const http = require('http');
const crypto = require('crypto');

const DVR_IP = '10.6.1.123';
const DVR_USER = 'admin';
const DVR_PASS = 'beto3107@';

console.log('🔍 Verificando tamanho da senha no DVR...\n');

// Função para gerar digest authentication
function digestAuth(username, password, realm, uri, nonce, method = 'GET') {
  const ha1 = crypto.createHash('md5').update(`${username}:${realm}:${password}`).digest('hex');
  const ha2 = crypto.createHash('md5').update(`${method}:${uri}`).digest('hex');
  const response = crypto.createHash('md5').update(`${ha1}:${nonce}:${ha2}`).digest('hex');
  return response;
}

// Primeiro request para pegar o nonce
const uri = '/cgi-bin/configManager.cgi?action=getConfig&name=Email';

const options = {
  hostname: DVR_IP,
  port: 80,
  path: uri,
  method: 'GET'
};

console.log('📡 Fazendo request inicial para pegar digest...');

const req = http.request(options, (res) => {
  if (res.statusCode === 401) {
    const wwwAuth = res.headers['www-authenticate'];
    console.log('✓ Recebeu challenge 401\n');

    // Parse do WWW-Authenticate header
    const realmMatch = wwwAuth.match(/realm="([^"]+)"/);
    const nonceMatch = wwwAuth.match(/nonce="([^"]+)"/);

    if (!realmMatch || !nonceMatch) {
      console.error('❌ Não conseguiu extrair realm/nonce');
      return;
    }

    const realm = realmMatch[1];
    const nonce = nonceMatch[1];

    console.log('🔐 Tentando acessar configuração de email...\n');

    // Segundo request com autenticação
    const response = digestAuth(DVR_USER, DVR_PASS, realm, uri, nonce);

    const authOptions = {
      hostname: DVR_IP,
      port: 80,
      path: uri,
      method: 'GET',
      headers: {
        'Authorization': `Digest username="${DVR_USER}", realm="${realm}", nonce="${nonce}", uri="${uri}", response="${response}"`
      }
    };

    const authReq = http.request(authOptions, (authRes) => {
      let data = '';

      authRes.on('data', (chunk) => {
        data += chunk;
      });

      authRes.on('end', () => {
        console.log('📊 ANÁLISE DA CONFIGURAÇÃO:\n');
        console.log('═══════════════════════════════════════\n');

        const lines = data.split('\n');
        let passwordLine = '';

        lines.forEach(line => {
          if (line.includes('Email.Password=')) {
            passwordLine = line;
            const password = line.split('=')[1];

            if (password === '******') {
              console.log('⚠️  Senha mascarada como "******"');
              console.log('   O DVR não mostra a senha real por segurança.\n');
            } else {
              console.log('✓ Senha visível:', password);
              console.log('✓ Tamanho:', password.length, 'caracteres\n');

              if (password.length === 16) {
                console.log('✅ TAMANHO CORRETO! (16 caracteres)');
              } else if (password.length === 20) {
                console.log('❌ PROBLEMA! Senha tem 20 caracteres (4 a mais!)');
                console.log('   A interface web adicionou 4 caracteres extras de novo!\n');
                console.log('💡 SOLUÇÃO: Reconfigurar pela API:');
                console.log('   curl -u admin:beto3107@ --digest "http://10.6.1.123/cgi-bin/configManager.cgi?action=setConfig&Email.Password=yoxttjyhuotpuxhf"');
              } else {
                console.log('⚠️  ATENÇÃO! Tamanho diferente de 16 caracteres!');
                console.log('   Senhas de app do Gmail sempre têm 16 caracteres.\n');
              }
            }
          }
        });

        console.log('\n═══════════════════════════════════════\n');
        console.log('🔍 POSSÍVEIS CAUSAS DO PROBLEMA:\n');
        console.log('1. ❌ Interface web adicionou caracteres extras');
        console.log('   → Solução: Usar API para configurar\n');
        console.log('2. ❌ Senha de app do Google inválida/revogada');
        console.log('   → Gerar nova em: https://myaccount.google.com/apppasswords\n');
        console.log('3. ❌ Configuração SSL/TLS incorreta');
        console.log('   → Porta 587 precisa TLS=true, SSL=false\n');
        console.log('4. ❌ Email de origem diferente do usuário SMTP');
        console.log('   → Ambos devem ser betotradicao76@gmail.com\n');

        // Mostrar outras configurações relevantes
        console.log('📋 OUTRAS CONFIGURAÇÕES:\n');
        lines.forEach(line => {
          if (line.includes('Email.UserName=')) {
            console.log('   UserName:', line.split('=')[1]);
          }
          if (line.includes('Email.SendAddress=')) {
            console.log('   SendAddress:', line.split('=')[1]);
          }
          if (line.includes('Email.Port=')) {
            console.log('   Port:', line.split('=')[1]);
          }
          if (line.includes('Email.TlsEnable=')) {
            const tls = line.split('=')[1];
            console.log('   TLS:', tls === 'true' ? '✅ Habilitado' : '❌ Desabilitado');
          }
          if (line.includes('Email.SslEnable=')) {
            const ssl = line.split('=')[1];
            console.log('   SSL:', ssl === 'true' ? '⚠️  Habilitado (deveria ser false)' : '✅ Desabilitado');
          }
        });

        console.log('\n═══════════════════════════════════════');
      });
    });

    authReq.on('error', (e) => {
      console.error('❌ Erro na requisição autenticada:', e.message);
    });

    authReq.end();
  }
});

req.on('error', (e) => {
  console.error('❌ Erro na requisição inicial:', e.message);
});

req.end();
