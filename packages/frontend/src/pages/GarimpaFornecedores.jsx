import { useState, useEffect, useCallback } from 'react';
import Layout from '../components/Layout';
import { api } from '../utils/api';

export default function GarimpaFornecedores() {
  const [contatos, setContatos] = useState([]);
  const [contatoSelecionado, setContatoSelecionado] = useState(null);
  const [mensagens, setMensagens] = useState([]);
  const [totalMensagens, setTotalMensagens] = useState(0);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(false);
  const [loadingMsgs, setLoadingMsgs] = useState(false);
  const [busca, setBusca] = useState('');
  const [filtroTipo, setFiltroTipo] = useState('todos');
  const [page, setPage] = useState(1);

  // Buscar contatos
  const fetchContatos = useCallback(async () => {
    try {
      setLoading(true);
      const { data } = await api.get('/garimpador/contatos');
      setContatos(data);
    } catch (err) {
      console.error('Erro ao buscar contatos:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  // Buscar estatísticas
  const fetchStats = useCallback(async () => {
    try {
      const { data } = await api.get('/garimpador/estatisticas');
      setStats(data);
    } catch (err) {
      console.error('Erro ao buscar stats:', err);
    }
  }, []);

  // Buscar mensagens do contato selecionado
  const fetchMensagens = useCallback(async (contatoId, pg = 1) => {
    if (!contatoId) return;
    try {
      setLoadingMsgs(true);
      const { data } = await api.get('/garimpador/mensagens', {
        params: { contatoId, page: pg, limit: 50 }
      });
      setMensagens(data.mensagens);
      setTotalMensagens(data.total);
    } catch (err) {
      console.error('Erro ao buscar mensagens:', err);
    } finally {
      setLoadingMsgs(false);
    }
  }, []);

  useEffect(() => {
    fetchContatos();
    fetchStats();
  }, []);

  // Quando seleciona contato, busca mensagens
  useEffect(() => {
    if (contatoSelecionado) {
      setPage(1);
      fetchMensagens(contatoSelecionado.id, 1);
    } else {
      setMensagens([]);
      setTotalMensagens(0);
    }
  }, [contatoSelecionado]);

  // Atualizar tipo do contato
  const handleTipoChange = async (contatoId, novoTipo) => {
    try {
      await api.put(`/garimpador/contatos/${contatoId}/tipo`, { tipo: novoTipo });
      // Atualizar local
      setContatos(prev => prev.map(c =>
        c.id === contatoId ? { ...c, tipo: novoTipo } : c
      ));
      fetchStats();
    } catch (err) {
      console.error('Erro ao atualizar tipo:', err);
    }
  };

  // Filtrar contatos
  const contatosFiltrados = contatos.filter(c => {
    const matchBusca = !busca ||
      (c.nome || '').toLowerCase().includes(busca.toLowerCase()) ||
      c.telefone.includes(busca);
    const matchTipo = filtroTipo === 'todos' || c.tipo === filtroTipo;
    return matchBusca && matchTipo;
  });

  // Formatar telefone
  const formatTelefone = (tel) => {
    if (!tel) return '';
    // Remove group suffix
    if (tel.includes('-')) return tel;
    // Format BR phone
    if (tel.length === 13 && tel.startsWith('55')) {
      return `+${tel.slice(0,2)} (${tel.slice(2,4)}) ${tel.slice(4,9)}-${tel.slice(9)}`;
    }
    return tel;
  };

  // Formatar data
  const formatData = (dt) => {
    if (!dt) return '';
    const d = new Date(dt);
    return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
  };

  // Ícone de tipo de mídia
  const iconMidia = (tipo) => {
    switch (tipo) {
      case 'imagem': return '🖼️';
      case 'audio': return '🎵';
      case 'documento': return '📄';
      default: return '💬';
    }
  };

  const totalPages = Math.ceil(totalMensagens / 50);

  return (
    <Layout>
      <div className="space-y-4">
        {/* Header */}
        <div className="bg-gradient-to-br from-orange-500 to-amber-600 rounded-lg shadow-lg p-4 sm:p-6 text-white">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl lg:text-2xl font-bold">Fornecedores e Concorrentes</h1>
              <p className="text-orange-100 mt-1 text-sm">Garimpa Facil - Mensagens recebidas via WhatsApp</p>
            </div>
            <div className="flex items-center gap-3">
              {stats && (
                <div className="hidden sm:flex gap-3 text-xs">
                  <div className="bg-white/20 backdrop-blur-sm rounded-lg px-3 py-1.5 text-center">
                    <div className="font-bold text-lg">{stats.totalContatos}</div>
                    <div className="text-orange-100">Contatos</div>
                  </div>
                  <div className="bg-white/20 backdrop-blur-sm rounded-lg px-3 py-1.5 text-center">
                    <div className="font-bold text-lg">{stats.totalMensagens}</div>
                    <div className="text-orange-100">Mensagens</div>
                  </div>
                  <div className="bg-white/20 backdrop-blur-sm rounded-lg px-3 py-1.5 text-center">
                    <div className="font-bold text-lg">{stats.naoClassificados}</div>
                    <div className="text-orange-100">Pendentes</div>
                  </div>
                </div>
              )}
              <button
                onClick={() => { fetchContatos(); fetchStats(); }}
                className="bg-white/20 backdrop-blur-sm rounded-full p-2.5 hover:bg-white/30 transition-colors"
                title="Atualizar"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/>
                </svg>
              </button>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Lista de Contatos */}
          <div className="lg:col-span-1 bg-white rounded-lg shadow overflow-hidden">
            <div className="p-3 border-b bg-gray-50">
              <h2 className="font-semibold text-gray-800 text-sm mb-2">Contatos</h2>
              {/* Busca */}
              <input
                type="text"
                placeholder="Buscar por nome ou telefone..."
                value={busca}
                onChange={e => setBusca(e.target.value)}
                className="w-full px-3 py-1.5 border rounded-lg text-sm focus:ring-2 focus:ring-orange-300 focus:outline-none"
              />
              {/* Filtro por tipo */}
              <div className="flex gap-1 mt-2">
                {[
                  { val: 'nao_classificado', label: 'Pendentes', color: 'yellow', count: stats?.naoClassificados || 0 },
                  { val: 'fornecedor', label: 'Fornecedor', color: 'blue', count: stats?.fornecedores || 0 },
                  { val: 'concorrente', label: 'Concorrente', color: 'red', count: stats?.concorrentes || 0 },
                  { val: 'todos', label: 'Todos', color: 'gray', count: stats?.totalContatos || 0 },
                ].map(f => (
                  <button
                    key={f.val}
                    onClick={() => setFiltroTipo(f.val)}
                    className={`flex-1 text-xs py-1.5 rounded-md transition-colors flex flex-col items-center ${
                      filtroTipo === f.val
                        ? f.color === 'gray' ? 'bg-gray-600 text-white'
                        : f.color === 'yellow' ? 'bg-yellow-500 text-white'
                        : f.color === 'blue' ? 'bg-blue-500 text-white'
                        : 'bg-red-500 text-white'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    <span>{f.label}</span>
                    <span className="font-bold text-[10px]">{f.count}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Lista */}
            <div className="max-h-[calc(100vh-320px)] overflow-y-auto divide-y">
              {loading ? (
                <div className="p-8 text-center text-gray-400">
                  <div className="animate-spin w-6 h-6 border-2 border-orange-500 border-t-transparent rounded-full mx-auto mb-2"></div>
                  Carregando...
                </div>
              ) : contatosFiltrados.length === 0 ? (
                <div className="p-8 text-center text-gray-400 text-sm">
                  {contatos.length === 0
                    ? 'Nenhum contato recebido ainda. Configure o webhook da Evolution API.'
                    : 'Nenhum contato encontrado com esse filtro.'
                  }
                </div>
              ) : (
                contatosFiltrados.map(contato => (
                  <div
                    key={contato.id}
                    onClick={() => setContatoSelecionado(contato)}
                    className={`p-3 cursor-pointer hover:bg-orange-50 transition-colors ${
                      contatoSelecionado?.id === contato.id ? 'bg-orange-50 border-l-4 border-orange-500' : ''
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      {/* Foto de perfil */}
                      <div className="w-10 h-10 rounded-full bg-gray-200 flex-shrink-0 overflow-hidden flex items-center justify-center">
                        {contato.fotoUrl ? (
                          <img src={contato.fotoUrl} alt="" className="w-full h-full object-cover" onError={(e) => { e.target.style.display='none'; e.target.nextSibling.style.display='flex'; }} />
                        ) : null}
                        <div className={`w-full h-full items-center justify-center text-white text-sm font-bold ${contato.fotoUrl ? 'hidden' : 'flex'}`} style={{ background: `hsl(${(contato.telefone || '').split('').reduce((a,c) => a + c.charCodeAt(0), 0) % 360}, 60%, 50%)` }}>
                          {(contato.nome || contato.telefone || '?').charAt(0).toUpperCase()}
                        </div>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-sm text-gray-900 truncate">
                          {contato.nome || formatTelefone(contato.telefone)}
                        </div>
                        {contato.nome && (
                          <div className="text-xs text-gray-400 truncate">{formatTelefone(contato.telefone)}</div>
                        )}
                        <div className="text-xs text-gray-400 mt-0.5">
                          {contato.totalMensagens} msgs
                          {contato.ultimaMensagem && ` - ${formatData(contato.ultimaMensagem)}`}
                        </div>
                      </div>
                      {/* Badge de tipo */}
                      <span className={`text-xs px-2 py-0.5 rounded-full whitespace-nowrap ${
                        contato.tipo === 'fornecedor' ? 'bg-blue-100 text-blue-700' :
                        contato.tipo === 'concorrente' ? 'bg-red-100 text-red-700' :
                        'bg-yellow-100 text-yellow-700'
                      }`}>
                        {contato.tipo === 'fornecedor' ? 'Fornec.' :
                         contato.tipo === 'concorrente' ? 'Concorr.' : 'Pendente'}
                      </span>
                    </div>

                    {/* Radio buttons de classificação */}
                    <div className="flex gap-4 mt-2" onClick={e => e.stopPropagation()}>
                      <label className="flex items-center gap-1.5 text-xs cursor-pointer">
                        <input
                          type="radio"
                          name={`tipo-${contato.id}`}
                          checked={contato.tipo === 'fornecedor'}
                          onChange={() => handleTipoChange(contato.id, 'fornecedor')}
                          className="text-blue-500 focus:ring-blue-400"
                        />
                        <span className="text-gray-600">Fornecedor</span>
                      </label>
                      <label className="flex items-center gap-1.5 text-xs cursor-pointer">
                        <input
                          type="radio"
                          name={`tipo-${contato.id}`}
                          checked={contato.tipo === 'concorrente'}
                          onChange={() => handleTipoChange(contato.id, 'concorrente')}
                          className="text-red-500 focus:ring-red-400"
                        />
                        <span className="text-gray-600">Concorrente</span>
                      </label>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Mensagens do Contato */}
          <div className="lg:col-span-2 bg-white rounded-lg shadow overflow-hidden">
            <div className="p-3 border-b bg-gray-50 flex items-center justify-between">
              <div>
                <h2 className="font-semibold text-gray-800 text-sm">
                  {contatoSelecionado
                    ? `Mensagens de ${contatoSelecionado.nome || formatTelefone(contatoSelecionado.telefone)}`
                    : 'Mensagens'
                  }
                </h2>
                {contatoSelecionado && (
                  <p className="text-xs text-gray-500">{totalMensagens} mensagem(ns)</p>
                )}
              </div>
              {contatoSelecionado && (
                <span className={`text-xs px-2 py-0.5 rounded-full ${
                  contatoSelecionado.tipo === 'fornecedor' ? 'bg-blue-100 text-blue-700' :
                  contatoSelecionado.tipo === 'concorrente' ? 'bg-red-100 text-red-700' :
                  'bg-yellow-100 text-yellow-700'
                }`}>
                  {contatoSelecionado.tipo === 'fornecedor' ? 'Fornecedor' :
                   contatoSelecionado.tipo === 'concorrente' ? 'Concorrente' : 'Nao classificado'}
                </span>
              )}
            </div>

            <div className="max-h-[calc(100vh-320px)] overflow-y-auto">
              {!contatoSelecionado ? (
                <div className="p-12 text-center text-gray-400">
                  <svg className="w-12 h-12 mx-auto mb-3 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"/>
                  </svg>
                  <p className="text-sm">Selecione um contato para ver as mensagens</p>
                </div>
              ) : loadingMsgs ? (
                <div className="p-8 text-center text-gray-400">
                  <div className="animate-spin w-6 h-6 border-2 border-orange-500 border-t-transparent rounded-full mx-auto mb-2"></div>
                  Carregando mensagens...
                </div>
              ) : mensagens.length === 0 ? (
                <div className="p-8 text-center text-gray-400 text-sm">
                  Nenhuma mensagem encontrada
                </div>
              ) : (
                <div className="divide-y">
                  {mensagens.map(msg => (
                    <div key={msg.id} className="p-3 hover:bg-gray-50">
                      <div className="flex items-start gap-2">
                        <span className="text-lg" title={msg.tipo_midia}>{iconMidia(msg.tipo_midia)}</span>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-xs text-gray-400">
                              {formatData(msg.received_at)}
                            </span>
                            {msg.sender_name && (
                              <span className="text-xs text-gray-500 font-medium">{msg.sender_name}</span>
                            )}
                            {msg.processado && (
                              <span className="text-xs bg-green-100 text-green-700 px-1.5 py-0.5 rounded">Processado</span>
                            )}
                          </div>
                          {/* Conteúdo */}
                          {/* Imagem */}
                          {msg.tipo_midia === 'imagem' && msg.media_url && (
                            <div className="mt-1 mb-2">
                              <img
                                src={msg.media_url}
                                alt="Imagem recebida"
                                className="max-w-xs max-h-64 rounded-lg border border-gray-200 cursor-pointer hover:opacity-90 transition"
                                onClick={() => window.open(msg.media_url, '_blank')}
                                onError={(e) => { e.target.style.display = 'none'; e.target.nextSibling.style.display = 'block'; }}
                              />
                              <p className="text-xs text-gray-400 italic hidden">[Imagem expirada ou indisponivel]</p>
                            </div>
                          )}
                          {msg.tipo_midia === 'imagem' && !msg.media_url && (
                            <p className="text-sm text-gray-400 italic">[Imagem sem URL]</p>
                          )}
                          {/* Texto */}
                          {msg.conteudo_original && (
                            <p className="text-sm text-gray-800 whitespace-pre-wrap break-words">
                              {msg.conteudo_original}
                            </p>
                          )}
                          {msg.tipo_midia === 'imagem' && !msg.conteudo_original && !msg.media_url && (
                            <p className="text-sm text-gray-400 italic">[Imagem sem legenda]</p>
                          )}
                          {msg.tipo_midia === 'audio' && (
                            <p className="text-sm text-gray-400 italic">[Mensagem de audio]</p>
                          )}
                          {msg.tipo_midia === 'documento' && (
                            <p className="text-sm text-gray-400 italic">[Documento recebido]</p>
                          )}
                          {msg.conteudo_extraido && (
                            <div className="mt-1 p-2 bg-blue-50 rounded text-xs text-blue-800">
                              <span className="font-medium">Texto extraido:</span> {msg.conteudo_extraido}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}

                  {/* Paginação */}
                  {totalPages > 1 && (
                    <div className="p-3 flex items-center justify-center gap-2">
                      <button
                        onClick={() => { const p = page - 1; setPage(p); fetchMensagens(contatoSelecionado.id, p); }}
                        disabled={page <= 1}
                        className="px-3 py-1 text-xs rounded bg-gray-100 hover:bg-gray-200 disabled:opacity-50"
                      >
                        Anterior
                      </button>
                      <span className="text-xs text-gray-500">Pagina {page} de {totalPages}</span>
                      <button
                        onClick={() => { const p = page + 1; setPage(p); fetchMensagens(contatoSelecionado.id, p); }}
                        disabled={page >= totalPages}
                        className="px-3 py-1 text-xs rounded bg-gray-100 hover:bg-gray-200 disabled:opacity-50"
                      >
                        Proxima
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}
