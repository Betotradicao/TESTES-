const axios = require('axios');

async function testarComSessao() {
  const baseUrl = 'http://10.6.1.101';
  const username = 'beto';
  const password = 'beto3107';

  console.log('🔐 TESTANDO API COM SESSÃO AUTENTICADA');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  const ontem = new Date();
  ontem.setDate(ontem.getDate() - 1);
  const data = ontem.toISOString().split('T')[0];

  // PASSO 1: Fazer login e pegar cookies
  console.log('1️⃣ Fazendo login para obter sessão...\n');

  let sessionCookies = '';

  try {
    const loginUrl = `${baseUrl}/manager/index.php5`;
    const loginData = new URLSearchParams();
    loginData.append('usuario', username);
    loginData.append('senha', password);

    const loginRes = await axios.post(loginUrl, loginData, {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      maxRedirects: 5,
      validateStatus: () => true
    });

    const cookies = loginRes.headers['set-cookie'];
    if (cookies) {
      sessionCookies = cookies.map(cookie => cookie.split(';')[0]).join('; ');
      console.log('✅ Login bem-sucedido!');
      console.log('Cookies obtidos:', sessionCookies);
    }

  } catch (e) {
    console.log('❌ Erro no login:', e.message);
    return;
  }

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  // PASSO 2: Usar cookies para acessar API
  console.log('2️⃣ Usando sessão para acessar tabelas...\n');

  const apiUrl = `${baseUrl}/manager/restful/integracao/cadastro_sincrono.php5`;

  const tabelas = [
    { nome: 'ZAN_M02', desc: 'Pagamentos' },
    { nome: 'ZAN_M01', desc: 'Cupom Fiscal' },
    { nome: 'ZAN_M00', desc: 'Cabeçalho' },
    { nome: 'TAB_FUNCIONARIO', desc: 'Funcionários', filtro: 'COD_FUNCIONARIO IN (185, 207, 275)' },
    { nome: 'TAB_OPERADOR', desc: 'Operadores', filtro: 'COD_OPERADOR IN (185, 207, 275)' },
  ];

  for (const tabela of tabelas) {
    const filtro = tabela.filtro || `TRUNC(M00AF) = TO_DATE('${data}','YYYY-MM-DD')`;
    const sql = `SELECT * FROM ${tabela.nome} WHERE ${filtro} AND ROWNUM <= 3`;

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
                DADOS: {
                  DADO: {
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
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Cookie': sessionCookies
        },
        timeout: 30000
      });

      const dados = res.data?.QUERY?.CONTENT || [];

      if (dados.length > 0) {
        console.log(`\n🎉 🎉 🎉 ${tabela.nome} (${tabela.desc}) - SUCESSO!`);
        console.log('\n📊 Campos disponíveis:');
        console.log(Object.keys(dados[0]).join(', '));
        console.log('\n📋 Primeiro registro:');
        console.log(JSON.stringify(dados[0], null, 2));
        console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      } else {
        console.log(`⚠️  ${tabela.nome} - Acessível mas sem dados no período`);
      }
    } catch (e) {
      if (e.response?.status === 500) {
        console.log(`❌ ${tabela.nome} - Erro 500 (não acessível)`);
      } else {
        console.log(`❌ ${tabela.nome} - Erro: ${e.response?.status || e.message}`);
      }
    }
  }

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  // PASSO 3: Tentar descobrir endpoints de consulta via interface web
  console.log('3️⃣ Explorando interface web autenticada...\n');

  const urls = [
    '/manager/menu.php5',
    '/manager/consultas/vendas.php5',
    '/manager/relatorios/vendas.php5',
    '/manager/cadastros/operador.php5',
    '/manager/cadastros/funcionario.php5',
    '/manager/restful/',
    '/manager/restful/help.php5',
    '/manager/restful/docs.php5',
  ];

  for (const url of urls) {
    try {
      const fullUrl = baseUrl + url;
      const res = await axios.get(fullUrl, {
        headers: {
          'Cookie': sessionCookies
        },
        timeout: 10000,
        maxRedirects: 0,
        validateStatus: () => true
      });

      if (res.status === 200 && res.data) {
        const text = typeof res.data === 'string' ? res.data : JSON.stringify(res.data);

        // Verificar se tem info útil
        if (text.toLowerCase().includes('operador') ||
            text.toLowerCase().includes('funcionario') ||
            text.toLowerCase().includes('pagamento') ||
            text.toLowerCase().includes('api') ||
            text.toLowerCase().includes('restful')) {
          console.log(`\n✅ ${url} - Status ${res.status}`);
          console.log('Conteúdo relevante encontrado!');
          console.log(text.substring(0, 300));
        }
      }
    } catch (e) {
      // Silencioso para erros
    }
  }

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  // PASSO 4: Tentar acessar dados via diferentes endpoints
  console.log('4️⃣ Tentando endpoints alternativos...\n');

  const endpoints = [
    '/manager/restful/integracao/consulta.php5',
    '/manager/restful/integracao/dados.php5',
    '/manager/restful/consulta.php5',
    '/manager/api/vendas.php5',
    '/manager/api/operadores.php5',
  ];

  const sqlSimples = `SELECT COUNT(*) as total FROM ZAN_M43 WHERE TRUNC(M00AF) = TO_DATE('${data}','YYYY-MM-DD')`;

  const jsonSimples = {
    ZMI: {
      DATABASES: {
        DATABASE: {
          "@attributes": {
            NAME: "MANAGER"
          },
          COMMANDS: {
            SELECT: {
              DADOS: {
                DADO: {
                  SQL: sqlSimples
                }
              }
            }
          }
        }
      }
    }
  };

  const formSimples = new URLSearchParams();
  formSimples.append('str_json', JSON.stringify(jsonSimples));

  for (const endpoint of endpoints) {
    try {
      const fullUrl = baseUrl + endpoint;
      const res = await axios.post(fullUrl, formSimples.toString(), {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Cookie': sessionCookies
        },
        timeout: 15000,
        validateStatus: () => true
      });

      if (res.status === 200) {
        console.log(`✅ ${endpoint} - Status ${res.status}`);
        console.log('Resposta:', JSON.stringify(res.data, null, 2).substring(0, 300));
      } else if (res.status !== 404) {
        console.log(`⚠️  ${endpoint} - Status ${res.status}`);
      }
    } catch (e) {
      // Silencioso
    }
  }

  console.log('\n✅ Testes com sessão concluídos!\n');
}

testarComSessao();
