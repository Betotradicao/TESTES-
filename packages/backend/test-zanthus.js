const axios = require('axios');
const { URLSearchParams } = require('url');

async function buscarVendasOntem() {
  // Data de ontem
  const date = new Date();
  date.setDate(date.getDate() - 1);
  const ontem = date.toISOString().split('T')[0];

  console.log('Buscando vendas de:', ontem);

  // SQL para buscar vendas
  const sql = `
    SELECT
      z.M00AC as codCaixa,
      z.M00ZA as codLoja,
      z.M43AH as codProduto,
      LPAD(z.M43AH, 13, '0') as codBarraPrincipal,
      z.M00AF as dtaSaida,
      z.M00AD as numCupomFiscal,
      z.M43DQ as valVenda,
      z.M43AO as qtdTotalProduto,
      z.M43AP as valTotalProduto,
      z.M43AQ as descontoAplicado,
      TO_CHAR(TO_TIMESTAMP(TO_CHAR(z.M00AF,'YYYY-MM-DD') || ' ' || LPAD(z.M43AS,4,'0'), 'YYYY-MM-DD HH24MI'), 'YYYY-MM-DD HH24:MI:SS') AS dataHoraVenda,
      p.DESCRICAO_PRODUTO as desProduto
    FROM ZAN_M43 z
    LEFT JOIN TAB_PRODUTO p ON p.COD_PRODUTO LIKE '%' || z.M43AH
    WHERE TRUNC(z.M00AF) BETWEEN TO_DATE('${ontem}','YYYY-MM-DD') AND TO_DATE('${ontem}','YYYY-MM-DD')
  `.replace(/\s+/g, ' ').trim();

  // Estrutura JSON da Zanthus
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
              MERCADORIAS: {
                MERCADORIA: {
                  SQL: sql
                }
              }
            }
          }
        }
      }
    }
  };

  // Form data
  const formData = new URLSearchParams();
  formData.append('str_json', JSON.stringify(jsonData));

  try {
    console.log('Fazendo requisição para Zanthus API...');
    const response = await axios.post(
      'http://10.6.1.101/manager/restful/integracao/cadastro_sincrono.php5',
      formData.toString(),
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        timeout: 60000
      }
    );

    const vendas = response.data?.QUERY?.CONTENT || [];
    const total = Array.isArray(vendas) ? vendas.length : 0;

    console.log('\n=== RESULTADO ===');
    console.log('Total de vendas encontradas:', total);

    if (total > 0) {
      console.log('\n=== PRIMEIRA VENDA ===');
      console.log(JSON.stringify(vendas[0], null, 2));

      console.log('\n=== RESUMO DAS VENDAS ===');
      const totalVendido = vendas.reduce((sum, v) => sum + parseFloat(v.VALTOTALPRODUTO || 0), 0);
      console.log('Valor total vendido:', totalVendido.toFixed(2));
    } else {
      console.log('Nenhuma venda encontrada para', ontem);
    }
  } catch (error) {
    console.error('\n=== ERRO ===');
    console.error('Mensagem:', error.message);
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Data:', error.response.data);
    }
  }
}

buscarVendasOntem();
