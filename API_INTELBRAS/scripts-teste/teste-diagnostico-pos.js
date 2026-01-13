/**
 * TESTE DIAGNÓSTICO - Identificar Canal POS Correto
 */

const net = require('net');

const DVR_IP = '10.6.1.123';
const DVR_PORT = 38800;

// Mensagem diagnóstica clara
const mensagem = 'TESTE DIAGNOSTICO|IP 10.6.1.171|PORTA 38800|PROCURAR EM TODOS OS CANAIS|';

console.log('═'.repeat(70));
console.log('🔍 TESTE DIAGNÓSTICO POS - INTELBRAS DVR');
console.log('═'.repeat(70));
console.log('');
console.log('📌 Objetivo: Identificar em qual canal o texto aparece');
console.log('');
console.log('📡 Configuração:');
console.log('   DVR IP: ' + DVR_IP);
console.log('   Porta: ' + DVR_PORT);
console.log('   Meu IP: 10.6.1.171');
console.log('');
console.log('📝 Mensagem a enviar:');
console.log('   TESTE DIAGNOSTICO');
console.log('   IP 10.6.1.171');
console.log('   PORTA 38800');
console.log('   PROCURAR EM TODOS OS CANAIS');
console.log('');
console.log('═'.repeat(70));
console.log('');

const client = new net.Socket();
client.setTimeout(5000);

console.log('🔌 Conectando ao DVR...');

client.connect(DVR_PORT, DVR_IP, () => {
  console.log('✅ Conectado ao DVR!');
  console.log('');

  console.log('📤 Enviando mensagem diagnóstica...');
  client.write(mensagem, 'utf8');

  console.log('✅ Enviado: ' + mensagem.length + ' bytes');
  console.log('');
  console.log('═'.repeat(70));
  console.log('📺 INSTRUÇÕES:');
  console.log('═'.repeat(70));
  console.log('');
  console.log('1. Acesse: http://10.6.1.123');
  console.log('2. VERIFIQUE TODOS OS CANAIS (1, 2, 3, 4, 5, 6, 7, 8)');
  console.log('3. Procure o texto:');
  console.log('');
  console.log('   TESTE DIAGNOSTICO');
  console.log('   IP 10.6.1.171');
  console.log('   PORTA 38800');
  console.log('   PROCURAR EM TODOS OS CANAIS');
  console.log('');
  console.log('4. ANOTE EM QUAL CANAL O TEXTO APARECEU');
  console.log('');
  console.log('═'.repeat(70));
  console.log('⚠️  IMPORTANTE:');
  console.log('═'.repeat(70));
  console.log('');
  console.log('   - O texto pode aparecer em COR ROXA ou OUTRA COR');
  console.log('   - Pode demorar 1-3 segundos para aparecer');
  console.log('   - Ficará visível por 120 segundos (2 minutos)');
  console.log('   - Se NÃO aparecer em NENHUM canal:');
  console.log('     • Overlay pode estar desabilitado');
  console.log('     • IP de origem pode estar errado');
  console.log('     • POS pode estar desabilitado');
  console.log('');
  console.log('═'.repeat(70));
  console.log('');

  setTimeout(() => {
    client.end();
    console.log('🔌 Conexão encerrada.');
    console.log('');
    console.log('⏳ Verifique AGORA os canais no DVR!');
  }, 1000);
});

client.on('error', (err) => {
  console.error('');
  console.error('❌ ERRO:', err.message);
  console.error('');
  console.error('Possíveis causas:');
  console.error('  - DVR offline ou desligado');
  console.error('  - Porta 38800 bloqueada por firewall');
  console.error('  - IP do DVR incorreto');
  console.error('');
});

client.on('timeout', () => {
  console.log('');
  console.log('⏱️  Timeout na conexão');
  console.log('');
  client.destroy();
});
