# Face Recognition API - Guia de Integração DVR Intelbras/Dahua

## Resumo

Este documento descreve como acessar e gerenciar o módulo de **reconhecimento facial** dos DVRs Intelbras (baseados em Dahua) através de duas APIs:

1. **RPC2 HTTP API** (porta 80) - JSON-RPC via HTTP, limitado
2. **NetSDK Binary Protocol** (porta 37777) - Protocolo binário via DLL/SO, completo

O DVR testado é o **iMHDX 5116** (firmware 4.001.00IB000.0.R), que suporta **detecção facial** (FaceDetection) mas com suporte limitado via HTTP para operações de banco de dados facial.

---

## Capabilities do DVR

Via `faceRecognitionServer.getCaps` (RPC2):
```json
{
  "detectMethod": 1,
  "function": 0,          // 0 = detection only (via HTTP)
  "multiFind": true,
  "supportGroupNum": 16,
  "supportPersonNum": 10000
}
```

- `function: 0` = Apenas detecção via HTTP, operações de DB de face requerem **NetSDK**
- O DVR suporta até 16 grupos e 10.000 pessoas
- FaceAnalysis ativo nos canais **0** e **15** (VideoAnalyseRule)
- Atributos detectados: Sexo, Idade, Óculos, Máscara, Barba, Emoção

---

## API 1: RPC2 HTTP (porta 80)

### Autenticação
Login em dois passos (challenge-response MD5):
```javascript
// Passo 1: Obter realm e random
POST /RPC2_Login
{ "method": "global.login", "params": { "userName": "admin", "password": "", "clientType": "Web3.0", "loginType": "Direct" } }

// Passo 2: Enviar hash
const h1 = md5(user + ':' + realm + ':' + password).toUpperCase();
const h2 = md5(user + ':' + random + ':' + h1).toUpperCase();
POST /RPC2_Login
{ "method": "global.login", "params": { "userName": "admin", "password": h2, ... } }
```

### Operações que FUNCIONAM via RPC2

#### Listar Grupos de Face
```javascript
POST /RPC2
{ "method": "faceRecognitionServer.findGroup", "params": {}, "id": 10 }

// Resposta:
{
  "params": {
    "GroupList": [
      {
        "groupID": "1",
        "groupName": "teste",
        "groupType": "BlackListDB",
        "groupSize": 1,
        "FeatureState": [0, 1, 0, 0]
      }
    ]
  }
}
```

**FeatureState significado:**
- `[0]` = Pessoas pendentes de modelar
- `[1]` = Pessoas que falharam no modelar (precisa trocar foto)
- `[2]` = Pessoas modeladas com sucesso (prontas para reconhecimento)
- `[3]` = Modeladas antes mas incompatíveis após upgrade

**GroupType:**
- `BlackListDB` = Lista negra (alerta quando detectado)
- `WhiteListDB` = Lista branca (funcionários/conhecidos)
- `History` = Histórico de detecções
- `Alarm` = Alarme

#### Buscar Detecções de Face (Snapshots)
```javascript
// Usando mediaFileFind (padrão factory)
POST /RPC2 { "method": "mediaFileFind.factory.create" }
POST /RPC2 { "method": "mediaFileFind.findFile", "params": {
  "condition": {
    "Channel": 0,
    "StartTime": "2026-03-05 07:00:00",
    "EndTime": "2026-03-05 08:00:00",
    "Types": ["jpg"],
    "Flags": ["Event"],
    "Events": ["FaceDetection"]
  }
}, "object": objectId }
POST /RPC2 { "method": "mediaFileFind.findNextFile", "params": { "count": 10 }, "object": objectId }
```
Retorna arquivos JPG das detecções faciais (9.000+ por dia no canal 0).

#### startMultiFind (parcial)
```javascript
// startMultiFind FUNCIONA - retorna totalCount
POST /RPC2
{ "method": "faceRecognitionServer.startMultiFind", "params": {
  "condition": { "GroupId": ["1"] }
} }
// Retorna: { token: 18, totalCount: 1 }

// MAS doFind FALHA neste firmware (-267976701)
```

