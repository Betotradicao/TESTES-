const axios = require('axios');

async function testarTabelasAlternativas() {
  const apiUrl = 'http://10.6.1.101/manager/restful/integracao/cadastro_sincrono.php5';

  const ontem = new Date();
  ontem.setDate(ontem.getDate() - 1);
  const data = ontem.toISOString().split('T')[0];

  console.log('🔍 TESTANDO TABELAS ALTERNATIVAS DO ZANTHUS');
  console.log('Data:', data);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  const tabelas = [
    // Tabelas de cadastro
    { nome: 'TAB_OPERADOR', descricao: 'Cadastro de Operadores', filtro: 'COD_OPERADOR IS NOT NULL' },
    { nome: 'TAB_FUNCIONARIO', descricao: 'Cadastro de Funcionários', filtro: 'COD_FUNCIONARIO IS NOT NULL' },
    { nome: 'TAB_CAIXA', descricao: 'Cadastro de Caixas', filtro: 'COD_CAIXA IS NOT NULL' },
    { nome: 'TAB_PLANO_PAGAMENTO', descricao: 'Planos de Pagamento', filtro: '1=1' },
    { nome: 'TAB_MOTIVO_DESCONTO', descricao: 'Motivos de Desconto', filtro: '1=1' },

    // Tabelas de movimento - tentando com M43 como prefixo conhecido
    { nome: 'ZAN_M43_PAGAMENTO', descricao: 'Pagamentos M43', filtro: `TRUNC(M00AF) = TO_DATE('${data}','YYYY-MM-DD')` },
    { nome: 'ZAN_CUPOM', descricao: 'Cupons', filtro: `TRUNC(DATA_CUPOM) = TO_DATE('${data}','YYYY-MM-DD')` },
    { nome: 'ZAN_PAGAMENTO', descricao: 'Pagamentos', filtro: `TRUNC(DATA_PAGAMENTO) = TO_DATE('${data}','YYYY-MM-DD')` },

    // Tentar M43 com sufixos
    { nome: 'M43', descricao: 'M43 sem prefixo ZAN_', filtro: `TRUNC(M00AF) = TO_DATE('${data}','YYYY-MM-DD')` },
    { nome: 'M02', descricao: 'M02 sem prefixo', filtro: `TRUNC(M00AF) = TO_DATE('${data}','YYYY-MM-DD')` },
    { nome: 'M01', descricao: 'M01 sem prefixo', filtro: `TRUNC(M00AF) = TO_DATE('${data}','YYYY-MM-DD')` },
  ];

  for (const tabela of tabelas) {
    console.log(`\n📋 TESTANDO: ${tabela.nome} - ${tabela.descricao}`);
    console.log('─────────────────────────────────────────────\n');

    const sql = `
      SELECT *
      FROM ${tabela.nome}
      WHERE ${tabela.filtro}
      AND ROWNUM <= 3
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
                    SQL: sql
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
        console.log(`✅ ✅ ✅ SUCESSO! Tabela ${tabela.nome} ACESSÍVEL!`);
        console.log(`Encontrados ${dados.length} registros\n`);

        console.log('📊 CAMPOS DISPONÍVEIS:');
        const campos = Object.keys(dados[0]);
        console.log(campos.join(', '));

        console.log('\n📋 REGISTROS ENCONTRADOS:');
        dados.forEach((d, i) => {
          console.log(`\nRegistro ${i + 1}:`);
          console.log(JSON.stringify(d, null, 2));
        });
      } else {
        console.log('⚠️  Tabela acessível mas sem dados');
      }
    } catch (e) {
      if (e.response?.status === 500) {
        console.log('❌ Tabela não acessível');
      } else {
        console.log('❌ ERRO:', e.message);
      }
    }

    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  }

  console.log('\n✅ Testes concluídos!\n');
}

testarTabelasAlternativas();
