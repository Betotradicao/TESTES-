const https = require('https');
const http = require('http');
const { exec } = require('child_process');

const DVR_IP = '10.6.1.123';
const DVR_USER = 'admin';
const DVR_PASS = 'beto3107@';

console.log('🔍 DIAGNÓSTICO COMPLETO DE EMAIL DVR\n');
console.log('═══════════════════════════════════════\n');

// 1. Verificar configuração atual
console.log('📋 1. CONFIGURAÇÃO ATUAL:');
exec(`curl -u ${DVR_USER}:${DVR_PASS} --digest "http://${DVR_IP}/cgi-bin/configManager.cgi?action=getConfig&name=Email" 2>/dev/null`, (err, stdout) => {
  if (err) {
    console.error('❌ Erro ao buscar configuração:', err.message);
    return;
  }

  const config = {};
  stdout.split('\n').forEach(line => {
    if (line.includes('table.Email.')) {
      const [key, value] = line.split('=');
      const shortKey = key.replace('table.Email.', '');
      config[shortKey] = value;
    }
  });

  console.log('   ✓ Habilitado:', config.Enable === 'true' ? '✅ SIM' : '❌ NÃO');
  console.log('   ✓ SMTP Server:', config.Address);
  console.log('   ✓ SMTP Port:', config.Port);
  console.log('   ✓ Username:', config.UserName);
  console.log('   ✓ Password:', config.Password === '******' ? '✅ Configurada' : '❌ Vazia');
  console.log('   ✓ TLS Enabled:', config.TlsEnable === 'true' ? '✅ SIM' : '❌ NÃO');
  console.log('   ✓ SSL Enabled:', config.SslEnable === 'true' ? '⚠️  SIM (deveria ser false para porta 587)' : '✅ NÃO');
  console.log('   ✓ Authentication:', config.Authentication === 'true' ? '✅ SIM' : '❌ NÃO');
  console.log('   ✓ Destinatário:', config['Receivers[0]']);

  console.log('\n═══════════════════════════════════════\n');

  // 2. Testar conectividade SMTP
  console.log('🌐 2. TESTE DE CONECTIVIDADE SMTP:');

  const net = require('net');
  const smtpClient = new net.Socket();

  smtpClient.setTimeout(5000);

  smtpClient.on('connect', () => {
    console.log('   ✅ Conectou no smtp.gmail.com:587');
    smtpClient.destroy();

    console.log('\n═══════════════════════════════════════\n');
    console.log('📊 3. POSSÍVEIS PROBLEMAS:\n');

    // Análise de problemas
    if (config.Port !== '587' && config.Port !== '465') {
      console.log('   ⚠️  PORTA INCORRETA! Use 587 (TLS) ou 465 (SSL)');
    }

    if (config.Port === '587' && config.SslEnable === 'true') {
      console.log('   ⚠️  SSL habilitado na porta 587! Deveria usar TLS apenas');
      console.log('      Solução: curl -u admin:senha --digest "http://IP/cgi-bin/configManager.cgi?action=setConfig&Email.SslEnable=false"');
    }

    if (config.Port === '587' && config.TlsEnable !== 'true') {
      console.log('   ❌ TLS desabilitado na porta 587!');
      console.log('      Solução: curl -u admin:senha --digest "http://IP/cgi-bin/configManager.cgi?action=setConfig&Email.TlsEnable=true"');
    }

    if (config.Authentication !== 'true') {
      console.log('   ❌ Autenticação desabilitada!');
    }

    console.log('\n💡 CAUSAS COMUNS DE FALHA:\n');
    console.log('   1. Google revogou a senha de app');
    console.log('      → Gerar nova em: https://myaccount.google.com/apppasswords');
    console.log('   2. Senha preenchida manualmente na interface web');
    console.log('      → Sempre use a API para configurar (16 caracteres exatos)');
    console.log('   3. SSL/TLS configurado incorretamente');
    console.log('      → Porta 587 = TLS:true, SSL:false');
    console.log('      → Porta 465 = TLS:false, SSL:true');
    console.log('   4. Firewall bloqueando porta 587/465');
    console.log('   5. Email de origem diferente do usuário SMTP');
    console.log('      → SendAddress deve ser igual a UserName');

    console.log('\n═══════════════════════════════════════\n');
    console.log('🔧 COMANDOS PARA CORRIGIR:\n');

    console.log('# Reconfigurar senha (substitua APP_PASSWORD_16_CHARS):');
    console.log(`curl -u ${DVR_USER}:${DVR_PASS} --digest "http://${DVR_IP}/cgi-bin/configManager.cgi?action=setConfig&Email.Password=APP_PASSWORD_16_CHARS"`);

    console.log('\n# Garantir TLS na porta 587:');
    console.log(`curl -u ${DVR_USER}:${DVR_PASS} --digest "http://${DVR_IP}/cgi-bin/configManager.cgi?action=setConfig&Email.TlsEnable=true&Email.SslEnable=false"`);

    console.log('\n# Verificar se email está habilitado:');
    console.log(`curl -u ${DVR_USER}:${DVR_PASS} --digest "http://${DVR_IP}/cgi-bin/configManager.cgi?action=setConfig&Email.Enable=true"`);

    console.log('\n═══════════════════════════════════════\n');
  });

  smtpClient.on('timeout', () => {
    console.log('   ❌ TIMEOUT ao conectar no Gmail SMTP');
    console.log('      Possíveis causas:');
    console.log('      - Firewall bloqueando porta 587');
    console.log('      - Problema de rede');
    console.log('      - DVR sem acesso à internet');
    smtpClient.destroy();
  });

  smtpClient.on('error', (err) => {
    console.log('   ❌ ERRO de conexão:', err.message);
    console.log('      O DVR consegue acessar a internet?');
  });

  console.log('   🔄 Testando conexão smtp.gmail.com:587...');
  smtpClient.connect(587, 'smtp.gmail.com');
});