#### Capabilities
```javascript
POST /RPC2
{ "method": "faceRecognitionServer.getCaps", "params": {} }
```

### Operações que NÃO FUNCIONAM via RPC2 (neste firmware)

| Método | Resultado |
|--------|-----------|
| `faceRecognitionServer.doFind` | Erro -267976701 |
| `faceRecognitionServer.createGroup` | Erro -267976701 |
| `faceRecognitionServer.addPerson` | Method not found |
| `faceRecognitionServer.findPerson` | Method not found |
| `faceRecognitionServer.deletePerson` | Method not found |
| `faceRecognitionServer.modifyGroup` | Unknown error |
| Todos CGI de face (`/cgi-bin/faceRecognitionServer.cgi`) | 501 Not Implemented |

---

## API 2: NetSDK Binary Protocol (porta 37777)

### Setup

**Biblioteca:** `dhnetsdk.dll` (Windows) / `libdhnetsdk.so` (Linux)
**FFI:** Usamos `koffi` (npm) - não requer compilação nativa

```bash
npm install koffi
```

**Estrutura de arquivos:**
```
packages/backend/netsdk/
  bin/              # DLLs do NetSDK (dhnetsdk.dll + dependências)
  include/          # Headers C (dhnetsdk.h)
```

### Inicialização
```javascript
const koffi = require('koffi');
const path = require('path');

const dllDir = path.join(__dirname, 'netsdk', 'bin');
process.env.PATH = dllDir + ';' + process.env.PATH;
const lib = koffi.load(path.join(dllDir, 'dhnetsdk.dll'));

// Definir callback de desconexão
const fDisConnect = koffi.proto('void fDisConnect(int64, const char*, int32, uint64)');
const disconnectCb = koffi.register(() => {}, koffi.pointer(fDisConnect));

// Funções básicas
const CLIENT_Init = lib.func('int32 CLIENT_Init(void*, uint64)');
const CLIENT_Cleanup = lib.func('void CLIENT_Cleanup()');
const CLIENT_GetLastError = lib.func('uint32 CLIENT_GetLastError()');
```

### Login
```javascript
const NET_DEVICEINFO_Ex = koffi.struct('NET_DEVICEINFO_Ex', {
  sSerialNumber: koffi.array('uint8', 48),
  nAlarmInPortNum: 'int32', nAlarmOutPortNum: 'int32',
  nDiskNum: 'int32', nDVRType: 'int32', nChanNum: 'int32',
  byLimitLoginTime: 'uint8', byLeftLogTimes: 'uint8',
  bReserved: koffi.array('uint8', 2), nLockLeftTime: 'int32',
  Reserved: koffi.array('uint8', 24),
});

const CLIENT_LoginEx2 = lib.func('int64 CLIENT_LoginEx2(const char*, uint16, const char*, const char*, int32, void*, _Out_ NET_DEVICEINFO_Ex*, _Out_ int32*)');
const CLIENT_Logout = lib.func('int32 CLIENT_Logout(int64)');

CLIENT_Init(disconnectCb, 0);
const deviceInfo = {};
const errorCode = [0];
const loginHandle = CLIENT_LoginEx2('10.6.1.123', 37777, 'admin', 'senha', 0, null, deviceInfo, errorCode);
// loginHandle > 0 = sucesso
```

