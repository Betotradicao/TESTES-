const axios = require('axios');

async function buscarDescontosDetalhados() {
  const apiUrl = 'http://10.6.1.101/manager/restful/integracao/cadastro_sincrono.php5';

  const ontem = new Date();
  ontem.setDate(ontem.getDate() - 1);
  const data = ontem.toISOString().split('T')[0];

  console.log('🎫 Buscando DESCONTOS com detalhes de CAIXA e OPERADOR\n');

  // Buscar vendas com desconto + info do operador
  const sql = `
    SELECT
      M00AD as cupom,
      M00AC as caixa,
      M43CZ as operador,
      M43AH as produto,
      M43AP as valTotal,
      M43AQ as desconto,
      M43DF as motivoDesconto,
      M43DG as autorizadorDesconto,
      M43AZ as planoPagamento,
      M00_TURNO as turno,
      p.DESCRICAO_PRODUTO as descProduto
    FROM ZAN_M43
    LEFT JOIN TAB_PRODUTO p ON p.COD_PRODUTO LIKE '%' || M43AH
    WHERE TRUNC(M00AF) = TO_DATE('${data}','YYYY-MM-DD')
    AND M43AQ IS NOT NULL
    AND M43AQ != 0
  `.replace(/\s+/g, ' ').trim();

  const json = {
    ZMI: {
      DATABASES: {
        DATABASE: {
          "@attributes": {
            NAME: "MANAGER",
            AUTOCOMMIT_VALUE: "1000",
            AUTOCOMMIT_ENABLED: "1",
            HALTONERROR: "1"
          },
          COMMANDS: {
            SELECT: {
              MERCADORIAS: {
                MERCADORIA: {
                  SQL: sql
                }
              }
            }
          }
        }
      }
    }
  };

  const formData = new URLSearchParams();
  formData.append('str_json', JSON.stringify(json));

  try {
    const res = await axios.post(apiUrl, formData.toString(), {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      timeout: 60000
    });

    const vendas = res.data?.QUERY?.CONTENT?.filter(v => v.CUPOM) || [];

    console.log('✅ Total de vendas com DESCONTO:', vendas.length);
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(' # | Cupom  | Caixa | Operador | Produto              | Desconto | Motivo | Autorizado | Plano Pag');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    vendas.forEach((v, i) => {
      const num = String(i + 1).padStart(2, ' ');
      const cupom = String(v.CUPOM).padStart(6, ' ');
      const caixa = String(v.CAIXA).padStart(2, ' ');
      const op = String(v.OPERADOR).padStart(4, ' ');
      const prod = (v.DESCPRODUTO || v.PRODUTO).substring(0, 20).padEnd(20, ' ');
      const desc = String('R$ ' + v.DESCONTO).padStart(8, ' ');
      const motivo = String(v.MOTIVODESCONTO || '-').padStart(6, ' ');
      const aut = String(v.AUTORIZADORDESCONTO || '-').padStart(10, ' ');
      const pag = String(v.PLANOPAGAMENTO || '-').padStart(9, ' ');

      console.log(` ${num} | ${cupom} |  ${caixa}   |   ${op}   | ${prod} | ${desc} | ${motivo} | ${aut} | ${pag}`);
    });

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    // Estatísticas
    console.log('📊 ESTATÍSTICAS POR OPERADOR:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    const porOperador = {};
    vendas.forEach(v => {
      const op = v.OPERADOR;
      if (!porOperador[op]) {
        porOperador[op] = {
          qtd: 0,
          totalDesconto: 0,
          caixas: new Set()
        };
      }
      porOperador[op].qtd++;
      porOperador[op].totalDesconto += parseFloat(v.DESCONTO || 0);
      porOperador[op].caixas.add(v.CAIXA);
    });

    Object.keys(porOperador).sort().forEach(op => {
      const info = porOperador[op];
      console.log(`Operador ${op}:`);
      console.log(`  Descontos dados: ${info.qtd}`);
      console.log(`  Total descontado: R$ ${info.totalDesconto.toFixed(2)}`);
      console.log(`  Caixas: ${[...info.caixas].sort().join(', ')}`);
      console.log('');
    });

    // Verificar plano de pagamento
    const comPlanoPag = vendas.filter(v => v.PLANOPAGAMENTO && v.PLANOPAGAMENTO != 0 && v.PLANOPAGAMENTO != '0');

    console.log('💳 FORMA DE PAGAMENTO:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    if (comPlanoPag.length > 0) {
      console.log('✅ Vendas com plano de pagamento:', comPlanoPag.length);
      const planos = [...new Set(comPlanoPag.map(v => v.PLANOPAGAMENTO))];
      console.log('Planos encontrados:', planos.join(', '));
    } else {
      console.log('⚠️  Nenhuma venda com plano de pagamento informado nessas vendas');
      console.log('(O plano de pagamento pode estar em outra tabela)');
    }

  } catch (e) {
    console.error('❌ Erro:', e.message);
  }
}

buscarDescontosDetalhados();
