import api from '../utils/api';

// Lista todos os DVRs (opcionalmente filtrado por loja)
export async function listDvrDevices(codigoLoja = null) {
  const params = codigoLoja != null ? `?codigo_loja=${codigoLoja}` : '';
  const response = await api.get(`/dvr-devices${params}`);
  return response.data;
}

export async function getDvrDevice(id) {
  const response = await api.get(`/dvr-devices/${id}`);
  return response.data;
}

export async function createDvrDevice(data) {
  const response = await api.post('/dvr-devices', data);
  return response.data;
}

export async function updateDvrDevice(id, data) {
  const response = await api.put(`/dvr-devices/${id}`, data);
  return response.data;
}

export async function deleteDvrDevice(id) {
  const response = await api.delete(`/dvr-devices/${id}`);
  return response.data;
}

export async function testDvrDevice(id) {
  const response = await api.post(`/dvr-devices/${id}/test`);
  return response.data;
}