### Criar Grupo de Face (FUNCIONA!)
```javascript
const EM_GROUP_OP = { UNKNOWN: 0, ADD: 1, MODIFY: 2, DELETE: 3 };
const EM_FACE_DB_TYPE = { UNKNOWN: 0, HISTORY: 1, BLACKLIST: 2, WHITELIST: 3, ALARM: 4 };

const NET_IN_GROUP_OP = koffi.struct('NET_IN_GROUP_OP', {
  dwSize: 'uint32', emOperateType: 'int32', pOPerateInfo: 'void*',
});
const NET_OUT_GROUP_OP = koffi.struct('NET_OUT_GROUP_OP', {
  dwSize: 'uint32', szGroupId: koffi.array('uint8', 64),
});
const CLIENT_OperateFaceRecognitionGroup = lib.func(
  'int32 CLIENT_OperateFaceRecognitionGroup(int64, NET_IN_GROUP_OP*, NET_OUT_GROUP_OP*, int32)'
);

// NET_ADD_FACERECONGNITION_GROUP_INFO buffer:
// dwSize(4) + GROUP_INFO: dwSize(4) + emFaceDBType(4) + szGroupId(64) + szGroupName(128) + szGroupRemarks(256) + ...
const GROUP_INFO_SIZE = 4 + 4 + 64 + 128 + 256 + 4 + 4 + (4*1024) + 4 + (4*1024) + (4*4); // 8676
const ADD_GROUP_SIZE = 4 + GROUP_INFO_SIZE; // 8680

const buf = Buffer.alloc(ADD_GROUP_SIZE);
let off = 0;
buf.writeUInt32LE(ADD_GROUP_SIZE, off); off += 4;  // dwSize
buf.writeUInt32LE(GROUP_INFO_SIZE, off); off += 4; // stuGroupInfo.dwSize
buf.writeInt32LE(EM_FACE_DB_TYPE.BLACKLIST, off); off += 4; // emFaceDBType
off += 64; // szGroupId (vazio = auto)
Buffer.from('Nome do Grupo').copy(buf, off); // szGroupName

const inParam = { dwSize: koffi.sizeof(NET_IN_GROUP_OP), emOperateType: EM_GROUP_OP.ADD, pOPerateInfo: buf };
const outParam = { dwSize: koffi.sizeof(NET_OUT_GROUP_OP), szGroupId: new Array(64).fill(0) };
const result = CLIENT_OperateFaceRecognitionGroup(loginHandle, inParam, outParam, 5000);
// result === 1 → sucesso!
```

**IMPORTANTE:** Apenas `BlackListDB` funciona neste DVR. `WhiteListDB` retorna erro de parâmetro.

### Deletar Grupo
```javascript
// NET_DELETE_FACERECONGNITION_GROUP_INFO: dwSize(4) + szGroupId(64) = 68
const delBuf = Buffer.alloc(68);
delBuf.writeUInt32LE(68, 0);
Buffer.from('2').copy(delBuf, 4); // groupID a deletar

const delIn = { dwSize: koffi.sizeof(NET_IN_GROUP_OP), emOperateType: EM_GROUP_OP.DELETE, pOPerateInfo: delBuf };
const delOut = { dwSize: koffi.sizeof(NET_OUT_GROUP_OP), szGroupId: new Array(64).fill(0) };
CLIENT_OperateFaceRecognitionGroup(loginHandle, delIn, delOut, 5000);
```

### Cadastrar Pessoa com Foto (FUNCIONA!)
```javascript
const CLIENT_OperateFaceRecognitionDB = lib.func(
  'int32 CLIENT_OperateFaceRecognitionDB(int64, NET_IN_OPERATE_DB*, NET_OUT_OPERATE_DB*, int32)'
);

// Chave: usar stPersonInfo (não PersonInfoEx) com pszGroupID apontando para buffer
// E enviar imagem via pBuffer + nBufferLen

const imgData = fs.readFileSync('foto-rosto.jpg');
const groupIdBuf = Buffer.alloc(64);
Buffer.from('1').copy(groupIdBuf); // grupo alvo

const inParam = {
  dwSize: koffi.sizeof(NET_IN_OPERATE_DB),
  emOperateType: 1, // ADD
  stPersonInfo: {
    szPersonName: strToArr('Nome Pessoa', 16),
    wYear: 1990, byMonth: 5, byDay: 15,
    szID: strToArr('CPF123', 32),
    bImportantRank: 5, bySex: 0, // 0=male, 1=female
    wFacePicNum: 1,              // OBRIGATÓRIO: 1 foto
    szFacePicInfo: [{ dwOffSet: 0, dwFileLenth: imgData.length, ... }, ...47 vazios],
    byAge: 30,
    pszGroupID: groupIdBuf,      // OBRIGATÓRIO: ponteiro para ID do grupo
    bGroupIdLen: 64,
    // ... demais campos zerados
  },
  pBuffer: imgData,              // OBRIGATÓRIO: dados binários da imagem
  nBufferLen: imgData.length,
  bUsePersonInfoEx: 0,           // usar stPersonInfo (não PersonInfoEx)
  // ... PersonInfoEx zerado
};

const outParam = { dwSize: ..., szUID: new Array(32).fill(0) };
CLIENT_OperateFaceRecognitionDB(loginHandle, inParam, outParam, 15000);
```

