const axios = require('axios');

async function buscarFormaPagamento() {
  const apiUrl = 'http://10.6.1.101/manager/restful/integracao/cadastro_sincrono.php5';

  const ontem = new Date();
  ontem.setDate(ontem.getDate() - 1);
  const data = ontem.toISOString().split('T')[0];

  console.log('💳 Buscando FORMA DE PAGAMENTO nas vendas\n');

  // Testar todas as vendas
  const sql1 = `
    SELECT DISTINCT M43AZ as planoPag, COUNT(*) as qtd
    FROM ZAN_M43
    WHERE TRUNC(M00AF) = TO_DATE('${data}','YYYY-MM-DD')
    GROUP BY M43AZ
    ORDER BY qtd DESC
  `.replace(/\s+/g, ' ').trim();

  console.log('1️⃣ Buscando planos de pagamento em M43AZ...\n');

  let json = {
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
                  SQL: sql1
                }
              }
            }
          }
        }
      }
    }
  };

  let formData = new URLSearchParams();
  formData.append('str_json', JSON.stringify(json));

  try {
    const res = await axios.post(apiUrl, formData.toString(), {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      timeout: 60000
    });

    const dados = res.data?.QUERY?.CONTENT?.filter(d => d.PLANOPAG !== undefined) || [];

    if (dados.length > 0) {
      console.log('Planos de pagamento encontrados:');
      dados.forEach(d => {
        console.log(`  Plano ${d.PLANOPAG}: ${d.QTD} vendas`);
      });
    } else {
      console.log('⚠️  M43AZ está vazio em todas as vendas');
    }
  } catch (e) {
    console.error('❌ Erro:', e.message);
  }

  // Buscar na tabela de CUPOM/NOTA (M01)
  console.log('\n2️⃣ Buscando na tabela M01 (CUPOM FISCAL)...\n');

  const sql2 = `
    SELECT
      M00AD as cupom,
      M00_TURNO as turno,
      M00ZA as loja,
      M00AC as caixa
    FROM ZAN_M01
    WHERE TRUNC(M00AF) = TO_DATE('${data}','YYYY-MM-DD')
    AND ROWNUM <= 10
  `.replace(/\s+/g, ' ').trim();

  json = {
    ZMI: {
      DATABASES: {
        DATABASE: {
          "@attributes": {
            NAME: "MANAGER",
            AUTOCOMMIT_VALUE: "1000",
            AUTOCOMMIT_ENABLED: "1",
            HALTONERROR: "0"
          },
          COMMANDS: {
            SELECT: {
              CUPONS: {
                CUPOM: {
                  SQL: sql2
                }
              }
            }
          }
        }
      }
    }
  };

  formData = new URLSearchParams();
  formData.append('str_json', JSON.stringify(json));

  try {
    const res = await axios.post(apiUrl, formData.toString(), {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      timeout: 60000
    });

    const cupons = res.data?.QUERY?.CONTENT?.filter(c => c.CUPOM) || [];

    if (cupons.length > 0) {
      console.log('✅ Tabela M01 (CUPOM) existe! Primeiros cupons:');
      cupons.forEach((c, i) => {
        console.log(`  ${i+1}. Cupom ${c.CUPOM} - Caixa ${c.CAIXA} - Loja ${c.LOJA}`);
      });
      console.log('\n⚠️  Preciso buscar CAMPOS de pagamento na M01');
    } else {
      console.log('⚠️  Tabela M01 vazia ou não acessível');
    }
  } catch (e) {
    console.log('❌ Tabela M01 não acessível:', e.response?.status || e.message);
  }

  // Buscar tabela de PAGAMENTOS (M02)
  console.log('\n3️⃣ Buscando na tabela M02 (PAGAMENTOS)...\n');

  const sql3 = `
    SELECT *
    FROM ZAN_M02
    WHERE TRUNC(M00AF) = TO_DATE('${data}','YYYY-MM-DD')
    AND ROWNUM <= 10
  `.replace(/\s+/g, ' ').trim();

  json = {
    ZMI: {
      DATABASES: {
        DATABASE: {
          "@attributes": {
            NAME: "MANAGER",
            AUTOCOMMIT_VALUE: "1000",
            AUTOCOMMIT_ENABLED: "1",
            HALTONERROR: "0"
          },
          COMMANDS: {
            SELECT: {
              PAGAMENTOS: {
                PAGAMENTO: {
                  SQL: sql3
                }
              }
            }
          }
        }
      }
    }
  };

  formData = new URLSearchParams();
  formData.append('str_json', JSON.stringify(json));

  try {
    const res = await axios.post(apiUrl, formData.toString(), {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      timeout: 60000
    });

    const pagamentos = res.data?.QUERY?.CONTENT?.filter(p => Object.keys(p).length > 0) || [];

    if (pagamentos.length > 0) {
      console.log('✅ Tabela M02 (PAGAMENTOS) existe!');
      console.log('\nPrimeiro registro completo:');
      console.log(JSON.stringify(pagamentos[0], null, 2));
    } else {
      console.log('⚠️  Tabela M02 vazia ou não acessível');
    }
  } catch (e) {
    console.log('❌ Tabela M02 não acessível:', e.response?.status || e.message);
  }
}

buscarFormaPagamento();
