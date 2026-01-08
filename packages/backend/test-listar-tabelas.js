const axios = require('axios');

async function listarTabelas() {
  const apiUrl = 'http://10.6.1.101/manager/restful/integracao/cadastro_sincrono.php5';

  console.log('🔍 TENTANDO LISTAR TABELAS DISPONÍVEIS NO BANCO');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  const queries = [
    {
      nome: 'Oracle User Tables',
      sql: `SELECT table_name FROM user_tables WHERE table_name LIKE 'ZAN_%' OR table_name LIKE 'TAB_%' OR table_name LIKE 'M%' ORDER BY table_name`
    },
    {
      nome: 'Oracle All Tables',
      sql: `SELECT table_name FROM all_tables WHERE table_name LIKE 'ZAN_%' AND ROWNUM <= 50 ORDER BY table_name`
    },
    {
      nome: 'Tabelas que começam com M',
      sql: `SELECT table_name FROM user_tables WHERE table_name LIKE 'M%' AND ROWNUM <= 30`
    },
    {
      nome: 'Views ZAN',
      sql: `SELECT view_name FROM user_views WHERE view_name LIKE 'ZAN_%' AND ROWNUM <= 30`
    }
  ];

  for (const query of queries) {
    console.log(`\n📋 TESTANDO: ${query.nome}`);
    console.log('─────────────────────────────────────────────\n');

    let json = {
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
                TABELAS: {
                  TABELA: {
                    SQL: query.sql.replace(/\s+/g, ' ').trim()
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

      const dados = res.data?.QUERY?.CONTENT || [];

      if (dados.length > 0) {
        console.log(`✅ SUCESSO! Encontradas ${dados.length} tabelas:\n`);
        dados.forEach((d, i) => {
          console.log(`${i + 1}. ${d.TABLE_NAME || d.VIEW_NAME}`);
        });
      } else {
        console.log('⚠️  Nenhuma tabela encontrada');
      }
    } catch (e) {
      if (e.response?.status === 500) {
        console.log('❌ Consulta não permitida (sem permissão)');
      } else {
        console.log('❌ ERRO:', e.message);
      }
    }

    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  }

  // Tentar descobrir estrutura da M43 que sabemos que funciona
  console.log('\n\n📊 TENTANDO DESCOBRIR ESTRUTURA DA TABELA ZAN_M43');
  console.log('─────────────────────────────────────────────\n');

  const sqlColunas = `
    SELECT column_name, data_type, data_length
    FROM user_tab_columns
    WHERE table_name = 'ZAN_M43'
    ORDER BY column_id
  `.replace(/\s+/g, ' ').trim();

  let json = {
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
              COLUNAS: {
                COLUNA: {
                  SQL: sqlColunas
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

    const colunas = res.data?.QUERY?.CONTENT || [];

    if (colunas.length > 0) {
      console.log(`✅ SUCESSO! Encontradas ${colunas.length} colunas:\n`);
      console.log('| Coluna | Tipo | Tamanho |');
      console.log('|--------|------|---------|');
      colunas.forEach(c => {
        console.log(`| ${c.COLUMN_NAME} | ${c.DATA_TYPE} | ${c.DATA_LENGTH || '-'} |`);
      });
    } else {
      console.log('⚠️  Nenhuma coluna encontrada');
    }
  } catch (e) {
    if (e.response?.status === 500) {
      console.log('❌ Consulta de estrutura não permitida');
    } else {
      console.log('❌ ERRO:', e.message);
    }
  }

  console.log('\n✅ Testes concluídos!\n');
}

listarTabelas();
