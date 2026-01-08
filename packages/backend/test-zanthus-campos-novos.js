const axios = require('axios');
const { URLSearchParams } = require('url');

const apiUrl = 'http://10.6.1.101/manager/restful/integracao/cadastro_sincrono.php5';

async function testZanthusNovosCampos() {
  try {
    // Data de ontem (hoje não pode buscar vendas)
    const ontem = new Date();
    ontem.setDate(ontem.getDate() - 1);
    const dataOntem = ontem.toISOString().split('T')[0];

    console.log('📅 Buscando vendas de:', dataOntem);
    console.log('');

    // Query SQL EXPANDIDA com TODOS os campos solicitados
    const sqlVendas = `
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
        TO_CHAR(TO_TIMESTAMP(TO_CHAR(z.M00AF,'YYYY-MM-DD') || ' ' || LPAD(z.M43AS,4,'0'), 'YYYY-MM-DD HH24MI'), 'YYYY-MM-DD HH24:MI:SS') AS dataHoraVenda,
        p.DESCRICAO_PRODUTO as desProduto,

        -- CAMPOS NOVOS - PESSOAS
        z.M43AM as codVendedor,
        z.M43BB as codCliente,
        z.M43CY as codAutorizadorVenda,

        -- CAMPOS NOVOS - PAGAMENTO
        z.M43AZ as codPlanoPagamento,

        -- CAMPOS NOVOS - VOUCHER/VALE-COMPRA
        z.M43ER as valVoucherConcedido,

        -- CAMPOS NOVOS - CANCELAMENTO (já existentes)
        z.M43BV as motivoCancelamento,
        z.M43BW as funcionarioCancelamento,
        z.M43CF as tipoCancelamento,

        -- CAMPOS NOVOS - ASSINATURAS
        z.M43CZ as assinaturaRegistro,
        z.M43DA as assinaturaCancelamento,
        z.M43DB as assinaturaSubtotal,
        z.M43DC as assinaturaDesconto,

        -- CAMPOS NOVOS - DESCONTO
        z.M43AQ as descontoAplicado,
        z.M43DF as motivoDesconto,
        z.M43DG as codAutorizadorDesconto,
        z.M43AW as tipoDesconto,
        z.M43AX as valDescontoItem,
        z.M43CK as modoDesconto,
        z.M43EFA as valDescontoAdicional,
        z.M43EFB as motivoDescontoAdicional

      FROM ZAN_M43 z
      LEFT JOIN TAB_PRODUTO p ON p.COD_PRODUTO LIKE '%' || z.M43AH
      WHERE TRUNC(z.M00AF) = TO_DATE('${dataOntem}','YYYY-MM-DD')
      AND ROWNUM <= 10
    `.replace(/\s+/g, ' ').trim();

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

    console.log('🔍 Query SQL:');
    console.log(sqlVendas);
    console.log('');
    console.log('📤 Enviando requisição para Zanthus...');
    console.log('URL:', apiUrl);
    console.log('');

    const response = await axios.post(apiUrl, formData.toString(), {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      timeout: 60000 // 1 minuto
    });

    console.log('✅ Status:', response.status);
    console.log('');

    // Processar resposta
    const vendasContent = response.data?.QUERY?.CONTENT;

    if (!vendasContent || !Array.isArray(vendasContent)) {
      console.log('⚠️ Nenhuma venda encontrada ou formato inesperado');
      console.log('Resposta completa:', JSON.stringify(response.data, null, 2));
      return;
    }

    console.log(`📊 Total de vendas encontradas: ${vendasContent.length}`);
    console.log('');

    // Analisar cada venda
    vendasContent.forEach((venda, idx) => {
      if (!venda || Object.keys(venda).length === 0) return;

      console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
      console.log(`VENDA ${idx + 1} - Cupom ${venda.NUMCUPOMFISCAL || 'N/A'}`);
      console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);

      console.log('\n📦 PRODUTO:');
      console.log('  Código:', venda.CODPRODUTO || 'N/A');
      console.log('  Descrição:', venda.DESPRODUTO || 'N/A');
      console.log('  Cód. Barras:', venda.CODBARRAPRINCIPAL || 'N/A');

      console.log('\n💰 VALORES:');
      console.log('  Valor Unitário:', venda.VALVENDA || 0);
      console.log('  Quantidade:', venda.QTDTOTALPRODUTO || 0);
      console.log('  Valor Total:', venda.VALTOTALPRODUTO || 0);

      console.log('\n👤 PESSOAS:');
      console.log('  🔥 Vendedor:', venda.CODVENDEDOR || 'NÃO INFORMADO');
      console.log('  🔥 Cliente:', venda.CODCLIENTE || 'NÃO INFORMADO');
      console.log('  🔥 Autorizador Venda:', venda.CODAUTORIZADORVENDA || 'NÃO INFORMADO');

      console.log('\n💳 PAGAMENTO:');
      console.log('  🔥 Plano Pagamento:', venda.CODPLANOPAGAMENTO || 'NÃO INFORMADO');
      console.log('  🔥 Voucher Concedido:', venda.VALVOUCHERCONCEDIDO || 'NÃO INFORMADO');

      console.log('\n🎫 DESCONTO:');
      console.log('  Desconto Aplicado:', venda.DESCONTOAPLICADO || 'NÃO INFORMADO');
      console.log('  🔥 Motivo Desconto:', venda.MOTIVODESCONTO || 'NÃO INFORMADO');
      console.log('  🔥 Autorizador Desconto:', venda.CODAUTORIZADORDESCONTO || 'NÃO INFORMADO');
      console.log('  🔥 Tipo Desconto:', venda.TIPODESCONTO || 'NÃO INFORMADO');
      console.log('  🔥 Valor Desconto Item:', venda.VALDESCONTOITEM || 'NÃO INFORMADO');
      console.log('  🔥 Modo Desconto:', venda.MODODESCONTO || 'NÃO INFORMADO');
      console.log('  🔥 Desconto Adicional:', venda.VALDESCONTOADICIONAL || 'NÃO INFORMADO');
      console.log('  🔥 Motivo Desc. Adicional:', venda.MOTIVODESCONTOADICIONAL || 'NÃO INFORMADO');

      console.log('\n❌ CANCELAMENTO:');
      console.log('  Motivo:', venda.MOTIVOCANCELAMENTO || 'NÃO INFORMADO');
      console.log('  Funcionário:', venda.FUNCIONARIOCANCELAMENTO || 'NÃO INFORMADO');
      console.log('  Tipo:', venda.TIPOCANCELAMENTO || 'NÃO INFORMADO');

      console.log('\n✍️ ASSINATURAS:');
      console.log('  🔥 Registro:', venda.ASSINATURAREGISTRO || 'NÃO INFORMADO');
      console.log('  🔥 Cancelamento:', venda.ASSINATURACANCELAMENTO || 'NÃO INFORMADO');
      console.log('  🔥 Subtotal:', venda.ASSINATURASUBTOTAL || 'NÃO INFORMADO');
      console.log('  🔥 Desconto:', venda.ASSINATURADESCONTO || 'NÃO INFORMADO');

      console.log('\n📅 OUTROS:');
      console.log('  Data/Hora:', venda.DATAHORAVENDA || 'NÃO INFORMADO');
      console.log('  Caixa:', venda.CODCAIXA || 'N/A');
      console.log('  Loja:', venda.CODLOJA || 'N/A');
    });

    console.log('\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📈 ESTATÍSTICAS DOS NOVOS CAMPOS');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    const stats = {
      comVendedor: vendasContent.filter(v => v.CODVENDEDOR).length,
      comCliente: vendasContent.filter(v => v.CODCLIENTE).length,
      comAutorizadorVenda: vendasContent.filter(v => v.CODAUTORIZADORVENDA).length,
      comPlanoPagamento: vendasContent.filter(v => v.CODPLANOPAGAMENTO).length,
      comVoucher: vendasContent.filter(v => v.VALVOUCHERCONCEDIDO).length,
      comMotivoDesconto: vendasContent.filter(v => v.MOTIVODESCONTO).length,
      comAutorizadorDesconto: vendasContent.filter(v => v.CODAUTORIZADORDESCONTO).length,
      comDescontoAdicional: vendasContent.filter(v => v.VALDESCONTOADICIONAL).length,
      comCancelamento: vendasContent.filter(v => v.MOTIVOCANCELAMENTO).length,
      total: vendasContent.length
    };

    console.log(`Vendas com VENDEDOR informado: ${stats.comVendedor}/${stats.total} (${((stats.comVendedor/stats.total)*100).toFixed(1)}%)`);
    console.log(`Vendas com CLIENTE informado: ${stats.comCliente}/${stats.total} (${((stats.comCliente/stats.total)*100).toFixed(1)}%)`);
    console.log(`Vendas com AUTORIZADOR informado: ${stats.comAutorizadorVenda}/${stats.total} (${((stats.comAutorizadorVenda/stats.total)*100).toFixed(1)}%)`);
    console.log(`Vendas com PLANO PAGAMENTO: ${stats.comPlanoPagamento}/${stats.total} (${((stats.comPlanoPagamento/stats.total)*100).toFixed(1)}%)`);
    console.log(`Vendas com VOUCHER: ${stats.comVoucher}/${stats.total} (${((stats.comVoucher/stats.total)*100).toFixed(1)}%)`);
    console.log(`Vendas com MOTIVO DESCONTO: ${stats.comMotivoDesconto}/${stats.total} (${((stats.comMotivoDesconto/stats.total)*100).toFixed(1)}%)`);
    console.log(`Vendas com AUTORIZADOR DESCONTO: ${stats.comAutorizadorDesconto}/${stats.total} (${((stats.comAutorizadorDesconto/stats.total)*100).toFixed(1)}%)`);
    console.log(`Vendas com DESCONTO ADICIONAL: ${stats.comDescontoAdicional}/${stats.total} (${((stats.comDescontoAdicional/stats.total)*100).toFixed(1)}%)`);
    console.log(`Vendas com CANCELAMENTO: ${stats.comCancelamento}/${stats.total} (${((stats.comCancelamento/stats.total)*100).toFixed(1)}%)`);

    console.log('\n✅ Teste concluído com sucesso!');

  } catch (error) {
    console.error('\n❌ ERRO:');
    console.error('Mensagem:', error.message);
    console.error('Código:', error.code);
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Status Text:', error.response.statusText);
      console.error('Data:', JSON.stringify(error.response.data, null, 2));
    }
    if (error.request && !error.response) {
      console.error('Sem resposta do servidor. Verifique se a API está acessível.');
    }
  }
}

testZanthusNovosCampos();
