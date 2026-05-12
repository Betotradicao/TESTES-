import React, { useState, useEffect, useCallback, useRef } from 'react';
import Sidebar from '../components/Sidebar';
import { useAuth } from '../contexts/AuthContext';
import { api } from '../utils/api';

const API = import.meta.env.VITE_API_URL || '';

function DisparoWhatsapp() {
  const { token, user, logout } = useAuth();
  const [tab, setTab] = useState('dashboard');
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Dashboard
  const [stats, setStats] = useState(null);

  // Listas
  const [listas, setListas] = useState([]);
  const [listaFilter, setListaFilter] = useState('');

  // Contatos
  const [contatos, setContatos] = useState([]);
  const [contatosTotal, setContatosTotal] = useState(0);
  const [contatosPage, setContatosPage] = useState(1);
  const [contatosSearch, setContatosSearch] = useState('');
  const [contatosStatusFilter, setContatosStatusFilter] = useState('');
  const [showImportModal, setShowImportModal] = useState(false);
  const [importText, setImportText] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [addNome, setAddNome] = useState('');
  const [addTelefone, setAddTelefone] = useState('');
  const [selectedContatos, setSelectedContatos] = useState(new Set());
  const [sortCol, setSortCol] = useState('nome');
  const [sortDir, setSortDir] = useState('asc');
  const handleSort = (col) => {
    if (sortCol === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortCol(col); setSortDir('asc'); }
    setContatosPage(1);
  };

  // Campanhas
  const [campanhas, setCampanhas] = useState([]);
  const [showCampanhaModal, setShowCampanhaModal] = useState(false);
  const [campNome, setCampNome] = useState('');
  const [campTexto, setCampTexto] = useState('');
  const [campImagens, setCampImagens] = useState([]);
  const [campListaId, setCampListaId] = useState('');

  // Histórico
  const [selectedCampanha, setSelectedCampanha] = useState('');
  const [mensagens, setMensagens] = useState([]);
  const [mensagensTotal, setMensagensTotal] = useState(0);
  const [mensagensPage, setMensagensPage] = useState(1);
  const [mensagensStatusFilter, setMensagensStatusFilter] = useState('');

  // Entregas
  const [entregasStats, setEntregasStats] = useState(null);
  const [entregasMsgs, setEntregasMsgs] = useState([]);
  const [entregasLoading, setEntregasLoading] = useState(false);
  const [entregasDateRange, setEntregasDateRange] = useState({
    inicio: new Date().toISOString().split('T')[0],
    fim: new Date().toISOString().split('T')[0]
  });
  const [selectedEntregaMsg, setSelectedEntregaMsg] = useState(null);

  const headers = { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` };

  // ========== FETCH ==========

  const fetchListas = useCallback(async () => {
    try {
      const r = await fetch(`${API}/disparo-whatsapp/listas`, { headers });
      if (r.ok) setListas(await r.json());
    } catch (e) { console.error(e); }
  }, [token]);

  const fetchEntregas = useCallback(async () => {
    setEntregasLoading(true);
    try {
      const [statsRes, msgsRes] = await Promise.all([
        api.get('/marketing/whatsapp/stats', { params: entregasDateRange }),
        api.get('/marketing/whatsapp/messages', { params: entregasDateRange })
      ]);
      setEntregasStats(statsRes.data);
      setEntregasMsgs(msgsRes.data?.messages || []);
    } catch (e) {
      setEntregasStats(null);
      setEntregasMsgs([]);
    } finally {
      setEntregasLoading(false);
    }
  }, [entregasDateRange]);

  const fetchStats = useCallback(async () => {
    try {
      const r = await fetch(`${API}/disparo-whatsapp/stats`, { headers });
      if (r.ok) setStats(await r.json());
    } catch (e) { console.error(e); }
  }, [token]);

  const fetchContatos = useCallback(async () => {
    try {
      const params = new URLSearchParams({ page: contatosPage, limit: 50, search: contatosSearch, status: contatosStatusFilter, sortCol, sortDir, lista_id: listaFilter });
      const r = await fetch(`${API}/disparo-whatsapp/contatos?${params}`, { headers });
      if (r.ok) {
        const data = await r.json();
        setContatos(data.items);
        setContatosTotal(data.total);
      }
    } catch (e) { console.error(e); }
  }, [token, contatosPage, contatosSearch, contatosStatusFilter, sortCol, sortDir, listaFilter]);

  const fetchCampanhas = useCallback(async () => {
    try {
      const r = await fetch(`${API}/disparo-whatsapp/campanhas`, { headers });
      if (r.ok) setCampanhas(await r.json());
    } catch (e) { console.error(e); }
  }, [token]);

  const fetchMensagens = useCallback(async () => {
    if (!selectedCampanha) return;
    try {
      const params = new URLSearchParams({ page: mensagensPage, limit: 50, status: mensagensStatusFilter });
      const r = await fetch(`${API}/disparo-whatsapp/campanhas/${selectedCampanha}/messages?${params}`, { headers });
      if (r.ok) {
        const data = await r.json();
        setMensagens(data.items);
        setMensagensTotal(data.total);
      }
    } catch (e) { console.error(e); }
  }, [token, selectedCampanha, mensagensPage, mensagensStatusFilter]);

  useEffect(() => {
    fetchListas();
    if (tab === 'dashboard') fetchStats();
    if (tab === 'contatos') fetchContatos();
    if (tab === 'campanhas') fetchCampanhas();
    if (tab === 'historico') { fetchCampanhas(); fetchMensagens(); }
    if (tab === 'entregas') fetchEntregas();
  }, [tab, fetchStats, fetchContatos, fetchCampanhas, fetchMensagens]);

  // Auto-refresh stats e campanhas a cada 10s
  useEffect(() => {
    if (tab !== 'dashboard' && tab !== 'campanhas') return;
    const i = setInterval(() => {
      if (tab === 'dashboard') fetchStats();
      if (tab === 'campanhas') fetchCampanhas();
    }, 10000);
    return () => clearInterval(i);
  }, [tab]);

  // ========== ACTIONS ==========

  const handleImport = async () => {
    try {
      const lines = importText.trim().split('\n').filter(Boolean);
      const contacts = lines.map(line => {
        const parts = line.split(/[;,\t]/).map(s => s.trim());
        return { telefone: parts[0], nome: parts[1] || '' };
      });
      const r = await fetch(`${API}/disparo-whatsapp/contatos/import`, {
        method: 'POST', headers, body: JSON.stringify({ contacts })
      });
      if (r.ok) {
        const data = await r.json();
        alert(`Importados: ${data.imported} | Duplicados: ${data.duplicates}`);
        setShowImportModal(false);
        setImportText('');
        fetchContatos();
        fetchStats();
      }
    } catch (e) { alert('Erro ao importar'); }
  };

  const handleAddContact = async () => {
    if (!addTelefone) return;
    const r = await fetch(`${API}/disparo-whatsapp/contatos`, {
      method: 'POST', headers, body: JSON.stringify({ telefone: addTelefone, nome: addNome })
    });
    if (r.ok) {
      setShowAddModal(false); setAddNome(''); setAddTelefone('');
      fetchContatos(); fetchStats();
    } else {
      const err = await r.json();
      alert(err.error || 'Erro');
    }
  };

  const handleDeleteSelected = async () => {
    if (selectedContatos.size === 0) return;
    if (!confirm(`Deletar ${selectedContatos.size} contatos?`)) return;
    await fetch(`${API}/disparo-whatsapp/contatos/delete-multiple`, {
      method: 'POST', headers, body: JSON.stringify({ ids: [...selectedContatos] })
    });
    setSelectedContatos(new Set());
    fetchContatos(); fetchStats();
  };

  const handleReactivate = async (id) => {
    await fetch(`${API}/disparo-whatsapp/contatos/${id}/reactivate`, { method: 'POST', headers });
    fetchContatos();
  };

  const handleCreateCampanha = async () => {
    if (!campNome) return;
    const imagens_base64 = campImagens.map(i => i.base64);
    const body = { nome: campNome, mensagem_texto: campTexto, imagem_base64: imagens_base64.length === 1 ? imagens_base64[0] : null, imagens_base64: imagens_base64.length > 0 ? imagens_base64 : null, lista_id: campListaId ? parseInt(campListaId) : null };
    const r = await fetch(`${API}/disparo-whatsapp/campanhas`, {
      method: 'POST', headers, body: JSON.stringify(body)
    });
    if (r.ok) {
      setShowCampanhaModal(false); setCampNome(''); setCampTexto(''); setCampImagens([]); setCampListaId('');
      fetchCampanhas();
    }
  };

  const handleImageUpload = (e) => {
    const files = Array.from(e.target.files);
    if (!files.length) return;
    files.forEach(file => {
      const reader = new FileReader();
      reader.onload = (ev) => {
        const base64 = ev.target.result.split(',')[1];
        setCampImagens(prev => [...prev, { base64, preview: ev.target.result, name: file.name }]);
      };
      reader.readAsDataURL(file);
    });
    e.target.value = '';
  };

  const campaignAction = async (id, action) => {
    await fetch(`${API}/disparo-whatsapp/campanhas/${id}/${action}`, { method: 'POST', headers });
    fetchCampanhas();
  };

  const deleteCampanha = async (id) => {
    if (!confirm('Deletar campanha?')) return;
    await fetch(`${API}/disparo-whatsapp/campanhas/${id}`, { method: 'DELETE', headers });
    fetchCampanhas();
  };

  // ========== HELPERS ==========

  const statusBadge = (s) => {
    const map = {
      active: 'bg-green-100 text-green-700',
      inactive: 'bg-yellow-100 text-yellow-700',
      invalid: 'bg-red-100 text-red-700',
      draft: 'bg-gray-100 text-gray-700',
      running: 'bg-blue-100 text-blue-700',
      paused: 'bg-yellow-100 text-yellow-700',
      completed: 'bg-green-100 text-green-700',
      cancelled: 'bg-red-100 text-red-700',
      pending: 'bg-gray-100 text-gray-600',
      sent: 'bg-blue-100 text-blue-700',
      delivered: 'bg-green-100 text-green-700',
      read: 'bg-emerald-100 text-emerald-700',
      failed: 'bg-red-100 text-red-700',
    };
    const label = { active: 'Ativo', inactive: 'Inativo', invalid: 'Inválido', draft: 'Rascunho', running: 'Enviando', paused: 'Pausada', completed: 'Concluída', cancelled: 'Cancelada', pending: 'Pendente', sent: 'Enviada', delivered: 'Entregue', read: 'Lida', failed: 'Falhou' };
    return <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${map[s] || 'bg-gray-100'}`}>{label[s] || s}</span>;
  };

  const scoreBar = (score) => {
    const color = score >= 70 ? 'bg-green-500' : score >= 40 ? 'bg-yellow-500' : 'bg-red-500';
    return (
      <div className="flex items-center gap-2">
        <div className="w-16 h-2 bg-gray-200 rounded-full overflow-hidden">
          <div className={`h-full ${color} rounded-full`} style={{ width: `${score}%` }} />
        </div>
        <span className="text-xs text-gray-500">{score}</span>
      </div>
    );
  };

  const formatPhone = (t) => {
    if (!t) return '-';
    const d = t.replace(/\D/g, '');
    if (d.length >= 12) return `+${d.slice(0,2)} (${d.slice(2,4)}) ${d.slice(4,d.length-4)}-${d.slice(-4)}`;
    if (d.length === 11) return `(${d.slice(0,2)}) ${d.slice(2,7)}-${d.slice(7)}`;
    if (d.length === 10) return `(${d.slice(0,2)}) ${d.slice(2,6)}-${d.slice(6)}`;
    return d;
  };

  const formatDate = (d) => d ? new Date(d).toLocaleString('pt-BR') : '-';

  // ========== TABS ==========

  const tabs = [
    { id: 'dashboard', label: 'Dashboard', icon: '📊' },
    { id: 'contatos', label: 'Contatos', icon: '👥' },
    { id: 'campanhas', label: 'Campanhas', icon: '📤' },
    { id: 'historico', label: 'Histórico', icon: '📋' },
    { id: 'entregas', label: 'Entregas', icon: '✅' },
  ];

  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar user={user} onLogout={logout} isMobileMenuOpen={sidebarOpen} setIsMobileMenuOpen={setSidebarOpen} />
      <div className="flex-1 overflow-auto">
        {/* Header */}
        <div className="bg-gradient-to-r from-green-600 to-green-700 text-white p-6">
          <div className="flex items-center gap-3">
            <button className="md:hidden text-white" onClick={() => setSidebarOpen(true)}>
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16"/></svg>
            </button>
            <div className="w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center text-xl">📱</div>
            <div>
              <h1 className="text-2xl font-bold">DISPARO EM MASSA</h1>
              <p className="text-green-100 text-sm">Envie ofertas para seus clientes via WhatsApp</p>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b bg-white px-4">
          {tabs.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`px-4 py-3 text-sm font-medium border-b-2 transition ${tab === t.id ? 'border-green-500 text-green-700' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
              <span className="mr-1">{t.icon}</span> {t.label}
            </button>
          ))}
        </div>

        <div className="p-4 md:p-6">
          {/* ========== DASHBOARD ========== */}
          {tab === 'dashboard' && stats && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Card title="Total Contatos" value={stats.contatos.total} sub={`${stats.contatos.ativos} ativos`} color="blue" />
                <Card title="Inativos" value={stats.contatos.inativos} sub={`${stats.contatos.invalidos} inválidos`} color="yellow" />
                <Card title="Taxa Entrega" value={`${stats.taxaEntrega}%`} sub={`${stats.mensagens.entregues + stats.mensagens.lidas} de ${stats.mensagens.enviadas + stats.mensagens.entregues + stats.mensagens.lidas}`} color="green" />
                <Card title="Taxa Leitura" value={`${stats.taxaLeitura}%`} sub={`${stats.mensagens.lidas} lidas`} color="emerald" />
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Card title="Enviadas Hoje" value={3500 - stats.limiteHoje} sub={`Limite: ${stats.limiteHoje} restantes`} color="blue" />
                <Card title="Campanhas" value={stats.campanhas.total} sub={`${stats.campanhas.ativas} ativa(s)`} color="purple" />
                <Card title="Total Enviadas" value={stats.mensagens.enviadas + stats.mensagens.entregues + stats.mensagens.lidas} sub={`${stats.mensagens.falharam} falhas`} color="orange" />
                <Card title="Msgs Lidas" value={stats.mensagens.lidas} sub="total histórico" color="emerald" />
              </div>
            </div>
          )}

          {/* ========== CONTATOS ========== */}
          {tab === 'contatos' && (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center gap-3">
                <input type="text" value={contatosSearch} onChange={e => { setContatosSearch(e.target.value); setContatosPage(1); }}
                  placeholder="Buscar por nome ou telefone..." className="border rounded-lg px-3 py-2 text-sm flex-1 min-w-[200px]" />
                <select value={listaFilter} onChange={e => { setListaFilter(e.target.value); setContatosPage(1); }}
                  className="border rounded-lg px-3 py-2 text-sm">
                  <option value="">Todas as Listas</option>
                  {listas.map(l => <option key={l.id} value={l.id}>{l.nome} ({l.total_contatos})</option>)}
                </select>
                <select value={contatosStatusFilter} onChange={e => { setContatosStatusFilter(e.target.value); setContatosPage(1); }}
                  className="border rounded-lg px-3 py-2 text-sm">
                  <option value="">Todos Status</option>
                  <option value="active">Ativos</option>
                  <option value="inactive">Inativos</option>
                  <option value="invalid">Inválidos</option>
                </select>
                <button onClick={async () => {
                  if (!confirm('Sincronizar contatos do WhatsApp? Isso pode levar alguns segundos.')) return;
                  try {
                    const r = await fetch(`${API}/disparo-whatsapp/contatos/sync-whatsapp`, { method: 'POST', headers });
                    if (r.ok) {
                      const data = await r.json();
                      alert(`WhatsApp retornou ${data.total} contatos.\nImportados: ${data.imported}\nJá existiam: ${data.duplicates}`);
                      fetchContatos(); fetchStats();
                    } else {
                      const err = await r.json();
                      alert('Erro: ' + (err.error || 'Falha na sincronização'));
                    }
                  } catch (e) { alert('Erro ao sincronizar'); }
                }} className="bg-green-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-green-700 flex items-center gap-1">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/></svg>
                  Sincronizar WhatsApp
                </button>
                <button onClick={() => setShowImportModal(true)} className="bg-gray-500 text-white px-4 py-2 rounded-lg text-sm hover:bg-gray-600">Importar Manual</button>
                <button onClick={() => setShowAddModal(true)} className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-blue-700">+ Adicionar</button>
                {selectedContatos.size > 0 && (
                  <>
                    <select onChange={async e => {
                      if (!e.target.value) return;
                      await fetch(`${API}/disparo-whatsapp/contatos/move-to-list`, {
                        method: 'POST', headers, body: JSON.stringify({ ids: [...selectedContatos], lista_id: parseInt(e.target.value) })
                      });
                      setSelectedContatos(new Set());
                      fetchContatos(); fetchListas();
                      e.target.value = '';
                    }} className="border rounded-lg px-3 py-2 text-sm bg-purple-50">
                      <option value="">Mover {selectedContatos.size} para...</option>
                      {listas.map(l => <option key={l.id} value={l.id}>{l.nome}</option>)}
                    </select>
                    <button onClick={handleDeleteSelected} className="bg-red-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-red-700">
                      Excluir ({selectedContatos.size})
                    </button>
                  </>
                )}
              </div>

              <div className="text-sm text-gray-500">{contatosTotal} contatos encontrados</div>

              <div className="bg-white rounded-lg shadow overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="p-3 text-left"><input type="checkbox" onChange={e => {
                        if (e.target.checked) setSelectedContatos(new Set(contatos.map(c => c.id)));
                        else setSelectedContatos(new Set());
                      }} /></th>
                      <Th col="nome" label="Nome" align="left" sortCol={sortCol} sortDir={sortDir} onSort={handleSort} />
                      <Th col="telefone" label="Telefone" align="left" sortCol={sortCol} sortDir={sortDir} onSort={handleSort} />
                      <Th col="score" label="Score" sortCol={sortCol} sortDir={sortDir} onSort={handleSort} />
                      <Th col="status" label="Status" sortCol={sortCol} sortDir={sortDir} onSort={handleSort} />
                      <Th col="enviadas" label="Enviadas" sortCol={sortCol} sortDir={sortDir} onSort={handleSort} />
                      <Th col="lidas" label="Lidas" sortCol={sortCol} sortDir={sortDir} onSort={handleSort} />
                      <Th col="falhas" label="Falhas" sortCol={sortCol} sortDir={sortDir} onSort={handleSort} />
                      <th className="p-3 text-left">Última Interação</th>
                      <th className="p-3 text-center">Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {contatos.map(c => (
                      <tr key={c.id} className="border-t hover:bg-gray-50">
                        <td className="p-3"><input type="checkbox" checked={selectedContatos.has(c.id)}
                          onChange={e => {
                            const s = new Set(selectedContatos);
                            e.target.checked ? s.add(c.id) : s.delete(c.id);
                            setSelectedContatos(s);
                          }} /></td>
                        <td className="p-3 font-medium">{c.nome || '-'}</td>
                        <td className="p-3">{formatPhone(c.telefone)}</td>
                        <td className="p-3">{scoreBar(c.score)}</td>
                        <td className="p-3 text-center">{statusBadge(c.status)}</td>
                        <td className="p-3 text-center">{c.total_enviados}</td>
                        <td className="p-3 text-center text-green-600 font-medium">{c.total_lidos}</td>
                        <td className="p-3 text-center text-red-600">{c.total_falhas}</td>
                        <td className="p-3 text-xs text-gray-500">{formatDate(c.last_interaction_at)}</td>
                        <td className="p-3 text-center">
                          {c.status === 'inactive' && (
                            <button onClick={() => handleReactivate(c.id)} className="text-blue-600 text-xs hover:underline">Reativar</button>
                          )}
                        </td>
                      </tr>
                    ))}
                    {contatos.length === 0 && (
                      <tr><td colSpan={10} className="p-8 text-center text-gray-400">Nenhum contato encontrado</td></tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* Paginação */}
              {contatosTotal > 50 && (
                <div className="flex justify-center gap-2">
                  <button disabled={contatosPage <= 1} onClick={() => setContatosPage(p => p - 1)}
                    className="px-3 py-1 border rounded text-sm disabled:opacity-50">Anterior</button>
                  <span className="px-3 py-1 text-sm">Página {contatosPage} de {Math.ceil(contatosTotal / 50)}</span>
                  <button disabled={contatosPage >= Math.ceil(contatosTotal / 50)} onClick={() => setContatosPage(p => p + 1)}
                    className="px-3 py-1 border rounded text-sm disabled:opacity-50">Próxima</button>
                </div>
              )}
            </div>
          )}

          {/* ========== CAMPANHAS ========== */}
          {tab === 'campanhas' && (
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <h2 className="text-lg font-bold text-gray-700">Campanhas</h2>
                <button onClick={() => setShowCampanhaModal(true)} className="bg-green-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-green-700">
                  + Nova Campanha
                </button>
              </div>

              <div className="space-y-3">
                {campanhas.map(c => (
                  <div key={c.id} className="bg-white rounded-lg shadow p-4">
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <h3 className="font-bold text-gray-800">{c.nome}</h3>
                        <p className="text-xs text-gray-500">
                          Criada: {formatDate(c.created_at)}
                          {c.lista_id && listas.find(l => l.id === c.lista_id) && (
                            <span className="ml-2 px-2 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-700">
                              {listas.find(l => l.id === c.lista_id)?.nome}
                            </span>
                          )}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        {statusBadge(c.status)}
                        {c.status === 'running' && c.isRunningInMemory && (
                          <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" title="Em execução" />
                        )}
                      </div>
                    </div>

                    {/* Progress bar */}
                    {c.total_contatos > 0 && (
                      <div className="mb-3">
                        <div className="flex justify-between text-xs text-gray-500 mb-1">
                          <span>{c.enviados} / {c.total_contatos} enviados</span>
                          <span>{c.falharam} falhas</span>
                        </div>
                        <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
                          <div className="h-full bg-green-500 rounded-full transition-all" style={{ width: `${(c.enviados / c.total_contatos * 100).toFixed(0)}%` }} />
                        </div>
                        <div className="flex gap-4 mt-1 text-xs text-gray-400">
                          <span>Entregues: {c.entregues}</span>
                          <span>Lidas: {c.lidos}</span>
                        </div>
                      </div>
                    )}

                    {/* Prévia da mensagem */}
                    {c.mensagem_texto && (
                      <div className="bg-gray-50 rounded p-2 mb-3 text-xs text-gray-600 max-h-16 overflow-hidden">
                        {c.mensagem_texto.substring(0, 150)}{c.mensagem_texto.length > 150 ? '...' : ''}
                      </div>
                    )}

                    {/* Ações */}
                    <div className="flex gap-2">
                      {(c.status === 'draft' || c.status === 'paused') && (
                        <button onClick={() => campaignAction(c.id, c.status === 'draft' ? 'start' : 'resume')}
                          className="bg-green-600 text-white px-3 py-1 rounded text-xs hover:bg-green-700">
                          {c.status === 'draft' ? 'Iniciar' : 'Retomar'}
                        </button>
                      )}
                      {c.status === 'running' && (
                        <button onClick={() => campaignAction(c.id, 'pause')}
                          className="bg-yellow-500 text-white px-3 py-1 rounded text-xs hover:bg-yellow-600">Pausar</button>
                      )}
                      {(c.status === 'running' || c.status === 'paused') && (
                        <button onClick={() => campaignAction(c.id, 'cancel')}
                          className="bg-red-500 text-white px-3 py-1 rounded text-xs hover:bg-red-600">Cancelar</button>
                      )}
                      {(c.status === 'draft' || c.status === 'completed' || c.status === 'cancelled') && (
                        <button onClick={() => deleteCampanha(c.id)}
                          className="bg-gray-200 text-gray-700 px-3 py-1 rounded text-xs hover:bg-gray-300">Excluir</button>
                      )}
                      <button onClick={() => { setSelectedCampanha(c.id); setTab('historico'); }}
                        className="bg-blue-100 text-blue-700 px-3 py-1 rounded text-xs hover:bg-blue-200">Ver Mensagens</button>
                    </div>
                  </div>
                ))}
                {campanhas.length === 0 && (
                  <div className="text-center text-gray-400 py-12">Nenhuma campanha criada</div>
                )}
              </div>
            </div>
          )}

          {/* ========== HISTÓRICO ========== */}
          {tab === 'historico' && (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center gap-3">
                <select value={selectedCampanha} onChange={e => { setSelectedCampanha(e.target.value); setMensagensPage(1); }}
                  className="border rounded-lg px-3 py-2 text-sm flex-1 min-w-[200px]">
                  <option value="">Selecione uma campanha</option>
                  {campanhas.map(c => <option key={c.id} value={c.id}>{c.nome} ({c.enviados} enviadas)</option>)}
                </select>
                <select value={mensagensStatusFilter} onChange={e => { setMensagensStatusFilter(e.target.value); setMensagensPage(1); }}
                  className="border rounded-lg px-3 py-2 text-sm">
                  <option value="">Todos</option>
                  <option value="sent">Enviadas</option>
                  <option value="delivered">Entregues</option>
                  <option value="read">Lidas</option>
                  <option value="failed">Falhou</option>
                </select>
              </div>

              {selectedCampanha && (
                <>
                  <div className="text-sm text-gray-500">{mensagensTotal} mensagens</div>
                  <div className="bg-white rounded-lg shadow overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="p-3 text-left">Contato</th>
                          <th className="p-3 text-left">Telefone</th>
                          <th className="p-3 text-center">Status</th>
                          <th className="p-3 text-left">Enviada</th>
                          <th className="p-3 text-left">Entregue</th>
                          <th className="p-3 text-left">Lida</th>
                          <th className="p-3 text-left">Erro</th>
                        </tr>
                      </thead>
                      <tbody>
                        {mensagens.map(m => (
                          <tr key={m.id} className="border-t hover:bg-gray-50">
                            <td className="p-3 font-medium">{m.nome_contato || '-'}</td>
                            <td className="p-3">{formatPhone(m.telefone)}</td>
                            <td className="p-3 text-center">{statusBadge(m.status)}</td>
                            <td className="p-3 text-xs text-gray-500">{formatDate(m.sent_at)}</td>
                            <td className="p-3 text-xs text-gray-500">{formatDate(m.delivered_at)}</td>
                            <td className="p-3 text-xs text-gray-500">{formatDate(m.read_at)}</td>
                            <td className="p-3 text-xs text-red-500 max-w-[200px] truncate">{m.error_message || '-'}</td>
                          </tr>
                        ))}
                        {mensagens.length === 0 && (
                          <tr><td colSpan={7} className="p-8 text-center text-gray-400">Nenhuma mensagem</td></tr>
                        )}
                      </tbody>
                    </table>
                  </div>

                  {mensagensTotal > 50 && (
                    <div className="flex justify-center gap-2">
                      <button disabled={mensagensPage <= 1} onClick={() => setMensagensPage(p => p - 1)}
                        className="px-3 py-1 border rounded text-sm disabled:opacity-50">Anterior</button>
                      <span className="px-3 py-1 text-sm">Página {mensagensPage} de {Math.ceil(mensagensTotal / 50)}</span>
                      <button disabled={mensagensPage >= Math.ceil(mensagensTotal / 50)} onClick={() => setMensagensPage(p => p + 1)}
                        className="px-3 py-1 border rounded text-sm disabled:opacity-50">Próxima</button>
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {/* ========== ENTREGAS ========== */}
          {tab === 'entregas' && (
            <div className="space-y-4">
              <div className="bg-white rounded-xl shadow-sm border p-4 flex items-center gap-4">
                <div>
                  <label className="text-xs text-gray-500 block mb-1">Data Inicio</label>
                  <input type="date" value={entregasDateRange.inicio}
                    onChange={e => setEntregasDateRange(prev => ({ ...prev, inicio: e.target.value }))}
                    className="border rounded px-3 py-1.5 text-sm" />
                </div>
                <div>
                  <label className="text-xs text-gray-500 block mb-1">Data Fim</label>
                  <input type="date" value={entregasDateRange.fim}
                    onChange={e => setEntregasDateRange(prev => ({ ...prev, fim: e.target.value }))}
                    className="border rounded px-3 py-1.5 text-sm" />
                </div>
                <button onClick={fetchEntregas} className="bg-green-600 text-white px-4 py-1.5 rounded text-sm hover:bg-green-700 mt-4">Atualizar</button>
              </div>

              {entregasLoading ? (
                <div className="text-center py-12 text-gray-400">Carregando...</div>
              ) : !entregasStats ? (
                <div className="text-center py-12 text-gray-400">Configure a instância do WhatsApp em Configurações</div>
              ) : (
                <>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="bg-white rounded-xl shadow-sm border p-5">
                      <p className="text-xs text-gray-500 uppercase">Total Enviadas</p>
                      <p className="text-3xl font-bold text-blue-600">{entregasStats.enviadas || 0}</p>
                    </div>
                    <div className="bg-white rounded-xl shadow-sm border p-5">
                      <p className="text-xs text-gray-500 uppercase">Entregues</p>
                      <p className="text-3xl font-bold text-green-600">{entregasStats.entregues || 0}</p>
                      {entregasStats.enviadas > 0 && <p className="text-xs text-green-500">{((entregasStats.entregues / entregasStats.enviadas) * 100).toFixed(1)}%</p>}
                    </div>
                    <div className="bg-white rounded-xl shadow-sm border p-5">
                      <p className="text-xs text-gray-500 uppercase">Lidas</p>
                      <p className="text-3xl font-bold text-purple-600">{entregasStats.lidas || 0}</p>
                      {entregasStats.enviadas > 0 && <p className="text-xs text-purple-500">{((entregasStats.lidas / entregasStats.enviadas) * 100).toFixed(1)}%</p>}
                    </div>
                    <div className="bg-white rounded-xl shadow-sm border p-5">
                      <p className="text-xs text-gray-500 uppercase">Falharam</p>
                      <p className="text-3xl font-bold text-red-600">{entregasStats.falharam || 0}</p>
                      {entregasStats.enviadas > 0 && <p className="text-xs text-red-500">{((entregasStats.falharam / entregasStats.enviadas) * 100).toFixed(1)}%</p>}
                    </div>
                  </div>

                  {entregasMsgs.length > 0 && (
                    <div className="bg-white rounded-xl shadow-sm border">
                      <div className="p-4 border-b flex justify-between">
                        <h3 className="font-semibold text-gray-700">Mensagens Capturadas</h3>
                        <span className="text-sm text-gray-400">{entregasMsgs.length} mensagens</span>
                      </div>
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead className="bg-gray-50">
                            <tr>
                              <th className="text-left px-4 py-2 text-xs text-gray-500">Contato</th>
                              <th className="text-left px-4 py-2 text-xs text-gray-500">Tipo</th>
                              <th className="text-left px-4 py-2 text-xs text-gray-500">Mensagem</th>
                              <th className="text-center px-3 py-2 text-xs text-gray-500">Enviado</th>
                              <th className="text-center px-3 py-2 text-xs text-gray-500">Recebido</th>
                              <th className="text-center px-3 py-2 text-xs text-gray-500">Visualizado</th>
                              <th className="text-center px-3 py-2 text-xs text-gray-500">Falhou</th>
                              <th className="text-left px-4 py-2 text-xs text-gray-500">Horário</th>
                            </tr>
                          </thead>
                          <tbody>
                            {entregasMsgs.map((msg, i) => {
                              const phone = (msg.remoteJidAlt || msg.remoteJid || '').replace('@s.whatsapp.net', '').replace('@lid', '');
                              const fmtPhone = phone.length > 10 ? `(${phone.slice(2,4)}) ${phone.slice(4,9)}-${phone.slice(9)}` : phone;
                              return (
                                <tr key={msg.id || i} className="border-t hover:bg-gray-50">
                                  <td className="px-4 py-2">
                                    <div className="font-medium text-gray-800 text-xs">{msg.pushName || '-'}</div>
                                    <div className="text-xs text-gray-400">{fmtPhone}</div>
                                  </td>
                                  <td className="px-4 py-2 text-xs text-gray-600">
                                    {msg.messageType === 'imageMessage' ? 'Imagem' : msg.messageType === 'videoMessage' ? 'Video' : msg.messageType === 'conversation' ? 'Texto' : msg.messageType || '-'}
                                  </td>
                                  <td className="px-4 py-2 text-xs text-gray-600 max-w-xs truncate">{msg.caption || '-'}</td>
                                  <td className="px-3 py-2 text-center">
                                    {['SERVER_ACK','DELIVERY_ACK','READ','PENDING'].includes(msg.status) ? <span className="text-green-500">✔</span> : <span className="text-gray-300">—</span>}
                                  </td>
                                  <td className="px-3 py-2 text-center">
                                    {['DELIVERY_ACK','READ'].includes(msg.status) ? <span className="text-blue-500">✔✔</span> : <span className="text-gray-300">—</span>}
                                  </td>
                                  <td className="px-3 py-2 text-center">
                                    {msg.status === 'READ' ? <span className="text-blue-600">✔✔</span> : <span className="text-gray-300">—</span>}
                                  </td>
                                  <td className="px-3 py-2 text-center">
                                    {['ERROR','FAILED'].includes(msg.status) ? <span className="text-red-500">✘</span> : <span className="text-gray-300">—</span>}
                                  </td>
                                  <td className="px-4 py-2 text-xs text-gray-500">
                                    {msg.timestamp ? new Date(msg.timestamp * 1000).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : ''}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </div>

        {/* ========== MODAIS ========== */}

        {/* Modal Importar */}
        {showImportModal && (
          <Modal title="Importar Contatos" onClose={() => setShowImportModal(false)}>
            <p className="text-sm text-gray-500 mb-3">Cole os contatos, um por linha. Formato: <b>telefone;nome</b></p>
            <p className="text-xs text-gray-400 mb-2">Exemplo: 5511999998888;João Silva</p>
            <textarea value={importText} onChange={e => setImportText(e.target.value)}
              className="w-full border rounded-lg p-3 text-sm h-48 font-mono" placeholder="5511999998888;João&#10;5511888887777;Maria" />
            <div className="flex justify-end gap-2 mt-4">
              <button onClick={() => setShowImportModal(false)} className="px-4 py-2 border rounded-lg text-sm">Cancelar</button>
              <button onClick={handleImport} className="bg-green-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-green-700">
                Importar ({importText.trim().split('\n').filter(Boolean).length} contatos)
              </button>
            </div>
          </Modal>
        )}

        {/* Modal Adicionar Contato */}
        {showAddModal && (
          <Modal title="Adicionar Contato" onClose={() => setShowAddModal(false)}>
            <div className="space-y-3">
              <input type="text" value={addTelefone} onChange={e => setAddTelefone(e.target.value)}
                className="w-full border rounded-lg px-3 py-2 text-sm" placeholder="Telefone (ex: 5511999998888)" />
              <input type="text" value={addNome} onChange={e => setAddNome(e.target.value)}
                className="w-full border rounded-lg px-3 py-2 text-sm" placeholder="Nome (opcional)" />
            </div>
            <div className="flex justify-end gap-2 mt-4">
              <button onClick={() => setShowAddModal(false)} className="px-4 py-2 border rounded-lg text-sm">Cancelar</button>
              <button onClick={handleAddContact} className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-blue-700">Adicionar</button>
            </div>
          </Modal>
        )}

        {/* Modal Nova Campanha */}
        {showCampanhaModal && (
          <Modal title="Nova Campanha" onClose={() => setShowCampanhaModal(false)}>
            <div className="space-y-3">
              <input type="text" value={campNome} onChange={e => setCampNome(e.target.value)}
                className="w-full border rounded-lg px-3 py-2 text-sm" placeholder="Nome da campanha (ex: Oferta Terça 19/03)" />
              <div>
                <label className="text-sm text-gray-600 block mb-1">Enviar para lista</label>
                <select value={campListaId} onChange={e => setCampListaId(e.target.value)}
                  className="w-full border rounded-lg px-3 py-2 text-sm">
                  <option value="">Todos os contatos</option>
                  {listas.map(l => <option key={l.id} value={l.id}>{l.nome} ({l.total_contatos} contatos)</option>)}
                </select>
              </div>
              <textarea value={campTexto} onChange={e => setCampTexto(e.target.value)}
                className="w-full border rounded-lg p-3 text-sm h-32" placeholder="Texto da mensagem..." />
              <div>
                <label className="text-sm text-gray-600 block mb-1">Imagens (opcional — pode selecionar várias)</label>
                <input type="file" accept="image/*" multiple onChange={handleImageUpload} className="text-sm" />
                {campImagens.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-2">
                    {campImagens.map((img, i) => (
                      <div key={i} className="relative">
                        <img src={img.preview} alt={img.name} className="h-20 rounded border" />
                        <button onClick={() => setCampImagens(prev => prev.filter((_, j) => j !== i))}
                          className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full w-5 h-5 text-xs flex items-center justify-center">&times;</button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-4">
              <button onClick={() => setShowCampanhaModal(false)} className="px-4 py-2 border rounded-lg text-sm">Cancelar</button>
              <button onClick={handleCreateCampanha} className="bg-green-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-green-700">Criar Campanha</button>
            </div>
          </Modal>
        )}
      </div>
    </div>
  );
}

// ========== COMPONENTES ==========

function Th({ col, label, align = 'center', sortCol, sortDir, onSort }) {
  const active = sortCol === col;
  return (
    <th className={`p-3 text-${align} cursor-pointer select-none hover:bg-gray-100 transition`}
      onClick={() => onSort(col)}>
      <span className={active ? 'text-orange-600 font-bold' : ''}>
        {label} {active ? (sortDir === 'asc' ? '▲' : '▼') : '⇅'}
      </span>
    </th>
  );
}

function Card({ title, value, sub, color }) {
  const colors = {
    blue: 'border-blue-500 bg-blue-50',
    green: 'border-green-500 bg-green-50',
    emerald: 'border-emerald-500 bg-emerald-50',
    yellow: 'border-yellow-500 bg-yellow-50',
    red: 'border-red-500 bg-red-50',
    purple: 'border-purple-500 bg-purple-50',
    orange: 'border-orange-500 bg-orange-50',
  };
  return (
    <div className={`rounded-lg border-l-4 p-4 ${colors[color] || colors.blue}`}>
      <p className="text-xs text-gray-500 uppercase">{title}</p>
      <p className="text-2xl font-bold text-gray-800 mt-1">{value}</p>
      <p className="text-xs text-gray-400 mt-1">{sub}</p>
    </div>
  );
}

function Modal({ title, children, onClose }) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg p-6" onClick={e => e.stopPropagation()}>
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-bold text-gray-800">{title}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl">&times;</button>
        </div>
        {children}
      </div>
    </div>
  );
}

export default DisparoWhatsapp;
