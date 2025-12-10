import { api } from '../utils/api';

export const fetchProfile = async () => {
  const response = await api.get('/employees/me/profile');
  return response.data;
};

export const updateProfile = async (name) => {
  const response = await api.patch('/employees/me/profile', { name });
  return response.data;
};

export const uploadProfileAvatar = async (file) => {
  const formData = new FormData();
  formData.append('avatar', file);

  const response = await api.patch('/employees/me/avatar', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  });
  return response.data;
};

export const changePassword = async (currentPassword, newPassword) => {
  const response = await api.patch('/employees/me/password', {
    currentPassword,
    newPassword,
  });
  return response.data;
};
