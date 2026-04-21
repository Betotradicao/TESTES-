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

              {/* Rankings lado a lado */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-5">
                {/* Ranking Lojas */}
                <div className="bg-white border-2 border-gray-100 rounded-xl p-5 shadow-sm">
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-xl">🏪</span>
                    <h3 className="font-bold text-gray-700">Desempenho das Lojas</h3>
                  </div>
                  {dados.ranking_lojas.length === 0 ? (
                    <div className="text-sm text-gray-400 italic text-center py-6">Sem dados</div>
                  ) : (
                    <div className="space-y-2">
                      {dados.ranking_lojas.map((l, i) => (
                        <div key={i} className="flex items-center gap-3">
                          <div className="w-7 text-center text-sm font-bold text-gray-500">{medalha(i) || (i + 1)}</div>
                          <div className="flex-1 min-w-0">
                            <div className="font-semibold text-sm text-gray-800">
                              {l.cod_loja != null ? `Loja ${l.cod_loja}` : 'Sem loja'}
                            </div>
                            <div className="text-xs text-gray-500">{l.total} auditoria(s)</div>
                          </div>
                          <div className="w-24 sm:w-36 shrink-0">
                            <div className={`text-xs text-right font-bold ${corPct(l.media)} mb-0.5`}>{l.media.toFixed(1)}%</div>
                            <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                              <div className={`h-full ${bgBar(l.media)}`} style={{ width: `${Math.min(100, l.media)}%` }} />
                            </div>
                          </div>
                        </div>
                      ))}
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
