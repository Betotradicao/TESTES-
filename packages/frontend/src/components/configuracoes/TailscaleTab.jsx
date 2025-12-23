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
            <span><strong>VPS → DVR:</strong> Testa se a VPS consegue alcançar o DVR na rede local do cliente através do Tailscale</span>
          </li>
        </ul>
      </div>

      {/* Instruções de Configuração */}
      <div className="bg-gradient-to-br from-orange-50 to-yellow-50 rounded-xl shadow p-6 border-2 border-orange-200">
        <h4 className="font-bold text-gray-800 mb-4 flex items-center">
          <svg className="w-5 h-5 mr-2 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          Como obter os IPs Tailscale:
        </h4>

        <div className="space-y-4">
          {/* Cliente Windows */}
          <div className="bg-white rounded-lg p-4 border-l-4 border-blue-500">
            <h5 className="font-bold text-blue-700 mb-2 flex items-center">
              <svg className="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 24 24">
                <path d="M0 3.449L9.75 2.1v9.451H0m10.949-9.602L24 0v11.4H10.949M0 12.6h9.75v9.451L0 20.699M10.949 12.6H24V24l-12.9-1.801" />
              </svg>
              Cliente Windows:
            </h5>
            <ol className="text-sm text-gray-700 space-y-1 ml-6 list-decimal">
              <li>Acesse no PC do cliente: <a href="https://login.tailscale.com/admin/machines" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline font-mono">login.tailscale.com/admin/machines</a></li>
              <li>Encontre o computador do cliente na lista</li>
              <li>Copie o IP Tailscale (ex: 100.69.131.40)</li>
              <li>Cole no campo "IP Tailscale do Cliente" acima</li>
            </ol>
          </div>

          {/* VPS Linux */}
          <div className="bg-white rounded-lg p-4 border-l-4 border-green-500">
            <h5 className="font-bold text-green-700 mb-2 flex items-center">
              <svg className="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12.504 0c-.155 0-.315.008-.48.021-4.226.333-3.105 4.807-3.17 6.298-.076 1.092-.3 1.953-1.05 3.02-.885 1.051-2.127 2.75-2.716 4.521-.278.84-.41 1.719-.287 2.589.214 1.505.962 2.735 2.179 3.548l.062.04c.651.408 1.446.65 2.315.65.869 0 1.664-.242 2.315-.65l.062-.04c1.217-.813 1.965-2.043 2.179-3.548.123-.87-.009-1.75-.287-2.589-.589-1.771-1.831-3.47-2.716-4.521-.75-1.067-.974-1.928-1.05-3.02-.065-1.491 1.056-5.965-3.17-6.298-.165-.013-.325-.021-.48-.021zm-.005 2.024c.044 0 .09.003.135.006 1.012.08 1.067.748 1.092 1.476.028.813.227 1.574.845 2.426.793.928 1.959 2.579 2.503 4.205.196.587.288 1.176.191 1.714-.121.675-.499 1.216-1.099 1.572-.281.177-.61.268-.964.268s-.683-.091-.964-.268c-.6-.356-.978-.897-1.099-1.572-.097-.538-.005-1.127.191-1.714.544-1.626 1.71-3.277 2.503-4.205.618-.852.817-1.613.845-2.426.025-.728.08-1.396 1.092-1.476.045-.003.091-.006.135-.006z" />
              </svg>
              VPS Linux:
            </h5>
            <ol className="text-sm text-gray-700 space-y-1 ml-6 list-decimal">
              <li>Conecte via SSH na VPS</li>
              <li>Execute: <code className="bg-gray-100 px-2 py-1 rounded font-mono text-xs">curl -fsSL https://tailscale.com/install.sh | sh</code></li>
              <li>Execute: <code className="bg-gray-100 px-2 py-1 rounded font-mono text-xs">sudo tailscale up</code></li>
              <li>Abra a URL que aparecer no navegador e autorize</li>
              <li>Execute: <code className="bg-gray-100 px-2 py-1 rounded font-mono text-xs">tailscale ip -4</code></li>
              <li>Copie o IP retornado (ex: 100.81.126.110)</li>
              <li>Cole no campo "IP Tailscale da VPS" acima</li>
            </ol>
          </div>

          {/* Configurar Subnet Routes */}
          <div className="bg-white rounded-lg p-4 border-l-4 border-purple-500">
            <h5 className="font-bold text-purple-700 mb-2 flex items-center">
              <svg className="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" />
              </svg>
              Liberar Acesso ao DVR (Subnet Routes):
            </h5>
            <p className="text-xs text-gray-600 mb-2 italic">Permite que a VPS acesse a rede local do cliente (10.6.1.x) onde está o DVR</p>
            <ol className="text-sm text-gray-700 space-y-2 ml-6 list-decimal">
              <li>
                <strong>No PC do cliente (Windows):</strong> Abra PowerShell como Administrador e execute:
                <div className="mt-1 bg-gray-900 text-green-400 p-2 rounded font-mono text-xs overflow-x-auto">
                  tailscale up --advertise-routes=10.6.1.0/24 --accept-routes
                </div>
              </li>
              <li>
                <strong>No painel web:</strong> Acesse <a href="https://login.tailscale.com/admin/machines" target="_blank" rel="noopener noreferrer" className="text-purple-600 hover:underline font-mono">login.tailscale.com/admin/machines</a>
              </li>
              <li>
                Clique no computador do cliente (ex: srv-tradicao)
              </li>
              <li>
                Na seção <strong>"Subnet routes"</strong>, marque o checkbox <code className="bg-gray-100 px-1 rounded">10.6.1.0/24</code>
              </li>
              <li>
                Clique em <strong>Save</strong>
              </li>
              <li>
                Pronto! Agora a VPS consegue acessar o DVR (10.6.1.123) através do Tailscale
              </li>
            </ol>
          </div>

          {/* Dica Extra */}
          <div className="bg-gradient-to-r from-purple-100 to-pink-100 rounded-lg p-3 border border-purple-300">
            <p className="text-sm text-purple-900 flex items-start">
              <svg className="w-5 h-5 mr-2 flex-shrink-0 text-purple-600" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
              </svg>
              <span><strong>Dica:</strong> No painel do Tailscale você consegue ver TODAS as máquinas conectadas e seus IPs em um só lugar!</span>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
