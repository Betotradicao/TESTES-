import { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useLoja } from '../../contexts/LojaContext';
import Sidebar from '../../components/Sidebar';
import api from '../../utils/api';

export default function ChecklistDashboards() {
  const { user, logout } = useAuth();
  const { lojaSelecionada } = useLoja();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [dados, setDados] = useState(null);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState('');
  const [dias, setDias] = useState(30);

  useEffect(() => { carregar(); /* eslint-disable-next-line */ }, [lojaSelecionada, dias]);

  const carregar = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (lojaSelecionada != null) params.set('cod_loja', String(lojaSelecionada));
      params.set('dias', String(dias));
      const res = await api.get(`/checklist/dashboard/completo?${params.toString()}`);
      setDados(res.data);
    } catch (e) { setErro(e?.response?.data?.error || e.message); }
    finally { setLoading(false); }
  };

  const fmtData = (iso) => iso ? new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }) : '—';

  const corPct = (pct, meta = 95) => {
    const p = Number(pct) || 0;
    if (p >= meta) return 'text-emerald-600';
    if (p >= 70) return 'text-teal-600';
    if (p >= 50) return 'text-amber-600';
    return 'text-rose-600';
  };
  const bgBar = (pct, meta = 95) => {
    const p = Number(pct) || 0;
    if (p >= meta) return 'bg-emerald-500';
    if (p >= 70) return 'bg-teal-500';
    if (p >= 50) return 'bg-amber-500';
    return 'bg-rose-500';
  };
  const medalha = (pos) => pos === 0 ? '🥇' : pos === 1 ? '🥈' : pos === 2 ? '🥉' : null;

  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar user={user} onLogout={logout} isMobileMenuOpen={isMobileMenuOpen} setIsMobileMenuOpen={setIsMobileMenuOpen} />
      <div className="flex-1 min-w-0 overflow-auto overflow-x-hidden">
        <div className="bg-gradient-to-r from-teal-500 to-teal-600 text-white p-4 shadow">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-3 flex-1 min-w-0">
              <button onClick={() => setIsMobileMenuOpen(true)}
                className="lg:hidden bg-white/20 hover:bg-white/30 rounded-lg p-2 transition">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16"/>
                </svg>
              </button>
              <div className="min-w-0">
                <h1 className="text-xl sm:text-2xl font-bold">📊 Dashboards</h1>
                <p className="text-xs sm:text-sm opacity-90">Indicadores de conformidade e performance</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm opacity-90">Período:</span>
              <select value={dias} onChange={e => setDias(parseInt(e.target.value))}
                className="bg-white/20 border border-white/40 rounded px-2 py-1 text-sm text-white backdrop-blur">
                <option value="7">Últimos 7 dias</option>
                <option value="30">Últimos 30 dias</option>
                <option value="90">Últimos 90 dias</option>
                <option value="365">Último ano</option>
              </select>
            </div>
          </div>
        </div>

        <div className="p-4 sm:p-6 max-w-7xl mx-auto">
          {erro && <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded text-sm">{erro}</div>}
          {loading ? (
            <div className="text-gray-500 py-10 text-center">Carregando…</div>
          ) : !dados ? (
            <div className="text-gray-500 py-10 text-center">Sem dados.</div>
          ) : (
            <>
              {/* Dados Gerais — tiles */}
              <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-5">
                <TileGrande titulo="Auditorias" valor={dados.dados_gerais.auditorias_concluidas} sub="concluídas" emoji="✅" grad="from-emerald-500 to-green-600" />
                <TileGrande titulo="Setores" valor={dados.dados_gerais.setores} sub="cadastrados" emoji="📂" grad="from-sky-500 to-blue-600" />
                <TileGrande titulo="Lojas" valor={dados.dados_gerais.filiais} sub="auditadas" emoji="🏪" grad="from-amber-500 to-orange-600" />
                <TileGrande titulo="Auditores" valor={dados.dados_gerais.auditores} sub="liberados" emoji="👤" grad="from-violet-500 to-purple-600" />
                <TileGrande titulo="Roteiros" valor={dados.dados_gerais.questionarios} sub="ativos" emoji="📝" grad="from-rose-500 to-red-600" />
              </div>

              {/* Desempenho */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-5">
                <div className="bg-white border-2 border-gray-100 rounded-xl p-5 shadow-sm">
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-xl">🎯</span>
                    <h3 className="font-bold text-gray-700">Desempenho Geral</h3>
                    <span className="ml-auto text-xs text-gray-400">últimos {dias}d</span>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <div className="text-xs uppercase text-gray-500 font-semibold">Total</div>
                      <div className="text-3xl font-extrabold text-gray-800 mt-1">{dados.desempenho.total}</div>
                    </div>
                    <div>
                      <div className="text-xs uppercase text-gray-500 font-semibold">Média</div>
                      <div className={`text-3xl font-extrabold mt-1 ${corPct(dados.desempenho.percentual_medio)}`}>
                        {dados.desempenho.percentual_medio.toFixed(1)}%
                      </div>
                    </div>
                  </div>
                </div>

                {/* Planos de ação */}
                <div className="bg-white border-2 border-gray-100 rounded-xl p-5 shadow-sm">
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-xl">⚡</span>
                    <h3 className="font-bold text-gray-700">Planos de Ação</h3>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div className="bg-amber-100 border border-amber-300 rounded-lg p-2">
                      <div className="text-xl font-bold text-amber-700">{dados.planos_acao.abertas}</div>
                      <div className="text-[10px] text-amber-700 font-semibold uppercase">Abertas</div>
                    </div>
                    <div className="bg-rose-100 border border-rose-300 rounded-lg p-2">
                      <div className="text-xl font-bold text-rose-700">{dados.planos_acao.atrasadas}</div>
                      <div className="text-[10px] text-rose-700 font-semibold uppercase">Atrasadas</div>
                    </div>
                    <div className="bg-emerald-100 border border-emerald-300 rounded-lg p-2">
                      <div className="text-xl font-bold text-emerald-700">{dados.planos_acao.concluidas}</div>
                      <div className="text-[10px] text-emerald-700 font-semibold uppercase">Concluídas</div>
                    </div>
                  </div>
                </div>

                {/* Últimas auditorias — resumo */}
                <div className="bg-white border-2 border-gray-100 rounded-xl p-5 shadow-sm">
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-xl">🕒</span>
                    <h3 className="font-bold text-gray-700">Últimas Auditorias</h3>
                  </div>
                  {dados.ultimas_auditorias.length === 0 ? (
                    <div className="text-sm text-gray-400 italic">Nenhuma auditoria no período</div>
                  ) : (
                    <ul className="space-y-1.5 text-xs max-h-36 overflow-auto">
                      {dados.ultimas_auditorias.slice(0, 5).map(u => (
                        <li key={u.id} className="flex items-center gap-2">
                          <span className="text-gray-400 shrink-0">{fmtData(u.data)}</span>
                          <span className="truncate flex-1">{u.template}</span>
                          <span className={`font-bold shrink-0 ${corPct(u.percentual, u.meta)}`}>
                            {u.percentual.toFixed(0)}%
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>

              {/* Ranking Colaboradores Auditados */}
              <div className="bg-white border-2 border-gray-100 rounded-xl p-5 shadow-sm mb-5">
                <div className="flex items-center gap-2 mb-4">
                  <span className="text-2xl">🏆</span>
                  <h3 className="font-bold text-gray-700 text-lg">Ranking — Colaboradores Auditados</h3>
                  <span className="ml-auto text-xs text-gray-400">Média de conformidade nas auditorias em que foi avaliado</span>
                </div>
                {dados.ranking_auditados.length === 0 ? (
                  <div className="text-sm text-gray-400 italic text-center py-6">Nenhum colaborador auditado no período</div>
                ) : (
                  <div className="space-y-2">
                    {dados.ranking_auditados.map((a, i) => (
                      <div key={a.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50">
                        <div className="w-8 text-center text-lg font-bold text-gray-500 shrink-0">
                          {medalha(i) || `${i + 1}º`}
                        </div>
                        {a.avatar ? (
                          <img src={a.avatar} alt={a.nome} className="w-10 h-10 rounded-full object-cover border shrink-0" />
                        ) : (
                          <div className="w-10 h-10 rounded-full bg-teal-100 text-teal-700 flex items-center justify-center font-bold shrink-0">
                            {a.nome.charAt(0).toUpperCase()}
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <div className="font-semibold text-gray-800 truncate">{a.nome}</div>
                          <div className="text-xs text-gray-500">
                            {a.total} auditoria(s){a.cod_loja != null && ` · Loja ${a.cod_loja}`}
                          </div>
                        </div>
                        <div className="w-40 sm:w-56 shrink-0">
                          <div className="flex justify-end mb-0.5">
                            <span className={`font-bold ${corPct(a.media)}`}>{a.media.toFixed(1)}%</span>
                          </div>
                          <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                            <div className={`h-full ${bgBar(a.media)}`} style={{ width: `${Math.min(100, a.media)}%` }} />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Heatmap Loja x Roteiro */}
              {dados.heatmap_loja_roteiro && dados.heatmap_loja_roteiro.length > 0 && (
                <HeatmapLojaRoteiro
                  dados={dados.heatmap_loja_roteiro}
                  companies={dados.ranking_lojas}
                  roteiros={dados.ranking_questionarios}
                  corPct={corPct}
                  bgBar={bgBar}
                />
              )}

              {/* Grafico de Evolucao multi-loja */}
              {dados.evolucao_multiloja && dados.evolucao_multiloja.series && dados.evolucao_multiloja.series.length > 0 && (
                <EvolucaoMultiLoja
                  data={dados.evolucao_multiloja}
                  companies={dados.ranking_lojas}
                />
              )}

              {/* Top 10 perguntas nao-conformes */}
              {dados.top_perguntas_nc && dados.top_perguntas_nc.length > 0 && (
                <TopPerguntasNC dados={dados.top_perguntas_nc} />
              )}

              {/* Rankings lado a lado */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-5">
                {/* Ranking Lojas */}
                <div className="bg-white border-2 border-gray-100 rounded-xl p-5 shadow-sm">
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-xl">🏪</span>
                    <h3 className="font-bold text-gray-700">Desempenho das Lojas</h3>
                    <span className="ml-auto text-[10px] text-gray-400">barra x meta da loja</span>
                  </div>
                  {dados.ranking_lojas.length === 0 ? (
                    <div className="text-sm text-gray-400 italic text-center py-6">Sem dados</div>
                  ) : (
                    <div className="space-y-2">
                      {dados.ranking_lojas.map((l, i) => {
                        const meta = Number(l.meta) || 95;
                        const atingiu = Number(l.media) >= meta;
                        return (
                          <div key={i} className="flex items-center gap-3">
                            <div className="w-7 text-center text-sm font-bold text-gray-500">{medalha(i) || (i + 1)}</div>
                            <div className="flex-1 min-w-0">
                              <div className="font-semibold text-sm text-gray-800 truncate">
                                {l.cod_loja != null ? `Loja ${l.cod_loja}` : 'Sem loja'}
                                {l.apelido && <span className="text-gray-500 font-normal"> · {l.apelido}</span>}
                              </div>
                              <div className="text-xs text-gray-500">
                                {l.total} auditoria(s) · meta {meta.toFixed(0)}%
                                {atingiu ? <span className="ml-1 text-emerald-600 font-semibold">✓ atingiu</span> : <span className="ml-1 text-rose-600 font-semibold">abaixo</span>}
                              </div>
                            </div>
                            <div className="w-24 sm:w-36 shrink-0">
                              <div className={`text-xs text-right font-bold ${corPct(l.media, meta)} mb-0.5`}>{l.media.toFixed(1)}%</div>
                              <div className="h-2 bg-gray-200 rounded-full overflow-hidden relative">
                                <div className={`h-full ${bgBar(l.media, meta)}`} style={{ width: `${Math.min(100, l.media)}%` }} />
                                <div className="absolute top-0 bottom-0 w-0.5 bg-gray-600 opacity-80"
                                  style={{ left: `${Math.min(100, meta)}%` }} title={`Meta ${meta}%`} />
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Ranking Questionários */}
                <div className="bg-white border-2 border-gray-100 rounded-xl p-5 shadow-sm">
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-xl">📝</span>
                    <h3 className="font-bold text-gray-700">Desempenho dos Roteiros</h3>
                  </div>
                  {dados.ranking_questionarios.length === 0 ? (
                    <div className="text-sm text-gray-400 italic text-center py-6">Sem dados</div>
                  ) : (
                    <div className="space-y-2">
                      {dados.ranking_questionarios.map((q, i) => (
                        <div key={q.id} className="flex items-center gap-3">
                          <div className="w-7 text-center text-sm font-bold text-gray-500">{medalha(i) || (i + 1)}</div>
                          <div className="flex-1 min-w-0">
                            <div className="font-semibold text-sm text-gray-800 truncate">{q.nome}</div>
                            <div className="text-xs text-gray-500">{q.total} auditoria(s) · meta {q.meta.toFixed(0)}%</div>
                          </div>
                          <div className="w-24 sm:w-36 shrink-0">
                            <div className={`text-xs text-right font-bold ${corPct(q.media, q.meta)} mb-0.5`}>{q.media.toFixed(1)}%</div>
                            <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                              <div className={`h-full ${bgBar(q.media, q.meta)}`} style={{ width: `${Math.min(100, q.media)}%` }} />
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Planos de Ação em Aberto — lista */}
              {dados.planos_acao.lista.length > 0 && (
                <div className="bg-white border-2 border-gray-100 rounded-xl p-5 shadow-sm">
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-xl">⚡</span>
                    <h3 className="font-bold text-gray-700">Planos de Ação em Aberto</h3>
                    <span className="ml-auto text-xs text-gray-400">{dados.planos_acao.lista.length} ação(ões)</span>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm min-w-[600px]">
                      <thead className="text-xs uppercase text-gray-500 bg-gray-50">
                        <tr>
                          <th className="text-left px-3 py-2">Ação</th>
                          <th className="text-left px-3 py-2">Responsável</th>
                          <th className="text-center px-3 py-2">Criticidade</th>
                          <th className="text-center px-3 py-2">Prazo</th>
                          <th className="text-center px-3 py-2">Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {dados.planos_acao.lista.map(p => (
                          <tr key={p.id} className={`border-t ${p.atrasada ? 'bg-rose-50' : ''}`}>
                            <td className="px-3 py-2">{p.what}</td>
                            <td className="px-3 py-2 text-gray-700">{p.responsavel || '—'}</td>
                            <td className="px-3 py-2 text-center">
                              <span className={`text-xs px-2 py-0.5 rounded font-semibold ${p.criticidade === 'alta' ? 'bg-rose-100 text-rose-700' : p.criticidade === 'media' ? 'bg-amber-100 text-amber-700' : 'bg-green-100 text-green-700'}`}>
                                {p.criticidade}
                              </span>
                            </td>
                            <td className="px-3 py-2 text-center text-gray-700">{p.prazo ? new Date(p.prazo).toLocaleDateString('pt-BR') : '—'}</td>
                            <td className="px-3 py-2 text-center">
                              {p.atrasada ? <span className="text-rose-600 font-bold text-xs">⚠️ Atrasada</span> : <span className="text-amber-600 text-xs">Aberta</span>}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function TileGrande({ titulo, valor, sub, emoji, grad }) {
  return (
    <div className={`bg-gradient-to-br ${grad} text-white rounded-xl p-4 shadow-md`}>
      <div className="text-2xl mb-1">{emoji}</div>
      <div className="text-3xl font-extrabold">{valor}</div>
      <div className="text-xs font-semibold opacity-90 uppercase tracking-wide">{titulo}</div>
      <div className="text-[11px] opacity-80 mt-0.5">{sub}</div>
    </div>
  );
}

// Heatmap Loja x Roteiro
function HeatmapLojaRoteiro({ dados, companies, roteiros, corPct, bgBar }) {
  // Lojas unicas (ordenadas por media desc, como veio em ranking_lojas)
  const lojasUnicas = Array.from(new Set(dados.map(d => d.cod_loja).filter(v => v != null))).sort((a, b) => a - b);
  // Roteiros unicos
  const roteirosUnicos = roteiros.map(r => ({ id: r.id, nome: r.nome, meta: r.meta }));

  // Map: cod_loja -> template_id -> {media, total, meta}
  const mapa = {};
  for (const d of dados) {
    if (d.cod_loja == null) continue;
    if (!mapa[d.cod_loja]) mapa[d.cod_loja] = {};
    mapa[d.cod_loja][d.template_id] = d;
  }

  const corCell = (pct, meta) => {
    if (pct == null) return 'bg-gray-100 text-gray-300';
    if (pct >= meta) return 'bg-emerald-500 text-white';
    if (pct >= 70) return 'bg-teal-400 text-white';
    if (pct >= 50) return 'bg-amber-400 text-amber-900';
    return 'bg-rose-500 text-white';
  };

  return (
    <div className="bg-white border-2 border-gray-100 rounded-xl p-5 shadow-sm mb-5">
      <div className="flex items-center gap-2 mb-3 flex-wrap">
        <span className="text-xl">🗺️</span>
        <h3 className="font-bold text-gray-700">Heatmap — Lojas × Roteiros</h3>
        <span className="ml-auto text-xs text-gray-400">% média de conformidade</span>
      </div>
      {lojasUnicas.length === 0 || roteirosUnicos.length === 0 ? (
        <div className="text-sm text-gray-400 italic text-center py-6">Sem dados suficientes</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-xs min-w-[500px]">
            <thead>
              <tr>
                <th className="text-left px-2 py-2 text-gray-600 sticky left-0 bg-white z-10">Roteiro</th>
                {lojasUnicas.map(cl => (
                  <th key={cl} className="px-2 py-2 text-center text-gray-600">
                    Loja {cl}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {roteirosUnicos.map(r => (
                <tr key={r.id} className="border-t">
                  <td className="px-2 py-2 font-semibold text-gray-700 sticky left-0 bg-white max-w-[180px] truncate">
                    {r.nome}
                  </td>
                  {lojasUnicas.map(cl => {
                    const cell = mapa[cl]?.[r.id];
                    const pct = cell ? cell.media : null;
                    const meta = cell ? cell.meta : r.meta;
                    return (
                      <td key={cl} className="px-1 py-1 text-center">
                        <div className={`rounded-md py-2 px-1 font-bold ${corCell(pct, meta)}`}>
                          {pct != null ? `${pct.toFixed(0)}%` : '—'}
                          {cell && <div className="text-[9px] font-normal opacity-80">{cell.total}x</div>}
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <div className="flex items-center gap-3 mt-3 text-[11px] text-gray-600 flex-wrap">
        <span className="flex items-center gap-1"><span className="inline-block w-3 h-3 bg-emerald-500 rounded" /> acima da meta</span>
        <span className="flex items-center gap-1"><span className="inline-block w-3 h-3 bg-teal-400 rounded" /> ≥ 70%</span>
        <span className="flex items-center gap-1"><span className="inline-block w-3 h-3 bg-amber-400 rounded" /> ≥ 50%</span>
        <span className="flex items-center gap-1"><span className="inline-block w-3 h-3 bg-rose-500 rounded" /> abaixo</span>
      </div>
    </div>
  );
}

// Grafico de linha SVG multi-loja
function EvolucaoMultiLoja({ data, companies }) {
  const { labels = [], series = [] } = data || {};
  const [lojasVisiveis, setLojasVisiveis] = useState(() => series.map(s => s.cod_loja));

  const toggleLoja = (cl) => {
    setLojasVisiveis(prev => prev.includes(cl) ? prev.filter(x => x !== cl) : [...prev, cl]);
  };

  const cores = ['#0ea5e9', '#f43f5e', '#10b981', '#a855f7', '#f59e0b', '#06b6d4', '#ec4899', '#84cc16', '#6366f1', '#f97316'];
  const serieCor = (idx) => cores[idx % cores.length];

  // Dimensoes SVG
  const W = 800, H = 260, pad = { l: 40, r: 20, t: 20, b: 40 };
  const iw = W - pad.l - pad.r, ih = H - pad.t - pad.b;

  const xFor = (i) => pad.l + (labels.length <= 1 ? iw / 2 : (i * iw) / (labels.length - 1));
  const yFor = (pct) => pad.t + ih - (Math.max(0, Math.min(100, pct)) / 100) * ih;

  const fmtLabel = (iso) => {
    try {
      const [, m, d] = iso.split('-');
      return `${d}/${m}`;
    } catch { return iso; }
  };

  const tickX = Math.max(1, Math.ceil(labels.length / 8));

  return (
    <div className="bg-white border-2 border-gray-100 rounded-xl p-5 shadow-sm mb-5">
      <div className="flex items-center gap-2 mb-3 flex-wrap">
        <span className="text-xl">📈</span>
        <h3 className="font-bold text-gray-700">Evolução de Conformidade — Multi-loja</h3>
        <span className="ml-auto text-xs text-gray-400">% por dia</span>
      </div>
      {/* Legenda / toggles */}
      <div className="flex flex-wrap gap-2 mb-3">
        {series.map((s, idx) => {
          const ativo = lojasVisiveis.includes(s.cod_loja);
          return (
            <button
              key={idx}
              onClick={() => toggleLoja(s.cod_loja)}
              className={`text-xs px-3 py-1 rounded-full border-2 font-semibold transition ${ativo ? 'text-white' : 'text-gray-400 bg-white'}`}
              style={ativo ? { backgroundColor: serieCor(idx), borderColor: serieCor(idx) } : { borderColor: '#e5e7eb' }}
            >
              {s.cod_loja != null ? `Loja ${s.cod_loja}` : 'Sem loja'}{s.nome ? ` · ${s.nome.substring(0, 18)}` : ''}
            </button>
          );
        })}
      </div>
      <div className="overflow-x-auto">
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ minWidth: 500 }}>
          {/* Grid */}
          {[0, 25, 50, 75, 100].map(pct => (
            <g key={pct}>
              <line x1={pad.l} y1={yFor(pct)} x2={W - pad.r} y2={yFor(pct)} stroke="#f3f4f6" strokeWidth={1} />
              <text x={pad.l - 6} y={yFor(pct) + 3} fontSize={10} textAnchor="end" fill="#9ca3af">{pct}</text>
            </g>
          ))}
          {/* Eixo X */}
          {labels.map((l, i) => (
            i % tickX === 0 && (
              <text key={i} x={xFor(i)} y={H - pad.b + 15} fontSize={9} textAnchor="middle" fill="#6b7280">
                {fmtLabel(l)}
              </text>
            )
          ))}
          {/* Series */}
          {series.map((s, idx) => {
            if (!lojasVisiveis.includes(s.cod_loja)) return null;
            const cor = serieCor(idx);
            // Monta path ignorando null (quebra a linha)
            let d = '';
            let openSegment = false;
            s.data.forEach((pct, i) => {
              if (pct == null) { openSegment = false; return; }
              const cmd = openSegment ? 'L' : 'M';
              d += `${cmd}${xFor(i).toFixed(2)},${yFor(pct).toFixed(2)} `;
              openSegment = true;
            });
            return (
              <g key={idx}>
                <path d={d} fill="none" stroke={cor} strokeWidth={2.2} strokeLinejoin="round" strokeLinecap="round" />
                {s.data.map((pct, i) => pct != null && (
                  <circle key={i} cx={xFor(i)} cy={yFor(pct)} r={2.5} fill={cor} />
                ))}
                {/* linha da meta (tracejada) */}
                {s.meta != null && (
                  <line x1={pad.l} y1={yFor(s.meta)} x2={W - pad.r} y2={yFor(s.meta)}
                    stroke={cor} strokeWidth={1} strokeDasharray="4 3" opacity={0.4} />
                )}
              </g>
            );
          })}
        </svg>
      </div>
      <p className="text-[11px] text-gray-500 mt-1 italic">Linhas tracejadas = meta da loja correspondente.</p>
    </div>
  );
}

// Top 10 perguntas com mais Nao-Conforme
function TopPerguntasNC({ dados }) {
  return (
    <div className="bg-white border-2 border-gray-100 rounded-xl p-5 shadow-sm mb-5">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-xl">🚨</span>
        <h3 className="font-bold text-gray-700">Top perguntas com "Não Conforme"</h3>
        <span className="ml-auto text-xs text-gray-400">top 10 no período</span>
      </div>
      <div className="space-y-2">
        {dados.map((p, i) => {
          const maxNC = Math.max(...dados.map(x => x.total_nc), 1);
          const widthPct = (p.total_nc / maxNC) * 100;
          return (
            <div key={p.question_id} className="border border-rose-100 rounded-lg p-3 hover:bg-rose-50/40 transition">
              <div className="flex items-start gap-2">
                <div className="w-6 text-center text-rose-600 font-bold shrink-0">{i + 1}</div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold text-gray-800 break-words">{p.pergunta}</div>
                  {p.template_nome && (
                    <div className="text-[11px] text-gray-500 mt-0.5">📝 {p.template_nome}</div>
                  )}
                  <div className="mt-2 flex items-center gap-3">
                    <div className="flex-1 h-2 bg-rose-100 rounded-full overflow-hidden">
                      <div className="h-full bg-rose-500" style={{ width: `${widthPct}%` }} />
                    </div>
                    <div className="text-xs text-gray-600 font-semibold whitespace-nowrap">
                      {p.total_nc} NC / {p.total_respostas} · <span className="text-rose-600">{p.pct_nc.toFixed(1)}%</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
