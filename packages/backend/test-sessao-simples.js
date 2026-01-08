const axios = require('axios');

async function manterSessaoSimples() {
  const baseUrl = 'http://10.6.1.101';
  const username = 'beto';
  const password = 'beto3107';

  console.log('🔐 MANTENDO SESSÃO NO MANAGER (versão simples)');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  let allCookies = {};

  const updateCookies = (headers) => {
    const setCookies = headers['set-cookie'] || [];
    setCookies.forEach(cookie => {
      const parts = cookie.split(';');
      const [nameValue] = parts;
      const [name, value] = nameValue.split('=');

      if (value && value !== 'deleted' && name) {
        allCookies[name.trim()] = value.trim();
      } else if (value === 'deleted' && name) {
        delete allCookies[name.trim()];
      }
    });
  };

  const getCookieString = () => {
    return Object.entries(allCookies)
      .map(([k, v]) => `${k}=${v}`)
      .join('; ');
  };

  // PASSO 1: Acessar página inicial
  console.log('1️⃣ Acessando página inicial para pegar cookies...\n');

  try {
    const res = await axios.get(`${baseUrl}/manager/`, {
      maxRedirects: 5,
      validateStatus: () => true
    });

    updateCookies(res.headers);
    console.log('Status:', res.status);
    console.log('Cookies obtidos:', Object.keys(allCookies).join(', ') || 'nenhum');
    console.log('Cookie string:', getCookieString());

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
    const res = await axios.post(`${baseUrl}/manager/index.php5`, loginData.toString(), {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Cookie': getCookieString(),
        'Referer': `${baseUrl}/manager/`,
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      },
      maxRedirects: 5,
      validateStatus: () => true
    });

    updateCookies(res.headers);
    console.log('Status:', res.status);
    console.log('Cookies após login:', Object.keys(allCookies).join(', '));
    console.log('Cookie string:', getCookieString());

    // Verificar se o HTML indica sucesso
    const html = res.data?.toString() || '';
    if (html.includes('LOGOFF') && html.length < 300) {
      console.log('⚠️  Possível falha no login (redirect para logout)');
    } else if (html.length > 300) {
      console.log('✅ Login parece ter funcionado (página com conteúdo)');
    }

  } catch (e) {
    console.log('Erro:', e.message);
  }

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  // PASSO 3: Acessar página desvio operador
  console.log('3️⃣ Acessando con_desvio_operador.php5...\n');

  try {
    const res = await axios.get(`${baseUrl}/manager/con_desvio_operador.php5?id_menu=513`, {
      headers: {
        'Cookie': getCookieString(),
        'Referer': `${baseUrl}/manager/menu.php5`,
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml'
      },
      maxRedirects: 0, // Não seguir redirects
      validateStatus: () => true
    });

    updateCookies(res.headers);
    console.log('Status:', res.status);
    console.log('Content-Type:', res.headers['content-type']);
    console.log('Tamanho:', res.data?.length || 0, 'bytes');

    const html = res.data?.toString() || '';

    if (res.status === 302 || res.status === 301) {
      console.log('⚠️  Redirect para:', res.headers.location);
      console.log('Provavelmente sessão expirou ou não autenticou');
    } else if (html.includes('LOGOFF') && html.length < 300) {
      console.log('❌ Sendo redirecionado para login (sessão inválida)');
      console.log('Resposta:', html);
    } else if (html.length > 300) {
      console.log('✅ Página acessada com sucesso!');

      // Análise da página
      const temTabela = html.includes('<table') || html.includes('TABLE');
      const temForm = html.includes('<form') || html.includes('FORM');
      const temOperador = html.toLowerCase().includes('operador');

      console.log('\n📊 Análise:');
      console.log(`  Tem tabelas: ${temTabela ? 'Sim' : 'Não'}`);
      console.log(`  Tem formulários: ${temForm ? 'Sim' : 'Não'}`);
      console.log(`  Menciona operador: ${temOperador ? 'Sim' : 'Não'}`);

      console.log('\n📄 Primeiros 3000 caracteres:');
      console.log('━'.repeat(60));
      console.log(html.substring(0, 3000));
      console.log('━'.repeat(60));

      if (html.length > 3000) {
        console.log('\n📄 Últimos 1000 caracteres:');
        console.log('━'.repeat(60));
        console.log(html.substring(html.length - 1000));
        console.log('━'.repeat(60));
      }
    } else {
      console.log('❓ Resposta curta, pode ser erro ou redirect');
      console.log('Resposta completa:');
      console.log(html);
    }

  } catch (e) {
    console.log('Erro:', e.message);
    if (e.response) {
      console.log('Status:', e.response.status);
      console.log('Data:', e.response.data);
    }
  }

  console.log('\n✅ Teste concluído!\n');
}

manterSessaoSimples();
