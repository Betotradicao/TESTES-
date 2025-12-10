import { api } from '../utils/api';

const equipmentSessionsService = {
  /**
   * Get all active sessions (all equipment with logged employees)
   */
  async getAllActiveSessions() {
    const response = await api.get('/equipment-sessions/active');
    return response.data;
  },

  /**
   * Get active session for a specific equipment
   * @param {number} equipmentId
   */
  async getActiveSession(equipmentId) {
    const response = await api.get(`/equipment-sessions/equipment/${equipmentId}`);
    return response.data;
  },

  /**
   * Get session history for an equipment
   * @param {number} equipmentId
   * @param {Object} filters - Optional filters (employeeId, startDate, endDate, page, limit)
   */
  async getSessionHistory(equipmentId, filters = {}) {
    const params = new URLSearchParams();

    if (filters.employeeId) params.append('employeeId', filters.employeeId);
    if (filters.startDate) params.append('startDate', filters.startDate);
    if (filters.endDate) params.append('endDate', filters.endDate);
    if (filters.page) params.append('page', filters.page);
    if (filters.limit) params.append('limit', filters.limit);

    const response = await api.get(`/equipment-sessions/equipment/${equipmentId}/history?${params.toString()}`);
    return response.data;
  },

  /**
   * Manually login employee to equipment
   * @param {number} equipmentId
   * @param {string} employeeId
   */
  async loginEmployee(equipmentId, employeeId) {
    const response = await api.post('/equipment-sessions/login', {
      equipmentId,
      employeeId,
    });
    return response.data;
  },

  /**
   * Manually logout employee from equipment
   * @param {number} equipmentId
   */
  async logoutEmployee(equipmentId) {
    const response = await api.post(`/equipment-sessions/logout/${equipmentId}`);
    return response.data;
  },
};

export default equipmentSessionsService;
