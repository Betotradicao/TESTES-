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

// Cache de buffers de detecção para download de imagens
// Key: filePath hash, Value: Buffer raw do MEDIAFILE_FACE_DETECTION_INFO
const detectionBufferCache = new Map<string, Buffer>();

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
let CLIENT_FindFileEx: any;
let CLIENT_FindNextFileEx: any;
let CLIENT_FindCloseEx: any;
let CLIENT_DownloadMediaFile: any;
let CLIENT_StopDownloadMediaFile: any;
let downloadPosCb: any; // Callback registrado uma vez para download

// Koffi struct types
let NET_IN_OPERATE_FACERECONGNITIONDB: any;
let NET_OUT_OPERATE_FACERECONGNITIONDB: any;
let DH_PIC_INFO: any;
let FACERECOGNITION_PERSON_INFO: any;
let NET_TIME_FD: any;
let NET_TIME_EX_FD: any;
let MEDIAFILE_FACE_DETECTION_PARAM: any;
let MEDIAFILE_FACE_DETECTION_INFO: any;

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
    // Face Detection structs (declared early so we can use them in function signatures)
    NET_TIME_FD = koffiModule.struct('NET_TIME_FD', {
      dwYear: 'uint32', dwMonth: 'uint32', dwDay: 'uint32',
      dwHour: 'uint32', dwMinute: 'uint32', dwSecond: 'uint32',
    });
    NET_TIME_EX_FD = koffiModule.struct('NET_TIME_EX_FD', {
      dwYear: 'uint32', dwMonth: 'uint32', dwDay: 'uint32',
      dwHour: 'uint32', dwMinute: 'uint32', dwSecond: 'uint32',
      dwMillisecond: 'uint32', dwUTC: 'uint32', dwReserved: koffiModule.array('uint32', 1),
    });
    const FACE_DETECTION_DETAIL_PARAM = koffiModule.struct('FACE_DETECTION_DETAIL_PARAM', {
      dwSize: 'uint32', dwObjectId: 'uint32', dwFrameSequence: 'uint32', stTime: NET_TIME_EX_FD,
    });
    MEDIAFILE_FACE_DETECTION_PARAM = koffiModule.struct('MEDIAFILE_FACE_DETECTION_PARAM_FD', {
      dwSize: 'uint32', nChannelID: 'int32',
      stuStartTime: NET_TIME_FD, stuEndTime: NET_TIME_FD,
      emPicType: 'int32', bDetailEnable: 'int32',
      stuDetail: FACE_DETECTION_DETAIL_PARAM,
      emSex: 'int32', bAgeEnable: 'int32',
      nAgeRange: koffiModule.array('int32', 2),
      nEmotionValidNum: 'int32',
      emEmotion: koffiModule.array('int32', 32),
      emGlasses: 'int32', emMask: 'int32', emBeard: 'int32',
    });
    MEDIAFILE_FACE_DETECTION_INFO = koffiModule.struct('MEDIAFILE_FACE_DETECTION_INFO_FD', {
      dwSize: 'uint32', ch: 'uint32',
      szFilePath: koffiModule.array('uint8', 128),
      size: 'uint32', starttime: NET_TIME_FD, endtime: NET_TIME_FD,
      nWorkDirSN: 'uint32',
      nFileType: 'uint8', bHint: 'uint8', bDriveNo: 'uint8', byPictureType: 'uint8',
      nCluster: 'uint32', emPicType: 'int32', dwObjectId: 'uint32',
      dwFrameSequence: koffiModule.array('uint32', 2),
      nFrameSequenceNum: 'int32',
      stTimes: koffiModule.array(NET_TIME_EX_FD, 2),
      nTimeStampNum: 'int32', nPicIndex: 'int32',
      emSex: 'int32', nAge: 'int32', emEmotion: 'int32',
      emGlasses: 'int32', sizeEx: 'int64',
      emMask: 'int32', emBeard: 'int32', emRace: 'int32',
      emEye: 'int32', emMouth: 'int32', nAttractive: 'int32',
    });

    CLIENT_FindFileEx = koffiLib.func('int64 CLIENT_FindFileEx(int64, int32, MEDIAFILE_FACE_DETECTION_PARAM_FD*, void*, int32)');
    CLIENT_FindNextFileEx = koffiLib.func('int32 CLIENT_FindNextFileEx(int64, int32, void*, int32, void*, int32)');
    CLIENT_FindCloseEx = koffiLib.func('int32 CLIENT_FindCloseEx(int64)');

    // Download media file (face detection images)
    const fDownLoadPosCallBackProto = koffiModule.proto('void fDownLoadPosCallBackFD(int64, uint32, uint32, uint64)');
    CLIENT_DownloadMediaFile = koffiLib.func('int64 CLIENT_DownloadMediaFile(int64, int32, void*, const char*, void*, uint64, void*)');
    CLIENT_StopDownloadMediaFile = koffiLib.func('int32 CLIENT_StopDownloadMediaFile(int64)');
    downloadPosCb = koffiModule.register(() => {}, koffiModule.pointer(fDownLoadPosCallBackProto));

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

  // ========== PESSOAS VIA RPC2 (com fotos) ==========

  /**
   * Lista pessoas de um grupo via RPC2 (retorna URLs de fotos)
   */
  static async findPersonsRPC(groupId: string, offset: number = 0, count: number = 20): Promise<{ total: number; persons: any[] }> {
    const config = await this.getConfig();
    const session = await this.rpcLogin();

    // StartFind
    const startResult = await this.rpcCall(config.ip, '/RPC2', session, 'faceRecognitionServer.startFind', {
      condition: { GroupID: [groupId] }
    }, 20, config.httpPort);

    console.log('[FaceRecognition] RPC startFind result:', JSON.stringify(startResult));

    if (!startResult?.params?.token && startResult?.params?.token !== 0) {
      throw new Error('startFind falhou: ' + JSON.stringify(startResult));
    }

    const token = startResult.params.token;
    const total = startResult.params.totalCount || 0;

    if (total === 0) {
      await this.rpcCall(config.ip, '/RPC2', session, 'faceRecognitionServer.stopFind', { token }, 22, config.httpPort);
      return { total: 0, persons: [] };
    }

    // DoFind
    const doResult = await this.rpcCall(config.ip, '/RPC2', session, 'faceRecognitionServer.doFind', {
      token, count, offset
    }, 21, config.httpPort);

    console.log('[FaceRecognition] RPC doFind result keys:', doResult?.params ? Object.keys(doResult.params) : 'none');
    if (doResult?.params?.PersonList?.[0]) {
      console.log('[FaceRecognition] First person keys:', Object.keys(doResult.params.PersonList[0]));
    }

    // StopFind
    await this.rpcCall(config.ip, '/RPC2', session, 'faceRecognitionServer.stopFind', { token }, 22, config.httpPort);

    const personList = doResult?.params?.PersonList || [];
    const persons = personList.map((p: any) => ({
      name: p.PersonName || p.Name || '',
      uid: p.UID || '',
      id: p.ID || p.CertificateNo || '',
      sex: p.Sex === 'Male' ? 1 : p.Sex === 'Female' ? 2 : (typeof p.Sex === 'number' ? p.Sex : 0),
      age: p.Age || 0,
      groupId: groupId,
      photoUrl: p.Photo?.[0]?.PhotoURL || p.PhotoURL || '',
      photoCount: p.Photo?.length || 0,
    }));

    return { total, persons };
  }

  /**
   * Baixa uma foto de pessoa do DVR via RPC_Loadfile
   */
  static async getPersonPhoto(photoUrl: string): Promise<Buffer> {
    const config = await this.getConfig();
    const session = await this.rpcLogin();

    // O DVR serve fotos via /RPC_Loadfile/<path>
    // O photoUrl já contém o path relativo
    const urlPath = photoUrl.startsWith('/') ? photoUrl : `/RPC_Loadfile/${photoUrl}`;

    return new Promise((resolve, reject) => {
      const req = http.request({
        hostname: config.ip,
        port: config.httpPort,
        path: urlPath,
        method: 'GET',
        headers: {
          'Cookie': 'DhWebClientSessionID=' + session
        }
      }, res => {
        const chunks: Buffer[] = [];
        res.on('data', (c: Buffer) => chunks.push(c));
        res.on('end', () => {
          const buf = Buffer.concat(chunks);
          if (buf.length < 100) {
            // Pode ser erro JSON
            const text = buf.toString('utf8');
            console.log('[FaceRecognition] Photo response:', text);
          }
          resolve(buf);
        });
      });
      req.on('error', reject);
      req.setTimeout(15000, () => { req.destroy(); reject(new Error('timeout photo')); });
      req.end();
    });
  }

  /**
   * Baixa uma imagem de deteccao facial do DVR via NetSDK CLIENT_DownloadMediaFile
   * filePath: /IntelliStorage/mnt/0-165018-1-0-0-0:328431&E=FaceDetection&I=1249745.jpg
   */
  static async getDetectionImage(filePath: string): Promise<Buffer> {
    await this.initSDK();

    // Criar diretório temporário para imagens
    const tmpDir = path.join(__dirname, '../../tmp-faces');
    if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });

    // Gerar nome de arquivo único baseado no hash do filePath
    const hash = crypto.createHash('md5').update(filePath).digest('hex');
    const tmpFile = path.join(tmpDir, `face-${hash}.jpg`);

    // Se já existe em cache de disco, retornar direto
    if (fs.existsSync(tmpFile)) {
      const cached = fs.readFileSync(tmpFile);
      if (cached.length > 100) {
        return cached;
      }
      fs.unlinkSync(tmpFile);
    }

    // Buscar o buffer raw da detecção no cache em memória
    const cacheKey = hash;
    const infoBuf = detectionBufferCache.get(cacheKey);

    if (!infoBuf) {
      console.error(`[FaceDetection] Buffer nao encontrado no cache para: ${filePath.slice(0, 80)}`);
      throw new Error('Deteccao nao encontrada no cache. Execute a busca novamente.');
    }

    console.log(`[FaceDetection] Baixando imagem via NetSDK: ${filePath.slice(0, 80)}`);

    // Usar Promise com callback que detecta quando download completa
    return new Promise<Buffer>((resolve, reject) => {
      let downloadComplete = false;
      let dlHandle: any = null;

      // Callback que monitora progresso do download
      const progressCb = koffiModule.register(
        (_handle: any, totalSize: number, downloadSize: number, _userData: any) => {
          console.log(`[FaceDetection] Download progress: ${downloadSize}/${totalSize}`);
          if (downloadSize >= totalSize && totalSize > 0) {
            downloadComplete = true;
          }
        },
        koffiModule.pointer(koffiModule.proto('void fDLProgCb_' + hash.slice(0, 8) + '(int64, uint32, uint32, uint64)'))
      );

      try {
        dlHandle = CLIENT_DownloadMediaFile(loginHandle, 6, infoBuf, tmpFile, progressCb, 0, null);

        if (!dlHandle || dlHandle === BigInt(0) || dlHandle === 0) {
          const err = CLIENT_GetLastError();
          return reject(new Error(`Download falhou: erro 0x${err.toString(16)}`));
        }

        // Polling: aguardar callback sinalizar conclusão
        const maxWait = 20000;
        const startMs = Date.now();
        const poll = setInterval(() => {
          if (downloadComplete || Date.now() - startMs > maxWait) {
            clearInterval(poll);
            // Dar tempo extra para flush do arquivo
            setTimeout(() => {
              try {
                CLIENT_StopDownloadMediaFile(dlHandle);
              } catch {}

              if (fs.existsSync(tmpFile)) {
                const imgData = fs.readFileSync(tmpFile);
                // Verificar se é JPEG válido (ff d8 ff)
                if (imgData.length > 100 && imgData[0] === 0xff && imgData[1] === 0xd8) {
                  console.log(`[FaceDetection] Imagem JPEG baixada: ${imgData.length} bytes`);
                  resolve(imgData);
                } else if (imgData.length > 100) {
                  console.log(`[FaceDetection] Arquivo baixado (${imgData.length} bytes) - hex: ${imgData.subarray(0, 10).toString('hex')}`);
                  resolve(imgData);
                } else {
                  reject(new Error('Download completou mas arquivo vazio'));
                }
              } else {
                reject(new Error('Arquivo de download nao encontrado'));
              }
            }, 1000);
          }
        }, 200);
      } catch (err: any) {
        reject(err);
      }
    });
  }

  // ========== BUSCA DE DETECCOES FACIAIS DO DIA (via NetSDK CLIENT_FindFileEx) ==========

  private static readonly SEX_MAP: Record<number, string> = {
    0: 'Desconhecido', 1: 'Masculino', 2: 'Feminino',
  };
  private static readonly EMOTION_MAP: Record<number, string> = {
    0: 'Desconhecido', 1: 'Oculos', 2: 'Sorrindo', 3: 'Raiva',
    4: 'Tristeza', 5: 'Nojo', 6: 'Medo', 7: 'Surpresa', 8: 'Neutro',
  };
  private static readonly GLASSES_MAP: Record<number, string> = {
    0: 'Desconhecido', 1: 'Com oculos', 2: 'Sem oculos',
  };
  private static readonly MASK_MAP: Record<number, string> = {
    0: 'Desconhecido', 1: 'Indistinto', 2: 'Sem mascara', 3: 'Com mascara',
  };
  private static readonly BEARD_MAP: Record<number, string> = {
    0: 'Desconhecido', 1: 'Indistinto', 2: 'Sem barba', 3: 'Com barba',
  };
  private static readonly RACE_MAP: Record<number, string> = {
    0: 'Desconhecido', 1: 'Indistinto', 2: 'Amarelo', 3: 'Negro', 4: 'Branco',
  };
  private static readonly EYE_MAP: Record<number, string> = {
    0: 'Desconhecido', 1: 'Indistinto', 2: 'Fechados', 3: 'Abertos',
  };
  private static readonly MOUTH_MAP: Record<number, string> = {
    0: 'Desconhecido', 1: 'Indistinto', 2: 'Fechada', 3: 'Aberta',
  };

  /**
   * Busca detecções faciais do DVR via CLIENT_FindFileEx (DH_FILE_QUERY_FACE_DETECTION = 6)
   * Retorna faces detectadas com atributos (idade, sexo, emoção, óculos, máscara, barba, etc.)
   */
  static async searchFaceDetections(params: {
    startTime: string;
    endTime: string;
    channel?: number;
    maxResults?: number;
  }): Promise<{ total: number; detections: any[] }> {
    await this.initSDK();

    // Parse start/end times "YYYY-MM-DD HH:MM:SS"
    const parseTime = (s: string) => {
      const [date, time] = s.split(' ');
      const [y, m, d] = (date || '').split('-').map(Number);
      const [h, mi, sec] = (time || '00:00:00').split(':').map(Number);
      return { dwYear: y || 2026, dwMonth: m || 1, dwDay: d || 1, dwHour: h || 0, dwMinute: mi || 0, dwSecond: sec || 0 };
    };

    const emptyTimeEx = { dwYear: 0, dwMonth: 0, dwDay: 0, dwHour: 0, dwMinute: 0, dwSecond: 0, dwMillisecond: 0, dwUTC: 0, dwReserved: [0] };

    const queryParam = {
      dwSize: koffiModule.sizeof(MEDIAFILE_FACE_DETECTION_PARAM),
      nChannelID: params.channel ?? -1,
      stuStartTime: parseTime(params.startTime),
      stuEndTime: parseTime(params.endTime),
      emPicType: 0,
      bDetailEnable: 0,
      stuDetail: { dwSize: 48, dwObjectId: 0, dwFrameSequence: 0, stTime: emptyTimeEx },
      emSex: 0,
      bAgeEnable: 0,
      nAgeRange: [0, 0],
      nEmotionValidNum: 0,
      emEmotion: new Array(32).fill(0),
      emGlasses: 0,
      emMask: 0,
      emBeard: 0,
    };

    console.log('[FaceDetection] Buscando deteccoes faciais:', JSON.stringify({
      channel: queryParam.nChannelID,
      start: params.startTime,
      end: params.endTime,
      paramSize: queryParam.dwSize,
    }));

    // FindFileEx: tipo 6 = DH_FILE_QUERY_FACE_DETECTION
    const findHandle = CLIENT_FindFileEx(loginHandle, 6, queryParam, null, 10000);
    console.log('[FaceDetection] FindFileEx handle:', findHandle?.toString());

    if (!findHandle || findHandle === BigInt(0) || findHandle === 0) {
      const err = CLIENT_GetLastError();
      console.error(`[FaceDetection] FindFileEx falhou. Erro: 0x${err.toString(16)} (${err})`);
      return { total: 0, detections: [] };
    }

    const maxResults = params.maxResults || 100;
    const detections: any[] = [];
    const INFO_SIZE = koffiModule.sizeof(MEDIAFILE_FACE_DETECTION_INFO);

    console.log('[FaceDetection] INFO_SIZE:', INFO_SIZE, 'bytes por deteccao');

    try {
      let totalFetched = 0;
      while (totalFetched < maxResults) {
        // Usar Buffer raw para receber dados do SDK
        const outBuf = Buffer.alloc(INFO_SIZE);
        // Inicializar dwSize no inicio do buffer
        outBuf.writeUInt32LE(INFO_SIZE, 0);

        const count = CLIENT_FindNextFileEx(findHandle, 1, outBuf, INFO_SIZE, null, 10000);

        if (count <= 0) break;

        // Decode usando koffi.decode
        const info: any = koffiModule.decode(outBuf, 0, MEDIAFILE_FACE_DETECTION_INFO);

        // Parse filePath from uint8 array
        const pathBytes: number[] = info.szFilePath;
        let pathEnd = pathBytes.indexOf(0);
        if (pathEnd < 0) pathEnd = pathBytes.length;
        const filePath = Buffer.from(pathBytes.slice(0, pathEnd)).toString('utf8');

        // Guardar buffer raw no cache para download posterior
        if (filePath) {
          const cacheKey = crypto.createHash('md5').update(filePath).digest('hex');
          detectionBufferCache.set(cacheKey, Buffer.from(outBuf));
        }

        const st = info.starttime;
        const startTime = `${st.dwYear}-${String(st.dwMonth).padStart(2, '0')}-${String(st.dwDay).padStart(2, '0')} ${String(st.dwHour).padStart(2, '0')}:${String(st.dwMinute).padStart(2, '0')}:${String(st.dwSecond).padStart(2, '0')}`;

        if (totalFetched === 0) {
          console.log('[FaceDetection] Primeira deteccao raw:', JSON.stringify({
            ch: info.ch, filePath, size: info.size, startTime,
            emSex: info.emSex, nAge: info.nAge, emEmotion: info.emEmotion,
            emGlasses: info.emGlasses, emMask: info.emMask, emBeard: info.emBeard,
          }));
          // Debug: dump first 64 bytes as hex
          console.log('[FaceDetection] Raw hex (first 64):', outBuf.slice(0, 64).toString('hex'));
          console.log('[FaceDetection] Raw hex (140-200):', outBuf.slice(140, 200).toString('hex'));
        }

        detections.push({
          channel: info.ch,
          filePath,
          fileSize: info.size,
          startTime,
          objectId: info.dwObjectId,
          picType: info.emPicType,
          pictureType: info.byPictureType,
          sex: this.SEX_MAP[info.emSex] || 'Desconhecido',
          sexCode: info.emSex,
          age: info.nAge,
          emotion: this.EMOTION_MAP[info.emEmotion] || 'Desconhecido',
          emotionCode: info.emEmotion,
          glasses: this.GLASSES_MAP[info.emGlasses] || 'Desconhecido',
          glassesCode: info.emGlasses,
          mask: this.MASK_MAP[info.emMask] || 'Desconhecido',
          maskCode: info.emMask,
          beard: this.BEARD_MAP[info.emBeard] || 'Desconhecido',
          beardCode: info.emBeard,
          race: this.RACE_MAP[info.emRace] || 'Desconhecido',
          raceCode: info.emRace,
          eye: this.EYE_MAP[info.emEye] || 'Desconhecido',
          eyeCode: info.emEye,
          mouth: this.MOUTH_MAP[info.emMouth] || 'Desconhecido',
          mouthCode: info.emMouth,
          attractive: info.nAttractive,
        });

        totalFetched++;
      }
    } finally {
      CLIENT_FindCloseEx(findHandle);
    }

    console.log(`[FaceDetection] Total deteccoes encontradas: ${detections.length}`);
    return { total: detections.length, detections };
  }

  /**
   * Busca reconhecimentos faciais (wrapper que agora usa searchFaceDetections)
   */
  static async searchFaceEvents(params: {
    startTime: string;
    endTime: string;
    channel?: number;
  }): Promise<any[]> {
    try {
      const result = await this.searchFaceDetections(params);
      return result.detections;
    } catch (err: any) {
      console.error('[FaceDetection] Erro na busca, fallback para pessoas:', err.message);
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
