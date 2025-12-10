import axios from 'axios';

// Usar config runtime se disponível, senão fallback para variável de build
const API_BASE_URL = window.ENV?.VITE_API_URL || import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

export const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Interceptor para adicionar o token automaticamente
api.interceptors.request.use(
  (config) => {
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