import api from '../utils/api';

export async function fetchEquipments() {
  const response = await api.get('/equipments');
  return response.data;
}

export async function fetchEquipmentById(id) {
  const response = await api.get(`/equipments/${id}`);
  return response.data;
}

export async function updateEquipment(id, data) {
  const response = await api.put(`/equipments/${id}`, data);
  return response.data;
}

export async function toggleEquipmentStatus(id) {
  const response = await api.patch(`/equipments/${id}/toggle`);
  return response.data;
}
