const axios = require('axios');

async function buscarCadastros() {
  const apiUrl = 'http://10.6.1.101/manager/restful/integracao/cadastro_sincrono.php5';

  console.log('🔍 BUSCANDO CADASTROS E DADOS DE APOIO');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  // Códigos reais que já encontramos
  const operadores = [185, 207, 275, 459, 3557, 3649, 5948];
  const motivosDesconto = [10, 20];
  const autorizadores = [3, 28];

  // TESTE 1: Buscar operadores na tabela de funcionários
  console.log('1️⃣ Tentando buscar OPERADORES/FUNCIONÁRIOS...\n');

  for (const codOp of operadores.slice(0, 3)) { // Testar só os 3 primeiros
    const queries = [
      // Diferentes formas de buscar
      `SELECT * FROM TAB_FUNCIONARIO WHERE COD_FUNCIONARIO = ${codOp}`,
      `SELECT * FROM FUNCIONARIO WHERE CODIGO = ${codOp}`,
      `SELECT * FROM CAD_FUNCIONARIO WHERE COD = ${codOp}`,
      `SELECT * FROM ZAN_FUNCIONARIO WHERE COD_FUNCIONARIO = ${codOp}`,
      `SELECT * FROM OPERADOR WHERE COD_OPERADOR = ${codOp}`,
      `SELECT * FROM TAB_OPERADOR WHERE COD_OPERADOR = ${codOp}`,
      `SELECT * FROM CAD_OPERADOR WHERE CODIGO = ${codOp}`
    ];

    for (const sql of queries) {
      const json = {
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
      formData.append('str_json', JSON.stringify(json));

      try {
        const res = await axios.post(apiUrl, formData.toString(), {
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          timeout: 30000
        });

        const dados = res.data?.QUERY?.CONTENT || [];

        if (dados.length > 0) {
          console.log(`✅ ✅ ✅ SUCESSO! Query funcionou: ${sql}`);
          console.log('Dados encontrados:');
          console.log(JSON.stringify(dados[0], null, 2));
          console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
          return; // Para se encontrar
        }
      } catch (e) {
        // Silencioso - só mostra se encontrar
      }
    }
  }

  console.log('❌ Nenhuma tabela de funcionário/operador acessível\n');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  // TESTE 2: Buscar forma de pagamento
  console.log('2️⃣ Tentando buscar FORMA DE PAGAMENTO...\n');

  const ontem = new Date();
  ontem.setDate(ontem.getDate() - 1);
  const data = ontem.toISOString().split('T')[0];

  // Pegar um cupom que sabemos que existe
  const cupomTeste = 94536; // Cupom com devoluções que encontramos

  const querysPagamento = [
    `SELECT * FROM ZAN_M02 WHERE M00AD = ${cupomTeste}`,
    `SELECT * FROM M02 WHERE M00AD = ${cupomTeste}`,
    `SELECT * FROM PAGAMENTO WHERE NUM_CUPOM = ${cupomTeste}`,
    `SELECT * FROM ZAN_PAGAMENTO WHERE CUPOM = ${cupomTeste}`,
    `SELECT * FROM M43_PAGAMENTO WHERE M00AD = ${cupomTeste}`,

    // Tentar com data
    `SELECT * FROM ZAN_M02 WHERE TRUNC(M00AF) = TO_DATE('${data}','YYYY-MM-DD') AND ROWNUM <= 3`,
    `SELECT * FROM M02 WHERE TRUNC(DATA) = TO_DATE('${data}','YYYY-MM-DD') AND ROWNUM <= 3`,

    // Tentar JOIN com M43
    `SELECT p.* FROM ZAN_M02 p INNER JOIN ZAN_M43 v ON p.M00AD = v.M00AD WHERE TRUNC(v.M00AF) = TO_DATE('${data}','YYYY-MM-DD') AND ROWNUM <= 3`,
  ];

  for (const sql of querysPagamento) {
    const json = {
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
    formData.append('str_json', JSON.stringify(json));

    try {
      const res = await axios.post(apiUrl, formData.toString(), {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        timeout: 30000
      });

      const dados = res.data?.QUERY?.CONTENT || [];

      if (dados.length > 0) {
        console.log(`✅ ✅ ✅ SUCESSO! Forma de pagamento encontrada!`);
        console.log(`Query: ${sql}\n`);
        console.log('Campos disponíveis:', Object.keys(dados[0]).join(', '));
        console.log('\nPrimeiro registro:');
        console.log(JSON.stringify(dados[0], null, 2));
        console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
        return; // Para se encontrar
      }
    } catch (e) {
      // Silencioso
    }
  }

  console.log('❌ Nenhuma tabela de pagamento acessível\n');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  // TESTE 3: Buscar motivos de desconto
  console.log('3️⃣ Tentando buscar MOTIVOS DE DESCONTO...\n');

  const querysMotivo = [
    `SELECT * FROM TAB_MOTIVO_DESCONTO WHERE CODIGO IN (10, 20)`,
    `SELECT * FROM MOTIVO_DESCONTO WHERE COD_MOTIVO IN (10, 20)`,
    `SELECT * FROM ZAN_MOTIVO_DESCONTO WHERE CODIGO IN (10, 20)`,
    `SELECT * FROM CAD_MOTIVO WHERE CODIGO IN (10, 20)`,
    `SELECT * FROM TAB_MOTIVO WHERE COD IN (10, 20)`,
  ];

  for (const sql of querysMotivo) {
    const json = {
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
    formData.append('str_json', JSON.stringify(json));

    try {
      const res = await axios.post(apiUrl, formData.toString(), {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        timeout: 30000
      });

      const dados = res.data?.QUERY?.CONTENT || [];

      if (dados.length > 0) {
        console.log(`✅ ✅ ✅ SUCESSO! Motivos de desconto encontrados!`);
        console.log(`Query: ${sql}\n`);
        console.log('Dados:');
        dados.forEach(d => console.log(JSON.stringify(d, null, 2)));
        console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
        return;
      }
    } catch (e) {
      // Silencioso
    }
  }

  console.log('❌ Nenhuma tabela de motivo de desconto acessível\n');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  // TESTE 4: Tentar campos de JOIN na própria M43
  console.log('4️⃣ Tentando buscar NOMES via JOIN na própria M43...\n');

  const queryJoin = `
    SELECT
      v.M43CZ as codOperador,
      f.NOME as nomeOperador,
      v.M43DF as codMotivo,
      m.DESCRICAO as descMotivo
    FROM ZAN_M43 v
    LEFT JOIN TAB_FUNCIONARIO f ON f.COD_FUNCIONARIO = v.M43CZ
    LEFT JOIN TAB_MOTIVO_DESCONTO m ON m.CODIGO = v.M43DF
    WHERE TRUNC(v.M00AF) = TO_DATE('${data}','YYYY-MM-DD')
    AND v.M43AQ IS NOT NULL
    AND ROWNUM <= 5
  `.replace(/\s+/g, ' ').trim();

  const json = {
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
                  SQL: queryJoin
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
      timeout: 30000
    });

    const dados = res.data?.QUERY?.CONTENT || [];

    if (dados.length > 0) {
      console.log(`✅ Query JOIN executou! Verificando se trouxe nomes...\n`);
      console.log('Primeiro registro:');
      console.log(JSON.stringify(dados[0], null, 2));

      if (dados[0].NOMEOPERADOR || dados[0].DESCMOTIVO) {
        console.log('\n🎉 🎉 🎉 SUCESSO! Conseguimos nomes via JOIN!');
      } else {
        console.log('\n⚠️  JOIN funcionou mas não trouxe nomes (tabelas podem estar vazias)');
      }
    }
  } catch (e) {
    console.log('❌ JOIN não funcionou:', e.response?.status || e.message);
  }

  console.log('\n✅ Testes concluídos!\n');
}

buscarCadastros();
