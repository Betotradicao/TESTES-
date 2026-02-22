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

export default function ProgramacaoAtual() {
  const { user, logout } = useAuth();
  const { lojaSelecionada } = useLoja();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // Data
  const [programacoes, setProgramacoes] = useState([]);
  const [produtos, setProdutos] = useState([]);
  const [resumo, setResumo] = useState(null);
  const [loading, setLoading] = useState(false);
  const [loadingProdutos, setLoadingProdutos] = useState(false);

  // Filters
  const [selectedProg, setSelectedProg] = useState('0');
  const [filterSecao, setFilterSecao] = useState('');
  const [filterCurva, setFilterCurva] = useState('');
  const [filterFornecedor, setFilterFornecedor] = useState('');
  const [searchText, setSearchText] = useState('');
  const [apenasAtivas, setApenasAtivas] = useState(true);
  const [somenteMesAtual, setSomenteMesAtual] = useState(true);

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

  // Load programacoes (busca todas - o filtro de mes e feito no client)
  useEffect(() => {
    const codLoja = lojaSelecionada || 1;
    setLoading(true);
    api.get(`/api/ofertas/programacoes?codLoja=${codLoja}&ativas=${apenasAtivas}`)
      .then(res => {
        setProgramacoes(res.data || []);
        // A selecao sera ajustada pelo useEffect de programacoesFiltradas
      })
      .catch(err => {
        console.error('Erro ao carregar programacoes:', err);
        setProgramacoes([]);
      })
      .finally(() => setLoading(false));
  }, [lojaSelecionada, apenasAtivas]);

  // Load produtos when programacao changes
  useEffect(() => {
    if (!selectedProg) return;
    const codLoja = lojaSelecionada || 1;
    const mesParam = somenteMesAtual ? '&mesAtual=true' : '';
    setLoadingProdutos(true);
    api.get(`/api/ofertas/produtos/${selectedProg}?codLoja=${codLoja}${mesParam}`)
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
      .finally(() => setLoadingProdutos(false));
  }, [selectedProg, lojaSelecionada, somenteMesAtual]);

  // Filter options
  const filterOptions = useMemo(() => {
    const secoes = [...new Set(produtos.map(p => p.SECAO).filter(Boolean))].sort();
    const curvas = [...new Set(produtos.map(p => p.CURVA).filter(Boolean))].sort();
    const fornecedores = [...new Set(produtos.map(p => p.FORNECEDOR).filter(Boolean))].sort();
    return { secoes, curvas, fornecedores };
  }, [produtos]);

  // Filtered & sorted products
  const filteredProducts = useMemo(() => {
    let result = [...produtos];

    if (filterSecao) result = result.filter(p => p.SECAO === filterSecao);
    if (filterCurva) result = result.filter(p => p.CURVA === filterCurva);
    if (filterFornecedor) result = result.filter(p => p.FORNECEDOR === filterFornecedor);
    if (searchText) {
      const s = searchText.toLowerCase();
      result = result.filter(p =>
        (p.DESCRICAO || '').toLowerCase().includes(s) ||
        (p.COD_BARRAS || '').includes(s) ||
        (p.COD_PRODUTO || '').includes(s)
      );
    }

    // Sort (suporta colunas calculadas)
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
  }, [produtos, filterSecao, filterCurva, filterFornecedor, searchText, sortColumn, sortDirection]);

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

  // Filtrar programacoes por mes atual (client-side)
  const programacoesFiltradas = useMemo(() => {
    if (!somenteMesAtual) return programacoes;
    const agora = new Date();
    const mesAtual = agora.getMonth(); // 0-based
    const anoAtual = agora.getFullYear();
    const primeiroDia = new Date(anoAtual, mesAtual, 1);
    const ultimoDia = new Date(anoAtual, mesAtual + 1, 0);
    return programacoes.filter(p => {
      // Parse DD/MM/YYYY
      const [dI, mI, yI] = (p.DTA_INICIAL || '').split('/').map(Number);
      const [dF, mF, yF] = (p.DTA_FINAL || '').split('/').map(Number);
      if (!dI || !mI || !yI || !dF || !mF || !yF) return false;
      const dtaIni = new Date(yI, mI - 1, dI);
      const dtaFim = new Date(yF, mF - 1, dF);
      // Programacao sobrepoe o mes atual?
      return dtaFim >= primeiroDia && dtaIni <= ultimoDia;
    });
  }, [programacoes, somenteMesAtual]);

  // Quando programacoes filtradas mudam, ajustar selecao
  useEffect(() => {
    // Sempre manter "Todas as programações" como default
    if (selectedProg === '0') return;
    const existeNaLista = programacoesFiltradas.some(p => String(p.COD_PROG) === selectedProg);
    if (!existeNaLista || !selectedProg) {
      setSelectedProg('0');
    }
  }, [programacoesFiltradas]);

  const selectedProgData = selectedProg === '0' ? null : programacoesFiltradas.find(p => String(p.COD_PROG) === selectedProg);

  // Calcular classificacao de um produto
  const getProductClassifId = (product) => {
    const cresc = product.VD_MEDIA > 0 && product.VD_OFERTA != null
      ? ((product.VD_OFERTA - product.VD_MEDIA) / product.VD_MEDIA) * 100
      : null;
    if (cresc == null) return null;
    const classif = getOfertaClassif(cresc);
    return classif ? classif.id : null;
  };

  // Ordem de classificação: Excelente primeiro, Pessima por ultimo
  const CLASSIF_ORDER = { excelente: 0, boa: 1, regular: 2, ruim: 3, pessima: 4 };

  // Agrupar por seção e ordenar por classificação dentro de cada seção
  const groupedBySecao = useMemo(() => {
    const grupos = new Map();
    filteredProducts.forEach(item => {
      const secao = item.SECAO || 'SEM SECAO';
      if (!grupos.has(secao)) {
        grupos.set(secao, []);
      }
      grupos.get(secao).push(item);
    });
    // Ordenar dentro de cada seção por classificação (Excelente→Pessima)
    grupos.forEach((items) => {
      items.sort((a, b) => {
        const classifA = getProductClassifId(a);
        const classifB = getProductClassifId(b);
        const orderA = classifA ? (CLASSIF_ORDER[classifA] ?? 99) : 99;
        const orderB = classifB ? (CLASSIF_ORDER[classifB] ?? 99) : 99;
        return orderA - orderB;
      });
    });
    return grupos;
  }, [filteredProducts, ofertaRanges]);

  // Table columns definition (reordenable via drag & drop)
  const defaultColumns = [
    { id: 'DESCRICAO', label: 'Descricao', align: 'left' },
    { id: 'COD_BARRAS', label: 'EAN', align: 'left' },
    { id: 'RELEVANCIA', label: 'Relev.', align: 'center' },
    { id: 'CUSTO', label: 'Custo', align: 'right', format: formatCurrency },
    { id: 'PRECO_NORMAL', label: 'Preco Normal', align: 'right', format: formatCurrency },
    { id: 'CONC_BARATO', label: 'Conc. Barato', align: 'right', format: formatCurrency },
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
    { id: 'QTD_OFERTAS', label: 'Ofertas', align: 'center' },
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

  // Modal historico
  const [historicoModal, setHistoricoModal] = useState(null);
  const [historico, setHistorico] = useState([]);
  const [loadingHistorico, setLoadingHistorico] = useState(false);

  const openHistorico = async (codProduto, descricao) => {
    setHistoricoModal({ codProduto, descricao });
    setLoadingHistorico(true);
    try {
      const codLoja = lojaSelecionada || 1;
      const res = await api.get(`/api/ofertas/historico-produto/${codProduto}?codLoja=${codLoja}`);
      setHistorico(res.data || []);
    } catch (err) {
      console.error('Erro ao carregar historico:', err);
      setHistorico([]);
    } finally {
      setLoadingHistorico(false);
    }
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
          <h1 className="text-lg font-semibold text-gray-900">Programacao Atual</h1>
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
                <h1 className="text-2xl lg:text-3xl font-bold mb-2">GESTAO DE OFERTAS</h1>
                <p className="text-white/90">
                  Acompanhe as ofertas ativas, margens, estoque e performance dos produtos em promocao
                </p>
              </div>
              <div className="bg-white/20 backdrop-blur-sm rounded-full p-3">
                <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z"/>
                </svg>
              </div>
            </div>
          </div>

          {/* Filtros */}
          <div className="bg-white rounded-lg shadow p-4 mb-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-4">
              {/* Programacao */}
              <div className="sm:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">Programacao</label>
                <select
                  value={selectedProg}
                  onChange={(e) => setSelectedProg(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500 text-sm"
                >
                  {programacoesFiltradas.length === 0 && (
                    <option value="">Nenhuma programacao encontrada</option>
                  )}
                  {programacoesFiltradas.length > 0 && (
                    <option value="0">TODAS AS PROGRAMACOES ({programacoesFiltradas.reduce((s, p) => s + (p.TOTAL_PRODUTOS || 0), 0)} itens)</option>
                  )}
                  {programacoesFiltradas.map(p => (
                    <option key={p.COD_PROG} value={String(p.COD_PROG)}>
                      {p.DES_PROGRAMACAO} ({p.DTA_INICIAL} {p.HOR_INICIO}h - {p.DTA_FINAL} {p.HOR_FINAL}h) [{p.TOTAL_PRODUTOS} itens]
                    </option>
                  ))}
                </select>
              </div>

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

              {/* Curva */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Curva</label>
                <select
                  value={filterCurva}
                  onChange={(e) => { setFilterCurva(e.target.value); setCurrentPage(1); }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500 text-sm"
                >
                  <option value="">Todas</option>
                  {filterOptions.curvas.map(c => (
                    <option key={c} value={c}>{c}</option>
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
              <div>
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

            {/* Toggle ativas + mes atual */}
            <div className="mt-3 flex flex-wrap items-center gap-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={apenasAtivas}
                  onChange={(e) => setApenasAtivas(e.target.checked)}
                  className="w-4 h-4 text-orange-500 border-gray-300 rounded focus:ring-orange-500"
                />
                <span className="text-sm text-gray-600">Apenas ofertas ativas</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={somenteMesAtual}
                  onChange={(e) => setSomenteMesAtual(e.target.checked)}
                  className="w-4 h-4 text-orange-500 border-gray-300 rounded focus:ring-orange-500"
                />
                <span className="text-sm text-gray-600">Somente do mes atual</span>
              </label>
              {selectedProgData && (
                <span className="text-xs text-gray-500">
                  Vigencia: {selectedProgData.DTA_INICIAL} {selectedProgData.HOR_INICIO}h a {selectedProgData.DTA_FINAL} {selectedProgData.HOR_FINAL}h
                </span>
              )}
              {selectedProg === '0' && (
                <span className="text-xs text-purple-600 font-medium">
                  Exibindo todas as programacoes {somenteMesAtual ? 'do mes atual' : ''} combinadas
                </span>
              )}
            </div>
          </div>

          {/* Cards Resumo */}
          {resumo && (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4 mb-6">
              {/* Total Produtos */}
              <div className="bg-white rounded-lg shadow p-3 sm:p-4 border-l-4 border-blue-500">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xl sm:text-2xl">📦</span>
                  <span className="text-xl sm:text-2xl font-bold text-blue-600">{resumo.totalProdutos}</span>
                </div>
                <p className="text-xs sm:text-sm font-medium text-gray-700">Total Produtos</p>
              </div>

              {/* Estoque Zerado */}
              <div className="bg-white rounded-lg shadow p-3 sm:p-4 border-l-4 border-red-500">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xl sm:text-2xl">🚫</span>
                  <span className="text-xl sm:text-2xl font-bold text-red-600">{resumo.estZerado}</span>
                </div>
                <p className="text-xs sm:text-sm font-medium text-gray-700">Est. Zerado</p>
                <p className="text-[10px] sm:text-xs text-red-500">
                  {resumo.totalProdutos > 0 ? ((resumo.estZerado / resumo.totalProdutos) * 100).toFixed(1) : 0}% do total
                </p>
              </div>

              {/* Margem Oferta */}
              <div className="bg-white rounded-lg shadow p-3 sm:p-4 border-l-4 border-orange-500">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xl sm:text-2xl">🏷️</span>
                  <span className={`text-xl sm:text-2xl font-bold ${getMargemColor(resumo.margemMediaOferta)}`}>
                    {formatPercent(resumo.margemMediaOferta)}
                  </span>
                </div>
                <p className="text-xs sm:text-sm font-medium text-gray-700">Mg Media Oferta</p>
              </div>

              {/* Margem Normal */}
              <div className="bg-white rounded-lg shadow p-3 sm:p-4 border-l-4 border-green-500">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xl sm:text-2xl">💰</span>
                  <span className={`text-xl sm:text-2xl font-bold ${getMargemColor(resumo.margemMediaNormal)}`}>
                    {formatPercent(resumo.margemMediaNormal)}
                  </span>
                </div>
                <p className="text-xs sm:text-sm font-medium text-gray-700">Mg Media Normal</p>
              </div>

              {/* Vendas em Oferta */}
              <div className="bg-white rounded-lg shadow p-3 sm:p-4 border-l-4 border-purple-500">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xl sm:text-2xl">📊</span>
                  <span className="text-lg sm:text-xl font-bold text-purple-600">
                    {formatPercent(resumo.pctVendasOferta)}
                  </span>
                </div>
                <p className="text-xs sm:text-sm font-medium text-gray-700">Vendas em Oferta</p>
                <p className="text-[10px] sm:text-xs text-purple-500">
                  {formatCurrency(resumo.vendasOferta)} | MKD: {formatPercent(resumo.markdownOferta)}
                </p>
              </div>

              {/* Diferenca Margem */}
              <div className="bg-white rounded-lg shadow p-3 sm:p-4 border-l-4 border-amber-500">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xl sm:text-2xl">📉</span>
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
              {(filterSecao || filterCurva || filterFornecedor || searchText) && (
                <button
                  onClick={() => { setFilterSecao(''); setFilterCurva(''); setFilterFornecedor(''); setSearchText(''); setCurrentPage(1); }}
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
          {(loading || loadingProdutos) && (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-orange-500"></div>
              <span className="ml-3 text-gray-600">Carregando...</span>
            </div>
          )}

          {/* Table - agrupado por seção */}
          {!loading && !loadingProdutos && filteredProducts.length > 0 && (
            <div className="bg-white rounded-lg shadow overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-100 sticky top-0">
                    <tr>
                      <th className="px-3 py-3 text-xs font-semibold text-gray-500 text-center w-8">#</th>
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
                    {(() => {
                      let globalIdx = 0;
                      const rows = [];
                      groupedBySecao.forEach((itensSecao, secaoNome) => {
                        // Barra laranja da seção
                        rows.push(
                          <tr key={`secao-${secaoNome}`}>
                            <td colSpan={columns.length + 1} className="px-0 py-0">
                              <div className="bg-gradient-to-r from-orange-500 to-orange-400 px-4 py-2 flex items-center gap-3">
                                <span className="text-white font-bold text-xs uppercase tracking-wide">{secaoNome}</span>
                                <span className="text-orange-100 text-[10px] font-medium">{itensSecao.length} {itensSecao.length === 1 ? 'item' : 'itens'}</span>
                              </div>
                            </td>
                          </tr>
                        );
                        // Mini-header por seção
                        rows.push(
                          <tr key={`header-${secaoNome}`} className="bg-gray-100">
                            <th className="px-3 py-2 text-[10px] font-semibold text-gray-500 text-center w-8">#</th>
                            {columns.map(col => (
                              <th
                                key={col.id}
                                onClick={() => handleSort(col.id)}
                                className={`px-3 py-2 text-[10px] font-semibold cursor-pointer hover:bg-gray-200 whitespace-nowrap select-none ${
                                  col.id === 'MARGEM_OFERTA' ? 'bg-purple-100 text-purple-800' : 'text-gray-600'
                                } ${
                                  col.align === 'right' ? 'text-right' : col.align === 'center' ? 'text-center' : 'text-left'
                                }`}
                              >
                                {col.label}
                                {sortColumn === col.id && (
                                  <span className="ml-1">{sortDirection === 'asc' ? '\u2191' : '\u2193'}</span>
                                )}
                              </th>
                            ))}
                          </tr>
                        );
                        // Itens da seção
                        itensSecao.forEach((product, localIdx) => {
                          globalIdx++;
                          rows.push(
                            <tr
                              key={`${product.COD_PRODUTO}-${globalIdx}`}
                              className={`border-b border-gray-100 hover:bg-orange-50/50 transition-colors ${localIdx % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}`}
                            >
                              <td className="px-3 py-2 text-gray-400 text-xs text-center">{globalIdx}</td>
                              {columns.map(col => {
                                const val = product[col.id];
                                if (col.id === 'DESCRICAO') {
                                  return <td key={col.id} className="px-3 py-2.5 text-sm text-gray-900 whitespace-nowrap">{val}</td>;
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
                                if (col.id === 'CONC_BARATO') {
                                  const concPreco = product.CONC_BARATO || 0;
                                  const concNome = product.CONC_NOME || '';
                                  const meuPreco = product.PRECO_NORMAL || product.PRECO_VENDA || 0;
                                  return <td key={col.id} className="px-3 py-2.5 text-sm text-right" title={concNome || 'Sem concorrente'}>
                                    {concPreco > 0 ? (
                                      <span className={`font-semibold ${meuPreco <= concPreco ? 'text-green-600' : 'text-red-600'}`}>
                                        {formatCurrency(concPreco)}
                                      </span>
                                    ) : (
                                      <span className="text-gray-400">-</span>
                                    )}
                                  </td>;
                                }
                                if (col.id === 'QTD_OFERTAS') {
                                  const qtd = Number(product.QTD_OFERTAS) || 0;
                                  return <td key={col.id} className="px-3 py-2.5 text-center">
                                    <button
                                      onClick={() => openHistorico(product.COD_PRODUTO, product.DESCRICAO)}
                                      className={`inline-flex items-center gap-1 px-2 py-1 rounded-md border text-xs font-bold transition-colors ${
                                        qtd > 0
                                          ? 'bg-orange-50 border-orange-200 text-orange-700 hover:bg-orange-100'
                                          : 'bg-gray-50 border-gray-200 text-gray-500 hover:bg-gray-100'
                                      }`}
                                      title="Ver historico de ofertas"
                                    >
                                      {qtd}x
                                    </button>
                                  </td>;
                                }
                                const formatted = col.format ? col.format(val) : val;
                                return <td key={col.id} className={`px-3 py-2.5 text-sm text-gray-700 ${col.align === 'right' ? 'text-right' : ''}`}>{formatted}</td>;
                              })}
                            </tr>
                          );
                        });
                      });
                      return rows;
                    })()}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Empty state */}
          {!loading && !loadingProdutos && filteredProducts.length === 0 && selectedProg && (
            <div className="text-center py-12 text-gray-500">
              <span className="text-4xl mb-4 block">📭</span>
              <p className="text-lg font-medium">Nenhum produto encontrado</p>
              <p className="text-sm">Tente ajustar os filtros ou selecionar outra programacao</p>
            </div>
          )}

          {!loading && programacoes.length === 0 && (
            <div className="text-center py-12 text-gray-500">
              <span className="text-4xl mb-4 block">📋</span>
              <p className="text-lg font-medium">Nenhuma programacao {apenasAtivas ? 'ativa' : ''} encontrada</p>
              <p className="text-sm">Verifique se existem ofertas cadastradas no ERP</p>
            </div>
          )}
        </div>
      </div>

      {/* Modal Historico */}
      {historicoModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setHistoricoModal(null)}>
          <div className="bg-white rounded-xl shadow-2xl max-w-3xl w-full max-h-[80vh] overflow-auto" onClick={e => e.stopPropagation()}>
            <div className="sticky top-0 bg-white border-b px-6 py-4 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-lg text-gray-900">Historico de Ofertas</h3>
                <p className="text-sm text-gray-500 mt-0.5">{historicoModal.descricao} (Cod: {historicoModal.codProduto})</p>
              </div>
              <button onClick={() => setHistoricoModal(null)} className="text-gray-400 hover:text-gray-600 text-2xl font-bold">&times;</button>
            </div>
            <div className="p-6">
              {loadingHistorico ? (
                <div className="text-center py-8">
                  <div className="inline-block w-8 h-8 border-4 border-orange-300 border-t-orange-600 rounded-full animate-spin"></div>
                  <p className="mt-3 text-gray-600">Carregando historico...</p>
                </div>
              ) : historico.length === 0 ? (
                <p className="text-center py-8 text-gray-500">Nenhuma oferta encontrada para este produto</p>
              ) : (
                <table className="w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600">Programacao</th>
                      <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600">Periodo</th>
                      <th className="px-3 py-2 text-right text-xs font-semibold text-gray-600">Preco Oferta</th>
                      <th className="px-3 py-2 text-right text-xs font-semibold text-gray-600">% Desc.</th>
                    </tr>
                  </thead>
                  <tbody>
                    {historico.map((h, i) => (
                      <tr key={i} className={`border-b ${i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}`}>
                        <td className="px-3 py-2 text-gray-800">{h.DES_PROGRAMACAO || '-'}</td>
                        <td className="px-3 py-2 text-gray-600">{h.DTA_INICIAL || ''} - {h.DTA_FINAL || ''}</td>
                        <td className="px-3 py-2 text-right font-semibold text-orange-600">{formatCurrency(h.PRECO_OFERTA)}</td>
                        <td className="px-3 py-2 text-right text-gray-700">{formatPercent(h.DESC_PCT)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
