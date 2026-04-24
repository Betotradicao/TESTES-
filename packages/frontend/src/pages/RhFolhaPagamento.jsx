import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import Sidebar from '../components/Sidebar';
import { api } from '../utils/api';
import toast from 'react-hot-toast';
import RadarLoading from '../components/RadarLoading';

const MESES_LABEL = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

const LANCAMENTOS = [
  // Proventos
  { key: 'hora_extra_60', label: 'HE 60%', tipo: 'provento' },
  { key: 'hora_extra_60_inter', label: 'HE 60% Interjornada', tipo: 'provento' },
  { key: 'hora_extra_100', label: 'HE 100%', tipo: 'provento' },
  { key: 'adicional_noturno', label: 'Adic. Noturno', tipo: 'provento' },
  { key: 'quebra_caixa', label: 'Quebra Caixa', tipo: 'provento' },
  { key: 'ajuda_custo_domingo', label: 'Aj. Custo Domingo', tipo: 'provento' },
  { key: 'ajuda_custo_feriado', label: 'Aj. Custo Feriado', tipo: 'provento' },
  { key: 'insalubridade', label: 'Insalubridade', tipo: 'provento' },
  { key: 'premio', label: 'Prêmio', tipo: 'provento' },
  // Descontos
  { key: 'falta_dias', label: 'Falta (dias)', tipo: 'desconto' },
  { key: 'atraso_horas', label: 'Atraso (horas)', tipo: 'desconto' },
  { key: 'desconto_dsr', label: 'Desc. DSR', tipo: 'desconto' },
  { key: 'vale_transporte', label: 'Vale Transporte', tipo: 'desconto' },
  { key: 'desconto_quebra_caixa', label: 'Desc. Quebra Caixa', tipo: 'desconto' },
  { key: 'contribuicao_sindical', label: 'Contrib. Sindical', tipo: 'desconto' },
  { key: 'adiantamento', label: 'Adiantamento', tipo: 'desconto' },
  { key: 'compras', label: 'Compras', tipo: 'desconto' },
];

