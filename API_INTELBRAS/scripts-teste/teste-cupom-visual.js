/**
 * TESTE VISUAL DE CUPOM - LETRA ROXA
 * Envia cupom com 5 itens para validação visual
 */

const net = require('net');

const DVR_CONFIG = {
  ip: '10.6.1.123',
  port: 38800
};

function formatarCupom() {
  const agora = new Date();
  const data = agora.toLocaleDateString('pt-BR');
  const hora = agora.toLocaleTimeString('pt-BR');

  // Delimitador: | (0x7C)
  const L = '|';

  const cupom = [
    '========================================',
    '      SUPERMERCADO BOM PRECO           ',
    '========================================',
    'CNPJ: 12.345.678/0001-99',
    'Rua das Flores, 123 - Centro',
    'Tel: (11) 1234-5678',
    '========================================',
    '',
    `Data: ${data}`,
    `Hora: ${hora}`,
    `Cupom: ${Math.floor(Math.random() * 999999).toString().padStart(6, '0')}`,
    'Caixa: PDV 02',
    'Operador: MARIA SILVA',
    '',
    '========================================',
    '            PRODUTOS                    ',
    '========================================',
    '',
    '001 ARROZ TIPO 1 5KG',
    '    1 x R$ 25,90',
    '                           R$ 25,90',
    '',
    '002 FEIJAO PRETO 1KG',
    '    2 x R$ 8,50',
    '                           R$ 17,00',
    '',
    '003 OLEO DE SOJA 900ML',
    '    3 x R$ 6,99',
    '                           R$ 20,97',
    '',
    '004 CAFE TORRADO 500G',
    '    1 x R$ 15,90',
    '                           R$ 15,90',
    '',
    '005 ACUCAR CRISTAL 1KG',
    '    2 x R$ 4,50',
    '                            R$ 9,00',
    '',
    '========================================',
    'SUBTOTAL:                  R$ 88,77',
    'DESCONTO:                   R$ 8,77',
    '========================================',
    'TOTAL:                     R$ 80,00',
    '========================================',
    '',
    'FORMA DE PAGAMENTO:',
    'DINHEIRO                   R$ 80,00',
    '',
    '========================================',
    '      OBRIGADO PELA PREFERENCIA!       ',
    '========================================',
    ''
  ];

  // Juntar com delimitador |
  return cupom.join(L) + L;
}

async function enviarCupom() {
  return new Promise((resolve, reject) => {
    console.log('\n╔═══════════════════════════════════════════════════════════════════╗');
    console.log('║           TESTE VISUAL - CUPOM COM LETRA ROXA                    ║');
    console.log('╚═══════════════════════════════════════════════════════════════════╝\n');

    console.log(`📡 DVR: ${DVR_CONFIG.ip}:${DVR_CONFIG.port}`);
    console.log(`🎨 Cor configurada no DVR: ROXA (para fácil visualização)\n`);

    const cupom = formatarCupom();

    console.log('📋 CUPOM QUE SERÁ ENVIADO:');
    console.log('═'.repeat(70));
    // Exibir sem o delimitador para visualização
    console.log(cupom.split('|').join('\n'));
    console.log('═'.repeat(70));

    console.log(`\n📦 Tamanho do cupom: ${cupom.length} bytes`);
    console.log(`📊 Total de linhas: ${cupom.split('|').length}\n`);

    console.log('🔌 Conectando ao DVR...');

    const client = new net.Socket();
    client.setTimeout(5000);

    client.on('connect', () => {
      console.log('✅ Conectado ao DVR!\n');
      console.log('📤 Enviando cupom...');

      client.write(cupom, 'utf8', (err) => {
        if (err) {
          console.error('❌ Erro ao enviar:', err.message);
          client.destroy();
          reject(err);
        } else {
          console.log('✅ Cupom enviado com sucesso!\n');

          console.log('═'.repeat(70));
          console.log('📺 VERIFICAÇÃO VISUAL:');
          console.log('═'.repeat(70));
          console.log('\n1. Acesse http://10.6.1.123 no navegador');
          console.log('2. Faça login com: admin / beto3107@');
          console.log('3. Vá para a visualização AO VIVO');
          console.log('4. Olhe o CANAL 5 (PDV2)');
          console.log('5. Você DEVE VER o texto ROXO sobreposto no vídeo\n');

          console.log('✅ CHECKLIST DE VERIFICAÇÃO:');
          console.log('   [ ] Texto aparece em ROXO?');
          console.log('   [ ] Todos os 5 produtos estão visíveis?');
          console.log('   [ ] Valores estão corretos?');
          console.log('   [ ] Formatação está legível?');
          console.log('   [ ] Data e hora estão corretos?\n');

          console.log('═'.repeat(70));
          console.log('🎯 Tempo de exibição: 120 segundos (2 minutos)');
          console.log('═'.repeat(70));
          console.log('\n');

          client.end();
          resolve();
        }
      });
    });

    client.on('error', (err) => {
      console.error(`❌ Erro de conexão: ${err.message}\n`);
      reject(err);
    });

    client.on('timeout', () => {
      console.error('⏱️  Timeout na conexão\n');
      client.destroy();
      reject(new Error('Timeout'));
    });

    client.on('close', () => {
      console.log('🔌 Conexão fechada.\n');
    });

    client.connect(DVR_CONFIG.port, DVR_CONFIG.ip);
  });
}

enviarCupom().catch(err => {
  console.error('❌ Falha:', err.message);
  process.exit(1);
});
