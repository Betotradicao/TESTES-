const axios = require('axios');

async function testarComAutenticacao() {
  const baseUrl = 'http://10.6.1.101';
  const username = 'beto';
  const password = 'beto3107';

  console.log('🔐 TESTANDO API COM AUTENTICAÇÃO');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  const ontem = new Date();
  ontem.setDate(ontem.getDate() - 1);
  const data = ontem.toISOString().split('T')[0];

  // TESTE 1: Tentar fazer login primeiro
  console.log('1️⃣ Tentando fazer login no sistema...\n');

  try {
    const loginUrl = `${baseUrl}/manager/index.php5`;
    const loginData = new URLSearchParams();
    loginData.append('usuario', username);
    loginData.append('senha', password);
    loginData.append('acao', 'login');

    const loginRes = await axios.post(loginUrl, loginData, {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      maxRedirects: 0,
      validateStatus: () => true
    });

    console.log('Login Status:', loginRes.status);
    console.log('Headers:', loginRes.headers);

    // Pegar cookies
    const cookies = loginRes.headers['set-cookie'];
    console.log('Cookies:', cookies);

  } catch (e) {
    console.log('Erro no login:', e.message);
  }

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  // TESTE 2: Tentar acessar API com Basic Auth
  console.log('2️⃣ Tentando API com Basic Authentication...\n');

  const apiUrl = `${baseUrl}/manager/restful/integracao/cadastro_sincrono.php5`;

  const sql = `
    SELECT *
    FROM ZAN_M02
    WHERE TRUNC(M00AF) = TO_DATE('${data}','YYYY-MM-DD')
    AND ROWNUM <= 3
  `.replace(/\s+/g, ' ').trim();

  const jsonData = {
    ZMI: {
      DATABASES: {
        DATABASE: {
          "@attributes": {
            NAME: "MANAGER",
            AUTOCOMMIT_VALUE: "1000",
            AUTOCOMMIT_ENABLED: "1",
            HALTONERROR: "0"
          },
          COMMANDS: {
            SELECT: {
              PAGAMENTOS: {
                PAGAMENTO: {
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
  formData.append('str_json', JSON.stringify(jsonData));

  try {
    const res = await axios.post(apiUrl, formData.toString(), {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      auth: {
        username: username,
        password: password
      },
      timeout: 30000
    });

    const dados = res.data?.QUERY?.CONTENT || [];

    if (dados.length > 0) {
      console.log('✅ ✅ ✅ BASIC AUTH FUNCIONOU! Tabela M02 ACESSÍVEL!');
      console.log('\n📊 CAMPOS DA TABELA M02 (PAGAMENTOS):');
      console.log(Object.keys(dados[0]).join(', '));
      console.log('\n📋 DADOS:');
      dados.forEach((d, i) => {
        console.log(`\nPagamento ${i + 1}:`);
        console.log(JSON.stringify(d, null, 2));
      });
    } else {
      console.log('⚠️  Autenticou mas tabela vazia');
    }
  } catch (e) {
    if (e.response?.status === 401) {
      console.log('❌ Credenciais inválidas (401)');
    } else if (e.response?.status === 500) {
      console.log('⚠️  Autenticou mas M02 não acessível (500)');
    } else {
      console.log('❌ Erro:', e.message);
    }
  }

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  // TESTE 3: Testar outras tabelas com autenticação
  console.log('3️⃣ Testando TODAS as tabelas com autenticação...\n');

  const tabelas = [
    { nome: 'ZAN_M01', desc: 'Cupom Fiscal', filtro: `TRUNC(M00AF) = TO_DATE('${data}','YYYY-MM-DD')` },
    { nome: 'ZAN_M02', desc: 'Pagamentos', filtro: `TRUNC(M00AF) = TO_DATE('${data}','YYYY-MM-DD')` },
    { nome: 'ZAN_M00', desc: 'Cabeçalho', filtro: `TRUNC(M00AF) = TO_DATE('${data}','YYYY-MM-DD')` },
    { nome: 'TAB_OPERADOR', desc: 'Operadores', filtro: '1=1' },
    { nome: 'TAB_FUNCIONARIO', desc: 'Funcionários', filtro: 'COD_FUNCIONARIO IN (185, 207, 275, 459, 3557, 3649, 5948)' },
    { nome: 'TAB_MOTIVO_DESCONTO', desc: 'Motivos Desconto', filtro: 'CODIGO IN (10, 20)' },
    { nome: 'TAB_PLANO_PAGAMENTO', desc: 'Planos Pagamento', filtro: '1=1' },
  ];

  for (const tabela of tabelas) {
    const sqlTabela = `SELECT * FROM ${tabela.nome} WHERE ${tabela.filtro} AND ROWNUM <= 3`;

    const jsonTabela = {
      ZMI: {
        DATABASES: {
          DATABASE: {
            "@attributes": {
              NAME: "MANAGER",
              AUTOCOMMIT_VALUE: "1000",
              AUTOCOMMIT_ENABLED: "1",
              HALTONERROR: "0"
            },
            COMMANDS: {
              SELECT: {
                DADOS: {
                  DADO: {
                    SQL: sqlTabela
                  }
                }
              }
            }
          }
        }
      }
    };

    const formDataTabela = new URLSearchParams();
    formDataTabela.append('str_json', JSON.stringify(jsonTabela));

    try {
      const res = await axios.post(apiUrl, formDataTabela.toString(), {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        auth: {
          username: username,
          password: password
        },
        timeout: 30000
      });

      const dados = res.data?.QUERY?.CONTENT || [];

      if (dados.length > 0) {
        console.log(`\n✅ ✅ ✅ ${tabela.nome} (${tabela.desc}) - ACESSÍVEL!`);
        console.log('Campos:', Object.keys(dados[0]).join(', '));
        console.log('\nPrimeiro registro:');
        console.log(JSON.stringify(dados[0], null, 2));
        console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      } else {
        console.log(`⚠️  ${tabela.nome} - Acessível mas vazia`);
      }
    } catch (e) {
      if (e.response?.status !== 500) {
        console.log(`❌ ${tabela.nome} - Erro: ${e.response?.status || e.message}`);
      }
    }
  }

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  // TESTE 4: Explorar interface web do Manager
  console.log('4️⃣ Explorando interface web do Manager...\n');

  const urls = [
    '/manager/',
    '/manager/menu.php5',
    '/manager/cadastro/',
    '/manager/relatorios/',
    '/manager/api/',
  ];

  for (const url of urls) {
    try {
      const fullUrl = baseUrl + url;
      const res = await axios.get(fullUrl, {
        auth: {
          username: username,
          password: password
        },
        timeout: 10000,
        maxRedirects: 0,
        validateStatus: () => true
      });

      if (res.status === 200 && res.data) {
        console.log(`✅ ${url} - Status ${res.status}`);
        const text = typeof res.data === 'string' ? res.data : JSON.stringify(res.data);
        if (text.includes('api') || text.includes('API') || text.includes('restful') || text.includes('RESTFUL')) {
          console.log('⭐ Parece ter informações sobre API!');
          console.log(text.substring(0, 500));
        }
      }
    } catch (e) {
      // Silencioso
    }
  }

  console.log('\n✅ Testes com autenticação concluídos!\n');
}

testarComAutenticacao();
