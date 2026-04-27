import { useEffect, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import Sidebar from '../../components/Sidebar';
import { api } from '../../utils/api';
import toast from 'react-hot-toast';

export default function PesquisaClimaAnalise() {
  const { user, logout } = useAuth();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [modelos, setModelos] = useState([]);
  const [modeloAberto, setModeloAberto] = useState(null);
  const [rodadas, setRodadas] = useState([]);
  const [criandoRodada, setCriandoRodada] = useState(false);
  const [novaRodadaNome, setNovaRodadaNome] = useState('');
  const [dashRodada, setDashRodada] = useState(null);

  useEffect(() => { (async () => {
    try {
      const r = await api.get('/pesquisa-clima/modelos');
      setModelos(Array.isArray(r.data) ? r.data : []);
    } catch { toast.error('Erro ao carregar'); }
  })(); }, []);

  const abrirModelo = async (m) => {
    setModeloAberto(m);
    try {
      const r = await api.get('/pesquisa-clima/rodadas', { params: { modelo_id: m.id } });
      setRodadas(Array.isArray(r.data) ? r.data : []);
    } catch { toast.error('Erro ao carregar rodadas'); }
  };

  const criarRodada = async () => {
    if (!novaRodadaNome.trim() || !modeloAberto) return;
    try {
      await api.post('/pesquisa-clima/rodadas', { modelo_id: modeloAberto.id, nome: novaRodadaNome.trim() });
      toast.success('Rodada criada');
      setNovaRodadaNome(''); setCriandoRodada(false);
      abrirModelo(modeloAberto);
    } catch (e) { toast.error(e.response?.data?.error || 'Erro'); }
  };

  const togglerAberta = async (r) => {
    try {
      await api.put(`/pesquisa-clima/rodadas/${r.id}`, { aberta: !r.aberta });
      abrirModelo(modeloAberto);
    } catch (e) { toast.error(e.response?.data?.error || 'Erro'); }
  };

  const excluirRodada = async (r) => {
    if (!window.confirm(`Excluir rodada "${r.nome}" e todas suas ${r.total_respostas} respostas?`)) return;
    try {
      await api.delete(`/pesquisa-clima/rodadas/${r.id}`);
      toast.success('Excluída');
      abrirModelo(modeloAberto);
    } catch (e) { toast.error(e.response?.data?.error || 'Erro'); }
  };

  const copiarLink = (token) => {
    const url = `${window.location.origin}/pesquisa-publica/${token}`;
    navigator.clipboard.writeText(url);
    toast.success('Link copiado!');
  };

  const verDashboard = async (r) => {
    try {
      const resp = await api.get(`/pesquisa-clima/rodadas/${r.id}/dashboard`);
      setDashRodada(resp.data);
    } catch (e) { toast.error('Erro ao abrir dashboard'); }
  };

  return (
    <div className="flex h-screen bg-gray-100">
      <Sidebar user={user} onLogout={logout} isMobileMenuOpen={isMobileMenuOpen} setIsMobileMenuOpen={setIsMobileMenuOpen} />
      <div className="flex-1 overflow-y-auto">
        <div className="bg-gradient-to-r from-pink-600 to-rose-500 text-white px-6 py-4">
          <h1 className="text-2xl font-bold">📊 Análise de Pesquisas</h1>
          <p className="text-pink-100 text-sm">Acompanhe rodadas, evolução temporal e dashboards comparativos.</p>
        </div>

        <div className="p-4 md:p-6">
          {dashRodada ? (
            <DashboardRodada data={dashRodada} voltar={() => setDashRodada(null)} />
          ) : !modeloAberto ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {modelos.map(m => (
                <button key={m.id} onClick={() => abrirModelo(m)}
                  className="bg-white rounded-lg shadow border-2 border-transparent hover:border-rose-300 transition p-4 text-left">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-3xl">{m.icone || '📋'}</span>
                    <h3 className="font-bold flex-1">{m.nome}</h3>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-center text-xs">
                    <div className="bg-blue-50 rounded p-2">
                      <div className="font-bold text-blue-700">{m.qtd_perguntas}</div>
                      <div className="text-gray-600">perguntas</div>
                    </div>
                    <div className="bg-emerald-50 rounded p-2">
                      <div className="font-bold text-emerald-700">{m.qtd_rodadas}</div>
                      <div className="text-gray-600">rodadas</div>
                    </div>
                    <div className="bg-amber-50 rounded p-2">
                      <div className="font-bold text-amber-700">{m.total_respostas}</div>
                      <div className="text-gray-600">respostas</div>
                    </div>
                  </div>
                </button>
              ))}
              {modelos.length === 0 && (
                <div className="col-span-full text-center text-gray-400 py-16">
                  Nenhuma pesquisa criada. Vá em <strong>Criar Pesquisas</strong>.
                </div>
              )}
            </div>
          ) : (
            <>
              <div className="flex items-center gap-2 mb-4">
                <button onClick={() => { setModeloAberto(null); setRodadas([]); }}
                  className="px-3 py-1.5 rounded bg-gray-200 hover:bg-gray-300 text-sm">← Voltar</button>
                <h2 className="text-lg font-bold flex-1">{modeloAberto.icone} {modeloAberto.nome} — Rodadas</h2>
                <button onClick={() => setCriandoRodada(true)}
                  className="bg-rose-500 hover:bg-rose-600 text-white px-4 py-2 rounded-lg font-bold text-sm">
                  ➕ Nova Rodada
                </button>
              </div>

              {criandoRodada && (
                <div className="bg-white rounded-lg shadow p-4 mb-4 border-2 border-rose-300">
                  <label className="block text-sm font-bold mb-1">Nome da rodada</label>
                  <input type="text" value={novaRodadaNome}
                    onChange={e => setNovaRodadaNome(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && criarRodada()}
                    placeholder="Ex: 1º Trimestre 2026 / Avaliação Maio/2026"
                    className="w-full border rounded px-3 py-2 mb-2" autoFocus />
                  <div className="flex gap-2">
                    <button onClick={criarRodada} className="bg-rose-500 text-white px-4 py-2 rounded font-bold">Criar Rodada</button>
                    <button onClick={() => { setCriandoRodada(false); setNovaRodadaNome(''); }} className="bg-gray-200 px-4 py-2 rounded">Cancelar</button>
                  </div>
                </div>
              )}

              <div className="space-y-3">
                {rodadas.map(r => (
                  <div key={r.id} className="bg-white rounded-lg shadow p-4 flex flex-wrap items-center gap-3">
                    <div className="flex-1 min-w-[200px]">
                      <div className="font-bold">{r.nome}</div>
                      <div className="text-xs text-gray-500">
                        Criada em {new Date(r.created_at).toLocaleDateString('pt-BR')} ·
                        {r.aberta ? <span className="text-emerald-600 font-bold"> 🟢 Aberta</span> : <span className="text-gray-500"> ⛔ Fechada</span>}
                      </div>
                    </div>
                    <div className="bg-amber-50 rounded px-3 py-1 text-center">
                      <div className="font-bold text-amber-700">{r.total_respostas}</div>
                      <div className="text-xs text-gray-600">respostas</div>
                    </div>
                    {r.nps_medio != null && (
                      <div className="bg-blue-50 rounded px-3 py-1 text-center">
                        <div className="font-bold text-blue-700">{Number(r.nps_medio).toFixed(1)}</div>
                        <div className="text-xs text-gray-600">NPS médio</div>
                      </div>
                    )}
                    <button onClick={() => copiarLink(r.token_publico)}
                      className="bg-blue-100 hover:bg-blue-200 text-blue-700 px-3 py-1.5 rounded text-sm font-bold">
                      🔗 Copiar Link
                    </button>
                    <button onClick={() => togglerAberta(r)}
                      className={`px-3 py-1.5 rounded text-sm font-bold ${r.aberta ? 'bg-amber-100 hover:bg-amber-200 text-amber-800' : 'bg-emerald-100 hover:bg-emerald-200 text-emerald-700'}`}>
                      {r.aberta ? '⛔ Fechar' : '🟢 Abrir'}
                    </button>
                    <button onClick={() => verDashboard(r)} disabled={r.total_respostas === 0}
                      className="bg-rose-500 hover:bg-rose-600 text-white px-3 py-1.5 rounded text-sm font-bold disabled:opacity-50">
                      📊 Dashboard
                    </button>
                    <button onClick={() => excluirRodada(r)}
                      className="bg-red-100 hover:bg-red-200 text-red-700 px-3 py-1.5 rounded text-sm">🗑️</button>
                  </div>
                ))}
                {rodadas.length === 0 && (
                  <div className="text-center text-gray-400 py-10">Nenhuma rodada criada ainda.</div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function DashboardRodada({ data, voltar }) {
  const { rodada, analise } = data;
  return (
    <>
      <div className="flex items-center gap-2 mb-4">
        <button onClick={voltar} className="px-3 py-1.5 rounded bg-gray-200 hover:bg-gray-300 text-sm">← Voltar</button>
        <h2 className="text-lg font-bold flex-1">📊 {rodada.modelo_nome} — {rodada.nome}</h2>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        <Card label="Respostas" value={rodada.total_respostas} cor="amber" />
        <Card label="NPS Médio" value={rodada.nps_medio != null ? Number(rodada.nps_medio).toFixed(1) : '—'} cor="blue" />
        <Card label="Aberta?" value={rodada.aberta ? 'SIM' : 'NÃO'} cor={rodada.aberta ? 'emerald' : 'gray'} />
        <Card label="Perguntas" value={analise.length} cor="rose" />
      </div>

      <div className="space-y-3">
        {analise.map(p => (
          <div key={p.id} className="bg-white rounded-lg shadow p-4">
            <div className="flex justify-between items-start mb-2">
              <div>
                {p.secao && <span className="bg-gray-100 text-gray-600 text-xs px-2 py-0.5 rounded mr-2">{p.secao}</span>}
                <span className="font-bold text-sm">{p.enunciado}</span>
              </div>
              <span className="text-xs text-gray-500 whitespace-nowrap">{p.total_respostas} respostas</span>
            </div>

            {p.tipo === 'nps_0_10' && (
              <div className="grid grid-cols-3 gap-2 text-center mt-2">
                <div className="bg-emerald-50 rounded p-2">
                  <div className="text-2xl font-bold text-emerald-700">{p.distribuicao?.promotores || 0}</div>
                  <div className="text-xs">😍 Promotores (9-10)</div>
                </div>
                <div className="bg-amber-50 rounded p-2">
                  <div className="text-2xl font-bold text-amber-700">{p.distribuicao?.passivos || 0}</div>
                  <div className="text-xs">😐 Passivos (7-8)</div>
                </div>
                <div className="bg-red-50 rounded p-2">
                  <div className="text-2xl font-bold text-red-700">{p.distribuicao?.detratores || 0}</div>
                  <div className="text-xs">😠 Detratores (0-6)</div>
                </div>
                <div className="col-span-3 mt-2 text-center bg-blue-50 rounded p-2">
                  <span className="text-3xl font-bold text-blue-700">{p.nps}</span>
                  <span className="text-sm text-gray-600 ml-2">NPS · média {Number(p.media).toFixed(1)}/10</span>
                </div>
              </div>
            )}

            {p.tipo === 'rating_5_matriz' && p.medias_criterios && (
              <div className="space-y-1 mt-2">
                {Object.entries(p.medias_criterios).map(([c, m]) => (
                  <div key={c} className="flex items-center gap-2 text-sm">
                    <div className="w-44 truncate">{c}</div>
                    <div className="flex-1 bg-gray-200 rounded h-3 overflow-hidden">
                      <div className="bg-rose-500 h-3" style={{ width: `${(Number(m) / 5) * 100}%` }}></div>
                    </div>
                    <div className="w-12 text-right font-bold">{Number(m).toFixed(2)}</div>
                  </div>
                ))}
              </div>
            )}

            {(p.tipo === 'multipla_escolha' || p.tipo === 'sim_nao' || p.tipo === 'checkbox') && p.distribuicao && (
              <div className="space-y-1 mt-2">
                {Object.entries(p.distribuicao).sort((a, b) => b[1] - a[1]).map(([k, v]) => {
                  const total = Object.values(p.distribuicao).reduce((a, b) => a + b, 0);
                  const pct = total ? (v / total) * 100 : 0;
                  return (
                    <div key={k} className="flex items-center gap-2 text-sm">
                      <div className="w-48 truncate">{k}</div>
                      <div className="flex-1 bg-gray-200 rounded h-3 overflow-hidden">
                        <div className="bg-rose-500 h-3" style={{ width: `${pct}%` }}></div>
                      </div>
                      <div className="w-20 text-right text-xs">{v} ({pct.toFixed(0)}%)</div>
                    </div>
                  );
                })}
              </div>
            )}

            {(p.tipo === 'texto_curto' || p.tipo === 'texto_longo') && (
              <div className="mt-2 space-y-1 max-h-60 overflow-y-auto">
                {(p.respostas || []).map((r, i) => (
                  <div key={i} className="bg-gray-50 rounded p-2 text-sm border-l-2 border-rose-300">{r}</div>
                ))}
                {(!p.respostas || p.respostas.length === 0) && <div className="text-gray-400 text-sm italic">Nenhuma resposta de texto.</div>}
              </div>
            )}
          </div>
        ))}
      </div>
    </>
  );
}

function Card({ label, value, cor }) {
  const cores = {
    amber: 'bg-amber-50 text-amber-700 border-amber-200',
    blue: 'bg-blue-50 text-blue-700 border-blue-200',
    emerald: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    rose: 'bg-rose-50 text-rose-700 border-rose-200',
    gray: 'bg-gray-50 text-gray-700 border-gray-200',
  };
  return (
    <div className={`rounded-lg border p-3 text-center ${cores[cor]}`}>
      <div className="text-2xl font-bold">{value}</div>
      <div className="text-xs uppercase font-semibold">{label}</div>
    </div>
  );
}
