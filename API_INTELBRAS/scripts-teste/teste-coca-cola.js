/**
 * Teste simples - Enviar cupom com Coca Cola 2L
 */

const net = require('net');

const DVR_IP = '10.6.1.123';
const DVR_PORT = 38800;

// Cupom simples com Coca Cola
const cupom = [
  '========================================',
  '      SUPERMERCADO TRADICAO            ',
  '========================================',
  'Data: 12/01/2026',
  'Hora: ' + new Date().toLocaleTimeString('pt-BR'),
  'Cupom: 123456',
  'Caixa: PDV 01',
  '',
  '========================================',
  '            PRODUTOS                    ',
  '========================================',
  '',
  '001 REFRI COCA COLA 2L',
  '    1 x R$ 10,99',
  '                           R$ 10,99',
  '',
  '========================================',
  'TOTAL:                     R$ 10,99',
  '========================================',
  '',
  'FORMA DE PAGAMENTO:',
  'DINHEIRO                   R$ 10,99',
  '',
  '========================================',
  '      OBRIGADO PELA PREFERENCIA!       ',
  '========================================',
  ''
].join('|') + '|';

console.log('╔═══════════════════════════════════════════════════════════════════╗');
console.log('║           TESTE CUPOM - COCA COLA 2L                             ║');
console.log('╚═══════════════════════════════════════════════════════════════════╝');
console.log('');
console.log('📡 DVR: ' + DVR_IP + ':' + DVR_PORT);
console.log('🥤 Produto: REFRI COCA COLA 2L - R$ 10,99');
console.log('');
console.log('🔌 Conectando ao DVR...');

const client = new net.Socket();
client.setTimeout(10000);

client.connect(DVR_PORT, DVR_IP, () => {
  console.log('✅ Conectado ao DVR!');
  console.log('');
  console.log('📤 Enviando cupom...');

  client.write(cupom, 'utf8');

  console.log('✅ Cupom enviado com sucesso!');
  console.log('');
  console.log('══════════════════════════════════════════════════════════════════════');
  console.log('📺 VERIFICAÇÃO:');
  console.log('══════════════════════════════════════════════════════════════════════');
  console.log('');
  console.log('1. Acesse http://10.6.1.123');
  console.log('2. Veja o CANAL 5 (ao vivo)');
  console.log('3. Deve aparecer texto ROXO com:');
  console.log('');
  console.log('   001 REFRI COCA COLA 2L');
  console.log('       1 x R$ 10,99');
  console.log('                          R$ 10,99');
  console.log('');
  console.log('══════════════════════════════════════════════════════════════════════');
  console.log('⏱️  Tempo de exibição: 120 segundos (2 minutos)');
  console.log('══════════════════════════════════════════════════════════════════════');
  console.log('');

  setTimeout(() => {
    client.end();
    console.log('🔌 Conexão fechada.');
  }, 1000);
});

client.on('error', (err) => {
  console.error('❌ Erro:', err.message);
  console.log('');
  console.log('⚠️  Verifique:');
  console.log('   - DVR está ligado?');
  console.log('   - IP correto: 10.6.1.123');
  console.log('   - Porta 38800 aberta?');
  console.log('   - POS configurado no DVR?');
});

client.on('timeout', () => {
  console.log('⏱️  Timeout na conexão');
  client.destroy();
});
