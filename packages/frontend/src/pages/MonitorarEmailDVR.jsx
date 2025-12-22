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
  const [mostrarSenhaDVR, setMostrarSenhaDVR] = useState(false);
  const [mostrarSenhaGmail, setMostrarSenhaGmail] = useState(false);
  const [intervaloHoras, setIntervaloHoras] = useState('00');
  const [intervaloMinutos, setIntervaloMinutosLocal] = useState('05');

  // Carregar status e configurações ao montar componente
  useEffect(() => {
    carregarStatus();
    carregarConfiguracoes();
    const interval = setInterval(carregarStatus, 30000);
    return () => clearInterval(interval);
  }, []);

  const carregarConfiguracoes = async () => {
    try {
      // Buscar configuração do DVR
      const responseDVR = await api.get('/dvr-monitor/config');
      if (responseDVR.data) {
        // Manter a senha que já está no estado (o backend não retorna senha por segurança)
        setConfigDVR(prev => ({
          ip: responseDVR.data.ip || prev.ip,
          usuario: responseDVR.data.usuario || prev.usuario,
          senha: prev.senha // Manter senha atual
        }));

        // Converter intervalo de minutos para HH:MM
        const minutos = responseDVR.data.intervaloMinutos || 5;
        const horas = Math.floor(minutos / 60);
        const mins = minutos % 60;
        setIntervaloHoras(String(horas).padStart(2, '0'));
        setIntervaloMinutosLocal(String(mins).padStart(2, '0'));
      }

      // Buscar senha do Gmail da aba Gmail
      const responseEmailMonitor = await api.get('/email-monitor/config');
      if (responseEmailMonitor.data?.app_password) {
        setSenhaGmail(responseEmailMonitor.data.app_password);
      }
    } catch (error) {
      console.error('Erro ao carregar configurações:', error);
    }
  };

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
      // Converter HH:MM para minutos totais
      const totalMinutos = (parseInt(intervaloHoras) * 60) + parseInt(intervaloMinutos);

      // Enviar dados no formato esperado pelo backend
      await api.post('/dvr-monitor/config', {
        ip: configDVR.ip,
        usuario: configDVR.usuario,
        senha: configDVR.senha,
        intervaloMinutos: totalMinutos
      });

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

              <div className="relative mb-4">
                <input
                  type={mostrarSenhaGmail ? "text" : "password"}
                  value={senhaGmail}
                  onChange={(e) => setSenhaGmail(e.target.value)}
                  placeholder="Digite a senha correta do Gmail"
                  className="w-full px-4 py-2 pr-12 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                <button
                  type="button"
                  onClick={() => setMostrarSenhaGmail(!mostrarSenhaGmail)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                >
                  {mostrarSenhaGmail ? (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/>
                    </svg>
                  ) : (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21"/>
                    </svg>
                  )}
                </button>
              </div>

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
                  <div className="relative">
                    <input
                      type={mostrarSenhaDVR ? "text" : "password"}
                      value={configDVR.senha}
                      onChange={(e) => setConfigDVR({ ...configDVR, senha: e.target.value })}
                      className="w-full px-4 py-2 pr-12 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                    <button
                      type="button"
                      onClick={() => setMostrarSenhaDVR(!mostrarSenhaDVR)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                    >
                      {mostrarSenhaDVR ? (
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/>
                        </svg>
                      ) : (
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21"/>
                        </svg>
                      )}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Intervalo de Verificação</label>
                  <div className="flex gap-2">
                    <div className="flex-1">
                      <input
                        type="number"
                        min="0"
                        max="23"
                        value={intervaloHoras}
                        onChange={(e) => {
                          const valor = e.target.value.padStart(2, '0');
                          setIntervaloHoras(valor);
                        }}
                        placeholder="HH"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-center"
                      />
                      <p className="text-xs text-gray-500 text-center mt-1">Horas</p>
                    </div>
                    <span className="text-2xl font-bold text-gray-400 self-center">:</span>
                    <div className="flex-1">
                      <input
                        type="number"
                        min="0"
                        max="59"
                        value={intervaloMinutos}
                        onChange={(e) => {
                          const valor = e.target.value.padStart(2, '0');
                          setIntervaloMinutosLocal(valor);
                        }}
                        placeholder="MM"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-center"
                      />
                      <p className="text-xs text-gray-500 text-center mt-1">Minutos</p>
                    </div>
                  </div>
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
