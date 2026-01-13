/**
 * TESTE ABSOLUTO MÍNIMO - Apenas UMA palavra
 */

const net = require('net');

const DVR_IP = '10.6.1.123';
const DVR_PORT = 38800;

// APENAS UMA PALAVRA
const mensagem = 'TESTE|';

console.log('═══════════════════════════════════════');
console.log('TESTE ABSOLUTO MÍNIMO - 1 PALAVRA');
console.log('═══════════════════════════════════════');
console.log('Mensagem: ' + mensagem);
console.log('Bytes: ' + mensagem.length);
console.log('');

const client = new net.Socket();
client.setTimeout(3000);

client.connect(DVR_PORT, DVR_IP, () => {
  console.log('✅ Conectado');

  client.write(mensagem, 'utf8');

  console.log('✅ Enviado');
  console.log('');
  console.log('⏳ AGUARDE 10 SEGUNDOS');
  console.log('   Não faça NADA no DVR');
  console.log('');
  console.log('📺 Se DVR NÃO travar:');
  console.log('   - Problema é VOLUME de dados');
  console.log('');
  console.log('❌ Se DVR TRAVAR:');
  console.log('   - Problema é configuração do POS');
  console.log('   - Overlay pode estar desabilitado');
  console.log('   - POS pode não estar habilitado');

  setTimeout(() => {
    client.end();
    console.log('');
    console.log('🔌 Conexão fechada');
  }, 200);
});

client.on('error', (err) => {
  console.error('❌ Erro:', err.message);
});

client.on('timeout', () => {
  console.log('⏱️  Timeout');
  client.destroy();
});
