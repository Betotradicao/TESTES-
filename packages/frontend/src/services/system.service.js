import api from '../utils/api';

/**
 * Serviço para gerenciar configurações do sistema
 */
class SystemService {
  /**
   * Obter o token atual
   */
  async getToken() {
    try {
      const response = await api.get('/system/token');
      return response.data;
    } catch (error) {
      console.error('Erro ao buscar token:', error);
      throw error;
    }
  }

  /**
   * Gerar novo token automaticamente
   */
  async generateToken() {
    try {
      const response = await api.post('/system/token/generate');
      return response.data;
    } catch (error) {
      console.error('Erro ao gerar token:', error);
      throw error;
    }
  }

  /**
   * Atualizar token com valor específico
   */
  async updateToken(token) {
    try {
      const response = await api.put('/system/token', { token });
      return response.data;
    } catch (error) {
      console.error('Erro ao atualizar token:', error);
      throw error;
    }
  }
}

export default new SystemService();
