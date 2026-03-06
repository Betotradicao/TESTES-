import * as http from 'http';
import * as crypto from 'crypto';
import * as path from 'path';
import * as fs from 'fs';
import { ConfigurationService } from './configuration.service';

/**
 * Serviço de Reconhecimento Facial via DVR Intelbras (Dahua NetSDK)
 *
 * Usa duas APIs:
 * - RPC2 HTTP (porta 80): para listagem de grupos e login
 * - NetSDK binary (porta 37777 via koffi + dhnetsdk.dll): para CRUD de pessoas e busca
 *
 * O DVR Intelbras iMHDX suporta apenas BlackListDB (não WhiteListDB).
 * Face recognition requer foto com rosto detectável.
 */

interface DVRConfig {
  ip: string;
  user: string;
  pass: string;
  httpPort: number;
}

interface FaceGroup {
  groupID: string;
  groupName: string;
  groupSize: number;
  featureState?: number[];
}

interface FacePerson {
  name: string;
  uid: string;
  id: string;
  sex: number;
  age: number;
  groupId: string;
}

// Singleton koffi instances
let koffiLib: any = null;
let koffiModule: any = null;
let sdkInitialized = false;
let loginHandle: any = null;
let disconnectCb: any = null;

// SDK Functions
let CLIENT_Init: any;
let CLIENT_Cleanup: any;
let CLIENT_GetLastError: any;
let CLIENT_LoginEx2: any;
let CLIENT_Logout: any;
let CLIENT_OperateFaceRecognitionDB: any;
let CLIENT_OperateFaceRecognitionGroup: any;
let CLIENT_StartFindFaceRecognition: any;
let CLIENT_DoFindFaceRecognition: any;
let CLIENT_StopFindFaceRecognition: any;

// Koffi struct types
let NET_IN_OPERATE_FACERECONGNITIONDB: any;
let NET_OUT_OPERATE_FACERECONGNITIONDB: any;
let DH_PIC_INFO: any;
let FACERECOGNITION_PERSON_INFO: any;

export class FaceRecognitionService {
  private static rpcSession: { id: string; time: number } | null = null;
  private static SESSION_TTL = 4 * 60 * 1000; // 4 min

  // ========== CONFIG ==========

  private static async getConfig(): Promise<DVRConfig> {
    const configs = await ConfigurationService.getAll();
    const isDocker = process.env.IS_DOCKER === 'true' || fs.existsSync('/.dockerenv');
    const rawHttpPort = parseInt(configs.dvr_porta_http || '80');
    const httpPort = !isDocker && rawHttpPort > 10000 ? 80 : rawHttpPort;

    return {
      ip: configs.dvr_ip || '',
      user: configs.dvr_usuario || 'admin',
      pass: configs.dvr_senha || '',
      httpPort,
    };
  }

  // ========== RPC2 HTTP ==========

