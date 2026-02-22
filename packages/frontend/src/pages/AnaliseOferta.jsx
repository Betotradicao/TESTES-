import { useState, useEffect, useMemo, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useLoja } from '../contexts/LojaContext';
import Sidebar from '../components/Sidebar';
import { api } from '../utils/api';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

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

export default function AnaliseOferta({ defaultTab }) {
  const { user, logout } = useAuth();
  const { lojaSelecionada } = useLoja();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // Data
  const [produtos, setProdutos] = useState([]);
  const [resumo, setResumo] = useState(null);
  const [loading, setLoading] = useState(false);

  // Abas
  const [activeTab, setActiveTab] = useState(defaultTab || 'analise');
  const [excedidoData, setExcedidoData] = useState([]);
  const [excedidoLoading, setExcedidoLoading] = useState(false);
  const [excedidoLoaded, setExcedidoLoaded] = useState(false);

  // Filtros Aba 2
  const [excTipoEspecie, setExcTipoEspecie] = useState('0');
  const [excTipoEvento, setExcTipoEvento] = useState('0');

  // Aba 3: Nova Oferta (produtos selecionados)
  const [selectedProducts, setSelectedProducts] = useState(new Map()); // Map<COD_PRODUTO, produto>
  const [ofertaPrecos, setOfertaPrecos] = useState({}); // { COD_PRODUTO: { rebaixo, club, leveMais } }
  const [savingOfertas, setSavingOfertas] = useState(false);
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [nomeOferta, setNomeOferta] = useState('');
  const [vigenciaInicio, setVigenciaInicio] = useState('');
  const [vigenciaFim, setVigenciaFim] = useState('');

  // Aba 4: controle de oferta expandida
  const [expandedOferta, setExpandedOferta] = useState(null);

  // Aba 3: Colunas arrastáveis
  const [ofertaTab3Cols, setOfertaTab3Cols] = useState([
    { id: 'EAN', label: 'EAN', align: 'left' },
    { id: 'DESCRICAO', label: 'Descricao', align: 'left' },
    { id: 'ESTOQUE', label: 'Estoque', align: 'right' },
    { id: 'CURVA', label: 'Curva', align: 'center' },
    { id: 'CLASSIF', label: 'Classif.', align: 'center' },
    { id: 'RELEV', label: 'Relev.', align: 'center' },
    { id: 'OFERTAS', label: 'Ofertas', align: 'center' },
    { id: 'CUSTO', label: 'Custo', align: 'right' },
    { id: 'PRECO_ATUAL', label: 'Preco Atual', align: 'right' },
    { id: 'CONC_BARATO', label: 'Conc. Barato', align: 'right' },
    { id: 'MARGEM_ATUAL', label: 'Margem Atual', align: 'right' },
    { id: 'REBAIXO_PRECO', label: 'Preco Rebaixo', align: 'right', headerClass: 'bg-orange-50 text-orange-700', pair: 'REBAIXO_MG' },
    { id: 'REBAIXO_MG', label: 'Mg Rebaixo', align: 'right', headerClass: 'bg-orange-50 text-orange-700', pair: 'REBAIXO_PRECO' },
    { id: 'CLUB_PRECO', label: 'Preco Club', align: 'right', headerClass: 'bg-blue-50 text-blue-700', pair: 'CLUB_MG' },
    { id: 'CLUB_MG', label: 'Mg Club', align: 'right', headerClass: 'bg-blue-50 text-blue-700', pair: 'CLUB_PRECO' },
    { id: 'LEVE_QTD', label: 'Leve', align: 'center', headerClass: 'bg-purple-50 text-purple-700', group: 'LEVE' },
    { id: 'LEVE_PRECO', label: 'Preco Leve+', align: 'right', headerClass: 'bg-purple-50 text-purple-700', group: 'LEVE' },
    { id: 'LEVE_MG', label: 'Mg Leve+', align: 'right', headerClass: 'bg-purple-50 text-purple-700', group: 'LEVE' },
  ]);
  const [dragOferCol, setDragOferCol] = useState(null);

  // Aba 4: Sugestoes Salvas
  const [sugestoesSalvas, setSugestoesSalvas] = useState([]);
  const [sugestoesLoading, setSugestoesLoading] = useState(false);
  const [sugestoesLoaded, setSugestoesLoaded] = useState(false);

  // Modal historico
  const [historicoModal, setHistoricoModal] = useState(null); // { codProduto, descricao }
  const [historico, setHistorico] = useState([]);
  const [loadingHistorico, setLoadingHistorico] = useState(false);

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

  // Sort - default: classificacao (Excelente primeiro, descendo ate Pessima)
  const [sortColumn, setSortColumn] = useState('CLASSIF_OFERTA');
  const [sortDirection, setSortDirection] = useState('desc');

  // Page reset helper (kept for filter changes)
  const [currentPage, setCurrentPage] = useState(1);

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
    grupos.forEach((items, secao) => {
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
    { id: 'TICKET_MEDIO', label: 'Ticket Medio', align: 'right', format: formatCurrency },
    { id: 'CURVA', label: 'Curva', align: 'center' },
    { id: 'QTD_OFERTAS', label: 'Ofertas', align: 'center' },
  ];
  const COL_VERSION = 'v3'; // incrementar ao mudar defaultColumns
  const [columns, setColumns] = useState(() => {
    try {
      const savedVer = localStorage.getItem('analise_oferta_col_ver');
      if (savedVer === COL_VERSION) {
        const savedOrder = JSON.parse(localStorage.getItem('analise_oferta_col_order'));
        if (savedOrder && Array.isArray(savedOrder)) {
          const reordered = savedOrder
            .map(id => defaultColumns.find(c => c.id === id))
            .filter(Boolean);
          defaultColumns.forEach(c => {
            if (!reordered.find(r => r.id === c.id)) reordered.push(c);
          });
          return reordered;
        }
      } else {
        localStorage.removeItem('analise_oferta_col_order');
        localStorage.setItem('analise_oferta_col_ver', COL_VERSION);
      }
    } catch {}
    return defaultColumns;
  });
  const [dragColIdx, setDragColIdx] = useState(null);

  const updateColumns = (newCols) => {
    setColumns(newCols);
    localStorage.setItem('analise_oferta_col_order', JSON.stringify(newCols.map(c => c.id)));
  };

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

  // Abrir modal de historico
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

  const hasActiveFilters = filterSecao || filterCurvas.length > 0 || filterClassif.length > 0 || filterFornecedor || searchText;

  const clearAllFilters = () => {
    setFilterSecao('');
    setFilterCurvas([]);
    setFilterClassif([]);
    setFilterFornecedor('');
    setSearchText('');
    setCurrentPage(1);
  };

  // === Aba 2: Compra e Venda Excedido ===
  const carregarExcedido = (forceReload = false) => {
    if (excedidoLoaded && !forceReload) return;
    const codLoja = lojaSelecionada || 1;
    setExcedidoLoading(true);
    const params = new URLSearchParams({ codLoja: String(codLoja) });
    if (excTipoEspecie !== 'todos') params.append('tipoEspecie', excTipoEspecie);
    else params.append('tipoEspecie', 'todos');
    if (excTipoEvento !== 'todos') params.append('tipoEvento', excTipoEvento);
    else params.append('tipoEvento', 'todos');
    api.get(`/api/ofertas/compra-venda-excedido?${params.toString()}`)
      .then(res => {
        setExcedidoData(res.data || []);
        setExcedidoLoaded(true);
      })
      .catch(err => {
        console.error('Erro ao carregar excedido:', err);
        setExcedidoData([]);
      })
      .finally(() => setExcedidoLoading(false));
  };

  // Resetar excedido quando muda a loja
  useEffect(() => {
    setExcedidoLoaded(false);
    setExcedidoData([]);
    if (activeTab === 'excedido') {
      setActiveTab('analise');
    }
  }, [lojaSelecionada]);

  // Recarregar quando muda filtro especie/evento (se aba excedido ativa)
  useEffect(() => {
    if (activeTab === 'excedido') {
      setExcedidoLoaded(false);
      carregarExcedido(true);
    } else {
      setExcedidoLoaded(false);
    }
  }, [excTipoEspecie, excTipoEvento]);

  // === Aba 3: Funcoes de selecao e salvar ===
  const toggleProductSelection = (product, origem) => {
    setSelectedProducts(prev => {
      const next = new Map(prev);
      const key = String(product.COD_PRODUTO);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.set(key, { ...product, _origem: origem });
      }
      return next;
    });
  };

  const isProductSelected = (codProduto) => selectedProducts.has(String(codProduto));

  const selectedArray = useMemo(() => [...selectedProducts.values()], [selectedProducts]);

  const groupedSelected = useMemo(() => {
    const grupos = new Map();
    selectedArray.forEach(item => {
      const secao = item.SECAO || item.secao || 'SEM SECAO';
      if (!grupos.has(secao)) grupos.set(secao, []);
      grupos.get(secao).push(item);
    });
    return grupos;
  }, [selectedArray]);

  const updateOfertaPreco = (codProduto, tipo, valor) => {
    setOfertaPrecos(prev => ({
      ...prev,
      [codProduto]: { ...(prev[codProduto] || {}), [tipo]: valor }
    }));
  };

  const calcMargem = (preco, custo) => {
    const p = parseFloat(preco);
    const c = parseFloat(custo);
    if (!p || p <= 0) return null;
    return Math.round(((p - c) / p) * 10000) / 100;
  };

  const salvarSugestoes = async () => {
    if (selectedArray.length === 0) return;
    setSavingOfertas(true);
    try {
      const codLoja = lojaSelecionada || 1;
      const produtosPayload = selectedArray.map(p => {
        const precos = ofertaPrecos[String(p.COD_PRODUTO)] || {};
        return {
          codProduto: p.COD_PRODUTO,
          descricao: p.DESCRICAO || p.descricao || '',
          codBarras: p.COD_BARRAS || p.cod_barras || '',
          secao: p.SECAO || p.secao || '',
          curva: p.CURVA || p.curva || '',
          precoNormal: p.PRECO_VENDA || p.PRECO_NORMAL || 0,
          custo: p.CUSTO || p.CUSTO_UNITARIO || 0,
          precoRebaixo: precos.rebaixo || null,
          precoClub: precos.club || null,
          precoLeveMais: precos.leveMais || null,
          tipoOfertaEscolhido: precos.rebaixo ? 'rebaixo' : precos.club ? 'club' : precos.leveMais ? 'leve_mais' : null,
          origem: p._origem || 'analise',
        };
      });
      await api.post('/api/ofertas/salvar-sugestoes', {
        codLoja,
        produtos: produtosPayload,
        nomeOferta: nomeOferta || null,
        vigenciaInicio: vigenciaInicio || null,
        vigenciaFim: vigenciaFim || null,
      });
      setSelectedProducts(new Map());
      setOfertaPrecos({});
      setShowSaveModal(false);
      setNomeOferta('');
      setVigenciaInicio('');
      setVigenciaFim('');
      setSugestoesLoaded(false);
      setActiveTab('salvas');
      carregarSugestoes(true);
    } catch (err) {
      console.error('Erro ao salvar sugestoes:', err);
      alert('Erro ao salvar sugestoes de oferta');
    } finally {
      setSavingOfertas(false);
    }
  };

  // === Aba 4: Carregar sugestoes salvas ===
  const carregarSugestoes = (forceReload = false) => {
    if (sugestoesLoaded && !forceReload) return;
    const codLoja = lojaSelecionada || 1;
    setSugestoesLoading(true);
    api.get(`/api/ofertas/sugestoes-salvas?codLoja=${codLoja}`)
      .then(res => {
        setSugestoesSalvas(res.data || []);
        setSugestoesLoaded(true);
      })
      .catch(err => {
        console.error('Erro ao carregar sugestoes:', err);
        setSugestoesSalvas([]);
      })
      .finally(() => setSugestoesLoading(false));
  };

  const deleteSugestao = async (id) => {
    try {
      await api.delete(`/api/ofertas/sugestoes-salvas/${id}`);
      setSugestoesSalvas(prev => prev.filter(s => s.id !== id));
    } catch (err) {
      console.error('Erro ao deletar sugestao:', err);
    }
  };

  const deleteOfertaPorNome = async (oferta) => {
    if (!confirm(`Excluir toda a oferta "${oferta.nome}"?`)) return;
    try {
      const codLoja = lojaSelecionada || 1;
      const payload = { codLoja };
      if (oferta.nomeOferta) {
        payload.nomeOferta = oferta.nomeOferta;
      } else {
        payload.itemIds = oferta.items.map(i => i.id);
      }
      await api.post('/api/ofertas/sugestoes-salvas-por-nome/deletar', payload);
      const idsToRemove = new Set(oferta.items.map(i => i.id));
      setSugestoesSalvas(prev => prev.filter(s => !idsToRemove.has(s.id)));
      if (expandedOferta === oferta.nome) setExpandedOferta(null);
    } catch (err) {
      console.error('Erro ao deletar oferta:', err);
    }
  };

  // Agrupar sugestoes salvas por nome_oferta
  const ofertasAgrupadas = useMemo(() => {
    const map = new Map();
    sugestoesSalvas.forEach(item => {
      const key = item.nome_oferta || `Sem nome - ${new Date(item.created_at).toLocaleDateString('pt-BR')}`;
      if (!map.has(key)) {
        map.set(key, {
          nome: key,
          nomeOferta: item.nome_oferta,
          vigenciaInicio: item.vigencia_inicio,
          vigenciaFim: item.vigencia_fim,
          createdAt: item.created_at,
          items: [],
        });
      }
      map.get(key).items.push(item);
    });
    return [...map.values()];
  }, [sugestoesSalvas]);

  // Exportar oferta como PDF
  const exportOfertaPDF = (oferta) => {
    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
    const orange = [234, 88, 12];
    const white = [255, 255, 255];

    // Header
    doc.setFillColor(...orange);
    doc.rect(0, 0, 297, 22, 'F');
    doc.setTextColor(...white);
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text(oferta.nome, 14, 10);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    const vigTxt = oferta.vigenciaInicio && oferta.vigenciaFim
      ? `Vigencia: ${new Date(oferta.vigenciaInicio).toLocaleDateString('pt-BR')} a ${new Date(oferta.vigenciaFim).toLocaleDateString('pt-BR')}`
      : '';
    doc.text(`${vigTxt}  |  ${oferta.items.length} itens  |  ${new Date(oferta.createdAt).toLocaleDateString('pt-BR')}`, 14, 17);

    // Agrupar itens por secao
    const secoes = new Map();
    oferta.items.forEach(item => {
      const sec = item.secao || 'SEM SECAO';
      if (!secoes.has(sec)) secoes.set(sec, []);
      secoes.get(sec).push(item);
    });

    const headers = ['EAN', 'Descricao', 'Curva', 'Custo', 'Preco Normal', 'Margem', 'Rebaixo', 'Mg Reb.', 'Club', 'Mg Club', 'Leve+', 'Mg Leve+'];
    const rows = [];
    const rowStyles = {};
    let rowIdx = 0;

    secoes.forEach((items, secaoNome) => {
      // Linha de secao
      rows.push([secaoNome, '', '', '', '', '', '', '', '', '', '', '']);
      rowStyles[rowIdx] = { fillColor: [251, 146, 60], textColor: white, fontStyle: 'bold' };
      rowIdx++;

      items.forEach(item => {
        const custo = parseFloat(item.custo) || 0;
        const pn = parseFloat(item.preco_normal) || 0;
        const mg = pn > 0 ? ((pn - custo) / pn * 100).toFixed(1) + '%' : '-';
        const mgReb = item.preco_rebaixo ? ((parseFloat(item.preco_rebaixo) - custo) / parseFloat(item.preco_rebaixo) * 100).toFixed(1) + '%' : '-';
        const mgClub = item.preco_club ? ((parseFloat(item.preco_club) - custo) / parseFloat(item.preco_club) * 100).toFixed(1) + '%' : '-';
        const mgLeve = item.preco_leve_mais ? ((parseFloat(item.preco_leve_mais) - custo) / parseFloat(item.preco_leve_mais) * 100).toFixed(1) + '%' : '-';
        rows.push([
          item.cod_barras || '',
          item.descricao || '',
          item.curva || '',
          custo > 0 ? `R$ ${custo.toFixed(2).replace('.', ',')}` : '-',
          pn > 0 ? `R$ ${pn.toFixed(2).replace('.', ',')}` : '-',
          mg,
          item.preco_rebaixo ? `R$ ${parseFloat(item.preco_rebaixo).toFixed(2).replace('.', ',')}` : '-',
          mgReb,
          item.preco_club ? `R$ ${parseFloat(item.preco_club).toFixed(2).replace('.', ',')}` : '-',
          mgClub,
          item.preco_leve_mais ? `R$ ${parseFloat(item.preco_leve_mais).toFixed(2).replace('.', ',')}` : '-',
          mgLeve,
        ]);
        rowIdx++;
      });
    });

    autoTable(doc, {
      head: [headers],
      body: rows,
      startY: 26,
      theme: 'grid',
      styles: { fontSize: 7, cellPadding: 1.5 },
      headStyles: { fillColor: orange, textColor: white, fontStyle: 'bold', fontSize: 7 },
      columnStyles: { 0: { cellWidth: 30 }, 1: { cellWidth: 55 } },
      didParseCell: (data) => {
        if (data.section === 'head' && data.column.index === 6) {
          data.cell.styles.fillColor = [34, 139, 34];
        }
        if (data.section === 'body') {
          const style = rowStyles[data.row.index];
          if (style) {
            if (style.fillColor) data.cell.styles.fillColor = style.fillColor;
            if (style.textColor) data.cell.styles.textColor = style.textColor;
            if (style.fontStyle) data.cell.styles.fontStyle = style.fontStyle;
          } else if (data.column.index === 6) {
            data.cell.styles.fillColor = [220, 252, 231];
          }
          if (data.column.index >= 3) data.cell.styles.halign = 'right';
        }
      },
    });

    const nomeArquivo = oferta.nome.replace(/[^a-zA-Z0-9]/g, '-').substring(0, 40);
    doc.save(`oferta-${nomeArquivo}.pdf`);
  };

  // Mapa de classificação de oferta (cross-reference com Aba 1)
  const classifMap = useMemo(() => {
    const map = new Map();
    produtos.forEach(p => {
      if (p.VD_MEDIA > 0 && p.VD_OFERTA != null) {
        const cresc = ((p.VD_OFERTA - p.VD_MEDIA) / p.VD_MEDIA) * 100;
        const classif = getOfertaClassif(cresc);
        if (classif) map.set(String(p.COD_PRODUTO), classif);
      }
    });
    return map;
  }, [produtos, ofertaRanges]);

  // Sort para aba excedido
  const [excedidoSort, setExcedidoSort] = useState({ col: 'DIF_ANUAL_RS', dir: 'asc' });

  const handleExcedidoSort = (col) => {
    setExcedidoSort(prev =>
      prev.col === col
        ? { col, dir: prev.dir === 'asc' ? 'desc' : 'asc' }
        : { col, dir: 'asc' }
    );
  };

  // Filtrar e agrupar dados excedidos por secao (ordenado por mais estourado)
  const filteredExcedido = useMemo(() => {
    let result = [...excedidoData];
    if (filterSecao) result = result.filter(p => p.SECAO === filterSecao);
    if (filterCurvas.length > 0) result = result.filter(p => filterCurvas.includes(p.CURVA));
    if (filterClassif.length > 0) {
      result = result.filter(p => {
        const classif = classifMap.get(String(p.COD_PRODUTO));
        return classif && filterClassif.includes(classif.id);
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
    // Sort dentro de cada seção
    result.sort((a, b) => {
      let va = a[excedidoSort.col];
      let vb = b[excedidoSort.col];
      if (typeof va === 'string') va = va.toLowerCase();
      if (typeof vb === 'string') vb = vb.toLowerCase();
      if (va < vb) return excedidoSort.dir === 'asc' ? -1 : 1;
      if (va > vb) return excedidoSort.dir === 'asc' ? 1 : -1;
      return 0;
    });
    return result;
  }, [excedidoData, filterSecao, filterCurvas, filterClassif, filterFornecedor, searchText, excedidoSort, classifMap]);

  const groupedExcedido = useMemo(() => {
    // Agrupar por seção
    const grupos = new Map();
    filteredExcedido.forEach(item => {
      const secao = item.SECAO || 'SEM SECAO';
      if (!grupos.has(secao)) grupos.set(secao, []);
      grupos.get(secao).push(item);
    });
    // Ordenar seções pela soma de DIF_ANUAL_RS (mais negativo primeiro)
    const sorted = [...grupos.entries()].sort((a, b) => {
      const somaA = a[1].reduce((s, p) => s + (p.DIF_ANUAL_RS || 0), 0);
      const somaB = b[1].reduce((s, p) => s + (p.DIF_ANUAL_RS || 0), 0);
      return somaA - somaB; // mais negativo primeiro
    });
    return new Map(sorted);
  }, [filteredExcedido]);

  const excedidoColumns = [
    { id: 'COD_BARRAS', label: 'EAN', align: 'left' },
    { id: 'DESCRICAO', label: 'Descricao', align: 'left' },
    { id: 'ESTOQUE_ATUAL', label: 'Estoque', align: 'right' },
    { id: 'DIAS_COBERTURA', label: 'Dias Cob.', align: 'right' },
    { id: 'CURVA', label: 'Curva', align: 'center' },
    { id: 'RELEVANCIA', label: 'Relev.', align: 'center' },
    { id: 'PRECO_VENDA', label: 'Preco Venda', align: 'right' },
    { id: 'CONC_BARATO', label: 'Conc. Barato', align: 'right' },
    { id: 'MARGEM', label: 'Margem', align: 'right' },
    { id: 'COMPRAS', label: 'Compras', align: 'right' },
    { id: 'VENDAS', label: 'Vendas', align: 'right' },
    { id: 'QTD_OFERTAS', label: 'Ofertas', align: 'center' },
    { id: 'CLASSIF_OFERTA', label: 'Classif.', align: 'center' },
    { id: 'DIF_ANUAL_PCT', label: 'Dif Anual (%)', align: 'right' },
    { id: 'DIF_ANUAL_RS', label: 'Dif Anual (R$)', align: 'right' },
  ];

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

          {/* Abas + Info bar */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 mb-4">
            <div className="flex items-center gap-0">
              <button
                onClick={() => setActiveTab('analise')}
                className={`px-4 py-2 text-sm font-semibold border-b-2 transition-colors ${
                  activeTab === 'analise'
                    ? 'border-orange-500 text-orange-700 bg-orange-50'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                } rounded-t-md`}
              >
                Analise Realizada
                <span className={`ml-2 px-2 py-0.5 rounded-full text-xs font-bold ${
                  activeTab === 'analise' ? 'bg-orange-200 text-orange-800' : 'bg-gray-200 text-gray-600'
                }`}>
                  {filteredProducts.length}
                </span>
              </button>
              <button
                onClick={() => { setActiveTab('excedido'); carregarExcedido(); }}
                className={`px-4 py-2 text-sm font-semibold border-b-2 transition-colors ${
                  activeTab === 'excedido'
                    ? 'border-red-500 text-red-700 bg-red-50'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                } rounded-t-md`}
              >
                Compra e Venda Excedido
                <span className={`ml-2 px-2 py-0.5 rounded-full text-xs font-bold ${
                  activeTab === 'excedido' ? 'bg-red-200 text-red-800' : 'bg-gray-200 text-gray-600'
                }`}>
                  {excedidoLoaded ? filteredExcedido.length : '...'}
                </span>
              </button>
              <button
                onClick={() => setActiveTab('nova_oferta')}
                className={`px-4 py-2 text-sm font-semibold border-b-2 transition-colors ${
                  activeTab === 'nova_oferta'
                    ? 'border-green-500 text-green-700 bg-green-50'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                } rounded-t-md`}
              >
                Nova Oferta
                <span className={`ml-2 px-2 py-0.5 rounded-full text-xs font-bold ${
                  activeTab === 'nova_oferta' ? 'bg-green-200 text-green-800' : selectedProducts.size > 0 ? 'bg-green-200 text-green-800' : 'bg-gray-200 text-gray-600'
                }`}>
                  {selectedProducts.size}
                </span>
              </button>
              <button
                onClick={() => { setActiveTab('salvas'); carregarSugestoes(); }}
                className={`px-4 py-2 text-sm font-semibold border-b-2 transition-colors ${
                  activeTab === 'salvas'
                    ? 'border-purple-500 text-purple-700 bg-purple-50'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                } rounded-t-md`}
              >
                Ofertas Salvas
                <span className={`ml-2 px-2 py-0.5 rounded-full text-xs font-bold ${
                  activeTab === 'salvas' ? 'bg-purple-200 text-purple-800' : 'bg-gray-200 text-gray-600'
                }`}>
                  {sugestoesLoaded ? sugestoesSalvas.length : '...'}
                </span>
              </button>
              {activeTab === 'excedido' && (
                <>
                  <select
                    value={excTipoEspecie}
                    onChange={e => setExcTipoEspecie(e.target.value)}
                    className="ml-3 px-2 py-1.5 text-xs border border-gray-300 rounded-md bg-white text-gray-700 focus:ring-1 focus:ring-red-400 focus:border-red-400"
                  >
                    <option value="todos">Especie: Todos</option>
                    <option value="0">Mercadoria</option>
                    <option value="2">Servico</option>
                    <option value="3">Imobilizado</option>
                    <option value="4">Insumo</option>
                  </select>
                  <select
                    value={excTipoEvento}
                    onChange={e => setExcTipoEvento(e.target.value)}
                    className="ml-1 px-2 py-1.5 text-xs border border-gray-300 rounded-md bg-white text-gray-700 focus:ring-1 focus:ring-red-400 focus:border-red-400"
                  >
                    <option value="todos">Evento: Todos</option>
                    <option value="0">Direta</option>
                    <option value="1">Decomposicao</option>
                    <option value="2">Composicao</option>
                    <option value="3">Producao</option>
                  </select>
                </>
              )}
              {hasActiveFilters && (
                <button
                  onClick={clearAllFilters}
                  className="ml-3 text-xs text-orange-500 hover:text-orange-700 underline"
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
          {(activeTab === 'analise' ? loading : excedidoLoading) && (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-orange-500"></div>
              <span className="ml-3 text-gray-600">Carregando...</span>
            </div>
          )}

          {/* === ABA 1: Analise Realizada === */}
          {/* Table - agrupado por seção */}
          {activeTab === 'analise' && !loading && filteredProducts.length > 0 && (
            <div className="bg-white rounded-lg shadow overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-100 sticky top-0">
                    <tr>
                      <th className="px-2 py-3 text-xs font-semibold text-green-700 text-center w-10">Ofertar</th>
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
                            updateColumns(newCols);
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
                            <td colSpan={columns.length + 2} className="px-0 py-0">
                              <div className="bg-gradient-to-r from-orange-500 to-orange-400 px-4 py-2 flex items-center gap-3">
                                <span className="text-white font-bold text-xs uppercase tracking-wide">{secaoNome}</span>
                                <span className="text-orange-100 text-[10px] font-medium">{itensSecao.length} {itensSecao.length === 1 ? 'item' : 'itens'}</span>
                              </div>
                            </td>
                          </tr>
                        );
                        // Repetir cabeçalho das colunas em cada seção
                        rows.push(
                          <tr key={`header-${secaoNome}`} className="bg-gray-100">
                            <th className="px-2 py-2 text-[10px] font-semibold text-green-700 text-center w-10"></th>
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
                              <td className="px-2 py-2 text-center">
                                <input
                                  type="checkbox"
                                  checked={isProductSelected(product.COD_PRODUTO)}
                                  onChange={() => toggleProductSelection(product, 'analise')}
                                  className="w-4 h-4 rounded border-gray-300 text-green-600 focus:ring-green-500 cursor-pointer"
                                />
                              </td>
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
                                if (col.id === 'QTD_OFERTAS') {
                                  const qtd = product.QTD_OFERTAS || 0;
                                  return (
                                    <td key={col.id} className="px-3 py-2.5 text-center">
                                      <button
                                        onClick={() => openHistorico(product.COD_PRODUTO, product.DESCRICAO)}
                                        className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-orange-50 border border-orange-200 text-orange-700 hover:bg-orange-100 transition-colors text-xs font-bold"
                                        title="Ver historico de ofertas"
                                      >
                                        {qtd}x
                                      </button>
                                    </td>
                                  );
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

          {/* Empty state - Aba 1 */}
          {activeTab === 'analise' && !loading && filteredProducts.length === 0 && (
            <div className="text-center py-12 text-gray-500">
              <span className="text-4xl mb-4 block">📭</span>
              <p className="text-lg font-medium">Nenhum produto encontrado</p>
              <p className="text-sm">Tente ajustar os filtros</p>
            </div>
          )}

          {/* === ABA 2: Compra e Venda Excedido === */}
          {activeTab === 'excedido' && !excedidoLoading && filteredExcedido.length > 0 && (
            <div className="bg-white rounded-lg shadow overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-100 sticky top-0">
                    <tr>
                      <th className="px-2 py-3 text-xs font-semibold text-green-700 text-center w-10">Ofertar</th>
                      <th className="px-3 py-3 text-xs font-semibold text-gray-500 text-center w-8">#</th>
                      {excedidoColumns.map(col => (
                        <th
                          key={col.id}
                          onClick={() => handleExcedidoSort(col.id)}
                          className={`px-3 py-3 text-xs font-semibold cursor-pointer hover:bg-gray-200 transition-colors whitespace-nowrap select-none ${
                            col.id === 'DIF_ANUAL_RS' || col.id === 'DIF_ANUAL_PCT' ? 'bg-red-50 text-red-700 hover:bg-red-100' : 'text-gray-700'
                          } ${
                            col.align === 'right' ? 'text-right' : col.align === 'center' ? 'text-center' : 'text-left'
                          }`}
                        >
                          {col.label}
                          {excedidoSort.col === col.id && (
                            <span className="ml-1">{excedidoSort.dir === 'asc' ? '\u2191' : '\u2193'}</span>
                          )}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {(() => {
                      let globalIdx = 0;
                      const rows = [];
                      groupedExcedido.forEach((itensSecao, secaoNome) => {
                        const somaSecao = itensSecao.reduce((s, p) => s + (p.DIF_ANUAL_RS || 0), 0);
                        // Barra laranja da seção com total
                        rows.push(
                          <tr key={`exc-secao-${secaoNome}`}>
                            <td colSpan={excedidoColumns.length + 2} className="px-0 py-0">
                              <div className="bg-gradient-to-r from-red-600 to-red-500 px-4 py-2 flex items-center gap-3">
                                <span className="text-white font-bold text-xs uppercase tracking-wide">{secaoNome}</span>
                                <span className="text-red-100 text-[10px] font-medium">{itensSecao.length} {itensSecao.length === 1 ? 'item' : 'itens'}</span>
                                <span className="ml-auto text-white font-bold text-xs">
                                  Dif Anual: {formatCurrency(somaSecao)}
                                </span>
                              </div>
                            </td>
                          </tr>
                        );
                        // Mini-header de colunas
                        rows.push(
                          <tr key={`exc-header-${secaoNome}`} className="bg-gray-100">
                            <th className="px-2 py-2 text-[10px] font-semibold text-green-700 text-center w-10"></th>
                            <th className="px-3 py-2 text-[10px] font-semibold text-gray-500 text-center w-8">#</th>
                            {excedidoColumns.map(col => (
                              <th
                                key={col.id}
                                onClick={() => handleExcedidoSort(col.id)}
                                className={`px-3 py-2 text-[10px] font-semibold cursor-pointer hover:bg-gray-200 whitespace-nowrap select-none ${
                                  col.id === 'DIF_ANUAL_RS' || col.id === 'DIF_ANUAL_PCT' ? 'bg-red-50 text-red-700' : 'text-gray-600'
                                } ${
                                  col.align === 'right' ? 'text-right' : col.align === 'center' ? 'text-center' : 'text-left'
                                }`}
                              >
                                {col.label}
                                {excedidoSort.col === col.id && (
                                  <span className="ml-1">{excedidoSort.dir === 'asc' ? '\u2191' : '\u2193'}</span>
                                )}
                              </th>
                            ))}
                          </tr>
                        );
                        // Produtos
                        itensSecao.forEach((product, localIdx) => {
                          globalIdx++;
                          rows.push(
                            <tr
                              key={`exc-${product.COD_PRODUTO}-${globalIdx}`}
                              className={`border-b border-gray-100 hover:bg-red-50/50 transition-colors ${localIdx % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}`}
                            >
                              <td className="px-2 py-2 text-center">
                                <input
                                  type="checkbox"
                                  checked={isProductSelected(product.COD_PRODUTO)}
                                  onChange={() => toggleProductSelection(product, 'compra_venda')}
                                  className="w-4 h-4 rounded border-gray-300 text-green-600 focus:ring-green-500 cursor-pointer"
                                />
                              </td>
                              <td className="px-3 py-2 text-gray-400 text-xs text-center">{globalIdx}</td>
                              {excedidoColumns.map(col => {
                                const val = product[col.id];
                                if (col.id === 'DESCRICAO') {
                                  return <td key={col.id} className="px-3 py-2.5 text-sm text-gray-900 whitespace-nowrap">{val}</td>;
                                }
                                if (col.id === 'COD_BARRAS') {
                                  return <td key={col.id} className="px-3 py-2.5 text-sm text-gray-600 font-mono">{val}</td>;
                                }
                                if (col.id === 'ESTOQUE_ATUAL') {
                                  return <td key={col.id} className={`px-3 py-2.5 text-sm text-right ${getEstoqueColor(val)}`}>{formatNumber(val)}</td>;
                                }
                                if (col.id === 'DIAS_COBERTURA') {
                                  return <td key={col.id} className={`px-3 py-2.5 text-sm text-right ${val <= 0 ? 'text-red-600 font-semibold' : val < 3 ? 'text-orange-600' : 'text-gray-700'}`}>
                                    {val != null ? Number(val).toFixed(1).replace('.', ',') : '0'}
                                  </td>;
                                }
                                if (col.id === 'CURVA') {
                                  return <td key={col.id} className="px-3 py-2.5 text-center">
                                    <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-bold ${getCurvaColor(val)}`}>{val}</span>
                                  </td>;
                                }
                                if (col.id === 'RELEVANCIA') {
                                  return <td key={col.id} className="px-3 py-2.5 text-center">
                                    <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-bold ${getRelevanciaColor(val)}`}>{val || '-'}</span>
                                  </td>;
                                }
                                if (col.id === 'PRECO_VENDA') {
                                  return <td key={col.id} className="px-3 py-2.5 text-sm text-right text-gray-700">{formatCurrency(val)}</td>;
                                }
                                if (col.id === 'MARGEM') {
                                  return <td key={col.id} className={`px-3 py-2.5 text-sm text-right font-semibold ${val < 0 ? 'text-red-600' : val < 5 ? 'text-orange-600' : 'text-green-600'}`}>
                                    {formatPercent(val)}
                                  </td>;
                                }
                                if (col.id === 'COMPRAS' || col.id === 'VENDAS') {
                                  return <td key={col.id} className="px-3 py-2.5 text-sm text-right text-gray-700">{formatCurrency(val)}</td>;
                                }
                                if (col.id === 'QTD_OFERTAS') {
                                  const qtd = product.QTD_OFERTAS || 0;
                                  return <td key={col.id} className="px-3 py-2.5 text-center">
                                    <button
                                      onClick={() => openHistorico(product.COD_PRODUTO, product.DESCRICAO)}
                                      className={`inline-flex items-center gap-1 px-2 py-1 rounded-md border text-xs font-bold transition-colors ${qtd > 0 ? 'bg-orange-50 border-orange-200 text-orange-700 hover:bg-orange-100' : 'bg-gray-50 border-gray-200 text-gray-500 hover:bg-gray-100'}`}
                                      title="Ver historico de ofertas"
                                    >
                                      {qtd}x
                                    </button>
                                  </td>;
                                }
                                if (col.id === 'CLASSIF_OFERTA') {
                                  const classif = classifMap.get(String(product.COD_PRODUTO));
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
                                if (col.id === 'CONC_BARATO') {
                                  const concPreco = product.CONC_BARATO || 0;
                                  const concNome = product.CONC_NOME || '';
                                  const meuPreco = product.PRECO_VENDA || 0;
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
                                if (col.id === 'DIF_ANUAL_PCT') {
                                  return <td key={col.id} className={`px-3 py-2.5 text-sm text-right font-semibold ${val < 0 ? 'text-red-600' : 'text-green-600'}`}>
                                    {val > 0 ? '+' : ''}{formatPercent(val)}
                                  </td>;
                                }
                                if (col.id === 'DIF_ANUAL_RS') {
                                  return <td key={col.id} className={`px-3 py-2.5 text-sm text-right font-semibold ${val < 0 ? 'text-red-600' : 'text-green-600'}`}>
                                    {formatCurrency(val)}
                                  </td>;
                                }
                                return <td key={col.id} className={`px-3 py-2.5 text-sm text-gray-700 ${col.align === 'right' ? 'text-right' : ''}`}>{val}</td>;
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

          {/* Empty state - Aba 2 */}
          {activeTab === 'excedido' && !excedidoLoading && filteredExcedido.length === 0 && excedidoLoaded && (
            <div className="text-center py-12 text-gray-500">
              <span className="text-4xl mb-4 block">✅</span>
              <p className="text-lg font-medium">Nenhum produto excedido</p>
              <p className="text-sm">Todos os produtos estao dentro do limite de compra e venda</p>
            </div>
          )}

          {/* === ABA 3: Nova Oferta === */}
          {activeTab === 'nova_oferta' && selectedArray.length > 0 && (
            <div>
              {/* Botao Salvar */}
              <div className="flex items-center justify-between mb-4">
                <p className="text-sm text-gray-600">{selectedArray.length} produto{selectedArray.length !== 1 ? 's' : ''} selecionado{selectedArray.length !== 1 ? 's' : ''} para sugestao de oferta</p>
                <div className="flex gap-2">
                  <button
                    onClick={() => { setSelectedProducts(new Map()); setOfertaPrecos({}); }}
                    className="px-4 py-2 text-sm font-semibold text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                  >
                    Limpar Selecao
                  </button>
                  <button
                    onClick={() => setShowSaveModal(true)}
                    disabled={savingOfertas}
                    className="px-6 py-2 text-sm font-bold text-white bg-orange-600 hover:bg-orange-700 disabled:opacity-50 rounded-lg shadow transition-colors"
                  >
                    {savingOfertas ? 'Salvando...' : 'Salvar Sugestoes'}
                  </button>
                </div>
              </div>

              <div className="bg-white rounded-lg shadow overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-100 sticky top-0">
                      <tr>
                        <th className="px-3 py-3 text-xs font-semibold text-gray-500 text-center w-8">#</th>
                        {/* Colunas arrastáveis da Aba 3 */}
                        {(ofertaTab3Cols).map((col, colIdx) => (
                          <th
                            key={col.id}
                            draggable
                            onDragStart={() => setDragOferCol(colIdx)}
                            onDragOver={(e) => e.preventDefault()}
                            onDrop={() => {
                              if (dragOferCol === null || dragOferCol === colIdx) return;
                              setOfertaTab3Cols(prev => {
                                const newCols = [...prev];
                                const [moved] = newCols.splice(dragOferCol, 1);
                                // Se for par (preco+margem), arrastar os dois juntos
                                if (moved.pair) {
                                  const pairIdx = newCols.findIndex(c => c.id === moved.pair);
                                  if (pairIdx >= 0) {
                                    const [pairCol] = newCols.splice(pairIdx, 1);
                                    const insertAt = Math.min(colIdx, newCols.length);
                                    newCols.splice(insertAt, 0, moved, pairCol);
                                  } else {
                                    newCols.splice(colIdx, 0, moved);
                                  }
                                } else {
                                  newCols.splice(colIdx, 0, moved);
                                }
                                return newCols;
                              });
                              setDragOferCol(null);
                            }}
                            className={`px-3 py-3 text-xs font-semibold cursor-grab whitespace-nowrap select-none ${col.headerClass || 'text-gray-700'} ${
                              col.align === 'right' ? 'text-right' : col.align === 'center' ? 'text-center' : 'text-left'
                            }`}
                            title="Arraste para reordenar"
                          >
                            {col.label}
                          </th>
                        ))}
                        <th className="px-3 py-3 text-xs font-semibold text-gray-500 text-center w-10">X</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(() => {
                        let globalIdx = 0;
                        const rows = [];
                        groupedSelected.forEach((itensSecao, secaoNome) => {
                          rows.push(
                            <tr key={`sel-secao-${secaoNome}`}>
                              <td colSpan={ofertaTab3Cols.length + 2} className="px-0 py-0">
                                <div className="bg-gradient-to-r from-orange-600 to-orange-500 px-4 py-2 flex items-center gap-3">
                                  <span className="text-white font-bold text-xs uppercase tracking-wide">{secaoNome}</span>
                                  <span className="text-orange-100 text-[10px] font-medium">{itensSecao.length} {itensSecao.length === 1 ? 'item' : 'itens'}</span>
                                </div>
                              </td>
                            </tr>
                          );
                          itensSecao.forEach((product, localIdx) => {
                            globalIdx++;
                            const codProd = String(product.COD_PRODUTO);
                            const precos = ofertaPrecos[codProd] || {};
                            const custo = product.CUSTO || product.CUSTO_UNITARIO || 0;
                            const precoAtual = product.PRECO_VENDA || product.PRECO_NORMAL || 0;
                            // Usar MARGEM_NORMAL do backend se disponivel, senão calcular
                            const margemAtual = product.MARGEM_NORMAL != null ? product.MARGEM_NORMAL
                              : (product.MARGEM != null ? product.MARGEM
                              : (precoAtual > 0 && custo > 0 ? ((precoAtual - custo) / precoAtual) * 100 : 0));
                            const mgRebaixo = calcMargem(precos.rebaixo, custo);
                            const mgClub = calcMargem(precos.club, custo);
                            const mgLeveMais = calcMargem(precos.leveMais, custo);
                            const concPreco = product.CONC_BARATO || 0;
                            const classif = classifMap.get(codProd);

                            const cellRenderers = {
                              EAN: () => <td key="EAN" className="px-3 py-2 text-sm text-gray-600 font-mono">{product.COD_BARRAS || product.cod_barras || ''}</td>,
                              DESCRICAO: () => <td key="DESCRICAO" className="px-3 py-2 text-sm text-gray-900 whitespace-nowrap">{product.DESCRICAO || product.descricao || ''}</td>,
                              ESTOQUE: () => <td key="ESTOQUE" className={`px-3 py-2 text-sm text-right ${getEstoqueColor(product.ESTOQUE || product.ESTOQUE_ATUAL || 0)}`}>{formatNumber(product.ESTOQUE || product.ESTOQUE_ATUAL || 0)}</td>,
                              CURVA: () => <td key="CURVA" className="px-3 py-2 text-center"><span className={`inline-block px-2 py-0.5 rounded-full text-xs font-bold ${getCurvaColor(product.CURVA || '')}`}>{product.CURVA || '-'}</span></td>,
                              CLASSIF: () => <td key="CLASSIF" className="px-3 py-2 text-center">{classif ? <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-bold border ${classif.color}`}>{classif.label}</span> : <span className="text-gray-400 text-xs">-</span>}</td>,
                              RELEV: () => <td key="RELEV" className="px-3 py-2 text-center"><span className={`inline-block px-2 py-0.5 rounded-full text-xs font-bold ${getRelevanciaColor(product.RELEVANCIA || '')}`}>{product.RELEVANCIA || '-'}</span></td>,
                              OFERTAS: () => {
                                const qtd = Number(product.QTD_OFERTAS) || 0;
                                return <td key="OFERTAS" className="px-3 py-2 text-center">
                                  <button onClick={() => openHistorico(product.COD_PRODUTO, product.DESCRICAO)}
                                    className={`inline-flex items-center gap-1 px-2 py-1 rounded-md border text-xs font-bold transition-colors ${qtd > 0 ? 'bg-orange-50 border-orange-200 text-orange-700 hover:bg-orange-100' : 'bg-gray-50 border-gray-200 text-gray-500 hover:bg-gray-100'}`}
                                    title="Ver historico de ofertas">{qtd}x</button>
                                </td>;
                              },
                              CUSTO: () => <td key="CUSTO" className="px-3 py-2 text-sm text-right text-gray-600">{formatCurrency(custo)}</td>,
                              PRECO_ATUAL: () => <td key="PRECO_ATUAL" className="px-3 py-2 text-sm text-right text-gray-700">{formatCurrency(precoAtual)}</td>,
                              CONC_BARATO: () => <td key="CONC_BARATO" className="px-3 py-2 text-sm text-right" title={product.CONC_NOME || ''}>{concPreco > 0 ? <span className={`font-semibold ${precoAtual <= concPreco ? 'text-green-600' : 'text-red-600'}`}>{formatCurrency(concPreco)}</span> : <span className="text-gray-400">-</span>}</td>,
                              MARGEM_ATUAL: () => <td key="MARGEM_ATUAL" className={`px-3 py-2 text-sm text-right font-semibold ${margemAtual < 0 ? 'text-red-600' : margemAtual < 5 ? 'text-orange-600' : 'text-green-600'}`}>{formatPercent(margemAtual)}</td>,
                              REBAIXO_PRECO: () => <td key="REBAIXO_PRECO" className="px-2 py-1 bg-orange-50/50"><input type="number" step="0.01" min="0" value={precos.rebaixo || ''} onChange={e => updateOfertaPreco(codProd, 'rebaixo', e.target.value)} placeholder="0,00" className="w-20 px-2 py-1 text-xs text-right border border-orange-200 rounded focus:ring-1 focus:ring-orange-400 focus:border-orange-400" /></td>,
                              REBAIXO_MG: () => <td key="REBAIXO_MG" className={`px-2 py-1 text-xs text-right font-semibold bg-orange-50/50 ${mgRebaixo != null ? (mgRebaixo < 0 ? 'text-red-600' : 'text-green-600') : 'text-gray-400'}`}>{mgRebaixo != null ? formatPercent(mgRebaixo) : '-'}</td>,
                              CLUB_PRECO: () => <td key="CLUB_PRECO" className="px-2 py-1 bg-blue-50/50"><input type="number" step="0.01" min="0" value={precos.club || ''} onChange={e => updateOfertaPreco(codProd, 'club', e.target.value)} placeholder="0,00" className="w-20 px-2 py-1 text-xs text-right border border-blue-200 rounded focus:ring-1 focus:ring-blue-400 focus:border-blue-400" /></td>,
                              CLUB_MG: () => <td key="CLUB_MG" className={`px-2 py-1 text-xs text-right font-semibold bg-blue-50/50 ${mgClub != null ? (mgClub < 0 ? 'text-red-600' : 'text-green-600') : 'text-gray-400'}`}>{mgClub != null ? formatPercent(mgClub) : '-'}</td>,
                              LEVE_QTD: () => <td key="LEVE_QTD" className="px-2 py-1 bg-purple-50/50"><input type="number" step="1" min="1" value={precos.leveQtd || ''} onChange={e => updateOfertaPreco(codProd, 'leveQtd', e.target.value)} placeholder="0" className="w-12 px-2 py-1 text-xs text-center border border-purple-200 rounded focus:ring-1 focus:ring-purple-400 focus:border-purple-400" /></td>,
                              LEVE_PRECO: () => <td key="LEVE_PRECO" className="px-2 py-1 bg-purple-50/50"><input type="number" step="0.01" min="0" value={precos.leveMais || ''} onChange={e => updateOfertaPreco(codProd, 'leveMais', e.target.value)} placeholder="0,00" className="w-20 px-2 py-1 text-xs text-right border border-purple-200 rounded focus:ring-1 focus:ring-purple-400 focus:border-purple-400" /></td>,
                              LEVE_MG: () => <td key="LEVE_MG" className={`px-2 py-1 text-xs text-right font-semibold bg-purple-50/50 ${mgLeveMais != null ? (mgLeveMais < 0 ? 'text-red-600' : 'text-green-600') : 'text-gray-400'}`}>{mgLeveMais != null ? formatPercent(mgLeveMais) : '-'}</td>,
                            };

                            rows.push(
                              <tr key={`sel-${codProd}-${globalIdx}`} className={`border-b border-gray-100 hover:bg-orange-50/50 transition-colors ${localIdx % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}`}>
                                <td className="px-3 py-2 text-gray-400 text-xs text-center">{globalIdx}</td>
                                {ofertaTab3Cols.map(col => cellRenderers[col.id] ? cellRenderers[col.id]() : null)}
                                <td className="px-2 py-1 text-center">
                                  <button onClick={() => toggleProductSelection(product, '')} className="text-red-400 hover:text-red-600 text-xs" title="Remover da selecao">✕</button>
                                </td>
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
            </div>
          )}

          {activeTab === 'nova_oferta' && selectedArray.length === 0 && (
            <div className="text-center py-12 text-gray-500">
              <span className="text-4xl mb-4 block">🛒</span>
              <p className="text-lg font-medium">Nenhum produto selecionado</p>
              <p className="text-sm">Selecione produtos nas abas "Analise Realizada" ou "Compra e Venda Excedido" marcando a coluna Ofertar</p>
            </div>
          )}

          {/* === ABA 4: Ofertas Salvas (colapsavel) === */}
          {activeTab === 'salvas' && !sugestoesLoading && ofertasAgrupadas.length > 0 && (
            <div className="space-y-3">
              {ofertasAgrupadas.map((oferta, idx) => {
                const isExpanded = expandedOferta === oferta.nome;
                const vigIni = oferta.vigenciaInicio ? new Date(oferta.vigenciaInicio).toLocaleDateString('pt-BR') : null;
                const vigFim = oferta.vigenciaFim ? new Date(oferta.vigenciaFim).toLocaleDateString('pt-BR') : null;
                return (
                  <div key={`oferta-${idx}`} className="bg-white rounded-lg shadow overflow-hidden">
                    {/* Header da oferta - clicavel */}
                    <div
                      className="flex items-center justify-between px-5 py-3 cursor-pointer hover:bg-gray-50 transition-colors"
                      onClick={() => setExpandedOferta(isExpanded ? null : oferta.nome)}
                    >
                      <div className="flex items-center gap-4">
                        <svg className={`w-5 h-5 text-gray-400 transition-transform ${isExpanded ? 'rotate-90' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7"/>
                        </svg>
                        <div>
                          <h3 className="text-sm font-bold text-gray-900">{oferta.nome}</h3>
                          <div className="flex items-center gap-3 mt-0.5">
                            {vigIni && vigFim && (
                              <span className="text-xs text-gray-500">{vigIni} a {vigFim}</span>
                            )}
                            <span className="text-xs text-gray-400">{oferta.items.length} {oferta.items.length === 1 ? 'item' : 'itens'}</span>
                            <span className="text-xs text-gray-400">{new Date(oferta.createdAt).toLocaleDateString('pt-BR')}</span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
                        <button
                          onClick={() => exportOfertaPDF(oferta)}
                          className="px-3 py-1.5 text-xs font-semibold text-orange-700 bg-orange-50 border border-orange-200 rounded-lg hover:bg-orange-100 transition-colors"
                          title="Exportar PDF"
                        >
                          PDF
                        </button>
                        <button
                          onClick={() => deleteOfertaPorNome(oferta)}
                          className="px-3 py-1.5 text-xs font-semibold text-red-600 bg-red-50 border border-red-200 rounded-lg hover:bg-red-100 transition-colors"
                          title="Excluir oferta"
                        >
                          Excluir
                        </button>
                      </div>
                    </div>

                    {/* Tabela de itens - expandida */}
                    {isExpanded && (
                      <div className="border-t border-gray-200 overflow-x-auto">
                        <table className="w-full">
                          <thead className="bg-gray-100">
                            <tr>
                              <th className="px-3 py-2 text-xs font-semibold text-gray-500 text-center w-8">#</th>
                              <th className="px-3 py-2 text-xs font-semibold text-gray-700 text-left">EAN</th>
                              <th className="px-3 py-2 text-xs font-semibold text-gray-700 text-left">Descricao</th>
                              <th className="px-3 py-2 text-xs font-semibold text-gray-700 text-left">Secao</th>
                              <th className="px-3 py-2 text-xs font-semibold text-gray-700 text-center">Curva</th>
                              <th className="px-3 py-2 text-xs font-semibold text-gray-700 text-right">Custo</th>
                              <th className="px-3 py-2 text-xs font-semibold text-gray-700 text-right">Preco Normal</th>
                              <th className="px-3 py-2 text-xs font-semibold text-gray-700 text-right">Margem</th>
                              <th className="px-3 py-2 text-xs font-semibold bg-orange-50 text-orange-700 text-right">Rebaixo</th>
                              <th className="px-3 py-2 text-xs font-semibold bg-orange-50 text-orange-700 text-right">Mg</th>
                              <th className="px-3 py-2 text-xs font-semibold bg-blue-50 text-blue-700 text-right">Club</th>
                              <th className="px-3 py-2 text-xs font-semibold bg-blue-50 text-blue-700 text-right">Mg</th>
                              <th className="px-3 py-2 text-xs font-semibold bg-purple-50 text-purple-700 text-right">Leve+</th>
                              <th className="px-3 py-2 text-xs font-semibold bg-purple-50 text-purple-700 text-right">Mg</th>
                            </tr>
                          </thead>
                          <tbody>
                            {oferta.items.map((item, localIdx) => {
                              const custo = parseFloat(item.custo) || 0;
                              const precoNormal = parseFloat(item.preco_normal) || 0;
                              const margem = precoNormal > 0 ? ((precoNormal - custo) / precoNormal) * 100 : 0;
                              const mgReb = item.preco_rebaixo ? calcMargem(item.preco_rebaixo, custo) : null;
                              const mgClub = item.preco_club ? calcMargem(item.preco_club, custo) : null;
                              const mgLeve = item.preco_leve_mais ? calcMargem(item.preco_leve_mais, custo) : null;
                              return (
                                <tr key={`sug-${item.id}`} className={`border-b border-gray-100 hover:bg-purple-50/30 transition-colors ${localIdx % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}`}>
                                  <td className="px-3 py-2 text-gray-400 text-xs text-center">{localIdx + 1}</td>
                                  <td className="px-3 py-2 text-xs text-gray-600 font-mono">{item.cod_barras || ''}</td>
                                  <td className="px-3 py-2 text-xs text-gray-900 whitespace-nowrap">{item.descricao}</td>
                                  <td className="px-3 py-2 text-xs text-gray-600">{item.secao || '-'}</td>
                                  <td className="px-3 py-2 text-center"><span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold ${getCurvaColor(item.curva || '')}`}>{item.curva || '-'}</span></td>
                                  <td className="px-3 py-2 text-xs text-right text-gray-600">{formatCurrency(custo)}</td>
                                  <td className="px-3 py-2 text-xs text-right text-gray-700">{formatCurrency(precoNormal)}</td>
                                  <td className={`px-3 py-2 text-xs text-right font-semibold ${margem < 0 ? 'text-red-600' : 'text-green-600'}`}>{formatPercent(margem)}</td>
                                  <td className="px-3 py-2 text-xs text-right bg-orange-50/50 font-semibold text-orange-700">{item.preco_rebaixo ? formatCurrency(item.preco_rebaixo) : '-'}</td>
                                  <td className={`px-3 py-2 text-xs text-right bg-orange-50/50 font-semibold ${mgReb != null ? (mgReb < 0 ? 'text-red-600' : 'text-green-600') : 'text-gray-400'}`}>{mgReb != null ? formatPercent(mgReb) : '-'}</td>
                                  <td className="px-3 py-2 text-xs text-right bg-blue-50/50 font-semibold text-blue-700">{item.preco_club ? formatCurrency(item.preco_club) : '-'}</td>
                                  <td className={`px-3 py-2 text-xs text-right bg-blue-50/50 font-semibold ${mgClub != null ? (mgClub < 0 ? 'text-red-600' : 'text-green-600') : 'text-gray-400'}`}>{mgClub != null ? formatPercent(mgClub) : '-'}</td>
                                  <td className="px-3 py-2 text-xs text-right bg-purple-50/50 font-semibold text-purple-700">{item.preco_leve_mais ? formatCurrency(item.preco_leve_mais) : '-'}</td>
                                  <td className={`px-3 py-2 text-xs text-right bg-purple-50/50 font-semibold ${mgLeve != null ? (mgLeve < 0 ? 'text-red-600' : 'text-green-600') : 'text-gray-400'}`}>{mgLeve != null ? formatPercent(mgLeve) : '-'}</td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {activeTab === 'salvas' && sugestoesLoading && (
            <div className="text-center py-12">
              <div className="inline-block w-8 h-8 border-4 border-purple-300 border-t-purple-600 rounded-full animate-spin"></div>
              <p className="mt-3 text-gray-600">Carregando ofertas...</p>
            </div>
          )}

          {activeTab === 'salvas' && !sugestoesLoading && sugestoesSalvas.length === 0 && sugestoesLoaded && (
            <div className="text-center py-12 text-gray-500">
              <span className="text-4xl mb-4 block">📋</span>
              <p className="text-lg font-medium">Nenhuma oferta salva</p>
              <p className="text-sm">Selecione produtos e salve ofertas na aba "Nova Oferta"</p>
            </div>
          )}

        </div>
      </div>

      {/* Modal Salvar Oferta - nome + vigencia */}
      {showSaveModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setShowSaveModal(false)}>
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md" onClick={(e) => e.stopPropagation()}>
            <div className="bg-gradient-to-r from-orange-600 to-orange-500 px-6 py-4 rounded-t-xl">
              <h3 className="text-white font-bold text-lg">Salvar Oferta</h3>
              <p className="text-orange-100 text-sm">{selectedArray.length} produto{selectedArray.length !== 1 ? 's' : ''} selecionado{selectedArray.length !== 1 ? 's' : ''}</p>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Nome da Oferta *</label>
                <input
                  type="text"
                  value={nomeOferta}
                  onChange={e => setNomeOferta(e.target.value)}
                  placeholder="Ex: Oferta Acougue Fevereiro"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-400 focus:border-orange-400 text-sm"
                  autoFocus
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Vigencia Inicio</label>
                  <input
                    type="date"
                    value={vigenciaInicio}
                    onChange={e => setVigenciaInicio(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-400 focus:border-orange-400 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Vigencia Fim</label>
                  <input
                    type="date"
                    value={vigenciaFim}
                    onChange={e => setVigenciaFim(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-400 focus:border-orange-400 text-sm"
                  />
                </div>
              </div>
            </div>
            <div className="px-6 py-4 bg-gray-50 rounded-b-xl flex justify-end gap-3">
              <button
                onClick={() => setShowSaveModal(false)}
                className="px-4 py-2 text-sm font-semibold text-gray-600 bg-gray-200 hover:bg-gray-300 rounded-lg transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={salvarSugestoes}
                disabled={savingOfertas || !nomeOferta.trim()}
                className="px-6 py-2 text-sm font-bold text-white bg-orange-600 hover:bg-orange-700 disabled:opacity-50 rounded-lg shadow transition-colors"
              >
                {savingOfertas ? 'Salvando...' : 'Salvar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Historico de Ofertas */}
      {historicoModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setHistoricoModal(null)}>
          <div className="bg-white rounded-xl shadow-2xl max-w-5xl w-full max-h-[80vh] overflow-hidden" onClick={(e) => e.stopPropagation()}>
            {/* Header */}
            <div className="bg-gradient-to-r from-orange-500 to-red-500 px-6 py-4 flex items-center justify-between">
              <div>
                <h3 className="text-white font-bold text-lg">Historico de Ofertas</h3>
                <p className="text-orange-100 text-sm truncate max-w-[500px]">{historicoModal.descricao}</p>
              </div>
              <button
                onClick={() => setHistoricoModal(null)}
                className="text-white/80 hover:text-white transition-colors"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"/>
                </svg>
              </button>
            </div>

            {/* Conteudo */}
            <div className="p-6 overflow-y-auto max-h-[60vh]">
              {loadingHistorico && (
                <div className="flex items-center justify-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500"></div>
                  <span className="ml-3 text-gray-600">Carregando historico...</span>
                </div>
              )}

              {!loadingHistorico && historico.length === 0 && (
                <p className="text-center text-gray-500 py-8">Nenhum historico encontrado</p>
              )}

              {!loadingHistorico && historico.length > 0 && (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-100">
                      <tr>
                        <th className="px-3 py-2 text-xs font-semibold text-gray-700 text-left">Periodo</th>
                        <th className="px-3 py-2 text-xs font-semibold text-gray-700 text-left">Programacao</th>
                        <th className="px-3 py-2 text-xs font-semibold text-gray-700 text-right">Preco Normal</th>
                        <th className="px-3 py-2 text-xs font-semibold text-gray-700 text-right">Preco Oferta</th>
                        <th className="px-3 py-2 text-xs font-semibold text-gray-700 text-right">Mg Oferta</th>
                        <th className="px-3 py-2 text-xs font-semibold text-gray-700 text-right">Vd Media</th>
                        <th className="px-3 py-2 text-xs font-semibold text-gray-700 text-right">Vd Oferta</th>
                        <th className="px-3 py-2 text-xs font-semibold text-gray-700 text-right">Cresc.</th>
                        <th className="px-3 py-2 text-xs font-semibold text-gray-700 text-center">Classif.</th>
                      </tr>
                    </thead>
                    <tbody>
                      {historico.map((h, idx) => {
                        const classif = getOfertaClassif(h.CRESC_OFERTA);
                        return (
                          <tr key={idx} className={`border-b border-gray-100 ${idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}`}>
                            <td className="px-3 py-2 text-xs text-gray-700 whitespace-nowrap">
                              {h.DTA_INICIAL} - {h.DTA_FINAL}
                            </td>
                            <td className="px-3 py-2 text-xs text-gray-600 whitespace-nowrap">
                              {h.DES_PROGRAMACAO}
                            </td>
                            <td className="px-3 py-2 text-xs text-right text-gray-700">{formatCurrency(h.PRECO_NORMAL)}</td>
                            <td className="px-3 py-2 text-xs text-right font-semibold text-orange-600">{formatCurrency(h.PRECO_OFERTA)}</td>
                            <td className={`px-3 py-2 text-xs text-right font-semibold ${h.MARGEM_OFERTA < 0 ? 'text-red-600' : 'text-green-600'}`}>
                              {formatPercent(h.MARGEM_OFERTA)}
                            </td>
                            <td className="px-3 py-2 text-xs text-right text-gray-700">{formatNumber(h.VD_MEDIA)}</td>
                            <td className={`px-3 py-2 text-xs text-right font-semibold ${h.VD_OFERTA >= h.VD_MEDIA ? 'text-green-600' : 'text-red-600'}`}>
                              {formatNumber(h.VD_OFERTA)}
                            </td>
                            <td className={`px-3 py-2 text-xs text-right font-semibold ${h.CRESC_OFERTA >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                              {h.CRESC_OFERTA > 0 ? '+' : ''}{formatPercent(h.CRESC_OFERTA)}
                            </td>
                            <td className="px-3 py-2 text-center">
                              {classif ? (
                                <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold border ${classif.color}`}>
                                  {classif.label}
                                </span>
                              ) : (
                                <span className="text-gray-400 text-xs">-</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
