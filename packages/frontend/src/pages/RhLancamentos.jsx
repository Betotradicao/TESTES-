import { useEffect, useState } from 'react';
import { api } from '../utils/api';
import Sidebar from '../components/Sidebar';
import { useAuth } from '../contexts/AuthContext';
import toast from 'react-hot-toast';

const PROVENTOS = [
  { key: 'hora_extra_60', label: 'HE 60%' },
  { key: 'hora_extra_60_inter', label: 'HE 60% Interj.' },
  { key: 'hora_extra_100', label: 'HE 100%' },
  { key: 'adicional_noturno', label: 'Adic. Noturno' },
  { key: 'quebra_caixa', label: 'Quebra Caixa' },
  { key: 'ajuda_custo_domingo', label: 'Aj. Dom.' },
  { key: 'ajuda_custo_feriado', label: 'Aj. Feriado' },
  { key: 'insalubridade', label: 'Insalub.' },
  { key: 'premio', label: 'Prêmio' },
];
const DESCONTOS = [
  { key: 'falta_dias', label: 'Falta (dias)' },
  { key: 'atraso_horas', label: 'Atraso (h)' },
  { key: 'desconto_dsr', label: 'Desc. DSR' },
  { key: 'vale_transporte', label: 'VT' },
  { key: 'desconto_quebra_caixa', label: 'Desc. Quebra' },
  { key: 'contribuicao_sindical', label: 'Contrib. Sind.' },
  { key: 'adiantamento', label: 'Adiantamento' },
  { key: 'compras', label: 'Compras' },
];
const ALL = [...PROVENTOS, ...DESCONTOS];

function hoje() { return new Date().toISOString().split('T')[0]; }
function primeiroDiaMes() {
  const d = new Date(); d.setDate(1);
  return d.toISOString().split('T')[0];
}

