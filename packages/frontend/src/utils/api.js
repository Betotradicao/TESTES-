import axios from 'axios';

// Criar instância do axios SEM baseURL fixo
export const api = axios.create({
  headers: {
    'Content-Type': 'application/json',
  },
});

// Detectar URL da API DINAMICAMENTE em cada requisição
function getApiBaseUrl() {
  const hostname = window.location.hostname;
  const fullUrl = window.location.href;
  const currentPort = window.location.port;

  console.log('🌍 Hostname:', hostname);
  console.log('📍 URL completa:', fullUrl);
  console.log('🚪 Porta atual:', currentPort);

  // PRIORIDADE 1: Se tiver variável de ambiente configurada (produção/multi-tenant), usar ela
  const envApiUrl = import.meta.env.VITE_API_URL;
  if (envApiUrl && envApiUrl !== '' && !envApiUrl.includes('localhost')) {
    console.log('🔧 Usando VITE_API_URL:', envApiUrl);
    return envApiUrl;
  }

  // PRIORIDADE 2: Se acessando pelo domínio prevencaonoradar (subdomínio multi-tenant)
  if (hostname.includes('prevencaonoradar.com.br')) {
    // Extrair subdomínio (ex: nunes.prevencaonoradar.com.br -> nunes)
    const subdomain = hostname.split('.')[0];
    console.log('☁️ Subdomínio detectado:', subdomain);
    return `https://${hostname}/api`;
  }

  // PRIORIDADE 3: Se acessando via IP direto (ex: 31.97.82.235:3002)
  // Calcular porta do backend como frontend_port + 998 (3002 -> 4000, 3003 -> 4001, etc)
  if (hostname.match(/^\d+\.\d+\.\d+\.\d+$/)) {
    const frontendPort = parseInt(currentPort) || 3000;
    // Multi-tenant: frontend 3002 -> backend 4000, frontend 3003 -> backend 4001
    // Single-tenant: frontend 3000 -> backend 3001
    let backendPort;
    if (frontendPort >= 3002 && frontendPort < 4000) {
      // Multi-tenant: porta base do backend é 4000 + (frontend - 3002)
      backendPort = 4000 + (frontendPort - 3002);
    } else {
      // Single-tenant ou padrão
      backendPort = frontendPort + 1;
    }
    const apiUrl = `http://${hostname}:${backendPort}/api`;
    console.log('🎯 IP detectado - API URL:', apiUrl);
    return apiUrl;
  }

  // PRIORIDADE 4: ngrok (desenvolvimento remoto)
  if (hostname.includes('.ngrok')) {
    console.log('✅ NGROK detectado');
    return 'http://10.6.1.171:3001/api';
  }

  // PRIORIDADE 5: localhost (desenvolvimento local)
  if (hostname === 'localhost' || hostname === '127.0.0.1') {
    console.log('💻 Localhost detectado');
    return 'http://localhost:3001/api';
  }

  // Fallback: usar hostname atual com porta 3001
  const apiUrl = `http://${hostname}:3001/api`;
  console.log('🔄 Fallback API URL:', apiUrl);
  return apiUrl;
}

// Interceptor para adicionar o token E a baseURL dinamicamente
api.interceptors.request.use(
  (config) => {
    // LOG ESPECIAL PARA UPLOADS
    if (config.url && config.url.includes('upload')) {
      const user = JSON.parse(localStorage.getItem('user') || '{}');
      console.log('🚀 INTERCEPTOR REQUEST - UPLOAD detectado!', {
        url: config.url,
        method: config.method,
        user: user.email,
        role: user.role,
        isMaster: user.isMaster
      });
    }

    // Detectar a baseURL dinamicamente em CADA requisição
    const baseURL = getApiBaseUrl();
    console.log('🔗 Base URL para esta requisição:', baseURL);
    console.log('🔗 URL da requisição:', config.url);

    // Se a URL da requisição não é absoluta, adicionar a baseURL
    if (!config.url.startsWith('http')) {
      // Se a baseURL termina com /api e a URL começa com /api, remover o /api da URL
      if (baseURL.endsWith('/api') && config.url.startsWith('/api')) {
        config.url = config.url.substring(4); // Remove '/api' do início
        console.log('🔧 URL ajustada (removido /api duplicado):', config.url);
      }
      config.baseURL = baseURL;
    }

    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    // LOG FINAL ANTES DE ENVIAR
    if (config.url && config.url.includes('upload')) {
      console.log('✅ INTERCEPTOR - Enviando requisição de upload para:', config.baseURL + config.url);
    }

    return config;
  },
  (error) => {
    console.log('❌ INTERCEPTOR REQUEST ERROR:', error);
    return Promise.reject(error);
  }
);

// Interceptor para lidar com respostas de erro
api.interceptors.response.use(
  (response) => response,
  (error) => {
    const errorMessage = error.response?.data?.error || '';

    // Erro 401: Token inválido ou expirado - redirecionar para login
    if (error.response?.status === 401) {
      if (errorMessage.includes('token') || errorMessage.includes('Token') ||
          errorMessage.includes('expired') || errorMessage.includes('invalid')) {
        // Limpar dados locais
        localStorage.removeItem('token');
        localStorage.removeItem('user');

        // Redirecionar para login
        window.location.href = '/login';
      }
    }

    // Erro 403: Acesso negado ou token expirado
    if (error.response?.status === 403) {
      // Se for erro de token inválido/expirado, fazer logout
      if (errorMessage.includes('token') || errorMessage.includes('Token') ||
          errorMessage.includes('expired') || errorMessage.includes('invalid')) {
        // Limpar dados locais
        localStorage.removeItem('token');
        localStorage.removeItem('user');

        // Redirecionar para login
        window.location.href = '/login';
      }
      // Se for erro de permissão de admin, redirecionar para dashboard
      else if (errorMessage.includes('Admin access required')) {
        // Redirecionar para dashboard sem fazer logout
        window.location.href = '/dashboard';
      }
    }

    return Promise.reject(error);
  }
);

// Exportar a função para uso em URLs diretas (ex: abrir PDF em nova aba)
export { getApiBaseUrl };

export default api;