import api from '../utils/api';

export async function listGroups() {
  const response = await api.get('/face-recognition/groups');
  return response.data;
}

export async function listPersons({ groupId, begin = 0, count = 20 } = {}) {
  const params = new URLSearchParams();
  if (groupId) params.append('groupId', groupId);
  params.append('begin', begin.toString());
  params.append('count', count.toString());
  const response = await api.get(`/face-recognition/persons?${params.toString()}`);
  return response.data;
}

export async function addPerson({ name, groupId, photoBase64, id, sex, age }) {
  const response = await api.post('/face-recognition/persons', {
    name, groupId, photoBase64, id, sex, age
  });
  return response.data;
}

export async function deletePerson(uid) {
  const response = await api.delete(`/face-recognition/persons/${uid}`);
  return response.data;
}

export async function searchEvents({ start, end, channel }) {
  const params = new URLSearchParams();
  if (start) params.append('start', start);
  if (end) params.append('end', end);
  if (channel !== undefined && channel !== '') params.append('channel', channel.toString());
  const response = await api.get(`/face-recognition/events?${params.toString()}`);
  return response.data;
}

export async function searchDetections({ start, end, channel, max } = {}) {
  const params = new URLSearchParams();
  if (start) params.append('start', start);
  if (end) params.append('end', end);
  if (channel !== undefined && channel !== '') params.append('channel', channel.toString());
  if (max) params.append('max', max.toString());
  const response = await api.get(`/face-recognition/detections?${params.toString()}`);
  return response.data;
}

export async function getSnapshotUrl(channel = 1) {
  return `/face-recognition/snapshot?channel=${channel}`;
}

export function getPersonPhotoUrl(photoUrl) {
  if (!photoUrl) return null;
  const token = localStorage.getItem('token');
  const baseUrl = api.defaults.baseURL || '';
  return `${baseUrl}/face-recognition/person-photo?url=${encodeURIComponent(photoUrl)}&token=${token}`;
}
