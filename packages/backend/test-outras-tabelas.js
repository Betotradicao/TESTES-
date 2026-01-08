const axios = require('axios');

async function testarTabelas() {
  const apiUrl = 'http://10.6.1.101/manager/restful/integracao/cadastro_sincrono.php5';

  const ontem = new Date();
  ontem.setDate(ontem.getDate() - 1);
  const data = ontem.toISOString().split('T')[0];

  console.log('🔍 TESTANDO ACESSO ÀS TABELAS ZANTHUS');
  console.log('Data:', data);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  const tabelas = [
    { nome: 'ZAN_M44', descricao: 'Tabela M44' },
    { nome: 'ZAN_M36', descricao: 'Tabela M36' },
    { nome: 'ZAN_M31', descricao: 'Tabela M31' },
    { nome: 'ZAN_M02', descricao: 'Tabela M02 (Pagamentos)' },
    { nome: 'ZAN_M01', descricao: 'Tabela M01 (Cupom Fiscal)' },
    { nome: 'ZAN_M00', descricao: 'Tabela M00' },
    { nome: 'ZAN_DEFM', descricao: 'Tabela DEFM (Definições)' }
  ];

  for (const tabela of tabelas) {
    console.log(`\n📋 TESTANDO: ${tabela.nome} - ${tabela.descricao}`);
    console.log('─────────────────────────────────────────────\n');

    // Tentar buscar com filtro de data
    const sql1 = `
      SELECT *
      FROM ${tabela.nome}
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
              HALTONERROR: "0"
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
        console.log(`✅ TABELA ACESSÍVEL! Encontrados ${dados.length} registros\n`);
        console.log('📊 CAMPOS DISPONÍVEIS:');
        const campos = Object.keys(dados[0]);
        console.log(campos.join(', '));
        console.log('\n📋 PRIMEIRO REGISTRO COMPLETO:');
        console.log(JSON.stringify(dados[0], null, 2));
      } else {
        // Tentar sem filtro de data
        console.log('⚠️  Nenhum registro com filtro de data. Tentando sem filtro...\n');

        const sql2 = `SELECT * FROM ${tabela.nome} WHERE ROWNUM <= 3`.replace(/\s+/g, ' ').trim();

        json.ZMI.DATABASES.DATABASE.COMMANDS.SELECT.DADOS.DADO.SQL = sql2;
        formData = new URLSearchParams();
        formData.append('str_json', JSON.stringify(json));

        const res2 = await axios.post(apiUrl, formData.toString(), {
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          timeout: 60000
        });

        const dados2 = res2.data?.QUERY?.CONTENT || [];

        if (dados2.length > 0) {
          console.log(`✅ TABELA ACESSÍVEL (sem filtro)! Encontrados ${dados2.length} registros\n`);
          console.log('📊 CAMPOS DISPONÍVEIS:');
          const campos = Object.keys(dados2[0]);
          console.log(campos.join(', '));
          console.log('\n📋 PRIMEIRO REGISTRO COMPLETO:');
          console.log(JSON.stringify(dados2[0], null, 2));
        } else {
          console.log('⚠️  Tabela vazia ou sem dados');
        }
      }
    } catch (e) {
      if (e.response?.status === 500) {
        console.log('❌ ERRO 500: Tabela não acessível ou não existe');
      } else {
        console.log('❌ ERRO:', e.message);
      }
    }

    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  }

  console.log('\n✅ Testes concluídos!\n');
}

testarTabelas();
