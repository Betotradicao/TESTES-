import { useState, useEffect } from 'react';
import { api } from '../../utils/api';

export default function DisparoWhatsTab() {
  const [config, setConfig] = useState({
    disparo_whats_url: '',
    disparo_whats_token: '',
    disparo_whats_instancia: ''
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState(null);

  useEffect(() => {
    loadConfig();
  }, []);

  const loadConfig = async () => {
    try {
      const res = await api.get('/config/configurations');
      const configs = res.data || [];
      const getValue = (key) => {
        const item = configs.find(c => c.key === key);
        return item ? item.value : '';
      };
      setConfig({
        disparo_whats_url: getValue('disparo_whats_url'),
        disparo_whats_token: getValue('disparo_whats_token'),
        disparo_whats_instancia: getValue('disparo_whats_instancia')
      });
    } catch (err) {
      console.error('Erro ao carregar config:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.post('/config/configurations', {
        disparo_whats_url: config.disparo_whats_url,
        disparo_whats_token: config.disparo_whats_token,
        disparo_whats_instancia: config.disparo_whats_instancia
      });
      alert('Configuracoes salvas com sucesso!');
    } catch (err) {
      alert('Erro ao salvar: ' + (err.response?.data?.error || err.message));
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const res = await api.post('/marketing/whatsapp/test-connection', {
        url: config.disparo_whats_url,
        token: config.disparo_whats_token,
        instancia: config.disparo_whats_instancia
      });
      setTestResult({ success: true, message: res.data.message || 'Conexao OK!' });
    } catch (err) {
      setTestResult({ success: false, message: err.response?.data?.error || 'Falha na conexao' });
    } finally {
      setTesting(false);
    }
  };

  if (loading) return <div className="p-6 text-gray-400">Carregando...</div>;

  return (
    <div className="p-6 space-y-6">
      <div className="bg-green-50 border border-green-200 rounded-lg p-4">
        <div className="flex items-center gap-2 mb-1">
          <svg className="w-5 h-5 text-green-600" viewBox="0 0 24 24" fill="currentColor">
            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
          </svg>
          <span className="text-green-700 font-semibold">Disparo WhatsApp - Configuracao da instancia para monitoramento de entregas</span>
        </div>
        <p className="text-green-600 text-sm">Configure aqui a instancia do WhatsApp que sera usada para disparos de ofertas e monitoramento de entrega.</p>
      </div>

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">URL da API</label>
          <input
            type="text"
            value={config.disparo_whats_url}
            onChange={e => setConfig(prev => ({ ...prev, disparo_whats_url: e.target.value }))}
            placeholder="Ex: http://31.97.82.235:8090"
            className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-green-500 focus:border-green-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Token da API</label>
          <div className="relative">
            <input
              type={config.showToken ? 'text' : 'password'}
              value={config.disparo_whats_token}
              onChange={e => setConfig(prev => ({ ...prev, disparo_whats_token: e.target.value }))}
              placeholder="Token de autenticacao"
              className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-green-500 focus:border-green-500 pr-10"
            />
            <button
              type="button"
              onClick={() => setConfig(prev => ({ ...prev, showToken: !prev.showToken }))}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              {config.showToken ? (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21"/>
                </svg>
              ) : (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/>
                </svg>
              )}
            </button>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Instancia</label>
          <input
            type="text"
            value={config.disparo_whats_instancia}
            onChange={e => setConfig(prev => ({ ...prev, disparo_whats_instancia: e.target.value }))}
            placeholder="Nome da instancia (Ex: DISPARO-OFERTAS)"
            className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-green-500 focus:border-green-500"
          />
        </div>
      </div>

      {testResult && (
        <div className={`p-3 rounded-lg text-sm ${testResult.success ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
          {testResult.success ? '✅' : '❌'} {testResult.message}
        </div>
      )}

      <div className="flex gap-3">
        <button
          onClick={handleTest}
          disabled={testing || !config.disparo_whats_url || !config.disparo_whats_token || !config.disparo_whats_instancia}
          className="px-4 py-2 bg-white border border-green-500 text-green-600 rounded-lg text-sm hover:bg-green-50 disabled:opacity-50"
        >
          {testing ? 'Testando...' : '🔌 Testar Conexao'}
        </button>
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm hover:bg-green-700 disabled:opacity-50"
        >
          {saving ? 'Salvando...' : '💾 Salvar'}
        </button>
      </div>
    </div>
  );
}
