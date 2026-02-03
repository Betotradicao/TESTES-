import api from '../utils/api';

export async function fetchEmployees(page = 1, limit = 10, onlyActive = false, codLoja = null) {
  const params = new URLSearchParams({
    page: page.toString(),
    limit: limit.toString(),
  });

  if (onlyActive) {
    params.append('active', 'true');
  }

  if (codLoja) {
    params.append('codLoja', codLoja.toString());
  }

  const response = await api.get(`/employees?${params.toString()}`);
  return response.data;
}

export async function fetchEmployeeById(id) {
  const response = await api.get(`/employees/${id}`);
  return response.data;
}

export async function createEmployee(data) {
  const response = await api.post('/employees', data);
  return response.data;
}

export async function updateEmployee(id, data) {
  const response = await api.put(`/employees/${id}`, data);
  return response.data;
}

export async function uploadEmployeeAvatar(id, file) {
  const formData = new FormData();
  formData.append('avatar', file);

  const response = await api.patch(`/employees/${id}/avatar`, formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  });

  return response.data;
}

export async function toggleEmployeeStatus(id) {
  const response = await api.patch(`/employees/${id}/toggle`);
  return response.data;
}

export async function resetEmployeePassword(id, newPassword) {
  const response = await api.post(`/employees/${id}/reset-password`, {
    newPassword,
  });
  return response.data;
}

export async function deleteEmployee(id) {
  const response = await api.delete(`/employees/${id}`);
  return response.data;
}
