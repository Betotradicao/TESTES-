import { useState, useEffect } from 'react';
import api from '../../services/api';

export default function TailscaleTab() {
  const [loading, setLoading] = useState(false);
  const [testing, setTesting] = useState(false);
  const [config, setConfig] = useState({
    vps_ip: '',
    client_ip: '',
    dvr_ip: ''
  });
  const [testResults, setTestResults] = useState(null);

  useEffect(() => {
    loadConfig();
  }, []);

  const loadConfig = async () => {
    try {
      setLoading(true);
      const response = await api.get('/tailscale/config');
      setConfig(response.data);
    } catch (error) {
      console.error('Erro ao carregar configurações:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveConfig = async () => {
    try {
      setLoading(true);
      await api.put('/tailscale/config', {
        vps_ip: config.vps_ip,
        client_ip: config.client_ip
      });
      alert('✅ Configurações salvas com sucesso!');
    } catch (error) {
      console.error('Erro ao salvar configurações:', error);
      alert('❌ Erro ao salvar configurações');
    } finally {
      setLoading(false);
    }
  };

  const handleTestConnectivity = async () => {
    try {
      setTesting(true);
      const response = await api.post('/tailscale/test');
      setTestResults(response.data);
    } catch (error) {
      console.error('Erro ao testar conectividade:', error);
      alert('❌ Erro ao testar conectividade');
    } finally {
      setTesting(false);
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'online':
        return '🟢';
      case 'offline':
      case 'error':
        return '🔴';
      case 'not_configured':
        return '⚪';
      default:
        return '🟡';
    }
  };

  const getStatusColor = (color) => {
    switch (color) {
      case 'green':
        return 'text-green-600 bg-green-50 border-green-200';
      case 'red':
        return 'text-red-600 bg-red-50 border-red-200';
      case 'gray':
        return 'text-gray-600 bg-gray-50 border-gray-200';
      case 'yellow':
        return 'text-yellow-600 bg-yellow-50 border-yellow-200';
      default:
        return 'text-gray-600 bg-gray-50 border-gray-200';
    }
  };

  const getOverallStatusBadge = () => {
    if (!testResults) return null;

    const { overall_status } = testResults;
    const colors = {
      healthy: 'bg-green-100 text-green-800 border-green-300',
      unhealthy: 'bg-red-100 text-red-800 border-red-300',
      partial: 'bg-yellow-100 text-yellow-800 border-yellow-300',
      not_configured: 'bg-gray-100 text-gray-800 border-gray-300'
    };

    return (
      <div className={`inline-flex items-center px-4 py-2 rounded-full border-2 font-semibold ${colors[overall_status.status]}`}>
        {getStatusIcon(overall_status.status)} {overall_status.message}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Status Geral */}
      {testResults && (
        <div className="bg-white rounded-xl shadow-lg p-6 border-2 border-orange-200">
          <div className="flex items-center justify-between">
            <h3 className="text-xl font-bold text-gray-800">Status Geral da Rede</h3>
            {getOverallStatusBadge()}
          </div>
        </div>
      )}

      {/* Configurações */}
      <div className="bg-white rounded-xl shadow-lg p-6 border-2 border-gray-200">
        <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center">
          <svg className="w-6 h-6 mr-2 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          Configuração de IPs Tailscale
        </h3>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              IP Tailscale da VPS
            </label>
            <input
              type="text"
              value={config.vps_ip}
              onChange={(e) => setConfig({ ...config, vps_ip: e.target.value })}
              placeholder="100.x.x.x"
              className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-orange-500 focus:outline-none"
            />
            <p className="text-xs text-gray-500 mt-1">IP da VPS na rede Tailscale</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              IP Tailscale do Cliente
            </label>
            <input
              type="text"
              value={config.client_ip}
              onChange={(e) => setConfig({ ...config, client_ip: e.target.value })}
              placeholder="100.y.y.y"
              className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-orange-500 focus:outline-none"
            />
            <p className="text-xs text-gray-500 mt-1">IP do computador do cliente na rede Tailscale</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              IP Local do DVR (no cliente)
            </label>
            <input
              type="text"
              value={config.dvr_ip}
              disabled
              className="w-full px-4 py-2 border-2 border-gray-200 rounded-lg bg-gray-100 text-gray-600 cursor-not-allowed"
            />
            <p className="text-xs text-gray-500 mt-1">Configurado automaticamente (10.6.1.123)</p>
          </div>

          <button
            onClick={handleSaveConfig}
            disabled={loading}
            className="w-full bg-orange-500 hover:bg-orange-600 text-white font-bold py-3 px-4 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
          >
            {loading ? (
              <>
                <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                <span>Salvando...</span>
              </>
            ) : (
              <>
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
                </svg>
                <span>Salvar Configurações</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Testes de Conectividade */}
      <div className="bg-white rounded-xl shadow-lg p-6 border-2 border-gray-200">
        <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center">
          <svg className="w-6 h-6 mr-2 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          Testes de Conectividade
        </h3>

        <button
          onClick={handleTestConnectivity}
          disabled={testing}
          className="w-full bg-blue-500 hover:bg-blue-600 text-white font-bold py-3 px-4 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2 mb-6"
        >
          {testing ? (
            <>
              <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              <span>Testando...</span>
            </>
          ) : (
            <>
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              <span>Testar Conectividade Agora</span>
            </>
          )}
        </button>

        {/* Resultados dos Testes */}
        {testResults && testResults.tests && (
          <div className="space-y-3">
            {/* VPS → Cliente */}
            <div className={`p-4 rounded-lg border-2 ${getStatusColor(testResults.tests.vps_to_client.color)}`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <span className="text-2xl">{getStatusIcon(testResults.tests.vps_to_client.status)}</span>
                  <div>
                    <p className="font-semibold">{testResults.tests.vps_to_client.description}</p>
                    <p className="text-sm">{testResults.tests.vps_to_client.message}</p>
                  </div>
                </div>
                {testResults.tests.vps_to_client.latency_ms && (
                  <span className="text-sm font-mono">{testResults.tests.vps_to_client.latency_ms}ms</span>
                )}
              </div>
            </div>

            {/* VPS → DVR */}
            <div className={`p-4 rounded-lg border-2 ${getStatusColor(testResults.tests.vps_to_dvr.color)}`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <span className="text-2xl">{getStatusIcon(testResults.tests.vps_to_dvr.status)}</span>
                  <div>
                    <p className="font-semibold">{testResults.tests.vps_to_dvr.description}</p>
                    <p className="text-sm">{testResults.tests.vps_to_dvr.message}</p>
                  </div>
                </div>
                {testResults.tests.vps_to_dvr.latency_ms && (
                  <span className="text-sm font-mono">{testResults.tests.vps_to_dvr.latency_ms}ms</span>
                )}
              </div>
            </div>

            {/* DVR HTTP */}
            <div className={`p-4 rounded-lg border-2 ${getStatusColor(testResults.tests.dvr_http.color)}`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <span className="text-2xl">{getStatusIcon(testResults.tests.dvr_http.status)}</span>
                  <div>
                    <p className="font-semibold">{testResults.tests.dvr_http.description}</p>
                    <p className="text-sm">{testResults.tests.dvr_http.message}</p>
                  </div>
                </div>
                {testResults.tests.dvr_http.response_time_ms && (
                  <span className="text-sm font-mono">{testResults.tests.dvr_http.response_time_ms}ms</span>
                )}
              </div>
            </div>
          </div>
        )}

        {!testResults && (
          <div className="text-center py-8 text-gray-500">
            <svg className="w-16 h-16 mx-auto mb-3 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p>Clique em "Testar Conectividade Agora" para verificar o status da rede</p>
          </div>
        )}
      </div>

      {/* Legenda */}
      <div className="bg-blue-50 rounded-xl shadow p-6 border-2 border-blue-200">
        <h4 className="font-bold text-gray-800 mb-3">ℹ️ Como funciona:</h4>
        <ul className="space-y-2 text-sm text-gray-700">
          <li className="flex items-start">
            <span className="mr-2">•</span>
            <span><strong>VPS → Cliente:</strong> Testa se a VPS consegue alcançar o computador do cliente via Tailscale</span>
          </li>
          <li className="flex items-start">
            <span className="mr-2">•</span>
            <span><strong>VPS → DVR:</strong> Testa se a VPS consegue alcançar o DVR na rede local do cliente</span>
          </li>
          <li className="flex items-start">
            <span className="mr-2">•</span>
            <span><strong>DVR HTTP:</strong> Testa se o DVR está respondendo requisições HTTP corretamente</span>
          </li>
        </ul>
      </div>
    </div>
  );
}
