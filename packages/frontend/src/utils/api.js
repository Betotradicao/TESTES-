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
  console.log('🔍 Tipo do hostname:', typeof hostname);
  console.log('🔍 Hostname length:', hostname?.length);
  console.log('🚪 Porta atual:', currentPort);

  // Se tiver variável de ambiente configurada, usar ela
  if (window.ENV?.VITE_API_URL || import.meta.env.VITE_API_URL) {
    console.log('🔧 Usando variável de ambiente');
    return window.ENV?.VITE_API_URL || import.meta.env.VITE_API_URL;
  }

  // Se acessando pelo ngrok (internet)
  if (hostname.includes('.ngrok')) {
    console.log('✅ NGROK detectado');
    const backendUrl = 'http://10.6.1.171:3001/api';
    console.log('🔗 Usando backend na rede local:', backendUrl);
    return backendUrl;
  }

  // Se acessando pelo domínio (Cloudflare), usar a API do Cloudflare
  if (hostname.includes('prevencaonoradar.com.br')) {
    console.log('☁️ Cloudflare detectado');
    return 'https://api.prevencaonoradar.com.br/api';
  }

  // Se for localhost, usar localhost
  if (hostname === 'localhost' || hostname === '127.0.0.1') {
    console.log('💻 Localhost detectado - usando localhost:3001');
    return 'http://localhost:3001/api';
  }

  // QUALQUER OUTRO CASO: Usar o hostname atual com porta calculada
  console.log('🎯 Usando hostname atual:', hostname);
  // Se frontend está na 3003 (teste), backend está na 3002
  // Se frontend está na 3000 (prod), backend está na 3001
  const backendPort = currentPort === '3003' ? '3002' : '3001';
  const apiUrl = `http://${hostname}:${backendPort}/api`;
  console.log('✅ API URL:', apiUrl);
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

export default api;