**Requisitos para cadastro:**
1. `wFacePicNum` deve ser >= 1
2. `szFacePicInfo[0].dwFileLenth` deve conter o tamanho da imagem
3. `pBuffer` deve conter os dados binários da imagem (JPG)
4. `pszGroupID` deve apontar para buffer com o ID do grupo
5. `bGroupIdLen` deve ser 64

**Erros comuns:**
- `0x8000041a` (NET_ERROR_FACE_RECOGNITION_SERVER_MULTI_APPEND_ERROR) = Sem foto ou foto inválida
- `0x80000015` = Parâmetro inválido (ex: WhiteListDB não suportado)

### Listar Pessoas de um Grupo (FUNCIONA via NetSDK!)

**Via RPC2 (NÃO funciona):**
- `startMultiFind` retorna `totalCount` correto, mas `doFind` falha (-267976701)

**Via NetSDK (CLIENT_StartFindFaceRecognition + DoFind):**
```javascript
const CLIENT_StartFindFaceRecognition = lib.func('int32 CLIENT_StartFindFaceRecognition(int64, void*, void*, int32)');
const CLIENT_DoFindFaceRecognition = lib.func('int32 CLIENT_DoFindFaceRecognition(void*, void*, int32)');
const CLIENT_StopFindFaceRecognition = lib.func('int32 CLIENT_StopFindFaceRecognition(int64)');

// StartFind - buffer grande zerado (sem filtro = busca tudo)
const inBuf = Buffer.alloc(64 * 1024);
inBuf.writeUInt32LE(64 * 1024, 0); // dwSize

const outBuf = Buffer.alloc(64);
outBuf.writeUInt32LE(64, 0);

CLIENT_StartFindFaceRecognition(loginHandle, inBuf, outBuf, 10000);
const totalCount = outBuf.readInt32LE(4);
const findHandle = outBuf.readBigInt64LE(8);

// DoFind
const doInBuf = Buffer.alloc(32);
doInBuf.writeUInt32LE(32, 0);
doInBuf.writeBigInt64LE(findHandle, 8);  // lFindHandle
doInBuf.writeInt32LE(0, 16);             // nBeginNum
doInBuf.writeInt32LE(5, 20);             // nCount (max 20)

const doOutBuf = Buffer.alloc(512 * 1024);
doOutBuf.writeUInt32LE(512 * 1024, 0);

CLIENT_DoFindFaceRecognition(doInBuf, doOutBuf, 10000);
// doOutBuf offset 4 = nCadidateNum
// szPersonNameEx no offset ~2108 dentro de cada CANDIDATE_INFO

CLIENT_StopFindFaceRecognition(findHandle);
```
**Testado:** Retornou `szPersonNameEx: "Teste Via API NetSDK"` com sucesso.

---

## Structs Koffi Necessários

### Tamanhos (64-bit):
| Struct | Tamanho |
|--------|---------|
| DH_PIC_INFO | 40 bytes |
| FACERECOGNITION_PERSON_INFO | 2248 bytes |
| FACERECOGNITION_PERSON_INFOEX | 4712 bytes |
| NET_IN_OPERATE_FACERECONGNITIONDB | 7000 bytes |
| NET_OUT_OPERATE_FACERECONGNITIONDB | 36 bytes |
| NET_IN_GROUP_OP | 16 bytes |
| NET_OUT_GROUP_OP | 68 bytes |

