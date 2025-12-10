const axios = require('axios');
const { URLSearchParams } = require('url');

const apiUrl = 'http://10.6.1.101/manager/restful/integracao/cadastro_sincrono.php5';

async function testVendas() {
  try {
    const ontem = new Date();
    ontem.setDate(ontem.getDate() - 1);
    const dataOntem = ontem.toISOString().split('T')[0];

    // Query SQL igual ao teste que funcionou
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
      WHERE TRUNC(z.M00AF) = TO_DATE('${dataOntem}','YYYY-MM-DD')
      AND ROWNUM <= 5
    `.replace(/\s+/g, ' ').trim();

    const config = {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
        // SEM TOKEN!
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
                MERCADORIAS: {  // Usando MERCADORIAS como no teste que funcionou
                  MERCADORIA: {
                    SQL: sqlVendas
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

    console.log('Testando vendas SEM token de autorização...');
    console.log('SQL:', sqlVendas);

    const response = await axios.post(apiUrl, formData.toString(), config);
    console.log('✓ SUCCESS! Status:', response.status);
    console.log('Vendas encontradas:', response.data?.QUERY?.SUMMARY || 0);

    const content = response.data?.QUERY?.CONTENT;
    if (content) {
      const firstItem = Array.isArray(content) ? content[0] : content;
      console.log('Primeira venda:', JSON.stringify(firstItem, null, 2));
    }

  } catch (error) {
    console.error('✗ ERRO');
    console.error('Mensagem:', error.message);
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Data:', error.response.data);
    }
  }
}

testVendas();
