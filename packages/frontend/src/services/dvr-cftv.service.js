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
    // Acompanha o timeout do backend: H.265 5MP transcodifica a ~0.7x, entao a espera
    // cresce com a duracao do clipe (126s de video => ~187s de conversao).
    timeout: Math.max(300000, (Number(duration) || 90) * 3000),
  });
  return response.data; // { filename }
}

// Buscar cupom/nota do Oracle (por número do cupom ou timestamp DVR)
export async function getCupom(channel, time, cupomNum, pdv) {
  const params = { channel, time };
  if (cupomNum) params.cupomNum = cupomNum;
  if (pdv !== undefined && pdv !== null) params.pdv = pdv;
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

// Buscar câmeras configuradas para Prev. Risco (por PDV)
export async function getCamerasRisco(codigoLoja = null) {
  const params = codigoLoja != null ? { codigo_loja: codigoLoja } : {};
  const response = await api.get('/dvr-cftv/config/cameras-risco', { params });
  return response.data; // { success, cameras: [{channel, label, pdv, antes, depois}] }
}

// Retorna URL de streaming direto do DVR (RTSP → MP4 em tempo real)
// antes/depois: override per-camera (opcional, usado por Bipagens)
export function getLiveStreamUrl(channel, time, antes, depois) {
  const baseUrl = getApiBaseUrl();
  const token = localStorage.getItem('token');
  const params = new URLSearchParams({ channel: String(channel), time, token });
  if (antes !== undefined) params.append('antes', String(antes));
  if (depois !== undefined) params.append('depois', String(depois));
  return `${baseUrl}/dvr-cftv/pos/live-stream?${params.toString()}`;
}
