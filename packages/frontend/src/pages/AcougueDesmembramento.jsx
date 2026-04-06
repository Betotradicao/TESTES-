import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import Sidebar from '../components/Sidebar';
import { api } from '../utils/api';
import toast from 'react-hot-toast';
import RadarLoading from '../components/RadarLoading';

const fmt = (v) => {
  if (v == null || isNaN(v)) return 'R$ 0,00';
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
};
const fmtKg = (v) => (v != null ? parseFloat(v).toFixed(3) : '0.000');
const fmtPct = (v) => (v != null ? parseFloat(v).toFixed(2) + '%' : '0.00%');

const ALL_COLUMNS = [
  { id: 'corte', label: 'Corte', fixed: true },
  { id: 'pct_rend', label: '% Rend' },
  { id: 'peso_kg', label: 'Peso (KG)' },
  { id: 'custo_kg', label: 'Custo/KG' },
  { id: 'custo_total', label: 'Custo Total' },
  { id: 'preco_venda', label: 'Preco Venda/KG' },
  { id: 'receita', label: 'Receita' },
  { id: 'lucro', label: 'Lucro' },
  { id: 'margem', label: 'Margem %' },
  { id: 'preco_conc', label: 'Preco Concorrente' },
  { id: 'meta_margem', label: 'Meta Margem %' },
];

