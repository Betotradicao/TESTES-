const axios = require('axios');

async function buscarTabelaMotivos() {
  const apiUrl = 'http://10.6.1.101/manager/restful/integracao/cadastro_sincrono.php5';

  console.log('🔍 Buscando tabelas de motivos/descontos no Zanthus...\n');

  // Queries para buscar tabelas relacionadas
  const queries = [
    {
      nome: 'A06CQ - Cadastro de Motivos',
      sql: 'SELECT * FROM ZAN_A06CQ WHERE ROWNUM <= 30'
    },
    {
      nome: 'A06CN - Cadastro de Funções',
      sql: 'SELECT * FROM ZAN_A06CN WHERE ROWNUM <= 30'
    },
    {
      nome: 'A06CO - Cadastro',
      sql: 'SELECT * FROM ZAN_A06CO WHERE ROWNUM <= 30'
    },
    {
      nome: 'A06CP - Tipos de Preços',
      sql: 'SELECT * FROM ZAN_A06CP WHERE ROWNUM <= 30'
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
        console.log('\nPrimeiros 5 registros:');
        dados.slice(0, 5).forEach((d, i) => {
          console.log(`\nRegistro ${i+1}:`);
          console.log(JSON.stringify(d, null, 2));
        });
      } else {
        console.log('⚠️  Tabela vazia ou não existe');
      }
    } catch (e) {
      console.log('❌ Erro:', e.response?.status || e.message);
    }

    console.log('\n');
  }

  // Agora testar buscar especificamente os motivos 10 e 20
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('Buscando MOTIVOS específicos (10 e 20)');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  const sqlMotivosEspecificos = "SELECT * FROM ZAN_A06CQ WHERE A06CQ IN (10, 20)";

  const json2 = {
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
              MOTIVOS: {
                MOTIVO: {
                  SQL: sqlMotivosEspecificos
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

    const motivos = res.data?.QUERY?.CONTENT || [];

    if (motivos.length > 0) {
      console.log('✅ ENCONTROU os motivos!\n');
      motivos.forEach(m => {
        console.log('Código:', m.A06CQ);
        console.log('Dados completos:', JSON.stringify(m, null, 2));
        console.log('---');
      });
    }
  } catch (e) {
    console.log('❌ Não encontrou com essa query');
  }
}

buscarTabelaMotivos();
