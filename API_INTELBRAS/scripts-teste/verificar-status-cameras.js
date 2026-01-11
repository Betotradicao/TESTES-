/**
 * VERIFICAR STATUS DAS CÂMERAS
 */

const http = require('http');
const crypto = require('crypto');

const DVR_CONFIG = {
  ip: '10.6.1.123',
  port: 80,
  username: 'admin',
  password: 'beto3107@'
};

function httpRequest(path, method = 'GET', authHeader = null) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: DVR_CONFIG.ip,
      port: DVR_CONFIG.port,
      path: path,
      method: method,
      headers: {}
    };

    if (authHeader) {
      options.headers['Authorization'] = authHeader;
    }

    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => { body += chunk; });
      res.on('end', () => {
        resolve({ status: res.statusCode, headers: res.headers, body: body });
      });
    });

    req.on('error', reject);
    req.setTimeout(10000, () => { req.destroy(); reject(new Error('Timeout')); });
    req.end();
  });
}

function createDigestAuth(wwwAuthenticate, uri, method = 'GET') {
  const realm = /realm="([^"]+)"/.exec(wwwAuthenticate)?.[1];
  const nonce = /nonce="([^"]+)"/.exec(wwwAuthenticate)?.[1];
  const qop = /qop="([^"]+)"/.exec(wwwAuthenticate)?.[1];
  const opaque = /opaque="([^"]+)"/.exec(wwwAuthenticate)?.[1];

  if (!realm || !nonce) return null;

  const nc = '00000001';
  const cnonce = crypto.randomBytes(8).toString('hex');

  const ha1 = crypto.createHash('md5')
    .update(`${DVR_CONFIG.username}:${realm}:${DVR_CONFIG.password}`)
    .digest('hex');

  const ha2 = crypto.createHash('md5')
    .update(`${method}:${uri}`)
    .digest('hex');

  let response;
  if (qop) {
    response = crypto.createHash('md5')
      .update(`${ha1}:${nonce}:${nc}:${cnonce}:${qop}:${ha2}`)
      .digest('hex');
  } else {
    response = crypto.createHash('md5')
      .update(`${ha1}:${nonce}:${ha2}`)
      .digest('hex');
  }

  let authHeader = `Digest username="${DVR_CONFIG.username}", realm="${realm}", nonce="${nonce}", uri="${uri}", response="${response}"`;

  if (qop) authHeader += `, qop=${qop}, nc=${nc}, cnonce="${cnonce}"`;
  if (opaque) authHeader += `, opaque="${opaque}"`;

  return authHeader;
}

async function getDeviceStatus() {
  const path = '/cgi-bin/magicBox.cgi?action=getDeviceType';
  let response = await httpRequest(path);

  if (response.status === 401 && response.headers['www-authenticate']) {
    const authHeader = createDigestAuth(response.headers['www-authenticate'], path);
    if (authHeader) {
      response = await httpRequest(path, 'GET', authHeader);
    }
  }

  return response.body;
}

async function getCameraStatus() {
  const path = '/cgi-bin/configManager.cgi?action=getConfig&name=VideoInOptions';
  let response = await httpRequest(path);

  if (response.status === 401 && response.headers['www-authenticate']) {
    const authHeader = createDigestAuth(response.headers['www-authenticate'], path);
    if (authHeader) {
      response = await httpRequest(path, 'GET', authHeader);
    }
  }

  return response.body;
}

async function getChannelTitle() {
  const path = '/cgi-bin/configManager.cgi?action=getConfig&name=ChannelTitle';
  let response = await httpRequest(path);

  if (response.status === 401 && response.headers['www-authenticate']) {
    const authHeader = createDigestAuth(response.headers['www-authenticate'], path);
    if (authHeader) {
      response = await httpRequest(path, 'GET', authHeader);
    }
  }

  return response.body;
}

