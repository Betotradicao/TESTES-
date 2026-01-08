const axios = require('axios');

async function investigarAPIProfunda() {
  const apiUrl = 'http://10.6.1.101/manager/restful/integracao/cadastro_sincrono.php5';

  const ontem = new Date();
  ontem.setDate(ontem.getDate() - 1);
  const data = ontem.toISOString().split('T')[0];

  console.log('🔬 INVESTIGAÇÃO PROFUNDA DA API ZANTHUS');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  // TESTE 1: Tentar SELECT * completo em M43 para ver TODOS os campos retornados
  console.log('1️⃣ Buscando TODOS os campos da M43 (SELECT *)...\n');

  const sql1 = `
    SELECT *
    FROM ZAN_M43
    WHERE TRUNC(M00AF) = TO_DATE('${data}','YYYY-MM-DD')
    AND M43AQ IS NOT NULL
    AND ROWNUM <= 1
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
      const campos = Object.keys(dados[0]);
      console.log(`✅ Retornou ${campos.length} campos!\n`);
      console.log('📊 TODOS OS CAMPOS RETORNADOS:');
      console.log(campos.join(', '));
      console.log('\n📋 CAMPOS COM DADOS PREENCHIDOS:');

      const camposPreenchidos = {};
      for (const campo of campos) {
        const valor = dados[0][campo];
        if (valor !== null && valor !== undefined && valor !== '' && valor !== 0 && valor !== '0') {
          camposPreenchidos[campo] = valor;
        }
      }

      console.log(JSON.stringify(camposPreenchidos, null, 2));
    }
  } catch (e) {
    console.error('❌ Erro:', e.message);
  }

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  // TESTE 2: Buscar em VIEW em vez de TABLE
  console.log('2️⃣ Tentando acessar VIEWS...\n');

  const views = [
    'V_VENDAS',
    'V_CUPOM',
    'V_VENDAS_PDV',
    'V_M43',
    'VIEW_VENDAS',
    'VW_VENDAS'
  ];

  for (const view of views) {
    const sql = `SELECT * FROM ${view} WHERE ROWNUM <= 1`;

    json.ZMI.DATABASES.DATABASE.COMMANDS.SELECT.DADOS.DADO.SQL = sql;
    formData = new URLSearchParams();
    formData.append('str_json', JSON.stringify(json));

    try {
      const res = await axios.post(apiUrl, formData.toString(), {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        timeout: 30000
      });

      const dados = res.data?.QUERY?.CONTENT || [];

      if (dados.length > 0) {
        console.log(`✅ ✅ ✅ VIEW ${view} ACESSÍVEL!`);
        console.log('Campos:', Object.keys(dados[0]).join(', '));
        console.log('Dados:', JSON.stringify(dados[0], null, 2));
        console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
      }
    } catch (e) {
      // Silencioso
    }
  }

  console.log('⚠️  Nenhuma VIEW acessível testada\n');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  // TESTE 3: Tentar diferentes comandos além de SELECT
  console.log('3️⃣ Testando comando SHOW/DESCRIBE...\n');

  const comandosEspeciais = [
    'SHOW TABLES',
    'DESCRIBE ZAN_M43',
    'DESC ZAN_M43',
  ];

  for (const cmd of comandosEspeciais) {
    json.ZMI.DATABASES.DATABASE.COMMANDS.SELECT.DADOS.DADO.SQL = cmd;
    formData = new URLSearchParams();
    formData.append('str_json', JSON.stringify(json));

    try {
      const res = await axios.post(apiUrl, formData.toString(), {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        timeout: 30000
      });

      const dados = res.data?.QUERY?.CONTENT || [];

      if (dados.length > 0) {
        console.log(`✅ Comando ${cmd} funcionou!`);
        console.log(JSON.stringify(dados, null, 2));
      }
    } catch (e) {
      // Silencioso
    }
  }

  console.log('⚠️  Comandos especiais não funcionaram\n');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  // TESTE 4: Tentar acessar dados em SCHEMA diferente
  console.log('4️⃣ Tentando acessar outros SCHEMAs...\n');

  const schemas = [
    'MANAGER.ZAN_M02',
    'MANAGER.ZAN_M01',
    'ZANTHUS.M43',
    'ZANTHUS.M02',
    'ZANTHUS.M01',
    'PDV.M43',
    'DBA.ZAN_M43'
  ];

  for (const schema of schemas) {
    const sql = `SELECT * FROM ${schema} WHERE ROWNUM <= 1`;

    json.ZMI.DATABASES.DATABASE.COMMANDS.SELECT.DADOS.DADO.SQL = sql;
    formData = new URLSearchParams();
    formData.append('str_json', JSON.stringify(json));

    try {
      const res = await axios.post(apiUrl, formData.toString(), {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        timeout: 30000
      });

      const dados = res.data?.QUERY?.CONTENT || [];

      if (dados.length > 0) {
        console.log(`✅ ✅ ✅ SCHEMA ${schema} ACESSÍVEL!`);
        console.log('Campos:', Object.keys(dados[0]).join(', '));
        console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
      }
    } catch (e) {
      // Silencioso
    }
  }

  console.log('⚠️  Nenhum SCHEMA alternativo acessível\n');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  // TESTE 5: Testar UNION com outras tabelas
  console.log('5️⃣ Tentando UNION para descobrir estrutura de outras tabelas...\n');

  const unions = [
    `SELECT M00AD as id, 'M43' as origem FROM ZAN_M43 WHERE ROWNUM <= 1 UNION SELECT M00AD, 'M02' FROM ZAN_M02 WHERE ROWNUM <= 1`,
    `SELECT M00AD as id, 'M43' as origem FROM ZAN_M43 WHERE ROWNUM <= 1 UNION SELECT NUM_CUPOM, 'PAG' FROM ZAN_PAGAMENTO WHERE ROWNUM <= 1`,
    `SELECT COUNT(*) as total, 'M43' as tabela FROM ZAN_M43 UNION SELECT COUNT(*), 'M02' FROM ZAN_M02`,
  ];

  for (const sql of unions) {
    json.ZMI.DATABASES.DATABASE.COMMANDS.SELECT.DADOS.DADO.SQL = sql;
    formData = new URLSearchParams();
    formData.append('str_json', JSON.stringify(json));

    try {
      const res = await axios.post(apiUrl, formData.toString(), {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        timeout: 30000
      });

      const dados = res.data?.QUERY?.CONTENT || [];

      if (dados.length > 0) {
        console.log(`✅ UNION funcionou!`);
        console.log(JSON.stringify(dados, null, 2));
        console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
      }
    } catch (e) {
      // Silencioso
    }
  }

  console.log('⚠️  UNION com outras tabelas não funcionou\n');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  // TESTE 6: Verificar se há campos calculados ou funções
  console.log('6️⃣ Testando FUNÇÕES e CAMPOS CALCULADOS...\n');

  const sql6 = `
    SELECT
      M00AD as cupom,
      M43CZ as operador,
      M43AQ as desconto,
      M43DF as motivoDesconto,

      -- Tentar buscar descrição via decode/case
      DECODE(M43DF, 10, 'Motivo 10', 20, 'Motivo 20', 'Outro') as descMotivo,

      -- Tentar achar nome do operador em campo que não vimos
      NVL(M43DS, 'SEM_NOME') as possibleNome1,
      NVL(M43DT, 'SEM_NOME') as possibleNome2,

      -- Campos de texto que podem ter descrição
      M43AR as campoTexto1,
      M43BB as campoTexto2,
      M43BD as campoTexto3,
      M43BE as campoTexto4,
      M43BF as campoTexto5,
      M43BK as campoTexto6,
      M43BP as campoTexto7,
      M43CM as campoTexto8,
      M43CO as campoTexto9,
      M43CQ as campoTexto10,
      M43CS as campoTexto11,
      M43CU as campoTexto12,
      M43DH as campoTexto13,
      M43DS as campoTexto14,
      M43DT as campoTexto15,
      M43DZ as campoTexto16,
      M43EMA as campoTexto17,
      M43EO as campoTexto18,
      M43EP as campoTexto19

    FROM ZAN_M43
    WHERE TRUNC(M00AF) = TO_DATE('${data}','YYYY-MM-DD')
    AND M43AQ IS NOT NULL
    AND ROWNUM <= 3
  `.replace(/\s+/g, ' ').trim();

  json.ZMI.DATABASES.DATABASE.COMMANDS.SELECT.DADOS.DADO.SQL = sql6;
  formData = new URLSearchParams();
  formData.append('str_json', JSON.stringify(json));

  try {
    const res = await axios.post(apiUrl, formData.toString(), {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      timeout: 60000
    });

    const dados = res.data?.QUERY?.CONTENT || [];

    if (dados.length > 0) {
      console.log(`✅ Campos de texto testados:\n`);

      dados.forEach((d, i) => {
        console.log(`\n📦 Registro ${i + 1}:`);

        // Mostrar apenas campos de texto que estão preenchidos
        for (const campo of Object.keys(d)) {
          if (campo.startsWith('CAMPOTEXTO') || campo.startsWith('POSSIBLE')) {
            if (d[campo] && d[campo] !== 'SEM_NOME' && d[campo] !== '0') {
              console.log(`  ⭐ ${campo}: ${d[campo]}`);
            }
          }
        }

        console.log(`  Cupom: ${d.CUPOM} | Operador: ${d.OPERADOR} | Desconto: ${d.DESCONTO}`);
        console.log(`  Descrição via DECODE: ${d.DESCMOTIVO}`);
      });
    }
  } catch (e) {
    console.error('❌ Erro:', e.message);
  }

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  // TESTE 7: Verificar existência de procedures/functions
  console.log('7️⃣ Tentando executar PROCEDURES...\n');

  const procedures = [
    'EXECUTE GET_OPERADOR_NOME(275)',
    'CALL GET_OPERADOR(275)',
    'SELECT NOME_OPERADOR(275) FROM DUAL',
    'SELECT GET_FUNCIONARIO(275) FROM DUAL'
  ];

  for (const sql of procedures) {
    json.ZMI.DATABASES.DATABASE.COMMANDS.SELECT.DADOS.DADO.SQL = sql;
    formData = new URLSearchParams();
    formData.append('str_json', JSON.stringify(json));

    try {
      const res = await axios.post(apiUrl, formData.toString(), {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        timeout: 30000
      });

      const dados = res.data?.QUERY?.CONTENT || [];

      if (dados && dados.length > 0) {
        console.log(`✅ ✅ ✅ PROCEDURE/FUNCTION ENCONTRADA!`);
        console.log(`SQL: ${sql}`);
        console.log('Resultado:', JSON.stringify(dados, null, 2));
        console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
      }
    } catch (e) {
      // Silencioso
    }
  }

  console.log('⚠️  Nenhuma PROCEDURE acessível\n');

  console.log('\n✅ Investigação profunda concluída!\n');
}

investigarAPIProfunda();
