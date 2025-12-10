const axios = require('axios');
const { URLSearchParams } = require('url');

const apiUrl = 'http://10.6.1.101/manager/restful/integracao/cadastro_sincrono.php5';

async function testProdutos() {
  try {
    const sqlProdutos = "SELECT * FROM TAB_PRODUTO WHERE ROWNUM <= 5";

    const config = {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
        // SEM TOKEN
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
                PRODUTOS: {
                  PRODUTO: {
                    SQL: sqlProdutos
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

    console.log('Testando produtos SEM token...');
    const response = await axios.post(apiUrl, formData.toString(), config);
    console.log('✓ SUCCESS! Status:', response.status);
    console.log('Produtos encontrados:', response.data?.QUERY?.SUMMARY || 0);

  } catch (error) {
    console.error('✗ ERRO');
    console.error('Mensagem:', error.message);
    if (error.response) {
      console.error('Status:', error.response.status);
    }
  }
}

testProdutos();
