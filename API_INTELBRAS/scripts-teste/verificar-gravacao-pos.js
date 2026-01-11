/**
 * VERIFICAR SE GRAVAÇÃO POS ESTÁ ATIVA
 * A "barra roxa" da agenda
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

async function getRecordConfig() {
  const path = '/cgi-bin/configManager.cgi?action=getConfig&name=RecordMode';
  let response = await httpRequest(path);

  if (response.status === 401 && response.headers['www-authenticate']) {
    const authHeader = createDigestAuth(response.headers['www-authenticate'], path);
    if (authHeader) {
      response = await httpRequest(path, 'GET', authHeader);
    }
  }

  return response.body;
}

async function main() {
  console.log('\n╔═══════════════════════════════════════════════════════════════════╗');
  console.log('║     VERIFICAR GRAVAÇÃO POS - A BARRA ROXA DA AGENDA              ║');
  console.log('╚═══════════════════════════════════════════════════════════════════╝\n');

  console.log(`📡 DVR: ${DVR_CONFIG.ip}\n`);

  try {
    console.log('⏳ Buscando configurações de gravação...\n');

    const recordConfig = await getRecordConfig();

    console.log('═'.repeat(70));
    console.log('📹 CONFIGURAÇÃO DE GRAVAÇÃO:');
    console.log('═'.repeat(70));
    console.log(recordConfig);
    console.log('═'.repeat(70));

    console.log('\n\n💡 IMPORTANTE - PARA A BUSCA POS FUNCIONAR:\n');
    console.log('1. Acesse: http://10.6.1.123');
    console.log('2. Menu Principal → Armazenamento → Agenda');
    console.log('3. Clique na engrenagem do DOMINGO (ou dia desejado)');
    console.log('4. Na janela que abrir:');
    console.log('   - Marque a caixa "POS"');
    console.log('   - No gráfico de horários, deve aparecer BARRA ROXA');
    console.log('5. Clique em "Copiar para" e selecione TODOS os dias');
    console.log('6. Salvar\n');

    console.log('═'.repeat(70));
    console.log('🔍 DEPOIS DE CONFIGURAR:');
    console.log('═'.repeat(70));
    console.log('1. Envie um cupom de teste');
    console.log('2. Aguarde 1-2 minutos');
    console.log('3. Vá em: Menu → POS → Buscar');
    console.log('4. Busque por: "ARROZ" ou "CAFE" ou "COCA"');
    console.log('5. DEVE APARECER a transação na lista');
    console.log('6. Clique nela para ver o VÍDEO com o texto sobreposto\n');

    console.log('═'.repeat(70));
    console.log('⚠️  SEM A BARRA ROXA = NÃO GRAVA = NÃO BUSCA!');
    console.log('═'.repeat(70));
    console.log('\n');

  } catch (error) {
    console.error('\n❌ Erro:', error.message);
  }
}

main();
