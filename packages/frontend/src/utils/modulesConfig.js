// Persistencia de modulos habilitados/desabilitados.
// Antes: localStorage por dispositivo (bug — celular nao via mesma config do desktop).
// Agora: tabela `configurations` no banco (key=modules_config, modules_visibility_mode).
// localStorage continua como cache pra render imediato e fallback offline.

import api from '../services/api';

const KEY_CONFIG = 'modules_config';
const KEY_MODE = 'modules_visibility_mode';

let _memoryCache = null; // { config: [...], mode: 'disabled'|'hidden' }
let _loadPromise = null;

/** Le do backend. Se vazio, faz migracao do localStorage uma vez. */
export async function loadModulesConfig({ force = false } = {}) {
  if (_memoryCache && !force) return _memoryCache;
  if (_loadPromise && !force) return _loadPromise;

  _loadPromise = (async () => {
    let config = null;
    let mode = 'disabled';

    // 1. Tenta backend
    try {
      const [rConfig, rMode] = await Promise.all([
        api.get(`/configurations/${KEY_CONFIG}`).catch(e => e?.response?.status === 404 ? null : Promise.reject(e)),
        api.get(`/configurations/${KEY_MODE}`).catch(e => e?.response?.status === 404 ? null : Promise.reject(e)),
      ]);
      if (rConfig?.data?.value) {
        try { config = JSON.parse(rConfig.data.value); } catch {}
      }
      if (rMode?.data?.value === 'disabled' || rMode?.data?.value === 'hidden') {
        mode = rMode.data.value;
      }
    } catch (err) {
      console.warn('[modulesConfig] backend offline, usando localStorage', err?.message);
    }

    // 2. Migracao: se backend vazio mas localStorage tem dados, sobe pro backend
    if (!Array.isArray(config) || config.length === 0) {
      const lsRaw = localStorage.getItem(KEY_CONFIG);
      if (lsRaw) {
        try {
          const lsConfig = JSON.parse(lsRaw);
          if (Array.isArray(lsConfig) && lsConfig.length > 0) {
            config = lsConfig;
            // dispara migracao em background
            api.put(`/configurations/${KEY_CONFIG}`, { value: lsRaw }).catch(() => {});
          }
        } catch {}
      }
      const lsMode = localStorage.getItem(KEY_MODE);
      if ((lsMode === 'disabled' || lsMode === 'hidden') && mode === 'disabled') {
        mode = lsMode;
        api.put(`/configurations/${KEY_MODE}`, { value: lsMode }).catch(() => {});
      }
    }

    // 3. Cache em localStorage pra render imediato no proximo refresh
    if (Array.isArray(config) && config.length > 0) {
      try { localStorage.setItem(KEY_CONFIG, JSON.stringify(config)); } catch {}
    }
    try { localStorage.setItem(KEY_MODE, mode); } catch {}

    _memoryCache = { config: Array.isArray(config) ? config : [], mode };
    return _memoryCache;
  })();

  try { return await _loadPromise; }
  finally { _loadPromise = null; }
}

/** Le sincronamente do localStorage (cache). Pra primeiro render rapido. */
export function readCachedModulesConfig() {
  if (_memoryCache) return _memoryCache;
  let config = [];
  let mode = 'disabled';
  try {
    const raw = localStorage.getItem(KEY_CONFIG);
    if (raw) config = JSON.parse(raw);
  } catch {}
  const m = localStorage.getItem(KEY_MODE);
  if (m === 'disabled' || m === 'hidden') mode = m;
  return { config: Array.isArray(config) ? config : [], mode };
}

/** Salva no backend + atualiza cache + dispara evento pros listeners. */
export async function saveModulesConfig(config, mode) {
  const value = JSON.stringify(config || []);
  _memoryCache = { config: config || [], mode: mode || 'disabled' };
  try { localStorage.setItem(KEY_CONFIG, value); } catch {}
  try { localStorage.setItem(KEY_MODE, mode || 'disabled'); } catch {}

  // Notifica componentes (Sidebar) que estao escutando
  try { window.dispatchEvent(new Event('modulesConfigChanged')); } catch {}

  // Persiste no backend (se falhar, pelo menos localStorage tem)
  await Promise.all([
    api.put(`/configurations/${KEY_CONFIG}`, { value }).catch(err => {
      console.warn('[modulesConfig] erro ao salvar config no backend', err?.message);
    }),
    api.put(`/configurations/${KEY_MODE}`, { value: mode || 'disabled' }).catch(err => {
      console.warn('[modulesConfig] erro ao salvar mode no backend', err?.message);
    }),
  ]);
}

/** Reseta cache (pra forcar reload do backend, ex: apos login) */
export function resetModulesCache() {
  _memoryCache = null;
  _loadPromise = null;
}
