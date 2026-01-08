const axios = require('axios');

async function buscarFuncionarios() {
  const apiUrl = 'http://10.6.1.101/manager/restful/integracao/cadastro_sincrono.php5';

  console.log('🔍 Buscando tabelas de FUNCIONÁRIOS/OPERADORES...\n');

  const queries = [
    {
      nome: 'TAB_FUNCIONARIO',
      sql: 'SELECT * FROM TAB_FUNCIONARIO WHERE ROWNUM <= 10'
    },
    {
      nome: 'TAB_OPERADOR',
      sql: 'SELECT * FROM TAB_OPERADOR WHERE ROWNUM <= 10'
    },
    {
      nome: 'TAB_USUARIO',
      sql: 'SELECT * FROM TAB_USUARIO WHERE ROWNUM <= 10'
    },
    {
      nome: 'TAB_FUNCIONARIO com código 3 e 28',
      sql: 'SELECT * FROM TAB_FUNCIONARIO WHERE COD_FUNCIONARIO IN (3, 28)'
    },
    {
      nome: 'TAB_OPERADOR com código 3 e 28',
      sql: 'SELECT * FROM TAB_OPERADOR WHERE COD_OPERADOR IN (3, 28)'
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

        dados.forEach((d, i) => {
          console.log(`\n📋 Registro ${i+1}:`);
          // Mostrar todos os campos para identificar qual tem o nome
          Object.keys(d).forEach(key => {
            if (d[key] && d[key] !== '[]') {
              console.log(`  ${key}: ${d[key]}`);
            }
          });
        });
      } else {
        console.log('⚠️  Vazio ou não existe');
      }
    } catch (e) {
      console.log('❌ Erro:', e.response?.status || e.message);
    }

    console.log('\n');
  }
}

buscarFuncionarios();
