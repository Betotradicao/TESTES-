/**
 * Teste SIMPLES para PDV4 - Canal 4
 * Apenas 1 linha de texto
 */

const net = require('net');

const DVR_IP = '10.6.1.123';
const DVR_PORT = 38800;

// APENAS 1 LINHA - teste mínimo
const mensagem = 'TESTE PDV4|';

console.log('═'.repeat(70));
console.log('🧪 TESTE PDV4 - CANAL 4');
console.log('═'.repeat(70));
console.log('');
console.log('📡 Configuração:');
console.log('   DVR: ' + DVR_IP + ':' + DVR_PORT);
console.log('   Origem: 10.6.1.171 (este servidor)');
console.log('   Canal: 4 (PDV4)');
console.log('');
console.log('📝 Mensagem: ' + mensagem.replace('|', ''));
console.log('   Tamanho: ' + mensagem.length + ' bytes');
console.log('');
console.log('═'.repeat(70));
console.log('');

const client = new net.Socket();
client.setTimeout(3000);

console.log('🔌 Conectando ao DVR...');

client.connect(DVR_PORT, DVR_IP, () => {
  console.log('✅ Conectado!');
  console.log('');

  console.log('📤 Enviando mensagem...');
  client.write(mensagem, 'utf8');

  console.log('✅ Mensagem enviada!');
  console.log('');
  console.log('═'.repeat(70));
  console.log('📺 VERIFICAÇÃO:');
  console.log('═'.repeat(70));
  console.log('');
  console.log('1. Acesse: http://10.6.1.123');
  console.log('2. Veja o CANAL 4 (ao vivo)');
  console.log('3. Deve aparecer texto: TESTE PDV4');
  console.log('4. Cor: Branca ou colorida');
  console.log('5. Ficará visível por 120 segundos (2 minutos)');
  console.log('');
  console.log('═'.repeat(70));
  console.log('⚠️  IMPORTANTE:');
  console.log('═'.repeat(70));
  console.log('');
  console.log('✅ SE APARECER:');
  console.log('   - PDV4 configurado corretamente!');
  console.log('   - Pode enviar cupons completos');
  console.log('');
  console.log('❌ SE NÃO APARECER:');
  console.log('   - Aguardar 10 segundos');
  console.log('   - Verificar se DVR travou/reiniciou');
  console.log('   - Verificar Canal 4 especificamente');
  console.log('');
  console.log('═'.repeat(70));
  console.log('');

  setTimeout(() => {
    client.end();
    console.log('🔌 Conexão encerrada.');
    console.log('');
  }, 500);
});

client.on('error', (err) => {
  console.error('');
  console.error('❌ ERRO:', err.message);
  console.error('');
  console.error('Possíveis causas:');
  console.error('  - DVR offline');
  console.error('  - Porta 38800 bloqueada');
  console.error('  - Firewall ativo');
  console.error('');
});

client.on('timeout', () => {
  console.log('⏱️  Timeout na conexão');
  client.destroy();
});
