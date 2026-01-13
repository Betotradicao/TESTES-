/**
 * Script SIMPLES para configurar POS PDV1 - Canal 5
 * Evita sobrecarregar o DVR
 */

const http = require('http');
const crypto = require('crypto');

const DVR_CONFIG = {
  ip: '10.6.1.123',
  port: 80,
  username: 'admin',
  password: 'beto3107@'
};

console.log('='.repeat(70));
console.log('⚙️  TESTE CONFIGURAÇÃO POS - PDV1 CANAL 5');
console.log('='.repeat(70));

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
        resolve({
          status: res.statusCode,
          headers: res.headers,
          body: body
        });
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

async function executeRequest(path, description = '') {
  try {
    if (description) {
      console.log(`\n📍 ${description}`);
    }

    let response = await httpRequest(path);

    if (response.status === 401 && response.headers['www-authenticate']) {
      const authHeader = createDigestAuth(response.headers['www-authenticate'], path);
      if (authHeader) {
        response = await httpRequest(path, 'GET', authHeader);
      }
    }

    console.log(`   Status: ${response.status}`);

    if (response.status === 200) {
      console.log(`   ✅ OK`);
      return { success: true, body: response.body };
    } else {
      console.log(`   ❌ Erro: ${response.body.substring(0, 50)}`);
      return { success: false };
    }

  } catch (error) {
    console.log(`   ❌ Erro: ${error.message}`);
    return { success: false };
  }
}

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function main() {
  console.log('\n🔍 Etapa 1: Ler configuração atual\n');

  const readResult = await executeRequest(
    '/cgi-bin/configManager.cgi?action=getConfig&name=table.PosConfig',
    'Lendo todas as configurações POS'
  );

  if (readResult.success && readResult.body) {
    // Mostrar apenas linhas importantes
    const lines = readResult.body.split('\n');
    const important = lines.filter(line =>
      line.includes('[0].Name=') ||
      line.includes('[0].Enable=') ||
      line.includes('[0].LinkChannel') ||
      line.includes('[1].Name=') ||
      line.includes('[1].Enable=')
    );

    if (important.length > 0) {
      console.log('\n📄 Configurações encontradas:');
      important.forEach(line => console.log(`   ${line}`));
    }
  }

  await sleep(2000);

  console.log('\n⚙️  Etapa 2: Tentar configurar POS[1] (segundo slot)\n');

  // Tentar usar slot [1] ao invés de [0]
  const params = [
    'table.PosConfig[1].Name=PDV1',
    'table.PosConfig[1].Enable=true',
    'table.PosConfig[1].LinkChannel[0]=4',  // Canal 5 = índice 4
    'table.PosConfig[1].OverlayEnable=true',
    'table.PosConfig[1].Protocol=General',
    'table.PosConfig[1].ConnectType=TCP',
    'table.PosConfig[1].NetAtt.DstPort=38800',
    'table.PosConfig[1].Convert=UTF-8'
  ];

  const setPath = `/cgi-bin/configManager.cgi?action=setConfig&${params.join('&')}`;
  const setResult = await executeRequest(setPath, 'Configurando POS[1] - PDV1');

  await sleep(2000);

  console.log('\n📝 Etapa 3: Verificar resultado\n');
  const verifyResult = await executeRequest(
    '/cgi-bin/configManager.cgi?action=getConfig&name=table.PosConfig[1]',
    'Verificando POS[1]'
  );

  console.log('\n' + '='.repeat(70));

  if (setResult.success) {
    console.log('✅ CONFIGURAÇÃO APLICADA!');
    console.log('='.repeat(70));
    console.log('\n⚠️  PRÓXIMO PASSO OBRIGATÓRIO:');
    console.log('   Configure a BARRA ROXA manualmente:');
    console.log('   Menu → Armazenamento → Agenda → Marcar POS');
  } else {
    console.log('❌ CONFIGURAÇÃO FALHOU!');
    console.log('='.repeat(70));
    console.log('\n💡 SOLUÇÃO:');
    console.log('   Este DVR pode ter apenas 1 slot POS via API.');
    console.log('   Configure manualmente pela interface web:');
    console.log('   http://10.6.1.123');
    console.log('');
    console.log('   Ou edite o POS[0] existente para usar Canal 5');
  }
  console.log('='.repeat(70) + '\n');
}

main().catch(console.error);
