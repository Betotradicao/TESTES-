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
    <div className="flex h-screen bg-gray-900 text-white">
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
          <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
            <h2 className="text-lg font-semibold text-white mb-4">Dados do Desmembramento</h2>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
              <div>
                <label className="block text-sm text-gray-400 mb-1">Template de Rendimento *</label>
                {loadingTemplates ? (
                  <div className="py-2"><RadarLoading size="sm" message="" /></div>
                ) : (
                  <select
                    value={templateId}
                    onChange={(e) => { setTemplateId(e.target.value); setResultado(null); }}
                    className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white focus:border-orange-500 focus:outline-none"
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
                  className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white focus:border-orange-500 focus:outline-none"
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
                  className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white focus:border-orange-500 focus:outline-none"
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
                <div className="bg-gray-800 rounded-xl p-4 border border-gray-700 text-center">
                  <p className="text-gray-400 text-sm">Custo Total</p>
                  <p className="text-xl font-bold text-red-400">{fmt(resultado.custo_total)}</p>
                  <p className="text-xs text-gray-500">{fmtKg(resultado.peso_total)} KG x {fmt(resultado.custo_kg)}/KG</p>
                </div>
                <div className="bg-gray-800 rounded-xl p-4 border border-gray-700 text-center">
                  <p className="text-gray-400 text-sm">Receita Total</p>
                  <p className="text-xl font-bold text-blue-400">{fmt(resultado.receita_total)}</p>
                </div>
                <div className="bg-gray-800 rounded-xl p-4 border border-gray-700 text-center">
                  <p className="text-gray-400 text-sm">Lucro Bruto</p>
                  <p className={`text-xl font-bold ${resultado.lucro_total >= 0 ? 'text-green-400' : 'text-red-400'}`}>{fmt(resultado.lucro_total)}</p>
                </div>
                <div className="bg-gray-800 rounded-xl p-4 border border-gray-700 text-center">
                  <p className="text-gray-400 text-sm">Margem %</p>
                  <p className={`text-xl font-bold ${resultado.margem_pct >= 0 ? 'text-green-400' : 'text-red-400'}`}>{fmtPct(resultado.margem_pct)}</p>
                </div>
              </div>

              {/* Results table */}
              <div className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden">
                <div className="flex items-center justify-between p-4 border-b border-gray-700">
                  <h3 className="text-lg font-semibold text-white">
                    Detalhamento - {resultado.template_nome}
                  </h3>
                  <div className="flex gap-2">
                    <button
                      onClick={handleSalvar}
                      disabled={saving}
                      className="bg-orange-600 text-white text-sm font-semibold px-4 py-2 rounded-lg hover:bg-orange-500 disabled:opacity-50 transition"
                    >
                      {saving ? 'Salvando...' : 'Salvar Resultado'}
                    </button>
                    <button
                      onClick={handlePrint}
                      className="bg-gray-700 text-gray-200 text-sm font-semibold px-4 py-2 rounded-lg hover:bg-gray-600 transition"
                    >
                      Imprimir
                    </button>
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-gray-600 text-gray-200">
                        <th className="px-4 py-3 text-left">Corte</th>
                        <th className="px-3 py-3 text-right">% Rend</th>
                        <th className="px-3 py-3 text-right">Peso (KG)</th>
                        <th className="px-3 py-3 text-right">Custo/KG</th>
                        <th className="px-3 py-3 text-right">Custo Total</th>
                        <th className="px-3 py-3 text-right">Preco Venda/KG</th>
                        <th className="px-3 py-3 text-right">Receita</th>
                        <th className="px-3 py-3 text-right">Lucro</th>
                        <th className="px-3 py-3 text-right">Margem %</th>
                      </tr>
                    </thead>
                    <tbody>
                      {resultado.itens.map((item, idx) => {
                        const isNonSale = !item.vende;
                        return (
                          <tr
                            key={idx}
                            className={`border-b border-gray-700 ${isNonSale ? 'opacity-50' : 'hover:bg-gray-750'}`}
                          >
                            <td className={`px-4 py-2 font-medium ${isNonSale ? 'line-through text-gray-500' : 'text-white'}`}>
                              {item.nome_corte}
                              {item.codigo_produto && <span className="text-gray-500 text-xs ml-1">({item.codigo_produto})</span>}
                            </td>
                            <td className={`px-3 py-2 text-right ${isNonSale ? 'line-through text-gray-500' : ''}`}>{fmtPct(item.percentual)}</td>
                            <td className={`px-3 py-2 text-right ${isNonSale ? 'line-through text-gray-500' : ''}`}>{fmtKg(item.peso_kg)}</td>
                            <td className={`px-3 py-2 text-right ${isNonSale ? 'text-gray-500' : ''}`}>{isNonSale ? '-' : fmt(item.custo_kg)}</td>
                            <td className={`px-3 py-2 text-right ${isNonSale ? 'text-gray-500' : ''}`}>{isNonSale ? '-' : fmt(item.custo_total)}</td>
                            <td className={`px-3 py-2 text-right ${isNonSale ? 'text-gray-500' : ''}`}>{isNonSale ? '-' : fmt(item.preco_venda_kg)}</td>
                            <td className={`px-3 py-2 text-right ${isNonSale ? 'text-gray-500' : ''}`}>{isNonSale ? '-' : fmt(item.receita)}</td>
                            <td className={`px-3 py-2 text-right ${isNonSale ? 'text-gray-500' : item.lucro >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                              {isNonSale ? '-' : fmt(item.lucro)}
                            </td>
                            <td className={`px-3 py-2 text-right ${isNonSale ? 'text-gray-500' : item.margem_pct >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                              {isNonSale ? '-' : fmtPct(item.margem_pct)}
                            </td>
                          </tr>
                        );
                      })}
                      {/* Totals row */}
                      <tr className="bg-gray-700/50 font-bold text-orange-400">
                        <td className="px-4 py-3">TOTAIS</td>
                        <td className="px-3 py-3 text-right">
                          {fmtPct(resultado.itens.reduce((s, i) => s + (i.percentual || 0), 0))}
                        </td>
                        <td className="px-3 py-3 text-right">{fmtKg(totals.peso)}</td>
                        <td className="px-3 py-3 text-right">{fmt(resultado.custo_kg)}</td>
                        <td className="px-3 py-3 text-right">{fmt(totals.custoTotal)}</td>
                        <td className="px-3 py-3 text-right">-</td>
                        <td className="px-3 py-3 text-right">{fmt(totals.receita)}</td>
                        <td className={`px-3 py-3 text-right ${totals.lucro >= 0 ? 'text-green-400' : 'text-red-400'}`}>{fmt(totals.lucro)}</td>
                        <td className={`px-3 py-3 text-right ${resultado.margem_pct >= 0 ? 'text-green-400' : 'text-red-400'}`}>{fmtPct(resultado.margem_pct)}</td>
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
