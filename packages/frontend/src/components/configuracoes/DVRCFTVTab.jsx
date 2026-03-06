import { useState, useEffect } from 'react';
import api from '../../utils/api';

export default function DVRCFTVTab() {
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [isDetecting, setIsDetecting] = useState(false);
  const [testResult, setTestResult] = useState(null);
  const [showPassword, setShowPassword] = useState(false);

  const [config, setConfig] = useState({
    dvr_ip: '',
    dvr_usuario: 'admin',
    dvr_senha: '',
    dvr_porta_http: '80',
    dvr_porta_rtsp: '554',
    dvr_canal_padrao: '0',
    dvr_antecedencia_segundos: '15',
    dvr_tempo_depois_segundos: '120',
    dvr_canais: '[]'
  });

  const [canais, setCanais] = useState([]);
  const [bipagensChannels, setBipagensChannels] = useState(new Set());

  useEffect(() => {
    loadConfig();
  }, []);

  const loadConfig = async () => {
    try {
      const response = await api.get('/config/configurations');
      if (response.data.success && response.data.data) {
        const data = response.data.data;
        setConfig(prev => ({
          ...prev,
          dvr_ip: data.dvr_ip || '',
          dvr_usuario: data.dvr_usuario || 'admin',
          dvr_senha: data.dvr_senha || '',
          dvr_porta_http: data.dvr_porta_http || '80',
          dvr_porta_rtsp: data.dvr_porta_rtsp || '554',
          dvr_canal_padrao: data.dvr_canal_padrao || '0',
          dvr_antecedencia_segundos: data.dvr_antecedencia_segundos || '15',
          dvr_tempo_depois_segundos: data.dvr_tempo_depois_segundos || '120',
          dvr_canais: data.dvr_canais || '[]'
        }));
        try {
          const parsed = JSON.parse(data.dvr_canais || '[]');
          setCanais(Array.isArray(parsed) ? parsed : []);
        } catch {
          setCanais([]);
        }
        try {
          const parsedBip = JSON.parse(data.dvr_cameras_bipagens || '[]');
          const bipSet = new Set((Array.isArray(parsedBip) ? parsedBip : []).map(c => c.channel));
          setBipagensChannels(bipSet);
        } catch {
          setBipagensChannels(new Set());
        }
      }
    } catch (err) {
      console.error('Erro ao carregar configurações DVR:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const canaisJson = JSON.stringify(canais);
      // Construir cameras bipagens a partir dos canais marcados
      const camerasBip = canais
        .filter(c => bipagensChannels.has(c.channel))
        .map(c => ({ channel: c.channel, label: c.label }));
      const updates = {
        ...config,
        dvr_canais: canaisJson,
        dvr_cameras_bipagens: JSON.stringify(camerasBip)
      };
      await api.post('/config/configurations', updates);
      setConfig(prev => ({ ...prev, dvr_canais: canaisJson }));
      alert('Configurações DVR salvas com sucesso!');
    } catch (err) {
      alert('Erro ao salvar: ' + (err.response?.data?.error || err.message));
    } finally {
      setIsSaving(false);
    }
  };

  const handleTestConnection = async () => {
    setIsTesting(true);
    setTestResult(null);
    try {
      const response = await api.post('/dvr-cftv/test-connection');
      setTestResult(response.data);
    } catch (err) {
      setTestResult({ success: false, message: err.response?.data?.message || err.message });
    } finally {
      setIsTesting(false);
    }
  };

  const handleDetectChannels = async () => {
    setIsDetecting(true);
    try {
      // Salvar IP/user/senha/portas primeiro para o backend usar
      await api.post('/config/configurations', {
        dvr_ip: config.dvr_ip,
        dvr_usuario: config.dvr_usuario,
        dvr_senha: config.dvr_senha,
        dvr_porta_http: config.dvr_porta_http,
        dvr_porta_rtsp: config.dvr_porta_rtsp
      });
      const response = await api.post('/dvr-cftv/detect-channels');
      if (response.data.success && response.data.canais?.length > 0) {
        setCanais(response.data.canais);
        setConfig(prev => ({ ...prev, dvr_canal_padrao: String(response.data.canais[0].channel) }));
        alert(`${response.data.canais.length} canais detectados do DVR!`);
      } else {
        alert('Nenhum canal detectado');
      }
    } catch (err) {
      alert('Erro ao detectar canais: ' + (err.response?.data?.error || err.message));
    } finally {
      setIsDetecting(false);
    }
  };

  const addCanal = () => {
    const nextChannel = canais.length;
    setCanais([...canais, { channel: nextChannel, pdv: nextChannel + 1, label: `Canal ${nextChannel + 1} - PDV ${nextChannel + 1}` }]);
  };

  const removeCanal = (index) => {
    setCanais(canais.filter((_, i) => i !== index));
  };

  const updateCanal = (index, field, value) => {
    const updated = [...canais];
    updated[index] = { ...updated[index], [field]: field === 'label' ? value : parseInt(value) || 0 };
    setCanais(updated);
  };

  const toggleBipagem = (channel) => {
    setBipagensChannels(prev => {
      const next = new Set(prev);
      if (next.has(channel)) {
        next.delete(channel);
      } else {
        next.add(channel);
      }
      return next;
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <svg className="animate-spin h-8 w-8 text-blue-500" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
        <span className="ml-3 text-gray-600">Carregando configurações...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Conexão DVR */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
          <svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
          </svg>
          Conexao DVR
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">IP do DVR</label>
            <input
              type="text"
              value={config.dvr_ip}
              onChange={(e) => setConfig({ ...config, dvr_ip: e.target.value })}
              placeholder="Ex: 10.6.1.123 ou localhost (VPS)"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
            />
            <p className="text-xs text-gray-400 mt-1">Na VPS, use localhost com portas do tunel</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Porta HTTP (API)</label>
            <input
              type="number"
              value={config.dvr_porta_http}
              onChange={(e) => setConfig({ ...config, dvr_porta_http: e.target.value })}
              placeholder="80"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
            />
            <p className="text-xs text-gray-400 mt-1">Padrao: 80 (local) ou porta tunelada (VPS)</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Porta RTSP (Video)</label>
            <input
              type="number"
              value={config.dvr_porta_rtsp}
              onChange={(e) => setConfig({ ...config, dvr_porta_rtsp: e.target.value })}
              placeholder="554"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
            />
            <p className="text-xs text-gray-400 mt-1">Padrao: 554 (local) ou porta tunelada (VPS)</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Usuario</label>
            <input
              type="text"
              value={config.dvr_usuario}
              onChange={(e) => setConfig({ ...config, dvr_usuario: e.target.value })}
              placeholder="admin"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Senha</label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={config.dvr_senha}
                onChange={(e) => setConfig({ ...config, dvr_senha: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 focus:border-purple-500 pr-10"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-400 hover:text-gray-600"
              >
                {showPassword ? (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.878 9.878L3 3m6.878 6.878L21 21" />
                  </svg>
                ) : (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  </svg>
                )}
              </button>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Tempo ANTES do evento (segundos)</label>
            <input
              type="number"
              value={config.dvr_antecedencia_segundos}
              onChange={(e) => setConfig({ ...config, dvr_antecedencia_segundos: e.target.value })}
              placeholder="15"
              min="0"
              max="300"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
            />
            <p className="text-xs text-gray-500 mt-1">Segundos antes da bipagem/transação para iniciar o vídeo</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Tempo DEPOIS do evento (segundos)</label>
            <input
              type="number"
              value={config.dvr_tempo_depois_segundos}
              onChange={(e) => setConfig({ ...config, dvr_tempo_depois_segundos: e.target.value })}
              placeholder="120"
              min="10"
              max="600"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
            />
            <p className="text-xs text-gray-500 mt-1">Segundos depois da bipagem/transação para encerrar o vídeo</p>
          </div>
        </div>

        <div className="flex items-center gap-3 mt-4">
          <button
            onClick={handleTestConnection}
            disabled={isTesting || !config.dvr_ip}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50 flex items-center gap-2"
          >
            {isTesting ? (
              <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            ) : (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            )}
            Testar Conexao
          </button>
          {testResult && (
            <span className={`text-sm font-medium ${testResult.success ? 'text-green-600' : 'text-red-600'}`}>
              {testResult.success ? '✓' : '✗'} {testResult.message}
            </span>
          )}
        </div>
      </div>

      {/* Mapeamento de Canais */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
            <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
            </svg>
            Mapeamento de Canais DVR → PDV
          </h3>
          <div className="flex gap-2">
            <button
              onClick={handleDetectChannels}
              disabled={isDetecting || !config.dvr_ip}
              className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50 flex items-center gap-1"
            >
              {isDetecting ? (
                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
              ) : (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              )}
              Detectar do DVR
            </button>
            <button
              onClick={addCanal}
              className="px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white text-sm font-medium rounded-lg transition-colors flex items-center gap-1"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Adicionar Manual
            </button>
          </div>
        </div>

        {canais.length === 0 ? (
          <div className="text-center py-8 text-gray-400">
            <svg className="w-12 h-12 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
            <p className="text-sm">Nenhum canal configurado</p>
            <p className="text-xs mt-1">Clique em "Adicionar Canal" para mapear canais DVR aos PDVs</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-3 py-2 text-left font-semibold text-gray-600">Canal DVR</th>
                  <th className="px-3 py-2 text-left font-semibold text-gray-600">Numero PDV</th>
                  <th className="px-3 py-2 text-center font-semibold text-orange-600 w-20">Bipagem</th>
                  <th className="px-3 py-2 text-left font-semibold text-gray-600">Label (exibicao)</th>
                  <th className="px-3 py-2 text-center font-semibold text-gray-600 w-16">Acoes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {canais.map((canal, index) => (
                  <tr key={index} className="hover:bg-gray-50">
                    <td className="px-3 py-2">
                      <input
                        type="number"
                        value={canal.channel}
                        onChange={(e) => updateCanal(index, 'channel', e.target.value)}
                        min="0"
                        className="w-20 px-2 py-1 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-purple-500"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <input
                        type="number"
                        value={canal.pdv}
                        onChange={(e) => updateCanal(index, 'pdv', e.target.value)}
                        min="1"
                        className="w-20 px-2 py-1 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-purple-500"
                      />
                    </td>
                    <td className="px-3 py-2 text-center">
                      <input
                        type="checkbox"
                        checked={bipagensChannels.has(canal.channel)}
                        onChange={() => toggleBipagem(canal.channel)}
                        className="w-5 h-5 text-orange-600 border-gray-300 rounded focus:ring-orange-500 cursor-pointer"
                        title="Marque para usar esta câmera na prevenção de bipagens"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <input
                        type="text"
                        value={canal.label}
                        onChange={(e) => updateCanal(index, 'label', e.target.value)}
                        placeholder="Ex: Canal 1 - PDV 1"
                        className="w-full px-2 py-1 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-purple-500"
                      />
                    </td>
                    <td className="px-3 py-2 text-center">
                      <button
                        onClick={() => removeCanal(index)}
                        className="text-red-500 hover:text-red-700 transition-colors"
                        title="Remover canal"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {canais.length > 0 && (
          <div className="mt-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">Canal Padrao</label>
            <select
              value={config.dvr_canal_padrao}
              onChange={(e) => setConfig({ ...config, dvr_canal_padrao: e.target.value })}
              className="w-48 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
            >
              {canais.map((canal, index) => (
                <option key={index} value={canal.channel}>{canal.label}</option>
              ))}
            </select>
            <p className="text-xs text-gray-500 mt-1">Canal selecionado automaticamente ao abrir o Vision PDV</p>
          </div>
        )}
      </div>

      {/* Botao Salvar */}
      <div className="flex justify-end">
        <button
          onClick={handleSave}
          disabled={isSaving}
          className="px-6 py-2.5 bg-purple-600 hover:bg-purple-700 text-white font-semibold rounded-lg text-sm transition-colors disabled:opacity-50 flex items-center gap-2"
        >
          {isSaving ? (
            <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          ) : (
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          )}
          Salvar Configuracoes DVR
        </button>
      </div>
    </div>
  );
}
