import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useLoja } from '../contexts/LojaContext';
import Sidebar from '../components/Sidebar';
import { api } from '../utils/api';

// Definição das 25 colunas disponíveis
const AVAILABLE_COLUMNS = [
  { id: 'codigo', label: 'Código', visible: true },
  { id: 'descricao', label: 'Descrição', visible: true },
  { id: 'desReduzida', label: 'Desc. Reduzida', visible: false },
  { id: 'ean', label: 'EAN', visible: true },
  { id: 'curva', label: 'Curva', visible: true },
  { id: 'valCustoRep', label: 'Custo', visible: true },
  { id: 'valvendaloja', label: 'Preço Loja', visible: false },
  { id: 'valvenda', label: 'Preço Venda', visible: true },
  { id: 'valOferta', label: 'Oferta', visible: false },
  { id: 'estoque', label: 'Estoque', visible: true },
  { id: 'desSecao', label: 'Seção', visible: true },
  { id: 'desGrupo', label: 'Grupo', visible: false },
  { id: 'desSubGrupo', label: 'Subgrupo', visible: false },
  { id: 'fantasiaForn', label: 'Fornecedor', visible: true },
  { id: 'margemRef', label: 'Margem Meta', visible: false },
  { id: 'margemCalculada', label: 'Margem %', visible: true },
  { id: 'vendaMedia', label: 'Venda Média', visible: true },
  { id: 'diasCobertura', label: 'Dias Cobertura', visible: true },
  { id: 'dtaUltCompra', label: 'Últ. Compra', visible: true },
  { id: 'qtdUltCompra', label: 'Qtd Últ. Compra', visible: true },
  { id: 'qtdPedidoCompra', label: 'Pedido Compra', visible: true },
  { id: 'estoqueMinCalc', label: 'Estoque Mín', visible: true },
  { id: 'tipoEspecie', label: 'Tipo Espécie', visible: false },
  { id: 'dtaCadastro', label: 'Data Cadastro', visible: false },
  { id: 'diasSemVenda', label: 'Dias s/ Venda', visible: true },
  { id: 'valPesquisaMedia', label: 'Conc. Barato', visible: false },
  { id: 'desPesquisaConcorrente', label: 'Concorrente', visible: false },
];

// Configuração dos cards de resumo (data-driven)
const CARD_CONFIG = {
  zerado: { emoji: '🚫', label: 'Ruptura', textColor: 'text-red-600', borderColor: 'border-red-500', statKey: 'estoqueZerado' },
  negativo: { emoji: '⚠️', label: 'Estoque Negativo', textColor: 'text-red-700', borderColor: 'border-orange-600', statKey: 'estoqueNegativo' },
  sem_venda: { emoji: '⏸️', label: 'Sem Venda', textColor: 'text-orange-600', borderColor: 'border-orange-400', statKey: 'semVenda30Dias', special: true },
  pre_ruptura: { emoji: '📉', label: 'Estoque Mínimo', subtitle: 'Pré Ruptura', textColor: 'text-amber-600', borderColor: 'border-amber-500', statKey: 'preRuptura' },
  margem_negativa: { emoji: '💸', label: 'Margem Negativa', textColor: 'text-red-800', borderColor: 'border-rose-500', statKey: 'margemNegativa' },
  margem_baixa: { emoji: '💰', label: 'Margem Abaixo Meta', textColor: 'text-yellow-600', borderColor: 'border-yellow-500', statKey: 'margemAbaixoMeta' },
  custo_zerado: { emoji: '🏷️', label: 'Custo Zerado', textColor: 'text-purple-600', borderColor: 'border-purple-500', statKey: 'custoZerado' },
  preco_venda_zerado: { emoji: '💵', label: 'Preço Venda Zerado', textColor: 'text-pink-600', borderColor: 'border-pink-500', statKey: 'precoVendaZerado' },
  curva_x: { emoji: '❌', label: 'Curva X', textColor: 'text-gray-600', borderColor: 'border-gray-400', statKey: 'curvaX' },
  conc_barato: { emoji: '🏪', label: 'Concorrente', subtitle: '+ Barato', textColor: 'text-blue-600', borderColor: 'border-blue-500', statKey: 'concBarato' },
  margem_excessiva: { emoji: '📈', label: 'Margem Excessiva', textColor: 'text-emerald-600', borderColor: 'border-emerald-500', statKey: 'margemExcessiva', specialRanges: true },
  estoque_excessivo: { emoji: '📦', label: 'Estoque Excessivo', textColor: 'text-amber-600', borderColor: 'border-amber-500', statKey: 'estoqueExcessivo', specialRanges: true },
};
const DEFAULT_CARD_ORDER = ['zerado', 'negativo', 'sem_venda', 'pre_ruptura', 'margem_negativa', 'margem_baixa', 'margem_excessiva', 'estoque_excessivo', 'custo_zerado', 'preco_venda_zerado', 'curva_x', 'conc_barato'];

// Seções fixas de cards (posição travada)
const CARD_SECTIONS = [
  {
    id: 'gestao-estoque',
    title: 'GESTÃO ESTOQUE',
    cards: ['zerado', 'sem_venda', 'pre_ruptura', 'negativo', 'estoque_excessivo', 'curva_x'],
  },
  {
    id: 'gestao-margem',
    title: 'GESTÃO MARGEM',
    cards: ['margem_excessiva', 'custo_zerado', 'margem_negativa', 'preco_venda_zerado', 'margem_baixa', 'conc_barato'],
  },
];

// Faixas de margem excessiva (acima da meta)
const MARGEM_RANGES = [
  { id: 'ate5', label: 'Até 5%', min: 0.01, max: 5, color: 'bg-emerald-50 hover:bg-emerald-100', textColor: 'text-emerald-700' },
  { id: 'de5a10', label: '5-10%', min: 5.01, max: 10, color: 'bg-teal-50 hover:bg-teal-100', textColor: 'text-teal-700' },
  { id: 'de10a15', label: '10-15%', min: 10.01, max: 15, color: 'bg-cyan-50 hover:bg-cyan-100', textColor: 'text-cyan-700' },
  { id: 'de15a20', label: '15-20%', min: 15.01, max: 20, color: 'bg-blue-50 hover:bg-blue-100', textColor: 'text-blue-700' },
  { id: 'de20a30', label: '20-30%', min: 20.01, max: 30, color: 'bg-indigo-50 hover:bg-indigo-100', textColor: 'text-indigo-700' },
  { id: 'acima30', label: '>30%', min: 30.01, max: 99999, color: 'bg-violet-50 hover:bg-violet-100', textColor: 'text-violet-700' },
];

// Faixas de estoque excessivo (dias de cobertura = estoque / venda média)
const ESTOQUE_EXCESSIVO_RANGES = [
  { id: 'ate20', label: '≤20d', min: 0.01, max: 20, color: 'bg-green-50 hover:bg-green-100', textColor: 'text-green-700' },
  { id: 'de21a30', label: '21-30d', min: 21, max: 30, color: 'bg-lime-50 hover:bg-lime-100', textColor: 'text-lime-700' },
  { id: 'de31a60', label: '31-60d', min: 31, max: 60, color: 'bg-yellow-50 hover:bg-yellow-100', textColor: 'text-yellow-700' },
  { id: 'de61a120', label: '61-120d', min: 61, max: 120, color: 'bg-orange-50 hover:bg-orange-100', textColor: 'text-orange-700' },
  { id: 'de121a180', label: '121-180d', min: 121, max: 180, color: 'bg-red-50 hover:bg-red-100', textColor: 'text-red-600' },
  { id: 'acima180', label: '>180d', min: 181, max: 99999, color: 'bg-red-100 hover:bg-red-200', textColor: 'text-red-700' },
  { id: 'nunca', label: 'Nunca', min: -1, max: -1, color: 'bg-gray-100 hover:bg-gray-200', textColor: 'text-gray-700' },
];

// Mapa de faixas por card (para cards com specialRanges)
const SPECIAL_RANGES = {
  margem_excessiva: MARGEM_RANGES,
  estoque_excessivo: ESTOQUE_EXCESSIVO_RANGES,
};