### Constantes:
```
DH_MAX_NAME_LEN = 16
DH_MAX_PERSON_ID_LEN = 32
DH_MAX_PERSON_IMAGE_NUM = 48
DH_MAX_PERSON_NAME_LEN = 64
DH_MAX_PROVINCE_NAME_LEN = 64
DH_MAX_CITY_NAME_LEN = 64
DH_COMMON_STRING_64 = 64
DH_COMMON_STRING_128 = 128
DH_COMMON_STRING_256 = 256
MAX_SIMILARITY_COUNT = 1024
DH_MAX_CAMERA_CHANNEL_NUM = 1024
MAX_FEATURESTATE_NUM = 4
NET_COUNTRY_LENGTH = 3
NET_COMMENT_LENGTH = 100
NET_GROUPID_LENGTH = 64
NET_GROUPNAME_LENGTH = 128
```

---

## Snapshot ao Vivo (funciona via CGI)

```javascript
// Digest Auth necessária
GET /cgi-bin/snapshot.cgi?channel=1
// Retorna: JPEG ~47KB
```

---

## Compatibilidade Linux

O NetSDK está disponível para Linux:
- Caminho: `NetSDK 3.050/Linux/bin/libdhnetsdk.so`
- Mesmo código koffi funciona, apenas troca o caminho da lib
- koffi é cross-platform (Win/Linux/Mac)

---

## Arquivos de Teste

| Arquivo | Descrição |
|---------|-----------|
| `test-netsdk-koffi.js` | Conexão básica NetSDK (login/logout) |
| `test-netsdk-face.js` | GetNewDevConfig para configs de face |
| `test-netsdk-face2.js` | Comandos face via GetNewDevConfig |
| `test-netsdk-face3.js` | Primeiro teste de CRUD de grupos |
| `test-netsdk-face4.js` | CRUD grupos + verificação RPC2 |
| `test-netsdk-face5.js` | Teste cadastro pessoa (sem foto - falha) |
| `test-netsdk-face6.js` | Teste cadastro com PersonInfoEx |
| `test-netsdk-face7.js` | **SUCESSO** - cadastro com foto via snapshot |
| `test-netsdk-face8.js` | Tentativa de listar pessoas |
| `test-netsdk-face9.js` | Todos métodos RPC2 para listar pessoas |
| `test-dvr-face-crud.js` | CRUD via RPC2 (limitado) |
| `test-dvr-face-groups.js` | Busca de grupos via RPC2 |
| `test-dvr-face-groups2.js` | **findGroup funciona** - descoberta chave |

---

## Status das Operações

| Operação | Método | Status |
|----------|--------|--------|
| Listar grupos | RPC2 `faceRecognitionServer.findGroup` | ✅ Funciona |
| Criar grupo | NetSDK `CLIENT_OperateFaceRecognitionGroup` (ADD) | ✅ Funciona |
| Deletar grupo | NetSDK `CLIENT_OperateFaceRecognitionGroup` (DELETE) | ✅ Funciona |
| Cadastrar pessoa com foto | NetSDK `CLIENT_OperateFaceRecognitionDB` (ADD) | ✅ Funciona |
| Listar pessoas do grupo | NetSDK `CLIENT_StartFindFaceRecognition` + `DoFind` | ✅ Funciona |
| Deletar pessoa | NetSDK `CLIENT_OperateFaceRecognitionDB` (DELETE/DELETE_BY_UID) | 🔄 A testar |
| Download de foto face | NetSDK (via pBuffer no DoFind) | 🔄 A testar |

## Próximos Passos

1. ~~Mapear structs para `CLIENT_StartFindFaceRecognition` → listar pessoas~~ ✅ FEITO
2. Testar delete de pessoa e download de foto
3. Criar service backend integrado (`packages/backend/src/services/face-recognition.service.ts`)
4. Criar API REST para CRUD de faces
5. Criar UI no frontend: botão "Cadastro Facial" → selecionar grupo → upload foto → salvar
6. Garantir compatibilidade com Linux (.so) para deploy no VPS
7. Integrar com configurações do sistema (mapear grupos novos)
