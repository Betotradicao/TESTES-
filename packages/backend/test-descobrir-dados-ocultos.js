const axios = require('axios');

async function descobrirDadosOcultos() {
  const apiUrl = 'http://10.6.1.101/manager/restful/integracao/cadastro_sincrono.php5';

  const ontem = new Date();
  ontem.setDate(ontem.getDate() - 1);
  const data = ontem.toISOString().split('T')[0);

  console.log('🕵️  PROCURANDO DADOS OCULTOS NA API ZANTHUS');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  // TESTE 1: Verificar se campos VARCHAR podem ter descrições escondidas
  console.log('1️⃣ Buscando TODOS os campos VARCHAR da M43...\n');

  // Baseado na estrutura que descobrimos, esses são os campos VARCHAR:
  const camposVarchar = [
    'M43AH', 'M43AR', 'M43BB', 'M43BD', 'M43BE', 'M43BF', 'M43BK', 'M43BP',
    'M43CM', 'M43CO', 'M43CQ', 'M43CS', 'M43CU', 'M43DH', 'M43DS', 'M43DT',
    'M43DZ', 'M43EMA', 'M43EO', 'M43EP'
  ];

  const sql1 = `
    SELECT
      M00AD as cupom,
      M43CZ as operador,
      M43DF as motivo,
      ${camposVarchar.map((c, i) => `${c} as campo${i + 1}`).join(', ')}
    FROM ZAN_M43
    WHERE TRUNC(M00AF) = TO_DATE('${data}','YYYY-MM-DD')
    AND ROWNUM <= 5
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

    const dados = res.data?.QUERY?.CONTENT || [];

    if (dados.length > 0) {
      console.log(`✅ Analisando ${dados.length} registros...\n`);

      // Verificar quais campos VARCHAR têm dados
      const camposComDados = {};

      dados.forEach((registro, i) => {
        Object.keys(registro).forEach(campo => {
          if (campo.startsWith('CAMPO')) {
            const valor = registro[campo];
            if (valor && valor !== '0' && valor !== '' && valor !== null) {
              if (!camposComDados[campo]) {
                camposComDados[campo] = [];
              }
              camposComDados[campo].push({ cupom: registro.CUPOM, valor });
            }
          }
        });
      });

      console.log('📊 CAMPOS VARCHAR COM DADOS:\n');
      Object.keys(camposComDados).forEach(campo => {
        const indice = parseInt(campo.replace('CAMPO', '')) - 1;
        const nomeCampo = camposVarchar[indice];
        console.log(`\n${nomeCampo} (${campo}):`);
        camposComDados[campo].forEach(item => {
          console.log(`  Cupom ${item.cupom}: "${item.valor}"`);
        });
      });

      if (Object.keys(camposComDados).length === 0) {
        console.log('⚠️  Nenhum campo VARCHAR tem dados além de M43AH (produto)');
      }
    }
  } catch (e) {
    console.error('❌ Erro:', e.message);
  }

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  // TESTE 2: Buscar dados agregados que podem revelar padrões
  console.log('2️⃣ Buscando padrões em TODOS os campos numéricos...\n');

  const sql2 = `
    SELECT
      COUNT(DISTINCT M43CZ) as qtdOperadores,
      COUNT(DISTINCT M43DF) as qtdMotivosDesconto,
      COUNT(DISTINCT M43DG) as qtdAutorizadores,
      COUNT(DISTINCT M43AZ) as qtdPlanosPagamento,
      COUNT(DISTINCT M43BV) as qtdMotivosCancelamento,
      COUNT(DISTINCT M43CF) as qtdTiposCancelamento,
      COUNT(DISTINCT M43AM) as qtdVendedores,
      COUNT(DISTINCT M43BB) as qtdClientes,

      -- Ver se há valores diferentes de zero
      SUM(CASE WHEN M43AZ != 0 THEN 1 ELSE 0 END) as comPlanoPag,
      SUM(CASE WHEN M43BV != 0 THEN 1 ELSE 0 END) as comMotivoCancelamento,
      SUM(CASE WHEN M43CF != 0 THEN 1 ELSE 0 END) as comTipoCancelamento,
      SUM(CASE WHEN M43AM != 0 THEN 1 ELSE 0 END) as comVendedor,
      SUM(CASE WHEN M43BB != '0' AND M43BB IS NOT NULL THEN 1 ELSE 0 END) as comCliente

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

    console.log('📊 ANÁLISE DE PADRÕES:\n');
    console.log(`Operadores únicos: ${stats.QTDOPERADORES || 0}`);
    console.log(`Motivos de desconto únicos: ${stats.QTDMOTIVOSDESCONTO || 0}`);
    console.log(`Autorizadores únicos: ${stats.QTDAUTORIZADORES || 0}`);
    console.log(`Planos de pagamento únicos: ${stats.QTDPLANOSPAGAMENTO || 0}`);
    console.log(`Motivos de cancelamento únicos: ${stats.QTDMOTIVOSCANCELAMENTO || 0}`);
    console.log(`Tipos de cancelamento únicos: ${stats.QTDTIPOSCANCELAMENTO || 0}`);
    console.log(`Vendedores únicos: ${stats.QTDVENDEDORES || 0}`);
    console.log(`Clientes únicos: ${stats.QTDCLIENTES || 0}`);
    console.log('');
    console.log('Registros com valor diferente de zero:');
    console.log(`  Plano de pagamento: ${stats.COMPLANOPAG || 0}`);
    console.log(`  Motivo cancelamento: ${stats.COMMOTIVOCANCELAMENTO || 0}`);
    console.log(`  Tipo cancelamento: ${stats.COMTIPOCANCELAMENTO || 0}`);
    console.log(`  Vendedor: ${stats.COMVENDEDOR || 0}`);
    console.log(`  Cliente: ${stats.COMCLIENTE || 0}`);

  } catch (e) {
    console.error('❌ Erro:', e.message);
  }

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  // TESTE 3: Tentar buscar se há subconsultas ou CTEs permitidas
  console.log('3️⃣ Testando subconsultas para cruzar dados...\n');

  const sql3 = `
    SELECT
      operador,
      vendas,
      descontos,
      ROUND((descontos / vendas) * 100, 2) as percDesconto
    FROM (
      SELECT
        M43CZ as operador,
        COUNT(*) as vendas,
        SUM(CASE WHEN M43AQ > 0 THEN 1 ELSE 0 END) as descontos
      FROM ZAN_M43
      WHERE TRUNC(M00AF) = TO_DATE('${data}','YYYY-MM-DD')
      GROUP BY M43CZ
    )
    ORDER BY percDesconto DESC
  `.replace(/\s+/g, ' ').trim();

  json.ZMI.DATABASES.DATABASE.COMMANDS.SELECT.DADOS.DADO.SQL = sql3;
  formData = new URLSearchParams();
  formData.append('str_json', JSON.stringify(json));

  try {
    const res = await axios.post(apiUrl, formData.toString(), {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      timeout: 60000
    });

    const dados = res.data?.QUERY?.CONTENT || [];

    if (dados.length > 0) {
      console.log('✅ Subconsultas funcionam!\n');
      console.log('📊 RANKING DE DESCONTOS POR OPERADOR:\n');
      console.log('| Operador | Vendas | Descontos | % Desconto |');
      console.log('|----------|--------|-----------|------------|');

      dados.forEach(d => {
        const op = String(d.OPERADOR).padStart(4, ' ');
        const vendas = String(d.VENDAS).padStart(5, ' ');
        const desc = String(d.DESCONTOS).padStart(8, ' ');
        const perc = String(d.PERCDESCONTO || '0').padStart(10, ' ');

        console.log(`|   ${op}   | ${vendas}  | ${desc}  | ${perc}% |`);
      });
    }
  } catch (e) {
    console.error('❌ Subconsultas não funcionaram:', e.message);
  }

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  // TESTE 4: Tentar WITH (CTE)
  console.log('4️⃣ Testando CTEs (WITH)...\n');

  const sql4 = `
    WITH operadores AS (
      SELECT DISTINCT M43CZ as cod FROM ZAN_M43 WHERE TRUNC(M00AF) = TO_DATE('${data}','YYYY-MM-DD')
    )
    SELECT cod, ROWNUM as sequencia FROM operadores ORDER BY cod
  `.replace(/\s+/g, ' ').trim();

  json.ZMI.DATABASES.DATABASE.COMMANDS.SELECT.DADOS.DADO.SQL = sql4;
  formData = new URLSearchParams();
  formData.append('str_json', JSON.stringify(json));

  try {
    const res = await axios.post(apiUrl, formData.toString(), {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      timeout: 60000
    });

    const dados = res.data?.QUERY?.CONTENT || [];

    if (dados.length > 0) {
      console.log('✅ CTEs (WITH) funcionam!');
      console.log('Operadores:', dados.map(d => d.COD).join(', '));
    }
  } catch (e) {
    console.log('❌ CTEs não funcionaram');
  }

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  // TESTE 5: Ver se há metadados nos campos ZZA/ZZB (campos customizáveis)
  console.log('5️⃣ Verificando campos customizáveis (ZZA/ZZB)...\n');

  const sql5 = `
    SELECT
      M00AD as cupom,
      M43ZZA01, M43ZZA02, M43ZZA03, M43ZZA04, M43ZZA05,
      M43ZZB01, M43ZZB02, M43ZZB03, M43ZZB04, M43ZZB05,
      DATA_ZZB01, DATA_ZZB02
    FROM ZAN_M43
    WHERE TRUNC(M00AF) = TO_DATE('${data}','YYYY-MM-DD')
    AND (
      M43ZZA01 IS NOT NULL OR M43ZZB01 IS NOT NULL OR DATA_ZZB01 IS NOT NULL
    )
    AND ROWNUM <= 10
  `.replace(/\s+/g, ' ').trim();

  json.ZMI.DATABASES.DATABASE.COMMANDS.SELECT.DADOS.DADO.SQL = sql5;
  formData = new URLSearchParams();
  formData.append('str_json', JSON.stringify(json));

  try {
    const res = await axios.post(apiUrl, formData.toString(), {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      timeout: 60000
    });

    const dados = res.data?.QUERY?.CONTENT || [];

    if (dados.length > 0) {
      console.log(`✅ Encontrados ${dados.length} registros com campos customizáveis!\n`);
      dados.forEach((d, i) => {
        console.log(`Cupom ${d.CUPOM}:`);
        Object.keys(d).forEach(campo => {
          if (campo.startsWith('M43ZZ') || campo.startsWith('DATA_ZZ')) {
            if (d[campo] !== null && d[campo] !== 0) {
              console.log(`  ${campo}: ${d[campo]}`);
            }
          }
        });
      });
    } else {
      console.log('⚠️  Campos customizáveis não têm dados');
    }
  } catch (e) {
    console.error('❌ Erro:', e.message);
  }

  console.log('\n✅ Busca por dados ocultos concluída!\n');
}

descobrirDadosOcultos();
