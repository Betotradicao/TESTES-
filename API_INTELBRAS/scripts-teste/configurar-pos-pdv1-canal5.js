/**
 * Script para configurar POS no DVR - PDV1 no Canal 5
 * Baseado nas configurações da interface web
 */

const http = require('http');
const crypto = require('crypto');

const DVR_CONFIG = {
  ip: '10.6.1.123',
  port: 80,
  username: 'admin',
  password: 'beto3107@'
};

const POS_CONFIG = {
  name: 'PDV1',
  enabled: true,
  channel: 5, // Canal 5
  protocol: 'General', // TCP
  ipOrigin: '10.6.1.171',
  portOrigin: 37777,
  ipDestination: '10.6.1.123',
  portDestination: 38800,
  converter: 'Unicode(UTF-8)',
  displayMode: 'Pagina', // Modo virar página
  timeoutExceed: 100,
  displayTime: 120,
  fontSize: 'Grande',
  fontColor: 'orange', // Cor laranja
  showPOSInfo: true,
  delimiter: '1C'
};

console.log('='.repeat(70));
console.log('⚙️  CONFIGURAÇÃO POS - DVR INTELBRAS');
console.log('='.repeat(70));
console.log('\n📋 Configurações a aplicar:');
console.log(`   Nome: ${POS_CONFIG.name}`);
console.log(`   Canal: ${POS_CONFIG.channel}`);
console.log(`   IP Origem: ${POS_CONFIG.ipOrigin}:${POS_CONFIG.portOrigin}`);
console.log(`   IP Destino: ${POS_CONFIG.ipDestination}:${POS_CONFIG.portDestination}`);
console.log(`   Protocolo: ${POS_CONFIG.protocol} (TCP)`);
console.log(`   Converter: ${POS_CONFIG.converter}`);
console.log('='.repeat(70));

function httpRequest(path, method = 'GET', authHeader = null, body = null) {
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

    if (body) {
      options.headers['Content-Type'] = 'application/x-www-form-urlencoded';
      options.headers['Content-Length'] = Buffer.byteLength(body);
    }

    const req = http.request(options, (res) => {
      let responseBody = '';
      res.on('data', (chunk) => { responseBody += chunk; });
      res.on('end', () => {
        resolve({
          status: res.statusCode,
          headers: res.headers,
          body: responseBody
        });
      });
    });

    req.on('error', reject);
    req.setTimeout(10000, () => { req.destroy(); reject(new Error('Timeout')); });

    if (body) {
      req.write(body);
    }

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

async function executeRequest(path, method = 'GET', body = null, description = '') {
  try {
    if (description) {
      console.log(`\n📍 ${description}`);
    }

    let response = await httpRequest(path, method, null, body);

    if (response.status === 401 && response.headers['www-authenticate']) {
      const authHeader = createDigestAuth(response.headers['www-authenticate'], path, method);
      if (authHeader) {
        response = await httpRequest(path, method, authHeader, body);
      }
    }

    console.log(`   Status: ${response.status}`);

    if (response.status === 200) {
      console.log(`   ✅ Sucesso!`);
      if (response.body && response.body.length < 500) {
        console.log(`   Resposta: ${response.body}`);
      }
      return true;
    } else {
      console.log(`   ❌ Falha! Resposta: ${response.body}`);
      return false;
    }

  } catch (error) {
    console.log(`   ❌ Erro: ${error.message}`);
    return false;
  }
}

async function main() {
  console.log('\n🔍 Passo 1: Verificando configuração POS atual...\n');

  // Buscar configuração atual
  const getPath = '/cgi-bin/configManager.cgi?action=getConfig&name=POS';
  await executeRequest(getPath, 'GET', null, 'Lendo configuração POS atual');

  console.log('\n⚙️  Passo 2: Aplicando nova configuração POS...\n');

  // Configurar POS
  const setPOSPath = `/cgi-bin/configManager.cgi?action=setConfig&POS[0].Enable=true&POS[0].Channel=${POS_CONFIG.channel - 1}&POS[0].Protocol=${POS_CONFIG.protocol}&POS[0].Address.IP=${POS_CONFIG.ipOrigin}&POS[0].Address.Port=${POS_CONFIG.portOrigin}&POS[0].ListenPort=${POS_CONFIG.portDestination}&POS[0].Encoder=${POS_CONFIG.converter}&POS[0].DisplayMode=${POS_CONFIG.displayMode}&POS[0].TimeoutExceed=${POS_CONFIG.timeoutExceed}&POS[0].DisplayTime=${POS_CONFIG.displayTime}&POS[0].FontSize=${POS_CONFIG.fontSize}&POS[0].FontColor=${POS_CONFIG.fontColor}&POS[0].POSInfo=${POS_CONFIG.showPOSInfo}&POS[0].Delimiter=${POS_CONFIG.delimiter}`;

  const success = await executeRequest(setPOSPath, 'GET', null, 'Configurando POS PDV1 no Canal 5');

  console.log('\n📝 Passo 3: Verificando configuração aplicada...\n');
  await executeRequest(getPath, 'GET', null, 'Lendo configuração POS atualizada');

  console.log('\n' + '='.repeat(70));
  if (success) {
    console.log('✅ CONFIGURAÇÃO CONCLUÍDA COM SUCESSO!');
    console.log('='.repeat(70));
    console.log('\n📌 Próximos passos:');
    console.log('1. ✅ POS configurado no DVR');
    console.log('2. ⏭️  Configure a AGENDA DE GRAVAÇÃO (Armazenamento > Agenda)');
    console.log('3. ⏭️  Marque a opção POS no agendamento (barra roxa)');
    console.log('4. ⏭️  Teste enviando dados via porta 38800 (use Hercules SETUP)');
    console.log('\n💡 Para testar:');
    console.log('   - IP Destino: 10.6.1.123');
    console.log('   - Porta: 38800');
    console.log('   - Protocolo: TCP Client');
    console.log('   - Envie uma string de teste (ex: "TESTE PDV1 - CANAL 5")');
  } else {
    console.log('❌ CONFIGURAÇÃO FALHOU!');
    console.log('='.repeat(70));
    console.log('\n⚠️  Verifique:');
    console.log('   - IP do DVR está correto: 10.6.1.123');
    console.log('   - Credenciais estão corretas');
    console.log('   - DVR está acessível na rede');
  }
  console.log('='.repeat(70) + '\n');
}

main().catch(console.error);
