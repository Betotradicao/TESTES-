const axios = require('axios');

async function buscarOperadora() {
  const apiUrl = 'http://10.6.1.101/manager/restful/integracao/cadastro_sincrono.php5';

  console.log('🔍 Buscando OPERADORA DE CAIXA nas vendas...\n');

  const ontem = new Date();
  ontem.setDate(ontem.getDate() - 1);
  const data = ontem.toISOString().split('T')[0];

  // Vou buscar TODOS os campos M43 relacionados a operador/funcionário/vendedor
  const sql = `
    SELECT
      M00AD as cupom,
      M00AC as caixa,
      M43AH as produto,
      M43AM as codVendedor,
      M43BB as codCliente,
      M43CY as codAutorizadorVenda,
      M43CZ as assinaturaRegistro,
      M43DA as assinaturaCancelamento,
      M43DB as assinaturaSubtotal,
      M43DC as assinaturaDesconto,
      M43BW as funcionarioCancelamento,
      M43DG as codAutorizadorDesconto,
      M00_TURNO as turno,
      p.DESCRICAO_PRODUTO as descProduto
    FROM ZAN_M43
    LEFT JOIN TAB_PRODUTO p ON p.COD_PRODUTO LIKE '%' || M43AH
    WHERE TRUNC(M00AF) = TO_DATE('${data}','YYYY-MM-DD')
    AND ROWNUM <= 20
  `.replace(/\s+/g, ' ').trim();

  const json = {
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

  const formData = new URLSearchParams();
  formData.append('str_json', JSON.stringify(json));

  try {
    const res = await axios.post(apiUrl, formData.toString(), {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      timeout: 60000
    });

    const vendas = res.data?.QUERY?.CONTENT || [];

    if (vendas.length > 0) {
      // Remove último se vazio
      const vendasLimpas = vendas.filter(v => v.CUPOM);

      console.log('✅ Total de vendas:', vendasLimpas.length);
      console.log('\n📊 ANÁLISE DOS CAMPOS:');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

      // Estatísticas
      const stats = {
        codVendedor: vendasLimpas.filter(v => v.CODVENDEDOR && v.CODVENDEDOR != 0 && v.CODVENDEDOR != '0'),
        assinaturaRegistro: vendasLimpas.filter(v => v.ASSINATURAREGISTRO && v.ASSINATURAREGISTRO != 0 && v.ASSINATURAREGISTRO != '[]'),
        assinaturaCancelamento: vendasLimpas.filter(v => v.ASSINATURACANCELAMENTO && v.ASSINATURACANCELAMENTO != '[]'),
        assinaturaSubtotal: vendasLimpas.filter(v => v.ASSINATURASUBTOTAL && v.ASSINATURASUBTOTAL != '[]'),
        assinaturaDesconto: vendasLimpas.filter(v => v.ASSINATURADESCONTO && v.ASSINATURADESCONTO != '[]'),
        funcionarioCancelamento: vendasLimpas.filter(v => v.FUNCIONARIOCANCELAMENTO && v.FUNCIONARIOCANCELAMENTO != 0),
        codAutorizadorVenda: vendasLimpas.filter(v => v.CODAUTORIZADORVENDA && v.CODAUTORIZADORVENDA != 0),
        codAutorizadorDesconto: vendasLimpas.filter(v => v.CODAUTORIZADORDESCONTO && v.CODAUTORIZADORDESCONTO != '[]' && v.CODAUTORIZADORDESCONTO != 0),
        turno: vendasLimpas.filter(v => v.TURNO && v.TURNO != 0)
      };

      console.log('Campo                         | Com Dados | % ');
      console.log('------------------------------|-----------|----');
      console.log(`M43AM (codVendedor)           | ${stats.codVendedor.length.toString().padStart(9)} | ${((stats.codVendedor.length/vendasLimpas.length)*100).toFixed(1)}%`);
      console.log(`M43CZ (assinaturaRegistro)    | ${stats.assinaturaRegistro.length.toString().padStart(9)} | ${((stats.assinaturaRegistro.length/vendasLimpas.length)*100).toFixed(1)}%`);
      console.log(`M43CY (codAutorizadorVenda)   | ${stats.codAutorizadorVenda.length.toString().padStart(9)} | ${((stats.codAutorizadorVenda.length/vendasLimpas.length)*100).toFixed(1)}%`);
      console.log(`M43DG (codAutorizadorDesconto)| ${stats.codAutorizadorDesconto.length.toString().padStart(9)} | ${((stats.codAutorizadorDesconto.length/vendasLimpas.length)*100).toFixed(1)}%`);
      console.log(`M43BW (funcCancelamento)      | ${stats.funcionarioCancelamento.length.toString().padStart(9)} | ${((stats.funcionarioCancelamento.length/vendasLimpas.length)*100).toFixed(1)}%`);
      console.log(`M43DA (assinaturaCancelamento)| ${stats.assinaturaCancelamento.length.toString().padStart(9)} | ${((stats.assinaturaCancelamento.length/vendasLimpas.length)*100).toFixed(1)}%`);
      console.log(`M43DB (assinaturaSubtotal)    | ${stats.assinaturaSubtotal.length.toString().padStart(9)} | ${((stats.assinaturaSubtotal.length/vendasLimpas.length)*100).toFixed(1)}%`);
      console.log(`M43DC (assinaturaDesconto)    | ${stats.assinaturaDesconto.length.toString().padStart(9)} | ${((stats.assinaturaDesconto.length/vendasLimpas.length)*100).toFixed(1)}%`);
      console.log(`M00_TURNO (turno)             | ${stats.turno.length.toString().padStart(9)} | ${((stats.turno.length/vendasLimpas.length)*100).toFixed(1)}%`);

      // Mostrar exemplos com assinaturaRegistro (parece ser o campo mais preenchido)
      if (stats.assinaturaRegistro.length > 0) {
        console.log('\n🔥 ASSINATURA REGISTRO (campo mais preenchido):');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

        // Agrupar por valor de assinatura
        const porAssinatura = {};
        stats.assinaturaRegistro.forEach(v => {
          const ass = v.ASSINATURAREGISTRO;
          if (!porAssinatura[ass]) {
            porAssinatura[ass] = [];
          }
          porAssinatura[ass].push(v);
        });

        console.log('\nDISTRIBUIÇÃO DE VALORES:');
        Object.keys(porAssinatura).sort().forEach(ass => {
          console.log(`  Assinatura ${ass}: ${porAssinatura[ass].length} vendas`);
        });

        console.log('\n📋 EXEMPLOS (primeiras 5 vendas):');
        stats.assinaturaRegistro.slice(0, 5).forEach((v, i) => {
          console.log(`\n  Venda ${i+1}:`);
          console.log(`    Cupom: ${v.CUPOM}`);
          console.log(`    Caixa: ${v.CAIXA}`);
          console.log(`    Produto: ${(v.DESCPRODUTO || v.PRODUTO).substring(0, 30)}`);
          console.log(`    🔥 Assinatura Registro: ${v.ASSINATURAREGISTRO}`);
          console.log(`    Vendedor: ${v.CODVENDEDOR || 'N/A'}`);
          console.log(`    Autorizador Venda: ${v.CODAUTORIZADORVENDA || 'N/A'}`);
        });
      }

      // Verificar se M43CZ pode ser o código do operador
      console.log('\n\n💡 HIPÓTESE: M43CZ (assinaturaRegistro) pode ser o CÓDIGO DO OPERADOR DE CAIXA');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('Motivo: Este campo está preenchido em quase 100% das vendas');
      console.log('Valores encontrados:', [...new Set(stats.assinaturaRegistro.map(v => v.ASSINATURAREGISTRO))].sort().join(', '));

    } else {
      console.log('⚠️  Nenhuma venda encontrada');
    }

  } catch (e) {
    console.error('❌ Erro:', e.message);
    if (e.response) {
      console.error('Status:', e.response.status);
    }
  }
}

buscarOperadora();
