/**
 * Script para ESCUTAR o que o DVR responde quando conectamos
 * Tentando entender o protocolo correto
 */

const net = require('net');

const DVR_IP = '10.6.1.123';
const DVR_PORT = 38800;

console.log('='.repeat(80));
console.log(' TESTE: ESCUTAR RESPOSTAS DO DVR');
console.log('='.repeat(80));
console.log();
console.log(`Conectando em ${DVR_IP}:${DVR_PORT}...`);
console.log();

const client = new net.Socket();

client.on('connect', () => {
  console.log('✅ CONECTADO AO DVR');
  console.log('Aguardando respostas do DVR (10 segundos)...');
  console.log('Se DVR enviar algo, será exibido abaixo:');
  console.log('-'.repeat(80));

  // Aguardar 10 segundos só escutando
  setTimeout(() => {
    console.log('-'.repeat(80));
    console.log();
    console.log('⏱️  10 segundos se passaram.');
    console.log('DVR não enviou nenhuma mensagem de inicialização.');
    console.log();
    console.log('Agora vou enviar um cupom MÍNIMO e observar respostas:');
    console.log();

    const cupom = 'TESTE 1|TESTE 2|FIM|';
    console.log(`📤 Enviando: "${cupom}"`);
    console.log(`   Tamanho: ${cupom.length} bytes`);
    console.log(`   Encoding: UTF-8`);
    console.log();

    client.write(cupom, 'utf8', () => {
      console.log('✅ Dados enviados com sucesso');
      console.log('Aguardando resposta do DVR (5 segundos)...');
      console.log('-'.repeat(80));

      // Aguardar mais 5 segundos
      setTimeout(() => {
        console.log('-'.repeat(80));
        console.log();
        console.log('⏱️  5 segundos após envio.');
        console.log();
        console.log('🔌 Fechando conexão...');
        client.end();
      }, 5000);
    });
  }, 10000);
});

client.on('data', (data) => {
  console.log('📥 DVR ENVIOU DADOS:');
  console.log('   String:', data.toString());
  console.log('   Hex:', data.toString('hex'));
  console.log('   Bytes:', data.length);
  console.log();
});

client.on('error', (err) => {
  console.error('❌ ERRO:', err.message);
  process.exit(1);
});

client.on('close', () => {
  console.log();
  console.log('🔌 Conexão fechada');
  console.log();
  console.log('='.repeat(80));
  console.log(' RESUMO');
  console.log('='.repeat(80));
  console.log('Verifique na interface web do DVR se:');
  console.log('  1. Texto apareceu na tela (roxo)');
  console.log('  2. DVR continua responsivo');
  console.log('  3. Texto está visível no canal correto');
  console.log();
  process.exit(0);
});

client.on('timeout', () => {
  console.log('⏱️  Timeout da conexão');
  client.destroy();
});

// Timeout de 30 segundos para toda operação
client.setTimeout(30000);

// Conectar
client.connect(DVR_PORT, DVR_IP);