export default function EstoqueSaude() {
  const { user, logout } = useAuth();
  const { lojaSelecionada } = useLoja();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Configuração de colunas - merge inteligente com versão salva
  const [showColumnSelector, setShowColumnSelector] = useState(false);
  const [columns, setColumns] = useState(() => {
    const saved = localStorage.getItem('estoque_columns');
    if (!saved) return AVAILABLE_COLUMNS;
    try {
      const savedCols = JSON.parse(saved);
      const savedIds = new Set(savedCols.map(c => c.id));
      const currentIds = new Set(AVAILABLE_COLUMNS.map(c => c.id));
      // Se não mudou nada, usa o salvo direto
      const hasNew = AVAILABLE_COLUMNS.some(c => !savedIds.has(c.id));
      const hasRemoved = savedCols.some(c => !currentIds.has(c.id));
      if (!hasNew && !hasRemoved) return savedCols;
      // Merge: manter ordem e visibilidade do salvo, adicionar novas, remover obsoletas
      const merged = savedCols.filter(c => currentIds.has(c.id)).map(c => {
        const current = AVAILABLE_COLUMNS.find(a => a.id === c.id);
        return { ...c, label: current.label }; // Atualiza label se mudou
      });
      // Adicionar colunas novas no final (visíveis por padrão)
      AVAILABLE_COLUMNS.forEach(c => {
        if (!savedIds.has(c.id)) merged.push({ ...c });
      });
      localStorage.setItem('estoque_columns', JSON.stringify(merged));
      return merged;
    } catch { return AVAILABLE_COLUMNS; }
  });

  // Ordem dos cards (drag and drop) - salva no localStorage
  const [cardOrder, setCardOrder] = useState(() => {
    const saved = localStorage.getItem('estoque_card_order');
    if (!saved) return DEFAULT_CARD_ORDER;
    try {
      const parsed = JSON.parse(saved);
      const knownIds = new Set(DEFAULT_CARD_ORDER);
      const result = parsed.filter(id => knownIds.has(id));
      DEFAULT_CARD_ORDER.forEach(id => { if (!result.includes(id)) result.push(id); });
      return result;
    } catch { return DEFAULT_CARD_ORDER; }
  });
  const [draggedCard, setDraggedCard] = useState(null);

  // Filtros - valores padrão: MERCADORIA e Direta (arrays para multi-select)
  const [filterTipoEspecie, setFilterTipoEspecie] = useState(['MERCADORIA']);
  const [filterTipoEvento, setFilterTipoEvento] = useState(['Direta']);
  const [showEspecieDropdown, setShowEspecieDropdown] = useState(false);
  const [showEventoDropdown, setShowEventoDropdown] = useState(false);
  const especieRef = useRef(null);
  const eventoRef = useRef(null);

  // Fechar dropdowns ao clicar fora
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (especieRef.current && !especieRef.current.contains(e.target)) setShowEspecieDropdown(false);
      if (eventoRef.current && !eventoRef.current.contains(e.target)) setShowEventoDropdown(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const [filterSecao, setFilterSecao] = useState('');
  const [filterGrupo, setFilterGrupo] = useState('');
  const [filterSubGrupo, setFilterSubGrupo] = useState('');
  const [filterCurva, setFilterCurva] = useState('');
  const [activeCardFilter, setActiveCardFilter] = useState('todos');
  const [activeCardCurva, setActiveCardCurva] = useState(''); // Filtro de curva dentro do card
  const [viewMode, setViewMode] = useState('geral'); // 'geral' ou 'pontuacao'

  // Ordenação
  const [sortColumn, setSortColumn] = useState(null);
  const [sortDirection, setSortDirection] = useState('asc'); // 'asc' ou 'desc'

  // Ordenação da tabela de pontuação
  const [sortPontuacao, setSortPontuacao] = useState({ column: 'totalPontos', direction: 'desc' });

  // Definição das colunas da tabela de pontuação (para drag and drop)
  // Colunas base (info) compartilhadas entre as duas pontuações
  const PONTUACAO_INFO_COLUMNS = [
    { id: 'codigo', label: 'Código', type: 'info' },
    { id: 'descricao', label: 'Descrição', type: 'info' },
    { id: 'curva', label: 'Curva', type: 'info' },
    { id: 'estoque', label: 'Estoque', type: 'info' },
    { id: 'diasSemVenda', label: 'Dias Venda', type: 'info' },
    { id: 'desSecao', label: 'Seção', type: 'info' },
    { id: 'fornecedor', label: 'Fornecedor', type: 'info' },
    { id: 'historico', label: 'Hist.', type: 'action' },
    { id: 'qtdPedidoCompra', label: 'Pedido', type: 'info' },
  ];

  // Colunas de pontuação ESTOQUE
  const PONTUACAO_ESTOQUE_COLUMNS_DEFAULT = [
    ...PONTUACAO_INFO_COLUMNS,
    { id: 'pontosZerado', label: '📭 Est. Zerado', type: 'pontos', bg: 'bg-red-600' },
    { id: 'pontosNegativo', label: '⚠️ Est. Negativo', type: 'pontos', bg: 'bg-red-700' },
    { id: 'pontosSemVenda', label: '⏸️ Sem Venda', type: 'pontos', bg: 'bg-orange-600' },
    { id: 'pontosPreRuptura', label: '📉 Pré Ruptura', type: 'pontos', bg: 'bg-amber-600' },
    { id: 'pontosEstoqueExcessivo', label: '📦 Est. Excessivo', type: 'pontos', bg: 'bg-amber-700' },
    { id: 'totalPontosEstoque', label: 'TOTAL', type: 'total', bg: 'bg-gray-800' },
    { id: 'nivelRisco', label: 'NÍVEL', type: 'risco', bg: 'bg-gray-700' },
  ];

  // Colunas de pontuação MARGEM
  const PONTUACAO_MARGEM_COLUMNS_DEFAULT = [
    ...PONTUACAO_INFO_COLUMNS,
    { id: 'pontosMargemNegativa', label: '💸 Mg. Negativa', type: 'pontos', bg: 'bg-red-800' },
    { id: 'pontosMargemBaixa', label: '💰 Mg. Baixa', type: 'pontos', bg: 'bg-yellow-600' },
    { id: 'pontosCustoZerado', label: '🏷️ Custo Zero', type: 'pontos', bg: 'bg-purple-600' },
    { id: 'pontosPrecoZerado', label: '💵 Preço Zero', type: 'pontos', bg: 'bg-pink-600' },
    { id: 'pontosConcBarato', label: '🏪 Conc. Barato', type: 'pontos', bg: 'bg-blue-600' },
    { id: 'pontosMargemExcessiva', label: '📈 Mg. Excessiva', type: 'pontos', bg: 'bg-emerald-600' },
    { id: 'totalPontosMargem', label: 'TOTAL', type: 'total', bg: 'bg-gray-800' },
    { id: 'nivelRisco', label: 'NÍVEL', type: 'risco', bg: 'bg-gray-700' },
  ];

  // Manter compatibilidade - PONTUACAO_COLUMNS_DEFAULT com todas (usado em fallback)
  const PONTUACAO_COLUMNS_DEFAULT = [
    ...PONTUACAO_INFO_COLUMNS,
    { id: 'pontosZerado', label: '📭 Est. Zerado', type: 'pontos', bg: 'bg-red-600' },
    { id: 'pontosNegativo', label: '⚠️ Est. Negativo', type: 'pontos', bg: 'bg-red-700' },
    { id: 'pontosSemVenda', label: '⏸️ Sem Venda', type: 'pontos', bg: 'bg-orange-600' },
    { id: 'pontosMargemNegativa', label: '💸 Mg. Negativa', type: 'pontos', bg: 'bg-red-800' },
    { id: 'pontosMargemBaixa', label: '💰 Mg. Baixa', type: 'pontos', bg: 'bg-yellow-600' },
    { id: 'pontosCustoZerado', label: '🏷️ Custo Zero', type: 'pontos', bg: 'bg-purple-600' },
    { id: 'pontosPrecoZerado', label: '💵 Preço Zero', type: 'pontos', bg: 'bg-pink-600' },
    { id: 'pontosConcBarato', label: '🏪 Conc. Barato', type: 'pontos', bg: 'bg-blue-600' },
    { id: 'pontosMargemExcessiva', label: '📈 Mg. Excessiva', type: 'pontos', bg: 'bg-emerald-600' },
    { id: 'pontosEstoqueExcessivo', label: '📦 Est. Excessivo', type: 'pontos', bg: 'bg-amber-600' },
    { id: 'totalPontos', label: 'TOTAL', type: 'total', bg: 'bg-gray-800' },
    { id: 'nivelRisco', label: 'NÍVEL', type: 'risco', bg: 'bg-gray-700' },
  ];

  // Helper para restaurar colunas do localStorage
  const loadPontuacaoCols = (key, defaults) => {
    const saved = localStorage.getItem(key);
    if (saved) {
      try {
        const savedOrder = JSON.parse(saved);
        const reordered = savedOrder.map(id => defaults.find(c => c.id === id)).filter(Boolean);
        const newColumns = defaults.filter(col => !savedOrder.includes(col.id));
        return [...reordered, ...newColumns];
      } catch (e) {}
    }
    return defaults;
  };

  // Estados para colunas de cada pontuação (persistidas separadamente)
  const [pontuacaoEstoqueColumns, setPontuacaoEstoqueColumns] = useState(() => loadPontuacaoCols('estoque_pontuacao_estoque_cols', PONTUACAO_ESTOQUE_COLUMNS_DEFAULT));
  const [pontuacaoMargemColumns, setPontuacaoMargemColumns] = useState(() => loadPontuacaoCols('estoque_pontuacao_margem_cols', PONTUACAO_MARGEM_COLUMNS_DEFAULT));
  // Manter compatibilidade com o state original
  const [pontuacaoColumns, setPontuacaoColumns] = useState(() => loadPontuacaoCols('estoque_saude_pontuacao_columns', PONTUACAO_COLUMNS_DEFAULT));

  // Colunas ativas dependem do viewMode
  const activePontuacaoColumns = viewMode === 'pontuacaoEstoque' ? pontuacaoEstoqueColumns
    : viewMode === 'pontuacaoMargem' ? pontuacaoMargemColumns
    : pontuacaoColumns;

  const setActivePontuacaoColumns = viewMode === 'pontuacaoEstoque' ? setPontuacaoEstoqueColumns
    : viewMode === 'pontuacaoMargem' ? setPontuacaoMargemColumns
    : setPontuacaoColumns;

  // Persistir ordem das colunas de pontuação
  useEffect(() => {
    localStorage.setItem('estoque_saude_pontuacao_columns', JSON.stringify(pontuacaoColumns.map(c => c.id)));
  }, [pontuacaoColumns]);
  useEffect(() => {
    localStorage.setItem('estoque_pontuacao_estoque_cols', JSON.stringify(pontuacaoEstoqueColumns.map(c => c.id)));
  }, [pontuacaoEstoqueColumns]);
  useEffect(() => {
    localStorage.setItem('estoque_pontuacao_margem_cols', JSON.stringify(pontuacaoMargemColumns.map(c => c.id)));
  }, [pontuacaoMargemColumns]);

  // Drag and drop para colunas de pontuação
  const [draggedPontuacaoCol, setDraggedPontuacaoCol] = useState(null);
  const [dragOverPontuacaoCol, setDragOverPontuacaoCol] = useState(null);

  const handlePontuacaoDragStart = (e, columnId) => {
    setDraggedPontuacaoCol(columnId);
    e.dataTransfer.effectAllowed = 'move';
    e.target.style.opacity = '0.5';
  };

  const handlePontuacaoDragEnd = (e) => {
    e.target.style.opacity = '1';
    setDraggedPontuacaoCol(null);
    setDragOverPontuacaoCol(null);
  };

  const handlePontuacaoDragOver = (e, columnId) => {
    e.preventDefault();
    if (draggedPontuacaoCol === columnId) return;
    setDragOverPontuacaoCol(columnId);
  };

  const handlePontuacaoDrop = (e, targetColumnId) => {
    e.preventDefault();
    if (!draggedPontuacaoCol || draggedPontuacaoCol === targetColumnId) return;

    const newColumns = [...activePontuacaoColumns];
    const draggedIndex = newColumns.findIndex(c => c.id === draggedPontuacaoCol);
    const targetIndex = newColumns.findIndex(c => c.id === targetColumnId);

    if (draggedIndex === -1 || targetIndex === -1) return;

    const [draggedItem] = newColumns.splice(draggedIndex, 1);
    newColumns.splice(targetIndex, 0, draggedItem);

    setActivePontuacaoColumns(newColumns);
    setDraggedPontuacaoCol(null);
    setDragOverPontuacaoCol(null);
  };

  // Paginação
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 50;

  // Paginação da tabela de pontuação
  const [currentPagePontuacao, setCurrentPagePontuacao] = useState(1);
  const itemsPerPagePontuacao = 50;

  // Drag and Drop para reordenar colunas
  const [draggedColumn, setDraggedColumn] = useState(null);

  // Modal de configuração de pontuação por card
  const [configModalOpen, setConfigModalOpen] = useState(null); // null ou 'zerado', 'negativo', etc

  // Modal de configuração de níveis de risco
  const [riskConfigModalOpen, setRiskConfigModalOpen] = useState(false);

  // Configuração de níveis de risco (persistido no localStorage)
  const [riskConfig, setRiskConfig] = useState(() => {
    const defaults = {
      semRisco: { min: 0, max: 0 },
      moderado: { min: 1, max: 100 },
      critico: { min: 101, max: 150 },
      muitoCritico: { min: 151, max: 999999 }
    };
    const saved = localStorage.getItem('estoque_saude_risk_config');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {}
    }
    return defaults;
  });

  // Persistir configuração de risco
  useEffect(() => {
    localStorage.setItem('estoque_saude_risk_config', JSON.stringify(riskConfig));
  }, [riskConfig]);

  // Filtro de risco ativo
  const [activeRiskFilter, setActiveRiskFilter] = useState(null); // null, 'semRisco', 'moderado', 'critico', 'muitoCritico'

  // ============ SISTEMA DE PEDIDOS ============
  // Produtos selecionados para pedido (Set de códigos)
  const [selectedForPedido, setSelectedForPedido] = useState(new Set());

  // Quantidades dos pedidos (Map: codigo -> quantidade)
  const [pedidoQuantidades, setPedidoQuantidades] = useState({});

  // Pedidos salvos (persistidos no localStorage)
  const [pedidosSalvos, setPedidosSalvos] = useState(() => {
    const saved = localStorage.getItem('estoque_saude_pedidos');
    return saved ? JSON.parse(saved) : [];
  });

  // Persistir pedidos salvos
  useEffect(() => {
    localStorage.setItem('estoque_saude_pedidos', JSON.stringify(pedidosSalvos));
  }, [pedidosSalvos]);

  // Estado para controlar qual pedido está expandido
  const [expandedPedido, setExpandedPedido] = useState(null);

  // Estados para modal de histórico de compras
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [historyProduct, setHistoryProduct] = useState(null);
  const [historyData, setHistoryData] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  // Buscar histórico de compras de um produto
  const fetchPurchaseHistory = async (product) => {
    setHistoryProduct(product);
    setShowHistoryModal(true);
    setLoadingHistory(true);
    setHistoryData([]);

    try {
      const response = await api.get(`/products/${product.codigo}/purchase-history?limit=10`);
      setHistoryData(response.data.historico || []);
    } catch (err) {
      console.error('Erro ao buscar histórico:', err);
      setHistoryData([]);
    } finally {
      setLoadingHistory(false);
    }
  };

  // Toggle seleção de produto para pedido
  const togglePedidoSelection = (codigo) => {
    setSelectedForPedido(prev => {
      const newSet = new Set(prev);
      if (newSet.has(codigo)) {
        newSet.delete(codigo);
      } else {
        newSet.add(codigo);
      }
      return newSet;
    });
  };

  // Selecionar todos os produtos visíveis
  const selectAllForPedido = () => {
    const visibleCodigos = paginatedProdutosPontuacao.map(p => p.codigo);
    setSelectedForPedido(prev => {
      const newSet = new Set(prev);
      visibleCodigos.forEach(codigo => newSet.add(codigo));
      return newSet;
    });
  };

  // Desmarcar todos
  const clearPedidoSelection = () => {
    setSelectedForPedido(new Set());
    setPedidoQuantidades({});
  };

  // Atualizar quantidade de um item no pedido
  const updatePedidoQuantidade = (codigo, quantidade) => {
    setPedidoQuantidades(prev => ({
      ...prev,
      [codigo]: quantidade
    }));
  };

  // Salvar pedido atual
  const salvarPedido = () => {
    if (selectedForPedido.size === 0) return;

    const itensPedido = Array.from(selectedForPedido).map(codigo => {
      const produto = products.find(p => p.codigo === codigo);
      return {
        codigo: produto?.codigo || codigo,
        ean: produto?.ean || '',
        descricao: produto?.descricao || '',
        desSecao: produto?.desSecao || '',
        fornecedor: produto?.fantasiaForn || '',
        desEmbalagem: produto?.desEmbalagem || '',
        qtdEmbalagemCompra: produto?.qtdEmbalagemCompra || 1,
        quantidade: pedidoQuantidades[codigo] || 1
      };
    });

    const novoPedido = {
      id: Date.now(),
      data: new Date().toLocaleString('pt-BR'),
      itens: itensPedido,
      totalItens: itensPedido.length
    };

    setPedidosSalvos(prev => [...prev, novoPedido]);
    clearPedidoSelection();
    setViewMode('pontuacao');
  };

  // Excluir um pedido salvo
  const excluirPedido = (pedidoId) => {
    setPedidosSalvos(prev => prev.filter(p => p.id !== pedidoId));
  };

  // Produtos selecionados com dados completos
  const produtosSelecionadosPedido = useMemo(() => {
    return Array.from(selectedForPedido).map(codigo => {
      const produto = products.find(p => p.codigo === codigo);
      return {
        codigo: produto?.codigo || codigo,
        ean: produto?.ean || '',
        descricao: produto?.descricao || '',
        desSecao: produto?.desSecao || '',
        fornecedor: produto?.fantasiaForn || '',
        desEmbalagem: produto?.desEmbalagem || '',
        qtdEmbalagemCompra: produto?.qtdEmbalagemCompra || 1,
        quantidade: pedidoQuantidades[codigo] || 1
      };
    });
  }, [selectedForPedido, products, pedidoQuantidades]);
  // ============ FIM SISTEMA DE PEDIDOS ============

  // Configuração de pontuação por curva para cada indicador
  // sem_venda tem estrutura diferente: { curva: { dias: X, pontos: Y } }
  const [pontuacaoConfig, setPontuacaoConfig] = useState(() => {
    const PONTUACAO_VERSION = 4;
    const curvaDefault = { A: 50, B: 35, C: 25, D: 15, E: 10, X: 5 };
    const defaults = {
      _version: PONTUACAO_VERSION,
      zerado: { ...curvaDefault },
      negativo: { ...curvaDefault },
      sem_venda: {
        A: { dias: 3, pontos: 50 },
        B: { dias: 7, pontos: 40 },
        C: { dias: 15, pontos: 30 },
        D: { dias: 30, pontos: 20 },
        E: { dias: 45, pontos: 10 },
        X: { dias: 60, pontos: 5 }
      },
      pre_ruptura: { ...curvaDefault },
      margem_negativa: { ...curvaDefault },
      margem_baixa: { ...curvaDefault },
      custo_zerado: { ...curvaDefault },
      preco_venda_zerado: { ...curvaDefault },
      curva_x: { ...curvaDefault },
      conc_barato: { ...curvaDefault },
      margem_excessiva: { ate5: 50, de5a10: 35, de10a15: 25, de15a20: 15, de20a30: 10, acima30: 5 },
      estoque_excessivo: { ate20: 5, de21a30: 10, de31a60: 15, de61a120: 25, de121a180: 35, acima180: 50, nunca: 50 },
    };
    const saved = localStorage.getItem('estoque_saude_pontuacao');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        // Se versão antiga (sem _version ou < PONTUACAO_VERSION), usar novos defaults
        if (!parsed._version || parsed._version < PONTUACAO_VERSION) {
          return defaults;
        }
        // Merge saved values with defaults to ensure all keys exist
        const result = { _version: PONTUACAO_VERSION };
        for (const key of Object.keys(defaults)) {
          if (key === '_version') continue;
          if (key === 'sem_venda') {
            // Estrutura especial para sem_venda
            result[key] = {};
            for (const curva of ['A', 'B', 'C', 'D', 'E', 'X']) {
              if (parsed[key]?.[curva] && typeof parsed[key][curva] === 'object') {
                result[key][curva] = { ...defaults[key][curva], ...parsed[key][curva] };
              } else {
                result[key][curva] = defaults[key][curva];
              }
            }
          } else {
            result[key] = { ...defaults[key], ...(parsed[key] || {}) };
          }
        }
        return result;
      } catch (e) {
        return defaults;
      }
    }
    return defaults;
  });

  // Salvar pontuação no localStorage
  useEffect(() => {
    localStorage.setItem('estoque_saude_pontuacao', JSON.stringify(pontuacaoConfig));
  }, [pontuacaoConfig]);

  // Salvar ordem dos cards no localStorage
  useEffect(() => {
    localStorage.setItem('estoque_card_order', JSON.stringify(cardOrder));
  }, [cardOrder]);

  // Drag and drop handlers para reordenar cards
  const handleCardDragStart = (e, cardId) => {
    setDraggedCard(cardId);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', cardId);
  };
  const handleCardDragOver = (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };
  const handleCardDrop = (e, targetId) => {
    e.preventDefault();
    const sourceId = e.dataTransfer.getData('text/plain');
    if (!sourceId || sourceId === targetId) return;
    setCardOrder(prev => {
      const newOrder = [...prev];
      const fromIdx = newOrder.indexOf(sourceId);
      const toIdx = newOrder.indexOf(targetId);
      newOrder.splice(fromIdx, 1);
      newOrder.splice(toIdx, 0, sourceId);
      return newOrder;
    });
    setDraggedCard(null);
  };
  const handleCardDragEnd = () => setDraggedCard(null);

  // Função para atualizar pontuação de uma curva específica
  const updatePontuacao = (indicador, curva, valor) => {
    setPontuacaoConfig(prev => ({
      ...prev,
      [indicador]: {
        ...prev[indicador],
        [curva]: parseInt(valor) || 0
      }
    }));
  };

  // Função específica para atualizar sem_venda (dias ou pontos)
  const updateSemVenda = (curva, campo, valor) => {
    setPontuacaoConfig(prev => ({
      ...prev,
      sem_venda: {
        ...prev.sem_venda,
        [curva]: {
          ...prev.sem_venda[curva],
          [campo]: parseInt(valor) || 0
        }
      }
    }));
  };

  // Salvar colunas no localStorage
  useEffect(() => {
    localStorage.setItem('estoque_columns', JSON.stringify(columns));
  }, [columns]);

  // Toggle visibilidade de coluna
  const toggleColumn = (columnId) => {
    setColumns(prev => prev.map(col =>
      col.id === columnId ? { ...col, visible: !col.visible } : col
    ));
  };

  // Estado adicional para drag over
  const [dragOverColumn, setDragOverColumn] = useState(null);

  // Funções de Drag and Drop para o seletor de colunas
  const handleDragStart = (index) => {
    setDraggedColumn(index);
  };

  const handleDragOver = (e, index) => {
    e.preventDefault();

    if (draggedColumn === null || draggedColumn === index) return;

    const newColumns = [...columns];
    const draggedItem = newColumns[draggedColumn];

    // Remove item da posição original
    newColumns.splice(draggedColumn, 1);

    // Insere na nova posição
    newColumns.splice(index, 0, draggedItem);

    setColumns(newColumns);
    setDraggedColumn(index);
  };

  const handleDragEnd = () => {
    setDraggedColumn(null);
  };

  // Funções de Drag and Drop para os headers da tabela
  const handleHeaderDragStart = (e, columnId) => {
    setDraggedColumn(columnId);
    e.dataTransfer.effectAllowed = 'move';
    e.target.style.opacity = '0.5';
  };

  const handleHeaderDragEnd = (e) => {
    e.target.style.opacity = '1';
    setDraggedColumn(null);
    setDragOverColumn(null);
  };

  const handleHeaderDragOver = (e, columnId) => {
    e.preventDefault();
    if (draggedColumn !== columnId) {
      setDragOverColumn(columnId);
    }
  };

  const handleHeaderDragLeave = () => {
    setDragOverColumn(null);
  };

  const handleHeaderDrop = (e, targetColumnId) => {
    e.preventDefault();
    if (!draggedColumn || draggedColumn === targetColumnId) return;

    const newColumns = [...columns];
    const draggedIndex = newColumns.findIndex(col => col.id === draggedColumn);
    const targetIndex = newColumns.findIndex(col => col.id === targetColumnId);

    const [removed] = newColumns.splice(draggedIndex, 1);
    newColumns.splice(targetIndex, 0, removed);

    setColumns(newColumns);
    setDraggedColumn(null);
    setDragOverColumn(null);
  };

  // Buscar produtos diretamente do Oracle
  const fetchProducts = async () => {
    try {
      setLoading(true);
      setError('');

      // Usar endpoint Oracle diretamente
      const params = new URLSearchParams();
      if (lojaSelecionada) params.append('codLoja', lojaSelecionada);
      const response = await api.get(`/products/oracle?${params.toString()}`);
      const allProducts = response.data.data || response.data;

      // Adicionar colunas calculadas
      const productsWithCalcs = allProducts.map(p => {
        const dataAtual = new Date();
        const dtaUltVenda = p.dtaUltMovVenda ? new Date(p.dtaUltMovVenda.slice(0, 4), p.dtaUltMovVenda.slice(4, 6) - 1, p.dtaUltMovVenda.slice(6, 8)) : null;
        const diasSemVenda = dtaUltVenda ? Math.floor((dataAtual - dtaUltVenda) / (1000 * 60 * 60 * 24)) : 999;

        // Calcular margem apenas se tiver preço de venda E custo válidos
        let margemCalculada = 0;
        if (p.valvenda > 0 && p.valCustoRep != null) {
          margemCalculada = parseFloat((((p.valvenda - p.valCustoRep) / p.valvenda) * 100).toFixed(2));
        }

        // Estoque Mínimo = (Dias Visita + Prazo Entrega) × Venda Média Diária
        const diasReposicao = (Number(p.numFreqVisita) || 0) + (Number(p.numPrazo) || 0);
        const estoqueMinCalc = diasReposicao > 0 ? Math.ceil(diasReposicao * (p.vendaMedia || 0)) : 0;

        return {
          ...p,
          diasSemVenda,
          margemCalculada,
          estoqueMinCalc
        };
      });

      setProducts(productsWithCalcs);
    } catch (err) {
      console.error('Erro ao buscar produtos:', err);
      if (err.response?.status === 401) {
        logout();
      } else {
        setError('Erro ao carregar produtos. Tente novamente.');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProducts();
  }, [lojaSelecionada]);

  // Função para ordenar produtos
  const handleSort = (columnId) => {
    if (sortColumn === columnId) {
      // Se já está ordenando por esta coluna, inverte a direção
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      // Se é nova coluna, ordena ascendente
      setSortColumn(columnId);
      setSortDirection('asc');
    }
  };

  // Opções únicas para os filtros (dependentes entre si)
  const filterOptions = useMemo(() => {
    // Tipo Espécie e Tipo Evento disponíveis
    const tipoEspecies = [...new Set(products.map(p => p.tipoEspecie).filter(Boolean))].sort();
    const tipoEventos = [...new Set(products.map(p => p.tipoEvento).filter(Boolean))].sort();

    // Todas as seções disponíveis
    const secoes = [...new Set(products.map(p => p.desSecao).filter(Boolean))].sort();

    // Grupos filtrados pela seção selecionada
    let produtosFiltradosParaGrupo = products;
    if (filterSecao) {
      produtosFiltradosParaGrupo = products.filter(p => p.desSecao === filterSecao);
    }
    const grupos = [...new Set(produtosFiltradosParaGrupo.map(p => p.desGrupo).filter(Boolean))].sort();

    // Subgrupos filtrados pela seção E grupo selecionados
    let produtosFiltradosParaSubgrupo = products;
    if (filterSecao) {
      produtosFiltradosParaSubgrupo = produtosFiltradosParaSubgrupo.filter(p => p.desSecao === filterSecao);
    }
    if (filterGrupo) {
      produtosFiltradosParaSubgrupo = produtosFiltradosParaSubgrupo.filter(p => p.desGrupo === filterGrupo);
    }
    const subgrupos = [...new Set(produtosFiltradosParaSubgrupo.map(p => p.desSubGrupo).filter(Boolean))].sort();

    // Curvas disponíveis (A, B, C, D, E, X, etc.)
    const curvas = [...new Set(products.map(p => p.curva).filter(Boolean))].sort();

    return { secoes, grupos, subgrupos, curvas, tipoEspecies, tipoEventos };
  }, [products, filterSecao, filterGrupo]);

  // Produtos filtrados e ordenados
  const filteredProducts = useMemo(() => {
    let filtered = products;

    // Filtro de Tipo Espécie (multi-select)
    if (filterTipoEspecie.length > 0) {
      filtered = filtered.filter(p => filterTipoEspecie.includes(p.tipoEspecie));
    }

    // Filtro de Tipo Evento (multi-select)
    if (filterTipoEvento.length > 0) {
      filtered = filtered.filter(p => filterTipoEvento.includes(p.tipoEvento));
    }

    // Filtro de Seção
    if (filterSecao) {
      filtered = filtered.filter(p => p.desSecao === filterSecao);
    }

    // Filtro de Grupo
    if (filterGrupo) {
      filtered = filtered.filter(p => p.desGrupo === filterGrupo);
    }

    // Filtro de Subgrupo
    if (filterSubGrupo) {
      filtered = filtered.filter(p => p.desSubGrupo === filterSubGrupo);
    }

    // Filtro de Curva
    if (filterCurva) {
      filtered = filtered.filter(p => p.curva === filterCurva);
    }

    // Filtro por Card clicado
    if (activeCardFilter === 'zerado') {
      filtered = filtered.filter(p => p.estoque === 0);
    } else if (activeCardFilter === 'negativo') {
      filtered = filtered.filter(p => p.estoque < 0);
    } else if (activeCardFilter === 'sem_venda') {
      // Filtra usando dias específicos da curva do produto
      filtered = filtered.filter(p => {
        const curva = p.curva || 'X';
        const curvaKey = ['A', 'B', 'C', 'D', 'E', 'X'].includes(curva) ? curva : 'X';
        const diasLimite = pontuacaoConfig.sem_venda?.[curvaKey]?.dias || 30;
        return p.diasSemVenda > diasLimite;
      });
    } else if (activeCardFilter === 'pre_ruptura') {
      filtered = filtered.filter(p => p.estoqueMinCalc > 0 && p.estoque <= p.estoqueMinCalc);
    } else if (activeCardFilter === 'margem_negativa') {
      filtered = filtered.filter(p => p.margemCalculada < 0);
    } else if (activeCardFilter === 'margem_baixa') {
      filtered = filtered.filter(p => p.margemCalculada < p.margemRef && p.margemCalculada >= 0);
    } else if (activeCardFilter === 'custo_zerado') {
      filtered = filtered.filter(p => !p.valCustoRep || p.valCustoRep === 0);
    } else if (activeCardFilter === 'preco_venda_zerado') {
      filtered = filtered.filter(p => !p.valvenda || p.valvenda === 0);
    } else if (activeCardFilter === 'curva_x') {
      filtered = filtered.filter(p => p.curva === 'X' || !p.curva);
    } else if (activeCardFilter === 'conc_barato') {
      filtered = filtered.filter(p => p.valPesquisaMedia > 0 && p.valvenda > 0 && p.valPesquisaMedia < p.valvenda);
    } else if (activeCardFilter === 'margem_excessiva') {
      filtered = filtered.filter(p => p.margemRef > 0 && p.margemCalculada > p.margemRef);
    } else if (activeCardFilter === 'estoque_excessivo') {
      filtered = filtered.filter(p => {
        if (!p.estoque || p.estoque <= 0) return false;
        return true; // todos com estoque > 0 (detalhamento por faixa no activeCardCurva)
      });
    }

    // Filtro de curva específica dentro do card (ou faixa especial)
    if (activeCardCurva) {
      if (activeCardFilter === 'margem_excessiva') {
        const range = MARGEM_RANGES.find(r => r.id === activeCardCurva);
        if (range) {
          filtered = filtered.filter(p => {
            const excesso = p.margemCalculada - p.margemRef;
            return excesso >= range.min && excesso <= range.max;
          });
        }
      } else if (activeCardFilter === 'estoque_excessivo') {
        if (activeCardCurva === 'nunca') {
          // Nunca vendido: sem registro de venda (diasSemVenda >= 999) e tem estoque
          filtered = filtered.filter(p => p.estoque > 0 && p.diasSemVenda >= 999);
        } else if (activeCardCurva === 'acima180') {
          // >180d: inclui produtos com cobertura > 180 dias OU vendaMedia = 0 mas já vendeu antes
          filtered = filtered.filter(p => {
            if (!p.estoque || p.estoque <= 0 || p.diasSemVenda >= 999) return false;
            const vm = p.vendaMedia || 0;
            if (vm <= 0) return true; // vendaMedia=0 mas já vendeu → cobertura infinita
            return (p.estoque / vm) >= 181;
          });
        } else {
          const range = ESTOQUE_EXCESSIVO_RANGES.find(r => r.id === activeCardCurva);
          if (range) {
            filtered = filtered.filter(p => {
              if (p.diasSemVenda >= 999) return false; // nunca vendido vai no "nunca"
              const vm = p.vendaMedia || 0;
              if (vm <= 0) return false; // vendaMedia=0 vai no ">180d"
              const diasCobertura = p.estoque / vm;
              return diasCobertura >= range.min && diasCobertura <= range.max;
            });
          }
        }
      } else if (activeCardCurva === 'X') {
        filtered = filtered.filter(p => p.curva === 'X' || !p.curva);
      } else {
        filtered = filtered.filter(p => p.curva === activeCardCurva);
      }
    }

    // Ordenação
    if (sortColumn) {
      filtered = [...filtered].sort((a, b) => {
        const aVal = a[sortColumn];
        const bVal = b[sortColumn];

        // Valores nulos/undefined vão para o final
        if (aVal == null) return 1;
        if (bVal == null) return -1;

        // Comparação numérica
        if (typeof aVal === 'number' && typeof bVal === 'number') {
          return sortDirection === 'asc' ? aVal - bVal : bVal - aVal;
        }

        // Comparação de string (case-insensitive)
        const aStr = String(aVal).toLowerCase();
        const bStr = String(bVal).toLowerCase();

        if (sortDirection === 'asc') {
          return aStr.localeCompare(bStr);
        } else {
          return bStr.localeCompare(aStr);
        }
      });
    }

    return filtered;
  }, [products, filterTipoEspecie, filterTipoEvento, filterSecao, filterGrupo, filterSubGrupo, filterCurva, activeCardFilter, activeCardCurva, sortColumn, sortDirection, pontuacaoConfig.sem_venda]);

  // Resetar filtros dependentes quando filtro pai muda
  useEffect(() => {
    // Se mudou a seção, limpa grupo e subgrupo
    setFilterGrupo('');
    setFilterSubGrupo('');
  }, [filterSecao]);

  useEffect(() => {
    // Se mudou o grupo, limpa subgrupo
    setFilterSubGrupo('');
  }, [filterGrupo]);

  // Resetar curva do card quando mudar de card
  useEffect(() => {
    setActiveCardCurva('');
  }, [activeCardFilter]);

  // Resetar para página 1 quando mudar filtros
  useEffect(() => {
    setCurrentPage(1);
  }, [filterTipoEspecie, filterTipoEvento, filterSecao, filterGrupo, filterSubGrupo, filterCurva, activeCardFilter, activeCardCurva, sortColumn, sortDirection]);

  // Produtos paginados
  const paginatedProducts = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    return filteredProducts.slice(startIndex, endIndex);
  }, [filteredProducts, currentPage, itemsPerPage]);

  // Total de páginas
  const totalPages = Math.ceil(filteredProducts.length / itemsPerPage);

  // Função para contar produtos por curva em um conjunto filtrado
  const contarPorCurva = (produtosFiltrados) => {
    const contagem = { A: 0, B: 0, C: 0, D: 0, E: 0, X: 0 };
    produtosFiltrados.forEach(p => {
      const curva = p.curva || 'X';
      if (contagem[curva] !== undefined) {
        contagem[curva]++;
      } else {
        contagem['X']++;
      }
    });
    return contagem;
  };

  // Cálculos dos cards
  const stats = useMemo(() => {
    const filtered = products.filter(p => {
      let match = true;
      if (filterTipoEspecie.length > 0) match = match && filterTipoEspecie.includes(p.tipoEspecie);
      if (filterTipoEvento.length > 0) match = match && filterTipoEvento.includes(p.tipoEvento);
      return match;
    });

    // Calcular valor total do estoque (estoque * custo)
    const valorTotalEstoque = filtered.reduce((total, p) => {
      const valorItem = (p.estoque || 0) * (p.valCustoRep || 0);
      return total + valorItem;
    }, 0);

    // Filtros para cada indicador
    const produtosZerado = filtered.filter(p => p.estoque === 0);
    const produtosNegativo = filtered.filter(p => p.estoque < 0);

    // Sem Venda: filtrar por curva com dias específicos de cada curva
    const contarSemVendaPorCurva = () => {
      const contagem = { A: 0, B: 0, C: 0, D: 0, E: 0, X: 0 };
      filtered.forEach(p => {
        const curva = p.curva || 'X';
        const curvaKey = ['A', 'B', 'C', 'D', 'E', 'X'].includes(curva) ? curva : 'X';
        const diasLimite = pontuacaoConfig.sem_venda?.[curvaKey]?.dias || 30;
        if (p.diasSemVenda > diasLimite) {
          contagem[curvaKey]++;
        }
      });
      return contagem;
    };
    const semVendaPorCurva = contarSemVendaPorCurva();
    const totalSemVenda = Object.values(semVendaPorCurva).reduce((a, b) => a + b, 0);

    // Produtos sem venda para filtro (usa dias do próprio produto conforme sua curva)
    const produtosSemVenda = filtered.filter(p => {
      const curva = p.curva || 'X';
      const curvaKey = ['A', 'B', 'C', 'D', 'E', 'X'].includes(curva) ? curva : 'X';
      const diasLimite = pontuacaoConfig.sem_venda?.[curvaKey]?.dias || 30;
      return p.diasSemVenda > diasLimite;
    });

    const produtosMargemNegativa = filtered.filter(p => p.margemCalculada < 0);
    const produtosMargemBaixa = filtered.filter(p => p.margemCalculada < p.margemRef && p.margemCalculada >= 0);
    const produtosCustoZerado = filtered.filter(p => !p.valCustoRep || p.valCustoRep === 0);
    const produtosPrecoZerado = filtered.filter(p => !p.valvenda || p.valvenda === 0);
    const produtosCurvaX = filtered.filter(p => p.curva === 'X' || !p.curva);

    // Estoque Mínimo Pré Ruptura: estoque atual <= estoque mínimo calculado
    const produtosPreRuptura = filtered.filter(p => {
      if (!p.estoqueMinCalc || p.estoqueMinCalc === 0) return false;
      return p.estoque <= p.estoqueMinCalc;
    });

    // Concorrente + Barato: produtos onde concorrente vende mais barato
    const produtosConcBarato = filtered.filter(p => {
      return p.valPesquisaMedia > 0 && p.valvenda > 0 && p.valPesquisaMedia < p.valvenda;
    });

    // Margem Excessiva: margem calculada acima da meta
    const produtosMargemExcessiva = filtered.filter(p => {
      if (!p.margemRef || p.margemRef === 0) return false;
      return p.margemCalculada > p.margemRef;
    });
    // Contar por faixa de excesso
    const margemExcessivaPorFaixa = {};
    MARGEM_RANGES.forEach(range => { margemExcessivaPorFaixa[range.id] = 0; });
    produtosMargemExcessiva.forEach(p => {
      const excesso = p.margemCalculada - p.margemRef;
      for (const range of MARGEM_RANGES) {
        if (excesso >= range.min && excesso <= range.max) {
          margemExcessivaPorFaixa[range.id]++;
          break;
        }
      }
    });

    // Estoque Excessivo: produtos com estoque > 0 classificados por dias de cobertura
    const estoqueExcessivoPorFaixa = {};
    ESTOQUE_EXCESSIVO_RANGES.forEach(range => { estoqueExcessivoPorFaixa[range.id] = 0; });
    const produtosEstoqueExcessivo = filtered.filter(p => {
      if (!p.estoque || p.estoque <= 0) return false;
      // "Nunca Vendido" = sem data de última venda (diasSemVenda >= 999 = sem registro de venda)
      if (p.diasSemVenda >= 999) {
        estoqueExcessivoPorFaixa.nunca++;
        return true;
      }
      const vm = p.vendaMedia || 0;
      if (vm <= 0) {
        // Tem histórico de venda mas média arredondou para 0 → cobertura infinita → >180d
        estoqueExcessivoPorFaixa.acima180++;
        return true;
      }
      const diasCobertura = p.estoque / vm;
      for (const range of ESTOQUE_EXCESSIVO_RANGES) {
        if (range.id === 'nunca') continue;
        if (diasCobertura >= range.min && diasCobertura <= range.max) {
          estoqueExcessivoPorFaixa[range.id]++;
          return true;
        }
      }
      return false;
    });

    return {
      estoqueZerado: produtosZerado.length,
      estoqueNegativo: produtosNegativo.length,
      semVenda30Dias: totalSemVenda,
      preRuptura: produtosPreRuptura.length,
      margemNegativa: produtosMargemNegativa.length,
      margemAbaixoMeta: produtosMargemBaixa.length,
      custoZerado: produtosCustoZerado.length,
      precoVendaZerado: produtosPrecoZerado.length,
      curvaX: produtosCurvaX.length,
      concBarato: produtosConcBarato.length,
      margemExcessiva: produtosMargemExcessiva.length,
      estoqueExcessivo: produtosEstoqueExcessivo.length,
      total: filtered.length,
      valorTotalEstoque,
      // Contagem por curva para cada indicador
      curvasPorIndicador: {
        zerado: contarPorCurva(produtosZerado),
        negativo: contarPorCurva(produtosNegativo),
        sem_venda: semVendaPorCurva,
        pre_ruptura: contarPorCurva(produtosPreRuptura),
        margem_negativa: contarPorCurva(produtosMargemNegativa),
        margem_baixa: contarPorCurva(produtosMargemBaixa),
        custo_zerado: contarPorCurva(produtosCustoZerado),
        preco_venda_zerado: contarPorCurva(produtosPrecoZerado),
        curva_x: contarPorCurva(produtosCurvaX),
        conc_barato: contarPorCurva(produtosConcBarato),
        margem_excessiva: margemExcessivaPorFaixa,
        estoque_excessivo: estoqueExcessivoPorFaixa,
      }
    };
  }, [products, filterTipoEspecie, filterTipoEvento, pontuacaoConfig.sem_venda]);

  // Calcular pontos para cada produto (para a visualização de pontuação)
  const produtosComPontuacao = useMemo(() => {
    const produtos = filteredProducts.map(p => {
      const curva = p.curva || 'X';
      const curvaKey = ['A', 'B', 'C', 'D', 'E', 'X'].includes(curva) ? curva : 'X';

      // Calcular pontos para cada indicador
      const pontosZerado = p.estoque === 0 ? (pontuacaoConfig.zerado?.[curvaKey] || 0) : 0;
      const pontosNegativo = p.estoque < 0 ? (pontuacaoConfig.negativo?.[curvaKey] || 0) : 0;

      // Sem venda: verificar se dias sem venda > limite da curva
      const diasLimite = pontuacaoConfig.sem_venda?.[curvaKey]?.dias || 30;
      const pontosSemVenda = p.diasSemVenda > diasLimite ? (pontuacaoConfig.sem_venda?.[curvaKey]?.pontos || 0) : 0;

      const pontosPreRuptura = (p.estoqueMinCalc > 0 && p.estoque > 0 && p.estoque < p.estoqueMinCalc) ? (pontuacaoConfig.pre_ruptura?.[curvaKey] || 0) : 0;
      const pontosMargemNegativa = p.margemCalculada < 0 ? (pontuacaoConfig.margem_negativa?.[curvaKey] || 0) : 0;
      const pontosMargemBaixa = (p.margemCalculada < p.margemRef && p.margemCalculada >= 0) ? (pontuacaoConfig.margem_baixa?.[curvaKey] || 0) : 0;
      const pontosCustoZerado = (!p.valCustoRep || p.valCustoRep === 0) ? (pontuacaoConfig.custo_zerado?.[curvaKey] || 0) : 0;
      const pontosPrecoZerado = (!p.valvenda || p.valvenda === 0) ? (pontuacaoConfig.preco_venda_zerado?.[curvaKey] || 0) : 0;
      const pontosConcBarato = (p.valPesquisaMedia > 0 && p.valvenda > 0 && p.valPesquisaMedia < p.valvenda) ? (pontuacaoConfig.conc_barato?.[curvaKey] || 0) : 0;

      // Margem excessiva: pontos por faixa de excesso
      let pontosMargemExcessiva = 0;
      if (p.margemRef > 0 && p.margemCalculada > p.margemRef) {
        const excesso = p.margemCalculada - p.margemRef;
        for (const range of MARGEM_RANGES) {
          if (excesso >= range.min && excesso <= range.max) {
            pontosMargemExcessiva = pontuacaoConfig.margem_excessiva?.[range.id] || 0;
            break;
          }
        }
      }

      // Estoque excessivo: pontos por faixa de dias de cobertura
      let pontosEstoqueExcessivo = 0;
      if (p.estoque > 0) {
        if (p.diasSemVenda >= 999) {
          // Nunca vendido
          pontosEstoqueExcessivo = pontuacaoConfig.estoque_excessivo?.nunca || 0;
        } else {
          const vm = p.vendaMedia || 0;
          if (vm <= 0) {
            // Já vendeu mas média é 0 → cobertura infinita → >180d
            pontosEstoqueExcessivo = pontuacaoConfig.estoque_excessivo?.acima180 || 0;
          } else {
            const diasCobertura = p.estoque / vm;
            for (const range of ESTOQUE_EXCESSIVO_RANGES) {
              if (range.id === 'nunca') continue;
              if (diasCobertura >= range.min && diasCobertura <= range.max) {
                pontosEstoqueExcessivo = pontuacaoConfig.estoque_excessivo?.[range.id] || 0;
                break;
              }
            }
          }
        }
      }

      // Totais separados por categoria
      const totalPontosEstoque = pontosZerado + pontosNegativo + pontosSemVenda + pontosPreRuptura + pontosEstoqueExcessivo;
      const totalPontosMargem = pontosMargemNegativa + pontosMargemBaixa + pontosCustoZerado + pontosPrecoZerado + pontosConcBarato + pontosMargemExcessiva;
      const totalPontos = totalPontosEstoque + totalPontosMargem;

      return {
        ...p,
        pontosZerado,
        pontosNegativo,
        pontosSemVenda,
        pontosPreRuptura,
        pontosMargemNegativa,
        pontosMargemBaixa,
        pontosCustoZerado,
        pontosPrecoZerado,
        pontosConcBarato,
        pontosMargemExcessiva,
        pontosEstoqueExcessivo,
        totalPontos,
        totalPontosEstoque,
        totalPontosMargem
      };
    }).filter(p => p.totalPontos > 0); // Mostrar apenas produtos com pontuação > 0

    // Ordenar baseado em sortPontuacao
    const { column, direction } = sortPontuacao;
    return [...produtos].sort((a, b) => {
      let aVal = a[column];
      let bVal = b[column];

      // Para strings (codigo, descricao, curva)
      if (typeof aVal === 'string' && typeof bVal === 'string') {
        return direction === 'asc'
          ? aVal.localeCompare(bVal, 'pt-BR')
          : bVal.localeCompare(aVal, 'pt-BR');
      }

      // Para números
      aVal = aVal || 0;
      bVal = bVal || 0;
      return direction === 'asc' ? aVal - bVal : bVal - aVal;
    });
  }, [filteredProducts, pontuacaoConfig, sortPontuacao]);

  // Função para alternar ordenação da tabela de pontuação
  const handleSortPontuacao = (column) => {
    setSortPontuacao(prev => ({
      column,
      direction: prev.column === column && prev.direction === 'desc' ? 'asc' : 'desc'
    }));
  };

  // Calcular contagens de risco (baseado no viewMode ativo)
  const riskCounts = useMemo(() => {
    const counts = {
      semRisco: 0,
      moderado: 0,
      critico: 0,
      muitoCritico: 0
    };

    produtosComPontuacao.forEach(p => {
      const pontos = viewMode === 'pontuacaoEstoque' ? (p.totalPontosEstoque || 0)
        : viewMode === 'pontuacaoMargem' ? (p.totalPontosMargem || 0)
        : (p.totalPontos || 0);
      if (pontos >= riskConfig.muitoCritico.min) {
        counts.muitoCritico++;
      } else if (pontos >= riskConfig.critico.min && pontos <= riskConfig.critico.max) {
        counts.critico++;
      } else if (pontos >= riskConfig.moderado.min && pontos <= riskConfig.moderado.max) {
        counts.moderado++;
      } else if (pontos === 0) {
        counts.semRisco++;
      }
    });

    // Adicionar produtos com 0 pontos que não estão em produtosComPontuacao
    counts.semRisco = filteredProducts.length - produtosComPontuacao.length;

    return counts;
  }, [produtosComPontuacao, filteredProducts, riskConfig, viewMode]);

  // Filtrar produtos por nível de risco (baseado no viewMode ativo)
  const produtosFiltradosPorRisco = useMemo(() => {
    if (!activeRiskFilter) return produtosComPontuacao;

    return produtosComPontuacao.filter(p => {
      const pontos = viewMode === 'pontuacaoEstoque' ? (p.totalPontosEstoque || 0)
        : viewMode === 'pontuacaoMargem' ? (p.totalPontosMargem || 0)
        : (p.totalPontos || 0);
      switch (activeRiskFilter) {
        case 'muitoCritico':
          return pontos >= riskConfig.muitoCritico.min;
        case 'critico':
          return pontos >= riskConfig.critico.min && pontos <= riskConfig.critico.max;
        case 'moderado':
          return pontos >= riskConfig.moderado.min && pontos <= riskConfig.moderado.max;
        case 'semRisco':
          return pontos === 0;
        default:
          return true;
      }
    });
  }, [produtosComPontuacao, activeRiskFilter, riskConfig, viewMode]);

  // Resetar página de pontuação quando filtro de risco muda
  useEffect(() => {
    setCurrentPagePontuacao(1);
  }, [activeRiskFilter]);

  // Lista de produtos para a tabela de pontuação (com ou sem filtro de risco)
  const produtosPontuacaoList = activeRiskFilter ? produtosFiltradosPorRisco : produtosComPontuacao;

  // Paginação da tabela de pontuação
  const paginatedProdutosPontuacao = useMemo(() => {
    const startIndex = (currentPagePontuacao - 1) * itemsPerPagePontuacao;
    const endIndex = startIndex + itemsPerPagePontuacao;
    return produtosPontuacaoList.slice(startIndex, endIndex);
  }, [produtosPontuacaoList, currentPagePontuacao, itemsPerPagePontuacao]);

  const totalPagesPontuacao = Math.ceil(produtosPontuacaoList.length / itemsPerPagePontuacao);

  // Renderizar célula da tabela de pontuação
  const renderPontuacaoCell = (product, col) => {
    switch (col.id) {
      case 'codigo':
        return <td key={col.id} className="px-3 py-2 text-sm text-gray-900 font-mono">{product.codigo}</td>;
      case 'descricao':
        return <td key={col.id} className="px-3 py-2 text-sm text-gray-900 max-w-xs truncate" title={product.descricao}>{product.descricao}</td>;
      case 'curva':
        return (
          <td key={col.id} className="px-3 py-2 text-center">
            <span className={`px-2 py-1 rounded text-xs font-bold ${
              product.curva === 'A' ? 'bg-green-100 text-green-800' :
              product.curva === 'B' ? 'bg-blue-100 text-blue-800' :
              product.curva === 'C' ? 'bg-yellow-100 text-yellow-800' :
              product.curva === 'D' ? 'bg-orange-100 text-orange-800' :
              product.curva === 'E' ? 'bg-red-100 text-red-800' :
              'bg-gray-100 text-gray-800'
            }`}>{product.curva || 'X'}</span>
          </td>
        );
      case 'estoque':
        return (
          <td key={col.id} className={`px-3 py-2 text-center text-sm ${product.estoque < 0 ? 'text-red-600 font-bold' : product.estoque === 0 ? 'text-orange-600' : 'text-gray-700'}`}>
            {product.estoque?.toFixed(2).replace('.', ',') || '0'}
          </td>
        );
      case 'diasSemVenda':
        return (
          <td key={col.id} className="px-3 py-2 text-center text-sm text-gray-700">
            {product.diasSemVenda === 999 ? 'Nunca' : product.diasSemVenda === 0 ? 'Hoje' : `${product.diasSemVenda} d`}
          </td>
        );
      case 'valPesquisaMedia': {
        const val = product.valPesquisaMedia || 0;
        const precoVenda = product.valvenda || 0;
        const isCheaper = val > 0 && precoVenda > 0 && val < precoVenda;
        const isMoreExpensive = val > 0 && precoVenda > 0 && val > precoVenda;
        return (
          <td key={col.id} className={`px-3 py-2 text-center text-sm font-medium ${isCheaper ? 'text-red-600' : isMoreExpensive ? 'text-green-600' : 'text-gray-500'}`}
              title={product.desPesquisaConcorrente ? `Concorrente: ${product.desPesquisaConcorrente}` : ''}>
            {val > 0 ? `R$ ${val.toFixed(2).replace('.', ',')}` : '-'}
          </td>
        );
      }
      case 'desPesquisaConcorrente':
        return (
          <td key={col.id} className="px-3 py-2 text-sm text-gray-700 min-w-[120px]" title={product.desPesquisaConcorrente}>
            {product.desPesquisaConcorrente || '-'}
          </td>
        );
      case 'desSecao':
        return (
          <td key={col.id} className="px-3 py-2 text-sm text-gray-700 min-w-[150px]" title={product.desSecao}>
            {product.desSecao || '-'}
          </td>
        );
      case 'fornecedor':
        return (
          <td key={col.id} className="px-3 py-2 text-sm text-gray-700 min-w-[120px]" title={product.fantasiaForn}>
            {product.fantasiaForn || '-'}
          </td>
        );
      case 'historico':
        return (
          <td key={col.id} className="px-2 py-2 text-center">
            <button
              onClick={() => fetchPurchaseHistory(product)}
              className="p-1.5 bg-blue-100 hover:bg-blue-200 text-blue-700 rounded-full transition-colors"
              title="Ver histórico de compras"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </button>
          </td>
        );
      case 'qtdPedidoCompra':
        return (
          <td key={col.id} className="px-3 py-2 text-center">
            <span className={`px-2 py-1 rounded text-xs font-semibold ${
              product.qtdPedidoCompra > 0 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
            }`}>
              {product.qtdPedidoCompra > 0 ? 'Sim' : 'Não'}
            </span>
          </td>
        );
      case 'pontosZerado':
        return <td key={col.id} className={`px-3 py-2 text-center text-sm font-bold ${product.pontosZerado > 0 ? 'text-red-600 bg-red-50' : 'text-gray-400'}`}>{product.pontosZerado > 0 ? product.pontosZerado : '-'}</td>;
      case 'pontosNegativo':
        return <td key={col.id} className={`px-3 py-2 text-center text-sm font-bold ${product.pontosNegativo > 0 ? 'text-red-700 bg-red-50' : 'text-gray-400'}`}>{product.pontosNegativo > 0 ? product.pontosNegativo : '-'}</td>;
      case 'pontosSemVenda':
        return <td key={col.id} className={`px-3 py-2 text-center text-sm font-bold ${product.pontosSemVenda > 0 ? 'text-orange-600 bg-orange-50' : 'text-gray-400'}`}>{product.pontosSemVenda > 0 ? product.pontosSemVenda : '-'}</td>;
      case 'pontosMargemNegativa':
        return <td key={col.id} className={`px-3 py-2 text-center text-sm font-bold ${product.pontosMargemNegativa > 0 ? 'text-red-800 bg-red-50' : 'text-gray-400'}`}>{product.pontosMargemNegativa > 0 ? product.pontosMargemNegativa : '-'}</td>;
      case 'pontosMargemBaixa':
        return <td key={col.id} className={`px-3 py-2 text-center text-sm font-bold ${product.pontosMargemBaixa > 0 ? 'text-yellow-600 bg-yellow-50' : 'text-gray-400'}`}>{product.pontosMargemBaixa > 0 ? product.pontosMargemBaixa : '-'}</td>;
      case 'pontosCustoZerado':
        return <td key={col.id} className={`px-3 py-2 text-center text-sm font-bold ${product.pontosCustoZerado > 0 ? 'text-purple-600 bg-purple-50' : 'text-gray-400'}`}>{product.pontosCustoZerado > 0 ? product.pontosCustoZerado : '-'}</td>;
      case 'pontosPrecoZerado':
        return <td key={col.id} className={`px-3 py-2 text-center text-sm font-bold ${product.pontosPrecoZerado > 0 ? 'text-pink-600 bg-pink-50' : 'text-gray-400'}`}>{product.pontosPrecoZerado > 0 ? product.pontosPrecoZerado : '-'}</td>;
      case 'pontosConcBarato':
        return <td key={col.id} className={`px-3 py-2 text-center text-sm font-bold ${product.pontosConcBarato > 0 ? 'text-blue-600 bg-blue-50' : 'text-gray-400'}`}>{product.pontosConcBarato > 0 ? product.pontosConcBarato : '-'}</td>;
      case 'pontosMargemExcessiva':
        return <td key={col.id} className={`px-3 py-2 text-center text-sm font-bold ${product.pontosMargemExcessiva > 0 ? 'text-emerald-600 bg-emerald-50' : 'text-gray-400'}`}>{product.pontosMargemExcessiva > 0 ? product.pontosMargemExcessiva : '-'}</td>;
      case 'pontosEstoqueExcessivo':
        return <td key={col.id} className={`px-3 py-2 text-center text-sm font-bold ${product.pontosEstoqueExcessivo > 0 ? 'text-amber-600 bg-amber-50' : 'text-gray-400'}`}>{product.pontosEstoqueExcessivo > 0 ? product.pontosEstoqueExcessivo : '-'}</td>;
      case 'pontosPreRuptura':
        return <td key={col.id} className={`px-3 py-2 text-center text-sm font-bold ${product.pontosPreRuptura > 0 ? 'text-amber-600 bg-amber-50' : 'text-gray-400'}`}>{product.pontosPreRuptura > 0 ? product.pontosPreRuptura : '-'}</td>;
      case 'totalPontos':
        return <td key={col.id} className="px-3 py-2 text-center text-sm font-bold text-white bg-gray-800">{product.totalPontos}</td>;
      case 'totalPontosEstoque':
        return <td key={col.id} className="px-3 py-2 text-center text-sm font-bold text-white bg-gray-800">{product.totalPontosEstoque || 0}</td>;
      case 'totalPontosMargem':
        return <td key={col.id} className="px-3 py-2 text-center text-sm font-bold text-white bg-gray-800">{product.totalPontosMargem || 0}</td>;
      case 'nivelRisco': {
        const pontos = viewMode === 'pontuacaoEstoque' ? (product.totalPontosEstoque || 0)
          : viewMode === 'pontuacaoMargem' ? (product.totalPontosMargem || 0)
          : (product.totalPontos || 0);
        let nivel = { label: 'SEM RISCO', color: 'bg-green-500 text-white' };
        if (pontos >= riskConfig.muitoCritico.min) {
          nivel = { label: 'MUITO CRÍTICO', color: 'bg-red-600 text-white' };
        } else if (pontos >= riskConfig.critico.min && pontos <= riskConfig.critico.max) {
          nivel = { label: 'CRÍTICO', color: 'bg-orange-500 text-white' };
        } else if (pontos >= riskConfig.moderado.min && pontos <= riskConfig.moderado.max) {
          nivel = { label: 'MODERADO', color: 'bg-yellow-500 text-white' };
        }
        return (
          <td key={col.id} className={`px-3 py-2 text-center text-xs font-bold ${nivel.color}`}>
            {nivel.label}
          </td>
        );
      }
      default:
        return <td key={col.id} className="px-3 py-2 text-center text-sm text-gray-700">-</td>;
    }
  };

  // Renderizar valor da célula
  const renderCellValue = (product, columnId) => {
    const value = product[columnId];

    switch (columnId) {
      // Valores monetários
      case 'valCustoRep':
      case 'valvendaloja':
      case 'valvenda':
        if (value == null) return 'R$ 0,00';
        if (value === 0) return 'R$ 0,00';
        return `R$ ${value.toFixed(2).replace('.', ',')}`;

      case 'valOferta':
        if (value == null || value === 0) return '-';
        return `R$ ${value.toFixed(2).replace('.', ',')}`;

      // Estoque
      case 'estoque':
      case 'estoqueMaximo':
        if (value == null) return '0,00';
        return value.toFixed(2).replace('.', ',');

      case 'estoqueMinCalc': {
        if (value == null || value === 0) return '-';
        const diasRep = (product.numFreqVisita || 0) + (product.numPrazo || 0);
        const vm = product.vendaMedia || 0;
        const abaixo = product.estoque < value;
        return (
          <span
            className={abaixo ? 'text-red-600 font-bold' : ''}
            title={`Visita: ${product.numFreqVisita || 0}d + Prazo: ${product.numPrazo || 0}d = ${diasRep}d × Venda: ${vm.toFixed(2)} = ${value}`}
          >
            {value}
          </span>
        );
      }

      // Porcentagens
      case 'margemCalculada':
        if (value == null || isNaN(value) || value === 0) return '0,0%';
        return `${value.toFixed(1).replace('.', ',')}%`;

      case 'margemRef':
        if (value == null || isNaN(value) || value === 0) return '-';
        return `${value.toFixed(0)}%`;

      // Quantidades
      case 'vendaMedia':
        if (value == null || value === 0) return '0';
        return value.toFixed(2).replace('.', ',');

      case 'qtdUltCompra':
      case 'qtdPedidoCompra':
        if (value == null) return '-';
        if (value === 0) return '0';
        return value.toString();

      case 'diasCobertura':
        if (value == null || value === 0) return '-';
        return `${value} dias`;

      // Datas
      case 'dtaUltCompra':
      case 'dtaCadastro':
        if (!value) return '-';
        return new Date(value).toLocaleDateString('pt-BR');

      // Dias sem venda
      case 'diasSemVenda':
        if (value === 999) return 'Nunca vendeu';
        if (value === 0) return 'Hoje';
        if (value === 1) return '1 dia';
        return `${value} dias`;

      // Curva
      case 'curva':
        if (!value || value === '') return 'X';
        return value;

      // Concorrência
      case 'valPesquisaMedia':
        if (value == null || value === 0) return '-';
        return `R$ ${value.toFixed(2).replace('.', ',')}`;

      case 'desPesquisaConcorrente':
        if (!value || value === '') return '-';
        return value;

      // Texto padrão
      default:
        if (value == null || value === '') return '-';
        return value;
    }
  };

  // Função para exportar para PDF
  const exportToPDF = () => {
    // Verificar se está na aba de pontuação ou geral
    if (viewMode === 'pontuacaoEstoque' || viewMode === 'pontuacaoMargem') {
      // Exportar tabela de pontuação
      if (produtosPontuacaoList.length === 0) {
        alert('Nenhum produto com pontuação encontrado!');
        return;
      }

      const doc = new jsPDF('landscape');

      // Título
      doc.setFontSize(16);
      doc.text('Relatório de Pontuação - Saúde do Estoque', 14, 15);

      // Subtítulo com filtro de risco
      doc.setFontSize(10);
      let subtitle = 'Filtro de Risco: ';
      if (activeRiskFilter) {
        const riskLabels = {
          muitoCritico: 'MUITO CRÍTICO',
          critico: 'CRÍTICO',
          moderado: 'MODERADO',
          semRisco: 'SEM RISCO'
        };
        subtitle += riskLabels[activeRiskFilter] || 'Todos';
      } else {
        subtitle += 'Todos os níveis';
      }
      doc.text(subtitle, 14, 22);

      // Preparar colunas da pontuação
      const headers = [activePontuacaoColumns.map(col => col.label)];

      // Função para obter nível de risco
      const getNivelRisco = (pontos) => {
        if (pontos >= riskConfig.muitoCritico.min) return 'MUITO CRÍTICO';
        if (pontos >= riskConfig.critico.min && pontos <= riskConfig.critico.max) return 'CRÍTICO';
        if (pontos >= riskConfig.moderado.min && pontos <= riskConfig.moderado.max) return 'MODERADO';
        return 'SEM RISCO';
      };

      // Preparar dados
      const data = produtosPontuacaoList.map(product =>
        activePontuacaoColumns.map(col => {
          switch (col.id) {
            case 'codigo': return product.codigo || '-';
            case 'descricao': return product.descricao || '-';
            case 'curva': return product.curva || 'X';
            case 'estoque': return product.estoque?.toFixed(2).replace('.', ',') || '0';
            case 'diasSemVenda':
              if (product.diasSemVenda === 999) return 'Nunca';
              if (product.diasSemVenda === 0) return 'Hoje';
              return `${product.diasSemVenda} d`;
            case 'desSecao': return product.desSecao || '-';
            case 'qtdPedidoCompra': return product.qtdPedidoCompra > 0 ? 'Sim' : 'Não';
            case 'pontosZerado': return product.pontosZerado > 0 ? product.pontosZerado.toString() : '-';
            case 'pontosNegativo': return product.pontosNegativo > 0 ? product.pontosNegativo.toString() : '-';
            case 'pontosSemVenda': return product.pontosSemVenda > 0 ? product.pontosSemVenda.toString() : '-';
            case 'pontosMargemNegativa': return product.pontosMargemNegativa > 0 ? product.pontosMargemNegativa.toString() : '-';
            case 'pontosMargemBaixa': return product.pontosMargemBaixa > 0 ? product.pontosMargemBaixa.toString() : '-';
            case 'pontosCustoZerado': return product.pontosCustoZerado > 0 ? product.pontosCustoZerado.toString() : '-';
            case 'pontosPrecoZerado': return product.pontosPrecoZerado > 0 ? product.pontosPrecoZerado.toString() : '-';
            case 'pontosConcBarato': return product.pontosConcBarato > 0 ? product.pontosConcBarato.toString() : '-';
            case 'pontosMargemExcessiva': return product.pontosMargemExcessiva > 0 ? product.pontosMargemExcessiva.toString() : '-';
            case 'pontosEstoqueExcessivo': return product.pontosEstoqueExcessivo > 0 ? product.pontosEstoqueExcessivo.toString() : '-';
            case 'pontosPreRuptura': return (product.pontosPreRuptura || 0) > 0 ? product.pontosPreRuptura.toString() : '-';
            case 'totalPontos': return product.totalPontos.toString();
            case 'totalPontosEstoque': return (product.totalPontosEstoque || 0).toString();
            case 'totalPontosMargem': return (product.totalPontosMargem || 0).toString();
            case 'nivelRisco': {
              const pts = viewMode === 'pontuacaoEstoque' ? (product.totalPontosEstoque || 0)
                : viewMode === 'pontuacaoMargem' ? (product.totalPontosMargem || 0)
                : (product.totalPontos || 0);
              return getNivelRisco(pts);
            }
            default: return '-';
          }
        })
      );

      // Gerar tabela
      autoTable(doc, {
        head: headers,
        body: data,
        startY: 28,
        styles: {
          fontSize: 7,
          cellPadding: 2
        },
        headStyles: {
          fillColor: [249, 115, 22], // orange-500
          textColor: 255,
          fontStyle: 'bold'
        },
        alternateRowStyles: {
          fillColor: [249, 250, 251] // gray-50
        },
        columnStyles: {
          0: { cellWidth: 18 }, // Código
          1: { cellWidth: 45 }, // Descrição
        },
        margin: { top: 28 }
      });

      // Adicionar rodapé
      const pageCount = doc.internal.getNumberOfPages();
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.text(
          `Página ${i} de ${pageCount} | Total de produtos: ${produtosPontuacaoList.length} | Gerado em ${new Date().toLocaleString('pt-BR')}`,
          14,
          doc.internal.pageSize.height - 10
        );
      }

      // Salvar PDF
      const filename = `estoque_pontuacao_${new Date().toISOString().slice(0, 10)}.pdf`;
      doc.save(filename);

    } else {
      // Exportar tabela geral (comportamento original)
      if (filteredProducts.length === 0) {
        alert('Nenhum produto encontrado com os filtros aplicados!');
        return;
      }

      const doc = new jsPDF('landscape');

      // Título
      doc.setFontSize(16);
      doc.text('Relatório de Estoque e Margem', 14, 15);

      // Subtítulo com filtros aplicados
      doc.setFontSize(10);
      let subtitle = 'Filtros: ';
      const filtrosAtivos = [];
      if (filterSecao) filtrosAtivos.push(`Seção: ${filterSecao}`);
      if (filterGrupo) filtrosAtivos.push(`Grupo: ${filterGrupo}`);
      if (filterSubGrupo) filtrosAtivos.push(`Subgrupo: ${filterSubGrupo}`);
      if (activeCardFilter) {
        const filterLabels = {
          zerado: 'Estoque Zerado',
          negativo: 'Estoque Negativo',
          sem_venda: 'Sem Venda',
          margem_negativa: 'Margem Negativa',
          margem_baixa: 'Margem Abaixo da Meta',
          custo_zerado: 'Custo Zerado',
          preco_venda_zerado: 'Preço Venda Zerado'
        };
        filtrosAtivos.push(filterLabels[activeCardFilter]);
      }
      subtitle += filtrosAtivos.length > 0 ? filtrosAtivos.join(', ') : 'Nenhum';
      doc.text(subtitle, 14, 22);

      // Preparar colunas visíveis
      const visibleCols = columns.filter(col => col.visible);
      const headers = [visibleCols.map(col => col.label)];

      // Preparar dados
      const data = filteredProducts.map(product =>
        visibleCols.map(col => {
          const value = product[col.id];

          // Formatar valores para PDF
          switch (col.id) {
            case 'valCustoRep':
            case 'valvendaloja':
            case 'valvenda':
            case 'valOferta':
              if (value == null || value === 0) return 'R$ 0,00';
              return `R$ ${value.toFixed(2).replace('.', ',')}`;

            case 'estoque':
            case 'vendaMedia':
            case 'margemRef':
            case 'margemCalculada':
              if (value == null || value === 0) return '0';
              return value.toFixed(2).replace('.', ',');

            case 'qtdUltCompra':
            case 'qtdPedidoCompra':
              if (value == null) return '-';
              if (value === 0) return '0';
              return value.toString();

            case 'estoqueMinCalc':
              if (value == null || value === 0) return '-';
              return value.toString();

            case 'diasCobertura':
              if (value == null || value === 0) return '-';
              return `${value} dias`;

            case 'dtaUltCompra':
            case 'dtaCadastro':
              if (!value) return '-';
              return new Date(value).toLocaleDateString('pt-BR');

            case 'diasSemVenda':
              if (value === 999) return 'Nunca vendeu';
              if (value === 0) return 'Hoje';
              if (value === 1) return '1 dia';
              return `${value} dias`;

            default:
              if (value == null || value === '') return '-';
              return String(value);
          }
        })
      );

      // Gerar tabela
      autoTable(doc, {
        head: headers,
        body: data,
        startY: 28,
        styles: {
          fontSize: 8,
          cellPadding: 2
        },
        headStyles: {
          fillColor: [249, 115, 22], // orange-500
          textColor: 255,
          fontStyle: 'bold'
        },
        alternateRowStyles: {
          fillColor: [249, 250, 251] // gray-50
        },
        margin: { top: 28 }
      });

      // Adicionar rodapé com data e total de registros
      const pageCount = doc.internal.getNumberOfPages();
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.text(
          `Página ${i} de ${pageCount} | Total de produtos: ${filteredProducts.length} | Gerado em ${new Date().toLocaleString('pt-BR')}`,
          14,
          doc.internal.pageSize.height - 10
        );
      }

      // Salvar PDF
      const filename = `estoque_saude_${new Date().toISOString().slice(0, 10)}.pdf`;
      doc.save(filename);
    }
  };

  // Função para exportar pedido atual para PDF
  const exportPedidoToPDF = () => {
    if (selectedForPedido.size === 0) return;

    const doc = new jsPDF('portrait');

    // Título
    doc.setFontSize(18);
    doc.text('PEDIDO DE COMPRAS', 105, 20, { align: 'center' });

    // Subtítulo
    doc.setFontSize(10);
    doc.text(`Data: ${new Date().toLocaleDateString('pt-BR')}`, 14, 30);
    doc.text(`Total de itens: ${selectedForPedido.size}`, 14, 36);

    // Preparar dados
    const headers = [['Código', 'EAN', 'Descrição', 'Seção', 'Fornecedor', 'Tipo', 'Emb.', 'Qtd']];
    const data = produtosSelecionadosPedido.map(item => [
      item.codigo,
      item.ean || '-',
      item.descricao.substring(0, 30) + (item.descricao.length > 30 ? '...' : ''),
      (item.desSecao || '-').substring(0, 12),
      (item.fornecedor || '-').substring(0, 15),
      item.desEmbalagem || '-',
      item.qtdEmbalagemCompra || 1,
      pedidoQuantidades[item.codigo] || 1
    ]);

    // Gerar tabela
    autoTable(doc, {
      head: headers,
      body: data,
      startY: 42,
      styles: {
        fontSize: 7,
        cellPadding: 2
      },
      headStyles: {
        fillColor: [234, 88, 12], // orange-600
        textColor: 255,
        fontStyle: 'bold'
      },
      alternateRowStyles: {
        fillColor: [255, 247, 237] // orange-50
      },
      columnStyles: {
        0: { cellWidth: 16 },
        1: { cellWidth: 24 },
        2: { cellWidth: 45 },
        3: { cellWidth: 20 },
        4: { cellWidth: 25 },
        5: { cellWidth: 12, halign: 'center' },
        6: { cellWidth: 12, halign: 'center' },
        7: { cellWidth: 12, halign: 'center' }
      }
    });

    // Rodapé
    const pageCount = doc.internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.text(
        `Página ${i} de ${pageCount} | Gerado em ${new Date().toLocaleString('pt-BR')}`,
        105,
        doc.internal.pageSize.height - 10,
        { align: 'center' }
      );
    }

    doc.save(`pedido_compras_${new Date().toISOString().slice(0, 10)}.pdf`);
  };

  // Função para exportar pedido salvo para PDF
  const exportPedidoSalvoToPDF = (pedido) => {
    const doc = new jsPDF('portrait');

    // Título
    doc.setFontSize(18);
    doc.text('PEDIDO DE COMPRAS', 105, 20, { align: 'center' });

    // Subtítulo
    doc.setFontSize(10);
    doc.text(`Pedido #${pedido.id}`, 14, 30);
    doc.text(`Data: ${pedido.data}`, 14, 36);
    doc.text(`Total de itens: ${pedido.totalItens}`, 14, 42);

    // Preparar dados
    const headers = [['Código', 'EAN', 'Descrição', 'Seção', 'Fornecedor', 'Tipo', 'Emb.', 'Qtd']];
    const data = pedido.itens.map(item => [
      item.codigo,
      item.ean || '-',
      item.descricao.substring(0, 30) + (item.descricao.length > 30 ? '...' : ''),
      (item.desSecao || '-').substring(0, 12),
      (item.fornecedor || '-').substring(0, 15),
      item.desEmbalagem || '-',
      item.qtdEmbalagemCompra || 1,
      item.quantidade || 1
    ]);

    // Gerar tabela
    autoTable(doc, {
      head: headers,
      body: data,
      startY: 48,
      styles: {
        fontSize: 7,
        cellPadding: 2
      },
      headStyles: {
        fillColor: [234, 88, 12], // orange-600
        textColor: 255,
        fontStyle: 'bold'
      },
      alternateRowStyles: {
        fillColor: [255, 247, 237] // orange-50
      },
      columnStyles: {
        0: { cellWidth: 16 },
        1: { cellWidth: 24 },
        2: { cellWidth: 45 },
        3: { cellWidth: 20 },
        4: { cellWidth: 25 },
        5: { cellWidth: 12, halign: 'center' },
        6: { cellWidth: 12, halign: 'center' },
        7: { cellWidth: 12, halign: 'center' }
      }
    });

    // Rodapé
    const pageCount = doc.internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.text(
        `Página ${i} de ${pageCount} | Gerado em ${new Date().toLocaleString('pt-BR')}`,
        105,
        doc.internal.pageSize.height - 10,
        { align: 'center' }
      );
    }

    doc.save(`pedido_${pedido.id}_${new Date().toISOString().slice(0, 10)}.pdf`);
  };

  // Função para obter classe CSS da célula
  const getCellClassName = (product, columnId) => {
    const baseClass = "px-4 py-3 text-sm";

    if (columnId === 'estoque') {
      return `${baseClass} text-right font-medium ${
        product.estoque < 0 ? 'text-red-600' :
        product.estoque === 0 ? 'text-orange-600' :
        'text-gray-900'
      }`;
    }

    if (columnId === 'margemCalculada') {
      return `${baseClass} text-right font-medium ${
        product.margemCalculada < 0 ? 'text-red-600' :
        product.margemCalculada < product.margemRef ? 'text-yellow-600' :
        'text-green-600'
      }`;
    }

    if (columnId === 'diasSemVenda') {
      return `${baseClass} text-right font-medium ${
        product.diasSemVenda > 30 ? 'text-red-600' :
        product.diasSemVenda > 15 ? 'text-yellow-600' :
        'text-green-600'
      }`;
    }

    if (columnId === 'estoqueMinCalc') {
      const minCalc = product.estoqueMinCalc || 0;
      return `${baseClass} text-right font-medium ${
        minCalc > 0 && product.estoque < minCalc ? 'text-red-600' :
        minCalc > 0 ? 'text-green-600' :
        'text-gray-400'
      }`;
    }

    if (columnId === 'valCustoRep' || columnId === 'valvenda' || columnId === 'margemRef') {
      return `${baseClass} text-right text-gray-700`;
    }

    if (columnId === 'codigo') {
      return `${baseClass} font-medium text-gray-900`;
    }

    return `${baseClass} text-gray-700`;
  };

  const visibleColumns = columns.filter(col => col.visible);

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Sidebar */}
      <Sidebar
        user={user}
        onLogout={logout}
        isMobileMenuOpen={isMobileMenuOpen}
        setIsMobileMenuOpen={setIsMobileMenuOpen}
      />

      {/* Main Content */}
      <div className="flex-1 overflow-auto lg:ml-0">
        {/* Mobile Header */}
        <div className="lg:hidden bg-white shadow-sm p-4 flex items-center justify-between">
          <button
            onClick={() => setIsMobileMenuOpen(true)}
            className="p-2 text-gray-600 hover:text-gray-900"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16"/>
            </svg>
          </button>
          <h1 className="text-lg font-semibold text-gray-900">📦 Prevenção Estoque</h1>
          <button
            onClick={logout}
            className="p-2 text-gray-600 hover:text-red-600"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"/>
            </svg>
          </button>
        </div>

        {/* Content Area */}
        <div className="p-6">
          {/* Card com Gradiente Laranja */}
          <div className="hidden lg:block bg-gradient-to-br from-orange-500 to-red-600 rounded-lg shadow-lg p-6 mb-6 text-white">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl lg:text-3xl font-bold mb-2">📦 GESTÃO ESTOQUE E MARGEM</h1>
                <p className="text-white/90">
                  Monitore a saúde do seu estoque e identifique produtos críticos
                </p>
              </div>
              <div className="bg-white/20 backdrop-blur-sm rounded-full p-3">
                <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"/>
                </svg>
              </div>
            </div>
          </div>

          {/* Filtros */}
          <div className="bg-white rounded-lg shadow p-4 mb-6">
            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  🏪 Seção
                </label>
                <select
                  value={filterSecao}
                  onChange={(e) => setFilterSecao(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
                >
                  <option value="">Todas</option>
                  {filterOptions.secoes.map(secao => (
                    <option key={secao} value={secao}>{secao}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  📦 Grupo
                </label>
                <select
                  value={filterGrupo}
                  onChange={(e) => setFilterGrupo(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
                >
                  <option value="">Todos</option>
                  {filterOptions.grupos.map(grupo => (
                    <option key={grupo} value={grupo}>{grupo}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  🏷️ Subgrupo
                </label>
                <select
                  value={filterSubGrupo}
                  onChange={(e) => setFilterSubGrupo(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
                >
                  <option value="">Todos</option>
                  {filterOptions.subgrupos.map(subgrupo => (
                    <option key={subgrupo} value={subgrupo}>{subgrupo}</option>
                  ))}
                </select>
              </div>

              <div className="relative" ref={especieRef}>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  📋 Tipo Espécie
                </label>
                <button
                  type="button"
                  onClick={() => { setShowEspecieDropdown(!showEspecieDropdown); setShowEventoDropdown(false); }}
                  className="w-full px-3 py-2 uppercase border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500 bg-white text-left text-sm truncate"
                >
                  {filterTipoEspecie.length === 0 ? 'TODOS' : filterTipoEspecie.join(', ')}
                </button>
                {showEspecieDropdown && (
                  <div className="absolute z-50 mt-1 w-full bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-y-auto">
                    <label className="flex items-center gap-2 px-3 py-2 hover:bg-gray-50 cursor-pointer border-b border-gray-100 font-semibold text-sm">
                      <input type="checkbox" checked={filterTipoEspecie.length === 0} onChange={() => setFilterTipoEspecie([])} className="accent-orange-500" />
                      TODOS
                    </label>
                    {filterOptions.tipoEspecies.map(tipo => (
                      <label key={tipo} className="flex items-center gap-2 px-3 py-2 hover:bg-gray-50 cursor-pointer text-sm uppercase">
                        <input
                          type="checkbox"
                          checked={filterTipoEspecie.includes(tipo)}
                          onChange={() => {
                            setFilterTipoEspecie(prev => {
                              if (prev.includes(tipo)) {
                                return prev.filter(t => t !== tipo);
                              }
                              return [...prev, tipo];
                            });
                          }}
                          className="accent-orange-500"
                        />
                        {tipo}
                      </label>
                    ))}
                  </div>
                )}
              </div>

              <div className="relative" ref={eventoRef}>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  📄 Tipo Evento
                </label>
                <button
                  type="button"
                  onClick={() => { setShowEventoDropdown(!showEventoDropdown); setShowEspecieDropdown(false); }}
                  className="w-full px-3 py-2 uppercase border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500 bg-white text-left text-sm truncate"
                >
                  {filterTipoEvento.length === 0 ? 'TODOS' : filterTipoEvento.join(', ')}
                </button>
                {showEventoDropdown && (
                  <div className="absolute z-50 mt-1 w-full bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-y-auto">
                    <label className="flex items-center gap-2 px-3 py-2 hover:bg-gray-50 cursor-pointer border-b border-gray-100 font-semibold text-sm">
                      <input type="checkbox" checked={filterTipoEvento.length === 0} onChange={() => setFilterTipoEvento([])} className="accent-orange-500" />
                      TODOS
                    </label>
                    {filterOptions.tipoEventos.map(tipo => (
                      <label key={tipo} className="flex items-center gap-2 px-3 py-2 hover:bg-gray-50 cursor-pointer text-sm uppercase">
                        <input
                          type="checkbox"
                          checked={filterTipoEvento.includes(tipo)}
                          onChange={() => {
                            setFilterTipoEvento(prev => {
                              if (prev.includes(tipo)) {
                                return prev.filter(t => t !== tipo);
                              }
                              return [...prev, tipo];
                            });
                          }}
                          className="accent-orange-500"
                        />
                        {tipo}
                      </label>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  📊 Curva
                </label>
                <select
                  value={filterCurva}
                  onChange={(e) => setFilterCurva(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
                >
                  <option value="">Todas</option>
                  {filterOptions.curvas.map(curva => (
                    <option key={curva} value={curva}>{curva}</option>
                  ))}
                </select>
              </div>
            </div>

          </div>

          {/* Cards de Resumo - Grid único 4 colunas com headers */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            {/* Headers */}
            <div className="col-span-2 flex items-center gap-2 px-4 py-2.5 rounded-lg shadow-sm bg-gradient-to-r from-orange-500 to-amber-500">
              <span className="text-xl">📦</span>
              <h3 className="text-sm font-bold uppercase tracking-wider text-white">GESTÃO ESTOQUE</h3>
            </div>
            <div className="col-span-2 flex items-center gap-2 px-4 py-2.5 rounded-lg shadow-sm bg-gradient-to-r from-blue-600 to-indigo-500">
              <span className="text-xl">💹</span>
              <h3 className="text-sm font-bold uppercase tracking-wider text-white">GESTÃO MARGEM</h3>
            </div>
            {/* Cards intercalados: 2 estoque + 2 margem por linha */}
            {[0, 1, 2].map(row => {
              const estoqueCards = CARD_SECTIONS[0].cards.slice(row * 2, row * 2 + 2);
              const margemCards = CARD_SECTIONS[1].cards.slice(row * 2, row * 2 + 2);
              return [...estoqueCards, ...margemCards].map(cardId => {
                const cfg = CARD_CONFIG[cardId];
                if (!cfg) return null;
                const isActive = activeCardFilter === cardId;
                const isSemVenda = cardId === 'sem_venda';
                const specialRanges = cfg.specialRanges ? SPECIAL_RANGES[cardId] : null;
                return (
                  <div
                    key={cardId}
                    className={`bg-white rounded-lg shadow p-4 text-left transition-all hover:shadow-lg border-l-4 ${cfg.borderColor} ${
                      isActive ? 'ring-2 ring-orange-500 bg-orange-50' : ''
                    }`}
                  >
                  <button
                    onClick={() => setActiveCardFilter(isActive ? 'todos' : cardId)}
                    className="w-full text-left"
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-2xl">{cfg.emoji}</span>
                      <span className={`text-2xl font-bold ${cfg.textColor}`}>{stats[cfg.statKey]}</span>
                    </div>
                    <p className="text-sm font-medium text-gray-700">{cfg.label}</p>
                    {cfg.subtitle && <p className={`text-xs ${cfg.textColor} -mt-0.5`}>{cfg.subtitle}</p>}
                  </button>
                  <div className="mt-2 pt-2 border-t border-gray-100">
                    <div className="flex gap-1 justify-between items-start">
                      {specialRanges ? (
                        specialRanges.map(range => (
                          <button
                            key={range.id}
                            onClick={(e) => {
                              e.stopPropagation();
                              if (!isActive) setActiveCardFilter(cardId);
                              setActiveCardCurva(activeCardCurva === range.id ? '' : range.id);
                            }}
                            className={`flex-1 flex flex-col items-center px-1 py-2 rounded transition-all ${
                              isActive && activeCardCurva === range.id ? 'ring-2 ring-orange-500 bg-orange-100' : range.color
                            }`}
                            title={`${range.label} = ${pontuacaoConfig[cardId]?.[range.id] || 0}pts`}
                          >
                            <span className={`text-sm font-bold ${range.textColor}`}>
                              {stats.curvasPorIndicador?.[cardId]?.[range.id] || 0}
                            </span>
                            <span className="text-xs text-gray-500">{range.label}</span>
                            <span className="text-xs text-gray-500">{pontuacaoConfig[cardId]?.[range.id] || 0}pts</span>
                          </button>
                        ))
                      ) : (
                        ['A', 'B', 'C', 'D', 'E', 'X'].map(curva => (
                          <button
                            key={curva}
                            onClick={(e) => {
                              e.stopPropagation();
                              if (!isActive) setActiveCardFilter(cardId);
                              setActiveCardCurva(activeCardCurva === curva ? '' : curva);
                            }}
                            className={`flex flex-col items-center px-3 py-2 rounded transition-all ${
                              isActive && activeCardCurva === curva ? 'ring-2 ring-orange-500 bg-orange-100' : ''
                            } ${
                              curva === 'A' ? 'bg-green-50 hover:bg-green-100' :
                              curva === 'B' ? 'bg-blue-50 hover:bg-blue-100' :
                              curva === 'C' ? 'bg-yellow-50 hover:bg-yellow-100' :
                              curva === 'D' ? 'bg-orange-50 hover:bg-orange-100' :
                              curva === 'E' ? 'bg-red-50 hover:bg-red-100' : 'bg-gray-50 hover:bg-gray-100'
                            }`}
                            title={isSemVenda
                              ? `Curva ${curva}: >${pontuacaoConfig.sem_venda?.[curva]?.dias || 0} dias = ${pontuacaoConfig.sem_venda?.[curva]?.pontos || 0}pts`
                              : `Filtrar curva ${curva}`
                            }
                          >
                            <span className={`text-sm font-bold ${
                              curva === 'A' ? 'text-green-700' : curva === 'B' ? 'text-blue-700' :
                              curva === 'C' ? 'text-yellow-700' : curva === 'D' ? 'text-orange-700' :
                              curva === 'E' ? 'text-red-700' : 'text-gray-700'
                            }`}>{curva}:{stats.curvasPorIndicador?.[cardId]?.[curva] || 0}</span>
                            {isSemVenda ? (
                              <>
                                <span className="text-xs text-gray-500">{pontuacaoConfig.sem_venda?.[curva]?.dias || 0}d</span>
                                <span className="text-xs text-gray-500">{pontuacaoConfig.sem_venda?.[curva]?.pontos || 0}pts</span>
                              </>
                            ) : (
                              <span className="text-xs text-gray-500 mt-0.5">
                                {pontuacaoConfig[cardId]?.[curva] || 0}pts
                              </span>
                            )}
                          </button>
                        ))
                      )}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setConfigModalOpen(configModalOpen === cardId ? null : cardId);
                        }}
                        className="p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded self-center"
                        title={isSemVenda ? 'Configurar dias e pontuação' : 'Configurar pontuação'}
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"/>
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>
                        </svg>
                      </button>
                    </div>
                  </div>
                  </div>
                );
              });
            })}
          </div>

          {/* Botões de Visualização: GERAL / PONTUAÇÃO + Cards de Risco */}
          <div className="flex items-center gap-2 mb-4 flex-wrap">
            <button
              onClick={() => setViewMode('geral')}
              className={`px-6 py-2 rounded-lg font-semibold transition-all ${
                viewMode === 'geral'
                  ? 'bg-orange-500 text-white shadow-lg'
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              GERAL
            </button>
            <button
              onClick={() => { setViewMode('pontuacaoEstoque'); setActiveRiskFilter(null); setCurrentPagePontuacao(1); }}
              className={`px-5 py-2 rounded-lg font-semibold transition-all ${
                viewMode === 'pontuacaoEstoque'
                  ? 'bg-gradient-to-r from-orange-500 to-amber-500 text-white shadow-lg'
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              📦 PONTUAÇÃO ESTOQUE
            </button>
            <button
              onClick={() => { setViewMode('pontuacaoMargem'); setActiveRiskFilter(null); setCurrentPagePontuacao(1); }}
              className={`px-5 py-2 rounded-lg font-semibold transition-all ${
                viewMode === 'pontuacaoMargem'
                  ? 'bg-gradient-to-r from-blue-600 to-indigo-500 text-white shadow-lg'
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              💹 PONTUAÇÃO MARGEM
            </button>
            <button
              onClick={() => setViewMode('pedido')}
              className={`px-6 py-2 rounded-lg font-semibold transition-all flex items-center gap-2 ${
                viewMode === 'pedido'
                  ? 'bg-orange-600 text-white shadow-lg'
                  : 'bg-orange-100 text-orange-700 hover:bg-orange-200'
              }`}
            >
              📋 PEDIDO
              {selectedForPedido.size > 0 && (
                <span className="bg-white text-orange-600 px-2 py-0.5 rounded-full text-xs font-bold">
                  {selectedForPedido.size}
                </span>
              )}
            </button>
            <button
              onClick={() => setViewMode('pedidosRealizados')}
              className={`px-6 py-2 rounded-lg font-semibold transition-all flex items-center gap-2 ${
                viewMode === 'pedidosRealizados'
                  ? 'bg-orange-600 text-white shadow-lg'
                  : 'bg-orange-100 text-orange-700 hover:bg-orange-200'
              }`}
            >
              📁 PEDIDOS REALIZADOS
              {pedidosSalvos.length > 0 && (
                <span className="bg-white text-orange-600 px-2 py-0.5 rounded-full text-xs font-bold">
                  {pedidosSalvos.length}
                </span>
              )}
            </button>

          </div>

          {/* Info do filtro ativo e contador - NÃO mostrar nas telas de pedido */}
          {viewMode !== 'pedido' && viewMode !== 'pedidosRealizados' && (
          <div className="flex items-center justify-between mb-6">
            {activeCardFilter !== 'todos' ? (
              <div className="flex-1 bg-orange-50 border-l-4 border-orange-500 p-4 rounded">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <p className="text-sm text-orange-800">
                      <strong>Filtro ativo:</strong> {
                        CARD_CONFIG[activeCardFilter]
                          ? `${CARD_CONFIG[activeCardFilter].emoji} ${CARD_CONFIG[activeCardFilter].label}${CARD_CONFIG[activeCardFilter].subtitle ? ' - ' + CARD_CONFIG[activeCardFilter].subtitle : ''}`
                          : activeCardFilter
                      }
                    </p>
                    <span className="bg-orange-200 text-orange-900 px-3 py-1 rounded-full text-xs font-bold">
                      {filteredProducts.length} produtos
                    </span>
                    <span className="text-orange-800 font-medium">💰 Valor Total:</span>
                    <span className="bg-orange-200 text-orange-900 px-3 py-1 rounded-full text-xs font-bold">
                      R$ {(stats.valorTotalEstoque / 1000).toFixed(0)}k
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={exportToPDF}
                      className="px-3 py-1.5 bg-red-600 text-white rounded-md hover:bg-red-700 flex items-center justify-center gap-1 text-sm"
                      title="Exportar para PDF"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
                      </svg>
                      PDF
                    </button>
                    <button
                      onClick={() => setShowColumnSelector(!showColumnSelector)}
                      className="px-3 py-1.5 bg-gray-600 text-white rounded-md hover:bg-gray-700 flex items-center justify-center gap-1 text-sm"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/>
                      </svg>
                      Colunas ({visibleColumns.length}/{columns.length})
                    </button>
                    <button
                      onClick={() => setActiveCardFilter('todos')}
                      className="text-orange-600 hover:text-orange-800 font-medium text-sm"
                    >
                      ✕ Limpar
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex-1 bg-blue-50 border-l-4 border-blue-500 p-4 rounded">
                <div className="flex flex-col gap-3">
                  {/* Cards de Risco - só aparecem na aba de pontuação */}
                  {(viewMode === 'pontuacaoEstoque' || viewMode === 'pontuacaoMargem') && (
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        onClick={() => { setActiveRiskFilter(activeRiskFilter === 'muitoCritico' ? null : 'muitoCritico'); }}
                        className={`px-3 py-1.5 rounded-lg font-semibold text-sm transition-all flex items-center gap-2 ${
                          activeRiskFilter === 'muitoCritico'
                            ? 'bg-red-600 text-white shadow-lg ring-2 ring-red-400'
                            : 'bg-red-100 text-red-700 hover:bg-red-200'
                        }`}
                      >
                        <span>🔴</span>
                        <span>MUITO CRÍTICO</span>
                        <span className="bg-white text-red-600 px-2 py-0.5 rounded-full text-xs font-bold">{riskCounts.muitoCritico}</span>
                      </button>

                      <button
                        onClick={() => { setActiveRiskFilter(activeRiskFilter === 'critico' ? null : 'critico'); }}
                        className={`px-3 py-1.5 rounded-lg font-semibold text-sm transition-all flex items-center gap-2 ${
                          activeRiskFilter === 'critico'
                            ? 'bg-orange-600 text-white shadow-lg ring-2 ring-orange-400'
                            : 'bg-orange-100 text-orange-700 hover:bg-orange-200'
                        }`}
                      >
                        <span>🟠</span>
                        <span>CRÍTICO</span>
                        <span className="bg-white text-orange-600 px-2 py-0.5 rounded-full text-xs font-bold">{riskCounts.critico}</span>
                      </button>

                      <button
                        onClick={() => { setActiveRiskFilter(activeRiskFilter === 'moderado' ? null : 'moderado'); }}
                        className={`px-3 py-1.5 rounded-lg font-semibold text-sm transition-all flex items-center gap-2 ${
                          activeRiskFilter === 'moderado'
                            ? 'bg-yellow-500 text-white shadow-lg ring-2 ring-yellow-400'
                            : 'bg-yellow-100 text-yellow-700 hover:bg-yellow-200'
                        }`}
                      >
                        <span>🟡</span>
                        <span>MODERADO</span>
                        <span className="bg-white text-yellow-600 px-2 py-0.5 rounded-full text-xs font-bold">{riskCounts.moderado}</span>
                      </button>

                      <button
                        onClick={() => { setActiveRiskFilter(activeRiskFilter === 'semRisco' ? null : 'semRisco'); }}
                        className={`px-3 py-1.5 rounded-lg font-semibold text-sm transition-all flex items-center gap-2 ${
                          activeRiskFilter === 'semRisco'
                            ? 'bg-green-600 text-white shadow-lg ring-2 ring-green-400'
                            : 'bg-green-100 text-green-700 hover:bg-green-200'
                        }`}
                      >
                        <span>🟢</span>
                        <span>SEM RISCO</span>
                        <span className="bg-white text-green-600 px-2 py-0.5 rounded-full text-xs font-bold">{riskCounts.semRisco}</span>
                      </button>

                      {/* Botão de Configuração de Risco */}
                      <button
                        onClick={() => setRiskConfigModalOpen(true)}
                        className="p-2 text-gray-500 hover:text-gray-700 hover:bg-blue-100 rounded-lg transition-all"
                        title="Configurar níveis de risco"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"/>
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>
                        </svg>
                      </button>
                    </div>
                  )}

                  {/* Info de Total e Valor */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-6">
                      <div className="flex items-center gap-2">
                        <span className="text-blue-800 font-medium">📊 Total de produtos:</span>
                        <span className="bg-blue-200 text-blue-900 px-3 py-1 rounded-full text-sm font-bold">
                          {(viewMode === 'pontuacaoEstoque' || viewMode === 'pontuacaoMargem')
                            ? (activeRiskFilter ? produtosFiltradosPorRisco.length : produtosComPontuacao.length)
                            : filteredProducts.length} produtos
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-blue-800 font-medium">💰 Valor Total Estoque:</span>
                        <span className="bg-blue-200 text-blue-900 px-3 py-1 rounded-full text-sm font-bold">
                          R$ {(stats.valorTotalEstoque / 1000).toFixed(0)}k
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={exportToPDF}
                        className="px-3 py-1.5 bg-red-600 text-white rounded-md hover:bg-red-700 flex items-center justify-center gap-1 text-sm"
                        title="Exportar para PDF"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
                        </svg>
                        PDF
                      </button>
                      <button
                        onClick={() => setShowColumnSelector(!showColumnSelector)}
                        className="px-3 py-1.5 bg-gray-600 text-white rounded-md hover:bg-gray-700 flex items-center justify-center gap-1 text-sm"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/>
                        </svg>
                        Colunas ({visibleColumns.length}/{columns.length})
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
          )}

          {/* Tabela de Produtos ou Pontuação - NÃO mostrar na tela de pedido nem pedidos realizados */}
          {viewMode !== 'pedido' && viewMode !== 'pedidosRealizados' && (viewMode === 'geral' ? (
            <div className="bg-white rounded-lg shadow overflow-hidden">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-orange-50">
                    <tr>
                      {visibleColumns.map(col => (
                        <th
                          key={col.id}
                          draggable
                          onDragStart={(e) => handleHeaderDragStart(e, col.id)}
                          onDragEnd={handleHeaderDragEnd}
                          onDragOver={(e) => handleHeaderDragOver(e, col.id)}
                          onDragLeave={handleHeaderDragLeave}
                          onDrop={(e) => handleHeaderDrop(e, col.id)}
                          className={`px-4 py-3 text-left text-xs font-medium text-orange-700 uppercase cursor-move hover:bg-orange-100 select-none transition-all ${
                            dragOverColumn === col.id ? 'bg-orange-200 border-l-2 border-orange-500' : ''
                          }`}
                          onClick={() => handleSort(col.id)}
                        >
                          <div className="flex items-center gap-1">
                            <span>{col.label}</span>
                            {sortColumn === col.id && (
                              <span className="text-orange-500">
                                {sortDirection === 'asc' ? '▲' : '▼'}
                              </span>
                            )}
                          </div>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {loading ? (
                      <tr>
                        <td colSpan={visibleColumns.length} className="px-4 py-8 text-center text-gray-500">
                          🔄 Carregando produtos...
                        </td>
                      </tr>
                    ) : error ? (
                      <tr>
                        <td colSpan={visibleColumns.length} className="px-4 py-8 text-center text-red-500">
                          ❌ {error}
                        </td>
                      </tr>
                    ) : filteredProducts.length === 0 ? (
                      <tr>
                        <td colSpan={visibleColumns.length} className="px-4 py-8 text-center text-gray-500">
                          📭 Nenhum produto encontrado
                        </td>
                      </tr>
                    ) : (
                      paginatedProducts.map((product) => (
                        <tr key={product.codigo} className="hover:bg-gray-50">
                          {visibleColumns.map(col => (
                            <td key={col.id} className={getCellClassName(product, col.id)}>
                              {renderCellValue(product, col.id)}
                            </td>
                          ))}
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {/* Footer da Tabela com Paginação */}
              {!loading && !error && filteredProducts.length > 0 && (
                <div className="bg-gray-50 px-4 py-3 border-t border-gray-200 flex items-center justify-between">
                  <p className="text-sm text-gray-700">
                    Exibindo <strong>{(currentPage - 1) * itemsPerPage + 1}</strong> - <strong>{Math.min(currentPage * itemsPerPage, filteredProducts.length)}</strong> de <strong>{filteredProducts.length}</strong> produtos
                  </p>

                  {/* Controles de Paginação */}
                  {totalPages > 1 && (
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setCurrentPage(1)}
                        disabled={currentPage === 1}
                        className="px-3 py-1 bg-white border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                      >
                        ⏮️ Primeira
                      </button>
                      <button
                        onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                        disabled={currentPage === 1}
                        className="px-3 py-1 bg-white border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                      >
                        ◀️ Anterior
                      </button>

                      <span className="text-sm text-gray-700 px-3">
                        Página <strong>{currentPage}</strong> de <strong>{totalPages}</strong>
                      </span>

                      <button
                        onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                        disabled={currentPage === totalPages}
                        className="px-3 py-1 bg-white border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                      >
                        Próxima ▶️
                      </button>
                      <button
                        onClick={() => setCurrentPage(totalPages)}
                        disabled={currentPage === totalPages}
                        className="px-3 py-1 bg-white border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                      >
                        Última ⏭️
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : (
            /* Tabela de Pontuação */
            <div className="bg-white rounded-lg shadow overflow-hidden">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className={`bg-gradient-to-r ${viewMode === 'pontuacaoMargem' ? 'from-blue-600 to-indigo-500' : 'from-orange-500 to-red-500'} text-white`}>
                    <tr>
                      {/* Coluna de seleção para pedido */}
                      <th className="px-2 py-3 text-center w-12">
                        <div className="flex flex-col items-center gap-1">
                          <span className="text-[10px]">Pedido</span>
                          <input
                            type="checkbox"
                            onChange={(e) => {
                              if (e.target.checked) {
                                selectAllForPedido();
                              } else {
                                clearPedidoSelection();
                              }
                            }}
                            checked={paginatedProdutosPontuacao.length > 0 && paginatedProdutosPontuacao.every(p => selectedForPedido.has(p.codigo))}
                            className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                          />
                        </div>
                      </th>
                      {activePontuacaoColumns.map((col) => (
                        <th
                          key={col.id}
                          draggable
                          onDragStart={(e) => handlePontuacaoDragStart(e, col.id)}
                          onDragEnd={handlePontuacaoDragEnd}
                          onDragOver={(e) => handlePontuacaoDragOver(e, col.id)}
                          onDrop={(e) => handlePontuacaoDrop(e, col.id)}
                          onClick={() => handleSortPontuacao(col.id)}
                          className={`px-3 py-3 text-xs font-medium uppercase cursor-move select-none transition-all
                            ${col.type === 'info' ? 'hover:bg-orange-600' : ''}
                            ${col.bg || ''}
                            ${col.id === 'desSecao' ? 'min-w-[150px]' : ''}
                            ${col.id === 'codigo' || col.id === 'descricao' || col.id === 'desSecao' ? 'text-left' : 'text-center'}
                            ${dragOverPontuacaoCol === col.id ? 'bg-orange-700 scale-105' : ''}
                            ${col.type === 'total' ? 'font-bold' : ''}
                          `}
                        >
                          <div className={`flex items-center gap-1 ${col.id !== 'codigo' && col.id !== 'descricao' && col.id !== 'desSecao' ? 'justify-center' : ''}`}>
                            {col.label}
                            {sortPontuacao.column === col.id && (
                              <span>{sortPontuacao.direction === 'asc' ? '▲' : '▼'}</span>
                            )}
                          </div>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {loading ? (
                      <tr>
                        <td colSpan={activePontuacaoColumns.length + 1} className="px-4 py-8 text-center text-gray-500">
                          🔄 Carregando produtos...
                        </td>
                      </tr>
                    ) : produtosPontuacaoList.length === 0 ? (
                      <tr>
                        <td colSpan={activePontuacaoColumns.length + 1} className="px-4 py-8 text-center text-gray-500">
                          📊 {activeRiskFilter ? 'Nenhum produto neste nível de risco.' : 'Nenhum produto com pontuação. Configure os pontos em cada card.'}
                        </td>
                      </tr>
                    ) : (
                      paginatedProdutosPontuacao.map((product) => (
                        <tr key={product.codigo} className={`hover:bg-gray-50 ${selectedForPedido.has(product.codigo) ? 'bg-blue-50' : ''}`}>
                          {/* Checkbox de seleção */}
                          <td className="px-2 py-2 text-center">
                            <input
                              type="checkbox"
                              checked={selectedForPedido.has(product.codigo)}
                              onChange={() => togglePedidoSelection(product.codigo)}
                              className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                            />
                          </td>
                          {activePontuacaoColumns.map((col) => renderPontuacaoCell(product, col))}
                        </tr>
                      ))
                    )}
                  </tbody>
                  {produtosPontuacaoList.length > 0 && (
                    <tfoot className="bg-gray-100">
                      <tr className="font-bold">
                        {/* Célula vazia para coluna de checkbox */}
                        <td className="px-2 py-3"></td>
                        {activePontuacaoColumns.map((col, idx) => {
                          // Colunas de info: mostrar "TOTAL GERAL:" na última coluna de info
                          const infoColumns = activePontuacaoColumns.filter(c => c.type === 'info');
                          const isLastInfo = col.type === 'info' && idx === activePontuacaoColumns.indexOf(infoColumns[infoColumns.length - 1]);
                          const isInfo = col.type === 'info' && !isLastInfo;

                          if (isInfo) return <td key={col.id} className="px-3 py-3"></td>;
                          if (isLastInfo) return <td key={col.id} className="px-3 py-3 text-right text-sm">TOTAL {activeRiskFilter ? 'FILTRADO' : 'GERAL'}:</td>;

                          // Usar lista filtrada se houver filtro de risco ativo
                          const dataList = produtosPontuacaoList;

                          // Colunas de pontos
                          const totals = {
                            pontosZerado: { value: dataList.reduce((sum, p) => sum + p.pontosZerado, 0), color: 'text-red-600' },
                            pontosNegativo: { value: dataList.reduce((sum, p) => sum + p.pontosNegativo, 0), color: 'text-red-700' },
                            pontosSemVenda: { value: dataList.reduce((sum, p) => sum + p.pontosSemVenda, 0), color: 'text-orange-600' },
                            pontosPreRuptura: { value: dataList.reduce((sum, p) => sum + (p.pontosPreRuptura || 0), 0), color: 'text-amber-600' },
                            pontosMargemNegativa: { value: dataList.reduce((sum, p) => sum + p.pontosMargemNegativa, 0), color: 'text-red-800' },
                            pontosMargemBaixa: { value: dataList.reduce((sum, p) => sum + p.pontosMargemBaixa, 0), color: 'text-yellow-600' },
                            pontosCustoZerado: { value: dataList.reduce((sum, p) => sum + p.pontosCustoZerado, 0), color: 'text-purple-600' },
                            pontosPrecoZerado: { value: dataList.reduce((sum, p) => sum + p.pontosPrecoZerado, 0), color: 'text-pink-600' },
                            pontosConcBarato: { value: dataList.reduce((sum, p) => sum + p.pontosConcBarato, 0), color: 'text-blue-600' },
                            pontosMargemExcessiva: { value: dataList.reduce((sum, p) => sum + p.pontosMargemExcessiva, 0), color: 'text-emerald-600' },
                            pontosEstoqueExcessivo: { value: dataList.reduce((sum, p) => sum + p.pontosEstoqueExcessivo, 0), color: 'text-amber-600' },
                            totalPontos: { value: dataList.reduce((sum, p) => sum + p.totalPontos, 0), color: 'text-white', bg: 'bg-gray-800' },
                            totalPontosEstoque: { value: dataList.reduce((sum, p) => sum + (p.totalPontosEstoque || 0), 0), color: 'text-white', bg: 'bg-gray-800' },
                            totalPontosMargem: { value: dataList.reduce((sum, p) => sum + (p.totalPontosMargem || 0), 0), color: 'text-white', bg: 'bg-gray-800' },
                          };

                          const total = totals[col.id];
                          if (total) {
                            return (
                              <td key={col.id} className={`px-3 py-3 text-center text-sm ${total.color} ${total.bg || ''}`}>
                                {total.value}
                              </td>
                            );
                          }
                          return <td key={col.id} className="px-3 py-3"></td>;
                        })}
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>
              {/* Controles de paginação */}
              {produtosPontuacaoList.length > 0 && (
                <div className="bg-gray-50 px-4 py-3 border-t flex flex-col sm:flex-row items-center justify-between gap-3">
                  <span className="text-sm text-gray-700">
                    Exibindo <strong>{(currentPagePontuacao - 1) * itemsPerPagePontuacao + 1}</strong> - <strong>{Math.min(currentPagePontuacao * itemsPerPagePontuacao, produtosPontuacaoList.length)}</strong> de <strong>{produtosPontuacaoList.length}</strong> produtos
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setCurrentPagePontuacao(1)}
                      disabled={currentPagePontuacao === 1}
                      className="px-2 py-1 text-sm border rounded hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      ««
                    </button>
                    <button
                      onClick={() => setCurrentPagePontuacao(p => Math.max(1, p - 1))}
                      disabled={currentPagePontuacao === 1}
                      className="px-3 py-1 text-sm border rounded hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Anterior
                    </button>
                    <span className="text-sm text-gray-600 px-2">
                      Página <strong>{currentPagePontuacao}</strong> de <strong>{totalPagesPontuacao || 1}</strong>
                    </span>
                    <button
                      onClick={() => setCurrentPagePontuacao(p => Math.min(totalPagesPontuacao, p + 1))}
                      disabled={currentPagePontuacao === totalPagesPontuacao || totalPagesPontuacao === 0}
                      className="px-3 py-1 text-sm border rounded hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Próxima
                    </button>
                    <button
                      onClick={() => setCurrentPagePontuacao(totalPagesPontuacao)}
                      disabled={currentPagePontuacao === totalPagesPontuacao || totalPagesPontuacao === 0}
                      className="px-2 py-1 text-sm border rounded hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      »»
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}

          {/* ========== TELA DE PEDIDO ========== */}
          {viewMode === 'pedido' && (
            <div className="bg-white rounded-lg shadow overflow-hidden">
              <div className="bg-gradient-to-r from-orange-500 to-red-600 text-white p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-xl font-bold">📋 Novo Pedido</h2>
                    <p className="text-orange-100 text-sm">
                      {selectedForPedido.size} produto(s) selecionado(s)
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={clearPedidoSelection}
                      className="px-4 py-2 bg-white/20 hover:bg-white/30 rounded-lg text-sm font-medium transition-all"
                    >
                      Limpar Seleção
                    </button>
                    <button
                      onClick={salvarPedido}
                      disabled={selectedForPedido.size === 0}
                      className="px-4 py-2 bg-green-500 hover:bg-green-600 disabled:bg-gray-400 disabled:cursor-not-allowed rounded-lg text-sm font-medium transition-all flex items-center gap-2"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"/>
                      </svg>
                      Salvar Pedido
                    </button>
                    <button
                      onClick={() => {
                        if (selectedForPedido.size === 0) return;
                        exportPedidoToPDF();
                      }}
                      disabled={selectedForPedido.size === 0}
                      className="px-4 py-2 bg-red-500 hover:bg-red-600 disabled:bg-gray-400 disabled:cursor-not-allowed rounded-lg text-sm font-medium transition-all flex items-center gap-2"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
                      </svg>
                      PDF
                    </button>
                  </div>
                </div>
              </div>

              {selectedForPedido.size === 0 ? (
                <div className="p-8 text-center text-gray-500">
                  <div className="text-6xl mb-4">📭</div>
                  <p className="text-lg font-medium">Nenhum produto selecionado</p>
                  <p className="text-sm mt-2">Vá até a aba PONTUAÇÃO e marque os produtos que deseja incluir no pedido.</p>
                  <button
                    onClick={() => setViewMode('pontuacao')}
                    className="mt-4 px-6 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-all"
                  >
                    Ir para Pontuação
                  </button>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-orange-50">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-orange-800 uppercase">Código</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-orange-800 uppercase">Cód. Barras (EAN)</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-orange-800 uppercase min-w-[200px]">Descrição</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-orange-800 uppercase">Seção</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-orange-800 uppercase">Fornecedor</th>
                        <th className="px-4 py-3 text-center text-xs font-medium text-orange-800 uppercase">Tipo Emb.</th>
                        <th className="px-4 py-3 text-center text-xs font-medium text-orange-800 uppercase">Qtd Emb.</th>
                        <th className="px-4 py-3 text-center text-xs font-medium text-orange-800 uppercase w-24">Qtd. Pedido</th>
                        <th className="px-4 py-3 text-center text-xs font-medium text-orange-800 uppercase w-16">Remover</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {produtosSelecionadosPedido.map((item) => (
                        <tr key={item.codigo} className="hover:bg-orange-50/50">
                          <td className="px-4 py-3 text-sm font-mono text-gray-900">{item.codigo}</td>
                          <td className="px-4 py-3 text-sm font-mono text-gray-600">{item.ean || '-'}</td>
                          <td className="px-4 py-3 text-sm text-gray-900">{item.descricao}</td>
                          <td className="px-4 py-3 text-sm text-gray-600">{item.desSecao || '-'}</td>
                          <td className="px-4 py-3 text-sm text-gray-600">{item.fornecedor || '-'}</td>
                          <td className="px-4 py-3 text-center">
                            <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded text-sm font-medium">
                              {item.desEmbalagem || '-'}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-center">
                            <span className="px-2 py-1 bg-gray-100 text-gray-700 rounded text-sm font-medium">
                              {item.qtdEmbalagemCompra || 1}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-center">
                            <input
                              type="number"
                              min="1"
                              value={pedidoQuantidades[item.codigo] || 1}
                              onChange={(e) => updatePedidoQuantidade(item.codigo, parseInt(e.target.value) || 1)}
                              className="w-20 px-2 py-1 border border-gray-300 rounded text-center text-sm focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                            />
                          </td>
                          <td className="px-4 py-3 text-center">
                            <button
                              onClick={() => togglePedidoSelection(item.codigo)}
                              className="p-1 text-red-500 hover:text-red-700 hover:bg-red-50 rounded"
                              title="Remover do pedido"
                            >
                              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
                              </svg>
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* ========== TELA DE PEDIDOS REALIZADOS ========== */}
          {viewMode === 'pedidosRealizados' && (
            <div className="bg-white rounded-lg shadow overflow-hidden">
              <div className="bg-gradient-to-r from-orange-500 to-red-600 text-white p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-xl font-bold">📁 Pedidos Realizados</h2>
                    <p className="text-orange-100 text-sm">
                      {pedidosSalvos.length} pedido(s) salvo(s)
                    </p>
                  </div>
                </div>
              </div>

              {pedidosSalvos.length === 0 ? (
                <div className="p-8 text-center text-gray-500">
                  <div className="text-6xl mb-4">📭</div>
                  <p className="text-lg font-medium">Nenhum pedido realizado</p>
                  <p className="text-sm mt-2">Crie um pedido na aba PEDIDO e salve para vê-lo aqui.</p>
                  <button
                    onClick={() => setViewMode('pedido')}
                    className="mt-4 px-6 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-all"
                  >
                    Ir para Pedido
                  </button>
                </div>
              ) : (
                <div className="divide-y divide-gray-200">
                  {pedidosSalvos.map((pedido) => (
                    <div key={pedido.id}>
                      {/* Linha resumida - clicável */}
                      <div
                        className={`flex items-center justify-between p-4 cursor-pointer hover:bg-gray-50 transition-colors ${expandedPedido === pedido.id ? 'bg-orange-50' : ''}`}
                        onClick={() => setExpandedPedido(expandedPedido === pedido.id ? null : pedido.id)}
                      >
                        <div className="flex items-center gap-4">
                          {/* Ícone de expandir/colapsar */}
                          <svg
                            className={`w-5 h-5 text-gray-500 transition-transform ${expandedPedido === pedido.id ? 'rotate-90' : ''}`}
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7"/>
                          </svg>
                          <div className="bg-orange-600 text-white px-3 py-1 rounded text-sm font-bold">
                            #{pedido.id}
                          </div>
                          <span className="font-medium text-gray-800">{pedido.data}</span>
                          <span className="bg-orange-100 text-orange-700 px-3 py-1 rounded-full text-sm font-semibold">
                            {pedido.totalItens} itens
                          </span>
                        </div>
                        <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                          <button
                            onClick={() => exportPedidoSalvoToPDF(pedido)}
                            className="px-3 py-1.5 bg-red-500 text-white rounded hover:bg-red-600 text-sm font-medium flex items-center gap-1"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
                            </svg>
                            PDF
                          </button>
                          <button
                            onClick={() => excluirPedido(pedido.id)}
                            className="px-3 py-1.5 bg-gray-400 text-white rounded hover:bg-gray-500 text-sm font-medium"
                          >
                            Excluir
                          </button>
                        </div>
                      </div>

                      {/* Itens do pedido - expandível */}
                      {expandedPedido === pedido.id && (
                        <div className="bg-gray-50 border-t border-gray-200">
                          <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-orange-100">
                              <tr>
                                <th className="px-4 py-2 text-left text-xs font-medium text-orange-800">Código</th>
                                <th className="px-4 py-2 text-left text-xs font-medium text-orange-800">Descrição</th>
                                <th className="px-4 py-2 text-left text-xs font-medium text-orange-800">Seção</th>
                                <th className="px-4 py-2 text-left text-xs font-medium text-orange-800">Fornecedor</th>
                                <th className="px-4 py-2 text-center text-xs font-medium text-orange-800">Qtd</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100 bg-white">
                              {pedido.itens.map((item, idx) => (
                                <tr key={idx} className="hover:bg-orange-50/50">
                                  <td className="px-4 py-2 text-sm font-mono text-gray-700">{item.codigo}</td>
                                  <td className="px-4 py-2 text-sm text-gray-800">{item.descricao}</td>
                                  <td className="px-4 py-2 text-sm text-gray-600">{item.desSecao || '-'}</td>
                                  <td className="px-4 py-2 text-sm text-gray-600">{item.fornecedor || '-'}</td>
                                  <td className="px-4 py-2 text-center text-sm font-semibold text-orange-600">{item.quantidade}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Modal de Histórico de Compras */}
      {showHistoryModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center" onClick={() => setShowHistoryModal(false)}>
          <div
            className="bg-white rounded-lg shadow-2xl w-full max-w-2xl mx-4 max-h-[90vh] overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="bg-gradient-to-r from-blue-500 to-blue-700 p-4 rounded-t-lg text-white">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-bold">Histórico de Compras</h2>
                  {historyProduct && (
                    <p className="text-sm text-blue-100">{historyProduct.codigo} - {historyProduct.descricao}</p>
                  )}
                </div>
                <button
                  onClick={() => setShowHistoryModal(false)}
                  className="text-white hover:text-gray-200"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"/>
                  </svg>
                </button>
              </div>
            </div>

            <div className="p-4 overflow-y-auto max-h-[60vh]">
              {loadingHistory ? (
                <div className="flex items-center justify-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                  <span className="ml-2 text-gray-600">Carregando histórico...</span>
                </div>
              ) : historyData.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 mx-auto mb-2 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  <p>Nenhum registro de compra encontrado</p>
                </div>
              ) : (
                (() => {
                  const custos = historyData.map(item => Number(item.custoReposicao || item.precoUnitario || 0)).filter(c => c > 0);
                  const menorCusto = custos.length > 0 ? Math.min(...custos) : 0;
                  return (
                    <table className="w-full text-sm">
                      <thead className="bg-gray-100">
                        <tr>
                          <th className="px-3 py-2 text-left font-semibold text-gray-700">Data</th>
                          <th className="px-3 py-2 text-center font-semibold text-gray-700">Dias</th>
                          <th className="px-3 py-2 text-left font-semibold text-gray-700">Fornecedor</th>
                          <th className="px-3 py-2 text-right font-semibold text-gray-700">Qtd</th>
                          <th className="px-3 py-2 text-right font-semibold text-gray-700">Custo Rep.</th>
                          <th className="px-3 py-2 text-right font-semibold text-gray-700">Total</th>
                          <th className="px-3 py-2 text-center font-semibold text-gray-700">NF</th>
                        </tr>
                      </thead>
                      <tbody>
                        {historyData.map((item, index) => {
                          const custo = Number(item.custoReposicao || item.precoUnitario || 0);
                          const isMenor = custo > 0 && custo === menorCusto;
                          return (
                            <tr key={index} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                              <td className="px-3 py-2 text-gray-900 font-medium">{item.data}</td>
                              <td className="px-3 py-2 text-center text-gray-500">
                                {item.diasDesdeCompra || 0}
                              </td>
                              <td className="px-3 py-2 text-gray-700 max-w-[200px] truncate" title={item.fornecedor}>
                                {item.fornecedor}
                              </td>
                              <td className="px-3 py-2 text-right text-gray-900 font-medium">
                                {item.quantidade?.toFixed(0)}
                              </td>
                              <td className={`px-3 py-2 text-right font-medium ${isMenor ? 'text-green-600' : 'text-red-600'}`}>
                                R$ {custo.toFixed(2).replace('.', ',')}
                              </td>
                              <td className="px-3 py-2 text-right text-blue-600 font-bold">
                                R$ {item.valorTotal?.toFixed(2).replace('.', ',')}
                              </td>
                              <td className="px-3 py-2 text-center text-gray-600">
                                {item.numeroNF || '-'}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  );
                })()
              )}
            </div>

            <div className="border-t p-4 bg-gray-50 flex justify-end">
              <button
                onClick={() => setShowHistoryModal(false)}
                className="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-lg font-medium transition-colors"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Configuração de Pontuação */}
      {configModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center" onClick={() => setConfigModalOpen(null)}>
          <div
            className="bg-white rounded-lg shadow-2xl w-full max-w-lg mx-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="bg-gradient-to-r from-orange-500 to-red-600 p-4 rounded-t-lg text-white">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-bold">
                  {configModalOpen === 'zerado' && '📭 Pontuação - Estoque Zerado'}
                  {configModalOpen === 'negativo' && '⚠️ Pontuação - Estoque Negativo'}
                  {configModalOpen === 'sem_venda' && '⏸️ Configuração - Sem Venda'}
                  {configModalOpen === 'margem_negativa' && '💸 Pontuação - Margem Negativa'}
                  {configModalOpen === 'margem_baixa' && '💰 Pontuação - Margem Baixa'}
                  {configModalOpen === 'custo_zerado' && '🏷️ Pontuação - Custo Zerado'}
                  {configModalOpen === 'preco_venda_zerado' && '💵 Pontuação - Preço Zerado'}
                  {configModalOpen === 'curva_x' && '❌ Pontuação - Curva X'}
                  {configModalOpen === 'conc_barato' && '🏪 Pontuação - Concorrente + Barato'}
                  {configModalOpen === 'pre_ruptura' && '📉 Pontuação - Estoque Mínimo'}
                  {configModalOpen === 'margem_excessiva' && '📈 Pontuação - Margem Excessiva'}
                </h2>
                <button
                  onClick={() => setConfigModalOpen(null)}
                  className="text-white hover:text-gray-200"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"/>
                  </svg>
                </button>
              </div>
              <p className="text-sm text-white/80 mt-1">
                {configModalOpen === 'sem_venda'
                  ? 'Defina dias sem venda e pontos para cada curva'
                  : configModalOpen === 'margem_excessiva'
                  ? 'Defina a pontuação para cada faixa de margem acima da meta'
                  : 'Defina a pontuação para cada curva'}
              </p>
            </div>

            <div className="p-6">
              {configModalOpen === 'sem_venda' ? (
                <>
                  <p className="text-sm text-gray-600 mb-4">
                    Informe quantos dias sem venda e quantos pontos cada produto recebe, por curva:
                  </p>
                  <div className="space-y-3">
                    {/* Cabeçalho */}
                    <div className="flex items-center gap-2 text-xs font-medium text-gray-500 border-b pb-2">
                      <div className="w-10"></div>
                      <div className="flex-1">Curva</div>
                      <div className="w-20 text-center">Dias</div>
                      <div className="w-20 text-center">Pontos</div>
                    </div>
                    {['A', 'B', 'C', 'D', 'E', 'X'].map((curva) => (
                      <div key={curva} className="flex items-center gap-2">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-white ${
                          curva === 'A' ? 'bg-green-500' :
                          curva === 'B' ? 'bg-blue-500' :
                          curva === 'C' ? 'bg-yellow-500' :
                          curva === 'D' ? 'bg-orange-500' :
                          curva === 'E' ? 'bg-red-500' :
                          'bg-gray-500'
                        }`}>
                          {curva}
                        </div>
                        <label className="flex-1 text-sm font-medium text-gray-700">
                          Curva {curva}
                        </label>
                        <div className="flex items-center gap-1">
                          <span className="text-xs text-gray-400">{'>'}</span>
                          <input
                            type="number"
                            min="0"
                            max="999"
                            value={pontuacaoConfig.sem_venda?.[curva]?.dias || 0}
                            onChange={(e) => updateSemVenda(curva, 'dias', e.target.value)}
                            className="w-16 px-2 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500 text-center text-sm"
                          />
                          <span className="text-xs text-gray-500">d</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <input
                            type="number"
                            min="0"
                            max="100"
                            value={pontuacaoConfig.sem_venda?.[curva]?.pontos || 0}
                            onChange={(e) => updateSemVenda(curva, 'pontos', e.target.value)}
                            className="w-16 px-2 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500 text-center text-sm"
                          />
                          <span className="text-xs text-gray-500">pts</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              ) : SPECIAL_RANGES[configModalOpen] ? (
                <>
                  <p className="text-sm text-gray-600 mb-4">
                    {configModalOpen === 'margem_excessiva'
                      ? 'Informe quantos pontos cada produto recebe por faixa de margem acima da meta:'
                      : 'Informe quantos pontos cada produto recebe por faixa de dias de cobertura de estoque:'}
                  </p>
                  <div className="space-y-3">
                    {SPECIAL_RANGES[configModalOpen].map((range, idx) => (
                      <div key={range.id} className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-lg flex items-center justify-center font-bold text-white ${
                          range.color.split(' ')[0].replace('bg-', 'bg-').replace('-50', '-500').replace('-100', '-500')
                        }`} style={{ backgroundColor: ['#10b981','#14b8a6','#06b6d4','#3b82f6','#6366f1','#8b5cf6','#22c55e','#84cc16','#eab308','#f97316','#ef4444','#dc2626','#6b7280'][idx] || '#6b7280' }}>
                          <span className="text-xs text-white font-bold">{range.label}</span>
                        </div>
                        <label className="flex-1 text-sm font-medium text-gray-700">
                          {range.label === 'Nunca' ? 'Nunca Vendido' : range.label}
                        </label>
                        <div className="flex items-center gap-2">
                          <input
                            type="number"
                            min="0"
                            max="100"
                            value={pontuacaoConfig[configModalOpen]?.[range.id] || 0}
                            onChange={(e) => updatePontuacao(configModalOpen, range.id, e.target.value)}
                            className="w-20 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500 text-center"
                          />
                          <span className="text-sm text-gray-500">pontos</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <>
                  <p className="text-sm text-gray-600 mb-4">
                    Informe quantos pontos cada produto com esta condição recebe, de acordo com sua curva:
                  </p>
                  <div className="space-y-3">
                    {['A', 'B', 'C', 'D', 'E', 'X'].map((curva) => (
                      <div key={curva} className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-white ${
                          curva === 'A' ? 'bg-green-500' :
                          curva === 'B' ? 'bg-blue-500' :
                          curva === 'C' ? 'bg-yellow-500' :
                          curva === 'D' ? 'bg-orange-500' :
                          curva === 'E' ? 'bg-red-500' :
                          'bg-gray-500'
                        }`}>
                          {curva}
                        </div>
                        <label className="flex-1 text-sm font-medium text-gray-700">
                          Curva {curva}
                        </label>
                        <div className="flex items-center gap-2">
                          <input
                            type="number"
                            min="0"
                            max="100"
                            value={pontuacaoConfig[configModalOpen]?.[curva] || 0}
                            onChange={(e) => updatePontuacao(configModalOpen, curva, e.target.value)}
                            className="w-20 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500 text-center"
                          />
                          <span className="text-sm text-gray-500">pontos</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}

              <div className="mt-6 pt-4 border-t border-gray-200">
                <div className="flex items-center justify-between">
                  <button
                    onClick={() => {
                      if (configModalOpen === 'sem_venda') {
                        setPontuacaoConfig(prev => ({
                          ...prev,
                          sem_venda: {
                            A: { dias: 3, pontos: 0 },
                            B: { dias: 7, pontos: 0 },
                            C: { dias: 15, pontos: 0 },
                            D: { dias: 30, pontos: 0 },
                            E: { dias: 45, pontos: 0 },
                            X: { dias: 60, pontos: 0 }
                          }
                        }));
                      } else if (SPECIAL_RANGES[configModalOpen]) {
                        const zeroed = {};
                        SPECIAL_RANGES[configModalOpen].forEach(r => { zeroed[r.id] = 0; });
                        setPontuacaoConfig(prev => ({
                          ...prev,
                          [configModalOpen]: zeroed
                        }));
                      } else {
                        setPontuacaoConfig(prev => ({
                          ...prev,
                          [configModalOpen]: { A: 0, B: 0, C: 0, D: 0, E: 0, X: 0 }
                        }));
                      }
                    }}
                    className="px-4 py-2 text-gray-600 hover:text-gray-800 text-sm"
                  >
                    Zerar valores
                  </button>
                  <button
                    onClick={() => setConfigModalOpen(null)}
                    className="px-6 py-2 bg-orange-500 text-white rounded-md hover:bg-orange-600 font-medium"
                  >
                    Salvar
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Configuração de Níveis de Risco */}
      {riskConfigModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center" onClick={() => setRiskConfigModalOpen(false)}>
          <div
            className="bg-white rounded-lg shadow-2xl w-full max-w-lg mx-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="bg-gradient-to-r from-purple-600 to-indigo-600 p-4 rounded-t-lg text-white">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-bold">
                  ⚙️ Configuração de Níveis de Risco
                </h2>
                <button
                  onClick={() => setRiskConfigModalOpen(false)}
                  className="text-white hover:text-gray-200"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"/>
                  </svg>
                </button>
              </div>
              <p className="text-sm text-white/80 mt-1">
                Defina os intervalos de pontos para cada nível de risco
              </p>
            </div>

            <div className="p-6 space-y-4">
              {/* Sem Risco */}
              <div className="p-3 bg-green-50 rounded-lg border border-green-200">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-lg">🟢</span>
                  <span className="font-bold text-green-700">SEM RISCO</span>
                </div>
                <p className="text-xs text-green-600 mb-2">Produtos com 0 pontos</p>
              </div>

              {/* Moderado */}
              <div className="p-3 bg-yellow-50 rounded-lg border border-yellow-200">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-lg">🟡</span>
                  <span className="font-bold text-yellow-700">MODERADO</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-yellow-700">De</span>
                  <input
                    type="number"
                    min="1"
                    value={riskConfig.moderado.min}
                    onChange={(e) => {
                      const newMin = parseInt(e.target.value) || 1;
                      setRiskConfig(prev => ({
                        ...prev,
                        moderado: { ...prev.moderado, min: newMin }
                      }));
                    }}
                    className="w-20 px-2 py-1 border border-yellow-300 rounded text-center text-sm"
                  />
                  <span className="text-sm text-yellow-700">até</span>
                  <input
                    type="number"
                    min="1"
                    value={riskConfig.moderado.max}
                    onChange={(e) => {
                      const newMax = parseInt(e.target.value) || 1;
                      setRiskConfig(prev => ({
                        ...prev,
                        moderado: { ...prev.moderado, max: newMax },
                        critico: { ...prev.critico, min: newMax + 1 }
                      }));
                    }}
                    className="w-20 px-2 py-1 border border-yellow-300 rounded text-center text-sm"
                  />
                  <span className="text-sm text-yellow-700">pontos</span>
                </div>
              </div>

              {/* Crítico */}
              <div className="p-3 bg-orange-50 rounded-lg border border-orange-200">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-lg">🟠</span>
                  <span className="font-bold text-orange-700">CRÍTICO</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-orange-700">De</span>
                  <input
                    type="number"
                    min="1"
                    value={riskConfig.critico.min}
                    onChange={(e) => {
                      const newMin = parseInt(e.target.value) || 1;
                      setRiskConfig(prev => ({
                        ...prev,
                        critico: { ...prev.critico, min: newMin },
                        moderado: { ...prev.moderado, max: newMin - 1 }
                      }));
                    }}
                    className="w-20 px-2 py-1 border border-orange-300 rounded text-center text-sm"
                  />
                  <span className="text-sm text-orange-700">até</span>
                  <input
                    type="number"
                    min="1"
                    value={riskConfig.critico.max}
                    onChange={(e) => {
                      const newMax = parseInt(e.target.value) || 1;
                      setRiskConfig(prev => ({
                        ...prev,
                        critico: { ...prev.critico, max: newMax },
                        muitoCritico: { ...prev.muitoCritico, min: newMax + 1 }
                      }));
                    }}
                    className="w-20 px-2 py-1 border border-orange-300 rounded text-center text-sm"
                  />
                  <span className="text-sm text-orange-700">pontos</span>
                </div>
              </div>

              {/* Muito Crítico */}
              <div className="p-3 bg-red-50 rounded-lg border border-red-200">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-lg">🔴</span>
                  <span className="font-bold text-red-700">MUITO CRÍTICO</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-red-700">A partir de</span>
                  <input
                    type="number"
                    min="1"
                    value={riskConfig.muitoCritico.min}
                    onChange={(e) => {
                      const newMin = parseInt(e.target.value) || 1;
                      setRiskConfig(prev => ({
                        ...prev,
                        muitoCritico: { ...prev.muitoCritico, min: newMin },
                        critico: { ...prev.critico, max: newMin - 1 }
                      }));
                    }}
                    className="w-20 px-2 py-1 border border-red-300 rounded text-center text-sm"
                  />
                  <span className="text-sm text-red-700">pontos ou mais</span>
                </div>
              </div>

              {/* Info box */}
              <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
                <p className="text-xs text-blue-700">
                  💡 <strong>Dica:</strong> Os intervalos são ajustados automaticamente para não haver sobreposição.
                </p>
              </div>
            </div>

            <div className="flex justify-between p-4 border-t bg-gray-50 rounded-b-lg">
              <button
                onClick={() => {
                  setRiskConfig({
                    semRisco: { min: 0, max: 0 },
                    moderado: { min: 1, max: 100 },
                    critico: { min: 101, max: 150 },
                    muitoCritico: { min: 151, max: 999999 }
                  });
                }}
                className="px-4 py-2 text-gray-600 hover:text-gray-800 text-sm"
              >
                Restaurar padrão
              </button>
              <button
                onClick={() => setRiskConfigModalOpen(false)}
                className="px-6 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 font-medium"
              >
                Salvar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Sidebar de Seleção de Colunas */}
      {showColumnSelector && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50" onClick={() => setShowColumnSelector(false)}>
          <div
            className="absolute right-0 top-0 h-full w-96 bg-white shadow-2xl overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="sticky top-0 bg-gradient-to-r from-orange-500 to-red-600 p-6 text-white">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold">⚙️ Configurar Colunas</h2>
                <button
                  onClick={() => setShowColumnSelector(false)}
                  className="text-white hover:text-gray-200"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"/>
                  </svg>
                </button>
              </div>
              <p className="text-sm text-white/90 mt-2">
                {visibleColumns.length} de {columns.length} colunas visíveis
              </p>
            </div>

            <div className="p-6">
              <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <p className="text-xs text-blue-800">
                  💡 <strong>Dica:</strong> Arraste as colunas para reordenar a sequência na tabela
                </p>
              </div>

              <div className="space-y-2">
                {columns.map((column, index) => (
                  <div
                    key={column.id}
                    draggable
                    onDragStart={() => handleDragStart(index)}
                    onDragOver={(e) => handleDragOver(e, index)}
                    onDragEnd={handleDragEnd}
                    className={`flex items-center p-3 rounded-lg transition-all cursor-move ${
                      draggedColumn === index
                        ? 'bg-orange-100 border-2 border-orange-500 scale-105'
                        : 'bg-white hover:bg-gray-50 border-2 border-transparent'
                    }`}
                  >
                    {/* Ícone de drag */}
                    <div className="mr-2 text-gray-400">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 8h16M4 16h16"/>
                      </svg>
                    </div>

                    <input
                      type="checkbox"
                      checked={column.visible}
                      onChange={() => toggleColumn(column.id)}
                      className="w-5 h-5 text-orange-500 border-gray-300 rounded focus:ring-orange-500 cursor-pointer"
                      onClick={(e) => e.stopPropagation()}
                    />
                    <span className="ml-3 text-sm font-medium text-gray-700 flex-1">
                      {column.label}
                    </span>

                    {/* Indicador de posição */}
                    <span className="text-xs text-gray-400 font-mono">
                      #{index + 1}
                    </span>
                  </div>
                ))}
              </div>

              <div className="mt-6 pt-6 border-t border-gray-200">
                <button
                  onClick={() => {
                    setColumns(AVAILABLE_COLUMNS);
                    setShowColumnSelector(false);
                  }}
                  className="w-full px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700"
                >
                  🔄 Restaurar Padrão
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
