const axios = require('axios');
const tough = require('tough-cookie');
const { wrapper } = require('axios-cookiejar-support');

async function manterSessao() {
  const baseUrl = 'http://10.6.1.101';
  const username = 'beto';
  const password = 'beto3107';

  console.log('🔐 MANTENDO SESSÃO NO MANAGER');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  // Criar cookie jar para manter cookies entre requisições
  const cookieJar = new tough.CookieJar();
  const client = wrapper(axios.create({
    baseURL: baseUrl,
    jar: cookieJar,
    withCredentials: true,
    maxRedirects: 0, // Não seguir redirects automaticamente
    validateStatus: () => true,
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml',
      'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7',
      'Connection': 'keep-alive'
    }
  }));

  // PASSO 1: Acessar página inicial para pegar cookies iniciais
  console.log('1️⃣ Acessando página inicial...\n');

  try {
    const inicialRes = await client.get('/manager/');
    console.log('Status:', inicialRes.status);

    const cookies = await cookieJar.getCookies(baseUrl);
    console.log('Cookies após acessar inicial:');
    cookies.forEach(c => console.log(`  ${c.key}=${c.value}`));

  } catch (e) {
    console.log('Erro:', e.message);
  }

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  // PASSO 2: Fazer login
  console.log('2️⃣ Fazendo login...\n');

  const loginData = new URLSearchParams();
  loginData.append('usuario', username);
  loginData.append('senha', password);

  try {
    const loginRes = await client.post('/manager/index.php5', loginData.toString(), {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Referer': `${baseUrl}/manager/`
      }
    });

    console.log('Login Status:', loginRes.status);
    console.log('Login Headers:', loginRes.headers);

    const cookies = await cookieJar.getCookies(baseUrl);
    console.log('\nCookies após login:');
    cookies.forEach(c => console.log(`  ${c.key}=${c.value}`));

    // Se tiver redirect, seguir
    if (loginRes.status === 302 || loginRes.status === 301) {
      const location = loginRes.headers.location;
      console.log('\nRedirect para:', location);

      if (location) {
        const redirectRes = await client.get(location);
        console.log('Redirect Status:', redirectRes.status);
      }
    }

  } catch (e) {
    console.log('Erro no login:', e.message);
  }

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  // PASSO 3: Verificar se está logado
  console.log('3️⃣ Verificando se sessão está ativa...\n');

  try {
    const checkRes = await client.get('/manager/menu.php5');
    console.log('Status:', checkRes.status);
    console.log('Tamanho:', checkRes.data?.length || 0, 'bytes');

    const html = checkRes.data?.toString() || '';

    if (html.includes('LOGOFF') && html.length < 200) {
      console.log('❌ Sessão NÃO está ativa (sendo redirecionado para login)');
    } else if (html.length > 200) {
      console.log('✅ Sessão ATIVA!');
      console.log('Página contém menu do sistema');
    }

  } catch (e) {
    console.log('Erro:', e.message);
  }

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  // PASSO 4: Acessar página de desvio operador
  console.log('4️⃣ Acessando con_desvio_operador.php5...\n');

  try {
    const pageRes = await client.get('/manager/con_desvio_operador.php5?id_menu=513', {
      headers: {
        'Referer': `${baseUrl}/manager/menu.php5`
      }
    });

    console.log('Status:', pageRes.status);
    console.log('Tamanho:', pageRes.data?.length || 0, 'bytes');

    const html = pageRes.data?.toString() || '';

    if (html.includes('LOGOFF') && html.length < 200) {
      console.log('❌ Ainda sendo redirecionado para login');
    } else {
      console.log('✅ Página acessada!');

      console.log('\n📊 Conteúdo da página:');
      console.log(html.substring(0, 3000));
    }

  } catch (e) {
    console.log('Erro:', e.message);
  }

  console.log('\n✅ Teste concluído!\n');
}

// Verificar se tough-cookie está disponível
try {
  require.resolve('tough-cookie');
  require.resolve('axios-cookiejar-support');
  manterSessao();
} catch (e) {
  console.log('❌ Bibliotecas não disponíveis, instalando...');
  console.log('Execute: npm install tough-cookie axios-cookiejar-support');
  console.log('\nTentando abordagem alternativa sem bibliotecas externas...\n');

  // Abordagem alternativa manual
  async function manterSessaoManual() {
    const baseUrl = 'http://10.6.1.101';
    const username = 'beto';
    const password = 'beto3107';

    console.log('🔐 MANTENDO SESSÃO (modo manual)');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    let allCookies = {};

    const updateCookies = (headers) => {
      const setCookies = headers['set-cookie'] || [];
      setCookies.forEach(cookie => {
        const [nameValue] = cookie.split(';');
        const [name, value] = nameValue.split('=');
        if (value && value !== 'deleted') {
          allCookies[name] = value;
        } else if (value === 'deleted') {
          delete allCookies[name];
        }
      });
    };

    const getCookieString = () => {
      return Object.entries(allCookies).map(([k, v]) => `${k}=${v}`).join('; ');
    };

    // Acessar inicial
    console.log('1️⃣ Acessando inicial...\n');
    let res = await axios.get(`${baseUrl}/manager/`, {
      maxRedirects: 0,
      validateStatus: () => true
    });
    updateCookies(res.headers);
    console.log('Cookies:', getCookieString());

    // Login
    console.log('\n2️⃣ Login...\n');
    const loginData = new URLSearchParams();
    loginData.append('usuario', username);
    loginData.append('senha', password);

    res = await axios.post(`${baseUrl}/manager/index.php5`, loginData.toString(), {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Cookie': getCookieString()
      },
      maxRedirects: 0,
      validateStatus: () => true
    });
    updateCookies(res.headers);
    console.log('Status:', res.status);
    console.log('Cookies:', getCookieString());

    // Acessar página
    console.log('\n3️⃣ Acessando página desvio operador...\n');
    res = await axios.get(`${baseUrl}/manager/con_desvio_operador.php5?id_menu=513`, {
      headers: {
        'Cookie': getCookieString()
      },
      maxRedirects: 0,
      validateStatus: () => true
    });

    console.log('Status:', res.status);
    console.log('Tamanho:', res.data?.length || 0);

    if (res.data && res.data.length > 200) {
      console.log('\n✅ Página acessada com sucesso!');
      console.log('\nConteúdo:');
      console.log(res.data.substring(0, 2000));
    } else {
      console.log('\n❌ Página não acessível ou redirect');
      console.log('Resposta:', res.data);
    }
  }

  manterSessaoManual();
}
