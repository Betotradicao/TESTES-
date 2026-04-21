import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useLoja } from '../../contexts/LojaContext';
import Sidebar from '../../components/Sidebar';
import api from '../../utils/api';
import { AlternativaIcon } from './ChecklistIcons';
import ChecklistQuestionModal from './ChecklistQuestionModal';

export default function ChecklistTemplates() {
  const { user, logout } = useAuth();
  const { lojaSelecionada } = useLoja();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [templates, setTemplates] = useState([]);
  const [modelos, setModelos] = useState([]);
  const [auditores, setAuditores] = useState([]);
  const [auditados, setAuditados] = useState([]);
  const [setores, setSetores] = useState([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState('');
  const [sucesso, setSucesso] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [formData, setFormData] = useState({ nome: '', observacao: '', minimo_esperado: 95, ativo: true, grupos_acesso: [], grupos_acesso_auditados: [], whatsapp_group_pdf_id: null, whatsapp_group_pdf_name: null });

  // Grupos WhatsApp (para o seletor de envio do PDF no template)
  const [whatsappGroups, setWhatsappGroups] = useState(() => {
    try { return JSON.parse(sessionStorage.getItem('wa_groups_cache') || '[]'); } catch { return []; }
  });
  const [loadingWaGroups, setLoadingWaGroups] = useState(false);
  const carregarGruposWA = async (forceRefresh = false) => {
    if (!forceRefresh && whatsappGroups.length > 0) return;
    setLoadingWaGroups(true);
    try {
      const res = await api.get('/whatsapp/fetch-groups');
      if (res.data?.success && Array.isArray(res.data.data)) {
        setWhatsappGroups(res.data.data);
        try { sessionStorage.setItem('wa_groups_cache', JSON.stringify(res.data.data)); } catch {}
      }
    } catch {}
    finally { setLoadingWaGroups(false); }
  };
  const [questionModal, setQuestionModal] = useState(null); // { section_id, question|null }
  const [filtroStatus, setFiltroStatus] = useState('ativos'); // ativos | inativos | ambos
  const [autoSaveStatus, setAutoSaveStatus] = useState(''); // '', 'saving', 'saved'
  const autoSaveTimer = useRef(null);
  const skipNextAutoSave = useRef(false);

  useEffect(() => {
    carregar();
    // eslint-disable-next-line
  }, [lojaSelecionada]);

  // Recarrega listas filtradas por loja sempre que a loja selecionada mudar
  useEffect(() => {
    const qs = lojaSelecionada != null ? `?cod_loja=${lojaSelecionada}` : '';
    Promise.all([
      api.get('/checklist/modelos').then(r => setModelos(r.data?.modelos || [])),
      api.get(`/checklist/auditores${qs}`).then(r => setAuditores(r.data?.auditores || [])),
      api.get(`/checklist/auditados${qs}`).then(r => setAuditados(r.data?.auditados || [])),
      api.get(`/checklist/setores${qs}`).then(r => setSetores(r.data?.setores || [])),
    ]).catch(() => {});
  }, [lojaSelecionada]);

  const flash = (txt) => { setSucesso(txt); setTimeout(() => setSucesso(''), 2500); };

  const carregar = async () => {
    setLoading(true);
    try {
      const qs = lojaSelecionada != null ? `?cod_loja=${lojaSelecionada}` : '';
      const res = await api.get(`/checklist/templates${qs}`);
      setTemplates(res.data?.templates || []);
    } catch (e) {
      setErro(e?.response?.data?.error || e.message);
    } finally {
      setLoading(false);
    }
  };

  const abrirNovo = () => {
    setEditing(null);
    setFormData({ nome: '', observacao: '', minimo_esperado: 95, ativo: true, grupos_acesso: [], grupos_acesso_auditados: [], whatsapp_group_pdf_id: null, whatsapp_group_pdf_name: null });
    setShowForm(true);
    carregarGruposWA(false);
  };

  const abrirEdicao = async (id) => {
    try {
      const res = await api.get(`/checklist/templates/${id}`);
      const t = res.data?.template;
      setEditing(t);
      skipNextAutoSave.current = true; // primeiro setFormData nao dispara autosave
      setFormData({
        nome: t.nome,
        observacao: t.observacao || '',
        minimo_esperado: Number(t.minimo_esperado) || 95,
        ativo: t.ativo,
        grupos_acesso: Array.isArray(t.grupos_acesso) ? t.grupos_acesso : [],
        grupos_acesso_auditados: Array.isArray(t.grupos_acesso_auditados) ? t.grupos_acesso_auditados : [],
        whatsapp_group_pdf_id: t.whatsapp_group_pdf_id || null,
        whatsapp_group_pdf_name: t.whatsapp_group_pdf_name || null,
      });
      setShowForm(true);
      carregarGruposWA(false);
    } catch (e) { setErro(e?.response?.data?.error || e.message); }
  };

  // Auto-save template (debounce 600ms) sempre que formData muda e ha um template em edicao
  useEffect(() => {
    if (!editing) return;
    if (skipNextAutoSave.current) { skipNextAutoSave.current = false; return; }
    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    autoSaveTimer.current = setTimeout(async () => {
      try {
        setAutoSaveStatus('saving');
        await api.put(`/checklist/templates/${editing.id}`, formData);
        setAutoSaveStatus('saved');
        setTimeout(() => setAutoSaveStatus(''), 1500);
      } catch (e) {
        setErro(e?.response?.data?.error || e.message);
        setAutoSaveStatus('');
      }
    }, 600);
    return () => autoSaveTimer.current && clearTimeout(autoSaveTimer.current);
    // eslint-disable-next-line
  }, [formData]);

  const salvarTemplate = async () => {
    if (!formData.nome.trim()) { setErro('Nome obrigatório'); return; }
    try {
      // Sempre envia cod_loja da loja atual (preserva no update se ja houver)
      const payload = { ...formData };
      if (!editing && lojaSelecionada != null) {
        payload.cod_loja = lojaSelecionada;
      }
      if (editing) {
        await api.put(`/checklist/templates/${editing.id}`, payload);
        flash('Template atualizado');
      } else {
        const res = await api.post('/checklist/templates', payload);
        setEditing({ ...res.data.template, sections: [] });
        flash('Template criado');
      }
      await carregar();
      setErro('');
    } catch (e) { setErro(e?.response?.data?.error || e.message); }
  };

  const deletarTemplate = async (id) => {
    if (!confirm('Excluir template?\n\nSe já tiver auditorias aplicadas, será apenas marcado como inativo pra preservar o histórico.')) return;
    try {
      const res = await api.delete(`/checklist/templates/${id}`);
      await carregar();
      setShowForm(false);
      if (res.data?.softDelete) flash(res.data.message || 'Template marcado como inativo');
      else flash('Template excluído');
    } catch (e) { setErro(e?.response?.data?.error || e.message); }
  };

  const addSection = async () => {
    const raw = prompt('Nome da seção (ex: AÇOUGUE, PADARIA)');
    if (!raw) return;
    const nome = raw.trim().toUpperCase();
    if (!nome) return;
    try {
      await api.post(`/checklist/templates/${editing.id}/sections`, { nome, ordem: (editing.sections?.length || 0) + 1 });
      await recarregarEdicao();
    } catch (e) { setErro(e?.response?.data?.error || e.message); }
  };

  const removerSection = async (sId) => {
    if (!confirm('Excluir seção e perguntas?')) return;
    try { await api.delete(`/checklist/sections/${sId}`); await recarregarEdicao(); }
    catch (e) { setErro(e?.response?.data?.error || e.message); }
  };

  const renomearSection = async (s) => {
    const raw = prompt('Novo nome da seção:', s.nome);
    if (!raw) return;
    const novoNome = raw.trim().toUpperCase();
    if (!novoNome || novoNome === s.nome) return;
    try { await api.put(`/checklist/sections/${s.id}`, { nome: novoNome }); await recarregarEdicao(); }
    catch (e) { setErro(e?.response?.data?.error || e.message); }
  };

  const removerQuestion = async (qId) => {
    if (!confirm('Excluir pergunta?')) return;
    try { await api.delete(`/checklist/questions/${qId}`); await recarregarEdicao(); }
    catch (e) { setErro(e?.response?.data?.error || e.message); }
  };

  const recarregarEdicao = async () => {
    if (!editing) return;
    const res = await api.get(`/checklist/templates/${editing.id}`);
    setEditing(res.data?.template);
  };

  const toggleGrupoAcesso = (empId) => {
    setFormData(fd => ({
      ...fd,
      grupos_acesso: fd.grupos_acesso.includes(empId)
        ? fd.grupos_acesso.filter(x => x !== empId)
        : [...fd.grupos_acesso, empId],
    }));
  };

  const toggleGrupoAuditados = (empId) => {
    setFormData(fd => ({
      ...fd,
      grupos_acesso_auditados: fd.grupos_acesso_auditados.includes(empId)
        ? fd.grupos_acesso_auditados.filter(x => x !== empId)
        : [...fd.grupos_acesso_auditados, empId],
    }));
  };

  const getModeloDaQuestao = (q) => modelos.find(m => m.id === q.modelo_alternativa_id);

  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar user={user} onLogout={logout} isMobileMenuOpen={isMobileMenuOpen} setIsMobileMenuOpen={setIsMobileMenuOpen} />
      <div className="flex-1 min-w-0 overflow-auto overflow-x-hidden">
        <div className="bg-gradient-to-r from-teal-500 to-teal-600 text-white p-4 shadow">
          <div className="flex items-center gap-3">
            <button onClick={() => setIsMobileMenuOpen(true)}
              className="lg:hidden bg-white/20 hover:bg-white/30 rounded-lg p-2 transition">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16"/>
              </svg>
            </button>
            <div className="flex-1 min-w-0">
              <h1 className="text-xl sm:text-2xl font-bold">✅ Templates</h1>
              <p className="text-xs sm:text-sm opacity-90">Roteiros de auditoria (seções e perguntas)</p>
            </div>
          </div>
        </div>

        <div className="p-6">
          {erro && <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded text-sm">{erro}</div>}
          {sucesso && <div className="mb-4 p-3 bg-green-50 border border-green-200 text-green-700 rounded text-sm">{sucesso}</div>}

          {!showForm && (() => {
            const templatesFiltrados = templates.filter(t =>
              filtroStatus === 'ambos' ? true :
              filtroStatus === 'ativos' ? t.ativo :
              !t.ativo
            );
            const counts = {
              ativos: templates.filter(t => t.ativo).length,
              inativos: templates.filter(t => !t.ativo).length,
            };
            return (
            <>
              <div className="mb-4 flex justify-between items-center flex-wrap gap-3">
                <div className="flex items-center gap-3 flex-wrap">
                  <h2 className="text-lg font-semibold text-gray-700">{templatesFiltrados.length} template(s)</h2>
                  <div className="inline-flex bg-gray-100 rounded-lg p-1 text-sm">
                    <button onClick={() => setFiltroStatus('ativos')}
                      className={`px-3 py-1.5 rounded-md font-medium transition ${filtroStatus === 'ativos' ? 'bg-white text-teal-700 shadow-sm' : 'text-gray-600 hover:text-gray-800'}`}>
                      ✓ Ativos <span className="text-xs opacity-70">({counts.ativos})</span>
                    </button>
                    <button onClick={() => setFiltroStatus('inativos')}
                      className={`px-3 py-1.5 rounded-md font-medium transition ${filtroStatus === 'inativos' ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-600 hover:text-gray-800'}`}>
                      ✗ Inativos <span className="text-xs opacity-70">({counts.inativos})</span>
                    </button>
                    <button onClick={() => setFiltroStatus('ambos')}
                      className={`px-3 py-1.5 rounded-md font-medium transition ${filtroStatus === 'ambos' ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-600 hover:text-gray-800'}`}>
                      Ambos <span className="text-xs opacity-70">({templates.length})</span>
                    </button>
                  </div>
                </div>
                <button onClick={abrirNovo} className="px-4 py-2 bg-teal-500 text-white rounded hover:bg-teal-600 font-medium">
                  + Novo Template
                </button>
              </div>
              {loading ? (
                <div className="text-gray-500 py-10 text-center">Carregando…</div>
              ) : templatesFiltrados.length === 0 ? (
                <div className="text-gray-500 py-10 text-center italic">
                  {templates.length === 0 ? 'Nenhum template cadastrado' : `Nenhum template ${filtroStatus === 'ativos' ? 'ativo' : 'inativo'}`}
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {templatesFiltrados.map(t => (
                    <div key={t.id} className="bg-white border rounded-lg p-4 hover:shadow-md transition">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <h3 className="font-semibold text-gray-800">{t.nome}</h3>
                          {t.observacao && <p className="text-xs text-gray-500 mt-1">{t.observacao}</p>}
                          <p className="text-xs text-gray-400 mt-2">Mínimo esperado: <strong>{Number(t.minimo_esperado || 95).toFixed(0)}%</strong></p>
                        </div>
                        <span className={`text-xs px-2 py-0.5 rounded ${t.ativo ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                          {t.ativo ? 'Ativo' : 'Inativo'}
                        </span>
                      </div>
                      <div className="mt-3 flex gap-2">
                        <button onClick={() => abrirEdicao(t.id)} className="flex-1 text-sm px-3 py-1.5 bg-teal-50 text-teal-700 rounded hover:bg-teal-100">Editar</button>
                        <button onClick={() => deletarTemplate(t.id)} className="text-sm px-3 py-1.5 bg-red-50 text-red-600 rounded hover:bg-red-100">🗑</button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
            );
          })()}

          {showForm && (
            <div className="bg-white rounded-lg border p-5 max-w-5xl">
              <div className="flex justify-between items-center mb-4 border-b pb-3">
                <h2 className="text-xl font-semibold text-gray-800">
                  {editing ? `Editar: ${editing.nome}` : 'Novo Template'}
                </h2>
                <button onClick={() => { setShowForm(false); setEditing(null); carregar(); }} className="text-gray-500 hover:text-gray-700">
                  ← Voltar à lista
                </button>
              </div>

              {/* Dados do Questionário */}
              <div className="bg-gray-50 border rounded p-4 mb-4">
                <h3 className="text-sm font-semibold text-gray-700 mb-3">Dados do Questionário</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">*Nome do Questionário</label>
                    <input type="text" value={formData.nome} onChange={e => setFormData({ ...formData, nome: e.target.value })}
                      className="w-full border rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">*Mínimo Esperado (%)</label>
                    <div className="flex items-center gap-2">
                      <input type="number" min="0" max="100" value={formData.minimo_esperado}
                        onChange={e => setFormData({ ...formData, minimo_esperado: parseInt(e.target.value) || 0 })}
                        className="w-24 border rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500" />
                      <span className="text-sm text-gray-500">%</span>
                      <span className="text-xs text-gray-500 ml-2">Valor mínimo tolerável de conformidade</span>
                    </div>
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-xs font-medium text-gray-700 mb-1">Observação</label>
                    <textarea value={formData.observacao} onChange={e => setFormData({ ...formData, observacao: e.target.value })}
                      rows={2} className="w-full border rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500" />
                  </div>

                  {/* Grupo WhatsApp para envio automatico do PDF da auditoria */}
                  <div className="md:col-span-2">
                    <div className="border-2 border-emerald-200 bg-emerald-50 rounded-lg p-3">
                      <div className="flex items-center gap-2 mb-2 flex-wrap">
                        <span className="text-base">💬</span>
                        <label className="text-xs font-semibold text-gray-800">
                          Grupo WhatsApp para envio do PDF da auditoria
                        </label>
                        <span className="text-[10px] bg-gray-200 text-gray-700 px-1.5 py-0.5 rounded-full font-semibold uppercase">Opcional</span>
                        <button type="button" onClick={() => carregarGruposWA(true)} disabled={loadingWaGroups}
                          className="ml-auto text-[11px] text-emerald-700 hover:text-emerald-900 font-medium disabled:opacity-50">
                          {loadingWaGroups ? 'Carregando…' : '🔄 Atualizar'}
                        </button>
                      </div>
                      <p className="text-[11px] text-gray-600 mb-2">
                        Ao finalizar qualquer auditoria deste roteiro, o PDF completo (com perguntas, respostas e evidências) será enviado automaticamente para o grupo escolhido.
                      </p>
                      <select
                        value={formData.whatsapp_group_pdf_id || ''}
                        onChange={e => {
                          const id = e.target.value || null;
                          const grp = whatsappGroups.find(g => g.id === id);
                          setFormData({
                            ...formData,
                            whatsapp_group_pdf_id: id,
                            whatsapp_group_pdf_name: grp?.subject || null,
                          });
                        }}
                        onFocus={() => whatsappGroups.length === 0 && carregarGruposWA(false)}
                        className="w-full border-2 border-emerald-300 rounded px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-emerald-400">
                        <option value="">— não enviar PDF automaticamente —</option>
                        {whatsappGroups.map(g => (
                          <option key={g.id} value={g.id}>
                            {g.subject || 'Sem nome'}{g.size ? ` (${g.size})` : ''}
                          </option>
                        ))}
                      </select>
                      {!loadingWaGroups && whatsappGroups.length === 0 && (
                        <p className="mt-1 text-[11px] text-emerald-700 italic">
                          Nenhum grupo carregado. Clique em "Atualizar" para buscar da Evolution API.
                        </p>
                      )}
                    </div>
                  </div>

                  <div>
                    <label className="flex items-center gap-2">
                      <input type="checkbox" checked={formData.ativo} onChange={e => setFormData({ ...formData, ativo: e.target.checked })} className="w-4 h-4 text-teal-500" />
                      <span className="text-sm">Ativo</span>
                    </label>
                  </div>
                </div>

                {/* Grupos de acesso — auditores liberados a aplicar este questionário */}
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">👤 Grupos de Acesso — Auditores (podem aplicar)</label>
                  <div className="border rounded bg-white p-2 max-h-36 overflow-auto">
                    {auditores.length === 0 ? (
                      <div className="text-xs text-gray-500 italic p-2">
                        Nenhum auditor liberado. Libere em <strong>Configurações → Colaboradores</strong> com a flag "Pode auditar".
                      </div>
                    ) : (
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-1">
                        {auditores.map(a => (
                          <label key={a.id} className="flex items-center gap-2 text-sm p-1.5 hover:bg-gray-50 cursor-pointer rounded">
                            <input type="checkbox" checked={formData.grupos_acesso.includes(a.id)} onChange={() => toggleGrupoAcesso(a.id)}
                              className="w-4 h-4 text-teal-500" />
                            <span>{a.name}</span>
                          </label>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="text-xs text-gray-500 mt-1">
                    {formData.grupos_acesso.length > 0
                      ? `${formData.grupos_acesso.length} auditor(es) selecionado(s)`
                      : 'Nenhum — se vazio, qualquer auditor pode aplicar'}
                  </div>
                </div>

                {/* Grupos de acesso — auditados liberados a serem avaliados neste questionário */}
                <div className="mt-3">
                  <label className="block text-xs font-medium text-gray-700 mb-1">👥 Grupos de Acesso — Auditados (podem ser avaliados)</label>
                  <div className="border rounded bg-white p-2 max-h-36 overflow-auto">
                    {auditados.length === 0 ? (
                      <div className="text-xs text-gray-500 italic p-2">
                        Nenhum colaborador liberado. Libere em <strong>Configurações → Colaboradores</strong> com a flag "Pode ser auditado".
                      </div>
                    ) : (
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-1">
                        {auditados.map(a => (
                          <label key={a.id} className="flex items-center gap-2 text-sm p-1.5 hover:bg-gray-50 cursor-pointer rounded">
                            <input type="checkbox" checked={formData.grupos_acesso_auditados.includes(a.id)} onChange={() => toggleGrupoAuditados(a.id)}
                              className="w-4 h-4 text-teal-500" />
                            <span>{a.name}</span>
                          </label>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="text-xs text-gray-500 mt-1">
                    {formData.grupos_acesso_auditados.length > 0
                      ? `${formData.grupos_acesso_auditados.length} auditado(s) selecionado(s)`
                      : 'Nenhum — se vazio, qualquer colaborador auditado aparece'}
                  </div>
                </div>

                <div className="mt-3 flex items-center gap-3">
                  {!editing && (
                    <button onClick={salvarTemplate} className="px-4 py-2 bg-teal-500 text-white rounded hover:bg-teal-600 text-sm font-medium">
                      Criar template
                    </button>
                  )}
                  {editing && (
                    <div className="text-xs flex items-center gap-1.5">
                      {autoSaveStatus === 'saving' && <span className="text-gray-500">💾 Salvando…</span>}
                      {autoSaveStatus === 'saved' && <span className="text-emerald-600 font-medium">✓ Salvo automaticamente</span>}
                      {!autoSaveStatus && <span className="text-gray-400">Alterações salvas automaticamente</span>}
                    </div>
                  )}
                </div>
              </div>

              {editing && (
                <div className="border rounded p-4">
                  <div className="flex justify-between items-center mb-3">
                    <h3 className="font-semibold text-gray-700">Seções e Perguntas</h3>
                    <button onClick={addSection} className="text-sm px-3 py-1.5 bg-teal-50 text-teal-700 rounded hover:bg-teal-100 font-medium">
                      + Adicionar seção
                    </button>
                  </div>

                  {(editing.sections || []).length === 0 ? (
                    <div className="text-sm text-gray-500 italic py-6 text-center">Nenhuma seção — adicione uma para começar</div>
                  ) : (
                    <div className="space-y-3">
                      {editing.sections.map(s => (
                        <div key={s.id} className="border rounded bg-white">
                          <div className="flex justify-between items-center px-4 py-2.5 bg-slate-200 border-b border-slate-300 rounded-t">
                            <h4 className="font-semibold text-slate-800 flex items-center gap-2">
                              <span>📂</span>
                              <span>{s.nome}</span>
                              <button
                                onClick={() => renomearSection(s)}
                                title="Renomear seção"
                                className="text-slate-500 hover:text-slate-800 text-sm"
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                </svg>
                              </button>
                            </h4>
                            <div className="flex gap-2">
                              <button onClick={() => setQuestionModal({ section_id: s.id, question: null })}
                                className="text-xs px-3 py-1 bg-teal-500 text-white rounded hover:bg-teal-600">+ Pergunta</button>
                              <button onClick={() => removerSection(s.id)} className="text-xs px-2 py-1 bg-red-100 text-red-600 rounded hover:bg-red-200" title="Excluir seção">🗑</button>
                            </div>
                          </div>

                          {(s.questions || []).length === 0 ? (
                            <div className="text-xs text-gray-400 italic p-4 text-center">Sem perguntas</div>
                          ) : (
                            <div className="divide-y">
                              {s.questions.map(q => {
                                const modelo = getModeloDaQuestao(q);
                                return (
                                  <div key={q.id} className="p-3 hover:bg-gray-50 flex items-start gap-3">
                                    <div className="flex-1">
                                      <div className="text-sm text-gray-800">{q.texto}</div>
                                      <div className="mt-2 flex items-center gap-2 flex-wrap">
                                        {modelo && (modelo.alternativas || []).map((a, i) => {
                                          const cfg = (q.alternativas_config || []).find(c => c.ordem === a.ordem) || {};
                                          return (
                                            <div key={i} className="inline-flex items-center gap-1.5 bg-white border border-gray-200 rounded-full pl-1 pr-2.5 py-0.5 shadow-sm">
                                              <AlternativaIcon icone={a.icone} size={22} />
                                              <span className="text-xs font-medium text-gray-700">{a.label}</span>
                                              {cfg.generates_alert && <span title="Gera alerta" className="text-[10px]">⚠️</span>}
                                              {cfg.requires_photo && <span title="Foto obrigatória" className="text-[10px]">📷</span>}
                                              {cfg.requires_comment && <span title="Comentário obrigatório" className="text-[10px]">💬</span>}
                                            </div>
                                          );
                                        })}
                                        {!modelo && (
                                          <span className="text-xs text-amber-600">⚠️ Sem modelo de alternativa</span>
                                        )}
                                      </div>
                                      {(q.imagens_referencia || []).length > 0 && (
                                        <div className="mt-2 flex gap-1 flex-wrap">
                                          {(q.imagens_referencia || []).map((img, i) => (
                                            <img key={i} src={img.url} alt={img.titulo || ''} className="w-12 h-12 object-cover rounded border" />
                                          ))}
                                        </div>
                                      )}
                                    </div>
                                    <div className="flex gap-1 shrink-0">
                                      <button onClick={() => setQuestionModal({ section_id: s.id, question: q })}
                                        className="text-xs px-2 py-1 bg-teal-50 text-teal-700 rounded hover:bg-teal-100">Editar</button>
                                      <button onClick={() => removerQuestion(q.id)} className="text-xs px-2 py-1 bg-red-50 text-red-600 rounded hover:bg-red-100">🗑</button>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {questionModal && (
        <ChecklistQuestionModal
          sectionId={questionModal.section_id}
          question={questionModal.question}
          modelos={modelos}
          setores={setores}
          onClose={() => setQuestionModal(null)}
          onSaved={async () => { setQuestionModal(null); await recarregarEdicao(); }}
        />
      )}
    </div>
  );
}
