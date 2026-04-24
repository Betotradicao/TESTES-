import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import Sidebar from '../components/Sidebar';
import { api } from '../utils/api';
import toast from 'react-hot-toast';
import RadarLoading from '../components/RadarLoading';

const DIAS_SEMANA = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

function mesAtualStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export default function RhEscala() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const [empresas, setEmpresas] = useState([]);
  const [setores, setSetores] = useState([]);
  const [companyId, setCompanyId] = useState('');
  const [departamentoId, setDepartamentoId] = useState('');
  const [mes, setMes] = useState(mesAtualStr());

  const [turnos, setTurnos] = useState([]);
  const [grid, setGrid] = useState(null);
  const [loading, setLoading] = useState(false);

  const [celulaEdit, setCelulaEdit] = useState(null); // { colaboradorId, data, codigoAtual }

  // Carrega empresas + setores + turnos uma vez
  useEffect(() => {
    (async () => {
      try {
        const [r1, r2, r3] = await Promise.all([
          api.get('/rh/empresas/stores/list'),
          api.get('/rh/configuracoes/departamentos'),
          api.get('/rh/escala/turnos'),
        ]);
        const emps = Array.isArray(r1.data) ? r1.data : [];
        setEmpresas(emps);
        if (emps.length > 0 && !companyId) setCompanyId(emps[0].id);
        setSetores(Array.isArray(r2.data) ? r2.data : (r2.data?.departamentos || []));
        setTurnos(Array.isArray(r3.data) ? r3.data : []);
      } catch (e) {
        console.error(e);
      }
    })();
    // eslint-disable-next-line
  }, []);

  const carregarGrid = async () => {
    if (!companyId) return;
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('company_id', companyId);
      if (departamentoId) params.set('departamento_id', departamentoId);
      params.set('mes', mes);
      const r = await api.get(`/rh/escala/grid?${params}`);
      setGrid(r.data);
    } catch (e) {
      toast.error('Erro ao carregar escala');
    } finally { setLoading(false); }
  };

  useEffect(() => {
    if (companyId) carregarGrid();
    // eslint-disable-next-line
  }, [companyId, departamentoId, mes]);

  const setorNome = useMemo(() => {
    if (!departamentoId) return 'Todos os setores';
    const s = setores.find(s => String(s.id) === String(departamentoId));
    return s?.nome || 'Setor';
  }, [departamentoId, setores]);

  const mesNome = useMemo(() => {
    const [y, m] = mes.split('-').map(Number);
    const d = new Date(y, m - 1, 1);
    return d.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
  }, [mes]);

  const salvarCelula = async (turnoId) => {
    if (!celulaEdit) return;
    try {
      if (turnoId === null) {
        await api.delete('/rh/escala/celula', { data: { colaboradorId: celulaEdit.colaboradorId, data: celulaEdit.data } });
      } else {
        await api.post('/rh/escala/celula', { colaboradorId: celulaEdit.colaboradorId, data: celulaEdit.data, turnoId });
      }
      setCelulaEdit(null);
      await carregarGrid();
    } catch {
      toast.error('Erro ao salvar');
    }
  };

  return (
    <div className="flex h-screen bg-gray-100">
      <Sidebar user={user} onLogout={logout} isMobileMenuOpen={isMobileMenuOpen} setIsMobileMenuOpen={setIsMobileMenuOpen} />
      <div className="flex-1 overflow-y-auto">
        {/* Header */}
        <div className="bg-gradient-to-r from-orange-600 to-orange-500 text-white px-6 py-4">
          <h1 className="text-2xl font-bold">Escala de Trabalho</h1>
          <p className="text-orange-100 text-sm">Planejamento mensal — {setorNome} · {mesNome}</p>
        </div>

        {/* Filtros */}
        <div className="bg-white border-b px-6 py-3 flex items-center gap-3 flex-wrap">
          <div>
            <label className="block text-[10px] uppercase text-gray-500 font-semibold">Loja</label>
            <select value={companyId} onChange={e => setCompanyId(e.target.value)}
              className="border rounded-lg px-3 py-1.5 text-sm">
              {empresas.map(e => (
                <option key={e.id} value={e.id}>{e.apelido ? `Loja ${e.cod_loja} — ${e.apelido}` : e.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-[10px] uppercase text-gray-500 font-semibold">Setor</label>
            <select value={departamentoId} onChange={e => setDepartamentoId(e.target.value)}
              className="border rounded-lg px-3 py-1.5 text-sm font-medium text-orange-600">
              <option value="">— Todos os setores —</option>
              {setores.map(s => (
                <option key={s.id} value={s.id}>{s.nome}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-[10px] uppercase text-gray-500 font-semibold">Mês</label>
            <input type="month" value={mes} onChange={e => setMes(e.target.value)}
              className="border rounded-lg px-3 py-1.5 text-sm" />
          </div>
          <div className="flex-1" />
          <button onClick={carregarGrid}
            className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-sm font-semibold">
            ↻ Recarregar
          </button>
        </div>

        {/* Grid */}
        <div className="px-6 py-4">
          {loading ? (
            <div className="flex justify-center py-20"><RadarLoading size="sm" message="Carregando escala..." /></div>
          ) : !grid || grid.colaboradores.length === 0 ? (
            <div className="bg-white rounded-lg shadow p-10 text-center text-gray-400">
              <div className="text-5xl mb-3">📅</div>
              <p className="font-semibold">Nenhum colaborador encontrado pra este filtro</p>
              <p className="text-xs mt-1">Ajuste o setor ou cadastre colaboradores ativos.</p>
            </div>
          ) : (
            <div className="bg-white rounded-lg shadow border overflow-auto" style={{ maxHeight: '75vh' }}>
              <table className="text-xs">
                <thead>
                  <tr className="bg-gray-50">
                    <th className="sticky left-0 z-20 bg-gray-50 px-3 py-2 text-left font-semibold text-gray-700 border-b"
                        style={{ minWidth: 260 }}>Colaborador</th>
                    {grid.dias.map(d => {
                      const [ , mm, dd ] = d.data.split('-');
                      const dsInfo = DIAS_SEMANA[d.diaSemana];
                      const bg = d.ehFeriado ? 'bg-red-100 text-red-900 font-bold'
                        : d.diaSemana === 0 ? 'bg-red-50 text-red-700' : '';
                      return (
                        <th key={d.data} className={`px-1 py-1 text-center font-semibold border-b ${bg}`}
                            style={{ minWidth: 52 }}
                            title={d.ehFeriado ? d.nomeFeriado : ''}>
                          <div>{Number(dd)}</div>
                          <div className="text-[9px] font-normal">{d.ehFeriado ? 'FR' : dsInfo}</div>
                        </th>
                      );
                    })}
                    <th className="px-2 py-2 text-right font-semibold text-gray-700 border-b bg-amber-50" style={{ minWidth: 70 }}>Σ Mês</th>
                  </tr>
                </thead>
                <tbody>
                  {grid.colaboradores.map(c => (
                    <tr key={c.id} className="hover:bg-orange-50/30">
                      <td className="sticky left-0 z-10 bg-white border-b px-3 py-2">
                        <div className="flex items-center gap-2">
                          {c.fotoUrl ? (
                            <img src={c.fotoUrl} alt="" className="w-8 h-8 rounded-full object-cover" />
                          ) : (
                            <div className="w-8 h-8 rounded-full bg-orange-100 text-orange-700 flex items-center justify-center font-bold text-xs">
                              {c.nome?.charAt(0) || '?'}
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <div className="font-semibold text-gray-800 text-xs leading-tight">{c.nome}</div>
                            <div className="text-[10px] text-gray-500 leading-tight">{c.cargoNome || '—'}</div>
                            <div className="flex gap-1 mt-0.5 flex-wrap">
                              {c.jornadaNome && (
                                <span className="text-[9px] bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded font-semibold">
                                  {c.jornadaCarga || c.jornadaNome}
                                </span>
                              )}
                              {c.tipoRotacao && (
                                <span className="text-[9px] bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded font-semibold">
                                  {c.tipoRotacao}
                                </span>
                              )}
                              {!c.temTemplate && (
                                <span className="text-[9px] bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded font-semibold" title="Ainda não tem template - clique em editar">
                                  ⚠ sem template
                                </span>
                              )}
                            </div>
                          </div>
                          <button onClick={e => { e.stopPropagation(); navigate(`/rh/escala/template/${c.id}`); }}
                            title="Editar template semanal"
                            className="shrink-0 p-1.5 rounded hover:bg-orange-100 text-orange-600">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/>
                            </svg>
                          </button>
                        </div>
                      </td>
                      {c.celulas.map(cel => {
                        const bg = cel.cor ? { backgroundColor: cel.cor } : {};
                        const txt = cel.codigo || '';
                        return (
                          <td key={cel.data}
                              onClick={() => setCelulaEdit({ colaboradorId: c.id, data: cel.data, codigoAtual: cel.codigo })}
                              className="border-b text-center text-[10px] font-bold cursor-pointer hover:ring-2 hover:ring-orange-400"
                              style={{ ...bg, padding: '3px 2px' }}
                              title={cel.origem + (cel.observacao ? ` · ${cel.observacao}` : '')}>
                            {txt}
                          </td>
                        );
                      })}
                      <td className="border-b px-2 py-2 text-right font-semibold text-emerald-700 bg-amber-50">{c.horasMes}h</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Legenda */}
          {grid && grid.turnos.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-2 text-xs">
              {grid.turnos.map(t => (
                <span key={t.id} className="px-3 py-1 rounded font-semibold" style={{ backgroundColor: t.cor || '#E5E7EB' }} title={t.nome}>
                  {t.codigo} {t.horaInicio ? `· ${t.horaInicio.slice(0,5)}` : ''}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Modal editar celula */}
      {celulaEdit && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setCelulaEdit(null)}>
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full" onClick={e => e.stopPropagation()}>
            <div className="p-4 border-b">
              <h3 className="font-bold text-gray-800">Editar turno</h3>
              <p className="text-xs text-gray-500">{celulaEdit.data} — atual: {celulaEdit.codigoAtual || '(vazio)'}</p>
            </div>
            <div className="p-4 space-y-1 max-h-96 overflow-y-auto">
              <button onClick={() => salvarCelula(null)}
                className="w-full text-left px-3 py-2 rounded hover:bg-gray-100 text-sm text-red-600 font-semibold">
                🗑️ Limpar (voltar pro template)
              </button>
              {turnos.map(t => (
                <button key={t.id} onClick={() => salvarCelula(t.id)}
                  className="w-full text-left px-3 py-2 rounded hover:bg-gray-100 text-sm flex items-center gap-2">
                  <span className="inline-block w-4 h-4 rounded" style={{ backgroundColor: t.cor || '#E5E7EB' }}></span>
                  <span className="font-semibold">{t.codigo}</span>
                  <span className="text-gray-500 text-xs">{t.nome}</span>
                  {t.horaInicio && <span className="ml-auto text-gray-400 text-xs">{t.horaInicio.slice(0,5)}</span>}
                </button>
              ))}
            </div>
            <div className="p-4 border-t flex justify-end">
              <button onClick={() => setCelulaEdit(null)}
                className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-sm font-semibold">
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
