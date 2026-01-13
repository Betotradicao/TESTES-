/**
 * Configurar PDV4 - Canal 4 COMPLETO
 * Baseado no manual GCINT0037 do Zanthus
 */

const http = require('http');
const crypto = require('crypto');

const DVR_CONFIG = {
  ip: '10.6.1.123',
  port: 80,
  username: 'admin',
  password: 'beto3107@'
};

// PDV4 = PosConfig[3] (já existe)
const POS_INDEX = 3;

console.log('═'.repeat(80));
console.log('⚙️  CONFIGURAÇÃO COMPLETA PDV4 - CANAL 4');
console.log('═'.repeat(80));
console.log('');
console.log('📋 Configuração:');
console.log('   Nome: PDV4');
console.log('   Canal: 4 (índice 3)');
console.log('   IP Origem: 10.6.1.171 (nosso servidor)');
console.log('   Porta Origem: 37777');
console.log('   IP Destino: 10.6.1.123 (DVR)');
console.log('   Porta Destino: 38800');
console.log('   Protocolo: General (TCP)');
console.log('   Limitador: 7C (pipe |)');
console.log('   Encoding: UTF-8');
console.log('═'.repeat(80));
console.log('');

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
  console.log('🔍 ETAPA 1: Ler configuração atual do PDV4\n');

  const getPath = `/cgi-bin/configManager.cgi?action=getConfig&name=table.PosConfig[${POS_INDEX}]`;
  const currentConfig = await executeRequest(getPath, `Lendo POS[${POS_INDEX}] - PDV4`);

  if (currentConfig.success && currentConfig.body) {
    const lines = currentConfig.body.split('\n').filter(line =>
      line.includes('Name=') ||
      line.includes('Enable=') ||
      line.includes('LinkChannel') ||
      line.includes('OverlayEnable') ||
      line.includes('NetAtt')
    ).slice(0, 10);

    if (lines.length > 0) {
      console.log('\n📄 Config atual (principais campos):');
      lines.forEach(line => console.log(`   ${line}`));
    }
  }

  await sleep(1000);

  console.log('\n\n⚙️  ETAPA 2: Aplicar configuração completa\n');

  // TODAS as configurações necessárias baseadas no manual Zanthus
  const params = [
    // Básico
    `table.PosConfig[${POS_INDEX}].Name=PDV4`,
    `table.PosConfig[${POS_INDEX}].Enable=true`,
    `table.PosConfig[${POS_INDEX}].LinkChannel[0]=3`, // Canal 4 = índice 3

    // Overlay
    `table.PosConfig[${POS_INDEX}].OverlayEnable=true`,

    // Protocolo
    `table.PosConfig[${POS_INDEX}].Protocol=General`,
    `table.PosConfig[${POS_INDEX}].ConnectType=TCP`,

    // Rede (CRÍTICO - IP origem é nosso servidor)
    `table.PosConfig[${POS_INDEX}].NetAtt.SrcIP=10.6.1.171`,
    `table.PosConfig[${POS_INDEX}].NetAtt.SrcPort=37777`,
    `table.PosConfig[${POS_INDEX}].NetAtt.DstIP=10.6.1.123`,
    `table.PosConfig[${POS_INDEX}].NetAtt.DstPort=38800`,

    // Encoding
    `table.PosConfig[${POS_INDEX}].Convert=UTF-8`,

    // Limitador (CRÍTICO - 7C = pipe |)
    `table.PosConfig[${POS_INDEX}].Custom.LineDelimiter=7C`,

    // Tempos
    `table.PosConfig[${POS_INDEX}].DisplayTime=120`,
    `table.PosConfig[${POS_INDEX}].TimeOut=100`,

    // Aparência
    `table.PosConfig[${POS_INDEX}].FontSize=32`,
    `table.PosConfig[${POS_INDEX}].OverlayType=TURN`,

    // Cor (verde claro)
    `table.PosConfig[${POS_INDEX}].FrontColor[0]=1`,
    `table.PosConfig[${POS_INDEX}].FrontColor[1]=2`,
    `table.PosConfig[${POS_INDEX}].FrontColor[2]=8`,

    // Gravação
    `table.PosConfig[${POS_INDEX}].EventHandler.RecordEnable=true`,
    `table.PosConfig[${POS_INDEX}].EventHandler.RecordChannels[0]=3`
  ];

  const setPath = `/cgi-bin/configManager.cgi?action=setConfig&${params.join('&')}`;

  console.log('📤 Enviando configuração...');
  console.log(`   Total de parâmetros: ${params.length}`);

  const setResult = await executeRequest(setPath, 'Configurando PDV4 no Canal 4');

  await sleep(2000);

  console.log('\n\n📝 ETAPA 3: Verificar configuração aplicada\n');

  const verifyResult = await executeRequest(getPath, `Verificando POS[${POS_INDEX}]`);

  if (verifyResult.success && verifyResult.body) {
    const lines = verifyResult.body.split('\n').filter(line =>
      line.includes('Name=') ||
      line.includes('Enable=') ||
      line.includes('LinkChannel') ||
      line.includes('OverlayEnable') ||
      line.includes('NetAtt') ||
      line.includes('LineDelimiter')
    );

    console.log('\n📄 Configuração após update:');
    lines.forEach(line => {
      if (line.includes('true') || line.includes('PDV4') || line.includes('10.6.1')) {
        console.log(`   ✅ ${line}`);
      } else {
        console.log(`   ${line}`);
      }
    });
  }

  console.log('\n' + '═'.repeat(80));

  if (setResult.success) {
    console.log('✅ CONFIGURAÇÃO PDV4 CONCLUÍDA!');
    console.log('═'.repeat(80));
    console.log('');
    console.log('📌 Próximos passos:');
    console.log('');
    console.log('1. ✅ Configuração de rede APLICADA');
    console.log('   - IP Origem: 10.6.1.171 (autorizado)');
    console.log('   - Porta: 38800');
    console.log('   - Limitador: 7C (pipe |)');
    console.log('   - Canal: 4');
    console.log('');
    console.log('2. 🧪 TESTAR envio simples:');
    console.log('   node teste-pdv4-simples.js');
    console.log('');
    console.log('3. 📺 VERIFICAR no DVR:');
    console.log('   - Acessar http://10.6.1.123');
    console.log('   - Ver Canal 4 ao vivo');
    console.log('   - Texto deve aparecer');
    console.log('');
  } else {
    console.log('❌ CONFIGURAÇÃO FALHOU!');
    console.log('═'.repeat(80));
    console.log('');
    console.log('💡 Solução:');
    console.log('   Configurar manualmente via interface web');
    console.log('   http://10.6.1.123 → Menu → POS → Configurar');
  }

  console.log('═'.repeat(80) + '\n');
}

main().catch(console.error);
