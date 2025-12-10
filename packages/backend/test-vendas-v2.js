const axios = require('axios');
const { URLSearchParams } = require('url');

const apiUrl = 'http://10.6.1.101/manager/restful/integracao/cadastro_sincrono.php5';
const apiToken = '8e1ae7bf4ba74b39eff0f7bdddaa35b1';

async function testVendas() {
  try {
    // Teste 1: Sem ORDER BY
    console.log('\n=== TESTE 1: Query simples sem ORDER BY ===');
    const sql1 = "SELECT * FROM ZAN_M43 WHERE ROWNUM <= 5";
    await testarQuery(sql1, 'vendas_simples');

    // Teste 2: Com subquery para ORDER BY
    console.log('\n=== TESTE 2: Query com subquery para ordenação ===');
    const sql2 = "SELECT * FROM (SELECT * FROM ZAN_M43 ORDER BY M00AF DESC) WHERE ROWNUM <= 5";
    await testarQuery(sql2, 'vendas_ordenadas');

  } catch (error) {
    console.error('Erro geral:', error.message);
  }
}

async function testarQuery(sql, nome) {
  try {
    const config = {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Bearer ${apiToken}`
      }
    };

    const jsonData = {
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
                VENDAS: {
                  VENDA: {
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
    formData.append('str_json', JSON.stringify(jsonData));

    console.log(`Testando: ${nome}`);
    console.log('SQL:', sql);

    const response = await axios.post(apiUrl, formData.toString(), config);
    console.log('✓ SUCCESS! Status:', response.status);
    console.log('Vendas encontradas:', response.data?.QUERY?.SUMMARY || 0);

    const content = response.data?.QUERY?.CONTENT;
    if (content) {
      const firstItem = Array.isArray(content) ? content[0] : content;
      console.log('Primeira venda (campos):', Object.keys(firstItem || {}).join(', '));
    }

  } catch (error) {
    console.error('✗ ERRO');
    console.error('Mensagem:', error.message);
    if (error.response) {
      console.error('Status:', error.response.status);
    }
  }
}

testVendas();
