/**
 * HABILITAR OVERLAY PDV2
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

async function main() {
  console.log('\n🔧 HABILITANDO OVERLAY DO PDV2...\n');

  const idx = 5;
  const path = `/cgi-bin/configManager.cgi?action=setConfig&PosConfig[${idx}].OverlayEnable=true`;

  try {
    let response = await httpRequest(path, 'GET');

    if (response.status === 401 && response.headers['www-authenticate']) {
      const authHeader = createDigestAuth(response.headers['www-authenticate'], path, 'GET');
      if (authHeader) {
        response = await httpRequest(path, 'GET', authHeader);
      }
    }

    if (response.body.includes('OK') || response.body.includes('ok')) {
      console.log('✅ Overlay HABILITADO com sucesso!');
      console.log('\n💡 Agora o texto dos cupons VAI aparecer no vídeo do Canal 5 (PDV2)!\n');
    } else {
      console.log(`⚠️  Resposta: ${response.body}\n`);
    }

  } catch (error) {
    console.error('❌ Erro:', error.message);
  }
}

main();
