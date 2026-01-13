/**
 * Script para configurar POS PDV1 no Canal 5 do DVR Intelbras
 * Baseado na estrutura table.PosConfig encontrada no DVR
 */

const http = require('http');
const crypto = require('crypto');

const DVR_CONFIG = {
  ip: '10.6.1.123',
  port: 80,
  username: 'admin',
  password: 'beto3107@'
};

// Índice do POS a configurar (0-based, mas vamos usar [4] baseado na config atual)
const POS_INDEX = 4;

console.log('='.repeat(80));
console.log('⚙️  CONFIGURAÇÃO POS PDV1 - CANAL 5');
console.log('='.repeat(80));
console.log('\n📋 Configuração a aplicar:');
console.log(`   Nome PDV: PDV1`);
console.log(`   Canal: 5 (índice 4 no array)`);
console.log(`   IP Origem: 10.6.1.171`);
console.log(`   Porta Origem: 37777`);
console.log(`   IP Destino: 10.6.1.123`);
console.log(`   Porta Destino: 38800`);
console.log(`   Protocolo: General (TCP)`);
console.log(`   Delimitador: 7C (pipe |)`);
console.log(`   Converter: UTF-8`);
console.log('='.repeat(80));

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
    req.setTimeout(15000, () => { req.destroy(); reject(new Error('Timeout')); });

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
      console.log(`   ${path.substring(0, 100)}...`);
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
      if (response.body && response.body.length < 200) {
        console.log(`   Resposta: ${response.body}`);
      }
      return { success: true, body: response.body };
    } else {
      console.log(`   ❌ Falha! Resposta: ${response.body.substring(0, 100)}`);
      return { success: false, body: response.body };
    }

  } catch (error) {
    console.log(`   ❌ Erro: ${error.message}`);
    return { success: false, error: error.message };
  }
}

async function main() {
  console.log('\n🔍 Passo 1: Lendo configuração POS atual...\n');

  const getPath = `/cgi-bin/configManager.cgi?action=getConfig&name=table.PosConfig[${POS_INDEX}]`;
  const currentConfig = await executeRequest(getPath, 'GET', null, `Lendo POS [${POS_INDEX}]`);

  if (currentConfig.success && currentConfig.body) {
    console.log('\n📄 Configuração atual (primeiras linhas):');
    const lines = currentConfig.body.split('\n').slice(0, 15);
    lines.forEach(line => console.log(`   ${line}`));
  }

  console.log('\n⚙️  Passo 2: Aplicando nova configuração POS...\n');

  // Construir URL com todos os parâmetros necessários
  const params = [
    `table.PosConfig[${POS_INDEX}].Name=PDV1`,
    `table.PosConfig[${POS_INDEX}].Enable=true`,
    `table.PosConfig[${POS_INDEX}].LinkChannel[0]=${4}`,  // Canal 5 = índice 4
    `table.PosConfig[${POS_INDEX}].OverlayEnable=true`,
    `table.PosConfig[${POS_INDEX}].Protocol=General`,
    `table.PosConfig[${POS_INDEX}].ConnectType=TCP`,
    `table.PosConfig[${POS_INDEX}].NetAtt.SrcIP=10.6.1.171`,
    `table.PosConfig[${POS_INDEX}].NetAtt.SrcPort=37777`,
    `table.PosConfig[${POS_INDEX}].NetAtt.DstIP=10.6.1.123`,
    `table.PosConfig[${POS_INDEX}].NetAtt.DstPort=38800`,
    `table.PosConfig[${POS_INDEX}].Convert=UTF-8`,
    `table.PosConfig[${POS_INDEX}].Custom.LineDelimiter=7C`,  // Pipe | em hex
    `table.PosConfig[${POS_INDEX}].DisplayTime=120`,
    `table.PosConfig[${POS_INDEX}].FontSize=24`,
    `table.PosConfig[${POS_INDEX}].FrontColor[0]=255`,  // Cor laranja/amarelo
    `table.PosConfig[${POS_INDEX}].FrontColor[1]=165`,
    `table.PosConfig[${POS_INDEX}].FrontColor[2]=0`,
    `table.PosConfig[${POS_INDEX}].FrontColor[3]=128`,
    `table.PosConfig[${POS_INDEX}].OverlayType=TURN`,  // Modo virar página
    `table.PosConfig[${POS_INDEX}].EventHandler.RecordEnable=true`,  // Habilitar gravação
    `table.PosConfig[${POS_INDEX}].EventHandler.RecordChannels[0]=${4}`,  // Gravar no canal 5
  ];

  const setPath = `/cgi-bin/configManager.cgi?action=setConfig&${params.join('&')}`;

  const setResult = await executeRequest(setPath, 'GET', null, 'Configurando POS PDV1');

  console.log('\n📝 Passo 3: Verificando configuração aplicada...\n');
  const verifyResult = await executeRequest(getPath, 'GET', null, `Lendo POS [${POS_INDEX}] atualizado`);

  if (verifyResult.success && verifyResult.body) {
    console.log('\n📄 Configuração atualizada (primeiras linhas):');
    const lines = verifyResult.body.split('\n').slice(0, 20);
    lines.forEach(line => {
      if (line.includes('Name=') || line.includes('Enable=') || line.includes('LinkChannel') ||
          line.includes('NetAtt') || line.includes('OverlayEnable') || line.includes('Protocol')) {
        console.log(`   ✅ ${line}`);
      }
    });
  }

  console.log('\n' + '='.repeat(80));
  if (setResult.success) {
    console.log('✅ CONFIGURAÇÃO POS PDV1 CONCLUÍDA COM SUCESSO!');
    console.log('='.repeat(80));
    console.log('\n📌 Próximos passos OBRIGATÓRIOS:');
    console.log('');
    console.log('1. ⚠️  CONFIGURAR AGENDA DE GRAVAÇÃO (CRÍTICO!)');
    console.log('   - Acesse: Menu → Armazenamento → Agenda');
    console.log('   - Clique na engrenagem do DOMINGO');
    console.log('   - Marque a caixa "POS"');
    console.log('   - Deve aparecer BARRA ROXA no gráfico');
    console.log('   - Clique em "Copiar para" → Todos os dias');
    console.log('   - Salvar');
    console.log('');
    console.log('   ⚠️  SEM A BARRA ROXA, o POS NÃO GRAVA!');
    console.log('');
    console.log('2. 🧪 TESTAR ENVIO DE DADOS');
    console.log('   - Use Hercules SETUP utility ou script de teste');
    console.log('   - Conecte em: 10.6.1.123:38800 (TCP Client)');
    console.log('   - Envie: "TESTE PDV1|LINHA 2|LINHA 3|"');
    console.log('   - Verifique na câmera Canal 5 (ao vivo)');
    console.log('');
    console.log('3. ✅ VERIFICAR BUSCA POS (Após enviar dados)');
    console.log('   - Menu → POS → Buscar');
    console.log('   - Buscar por: "TESTE"');
    console.log('   - Deve aparecer na lista');
    console.log('');
  } else {
    console.log('❌ CONFIGURAÇÃO FALHOU!');
    console.log('='.repeat(80));
    console.log('\n⚠️  Possíveis causas:');
    console.log('   - Índice POS incorreto (tentamos [4])');
    console.log('   - Parâmetros inválidos para este modelo de DVR');
    console.log('   - DVR não suporta configuração via API');
    console.log('');
    console.log('💡 Solução alternativa:');
    console.log('   Configure manualmente via interface web: http://10.6.1.123');
  }
  console.log('='.repeat(80) + '\n');
}

main().catch(console.error);
