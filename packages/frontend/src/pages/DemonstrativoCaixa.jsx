import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useLoja } from '../contexts/LojaContext';
import Sidebar from '../components/Sidebar';
import RadarLoading from '../components/RadarLoading';
import api from '../utils/api';
import toast from 'react-hot-toast';

const TABS = [
  { id: '', label: 'Geral' },
  { id: '2', label: 'Fixas' },
  { id: '1', label: 'Variáveis' },
  { id: '4', label: 'Transferências' },
  { id: '3', label: 'Impostos' },
];

const INITIAL_COLUMNS = [
  { id: 'META', header: 'Meta', minW: 90 },
  { id: 'PCT_REC_META', header: '% Rec', minW: 55 },
  { id: 'PCT_DESP_META', header: '% Desp', minW: 55 },
  { id: 'VAL_ABERTO', header: 'Val. Aberto', minW: 90 },
  { id: 'VAL_QUITADO', header: 'Val. Quitado', minW: 90 },
  { id: 'PCT_REC_QUIT', header: '% Rec', minW: 55 },
  { id: 'PCT_DESP_QUIT', header: '% Desp', minW: 55 },
  { id: 'VAL_REALIZADO', header: 'Val. Realizado', minW: 90 },
  { id: 'PCT_REC_REAL', header: '% Rec', minW: 55 },
  { id: 'PCT_DESP_REAL', header: '% Desp', minW: 55 },
  { id: 'VAL_DIFERENCA', header: 'Val. Diferença', minW: 90 },
];

const STORAGE_KEY = 'demonstrativo_caixa_columns_order';

function formatCurrency(val) {
  if (val == null || isNaN(val)) return '-';
  const abs = Math.abs(val);
  const formatted = abs.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  if (val < 0) return `(${formatted})`;
  return formatted;
}

function formatPercent(val) {
  if (val == null || isNaN(val) || val === 0) return '';
  return val.toFixed(2).replace('.', ',') + '%';
}

function formatDate(dateStr) {
  if (!dateStr) return '-';
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString('pt-BR');
  } catch { return dateStr; }
}

// Render cell value based on column id for a category row
function getCatCellValue(colId, cat, totais) {
  const metaPctRec = totais.totalMetaReceitas ? (cat.META / totais.totalMetaReceitas * 100) : 0;
  const metaPctDesp = totais.totalMetaDespesas ? (cat.META / totais.totalMetaDespesas * 100) : 0;
  const realPctRec = totais.totalReceitas ? (cat.VAL_REALIZADO / totais.totalReceitas * 100) : 0;
  const realPctDesp = totais.totalDespesas ? (cat.VAL_REALIZADO / totais.totalDespesas * 100) : 0;

  switch (colId) {
    case 'META': return formatCurrency(cat.META);
    case 'PCT_REC_META': return cat.IS_RECEITA ? formatPercent(metaPctRec) : '';
    case 'PCT_DESP_META': return cat.IS_DESPESA ? formatPercent(metaPctDesp) : '';
    case 'VAL_ABERTO': return formatCurrency(cat.VAL_ABERTO);
    case 'VAL_QUITADO': return formatCurrency(cat.VAL_QUITADO);
    case 'PCT_REC_QUIT': return cat.IS_RECEITA ? formatPercent(realPctRec) : '';
    case 'PCT_DESP_QUIT': return cat.IS_DESPESA ? formatPercent(realPctDesp) : '';
    case 'VAL_REALIZADO': return formatCurrency(cat.VAL_REALIZADO);
    case 'PCT_REC_REAL': return cat.IS_RECEITA ? formatPercent(realPctRec) : '';
    case 'PCT_DESP_REAL': return cat.IS_DESPESA ? formatPercent(realPctDesp) : '';
    case 'VAL_DIFERENCA': return formatCurrency(cat.VAL_DIFERENCA);
    default: return '';
  }
}