export default function AcougueDesmembramento() {
  const { user, logout } = useAuth();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [templates, setTemplates] = useState([]);
  const [loadingTemplates, setLoadingTemplates] = useState(false);

  // Input
  const [templateId, setTemplateId] = useState('');
  const [pesoTotal, setPesoTotal] = useState('');
  const [custoKg, setCustoKg] = useState('');
  const [calculating, setCalculating] = useState(false);

  // Result
  const [resultado, setResultado] = useState(null);

  // Colunas visiveis (drag & drop + visibilidade)
  const [columns, setColumns] = useState(() => {
    const saved = localStorage.getItem('acougue_desm_columns');
    if (saved) { try { return JSON.parse(saved); } catch {} }
    return ALL_COLUMNS.map(c => c.id);
  });
  const [hiddenCols, setHiddenCols] = useState(() => {
    const saved = localStorage.getItem('acougue_desm_hidden');
    if (saved) { try { return JSON.parse(saved); } catch {} }
    return [];
  });
  const [showColMenu, setShowColMenu] = useState(false);
  const [dragCol, setDragCol] = useState(null);

  const visibleCols = columns.filter(c => !hiddenCols.includes(c));
  const toggleCol = (colId) => {
    const next = hiddenCols.includes(colId) ? hiddenCols.filter(c => c !== colId) : [...hiddenCols, colId];
    setHiddenCols(next);
    localStorage.setItem('acougue_desm_hidden', JSON.stringify(next));
  };
  const handleDragStart = (colId) => setDragCol(colId);
  const handleDragOver = (e, colId) => { e.preventDefault(); if (dragCol && dragCol !== colId) {
    const newCols = [...columns]; const from = newCols.indexOf(dragCol); const to = newCols.indexOf(colId);
    newCols.splice(from, 1); newCols.splice(to, 0, dragCol); setColumns(newCols);
    localStorage.setItem('acougue_desm_columns', JSON.stringify(newCols));
  }};
  const handleDragEnd = () => setDragCol(null);
  const getColDef = (id) => ALL_COLUMNS.find(c => c.id === id);
  const [saving, setSaving] = useState(false);
  const printRef = useRef();

  useEffect(() => {
    fetchTemplates();
  }, []);

  const fetchTemplates = async () => {
    setLoadingTemplates(true);
    try {
      const res = await api.get('/acougue/templates');
      setTemplates(res.data);
    } catch {
      toast.error('Erro ao carregar templates');
    } finally {
      setLoadingTemplates(false);
    }
  };

  const handleCalcular = async () => {
    if (!templateId) return toast.error('Selecione um template');
    if (!pesoTotal || parseFloat(pesoTotal) <= 0) return toast.error('Informe o peso total');
    if (!custoKg || parseFloat(custoKg) <= 0) return toast.error('Informe o custo por KG');

    setCalculating(true);
    try {
      const res = await api.post('/acougue/desmembramento/calcular', {
        template_id: parseInt(templateId),
        peso_total: parseFloat(pesoTotal),
        custo_kg: parseFloat(custoKg),
      });
      setResultado(res.data);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Erro ao calcular');
    } finally {
      setCalculating(false);
    }
  };

  const handleSalvar = async () => {
    if (!resultado) return;
    setSaving(true);
    try {
      await api.post('/acougue/desmembramento/salvar', {
        template_id: parseInt(templateId),
        template_nome: resultado.template_nome,
        peso_total: resultado.peso_total,
        custo_kg: resultado.custo_kg,
        custo_total: resultado.custo_total,
        receita_total: resultado.receita_total,
        lucro_total: resultado.lucro_total,
        margem_pct: resultado.margem_pct,
        itens: resultado.itens,
      });
      toast.success('Desmembramento salvo com sucesso!');
    } catch {
      toast.error('Erro ao salvar');
    } finally {
      setSaving(false);
    }
  };

  const handlePrint = () => {
    const content = printRef.current;
    if (!content) return;
    const printWindow = window.open('', '_blank');
    printWindow.document.write(`
      <html><head><title>Desmembramento - ${resultado?.template_nome || ''}</title>
      <style>
        body { font-family: Arial, sans-serif; padding: 20px; color: #333; }
        h1 { font-size: 18px; margin-bottom: 4px; }
        h2 { font-size: 14px; color: #666; margin-bottom: 16px; }
        table { width: 100%; border-collapse: collapse; font-size: 12px; }
        th, td { border: 1px solid #ddd; padding: 6px 8px; text-align: right; }
        th { background: #f5f5f5; font-weight: bold; }
        td:first-child, th:first-child { text-align: left; }
        .summary { display: flex; gap: 16px; margin-bottom: 16px; }
        .summary div { flex: 1; padding: 8px; border: 1px solid #ddd; border-radius: 4px; text-align: center; }
        .summary .label { font-size: 11px; color: #666; }
        .summary .value { font-size: 16px; font-weight: bold; }
        .gray { color: #999; text-decoration: line-through; }
        .totals { font-weight: bold; background: #fff8f0; }
        @media print { body { padding: 0; } }
      </style></head><body>
      ${content.innerHTML}
      </body></html>
    `);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => { printWindow.print(); printWindow.close(); }, 300);
  };

  // Totals from resultado
  const totals = resultado ? {
    peso: resultado.itens.reduce((s, i) => s + (i.peso_kg || 0), 0),
    custoTotal: resultado.custo_total,
    receita: resultado.receita_total,
    lucro: resultado.lucro_total,
  } : null;

  return (
    <div className="flex h-screen bg-gray-100">
      <Sidebar user={user} onLogout={logout} isMobileMenuOpen={isMobileMenuOpen} setIsMobileMenuOpen={setIsMobileMenuOpen} />
      <div className="flex-1 overflow-auto">
        {/* Header */}
        <div className="bg-gradient-to-r from-orange-600 to-orange-500 p-6 shadow-lg">
          <div className="flex items-center gap-3">
            <button className="lg:hidden text-white mr-2" onClick={() => setIsMobileMenuOpen(true)}>
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" /></svg>
            </button>
            <span className="text-3xl">🔪</span>
            <div>
              <h1 className="text-2xl font-bold text-white">Desmembramento - Acougue</h1>
              <p className="text-orange-100 text-sm">Calcule custos e receitas do desmembramento de carcacas</p>
            </div>
          </div>
        </div>

        <div className="p-6 space-y-6">
          {/* Input Card */}
          <div className="bg-white rounded-xl p-6 border border-gray-200 shadow-sm">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Dados do Desmembramento</h2>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
              <div>
                <label className="block text-sm text-gray-400 mb-1">Template de Rendimento *</label>
                {loadingTemplates ? (
                  <div className="py-2"><RadarLoading size="sm" message="" /></div>
                ) : (
                  <select
                    value={templateId}
                    onChange={(e) => { setTemplateId(e.target.value); setResultado(null); }}
                    className="w-full bg-white border border-gray-300 rounded-lg px-3 py-2 text-gray-900 focus:border-orange-500 focus:ring-orange-500 focus:outline-none"
                  >
                    <option value="">Selecione...</option>
                    {templates.map((t) => (
                      <option key={t.id} value={t.id}>{t.nome} ({t.total_cortes} cortes)</option>
                    ))}
                  </select>
                )}
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">Peso Total (KG) *</label>
                <input
                  type="number"
                  step="0.001"
                  min="0"
                  value={pesoTotal}
                  onChange={(e) => setPesoTotal(e.target.value)}
                  placeholder="Ex: 250.000"
                  className="w-full bg-white border border-gray-300 rounded-lg px-3 py-2 text-gray-900 focus:border-orange-500 focus:ring-orange-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">Custo por KG (R$) *</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={custoKg}
                  onChange={(e) => setCustoKg(e.target.value)}
                  placeholder="Ex: 22.50"
                  className="w-full bg-white border border-gray-300 rounded-lg px-3 py-2 text-gray-900 focus:border-orange-500 focus:ring-orange-500 focus:outline-none"
                />
              </div>
              <div>
                <button
                  onClick={handleCalcular}
                  disabled={calculating}
                  className="w-full bg-orange-600 text-white font-semibold px-4 py-2 rounded-lg hover:bg-orange-500 disabled:opacity-50 transition"
                >
                  {calculating ? 'Calculando...' : 'Calcular Desmembramento'}
                </button>
              </div>
            </div>
          </div>

          {/* Results */}
          {resultado && (
            <div ref={printRef}>
              {/* Summary cards */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                <div className="bg-white rounded-xl p-4 border border-gray-200 shadow-sm text-center">
                  <p className="text-gray-500 text-sm">Custo Total</p>
                  <p className="text-xl font-bold text-red-400">{fmt(resultado.custo_total)}</p>
                  <p className="text-xs text-gray-500">{fmtKg(resultado.peso_total)} KG x {fmt(resultado.custo_kg)}/KG</p>
                </div>
                <div className="bg-white rounded-xl p-4 border border-gray-200 shadow-sm text-center">
                  <p className="text-gray-500 text-sm">Receita Total</p>
                  <p className="text-xl font-bold text-blue-400">{fmt(resultado.receita_total)}</p>
                </div>
                <div className="bg-white rounded-xl p-4 border border-gray-200 shadow-sm text-center">
                  <p className="text-gray-500 text-sm">Lucro Bruto</p>
                  <p className={`text-xl font-bold ${resultado.lucro_total >= 0 ? 'text-green-400' : 'text-red-400'}`}>{fmt(resultado.lucro_total)}</p>
                </div>
                <div className="bg-white rounded-xl p-4 border border-gray-200 shadow-sm text-center">
                  <p className="text-gray-500 text-sm">Margem %</p>
                  <p className={`text-xl font-bold ${resultado.margem_pct >= 0 ? 'text-green-400' : 'text-red-400'}`}>{fmtPct(resultado.margem_pct)}</p>
                </div>
              </div>

              {/* Results table */}
              <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                <div className="flex items-center justify-between p-4 border-b border-gray-200">
                  <h3 className="text-lg font-semibold text-gray-900">
                    Detalhamento - {resultado.template_nome}
                  </h3>
                  <div className="flex gap-2 items-center">
                    {/* Engrenagem de colunas */}
                    <div className="relative">
                      <button onClick={() => setShowColMenu(!showColMenu)} className="text-gray-400 hover:text-gray-600 p-1" title="Colunas">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                      </button>
                      {showColMenu && (
                        <div className="absolute right-0 top-8 bg-white border border-gray-200 rounded-lg shadow-lg z-50 p-2 w-52">
                          {ALL_COLUMNS.filter(c => !c.fixed).map(col => (
                            <label key={col.id} className="flex items-center gap-2 px-2 py-1 hover:bg-gray-50 rounded cursor-pointer text-sm">
                              <input type="checkbox" checked={!hiddenCols.includes(col.id)} onChange={() => toggleCol(col.id)} className="accent-orange-500" />
                              {col.label}
                            </label>
                          ))}
                        </div>
                      )}
                    </div>
                    <button onClick={handleSalvar} disabled={saving} className="bg-orange-600 text-white text-sm font-semibold px-4 py-2 rounded-lg hover:bg-orange-500 disabled:opacity-50 transition">
                      {saving ? 'Salvando...' : 'Salvar Resultado'}
                    </button>
                    <button onClick={handlePrint} className="bg-gray-200 text-gray-700 text-sm font-semibold px-4 py-2 rounded-lg hover:bg-gray-300 transition">
                      Imprimir
                    </button>
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-gray-600 text-white">
                        {visibleCols.map(colId => {
                          const col = getColDef(colId);
                          return (
                            <th key={colId} className={`px-3 py-3 whitespace-nowrap ${colId === 'corte' ? 'text-left' : 'text-right'} ${!col?.fixed ? 'cursor-grab' : ''}`}
                              draggable={!col?.fixed} onDragStart={() => handleDragStart(colId)} onDragOver={(e) => handleDragOver(e, colId)} onDragEnd={handleDragEnd}>
                              <span className={`flex items-center gap-1 ${colId === 'corte' ? '' : 'justify-end'}`}>
                                {!col?.fixed && <span className="text-gray-400 text-xs">⠿</span>}
                                {col?.label}
                              </span>
                            </th>
                          );
                        })}
                      </tr>
                    </thead>
                    <tbody>
                      {resultado.itens.map((item, idx) => {
                        const ns = !item.vende;
                        const cellVal = (colId) => {
                          switch(colId) {
                            case 'corte': return <><span className={ns ? 'line-through text-gray-400' : 'text-gray-900 font-medium'}>{item.nome_corte}</span>{item.codigo_produto && <span className="text-gray-400 text-xs ml-1">({item.codigo_produto})</span>}</>;
                            case 'pct_rend': return <span className={ns ? 'line-through text-gray-400' : ''}>{fmtPct(item.percentual)}</span>;
                            case 'peso_kg': return <span className={ns ? 'line-through text-gray-400' : ''}>{fmtKg(item.peso_kg)}</span>;
                            case 'custo_kg': return ns ? '-' : fmt(item.custo_kg);
                            case 'custo_total': return ns ? '-' : fmt(item.custo_total);
                            case 'preco_venda': return ns ? '-' : fmt(item.preco_venda_kg);
                            case 'receita': return ns ? '-' : fmt(item.receita);
                            case 'lucro': return ns ? '-' : <span className={item.lucro >= 0 ? 'text-green-600' : 'text-red-600'}>{fmt(item.lucro)}</span>;
                            case 'margem': return ns ? '-' : <span className={item.margem_pct >= 0 ? 'text-green-600' : 'text-red-600'}>{fmtPct(item.margem_pct)}</span>;
                            case 'preco_conc': return ns ? '-' : (item.preco_concorrente > 0 ? fmt(item.preco_concorrente) : <span className="text-gray-300">-</span>);
                            case 'meta_margem': return ns ? '-' : (item.meta_margem > 0 ? fmtPct(item.meta_margem) : <span className="text-gray-300">-</span>);
                            default: return '-';
                          }
                        };
                        return (
                          <tr key={idx} className={`border-b border-gray-100 ${ns ? 'opacity-50' : 'hover:bg-gray-50'}`}>
                            {visibleCols.map(colId => (
                              <td key={colId} className={`px-3 py-2 ${colId === 'corte' ? 'text-left' : 'text-right'} ${ns ? 'text-gray-400' : ''}`}>{cellVal(colId)}</td>
                            ))}
                          </tr>
                        );
                      })}
                      {/* Totals row */}
                      <tr className="bg-orange-50 font-bold text-orange-700">
                        {visibleCols.map(colId => {
                          const totVal = () => {
                            switch(colId) {
                              case 'corte': return 'TOTAIS';
                              case 'pct_rend': return fmtPct(resultado.itens.reduce((s, i) => s + (i.percentual || 0), 0));
                              case 'peso_kg': return fmtKg(resultado.itens.reduce((s, i) => s + (i.peso_kg || 0), 0));
                              case 'custo_kg': return <span className="text-red-600">{fmt(resultado.custo_kg)}</span>;
                              case 'custo_total': return <span className="text-red-600">{fmt(resultado.custo_total)}</span>;
                              case 'preco_venda': return '-';
                              case 'receita': return fmt(resultado.receita_total);
                              case 'lucro': return <span className={resultado.lucro_total >= 0 ? 'text-green-600' : 'text-red-600'}>{fmt(resultado.lucro_total)}</span>;
                              case 'margem': return <span className={resultado.margem_pct >= 0 ? 'text-green-600' : 'text-red-600'}>{fmtPct(resultado.margem_pct)}</span>;
                              default: return '-';
                            }
                          };
                          return <td key={colId} className={`px-3 py-3 ${colId === 'corte' ? 'text-left' : 'text-right'}`}>{totVal()}</td>;
                        })}
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
