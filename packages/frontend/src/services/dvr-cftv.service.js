import api, { getApiBaseUrl } from '../utils/api';

// Buscar canais configurados no backend
export async function getCanaisConfig() {
  const response = await api.get('/dvr-cftv/config/canais');
  return response.data; // { success, canais: [{channel, pdv, label}], canalPadrao }
}

export async function searchPOS({ text, channel = 3, start, end }) {
  const params = new URLSearchParams();
  if (text) params.append('text', text);
  params.append('channel', channel);
  if (start) params.append('start', start);
  if (end) params.append('end', end);
  const response = await api.get(`/dvr-cftv/pos/search?${params.toString()}`);
  return response.data;
}

// Gera o clip no backend (aguarda ffmpeg) e retorna o filename
export async function generateClip(channel, time, duration) {
  const response = await api.get('/dvr-cftv/pos/generate-clip', {
    params: { channel, time, duration },
    timeout: 120000, // 2 min timeout para ffmpeg
  });
  return response.data; // { filename }
}

// Buscar cupom/nota do Oracle (por número do cupom ou timestamp DVR)
export async function getCupom(channel, time, cupomNum) {
  const params = { channel, time };
  if (cupomNum) params.cupomNum = cupomNum;
  const response = await api.get('/dvr-cftv/pos/cupom', { params });
  return response.data;
}

// Retorna URL para servir o clip já gerado
export function getClipStreamUrl(filename) {
  const baseUrl = getApiBaseUrl();
  const token = localStorage.getItem('token');
  return `${baseUrl}/dvr-cftv/pos/stream/${filename}?token=${token}`;
}

// Buscar câmeras configuradas para bipagens (açougue)
export async function getCamerasBipagens() {
  const response = await api.get('/dvr-cftv/config/cameras-bipagens');
  return response.data; // { success, cameras: [{channel, label}] }
}

// Salvar câmeras de bipagens
export async function saveCamerasBipagens(cameras) {
  const response = await api.post('/dvr-cftv/config/cameras-bipagens', { cameras });
  return response.data;
}

// Retorna URL de streaming direto do DVR (RTSP → MP4 em tempo real)
export function getLiveStreamUrl(channel, time) {
  const baseUrl = getApiBaseUrl();
  const token = localStorage.getItem('token');
  const params = new URLSearchParams({ channel: String(channel), time, token });
  return `${baseUrl}/dvr-cftv/pos/live-stream?${params.toString()}`;
}
