/**
 * Teste MÍNIMO - Apenas 3 linhas para não travar DVR
 */

const net = require('net');

const DVR_IP = '10.6.1.123';
const DVR_PORT = 38800;

// IMITANDO ZANTHUS - Enviar eventos separados como o manual mostra
const eventos = [
  'AbreDoc: COD=001|',
  'Item: 1 - COCA COLA 2L, qtd=1 valor=10.99|',
  'TOTAL: R$ 10,99|',
  'DINHEIRO: R$ 10,99|',
  'FECHA CUPOM|'
];

console.log('═══════════════════════════════════════');
console.log('TESTE ZANTHUS - EVENTOS SEPARADOS');
console.log('═══════════════════════════════════════');
console.log('🔌 Conectando: ' + DVR_IP + ':' + DVR_PORT);
console.log('');
console.log('📝 Eventos a enviar:');
eventos.forEach((e, i) => console.log(`   ${i+1}. ${e.replace('|', '')}`));
console.log('');

const client = new net.Socket();
client.setTimeout(5000);

client.connect(DVR_PORT, DVR_IP, () => {
  console.log('✅ Conectado');
  console.log('');

  // Enviar cada evento com intervalo (como Zanthus faz)
  let i = 0;
  const enviarEvento = () => {
    if (i < eventos.length) {
      const evento = eventos[i];
      client.write(evento, 'utf8');
      console.log(`✅ Evento ${i+1}/${eventos.length}: ${evento.replace('|', '')}`);
      i++;
      setTimeout(enviarEvento, 100); // 100ms entre eventos
    } else {
      console.log('');
      console.log('✅ Todos eventos enviados!');
      console.log('📺 Verifique TODOS os canais no DVR');
      setTimeout(() => {
        client.end();
        console.log('🔌 Conexão fechada');
      }, 500);
    }
  };

  enviarEvento();
});

client.on('error', (err) => {
  console.error('❌ Erro:', err.message);
});

client.on('timeout', () => {
  console.log('⏱️  Timeout');
  client.destroy();
});
