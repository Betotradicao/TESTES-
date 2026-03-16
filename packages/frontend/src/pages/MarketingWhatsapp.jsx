import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import Sidebar from '../components/Sidebar';
import { api } from '../utils/api';

export default function MarketingWhatsapp() {
  const { user, logout } = useAuth();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [stats, setStats] = useState(null);
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showMessages, setShowMessages] = useState(false);
  const [dateRange, setDateRange] = useState({
    inicio: new Date().toISOString().split('T')[0],
    fim: new Date().toISOString().split('T')[0]
  });

  useEffect(() => {
    loadStats();
  }, [dateRange]);

  const loadStats = async () => {
    setLoading(true);
    try {
      const [statsRes, msgsRes] = await Promise.all([
        api.get('/marketing/whatsapp/stats', { params: dateRange }),
        api.get('/marketing/whatsapp/messages', { params: dateRange })
      ]);
      setStats(statsRes.data);
      setMessages(msgsRes.data?.messages || []);
    } catch (err) {
      console.error('Erro ao carregar stats:', err);
      setStats(null);
      setMessages([]);
    } finally {
      setLoading(false);
    }
  };

  const formatPhone = (jid) => {
    if (!jid) return '';
    const num = jid.replace('@s.whatsapp.net', '').replace('@lid', '');
    if (num.length > 10) return `(${num.slice(2,4)}) ${num.slice(4,9)}-${num.slice(9)}`;
    return num;
  };

  const getStatusBadge = (status) => {
    switch(status) {
      case 'READ': return <span className="px-2 py-0.5 text-xs rounded-full bg-blue-100 text-blue-700">Lida</span>;
      case 'DELIVERY_ACK': return <span className="px-2 py-0.5 text-xs rounded-full bg-green-100 text-green-700">Entregue</span>;
      case 'SERVER_ACK': return <span className="px-2 py-0.5 text-xs rounded-full bg-yellow-100 text-yellow-700">Enviada</span>;
      case 'ERROR': case 'FAILED': return <span className="px-2 py-0.5 text-xs rounded-full bg-red-100 text-red-700">Falhou</span>;
      default: return <span className="px-2 py-0.5 text-xs rounded-full bg-gray-100 text-gray-700">{status}</span>;
    }
  };

  const formatTime = (ts) => {
    if (!ts) return '';
    const d = new Date(ts * 1000);
    return d.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar
        user={user}
        onLogout={logout}
        isMobileMenuOpen={isMobileMenuOpen}
        setIsMobileMenuOpen={setIsMobileMenuOpen}
      />
      <div className="flex-1 overflow-auto">
        {/* Mobile Header */}
        <div className="lg:hidden bg-white shadow-sm p-4 flex items-center justify-between">
          <button onClick={() => setIsMobileMenuOpen(true)} className="p-2 text-gray-600 hover:text-gray-900">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16"/>
            </svg>
          </button>
          <span className="text-lg font-semibold text-gray-800">Marketing WhatsApp</span>
          <div></div>
        </div>
    <div className="p-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-green-600 to-green-700 rounded-xl p-6 mb-6 text-white">
        <div className="flex items-center gap-3">
          <svg className="w-8 h-8" viewBox="0 0 24 24" fill="currentColor">
            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
          </svg>
          <div>
            <h1 className="text-2xl font-bold">Resultado de Entrega WhatsApp</h1>
            <p className="text-green-100 text-sm">Acompanhe o resultado dos disparos diarios</p>
          </div>
        </div>
      </div>

      {/* Filtros */}
      <div className="bg-white rounded-xl shadow-sm border p-4 mb-6 flex items-center gap-4">
        <div>
          <label className="text-xs text-gray-500 block mb-1">Data Inicio</label>
          <input
            type="date"
            value={dateRange.inicio}
            onChange={e => setDateRange(prev => ({ ...prev, inicio: e.target.value }))}
            className="border rounded px-3 py-1.5 text-sm"
          />
        </div>
        <div>
          <label className="text-xs text-gray-500 block mb-1">Data Fim</label>
          <input
            type="date"
            value={dateRange.fim}
            onChange={e => setDateRange(prev => ({ ...prev, fim: e.target.value }))}
            className="border rounded px-3 py-1.5 text-sm"
          />
        </div>
        <button
          onClick={loadStats}
          className="bg-green-600 text-white px-4 py-1.5 rounded text-sm hover:bg-green-700 mt-4"
        >
          Atualizar
        </button>
      </div>

      {/* Cards de estatísticas */}
      {loading ? (
        <div className="text-center py-20 text-gray-400">Carregando...</div>
      ) : !stats ? (
        <div className="bg-white rounded-xl shadow-sm border p-12 text-center">
          <svg className="w-16 h-16 text-gray-300 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"/>
          </svg>
          <h3 className="text-lg font-semibold text-gray-600 mb-2">Nenhum disparo configurado</h3>
          <p className="text-gray-400 text-sm">
            Configure a instancia do WhatsApp em Configurações de Rede &gt; Disparo WhatsApp para comecar a monitorar os disparos.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <div className="bg-white rounded-xl shadow-sm border p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-500 uppercase">Total Enviadas</p>
                <p className="text-3xl font-bold text-blue-600">{stats.enviadas || 0}</p>
              </div>
              <div className="w-12 h-12 bg-blue-50 rounded-full flex items-center justify-center">
                <svg className="w-6 h-6 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"/>
                </svg>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-500 uppercase">Entregues</p>
                <p className="text-3xl font-bold text-green-600">{stats.entregues || 0}</p>
                {stats.enviadas > 0 && (
                  <p className="text-xs text-green-500">{((stats.entregues / stats.enviadas) * 100).toFixed(1)}%</p>
                )}
              </div>
              <div className="w-12 h-12 bg-green-50 rounded-full flex items-center justify-center">
                <svg className="w-6 h-6 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"/>
                </svg>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-500 uppercase">Lidas</p>
                <p className="text-3xl font-bold text-purple-600">{stats.lidas || 0}</p>
                {stats.enviadas > 0 && (
                  <p className="text-xs text-purple-500">{((stats.lidas / stats.enviadas) * 100).toFixed(1)}%</p>
                )}
              </div>
              <div className="w-12 h-12 bg-purple-50 rounded-full flex items-center justify-center">
                <svg className="w-6 h-6 text-purple-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/>
                </svg>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-500 uppercase">Falharam</p>
                <p className="text-3xl font-bold text-red-600">{stats.falharam || 0}</p>
                {stats.enviadas > 0 && (
                  <p className="text-xs text-red-500">{((stats.falharam / stats.enviadas) * 100).toFixed(1)}%</p>
                )}
              </div>
              <div className="w-12 h-12 bg-red-50 rounded-full flex items-center justify-center">
                <svg className="w-6 h-6 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"/>
                </svg>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tabela de mensagens */}
      {messages.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border mt-6">
          <div className="p-4 border-b flex items-center justify-between">
            <h3 className="font-semibold text-gray-700">Mensagens Capturadas</h3>
            <span className="text-sm text-gray-400">{messages.length} mensagens</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="text-left px-4 py-2 text-xs text-gray-500">Contato / Numero</th>
                  <th className="text-left px-4 py-2 text-xs text-gray-500">Tipo</th>
                  <th className="text-left px-4 py-2 text-xs text-gray-500">Mensagem</th>
                  <th className="text-left px-4 py-2 text-xs text-gray-500">Status</th>
                  <th className="text-left px-4 py-2 text-xs text-gray-500">Horario</th>
                  <th className="text-left px-4 py-2 text-xs text-gray-500">Enviado/Recebido</th>
                </tr>
              </thead>
              <tbody>
                {messages.map((msg, i) => (
                  <tr key={msg.id || i} className="border-t hover:bg-gray-50">
                    <td className="px-4 py-2">
                      <div className="font-medium text-gray-800">{msg.pushName || 'Desconhecido'}</div>
                      <div className="text-xs text-gray-400">{formatPhone(msg.remoteJidAlt || msg.remoteJid)}</div>
                    </td>
                    <td className="px-4 py-2 text-xs text-gray-600">
                      {msg.messageType === 'imageMessage' ? 'Imagem' :
                       msg.messageType === 'videoMessage' ? 'Video' :
                       msg.messageType === 'conversation' ? 'Texto' :
                       msg.messageType === 'audioMessage' ? 'Audio' :
                       msg.messageType || '-'}
                    </td>
                    <td className="px-4 py-2 text-xs text-gray-600 max-w-xs truncate">
                      {msg.caption || '-'}
                    </td>
                    <td className="px-4 py-2">{getStatusBadge(msg.status)}</td>
                    <td className="px-4 py-2 text-xs text-gray-500">{formatTime(msg.timestamp)}</td>
                    <td className="px-4 py-2">
                      {msg.fromMe ? (
                        <span className="text-xs text-green-600 font-medium">Enviado</span>
                      ) : (
                        <span className="text-xs text-blue-600 font-medium">Recebido</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
    </div>
    </div>
  );
}
