import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useLoja } from '../../contexts/LojaContext';
import Sidebar from '../../components/Sidebar';
import api from '../../utils/api';
import { AlternativaIcon } from './ChecklistIcons';

const primeiroDiaDoMes = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
};
const hojeISO = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

export default function ChecklistFinalizadas() {
  const { user, logout } = useAuth();
  const { lojaSelecionada } = useLoja();
  const podeExcluir = !!(user?.isMaster || user?.type === 'admin' || user?.role === 'master' || user?.role === 'admin' || user?.role === 'gerente');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [inspections, setInspections] = useState([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState('');

  // Filtros — default: dia 1 do mes atual até hoje
  const [filtroAuditor, setFiltroAuditor] = useState('');
  const [filtroAuditado, setFiltroAuditado] = useState('');
  const [filtroAuditoria, setFiltroAuditoria] = useState('');
  const [dataDe, setDataDe] = useState(primeiroDiaDoMes());
  const [dataAte, setDataAte] = useState(hojeISO());
  // Tipos de resposta (multi-selecao): vazio = todos tipos
  const [tiposResposta, setTiposResposta] = useState([]);

  // Linhas expandidas + cache de detalhes
  const [expandidas, setExpandidas] = useState(new Set());
  const [detalhes, setDetalhes] = useState({});
  const [carregandoDet, setCarregandoDet] = useState({});
  const [lightbox, setLightbox] = useState(null);

  useEffect(() => { carregar(); /* eslint-disable-next-line */ }, [lojaSelecionada]);

  const carregar = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('status', 'enviada');
      if (lojaSelecionada != null) params.set('cod_loja', String(lojaSelecionada));
      const res = await api.get(`/checklist/inspections?${params.toString()}`);
      setInspections(res.data?.inspections || []);
    } catch (e) {
      setErro(e?.response?.data?.error || e.message);
    } finally {
      setLoading(false);
    }
  };

  const fmtData = (iso) => iso ? new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';

  const excluirInspection = async (id) => {
    if (!confirm('Excluir esta auditoria?\n\nTodas as respostas e planos de ação vinculados também serão removidos. Esta ação é irreversível.')) return;
    try {
      await api.delete(`/checklist/inspections/${id}`);
      await carregar();
      // Fecha expansão dela se estava aberta
      setExpandidas(prev => { const n = new Set(prev); n.delete(id); return n; });
    } catch (e) {
      setErro(e?.response?.data?.error || e.message);
    }
  };

  const toggleExpand = async (inspectionId) => {
    const novo = new Set(expandidas);
    if (novo.has(inspectionId)) {
      novo.delete(inspectionId);
      setExpandidas(novo);
      return;
    }
    novo.add(inspectionId);
    setExpandidas(novo);
    // Carrega detalhes se ainda nao cacheou
    if (!detalhes[inspectionId]) {
      setCarregandoDet(c => ({ ...c, [inspectionId]: true }));
      try {
        const [insRes, tplRes] = await Promise.all([
          api.get(`/checklist/inspections/${inspectionId}`),
          null, // template virá dentro da inspection via relations
        ]);
        const ins = insRes.data?.inspection;
        // carrega tambem o template full pra saber estrutura de perguntas
        const tpl = ins?.template?.id
          ? (await api.get(`/checklist/templates/${ins.template.id}`)).data?.template
          : null;
        setDetalhes(d => ({ ...d, [inspectionId]: { inspection: ins, template: tpl } }));
      } catch (e) {
        setErro(e?.response?.data?.error || e.message);
      } finally {
        setCarregandoDet(c => ({ ...c, [inspectionId]: false }));
      }
    }
  };

  const badgeConformidade = (pct, meta) => {
    const p = Number(pct) || 0;
    const m = Number(meta) || 95;
    const atingiu = p >= m;
    const cls = atingiu ? 'bg-emerald-100 text-emerald-700 border-emerald-300'
      : p >= 70 ? 'bg-teal-100 text-teal-700 border-teal-300'
      : p >= 50 ? 'bg-amber-100 text-amber-700 border-amber-300'
      : 'bg-rose-100 text-rose-700 border-rose-300';
    return (
      <span className={`inline-block px-2 py-0.5 rounded border font-bold text-xs ${cls}`}>
        {p.toFixed(1)}%
      </span>
    );
  };

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
              <h1 className="text-xl sm:text-2xl font-bold">✅ Auditorias Finalizadas</h1>
              <p className="text-xs sm:text-sm opacity-90">Histórico de auditorias concluídas</p>
            </div>
          </div>
        </div>

        <div className="p-4 sm:p-6">
          {erro && <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded text-sm">{erro}</div>}

          {(() => {
            // Opcoes unicas dos dropdowns a partir das inspecoes carregadas
            const auditoresMap = {}; const auditadosMap = {}; const auditoriasMap = {};
            for (const i of inspections) {
              if (i.auditor) auditoresMap[i.auditor.id] = i.auditor.name;
              if (i.auditado) auditadosMap[i.auditado.id] = i.auditado.name;
              if (i.template) auditoriasMap[i.template.id] = i.template.nome;
            }
            const auditores = Object.entries(auditoresMap).sort((a, b) => a[1].localeCompare(b[1]));
            const auditados = Object.entries(auditadosMap).sort((a, b) => a[1].localeCompare(b[1]));
            const auditorias = Object.entries(auditoriasMap).sort((a, b) => a[1].localeCompare(b[1]));

            // Aplicar filtros
            const filtradas = inspections.filter(i => {
              if (filtroAuditor && i.auditor?.id !== filtroAuditor) return false;
              if (filtroAuditado && i.auditado?.id !== filtroAuditado) return false;
              if (filtroAuditoria && String(i.template?.id) !== filtroAuditoria) return false;
              const dt = i.finished_at || i.created_at;
              if (dataDe && dt && new Date(dt) < new Date(dataDe + 'T00:00:00')) return false;
              if (dataAte && dt && new Date(dt) > new Date(dataAte + 'T23:59:59')) return false;
              // Tipos de resposta (multi-selecao). Vazio = passa tudo; com marcados = deve ter >=1 de algum
              if (tiposResposta.length > 0) {
                const temAlgum = tiposResposta.some(tp => {
                  if (tp === 'positivo') return (i.positivas || 0) > 0;
                  if (tp === 'negativo') return (i.negativas || 0) > 0;
                  if (tp === 'na') return (i.nao_aplica || 0) > 0;
                  if (tp === 'alerta') return (i.alertas || 0) > 0;
                  return false;
                });
                if (!temAlgum) return false;
              }
              return true;
            });

            const defaultDe = primeiroDiaDoMes(), defaultAte = hojeISO();
            const temFiltro = filtroAuditor || filtroAuditado || filtroAuditoria
              || (dataDe && dataDe !== defaultDe) || (dataAte && dataAte !== defaultAte)
              || tiposResposta.length > 0;
            const limpar = () => {
              setFiltroAuditor(''); setFiltroAuditado(''); setFiltroAuditoria('');
              setDataDe(defaultDe); setDataAte(defaultAte);
              setTiposResposta([]);
            };
            const toggleTipo = (tp) => {
              setTiposResposta(cur => cur.includes(tp) ? cur.filter(x => x !== tp) : [...cur, tp]);
            };

            return (
              <>
                <div className="mb-3 bg-white border rounded-lg p-3 shadow-sm">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-sm font-semibold text-gray-700">🔍 Filtros</span>
                    {temFiltro && (
                      <button onClick={limpar} className="text-xs text-teal-600 hover:underline ml-auto">Limpar</button>
                    )}
                  </div>

                  {/* Tipos de resposta — multi-seleção (apenas a caixinha fica laranja) */}
                  <div className="flex flex-wrap gap-2 mb-3">
                    {[
                      { key: 'positivo', label: 'Positivo', emoji: '😊' },
                      { key: 'negativo', label: 'Negativo', emoji: '🙁' },
                      { key: 'na', label: 'Não se Aplica', emoji: 'n/a' },
                      { key: 'alerta', label: 'Alerta', emoji: '⚠️' },
                    ].map(t => {
                      const ativo = tiposResposta.includes(t.key);
                      return (
                        <label key={t.key}
                          className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 cursor-pointer text-sm text-gray-700">
                          <input type="checkbox" checked={ativo}
                            onChange={() => toggleTipo(t.key)}
                            className="w-4 h-4 accent-orange-500 cursor-pointer" />
                          <span>{t.emoji}</span>
                          <span className="font-medium">{t.label}</span>
                        </label>
                      );
                    })}
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
                    <div>
                      <label className="block text-[11px] font-medium text-gray-500 mb-1">Data de</label>
                      <input type="date" value={dataDe} onChange={e => setDataDe(e.target.value)}
                        className="w-full border rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-teal-500" />
                    </div>
                    <div>
                      <label className="block text-[11px] font-medium text-gray-500 mb-1">Data até</label>
                      <input type="date" value={dataAte} onChange={e => setDataAte(e.target.value)}
                        className="w-full border rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-teal-500" />
                    </div>
                    <div>
                      <label className="block text-[11px] font-medium text-gray-500 mb-1">Auditoria</label>
                      <select value={filtroAuditoria} onChange={e => setFiltroAuditoria(e.target.value)}
                        className="w-full border rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-teal-500">
                        <option value="">Todas</option>
                        {auditorias.map(([id, nome]) => <option key={id} value={id}>{nome}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-[11px] font-medium text-gray-500 mb-1">Auditor</label>
                      <select value={filtroAuditor} onChange={e => setFiltroAuditor(e.target.value)}
                        className="w-full border rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-teal-500">
                        <option value="">Todos</option>
                        {auditores.map(([id, nome]) => <option key={id} value={id}>{nome}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-[11px] font-medium text-gray-500 mb-1">Auditado</label>
                      <select value={filtroAuditado} onChange={e => setFiltroAuditado(e.target.value)}
                        className="w-full border rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-teal-500">
                        <option value="">Todos</option>
                        {auditados.map(([id, nome]) => <option key={id} value={id}>{nome}</option>)}
                      </select>
                    </div>
                  </div>
                </div>

                <div className="mb-3 flex items-center justify-between flex-wrap gap-2">
                  <div className="text-sm text-gray-600">
                    <strong>{filtradas.length}</strong> auditoria(s)
                    {temFiltro && <span className="text-gray-400"> (de {inspections.length} total)</span>}
                    {lojaSelecionada != null && <> da Loja {lojaSelecionada}</>}
                  </div>
                  <button onClick={carregar} className="text-sm px-3 py-1 bg-teal-50 text-teal-700 rounded hover:bg-teal-100">
                    🔄 Atualizar
                  </button>
                </div>

                {loading ? (
                  <div className="text-gray-500 py-10 text-center">Carregando…</div>
                ) : filtradas.length === 0 ? (
                  <div className="bg-white border rounded-lg p-10 text-center text-gray-500 italic">
                    {inspections.length === 0
                      ? `Nenhuma auditoria finalizada ${lojaSelecionada != null ? `na Loja ${lojaSelecionada}` : ''}.`
                      : 'Nenhuma auditoria encontrada com os filtros aplicados.'}
                  </div>
                ) : (
                  <div className="bg-white border rounded-lg overflow-hidden shadow-sm overflow-x-auto">
                    <table className="w-full text-sm min-w-[900px]">
                      <thead className="bg-slate-100 text-xs uppercase text-slate-700">
                        <tr>
                          <th className="w-10 px-2 py-3"></th>
                          <th className="text-left px-4 py-3">Data</th>
                          <th className="text-left px-4 py-3">Auditoria</th>
                          <th className="text-left px-4 py-3">Auditor</th>
                          <th className="text-left px-4 py-3">Auditado</th>
                          <th className="text-center px-4 py-3">Loja</th>
                          <th className="text-center px-4 py-3 text-emerald-700">✓ Positivo</th>
                          <th className="text-center px-4 py-3 text-rose-700">✗ Negativo</th>
                          <th className="text-center px-4 py-3">Meta</th>
                          <th className="text-center px-4 py-3">Atingido</th>
                          {podeExcluir && <th className="w-12 px-2 py-3"></th>}
                        </tr>
                      </thead>
                      <tbody>
                        {filtradas.map(i => {
                          const aberta = expandidas.has(i.id);
                          const det = detalhes[i.id];
                          return (
                            <React.Fragment key={i.id}>
                              <tr className="border-t hover:bg-gray-50">
                                <td className="px-2 py-3 text-center">
                                  <button onClick={() => toggleExpand(i.id)}
                                    className={`w-7 h-7 rounded-full border-2 flex items-center justify-center font-bold text-sm transition ${aberta ? 'bg-teal-500 text-white border-teal-500' : 'bg-white text-teal-600 border-teal-300 hover:bg-teal-50'}`}
                                    title={aberta ? 'Recolher' : 'Expandir perguntas e respostas'}>
                                    {aberta ? '−' : '+'}
                                  </button>
                                </td>
                                <td className="px-4 py-3 text-gray-700">{fmtData(i.finished_at || i.created_at)}</td>
                                <td className="px-4 py-3 font-medium text-gray-800">{i.template?.nome || '—'}</td>
                                <td className="px-4 py-3 text-gray-700">{i.auditor?.name || '—'}</td>
                                <td className="px-4 py-3 text-gray-700">{i.auditado?.name || '—'}</td>
                                <td className="px-4 py-3 text-center text-gray-700">
                                  {i.cod_loja != null ? `Loja ${i.cod_loja}` : '—'}
                                </td>
                                <td className="px-4 py-3 text-center font-bold text-emerald-700">{i.positivas || 0}</td>
                                <td className="px-4 py-3 text-center font-bold text-rose-700">{i.negativas || 0}</td>
                                <td className="px-4 py-3 text-center text-gray-700">
                                  {Number(i.template?.minimo_esperado || 95).toFixed(0)}%
                                </td>
                                <td className="px-4 py-3 text-center">
                                  {badgeConformidade(i.percentual_conformidade, i.template?.minimo_esperado)}
                                </td>
                                {podeExcluir && (
                                  <td className="px-2 py-3 text-center">
                                    <button
                                      onClick={() => excluirInspection(i.id)}
                                      title="Excluir auditoria (Master/Admin)"
                                      className="text-rose-600 hover:text-white hover:bg-rose-600 border border-rose-200 hover:border-rose-600 rounded-lg w-8 h-8 inline-flex items-center justify-center transition"
                                    >
                                      <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
                                      </svg>
                                    </button>
                                  </td>
                                )}
                              </tr>
                              {aberta && (
                                <tr className="bg-slate-50 border-t border-slate-200">
                                  <td colSpan={podeExcluir ? 11 : 10} className="p-4">
                                    {carregandoDet[i.id] ? (
                                      <div className="text-sm text-gray-500 italic">Carregando perguntas…</div>
                                    ) : det ? (
                                      <DetalhesInspection det={det} onFoto={setLightbox} tiposResposta={tiposResposta} />
                                    ) : (
                                      <div className="text-sm text-gray-500 italic">Sem dados.</div>
                                    )}
                                  </td>
                                </tr>
                              )}
                            </React.Fragment>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </>
            );
          })()}

        </div>
      </div>



      {/* Lightbox pra fotos ampliadas */}
      {lightbox && (
        <div
          className="fixed inset-0 bg-black bg-opacity-85 flex items-center justify-center z-50 p-4"
          onClick={() => setLightbox(null)}
        >
          <div className="relative max-w-5xl max-h-full" onClick={e => e.stopPropagation()}>
            <img src={lightbox.url} alt={lightbox.titulo || ''} className="max-w-full max-h-[85vh] rounded-lg shadow-2xl" />
            {lightbox.titulo && (
              <div className="absolute bottom-0 left-0 right-0 bg-black bg-opacity-70 text-white text-sm p-3 rounded-b-lg">
                {lightbox.titulo}
              </div>
            )}
            <button onClick={() => setLightbox(null)}
              className="absolute -top-3 -right-3 bg-white text-gray-800 rounded-full w-10 h-10 text-xl font-bold shadow-lg hover:bg-gray-100"
            >×</button>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Renderiza as secoes/perguntas com as respostas dadas na auditoria.
 * Se tiposResposta tiver itens, filtra apenas as perguntas que casam com os tipos.
 */
function DetalhesInspection({ det, onFoto, tiposResposta = [] }) {
  const inspection = det.inspection;
  const template = det.template;
  const responses = inspection?.responses || [];
  const respMap = {};
  for (const r of responses) respMap[r.question_id] = r;

  const corResposta = (conforme) =>
    conforme === 'C' ? 'bg-emerald-100 text-emerald-700 border-emerald-300'
    : conforme === 'NC' ? 'bg-rose-100 text-rose-700 border-rose-300'
    : conforme === 'NA' ? 'bg-sky-100 text-sky-700 border-sky-300'
    : 'bg-gray-100 text-gray-500 border-gray-300';

  // Identifica o icone da resposta (mesmo usado nos modelos de alternativas)
  const iconeDaResposta = (r) => {
    if (!r) return null;
    const v = String(r.valor_opcao || '').toLowerCase();
    if (v.includes('alerta')) return 'warning_yellow';
    if (r.conforme === 'C') return 'smile_green';
    if (r.conforme === 'NC') return 'frown_red';
    if (r.conforme === 'NA') return 'na_blue';
    return null;
  };

  // Decide se uma resposta passa no filtro de tipos
  const passaFiltroTipo = (r) => {
    if (tiposResposta.length === 0) return true;
    if (!r) return false;
    const v = String(r.valor_opcao || '').toLowerCase();
    const ehAlerta = v.includes('alerta');
    return tiposResposta.some(tp => {
      if (tp === 'positivo') return r.conforme === 'C';
      if (tp === 'negativo') return r.conforme === 'NC';
      if (tp === 'alerta') return ehAlerta;
      if (tp === 'na') return r.conforme === 'NA' && !ehAlerta;
      return false;
    });
  };

  // Pre-calcula perguntas visiveis por secao (pra nao renderizar secoes vazias)
  const secoesComPerguntas = (template?.sections || []).map(s => ({
    ...s,
    questionsFiltradas: (s.questions || []).filter(q => passaFiltroTipo(respMap[q.id])),
  })).filter(s => s.questionsFiltradas.length > 0);

  return (
    <div className="space-y-3">
      <div className="text-xs font-semibold text-gray-600 uppercase flex items-center gap-2">
        <span>Perguntas e Respostas</span>
        {tiposResposta.length > 0 && (
          <span className="text-[10px] text-orange-700 bg-orange-100 border border-orange-300 rounded px-1.5 py-0.5 normal-case">
            filtrado por: {tiposResposta.join(', ')}
          </span>
        )}
      </div>
      {secoesComPerguntas.length === 0 && (
        <div className="text-sm text-gray-500 italic py-3">Nenhuma pergunta corresponde aos filtros selecionados.</div>
      )}
      {secoesComPerguntas.map(s => (
        <div key={s.id} className="bg-white border rounded-lg">
          <div className="bg-slate-200 px-3 py-2 border-b border-slate-300 rounded-t font-semibold text-sm text-slate-800">
            📂 {s.nome} <span className="text-xs font-normal text-slate-600">({s.questionsFiltradas.length})</span>
          </div>
          <div className="divide-y">
            {s.questionsFiltradas.map(q => {
              const r = respMap[q.id];
              const fotos = r?.fotos || [];
              const temRespondida_em = r?.respondida_em || r?.created_at;
              const iconeResp = iconeDaResposta(r);
              return (
                <div key={q.id} className="px-3 py-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      {iconeResp && (
                        <div className="shrink-0">
                          <AlternativaIcon icone={iconeResp} size={44} />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-semibold text-gray-900">{q.texto}</div>
                        {temRespondida_em && r && (
                          <div className="text-[11px] text-gray-400 mt-0.5">
                            🕒 Respondida em {new Date(temRespondida_em).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="shrink-0">
                      {r ? (
                        <span className={`inline-block px-2.5 py-0.5 rounded border text-xs font-bold ${corResposta(r.conforme)}`}>
                          {r.valor_opcao || r.conforme || '—'}
                        </span>
                      ) : (
                        <span className="text-xs text-gray-400 italic">Sem resposta</span>
                      )}
                    </div>
                  </div>

                  {r?.observacao && (
                    <div className="mt-2 text-xs text-gray-700 bg-violet-50 border border-violet-200 rounded p-2">
                      <div className="font-semibold text-violet-800 mb-0.5">💬 Comentário</div>
                      <div>{r.observacao}</div>
                    </div>
                  )}

                  {fotos.length > 0 && (
                    <div className="mt-2 bg-sky-50 border border-sky-200 rounded p-2">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-sm">📸</span>
                        <span className="text-xs font-bold text-sky-800">
                          Evidências fotográficas ({fotos.length})
                        </span>
                      </div>
                      <div className="flex gap-2 flex-wrap">
                        {fotos.map((f, i) => (
                          <div key={i} className="flex flex-col items-center">
                            <button type="button" onClick={() => onFoto(f)}
                              className="rounded-lg border-2 border-sky-300 hover:border-sky-500 overflow-hidden shadow-sm transition hover:shadow-md"
                              title="Clique para ampliar">
                              <img src={f.url} alt={f.titulo || ''} className="w-24 h-24 object-cover" />
                            </button>
                            {f.captured_at && (
                              <span className="text-[10px] text-sky-700 font-mono mt-0.5">
                                🕒 {new Date(f.captured_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                              </span>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ))}
      {(template?.sections || []).length === 0 && (
        <div className="text-sm text-gray-500 italic">Template sem seções.</div>
      )}
    </div>
  );
}