function getSubCellValue(colId, sub, cat, totais) {
  const subMetaPctRec = totais.totalMetaReceitas ? (sub.META / totais.totalMetaReceitas * 100) : 0;
  const subMetaPctDesp = totais.totalMetaDespesas ? (sub.META / totais.totalMetaDespesas * 100) : 0;
  const subRealPctRec = totais.totalReceitas ? (sub.VAL_REALIZADO / totais.totalReceitas * 100) : 0;
  const subRealPctDesp = totais.totalDespesas ? (sub.VAL_REALIZADO / totais.totalDespesas * 100) : 0;

  switch (colId) {
    case 'META': return formatCurrency(sub.META);
    case 'PCT_REC_META': return cat.IS_RECEITA ? formatPercent(subMetaPctRec) : '';
    case 'PCT_DESP_META': return cat.IS_DESPESA ? formatPercent(subMetaPctDesp) : '';
    case 'VAL_ABERTO': return formatCurrency(sub.VAL_ABERTO);
    case 'VAL_QUITADO': return formatCurrency(sub.VAL_QUITADO);
    case 'PCT_REC_QUIT': return cat.IS_RECEITA ? formatPercent(subRealPctRec) : '';
    case 'PCT_DESP_QUIT': return cat.IS_DESPESA ? formatPercent(subRealPctDesp) : '';
    case 'VAL_REALIZADO': return formatCurrency(sub.VAL_REALIZADO);
    case 'PCT_REC_REAL': return cat.IS_RECEITA ? formatPercent(subRealPctRec) : '';
    case 'PCT_DESP_REAL': return cat.IS_DESPESA ? formatPercent(subRealPctDesp) : '';
    case 'VAL_DIFERENCA': return formatCurrency(sub.VAL_DIFERENCA);
    default: return '';
  }
}

function getTotalCellValue(colId, totais, type) {
  // type: 'receitas' | 'despesas' | 'saldo'
  if (type === 'receitas') {
    switch (colId) {
      case 'META': return formatCurrency(totais.totalMetaReceitas);
      case 'PCT_REC_META': return '100,00%';
      case 'PCT_DESP_META': return '';
      case 'VAL_ABERTO': return formatCurrency(totais.totalAbertoReceitas);
      case 'VAL_QUITADO': return formatCurrency(totais.totalQuitadoReceitas);
      case 'PCT_REC_QUIT': return '100,00%';
      case 'PCT_DESP_QUIT': return '';
      case 'VAL_REALIZADO': return formatCurrency(totais.totalReceitas);
      case 'PCT_REC_REAL': return '100,00%';
      case 'PCT_DESP_REAL': return '';
      case 'VAL_DIFERENCA': return formatCurrency((totais.totalMetaReceitas || 0) - (totais.totalReceitas || 0));
      default: return '';
    }
  }
  if (type === 'despesas') {
    switch (colId) {
      case 'META': return formatCurrency(totais.totalMetaDespesas);
      case 'PCT_REC_META': return '';
      case 'PCT_DESP_META': return '100,00%';
      case 'VAL_ABERTO': return formatCurrency(totais.totalAbertoDespesas);
      case 'VAL_QUITADO': return formatCurrency(totais.totalQuitadoDespesas);
      case 'PCT_REC_QUIT': return '';
      case 'PCT_DESP_QUIT': return '100,00%';
      case 'VAL_REALIZADO': return formatCurrency(totais.totalDespesas);
      case 'PCT_REC_REAL': return '';
      case 'PCT_DESP_REAL': return '100,00%';
      case 'VAL_DIFERENCA': return formatCurrency((totais.totalMetaDespesas || 0) - (totais.totalDespesas || 0));
      default: return '';
    }
  }
  // saldo
  switch (colId) {
    case 'META': return formatCurrency((totais.totalMetaReceitas || 0) - (totais.totalMetaDespesas || 0));
    case 'VAL_ABERTO': return formatCurrency((totais.totalAbertoReceitas || 0) - (totais.totalAbertoDespesas || 0));
    case 'VAL_QUITADO': return formatCurrency((totais.totalQuitadoReceitas || 0) - (totais.totalQuitadoDespesas || 0));
    case 'VAL_REALIZADO': return formatCurrency(totais.saldo);
    default: return '';
  }
}

