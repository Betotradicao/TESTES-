const axios = require('axios');

async function buscarTodosOperadores() {
  const apiUrl = 'http://10.6.1.101/manager/restful/integracao/cadastro_sincrono.php5';

  const ontem = new Date();
  ontem.setDate(ontem.getDate() - 1);
  const data = ontem.toISOString().split('T')[0];

  console.log('🔍 Buscando TODOS os operadores que trabalharam em', data);
  console.log('');

  const sql = `
    SELECT DISTINCT
      M00AC as caixa,
      M43CZ as operador,
      COUNT(*) as qtd
    FROM ZAN_M43
    WHERE TRUNC(M00AF) = TO_DATE('${data}','YYYY-MM-DD')
    GROUP BY M00AC, M43CZ
    ORDER BY M00AC, M43CZ
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

    const dados = res.data?.QUERY?.CONTENT?.filter(d => d.CAIXA) || [];

    console.log('📊 TODOS OS OPERADORES DO DIA:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    console.log('Caixa | Operador | Vendas');
    console.log('------|----------|-------');

    dados.forEach(d => {
      const caixa = String(d.CAIXA).padStart(2, ' ');
      const op = String(d.OPERADOR).padStart(3, ' ');
      const qtd = String(d.QTD).padStart(5, ' ');
      console.log(`  ${caixa}  |   ${op}    | ${qtd}`);
    });

    const operadoresUnicos = [...new Set(dados.map(d => d.OPERADOR))].sort((a, b) => a - b);
    const caixasUnicos = [...new Set(dados.map(d => d.CAIXA))].sort((a, b) => a - b);

    console.log('\n📈 RESUMO:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('Total de caixas ativos:', caixasUnicos.length);
    console.log('Caixas:', caixasUnicos.join(', '));
    console.log('');
    console.log('Total de operadores:', operadoresUnicos.length);
    console.log('Operadores:', operadoresUnicos.join(', '));

    console.log('\n🎯 MAPEAMENTO CAIXA → OPERADOR:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    caixasUnicos.forEach(caixa => {
      const ops = dados.filter(d => d.CAIXA == caixa);
      console.log(`Caixa ${caixa}:`);
      ops.forEach(op => {
        console.log(`  → Operador ${op.OPERADOR} (${op.QTD} vendas)`);
      });
    });

  } catch (e) {
    console.error('❌ Erro:', e.message);
  }
}

buscarTodosOperadores();