export default function RhLancamentos() {
  const { user, logout } = useAuth();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const [empresas, setEmpresas] = useState([]);
  const [companyId, setCompanyId] = useState('');
  const [dataInicio, setDataInicio] = useState(primeiroDiaMes());
  const [dataFim, setDataFim] = useState(hoje());

  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // Campos customizados (extras)
  const [camposExtras, setCamposExtras] = useState([]); // [{ chave, label, tipo }]
  const [showNovaColuna, setShowNovaColuna] = useState(false);
  const [novaLabel, setNovaLabel] = useState('');
  const [novoTipo, setNovoTipo] = useState('provento');

  useEffect(() => {
    (async () => {
      try {
        const r = await api.get('/rh/empresas/stores/list');
        const data = Array.isArray(r.data) ? r.data : (r.data?.companies || []);
        setEmpresas(data);
      } catch { /* ignore */ }
    })();
    carregarCampos();
  }, []);

  const carregarCampos = async () => {
    try {
      const r = await api.get('/rh/apontamentos/campos');
      setCamposExtras(Array.isArray(r.data) ? r.data : []);
    } catch { setCamposExtras([]); }
  };

  const criarColuna = async () => {
    if (!novaLabel.trim()) return;
    try {
      await api.post('/rh/apontamentos/campos', { label: novaLabel.trim(), tipo: novoTipo });
      toast.success('Coluna criada');
      setShowNovaColuna(false);
      setNovaLabel('');
      setNovoTipo('provento');
      await carregarCampos();
    } catch (err) { toast.error(err?.response?.data?.error || 'Erro ao criar coluna'); }
  };

  const deletarColuna = async (id) => {
    if (!window.confirm('Remover essa coluna? (os valores já salvos permanecem no banco)')) return;
    try {
      await api.delete(`/rh/apontamentos/campos/${id}`);
      toast.success('Coluna removida');
      await carregarCampos();
    } catch { toast.error('Erro'); }
  };

  const extrasProventos = camposExtras.filter(c => c.tipo === 'provento');
  const extrasDescontos = camposExtras.filter(c => c.tipo === 'desconto');

  const carregar = async () => {
    if (!dataInicio || !dataFim) { toast.error('Informe o período'); return; }
    setLoading(true);
    try {
      const params = new URLSearchParams({ data_inicio: dataInicio, data_fim: dataFim });
      if (companyId) params.append('company_id', companyId);
      const r = await api.get(`/rh/apontamentos?${params.toString()}`);
      const data = Array.isArray(r.data) ? r.data : [];
      // Normaliza campos numericos
      setRows(data.map(d => {
        const obj = { ...d, campos_extras: d.campos_extras || {} };
        ALL.forEach(c => { obj[c.key] = d[c.key] == null ? '' : String(d[c.key]); });
        return obj;
      }));
    } catch (err) {
      toast.error('Erro ao carregar apontamentos');
    } finally { setLoading(false); }
  };

  const updateCell = (colaboradorId, key, value) => {
    setRows(rs => rs.map(r => r.colaborador_id === colaboradorId ? { ...r, [key]: value } : r));
  };
  const updateExtra = (colaboradorId, chave, value) => {
    setRows(rs => rs.map(r => r.colaborador_id === colaboradorId
      ? { ...r, campos_extras: { ...(r.campos_extras || {}), [chave]: value } } : r));
  };

  const salvarTudo = async () => {
    if (rows.length === 0) { toast.error('Nada pra salvar'); return; }
    setSaving(true);
    try {
      const payload = {
        data_inicio: dataInicio,
        data_fim: dataFim,
        company_id: companyId || null,
        apontamentos: rows.map(r => {
          const a = { colaborador_id: r.colaborador_id, observacao: r.observacao || '', campos_extras: r.campos_extras || {} };
          ALL.forEach(c => { a[c.key] = r[c.key]; });
          return a;
        })
      };
      const r = await api.post('/rh/apontamentos/batch', payload);
      toast.success(`${r.data.salvos || 0} registro(s) salvo(s)`);
    } catch (err) {
      toast.error(err?.response?.data?.error || 'Erro ao salvar');
    } finally { setSaving(false); }
  };

  const exportar = async (tipo) => {
    try {
      const params = new URLSearchParams({ data_inicio: dataInicio, data_fim: dataFim });
      if (companyId) params.append('company_id', companyId);
      const endpoint = tipo === 'pdf' ? 'pdf' : 'excel';
      const r = await api.get(`/rh/apontamentos/${endpoint}?${params.toString()}`, { responseType: 'blob' });
      const mime = tipo === 'pdf' ? 'application/pdf' : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
      const ext = tipo === 'pdf' ? 'pdf' : 'xlsx';
      const blob = new Blob([r.data], { type: mime });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `apontamento_${dataInicio}_${dataFim}.${ext}`;
      document.body.appendChild(a); a.click(); a.remove();
      URL.revokeObjectURL(url);
    } catch { toast.error('Erro ao exportar'); }
  };

  // Totais por colaborador (inclui extras)
  const totais = (r) => {
    const prov = PROVENTOS.reduce((s, c) => s + (Number(r[c.key]) || 0), 0)
      + extrasProventos.reduce((s, c) => s + (Number(r.campos_extras?.[c.chave]) || 0), 0);
    const desc = DESCONTOS.reduce((s, c) => s + (Number(r[c.key]) || 0), 0)
      + extrasDescontos.reduce((s, c) => s + (Number(r.campos_extras?.[c.chave]) || 0), 0);
    const sal = Number(r.salario) || 0;
    return { prov, desc, liq: sal + prov - desc };
  };

  const fmtMoney = (n) => (Number(n) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  return (
    <div className="flex h-screen bg-gray-100">
      <Sidebar user={user} onLogout={logout} isMobileMenuOpen={isMobileMenuOpen} setIsMobileMenuOpen={setIsMobileMenuOpen} />

      <div className="flex-1 overflow-hidden flex flex-col">
        <div className="bg-gradient-to-r from-orange-600 to-orange-500 text-white px-6 py-4">
          <h1 className="text-2xl font-bold">Lançamentos Financeiros</h1>
          <p className="text-orange-100 text-sm">Apontamento de folha de pagamento por período</p>
        </div>

        {/* Filtros */}
        <div className="bg-white border-b border-gray-200 p-3 md:p-4">
          <div className="grid grid-cols-2 md:grid-cols-6 gap-3 items-end">
            <div className="col-span-2">
              <label className="block text-xs font-bold uppercase text-gray-600 mb-1">🏪 Empresa</label>
              <select value={companyId} onChange={e => setCompanyId(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500">
                <option value="">Todas</option>
                {empresas.map(e => (
                  <option key={e.id} value={e.id}>
                    {e.apelido ? `Loja ${e.cod_loja} - ${e.apelido}` : (e.label || e.nome_fantasia)}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold uppercase text-gray-600 mb-1">De</label>
              <input type="date" value={dataInicio} onChange={e => setDataInicio(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-xs font-bold uppercase text-gray-600 mb-1">Até</label>
              <input type="date" value={dataFim} onChange={e => setDataFim(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
            </div>
            <button onClick={carregar} disabled={loading}
              className={`px-4 py-2 rounded-lg text-sm font-bold text-white ${loading ? 'bg-gray-400' : 'bg-blue-500 hover:bg-blue-600'}`}>
              {loading ? 'Carregando...' : '🔍 Carregar'}
            </button>
            <div className="flex gap-2 flex-wrap">
              <button onClick={salvarTudo} disabled={saving || rows.length === 0}
                className={`flex-1 px-3 py-2 rounded-lg text-sm font-bold text-white ${saving || rows.length === 0 ? 'bg-gray-300' : 'bg-emerald-500 hover:bg-emerald-600'}`}>
                {saving ? 'Salvando...' : '💾 Gravar'}
              </button>
              <button onClick={() => exportar('pdf')} disabled={rows.length === 0}
                className="px-3 py-2 rounded-lg text-sm font-bold text-white bg-red-600 hover:bg-red-700 disabled:bg-gray-300">
                📄 PDF
              </button>
              <button onClick={() => exportar('excel')} disabled={rows.length === 0}
                className="px-3 py-2 rounded-lg text-sm font-bold text-white bg-green-700 hover:bg-green-800 disabled:bg-gray-300">
                📊 Excel
              </button>
              <button onClick={() => setShowNovaColuna(true)}
                className="px-3 py-2 rounded-lg text-sm font-bold text-white bg-purple-600 hover:bg-purple-700"
                title="Adicionar nova coluna de provento ou desconto">
                + Coluna
              </button>
            </div>
          </div>
        </div>

        {/* Tabela */}
        <div className="flex-1 overflow-auto p-3 md:p-4">
          {rows.length === 0 ? (
            <div className="text-center py-20 text-gray-400">
              <div className="text-5xl mb-2">📋</div>
              <p className="font-semibold">Informe o período e clique em <strong>Carregar</strong></p>
            </div>
          ) : (
            <div className="bg-white rounded-lg border border-gray-200 overflow-x-auto">
              <table className="min-w-full text-xs">
                <thead>
                  <tr className="bg-gray-600 text-white">
                    <th className="px-2 py-2 text-left sticky left-0 bg-gray-600 z-10 min-w-[180px]">Colaborador</th>
                    <th className="px-2 py-2 text-left">Cargo</th>
                    <th className="px-2 py-2 text-right">Salário</th>
                    {PROVENTOS.map(c => (
                      <th key={c.key} className="px-2 py-2 text-center bg-emerald-700 min-w-[80px]" title={c.label}>
                        {c.label}
                      </th>
                    ))}
                    {extrasProventos.map(c => (
                      <th key={c.chave} className="px-2 py-2 text-center bg-emerald-800 min-w-[80px] relative group" title={c.label}>
                        {c.label}
                        <button onClick={() => deletarColuna(c.id)} className="absolute top-0 right-0 text-[10px] px-1 opacity-0 group-hover:opacity-100 hover:text-red-200" title="Remover">✖</button>
                      </th>
                    ))}
                    {DESCONTOS.map(c => (
                      <th key={c.key} className="px-2 py-2 text-center bg-rose-700 min-w-[80px]" title={c.label}>
                        {c.label}
                      </th>
                    ))}
                    {extrasDescontos.map(c => (
                      <th key={c.chave} className="px-2 py-2 text-center bg-rose-800 min-w-[80px] relative group" title={c.label}>
                        {c.label}
                        <button onClick={() => deletarColuna(c.id)} className="absolute top-0 right-0 text-[10px] px-1 opacity-0 group-hover:opacity-100 hover:text-rose-200" title="Remover">✖</button>
                      </th>
                    ))}
                    <th className="px-2 py-2 text-right bg-blue-700">Líquido</th>
                    <th className="px-2 py-2 text-left min-w-[150px]">Obs</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {rows.map((r, idx) => {
                    const t = totais(r);
                    return (
                      <tr key={r.colaborador_id} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                        <td className="px-2 py-1 font-semibold sticky left-0 bg-inherit z-10">
                          <div>{r.nome}</div>
                          <div className="text-[10px] text-gray-400">Mat. {r.matricula || '-'}</div>
                        </td>
                        <td className="px-2 py-1 text-gray-600">{r.cargo_nome || '-'}</td>
                        <td className="px-2 py-1 text-right font-semibold text-gray-700">{fmtMoney(r.salario)}</td>
                        {PROVENTOS.map(c => (
                          <td key={c.key} className="px-1 py-1 bg-emerald-50/30">
                            <input type="text" inputMode="decimal" value={r[c.key] || ''}
                              onChange={e => updateCell(r.colaborador_id, c.key, e.target.value)}
                              className="w-full px-1 py-1 text-right border border-transparent hover:border-gray-300 focus:border-orange-400 rounded bg-transparent focus:bg-white focus:outline-none"
                              placeholder="0" />
                          </td>
                        ))}
                        {extrasProventos.map(c => (
                          <td key={c.chave} className="px-1 py-1 bg-emerald-100/30">
                            <input type="text" inputMode="decimal" value={r.campos_extras?.[c.chave] || ''}
                              onChange={e => updateExtra(r.colaborador_id, c.chave, e.target.value)}
                              className="w-full px-1 py-1 text-right border border-transparent hover:border-gray-300 focus:border-orange-400 rounded bg-transparent focus:bg-white focus:outline-none"
                              placeholder="0" />
                          </td>
                        ))}
                        {DESCONTOS.map(c => (
                          <td key={c.key} className="px-1 py-1 bg-rose-50/30">
                            <input type="text" inputMode="decimal" value={r[c.key] || ''}
                              onChange={e => updateCell(r.colaborador_id, c.key, e.target.value)}
                              className="w-full px-1 py-1 text-right border border-transparent hover:border-gray-300 focus:border-orange-400 rounded bg-transparent focus:bg-white focus:outline-none"
                              placeholder="0" />
                          </td>
                        ))}
                        {extrasDescontos.map(c => (
                          <td key={c.chave} className="px-1 py-1 bg-rose-100/30">
                            <input type="text" inputMode="decimal" value={r.campos_extras?.[c.chave] || ''}
                              onChange={e => updateExtra(r.colaborador_id, c.chave, e.target.value)}
                              className="w-full px-1 py-1 text-right border border-transparent hover:border-gray-300 focus:border-orange-400 rounded bg-transparent focus:bg-white focus:outline-none"
                              placeholder="0" />
                          </td>
                        ))}
                        <td className="px-2 py-1 text-right font-bold text-blue-700 bg-blue-50/30 whitespace-nowrap">
                          {fmtMoney(t.liq)}
                        </td>
                        <td className="px-1 py-1">
                          <input type="text" value={r.observacao || ''}
                            onChange={e => updateCell(r.colaborador_id, 'observacao', e.target.value)}
                            className="w-full px-2 py-1 border border-transparent hover:border-gray-300 focus:border-orange-400 rounded bg-transparent focus:bg-white focus:outline-none text-xs" />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="bg-gray-100 font-bold text-xs">
                    <td colSpan={3} className="px-2 py-2 text-right">TOTAIS:</td>
                    {PROVENTOS.map(c => (
                      <td key={c.key} className="px-2 py-2 text-right bg-emerald-50">
                        {rows.reduce((s, r) => s + (Number(r[c.key]) || 0), 0).toFixed(2)}
                      </td>
                    ))}
                    {extrasProventos.map(c => (
                      <td key={c.chave} className="px-2 py-2 text-right bg-emerald-100">
                        {rows.reduce((s, r) => s + (Number(r.campos_extras?.[c.chave]) || 0), 0).toFixed(2)}
                      </td>
                    ))}
                    {DESCONTOS.map(c => (
                      <td key={c.key} className="px-2 py-2 text-right bg-rose-50">
                        {rows.reduce((s, r) => s + (Number(r[c.key]) || 0), 0).toFixed(2)}
                      </td>
                    ))}
                    {extrasDescontos.map(c => (
                      <td key={c.chave} className="px-2 py-2 text-right bg-rose-100">
                        {rows.reduce((s, r) => s + (Number(r.campos_extras?.[c.chave]) || 0), 0).toFixed(2)}
                      </td>
                    ))}
                    <td className="px-2 py-2 text-right bg-blue-100">
                      {fmtMoney(rows.reduce((s, r) => s + totais(r).liq, 0))}
                    </td>
                    <td></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Modal Nova Coluna */}
      {showNovaColuna && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md">
            <div className="p-4 border-b border-gray-200">
              <h3 className="text-lg font-bold text-gray-800">+ Nova Coluna</h3>
              <p className="text-xs text-gray-500">Cria uma coluna extra de provento ou desconto</p>
            </div>
            <div className="p-4 space-y-3">
              <div>
                <label className="block text-xs font-bold uppercase text-gray-600 mb-1">Nome da Coluna</label>
                <input type="text" value={novaLabel}
                  onChange={e => setNovaLabel(e.target.value.toUpperCase())}
                  style={{ textTransform: 'uppercase' }}
                  placeholder="Ex: GRATIFICAÇÃO, CESTA BÁSICA..."
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="block text-xs font-bold uppercase text-gray-600 mb-1">Tipo</label>
                <div className="grid grid-cols-2 gap-2">
                  <label className={`flex items-center gap-2 p-3 rounded-lg border-2 cursor-pointer ${novoTipo === 'provento' ? 'border-emerald-500 bg-emerald-50' : 'border-gray-200'}`}>
                    <input type="radio" value="provento" checked={novoTipo === 'provento'}
                      onChange={e => setNovoTipo(e.target.value)} className="accent-emerald-500" />
                    <span className="font-bold text-emerald-700">💰 Provento</span>
                  </label>
                  <label className={`flex items-center gap-2 p-3 rounded-lg border-2 cursor-pointer ${novoTipo === 'desconto' ? 'border-rose-500 bg-rose-50' : 'border-gray-200'}`}>
                    <input type="radio" value="desconto" checked={novoTipo === 'desconto'}
                      onChange={e => setNovoTipo(e.target.value)} className="accent-rose-500" />
                    <span className="font-bold text-rose-700">📉 Desconto</span>
                  </label>
                </div>
              </div>
            </div>
            <div className="p-4 border-t border-gray-200 flex justify-end gap-2">
              <button onClick={() => { setShowNovaColuna(false); setNovaLabel(''); }}
                className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-sm font-semibold">
                Cancelar
              </button>
              <button onClick={criarColuna} disabled={!novaLabel.trim()}
                className="px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg text-sm font-semibold disabled:bg-gray-300">
                Criar Coluna
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