function parseConfig(configText) {
  const lines = configText.split('\n');
  const config = {};

  lines.forEach(line => {
    const match = line.match(/table\.(.+?)=(.+)/);
    if (match) {
      config[match[1]] = match[2];
    }
  });

  return config;
}

async function main() {
  console.log('\n╔═══════════════════════════════════════════════════════════════════╗');
  console.log('║              DIAGNÓSTICO DE CÂMERAS - TELA PRETA?               ║');
  console.log('╚═══════════════════════════════════════════════════════════════════╝\n');

  console.log(`📡 DVR: ${DVR_CONFIG.ip}\n`);

  try {
    // 1. Info do dispositivo
    console.log('⏳ Verificando informações do DVR...\n');
    const deviceInfo = await getDeviceStatus();
    console.log(deviceInfo);
    console.log('\n');

    // 2. Status das câmeras
    console.log('⏳ Verificando status das câmeras...\n');
    const cameraStatus = await getCameraStatus();
    const cameras = parseConfig(cameraStatus);

    console.log('═'.repeat(70));
    console.log('📹 STATUS DAS CÂMERAS:');
    console.log('═'.repeat(70));

    // Organizar por canal
    const channels = {};
    Object.keys(cameras).forEach(key => {
      const match = key.match(/VideoInOptions\[(\d+)\]\.(.+)/);
      if (match) {
        const channel = parseInt(match[1]);
        const prop = match[2];

        if (!channels[channel]) {
          channels[channel] = {};
        }
        channels[channel][prop] = cameras[key];
      }
    });

    // 3. Nomes dos canais
    const channelTitles = await getChannelTitle();
    const titles = parseConfig(channelTitles);

    const titleMap = {};
    Object.keys(titles).forEach(key => {
      const match = key.match(/ChannelTitle\[(\d+)\]\.Name/);
      if (match) {
        titleMap[parseInt(match[1])] = titles[key];
      }
    });

    // Exibir cada canal
    Object.keys(channels).sort((a, b) => parseInt(a) - parseInt(b)).forEach(channel => {
      const ch = channels[channel];
      const channelNum = parseInt(channel) + 1;
      const name = titleMap[channel] || 'Sem nome';

      console.log(`\n📍 CANAL ${channelNum}: ${name}`);
      console.log('-'.repeat(70));

      // Status principal
      if (ch.VideoInType === '0') {
        console.log('   ❌ DESABILITADO (sem câmera conectada)');
      } else {
        console.log('   ✅ Habilitado');
        console.log(`   Tipo: ${ch.VideoInType}`);

        // Verificar sinal
        if (ch.VideoLossDetect === 'true') {
          console.log('   ⚠️  Detecção de perda de vídeo ATIVA');
        }

        // Outras infos
        console.log(`   Padrão de Vídeo: ${ch.VideoStandard || 'N/A'}`);
        console.log(`   Modo de Trabalho: ${ch.WorkMode || 'N/A'}`);
      }
    });

    console.log('\n\n' + '═'.repeat(70));
    console.log('💡 DIAGNÓSTICO:');
    console.log('═'.repeat(70));
    console.log('\nSe as câmeras aparecem como DESABILITADAS:');
    console.log('  ❌ Não há câmera física conectada naquele canal');
    console.log('\nSe as câmeras aparecem HABILITADAS mas tela está preta:');
    console.log('  ⚠️  Possíveis causas:');
    console.log('     1. Câmera sem alimentação (sem energia)');
    console.log('     2. Cabo de vídeo desconectado ou danificado');
    console.log('     3. Câmera com defeito');
    console.log('     4. Configuração de usuário sem permissão de visualização');
    console.log('     5. DVR em modo de economia de energia');
    console.log('     6. Problema de codificação H.264/H.265');
    console.log('\n═'.repeat(70));
    console.log('\n');

  } catch (error) {
    console.error('\n❌ Erro:', error.message);
  }
}

main();