const fmtMoney = (n) => (Number(n) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export default function RhFolhaPagamento() {
  const { user, logout } = useAuth();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const anoAtual = new Date().getFullYear();
  const [ano, setAno] = useState(anoAtual);
  const [base, setBase] = useState('competencia'); // 'competencia' | 'caixa'
  const [tipo, setTipo] = useState('todos'); // 'todos' | 'proventos' | 'descontos'
  const [lancamento, setLancamento] = useState(''); // '' = todos
  const [empresaId, setEmpresaId] = useState('');
  const [colaboradorId, setColaboradorId] = useState('');

  const [empresas, setEmpresas] = useState([]);
  const [colaboradores, setColaboradores] = useState([]);
  const [resumo, setResumo] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const [r1, r2] = await Promise.all([
          api.get('/rh/empresas/stores/list'),
          api.get('/rh/colaboradores?status=ativo&limit=500'),
        ]);
        setEmpresas(Array.isArray(r1.data) ? r1.data : []);
        const list = r2.data?.data || r2.data || [];
        setColaboradores(Array.isArray(list) ? list : []);
      } catch { /* ignore */ }
    })();
  }, []);

  const carregar = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('ano', String(ano));
      params.set('base', base === 'caixa' ? 'caixa' : 'competencia');
      params.set('tipo', tipo);
      if (lancamento) params.set('lancamento', lancamento);
      if (empresaId) params.set('empresa_id', empresaId);
      if (colaboradorId) params.set('colaborador_id', colaboradorId);
      const r = await api.get(`/rh/folha/resumo-anual?${params}`);
      setResumo(r.data);
    } catch { toast.error('Erro ao carregar folha'); }
    finally { setLoading(false); }
  };

  useEffect(() => { carregar(); /* eslint-disable-next-line */ }, [ano, base, tipo, lancamento, empresaId, colaboradorId]);

  const proventos = resumo?.linhas.filter(l => l.tipo === 'provento') || [];
  const descontos = resumo?.linhas.filter(l => l.tipo === 'desconto') || [];

  const totaisProvMes = resumo?.totaisProv || Array(12).fill(0);
  const totaisDescMes = resumo?.totaisDesc || Array(12).fill(0);
  const liquidoMes = totaisProvMes.map((p, i) => p - totaisDescMes[i]);

  // Anos disponiveis (atual -3 ate atual +1)
  const anos = [];
  for (let y = anoAtual - 3; y <= anoAtual + 1; y++) anos.push(y);

  return (
    <div className="flex h-screen bg-gray-100">
      <Sidebar user={user} onLogout={logout} isMobileMenuOpen={isMobileMenuOpen} setIsMobileMenuOpen={setIsMobileMenuOpen} />

      <div className="flex-1 overflow-y-auto">
        <div className="bg-gradient-to-r from-orange-600 to-orange-500 text-white px-6 py-4">
          <h1 className="text-2xl font-bold">Folha de Pagamento</h1>
          <p className="text-orange-100 text-sm">Visão anual — proventos e descontos por mês</p>
        </div>

        {/* Filtros */}
        <div className="bg-white border-b px-4 py-3">
          <div className="grid grid-cols-2 md:grid-cols-7 gap-3 items-end">
            <div>
              <label className="block text-[10px] uppercase text-gray-600 font-semibold">Empresa</label>
              <select value={empresaId} onChange={e => setEmpresaId(e.target.value)}
                className="w-full border rounded-lg px-3 py-1.5 text-sm">
                <option value="">— Todas —</option>
                {empresas.map(e => (
                  <option key={e.id} value={e.id}>{e.apelido ? `Loja ${e.cod_loja} — ${e.apelido}` : e.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-[10px] uppercase text-gray-600 font-semibold">Ano</label>
              <select value={ano} onChange={e => setAno(Number(e.target.value))}
                className="w-full border rounded-lg px-3 py-1.5 text-sm font-bold">
                {anos.map(y => <option key={y} value={y}>{y}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-[10px] uppercase text-gray-600 font-semibold">Base do mês</label>
              <select value={base} onChange={e => setBase(e.target.value)}
                className="w-full border rounded-lg px-3 py-1.5 text-sm">
                <option value="competencia">📅 Competência</option>
                <option value="caixa">💰 Caixa</option>
              </select>
            </div>
            <div>
              <label className="block text-[10px] uppercase text-gray-600 font-semibold">Colaborador</label>
              <select value={colaboradorId} onChange={e => setColaboradorId(e.target.value)}
                className="w-full border rounded-lg px-3 py-1.5 text-sm">
                <option value="">— Todos —</option>
                {colaboradores.map(c => (
                  <option key={c.id} value={c.id}>{c.nome}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-[10px] uppercase text-gray-600 font-semibold">Tipo</label>
              <select value={tipo} onChange={e => { setTipo(e.target.value); setLancamento(''); }}
                className="w-full border rounded-lg px-3 py-1.5 text-sm">
                <option value="todos">Todos</option>
                <option value="proventos">✓ Só pagamentos</option>
                <option value="descontos">✗ Só descontos</option>
              </select>
            </div>
            <div className="col-span-2">
              <label className="block text-[10px] uppercase text-gray-600 font-semibold">Lançamento específico</label>
              <select value={lancamento} onChange={e => setLancamento(e.target.value)}
                className="w-full border rounded-lg px-3 py-1.5 text-sm">
                <option value="">— Todos os lançamentos —</option>
                {LANCAMENTOS
                  .filter(l => tipo === 'todos' || (tipo === 'proventos' ? l.tipo === 'provento' : l.tipo === 'desconto'))
                  .map(l => (
                    <option key={l.key} value={l.key}>{l.label} ({l.tipo === 'provento' ? '✓' : '✗'})</option>
                  ))}
              </select>
            </div>
          </div>
        </div>

        {/* Pivot Anual */}
        <div className="p-4">
          {loading ? (
            <div className="flex justify-center py-20"><RadarLoading size="sm" message="" /></div>
          ) : !resumo ? null : (
            <div className="bg-white rounded-lg border shadow-sm overflow-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-gray-700 text-white">
                    <th className="text-left px-3 py-2 sticky left-0 bg-gray-700 z-10 min-w-[200px]">Lançamento</th>
                    {MESES_LABEL.map(m => (
                      <th key={m} className="text-right px-2 py-2 min-w-[90px]">{m}</th>
                    ))}
                    <th className="text-right px-3 py-2 bg-blue-700 min-w-[110px]">Total {ano}</th>
                  </tr>
                </thead>
                <tbody>
                  {/* Pagamentos / Proventos */}
                  {proventos.length > 0 && (
                    <>
                      <tr className="bg-emerald-700 text-white">
                        <td colSpan={14} className="px-3 py-1.5 font-bold uppercase text-xs">✓ PAGAMENTOS (PROVENTOS)</td>
                      </tr>
                      {proventos.map(l => (
                        <tr key={l.key} className="hover:bg-emerald-50 border-b">
                          <td className="sticky left-0 bg-white px-3 py-1.5 font-medium text-gray-800">{l.label}</td>
                          {l.meses.map((v, i) => (
                            <td key={i} className={`px-2 py-1.5 text-right ${v > 0 ? 'text-emerald-700 font-semibold' : 'text-gray-300'}`}>
                              {v > 0 ? fmtMoney(v) : '—'}
                            </td>
                          ))}
                          <td className="px-3 py-1.5 text-right font-bold text-emerald-800 bg-emerald-50">{fmtMoney(l.total)}</td>
                        </tr>
                      ))}
                      <tr className="bg-emerald-100 font-bold border-b-2 border-emerald-300">
                        <td className="sticky left-0 bg-emerald-100 px-3 py-2 text-emerald-900">SUBTOTAL Pagamentos</td>
                        {totaisProvMes.map((v, i) => (
                          <td key={i} className="px-2 py-2 text-right text-emerald-900">{v > 0 ? fmtMoney(v) : '—'}</td>
                        ))}
                        <td className="px-3 py-2 text-right text-emerald-900 bg-emerald-200">{fmtMoney(resumo.totalProvAno)}</td>
                      </tr>
                    </>
                  )}

                  {/* Descontos */}
                  {descontos.length > 0 && (
                    <>
                      <tr className="bg-rose-700 text-white">
                        <td colSpan={14} className="px-3 py-1.5 font-bold uppercase text-xs">✗ DESCONTOS</td>
                      </tr>
                      {descontos.map(l => (
                        <tr key={l.key} className="hover:bg-rose-50 border-b">
                          <td className="sticky left-0 bg-white px-3 py-1.5 font-medium text-gray-800">{l.label}</td>
                          {l.meses.map((v, i) => (
                            <td key={i} className={`px-2 py-1.5 text-right ${v > 0 ? 'text-rose-700 font-semibold' : 'text-gray-300'}`}>
                              {v > 0 ? fmtMoney(v) : '—'}
                            </td>
                          ))}
                          <td className="px-3 py-1.5 text-right font-bold text-rose-800 bg-rose-50">{fmtMoney(l.total)}</td>
                        </tr>
                      ))}
                      <tr className="bg-rose-100 font-bold border-b-2 border-rose-300">
                        <td className="sticky left-0 bg-rose-100 px-3 py-2 text-rose-900">SUBTOTAL Descontos</td>
                        {totaisDescMes.map((v, i) => (
                          <td key={i} className="px-2 py-2 text-right text-rose-900">{v > 0 ? fmtMoney(v) : '—'}</td>
                        ))}
                        <td className="px-3 py-2 text-right text-rose-900 bg-rose-200">{fmtMoney(resumo.totalDescAno)}</td>
                      </tr>
                    </>
                  )}

                  {/* Liquido (proventos - descontos) */}
                  {tipo === 'todos' && (
                    <tr className="bg-blue-600 text-white font-bold">
                      <td className="sticky left-0 bg-blue-600 px-3 py-2.5 uppercase text-xs">Líquido (Pagto − Desc)</td>
                      {liquidoMes.map((v, i) => (
                        <td key={i} className="px-2 py-2.5 text-right">{v !== 0 ? fmtMoney(v) : '—'}</td>
                      ))}
                      <td className="px-3 py-2.5 text-right bg-blue-800">{fmtMoney(resumo.liquidoAno)}</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}

          {!loading && resumo && resumo.linhas.length === 0 && (
            <div className="text-center py-16 text-gray-400">
              <div className="text-5xl mb-2">📋</div>
              <p>Nenhum lançamento encontrado pra esses filtros</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
