const axios = require('axios');

async function confirmarOperadores() {
  const apiUrl = 'http://10.6.1.101/manager/restful/integracao/cadastro_sincrono.php5';

  console.log('🔍 Buscando vendas de VÁRIOS CAIXAS para confirmar operadores...\n');

  const ontem = new Date();
  ontem.setDate(ontem.getDate() - 1);
  const data = ontem.toISOString().split('T')[0];

  // Buscar mais vendas de diferentes caixas
  const sql = `
    SELECT
      M00AD as cupom,
      M00AC as caixa,
      M43AH as produto,
      M43CZ as assinaturaRegistro,
      M00_TURNO as turno,
      p.DESCRICAO_PRODUTO as descProduto
    FROM ZAN_M43
    LEFT JOIN TAB_PRODUTO p ON p.COD_PRODUTO LIKE '%' || M43AH
    WHERE TRUNC(M00AF) = TO_DATE('${data}','YYYY-MM-DD')
    AND ROWNUM <= 100
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
    const vendasLimpas = vendas.filter(v => v.CUPOM);

    console.log('✅ Total de vendas:', vendasLimpas.length);

    // Agrupar por CAIXA e ASSINATURA
    const porCaixa = {};
    vendasLimpas.forEach(v => {
      const caixa = v.CAIXA;
      if (!porCaixa[caixa]) {
        porCaixa[caixa] = {
          total: 0,
          assinaturas: {}
        };
      }
      porCaixa[caixa].total++;

      const ass = v.ASSINATURAREGISTRO;
      if (!porCaixa[caixa].assinaturas[ass]) {
        porCaixa[caixa].assinaturas[ass] = 0;
      }
      porCaixa[caixa].assinaturas[ass]++;
    });

    console.log('\n📊 ANÁLISE POR CAIXA:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    Object.keys(porCaixa).sort((a, b) => a - b).forEach(caixa => {
      const info = porCaixa[caixa];
      console.log(`CAIXA ${caixa}: ${info.total} vendas`);

      Object.keys(info.assinaturas).forEach(ass => {
        const qtd = info.assinaturas[ass];
        const perc = ((qtd / info.total) * 100).toFixed(1);
        console.log(`  └─ Assinatura ${ass}: ${qtd} vendas (${perc}%)`);
      });
      console.log('');
    });

    // Verificar se cada caixa tem uma assinatura dominante
    console.log('\n💡 CONCLUSÃO:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    let todosTemOperadorUnico = true;
    const mapeamento = {};

    Object.keys(porCaixa).forEach(caixa => {
      const assinaturas = Object.keys(porCaixa[caixa].assinaturas);

      if (assinaturas.length === 1) {
        const operador = assinaturas[0];
        mapeamento[caixa] = operador;
        console.log(`✅ Caixa ${caixa} → Operador ${operador} (100% das vendas)`);
      } else {
        // Pegar o mais frequente
        let maisFrequente = null;
        let maxQtd = 0;
        Object.keys(porCaixa[caixa].assinaturas).forEach(ass => {
          if (porCaixa[caixa].assinaturas[ass] > maxQtd) {
            maxQtd = porCaixa[caixa].assinaturas[ass];
            maisFrequente = ass;
          }
        });

        const perc = ((maxQtd / porCaixa[caixa].total) * 100).toFixed(1);
        console.log(`⚠️  Caixa ${caixa} → Operador ${maisFrequente} (${perc}% das vendas)`);
        console.log(`    Outros operadores também usaram este caixa`);
        todosTemOperadorUnico = false;
      }
    });

    if (todosTemOperadorUnico) {
      console.log('\n🎯 CONFIRMADO: Cada caixa tem UM operador fixo!');
      console.log('M43CZ (assinaturaRegistro) = CÓDIGO DO OPERADOR DE CAIXA');
    } else {
      console.log('\n🔄 ATENÇÃO: Alguns caixas tiveram múltiplos operadores');
      console.log('M43CZ pode mudar durante o dia (troca de turno?)');
    }

    // Verificar turno
    console.log('\n📅 ANÁLISE DE TURNOS:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    const porTurno = {};
    vendasLimpas.forEach(v => {
      const turno = v.TURNO || 'Não informado';
      if (!porTurno[turno]) {
        porTurno[turno] = [];
      }
      porTurno[turno].push(v);
    });

    Object.keys(porTurno).forEach(turno => {
      console.log(`Turno ${turno}: ${porTurno[turno].length} vendas`);
    });

  } catch (e) {
    console.error('❌ Erro:', e.message);
  }
}

confirmarOperadores();
