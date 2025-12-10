const axios = require('axios');
const { URLSearchParams } = require('url');

const apiUrl = 'http://10.6.1.101/manager/restful/integracao/cadastro_sincrono.php5';
const apiToken = '8e1ae7bf4ba74b39eff0f7bdddaa35b1';

async function testVendas() {
  try {
    const sqlVendas = "SELECT * FROM ZAN_M43 WHERE ROWNUM <= 5 ORDER BY M00AF DESC";

    const config = {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Bearer ${apiToken}`
      }
    };

    const jsonDataVendas = {
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
                    SQL: sqlVendas
                  }
                }
              }
            }
          }
        }
      }
    };

    const formDataVendas = new URLSearchParams();
    formDataVendas.append('str_json', JSON.stringify(jsonDataVendas));

    console.log('Testando query de vendas simplificada...');
    console.log('SQL:', sqlVendas);

    const responseVendas = await axios.post(apiUrl, formDataVendas.toString(), config);
    console.log('Status:', responseVendas.status);
    console.log('Vendas encontradas:', responseVendas.data?.QUERY?.SUMMARY || 0);
    console.log('Primeira venda:', JSON.stringify(Array.isArray(responseVendas.data?.QUERY?.CONTENT) ? responseVendas.data.QUERY.CONTENT[0] : responseVendas.data?.QUERY?.CONTENT, null, 2));

  } catch (error) {
    console.error('\n=== ERRO ===');
    console.error('Mensagem:', error.message);
    console.error('Código:', error.code);
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Data:', error.response.data);
    }
  }
}

testVendas();
