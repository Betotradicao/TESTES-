/**
 * Teste ULTRA MÍNIMO - apenas 1 linha
 * Para ver se DVR aceita ou rejeita
 */

const net = require('net');

const DVR_IP = '10.6.1.123';
const DVR_PORT = 38800;

console.log('='.repeat(60));
console.log(' TESTE ULTRA MÍNIMO - 1 LINHA');
console.log('='.repeat(60));
console.log();

const client = new net.Socket();
let dataReceived = false;

client.on('connect', () => {
  console.log('✅ Conectado');
  console.log();

  // Aguardar 2 segundos
  setTimeout(() => {
    // Enviar APENAS uma palavra com delimiter
    const cupom = 'TESTE|';

    console.log(`📤 Enviando: "${cupom}"`);
    console.log(`   ${cupom.length} bytes`);
    console.log();

    client.write(cupom, 'utf8', () => {
      console.log('✅ Enviado');
      console.log('Aguardando 3 segundos...');
      console.log();

      // Aguardar 3 segundos antes de fechar
      setTimeout(() => {
        if (!dataReceived) {
          console.log('DVR não respondeu nada');
        }
        console.log();
        console.log('Fechando conexão...');
        client.destroy(); // Destroy em vez de end() para fechar imediatamente
      }, 3000);
    });
  }, 2000);
});

client.on('data', (data) => {
  dataReceived = true;
  console.log('📥 DVR RESPONDEU:');
  console.log('   String:', data.toString());
  console.log('   Hex:', data.toString('hex'));
  console.log();
});

client.on('error', (err) => {
  console.error('❌ ERRO:', err.message);
  console.log();
  process.exit(1);
});

client.on('close', (hadError) => {
  console.log(`🔌 Conexão fechada ${hadError ? '(com erro)' : '(normal)'}`);
  console.log();
  console.log('='.repeat(60));
  console.log('Verifique no DVR:');
  console.log('  • Texto apareceu?');
  console.log('  • DVR travou?');
  console.log('  • Qual cor do texto?');
  console.log('='.repeat(60));
  process.exit(hadError ? 1 : 0);
});

client.connect(DVR_PORT, DVR_IP);
