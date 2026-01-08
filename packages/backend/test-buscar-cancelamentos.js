const axios = require('axios');

async function buscarCancelamentos() {
  const apiUrl = 'http://10.6.1.101/manager/restful/integracao/cadastro_sincrono.php5';

  const ontem = new Date();
  ontem.setDate(ontem.getDate() - 1);
  const data = ontem.toISOString().split('T')[0];

  console.log('🔍 Buscando CANCELAMENTOS na API Zanthus');
  console.log('Data:', data);
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  // TESTE 1: Buscar itens com campo de cancelamento preenchido
  console.log('1️⃣ Buscando itens com M43BV (motivo cancelamento) preenchido...\n');

  const sql1 = `
    SELECT
      M00AD as cupom,
      M00AC as caixa,
      M43CZ as operador,
      M43AH as produto,
      M43AP as valor,
      M43AO as quantidade,
      M43BV as motivoCancelamento,
      M43BW as funcionarioCancelamento,
      M43CF as tipoCancelamento,
      p.DESCRICAO_PRODUTO as descProduto
    FROM ZAN_M43
    LEFT JOIN TAB_PRODUTO p ON p.COD_PRODUTO LIKE '%' || M43AH
    WHERE TRUNC(M00AF) = TO_DATE('${data}','YYYY-MM-DD')
    AND (M43BV IS NOT NULL AND M43BV != 0)
    AND ROWNUM <= 20
  `.replace(/\s+/g, ' ').trim();

  let json = {
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
                  SQL: sql1
                }
              }
            }
          }
        }
      }
    }
  };

  let formData = new URLSearchParams();
  formData.append('str_json', JSON.stringify(json));

  try {
    const res = await axios.post(apiUrl, formData.toString(), {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      timeout: 60000
    });

    const dados = res.data?.QUERY?.CONTENT?.filter(d => d.CUPOM) || [];

    if (dados.length > 0) {
      console.log('✅ ENCONTROU itens com cancelamento! Total:', dados.length);
      console.log('\n┌────────────────────────────────────────────────────────────────────┐');
      console.log('│ Cupom  │ Caixa │ Operador │ Produto           │ Qtd │ Valor  │ Motivo│');
      console.log('├────────────────────────────────────────────────────────────────────┤');

      dados.forEach(d => {
        const cupom = String(d.CUPOM).padStart(6, ' ');
        const caixa = String(d.CAIXA).padStart(2, ' ');
        const op = String(d.OPERADOR).padStart(4, ' ');
        const prod = (d.DESCPRODUTO || d.PRODUTO).substring(0, 17).padEnd(17, ' ');
        const qtd = String(d.QUANTIDADE || '').padStart(3, ' ');
        const val = String(d.VALOR || '').padStart(6, ' ');
        const mot = String(d.MOTIVOCANCELAMENTO).padStart(6, ' ');

        console.log(`│ ${cupom} │  ${caixa}   │   ${op}   │ ${prod} │ ${qtd} │ ${val} │ ${mot} │`);
      });
      console.log('└────────────────────────────────────────────────────────────────────┘\n');

      // Mostrar detalhes do primeiro
      console.log('📋 DETALHES DO PRIMEIRO CANCELAMENTO:');
      console.log(JSON.stringify(dados[0], null, 2));
    } else {
      console.log('⚠️  Nenhum item com M43BV preenchido');
    }
  } catch (e) {
    console.error('❌ Erro:', e.message);
  }

  // TESTE 2: Buscar por tipo de cancelamento (M43CF)
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  console.log('2️⃣ Buscando por M43CF (tipo de cancelamento)...\n');

  const sql2 = `
    SELECT DISTINCT
      M43CF as tipoCancelamento,
      COUNT(*) as quantidade
    FROM ZAN_M43
    WHERE TRUNC(M00AF) = TO_DATE('${data}','YYYY-MM-DD')
    AND M43CF IS NOT NULL
    GROUP BY M43CF
    ORDER BY quantidade DESC
  `.replace(/\s+/g, ' ').trim();

  json = {
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
                  SQL: sql2
                }
              }
            }
          }
        }
      }
    }
  };

  formData = new URLSearchParams();
  formData.append('str_json', JSON.stringify(json));

  try {
    const res = await axios.post(apiUrl, formData.toString(), {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      timeout: 60000
    });

    const dados = res.data?.QUERY?.CONTENT?.filter(d => d.TIPOCANCELAMENTO !== undefined) || [];

    if (dados.length > 0) {
      console.log('✅ Tipos de cancelamento encontrados:');
      dados.forEach(d => {
        console.log(`  Tipo ${d.TIPOCANCELAMENTO}: ${d.QUANTIDADE} itens`);
      });
    } else {
      console.log('⚠️  Nenhum tipo de cancelamento encontrado');
    }
  } catch (e) {
    console.error('❌ Erro:', e.message);
  }

  // TESTE 3: Comparar quantidade negativa vs campo cancelamento
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  console.log('3️⃣ Comparando QUANTIDADE NEGATIVA vs CAMPO CANCELAMENTO...\n');

  const sql3 = `
    SELECT
      M00AD as cupom,
      M43AH as produto,
      M43AO as quantidade,
      M43AP as valor,
      M43BV as motivoCancelamento,
      M43CF as tipoCancelamento,
      CASE
        WHEN M43AO < 0 THEN 'NEGATIVO'
        WHEN M43BV IS NOT NULL AND M43BV != 0 THEN 'CAMPO_CANCEL'
        ELSE 'NORMAL'
      END as tipoRegistro,
      p.DESCRICAO_PRODUTO as descProduto
    FROM ZAN_M43
    LEFT JOIN TAB_PRODUTO p ON p.COD_PRODUTO LIKE '%' || M43AH
    WHERE TRUNC(M00AF) = TO_DATE('${data}','YYYY-MM-DD')
    AND (M43AO < 0 OR (M43BV IS NOT NULL AND M43BV != 0))
    AND ROWNUM <= 30
  `.replace(/\s+/g, ' ').trim();

  json = {
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
                  SQL: sql3
                }
              }
            }
          }
        }
      }
    }
  };

  formData = new URLSearchParams();
  formData.append('str_json', JSON.stringify(json));

  try {
    const res = await axios.post(apiUrl, formData.toString(), {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      timeout: 60000
    });

    const dados = res.data?.QUERY?.CONTENT?.filter(d => d.CUPOM) || [];

    if (dados.length > 0) {
      console.log('✅ Total encontrado:', dados.length);

      const negativos = dados.filter(d => d.TIPOREGISTRO === 'NEGATIVO');
      const comCampoCancel = dados.filter(d => d.TIPOREGISTRO === 'CAMPO_CANCEL');

      console.log('\n📊 ANÁLISE:');
      console.log(`  Apenas QUANTIDADE NEGATIVA: ${negativos.length}`);
      console.log(`  Apenas CAMPO CANCELAMENTO: ${comCampoCancel.length}`);
      console.log(`  Total: ${dados.length}\n`);

      if (negativos.length > 0) {
        console.log('🔴 NEGATIVOS (venda finalizada com devolução):');
        negativos.slice(0, 5).forEach(d => {
          console.log(`  Cupom ${d.CUPOM}: ${d.DESCPRODUTO?.substring(0, 25)} - Qtd: ${d.QUANTIDADE} - Valor: ${d.VALOR}`);
        });
      }

      if (comCampoCancel.length > 0) {
        console.log('\n❌ CANCELAMENTO MARCADO (venda aberta):');
        comCampoCancel.slice(0, 5).forEach(d => {
          console.log(`  Cupom ${d.CUPOM}: ${d.DESCPRODUTO?.substring(0, 25)} - Qtd: ${d.QUANTIDADE} - Motivo: ${d.MOTIVOCANCELAMENTO}`);
        });
      }

      console.log('\n📋 EXEMPLO DETALHADO:');
      console.log(JSON.stringify(dados[0], null, 2));

    } else {
      console.log('⚠️  Nenhum cancelamento ou devolução encontrado');
    }
  } catch (e) {
    console.error('❌ Erro:', e.message);
  }

  // TESTE 4: Buscar em TODAS as vendas do período
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  console.log('4️⃣ Estatísticas GERAIS de cancelamento no dia...\n');

  const sql4 = `
    SELECT
      COUNT(*) as total,
      SUM(CASE WHEN M43AO < 0 THEN 1 ELSE 0 END) as qtdNegativos,
      SUM(CASE WHEN M43BV IS NOT NULL AND M43BV != 0 THEN 1 ELSE 0 END) as qtdCampoCancel,
      SUM(CASE WHEN M43CF IS NOT NULL AND M43CF != 0 THEN 1 ELSE 0 END) as qtdTipoCancel
    FROM ZAN_M43
    WHERE TRUNC(M00AF) = TO_DATE('${data}','YYYY-MM-DD')
  `.replace(/\s+/g, ' ').trim();

  json = {
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
                  SQL: sql4
                }
              }
            }
          }
        }
      }
    }
  };

  formData = new URLSearchParams();
  formData.append('str_json', JSON.stringify(json));

  try {
    const res = await axios.post(apiUrl, formData.toString(), {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      timeout: 60000
    });

    const dados = res.data?.QUERY?.CONTENT?.[0] || {};

    console.log('📊 ESTATÍSTICAS DO DIA:');
    console.log('─────────────────────────────────────────');
    console.log(`  Total de vendas: ${dados.TOTAL || 0}`);
    console.log(`  Quantidade negativa: ${dados.QTDNEGATIVOS || 0} (${((dados.QTDNEGATIVOS / dados.TOTAL) * 100).toFixed(2)}%)`);
    console.log(`  Campo M43BV preenchido: ${dados.QTDCAMPOCANCEL || 0} (${((dados.QTDCAMPOCANCEL / dados.TOTAL) * 100).toFixed(2)}%)`);
    console.log(`  Campo M43CF preenchido: ${dados.QTDTIPOCANCEL || 0} (${((dados.QTDTIPOCANCEL / dados.TOTAL) * 100).toFixed(2)}%)`);
    console.log('─────────────────────────────────────────\n');

  } catch (e) {
    console.error('❌ Erro:', e.message);
  }

  console.log('✅ Busca de cancelamentos concluída!\n');
}

buscarCancelamentos();
