const axios = require('axios');

async function test() {
  const apiUrl = 'http://10.6.1.101/manager/restful/integracao/cadastro_sincrono.php5';

  const ontem = new Date();
  ontem.setDate(ontem.getDate() - 1);
  const dataOntem = ontem.toISOString().split('T')[0];

  console.log('📅 Buscando TODAS as vendas de:', dataOntem);
  console.log('⏳ Isso pode demorar...\n');

  // SEM ROWNUM para pegar TODAS as vendas
  const sql = `
    SELECT
      z.M00AD as numCupom,
      z.M43AH as codProduto,
      z.M43AP as valTotal,
      z.M43AO as qtd,
      z.M43AM as codVendedor,
      z.M43BB as codCliente,
      z.M43AZ as codPlanoPagamento,
      z.M43AQ as descontoAplicado,
      z.M43DF as motivoDesconto,
      z.M43DG as codAutorizadorDesconto,
      z.M43AW as tipoDesconto,
      z.M43AX as valDescontoItem,
      z.M43CK as modoDesconto,
      z.M43EFA as valDescontoAdicional,
      z.M43EFB as motivoDescontoAdicional,
      z.M43BV as motivoCancelamento,
      z.M43BW as funcionarioCancelamento,
      z.M43CF as tipoCancelamento,
      p.DESCRICAO_PRODUTO as desProduto
    FROM ZAN_M43 z
    LEFT JOIN TAB_PRODUTO p ON p.COD_PRODUTO LIKE '%' || z.M43AH
    WHERE TRUNC(z.M00AF) = TO_DATE('${dataOntem}','YYYY-MM-DD')
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
      timeout: 120000 // 2 minutos
    });

    let vendas = res.data?.QUERY?.CONTENT || [];

    // Remove último se for vazio (summary)
    if (vendas.length > 0 && !vendas[vendas.length - 1].NUMCUPOM) {
      vendas = vendas.slice(0, -1);
    }

    console.log('✅ SUCESSO! Total de vendas:', vendas.length);

    // Filtros
    const comDesconto = vendas.filter(v => v.DESCONTOAPLICADO && parseFloat(v.DESCONTOAPLICADO) > 0);
    const comCancelamento = vendas.filter(v => v.MOTIVOCANCELAMENTO && v.MOTIVOCANCELAMENTO != '0' && v.MOTIVOCANCELAMENTO != 0);
    const comVendedor = vendas.filter(v => v.CODVENDEDOR && v.CODVENDEDOR != '0' && v.CODVENDEDOR != 0);
    const comCliente = vendas.filter(v => v.CODCLIENTE && v.CODCLIENTE != '0' && v.CODCLIENTE != 0);
    const comPlanoPag = vendas.filter(v => v.CODPLANOPAGAMENTO && v.CODPLANOPAGAMENTO != '0' && v.CODPLANOPAGAMENTO != 0);
    const valoresNegativos = vendas.filter(v => parseFloat(v.VALTOTAL || 0) < 0 || parseFloat(v.QTD || 0) < 0);

    console.log('\n📊 ESTATÍSTICAS:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('  Total de vendas:', vendas.length);
    console.log('  🎫 Com DESCONTO:', comDesconto.length);
    console.log('  ❌ Com CANCELAMENTO:', comCancelamento.length);
    console.log('  👤 Com VENDEDOR:', comVendedor.length);
    console.log('  🏪 Com CLIENTE:', comCliente.length);
    console.log('  💳 Com PLANO PAG:', comPlanoPag.length);
    console.log('  ⚠️  Valores NEGATIVOS:', valoresNegativos.length);

    // Vendas com DESCONTO
    if (comDesconto.length > 0) {
      console.log('\n💰 VENDAS COM DESCONTO (primeiras 5):');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━');
      comDesconto.slice(0, 5).forEach((v, i) => {
        console.log(`\nVenda ${i+1}:`);
        console.log('  Cupom:', v.NUMCUPOM);
        console.log('  Produto:', (v.DESPRODUTO || v.CODPRODUTO).substring(0, 30));
        console.log('  Valor Total:', v.VALTOTAL);
        console.log('  🔥 Desconto Aplicado:', v.DESCONTOAPLICADO);
        console.log('  🔥 Tipo Desconto:', v.TIPODESCONTO);
        console.log('  🔥 Modo Desconto:', v.MODODESCONTO);
        console.log('  🔥 Motivo:', v.MOTIVODESCONTO);
        console.log('  🔥 Autorizador:', v.CODAUTORIZADORDESCONTO);
      });
    } else {
      console.log('\n⚠️  Nenhuma venda com desconto');
    }

    // Vendas CANCELADAS
    if (comCancelamento.length > 0) {
      console.log('\n❌ VENDAS CANCELADAS (primeiras 5):');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━');
      comCancelamento.slice(0, 5).forEach((v, i) => {
        console.log(`\nVenda ${i+1}:`);
        console.log('  Cupom:', v.NUMCUPOM);
        console.log('  Produto:', (v.DESPRODUTO || v.CODPRODUTO).substring(0, 30));
        console.log('  Valor:', v.VALTOTAL);
        console.log('  🔥 Motivo Cancel:', v.MOTIVOCANCELAMENTO);
        console.log('  🔥 Funcionário:', v.FUNCIONARIOCANCELAMENTO);
        console.log('  🔥 Tipo:', v.TIPOCANCELAMENTO);
      });
    } else {
      console.log('\n⚠️  Nenhuma venda cancelada');
    }

    // Vendas NEGATIVAS
    if (valoresNegativos.length > 0) {
      console.log('\n🔴 VENDAS NEGATIVAS (primeiras 5):');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━');
      valoresNegativos.slice(0, 5).forEach((v, i) => {
        console.log(`\nVenda ${i+1}:`);
        console.log('  Cupom:', v.NUMCUPOM);
        console.log('  Produto:', (v.DESPRODUTO || v.CODPRODUTO).substring(0, 30));
        console.log('  🔥 Valor:', v.VALTOTAL);
        console.log('  🔥 Quantidade:', v.QTD);
        console.log('  🔥 Cancelamento?:', v.MOTIVOCANCELAMENTO);
      });
    }

    // Vendas com VENDEDOR
    if (comVendedor.length > 0) {
      console.log('\n👤 VENDAS COM VENDEDOR (primeiras 3):');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━');
      comVendedor.slice(0, 3).forEach((v, i) => {
        console.log(`\nVenda ${i+1}:`);
        console.log('  Cupom:', v.NUMCUPOM);
        console.log('  🔥 Vendedor:', v.CODVENDEDOR);
        console.log('  Produto:', (v.DESPRODUTO || v.CODPRODUTO).substring(0, 30));
      });
    }

    // Vendas com PLANO PAGAMENTO
    if (comPlanoPag.length > 0) {
      console.log('\n💳 VENDAS COM PLANO PAGAMENTO (primeiras 3):');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━');
      comPlanoPag.slice(0, 3).forEach((v, i) => {
        console.log(`\nVenda ${i+1}:`);
        console.log('  Cupom:', v.NUMCUPOM);
        console.log('  🔥 Plano Pagamento:', v.CODPLANOPAGAMENTO);
      });
    }

  } catch (e) {
    console.error('\n❌ Erro:', e.message);
    if (e.response) {
      console.error('Status:', e.response.status);
    }
  }
}

test();
