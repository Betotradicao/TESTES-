import { useEffect, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useLoja } from '../../contexts/LojaContext';
import Sidebar from '../../components/Sidebar';
import api from '../../utils/api';

const primeiroDiaDoMes = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
};
const hojeISO = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const STATUS_CONFIG = {
  aberta: {
    label: 'Aberto',
    emoji: '🔴',
    bgClass: 'bg-rose-100 text-rose-800 border-rose-200',
    descricao: 'Ainda sem resolução',
  },
  em_andamento: {
    label: 'Previamente resolvido',
    emoji: '⏳',
    bgClass: 'bg-amber-100 text-amber-800 border-amber-200',
    descricao: 'Tem providência, aguardando resolução definitiva',
  },
  concluida: {
    label: 'Resolvido definitivamente',
    emoji: '✅',
    bgClass: 'bg-emerald-100 text-emerald-800 border-emerald-200',
    descricao: 'Fechado',
  },
  atrasada: {
    label: 'Atrasado',
    emoji: '⚠️',
    bgClass: 'bg-red-200 text-red-900 border-red-300',
    descricao: 'Passou do prazo sem resolução',
  },
};

export default function ChecklistAlertas() {
  const { user, logout } = useAuth();
  const { lojaSelecionada } = useLoja();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [alertas, setAlertas] = useState([]);
  const [resumo, setResumo] = useState({ total: 0, abertas: 0, em_andamento: 0, concluidas: 0, atrasadas: 0 });
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState('');

  // Filtros
  const [dataDe, setDataDe] = useState(primeiroDiaDoMes());
  const [dataAte, setDataAte] = useState(hojeISO());
  const [filtroAuditor, setFiltroAuditor] = useState('');
  const [filtroAuditado, setFiltroAuditado] = useState('');
  const [filtroRoteiro, setFiltroRoteiro] = useState('');
  const [filtroStatus, setFiltroStatus] = useState(new Set()); // vazio = todos

  const [expandidos, setExpandidos] = useState(new Set());
  const [lightbox, setLightbox] = useState(null);

  useEffect(() => { carregar(); /* eslint-disable-next-line */ }, [lojaSelecionada, dataDe, dataAte, filtroStatus]);

  const carregar = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (lojaSelecionada != null) params.set('cod_loja', String(lojaSelecionada));
      if (dataDe) params.set('data_inicio', dataDe);
      if (dataAte) params.set('data_fim', dataAte);
      // Status: mapeia atrasada -> aberta/em_andamento no backend, mas filtro local tambem
      const statusParaBackend = [];
      if (filtroStatus.has('aberta') || filtroStatus.has('atrasada')) statusParaBackend.push('aberta');
      if (filtroStatus.has('em_andamento') || filtroStatus.has('atrasada')) statusParaBackend.push('em_andamento');
      if (filtroStatus.has('concluida')) statusParaBackend.push('concluida');
      if (statusParaBackend.length > 0) {
        params.set('status', [...new Set(statusParaBackend)].join(','));
      }
      const res = await api.get(`/checklist/alertas?${params.toString()}`);
      let lista = res.data?.alertas || [];
      // Pos-filtros (auditor/auditado/roteiro texto livre + status "atrasada")
      if (filtroAuditor.trim()) {
        const q = filtroAuditor.toLowerCase().trim();
        lista = lista.filter(a => (a.auditor || '').toLowerCase().includes(q));
      }
      if (filtroAuditado.trim()) {
        const q = filtroAuditado.toLowerCase().trim();
        lista = lista.filter(a => (a.auditado || '').toLowerCase().includes(q));
      }
      if (filtroRoteiro.trim()) {
        const q = filtroRoteiro.toLowerCase().trim();
        lista = lista.filter(a => (a.roteiro || '').toLowerCase().includes(q));
      }
      // Se o user marcou algum status, aplica filtro local (com atrasada)
      if (filtroStatus.size > 0) {
        lista = lista.filter(a => filtroStatus.has(a.status));
      }
      setAlertas(lista);
      setResumo(res.data?.resumo || {});
    } catch (e) {
      setErro(e?.response?.data?.error || e.message);
    } finally {
      setLoading(false);
    }
  };

  const toggleStatus = (s) => {
    const novo = new Set(filtroStatus);
    if (novo.has(s)) novo.delete(s); else novo.add(s);
    setFiltroStatus(novo);
  };

  const toggleExpand = (id) => {
    const novo = new Set(expandidos);
    if (novo.has(id)) novo.delete(id); else novo.add(id);
    setExpandidos(novo);
  };

  const fmtData = (iso) => iso ? new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';

  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar user={user} onLogout={logout} isMobileMenuOpen={isMobileMenuOpen} setIsMobileMenuOpen={setIsMobileMenuOpen} />
      <div className="flex-1 min-w-0 overflow-auto overflow-x-hidden">
        <div className="bg-gradient-to-r from-rose-500 to-red-600 text-white p-4 shadow">
          <div className="flex items-center gap-3">
            <button onClick={() => setIsMobileMenuOpen(true)}
              className="lg:hidden bg-white/20 hover:bg-white/30 rounded-lg p-2 transition">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16"/>
              </svg>
            </button>
            <div className="flex-1 min-w-0">
              <h1 className="text-xl sm:text-2xl font-bold">🚨 Alertas</h1>
              <p className="text-xs sm:text-sm opacity-90">Pendências geradas pelas auditorias</p>
            </div>
          </div>
        </div>

        <div className="p-4 sm:p-6 max-w-7xl mx-auto">
          {erro && <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded text-sm">{erro}</div>}

          {/* Tiles de resumo */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-5">
            <Tile emoji="🚨" valor={resumo.total} titulo="Total" sub="no período" grad="from-slate-500 to-gray-600" />
            <Tile emoji="🔴" valor={resumo.abertas} titulo="Abertos" sub="sem resolução" grad="from-rose-500 to-red-600" />
            <Tile emoji="⏳" valor={resumo.em_andamento} titulo="Previamente" sub="em andamento" grad="from-amber-500 to-orange-600" />
            <Tile emoji="✅" valor={resumo.concluidas} titulo="Resolvidos" sub="definitivos" grad="from-emerald-500 to-green-600" />
            <Tile emoji="⚠️" valor={resumo.atrasadas} titulo="Atrasados" sub="passaram do prazo" grad="from-red-600 to-rose-700" />
          </div>

          {/* Filtros */}
          <div className="bg-white border-2 border-gray-100 rounded-xl p-4 shadow-sm mb-5">
            <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
              <div>
                <label className="text-[11px] font-semibold uppercase text-gray-500 block mb-1">De</label>
                <input type="date" value={dataDe} onChange={e => setDataDe(e.target.value)}
                  className="w-full border-2 border-gray-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:border-rose-400" />
              </div>
              <div>
                <label className="text-[11px] font-semibold uppercase text-gray-500 block mb-1">Até</label>
                <input type="date" value={dataAte} onChange={e => setDataAte(e.target.value)}
                  className="w-full border-2 border-gray-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:border-rose-400" />
              </div>
              <div>
                <label className="text-[11px] font-semibold uppercase text-gray-500 block mb-1">Auditor</label>
                <input type="text" placeholder="Nome contém…" value={filtroAuditor}
                  onChange={e => setFiltroAuditor(e.target.value)}
                  onBlur={carregar}
                  className="w-full border-2 border-gray-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:border-rose-400" />
              </div>
              <div>
                <label className="text-[11px] font-semibold uppercase text-gray-500 block mb-1">Auditado</label>
                <input type="text" placeholder="Nome contém…" value={filtroAuditado}
                  onChange={e => setFiltroAuditado(e.target.value)}
                  onBlur={carregar}
                  className="w-full border-2 border-gray-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:border-rose-400" />
              </div>
              <div>
                <label className="text-[11px] font-semibold uppercase text-gray-500 block mb-1">Roteiro</label>
                <input type="text" placeholder="Nome contém…" value={filtroRoteiro}
                  onChange={e => setFiltroRoteiro(e.target.value)}
                  onBlur={carregar}
                  className="w-full border-2 border-gray-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:border-rose-400" />
              </div>
            </div>

            {/* Chips de status */}
            <div className="mt-3 flex flex-wrap gap-2">
              {Object.entries(STATUS_CONFIG).map(([key, cfg]) => {
                const ativo = filtroStatus.has(key);
                return (
                  <label key={key} className={`flex items-center gap-2 px-3 py-1.5 border-2 rounded-full cursor-pointer transition text-xs font-semibold ${ativo ? cfg.bgClass : 'border-gray-200 text-gray-500 hover:border-gray-300'}`}>
                    <input type="checkbox" checked={ativo} onChange={() => toggleStatus(key)}
                      className="w-3.5 h-3.5 accent-orange-500" />
                    <span>{cfg.emoji} {cfg.label}</span>
                  </label>
                );
              })}
              {filtroStatus.size > 0 && (
                <button onClick={() => setFiltroStatus(new Set())}
                  className="text-xs text-gray-500 hover:text-gray-700 underline">
                  limpar status
                </button>
              )}
            </div>
          </div>

          {/* Lista */}
          {loading ? (
            <div className="text-gray-500 py-10 text-center">Carregando…</div>
          ) : alertas.length === 0 ? (
            <div className="bg-white border-2 border-dashed border-gray-200 rounded-xl p-10 text-center">
              <div className="text-5xl mb-2">🎉</div>
              <div className="text-gray-600 font-semibold">Nenhum alerta no período.</div>
              <div className="text-xs text-gray-400 mt-1">Auditorias sem respostas de alerta não geram pendências aqui.</div>
            </div>
          ) : (
            <div className="bg-white rounded-xl shadow-sm border-2 border-gray-100 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm min-w-[800px]">
                  <thead className="bg-gray-50 text-[11px] uppercase text-gray-600 font-semibold">
                    <tr>
                      <th className="px-2 py-3 text-left w-6"></th>
                      <th className="px-3 py-3 text-left">Data</th>
                      <th className="px-3 py-3 text-left">Roteiro</th>
                      <th className="px-3 py-3 text-left">Pergunta</th>
                      <th className="px-3 py-3 text-left">Auditor</th>
                      <th className="px-3 py-3 text-left">Loja</th>
                      <th className="px-3 py-3 text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {alertas.map(a => {
                      const cfg = STATUS_CONFIG[a.status] || STATUS_CONFIG.aberta;
                      const aberto = expandidos.has(a.id);
                      return (
                        <>
                          <tr key={a.id} className={`border-t border-gray-100 cursor-pointer ${aberto ? 'bg-rose-50/30' : 'hover:bg-gray-50'}`} onClick={() => toggleExpand(a.id)}>
                            <td className="px-2 py-3 text-center text-gray-400">{aberto ? '▾' : '▸'}</td>
                            <td className="px-3 py-3 text-gray-700 whitespace-nowrap">{fmtData(a.created_at)}</td>
                            <td className="px-3 py-3 text-gray-800 font-medium truncate max-w-[200px]">{a.roteiro || '—'}</td>
                            <td className="px-3 py-3 text-gray-700 truncate max-w-[300px]">{a.pergunta || a.what}</td>
                            <td className="px-3 py-3 text-gray-700">{a.auditor || '—'}</td>
                            <td className="px-3 py-3 text-gray-700">{a.cod_loja != null ? `Loja ${a.cod_loja}` : '—'}</td>
                            <td className="px-3 py-3 text-center">
                              <span className={`inline-block px-2 py-0.5 rounded-full text-[11px] font-bold border ${cfg.bgClass}`}>
                                {cfg.emoji} {cfg.label}
                              </span>
                            </td>
                          </tr>
                          {aberto && (
                            <tr key={`${a.id}-det`} className="border-t-0">
                              <td colSpan={7} className="bg-rose-50/40 px-5 py-4">
                                <DetalhesAlerta alerta={a} onOpenLightbox={setLightbox} />
                              </td>
                            </tr>
                          )}
                        </>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>

      {lightbox && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4" onClick={() => setLightbox(null)}>
          <img src={lightbox} alt="Evidência ampliada" className="max-w-full max-h-full rounded-lg" />
        </div>
      )}
    </div>
  );
}

function Tile({ emoji, valor, titulo, sub, grad }) {
  return (
    <div className={`bg-gradient-to-br ${grad} text-white rounded-xl p-4 shadow-md`}>
      <div className="text-2xl mb-1">{emoji}</div>
      <div className="text-3xl font-extrabold">{Number(valor || 0)}</div>
      <div className="text-[11px] font-semibold opacity-90 uppercase tracking-wide">{titulo}</div>
      <div className="text-[10px] opacity-80 mt-0.5">{sub}</div>
    </div>
  );
}

function DetalhesAlerta({ alerta, onOpenLightbox }) {
  const cfg = STATUS_CONFIG[alerta.status] || STATUS_CONFIG.aberta;

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
        <Field label="Seção" value={alerta.secao} />
        <Field label="Auditado" value={alerta.auditado} />
        <Field label="Criticidade" value={alerta.criticidade} />
        <Field label="Criado em" value={new Date(alerta.created_at).toLocaleString('pt-BR')} />
      </div>

      {alerta.resposta && (
        <div>
          <div className="text-[11px] font-semibold uppercase text-gray-500 tracking-wide mb-1">Resposta do auditor</div>
          <div className="inline-block bg-rose-100 border border-rose-200 rounded-lg px-3 py-1.5 text-sm font-semibold text-rose-800">
            {alerta.resposta}
          </div>
        </div>
      )}

      {alerta.observacao && (
        <div>
          <div className="text-[11px] font-semibold uppercase text-gray-500 tracking-wide mb-1">Observação</div>
          <div className="text-sm text-gray-700 whitespace-pre-wrap bg-white border border-gray-200 rounded-lg p-3">
            {alerta.observacao}
          </div>
        </div>
      )}

      {Array.isArray(alerta.fotos) && alerta.fotos.length > 0 && (
        <div>
          <div className="text-[11px] font-semibold uppercase text-gray-500 tracking-wide mb-1">Evidências ({alerta.fotos.length})</div>
          <div className="flex flex-wrap gap-2">
            {alerta.fotos.map((url, i) => (
              <button key={i} type="button" onClick={() => onOpenLightbox(url)}
                className="w-20 h-20 rounded-lg overflow-hidden bg-gray-100 border border-gray-200 hover:ring-2 hover:ring-rose-400">
                <img src={url} alt={`Evidência ${i + 1}`} className="w-full h-full object-cover" />
              </button>
            ))}
          </div>
        </div>
      )}

      {alerta.whatsapp_group_name && (
        <div className="text-xs text-gray-600">
          💬 Enviado para: <strong>{alerta.whatsapp_group_name}</strong>
        </div>
      )}

      {/* Historico de resolucoes */}
      {Array.isArray(alerta.resolucao_historico) && alerta.resolucao_historico.length > 0 && (
        <div>
          <div className="text-[11px] font-semibold uppercase text-gray-500 tracking-wide mb-2">Histórico de resolução</div>
          <div className="space-y-2">
            {alerta.resolucao_historico.map((h, i) => (
              <div key={i} className={`border-l-4 rounded-r-lg p-3 ${h.tipo === 'definitivamente' ? 'border-emerald-500 bg-emerald-50' : 'border-amber-500 bg-amber-50'}`}>
                <div className="flex items-center justify-between mb-1 text-xs">
                  <span className={`font-bold ${h.tipo === 'definitivamente' ? 'text-emerald-700' : 'text-amber-700'}`}>
                    {h.tipo === 'definitivamente' ? '✅ Solucionado definitivamente' : '⏳ Solucionado previamente'}
                  </span>
                  <span className="text-gray-500">{new Date(h.timestamp).toLocaleString('pt-BR')}</span>
                </div>
                <div className="text-sm text-gray-800">{h.mensagem}</div>
                <div className="text-[11px] text-gray-500 mt-1">por <strong>{h.autor}</strong></div>
              </div>
            ))}
          </div>
        </div>
      )}

      {alerta.status !== 'concluida' && (!alerta.resolucao_historico || alerta.resolucao_historico.length === 0) && (
        <div className="bg-amber-50 border border-amber-200 text-amber-800 rounded-lg p-3 text-xs">
          ⏳ Aguardando resolução. Enviamos um link no grupo WhatsApp para o responsável marcar a providência.
        </div>
      )}
    </div>
  );
}

function Field({ label, value }) {
  return (
    <div>
      <div className="text-[10px] uppercase font-semibold text-gray-500 tracking-wide">{label}</div>
      <div className="text-xs text-gray-800 font-medium mt-0.5">{value || '—'}</div>
    </div>
  );
}
