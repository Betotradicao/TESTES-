import { useEffect, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import Sidebar from '../../components/Sidebar';
import api from '../../utils/api';

const STATUS_LABEL = {
  novo: { label: 'Novo', emoji: '🆕', bg: 'bg-sky-100 text-sky-800 border-sky-200' },
  em_analise: { label: 'Em análise', emoji: '🔎', bg: 'bg-amber-100 text-amber-800 border-amber-200' },
  aprovado: { label: 'Aprovado', emoji: '✅', bg: 'bg-emerald-100 text-emerald-800 border-emerald-200' },
  reprovado: { label: 'Reprovado', emoji: '❌', bg: 'bg-rose-100 text-rose-800 border-rose-200' },
  contratado: { label: 'Contratado', emoji: '🎉', bg: 'bg-indigo-100 text-indigo-800 border-indigo-200' },
};

export default function BancoCurriculos() {
  const { user, logout } = useAuth();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [curriculos, setCurriculos] = useState([]);
  const [resumo, setResumo] = useState({});
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState('');

  const [cargos, setCargos] = useState([]);
  const [habilidades, setHabilidades] = useState([]);

  const [filtros, setFiltros] = useState({
    cidade: '', bairro: '', cargo: '', habilidade: '', status: '', dataDe: '', dataAte: '', q: '', interesse_vaga: '',
  });

  const [selecionado, setSelecionado] = useState(null);

  const carregar = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      Object.entries(filtros).forEach(([k, v]) => { if (v) params.set(k, v); });
      const r = await api.get(`/curriculos?${params.toString()}`);
      setCurriculos(r.data?.curriculos || []);
      setResumo(r.data?.resumo || {});
    } catch (e) { setErro(e?.response?.data?.error || e.message); }
    finally { setLoading(false); }
  };

  useEffect(() => {
    (async () => {
      try {
        const [c, h] = await Promise.all([
          api.get('/curriculos/cargos'),
          api.get('/curriculos/habilidades'),
        ]);
        setCargos((c.data?.cargos || []).filter(x => x.ativo));
        setHabilidades((h.data?.habilidades || []).filter(x => x.ativo));
      } catch {}
    })();
    carregar();
    // eslint-disable-next-line
  }, []);

  const fmtData = (iso) => iso ? new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';

  const salvarStatus = async (id, campo, valor) => {
    try {
      await api.put(`/curriculos/${id}`, { [campo]: valor });
      await carregar();
      if (selecionado?.id === id) {
        const r = await api.get(`/curriculos/${id}`);
        setSelecionado(r.data?.curriculo || selecionado);
      }
    } catch (e) { setErro(e?.response?.data?.error || e.message); }
  };

  const excluirCV = async (cv) => {
    if (!window.confirm(`Excluir o currículo de "${cv.nome}"?`)) return;
    try {
      await api.delete(`/curriculos/${cv.id}`);
      setSelecionado(null);
      await carregar();
    } catch (e) { setErro(e?.response?.data?.error || e.message); }
  };

  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar user={user} onLogout={logout} isMobileMenuOpen={isMobileMenuOpen} setIsMobileMenuOpen={setIsMobileMenuOpen} />
      <div className="flex-1 min-w-0 overflow-auto overflow-x-hidden">
        <div className="bg-gradient-to-r from-pink-500 to-rose-600 text-white p-4 shadow">
          <div className="flex items-center gap-3">
            <button onClick={() => setIsMobileMenuOpen(true)} className="lg:hidden bg-white/20 hover:bg-white/30 rounded-lg p-2 transition">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16"/></svg>
            </button>
            <div className="flex-1 min-w-0">
              <h1 className="text-xl sm:text-2xl font-bold">📇 Banco de Currículos</h1>
              <p className="text-xs sm:text-sm opacity-90">Currículos recebidos via link público</p>
            </div>
          </div>
        </div>

        <div className="p-4 sm:p-6 max-w-7xl mx-auto">
          {erro && <div className="mb-3 p-3 bg-red-50 border border-red-200 text-red-700 rounded text-sm">{erro}</div>}

          {/* Resumo */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-2 mb-4">
            <Tile emoji="📇" titulo="Total" valor={resumo.total} grad="from-slate-500 to-gray-600" />
            <Tile emoji="🆕" titulo="Novo" valor={resumo.novo} grad="from-sky-500 to-blue-600" />
            <Tile emoji="🔎" titulo="Em análise" valor={resumo.em_analise} grad="from-amber-500 to-orange-600" />
            <Tile emoji="✅" titulo="Aprovado" valor={resumo.aprovado} grad="from-emerald-500 to-green-600" />
            <Tile emoji="🎉" titulo="Contratado" valor={resumo.contratado} grad="from-indigo-500 to-purple-600" />
          </div>

          {/* Filtros */}
          <div className="bg-white border-2 border-gray-100 rounded-xl p-3 shadow-sm mb-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              <FiltroInput label="Buscar" value={filtros.q} placeholder="nome, whatsapp, email…" onChange={v => setFiltros({ ...filtros, q: v })} />
              <FiltroInput label="Cidade" value={filtros.cidade} onChange={v => setFiltros({ ...filtros, cidade: v })} />
              <FiltroInput label="Bairro" value={filtros.bairro} onChange={v => setFiltros({ ...filtros, bairro: v })} />
              <FiltroSelect label="Status" value={filtros.status} onChange={v => setFiltros({ ...filtros, status: v })}>
                <option value="">Todos</option>
                {Object.entries(STATUS_LABEL).map(([k, v]) => <option key={k} value={k}>{v.emoji} {v.label}</option>)}
              </FiltroSelect>
              <FiltroSelect label="Tipo de vaga" value={filtros.interesse_vaga} onChange={v => setFiltros({ ...filtros, interesse_vaga: v })}>
                <option value="">Todos</option>
                <option value="clt">💼 CLT</option>
                <option value="aprendiz">🎓 Aprendiz</option>
              </FiltroSelect>
              <FiltroSelect label="Cargo" value={filtros.cargo} onChange={v => setFiltros({ ...filtros, cargo: v })}>
                <option value="">Todos</option>
                {cargos.map(c => <option key={c.id} value={c.nome}>{c.nome}</option>)}
              </FiltroSelect>
              <FiltroSelect label="Habilidade" value={filtros.habilidade} onChange={v => setFiltros({ ...filtros, habilidade: v })}>
                <option value="">Todas</option>
                {habilidades.map(h => <option key={h.id} value={h.nome}>{h.nome}</option>)}
              </FiltroSelect>
              <FiltroInput label="De" type="date" value={filtros.dataDe} onChange={v => setFiltros({ ...filtros, dataDe: v })} />
              <FiltroInput label="Até" type="date" value={filtros.dataAte} onChange={v => setFiltros({ ...filtros, dataAte: v })} />
            </div>
            <div className="flex justify-end gap-2 mt-2">
              <button onClick={() => { setFiltros({ cidade: '', bairro: '', cargo: '', habilidade: '', status: '', dataDe: '', dataAte: '', q: '', interesse_vaga: '' }); setTimeout(carregar, 0); }}
                className="text-xs px-3 py-1.5 border-2 border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50">Limpar</button>
              <button onClick={carregar} className="text-xs px-4 py-1.5 bg-rose-500 text-white rounded-lg font-bold hover:bg-rose-600">🔎 Aplicar filtros</button>
            </div>
          </div>

          {/* Lista */}
          {loading ? (
            <div className="text-gray-500 py-10 text-center">Carregando…</div>
          ) : curriculos.length === 0 ? (
            <div className="bg-white border-2 border-dashed rounded-xl p-10 text-center">
              <div className="text-5xl mb-2">📭</div>
              <div className="text-gray-600 font-semibold">Nenhum currículo encontrado.</div>
              <div className="text-xs text-gray-400 mt-1">Envie o link público pra candidatos em <strong>Modelo de Currículo</strong>.</div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {curriculos.map(cv => {
                const st = STATUS_LABEL[cv.status] || STATUS_LABEL.novo;
                return (
                  <button key={cv.id} onClick={() => setSelecionado(cv)}
                    className="text-left bg-white border-2 border-gray-100 rounded-xl p-3 shadow-sm hover:shadow-md hover:border-rose-200 transition">
                    <div className="flex items-start gap-3 mb-2">
                      {cv.foto_url ? (
                        <img src={cv.foto_url} alt="" className="w-14 h-14 rounded-full object-cover border-2 border-rose-200 shrink-0" />
                      ) : (
                        <div className="w-14 h-14 rounded-full bg-rose-100 text-rose-700 flex items-center justify-center font-bold text-xl shrink-0 border-2 border-rose-200">
                          {cv.nome?.charAt(0).toUpperCase() || '?'}
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <h4 className="text-sm font-bold text-gray-800 truncate">{cv.nome}</h4>
                        <div className="flex flex-wrap gap-1 mt-1">
                          <span className={`inline-block text-[10px] px-2 py-0.5 rounded-full font-bold border ${st.bg}`}>{st.emoji} {st.label}</span>
                          {cv.interesse_vaga && (
                            <span className="inline-block text-[10px] px-2 py-0.5 rounded-full font-bold border bg-slate-100 text-slate-700 border-slate-300">
                              {cv.interesse_vaga === 'clt' ? '💼 CLT' : '🎓 Aprendiz'}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="text-xs text-gray-600 space-y-0.5">
                      {cv.whatsapp && <div>📱 {cv.whatsapp}</div>}
                      {(cv.cidade || cv.bairro) && <div>📍 {[cv.bairro, cv.cidade, cv.estado].filter(Boolean).join(', ')}</div>}
                      <div>📅 {fmtData(cv.created_at)}</div>
                    </div>
                    {(cv.cargos?.length > 0) && (
                      <div className="mt-2 flex flex-wrap gap-1">
                        {cv.cargos.slice(0, 3).map((c, i) => (
                          <span key={i} className="text-[10px] px-2 py-0.5 bg-rose-50 border border-rose-200 text-rose-700 rounded-full">{c}</span>
                        ))}
                        {cv.cargos.length > 3 && <span className="text-[10px] text-gray-400">+{cv.cargos.length - 3}</span>}
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Modal de detalhe do currículo */}
      {selecionado && (
        <DetalheCV
          cv={selecionado}
          onFechar={() => setSelecionado(null)}
          onAtualizarStatus={(status) => salvarStatus(selecionado.id, 'status', status)}
          onAtualizarObs={(obs) => salvarStatus(selecionado.id, 'observacao_rh', obs)}
          onAtualizarAvaliacao={(n) => salvarStatus(selecionado.id, 'avaliacao_rh', n)}
          onExcluir={() => excluirCV(selecionado)}
        />
      )}
    </div>
  );
}

function Tile({ emoji, titulo, valor, grad }) {
  return (
    <div className={`bg-gradient-to-br ${grad} text-white rounded-xl p-3 shadow`}>
      <div className="text-xl mb-0.5">{emoji}</div>
      <div className="text-2xl font-extrabold">{Number(valor || 0)}</div>
      <div className="text-[10px] font-semibold opacity-90 uppercase">{titulo}</div>
    </div>
  );
}

function FiltroInput({ label, value, onChange, type = 'text', placeholder }) {
  return (
    <div>
      <label className="block text-[10px] font-semibold uppercase text-gray-500 mb-0.5">{label}</label>
      <input type={type} value={value} placeholder={placeholder} onChange={e => onChange(e.target.value)}
        className="w-full border-2 border-gray-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:border-rose-400" />
    </div>
  );
}
function FiltroSelect({ label, value, onChange, children }) {
  return (
    <div>
      <label className="block text-[10px] font-semibold uppercase text-gray-500 mb-0.5">{label}</label>
      <select value={value} onChange={e => onChange(e.target.value)}
        className="w-full border-2 border-gray-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:border-rose-400">
        {children}
      </select>
    </div>
  );
}

function DetalheCV({ cv, onFechar, onAtualizarStatus, onAtualizarObs, onAtualizarAvaliacao, onExcluir }) {
  const [obs, setObs] = useState(cv.observacao_rh || '');
  const st = STATUS_LABEL[cv.status] || STATUS_LABEL.novo;
  const salvarObs = () => onAtualizarObs(obs);

  const experiencias = Array.isArray(cv.experiencias_detalhadas) ? cv.experiencias_detalhadas : [];
  const formacoes = Array.isArray(cv.formacoes) ? cv.formacoes : [];

  const tempoStr = (ex) => {
    const a = Number(ex.tempo_anos) || 0;
    const m = Number(ex.tempo_meses) || 0;
    const partes = [];
    if (a > 0) partes.push(`${a} ${a === 1 ? 'ano' : 'anos'}`);
    if (m > 0) partes.push(`${m} ${m === 1 ? 'mês' : 'meses'}`);
    return partes.join(' e ');
  };

  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-2 sm:p-4" onClick={onFechar}>
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-5xl max-h-[95vh] overflow-hidden flex flex-col" onClick={e => e.stopPropagation()}>
        {/* Barra de ações do RH */}
        <div className="bg-gradient-to-r from-pink-500 to-rose-600 text-white p-3 flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`text-[11px] px-2 py-0.5 rounded-full font-bold border-2 border-white/30 ${st.bg}`}>{st.emoji} {st.label}</span>
            {cv.interesse_vaga && (
              <span className="text-[11px] px-2 py-0.5 rounded-full font-bold border-2 border-white/30 bg-white/20 text-white">
                {cv.interesse_vaga === 'clt' ? '💼 CLT' : '🎓 APRENDIZ'}
              </span>
            )}
            <span className="text-[11px] opacity-90">Recebido em {new Date(cv.created_at).toLocaleString('pt-BR')}</span>
          </div>
          <button onClick={onFechar} className="text-white/80 hover:text-white text-2xl">×</button>
        </div>

        {/* CV — Layout 2 colunas (igual modelo Maria Sá Vieira) */}
        <div className="flex-1 overflow-auto">
          <div className="grid grid-cols-1 md:grid-cols-[280px_1fr]">

            {/* ============ Coluna esquerda (escura) ============ */}
            <aside className="bg-slate-800 text-white p-5 space-y-5">
              {/* Foto */}
              <div className="flex justify-center">
                {cv.foto_url ? (
                  <img src={cv.foto_url} alt="" className="w-36 h-36 rounded-full object-cover border-4 border-white/20" />
                ) : (
                  <div className="w-36 h-36 rounded-full bg-slate-600 text-slate-300 flex items-center justify-center text-5xl font-bold border-4 border-white/20">
                    {cv.nome?.charAt(0).toUpperCase() || '?'}
                  </div>
                )}
              </div>

              {/* Contato */}
              <section>
                <h4 className="text-xs font-bold uppercase tracking-wider border-b border-white/20 pb-1 mb-2">📞 Contato</h4>
                <div className="text-xs space-y-1.5">
                  {cv.whatsapp && <div className="flex gap-2"><span>📱</span><span>{cv.whatsapp}</span></div>}
                  {cv.email && <div className="flex gap-2 break-all"><span>✉️</span><span>{cv.email}</span></div>}
                  {cv.instagram && <div className="flex gap-2 break-all"><span>📷</span><span>{cv.instagram}</span></div>}
                  {(cv.cidade || cv.bairro) && (
                    <div className="flex gap-2"><span>📍</span><span>{[cv.bairro, cv.cidade, cv.estado].filter(Boolean).join(', ')}</span></div>
                  )}
                  {cv.data_nascimento && (
                    <div className="flex gap-2"><span>🎂</span><span>{new Date(cv.data_nascimento).toLocaleDateString('pt-BR')}</span></div>
                  )}
                </div>
              </section>

              {/* Habilidades */}
              {cv.habilidades?.length > 0 && (
                <section>
                  <h4 className="text-xs font-bold uppercase tracking-wider border-b border-white/20 pb-1 mb-2">🔧 Habilidades</h4>
                  <ul className="text-xs space-y-1">
                    {cv.habilidades.map((h, i) => (
                      <li key={i} className="flex gap-2"><span className="text-rose-300">•</span><span>{h}</span></li>
                    ))}
                  </ul>
                </section>
              )}

              {/* Formação acadêmica */}
              {formacoes.length > 0 && (
                <section>
                  <h4 className="text-xs font-bold uppercase tracking-wider border-b border-white/20 pb-1 mb-2">🎓 Formação</h4>
                  <div className="text-xs space-y-2">
                    {formacoes.map((f, i) => (
                      <div key={i}>
                        <div className="font-semibold">
                          {f.curso || '—'}
                          {f.status && f.status !== 'concluido' && <span className="ml-1 text-slate-300 italic font-normal">({f.status})</span>}
                        </div>
                        {f.nome_curso && (
                          <div className="text-slate-300 text-[11px]">{f.nome_curso}</div>
                        )}
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {/* Cursos complementares */}
              {Array.isArray(cv.cursos_adicionais) && cv.cursos_adicionais.length > 0 && (
                <section>
                  <h4 className="text-xs font-bold uppercase tracking-wider border-b border-white/20 pb-1 mb-2">📖 Cursos</h4>
                  <ul className="text-xs space-y-1">
                    {cv.cursos_adicionais.filter(c => c && c.trim()).map((c, i) => (
                      <li key={i} className="flex gap-2"><span className="text-sky-300">•</span><span>{c}</span></li>
                    ))}
                  </ul>
                </section>
              )}

              {/* Informações adicionais */}
              {cv.experiencia_texto && (
                <section>
                  <h4 className="text-xs font-bold uppercase tracking-wider border-b border-white/20 pb-1 mb-2">ℹ️ Informações</h4>
                  <div className="text-xs whitespace-pre-wrap text-slate-200">{cv.experiencia_texto}</div>
                </section>
              )}
            </aside>

            {/* ============ Coluna direita (claro) ============ */}
            <main className="p-6 space-y-5 bg-white">
              {/* Nome destaque */}
              <div>
                <h2 className="text-2xl sm:text-3xl font-bold text-rose-700 leading-tight">{cv.nome}</h2>
                {cv.cargos?.length > 0 && (
                  <div className="text-sm text-gray-500 mt-1">{cv.cargos.slice(0, 3).join(' · ')}</div>
                )}
              </div>

              {/* Resumo */}
              {cv.resumo && (
                <section>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-rose-700 border-b-2 border-rose-200 pb-1 mb-2">Resumo</h3>
                  <p className="text-sm text-gray-700 whitespace-pre-wrap">{cv.resumo}</p>
                </section>
              )}

              {/* Experiências detalhadas */}
              {experiencias.length > 0 && (
                <section>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-rose-700 border-b-2 border-rose-200 pb-1 mb-2">Experiências</h3>
                  <div className="space-y-3">
                    {experiencias.map((ex, i) => (
                      <div key={i} className="border-l-4 border-rose-300 pl-3">
                        <div className="flex items-baseline justify-between gap-2 flex-wrap">
                          <h4 className="text-sm font-bold text-gray-800">{ex.funcao || '(sem função)'}</h4>
                          {tempoStr(ex) && <span className="text-xs text-gray-500">{tempoStr(ex)}</span>}
                        </div>
                        {ex.empresa && (
                          <div className="text-xs text-gray-600">
                            {ex.empresa}
                            {ex.empresa_instagram && (
                              <span className="ml-2 text-rose-600">· {ex.empresa_instagram}</span>
                            )}
                          </div>
                        )}
                        {ex.descricao && (
                          <p className="text-xs text-gray-700 mt-1 whitespace-pre-wrap">{ex.descricao}</p>
                        )}
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {/* Fallback: apenas lista de cargos sem detalhes */}
              {experiencias.length === 0 && cv.cargos?.length > 0 && (
                <section>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-rose-700 border-b-2 border-rose-200 pb-1 mb-2">Experiências como</h3>
                  <div className="flex flex-wrap gap-2">
                    {cv.cargos.map((c, i) => <span key={i} className="text-xs px-2 py-0.5 bg-rose-100 border border-rose-300 text-rose-800 rounded-full">{c}</span>)}
                  </div>
                </section>
              )}

              {/* Endereço completo */}
              {(cv.rua || cv.cidade) && (
                <section>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-rose-700 border-b-2 border-rose-200 pb-1 mb-2">Endereço completo</h3>
                  <p className="text-sm text-gray-700">
                    {[cv.rua, cv.numero, cv.complemento].filter(Boolean).join(', ')}
                    {cv.bairro && <>, {cv.bairro}</>}
                    <br />
                    {[cv.cidade, cv.estado].filter(Boolean).join(' - ')}
                    {cv.cep && <> · CEP {cv.cep}</>}
                  </p>
                </section>
              )}

              {/* Seção de avaliação do RH */}
              <section className="pt-4 border-t-2 border-gray-100">
                <h3 className="text-xs font-bold uppercase tracking-wider text-gray-700 mb-2">⭐ Avaliação do RH</h3>
                <div className="flex items-center gap-1 mb-3">
                  {[1, 2, 3, 4, 5].map(n => (
                    <button key={n} onClick={() => onAtualizarAvaliacao(n)}
                      className={`text-2xl transition ${cv.avaliacao_rh >= n ? 'text-amber-400' : 'text-gray-300 hover:text-amber-300'}`}>★</button>
                  ))}
                  {cv.avaliacao_rh != null && (
                    <button onClick={() => onAtualizarAvaliacao(null)} className="ml-2 text-xs text-gray-500 hover:text-gray-700 underline">limpar</button>
                  )}
                </div>
                <label className="text-[11px] font-semibold uppercase text-gray-500 block mb-1">Observação interna</label>
                <textarea value={obs} onChange={e => setObs(e.target.value)} onBlur={salvarObs} rows={3}
                  placeholder="Ex: entrevistei, gostei, mandar pro gerente…"
                  className="w-full border-2 border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-rose-400" />
              </section>
            </main>
          </div>
        </div>

        {/* Rodapé com ações */}
        <div className="p-3 border-t bg-gray-50 flex justify-between gap-2 flex-wrap">
          <div className="flex gap-1 flex-wrap">
            {Object.entries(STATUS_LABEL).map(([key, s]) => (
              <button key={key} onClick={() => onAtualizarStatus(key)}
                className={`text-xs px-3 py-1.5 border-2 rounded-lg font-bold ${cv.status === key ? s.bg + ' border-current' : 'border-gray-200 text-gray-600 hover:bg-gray-100'}`}>
                {s.emoji} {s.label}
              </button>
            ))}
          </div>
          <div className="flex gap-2">
            <button onClick={onExcluir} className="text-xs px-3 py-1.5 border-2 border-red-200 text-red-600 rounded-lg font-bold hover:bg-red-50">🗑️ Excluir</button>
            <button onClick={onFechar} className="text-xs px-3 py-1.5 bg-gray-200 rounded-lg font-bold hover:bg-gray-300">Fechar</button>
          </div>
        </div>
      </div>
    </div>
  );
}

