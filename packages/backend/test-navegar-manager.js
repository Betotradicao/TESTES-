const axios = require('axios');
const qs = require('querystring');

async function navegarManager() {
  const baseUrl = 'http://10.6.1.101';
  const username = 'beto';
  const password = 'beto3107';

  console.log('🌐 NAVEGANDO NO MANAGER ZANTHUS');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  // Criar um client que mantém cookies
  const axiosInstance = axios.create({
    baseURL: baseUrl,
    withCredentials: true,
    maxRedirects: 5,
    validateStatus: () => true,
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
    }
  });

  let cookies = {};

  // PASSO 1: Fazer login
  console.log('1️⃣ Fazendo login no Manager...\n');

  try {
    const loginData = new URLSearchParams();
    loginData.append('usuario', username);
    loginData.append('senha', password);
    loginData.append('acao', 'login');

    const loginRes = await axiosInstance.post('/manager/index.php5', loginData, {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      }
    });

    // Extrair cookies
    const setCookies = loginRes.headers['set-cookie'] || [];
    setCookies.forEach(cookie => {
      const [nameValue] = cookie.split(';');
      const [name, value] = nameValue.split('=');
      if (value && value !== 'deleted') {
        cookies[name] = value;
      }
    });

    const cookieString = Object.entries(cookies).map(([k, v]) => `${k}=${v}`).join('; ');

    console.log('Status:', loginRes.status);
    console.log('Cookies:', cookieString);

    if (Object.keys(cookies).length > 0) {
      console.log('✅ Login bem-sucedido!\n');
    } else {
      console.log('⚠️  Login pode ter falho (sem cookies)\n');
    }

    // Atualizar headers padrão com cookies
    axiosInstance.defaults.headers.common['Cookie'] = cookieString;

  } catch (e) {
    console.error('❌ Erro no login:', e.message);
    return;
  }

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  // PASSO 2: Tentar acessar menu/páginas comuns
  console.log('2️⃣ Explorando estrutura do Manager...\n');

  const paginas = [
    '/manager/menu.php5',
    '/manager/principal.php5',
    '/manager/home.php5',
    '/manager/main.php5',
    '/manager/desktop.php5',
  ];

  let paginaPrincipal = null;

  for (const pagina of paginas) {
    try {
      const res = await axiosInstance.get(pagina);

      if (res.status === 200 && res.data && res.data.length > 100) {
        console.log(`✅ ${pagina} - Acessível (${res.data.length} bytes)`);

        // Procurar por links de gerencial/estatísticas
        const html = res.data.toString();

        if (html.toLowerCase().includes('gerencial') ||
            html.toLowerCase().includes('estatistica') ||
            html.toLowerCase().includes('operador')) {
          console.log('   ⭐ Contém referências a gerencial/estatísticas!');
          paginaPrincipal = pagina;
        }
      }
    } catch (e) {
      // Silencioso
    }
  }

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  // PASSO 3: Buscar páginas de gerencial
  console.log('3️⃣ Buscando páginas de GERENCIAL...\n');

  const urlsGerencial = [
    '/manager/gerencial/menu.php5',
    '/manager/gerencial/index.php5',
    '/manager/gerencial/estatisticas.php5',
    '/manager/gerencial/operador.php5',
    '/manager/gerencial/indicadores_operador.php5',
    '/manager/gerencial/estatisticas_operador.php5',
    '/manager/relatorios/operador.php5',
    '/manager/relatorios/estatisticas.php5',
    '/manager/consultas/operador.php5',
  ];

  for (const url of urlsGerencial) {
    try {
      const res = await axiosInstance.get(url);

      if (res.status === 200 && res.data) {
        const html = res.data.toString();

        console.log(`\n✅ ${url} - ACESSÍVEL!`);
        console.log(`   Tamanho: ${html.length} bytes`);

        // Verificar se tem dados de operador
        if (html.includes('operador') || html.includes('OPERADOR')) {
          console.log('   ⭐ Contém dados de OPERADOR!');
        }

        // Procurar por tabelas ou dados estruturados
        if (html.includes('<table') || html.includes('TABLE')) {
          console.log('   📊 Contém TABELAS!');
        }

        // Procurar por formulários
        if (html.includes('<form') || html.includes('FORM')) {
          console.log('   📝 Contém FORMULÁRIOS!');

          // Extrair campos do formulário
          const inputs = html.match(/<input[^>]*name="([^"]*)"/gi) || [];
          if (inputs.length > 0) {
            console.log('   Campos encontrados:');
            inputs.slice(0, 5).forEach(input => {
              const match = input.match(/name="([^"]*)"/);
              if (match) console.log(`     - ${match[1]}`);
            });
          }
        }

        // Procurar por APIs/endpoints
        if (html.includes('restful') || html.includes('api')) {
          console.log('   🔗 Contém referências a API!');
          const matches = html.match(/(restful|api)[^\s<>"']*/gi) || [];
          matches.slice(0, 3).forEach(m => console.log(`     ${m}`));
        }

        // Salvar snippet do HTML
        console.log('\n   📄 Snippet do HTML:');
        console.log('   ' + html.substring(0, 500).replace(/\n/g, '\n   '));
        console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      }
    } catch (e) {
      // Silencioso para páginas que não existem
    }
  }

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  // PASSO 4: Tentar acessar via estrutura de menu
  console.log('4️⃣ Tentando descobrir estrutura de menu...\n');

  const possiveisMenus = [
    '/manager/frame.php5',
    '/manager/frameset.php5',
    '/manager/menu_lateral.php5',
    '/manager/menu_superior.php5',
    '/manager/navegacao.php5',
  ];

  for (const url of possiveisMenus) {
    try {
      const res = await axiosInstance.get(url);

      if (res.status === 200 && res.data) {
        const html = res.data.toString();

        console.log(`✅ ${url} - Acessível`);

        // Procurar por links
        const links = html.match(/href="([^"]*gerencial[^"]*)"/gi) || [];
        const linksOperador = html.match(/href="([^"]*operador[^"]*)"/gi) || [];
        const linksEstatistica = html.match(/href="([^"]*estatistica[^"]*)"/gi) || [];

        if (links.length > 0) {
          console.log('   Links de gerencial encontrados:');
          links.forEach(link => console.log(`     ${link}`));
        }

        if (linksOperador.length > 0) {
          console.log('   Links de operador encontrados:');
          linksOperador.forEach(link => console.log(`     ${link}`));
        }

        if (linksEstatistica.length > 0) {
          console.log('   Links de estatísticas encontrados:');
          linksEstatistica.forEach(link => console.log(`     ${link}`));
        }
      }
    } catch (e) {
      // Silencioso
    }
  }

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  // PASSO 5: Tentar fazer busca no site
  console.log('5️⃣ Tentando buscar por "indicadores operador"...\n');

  const buscas = [
    '/manager/busca.php5?q=indicadores+operador',
    '/manager/search.php5?q=operador',
    '/manager/pesquisa.php5?termo=estatisticas',
  ];

  for (const url of buscas) {
    try {
      const res = await axiosInstance.get(url);
      if (res.status === 200 && res.data && res.data.length > 100) {
        console.log(`✅ ${url} - Respondeu`);
        const html = res.data.toString().substring(0, 500);
        console.log(html);
      }
    } catch (e) {
      // Silencioso
    }
  }

  console.log('\n✅ Navegação concluída!\n');
}

navegarManager();
