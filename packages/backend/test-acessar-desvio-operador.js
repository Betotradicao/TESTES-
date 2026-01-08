const axios = require('axios');

async function acessarDesvioOperador() {
  const baseUrl = 'http://10.6.1.101';
  const username = 'beto';
  const password = 'beto3107';

  console.log('🎯 ACESSANDO PÁGINA DE DESVIO OPERADOR');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  const axiosInstance = axios.create({
    baseURL: baseUrl,
    withCredentials: true,
    maxRedirects: 5,
    validateStatus: () => true,
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
    }
  });

  // PASSO 1: Login
  console.log('1️⃣ Fazendo login...\n');

  const loginData = new URLSearchParams();
  loginData.append('usuario', username);
  loginData.append('senha', password);

  const loginRes = await axiosInstance.post('/manager/index.php5', loginData, {
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
  });

  const setCookies = loginRes.headers['set-cookie'] || [];
  const cookies = {};

  setCookies.forEach(cookie => {
    const [nameValue] = cookie.split(';');
    const [name, value] = nameValue.split('=');
    if (value && value !== 'deleted') {
      cookies[name] = value;
    }
  });

  const cookieString = Object.entries(cookies).map(([k, v]) => `${k}=${v}`).join('; ');
  axiosInstance.defaults.headers.common['Cookie'] = cookieString;

  console.log('✅ Login realizado');
  console.log('Cookies:', cookieString);

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  // PASSO 2: Acessar a página
  console.log('2️⃣ Acessando con_desvio_operador.php5...\n');

  try {
    const res = await axiosInstance.get('/manager/con_desvio_operador.php5?id_menu=513');

    console.log('Status:', res.status);
    console.log('Content-Type:', res.headers['content-type']);
    console.log('Tamanho:', res.data.length, 'bytes\n');

    if (res.status === 200 && res.data) {
      const html = res.data.toString();

      console.log('✅ Página acessada com sucesso!\n');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

      // ANÁLISE DO HTML
      console.log('📊 ANÁLISE DA PÁGINA:\n');

      // Procurar por tabelas
      const tabelas = html.match(/<table[^>]*>/gi) || [];
      console.log(`Tabelas encontradas: ${tabelas.length}`);

      // Procurar por formulários
      const forms = html.match(/<form[^>]*>/gi) || [];
      console.log(`Formulários encontrados: ${forms.length}`);

      // Procurar por scripts
      const scripts = html.match(/<script[^>]*>/gi) || [];
      console.log(`Scripts encontrados: ${scripts.length}`);

      // Procurar por campos de input
      const inputs = html.match(/<input[^>]*name="([^"]*)"/gi) || [];
      if (inputs.length > 0) {
        console.log(`\nCampos de formulário (${inputs.length}):`);
        inputs.slice(0, 10).forEach(input => {
          const match = input.match(/name="([^"]*)"/);
          const typeMatch = input.match(/type="([^"]*)"/);
          if (match) {
            console.log(`  - ${match[1]} (${typeMatch ? typeMatch[1] : 'text'})`);
          }
        });
      }

      // Procurar por selects (dropdowns)
      const selects = html.match(/<select[^>]*name="([^"]*)"/gi) || [];
      if (selects.length > 0) {
        console.log(`\nDropdowns (${selects.length}):`);
        selects.forEach(select => {
          const match = select.match(/name="([^"]*)"/);
          if (match) console.log(`  - ${match[1]}`);
        });
      }

      // Procurar por APIs/AJAX
      const ajaxCalls = html.match(/(ajax|fetch|axios|restful|api)[^\s<>"']*/gi) || [];
      if (ajaxCalls.length > 0) {
        console.log(`\nChamadas AJAX/API encontradas:`);
        [...new Set(ajaxCalls)].slice(0, 5).forEach(call => {
          console.log(`  ${call}`);
        });
      }

      // Procurar por URLs/endpoints
      const urls = html.match(/https?:\/\/[^\s<>"']+/gi) || [];
      const phpUrls = html.match(/[a-z_]+\.php5/gi) || [];

      if (urls.length > 0) {
        console.log(`\nURLs HTTP encontradas:`);
        [...new Set(urls)].slice(0, 5).forEach(url => {
          console.log(`  ${url}`);
        });
      }

      if (phpUrls.length > 0) {
        console.log(`\nArquivos PHP5 referenciados:`);
        [...new Set(phpUrls)].slice(0, 10).forEach(url => {
          console.log(`  ${url}`);
        });
      }

      console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

      // Mostrar primeiros 2000 caracteres do HTML
      console.log('📄 INÍCIO DO HTML:\n');
      console.log(html.substring(0, 2000));

      console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

      // Mostrar últimos 1000 caracteres
      console.log('📄 FINAL DO HTML:\n');
      console.log(html.substring(html.length - 1000));

    } else {
      console.log('❌ Erro ao acessar página');
      console.log('Status:', res.status);
    }

  } catch (e) {
    console.error('❌ Erro:', e.message);
  }

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  // PASSO 3: Tentar fazer uma consulta se houver formulário
  console.log('3️⃣ Tentando fazer consulta com dados de teste...\n');

  const ontem = new Date();
  ontem.setDate(ontem.getDate() - 1);
  const dataOntem = ontem.toISOString().split('T')[0];

  const hoje = new Date();
  const dataHoje = hoje.toISOString().split('T')[0];

  const consultaData = new URLSearchParams();
  consultaData.append('data_inicial', dataOntem);
  consultaData.append('data_final', dataHoje);
  consultaData.append('id_menu', '513');
  consultaData.append('acao', 'consultar');
  consultaData.append('buscar', '1');

  try {
    const resConsulta = await axiosInstance.post(
      '/manager/con_desvio_operador.php5',
      consultaData,
      {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
      }
    );

    if (resConsulta.status === 200 && resConsulta.data) {
      console.log('✅ Consulta realizada!');
      console.log('Tamanho resposta:', resConsulta.data.length, 'bytes');

      const htmlConsulta = resConsulta.data.toString();

      // Procurar por dados de operador
      if (htmlConsulta.includes('operador') || htmlConsulta.includes('OPERADOR')) {
        console.log('⭐ Resposta contém dados de operador!');
      }

      // Procurar por tabelas de resultado
      const tabelasResultado = htmlConsulta.match(/<tr[^>]*>[\s\S]*?<\/tr>/gi) || [];
      if (tabelasResultado.length > 0) {
        console.log(`📊 Linhas de tabela encontradas: ${tabelasResultado.length}`);
        console.log('\nPrimeiras 3 linhas:');
        tabelasResultado.slice(0, 3).forEach((tr, i) => {
          const texto = tr.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
          console.log(`  ${i + 1}. ${texto.substring(0, 100)}`);
        });
      }

      console.log('\nInício da resposta:');
      console.log(htmlConsulta.substring(0, 1500));

    } else {
      console.log('⚠️  Consulta não retornou dados esperados');
    }

  } catch (e) {
    console.log('⚠️  Tentativa de consulta falhou:', e.message);
  }

  console.log('\n✅ Análise concluída!\n');
}

acessarDesvioOperador();
