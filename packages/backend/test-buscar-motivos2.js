const axios = require('axios');

async function buscarMotivos() {
  const apiUrl = 'http://10.6.1.101/manager/restful/integracao/cadastro_sincrono.php5';

  console.log('🔍 Buscando descrição dos motivos de desconto...\n');

  // Baseado na documentação M43, vou tentar outras abordagens
  const queries = [
    {
      nome: 'TAB_MOTIVO_DESCONTO',
      sql: 'SELECT * FROM TAB_MOTIVO_DESCONTO WHERE ROWNUM <= 30'
    },
    {
      nome: 'TAB_FUNCAO (Funções do sistema)',
      sql: 'SELECT * FROM TAB_FUNCAO WHERE ROWNUM <= 30'
    },
    {
      nome: 'TAB_TIPO_PRECO',
      sql: 'SELECT * FROM TAB_TIPO_PRECO WHERE ROWNUM <= 30'
    },
    {
      nome: 'M43 com motivos específicos',
      sql: "SELECT DISTINCT M43DF as codigo_motivo, COUNT(*) as qtd FROM ZAN_M43 WHERE M43DF IS NOT NULL AND M43DF != '[]' GROUP BY M43DF ORDER BY qtd DESC"
    },
    {
      nome: 'Verificar estrutura M43DF',
      sql: "SELECT M43DF, M43DG, M43AQ, M43AH FROM ZAN_M43 WHERE M43DF IS NOT NULL AND M43DF != '[]' AND M43DF != 0 AND ROWNUM <= 10"
    }
  ];

  for (const q of queries) {
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('Testando:', q.nome);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    const json = {
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
                DADOS: {
                  DADO: {
                    SQL: q.sql
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
        timeout: 30000
      });

      const dados = res.data?.QUERY?.CONTENT || [];

      if (dados.length > 0 && dados[0] && Object.keys(dados[0]).length > 0) {
        console.log('✅ ENCONTROU! Total:', dados.length);
        dados.slice(0, 10).forEach((d, i) => {
          console.log(`\n${i+1}:`, JSON.stringify(d, null, 2));
        });
      } else {
        console.log('⚠️  Vazio ou não existe');
      }
    } catch (e) {
      console.log('❌ Erro:', e.response?.status || e.message);
    }

    console.log('\n');
  }

  // Tentar buscar diretamente nas vendas que TEM motivo
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('Vendas com MOTIVO DESCONTO preenchido');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  const ontem = new Date();
  ontem.setDate(ontem.getDate() - 1);
  const data = ontem.toISOString().split('T')[0];

  const sqlVendasComMotivo = `
    SELECT
      M43DF as motivoDesconto,
      M43DG as autorizador,
      M43AQ as desconto,
      M00AD as cupom,
      M43AH as produto,
      p.DESCRICAO_PRODUTO as descProduto
    FROM ZAN_M43
    LEFT JOIN TAB_PRODUTO p ON p.COD_PRODUTO LIKE '%' || M43AH
    WHERE TRUNC(M00AF) = TO_DATE('${data}','YYYY-MM-DD')
    AND M43DF IS NOT NULL
    AND M43DF != 0
    AND ROWNUM <= 20
  `.replace(/\s+/g, ' ').trim();

  const json2 = {
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
                  SQL: sqlVendasComMotivo
                }
              }
            }
          }
        }
      }
    }
  };

  const formData2 = new URLSearchParams();
  formData2.append('str_json', JSON.stringify(json2));

  try {
    const res = await axios.post(apiUrl, formData2.toString(), {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      timeout: 30000
    });

    const vendas = res.data?.QUERY?.CONTENT || [];

    if (vendas.length > 0) {
      console.log('✅ Vendas com motivo encontradas:', vendas.length);

      // Agrupar por motivo
      const porMotivo = {};
      vendas.forEach(v => {
        const motivo = v.MOTIVODESCONTO;
        if (!porMotivo[motivo]) {
          porMotivo[motivo] = [];
        }
        porMotivo[motivo].push(v);
      });

      console.log('\n📊 Agrupado por MOTIVO:');
      Object.keys(porMotivo).forEach(motivo => {
        console.log(`\nMotivo ${motivo}: ${porMotivo[motivo].length} vendas`);
        console.log('  Exemplo:', JSON.stringify(porMotivo[motivo][0], null, 2));
      });
    }
  } catch (e) {
    console.log('❌ Erro:', e.message);
  }
}

buscarMotivos();
