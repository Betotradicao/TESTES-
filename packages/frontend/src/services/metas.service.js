import api from '../utils/api';

export async function fetchMetas(codLoja = null, ano = null, mes = null) {
  const params = new URLSearchParams();
  if (codLoja !== null && codLoja !== undefined) params.append('cod_loja', codLoja);
  if (ano) params.append('ano', ano);
  if (mes) params.append('mes', mes);
  const queryString = params.toString();
  const url = queryString ? `/metas?${queryString}` : '/metas';
  const response = await api.get(url);
  return response.data;
}

export async function fetchMetaById(id) {
  const response = await api.get(`/metas/${id}`);
  return response.data;
}

export async function createMeta(data) {
  const response = await api.post('/metas', data);
  return response.data;
}

export async function updateMeta(id, data) {
  const response = await api.put(`/metas/${id}`, data);
  return response.data;
}

export async function deleteMeta(id) {
  const response = await api.delete(`/metas/${id}`);
  return response.data;
}

export async function toggleMeta(id) {
  const response = await api.patch(`/metas/${id}/toggle`);
  return response.data;
}
