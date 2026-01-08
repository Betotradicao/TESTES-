const axios = require('axios');

async function investigarEndpoints() {
  const baseUrl = 'http://10.6.1.101/manager/restful/integracao';

  console.log('🔬 INVESTIGANDO ENDPOINTS DA API ZANTHUS');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  // TESTE 1: Diferentes endpoints
  console.log('1️⃣ Testando diferentes endpoints...\n');

  const endpoints = [
    '/cadastro_sincrono.php5',
    '/cadastro.php5',
    '/vendas.php5',
    '/consulta.php5',
    '/movimentacao.php5',
    '/cupom.php5',
    '/pagamento.php5',
    '/relatorio.php5',
    '/dados.php5',
    '/api.php5',
    '/index.php5'
  ];

  const ontem = new Date();
  ontem.setDate(ontem.getDate() - 1);
  const data = ontem.toISOString().split('T')[0];

  const sqlTeste = `SELECT COUNT(*) as total FROM ZAN_M43 WHERE TRUNC(M00AF) = TO_DATE('${data}','YYYY-MM-DD')`;

  const jsonTeste = {
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
                  SQL: sqlTeste
                }
              }
            }
          }
        }
      }
    }
  };

  for (const endpoint of endpoints) {
    const url = baseUrl + endpoint;

    const formData = new URLSearchParams();
    formData.append('str_json', JSON.stringify(jsonTeste));

    try {
      const res = await axios.post(url, formData.toString(), {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        timeout: 15000
      });

      console.log(`✅ ✅ ✅ ENDPOINT ${endpoint} RESPONDEU!`);
      console.log(`Status: ${res.status}`);
      console.log(`Resposta:`, JSON.stringify(res.data, null, 2).substring(0, 500));
      console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    } catch (e) {
      if (e.response?.status) {
        console.log(`⚠️  ${endpoint} - Status ${e.response.status}`);
      }
      // Silencioso para timeout/connection refused
    }
  }

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  // TESTE 2: Testar método GET
  console.log('2️⃣ Testando método GET...\n');

  const urlGet = baseUrl + '/cadastro_sincrono.php5?str_json=' + encodeURIComponent(JSON.stringify(jsonTeste));

  try {
    const res = await axios.get(urlGet, { timeout: 15000 });
    console.log(`✅ GET funcionou!`);
    console.log(JSON.stringify(res.data, null, 2).substring(0, 500));
  } catch (e) {
    console.log(`❌ GET não funcionou: ${e.response?.status || e.message}`);
  }

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  // TESTE 3: Inspecionar resposta completa da API
  console.log('3️⃣ Inspecionando estrutura completa da resposta...\n');

  const sql3 = `
    SELECT
      M00AD as cupom,
      M43CZ as operador,
      M43DF as motivo
    FROM ZAN_M43
    WHERE TRUNC(M00AF) = TO_DATE('${data}','YYYY-MM-DD')
    AND M43AQ IS NOT NULL
    AND ROWNUM <= 1
  `.replace(/\s+/g, ' ').trim();

  const json3 = {
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
                  SQL: sql3
                }
              }
            }
          }
        }
      }
    }
  };

  const formData3 = new URLSearchParams();
  formData3.append('str_json', JSON.stringify(json3));

  try {
    const res = await axios.post(baseUrl + '/cadastro_sincrono.php5', formData3.toString(), {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      timeout: 30000
    });

    console.log('📊 ESTRUTURA COMPLETA DA RESPOSTA:\n');
    console.log('Headers:');
    console.log(JSON.stringify(res.headers, null, 2));
    console.log('\nBody completo:');
    console.log(JSON.stringify(res.data, null, 2));

  } catch (e) {
    console.error('❌ Erro:', e.message);
  }

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  // TESTE 4: Testar diferentes estruturas de JSON
  console.log('4️⃣ Testando diferentes estruturas de requisição...\n');

  const estruturas = [
    // Estrutura 1: Tentar acessar cadastro
    {
      ZMI: {
        DATABASES: {
          DATABASE: {
            "@attributes": {
              NAME: "MANAGER"
            },
            COMMANDS: {
              CONSULTA: {
                OPERADORES: {
                  OPERADOR: {
                    CODIGO: 275
                  }
                }
              }
            }
          }
        }
      }
    },
    // Estrutura 2: Tentar listar
    {
      ZMI: {
        DATABASES: {
          DATABASE: {
            "@attributes": {
              NAME: "MANAGER"
            },
            COMMANDS: {
              LIST: {
                TABELAS: "ZAN_M43"
              }
            }
          }
        }
      }
    },
    // Estrutura 3: Tentar INFO
    {
      ZMI: {
        DATABASES: {
          DATABASE: {
            "@attributes": {
              NAME: "MANAGER"
            },
            COMMANDS: {
              INFO: {
                TABELA: "ZAN_M43"
              }
            }
          }
        }
      }
    }
  ];

  for (let i = 0; i < estruturas.length; i++) {
    const formData = new URLSearchParams();
    formData.append('str_json', JSON.stringify(estruturas[i]));

    try {
      const res = await axios.post(baseUrl + '/cadastro_sincrono.php5', formData.toString(), {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        timeout: 15000
      });

      console.log(`✅ Estrutura ${i + 1} respondeu:`);
      console.log(JSON.stringify(res.data, null, 2));
      console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    } catch (e) {
      console.log(`⚠️  Estrutura ${i + 1} não funcionou`);
    }
  }

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  // TESTE 5: Tentar acessar help/documentation
  console.log('5️⃣ Buscando documentação/help da API...\n');

  const urlsHelp = [
    'http://10.6.1.101/manager/restful/help',
    'http://10.6.1.101/manager/restful/api',
    'http://10.6.1.101/manager/restful/docs',
    'http://10.6.1.101/manager/restful/info',
    'http://10.6.1.101/manager/restful/',
    'http://10.6.1.101/manager/api/docs',
    'http://10.6.1.101/manager/',
  ];

  for (const url of urlsHelp) {
    try {
      const res = await axios.get(url, { timeout: 10000 });
      console.log(`✅ ${url} - Status ${res.status}`);
      if (res.data) {
        const text = typeof res.data === 'string' ? res.data : JSON.stringify(res.data);
        console.log(text.substring(0, 300));
      }
      console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    } catch (e) {
      // Silencioso
    }
  }

  console.log('\n✅ Investigação de endpoints concluída!\n');
}

investigarEndpoints();
