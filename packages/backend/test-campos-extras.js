const axios = require('axios');

async function testarCamposExtras() {
  const apiUrl = 'http://10.6.1.101/manager/restful/integracao/cadastro_sincrono.php5';

  const ontem = new Date();
  ontem.setDate(ontem.getDate() - 1);
  const data = ontem.toISOString().split('T')[0];

  console.log('🔍 TESTANDO CAMPOS EXTRAS DA TABELA ZAN_M43');
  console.log('Data:', data);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  // Teste 1: Campos de troca e reembolso
  console.log('1️⃣ Buscando campos de TROCA e REEMBOLSO...\n');

  const sql1 = `
    SELECT
      M00AD as cupom,
      M00AC as caixa,
      M43CZ as operador,
      M43AH as produto,
      M43AO as quantidade,
      M43AP as valor,
      QTD_TROCADO as qtdTrocado,
      QTD_REEMBOLSO as qtdReembolso,
      VAL_REEMBOLSO as valReembolso,
      NUM_NF as numNF,
      VAL_LIQUIDO as valLiquido,
      p.DESCRICAO_PRODUTO as descProduto
    FROM ZAN_M43
    LEFT JOIN TAB_PRODUTO p ON p.COD_PRODUTO LIKE '%' || M43AH
    WHERE TRUNC(M00AF) = TO_DATE('${data}','YYYY-MM-DD')
    AND (
      QTD_TROCADO IS NOT NULL
      OR QTD_REEMBOLSO IS NOT NULL
      OR VAL_REEMBOLSO IS NOT NULL
      OR NUM_NF IS NOT NULL
    )
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
              DADOS: {
                DADO: {
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
      console.log(`✅ Encontrados ${dados.length} registros com campos extras!\n`);

      dados.forEach((d, i) => {
        console.log(`\n📦 Registro ${i + 1}:`);
        console.log(`  Cupom: ${d.CUPOM}`);
        console.log(`  Caixa: ${d.CAIXA} | Operador: ${d.OPERADOR}`);
        console.log(`  Produto: ${d.DESCPRODUTO || d.PRODUTO}`);
        console.log(`  Quantidade: ${d.QUANTIDADE} | Valor: ${d.VALOR}`);
        if (d.QTDTROCADO) console.log(`  ⭐ Qtd Trocado: ${d.QTDTROCADO}`);
        if (d.QTDREEMBOLSO) console.log(`  ⭐ Qtd Reembolso: ${d.QTDREEMBOLSO}`);
        if (d.VALREEMBOLSO) console.log(`  ⭐ Val Reembolso: ${d.VALREEMBOLSO}`);
        if (d.NUMNF) console.log(`  ⭐ Num NF: ${d.NUMNF}`);
        if (d.VALLIQUIDO) console.log(`  ⭐ Val Líquido: ${d.VALLIQUIDO}`);
      });
    } else {
      console.log('⚠️  Nenhum registro com esses campos preenchidos');
    }
  } catch (e) {
    console.error('❌ Erro:', e.message);
  }

  // Teste 2: Estatísticas gerais
  console.log('\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  console.log('2️⃣ Estatísticas gerais dos campos extras...\n');

  const sql2 = `
    SELECT
      COUNT(*) as total,
      SUM(CASE WHEN QTD_TROCADO IS NOT NULL AND QTD_TROCADO != 0 THEN 1 ELSE 0 END) as comTroca,
      SUM(CASE WHEN QTD_REEMBOLSO IS NOT NULL AND QTD_REEMBOLSO != 0 THEN 1 ELSE 0 END) as comReembolso,
      SUM(CASE WHEN VAL_REEMBOLSO IS NOT NULL AND VAL_REEMBOLSO != 0 THEN 1 ELSE 0 END) as comValReembolso,
      SUM(CASE WHEN NUM_NF IS NOT NULL AND NUM_NF != 0 THEN 1 ELSE 0 END) as comNumNF,
      SUM(CASE WHEN VAL_LIQUIDO IS NOT NULL AND VAL_LIQUIDO != 0 THEN 1 ELSE 0 END) as comValLiquido
    FROM ZAN_M43
    WHERE TRUNC(M00AF) = TO_DATE('${data}','YYYY-MM-DD')
  `.replace(/\s+/g, ' ').trim();

  json.ZMI.DATABASES.DATABASE.COMMANDS.SELECT.DADOS.DADO.SQL = sql2;
  formData = new URLSearchParams();
  formData.append('str_json', JSON.stringify(json));

  try {
    const res = await axios.post(apiUrl, formData.toString(), {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      timeout: 60000
    });

    const stats = res.data?.QUERY?.CONTENT?.[0] || {};

    console.log('📊 ESTATÍSTICAS:');
    console.log('─────────────────────────────────────────');
    console.log(`  Total de vendas: ${stats.TOTAL || 0}`);
    console.log(`  Com QTD_TROCADO: ${stats.COMTROCA || 0} (${((stats.COMTROCA / stats.TOTAL) * 100).toFixed(2)}%)`);
    console.log(`  Com QTD_REEMBOLSO: ${stats.COMREEMBOLSO || 0} (${((stats.COMREEMBOLSO / stats.TOTAL) * 100).toFixed(2)}%)`);
    console.log(`  Com VAL_REEMBOLSO: ${stats.COMVALREEMBOLSO || 0} (${((stats.COMVALREEMBOLSO / stats.TOTAL) * 100).toFixed(2)}%)`);
    console.log(`  Com NUM_NF: ${stats.COMNUMNF || 0} (${((stats.COMNUMNF / stats.TOTAL) * 100).toFixed(2)}%)`);
    console.log(`  Com VAL_LIQUIDO: ${stats.COMVALLIQUIDO || 0} (${((stats.COMVALLIQUIDO / stats.TOTAL) * 100).toFixed(2)}%)`);
    console.log('─────────────────────────────────────────\n');

  } catch (e) {
    console.error('❌ Erro:', e.message);
  }

  // Teste 3: Buscar alguns exemplos de VAL_LIQUIDO
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  console.log('3️⃣ Exemplos de VAL_LIQUIDO (valor líquido)...\n');

  const sql3 = `
    SELECT
      M00AD as cupom,
      M43AH as produto,
      M43AP as valTotal,
      M43AQ as desconto,
      VAL_LIQUIDO as valLiquido,
      p.DESCRICAO_PRODUTO as descProduto
    FROM ZAN_M43
    LEFT JOIN TAB_PRODUTO p ON p.COD_PRODUTO LIKE '%' || M43AH
    WHERE TRUNC(M00AF) = TO_DATE('${data}','YYYY-MM-DD')
    AND VAL_LIQUIDO IS NOT NULL
    AND VAL_LIQUIDO != 0
    AND ROWNUM <= 10
  `.replace(/\s+/g, ' ').trim();

  json.ZMI.DATABASES.DATABASE.COMMANDS.SELECT.DADOS.DADO.SQL = sql3;
  formData = new URLSearchParams();
  formData.append('str_json', JSON.stringify(json));

  try {
    const res = await axios.post(apiUrl, formData.toString(), {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      timeout: 60000
    });

    const dados = res.data?.QUERY?.CONTENT?.filter(d => d.CUPOM) || [];

    if (dados.length > 0) {
      console.log(`✅ Encontrados ${dados.length} registros com VAL_LIQUIDO:\n`);
      console.log('| Cupom  | Produto              | Val Total | Desconto | Val Líquido |');
      console.log('|--------|----------------------|-----------|----------|-------------|');

      dados.forEach(d => {
        const cupom = String(d.CUPOM).padStart(6, ' ');
        const prod = (d.DESCPRODUTO || d.PRODUTO).substring(0, 20).padEnd(20, ' ');
        const valTotal = String(d.VALTOTAL || '0').padStart(9, ' ');
        const desc = String(d.DESCONTO || '0').padStart(8, ' ');
        const valLiq = String(d.VALLIQUIDO || '0').padStart(11, ' ');

        console.log(`| ${cupom} | ${prod} | ${valTotal} | ${desc} | ${valLiq} |`);
      });
    } else {
      console.log('⚠️  Nenhum registro com VAL_LIQUIDO preenchido');
    }
  } catch (e) {
    console.error('❌ Erro:', e.message);
  }

  console.log('\n✅ Testes concluídos!\n');
}

testarCamposExtras();
