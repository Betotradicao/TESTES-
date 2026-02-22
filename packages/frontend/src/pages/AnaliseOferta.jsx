import { useState, useEffect, useMemo, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useLoja } from '../contexts/LojaContext';
import Sidebar from '../components/Sidebar';
import { api } from '../utils/api';

const DEFAULT_OFERTA_RANGES = [
  { id: 'excelente', label: 'Excelente', color: 'bg-green-100 text-green-800 border-green-300', de: 100, ate: 9999 },
  { id: 'boa',       label: 'Boa',       color: 'bg-blue-100 text-blue-800 border-blue-300',   de: 30,  ate: 99.9 },
  { id: 'regular',   label: 'Regular',   color: 'bg-yellow-100 text-yellow-800 border-yellow-300', de: 0, ate: 29.9 },
  { id: 'ruim',      label: 'Ruim',      color: 'bg-orange-100 text-orange-800 border-orange-300', de: -50, ate: -0.1 },
  { id: 'pessima',   label: 'Pessima',   color: 'bg-red-100 text-red-800 border-red-300',     de: -9999, ate: -50.1 },
];

const CURVA_OPTIONS = ['A', 'B', 'C', 'D', 'E'];
const CLASSIF_OPTIONS = [
  { id: 'excelente', label: 'Excelente', color: 'bg-green-100 text-green-700 border-green-400 hover:bg-green-200', activeColor: 'bg-green-500 text-white border-green-600' },
  { id: 'boa',       label: 'Boa',       color: 'bg-blue-100 text-blue-700 border-blue-400 hover:bg-blue-200',     activeColor: 'bg-blue-500 text-white border-blue-600' },
  { id: 'regular',   label: 'Regular',   color: 'bg-yellow-100 text-yellow-700 border-yellow-400 hover:bg-yellow-200', activeColor: 'bg-yellow-500 text-white border-yellow-600' },
  { id: 'ruim',      label: 'Ruim',      color: 'bg-orange-100 text-orange-700 border-orange-400 hover:bg-orange-200', activeColor: 'bg-orange-500 text-white border-orange-600' },
  { id: 'pessima',   label: 'Pessima',   color: 'bg-red-100 text-red-700 border-red-400 hover:bg-red-200',         activeColor: 'bg-red-500 text-white border-red-600' },
];

const CURVA_COLORS = {
  A: { color: 'bg-green-100 text-green-700 border-green-400 hover:bg-green-200', activeColor: 'bg-green-500 text-white border-green-600' },
  B: { color: 'bg-blue-100 text-blue-700 border-blue-400 hover:bg-blue-200',     activeColor: 'bg-blue-500 text-white border-blue-600' },
  C: { color: 'bg-yellow-100 text-yellow-700 border-yellow-400 hover:bg-yellow-200', activeColor: 'bg-yellow-500 text-white border-yellow-600' },
  D: { color: 'bg-orange-100 text-orange-700 border-orange-400 hover:bg-orange-200', activeColor: 'bg-orange-500 text-white border-orange-600' },
  E: { color: 'bg-red-100 text-red-700 border-red-400 hover:bg-red-200',         activeColor: 'bg-red-500 text-white border-red-600' },
};

