import React, { useState, useEffect } from 'react';
import Layout from '../components/Layout';
import api from '../services/api';

// Função para obter datas padrão (primeiro dia do ano até hoje)
const getDefaultDates = () => {
  const hoje = new Date();
  const primeiroDiaAno = new Date(hoje.getFullYear(), 0, 1);

  const formatDate = (date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  return {
    dataInicio: formatDate(primeiroDiaAno),
    dataFim: formatDate(hoje)
  };
};

// Função para obter os ranges de datas para exibir nos cabeçalhos
const getDateRanges = () => {
  const hoje = new Date();

  // Formata data como MM/YY
  const formatShort = (date) => {
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = String(date.getFullYear()).slice(-2);
    return `${month}/${year}`;
  };

  // Último mês
  const umMesAtras = new Date(hoje);
  umMesAtras.setMonth(umMesAtras.getMonth() - 1);

  // Últimos 6 meses
  const seisMesesAtras = new Date(hoje);
  seisMesesAtras.setMonth(seisMesesAtras.getMonth() - 6);

  // Último ano
  const umAnoAtras = new Date(hoje);
  umAnoAtras.setFullYear(umAnoAtras.getFullYear() - 1);

  return {
    mes: `${formatShort(umMesAtras)} a ${formatShort(hoje)}`,
    semestre: `${formatShort(seisMesesAtras)} a ${formatShort(hoje)}`,
    ano: `${formatShort(umAnoAtras)} a ${formatShort(hoje)}`
  };
};

const dateRanges = getDateRanges();

export default function RupturaIndustria() {
  // Estado para aba ativa
  const [activeTab, setActiveTab] = useState('geral'); // geral, ranking

  const [fornecedores, setFornecedores] = useState([]);
  const [stats, setStats] = useState({
    TOTAL_ITENS_RUPTURA: 0,
    TOTAL_FORNECEDORES_AFETADOS: 0,
    VALOR_NAO_FATURADO: 0,
    VALOR_EXCESSO: 0,
    TOTAL_PRODUTOS_AFETADOS: 0
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filters, setFilters] = useState(getDefaultDates());
  const [expandedFornecedor, setExpandedFornecedor] = useState(null);
  const [produtosFornecedor, setProdutosFornecedor] = useState({});
  const [loadingProdutos, setLoadingProdutos] = useState({});
  const [sortConfig, setSortConfig] = useState({ key: 'QTD_ITENS_RUPTURA', direction: 'desc' });
  const [selectedPeriodo, setSelectedPeriodo] = useState('periodo'); // periodo, mes, semestre, ano

  // Estado para aba Ranking
  const [rankingProdutos, setRankingProdutos] = useState([]);
  const [loadingRanking, setLoadingRanking] = useState(false);
  const [rankingPage, setRankingPage] = useState(1);
  const rankingPerPage = 20; // Itens por página
  const [expandedRankingProduto, setExpandedRankingProduto] = useState(null); // COD_PRODUTO expandido
  const [rankingExpandedFornecedor, setRankingExpandedFornecedor] = useState(null); // COD_FORNECEDOR expandido dentro do produto
  const [rankingExpandedPedidos, setRankingExpandedPedidos] = useState({}); // Pedidos carregados por COD_PRODUTO_COD_FORNECEDOR
  const [rankingSortConfig, setRankingSortConfig] = useState({ key: 'PERCENTUAL_RUPTURA', direction: 'desc' }); // Ordenação do ranking

  // Estado para modal de histórico de compras
  const [historicoModal, setHistoricoModal] = useState({
    open: false,
    produto: null,
    historico: [],
    codFornecedorAtual: null,
    loading: false
  });

  // Estado para modal de pedidos detalhados do produto
  const [pedidosModal, setPedidosModal] = useState({
    open: false,
    produto: null,
    fornecedor: null,
    codFornecedor: null,
    pedidos: [],
    totais: null,
    loading: false
  });

  // Estado para modal de nota fiscal
  const [nfModal, setNfModal] = useState({
    open: false,
    pedido: null,
    notasFiscais: [],
    loading: false
  });

  // Estado para ordenação da tabela de produtos
  const [produtosSortConfig, setProdutosSortConfig] = useState({ key: 'QTD_CORTADA', direction: 'desc' });

  // Função para ordenar produtos
  const handleProdutosSort = (key) => {
    let direction = 'desc';
    if (produtosSortConfig.key === key && produtosSortConfig.direction === 'desc') {
      direction = 'asc';
    }
    setProdutosSortConfig({ key, direction });
  };

  // Função para obter valor de ordenação de um produto baseado no período selecionado
  const getProdutoSortValue = (produto, key) => {
    const prefix = selectedPeriodo === 'periodo' ? 'TOTAL_' :
                   selectedPeriodo === 'mes' ? 'MES_' :
                   selectedPeriodo === 'semestre' ? 'SEMESTRE_' : 'ANO_';

    // Caso especial para % RUPTURA - calcular a porcentagem
    if (key === 'PERCENT_RUPTURA') {
      const qtdPedida = produto[prefix + 'QTD_PEDIDA'] || 0;
      const qtdCortada = produto[prefix + 'QTD_CORTADA'] || 0;
      return qtdPedida > 0 ? (qtdCortada / qtdPedida) * 100 : 0;
    }

    // Caso especial para VALOR
    if (key === 'VALOR') {
      return produto[prefix + 'VALOR'] || 0;
    }

    // Caso especial para CURVA - não depende do período
    if (key === 'CURVA') {
      return produto.CURVA || 'Z'; // Z para ordenar "sem curva" por último
    }

    // Caso especial para FORA_LINHA - não depende do período
    if (key === 'FORA_LINHA') {
      return produto.FORA_LINHA || 'N'; // N = ativo (aparece primeiro em asc), S = fora do mix
    }

    return produto[prefix + key] || 0;
  };

  // Ordenar produtos
  const sortProdutos = (produtos) => {
    if (!produtosSortConfig.key) return produtos;
    return [...produtos].sort((a, b) => {
      const aVal = getProdutoSortValue(a, produtosSortConfig.key);
      const bVal = getProdutoSortValue(b, produtosSortConfig.key);
      if (aVal < bVal) return produtosSortConfig.direction === 'asc' ? -1 : 1;
      if (aVal > bVal) return produtosSortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    });
  };

  // Ordenar ranking de produtos
  const handleRankingSort = (key) => {
    let direction = 'desc';
    if (rankingSortConfig.key === key && rankingSortConfig.direction === 'desc') {
      direction = 'asc';
    }
    setRankingSortConfig({ key, direction });
    setRankingPage(1); // Voltar para primeira página ao ordenar
  };

  const sortedRankingProdutos = [...rankingProdutos].sort((a, b) => {
    if (!rankingSortConfig.key) return 0;

    let aVal, bVal;

    // Caso especial para % EXCESSO - usar TOTAL_QTD_EXCESSO do backend
    if (rankingSortConfig.key === 'PERCENTUAL_EXCESSO') {
      const aExcesso = a.TOTAL_QTD_EXCESSO || 0;
      const aPedida = a.TOTAL_QTD_PEDIDA || 1;
      const bExcesso = b.TOTAL_QTD_EXCESSO || 0;
      const bPedida = b.TOTAL_QTD_PEDIDA || 1;
      aVal = aExcesso > 0 ? (aExcesso / aPedida) * 100 : 0;
      bVal = bExcesso > 0 ? (bExcesso / bPedida) * 100 : 0;
    }
    // Caso especial para QTD EXCESSO - usar TOTAL_QTD_EXCESSO do backend
    else if (rankingSortConfig.key === 'QTD_EXCESSO') {
      aVal = a.TOTAL_QTD_EXCESSO || 0;
      bVal = b.TOTAL_QTD_EXCESSO || 0;
    }
    // Caso especial para R$ EXCESSO - calcular valor do excesso
    else if (rankingSortConfig.key === 'TOTAL_VALOR_EXCESSO') {
      aVal = a.TOTAL_VALOR_EXCESSO || 0;
      bVal = b.TOTAL_VALOR_EXCESSO || 0;
    }
    // Caso especial para FORA_LINHA - ordenação alfabética (N = ativo, S = fora do mix)
    else if (rankingSortConfig.key === 'FORA_LINHA') {
      aVal = a.FORA_LINHA || 'N';
      bVal = b.FORA_LINHA || 'N';
    } else {
      aVal = a[rankingSortConfig.key];
      bVal = b[rankingSortConfig.key];
    }

    if (aVal === null || aVal === undefined) aVal = 0;
    if (bVal === null || bVal === undefined) bVal = 0;

    // Converter strings numéricas para números
    if (typeof aVal === 'string' && !isNaN(parseFloat(aVal))) {
      aVal = parseFloat(aVal);
    }
    if (typeof bVal === 'string' && !isNaN(parseFloat(bVal))) {
      bVal = parseFloat(bVal);
    }

    // Comparação de strings (para campos de texto)
    if (typeof aVal === 'string' && typeof bVal === 'string') {
      aVal = aVal.toLowerCase();
      bVal = bVal.toLowerCase();
    }

    if (aVal < bVal) return rankingSortConfig.direction === 'asc' ? -1 : 1;
    if (aVal > bVal) return rankingSortConfig.direction === 'asc' ? 1 : -1;
    return 0;
  });

  const RankingSortIcon = ({ columnKey }) => (
    <span className="ml-1 inline-block">
      {rankingSortConfig.key === columnKey ? (
        rankingSortConfig.direction === 'asc' ? '▲' : '▼'
      ) : (
        <span className="text-gray-300">⇅</span>
      )}
    </span>
  );

  // Função para carregar histórico de compras de um produto
  const loadHistoricoCompras = async (codProduto, codFornecedor) => {
    setHistoricoModal({ open: true, produto: null, historico: [], codFornecedorAtual: codFornecedor, loading: true });
    try {
      const response = await api.get(`/ruptura-industria/produto/${codProduto}/compras?codFornecedorAtual=${codFornecedor}`);
      setHistoricoModal({
        open: true,
        produto: response.data.produto,
        historico: response.data.historico || [],
        codFornecedorAtual: codFornecedor,
        loading: false
      });
    } catch (err) {
      console.error('Erro ao carregar histórico:', err);
      setHistoricoModal({ open: false, produto: null, historico: [], codFornecedorAtual: null, loading: false });
    }
  };

  // Função para carregar pedidos detalhados de um produto
  const loadPedidosProduto = async (codProduto, codFornecedor) => {
    setPedidosModal({ open: true, produto: null, fornecedor: null, codFornecedor: null, pedidos: [], totais: null, loading: true });
    try {
      const response = await api.get(`/ruptura-industria/produto/${codProduto}/pedidos?codFornecedor=${codFornecedor}`);
      setPedidosModal({
        open: true,
        produto: response.data.produto,
        fornecedor: response.data.fornecedor,
        codFornecedor: codFornecedor,
        pedidos: response.data.pedidos || [],
        totais: response.data.totais,
        loading: false
      });
    } catch (err) {
      console.error('Erro ao carregar pedidos:', err);
      setPedidosModal({ open: false, produto: null, fornecedor: null, codFornecedor: null, pedidos: [], totais: null, loading: false });
    }
  };

  // Função para toggle do ranking - apenas expande para mostrar fornecedores (não carrega pedidos)
  const toggleRankingExpand = (produto) => {
    const codProduto = produto.COD_PRODUTO;
    const isExpanded = expandedRankingProduto === codProduto;

    if (isExpanded) {
      // Fechar - também fecha fornecedor expandido
      setExpandedRankingProduto(null);
      setRankingExpandedFornecedor(null);
    } else {
      // Abrir - mostra lista de fornecedores
      setExpandedRankingProduto(codProduto);
      setRankingExpandedFornecedor(null); // Reset fornecedor expandido
    }
  };

  // Função para toggle do fornecedor dentro do produto expandido - carrega pedidos quando clica
  const toggleRankingFornecedorExpand = async (codProduto, fornecedor) => {
    const codFornecedor = fornecedor.COD_FORNECEDOR;
    const key = `${codProduto}_${codFornecedor}`;
    const isExpanded = rankingExpandedFornecedor === key;

    if (isExpanded) {
      // Fechar
      setRankingExpandedFornecedor(null);
    } else {
      // Abrir e carregar pedidos se ainda não carregou
      setRankingExpandedFornecedor(key);

      // Se já tem pedidos carregados, não precisa carregar novamente
      if (rankingExpandedPedidos[key]) {
        return;
      }

      // Marcar como carregando
      setRankingExpandedPedidos(prev => ({
        ...prev,
        [key]: { loading: true, pedidos: [], fornecedor: null }
      }));

      try {
        const response = await api.get(`/ruptura-industria/produto/${codProduto}/pedidos?codFornecedor=${codFornecedor}`);
        setRankingExpandedPedidos(prev => ({
          ...prev,
          [key]: {
            loading: false,
            pedidos: response.data.pedidos || [],
            fornecedor: response.data.fornecedor,
            totais: response.data.totais
          }
        }));
      } catch (err) {
        console.error('Erro ao carregar pedidos:', err);
        setRankingExpandedPedidos(prev => ({
          ...prev,
          [key]: { loading: false, pedidos: [], fornecedor: null, error: true }
        }));
      }
    }
  };

  // Função para abrir modal de pedidos ao clicar na linha do produto
  const openPedidosModalFromRanking = (produto) => {
    // Pegar o primeiro fornecedor do produto
    const fornecedor = produto.fornecedores && produto.fornecedores.length > 0
      ? produto.fornecedores[0]
      : null;

    if (fornecedor) {
      loadPedidosProduto(produto.COD_PRODUTO, fornecedor.COD_FORNECEDOR);
    }
  };

  // Função para carregar nota fiscal de um pedido
  const loadNotaFiscal = async (numPedido, codProduto, codFornecedor) => {
    setNfModal({ open: true, pedido: null, notasFiscais: [], loading: true });
    try {
      const response = await api.get(`/ruptura-industria/pedido/${numPedido}/nota-fiscal?codProduto=${codProduto}&codFornecedor=${codFornecedor}`);
      setNfModal({
        open: true,
        pedido: response.data.pedido,
        notasFiscais: response.data.notasFiscais || [],
        loading: false
      });
    } catch (err) {
      console.error('Erro ao carregar nota fiscal:', err);
      setNfModal({ open: false, pedido: null, notasFiscais: [], loading: false });
    }
  };

  // Carregar ranking de fornecedores
  const loadRanking = async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (filters.dataInicio) params.append('dataInicio', filters.dataInicio);
      if (filters.dataFim) params.append('dataFim', filters.dataFim);
      params.append('limit', '100');

      const response = await api.get(`/ruptura-industria/ranking-fornecedores?${params.toString()}`);
      setFornecedores(response.data.fornecedores || []);
      setStats(response.data.stats || {
        TOTAL_ITENS_RUPTURA: 0,
        TOTAL_FORNECEDORES_AFETADOS: 0,
        VALOR_NAO_FATURADO: 0,
        VALOR_EXCESSO: 0,
        TOTAL_PRODUTOS_AFETADOS: 0
      });
    } catch (err) {
      console.error('Erro ao carregar ranking:', err);
      setError('Erro ao carregar ranking. Verifique a conexao com o Oracle.');
    } finally {
      setLoading(false);
    }
  };

  // Carregar ranking de produtos por fornecedor (aba Ranking)
  const loadRankingProdutos = async () => {
    setLoadingRanking(true);
    setRankingPage(1); // Reset para primeira página ao recarregar
    try {
      const params = new URLSearchParams();
      if (filters.dataInicio) params.append('dataInicio', filters.dataInicio);
      if (filters.dataFim) params.append('dataFim', filters.dataFim);
      params.append('limit', '5000'); // Buscar todos os produtos com ruptura

      const response = await api.get(`/ruptura-industria/ranking-produtos-fornecedores?${params.toString()}`);
      setRankingProdutos(response.data.produtos || []);
    } catch (err) {
      console.error('Erro ao carregar ranking de produtos:', err);
    } finally {
      setLoadingRanking(false);
    }
  };

  // Carregar produtos de um fornecedor
  const loadProdutosFornecedor = async (codFornecedor) => {
    console.log('=== DEBUG loadProdutosFornecedor ===');
    console.log('codFornecedor:', codFornecedor);

    if (produtosFornecedor[codFornecedor]) return;

    setLoadingProdutos(prev => ({ ...prev, [codFornecedor]: true }));
    try {
      const params = new URLSearchParams();
      if (filters.dataInicio) params.append('dataInicio', filters.dataInicio);
      if (filters.dataFim) params.append('dataFim', filters.dataFim);

      console.log('URL:', `/ruptura-industria/fornecedor/${codFornecedor}/produtos?${params.toString()}`);
      const response = await api.get(`/ruptura-industria/fornecedor/${codFornecedor}/produtos?${params.toString()}`);
      console.log('Response:', response.data);
      setProdutosFornecedor(prev => ({
        ...prev,
        [codFornecedor]: response.data.produtos || []
      }));
    } catch (err) {
      console.error('Erro ao carregar produtos:', err);
      setProdutosFornecedor(prev => ({ ...prev, [codFornecedor]: [] }));
    } finally {
      setLoadingProdutos(prev => ({ ...prev, [codFornecedor]: false }));
    }
  };

  useEffect(() => {
    loadRanking();
    loadRankingProdutos();
  }, []);

  // Carregar dados quando mudar de aba
  useEffect(() => {
    if (activeTab === 'ranking' && rankingProdutos.length === 0 && !loadingRanking) {
      loadRankingProdutos();
    }
  }, [activeTab]);

  const handleFilter = () => {
    setExpandedFornecedor(null);
    setProdutosFornecedor({});
    loadRanking();
    loadRankingProdutos();
  };

  const handleClearFilters = () => {
    setFilters(getDefaultDates());
    setExpandedFornecedor(null);
    setProdutosFornecedor({});
    setTimeout(() => {
      loadRanking();
      loadRankingProdutos();
    }, 100);
  };

  const toggleFornecedor = (codFornecedor) => {
    if (expandedFornecedor === codFornecedor) {
      setExpandedFornecedor(null);
    } else {
      setExpandedFornecedor(codFornecedor);
      loadProdutosFornecedor(codFornecedor);
    }
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '-';
    const date = new Date(dateStr);
    return date.toLocaleDateString('pt-BR');
  };

  const formatCurrency = (value) => {
    if (!value) return 'R$ 0,00';
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
  };

  const formatCNPJ = (cnpj) => {
    if (!cnpj) return '-';
    const cleaned = String(cnpj).replace(/\D/g, '');
    if (cleaned.length === 14) {
      return cleaned.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');
    }
    return cnpj;
  };

  // Ordenar fornecedores
  const handleSort = (key) => {
    let direction = 'desc';
    if (sortConfig.key === key && sortConfig.direction === 'desc') {
      direction = 'asc';
    }
    setSortConfig({ key, direction });
  };

  const sortedFornecedores = [...fornecedores].sort((a, b) => {
    if (!sortConfig.key) return 0;

    let aVal = a[sortConfig.key];
    let bVal = b[sortConfig.key];

    if (aVal === null || aVal === undefined) aVal = 0;
    if (bVal === null || bVal === undefined) bVal = 0;

    if (typeof aVal === 'string') {
      aVal = aVal.toLowerCase();
      bVal = String(bVal).toLowerCase();
    }

    if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
    if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
    return 0;
  });

  const SortIcon = ({ columnKey }) => (
    <span className="ml-1 inline-block">
      {sortConfig.key === columnKey ? (
        sortConfig.direction === 'asc' ? '▲' : '▼'
      ) : (
        <span className="text-gray-300">⇅</span>
      )}
    </span>
  );

  // Calcular valor maximo para barras de progresso
  const maxRupturas = Math.max(...fornecedores.map(f => f.QTD_ITENS_RUPTURA || 0), 1);

  return (
    <Layout title="Ruptura Industria">
      <div className="p-4 lg:p-6">
        {/* Header com estatisticas */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 mb-4">
          <div className="bg-white rounded-lg shadow p-4 border-l-4 border-red-500">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-500 uppercase">Itens com Ruptura</p>
                <p className="text-2xl font-bold text-red-600">{stats.TOTAL_ITENS_RUPTURA || 0}</p>
              </div>
              <span className="text-3xl">📋</span>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-4 border-l-4 border-orange-500">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-500 uppercase">Fornecedores Afetados</p>
                <p className="text-2xl font-bold text-orange-600">{stats.TOTAL_FORNECEDORES_AFETADOS || 0}</p>
              </div>
              <span className="text-3xl">🏭</span>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-4 border-l-4 border-yellow-500">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-500 uppercase">Produtos Afetados</p>
                <p className="text-2xl font-bold text-yellow-600">{stats.TOTAL_PRODUTOS_AFETADOS || 0}</p>
              </div>
              <span className="text-3xl">📦</span>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-4 border-l-4 border-purple-500">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-500 uppercase">Valor Nao Faturado</p>
                <p className="text-xl font-bold text-purple-600">{formatCurrency(stats.VALOR_NAO_FATURADO)}</p>
              </div>
              <span className="text-3xl">💸</span>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-4 border-l-4 border-blue-500">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-500 uppercase">Valor Excesso</p>
                <p className="text-xl font-bold text-blue-600">{formatCurrency(stats.VALOR_EXCESSO || 0)}</p>
              </div>
              <span className="text-3xl">📈</span>
            </div>
          </div>
        </div>

        {/* Filtros */}
        <div className="bg-white rounded-lg shadow p-3 mb-4">
          <h3 className="text-sm font-semibold mb-2">Filtros</h3>
          <div className="flex flex-wrap gap-2 items-end">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Data Inicio</label>
              <input
                type="date"
                value={filters.dataInicio}
                onChange={(e) => setFilters(prev => ({ ...prev, dataInicio: e.target.value }))}
                className="border rounded px-2 py-1 text-sm focus:ring-1 focus:ring-red-500 focus:border-red-500"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Data Fim</label>
              <input
                type="date"
                value={filters.dataFim}
                onChange={(e) => setFilters(prev => ({ ...prev, dataFim: e.target.value }))}
                className="border rounded px-2 py-1 text-sm focus:ring-1 focus:ring-red-500 focus:border-red-500"
              />
            </div>

            <button
              onClick={handleFilter}
              className="px-4 py-1.5 bg-red-500 text-white rounded text-sm hover:bg-red-600 transition-colors"
            >
              Filtrar
            </button>
            <button
              onClick={handleClearFilters}
              className="px-4 py-1.5 bg-gray-200 text-gray-700 rounded text-sm hover:bg-gray-300 transition-colors"
            >
              Limpar
            </button>
          </div>
        </div>

        {/* Abas */}
        <div className="flex gap-2 mb-4">
          <button
            onClick={() => setActiveTab('geral')}
            className={`px-6 py-2 rounded-t-lg font-medium text-sm transition-colors ${
              activeTab === 'geral'
                ? 'bg-red-500 text-white'
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            Geral
          </button>
          <button
            onClick={() => setActiveTab('ranking')}
            className={`px-6 py-2 rounded-t-lg font-medium text-sm transition-colors ${
              activeTab === 'ranking'
                ? 'bg-purple-500 text-white'
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            Ranking de Produtos
          </button>
        </div>

        {/* Conteúdo da aba Geral */}
        {activeTab === 'geral' && (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="px-4 py-3 bg-red-50 border-b border-red-200">
            <h3 className="text-sm font-semibold text-red-800">
              Ranking de Fornecedores com Mais Rupturas
            </h3>
            <p className="text-xs text-red-600 mt-1">
              Ruptura = itens pedidos que nao chegaram ou chegaram incompletos. Clique no fornecedor para ver os produtos.
            </p>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-red-500"></div>
            </div>
          ) : error ? (
            <div className="text-center py-12 text-red-500">
              <p>{error}</p>
              <button
                onClick={loadRanking}
                className="mt-4 px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600"
              >
                Tentar novamente
              </button>
            </div>
          ) : sortedFornecedores.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              Nenhuma ruptura encontrada no periodo
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b">
                  {/* Header com agrupamento de colunas */}
                  <tr className="border-b border-gray-200">
                    <th colSpan="4" className="px-2 py-1"></th>
                    <th colSpan="5" className="px-2 py-1 text-center bg-teal-50 border-l border-r border-teal-200 cursor-pointer hover:bg-teal-100" onClick={() => setSelectedPeriodo('periodo')}>
                      <div className="text-[10px] font-bold text-teal-700">PERIODO SELECIONADO</div>
                      <div className="text-[9px] text-teal-600 font-medium">{filters.dataInicio?.split('-').reverse().join('/').slice(0,5)} a {filters.dataFim?.split('-').reverse().join('/').slice(0,5)}</div>
                    </th>
                    <th colSpan="5" className="px-2 py-1 text-center bg-orange-50 border-r border-orange-200 cursor-pointer hover:bg-orange-100" onClick={() => setSelectedPeriodo('mes')}>
                      <div className="text-[10px] font-bold text-orange-700">ULTIMO MES</div>
                      <div className="text-[9px] text-orange-600 font-medium">{dateRanges.mes}</div>
                    </th>
                    <th colSpan="5" className="px-2 py-1 text-center bg-purple-50 border-r border-purple-200 cursor-pointer hover:bg-purple-100" onClick={() => setSelectedPeriodo('semestre')}>
                      <div className="text-[10px] font-bold text-purple-700">ULTIMOS 6 MESES</div>
                      <div className="text-[9px] text-purple-600 font-medium">{dateRanges.semestre}</div>
                    </th>
                    <th colSpan="5" className="px-2 py-1 text-center bg-blue-50 border-r border-blue-200 cursor-pointer hover:bg-blue-100" onClick={() => setSelectedPeriodo('ano')}>
                      <div className="text-[10px] font-bold text-blue-700">ULTIMO ANO</div>
                      <div className="text-[9px] text-blue-600 font-medium">{dateRanges.ano}</div>
                    </th>
                  </tr>
                  <tr>
                    <th className="px-2 py-2 text-left text-xs font-semibold text-gray-600 w-8"></th>
                    <th className="px-2 py-2 text-left text-xs font-semibold text-gray-600 w-10">
                      #
                    </th>
                    <th
                      className="px-2 py-2 text-left text-xs font-semibold text-gray-600 cursor-pointer hover:bg-gray-100"
                      onClick={() => handleSort('DES_FORNECEDOR')}
                    >
                      FORNECEDOR<SortIcon columnKey="DES_FORNECEDOR" />
                    </th>
                    <th className="px-2 py-2 text-left text-xs font-semibold text-gray-600">
                      CNPJ
                    </th>
                    {/* Periodo Selecionado */}
                    <th
                      className="px-1 py-2 text-center text-[10px] font-semibold text-teal-600 bg-teal-50 border-l border-teal-200 cursor-pointer hover:bg-teal-100"
                      onClick={() => handleSort('PERIODO_PEDIDOS')}
                      title="Pedidos no periodo selecionado"
                    >
                      PED.<SortIcon columnKey="PERIODO_PEDIDOS" />
                    </th>
                    <th
                      className="px-1 py-2 text-center text-[10px] font-semibold text-teal-600 bg-teal-50 cursor-pointer hover:bg-teal-100"
                      onClick={() => handleSort('PERIODO_TOTAL')}
                      title="Total de itens no periodo selecionado"
                    >
                      ITENS<SortIcon columnKey="PERIODO_TOTAL" />
                    </th>
                    <th
                      className="px-1 py-2 text-center text-[10px] font-semibold text-red-600 bg-teal-50 cursor-pointer hover:bg-teal-100"
                      onClick={() => handleSort('PERIODO_RUPTURA')}
                      title="Itens com ruptura no periodo selecionado"
                    >
                      RUPT.<SortIcon columnKey="PERIODO_RUPTURA" />
                    </th>
                    <th
                      className="px-1 py-2 text-center text-[10px] font-semibold text-green-600 bg-teal-50 cursor-pointer hover:bg-teal-100"
                      onClick={() => handleSort('PERIODO_OK')}
                      title="Itens recebidos completos no periodo selecionado"
                    >
                      OK<SortIcon columnKey="PERIODO_OK" />
                    </th>
                    <th
                      className="px-1 py-2 text-center text-[10px] font-semibold text-purple-700 bg-teal-50 border-r border-teal-200 cursor-pointer hover:bg-teal-100"
                      onClick={() => handleSort('PERIODO_VALOR')}
                      title="Valor das rupturas no periodo selecionado"
                    >
                      R$<SortIcon columnKey="PERIODO_VALOR" />
                    </th>
                    {/* Ultimo Mes */}
                    <th
                      className="px-1 py-2 text-center text-[10px] font-semibold text-orange-600 bg-orange-50 border-l border-orange-200 cursor-pointer hover:bg-orange-100"
                      onClick={() => handleSort('MES_PEDIDOS')}
                      title="Pedidos no ultimo mes"
                    >
                      PED.<SortIcon columnKey="MES_PEDIDOS" />
                    </th>
                    <th
                      className="px-1 py-2 text-center text-[10px] font-semibold text-orange-600 bg-orange-50 cursor-pointer hover:bg-orange-100"
                      onClick={() => handleSort('MES_TOTAL')}
                      title="Total de itens no ultimo mes"
                    >
                      ITENS<SortIcon columnKey="MES_TOTAL" />
                    </th>
                    <th
                      className="px-1 py-2 text-center text-[10px] font-semibold text-red-600 bg-orange-50 cursor-pointer hover:bg-orange-100"
                      onClick={() => handleSort('MES_RUPTURA')}
                      title="Itens com ruptura no ultimo mes"
                    >
                      RUPT.<SortIcon columnKey="MES_RUPTURA" />
                    </th>
                    <th
                      className="px-1 py-2 text-center text-[10px] font-semibold text-green-600 bg-orange-50 cursor-pointer hover:bg-orange-100"
                      onClick={() => handleSort('MES_OK')}
                      title="Itens recebidos completos no ultimo mes"
                    >
                      OK<SortIcon columnKey="MES_OK" />
                    </th>
                    <th
                      className="px-1 py-2 text-center text-[10px] font-semibold text-purple-700 bg-orange-50 border-r border-orange-200 cursor-pointer hover:bg-orange-100"
                      onClick={() => handleSort('MES_VALOR')}
                      title="Valor das rupturas no ultimo mes"
                    >
                      R$<SortIcon columnKey="MES_VALOR" />
                    </th>
                    {/* Ultimos 6 Meses */}
                    <th
                      className="px-1 py-2 text-center text-[10px] font-semibold text-purple-600 bg-purple-50 border-l border-purple-200 cursor-pointer hover:bg-purple-100"
                      onClick={() => handleSort('SEMESTRE_PEDIDOS')}
                      title="Pedidos nos ultimos 6 meses"
                    >
                      PED.<SortIcon columnKey="SEMESTRE_PEDIDOS" />
                    </th>
                    <th
                      className="px-1 py-2 text-center text-[10px] font-semibold text-purple-600 bg-purple-50 cursor-pointer hover:bg-purple-100"
                      onClick={() => handleSort('SEMESTRE_TOTAL')}
                      title="Total de itens nos ultimos 6 meses"
                    >
                      ITENS<SortIcon columnKey="SEMESTRE_TOTAL" />
                    </th>
                    <th
                      className="px-1 py-2 text-center text-[10px] font-semibold text-red-600 bg-purple-50 cursor-pointer hover:bg-purple-100"
                      onClick={() => handleSort('SEMESTRE_RUPTURA')}
                      title="Itens com ruptura nos ultimos 6 meses"
                    >
                      RUPT.<SortIcon columnKey="SEMESTRE_RUPTURA" />
                    </th>
                    <th
                      className="px-1 py-2 text-center text-[10px] font-semibold text-green-600 bg-purple-50 cursor-pointer hover:bg-purple-100"
                      onClick={() => handleSort('SEMESTRE_OK')}
                      title="Itens recebidos completos nos ultimos 6 meses"
                    >
                      OK<SortIcon columnKey="SEMESTRE_OK" />
                    </th>
                    <th
                      className="px-1 py-2 text-center text-[10px] font-semibold text-purple-700 bg-purple-50 border-r border-purple-200 cursor-pointer hover:bg-purple-100"
                      onClick={() => handleSort('SEMESTRE_VALOR')}
                      title="Valor das rupturas nos ultimos 6 meses"
                    >
                      R$<SortIcon columnKey="SEMESTRE_VALOR" />
                    </th>
                    {/* Ultimo Ano */}
                    <th
                      className="px-1 py-2 text-center text-[10px] font-semibold text-blue-600 bg-blue-50 border-l border-blue-200 cursor-pointer hover:bg-blue-100"
                      onClick={() => handleSort('ANO_PEDIDOS')}
                      title="Pedidos no ultimo ano"
                    >
                      PED.<SortIcon columnKey="ANO_PEDIDOS" />
                    </th>
                    <th
                      className="px-1 py-2 text-center text-[10px] font-semibold text-blue-600 bg-blue-50 cursor-pointer hover:bg-blue-100"
                      onClick={() => handleSort('ANO_TOTAL')}
                      title="Total de itens no ultimo ano"
                    >
                      ITENS<SortIcon columnKey="ANO_TOTAL" />
                    </th>
                    <th
                      className="px-1 py-2 text-center text-[10px] font-semibold text-red-600 bg-blue-50 cursor-pointer hover:bg-blue-100"
                      onClick={() => handleSort('ANO_RUPTURA')}
                      title="Itens com ruptura no ultimo ano"
                    >
                      RUPT.<SortIcon columnKey="ANO_RUPTURA" />
                    </th>
                    <th
                      className="px-1 py-2 text-center text-[10px] font-semibold text-green-600 bg-blue-50 cursor-pointer hover:bg-blue-100"
                      onClick={() => handleSort('ANO_OK')}
                      title="Itens recebidos completos no ultimo ano"
                    >
                      OK<SortIcon columnKey="ANO_OK" />
                    </th>
                    <th
                      className="px-1 py-2 text-center text-[10px] font-semibold text-purple-700 bg-blue-50 border-r border-blue-200 cursor-pointer hover:bg-blue-100"
                      onClick={() => handleSort('ANO_VALOR')}
                      title="Valor das rupturas no ultimo ano"
                    >
                      R$<SortIcon columnKey="ANO_VALOR" />
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {sortedFornecedores.map((fornecedor, index) => {
                    const isExpanded = expandedFornecedor === fornecedor.COD_FORNECEDOR;
                    const produtos = produtosFornecedor[fornecedor.COD_FORNECEDOR] || [];
                    const isLoadingProds = loadingProdutos[fornecedor.COD_FORNECEDOR];
                    const percentual = ((fornecedor.QTD_ITENS_RUPTURA || 0) / maxRupturas) * 100;

                    return (
                      <>
                        <tr
                          key={fornecedor.COD_FORNECEDOR}
                          className={`hover:bg-gray-50 cursor-pointer ${isExpanded ? 'bg-red-50' : ''}`}
                          onClick={() => toggleFornecedor(fornecedor.COD_FORNECEDOR)}
                        >
                          <td className="px-2 py-2">
                            <button
                              className={`w-5 h-5 flex items-center justify-center rounded border text-xs font-bold transition-colors ${
                                isExpanded
                                  ? 'bg-red-500 text-white border-red-500'
                                  : 'bg-white text-gray-500 border-gray-300 hover:border-red-500 hover:text-red-500'
                              }`}
                            >
                              {isExpanded ? '−' : '+'}
                            </button>
                          </td>
                          <td className="px-2 py-2">
                            <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold ${
                              index === 0 ? 'bg-red-500 text-white' :
                              index === 1 ? 'bg-orange-500 text-white' :
                              index === 2 ? 'bg-yellow-500 text-white' :
                              'bg-gray-200 text-gray-600'
                            }`}>
                              {index + 1}
                            </span>
                          </td>
                          <td className="px-2 py-2 font-medium text-gray-900 max-w-[180px] truncate" title={fornecedor.DES_FORNECEDOR}>
                            {fornecedor.DES_FORNECEDOR || '-'}
                          </td>
                          <td className="px-2 py-2 text-xs text-gray-500 font-mono">
                            {formatCNPJ(fornecedor.NUM_CGC)}
                          </td>
                          {/* Periodo Selecionado */}
                          <td className="px-1 py-2 text-center text-xs bg-teal-50 border-l border-teal-200">
                            {fornecedor.PERIODO_PEDIDOS || 0}
                          </td>
                          <td className="px-1 py-2 text-center text-xs bg-teal-50 font-semibold">
                            {fornecedor.PERIODO_TOTAL || 0}
                          </td>
                          <td className="px-1 py-2 text-center text-xs font-bold text-red-600 bg-teal-50">
                            {fornecedor.PERIODO_RUPTURA || 0}
                          </td>
                          <td className="px-1 py-2 text-center text-xs text-green-600 bg-teal-50">
                            {fornecedor.PERIODO_OK || 0}
                          </td>
                          <td className="px-1 py-2 text-center text-xs font-semibold text-purple-700 bg-teal-50 border-r border-teal-200">
                            {formatCurrency(fornecedor.PERIODO_VALOR).replace('R$', '').trim()}
                          </td>
                          {/* Ultimo Mes */}
                          <td className="px-1 py-2 text-center text-xs bg-orange-50 border-l border-orange-200">
                            {fornecedor.MES_PEDIDOS || 0}
                          </td>
                          <td className="px-1 py-2 text-center text-xs bg-orange-50">
                            {fornecedor.MES_TOTAL || 0}
                          </td>
                          <td className="px-1 py-2 text-center text-xs font-semibold text-red-600 bg-orange-50">
                            {fornecedor.MES_RUPTURA || 0}
                          </td>
                          <td className="px-1 py-2 text-center text-xs text-green-600 bg-orange-50">
                            {fornecedor.MES_OK || 0}
                          </td>
                          <td className="px-1 py-2 text-center text-xs font-semibold text-purple-700 bg-orange-50 border-r border-orange-200">
                            {formatCurrency(fornecedor.MES_VALOR).replace('R$', '').trim()}
                          </td>
                          {/* Ultimos 6 Meses */}
                          <td className="px-1 py-2 text-center text-xs bg-purple-50 border-l border-purple-200">
                            {fornecedor.SEMESTRE_PEDIDOS || 0}
                          </td>
                          <td className="px-1 py-2 text-center text-xs bg-purple-50">
                            {fornecedor.SEMESTRE_TOTAL || 0}
                          </td>
                          <td className="px-1 py-2 text-center text-xs font-semibold text-red-600 bg-purple-50">
                            {fornecedor.SEMESTRE_RUPTURA || 0}
                          </td>
                          <td className="px-1 py-2 text-center text-xs text-green-600 bg-purple-50">
                            {fornecedor.SEMESTRE_OK || 0}
                          </td>
                          <td className="px-1 py-2 text-center text-xs font-semibold text-purple-700 bg-purple-50 border-r border-purple-200">
                            {formatCurrency(fornecedor.SEMESTRE_VALOR).replace('R$', '').trim()}
                          </td>
                          {/* Ultimo Ano */}
                          <td className="px-1 py-2 text-center text-xs bg-blue-50 border-l border-blue-200">
                            {fornecedor.ANO_PEDIDOS || 0}
                          </td>
                          <td className="px-1 py-2 text-center text-xs bg-blue-50">
                            {fornecedor.ANO_TOTAL || 0}
                          </td>
                          <td className="px-1 py-2 text-center text-xs font-semibold text-red-600 bg-blue-50">
                            {fornecedor.ANO_RUPTURA || 0}
                          </td>
                          <td className="px-1 py-2 text-center text-xs text-green-600 bg-blue-50">
                            {fornecedor.ANO_OK || 0}
                          </td>
                          <td className="px-1 py-2 text-center text-xs font-semibold text-purple-700 bg-blue-50 border-r border-blue-200">
                            {formatCurrency(fornecedor.ANO_VALOR).replace('R$', '').trim()}
                          </td>
                        </tr>

                        {/* Linha expandida com produtos */}
                        {isExpanded && (
                          <tr key={`${fornecedor.COD_FORNECEDOR}-produtos`}>
                            <td colSpan="24" className="bg-gray-50 p-4 border-t border-b border-red-200">
                              <div className="ml-8">
                                <div className="flex items-center justify-between mb-3">
                                  <h4 className="text-sm font-semibold text-gray-700">
                                    Produtos com Ruptura de {fornecedor.DES_FORNECEDOR}
                                  </h4>
                                  <div className="flex gap-1">
                                    <button
                                      onClick={(e) => { e.stopPropagation(); setSelectedPeriodo('periodo'); }}
                                      className={`px-2 py-1 text-[10px] rounded ${selectedPeriodo === 'periodo' ? 'bg-teal-500 text-white' : 'bg-teal-100 text-teal-700 hover:bg-teal-200'}`}
                                    >
                                      PERIODO
                                    </button>
                                    <button
                                      onClick={(e) => { e.stopPropagation(); setSelectedPeriodo('mes'); }}
                                      className={`px-2 py-1 text-[10px] rounded ${selectedPeriodo === 'mes' ? 'bg-orange-500 text-white' : 'bg-orange-100 text-orange-700 hover:bg-orange-200'}`}
                                    >
                                      MES
                                    </button>
                                    <button
                                      onClick={(e) => { e.stopPropagation(); setSelectedPeriodo('semestre'); }}
                                      className={`px-2 py-1 text-[10px] rounded ${selectedPeriodo === 'semestre' ? 'bg-purple-500 text-white' : 'bg-purple-100 text-purple-700 hover:bg-purple-200'}`}
                                    >
                                      6 MESES
                                    </button>
                                    <button
                                      onClick={(e) => { e.stopPropagation(); setSelectedPeriodo('ano'); }}
                                      className={`px-2 py-1 text-[10px] rounded ${selectedPeriodo === 'ano' ? 'bg-blue-500 text-white' : 'bg-blue-100 text-blue-700 hover:bg-blue-200'}`}
                                    >
                                      ANO
                                    </button>
                                  </div>
                                </div>

                                {isLoadingProds ? (
                                  <div className="flex items-center justify-center py-4">
                                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-red-500"></div>
                                  </div>
                                ) : produtos.length === 0 ? (
                                  <p className="text-gray-500 text-sm py-2">Nenhum produto encontrado</p>
                                ) : (
                                  <table className="w-full text-xs border border-gray-200 rounded">
                                    <thead className="bg-gray-100">
                                      <tr>
                                        <th className="px-2 py-1.5 text-left font-medium text-gray-600">COD</th>
                                        <th className="px-2 py-1.5 text-left font-medium text-gray-600">PRODUTO</th>
                                        <th
                                          className="px-1 py-1.5 text-center font-medium text-gray-600 cursor-pointer hover:opacity-80"
                                          title="Status do Mix - Verde: Ativo | Vermelho: Fora do Mix - Clique para ordenar"
                                          onClick={() => handleProdutosSort('FORA_LINHA')}
                                        >
                                          MIX {produtosSortConfig.key === 'FORA_LINHA' ? (produtosSortConfig.direction === 'desc' ? '▼' : '▲') : ''}
                                        </th>
                                        <th className="px-2 py-1.5 text-center font-medium text-gray-600" title="Opções - Clique para ver histórico de compras de outros fornecedores">
                                          OPÇ.
                                        </th>
                                        <th
                                          className="px-2 py-1.5 text-center font-medium text-gray-600 cursor-pointer hover:opacity-80"
                                          title="Curva ABC do produto - Clique para ordenar"
                                          onClick={() => handleProdutosSort('CURVA')}
                                        >
                                          CURVA {produtosSortConfig.key === 'CURVA' ? (produtosSortConfig.direction === 'desc' ? '▼' : '▲') : ''}
                                        </th>
                                        <th
                                          className={`px-2 py-1.5 text-center font-medium cursor-pointer hover:opacity-80 ${
                                          selectedPeriodo === 'periodo' ? 'text-teal-600 bg-teal-50' :
                                          selectedPeriodo === 'mes' ? 'text-orange-600 bg-orange-50' :
                                          selectedPeriodo === 'semestre' ? 'text-purple-600 bg-purple-50' :
                                          'text-blue-600 bg-blue-50'
                                        }`}
                                          title="Pedidos feitos - Clique para ordenar"
                                          onClick={() => handleProdutosSort('PEDIDOS_FEITOS')}
                                        >
                                          PED. FEITOS {produtosSortConfig.key === 'PEDIDOS_FEITOS' ? (produtosSortConfig.direction === 'desc' ? '▼' : '▲') : ''}
                                        </th>
                                        <th
                                          className={`px-2 py-1.5 text-center font-medium cursor-pointer hover:opacity-80 ${
                                          selectedPeriodo === 'periodo' ? 'text-teal-600 bg-teal-50' :
                                          selectedPeriodo === 'mes' ? 'text-orange-600 bg-orange-50' :
                                          selectedPeriodo === 'semestre' ? 'text-purple-600 bg-purple-50' :
                                          'text-blue-600 bg-blue-50'
                                        }`}
                                          title="Pedidos cortados - Clique para ordenar"
                                          onClick={() => handleProdutosSort('PEDIDOS_CORTADOS')}
                                        >
                                          PED. CORTADOS {produtosSortConfig.key === 'PEDIDOS_CORTADOS' ? (produtosSortConfig.direction === 'desc' ? '▼' : '▲') : ''}
                                        </th>
                                        <th
                                          className={`px-2 py-1.5 text-center font-medium cursor-pointer hover:opacity-80 ${
                                          selectedPeriodo === 'periodo' ? 'text-teal-600 bg-teal-50' :
                                          selectedPeriodo === 'mes' ? 'text-orange-600 bg-orange-50' :
                                          selectedPeriodo === 'semestre' ? 'text-purple-600 bg-purple-50' :
                                          'text-blue-600 bg-blue-50'
                                        }`}
                                          title="Quantidade pedida - Clique para ordenar"
                                          onClick={() => handleProdutosSort('QTD_PEDIDA')}
                                        >
                                          QTD PEDIDA {produtosSortConfig.key === 'QTD_PEDIDA' ? (produtosSortConfig.direction === 'desc' ? '▼' : '▲') : ''}
                                        </th>
                                        <th
                                          className={`px-2 py-1.5 text-center font-medium cursor-pointer hover:opacity-80 ${
                                          selectedPeriodo === 'periodo' ? 'text-teal-600 bg-teal-50' :
                                          selectedPeriodo === 'mes' ? 'text-orange-600 bg-orange-50' :
                                          selectedPeriodo === 'semestre' ? 'text-purple-600 bg-purple-50' :
                                          'text-blue-600 bg-blue-50'
                                        }`}
                                          title="Quantidade entregue - Clique para ordenar"
                                          onClick={() => handleProdutosSort('QTD_ENTREGUE')}
                                        >
                                          QTD ENTREGUE {produtosSortConfig.key === 'QTD_ENTREGUE' ? (produtosSortConfig.direction === 'desc' ? '▼' : '▲') : ''}
                                        </th>
                                        <th
                                          className={`px-2 py-1.5 text-center font-medium cursor-pointer hover:opacity-80 ${
                                          selectedPeriodo === 'periodo' ? 'text-teal-600 bg-teal-50' :
                                          selectedPeriodo === 'mes' ? 'text-orange-600 bg-orange-50' :
                                          selectedPeriodo === 'semestre' ? 'text-purple-600 bg-purple-50' :
                                          'text-blue-600 bg-blue-50'
                                        }`}
                                          title="Quantidade cortada - Clique para ordenar"
                                          onClick={() => handleProdutosSort('QTD_CORTADA')}
                                        >
                                          QTD CORTADA {produtosSortConfig.key === 'QTD_CORTADA' ? (produtosSortConfig.direction === 'desc' ? '▼' : '▲') : ''}
                                        </th>
                                        <th
                                          className={`px-2 py-1.5 text-center font-medium cursor-pointer hover:opacity-80 ${
                                          selectedPeriodo === 'periodo' ? 'text-teal-600 bg-teal-50' :
                                          selectedPeriodo === 'mes' ? 'text-orange-600 bg-orange-50' :
                                          selectedPeriodo === 'semestre' ? 'text-purple-600 bg-purple-50' :
                                          'text-blue-600 bg-blue-50'
                                        }`}
                                          title="% Ruptura - Clique para ordenar"
                                          onClick={() => handleProdutosSort('PERCENT_RUPTURA')}
                                        >
                                          % RUPTURA {produtosSortConfig.key === 'PERCENT_RUPTURA' ? (produtosSortConfig.direction === 'desc' ? '▼' : '▲') : ''}
                                        </th>
                                        <th
                                          className={`px-2 py-1.5 text-right font-medium cursor-pointer hover:opacity-80 ${
                                          selectedPeriodo === 'periodo' ? 'text-teal-600 bg-teal-50' :
                                          selectedPeriodo === 'mes' ? 'text-orange-600 bg-orange-50' :
                                          selectedPeriodo === 'semestre' ? 'text-purple-600 bg-purple-50' :
                                          'text-blue-600 bg-blue-50'
                                        }`}
                                          title="Valor da ruptura - Clique para ordenar"
                                          onClick={() => handleProdutosSort('VALOR')}
                                        >
                                          VALOR {produtosSortConfig.key === 'VALOR' ? (produtosSortConfig.direction === 'desc' ? '▼' : '▲') : ''}
                                        </th>
                                      </tr>
                                    </thead>
                                    <tbody className="bg-white divide-y divide-gray-100">
                                      {sortProdutos(produtos).map((produto, idx) => {
                                        // Selecionar dados do período correto
                                        const pedFeitos = selectedPeriodo === 'periodo' ? produto.TOTAL_PEDIDOS_FEITOS :
                                                          selectedPeriodo === 'mes' ? produto.MES_PEDIDOS_FEITOS :
                                                          selectedPeriodo === 'semestre' ? produto.SEMESTRE_PEDIDOS_FEITOS :
                                                          produto.ANO_PEDIDOS_FEITOS;
                                        const pedCortados = selectedPeriodo === 'periodo' ? produto.TOTAL_PEDIDOS_CORTADOS :
                                                            selectedPeriodo === 'mes' ? produto.MES_PEDIDOS_CORTADOS :
                                                            selectedPeriodo === 'semestre' ? produto.SEMESTRE_PEDIDOS_CORTADOS :
                                                            produto.ANO_PEDIDOS_CORTADOS;
                                        const qtdPedida = selectedPeriodo === 'periodo' ? produto.TOTAL_QTD_PEDIDA :
                                                          selectedPeriodo === 'mes' ? produto.MES_QTD_PEDIDA :
                                                          selectedPeriodo === 'semestre' ? produto.SEMESTRE_QTD_PEDIDA :
                                                          produto.ANO_QTD_PEDIDA;
                                        const qtdEntregue = selectedPeriodo === 'periodo' ? produto.TOTAL_QTD_ENTREGUE :
                                                            selectedPeriodo === 'mes' ? produto.MES_QTD_ENTREGUE :
                                                            selectedPeriodo === 'semestre' ? produto.SEMESTRE_QTD_ENTREGUE :
                                                            produto.ANO_QTD_ENTREGUE;
                                        const qtdCortada = selectedPeriodo === 'periodo' ? produto.TOTAL_QTD_CORTADA :
                                                           selectedPeriodo === 'mes' ? produto.MES_QTD_CORTADA :
                                                           selectedPeriodo === 'semestre' ? produto.SEMESTRE_QTD_CORTADA :
                                                           produto.ANO_QTD_CORTADA;
                                        const valor = selectedPeriodo === 'periodo' ? produto.TOTAL_VALOR :
                                                      selectedPeriodo === 'mes' ? produto.MES_VALOR :
                                                      selectedPeriodo === 'semestre' ? produto.SEMESTRE_VALOR :
                                                      produto.ANO_VALOR;
                                        // Calcular % de ruptura
                                        const percentRuptura = qtdPedida > 0 ? ((qtdCortada || 0) / qtdPedida) * 100 : 0;
                                        const bgColor = selectedPeriodo === 'periodo' ? 'bg-teal-50' :
                                                        selectedPeriodo === 'mes' ? 'bg-orange-50' :
                                                        selectedPeriodo === 'semestre' ? 'bg-purple-50' :
                                                        'bg-blue-50';
                                        return (
                                          <tr
                                            key={idx}
                                            className="hover:bg-gray-50 cursor-pointer"
                                            onClick={() => loadPedidosProduto(produto.COD_PRODUTO, fornecedor.COD_FORNECEDOR)}
                                            title="Clique para ver os pedidos detalhados"
                                          >
                                            <td className="px-2 py-1.5 font-mono">{produto.COD_PRODUTO}</td>
                                            <td className="px-2 py-1.5 max-w-[300px] truncate" title={produto.DES_PRODUTO}>
                                              {produto.DES_PRODUTO || '-'}
                                            </td>
                                            <td className="px-1 py-1.5 text-center">
                                              <span
                                                className={`inline-flex items-center justify-center w-4 h-4 rounded-full text-[9px] font-bold ${
                                                  produto.FORA_LINHA === 'S'
                                                    ? 'bg-red-500 text-white'
                                                    : 'bg-green-500 text-white'
                                                }`}
                                                title={produto.FORA_LINHA === 'S' ? 'Produto FORA do Mix' : 'Produto Ativo no Mix'}
                                              >
                                                {produto.FORA_LINHA === 'S' ? '✕' : '✓'}
                                              </span>
                                            </td>
                                            <td className="px-2 py-1.5 text-center">
                                              {(produto.QTD_OUTROS_FORNECEDORES || 0) > 0 && (
                                                <button
                                                  onClick={(e) => {
                                                    e.stopPropagation();
                                                    loadHistoricoCompras(produto.COD_PRODUTO, fornecedor.COD_FORNECEDOR);
                                                  }}
                                                  className="w-6 h-6 rounded-full bg-blue-500 hover:bg-blue-600 text-white text-xs font-bold flex items-center justify-center mx-auto"
                                                  title={`Ver histórico de compras (${produto.QTD_OUTROS_FORNECEDORES} outros fornecedores)`}
                                                >
                                                  +{produto.QTD_OUTROS_FORNECEDORES}
                                                </button>
                                              )}
                                            </td>
                                            <td className="px-2 py-1.5 text-center">
                                              <span className={`inline-flex items-center justify-center w-5 h-5 rounded text-[10px] font-bold ${
                                                produto.CURVA === 'A' ? 'bg-green-500 text-white' :
                                                produto.CURVA === 'B' ? 'bg-blue-500 text-white' :
                                                produto.CURVA === 'C' ? 'bg-yellow-500 text-white' :
                                                produto.CURVA === 'D' ? 'bg-orange-500 text-white' :
                                                produto.CURVA === 'E' ? 'bg-red-500 text-white' :
                                                'bg-gray-300 text-gray-600'
                                              }`}>
                                                {produto.CURVA || 'X'}
                                              </span>
                                            </td>
                                            <td className={`px-2 py-1.5 text-center font-medium ${bgColor}`}>
                                              {pedFeitos || 0}
                                            </td>
                                            <td className={`px-2 py-1.5 text-center font-bold text-red-600 ${bgColor}`}>
                                              {pedCortados || 0}
                                            </td>
                                            <td className={`px-2 py-1.5 text-center font-medium ${bgColor}`}>
                                              {(qtdPedida || 0).toFixed(0)}
                                            </td>
                                            <td className={`px-2 py-1.5 text-center font-medium ${bgColor} ${
                                              qtdEntregue > qtdPedida ? 'text-blue-600 font-bold' :
                                              qtdEntregue === qtdPedida && qtdPedida > 0 ? 'text-green-600' :
                                              'text-green-600'
                                            }`} title={qtdEntregue > qtdPedida ? 'Fornecedor enviou a mais!' : ''}>
                                              {(qtdEntregue || 0).toFixed(0)}
                                              {qtdEntregue > qtdPedida && <span className="ml-1 text-[9px]">▲</span>}
                                            </td>
                                            <td className={`px-2 py-1.5 text-center font-medium text-red-600 ${bgColor}`}>
                                              {(qtdCortada || 0).toFixed(0)}
                                            </td>
                                            <td className={`px-2 py-1.5 text-center font-bold ${bgColor} text-orange-600`}>
                                              {percentRuptura.toFixed(2)}%
                                            </td>
                                            <td className={`px-2 py-1.5 text-right font-medium text-red-600 ${bgColor}`}>
                                              {formatCurrency(valor)}
                                            </td>
                                          </tr>
                                        );
                                      })}
                                    </tbody>
                                    <tfoot className="bg-gray-100">
                                      <tr>
                                        <td colSpan="3" className="px-2 py-1.5 text-right font-medium">
                                          Total: {produtos.length} produtos
                                        </td>
                                        <td className={`px-2 py-1.5 text-center font-bold ${
                                          selectedPeriodo === 'periodo' ? 'text-teal-700 bg-teal-50' :
                                          selectedPeriodo === 'mes' ? 'text-orange-700 bg-orange-50' :
                                          selectedPeriodo === 'semestre' ? 'text-purple-700 bg-purple-50' :
                                          'text-blue-700 bg-blue-50'
                                        }`}>
                                          -
                                        </td>
                                        <td className={`px-2 py-1.5 text-center font-bold text-red-600 ${
                                          selectedPeriodo === 'periodo' ? 'bg-teal-50' :
                                          selectedPeriodo === 'mes' ? 'bg-orange-50' :
                                          selectedPeriodo === 'semestre' ? 'bg-purple-50' :
                                          'bg-blue-50'
                                        }`}>
                                          {produtos.reduce((sum, p) => sum + (
                                            selectedPeriodo === 'periodo' ? (p.TOTAL_PEDIDOS_CORTADOS || 0) :
                                            selectedPeriodo === 'mes' ? (p.MES_PEDIDOS_CORTADOS || 0) :
                                            selectedPeriodo === 'semestre' ? (p.SEMESTRE_PEDIDOS_CORTADOS || 0) :
                                            (p.ANO_PEDIDOS_CORTADOS || 0)
                                          ), 0)}
                                        </td>
                                        <td className={`px-2 py-1.5 text-center font-bold ${
                                          selectedPeriodo === 'periodo' ? 'bg-teal-50' :
                                          selectedPeriodo === 'mes' ? 'bg-orange-50' :
                                          selectedPeriodo === 'semestre' ? 'bg-purple-50' :
                                          'bg-blue-50'
                                        }`}>
                                          {produtos.reduce((sum, p) => sum + (
                                            selectedPeriodo === 'periodo' ? (p.TOTAL_QTD_PEDIDA || 0) :
                                            selectedPeriodo === 'mes' ? (p.MES_QTD_PEDIDA || 0) :
                                            selectedPeriodo === 'semestre' ? (p.SEMESTRE_QTD_PEDIDA || 0) :
                                            (p.ANO_QTD_PEDIDA || 0)
                                          ), 0).toFixed(0)}
                                        </td>
                                        <td className={`px-2 py-1.5 text-center font-bold ${
                                          selectedPeriodo === 'periodo' ? 'bg-teal-50' :
                                          selectedPeriodo === 'mes' ? 'bg-orange-50' :
                                          selectedPeriodo === 'semestre' ? 'bg-purple-50' :
                                          'bg-blue-50'
                                        } ${(() => {
                                          const totalPedida = produtos.reduce((sum, p) => sum + (
                                            selectedPeriodo === 'periodo' ? (p.TOTAL_QTD_PEDIDA || 0) :
                                            selectedPeriodo === 'mes' ? (p.MES_QTD_PEDIDA || 0) :
                                            selectedPeriodo === 'semestre' ? (p.SEMESTRE_QTD_PEDIDA || 0) :
                                            (p.ANO_QTD_PEDIDA || 0)
                                          ), 0);
                                          const totalEntregue = produtos.reduce((sum, p) => sum + (
                                            selectedPeriodo === 'periodo' ? (p.TOTAL_QTD_ENTREGUE || 0) :
                                            selectedPeriodo === 'mes' ? (p.MES_QTD_ENTREGUE || 0) :
                                            selectedPeriodo === 'semestre' ? (p.SEMESTRE_QTD_ENTREGUE || 0) :
                                            (p.ANO_QTD_ENTREGUE || 0)
                                          ), 0);
                                          return totalEntregue > totalPedida ? 'text-blue-600' : 'text-green-600';
                                        })()}`}>
                                          {produtos.reduce((sum, p) => sum + (
                                            selectedPeriodo === 'periodo' ? (p.TOTAL_QTD_ENTREGUE || 0) :
                                            selectedPeriodo === 'mes' ? (p.MES_QTD_ENTREGUE || 0) :
                                            selectedPeriodo === 'semestre' ? (p.SEMESTRE_QTD_ENTREGUE || 0) :
                                            (p.ANO_QTD_ENTREGUE || 0)
                                          ), 0).toFixed(0)}
                                        </td>
                                        <td className={`px-2 py-1.5 text-center font-bold text-red-600 ${
                                          selectedPeriodo === 'periodo' ? 'bg-teal-50' :
                                          selectedPeriodo === 'mes' ? 'bg-orange-50' :
                                          selectedPeriodo === 'semestre' ? 'bg-purple-50' :
                                          'bg-blue-50'
                                        }`}>
                                          {produtos.reduce((sum, p) => sum + (
                                            selectedPeriodo === 'periodo' ? (p.TOTAL_QTD_CORTADA || 0) :
                                            selectedPeriodo === 'mes' ? (p.MES_QTD_CORTADA || 0) :
                                            selectedPeriodo === 'semestre' ? (p.SEMESTRE_QTD_CORTADA || 0) :
                                            (p.ANO_QTD_CORTADA || 0)
                                          ), 0).toFixed(0)}
                                        </td>
                                        <td className={`px-2 py-1.5 text-center font-bold text-orange-600 ${
                                          selectedPeriodo === 'periodo' ? 'bg-teal-50' :
                                          selectedPeriodo === 'mes' ? 'bg-orange-50' :
                                          selectedPeriodo === 'semestre' ? 'bg-purple-50' :
                                          'bg-blue-50'
                                        }`}>
                                          {(() => {
                                            const totalPedida = produtos.reduce((sum, p) => sum + (
                                              selectedPeriodo === 'periodo' ? (p.TOTAL_QTD_PEDIDA || 0) :
                                              selectedPeriodo === 'mes' ? (p.MES_QTD_PEDIDA || 0) :
                                              selectedPeriodo === 'semestre' ? (p.SEMESTRE_QTD_PEDIDA || 0) :
                                              (p.ANO_QTD_PEDIDA || 0)
                                            ), 0);
                                            const totalCortada = produtos.reduce((sum, p) => sum + (
                                              selectedPeriodo === 'periodo' ? (p.TOTAL_QTD_CORTADA || 0) :
                                              selectedPeriodo === 'mes' ? (p.MES_QTD_CORTADA || 0) :
                                              selectedPeriodo === 'semestre' ? (p.SEMESTRE_QTD_CORTADA || 0) :
                                              (p.ANO_QTD_CORTADA || 0)
                                            ), 0);
                                            return totalPedida > 0 ? ((totalCortada / totalPedida) * 100).toFixed(2) : 0;
                                          })()}%
                                        </td>
                                        <td className={`px-2 py-1.5 text-right font-bold text-red-600 ${
                                          selectedPeriodo === 'periodo' ? 'bg-teal-50' :
                                          selectedPeriodo === 'mes' ? 'bg-orange-50' :
                                          selectedPeriodo === 'semestre' ? 'bg-purple-50' :
                                          'bg-blue-50'
                                        }`}>
                                          {formatCurrency(produtos.reduce((sum, p) => sum + (
                                            selectedPeriodo === 'periodo' ? (p.TOTAL_VALOR || 0) :
                                            selectedPeriodo === 'mes' ? (p.MES_VALOR || 0) :
                                            selectedPeriodo === 'semestre' ? (p.SEMESTRE_VALOR || 0) :
                                            (p.ANO_VALOR || 0)
                                          ), 0))}
                                        </td>
                                      </tr>
                                    </tfoot>
                                  </table>
                                )}
                              </div>
                            </td>
                          </tr>
                        )}
                      </>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
        )}

        {/* Conteúdo da aba Ranking de Produtos */}
        {activeTab === 'ranking' && (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="px-4 py-3 bg-purple-50 border-b border-purple-200">
            <h3 className="text-sm font-semibold text-purple-800">
              Ranking de Produtos com Maior Índice de Ruptura
            </h3>
            <p className="text-xs text-purple-600 mt-1">
              Produtos ordenados por % de ruptura. Clique no ícone para ver pedidos detalhados.
            </p>
          </div>

          {loadingRanking ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-purple-500"></div>
            </div>
          ) : rankingProdutos.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              Nenhum produto com ruptura encontrado no período
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="px-2 py-2 text-center font-semibold text-gray-700 w-10"></th>
                    <th className="px-3 py-2 text-left font-semibold text-gray-700 w-16">#</th>
                    <th
                      className="px-3 py-2 text-left font-semibold text-gray-700 cursor-pointer hover:bg-gray-100"
                      onClick={() => handleRankingSort('COD_PRODUTO')}
                    >
                      COD<RankingSortIcon columnKey="COD_PRODUTO" />
                    </th>
                    <th
                      className="px-3 py-2 text-left font-semibold text-gray-700 min-w-[250px] cursor-pointer hover:bg-gray-100"
                      onClick={() => handleRankingSort('DES_PRODUTO')}
                    >
                      PRODUTO<RankingSortIcon columnKey="DES_PRODUTO" />
                    </th>
                    <th
                      className="px-2 py-2 text-center font-semibold text-gray-700 cursor-pointer hover:bg-gray-100"
                      onClick={() => handleRankingSort('FORA_LINHA')}
                      title="Status do Mix - Verde: Ativo | Vermelho: Fora do Mix - Clique para ordenar"
                    >
                      MIX<RankingSortIcon columnKey="FORA_LINHA" />
                    </th>
                    <th
                      className="px-3 py-2 text-center font-semibold text-gray-700 cursor-pointer hover:bg-gray-100"
                      onClick={() => handleRankingSort('QTD_FORNECEDORES')}
                      title="Quantidade de Fornecedores"
                    >
                      FORN.<RankingSortIcon columnKey="QTD_FORNECEDORES" />
                    </th>
                    <th
                      className="px-3 py-2 text-center font-semibold text-gray-700 cursor-pointer hover:bg-gray-100"
                      onClick={() => handleRankingSort('CURVA')}
                      title="Curva ABC do produto"
                    >
                      CURVA<RankingSortIcon columnKey="CURVA" />
                    </th>
                    <th
                      className="px-3 py-2 text-center font-semibold text-gray-700 cursor-pointer hover:bg-gray-100"
                      onClick={() => handleRankingSort('TOTAL_PEDIDOS')}
                    >
                      PED<RankingSortIcon columnKey="TOTAL_PEDIDOS" />
                    </th>
                    <th
                      className="px-3 py-2 text-center font-semibold text-gray-700 cursor-pointer hover:bg-gray-100"
                      onClick={() => handleRankingSort('CORTE_TOTAL')}
                      title="Corte Total - Nenhuma unidade entregue"
                    >
                      CORT.T<RankingSortIcon columnKey="CORTE_TOTAL" />
                    </th>
                    <th
                      className="px-3 py-2 text-center font-semibold text-gray-700 cursor-pointer hover:bg-gray-100"
                      onClick={() => handleRankingSort('CORTE_PARCIAL')}
                      title="Corte Parcial - Parte foi entregue"
                    >
                      CORT.P<RankingSortIcon columnKey="CORTE_PARCIAL" />
                    </th>
                    <th
                      className="px-3 py-2 text-center font-semibold text-gray-700 cursor-pointer hover:bg-gray-100"
                      onClick={() => handleRankingSort('TOTAL_QTD_PEDIDA')}
                      title="Quantidade Total Pedida"
                    >
                      QTD PED.<RankingSortIcon columnKey="TOTAL_QTD_PEDIDA" />
                    </th>
                    <th
                      className="px-3 py-2 text-center font-semibold text-gray-700 cursor-pointer hover:bg-gray-100"
                      onClick={() => handleRankingSort('TOTAL_QTD_ENTREGUE')}
                      title="Quantidade Total Entregue"
                    >
                      QTD ENT.<RankingSortIcon columnKey="TOTAL_QTD_ENTREGUE" />
                    </th>
                    <th
                      className="px-3 py-2 text-center font-semibold text-gray-700 cursor-pointer hover:bg-gray-100"
                      onClick={() => handleRankingSort('TOTAL_QTD_CORTADA')}
                      title="Quantidade Total Cortada"
                    >
                      QTD CORT.<RankingSortIcon columnKey="TOTAL_QTD_CORTADA" />
                    </th>
                    <th
                      className="px-3 py-2 text-center font-semibold text-gray-700 cursor-pointer hover:bg-gray-100"
                      onClick={() => handleRankingSort('QTD_EXCESSO')}
                      title="Quantidade Excesso = QTD Entregue - QTD Pedida (quando entrega mais)"
                    >
                      QTD EXC.<RankingSortIcon columnKey="QTD_EXCESSO" />
                    </th>
                    <th
                      className="px-3 py-2 text-center font-semibold text-gray-700 cursor-pointer hover:bg-gray-100"
                      onClick={() => handleRankingSort('PERCENTUAL_RUPTURA')}
                      title="% Ruptura = QTD Cortada / QTD Pedida × 100"
                    >
                      % RUPT.<RankingSortIcon columnKey="PERCENTUAL_RUPTURA" />
                    </th>
                    <th
                      className="px-3 py-2 text-center font-semibold text-gray-700 cursor-pointer hover:bg-gray-100"
                      onClick={() => handleRankingSort('PERCENTUAL_EXCESSO')}
                      title="% Excesso = (QTD Entregue - QTD Pedida) / QTD Pedida × 100 (quando entrega mais que o pedido)"
                    >
                      % EXC.<RankingSortIcon columnKey="PERCENTUAL_EXCESSO" />
                    </th>
                    <th
                      className="px-3 py-2 text-right font-semibold text-gray-700 cursor-pointer hover:bg-gray-100"
                      onClick={() => handleRankingSort('TOTAL_VALOR_CORTADO')}
                    >
                      R$ CORT.<RankingSortIcon columnKey="TOTAL_VALOR_CORTADO" />
                    </th>
                    <th
                      className="px-3 py-2 text-right font-semibold text-gray-700 cursor-pointer hover:bg-gray-100"
                      onClick={() => handleRankingSort('TOTAL_VALOR_EXCESSO')}
                      title="Valor do Excesso (quando entrega mais que o pedido)"
                    >
                      R$ EXC.<RankingSortIcon columnKey="TOTAL_VALOR_EXCESSO" />
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {sortedRankingProdutos
                    .slice((rankingPage - 1) * rankingPerPage, rankingPage * rankingPerPage)
                    .map((produto, idx) => {
                    const posicaoRanking = (rankingPage - 1) * rankingPerPage + idx + 1;
                    const isExpanded = expandedRankingProduto === produto.COD_PRODUTO;

                    return (
                      <React.Fragment key={produto.COD_PRODUTO}>
                        <tr
                          className={`hover:bg-gray-50 cursor-pointer ${isExpanded ? 'bg-purple-50' : ''}`}
                          onClick={() => openPedidosModalFromRanking(produto)}
                        >
                          {/* Botão expandir - mostra fornecedores */}
                          <td className="px-2 py-2 text-center">
                            <button
                              onClick={(e) => {
                                e.stopPropagation(); // Evita abrir modal
                                toggleRankingExpand(produto);
                              }}
                              className={`w-6 h-6 flex items-center justify-center rounded border text-xs font-bold transition-colors ${
                                isExpanded
                                  ? 'bg-blue-500 text-white border-blue-500'
                                  : 'bg-white text-blue-500 border-blue-300 hover:border-blue-500 hover:bg-blue-50'
                              }`}
                              title="Ver fornecedores"
                            >
                              {isExpanded ? '−' : '+'}
                            </button>
                          </td>
                          {/* Posição no ranking */}
                          <td className="px-3 py-2">
                            <span className={`inline-flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold ${
                              posicaoRanking === 1 ? 'bg-red-500 text-white' :
                              posicaoRanking === 2 ? 'bg-orange-500 text-white' :
                              posicaoRanking === 3 ? 'bg-yellow-500 text-white' :
                              'bg-gray-200 text-gray-600'
                            }`}>
                              {posicaoRanking}
                            </span>
                          </td>
                          <td className="px-3 py-2 font-mono text-xs">{produto.COD_PRODUTO}</td>
                          <td className="px-3 py-2 font-medium truncate max-w-[300px]" title={produto.DES_PRODUTO}>
                            {produto.DES_PRODUTO}
                          </td>
                          <td className="px-2 py-2 text-center">
                            <span
                              className={`inline-flex items-center justify-center w-5 h-5 rounded-full text-[10px] font-bold ${
                                produto.FORA_LINHA === 'S'
                                  ? 'bg-red-500 text-white'
                                  : 'bg-green-500 text-white'
                              }`}
                              title={produto.FORA_LINHA === 'S' ? 'Produto FORA do Mix' : 'Produto Ativo no Mix'}
                            >
                              {produto.FORA_LINHA === 'S' ? '✕' : '✓'}
                            </span>
                          </td>
                          <td className="px-3 py-2 text-center">
                            <span className="inline-flex items-center justify-center px-2 py-1 rounded-full text-xs bg-blue-100 text-blue-700">
                              {produto.fornecedores?.length || produto.QTD_FORNECEDORES || 0}
                            </span>
                          </td>
                          <td className="px-3 py-2 text-center">
                            <span className={`inline-flex items-center justify-center w-6 h-6 rounded text-xs font-bold ${
                              produto.CURVA === 'A' ? 'bg-green-500 text-white' :
                              produto.CURVA === 'B' ? 'bg-blue-500 text-white' :
                              produto.CURVA === 'C' ? 'bg-yellow-500 text-white' :
                              produto.CURVA === 'D' ? 'bg-orange-500 text-white' :
                              produto.CURVA === 'E' ? 'bg-red-500 text-white' :
                              'bg-gray-300 text-gray-600'
                            }`}>
                              {produto.CURVA || 'X'}
                            </span>
                          </td>
                          <td className="px-3 py-2 text-center">{produto.TOTAL_PEDIDOS || 0}</td>
                          <td className="px-3 py-2 text-center text-red-700 font-medium" title="Corte Total">{produto.CORTE_TOTAL || 0}</td>
                          <td className="px-3 py-2 text-center text-orange-600 font-medium" title="Corte Parcial">{produto.CORTE_PARCIAL || 0}</td>
                          <td className="px-3 py-2 text-center">{(produto.TOTAL_QTD_PEDIDA || 0).toFixed(3)}</td>
                          <td className="px-3 py-2 text-center text-green-600">{(produto.TOTAL_QTD_ENTREGUE || 0).toFixed(3)}</td>
                          <td className="px-3 py-2 text-center text-red-600">{(produto.TOTAL_QTD_CORTADA || 0).toFixed(3)}</td>
                          <td className="px-3 py-2 text-center text-blue-600">
                            {(produto.TOTAL_QTD_EXCESSO || 0) > 0 ? (produto.TOTAL_QTD_EXCESSO || 0).toFixed(3) : '-'}
                          </td>
                          <td className="px-3 py-2 text-center font-bold text-orange-600">
                            {((produto.TOTAL_QTD_CORTADA || 0) / (produto.TOTAL_QTD_PEDIDA || 1) * 100).toFixed(2)}%
                          </td>
                          <td className="px-3 py-2 text-center font-bold text-blue-600">
                            {(produto.TOTAL_QTD_EXCESSO || 0) > 0
                              ? (((produto.TOTAL_QTD_EXCESSO || 0) / (produto.TOTAL_QTD_PEDIDA || 1)) * 100).toFixed(2) + '%'
                              : '-'}
                          </td>
                          <td className="px-3 py-2 text-right font-medium text-red-600">
                            {formatCurrency(produto.TOTAL_VALOR_CORTADO || 0)}
                          </td>
                          <td className="px-3 py-2 text-right font-medium text-blue-600">
                            {formatCurrency(produto.TOTAL_VALOR_EXCESSO || 0)}
                          </td>
                        </tr>

                        {/* Linha expandida com CASCADE: Fornecedores → Pedidos */}
                        {isExpanded && (
                          <tr>
                            <td colSpan="15" className="bg-blue-50 p-4 border-t border-b border-blue-200">
                              <div className="ml-8">
                                <h4 className="text-sm font-semibold text-gray-700 mb-2">
                                  Fornecedores - {produto.DES_PRODUTO}
                                </h4>

                                {produto.fornecedores && produto.fornecedores.length > 0 ? (
                                  <div className="space-y-1">
                                    {/* Cabeçalho das colunas */}
                                    <div className="flex items-center justify-between px-4 py-1 text-xs font-medium text-gray-500 border-b bg-gray-100 rounded-t">
                                      <div className="flex items-center gap-3 min-w-[350px]">
                                        <span className="w-5"></span>
                                        <span className="w-10">CÓD</span>
                                        <span>FORNECEDOR</span>
                                      </div>
                                      <div className="flex items-center gap-3">
                                        <span className="w-16 text-center">PED.</span>
                                        <span className="w-20 text-center">QTD PED.</span>
                                        <span className="w-20 text-center text-green-600">QTD ENT.</span>
                                        <span className="w-20 text-center text-red-600">QTD CORT.</span>
                                        <span className="w-20 text-center text-blue-600">QTD EXC.</span>
                                        <span className="w-16 text-center text-orange-600">% RUPT.</span>
                                        <span className="w-16 text-center text-blue-600">% EXC.</span>
                                        <span className="w-20 text-right text-red-600">R$ CORT.</span>
                                        <span className="w-20 text-right text-blue-600">R$ EXC.</span>
                                        <span className="w-20 ml-2"></span>
                                      </div>
                                    </div>
                                    {produto.fornecedores.map((forn, fidx) => {
                                      const fornKey = `${produto.COD_PRODUTO}_${forn.COD_FORNECEDOR}`;
                                      const isFornExpanded = rankingExpandedFornecedor === fornKey;
                                      const pedidosData = rankingExpandedPedidos[fornKey];

                                      // Calcular percentuais do fornecedor
                                      const qtdPedidaForn = forn.QTD_PEDIDA || 0;
                                      const qtdCortadaForn = forn.QTD_CORTADA || 0;
                                      const qtdExcessoForn = forn.QTD_EXCESSO || 0;
                                      const percRupturaForn = qtdPedidaForn > 0 ? (qtdCortadaForn / qtdPedidaForn) * 100 : 0;
                                      const percExcessoForn = qtdPedidaForn > 0 && qtdExcessoForn > 0 ? (qtdExcessoForn / qtdPedidaForn) * 100 : 0;

                                      return (
                                        <div key={fidx} className="border rounded bg-white overflow-hidden">
                                          {/* Linha do fornecedor - clicável */}
                                          <div
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              toggleRankingFornecedorExpand(produto.COD_PRODUTO, forn);
                                            }}
                                            className={`flex items-center justify-between px-4 py-2 cursor-pointer transition-colors ${
                                              isFornExpanded ? 'bg-blue-100' : 'hover:bg-gray-50'
                                            }`}
                                          >
                                            <div className="flex items-center gap-3 min-w-[350px]">
                                              <span className={`w-5 h-5 flex items-center justify-center rounded text-xs font-bold ${
                                                isFornExpanded ? 'bg-blue-500 text-white' : 'bg-gray-200 text-gray-600'
                                              }`}>
                                                {isFornExpanded ? '−' : '+'}
                                              </span>
                                              <span className="font-mono text-xs text-gray-500">{forn.COD_FORNECEDOR}</span>
                                              <span className="font-medium text-gray-800 truncate max-w-[250px]" title={forn.DES_FORNECEDOR}>{forn.DES_FORNECEDOR}</span>
                                            </div>
                                            <div className="flex items-center gap-3 text-xs">
                                              <span className="text-gray-600 w-16 text-center">Ped: <strong>{forn.TOTAL_PEDIDOS || 0}</strong></span>
                                              <span className="text-gray-600 w-20 text-center">{qtdPedidaForn.toFixed(3)}</span>
                                              <span className="text-green-600 w-20 text-center">{(forn.QTD_ENTREGUE || 0).toFixed(3)}</span>
                                              <span className="text-red-600 w-20 text-center font-medium">{qtdCortadaForn > 0 ? qtdCortadaForn.toFixed(3) : '-'}</span>
                                              <span className="text-blue-600 w-20 text-center font-medium">{qtdExcessoForn > 0 ? qtdExcessoForn.toFixed(3) : '-'}</span>
                                              <span className="text-orange-600 w-16 text-center font-bold">{percRupturaForn > 0 ? percRupturaForn.toFixed(2) + '%' : '-'}</span>
                                              <span className="text-blue-600 w-16 text-center font-bold">{percExcessoForn > 0 ? percExcessoForn.toFixed(2) + '%' : '-'}</span>
                                              <span className="text-red-600 w-20 text-right font-medium">{formatCurrency(forn.VALOR_CORTADO || 0)}</span>
                                              <span className="text-blue-600 w-20 text-right font-medium">{formatCurrency(forn.VALOR_EXCESSO || 0)}</span>
                                              <button
                                                onClick={(e) => {
                                                  e.stopPropagation();
                                                  loadHistoricoCompras(produto.COD_PRODUTO, forn.COD_FORNECEDOR);
                                                }}
                                                className="px-2 py-1 bg-blue-100 text-blue-700 rounded hover:bg-blue-200 ml-2"
                                              >
                                                Histórico
                                              </button>
                                            </div>
                                          </div>

                                          {/* Pedidos do fornecedor (expandido) */}
                                          {isFornExpanded && (
                                            <div className="border-t bg-gray-50 p-4">
                                              {pedidosData?.loading ? (
                                                <div className="flex items-center justify-center py-4">
                                                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500"></div>
                                                  <span className="ml-2 text-gray-600 text-sm">Carregando pedidos...</span>
                                                </div>
                                              ) : pedidosData?.pedidos?.length > 0 ? (
                                                <table className="w-full text-xs border border-gray-200 rounded bg-white">
                                                  <thead className="bg-gray-100">
                                                    <tr>
                                                      <th className="px-3 py-2 text-center font-medium text-gray-600">PEDIDO</th>
                                                      <th className="px-3 py-2 text-center font-medium text-gray-600">DATA</th>
                                                      <th className="px-3 py-2 text-center font-medium text-gray-600">DIAS</th>
                                                      <th className="px-3 py-2 text-center font-medium text-gray-600">QTD PEDIDA</th>
                                                      <th className="px-3 py-2 text-center font-medium text-gray-600">QTD ENTREGUE</th>
                                                      <th className="px-3 py-2 text-center font-medium text-red-600">QTD CORT.</th>
                                                      <th className="px-3 py-2 text-center font-medium text-blue-600">QTD EXC.</th>
                                                      <th className="px-3 py-2 text-center font-medium text-gray-600">STATUS</th>
                                                      <th className="px-3 py-2 text-right font-medium text-red-600">R$ CORT.</th>
                                                      <th className="px-3 py-2 text-right font-medium text-blue-600">R$ EXC.</th>
                                                    </tr>
                                                  </thead>
                                                  <tbody className="divide-y divide-gray-100">
                                                    {pedidosData.pedidos.map((pedido, pidx) => (
                                                      <tr key={pidx} className={`hover:bg-gray-50 ${pedido.STATUS === 'RUPTURA' ? 'bg-red-50' : pedido.STATUS === 'EXCESSO' ? 'bg-blue-50' : ''}`}>
                                                        <td className="px-3 py-2 text-center font-mono">{pedido.NUM_PEDIDO}</td>
                                                        <td className="px-3 py-2 text-center">
                                                          {pedido.DATA ? new Date(pedido.DATA).toLocaleDateString('pt-BR') : '-'}
                                                        </td>
                                                        <td className="px-3 py-2 text-center">{pedido.DIAS || 0}</td>
                                                        <td className="px-3 py-2 text-center">{(pedido.QTD_PEDIDA || 0).toFixed(3)}</td>
                                                        <td className="px-3 py-2 text-center text-green-600">
                                                          {(pedido.QTD_ENTREGUE || 0).toFixed(3)}
                                                        </td>
                                                        <td className="px-3 py-2 text-center text-red-600 font-medium">
                                                          {pedido.QTD_CORTADA > 0 ? pedido.QTD_CORTADA.toFixed(3) : '-'}
                                                        </td>
                                                        <td className="px-3 py-2 text-center text-blue-600 font-medium">
                                                          {pedido.QTD_EXTRA > 0 ? pedido.QTD_EXTRA.toFixed(3) : '-'}
                                                        </td>
                                                        <td className="px-3 py-2 text-center">
                                                          <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                                                            pedido.STATUS === 'RUPTURA' ? 'bg-red-100 text-red-700' :
                                                            pedido.STATUS === 'EXCESSO' ? 'bg-blue-100 text-blue-700' :
                                                            'bg-green-100 text-green-700'
                                                          }`}>
                                                            {pedido.STATUS}
                                                          </span>
                                                        </td>
                                                        <td className="px-3 py-2 text-right text-red-600 font-medium">
                                                          {pedido.VALOR_CORTADO > 0 ? formatCurrency(pedido.VALOR_CORTADO) : '-'}
                                                        </td>
                                                        <td className="px-3 py-2 text-right text-blue-600 font-medium">
                                                          {pedido.QTD_EXTRA > 0 ? formatCurrency(pedido.VALOR_EXCESSO || 0) : '-'}
                                                        </td>
                                                      </tr>
                                                    ))}
                                                  </tbody>
                                                </table>
                                              ) : (
                                                <p className="text-gray-500 text-sm py-2">Nenhum pedido encontrado</p>
                                              )}
                                            </div>
                                          )}
                                        </div>
                                      );
                                    })}
                                  </div>
                                ) : (
                                  <p className="text-gray-500 text-sm py-4">Nenhum fornecedor encontrado</p>
                                )}
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>

              {/* Paginação */}
              {rankingProdutos.length > rankingPerPage && (
                <div className="px-4 py-3 bg-gray-50 border-t flex items-center justify-between">
                  <div className="text-sm text-gray-600">
                    Mostrando {((rankingPage - 1) * rankingPerPage) + 1} a {Math.min(rankingPage * rankingPerPage, rankingProdutos.length)} de {rankingProdutos.length} produtos
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setRankingPage(1)}
                      disabled={rankingPage === 1}
                      className={`px-3 py-1 text-sm rounded ${rankingPage === 1 ? 'bg-gray-200 text-gray-400 cursor-not-allowed' : 'bg-purple-100 text-purple-700 hover:bg-purple-200'}`}
                    >
                      « Primeira
                    </button>
                    <button
                      onClick={() => setRankingPage(p => Math.max(1, p - 1))}
                      disabled={rankingPage === 1}
                      className={`px-3 py-1 text-sm rounded ${rankingPage === 1 ? 'bg-gray-200 text-gray-400 cursor-not-allowed' : 'bg-purple-100 text-purple-700 hover:bg-purple-200'}`}
                    >
                      ‹ Anterior
                    </button>
                    <span className="px-3 py-1 text-sm font-medium bg-purple-500 text-white rounded">
                      {rankingPage} / {Math.ceil(rankingProdutos.length / rankingPerPage)}
                    </span>
                    <button
                      onClick={() => setRankingPage(p => Math.min(Math.ceil(rankingProdutos.length / rankingPerPage), p + 1))}
                      disabled={rankingPage >= Math.ceil(rankingProdutos.length / rankingPerPage)}
                      className={`px-3 py-1 text-sm rounded ${rankingPage >= Math.ceil(rankingProdutos.length / rankingPerPage) ? 'bg-gray-200 text-gray-400 cursor-not-allowed' : 'bg-purple-100 text-purple-700 hover:bg-purple-200'}`}
                    >
                      Próxima ›
                    </button>
                    <button
                      onClick={() => setRankingPage(Math.ceil(rankingProdutos.length / rankingPerPage))}
                      disabled={rankingPage >= Math.ceil(rankingProdutos.length / rankingPerPage)}
                      className={`px-3 py-1 text-sm rounded ${rankingPage >= Math.ceil(rankingProdutos.length / rankingPerPage) ? 'bg-gray-200 text-gray-400 cursor-not-allowed' : 'bg-purple-100 text-purple-700 hover:bg-purple-200'}`}
                    >
                      Última »
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
        )}
      </div>

      {/* Modal de Histórico de Compras */}
      {historicoModal.open && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full mx-4 max-h-[80vh] overflow-hidden">
            {/* Header do Modal */}
            <div className="bg-blue-600 text-white px-4 py-3 flex items-center justify-between">
              <h3 className="text-lg font-semibold">
                Histórico de Compras
                {historicoModal.produto && (
                  <span className="ml-2 text-sm font-normal opacity-90">
                    {historicoModal.produto.COD_PRODUTO} - {historicoModal.produto.DES_PRODUTO}
                  </span>
                )}
              </h3>
              <button
                onClick={() => setHistoricoModal({ open: false, produto: null, historico: [], codFornecedorAtual: null, loading: false })}
                className="text-white hover:text-gray-200 text-2xl font-bold"
              >
                ×
              </button>
            </div>

            {/* Conteúdo do Modal */}
            <div className="p-4 overflow-y-auto max-h-[60vh]">
              {historicoModal.loading ? (
                <div className="flex items-center justify-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
                </div>
              ) : historicoModal.historico.length === 0 ? (
                <p className="text-center text-gray-500 py-8">Nenhum histórico de compras encontrado</p>
              ) : (() => {
                // Calcular o menor custo para destacar em verde
                const menorCusto = Math.min(...historicoModal.historico.filter(h => h.CUSTO_REP > 0).map(h => h.CUSTO_REP));
                return (
                <table className="w-full text-sm border border-gray-200">
                  <thead className="bg-gray-100">
                    <tr>
                      <th className="px-3 py-2 text-left font-semibold text-gray-700">Data</th>
                      <th className="px-3 py-2 text-center font-semibold text-gray-700">Dias</th>
                      <th className="px-3 py-2 text-left font-semibold text-gray-700">Fornecedor</th>
                      <th className="px-3 py-2 text-center font-semibold text-gray-700">Qtd</th>
                      <th className="px-3 py-2 text-right font-semibold text-gray-700">Custo Rep.</th>
                      <th className="px-3 py-2 text-right font-semibold text-gray-700">Total</th>
                      <th className="px-3 py-2 text-center font-semibold text-gray-700">NF</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {historicoModal.historico.map((item, idx) => {
                      const isMenorCusto = item.CUSTO_REP === menorCusto && item.CUSTO_REP > 0;
                      // Destacar em VERMELHO se for fornecedor diferente do atual
                      const isFornecedorDiferente = historicoModal.codFornecedorAtual &&
                        item.COD_FORNECEDOR !== historicoModal.codFornecedorAtual;
                      return (
                      <tr key={idx} className={`hover:bg-gray-50 ${isFornecedorDiferente ? 'bg-red-50 border-l-4 border-red-500' : ''}`}>
                        <td className="px-3 py-2">{formatDate(item.DATA)}</td>
                        <td className="px-3 py-2 text-center">{item.DIAS}</td>
                        <td className={`px-3 py-2 max-w-[200px] truncate ${isFornecedorDiferente ? 'text-red-700 font-bold' : ''}`} title={item.FORNECEDOR}>
                          {item.FORNECEDOR}
                        </td>
                        <td className="px-3 py-2 text-center">{item.QTD}</td>
                        <td className={`px-3 py-2 text-right font-bold ${isMenorCusto ? 'text-green-600' : 'text-red-600'}`}>
                          {formatCurrency(item.CUSTO_REP)}
                        </td>
                        <td className="px-3 py-2 text-right font-medium text-red-600">{formatCurrency(item.TOTAL)}</td>
                        <td className="px-3 py-2 text-center font-mono text-xs">{item.NF}</td>
                      </tr>
                    )})}
                  </tbody>
                </table>
              );})()}
            </div>

            {/* Footer do Modal */}
            <div className="bg-gray-50 px-4 py-3 flex justify-end border-t">
              <button
                onClick={() => setHistoricoModal({ open: false, produto: null, historico: [], codFornecedorAtual: null, loading: false })}
                className="px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Pedidos Detalhados do Produto */}
      {pedidosModal.open && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-5xl w-full mx-4 max-h-[85vh] overflow-hidden">
            {/* Header do Modal */}
            <div className="bg-orange-600 text-white px-4 py-3 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold">
                  Pedidos Detalhados
                </h3>
                {pedidosModal.produto && (
                  <p className="text-sm font-normal opacity-90">
                    {pedidosModal.produto.COD_PRODUTO} - {pedidosModal.produto.DES_PRODUTO}
                  </p>
                )}
                {pedidosModal.fornecedor && (
                  <p className="text-xs font-normal opacity-75">
                    Fornecedor: {pedidosModal.fornecedor}
                  </p>
                )}
              </div>
              <button
                onClick={() => setPedidosModal({ open: false, produto: null, fornecedor: null, codFornecedor: null, pedidos: [], totais: null, loading: false })}
                className="text-white hover:text-gray-200 text-2xl font-bold"
              >
                ×
              </button>
            </div>

            {/* Conteúdo do Modal */}
            <div className="p-4 overflow-y-auto max-h-[65vh]">
              {pedidosModal.loading ? (
                <div className="flex items-center justify-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500"></div>
                </div>
              ) : pedidosModal.pedidos.length === 0 ? (
                <p className="text-center text-gray-500 py-8">Nenhum pedido encontrado</p>
              ) : (
                <>
                  {/* Cards de Resumo */}
                  {pedidosModal.totais && (
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-4">
                      <div className="bg-gray-50 rounded-lg p-3 text-center">
                        <p className="text-xs text-gray-500">Total Pedidos</p>
                        <p className="text-xl font-bold text-gray-700">{pedidosModal.totais.TOTAL_PEDIDOS}</p>
                      </div>
                      <div className="bg-blue-50 rounded-lg p-3 text-center">
                        <p className="text-xs text-blue-600">Qtd Pedida</p>
                        <p className="text-xl font-bold text-blue-700">{pedidosModal.totais.TOTAL_QTD_PEDIDA?.toFixed(0) || 0}</p>
                      </div>
                      <div className="bg-green-50 rounded-lg p-3 text-center">
                        <p className="text-xs text-green-600">Qtd Entregue</p>
                        <p className="text-xl font-bold text-green-700">{pedidosModal.totais.TOTAL_QTD_ENTREGUE?.toFixed(0) || 0}</p>
                      </div>
                      <div className="bg-red-50 rounded-lg p-3 text-center">
                        <p className="text-xs text-red-600">Qtd Cortada</p>
                        <p className="text-xl font-bold text-red-700">{pedidosModal.totais.TOTAL_QTD_CORTADA?.toFixed(0) || 0}</p>
                      </div>
                      <div className="bg-purple-50 rounded-lg p-3 text-center">
                        <p className="text-xs text-purple-600">% Ruptura</p>
                        <p className="text-xl font-bold text-purple-700">
                          {pedidosModal.totais.TOTAL_QTD_PEDIDA > 0
                            ? ((pedidosModal.totais.TOTAL_QTD_CORTADA / pedidosModal.totais.TOTAL_QTD_PEDIDA) * 100).toFixed(2)
                            : 0}%
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Tabela de Pedidos */}
                  <table className="w-full text-sm border border-gray-200">
                    <thead className="bg-gray-100">
                      <tr>
                        <th className="px-3 py-2 text-center font-semibold text-gray-700">Pedido</th>
                        <th className="px-3 py-2 text-center font-semibold text-gray-700">Data</th>
                        <th className="px-3 py-2 text-center font-semibold text-gray-700">Dias</th>
                        <th className="px-3 py-2 text-center font-semibold text-blue-600 bg-blue-50">Qtd Pedida</th>
                        <th className="px-3 py-2 text-center font-semibold text-green-600 bg-green-50">Qtd Entregue</th>
                        <th className="px-3 py-2 text-center font-semibold text-red-600 bg-red-50">Qtd Cortada</th>
                        <th className="px-3 py-2 text-center font-semibold text-gray-700">Status</th>
                        <th className="px-3 py-2 text-right font-semibold text-red-600">Valor Cortado</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {pedidosModal.pedidos.map((pedido, idx) => (
                        <tr
                          key={idx}
                          className={`hover:bg-gray-50 cursor-pointer ${pedido.STATUS === 'RUPTURA' ? 'bg-red-50' : pedido.STATUS === 'EXCESSO' ? 'bg-blue-50' : ''}`}
                          onClick={() => loadNotaFiscal(pedido.NUM_PEDIDO, pedidosModal.produto?.COD_PRODUTO, pedidosModal.codFornecedor)}
                          title="Clique para ver a nota fiscal relacionada"
                        >
                          <td className="px-3 py-2 text-center font-mono">{pedido.NUM_PEDIDO}</td>
                          <td className="px-3 py-2 text-center">{formatDate(pedido.DATA)}</td>
                          <td className="px-3 py-2 text-center text-gray-500">{pedido.DIAS}</td>
                          <td className="px-3 py-2 text-center font-medium bg-blue-50">{pedido.QTD_PEDIDA?.toFixed(0) || 0}</td>
                          <td className={`px-3 py-2 text-center font-medium bg-green-50 ${
                            pedido.QTD_ENTREGUE > pedido.QTD_PEDIDA ? 'text-blue-600 font-bold' : 'text-green-600'
                          }`}>
                            {pedido.QTD_ENTREGUE?.toFixed(0) || 0}
                            {pedido.QTD_ENTREGUE > pedido.QTD_PEDIDA && <span className="ml-1 text-xs">+{(pedido.QTD_ENTREGUE - pedido.QTD_PEDIDA).toFixed(0)}</span>}
                          </td>
                          <td className="px-3 py-2 text-center font-bold text-red-600 bg-red-50">
                            {pedido.QTD_CORTADA > 0 ? pedido.QTD_CORTADA?.toFixed(0) : '-'}
                          </td>
                          <td className="px-3 py-2 text-center">
                            <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold ${
                              pedido.STATUS === 'RUPTURA' ? 'bg-red-100 text-red-700' :
                              pedido.STATUS === 'EXCESSO' ? 'bg-blue-100 text-blue-700' :
                              'bg-green-100 text-green-700'
                            }`}>
                              {pedido.STATUS}
                            </span>
                          </td>
                          <td className="px-3 py-2 text-right font-medium text-red-600">
                            {pedido.VALOR_CORTADO > 0 ? formatCurrency(pedido.VALOR_CORTADO) : '-'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="bg-gray-100">
                      <tr>
                        <td colSpan="3" className="px-3 py-2 text-right font-semibold">
                          Total: {pedidosModal.pedidos.length} pedidos
                        </td>
                        <td className="px-3 py-2 text-center font-bold text-blue-700 bg-blue-100">
                          {pedidosModal.pedidos.reduce((sum, p) => sum + (p.QTD_PEDIDA || 0), 0).toFixed(0)}
                        </td>
                        <td className="px-3 py-2 text-center font-bold text-green-700 bg-green-100">
                          {pedidosModal.pedidos.reduce((sum, p) => sum + (p.QTD_ENTREGUE || 0), 0).toFixed(0)}
                        </td>
                        <td className="px-3 py-2 text-center font-bold text-red-700 bg-red-100">
                          {pedidosModal.pedidos.reduce((sum, p) => sum + (p.QTD_CORTADA || 0), 0).toFixed(0)}
                        </td>
                        <td className="px-3 py-2 text-center">
                          <span className="text-xs text-gray-500">
                            {pedidosModal.pedidos.filter(p => p.STATUS === 'RUPTURA').length} com ruptura
                          </span>
                        </td>
                        <td className="px-3 py-2 text-right font-bold text-red-700">
                          {formatCurrency(pedidosModal.pedidos.reduce((sum, p) => sum + (p.VALOR_CORTADO || 0), 0))}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </>
              )}
            </div>

            {/* Footer do Modal */}
            <div className="bg-gray-50 px-4 py-3 flex justify-between items-center border-t">
              <p className="text-xs text-gray-500">
                Clique em um pedido para ver a nota fiscal relacionada
              </p>
              <button
                onClick={() => setPedidosModal({ open: false, produto: null, fornecedor: null, codFornecedor: null, pedidos: [], totais: null, loading: false })}
                className="px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Nota Fiscal */}
      {nfModal.open && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full mx-4 max-h-[85vh] overflow-hidden">
            {/* Header do Modal */}
            <div className="bg-green-600 text-white px-4 py-3 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold">
                  Nota Fiscal do Pedido
                </h3>
                {nfModal.pedido && (
                  <>
                    <p className="text-sm font-normal opacity-90">
                      Pedido #{nfModal.pedido.NUM_PEDIDO} - {nfModal.pedido.DES_PRODUTO}
                    </p>
                    <p className="text-xs font-normal opacity-75">
                      Fornecedor: {nfModal.pedido.DES_FORNECEDOR}
                    </p>
                  </>
                )}
              </div>
              <button
                onClick={() => setNfModal({ open: false, pedido: null, notasFiscais: [], loading: false })}
                className="text-white hover:text-gray-200 text-2xl font-bold"
              >
                ×
              </button>
            </div>

            {/* Conteúdo do Modal */}
            <div className="p-4 overflow-y-auto max-h-[65vh]">
              {nfModal.loading ? (
                <div className="flex items-center justify-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-500"></div>
                </div>
              ) : (
                <>
                  {/* Dados do Pedido */}
                  {nfModal.pedido && (
                    <div className="bg-gray-50 rounded-lg p-4 mb-4">
                      <h4 className="text-sm font-semibold text-gray-700 mb-3">Dados do Pedido</h4>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                        <div>
                          <p className="text-xs text-gray-500">Pedido</p>
                          <p className="font-bold">{nfModal.pedido.NUM_PEDIDO}</p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500">Data Emissão</p>
                          <p className="font-medium">{formatDate(nfModal.pedido.DTA_EMISSAO)}</p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500">Data Entrega</p>
                          <p className="font-medium">{formatDate(nfModal.pedido.DTA_ENTREGA)}</p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500">Valor Unit.</p>
                          <p className="font-medium">{formatCurrency(nfModal.pedido.VAL_TABELA)}</p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500">Qtd Pedida</p>
                          <p className="font-bold text-blue-600">{nfModal.pedido.QTD_PEDIDO?.toFixed(0) || 0}</p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500">Qtd Recebida</p>
                          <p className="font-bold text-green-600">{nfModal.pedido.QTD_RECEBIDA?.toFixed(0) || 0}</p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500">Diferença</p>
                          <p className={`font-bold ${(nfModal.pedido.QTD_RECEBIDA || 0) < (nfModal.pedido.QTD_PEDIDO || 0) ? 'text-red-600' : 'text-green-600'}`}>
                            {((nfModal.pedido.QTD_RECEBIDA || 0) - (nfModal.pedido.QTD_PEDIDO || 0)).toFixed(0)}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500">Produto</p>
                          <p className="font-mono text-xs">{nfModal.pedido.COD_PRODUTO}</p>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Notas Fiscais Relacionadas */}
                  <div>
                    <h4 className="text-sm font-semibold text-gray-700 mb-3">
                      Notas Fiscais Relacionadas
                      <span className="ml-2 text-xs font-normal text-gray-500">
                        (procura NFs do mesmo produto/fornecedor próximas à data do pedido)
                      </span>
                    </h4>

                    {nfModal.notasFiscais.length === 0 ? (
                      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 text-center">
                        <p className="text-yellow-700">Nenhuma nota fiscal encontrada para este pedido</p>
                        <p className="text-xs text-yellow-600 mt-1">
                          Verifique se a mercadoria já foi entregue e se a NF foi lançada no sistema
                        </p>
                      </div>
                    ) : (
                      <table className="w-full text-sm border border-gray-200">
                        <thead className="bg-gray-100">
                          <tr>
                            <th className="px-3 py-2 text-center font-semibold text-gray-700">NF</th>
                            <th className="px-3 py-2 text-center font-semibold text-gray-700">Série</th>
                            <th className="px-3 py-2 text-center font-semibold text-gray-700">Data Entrada</th>
                            <th className="px-3 py-2 text-center font-semibold text-gray-700">Dias após Pedido</th>
                            <th className="px-3 py-2 text-center font-semibold text-blue-600 bg-blue-50">Qtd</th>
                            <th className="px-3 py-2 text-right font-semibold text-gray-700">Valor Unit.</th>
                            <th className="px-3 py-2 text-right font-semibold text-green-600 bg-green-50">Custo Rep.</th>
                            <th className="px-3 py-2 text-right font-semibold text-gray-700">Total</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                          {nfModal.notasFiscais.map((nf, idx) => (
                            <tr key={idx} className={`hover:bg-gray-50 ${idx === 0 ? 'bg-green-50' : ''}`}>
                              <td className="px-3 py-2 text-center font-mono font-bold">{nf.NUM_NF}</td>
                              <td className="px-3 py-2 text-center">{nf.NUM_SERIE_NF}</td>
                              <td className="px-3 py-2 text-center">{formatDate(nf.DTA_ENTRADA)}</td>
                              <td className="px-3 py-2 text-center">
                                <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                                  nf.DIAS_APOS_PEDIDO <= 3 ? 'bg-green-100 text-green-700' :
                                  nf.DIAS_APOS_PEDIDO <= 7 ? 'bg-yellow-100 text-yellow-700' :
                                  'bg-gray-100 text-gray-700'
                                }`}>
                                  {nf.DIAS_APOS_PEDIDO >= 0 ? `+${nf.DIAS_APOS_PEDIDO}` : nf.DIAS_APOS_PEDIDO} dias
                                </span>
                              </td>
                              <td className="px-3 py-2 text-center font-bold text-blue-600 bg-blue-50">{nf.QTD_ENTRADA?.toFixed(0) || 0}</td>
                              <td className="px-3 py-2 text-right">{formatCurrency(nf.VAL_UNITARIO)}</td>
                              <td className="px-3 py-2 text-right font-bold text-green-600 bg-green-50">{formatCurrency(nf.CUSTO_REP)}</td>
                              <td className="px-3 py-2 text-right font-medium">{formatCurrency(nf.VAL_TOTAL)}</td>
                            </tr>
                          ))}
                        </tbody>
                        {nfModal.notasFiscais.length > 1 && (
                          <tfoot className="bg-gray-100">
                            <tr>
                              <td colSpan="4" className="px-3 py-2 text-right font-semibold">
                                Total: {nfModal.notasFiscais.length} NFs encontradas
                              </td>
                              <td className="px-3 py-2 text-center font-bold text-blue-700 bg-blue-100">
                                {nfModal.notasFiscais.reduce((sum, nf) => sum + (nf.QTD_ENTRADA || 0), 0).toFixed(0)}
                              </td>
                              <td className="px-3 py-2"></td>
                              <td className="px-3 py-2"></td>
                              <td className="px-3 py-2 text-right font-bold">
                                {formatCurrency(nfModal.notasFiscais.reduce((sum, nf) => sum + (nf.VAL_TOTAL || 0), 0))}
                              </td>
                            </tr>
                          </tfoot>
                        )}
                      </table>
                    )}
                  </div>

                  {nfModal.notasFiscais.length > 0 && (
                    <div className="mt-3 text-xs text-gray-500">
                      <p>* A primeira linha (destacada em verde) é a NF mais próxima da data do pedido.</p>
                      <p>* "Dias após Pedido" indica quantos dias depois da emissão do pedido a NF foi lançada.</p>
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Footer do Modal */}
            <div className="bg-gray-50 px-4 py-3 flex justify-end border-t">
              <button
                onClick={() => setNfModal({ open: false, pedido: null, notasFiscais: [], loading: false })}
                className="px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}
