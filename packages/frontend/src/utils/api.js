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
  console.log('🌍 Hostname:', hostname);
  console.log('📍 URL completa:', fullUrl);

  // Se tiver variável de ambiente configurada, usar ela
  if (window.ENV?.VITE_API_URL || import.meta.env.VITE_API_URL) {
    console.log('🔧 Usando variável de ambiente');
    return window.ENV?.VITE_API_URL || import.meta.env.VITE_API_URL;
  }

  // Se acessando pelo ngrok (internet)
  // IMPORTANTE: Ngrok em dev mode não suporta proxy do Vite
  // Então vamos usar a URL do backend rodando na mesma máquina mas na porta 3001
  if (hostname.includes('.ngrok')) {
    console.log('✅ NGROK detectado');
    // Usar IP da rede local do backend
    const backendUrl = 'http://10.6.1.171:3001/api';
    console.log('🔗 Usando backend na rede local:', backendUrl);
    return backendUrl;
  }

  // Se acessando pelo domínio (Cloudflare), usar a API do Cloudflare
  if (hostname.includes('prevencaonoradar.com.br')) {
    console.log('☁️ Cloudflare detectado');
    return 'https://api.prevencaonoradar.com.br/api';
  }

  // Se acessando por IP da rede local
  if (hostname.startsWith('10.') || hostname.startsWith('192.168.')) {
    console.log('🏠 Rede local detectada');
    return `http://${hostname}:3001/api`;
  }

  // Padrão: localhost
  console.log('💻 Usando localhost');
  return 'http://localhost:3001/api';
}

// Interceptor para adicionar o token E a baseURL dinamicamente
api.interceptors.request.use(
  (config) => {
    // Detectar a baseURL dinamicamente em CADA requisição
    const baseURL = getApiBaseUrl();
    console.log('🔗 Base URL para esta requisição:', baseURL);

    // Se a URL da requisição não é absoluta, adicionar a baseURL
    if (!config.url.startsWith('http')) {
      config.baseURL = baseURL;
    }

    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
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