export default function AnaliseOferta() {
  const { user, logout } = useAuth();
  const { lojaSelecionada } = useLoja();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // Data
  const [produtos, setProdutos] = useState([]);
  const [resumo, setResumo] = useState(null);
  const [loading, setLoading] = useState(false);

  // Filters
  const [filterSecao, setFilterSecao] = useState('');
  const [filterCurvas, setFilterCurvas] = useState([]); // multi-select
  const [filterClassif, setFilterClassif] = useState([]); // multi-select
  const [filterFornecedor, setFilterFornecedor] = useState('');
  const [searchText, setSearchText] = useState('');

  // % Oferta config
  const [showOfertaConfig, setShowOfertaConfig] = useState(false);
  const [ofertaRanges, setOfertaRanges] = useState(() => {
    try {
      const saved = localStorage.getItem('gestao_ofertas_ranges');
      if (saved) return JSON.parse(saved);
    } catch {}
    return DEFAULT_OFERTA_RANGES;
  });
  const ofertaConfigRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (ofertaConfigRef.current && !ofertaConfigRef.current.contains(e.target)) {
        setShowOfertaConfig(false);
      }
    };
    if (showOfertaConfig) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showOfertaConfig]);

  const handleRangeChange = (idx, field, value) => {
    const updated = [...ofertaRanges];
    updated[idx] = { ...updated[idx], [field]: value === '' ? '' : Number(value) };
    setOfertaRanges(updated);
  };

  const saveOfertaRanges = () => {
    localStorage.setItem('gestao_ofertas_ranges', JSON.stringify(ofertaRanges));
    setShowOfertaConfig(false);
  };

  const getOfertaClassif = (crescPct) => {
    for (const range of ofertaRanges) {
      const de = Number(range.de);
      const ate = Number(range.ate);
      const min = Math.min(de, ate);
      const max = Math.max(de, ate);
      if (crescPct >= min && crescPct <= max) {
        return range;
      }
    }
    return null;
  };

  // Sort
  const [sortColumn, setSortColumn] = useState('DESCRICAO');
  const [sortDirection, setSortDirection] = useState('asc');

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 50;

  // Load produtos - sempre codProg=0 (todas as programacoes ativas do mes atual)
  useEffect(() => {
    const codLoja = lojaSelecionada || 1;
    setLoading(true);
    api.get(`/api/ofertas/produtos/0?codLoja=${codLoja}&mesAtual=true`)
      .then(res => {
        setProdutos(res.data?.produtos || []);
        setResumo(res.data?.resumo || null);
        setCurrentPage(1);
      })
      .catch(err => {
        console.error('Erro ao carregar produtos:', err);
        setProdutos([]);
        setResumo(null);
      })
      .finally(() => setLoading(false));
  }, [lojaSelecionada]);

  // Filter options
  const filterOptions = useMemo(() => {
    const secoes = [...new Set(produtos.map(p => p.SECAO).filter(Boolean))].sort();
    const fornecedores = [...new Set(produtos.map(p => p.FORNECEDOR).filter(Boolean))].sort();
    return { secoes, fornecedores };
  }, [produtos]);

  // Toggle multi-select helpers
  const toggleCurva = (curva) => {
    setFilterCurvas(prev =>
      prev.includes(curva) ? prev.filter(c => c !== curva) : [...prev, curva]
    );
    setCurrentPage(1);
  };

  const toggleClassif = (classifId) => {
    setFilterClassif(prev =>
      prev.includes(classifId) ? prev.filter(c => c !== classifId) : [...prev, classifId]
    );
    setCurrentPage(1);
  };

  // Calcular classificacao de um produto
  const getProductClassifId = (product) => {
    const cresc = product.VD_MEDIA > 0 && product.VD_OFERTA != null
      ? ((product.VD_OFERTA - product.VD_MEDIA) / product.VD_MEDIA) * 100
      : null;
    if (cresc == null) return null;
    const classif = getOfertaClassif(cresc);
    return classif ? classif.id : null;
  };

  // Filtered & sorted products
  const filteredProducts = useMemo(() => {
    let result = [...produtos];

    if (filterSecao) result = result.filter(p => p.SECAO === filterSecao);
    if (filterCurvas.length > 0) result = result.filter(p => filterCurvas.includes(p.CURVA));
    if (filterClassif.length > 0) {
      result = result.filter(p => {
        const classifId = getProductClassifId(p);
        return classifId && filterClassif.includes(classifId);
      });
    }
    if (filterFornecedor) result = result.filter(p => p.FORNECEDOR === filterFornecedor);
    if (searchText) {
      const s = searchText.toLowerCase();
      result = result.filter(p =>
        (p.DESCRICAO || '').toLowerCase().includes(s) ||
        (p.COD_BARRAS || '').includes(s) ||
        (p.COD_PRODUTO || '').includes(s)
      );
    }

    // Sort
    result.sort((a, b) => {
      let va, vb;
      if (sortColumn === 'DESC_PCT') {
        va = a.PRECO_NORMAL > 0 ? ((a.PRECO_NORMAL - a.PRECO_OFERTA) / a.PRECO_NORMAL) * 100 : 0;
        vb = b.PRECO_NORMAL > 0 ? ((b.PRECO_NORMAL - b.PRECO_OFERTA) / b.PRECO_NORMAL) * 100 : 0;
      } else if (sortColumn === 'CRESC_OFERTA' || sortColumn === 'CLASSIF_OFERTA') {
        va = a.VD_MEDIA > 0 && a.VD_OFERTA != null ? ((a.VD_OFERTA - a.VD_MEDIA) / a.VD_MEDIA) * 100 : 0;
        vb = b.VD_MEDIA > 0 && b.VD_OFERTA != null ? ((b.VD_OFERTA - b.VD_MEDIA) / b.VD_MEDIA) * 100 : 0;
      } else {
        va = a[sortColumn];
        vb = b[sortColumn];
      }
      if (typeof va === 'string') va = va.toLowerCase();
      if (typeof vb === 'string') vb = vb.toLowerCase();
      if (va < vb) return sortDirection === 'asc' ? -1 : 1;
      if (va > vb) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });

    return result;
  }, [produtos, filterSecao, filterCurvas, filterClassif, filterFornecedor, searchText, sortColumn, sortDirection, ofertaRanges]);

  // Pagination
  const totalPages = Math.ceil(filteredProducts.length / itemsPerPage);
  const paginatedProducts = filteredProducts.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const handleSort = (column) => {
    if (sortColumn === column) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(column);
      setSortDirection('asc');
    }
  };

  const formatCurrency = (val) => {
    if (val == null) return 'R$ 0,00';
    return `R$ ${Number(val).toFixed(2).replace('.', ',')}`;
  };

  const formatPercent = (val) => {
    if (val == null) return '0,0%';
    return `${Number(val).toFixed(1).replace('.', ',')}%`;
  };

  const formatNumber = (val) => {
    if (val == null) return '0';
    return Number(val).toFixed(2).replace('.', ',');
  };

  // Table columns
  const defaultColumns = [
    { id: 'DESCRICAO', label: 'Descricao', align: 'left' },
    { id: 'COD_BARRAS', label: 'EAN', align: 'left' },
    { id: 'RELEVANCIA', label: 'Relev.', align: 'center' },
    { id: 'CUSTO', label: 'Custo', align: 'right', format: formatCurrency },
    { id: 'PRECO_NORMAL', label: 'Preco Normal', align: 'right', format: formatCurrency },
    { id: 'PRECO_OFERTA', label: 'Preco Oferta', align: 'right', format: formatCurrency },
    { id: 'DESC_PCT', label: '% Desc.', align: 'right', format: formatPercent },
    { id: 'MARGEM_NORMAL', label: 'Mg Normal', align: 'right', format: formatPercent },
    { id: 'MARGEM_OFERTA', label: 'Mg Oferta', align: 'right', format: formatPercent },
    { id: 'ESTOQUE', label: 'Estoque', align: 'right', format: formatNumber },
    { id: 'VD_MEDIA', label: 'Vd Media', align: 'right', format: formatNumber },
    { id: 'VD_OFERTA', label: 'Vd Atual', align: 'right', format: formatNumber },
    { id: 'CRESC_OFERTA', label: 'Cresc. Oferta', align: 'right', format: formatPercent },
    { id: 'CLASSIF_OFERTA', label: 'Classif.', align: 'center' },
    { id: 'DIAS_COBERTURA', label: 'Dias Cob.', align: 'right', format: (v) => v != null ? Number(v).toFixed(1).replace('.', ',') : '0' },
    { id: 'CURVA', label: 'Curva', align: 'center' },
    { id: 'SECAO', label: 'Secao', align: 'left' },
  ];
  const [columns, setColumns] = useState(defaultColumns);
  const [dragColIdx, setDragColIdx] = useState(null);

  const getCurvaColor = (curva) => {
    switch (curva) {
      case 'A': return 'bg-green-100 text-green-800';
      case 'B': return 'bg-blue-100 text-blue-800';
      case 'C': return 'bg-yellow-100 text-yellow-800';
      case 'D': return 'bg-orange-100 text-orange-800';
      case 'E': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getRelevanciaColor = (rel) => {
    switch (rel) {
      case 'N': return 'bg-green-100 text-green-800';
      case 'SP': return 'bg-yellow-100 text-yellow-800';
      case 'R': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getMargemColor = (margem) => {
    if (margem < 0) return 'text-red-600 font-semibold';
    if (margem < 5) return 'text-orange-600';
    if (margem < 15) return 'text-yellow-600';
    return 'text-green-600';
  };

  const getEstoqueColor = (estoque) => {
    if (estoque <= 0) return 'text-red-600 font-semibold';
    if (estoque < 5) return 'text-orange-600';
    return 'text-gray-900';
  };

  const hasActiveFilters = filterSecao || filterCurvas.length > 0 || filterClassif.length > 0 || filterFornecedor || searchText;

  const clearAllFilters = () => {
    setFilterSecao('');
    setFilterCurvas([]);
    setFilterClassif([]);
    setFilterFornecedor('');
    setSearchText('');
    setCurrentPage(1);
  };

  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar
        user={user}
        onLogout={logout}
        isMobileMenuOpen={isMobileMenuOpen}
        setIsMobileMenuOpen={setIsMobileMenuOpen}
      />

      <div className="flex-1 overflow-auto lg:ml-0 min-w-0">
        {/* Mobile Header */}
        <div className="lg:hidden bg-white shadow-sm p-4 flex items-center justify-between">
          <button onClick={() => setIsMobileMenuOpen(true)} className="p-2 text-gray-600 hover:text-gray-900">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16"/>
            </svg>
          </button>
          <h1 className="text-lg font-semibold text-gray-900">Analise e Sugestao</h1>
          <button onClick={logout} className="p-2 text-gray-600 hover:text-red-600">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"/>
            </svg>
          </button>
        </div>

        <div className="p-3 sm:p-6 min-w-0">
          {/* Orange Gradient Header - Desktop */}
          <div className="hidden lg:block bg-gradient-to-br from-orange-500 to-red-600 rounded-lg shadow-lg p-6 mb-6 text-white">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl lg:text-3xl font-bold mb-2">ANALISE E SUGESTAO DE OFERTAS</h1>
                <p className="text-white/90">
                  Analise a performance das ofertas ativas por curva, classificacao e secao
                </p>
              </div>
              <div className="bg-white/20 backdrop-blur-sm rounded-full p-3">
                <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/>
                </svg>
              </div>
            </div>
          </div>

          {/* Filtros */}
          <div className="bg-white rounded-lg shadow p-4 mb-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Secao */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Secao</label>
                <select
                  value={filterSecao}
                  onChange={(e) => { setFilterSecao(e.target.value); setCurrentPage(1); }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500 text-sm"
                >
                  <option value="">Todas</option>
                  {filterOptions.secoes.map(s => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>

              {/* Fornecedor */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Fornecedor</label>
                <select
                  value={filterFornecedor}
                  onChange={(e) => { setFilterFornecedor(e.target.value); setCurrentPage(1); }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500 text-sm"
                >
                  <option value="">Todos</option>
                  {filterOptions.fornecedores.map(f => (
                    <option key={f} value={f}>{f}</option>
                  ))}
                </select>
              </div>

              {/* Busca */}
              <div className="sm:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">Buscar</label>
                <input
                  type="text"
                  placeholder="Produto, EAN..."
                  value={searchText}
                  onChange={(e) => { setSearchText(e.target.value); setCurrentPage(1); }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500 text-sm"
                />
              </div>
            </div>

            {/* Filtros multi-select: Curva e Classificacao */}
            <div className="mt-4 space-y-3">
              {/* Curva toggle buttons */}
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-medium text-gray-700 mr-1">Curva:</span>
                {CURVA_OPTIONS.map(curva => {
                  const isActive = filterCurvas.includes(curva);
                  const colors = CURVA_COLORS[curva];
                  return (
                    <button
                      key={curva}
                      onClick={() => toggleCurva(curva)}
                      className={`px-3 py-1 rounded-full text-xs font-bold border transition-all ${
                        isActive ? colors.activeColor : colors.color
                      }`}
                    >
                      {curva}
                    </button>
                  );
                })}
                {filterCurvas.length > 0 && (
                  <button
                    onClick={() => { setFilterCurvas([]); setCurrentPage(1); }}
                    className="text-xs text-gray-500 hover:text-gray-700 underline ml-1"
                  >
                    Limpar
                  </button>
                )}
              </div>

              {/* Classificacao toggle buttons */}
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-medium text-gray-700 mr-1">Classificacao:</span>
                {CLASSIF_OPTIONS.map(opt => {
                  const isActive = filterClassif.includes(opt.id);
                  return (
                    <button
                      key={opt.id}
                      onClick={() => toggleClassif(opt.id)}
                      className={`px-3 py-1 rounded-full text-xs font-bold border transition-all ${
                        isActive ? opt.activeColor : opt.color
                      }`}
                    >
                      {opt.label}
                    </button>
                  );
                })}
                {filterClassif.length > 0 && (
                  <button
                    onClick={() => { setFilterClassif([]); setCurrentPage(1); }}
                    className="text-xs text-gray-500 hover:text-gray-700 underline ml-1"
                  >
                    Limpar
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Cards Resumo */}
          {resumo && (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4 mb-6">
              <div className="bg-white rounded-lg shadow p-3 sm:p-4 border-l-4 border-blue-500">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xl sm:text-2xl font-bold text-blue-600">{resumo.totalProdutos}</span>
                </div>
                <p className="text-xs sm:text-sm font-medium text-gray-700">Total Produtos</p>
              </div>

              <div className="bg-white rounded-lg shadow p-3 sm:p-4 border-l-4 border-red-500">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xl sm:text-2xl font-bold text-red-600">{resumo.estZerado}</span>
                </div>
                <p className="text-xs sm:text-sm font-medium text-gray-700">Est. Zerado</p>
                <p className="text-[10px] sm:text-xs text-red-500">
                  {resumo.totalProdutos > 0 ? ((resumo.estZerado / resumo.totalProdutos) * 100).toFixed(1) : 0}% do total
                </p>
              </div>

              <div className="bg-white rounded-lg shadow p-3 sm:p-4 border-l-4 border-orange-500">
                <div className="flex items-center justify-between mb-1">
                  <span className={`text-xl sm:text-2xl font-bold ${getMargemColor(resumo.margemMediaOferta)}`}>
                    {formatPercent(resumo.margemMediaOferta)}
                  </span>
                </div>
                <p className="text-xs sm:text-sm font-medium text-gray-700">Mg Media Oferta</p>
              </div>

              <div className="bg-white rounded-lg shadow p-3 sm:p-4 border-l-4 border-green-500">
                <div className="flex items-center justify-between mb-1">
                  <span className={`text-xl sm:text-2xl font-bold ${getMargemColor(resumo.margemMediaNormal)}`}>
                    {formatPercent(resumo.margemMediaNormal)}
                  </span>
                </div>
                <p className="text-xs sm:text-sm font-medium text-gray-700">Mg Media Normal</p>
              </div>

              <div className="bg-white rounded-lg shadow p-3 sm:p-4 border-l-4 border-purple-500">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-lg sm:text-xl font-bold text-purple-600">
                    {formatPercent(resumo.pctVendasOferta)}
                  </span>
                </div>
                <p className="text-xs sm:text-sm font-medium text-gray-700">Vendas em Oferta</p>
                <p className="text-[10px] sm:text-xs text-purple-500">
                  {formatCurrency(resumo.vendasOferta)} | MKD: {formatPercent(resumo.markdownOferta)}
                </p>
              </div>

              <div className="bg-white rounded-lg shadow p-3 sm:p-4 border-l-4 border-amber-500">
                <div className="flex items-center justify-between mb-1">
                  <span className={`text-xl sm:text-2xl font-bold ${resumo.difMargem >= 0 ? 'text-red-600' : 'text-green-600'}`}>
                    {resumo.difMargem >= 0 ? '-' : '+'}{formatPercent(Math.abs(resumo.difMargem))}
                  </span>
                </div>
                <p className="text-xs sm:text-sm font-medium text-gray-700">Dif. Margem</p>
                <p className="text-[10px] sm:text-xs text-gray-500">Normal vs Oferta</p>
              </div>
            </div>
          )}

          {/* Info bar */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 mb-4">
            <div className="text-xs sm:text-sm text-gray-600">
              {filteredProducts.length} produto{filteredProducts.length !== 1 ? 's' : ''} encontrado{filteredProducts.length !== 1 ? 's' : ''}
              {hasActiveFilters && (
                <button
                  onClick={clearAllFilters}
                  className="ml-2 text-orange-500 hover:text-orange-700 underline"
                >
                  Limpar filtros
                </button>
              )}
            </div>

            {/* Botao engrenagem % OFERTA */}
            <div className="relative" ref={ofertaConfigRef}>
              <button
                onClick={() => setShowOfertaConfig(!showOfertaConfig)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md border text-sm font-medium transition-colors ${
                  showOfertaConfig
                    ? 'bg-orange-100 border-orange-400 text-orange-700'
                    : 'bg-white border-gray-300 text-gray-600 hover:bg-gray-50 hover:border-gray-400'
                }`}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"/>
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>
                </svg>
                % OFERTA
              </button>

              {showOfertaConfig && (
                <div className="absolute right-0 top-full mt-2 bg-white rounded-lg shadow-xl border border-gray-200 p-4 z-50 w-[380px]">
                  <h3 className="text-sm font-bold text-gray-800 mb-3 flex items-center gap-2">
                    <span>Classificacao do Crescimento da Oferta</span>
                  </h3>
                  <p className="text-xs text-gray-500 mb-3">Defina as faixas de % para cada classificacao</p>

                  <div className="space-y-2">
                    {ofertaRanges.map((range, idx) => (
                      <div key={range.id} className="flex items-center gap-2">
                        <span className={`inline-block w-20 text-center px-2 py-1 rounded-full text-xs font-bold border ${range.color}`}>
                          {range.label}
                        </span>
                        <span className="text-xs text-gray-500">de</span>
                        <input
                          type="number"
                          value={range.de}
                          onChange={(e) => handleRangeChange(idx, 'de', e.target.value)}
                          className="w-20 px-2 py-1 border border-gray-300 rounded text-sm text-center focus:ring-1 focus:ring-orange-500 focus:border-orange-500"
                        />
                        <span className="text-xs text-gray-500">ate</span>
                        <input
                          type="number"
                          value={range.ate}
                          onChange={(e) => handleRangeChange(idx, 'ate', e.target.value)}
                          className="w-20 px-2 py-1 border border-gray-300 rounded text-sm text-center focus:ring-1 focus:ring-orange-500 focus:border-orange-500"
                        />
                        <span className="text-xs text-gray-400">%</span>
                      </div>
                    ))}
                  </div>

                  <div className="flex items-center justify-between mt-4 pt-3 border-t border-gray-200">
                    <button
                      onClick={() => { setOfertaRanges(DEFAULT_OFERTA_RANGES); localStorage.removeItem('gestao_ofertas_ranges'); }}
                      className="text-xs text-gray-500 hover:text-gray-700 underline"
                    >
                      Restaurar padrao
                    </button>
                    <button
                      onClick={saveOfertaRanges}
                      className="px-4 py-1.5 bg-orange-600 text-white text-sm font-medium rounded-md hover:bg-orange-700 transition-colors"
                    >
                      Salvar
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Loading */}
          {loading && (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-orange-500"></div>
              <span className="ml-3 text-gray-600">Carregando...</span>
            </div>
          )}

          {/* Table */}
          {!loading && filteredProducts.length > 0 && (
            <div className="bg-white rounded-lg shadow overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-100 sticky top-0">
                    <tr>
                      {columns.map((col, colIdx) => (
                        <th
                          key={col.id}
                          draggable
                          onDragStart={() => setDragColIdx(colIdx)}
                          onDragOver={(e) => e.preventDefault()}
                          onDrop={() => {
                            if (dragColIdx === null || dragColIdx === colIdx) return;
                            const newCols = [...columns];
                            const [moved] = newCols.splice(dragColIdx, 1);
                            newCols.splice(colIdx, 0, moved);
                            setColumns(newCols);
                            setDragColIdx(null);
                          }}
                          onClick={() => handleSort(col.id)}
                          className={`px-3 py-3 text-xs font-semibold cursor-pointer hover:bg-gray-200 transition-colors whitespace-nowrap select-none ${
                            col.id === 'MARGEM_OFERTA' ? 'bg-purple-100 text-purple-800 hover:bg-purple-200' : 'text-gray-700'
                          } ${
                            col.align === 'right' ? 'text-right' : col.align === 'center' ? 'text-center' : 'text-left'
                          }`}
                          title="Arraste para reordenar"
                        >
                          {col.label}
                          {sortColumn === col.id && (
                            <span className="ml-1">{sortDirection === 'asc' ? '\u2191' : '\u2193'}</span>
                          )}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedProducts.map((product, idx) => (
                      <tr key={`${product.COD_PRODUTO}-${idx}`} className="border-b border-gray-100 hover:bg-orange-50 transition-colors">
                        {columns.map(col => {
                          const val = product[col.id];
                          if (col.id === 'DESCRICAO') {
                            return <td key={col.id} className="px-3 py-2.5 text-sm text-gray-900 max-w-[200px] truncate" title={val}>{val}</td>;
                          }
                          if (col.id === 'COD_BARRAS') {
                            return <td key={col.id} className="px-3 py-2.5 text-sm text-gray-600 font-mono">{val}</td>;
                          }
                          if (col.id === 'PRECO_OFERTA') {
                            return <td key={col.id} className="px-3 py-2.5 text-sm text-right font-semibold text-orange-600">{formatCurrency(val)}</td>;
                          }
                          if (col.id === 'DESC_PCT') {
                            const descPct = product.PRECO_NORMAL > 0
                              ? ((product.PRECO_NORMAL - product.PRECO_OFERTA) / product.PRECO_NORMAL) * 100
                              : 0;
                            return <td key={col.id} className={`px-3 py-2.5 text-sm text-right font-semibold ${descPct > 20 ? 'text-red-600' : descPct > 10 ? 'text-orange-600' : 'text-blue-600'}`}>
                              {descPct > 0 ? '-' : ''}{formatPercent(Math.abs(descPct))}
                            </td>;
                          }
                          if (col.id === 'MARGEM_NORMAL') {
                            return <td key={col.id} className={`px-3 py-2.5 text-sm text-right ${getMargemColor(val)}`}>{formatPercent(val)}</td>;
                          }
                          if (col.id === 'MARGEM_OFERTA') {
                            return <td key={col.id} className={`px-3 py-2.5 text-sm text-right bg-purple-50 font-semibold ${val < 0 ? 'text-red-600' : 'text-green-600'}`}>{formatPercent(val)}</td>;
                          }
                          if (col.id === 'ESTOQUE') {
                            return <td key={col.id} className={`px-3 py-2.5 text-sm text-right ${getEstoqueColor(val)}`}>{formatNumber(val)}</td>;
                          }
                          if (col.id === 'DIAS_COBERTURA') {
                            return <td key={col.id} className={`px-3 py-2.5 text-sm text-right ${val <= 0 ? 'text-red-600 font-semibold' : val < 3 ? 'text-orange-600' : 'text-gray-700'}`}>
                              {val != null ? Number(val).toFixed(1).replace('.', ',') : '0'}
                            </td>;
                          }
                          if (col.id === 'RELEVANCIA') {
                            return <td key={col.id} className="px-3 py-2.5 text-center">
                              <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-bold ${getRelevanciaColor(val)}`}>{val || '-'}</span>
                            </td>;
                          }
                          if (col.id === 'VD_OFERTA') {
                            const vdOferta = product.VD_OFERTA;
                            const vdMedia = product.VD_MEDIA;
                            const color = vdOferta == null ? 'text-gray-400'
                              : vdOferta >= vdMedia ? 'text-green-600 font-semibold'
                              : 'text-red-600 font-semibold';
                            return <td key={col.id} className={`px-3 py-2.5 text-sm text-right ${color}`}>
                              {vdOferta != null ? formatNumber(vdOferta) : '-'}
                            </td>;
                          }
                          if (col.id === 'CRESC_OFERTA') {
                            const cresc = product.VD_MEDIA > 0 && product.VD_OFERTA != null
                              ? ((product.VD_OFERTA - product.VD_MEDIA) / product.VD_MEDIA) * 100
                              : 0;
                            return <td key={col.id} className={`px-3 py-2.5 text-sm text-right font-semibold ${cresc >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                              {cresc > 0 ? '+' : ''}{formatPercent(cresc)}
                            </td>;
                          }
                          if (col.id === 'CLASSIF_OFERTA') {
                            const cresc = product.VD_MEDIA > 0 && product.VD_OFERTA != null
                              ? ((product.VD_OFERTA - product.VD_MEDIA) / product.VD_MEDIA) * 100
                              : null;
                            const classif = cresc != null ? getOfertaClassif(cresc) : null;
                            return <td key={col.id} className="px-3 py-2.5 text-center">
                              {classif ? (
                                <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-bold border ${classif.color}`}>
                                  {classif.label}
                                </span>
                              ) : (
                                <span className="text-gray-400 text-xs">-</span>
                              )}
                            </td>;
                          }
                          if (col.id === 'CURVA') {
                            return <td key={col.id} className="px-3 py-2.5 text-center">
                              <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-bold ${getCurvaColor(val)}`}>{val}</span>
                            </td>;
                          }
                          if (col.id === 'SECAO') {
                            return <td key={col.id} className="px-3 py-2.5 text-sm text-gray-600 max-w-[120px] truncate" title={val}>{val}</td>;
                          }
                          const formatted = col.format ? col.format(val) : val;
                          return <td key={col.id} className={`px-3 py-2.5 text-sm text-gray-700 ${col.align === 'right' ? 'text-right' : ''}`}>{formatted}</td>;
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200">
                  <div className="text-xs sm:text-sm text-gray-500">
                    {(currentPage - 1) * itemsPerPage + 1}-{Math.min(currentPage * itemsPerPage, filteredProducts.length)} de {filteredProducts.length}
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => setCurrentPage(1)}
                      disabled={currentPage === 1}
                      className="px-2 py-1 text-sm rounded border border-gray-300 disabled:opacity-50 hover:bg-gray-100"
                    >
                      ⏮
                    </button>
                    <button
                      onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                      disabled={currentPage === 1}
                      className="px-2 py-1 text-sm rounded border border-gray-300 disabled:opacity-50 hover:bg-gray-100"
                    >
                      ◀
                    </button>
                    <span className="px-3 py-1 text-sm font-medium">{currentPage}/{totalPages}</span>
                    <button
                      onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                      disabled={currentPage === totalPages}
                      className="px-2 py-1 text-sm rounded border border-gray-300 disabled:opacity-50 hover:bg-gray-100"
                    >
                      ▶
                    </button>
                    <button
                      onClick={() => setCurrentPage(totalPages)}
                      disabled={currentPage === totalPages}
                      className="px-2 py-1 text-sm rounded border border-gray-300 disabled:opacity-50 hover:bg-gray-100"
                    >
                      ⏭
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Empty state */}
          {!loading && filteredProducts.length === 0 && (
            <div className="text-center py-12 text-gray-500">
              <span className="text-4xl mb-4 block">📭</span>
              <p className="text-lg font-medium">Nenhum produto encontrado</p>
              <p className="text-sm">Tente ajustar os filtros</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