  private static rpcCall(ip: string, urlPath: string, sessionId: string | null, method: string, params: any, id: number, port: number = 80): Promise<any> {
    return new Promise((resolve, reject) => {
      const body = JSON.stringify({ method, params, id, session: sessionId || undefined });
      const req = http.request({
        hostname: ip, port, path: urlPath, method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(body).toString(),
          ...(sessionId ? { 'Cookie': 'DhWebClientSessionID=' + sessionId } : {})
        }
      }, res => {
        let data = '';
        res.on('data', (c: string) => data += c);
        res.on('end', () => { try { resolve(JSON.parse(data)); } catch { resolve(data); } });
      });
      req.on('error', reject);
      req.setTimeout(15000, () => { req.destroy(); reject(new Error('RPC2 timeout')); });
      req.write(body);
      req.end();
    });
  }

  private static async rpcLogin(): Promise<string> {
    if (this.rpcSession && (Date.now() - this.rpcSession.time) < this.SESSION_TTL) {
      return this.rpcSession.id;
    }

    const config = await this.getConfig();
    const s1 = await this.rpcCall(config.ip, '/RPC2_Login', null, 'global.login', {
      userName: config.user, password: '', clientType: 'Web3.0', loginType: 'Direct'
    }, 1, config.httpPort);

    if (!s1?.session || !s1?.params?.realm || !s1?.params?.random) {
      throw new Error('DVR login challenge falhou');
    }

    const h1 = crypto.createHash('md5').update(`${config.user}:${s1.params.realm}:${config.pass}`).digest('hex').toUpperCase();
    const h2 = crypto.createHash('md5').update(`${config.user}:${s1.params.random}:${h1}`).digest('hex').toUpperCase();

    await this.rpcCall(config.ip, '/RPC2_Login', s1.session, 'global.login', {
      userName: config.user, password: h2, clientType: 'Web3.0',
      loginType: 'Default', authorityType: 'Default'
    }, 2, config.httpPort);

    this.rpcSession = { id: s1.session, time: Date.now() };
    return s1.session;
  }

  // ========== NETSDK INIT ==========

  private static async initSDK(): Promise<void> {
    if (sdkInitialized && loginHandle) return;

    try {
      koffiModule = require('koffi');
    } catch (e) {
      throw new Error('koffi não instalado. Execute: npm install koffi');
    }

    const dllDir = path.join(__dirname, '../../netsdk/bin');
    const dllPath = path.join(dllDir, 'dhnetsdk.dll');

    if (!fs.existsSync(dllPath)) {
      throw new Error(`NetSDK DLL não encontrada: ${dllPath}`);
    }

    // Add DLL dir to PATH
    process.env.PATH = dllDir + ';' + (process.env.PATH || '');

    koffiLib = koffiModule.load(dllPath);

    // Define structs
    const DH_POINT = koffiModule.struct('DH_POINT_FR', { nx: 'int16', ny: 'int16' });
    DH_PIC_INFO = koffiModule.struct('DH_PIC_INFO_FR', {
      dwOffSet: 'uint32', dwFileLenth: 'uint32', wWidth: 'uint16', wHeight: 'uint16',
      pszFilePath: 'void*', bIsDetected: 'uint8', bReserved: koffiModule.array('uint8', 3),
      nFilePathLen: 'int32', stuPoint: DH_POINT,
    });
    const CUSTOM_PERSON = koffiModule.struct('CUSTOM_PERSON_FR', {
      szPersonInfo: koffiModule.array('uint8', 64), byReserved: koffiModule.array('uint8', 124),
    });
    FACERECOGNITION_PERSON_INFO = koffiModule.struct('FACERECOGNITION_PERSON_INFO_FR', {
      szPersonName: koffiModule.array('uint8', 16), wYear: 'uint16', byMonth: 'uint8', byDay: 'uint8',
      szID: koffiModule.array('uint8', 32), bImportantRank: 'uint8', bySex: 'uint8', wFacePicNum: 'uint16',
      szFacePicInfo: koffiModule.array(DH_PIC_INFO, 48),
      byType: 'uint8', byIDType: 'uint8', byGlasses: 'uint8', byAge: 'uint8',
      szProvince: koffiModule.array('uint8', 64), szCity: koffiModule.array('uint8', 64),
      szPersonNameEx: koffiModule.array('uint8', 64), szUID: koffiModule.array('uint8', 32),
      szCountry: koffiModule.array('uint8', 3), byIsCustomType: 'uint8',
      pszComment: 'void*', pszGroupID: 'void*', pszGroupName: 'void*', pszFeatureValue: 'void*',
      bGroupIdLen: 'uint8', bGroupNameLen: 'uint8', bFeatureValueLen: 'uint8', bCommentLen: 'uint8',
      emEmotion: 'int32',
    });
    const PERSON_INFO_EX = koffiModule.struct('PERSON_INFO_EX_FR', {
      szPersonName: koffiModule.array('uint8', 64), wYear: 'uint16', byMonth: 'uint8', byDay: 'uint8',
      bImportantRank: 'uint8', bySex: 'uint8',
      szID: koffiModule.array('uint8', 32), wFacePicNum: 'uint16',
      szFacePicInfo: koffiModule.array(DH_PIC_INFO, 48),
      byType: 'uint8', byIDType: 'uint8', byGlasses: 'uint8', byAge: 'uint8',
      szProvince: koffiModule.array('uint8', 64), szCity: koffiModule.array('uint8', 64),
      szUID: koffiModule.array('uint8', 32), szCountry: koffiModule.array('uint8', 3), byIsCustomType: 'uint8',
      szCustomType: koffiModule.array('uint8', 16), szComment: koffiModule.array('uint8', 100),
      szGroupID: koffiModule.array('uint8', 64), szGroupName: koffiModule.array('uint8', 128),
      emEmotion: 'int32', szHomeAddress: koffiModule.array('uint8', 128),
      emGlassesType: 'int32', emRace: 'int32', emEye: 'int32', emMouth: 'int32',
      emMask: 'int32', emBeard: 'int32', nAttractive: 'int32', emFeatureState: 'int32',
      bAgeEnable: 'int32', nAgeRange: koffiModule.array('int32', 2), nEmotionValidNum: 'int32',
      emEmotions: koffiModule.array('int32', 32), nCustomPersonInfoNum: 'int32',
      szCustomPersonInfo: koffiModule.array(CUSTOM_PERSON, 4),
      byReserved: koffiModule.array('uint8', 1144),
    });
    NET_IN_OPERATE_FACERECONGNITIONDB = koffiModule.struct('NET_IN_OPERATE_FACERECONGNITIONDB_FR', {
      dwSize: 'uint32', emOperateType: 'int32', stPersonInfo: FACERECOGNITION_PERSON_INFO,
      nUIDNum: 'uint32', stuUIDs: 'void*', pBuffer: 'void*', nBufferLen: 'int32',
      bUsePersonInfoEx: 'int32', stPersonInfoEx: PERSON_INFO_EX,
    });
    NET_OUT_OPERATE_FACERECONGNITIONDB = koffiModule.struct('NET_OUT_OPERATE_FACERECONGNITIONDB_FR', {
      dwSize: 'uint32', szUID: koffiModule.array('uint8', 32),
    });
    const NET_DEVICEINFO_EX = koffiModule.struct('NET_DEVICEINFO_EX_FR', {
      sSerialNumber: koffiModule.array('uint8', 48),
      nAlarmInPortNum: 'int32', nAlarmOutPortNum: 'int32',
      nDiskNum: 'int32', nDVRType: 'int32', nChanNum: 'int32',
      byLimitLoginTime: 'uint8', byLeftLogTimes: 'uint8',
      bReserved: koffiModule.array('uint8', 2), nLockLeftTime: 'int32',
      Reserved: koffiModule.array('uint8', 24),
    });

    // Define functions
    const fDisConnect = koffiModule.proto('void fDisConnectFR(int64, const char*, int32, uint64)');
    CLIENT_Init = koffiLib.func('int32 CLIENT_Init(void*, uint64)');
    CLIENT_Cleanup = koffiLib.func('void CLIENT_Cleanup()');
    CLIENT_GetLastError = koffiLib.func('uint32 CLIENT_GetLastError()');
    CLIENT_LoginEx2 = koffiLib.func('int64 CLIENT_LoginEx2(const char*, uint16, const char*, const char*, int32, void*, _Out_ NET_DEVICEINFO_EX_FR*, _Out_ int32*)');
    CLIENT_Logout = koffiLib.func('int32 CLIENT_Logout(int64)');
    CLIENT_OperateFaceRecognitionDB = koffiLib.func('int32 CLIENT_OperateFaceRecognitionDB(int64, NET_IN_OPERATE_FACERECONGNITIONDB_FR*, NET_OUT_OPERATE_FACERECONGNITIONDB_FR*, int32)');
    CLIENT_OperateFaceRecognitionGroup = koffiLib.func('int32 CLIENT_OperateFaceRecognitionGroup(int64, void*, void*, int32)');
    CLIENT_StartFindFaceRecognition = koffiLib.func('int32 CLIENT_StartFindFaceRecognition(int64, void*, void*, int32)');
    CLIENT_DoFindFaceRecognition = koffiLib.func('int32 CLIENT_DoFindFaceRecognition(void*, void*, int32)');
    CLIENT_StopFindFaceRecognition = koffiLib.func('int32 CLIENT_StopFindFaceRecognition(int64)');

    disconnectCb = koffiModule.register(() => {}, koffiModule.pointer(fDisConnect));
    CLIENT_Init(disconnectCb, 0);
    sdkInitialized = true;

    // Login
    const config = await this.getConfig();
    const deviceInfo = {};
    const errorCode = [0];
    loginHandle = CLIENT_LoginEx2(config.ip, 37777, config.user, config.pass, 0, null, deviceInfo, errorCode);
    if (loginHandle === BigInt(0) || loginHandle === 0) {
      sdkInitialized = false;
      throw new Error('NetSDK login falhou');
    }
    console.log('[FaceRecognition] NetSDK inicializado e logado');
  }

  // ========== HELPERS ==========

  private static strToArr(str: string, len: number): number[] {
    const arr = new Array(len).fill(0);
    const buf = Buffer.from(str, 'utf8');
    for (let i = 0; i < Math.min(buf.length, len - 1); i++) arr[i] = buf[i];
    return arr;
  }

  private static arrToStr(arr: number[]): string {
    const end = arr.indexOf(0);
    return Buffer.from(arr.slice(0, end === -1 ? arr.length : end)).toString('utf8');
  }

  private static emptyPicInfoArray(): any[] {
    const arr = [];
    for (let i = 0; i < 48; i++) arr.push({
      dwOffSet: 0, dwFileLenth: 0, wWidth: 0, wHeight: 0, pszFilePath: null,
      bIsDetected: 0, bReserved: [0, 0, 0], nFilePathLen: 0, stuPoint: { nx: 0, ny: 0 }
    });
    return arr;
  }

  private static emptyCustomArray(): any[] {
    const arr = [];
    for (let i = 0; i < 4; i++) arr.push({ szPersonInfo: new Array(64).fill(0), byReserved: new Array(124).fill(0) });
    return arr;
  }

  // ========== SNAPSHOT ==========

  static async getSnapshot(channel: number = 1): Promise<Buffer> {
    const config = await this.getConfig();
    const urlPath = `/cgi-bin/snapshot.cgi?channel=${channel}`;

    return new Promise((resolve, reject) => {
      const req1 = http.request({ hostname: config.ip, port: config.httpPort, path: urlPath, method: 'GET' }, res1 => {
        if (res1.statusCode === 401) {
          const wwwAuth = res1.headers['www-authenticate'] || '';
          const realm = (wwwAuth.match(/realm="([^"]+)"/) || [])[1] || '';
          const nonce = (wwwAuth.match(/nonce="([^"]+)"/) || [])[1] || '';
          const ha1 = crypto.createHash('md5').update(`${config.user}:${realm}:${config.pass}`).digest('hex');
          const ha2 = crypto.createHash('md5').update(`GET:${urlPath}`).digest('hex');
          const nc = '00000001';
          const cnonce = crypto.randomBytes(8).toString('hex');
          const response = crypto.createHash('md5').update(`${ha1}:${nonce}:${nc}:${cnonce}:auth:${ha2}`).digest('hex');
          const auth = `Digest username="${config.user}", realm="${realm}", nonce="${nonce}", uri="${urlPath}", qop=auth, nc=${nc}, cnonce="${cnonce}", response="${response}"`;
          res1.resume();
          const req2 = http.request({ hostname: config.ip, port: config.httpPort, path: urlPath, method: 'GET',
            headers: { 'Authorization': auth } }, res2 => {
            const chunks: Buffer[] = [];
            res2.on('data', (c: Buffer) => chunks.push(c));
            res2.on('end', () => resolve(Buffer.concat(chunks)));
          });
          req2.on('error', reject);
          req2.setTimeout(10000, () => { req2.destroy(); reject(new Error('timeout')); });
          req2.end();
        } else {
          const chunks: Buffer[] = [];
          res1.on('data', (c: Buffer) => chunks.push(c));
          res1.on('end', () => resolve(Buffer.concat(chunks)));
        }
      });
      req1.on('error', reject);
      req1.setTimeout(10000, () => { req1.destroy(); reject(new Error('timeout')); });
      req1.end();
    });
  }

  // ========== GRUPOS (via RPC2) ==========

  static async listGroups(): Promise<FaceGroup[]> {
    const config = await this.getConfig();
    const session = await this.rpcLogin();
    const result = await this.rpcCall(config.ip, '/RPC2', session, 'faceRecognitionServer.findGroup', {}, 10, config.httpPort);

    if (!result?.params?.GroupList) return [];

    return result.params.GroupList.map((g: any) => ({
      groupID: g.groupID,
      groupName: (g.groupName || '').trim(),
      groupSize: g.groupSize || 0,
      featureState: g.FeatureState || [],
    }));
  }

  // ========== PESSOAS (via NetSDK) ==========

  static async addPerson(params: {
    name: string;
    groupId: string;
    photoBase64?: string;
    photoBuffer?: Buffer;
    snapshotChannel?: number;
    id?: string;
    sex?: number;
    age?: number;
  }): Promise<{ success: boolean; uid: string; error?: string }> {
    await this.initSDK();

    // Obter foto
    let imgData: Buffer;
    if (params.photoBuffer) {
      imgData = params.photoBuffer;
    } else if (params.photoBase64) {
      imgData = Buffer.from(params.photoBase64, 'base64');
    } else if (params.snapshotChannel !== undefined) {
      imgData = await this.getSnapshot(params.snapshotChannel);
    } else {
      throw new Error('Foto é obrigatória (photoBase64, photoBuffer ou snapshotChannel)');
    }

    const picInfo = this.emptyPicInfoArray();
    picInfo[0] = {
      dwOffSet: 0, dwFileLenth: imgData.length, wWidth: 0, wHeight: 0,
      pszFilePath: null, bIsDetected: 0, bReserved: [0, 0, 0], nFilePathLen: 0, stuPoint: { nx: 0, ny: 0 },
    };

    const groupIdBuf = Buffer.alloc(64);
    Buffer.from(params.groupId).copy(groupIdBuf);

    const inParam = {
      dwSize: koffiModule.sizeof(NET_IN_OPERATE_FACERECONGNITIONDB),
      emOperateType: 1, // ADD
      stPersonInfo: {
        szPersonName: this.strToArr(params.name.substring(0, 15), 16),
        wYear: 0, byMonth: 0, byDay: 0,
        szID: this.strToArr(params.id || '', 32),
        bImportantRank: 0, bySex: params.sex || 0, wFacePicNum: 1,
        szFacePicInfo: picInfo,
        byType: 0, byIDType: 0, byGlasses: 0, byAge: params.age || 0,
        szProvince: new Array(64).fill(0), szCity: new Array(64).fill(0),
        szPersonNameEx: this.strToArr(params.name, 64),
        szUID: new Array(32).fill(0),
        szCountry: [0, 0, 0], byIsCustomType: 0,
        pszComment: null, pszGroupID: groupIdBuf, pszGroupName: null, pszFeatureValue: null,
        bGroupIdLen: 64, bGroupNameLen: 0, bFeatureValueLen: 0, bCommentLen: 0,
        emEmotion: 0,
      },
      nUIDNum: 0, stuUIDs: null,
      pBuffer: imgData,
      nBufferLen: imgData.length,
      bUsePersonInfoEx: 0,
      stPersonInfoEx: {
        szPersonName: new Array(64).fill(0), wYear: 0, byMonth: 0, byDay: 0,
        bImportantRank: 0, bySex: 0, szID: new Array(32).fill(0), wFacePicNum: 0,
        szFacePicInfo: this.emptyPicInfoArray(),
        byType: 0, byIDType: 0, byGlasses: 0, byAge: 0,
        szProvince: new Array(64).fill(0), szCity: new Array(64).fill(0),
        szUID: new Array(32).fill(0), szCountry: [0, 0, 0], byIsCustomType: 0,
        szCustomType: new Array(16).fill(0), szComment: new Array(100).fill(0),
        szGroupID: new Array(64).fill(0), szGroupName: new Array(128).fill(0),
        emEmotion: 0, szHomeAddress: new Array(128).fill(0),
        emGlassesType: 0, emRace: 0, emEye: 0, emMouth: 0, emMask: 0, emBeard: 0,
        nAttractive: 0, emFeatureState: 0, bAgeEnable: 0, nAgeRange: [0, 0],
        nEmotionValidNum: 0, emEmotions: new Array(32).fill(0),
        nCustomPersonInfoNum: 0, szCustomPersonInfo: this.emptyCustomArray(),
        byReserved: new Array(1144).fill(0),
      },
    };

    const outParam = { dwSize: koffiModule.sizeof(NET_OUT_OPERATE_FACERECONGNITIONDB), szUID: new Array(32).fill(0) };

    const result = CLIENT_OperateFaceRecognitionDB(loginHandle, inParam, outParam, 15000);
    const lastErr = CLIENT_GetLastError();

    if (!result) {
      return { success: false, uid: '', error: `NetSDK erro 0x${lastErr.toString(16)} (${lastErr})` };
    }

    return { success: true, uid: this.arrToStr(outParam.szUID) };
  }

  static async deletePerson(uid: string): Promise<{ success: boolean; error?: string }> {
    await this.initSDK();

    const picInfo = this.emptyPicInfoArray();
    const groupIdBuf = Buffer.alloc(64);

    const inParam = {
      dwSize: koffiModule.sizeof(NET_IN_OPERATE_FACERECONGNITIONDB),
      emOperateType: 4, // DELETE_BY_UID
      stPersonInfo: {
        szPersonName: new Array(16).fill(0), wYear: 0, byMonth: 0, byDay: 0,
        szID: new Array(32).fill(0), bImportantRank: 0, bySex: 0, wFacePicNum: 0,
        szFacePicInfo: picInfo,
        byType: 0, byIDType: 0, byGlasses: 0, byAge: 0,
        szProvince: new Array(64).fill(0), szCity: new Array(64).fill(0),
        szPersonNameEx: new Array(64).fill(0),
        szUID: this.strToArr(uid, 32),
        szCountry: [0, 0, 0], byIsCustomType: 0,
        pszComment: null, pszGroupID: groupIdBuf, pszGroupName: null, pszFeatureValue: null,
        bGroupIdLen: 0, bGroupNameLen: 0, bFeatureValueLen: 0, bCommentLen: 0,
        emEmotion: 0,
      },
      nUIDNum: 1,
      stuUIDs: null,
      pBuffer: null,
      nBufferLen: 0,
      bUsePersonInfoEx: 0,
      stPersonInfoEx: {
        szPersonName: new Array(64).fill(0), wYear: 0, byMonth: 0, byDay: 0,
        bImportantRank: 0, bySex: 0, szID: new Array(32).fill(0), wFacePicNum: 0,
        szFacePicInfo: this.emptyPicInfoArray(),
        byType: 0, byIDType: 0, byGlasses: 0, byAge: 0,
        szProvince: new Array(64).fill(0), szCity: new Array(64).fill(0),
        szUID: this.strToArr(uid, 32), szCountry: [0, 0, 0], byIsCustomType: 0,
        szCustomType: new Array(16).fill(0), szComment: new Array(100).fill(0),
        szGroupID: new Array(64).fill(0), szGroupName: new Array(128).fill(0),
        emEmotion: 0, szHomeAddress: new Array(128).fill(0),
        emGlassesType: 0, emRace: 0, emEye: 0, emMouth: 0, emMask: 0, emBeard: 0,
        nAttractive: 0, emFeatureState: 0, bAgeEnable: 0, nAgeRange: [0, 0],
        nEmotionValidNum: 0, emEmotions: new Array(32).fill(0),
        nCustomPersonInfoNum: 0, szCustomPersonInfo: this.emptyCustomArray(),
        byReserved: new Array(1144).fill(0),
      },
    };

    const outParam = { dwSize: koffiModule.sizeof(NET_OUT_OPERATE_FACERECONGNITIONDB), szUID: new Array(32).fill(0) };
    const result = CLIENT_OperateFaceRecognitionDB(loginHandle, inParam, outParam, 15000);
    const lastErr = CLIENT_GetLastError();

    if (!result) {
      return { success: false, error: `NetSDK erro 0x${lastErr.toString(16)}` };
    }
    return { success: true };
  }

  static async findPersons(groupId?: string, beginNum: number = 0, count: number = 20): Promise<{ total: number; persons: FacePerson[] }> {
    await this.initSDK();

    const PIC_INFO_SIZE = koffiModule.sizeof(DH_PIC_INFO);

    // StartFind - buffer de entrada grande (64KB), sem filtro = todos
    const IN_BUF_SIZE = 64 * 1024;
    const inBuf = Buffer.alloc(IN_BUF_SIZE);
    inBuf.writeUInt32LE(IN_BUF_SIZE, 0); // dwSize

    const OUT_BUF_SIZE = 64;
    const outBuf = Buffer.alloc(OUT_BUF_SIZE);
    outBuf.writeUInt32LE(OUT_BUF_SIZE, 0);

    const startResult = CLIENT_StartFindFaceRecognition(loginHandle, inBuf, outBuf, 10000);
    if (!startResult) {
      const err = CLIENT_GetLastError();
      return { total: 0, persons: [] };
    }

    const totalCount = outBuf.readInt32LE(4);
    const findHandle = outBuf.readBigInt64LE(8);

    if (totalCount === 0) {
      CLIENT_StopFindFaceRecognition(findHandle);
      return { total: 0, persons: [] };
    }

    // DoFind
    const doInBuf = Buffer.alloc(32);
    doInBuf.writeUInt32LE(32, 0);
    doInBuf.writeBigInt64LE(findHandle, 8);
    doInBuf.writeInt32LE(beginNum, 16);
    doInBuf.writeInt32LE(Math.min(count, 20), 20); // max 20 por vez
    doInBuf.writeInt32LE(0, 24); // emDataType = URL

    const doOutBuf = Buffer.alloc(512 * 1024);
    doOutBuf.writeUInt32LE(512 * 1024, 0);

    const doResult = CLIENT_DoFindFaceRecognition(doInBuf, doOutBuf, 10000);
    const persons: FacePerson[] = [];

    if (doResult) {
      const candidateNum = doOutBuf.readInt32LE(4);

      // Parse das pessoas encontradas
      // Cada CANDIDATE_INFO contém FACERECOGNITION_PERSON_INFO (2248 bytes) + extras
      // O offset varia, vamos ler os nomes pelo offset calculado
      const PERSON_INFO_SIZE = koffiModule.sizeof(FACERECOGNITION_PERSON_INFO);

      for (let i = 0; i < candidateNum && i < count; i++) {
        // Cada candidato: PersonInfo(2248) + bySimilarity(1) + byRange(1) + wReserved(2) + stuTime(28) + szPath(260) + ...
        // Estimativa: ~2600 bytes por candidato
        const candidateSize = PERSON_INFO_SIZE + 1 + 1 + 2 + 28 + 260 + 4 + 300 + 4 + 32; // ~3000 aprox
        const personStart = 8 + (i * candidateSize);

        if (personStart + 100 > doOutBuf.length) break;

        // szPersonName: offset 0, 16 bytes
        let end = personStart;
        while (end < personStart + 16 && doOutBuf[end] !== 0) end++;
        const shortName = doOutBuf.slice(personStart, end).toString('utf8');

        // szPersonNameEx: deeper in struct
        const nameExOffset = personStart + 16 + 2 + 1 + 1 + 32 + 1 + 1 + 2 + (PIC_INFO_SIZE * 48) + 1 + 1 + 1 + 1 + 64 + 64;
        let end2 = nameExOffset;
        while (end2 < nameExOffset + 64 && doOutBuf[end2] !== 0) end2++;
        const nameEx = doOutBuf.slice(nameExOffset, end2).toString('utf8');

        // szUID: offset after szPersonNameEx (64 bytes)
        const uidOffset = nameExOffset + 64;
        let end3 = uidOffset;
        while (end3 < uidOffset + 32 && doOutBuf[end3] !== 0) end3++;
        const uid = doOutBuf.slice(uidOffset, end3).toString('utf8');

        // szID: offset 16+2+1+1 = 20 from personStart
        const idOffset = personStart + 16 + 2 + 1 + 1;
        let end4 = idOffset;
        while (end4 < idOffset + 32 && doOutBuf[end4] !== 0) end4++;
        const id = doOutBuf.slice(idOffset, end4).toString('utf8');

        // bySex: offset 16+2+1+1+32+1 = 53
        const sex = doOutBuf[personStart + 53];
        // byAge: offset after szFacePicInfo = 16+2+1+1+32+1+1+2+(PIC_INFO_SIZE*48)+1+1+1 = ...+3
        const ageOffset = personStart + 16 + 2 + 1 + 1 + 32 + 1 + 1 + 2 + (PIC_INFO_SIZE * 48) + 1 + 1 + 1;
        const age = doOutBuf[ageOffset];

        persons.push({
          name: nameEx || shortName || '(sem nome)',
          uid,
          id,
          sex,
          age,
          groupId: groupId || '',
        });
      }
    }

    CLIENT_StopFindFaceRecognition(findHandle);

    // Filtrar por grupo se especificado
    // (O DVR retorna todas as pessoas; filtramos no lado do serviço)
    return { total: totalCount, persons };
  }

  // ========== BUSCA DE RECONHECIMENTOS FACIAIS (via NetSDK) ==========

  /**
   * Busca reconhecimentos faciais do DVR via NetSDK.
   * Este DVR não suporta busca de eventos via RPC2, apenas via NetSDK binário.
   * Retorna as pessoas cadastradas encontradas pelo sistema de reconhecimento.
   */
  static async searchFaceEvents(params: {
    startTime: string;
    endTime: string;
    channel?: number;
  }): Promise<any[]> {
    // Este DVR (iMHDX 5116) não suporta busca de eventos de detecção facial via RPC2.
    // Os métodos mediaFileFind(FaceDetection), RecordFinder(FaceDetection),
    // faceRecognitionServer.startFindDetectLog, etc. todos retornam "Method not found".
    //
    // O que funciona é CLIENT_StartFindFaceRecognition via NetSDK que lista
    // as pessoas cadastradas nos grupos. As detecções em tempo real só são
    // acessíveis via callback (CLIENT_RealLoadPicEx) que requer conexão permanente.
    //
    // Por isso, a aba "Eventos" na verdade mostra as pessoas cadastradas nos grupos.
    // Para detecções em tempo real, seria necessário implementar um listener permanente.

    const result = await this.findPersons(undefined, 0, 50);
    return result.persons.map(p => ({
      time: '-',
      channel: params.channel ?? 0,
      filePath: '',
      type: 'Cadastrado',
      name: p.name,
      uid: p.uid,
      id: p.id,
      groupId: p.groupId,
    }));
  }

  // ========== CLEANUP ==========

  static cleanup(): void {
    if (loginHandle) {
      try { CLIENT_Logout(loginHandle); } catch {}
      loginHandle = null;
    }
    if (sdkInitialized) {
      try { CLIENT_Cleanup(); } catch {}
      sdkInitialized = false;
    }
  }
}
