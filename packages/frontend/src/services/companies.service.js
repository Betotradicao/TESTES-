import api from '../utils/api';

export const fetchMyCompany = async () => {
  const response = await api.get('/companies/my-company');
  return response.data;
};

export const updateMyCompany = async (companyData) => {
  const response = await api.put('/companies/my-company', companyData);
  return response.data;
};

export const fetchAllCompanies = async () => {
  const response = await api.get('/companies');
  return response.data;
};

export const createCompany = async (companyData) => {
  const response = await api.post('/companies', companyData);
  return response.data;
};

export const updateCompany = async (id, companyData) => {
  const response = await api.put(`/companies/${id}`, companyData);
  return response.data;
};

export const deleteCompany = async (id) => {
  const response = await api.delete(`/companies/${id}`);
  return response.data;
};

// Listar lojas para dropdown (empresas com cod_loja definido)
export const fetchStores = async () => {
  const response = await api.get('/companies/stores/list');
  return response.data;
};
