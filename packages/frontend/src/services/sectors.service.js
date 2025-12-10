import api from '../utils/api';

export async function fetchSectors(onlyActive = false) {
  const url = onlyActive ? '/sectors?active=true' : '/sectors';
  const response = await api.get(url);
  return response.data;
}

export async function fetchSectorById(id) {
  const response = await api.get(`/sectors/${id}`);
  return response.data;
}

export async function createSector(data) {
  const response = await api.post('/sectors', data);
  return response.data;
}

export async function updateSector(id, data) {
  const response = await api.put(`/sectors/${id}`, data);
  return response.data;
}

export async function toggleSectorStatus(id) {
  const response = await api.patch(`/sectors/${id}/toggle`);
  return response.data;
}