export default function DemonstrativoCaixa() {
  const { user, logout } = useAuth();
  const { lojaSelecionada } = useLoja();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState(null);
  const [expandedCats, setExpandedCats] = useState({});
  const [activeTab, setActiveTab] = useState('');
  const [regime, setRegime] = useState('caixa');

  // Datas livres
  const now = new Date();
  const mesStr = String(now.getMonth() + 1).padStart(2, '0');
  const anoStr = String(now.getFullYear());
  const ontem = new Date(now);
  ontem.setDate(ontem.getDate() - 1);
  const defaultInicio = `${anoStr}-${mesStr}-01`;
  const defaultFim = `${ontem.getFullYear()}-${String(ontem.getMonth() + 1).padStart(2, '0')}-${String(ontem.getDate()).padStart(2, '0')}`;

  const [dataInicio, setDataInicio] = useState(defaultInicio);
  const [dataFim, setDataFim] = useState(defaultFim);

  // Colunas com ordem persistida
  const [columns, setColumns] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        const validIds = new Set(INITIAL_COLUMNS.map(c => c.id));
        const filtered = parsed.filter(c => validIds.has(c.id));
        if (filtered.length === INITIAL_COLUMNS.length) return filtered;
      }
    } catch {}
    return INITIAL_COLUMNS;
  });

  // Drag state
  const dragColRef = useRef(null);
  const [dragOverCol, setDragOverCol] = useState(null);

  // Persistir ordem
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(columns));
  }, [columns]);

  // Painel de detalhamento de títulos
  const [detalhePainel, setDetalhePainel] = useState(null); // { codCategoria, codSubcategoria, desCategoria, desSubcategoria }
  const [detalheStatus, setDetalheStatus] = useState('todos'); // 'aberto', 'quitado', 'todos'
  const [detalheTitulos, setDetalheTitulos] = useState(null);
  const [detalheLoading, setDetalheLoading] = useState(false);
  const [expandedTitulo, setExpandedTitulo] = useState(null);
  const [itensNF, setItensNF] = useState([]);
  const [itensLoading, setItensLoading] = useState(false);

  // Buscar dados principais
  const fetchData = async () => {
    setLoading(true);
    try {
      const params = { dataInicio, dataFim, regime, tipoFluxo: activeTab };
      if (lojaSelecionada?.cod_loja) params.codLoja = lojaSelecionada.cod_loja;
      const res = await api.get('/demonstrativo-caixa/dados', { params });
      if (res.data?.success) {
        setData(res.data);
        const exp = {};
        for (const cat of (res.data.categorias || [])) exp[cat.COD_CATEGORIA] = true;
        setExpandedCats(exp);
      }
    } catch (err) {
      console.error('Erro ao buscar demonstrativo:', err);
      toast.error('Erro ao buscar dados do demonstrativo');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, [dataInicio, dataFim, regime, activeTab, lojaSelecionada]);

  // Buscar títulos do painel lateral
  const fetchTitulos = async () => {
    if (!detalhePainel) return;
    setDetalheLoading(true);
    try {
      const params = {
        codCategoria: detalhePainel.codCategoria,
        codSubcategoria: detalhePainel.codSubcategoria,
        dataInicio,
        dataFim,
        regime,
        status: detalheStatus,
      };
      if (lojaSelecionada?.cod_loja) params.codLoja = lojaSelecionada.cod_loja;
      const res = await api.get('/demonstrativo-caixa/titulos', { params });
      if (res.data?.success) {
        setDetalheTitulos(res.data);
      }
    } catch (err) {
      console.error('Erro ao buscar títulos:', err);
      toast.error('Erro ao buscar títulos');
    } finally {
      setDetalheLoading(false);
    }
  };

  useEffect(() => {
    if (detalhePainel) fetchTitulos();
  }, [detalhePainel, detalheStatus]);

  // Buscar itens NF ao expandir título
  const fetchItensNF = async (titulo) => {
    if (!titulo.NUM_NF) {
      setItensNF([]);
      return;
    }
    setItensLoading(true);
    try {
      const res = await api.get('/demonstrativo-caixa/titulos/itens-nf', {
        params: {
          numNf: titulo.NUM_NF,
          numSerieNf: titulo.NUM_SERIE_NF || '',
          codParceiro: titulo.COD_PARCEIRO,
        }
      });
      if (res.data?.success) {
        setItensNF(res.data.itens || []);
      }
    } catch (err) {
      console.error('Erro ao buscar itens NF:', err);
      setItensNF([]);
    } finally {
      setItensLoading(false);
    }
  };

  const handleTituloClick = (titulo) => {
    if (expandedTitulo === titulo.NUM_REGISTRO) {
      setExpandedTitulo(null);
      setItensNF([]);
    } else {
      setExpandedTitulo(titulo.NUM_REGISTRO);
      fetchItensNF(titulo);
    }
  };

  const abrirDetalhe = (cat, sub) => {
    setDetalhePainel({
      codCategoria: cat.COD_CATEGORIA,
      codSubcategoria: sub ? sub.COD_SUBCATEGORIA : null,
      desCategoria: cat.DES_CATEGORIA,
      desSubcategoria: sub ? sub.DES_SUBCATEGORIA : null,
    });
    setDetalheStatus('todos');
    setExpandedTitulo(null);
    setItensNF([]);
  };

  const fecharDetalhe = () => {
    setDetalhePainel(null);
    setDetalheTitulos(null);
    setExpandedTitulo(null);
    setItensNF([]);
  };

  const toggleCat = (codCat) => setExpandedCats(prev => ({ ...prev, [codCat]: !prev[codCat] }));
  const expandAll = () => {
    const exp = {};
    for (const cat of (data?.categorias || [])) exp[cat.COD_CATEGORIA] = true;
    setExpandedCats(exp);
  };
  const collapseAll = () => setExpandedCats({});

  const totais = data?.totais || {};

  // Drag & Drop handlers
  const handleDragStart = (e, colId) => {
    dragColRef.current = colId;
    e.dataTransfer.effectAllowed = 'move';
  };
  const handleDragOver = (e, colId) => {
    e.preventDefault();
    if (dragColRef.current && dragColRef.current !== colId) setDragOverCol(colId);
  };
  const handleDragLeave = () => setDragOverCol(null);
  const handleDrop = (e, targetColId) => {
    e.preventDefault();
    setDragOverCol(null);
    const srcId = dragColRef.current;
    if (!srcId || srcId === targetColId) return;
    setColumns(prev => {
      const arr = [...prev];
      const srcIdx = arr.findIndex(c => c.id === srcId);
      const tgtIdx = arr.findIndex(c => c.id === targetColId);
      if (srcIdx === -1 || tgtIdx === -1) return prev;
      const [moved] = arr.splice(srcIdx, 1);
      arr.splice(tgtIdx, 0, moved);
      return arr;
    });
    dragColRef.current = null;
  };
  const handleDragEnd = () => { dragColRef.current = null; setDragOverCol(null); };

  // Helper: extra class for VAL_DIFERENCA
  const getCatDifClass = (colId, cat) => {
    if (colId === 'VAL_DIFERENCA') {
      if (cat.VAL_DIFERENCA < 0) return 'text-red-600';
      if (cat.VAL_DIFERENCA > 0) return 'text-green-600';
    }
    return '';
  };
  const getSubDifClass = (colId, sub) => {
    if (colId === 'VAL_DIFERENCA') {
      if (sub.VAL_DIFERENCA < 0) return 'text-red-600 font-medium';
      if (sub.VAL_DIFERENCA > 0) return 'text-green-600 font-medium';
    }
    return '';
  };

  return (
    <div className="flex h-screen bg-gray-100 overflow-hidden">
      <Sidebar user={user} onLogout={logout} isMobileMenuOpen={isMobileMenuOpen} setIsMobileMenuOpen={setIsMobileMenuOpen} />
      <div className="flex-1 overflow-auto print:overflow-visible">
        {/* Header laranja */}
        <div className="bg-gradient-to-r from-orange-600 to-orange-500 text-white px-6 py-4 print:bg-white print:text-black">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold">DEMONSTRATIVO DE CAIXA</h1>
              <p className="text-orange-100 text-sm print:text-gray-500">Orçamento Gerencial - Regime de {regime === 'caixa' ? 'Caixa' : 'Competência'}</p>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={expandAll} className="p-2 bg-white/20 rounded hover:bg-white/30 transition" title="Expandir tudo">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4"/></svg>
              </button>
              <button onClick={collapseAll} className="p-2 bg-white/20 rounded hover:bg-white/30 transition" title="Recolher tudo">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 9V4.5M9 9H4.5M9 9L3.5 3.5M9 15v4.5M9 15H4.5M9 15l-5.5 5.5M15 9h4.5M15 9V4.5M15 9l5.5-5.5M15 15h4.5m-4.5 0v4.5m0-4.5l5.5 5.5"/></svg>
              </button>
              <button onClick={() => window.print()} className="p-2 bg-white/20 rounded hover:bg-white/30 transition flex items-center gap-1 text-sm" title="Imprimir">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"/></svg>
                Imprimir
              </button>
              <button onClick={() => setColumns(INITIAL_COLUMNS)} className="p-2 bg-white/20 rounded hover:bg-white/30 transition" title="Resetar colunas">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/></svg>
              </button>
            </div>
          </div>
        </div>

        <div className="p-3 md:p-4">
          {/* Filtros */}
          <div className="bg-white rounded-lg shadow-sm border p-3 mb-4 print:hidden">
            <div className="flex flex-wrap items-center gap-4">
              <div className="flex items-center gap-2">
                <label className="text-sm font-medium text-gray-600">De:</label>
                <input type="date" value={dataInicio} onChange={(e) => setDataInicio(e.target.value)} className="border rounded px-2 py-1.5 text-sm" />
              </div>
              <div className="flex items-center gap-2">
                <label className="text-sm font-medium text-gray-600">Até:</label>
                <input type="date" value={dataFim} onChange={(e) => setDataFim(e.target.value)} className="border rounded px-2 py-1.5 text-sm" />
              </div>
              <div className="flex items-center gap-2">
                <label className="text-sm font-medium text-gray-600">Regime:</label>
                <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-0.5">
                  <button onClick={() => setRegime('caixa')} className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${regime === 'caixa' ? 'bg-white shadow text-orange-600' : 'text-gray-500 hover:text-gray-700'}`}>Caixa</button>
                  <button onClick={() => setRegime('competencia')} className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${regime === 'competencia' ? 'bg-white shadow text-orange-600' : 'text-gray-500 hover:text-gray-700'}`}>Competência</button>
                </div>
              </div>
            </div>
          </div>

          {/* Tabs */}
          <div className="bg-white rounded-t-lg border border-b-0 print:hidden">
            <div className="flex overflow-x-auto">
              {TABS.map(tab => (
                <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                  className={`px-4 py-2.5 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${activeTab === tab.id ? 'border-orange-500 text-orange-600 bg-orange-50' : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50'}`}
                >{tab.label}</button>
              ))}
            </div>
          </div>

          {/* Tabela */}
          {loading ? (
            <div className="flex justify-center py-20"><RadarLoading /></div>
          ) : (
            <div className="bg-white rounded-b-lg shadow-sm border overflow-x-auto print:shadow-none print:border-none">
              <table className="w-full text-sm border-collapse table-fixed">
                <colgroup>
                  <col style={{ width: 320 }} />
                  {columns.map(col => (
                    <col key={col.id} style={{ width: col.id.startsWith('PCT_') ? 65 : 110 }} />
                  ))}
                  <col />
                </colgroup>
                <thead>
                  <tr className="bg-gray-700 text-white">
                    <th className="text-left py-2 px-2 font-semibold sticky left-0 bg-gray-700 z-10 whitespace-nowrap">
                      Movimento
                    </th>
                    {columns.map(col => (
                      <th
                        key={col.id}
                        className={`text-right py-2 px-1 font-semibold select-none whitespace-nowrap ${dragOverCol === col.id ? 'bg-gray-500' : ''}`}
                        draggable
                        onDragStart={(e) => handleDragStart(e, col.id)}
                        onDragOver={(e) => handleDragOver(e, col.id)}
                        onDragLeave={handleDragLeave}
                        onDrop={(e) => handleDrop(e, col.id)}
                        onDragEnd={handleDragEnd}
                      >
                        <div className="flex items-center justify-end gap-1 cursor-grab">
                          <svg className="w-3 h-3 opacity-40 flex-shrink-0" viewBox="0 0 24 24" fill="currentColor">
                            <circle cx="9" cy="5" r="1.5"/><circle cx="15" cy="5" r="1.5"/>
                            <circle cx="9" cy="12" r="1.5"/><circle cx="15" cy="12" r="1.5"/>
                            <circle cx="9" cy="19" r="1.5"/><circle cx="15" cy="19" r="1.5"/>
                          </svg>
                          <span>{col.header}</span>
                        </div>
                      </th>
                    ))}
                    <th className="bg-gray-700"></th>
                  </tr>
                </thead>
                <tbody>
                  {(data?.categorias || []).map((cat) => {
                    const isExpanded = expandedCats[cat.COD_CATEGORIA];
                    const catBg = cat.IS_RECEITA ? 'bg-green-100' : 'bg-orange-100';

                    return (
                      <React.Fragment key={cat.COD_CATEGORIA}>
                        {/* Linha da categoria */}
                        <tr className={`${catBg} ${cat.IS_RECEITA ? 'text-green-800' : 'text-orange-800'} cursor-pointer hover:opacity-80 transition-opacity`} onClick={() => toggleCat(cat.COD_CATEGORIA)}>
                          <td className={`py-1.5 px-3 font-bold sticky left-0 z-10 ${catBg}`}>
                            <div className="flex items-center gap-2">
                              <svg className={`w-3.5 h-3.5 flex-shrink-0 transition-transform ${isExpanded ? 'rotate-90' : ''}`} fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd"/>
                              </svg>
                              <span className="truncate">{cat.DES_CATEGORIA}</span>
                            </div>
                          </td>
                          {columns.map(col => (
                            <td key={col.id} className={`text-right py-1.5 px-1 font-bold ${getCatDifClass(col.id, cat)}`}>
                              {getCatCellValue(col.id, cat, totais)}
                            </td>
                          ))}
                          <td className={catBg}></td>
                        </tr>

                        {/* Subcategorias */}
                        {isExpanded && (cat.subcategorias || []).map((sub) => (
                          <tr key={`${cat.COD_CATEGORIA}_${sub.COD_SUBCATEGORIA}`}
                            className="bg-white hover:bg-gray-50 border-b border-gray-100 cursor-pointer"
                            onClick={() => abrirDetalhe(cat, sub)}
                          >
                            <td className="py-1 px-3 pl-8 sticky left-0 bg-white z-10">
                              <span className="text-gray-700">{sub.DES_SUBCATEGORIA}</span>
                            </td>
                            {columns.map(col => (
                              <td key={col.id} className={`text-right py-1 px-1 text-gray-600 ${getSubDifClass(col.id, sub)}`}>
                                {getSubCellValue(col.id, sub, cat, totais)}
                              </td>
                            ))}
                            <td></td>
                          </tr>
                        ))}
                      </React.Fragment>
                    );
                  })}

                  {/* Totais */}
                  {data && (
                    <>
                      <tr className="bg-green-200 text-green-900 font-bold">
                        <td className="py-2 px-3 sticky left-0 bg-green-200 z-10">TOTAL RECEITAS</td>
                        {columns.map(col => {
                          const difRec = (totais.totalMetaReceitas || 0) - (totais.totalReceitas || 0);
                          const difClass = col.id === 'VAL_DIFERENCA' ? (difRec < 0 ? 'text-red-600' : difRec > 0 ? 'text-green-700' : '') : '';
                          return <td key={col.id} className={`text-right py-1.5 px-1 ${difClass}`}>{getTotalCellValue(col.id, totais, 'receitas')}</td>;
                        })}
                        <td className="bg-green-200"></td>
                      </tr>
                      <tr className="bg-orange-200 text-orange-900 font-bold">
                        <td className="py-2 px-3 sticky left-0 bg-orange-200 z-10">TOTAL DESPESAS</td>
                        {columns.map(col => {
                          const difDesp = (totais.totalMetaDespesas || 0) - (totais.totalDespesas || 0);
                          const difClass = col.id === 'VAL_DIFERENCA' ? (difDesp < 0 ? 'text-red-600' : difDesp > 0 ? 'text-green-700' : '') : '';
                          return <td key={col.id} className={`text-right py-1.5 px-1 ${difClass}`}>{getTotalCellValue(col.id, totais, 'despesas')}</td>;
                        })}
                        <td className="bg-orange-200"></td>
                      </tr>
                      <tr className="bg-gray-800 text-white font-bold text-base">
                        <td className="py-2.5 px-3 sticky left-0 bg-gray-800 z-10">SALDO (Receitas - Despesas)</td>
                        {columns.map(col => (
                          <td key={col.id} className={`text-right py-2.5 px-1 ${col.id === 'VAL_REALIZADO' ? (totais.saldo < 0 ? 'text-red-300' : 'text-green-300') : ''}`}>
                            {getTotalCellValue(col.id, totais, 'saldo')}
                          </td>
                        ))}
                        <td className="bg-gray-800"></td>
                      </tr>
                    </>
                  )}

                  {!data && !loading && (
                    <tr>
                      <td colSpan={2 + columns.length} className="text-center py-10 text-gray-400">
                        Nenhum dado encontrado para o período selecionado.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}

          {/* Resumo em cards */}
          {data && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4 print:grid-cols-4">
              <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                <div className="text-sm text-green-600 font-medium">Total Receitas</div>
                <div className="text-xl font-bold text-green-700 mt-1">R$ {formatCurrency(totais.totalReceitas)}</div>
                <div className="text-sm text-green-500 mt-0.5">Meta: R$ {formatCurrency(totais.totalMetaReceitas)}</div>
              </div>
              <div className="bg-orange-50 border border-orange-200 rounded-lg p-3">
                <div className="text-sm text-orange-600 font-medium">Total Despesas</div>
                <div className="text-xl font-bold text-orange-700 mt-1">R$ {formatCurrency(totais.totalDespesas)}</div>
                <div className="text-sm text-orange-500 mt-0.5">Meta: R$ {formatCurrency(totais.totalMetaDespesas)}</div>
              </div>
              <div className={`${(totais.saldo || 0) >= 0 ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'} border rounded-lg p-3`}>
                <div className={`text-sm font-medium ${(totais.saldo || 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>Saldo</div>
                <div className={`text-xl font-bold mt-1 ${(totais.saldo || 0) >= 0 ? 'text-green-700' : 'text-red-700'}`}>R$ {formatCurrency(totais.saldo)}</div>
              </div>
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
                <div className="text-sm text-gray-600 font-medium">Período</div>
                <div className="text-base font-bold text-gray-700 mt-1">
                  {dataInicio.split('-').reverse().join('/')} a {dataFim.split('-').reverse().join('/')}
                </div>
                <div className="text-sm text-gray-500 mt-0.5">Regime: {regime === 'caixa' ? 'Caixa' : 'Competência'}</div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Painel lateral - Detalhamento de Títulos */}
      {detalhePainel && (
        <div className="w-[520px] flex-shrink-0 border-l border-gray-300 bg-white flex flex-col overflow-hidden shadow-xl">
          {/* Header do painel */}
          <div className="bg-gradient-to-r from-orange-600 to-orange-500 text-white px-4 py-3 flex items-center justify-between shrink-0">
            <div className="min-w-0">
              <h2 className="text-sm font-bold truncate">Detalhamento de Títulos</h2>
              <p className="text-orange-100 text-xs truncate">{detalhePainel.desCategoria}{detalhePainel.desSubcategoria ? ` > ${detalhePainel.desSubcategoria}` : ''}</p>
            </div>
            <button onClick={fecharDetalhe} className="p-1 hover:bg-white/20 rounded transition ml-2 shrink-0">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"/></svg>
            </button>
          </div>

          {/* Filtros status */}
          <div className="px-4 py-2 border-b flex items-center gap-2 shrink-0 bg-gray-50">
            {[
              { id: 'todos', label: 'TODOS' },
              { id: 'aberto', label: 'ABERTOS' },
              { id: 'quitado', label: 'QUITADOS' },
            ].map(s => (
              <button key={s.id} onClick={() => setDetalheStatus(s.id)}
                className={`px-3 py-1 rounded text-xs font-bold transition-colors ${detalheStatus === s.id ? 'bg-orange-500 text-white' : 'bg-gray-200 text-gray-600 hover:bg-gray-300'}`}
              >{s.label}</button>
            ))}
            {detalheTitulos && (
              <span className="text-xs text-gray-500 ml-auto">{detalheTitulos.totais?.qtdTitulos || 0} títulos</span>
            )}
          </div>

          {/* Lista de títulos */}
          <div className="flex-1 overflow-auto">
            {detalheLoading ? (
              <div className="flex justify-center py-10"><RadarLoading /></div>
            ) : (
              <div className="divide-y divide-gray-100">
                {(detalheTitulos?.titulos || []).map((t) => (
                  <div key={t.NUM_REGISTRO}>
                    <div
                      className={`px-4 py-2 cursor-pointer hover:bg-gray-50 transition ${expandedTitulo === t.NUM_REGISTRO ? 'bg-orange-50' : ''}`}
                      onClick={() => handleTituloClick(t)}
                    >
                      <div className="flex items-center gap-2">
                        <span className={`inline-block w-2 h-2 rounded-full shrink-0 ${t.FLG_QUITADO === 'S' ? 'bg-green-500' : 'bg-red-500'}`}></span>
                        <span className="text-sm font-medium text-gray-800 truncate flex-1">{t.DES_PARCEIRO || 'Sem parceiro'}</span>
                        <span className="text-sm font-bold text-gray-700 shrink-0">
                          {formatCurrency(t.VAL_PARCELA)}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 mt-1 ml-4 text-xs text-gray-500">
                        {t.NUM_DOCTO && <span>Doc: {t.NUM_DOCTO}</span>}
                        {t.NUM_NF && <span>NF: {t.NUM_NF}</span>}
                        <span>{t.FLG_QUITADO === 'S' ? 'Quitado' : 'Aberto'}</span>
                        {t.DES_ENTIDADE && <span>{t.DES_ENTIDADE}</span>}
                        <span className="ml-auto">{formatDate(t.DTA_VENCIMENTO)}</span>
                      </div>
                    </div>

                    {/* Itens da NF expandidos */}
                    {expandedTitulo === t.NUM_REGISTRO && (
                      <div className="bg-gray-50 border-t border-gray-200 px-4 py-2">
                        {itensLoading ? (
                          <div className="text-xs text-gray-400 py-2 text-center">Carregando produtos...</div>
                        ) : itensNF.length === 0 ? (
                          <div className="text-xs text-gray-400 py-2 text-center">
                            {t.NUM_NF ? 'Nenhum produto encontrado para esta NF' : 'Título sem NF vinculada'}
                          </div>
                        ) : (
                          <table className="w-full text-xs">
                            <thead>
                              <tr className="text-gray-500 border-b">
                                <th className="text-left py-1 font-medium">Cód</th>
                                <th className="text-left py-1 font-medium">Produto</th>
                                <th className="text-right py-1 font-medium">Qtd</th>
                                <th className="text-right py-1 font-medium">Valor</th>
                              </tr>
                            </thead>
                            <tbody>
                              {itensNF.map((item, idx) => (
                                <tr key={idx} className="border-b border-gray-100">
                                  <td className="py-1 text-gray-600">{item.COD_ITEM}</td>
                                  <td className="py-1 text-gray-700 truncate max-w-[200px]">{item.DES_PRODUTO || '-'}</td>
                                  <td className="py-1 text-right text-gray-600">{item.QTD_TOTAL != null ? Number(item.QTD_TOTAL).toLocaleString('pt-BR', { maximumFractionDigits: 3 }) : '-'}</td>
                                  <td className="py-1 text-right text-gray-700 font-medium">{formatCurrency(item.VAL_TOTAL_ITEM)}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        )}
                      </div>
                    )}
                  </div>
                ))}

                {!detalheLoading && (!detalheTitulos?.titulos || detalheTitulos.titulos.length === 0) && (
                  <div className="text-center py-10 text-gray-400 text-sm">
                    Nenhum título encontrado para o filtro selecionado.
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Totais do painel */}
          {detalheTitulos?.totais && (
            <div className="border-t bg-gray-50 px-4 py-3 shrink-0">
              <div className="grid grid-cols-3 gap-2 text-center">
                <div>
                  <div className="text-xs text-red-500 font-medium">Aberto</div>
                  <div className="text-sm font-bold text-red-600">{formatCurrency(detalheTitulos.totais.totalAberto)}</div>
                </div>
                <div>
                  <div className="text-xs text-green-500 font-medium">Quitado</div>
                  <div className="text-sm font-bold text-green-600">{formatCurrency(detalheTitulos.totais.totalQuitado)}</div>
                </div>
                <div>
                  <div className="text-xs text-gray-500 font-medium">Total</div>
                  <div className="text-sm font-bold text-gray-700">{formatCurrency(detalheTitulos.totais.totalGeral)}</div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
