import React, { useState, useEffect } from 'react';
import Layout from '../components/Layout';
import api from '../services/api';
import { useLoja } from '../contexts/LojaContext';

const STATUS_RECEBIMENTO = {
  0: { label: 'Pendente', color: 'bg-yellow-100 text-yellow-800', icon: '⏳' },
  1: { label: 'Parcial', color: 'bg-blue-100 text-blue-800', icon: '📦' },
  2: { label: 'Recebido', color: 'bg-green-100 text-green-800', icon: '✅' },
  3: { label: 'Cancelado', color: 'bg-red-100 text-red-800', icon: '❌' }
};

export default function PrevencaoPedidos() {
  const { lojaSelecionada } = useLoja();
  const [pedidos, setPedidos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filters, setFilters] = useState({
    tipoRecebimento: '0', // Inicia sempre em Pendente
    dataInicio: '',
    dataFim: '',
    fornecedor: '',
    numPedido: '',
    comprador: '',
    apenasAtrasados: false,
    parciaisFinalizadas: false,
    canceladasTotais: false,
    semNenhumaEntrada: false,
    nfSemPedido: false
  });
  const [nfsSemPedido, setNfsSemPedido] = useState([]);
  const [nfPagination, setNfPagination] = useState({
    page: 1,
    limit: 50,
    total: 0,
    totalPages: 0
  });
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 50,
    total: 0,
    totalPages: 0
  });
  const [stats, setStats] = useState({
    pendentes: 0,
    parciaisAberto: 0,
    recebidosIntegral: 0,
    cancelados: 0,
    atrasados: 0,
    parciaisFinalizadas: 0,
    notasCanceladas: 0,
    valorCancelado: 0,
    canceladosTotalmente: 0,
    valorCanceladoTotalmente: 0,
    nfSemPedido: 0,
    valorNfSemPedido: 0
  });

  // Estado para NFs com bloqueio
  const [nfsComBloqueio, setNfsComBloqueio] = useState([]);
  const [statsBloqueio, setStatsBloqueio] = useState({
    totalBloq1f: 0,
    totalBloq2f: 0,
    totalBloqCusto: 0,
    totalComBloqueio: 0,
    valorTotalBloqueado: 0
  });
  const [showNfsBloqueio, setShowNfsBloqueio] = useState(false);
  const [expandedNfBloqueio, setExpandedNfBloqueio] = useState(null);
  const [itensNfBloqueio, setItensNfBloqueio] = useState({});
  const [loadingItensNfBloqueio, setLoadingItensNfBloqueio] = useState({});
  const [expandedPedido, setExpandedPedido] = useState(null);
  const [itensPedido, setItensPedido] = useState({});
  const [loadingItens, setLoadingItens] = useState({});
  const [compradores, setCompradores] = useState([]);
  const [sortConfig, setSortConfig] = useState({ key: null, direction: 'asc' });
  const [nfSortConfig, setNfSortConfig] = useState({ key: null, direction: 'asc' });
  const [expandedNf, setExpandedNf] = useState(null);
  const [itensNf, setItensNf] = useState({});
  const [loadingItensNf, setLoadingItensNf] = useState({});
  const [classificacoes, setClassificacoes] = useState([]);
  const [semCadastroCount, setSemCadastroCount] = useState(0);
  const [selectedClassificacoes, setSelectedClassificacoes] = useState([]);
  const [showClassifDropdown, setShowClassifDropdown] = useState(false);
  const [draggedColumn, setDraggedColumn] = useState(null);

  // Definição das colunas da tabela de pedidos (ordem inicial)
  const [pedidoColumns, setPedidoColumns] = useState([
    { key: 'expand', label: '', sortable: false, width: 'w-8' },
    { key: 'NUM_PEDIDO', label: 'N. PEDIDO', sortable: true },
    { key: 'TIPO_RECEBIMENTO', label: 'STATUS', sortable: true },
    { key: 'QTD_NF_A_CONFIRMAR', label: 'À CONF.', sortable: true, width: 'w-24' },
    { key: 'DES_FORNECEDOR', label: 'FORNECEDOR', sortable: true },
    { key: 'NUM_CGC', label: 'CNPJ', sortable: true },
    { key: 'DES_CONTATO', label: 'CONTATO', sortable: false },
    { key: 'NUM_CELULAR', label: 'CELULAR', sortable: false },
    { key: 'NUM_FREQ_VISITA', label: 'VISITA', sortable: true },
    { key: 'PRAZO_ENTREGA', label: 'PRAZO ENT.', sortable: true },
    { key: 'PRAZO_MEDIO_REAL', label: 'PRAZO MÉD.', sortable: true },
    { key: 'COND_PAGAMENTO', label: 'COND. PGTO', sortable: true },
    { key: 'DTA_EMISSAO', label: 'EMISSAO', sortable: true },
    { key: 'DTA_ENTREGA', label: 'ENTREGA', sortable: true },
    { key: 'ATRASO', label: 'ATRASO', sortable: false },
    { key: 'DTA_PEDIDO_CANCELADO', label: 'DT CANCEL', sortable: true },
    { key: 'VAL_PEDIDO', label: 'VALOR (R$)', sortable: true },
    { key: 'USUARIO', label: 'COMPRADOR', sortable: true },
    { key: 'OBS', label: 'OBS', sortable: false }
  ]);

  // Definição das colunas da tabela de NFs (ordem inicial)
  const [nfColumns, setNfColumns] = useState([
    { key: 'expand', label: '', sortable: false, width: 'w-8' },
    { key: 'NUM_NF', label: 'NUM NF', sortable: true },
    { key: 'FORNECEDOR', label: 'FORNECEDOR', sortable: true },
    { key: 'DES_CLASSIFICACAO', label: 'CLASSIF', sortable: true },
    { key: 'NUM_CGC', label: 'CNPJ', sortable: false },
    { key: 'DES_CONTATO', label: 'CONTATO', sortable: false },
    { key: 'NUM_CELULAR', label: 'CELULAR', sortable: false },
    { key: 'DTA_EMISSAO', label: 'EMISSAO', sortable: true },
    { key: 'DTA_ENTRADA', label: 'ENTRADA', sortable: true },
    { key: 'VAL_TOTAL_NF', label: 'VALOR (R$)', sortable: true },
    { key: 'DES_NATUREZA', label: 'NATUREZA', sortable: false }
  ]);

  // Handlers para drag and drop de colunas
  const handleDragStart = (e, columnKey, tableType) => {
    setDraggedColumn({ key: columnKey, tableType });
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = (e, targetColumnKey, tableType) => {
    e.preventDefault();
    if (!draggedColumn || draggedColumn.tableType !== tableType) return;

    const columns = tableType === 'pedido' ? [...pedidoColumns] : [...nfColumns];
    const setColumns = tableType === 'pedido' ? setPedidoColumns : setNfColumns;

    const draggedIndex = columns.findIndex(c => c.key === draggedColumn.key);
    const targetIndex = columns.findIndex(c => c.key === targetColumnKey);

    if (draggedIndex === -1 || targetIndex === -1 || draggedIndex === targetIndex) return;

    // Reordenar
    const [removed] = columns.splice(draggedIndex, 1);
    columns.splice(targetIndex, 0, removed);
    setColumns(columns);
    setDraggedColumn(null);
  };

  // Calcular dias de atraso
  const calcularDiasAtraso = (dataEntrega) => {
    if (!dataEntrega) return 0;
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    const entrega = new Date(dataEntrega);
    entrega.setHours(0, 0, 0, 0);
    const diffTime = hoje - entrega;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays > 0 ? diffDays : 0;
  };

  // Carregar pedidos (aceita filtros opcionais para quando chamado de onClick)
  const loadPedidos = async (page = 1, customFilters = null) => {
    setLoading(true);
    setError(null);
    try {
      const activeFilters = customFilters || filters;
      const params = new URLSearchParams();
      params.append('page', page);
      params.append('limit', pagination.limit);

      if (activeFilters.tipoRecebimento !== '') params.append('tipoRecebimento', activeFilters.tipoRecebimento);
      if (activeFilters.dataInicio) params.append('dataInicio', activeFilters.dataInicio);
      if (activeFilters.dataFim) params.append('dataFim', activeFilters.dataFim);
      if (activeFilters.fornecedor) params.append('fornecedor', activeFilters.fornecedor);
      if (activeFilters.numPedido) params.append('numPedido', activeFilters.numPedido);
      if (activeFilters.comprador) params.append('comprador', activeFilters.comprador);
      if (activeFilters.apenasAtrasados) params.append('apenasAtrasados', 'true');
      if (activeFilters.parciaisFinalizadas) params.append('parciaisFinalizadas', 'true');
      if (activeFilters.canceladasTotais) params.append('canceladasTotais', 'true');
      if (activeFilters.semNenhumaEntrada) params.append('semNenhumaEntrada', 'true');
      if (lojaSelecionada) params.append('codLoja', lojaSelecionada);

      const response = await api.get(`/pedidos-compra?${params.toString()}`);

      setPedidos(response.data.pedidos || []);
      setPagination(prev => ({
        ...prev,
        page: response.data.page || 1,
        total: response.data.total || 0,
        totalPages: response.data.totalPages || 0
      }));
      setStats(response.data.stats || {
        pendentes: 0,
        parciaisAberto: 0,
        recebidosIntegral: 0,
        cancelados: 0,
        atrasados: 0,
        parciaisFinalizadas: 0,
        notasCanceladas: 0,
        valorCancelado: 0
      });
    } catch (err) {
      console.error('Erro ao carregar pedidos:', err);
      setError('Erro ao carregar pedidos. Verifique a conexão com o Oracle.');
    } finally {
      setLoading(false);
    }
  };

  // Carregar itens do pedido
  // filtroItens: 'apenasRecebidos' para Parciais Finalizadas, 'apenasRuptura' para Canceladas Totais, 'semNenhumaEntrada' para Cancelados Integral
  const loadItensPedido = async (numPedido, filtroItens = null) => {
    // Usar chave única incluindo o filtro para permitir recarregar com filtros diferentes
    const cacheKey = filtroItens ? `${numPedido}_${filtroItens}` : numPedido;
    if (itensPedido[cacheKey]) return;

    setLoadingItens(prev => ({ ...prev, [numPedido]: true }));
    try {
      const url = filtroItens
        ? `/pedidos-compra/${numPedido}/itens?filtroItens=${filtroItens}`
        : `/pedidos-compra/${numPedido}/itens`;
      const response = await api.get(url);
      setItensPedido(prev => ({ ...prev, [cacheKey]: response.data.itens || [] }));
    } catch (err) {
      console.error('Erro ao carregar itens:', err);
      setItensPedido(prev => ({ ...prev, [cacheKey]: [] }));
    } finally {
      setLoadingItens(prev => ({ ...prev, [numPedido]: false }));
    }
  };

  // Carregar compradores disponíveis
  const loadCompradores = async () => {
    try {
      const params = new URLSearchParams();
      if (lojaSelecionada) params.append('codLoja', lojaSelecionada);
      const response = await api.get(`/pedidos-compra/compradores?${params.toString()}`);
      setCompradores(response.data.compradores || []);
    } catch (err) {
      console.error('Erro ao carregar compradores:', err);
    }
  };

  // Carregar classificações de fornecedores (com contagem de NFs)
  const loadClassificacoes = async () => {
    try {
      const params = new URLSearchParams();
      if (lojaSelecionada) params.append('codLoja', lojaSelecionada);
      const response = await api.get(`/pedidos-compra/classificacoes?${params.toString()}`);
      setClassificacoes(response.data.classificacoes || []);
      setSemCadastroCount(response.data.semCadastroCount || 0);
    } catch (err) {
      console.error('Erro ao carregar classificações:', err);
    }
  };

  // Carregar NFs sem pedido
  const loadNfsSemPedido = async (page = 1, classifFilter = null) => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      params.append('page', page);
      params.append('limit', nfPagination.limit);

      if (filters.dataInicio) params.append('dataInicio', filters.dataInicio);
      if (filters.dataFim) params.append('dataFim', filters.dataFim);
      if (filters.fornecedor) params.append('fornecedor', filters.fornecedor);

      // Filtro de classificações
      const classifs = classifFilter !== null ? classifFilter : selectedClassificacoes;
      if (classifs.length > 0) {
        params.append('classificacoes', classifs.join(','));
      }
      if (lojaSelecionada) params.append('codLoja', lojaSelecionada);

      const response = await api.get(`/pedidos-compra/nf-sem-pedido?${params.toString()}`);

      setNfsSemPedido(response.data.nfs || []);
      setNfPagination(prev => ({
        ...prev,
        page: response.data.page || 1,
        total: response.data.total || 0,
        totalPages: response.data.totalPages || 0
      }));
    } catch (err) {
      console.error('Erro ao carregar NFs sem pedido:', err);
      setError('Erro ao carregar NFs sem pedido.');
    } finally {
      setLoading(false);
    }
  };

  // Carregar itens de uma NF
  const loadItensNf = async (numNf, codFornecedor, codLoja) => {
    const cacheKey = `${numNf}_${codFornecedor}_${codLoja}`;
    if (itensNf[cacheKey]) return;

    setLoadingItensNf(prev => ({ ...prev, [cacheKey]: true }));
    try {
      const response = await api.get(`/pedidos-compra/nf/${numNf}/${codFornecedor}/${codLoja}/itens`);
      setItensNf(prev => ({ ...prev, [cacheKey]: response.data.itens || [] }));
    } catch (err) {
      console.error('Erro ao carregar itens da NF:', err);
      setItensNf(prev => ({ ...prev, [cacheKey]: [] }));
    } finally {
      setLoadingItensNf(prev => ({ ...prev, [cacheKey]: false }));
    }
  };

  // Formatar celular para WhatsApp
  const formatWhatsApp = (celular) => {
    if (!celular) return null;
    // Remove tudo que não for número
    const numero = String(celular).replace(/\D/g, '');
    if (numero.length < 10) return null;
    // Adiciona 55 se não tiver
    const numeroCompleto = numero.startsWith('55') ? numero : '55' + numero;
    return `https://wa.me/${numeroCompleto}`;
  };

  // Formatar celular para exibição
  const formatCelular = (celular) => {
    if (!celular) return '-';
    const numero = String(celular).replace(/\D/g, '');
    if (numero.length === 11) {
      return `(${numero.substring(0, 2)}) ${numero.substring(2, 7)}-${numero.substring(7)}`;
    } else if (numero.length === 10) {
      return `(${numero.substring(0, 2)}) ${numero.substring(2, 6)}-${numero.substring(6)}`;
    }
    return celular;
  };

  // Toggle NF expandida
  const toggleNf = (nf) => {
    const nfKey = `${nf.NUM_NF}_${nf.COD_FORNECEDOR}_${nf.COD_LOJA}`;
    if (expandedNf === nfKey) {
      setExpandedNf(null);
    } else {
      setExpandedNf(nfKey);
      loadItensNf(nf.NUM_NF, nf.COD_FORNECEDOR, nf.COD_LOJA);
    }
  };

  // Ordenar NFs
  const handleNfSort = (key) => {
    let direction = 'asc';
    if (nfSortConfig.key === key && nfSortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setNfSortConfig({ key, direction });
  };

  const sortedNfs = [...nfsSemPedido].sort((a, b) => {
    if (!nfSortConfig.key) return 0;
    let aVal = a[nfSortConfig.key];
    let bVal = b[nfSortConfig.key];
    if (aVal === null || aVal === undefined) aVal = '';
    if (bVal === null || bVal === undefined) bVal = '';
    if (typeof aVal === 'string') {
      aVal = aVal.toLowerCase();
      bVal = String(bVal).toLowerCase();
    }
    if (aVal < bVal) return nfSortConfig.direction === 'asc' ? -1 : 1;
    if (aVal > bVal) return nfSortConfig.direction === 'asc' ? 1 : -1;
    return 0;
  });

  const NfSortIcon = ({ columnKey }) => (
    <span className="ml-1 inline-block">
      {nfSortConfig.key === columnKey ? (
        nfSortConfig.direction === 'asc' ? '▲' : '▼'
      ) : (
        <span className="text-gray-300">⇅</span>
      )}
    </span>
  );

  useEffect(() => {
    loadPedidos();
    loadCompradores();
    loadClassificacoes();
    loadNfsBloqueio();
  }, [lojaSelecionada]);

  // Carregar NFs com bloqueio
  const loadNfsBloqueio = async () => {
    try {
      const params = new URLSearchParams();
      if (lojaSelecionada) params.append('codLoja', lojaSelecionada);
      const response = await api.get(`/pedidos-compra/nf-com-bloqueio?${params.toString()}`);
      setNfsComBloqueio(response.data.nfs || []);
      setStatsBloqueio(response.data.stats || {
        totalBloq1f: 0,
        totalBloq2f: 0,
        totalBloqCusto: 0,
        totalComBloqueio: 0,
        valorTotalBloqueado: 0
      });
    } catch (err) {
      console.error('Erro ao carregar NFs com bloqueio:', err);
    }
  };

  // Carregar itens de uma NF com bloqueio (para expandir)
  const loadItensNfBloqueio = async (nf) => {
    const nfKey = `${nf.numeroNf}_${nf.codFornecedor}_${nf.loja}`;

    // Se já tem os itens carregados, só expande/colapsa
    if (itensNfBloqueio[nfKey]) {
      setExpandedNfBloqueio(expandedNfBloqueio === nfKey ? null : nfKey);
      return;
    }

    // Se está expandida, colapsa
    if (expandedNfBloqueio === nfKey) {
      setExpandedNfBloqueio(null);
      return;
    }

    // Carrega os itens
    setLoadingItensNfBloqueio(prev => ({ ...prev, [nfKey]: true }));
    try {
      const response = await api.get(`/pedidos-compra/nf-com-bloqueio/${nf.numeroNf}/${nf.codFornecedor}/${nf.loja}/itens`);
      setItensNfBloqueio(prev => ({ ...prev, [nfKey]: response.data.itens || [] }));
      setExpandedNfBloqueio(nfKey);
    } catch (err) {
      console.error('Erro ao carregar itens da NF:', err);
    } finally {
      setLoadingItensNfBloqueio(prev => ({ ...prev, [nfKey]: false }));
    }
  };

  const handleFilter = () => {
    loadPedidos(1);
  };

  const handleClearFilters = () => {
    setFilters({
      tipoRecebimento: '',
      dataInicio: '',
      dataFim: '',
      fornecedor: '',
      numPedido: '',
      comprador: '',
      apenasAtrasados: false,
      parciaisFinalizadas: false,
      canceladasTotais: false,
      semNenhumaEntrada: false,
      nfSemPedido: false
    });
    setTimeout(() => loadPedidos(1), 100);
  };

  const handlePageChange = (newPage) => {
    loadPedidos(newPage);
  };

  const togglePedido = (numPedido) => {
    if (expandedPedido === numPedido) {
      setExpandedPedido(null);
    } else {
      setExpandedPedido(numPedido);
      // Determinar qual filtro de itens usar baseado no filtro ativo
      let filtroItens = null;
      if (filters.parciaisFinalizadas) {
        filtroItens = 'apenasRecebidos'; // Mostrar apenas itens que foram recebidos
      } else if (filters.canceladasTotais) {
        filtroItens = 'apenasRuptura'; // Mostrar apenas itens com ruptura/não recebidos
      } else if (filters.semNenhumaEntrada) {
        filtroItens = 'semNenhumaEntrada'; // Mostrar todos os itens (nenhum foi recebido)
      }
      loadItensPedido(numPedido, filtroItens);
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

  // Ordenar pedidos
  const handleSort = (key) => {
    let direction = 'asc';
    // Colunas que devem começar do maior para menor
    const descFirstColumns = ['QTD_NF_A_CONFIRMAR', 'VAL_PEDIDO', 'DIAS_ATRASO'];
    if (descFirstColumns.includes(key)) {
      direction = 'desc';
      if (sortConfig.key === key && sortConfig.direction === 'desc') {
        direction = 'asc';
      }
    } else {
      if (sortConfig.key === key && sortConfig.direction === 'asc') {
        direction = 'desc';
      }
    }
    setSortConfig({ key, direction });
  };

  const sortedPedidos = [...pedidos].sort((a, b) => {
    if (!sortConfig.key) return 0;

    let aVal = a[sortConfig.key];
    let bVal = b[sortConfig.key];

    // Tratar valores nulos
    if (aVal === null || aVal === undefined) aVal = '';
    if (bVal === null || bVal === undefined) bVal = '';

    // Comparar strings
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

  return (
    <Layout title="Prevenção Pedidos">
      <div className="p-4 lg:p-6">
        {/* Header com Gradiente Laranja */}
        <div className="bg-gradient-to-br from-orange-500 to-red-600 rounded-lg shadow-lg p-6 mb-6 text-white">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl lg:text-3xl font-bold flex items-center gap-3">
                📋 Gestão de Pedidos de Compra
              </h1>
              <p className="text-white/90 mt-1">
                Acompanhe pedidos pendentes, parciais, recebidos e atrasados
              </p>
            </div>
          </div>
        </div>

        {/* Header com estatísticas */}
        <div className="grid grid-cols-2 lg:grid-cols-9 gap-3 mb-4">
          {/* Card NFs com Bloqueio - ANTES de Pendentes */}
          <div
            className={`bg-white rounded-lg shadow p-3 cursor-pointer border-2 transition-all ${
              showNfsBloqueio ? 'border-red-500 ring-2 ring-red-200' : 'border-transparent hover:border-red-300'
            }`}
            onClick={() => {
              setShowNfsBloqueio(!showNfsBloqueio);
              if (!showNfsBloqueio) {
                // Quando ativar o filtro de bloqueio, desativar outros
                setFilters({ ...filters, tipoRecebimento: '', apenasAtrasados: false, parciaisFinalizadas: false, canceladasTotais: false, semNenhumaEntrada: false, nfSemPedido: false });
              }
            }}
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-500">NFs com Bloqueio</p>
                <p className="text-xl font-bold text-red-600">{statsBloqueio.totalComBloqueio}</p>
              </div>
              <span className="text-2xl">🔒</span>
            </div>
          </div>

          <div
            className={`bg-white rounded-lg shadow p-3 cursor-pointer border-2 transition-all ${
              filters.tipoRecebimento === '0' && !filters.apenasAtrasados && !filters.parciaisFinalizadas && !filters.canceladasTotais && !showNfsBloqueio ? 'border-yellow-500 ring-2 ring-yellow-200' : 'border-transparent hover:border-yellow-300'
            }`}
            onClick={() => {
              setShowNfsBloqueio(false);
              const newFilters = { ...filters, tipoRecebimento: filters.tipoRecebimento === '0' ? '' : '0', apenasAtrasados: false, parciaisFinalizadas: false, canceladasTotais: false, semNenhumaEntrada: false, nfSemPedido: false };
              setFilters(newFilters);
              loadPedidos(1, newFilters);
            }}
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-500">Pendentes</p>
                <p className="text-xl font-bold text-yellow-600">{stats.pendentes}</p>
              </div>
              <span className="text-2xl">⏳</span>
            </div>
          </div>

          <div
            className={`bg-white rounded-lg shadow p-3 cursor-pointer border-2 transition-all ${
              filters.tipoRecebimento === '1' && !filters.apenasAtrasados && !filters.parciaisFinalizadas && !filters.canceladasTotais ? 'border-blue-500 ring-2 ring-blue-200' : 'border-transparent hover:border-blue-300'
            }`}
            onClick={() => {
              setShowNfsBloqueio(false);
              const newFilters = { ...filters, tipoRecebimento: filters.tipoRecebimento === '1' ? '' : '1', apenasAtrasados: false, parciaisFinalizadas: false, canceladasTotais: false, semNenhumaEntrada: false, nfSemPedido: false };
              setFilters(newFilters);
              loadPedidos(1, newFilters);
            }}
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-500">Parciais em Aberto</p>
                <p className="text-xl font-bold text-blue-600">{stats.parciaisAberto}</p>
              </div>
              <span className="text-2xl">📦</span>
            </div>
          </div>

          {/* Card Atrasados - após Parciais em Aberto */}
          <div
            className={`bg-white rounded-lg shadow p-3 cursor-pointer border-2 transition-all ${
              filters.apenasAtrasados ? 'border-orange-500 ring-2 ring-orange-200' : 'border-transparent hover:border-orange-300'
            }`}
            onClick={() => {
              setShowNfsBloqueio(false);
              const newFilters = { ...filters, apenasAtrasados: !filters.apenasAtrasados, tipoRecebimento: '', parciaisFinalizadas: false, canceladasTotais: false, semNenhumaEntrada: false, nfSemPedido: false };
              setFilters(newFilters);
              loadPedidos(1, newFilters);
            }}
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-500">Atrasados</p>
                <p className="text-xl font-bold text-orange-600">{stats.atrasados}</p>
              </div>
              <span className="text-2xl">🚨</span>
            </div>
          </div>

          <div
            className={`bg-white rounded-lg shadow p-3 cursor-pointer border-2 transition-all ${
              filters.tipoRecebimento === '2' && !filters.apenasAtrasados && !filters.parciaisFinalizadas && !filters.canceladasTotais ? 'border-green-500 ring-2 ring-green-200' : 'border-transparent hover:border-green-300'
            }`}
            onClick={() => {
              setShowNfsBloqueio(false);
              const newFilters = { ...filters, tipoRecebimento: filters.tipoRecebimento === '2' ? '' : '2', apenasAtrasados: false, parciaisFinalizadas: false, canceladasTotais: false, semNenhumaEntrada: false, nfSemPedido: false };
              setFilters(newFilters);
              loadPedidos(1, newFilters);
            }}
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-500">Recebidas Integralmente</p>
                <p className="text-xl font-bold text-green-600">{stats.recebidosIntegral}</p>
              </div>
              <span className="text-2xl">✅</span>
            </div>
          </div>

          <div
            className={`bg-white rounded-lg shadow p-3 cursor-pointer border-2 transition-all ${
              filters.parciaisFinalizadas ? 'border-purple-500 ring-2 ring-purple-200' : 'border-transparent hover:border-purple-300'
            }`}
            onClick={() => {
              setShowNfsBloqueio(false);
              const newFilters = { ...filters, parciaisFinalizadas: !filters.parciaisFinalizadas, canceladasTotais: false, apenasAtrasados: false, semNenhumaEntrada: false, tipoRecebimento: '', nfSemPedido: false };
              setFilters(newFilters);
              loadPedidos(1, newFilters);
            }}
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-500">Parciais Finalizadas</p>
                <p className="text-xl font-bold text-purple-600">{stats.parciaisFinalizadas}</p>
              </div>
              <span className="text-2xl">📋</span>
            </div>
          </div>

          <div
            className={`bg-white rounded-lg shadow p-3 cursor-pointer border-2 transition-all ${
              filters.canceladasTotais ? 'border-pink-500 ring-2 ring-pink-200' : 'border-transparent hover:border-pink-300'
            }`}
            onClick={() => {
              setShowNfsBloqueio(false);
              const newFilters = { ...filters, canceladasTotais: !filters.canceladasTotais, parciaisFinalizadas: false, apenasAtrasados: false, semNenhumaEntrada: false, tipoRecebimento: '', nfSemPedido: false };
              setFilters(newFilters);
              loadPedidos(1, newFilters);
            }}
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-500">Itens Cortados</p>
                <p className="text-xl font-bold text-pink-600">{stats.notasCanceladas}</p>
                <p className="text-xs font-semibold text-pink-500">R$ {(stats.valorCancelado || 0).toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</p>
              </div>
              <span className="text-2xl">🚫</span>
            </div>
          </div>

          <div
            className={`bg-white rounded-lg shadow p-3 cursor-pointer border-2 transition-all ${
              filters.semNenhumaEntrada ? 'border-gray-500 ring-2 ring-gray-200' : 'border-transparent hover:border-gray-300'
            }`}
            onClick={() => {
              setShowNfsBloqueio(false);
              const newFilters = { ...filters, semNenhumaEntrada: !filters.semNenhumaEntrada, parciaisFinalizadas: false, canceladasTotais: false, apenasAtrasados: false, tipoRecebimento: '', nfSemPedido: false };
              setFilters(newFilters);
              loadPedidos(1, newFilters);
            }}
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-500">Cancelados INTEGRAL</p>
                <p className="text-xl font-bold text-gray-700">{stats.canceladosTotalmente || 0}</p>
                <p className="text-xs font-semibold text-gray-600">R$ {(stats.valorCanceladoTotalmente || 0).toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</p>
              </div>
              <span className="text-2xl">⛔</span>
            </div>
          </div>

          <div
            className={`bg-white rounded-lg shadow p-3 cursor-pointer border-2 transition-all ${
              filters.nfSemPedido ? 'border-amber-500 ring-2 ring-amber-200' : 'border-transparent hover:border-amber-300'
            }`}
            onClick={() => {
              setShowNfsBloqueio(false);
              const newFilters = { ...filters, nfSemPedido: !filters.nfSemPedido, apenasAtrasados: false, tipoRecebimento: '', parciaisFinalizadas: false, canceladasTotais: false, semNenhumaEntrada: false };
              setFilters(newFilters);
              if (!filters.nfSemPedido) {
                // Classificações pré-selecionadas por padrão
                const defaultClassifs = ['SEM_CADASTRO', 12, 21, 40];
                setSelectedClassificacoes(defaultClassifs);
                loadNfsSemPedido(1, defaultClassifs);
              } else {
                setSelectedClassificacoes([]);
                loadPedidos(1, { ...newFilters, nfSemPedido: false });
              }
            }}
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-500">NF sem Pedido</p>
                <p className="text-xl font-bold text-amber-600">{stats.nfSemPedido || 0}</p>
                <p className="text-xs font-semibold text-amber-500">R$ {(stats.valorNfSemPedido || 0).toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</p>
              </div>
              <span className="text-2xl">📄</span>
            </div>
          </div>
        </div>

        {/* Filtros */}
        <div className="bg-white rounded-lg shadow p-3 mb-4">
          <h3 className="text-sm font-semibold mb-2">Filtros {filters.nfSemPedido && <span className="text-amber-600">(NF sem Pedido)</span>}</h3>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-7 gap-2">
            {!filters.nfSemPedido && (
              <>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Status</label>
                  <select
                    value={filters.tipoRecebimento}
                    onChange={(e) => setFilters(prev => ({ ...prev, tipoRecebimento: e.target.value }))}
                    className="w-full border rounded px-2 py-1 text-sm focus:ring-1 focus:ring-orange-500 focus:border-orange-500"
                  >
                    <option value="">Todos</option>
                    <option value="0">Pendente</option>
                    <option value="1">Parcial</option>
                    <option value="2">Recebido</option>
                    <option value="3">Cancelado</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">N. Pedido</label>
                  <input
                    type="text"
                    value={filters.numPedido}
                    onChange={(e) => setFilters(prev => ({ ...prev, numPedido: e.target.value }))}
                    className="w-full border rounded px-2 py-1 text-sm focus:ring-1 focus:ring-orange-500 focus:border-orange-500"
                    placeholder="Ex: 4600"
                  />
                </div>
              </>
            )}

            {filters.nfSemPedido && (
              <div className="relative col-span-2">
                <label className="block text-xs font-medium text-gray-700 mb-1">Classificação</label>
                <div
                  className="w-full border rounded px-2 py-1 text-sm cursor-pointer bg-white min-h-[30px] flex items-center flex-wrap gap-1"
                  onClick={() => setShowClassifDropdown(!showClassifDropdown)}
                >
                  {selectedClassificacoes.length === 0 ? (
                    <span className="text-gray-400">Todas as classificações</span>
                  ) : (
                    selectedClassificacoes.map(cod => {
                      const isSemCadastro = cod === 'SEM_CADASTRO';
                      const classif = !isSemCadastro ? classificacoes.find(c => c.cod === cod) : null;
                      return (
                        <span key={cod} className={`inline-flex items-center text-xs px-1.5 py-0.5 rounded ${isSemCadastro ? 'bg-red-100 text-red-800' : 'bg-amber-100 text-amber-800'}`}>
                          {isSemCadastro ? '⚠️ SEM CADASTRO' : (classif?.descricao || cod)}
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedClassificacoes(prev => prev.filter(c => c !== cod));
                            }}
                            className={`ml-1 ${isSemCadastro ? 'hover:text-red-900' : 'hover:text-amber-900'}`}
                          >×</button>
                        </span>
                      );
                    })
                  )}
                </div>
                {showClassifDropdown && (
                  <div className="absolute z-10 w-full mt-1 bg-white border rounded shadow-lg max-h-60 overflow-y-auto">
                    {/* Opção especial: Sem Cadastro */}
                    <label
                      className="flex items-center px-2 py-1.5 hover:bg-red-50 cursor-pointer text-xs border-b border-gray-200 bg-gray-50"
                    >
                      <input
                        type="checkbox"
                        checked={selectedClassificacoes.includes('SEM_CADASTRO')}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedClassificacoes(prev => [...prev, 'SEM_CADASTRO']);
                          } else {
                            setSelectedClassificacoes(prev => prev.filter(c => c !== 'SEM_CADASTRO'));
                          }
                        }}
                        className="mr-2 rounded text-red-500 focus:ring-red-500"
                      />
                      <span className="text-red-600 font-medium flex-1">⚠️ SEM CADASTRO (sem classificação)</span>
                      {semCadastroCount > 0 && (
                        <span className="ml-2 px-1.5 py-0.5 bg-red-500 text-white text-xs rounded-full font-bold min-w-[20px] text-center">
                          {semCadastroCount}
                        </span>
                      )}
                    </label>
                    {classificacoes.map(classif => (
                      <label
                        key={classif.cod}
                        className="flex items-center px-2 py-1.5 hover:bg-amber-50 cursor-pointer text-xs"
                      >
                        <input
                          type="checkbox"
                          checked={selectedClassificacoes.includes(classif.cod)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedClassificacoes(prev => [...prev, classif.cod]);
                            } else {
                              setSelectedClassificacoes(prev => prev.filter(c => c !== classif.cod));
                            }
                          }}
                          className="mr-2 rounded text-amber-500 focus:ring-amber-500"
                        />
                        <span className="flex-1">{classif.cod} - {classif.descricao}</span>
                        {classif.qtdNfs > 0 && (
                          <span className="ml-2 px-1.5 py-0.5 bg-amber-500 text-white text-xs rounded-full font-bold min-w-[20px] text-center">
                            {classif.qtdNfs}
                          </span>
                        )}
                      </label>
                    ))}
                  </div>
                )}
              </div>
            )}

            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Data Início</label>
              <input
                type="date"
                value={filters.dataInicio}
                onChange={(e) => setFilters(prev => ({ ...prev, dataInicio: e.target.value }))}
                className="w-full border rounded px-2 py-1 text-sm focus:ring-1 focus:ring-orange-500 focus:border-orange-500"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Data Fim</label>
              <input
                type="date"
                value={filters.dataFim}
                onChange={(e) => setFilters(prev => ({ ...prev, dataFim: e.target.value }))}
                className="w-full border rounded px-2 py-1 text-sm focus:ring-1 focus:ring-orange-500 focus:border-orange-500"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Fornecedor</label>
              <input
                type="text"
                value={filters.fornecedor}
                onChange={(e) => setFilters(prev => ({ ...prev, fornecedor: e.target.value }))}
                className="w-full border rounded px-2 py-1 text-sm focus:ring-1 focus:ring-orange-500 focus:border-orange-500"
                placeholder="Nome"
              />
            </div>

            {!filters.nfSemPedido && (
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Comprador</label>
                <select
                  value={filters.comprador}
                  onChange={(e) => setFilters(prev => ({ ...prev, comprador: e.target.value }))}
                  className="w-full border rounded px-2 py-1 text-sm focus:ring-1 focus:ring-orange-500 focus:border-orange-500"
                >
                  <option value="">Todos</option>
                  {compradores.map((comp) => (
                    <option key={comp} value={comp}>{comp}</option>
                  ))}
                </select>
              </div>
            )}

            <div className="flex items-end gap-1">
              <button
                onClick={() => {
                  if (filters.nfSemPedido) {
                    loadNfsSemPedido(1, selectedClassificacoes);
                  } else {
                    handleFilter();
                  }
                }}
                className="px-3 py-1 bg-orange-500 text-white rounded text-sm hover:bg-orange-600 transition-colors"
              >
                Filtrar
              </button>
              <button
                onClick={() => {
                  handleClearFilters();
                  setSelectedClassificacoes([]);
                  setShowClassifDropdown(false);
                }}
                className="px-3 py-1 bg-gray-200 text-gray-700 rounded text-sm hover:bg-gray-300 transition-colors"
              >
                Limpar
              </button>
            </div>
          </div>
        </div>

        {/* Tabela de Pedidos ou NFs sem Pedido */}
        <div className="bg-white rounded-lg shadow overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-orange-500"></div>
            </div>
          ) : error ? (
            <div className="text-center py-12 text-red-500">
              <p>{error}</p>
              <button
                onClick={() => filters.nfSemPedido ? loadNfsSemPedido() : loadPedidos()}
                className="mt-4 px-4 py-2 bg-orange-500 text-white rounded hover:bg-orange-600"
              >
                Tentar novamente
              </button>
            </div>
          ) : showNfsBloqueio ? (
            // Tabela de NFs com Bloqueio
            nfsComBloqueio.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                Nenhuma NF com bloqueio encontrada
              </div>
            ) : (
              <div className="overflow-x-auto">
                {/* Resumo de bloqueios */}
                <div className="bg-red-50 p-3 border-b border-red-200">
                  <div className="flex flex-wrap gap-4 text-sm">
                    <span className="text-red-700">
                      <strong>Bloqueio 1ª Fase:</strong> {statsBloqueio.totalBloq1f}
                    </span>
                    <span className="text-red-700">
                      <strong>Bloqueio 2ª Fase:</strong> {statsBloqueio.totalBloq2f}
                    </span>
                    <span className="text-red-700">
                      <strong>Bloqueio Custo:</strong> {statsBloqueio.totalBloqCusto}
                    </span>
                    <span className="text-red-800 font-bold">
                      <strong>Valor Total Bloqueado:</strong> {formatCurrency(statsBloqueio.valorTotalBloqueado)}
                    </span>
                  </div>
                </div>
                <table className="w-full text-sm">
                  <thead className="bg-red-50 border-b border-red-200">
                    <tr>
                      <th className="px-2 py-2 text-xs font-semibold text-red-800 text-left">LOJA</th>
                      <th className="px-2 py-2 text-xs font-semibold text-red-800 text-left">FORNECEDOR</th>
                      <th className="px-2 py-2 text-xs font-semibold text-red-800 text-left">CNPJ</th>
                      <th className="px-2 py-2 text-xs font-semibold text-red-800 text-center">NF</th>
                      <th className="px-2 py-2 text-xs font-semibold text-red-800 text-center">EMISSÃO</th>
                      <th className="px-2 py-2 text-xs font-semibold text-red-800 text-right">VALOR</th>
                      <th className="px-2 py-2 text-xs font-semibold text-red-800 text-center">BLOQ 1F</th>
                      <th className="px-2 py-2 text-xs font-semibold text-red-800 text-center">BLOQ 2F</th>
                      <th className="px-2 py-2 text-xs font-semibold text-red-800 text-center">BLOQ CUSTO</th>
                      <th className="px-2 py-2 text-xs font-semibold text-red-800 text-left">AUTORIZADOR</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {nfsComBloqueio.map((nf, idx) => {
                      const nfKey = `${nf.numeroNf}_${nf.codFornecedor}_${nf.loja}`;
                      const isExpanded = expandedNfBloqueio === nfKey;
                      const itens = itensNfBloqueio[nfKey] || [];
                      const isLoadingItens = loadingItensNfBloqueio[nfKey];

                      return (
                        <React.Fragment key={idx}>
                          <tr className={`hover:bg-red-50 ${isExpanded ? 'bg-red-100' : ''}`}>
                            <td className="px-2 py-1.5 text-xs">{nf.loja}</td>
                            <td className="px-2 py-1.5 max-w-[200px]">
                              <button
                                onClick={() => loadItensNfBloqueio(nf)}
                                className="flex items-center gap-1 hover:text-red-600 text-left"
                                title="Clique para ver itens da NF"
                              >
                                <span className={`text-lg font-bold transition-transform ${isExpanded ? 'text-red-600' : 'text-gray-500'}`}>
                                  {isLoadingItens ? '⏳' : isExpanded ? '−' : '+'}
                                </span>
                                <span className="truncate">{nf.fornecedor || '-'}</span>
                              </button>
                            </td>
                            <td className="px-2 py-1.5 text-xs text-gray-500 font-mono">{formatCNPJ(nf.cnpj)}</td>
                            <td className="px-2 py-1.5 text-center font-semibold">{nf.numeroNf}</td>
                            <td className="px-2 py-1.5 text-center text-xs">{nf.dataEntrada || '-'}</td>
                            <td className="px-2 py-1.5 text-right font-semibold text-green-600">{formatCurrency(nf.valorTotal)}</td>
                            <td className="px-2 py-1.5 text-center">
                              {nf.bloqueio1f ? (
                                <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-bold bg-red-500 text-white">🔒</span>
                              ) : (
                                <span className="text-gray-400">-</span>
                              )}
                            </td>
                            <td className="px-2 py-1.5 text-center">
                              {nf.bloqueio2f ? (
                                <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-bold bg-orange-500 text-white">🔒</span>
                              ) : (
                                <span className="text-gray-400">-</span>
                              )}
                            </td>
                            <td className="px-2 py-1.5 text-center">
                              {nf.bloqueioCusto ? (
                                <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-bold bg-purple-500 text-white">🔒</span>
                              ) : (
                                <span className="text-gray-400">-</span>
                              )}
                            </td>
                            <td className="px-2 py-1.5 text-xs max-w-[100px] truncate" title={nf.autorizador1f || nf.autorizador2f || nf.liberadorCusto}>
                              {nf.autorizador1f || nf.autorizador2f || nf.liberadorCusto || '-'}
                            </td>
                          </tr>
                          {/* Linha expandida com itens da NF */}
                          {isExpanded && (
                            <tr>
                              <td colSpan="10" className="bg-red-50 p-0">
                                <div className="p-3 border-l-4 border-red-400">
                                  <h4 className="text-sm font-bold text-red-800 mb-2">
                                    Itens da NF {nf.numeroNf} - {nf.fornecedor}
                                  </h4>
                                  {itens.length === 0 ? (
                                    <p className="text-gray-500 text-xs">Nenhum item encontrado</p>
                                  ) : (
                                    <div className="overflow-x-auto">
                                      <table className="w-full text-xs border">
                                        <thead className="bg-red-100">
                                          <tr>
                                            <th className="px-2 py-1 text-left border-b">Item</th>
                                            <th className="px-2 py-1 text-left border-b">Código</th>
                                            <th className="px-2 py-1 text-left border-b">Descrição</th>
                                            <th className="px-2 py-1 text-center border-b">Curva</th>
                                            <th className="px-2 py-1 text-center border-b">Qtd Entrada</th>
                                            <th className="px-2 py-1 text-center border-b">Unidade</th>
                                            <th className="px-2 py-1 text-right border-b">Custo Unit.</th>
                                            <th className="px-2 py-1 text-right border-b">Total</th>
                                          </tr>
                                        </thead>
                                        <tbody>
                                          {itens.map((item, itemIdx) => (
                                            <tr key={itemIdx} className="hover:bg-red-100 border-b">
                                              <td className="px-2 py-1">{item.item}</td>
                                              <td className="px-2 py-1 font-mono">{item.codProduto}</td>
                                              <td className="px-2 py-1 max-w-[250px] truncate" title={item.descricao}>{item.descricao}</td>
                                              <td className="px-2 py-1 text-center font-bold">{item.curva}</td>
                                              <td className="px-2 py-1 text-center">{item.qtdEntrada}</td>
                                              <td className="px-2 py-1 text-center">{item.unidade}</td>
                                              <td className="px-2 py-1 text-right">{formatCurrency(item.valCusto)}</td>
                                              <td className="px-2 py-1 text-right font-semibold">{formatCurrency(item.valTotal)}</td>
                                            </tr>
                                          ))}
                                        </tbody>
                                      </table>
                                    </div>
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
              </div>
            )
          ) : filters.nfSemPedido ? (
            // Tabela de NFs sem Pedido
            nfsSemPedido.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                Nenhuma NF sem pedido encontrada
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-amber-50 border-b border-amber-200">
                    <tr>
                      {nfColumns.map((col) => (
                        <th
                          key={col.key}
                          draggable={col.key !== 'expand'}
                          onDragStart={(e) => handleDragStart(e, col.key, 'nf')}
                          onDragOver={handleDragOver}
                          onDrop={(e) => handleDrop(e, col.key, 'nf')}
                          className={`px-2 py-2 text-xs font-semibold text-amber-800 whitespace-nowrap ${
                            col.key !== 'expand' ? 'cursor-grab active:cursor-grabbing' : ''
                          } ${col.sortable ? 'cursor-pointer hover:bg-amber-100' : ''} ${
                            col.key === 'VAL_TOTAL_NF' ? 'text-right' : col.key === 'NUM_CELULAR' || col.key === 'DTA_EMISSAO' || col.key === 'DTA_ENTRADA' ? 'text-center' : 'text-left'
                          } ${draggedColumn?.key === col.key ? 'opacity-50' : ''}`}
                          onClick={() => col.sortable && handleNfSort(col.key)}
                          title={col.key !== 'expand' ? 'Arraste para reordenar' : ''}
                        >
                          {col.label}{col.sortable && <NfSortIcon columnKey={col.key} />}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {sortedNfs.map((nf, idx) => {
                      const nfKey = `${nf.NUM_NF}_${nf.COD_FORNECEDOR}_${nf.COD_LOJA}`;
                      const isExpanded = expandedNf === nfKey;
                      const itens = itensNf[nfKey] || [];
                      const isLoadingItensNfRow = loadingItensNf[nfKey];
                      const whatsappUrl = formatWhatsApp(nf.NUM_CELULAR);

                      // Função para renderizar cada célula baseado na coluna
                      const renderNfCell = (col) => {
                        switch(col.key) {
                          case 'expand':
                            return (
                              <td key={col.key} className="px-2 py-1.5">
                                <button className={`w-5 h-5 flex items-center justify-center rounded border text-xs font-bold transition-colors ${isExpanded ? 'bg-amber-500 text-white border-amber-500' : 'bg-white text-gray-500 border-gray-300 hover:border-amber-500 hover:text-amber-500'}`}>
                                  {isExpanded ? '−' : '+'}
                                </button>
                              </td>
                            );
                          case 'NUM_NF':
                            return <td key={col.key} className="px-2 py-1.5 font-semibold text-gray-900">{nf.NUM_NF}</td>;
                          case 'FORNECEDOR':
                            return <td key={col.key} className="px-2 py-1.5 max-w-[180px] truncate" title={nf.FORNECEDOR}>{nf.FORNECEDOR || '-'}</td>;
                          case 'DES_CLASSIFICACAO':
                            return <td key={col.key} className="px-2 py-1.5 text-xs max-w-[120px] truncate" title={nf.DES_CLASSIFICACAO}>{nf.DES_CLASSIFICACAO || '-'}</td>;
                          case 'NUM_CGC':
                            return <td key={col.key} className="px-2 py-1.5 text-xs text-gray-500 font-mono">{formatCNPJ(nf.NUM_CGC)}</td>;
                          case 'DES_CONTATO':
                            return <td key={col.key} className="px-2 py-1.5 text-xs max-w-[100px] truncate" title={nf.DES_CONTATO}>{nf.DES_CONTATO || '-'}</td>;
                          case 'NUM_CELULAR':
                            return (
                              <td key={col.key} className="px-2 py-1.5 text-center" onClick={(e) => e.stopPropagation()}>
                                {whatsappUrl ? (
                                  <a href={whatsappUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 px-2 py-0.5 bg-green-100 text-green-700 rounded text-xs hover:bg-green-200 transition-colors" title="Abrir WhatsApp">
                                    <span>📱</span>
                                    <span className="font-medium">{formatCelular(nf.NUM_CELULAR)}</span>
                                  </a>
                                ) : (
                                  <span className="text-gray-400 text-xs">-</span>
                                )}
                              </td>
                            );
                          case 'DTA_EMISSAO':
                            return <td key={col.key} className="px-2 py-1.5 text-center text-xs">{formatDate(nf.DTA_EMISSAO)}</td>;
                          case 'DTA_ENTRADA':
                            return <td key={col.key} className="px-2 py-1.5 text-center text-xs">{formatDate(nf.DTA_ENTRADA)}</td>;
                          case 'VAL_TOTAL_NF':
                            return <td key={col.key} className="px-2 py-1.5 text-right font-semibold text-green-600">{formatCurrency(nf.VAL_TOTAL_NF)}</td>;
                          case 'DES_NATUREZA':
                            return <td key={col.key} className="px-2 py-1.5 text-xs max-w-[150px] truncate" title={nf.DES_NATUREZA}>{nf.DES_NATUREZA || '-'}</td>;
                          default:
                            return <td key={col.key} className="px-2 py-1.5">-</td>;
                        }
                      };

                      return (
                        <>
                          <tr key={`${nf.NUM_NF}-${nf.COD_FORNECEDOR}-${idx}`} className={`hover:bg-amber-50 cursor-pointer ${isExpanded ? 'bg-amber-50' : ''}`} onClick={() => toggleNf(nf)}>
                            {nfColumns.map(col => renderNfCell(col))}
                          </tr>

                          {/* Linha expandida com itens da NF */}
                          {isExpanded && (
                            <tr key={`${nf.NUM_NF}-${nf.COD_FORNECEDOR}-itens`}>
                              <td colSpan="11" className="bg-gray-50 p-3 border-t border-b border-amber-200">
                                <div className="ml-6">
                                  <h4 className="text-xs font-semibold text-gray-700 mb-2">
                                    📄 Itens da NF {nf.NUM_NF} - {nf.FORNECEDOR}
                                  </h4>

                                  {isLoadingItensNfRow ? (
                                    <div className="flex items-center justify-center py-4">
                                      <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-amber-500"></div>
                                    </div>
                                  ) : itens.length === 0 ? (
                                    <p className="text-gray-500 text-xs py-2">Nenhum item encontrado</p>
                                  ) : (
                                    <table className="w-full text-xs border border-gray-200 rounded">
                                      <thead className="bg-gray-100">
                                        <tr>
                                          <th className="px-2 py-1 text-left font-medium text-gray-600">COD</th>
                                          <th className="px-2 py-1 text-left font-medium text-gray-600">PRODUTO</th>
                                          <th className="px-2 py-1 text-center font-medium text-gray-600">CURVA</th>
                                          <th className="px-2 py-1 text-right font-medium text-gray-600">QTD</th>
                                          <th className="px-2 py-1 text-center font-medium text-gray-600">UN</th>
                                          <th className="px-2 py-1 text-right font-medium text-gray-600">VLR CUSTO</th>
                                          <th className="px-2 py-1 text-right font-medium text-gray-600">VLR VENDA</th>
                                          <th className="px-2 py-1 text-right font-medium text-gray-600">VLR TOTAL</th>
                                        </tr>
                                      </thead>
                                      <tbody className="bg-white divide-y divide-gray-100">
                                        {itens.map((item, itemIdx) => {
                                          const curva = item.CURVA || 'X';
                                          const curvaColor =
                                            curva === 'A' ? 'bg-green-100 text-green-800' :
                                            curva === 'B' ? 'bg-blue-100 text-blue-800' :
                                            curva === 'C' ? 'bg-yellow-100 text-yellow-800' :
                                            curva === 'D' ? 'bg-orange-100 text-orange-800' :
                                            curva === 'E' ? 'bg-red-100 text-red-800' :
                                            'bg-gray-100 text-gray-800';

                                          return (
                                            <tr key={itemIdx} className="hover:bg-gray-50">
                                              <td className="px-2 py-1 font-mono">{item.COD_PRODUTO}</td>
                                              <td className="px-2 py-1 max-w-[200px] truncate" title={item.DES_PRODUTO}>
                                                {item.DES_PRODUTO || '-'}
                                              </td>
                                              <td className="px-2 py-1 text-center">
                                                <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold ${curvaColor}`}>
                                                  {curva}
                                                </span>
                                              </td>
                                              <td className="px-2 py-1 text-right">{(item.QTD_ENTRADA || 0).toFixed(2)}</td>
                                              <td className="px-2 py-1 text-center">{item.DES_UNIDADE || '-'}</td>
                                              <td className="px-2 py-1 text-right">{formatCurrency(item.VAL_CUSTO)}</td>
                                              <td className="px-2 py-1 text-right">{formatCurrency(item.VAL_VENDA)}</td>
                                              <td className="px-2 py-1 text-right font-medium text-green-600">{formatCurrency(item.VAL_TOTAL)}</td>
                                            </tr>
                                          );
                                        })}
                                      </tbody>
                                      <tfoot className="bg-gray-100">
                                        <tr>
                                          <td colSpan="7" className="px-2 py-1 text-right font-medium">Total:</td>
                                          <td className="px-2 py-1 text-right font-bold text-green-600">
                                            {formatCurrency(itens.reduce((sum, item) => sum + (item.VAL_TOTAL || 0), 0))}
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
            )
          ) : sortedPedidos.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              Nenhum pedido encontrado
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-orange-50 border-b border-orange-200">
                  <tr>
                    {pedidoColumns.map((col) => (
                      <th
                        key={col.key}
                        draggable={col.key !== 'expand'}
                        onDragStart={(e) => handleDragStart(e, col.key, 'pedido')}
                        onDragOver={handleDragOver}
                        onDrop={(e) => handleDrop(e, col.key, 'pedido')}
                        className={`px-2 py-2 text-xs font-semibold text-orange-800 whitespace-nowrap ${
                          col.key !== 'expand' ? 'cursor-grab active:cursor-grabbing' : ''
                        } ${col.sortable ? 'cursor-pointer hover:bg-orange-100' : ''} ${
                          col.key === 'VAL_PEDIDO' ? 'text-right' :
                          col.key === 'NUM_CELULAR' || col.key === 'DTA_EMISSAO' || col.key === 'DTA_ENTREGA' || col.key === 'ATRASO' || col.key === 'DTA_PEDIDO_CANCELADO' ? 'text-center' : 'text-left'
                        } ${draggedColumn?.key === col.key ? 'opacity-50' : ''}`}
                        onClick={() => col.sortable && handleSort(col.key)}
                        title={col.key !== 'expand' ? 'Arraste para reordenar' : ''}
                      >
                        {col.label}{col.sortable && <SortIcon columnKey={col.key} />}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {sortedPedidos.map((pedido) => {
                    // Determinar status baseado no filtro ativo
                    let status = STATUS_RECEBIMENTO[pedido.TIPO_RECEBIMENTO] || STATUS_RECEBIMENTO[0];

                    // Sobrescrever status quando em filtros especiais
                    if (filters.parciaisFinalizadas) {
                      status = { label: 'Parcial Finalizada', color: 'bg-purple-100 text-purple-800', icon: '📋' };
                    } else if (filters.canceladasTotais) {
                      status = { label: 'Itens Cortados', color: 'bg-pink-100 text-pink-800', icon: '🚫' };
                    } else if (filters.semNenhumaEntrada) {
                      status = { label: 'Cancelado INTEGRAL', color: 'bg-gray-200 text-gray-800', icon: '⛔' };
                    }

                    const diasAtraso = calcularDiasAtraso(pedido.DTA_ENTREGA);
                    const isAtrasado = diasAtraso > 0 && pedido.TIPO_RECEBIMENTO < 2;
                    const isExpanded = expandedPedido === pedido.NUM_PEDIDO;
                    // Determinar chave do cache baseada no filtro ativo
                    const cacheKey = filters.parciaisFinalizadas
                      ? `${pedido.NUM_PEDIDO}_apenasRecebidos`
                      : filters.canceladasTotais
                        ? `${pedido.NUM_PEDIDO}_apenasRuptura`
                        : filters.semNenhumaEntrada
                          ? `${pedido.NUM_PEDIDO}_semNenhumaEntrada`
                          : pedido.NUM_PEDIDO;
                    const itens = itensPedido[cacheKey] || [];
                    const isLoadingItens = loadingItens[pedido.NUM_PEDIDO];

                    // Função para renderizar cada célula baseado na coluna
                    const renderPedidoCell = (col) => {
                      switch(col.key) {
                        case 'expand':
                          return (
                            <td key={col.key} className="px-2 py-1.5">
                              <button className={`w-5 h-5 flex items-center justify-center rounded border text-xs font-bold transition-colors ${isExpanded ? 'bg-orange-500 text-white border-orange-500' : 'bg-white text-gray-500 border-gray-300 hover:border-orange-500 hover:text-orange-500'}`}>
                                {isExpanded ? '−' : '+'}
                              </button>
                            </td>
                          );
                        case 'NUM_PEDIDO':
                          return <td key={col.key} className="px-2 py-1.5 font-semibold text-gray-900">#{pedido.NUM_PEDIDO}</td>;
                        case 'TIPO_RECEBIMENTO':
                          return (
                            <td key={col.key} className="px-2 py-1.5">
                              <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-medium ${status.color}`}>
                                {status.icon} {status.label}
                              </span>
                            </td>
                          );
                        case 'QTD_NF_A_CONFIRMAR':
                          return (
                            <td key={col.key} className="px-2 py-1.5">
                              {pedido.QTD_NF_A_CONFIRMAR > 0 && (
                                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-medium bg-orange-100 text-orange-700 border border-orange-400" title={`${pedido.QTD_NF_A_CONFIRMAR} NF(s) pendente(s) de confirmação`}>
                                  📋 À CONFIRMAR
                                </span>
                              )}
                            </td>
                          );
                        case 'DES_FORNECEDOR':
                          return <td key={col.key} className="px-2 py-1.5 max-w-[180px] truncate" title={pedido.DES_FORNECEDOR}>{pedido.DES_FORNECEDOR || '-'}</td>;
                        case 'NUM_CGC':
                          return <td key={col.key} className="px-2 py-1.5 text-xs text-gray-500 font-mono">{formatCNPJ(pedido.NUM_CGC)}</td>;
                        case 'DES_CONTATO':
                          return <td key={col.key} className="px-2 py-1.5 text-xs max-w-[100px] truncate" title={pedido.DES_CONTATO}>{pedido.DES_CONTATO || '-'}</td>;
                        case 'NUM_CELULAR':
                          return (
                            <td key={col.key} className="px-2 py-1.5 text-center" onClick={(e) => e.stopPropagation()}>
                              {formatWhatsApp(pedido.NUM_CELULAR) ? (
                                <a href={formatWhatsApp(pedido.NUM_CELULAR)} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 px-2 py-0.5 bg-green-100 text-green-700 rounded text-xs hover:bg-green-200 transition-colors" title="Abrir WhatsApp">
                                  <span>📱</span>
                                  <span className="font-medium">{formatCelular(pedido.NUM_CELULAR)}</span>
                                </a>
                              ) : (
                                <span className="text-gray-400 text-xs">-</span>
                              )}
                            </td>
                          );
                        case 'NUM_FREQ_VISITA':
                          return (
                            <td key={col.key} className="px-2 py-1.5 text-center text-xs">
                              {pedido.NUM_FREQ_VISITA ? (
                                <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-blue-100 text-blue-800 font-medium">
                                  {pedido.NUM_FREQ_VISITA}d
                                </span>
                              ) : (
                                <span className="text-gray-400">-</span>
                              )}
                            </td>
                          );
                        case 'PRAZO_ENTREGA':
                          return (
                            <td key={col.key} className="px-2 py-1.5 text-center text-xs">
                              {pedido.PRAZO_ENTREGA ? (
                                <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-green-100 text-green-800 font-medium">
                                  {pedido.PRAZO_ENTREGA}d
                                </span>
                              ) : (
                                <span className="text-gray-400">-</span>
                              )}
                            </td>
                          );
                        case 'PRAZO_MEDIO_REAL':
                          const prazoMedioRaw = pedido.PRAZO_MEDIO_REAL;
                          const prazoMedio = prazoMedioRaw ? Math.round(prazoMedioRaw) : null;
                          const prazoCad = pedido.PRAZO_ENTREGA || 0;
                          const diferenca = prazoMedio ? (prazoMedio - prazoCad) : null;
                          // Cor: Verde se igual ou abaixo, Vermelho se acima
                          const prazoMedioColor = !prazoMedio ? 'bg-gray-100 text-gray-500' :
                            diferenca <= 0 ? 'bg-green-100 text-green-800' :
                            'bg-red-100 text-red-800';
                          return (
                            <td key={col.key} className="px-2 py-1.5 text-center text-xs">
                              {prazoMedio ? (
                                <span
                                  className={`inline-flex items-center px-1.5 py-0.5 rounded font-medium ${prazoMedioColor}`}
                                  title={`Prazo médio real: ${pedido.QTD_NFS_PRAZO || 0} NFs (90 dias). Dif: ${diferenca > 0 ? '+' : ''}${diferenca}d`}
                                >
                                  {prazoMedio}d
                                </span>
                              ) : (
                                <span className="text-gray-400" title="Sem dados suficientes">-</span>
                              )}
                            </td>
                          );
                        case 'COND_PAGAMENTO':
                          return (
                            <td key={col.key} className="px-2 py-1.5 text-center text-xs">
                              {pedido.COND_PAGAMENTO ? (
                                <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-purple-100 text-purple-800 font-medium">
                                  {pedido.COND_PAGAMENTO}d
                                </span>
                              ) : (
                                <span className="text-gray-400">-</span>
                              )}
                            </td>
                          );
                        case 'DTA_EMISSAO':
                          return <td key={col.key} className="px-2 py-1.5 text-center text-xs">{formatDate(pedido.DTA_EMISSAO)}</td>;
                        case 'DTA_ENTREGA':
                          return <td key={col.key} className={`px-2 py-1.5 text-center text-xs ${isAtrasado ? 'text-red-600 font-semibold' : ''}`}>{formatDate(pedido.DTA_ENTREGA)}</td>;
                        case 'ATRASO':
                          return (
                            <td key={col.key} className="px-2 py-1.5 text-center">
                              {isAtrasado ? (
                                <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-red-500 text-white">{diasAtraso}d</span>
                              ) : (
                                <span className="text-gray-400 text-xs">-</span>
                              )}
                            </td>
                          );
                        case 'DTA_PEDIDO_CANCELADO':
                          return (
                            <td key={col.key} className="px-2 py-1.5 text-center text-xs">
                              {pedido.TIPO_RECEBIMENTO === 3 ? (
                                <span className={filters.canceladasTotais ? "text-pink-600 font-semibold" : "text-red-600 font-semibold"}>
                                  {formatDate(pedido.DTA_PEDIDO_CANCELADO || pedido.DTA_ALTERACAO)}
                                </span>
                              ) : (
                                <span className="text-gray-400">-</span>
                              )}
                            </td>
                          );
                        case 'VAL_PEDIDO':
                          return <td key={col.key} className="px-2 py-1.5 text-right font-semibold text-green-600">{formatCurrency(pedido.VAL_PEDIDO)}</td>;
                        case 'USUARIO':
                          return <td key={col.key} className="px-2 py-1.5 text-xs max-w-[80px] truncate" title={pedido.USUARIO}>{pedido.USUARIO || '-'}</td>;
                        case 'OBS':
                          return <td key={col.key} className="px-2 py-1.5 text-xs max-w-[100px] truncate text-gray-500" title={pedido.DES_OBSERVACAO || pedido.DES_CANCELAMENTO}>{pedido.DES_CANCELAMENTO || pedido.DES_OBSERVACAO || '-'}</td>;
                        default:
                          return <td key={col.key} className="px-2 py-1.5">-</td>;
                      }
                    };

                    return (
                      <>
                        <tr
                          key={pedido.NUM_PEDIDO}
                          className={`hover:bg-gray-50 cursor-pointer ${isAtrasado ? 'bg-red-50' : ''} ${isExpanded ? 'bg-orange-50' : ''}`}
                          onClick={() => togglePedido(pedido.NUM_PEDIDO)}
                        >
                          {pedidoColumns.map(col => renderPedidoCell(col))}
                        </tr>

                        {/* Linha expandida com itens */}
                        {isExpanded && (
                          <tr key={`${pedido.NUM_PEDIDO}-itens`}>
                            <td colSpan="18" className="bg-gray-50 p-3 border-t border-b border-orange-200">
                              <div className="ml-6">
                                <h4 className="text-xs font-semibold text-gray-700 mb-2">
                                  {filters.parciaisFinalizadas
                                    ? `📋 Itens Recebidos OK - Pedido #${pedido.NUM_PEDIDO}`
                                    : filters.canceladasTotais
                                      ? `🚫 Itens Cortados - Pedido #${pedido.NUM_PEDIDO}`
                                      : filters.semNenhumaEntrada
                                        ? `⛔ Cancelado INTEGRAL - Pedido #${pedido.NUM_PEDIDO}`
                                        : `Itens do Pedido #${pedido.NUM_PEDIDO}`
                                  }
                                </h4>

                                {isLoadingItens ? (
                                  <div className="flex items-center justify-center py-4">
                                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-orange-500"></div>
                                  </div>
                                ) : itens.length === 0 ? (
                                  <p className="text-gray-500 text-xs py-2">Nenhum item encontrado</p>
                                ) : (
                                  <table className="w-full text-xs border border-gray-200 rounded">
                                    <thead className="bg-gray-100">
                                      <tr>
                                        <th className="px-2 py-1 text-left font-medium text-gray-600">COD</th>
                                        <th className="px-2 py-1 text-left font-medium text-gray-600">PRODUTO</th>
                                        <th className="px-2 py-1 text-center font-medium text-gray-600">CURVA</th>
                                        <th className="px-2 py-1 text-right font-medium text-gray-600">QTD PED</th>
                                        <th className="px-2 py-1 text-right font-medium text-gray-600">QTD REC</th>
                                        <th className="px-2 py-1 text-center font-medium text-gray-600">STATUS</th>
                                        <th className="px-2 py-1 text-center font-medium text-gray-600">UN</th>
                                        <th className="px-2 py-1 text-right font-medium text-gray-600">VLR UNIT</th>
                                        <th className="px-2 py-1 text-right font-medium text-gray-600">VLR TOTAL</th>
                                        <th className="px-2 py-1 text-right font-medium text-gray-600">CUSTO REP</th>
                                      </tr>
                                    </thead>
                                    <tbody className="bg-white divide-y divide-gray-100">
                                      {itens.map((item, idx) => {
                                        const recebidoCompleto = (item.QTD_RECEBIDA || 0) >= (item.QTD_PEDIDO || 0);
                                        const recebidoParcial = (item.QTD_RECEBIDA || 0) > 0 && (item.QTD_RECEBIDA || 0) < (item.QTD_PEDIDO || 0);
                                        const isPendente = (item.QTD_RECEBIDA || 0) < (item.QTD_PEDIDO || 0);
                                        const isCancelado = pedido.TIPO_RECEBIMENTO === 3;

                                        // Determinar cor de fundo baseada no contexto
                                        let rowBgColor = '';
                                        if (filters.parciaisFinalizadas) {
                                          rowBgColor = 'bg-purple-50'; // Roxo claro para itens OK
                                        } else if (filters.canceladasTotais) {
                                          rowBgColor = 'bg-pink-50'; // Rosa claro para itens cancelados
                                        } else if (filters.semNenhumaEntrada) {
                                          rowBgColor = 'bg-gray-100'; // Cinza claro para cancelados integral
                                        } else if (isPendente) {
                                          rowBgColor = isCancelado ? 'bg-red-50' : 'bg-yellow-50';
                                        }

                                        // Definir cor da curva
                                        const curva = item.CURVA || 'X';
                                        const curvaColor =
                                          curva === 'A' ? 'bg-green-100 text-green-800' :
                                          curva === 'B' ? 'bg-blue-100 text-blue-800' :
                                          curva === 'C' ? 'bg-yellow-100 text-yellow-800' :
                                          curva === 'D' ? 'bg-orange-100 text-orange-800' :
                                          curva === 'E' ? 'bg-red-100 text-red-800' :
                                          'bg-gray-100 text-gray-800';

                                        return (
                                          <tr key={idx} className={`hover:bg-gray-50 ${rowBgColor}`}>
                                            <td className="px-2 py-1 font-mono">{item.COD_PRODUTO}</td>
                                            <td className="px-2 py-1 max-w-[200px] truncate" title={item.DES_PRODUTO}>
                                              {item.DES_PRODUTO || '-'}
                                            </td>
                                            <td className="px-2 py-1 text-center">
                                              <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold ${curvaColor}`}>
                                                {curva}
                                              </span>
                                            </td>
                                            <td className="px-2 py-1 text-right">{(item.QTD_PEDIDO || 0).toFixed(2)}</td>
                                            <td className={`px-2 py-1 text-right font-medium ${
                                              recebidoCompleto ? 'text-green-600' :
                                              recebidoParcial ? 'text-blue-600' : 'text-gray-600'
                                            }`}>
                                              {(item.QTD_RECEBIDA || 0).toFixed(2)}
                                            </td>
                                            <td className="px-2 py-1 text-center">
                                              {filters.parciaisFinalizadas ? (
                                                // Na tela de Parciais Finalizadas, mostra apenas itens OK em roxo
                                                <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-bold bg-purple-600 text-white">
                                                  RECEBIDO OK
                                                </span>
                                              ) : filters.canceladasTotais ? (
                                                // Na tela de Canceladas Totais, mostra apenas itens cancelados em rosa
                                                <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-bold bg-pink-600 text-white">
                                                  ITEM CORTADO
                                                </span>
                                              ) : filters.semNenhumaEntrada ? (
                                                // Na tela de Cancelados Integral, todos os itens foram cancelados
                                                <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-bold bg-gray-700 text-white">
                                                  NÃO RECEBIDO
                                                </span>
                                              ) : isPendente ? (
                                                isCancelado ? (
                                                  <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-bold bg-gray-700 text-white">
                                                    CANCELADO
                                                  </span>
                                                ) : (
                                                  <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-bold bg-red-500 text-white">
                                                    PENDENTE
                                                  </span>
                                                )
                                              ) : (
                                                <span className="text-green-600 font-medium">OK</span>
                                              )}
                                            </td>
                                            <td className="px-2 py-1 text-center">{item.DES_UNIDADE || '-'}</td>
                                            <td className="px-2 py-1 text-right">{formatCurrency(item.VAL_TABELA)}</td>
                                            <td className="px-2 py-1 text-right font-medium">
                                              {formatCurrency((item.QTD_PEDIDO || 0) * (item.VAL_TABELA || 0))}
                                            </td>
                                            <td className="px-2 py-1 text-right text-blue-600">{formatCurrency(item.VAL_CUSTO_REP)}</td>
                                          </tr>
                                        );
                                      })}
                                    </tbody>
                                    <tfoot className="bg-gray-100">
                                      <tr>
                                        <td colSpan="7" className="px-2 py-1 text-right font-medium">Total:</td>
                                        <td className="px-2 py-1 text-right font-bold text-green-600">
                                          {formatCurrency(itens.reduce((sum, item) => sum + ((item.QTD_PEDIDO || 0) * (item.VAL_TABELA || 0)), 0))}
                                        </td>
                                        <td></td>
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

          {/* Paginacao */}
          {!loading && (filters.nfSemPedido ? nfPagination.totalPages > 1 : pagination.totalPages > 1) && (
            <div className="px-3 py-2 border-t border-gray-200 flex flex-col sm:flex-row items-center justify-between gap-2 text-sm">
              <div className="text-xs text-gray-500">
                {filters.nfSemPedido ? (
                  <>
                    {((nfPagination.page - 1) * nfPagination.limit) + 1} - {Math.min(nfPagination.page * nfPagination.limit, nfPagination.total)} de {nfPagination.total}
                  </>
                ) : (
                  <>
                    {((pagination.page - 1) * pagination.limit) + 1} - {Math.min(pagination.page * pagination.limit, pagination.total)} de {pagination.total}
                  </>
                )}
              </div>
              <div className="flex gap-1">
                <button
                  onClick={() => filters.nfSemPedido ? loadNfsSemPedido(nfPagination.page - 1) : handlePageChange(pagination.page - 1)}
                  disabled={filters.nfSemPedido ? nfPagination.page <= 1 : pagination.page <= 1}
                  className="px-2 py-1 border rounded text-xs disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                >
                  Anterior
                </button>
                <span className="px-2 py-1 text-xs">
                  {filters.nfSemPedido ? nfPagination.page : pagination.page} / {filters.nfSemPedido ? nfPagination.totalPages : pagination.totalPages}
                </span>
                <button
                  onClick={() => filters.nfSemPedido ? loadNfsSemPedido(nfPagination.page + 1) : handlePageChange(pagination.page + 1)}
                  disabled={filters.nfSemPedido ? nfPagination.page >= nfPagination.totalPages : pagination.page >= pagination.totalPages}
                  className="px-2 py-1 border rounded text-xs disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                >
                  Proxima
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}
