const axios = require('axios');
const { URLSearchParams } = require('url');

const apiUrl = 'http://10.6.1.101/manager/restful/integracao/cadastro_sincrono.php5';
const apiToken = '8e1ae7bf4ba74b39eff0f7bdddaa35b1';

async function testZanthus() {
  try {
    const hoje = new Date();
    const dataHoje = hoje.toISOString().split('T')[0];

    // Query SQL para buscar produtos
    const sqlProdutos = "SELECT * FROM TAB_PRODUTO WHERE ROWNUM <= 5";

    // Query SQL para buscar vendas
    const sqlVendas = `
      SELECT
        z.M00AC as codCaixa,
        z.M00ZA as codLoja,
        z.M43AH as codProduto,
        z.M00AF as dtaSaida,
        z.M00AD as numCupomFiscal,
        z.M43DQ as valVenda,
        z.M43AO as qtdTotalProduto,
        z.M43AP as valTotalProduto,
        p.DESCRICAO_PRODUTO as desProduto
      FROM ZAN_M43 z
      LEFT JOIN TAB_PRODUTO p ON p.COD_PRODUTO LIKE '%' || z.M43AH
      WHERE TRUNC(z.M00AF) = TO_DATE('${dataHoje}','YYYY-MM-DD')
      AND ROWNUM <= 5
    `.replace(/\s+/g, ' ').trim();

    const config = {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Bearer ${apiToken}`
      }
    };

    // Requisição 1: Produtos
    console.log('\n=== TESTANDO REQUISIÇÃO DE PRODUTOS ===');
    const jsonDataProdutos = {
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

    const formDataProdutos = new URLSearchParams();
    formDataProdutos.append('str_json', JSON.stringify(jsonDataProdutos));

    console.log('Enviando requisição de produtos...');
    const responseProdutos = await axios.post(apiUrl, formDataProdutos.toString(), config);
    console.log('Status produtos:', responseProdutos.status);
    console.log('Dados produtos:', JSON.stringify(responseProdutos.data, null, 2));

    // Requisição 2: Vendas
    console.log('\n=== TESTANDO REQUISIÇÃO DE VENDAS ===');
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

    console.log('Enviando requisição de vendas...');
    const responseVendas = await axios.post(apiUrl, formDataVendas.toString(), config);
    console.log('Status vendas:', responseVendas.status);
    console.log('Dados vendas:', JSON.stringify(responseVendas.data, null, 2));

    // Testa ambas em paralelo
    console.log('\n=== TESTANDO REQUISIÇÕES EM PARALELO ===');
    const [p, v] = await Promise.all([
      axios.post(apiUrl, formDataProdutos.toString(), config),
      axios.post(apiUrl, formDataVendas.toString(), config)
    ]);

    console.log('Paralelo - Status produtos:', p.status);
    console.log('Paralelo - Status vendas:', v.status);

    const produtosContent = p.data?.QUERY?.CONTENT;
    const vendasContent = v.data?.QUERY?.CONTENT;

    console.log('\nProdutos encontrados:', Array.isArray(produtosContent) ? produtosContent.length : 1);
    console.log('Vendas encontradas:', Array.isArray(vendasContent) ? vendasContent.length : (vendasContent ? 1 : 0));

  } catch (error) {
    console.error('\n=== ERRO ===');
    console.error('Mensagem:', error.message);
    console.error('Código:', error.code);
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Status Text:', error.response.statusText);
      console.error('Data:', error.response.data);
    }
  }
}

testZanthus();
