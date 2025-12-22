/**
 * 🔍 Página de Monitoramento de Email DVR
 */

import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import Sidebar from '../components/Sidebar';
import api from '../services/api';

export default function MonitorarEmailDVR() {
  const { user, logout } = useAuth();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(false);
  const [senhaGmail, setSenhaGmail] = useState('');
  const [configDVR, setConfigDVR] = useState({
    ip: '10.6.1.123',
    usuario: 'admin',
    senha: 'beto3107@',
    intervaloMinutos: 5
  });
  const [mensagem, setMensagem] = useState(null);

  // Carregar status ao montar componente
  useEffect(() => {
    carregarStatus();
    const interval = setInterval(carregarStatus, 30000);
    return () => clearInterval(interval);
  }, []);

  const carregarStatus = async () => {
    try {
      const response = await api.get('/dvr-monitor/status');
      setStatus(response.data);
    } catch (error) {
      console.error('Erro ao carregar status:', error);
    }
  };

  const iniciarMonitor = async () => {
    setLoading(true);
    setMensagem(null);
    try {
      await api.post('/dvr-monitor/iniciar');
      setMensagem({ tipo: 'success', texto: 'Monitor iniciado com sucesso!' });
      await carregarStatus();
    } catch (error) {
      setMensagem({ tipo: 'error', texto: error.response?.data?.error || 'Erro ao iniciar monitor' });
    } finally {
      setLoading(false);
    }
  };

  const pararMonitor = async () => {
    setLoading(true);
    setMensagem(null);
    try {
      await api.post('/dvr-monitor/parar');
      setMensagem({ tipo: 'success', texto: 'Monitor parado' });
      await carregarStatus();
    } catch (error) {
      setMensagem({ tipo: 'error', texto: error.response?.data?.error || 'Erro ao parar monitor' });
    } finally {
      setLoading(false);
    }
  };

  const verificarAgora = async () => {
    setLoading(true);
    setMensagem(null);
    try {
      await api.post('/dvr-monitor/verificar');
      setMensagem({ tipo: 'success', texto: 'Verificação manual concluída!' });
      await carregarStatus();
    } catch (error) {
      setMensagem({ tipo: 'error', texto: error.response?.data?.error || 'Erro ao verificar' });
    } finally {
      setLoading(false);
    }
  };

  const salvarSenhaGmail = async () => {
    if (!senhaGmail) {
      setMensagem({ tipo: 'error', texto: 'Digite a senha do Gmail' });
      return;
    }
    setLoading(true);
    setMensagem(null);
    try {
      await api.post('/dvr-monitor/senha-gmail', { senha: senhaGmail });
      setMensagem({ tipo: 'success', texto: 'Senha salva com sucesso!' });
      setSenhaGmail('');
    } catch (error) {
      setMensagem({ tipo: 'error', texto: error.response?.data?.error || 'Erro ao salvar senha' });
    } finally {
      setLoading(false);
    }
  };

  const salvarConfigDVR = async () => {
    setLoading(true);
    setMensagem(null);
    try {
      await api.post('/dvr-monitor/config', configDVR);
      setMensagem({ tipo: 'success', texto: 'Configurações salvas!' });
    } catch (error) {
      setMensagem({ tipo: 'error', texto: error.response?.data?.error || 'Erro ao salvar configurações' });
    } finally {
      setLoading(false);
    }
  };

  const formatarData = (data) => {
    if (!data) return '-';
    return new Date(data).toLocaleString('pt-BR');
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Sidebar user={user} onLogout={logout} isMobileMenuOpen={isMobileMenuOpen} setIsMobileMenuOpen={setIsMobileMenuOpen} />

      <div className="lg:ml-64 p-4 lg:p-8">
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <div className="mb-6">
            <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
              <svg className="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/>
              </svg>
              Monitor de Email DVR Intelbras
            </h1>
            <p className="text-gray-600 mt-2">Monitore e corrija automaticamente problemas de email do DVR</p>
          </div>

          {/* Mensagem */}
          {mensagem && (
            <div className={`mb-6 p-4 rounded-lg ${mensagem.tipo === 'success' ? 'bg-green-50 text-green-800 border border-green-200' : 'bg-red-50 text-red-800 border border-red-200'}`}>
              <div className="flex items-center justify-between">
                <span>{mensagem.texto}</span>
                <button onClick={() => setMensagem(null)} className="text-gray-500 hover:text-gray-700">×</button>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Status do Monitor */}
            <div className="bg-white rounded-lg shadow-md p-6">
              <h2 className="text-xl font-bold mb-4">📊 Status do Monitor</h2>

              {status ? (
                <>
                  <div className="mb-4">
                    <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-semibold ${status.ativo ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>
                      {status.ativo ? '✅ ATIVO' : '⭕ INATIVO'}
                    </span>
                    <span className="ml-3 text-gray-600">DVR: {status.dvr?.ip || '10.6.1.123'}</span>
                  </div>

                  <div className="border-t pt-4 mt-4 space-y-2">
                    <p className="text-sm text-gray-600">⏱️ Intervalo: <strong>{status.intervaloMinutos} minutos</strong></p>
                    <p className="text-sm text-gray-600">🔢 Total de verificações: <strong>{status.totalVerificacoes}</strong></p>
                    <p className="text-sm text-gray-600">🔧 Total de correções: <strong>{status.totalCorrecoes}</strong></p>
                    <p className="text-sm text-gray-600">🕐 Última verificação: <strong>{formatarData(status.ultimaVerificacao)}</strong></p>
                    {status.ultimaCorrecao && (
                      <p className="text-sm text-green-600">✅ Última correção: <strong>{formatarData(status.ultimaCorrecao)}</strong></p>
                    )}
                  </div>

                  <div className="mt-6 flex gap-2 flex-wrap">
                    {!status.ativo ? (
                      <button onClick={iniciarMonitor} disabled={loading} className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 disabled:opacity-50">
                        ▶ Iniciar Monitor
                      </button>
                    ) : (
                      <button onClick={pararMonitor} disabled={loading} className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 disabled:opacity-50">
                        ⏹ Parar Monitor
                      </button>
                    )}
                    <button onClick={verificarAgora} disabled={loading || !status} className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50">
                      🔄 Verificar Agora
                    </button>
                  </div>
                </>
              ) : (
                <div className="flex justify-center py-8">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
                </div>
              )}
            </div>

            {/* Senha do Gmail */}
            <div className="bg-white rounded-lg shadow-md p-6">
              <h2 className="text-xl font-bold mb-4">🔐 Senha do Gmail</h2>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4">
                <p className="text-sm text-blue-800">Esta é a senha correta que será usada para corrigir automaticamente o bug do DVR</p>
              </div>

              <input
                type="password"
                value={senhaGmail}
                onChange={(e) => setSenhaGmail(e.target.value)}
                placeholder="Digite a senha correta do Gmail"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg mb-4 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />

              <button onClick={salvarSenhaGmail} disabled={loading} className="w-full bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50">
                💾 Salvar Senha
              </button>
            </div>

            {/* Configurações do DVR */}
            <div className="bg-white rounded-lg shadow-md p-6 lg:col-span-2">
              <h2 className="text-xl font-bold mb-4">⚙️ Configurações do DVR</h2>

              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">IP do DVR</label>
                  <input
                    type="text"
                    value={configDVR.ip}
                    onChange={(e) => setConfigDVR({ ...configDVR, ip: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Usuário</label>
                  <input
                    type="text"
                    value={configDVR.usuario}
                    onChange={(e) => setConfigDVR({ ...configDVR, usuario: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Senha do DVR</label>
                  <input
                    type="password"
                    value={configDVR.senha}
                    onChange={(e) => setConfigDVR({ ...configDVR, senha: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Intervalo (min)</label>
                  <input
                    type="number"
                    value={configDVR.intervaloMinutos}
                    onChange={(e) => setConfigDVR({ ...configDVR, intervaloMinutos: parseInt(e.target.value) || 5 })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <button onClick={salvarConfigDVR} disabled={loading} className="mt-4 bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50">
                💾 Salvar Configurações
              </button>
            </div>

            {/* Informações sobre o Bug */}
            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg shadow-md p-6 lg:col-span-2 border border-blue-200">
              <h2 className="text-xl font-bold mb-4 text-blue-900">ℹ️ Sobre o Bug do DVR</h2>

              <div className="space-y-3 text-sm text-gray-700">
                <p>
                  <strong>Problema:</strong> O DVR Intelbras tem um bug onde, ao salvar uma senha curta (exemplo: 4 caracteres),
                  ele adiciona automaticamente 16 caracteres "fantasmas" do buffer de memória, totalizando 20 caracteres.
                  Isso faz com que a autenticação SMTP falhe.
                </p>

                <p><strong>Solução Automática:</strong> Este monitor verifica periodicamente se a senha está correta. Quando detecta o bug, ele automaticamente:</p>

                <ol className="list-decimal list-inside space-y-1 ml-4">
                  <li>Limpa a senha corrompida</li>
                  <li>Aguarda 2 segundos (limpar buffer de memória)</li>
                  <li>Aplica a senha correta salva acima</li>
                  <li>Reinicia o serviço de email do DVR</li>
                </ol>

                <div className="bg-green-50 border border-green-200 rounded-lg p-3 mt-4">
                  <p className="text-green-800 font-semibold">✅ Com este monitor ativo, você nunca mais vai precisar corrigir manualmente a senha do email!</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
