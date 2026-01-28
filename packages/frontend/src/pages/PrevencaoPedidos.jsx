import { useState, useEffect } from 'react';
import Layout from '../components/Layout';
import api from '../services/api';

const STATUS_RECEBIMENTO = {
  0: { label: 'Pendente', color: 'bg-yellow-100 text-yellow-800', icon: '⏳' },
  1: { label: 'Parcial', color: 'bg-blue-100 text-blue-800', icon: '📦' },
  2: { label: 'Recebido', color: 'bg-green-100 text-green-800', icon: '✅' },
  3: { label: 'Cancelado', color: 'bg-red-100 text-red-800', icon: '❌' }
};

export default function PrevencaoPedidos() {
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
    apenasAtrasados: false
  });
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 50,
    total: 0,
    totalPages: 0
  });
  const [stats, setStats] = useState({
    pendentes: 0,
    parciais: 0,
    recebidos: 0,
    cancelados: 0,
    atrasados: 0
  });
  const [expandedPedido, setExpandedPedido] = useState(null);
  const [itensPedido, setItensPedido] = useState({});
  const [loadingItens, setLoadingItens] = useState({});
  const [compradores, setCompradores] = useState([]);
  const [sortConfig, setSortConfig] = useState({ key: null, direction: 'asc' });

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
        parciais: 0,
        recebidos: 0,
        cancelados: 0,
        atrasados: 0
      });
    } catch (err) {
      console.error('Erro ao carregar pedidos:', err);
      setError('Erro ao carregar pedidos. Verifique a conexão com o Oracle.');
    } finally {
      setLoading(false);
    }
  };

  // Carregar itens do pedido
  const loadItensPedido = async (numPedido) => {
    if (itensPedido[numPedido]) return;

    setLoadingItens(prev => ({ ...prev, [numPedido]: true }));
    try {
      const response = await api.get(`/pedidos-compra/${numPedido}/itens`);
      setItensPedido(prev => ({ ...prev, [numPedido]: response.data.itens || [] }));
    } catch (err) {
      console.error('Erro ao carregar itens:', err);
      setItensPedido(prev => ({ ...prev, [numPedido]: [] }));
    } finally {
      setLoadingItens(prev => ({ ...prev, [numPedido]: false }));
    }
  };

  // Carregar compradores disponíveis
  const loadCompradores = async () => {
    try {
      const response = await api.get('/pedidos-compra/compradores');
      setCompradores(response.data.compradores || []);
    } catch (err) {
      console.error('Erro ao carregar compradores:', err);
    }
  };

  useEffect(() => {
    loadPedidos();
    loadCompradores();
  }, []);

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
      apenasAtrasados: false
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
      loadItensPedido(numPedido);
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
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
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
        {/* Header com estatísticas */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 mb-4">
          <div
            className={`bg-white rounded-lg shadow p-3 cursor-pointer border-2 transition-all ${
              filters.tipoRecebimento === '0' && !filters.apenasAtrasados ? 'border-yellow-500 ring-2 ring-yellow-200' : 'border-transparent hover:border-yellow-300'
            }`}
            onClick={() => {
              const newFilters = { ...filters, tipoRecebimento: filters.tipoRecebimento === '0' ? '' : '0', apenasAtrasados: false };
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
              filters.tipoRecebimento === '1' && !filters.apenasAtrasados ? 'border-blue-500 ring-2 ring-blue-200' : 'border-transparent hover:border-blue-300'
            }`}
            onClick={() => {
              const newFilters = { ...filters, tipoRecebimento: filters.tipoRecebimento === '1' ? '' : '1', apenasAtrasados: false };
              setFilters(newFilters);
              loadPedidos(1, newFilters);
            }}
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-500">Parciais</p>
                <p className="text-xl font-bold text-blue-600">{stats.parciais}</p>
              </div>
              <span className="text-2xl">📦</span>
            </div>
          </div>

          <div
            className={`bg-white rounded-lg shadow p-3 cursor-pointer border-2 transition-all ${
              filters.tipoRecebimento === '2' && !filters.apenasAtrasados ? 'border-green-500 ring-2 ring-green-200' : 'border-transparent hover:border-green-300'
            }`}
            onClick={() => {
              const newFilters = { ...filters, tipoRecebimento: filters.tipoRecebimento === '2' ? '' : '2', apenasAtrasados: false };
              setFilters(newFilters);
              loadPedidos(1, newFilters);
            }}
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-500">Recebidos</p>
                <p className="text-xl font-bold text-green-600">{stats.recebidos}</p>
              </div>
              <span className="text-2xl">✅</span>
            </div>
          </div>

          <div
            className={`bg-white rounded-lg shadow p-3 cursor-pointer border-2 transition-all ${
              filters.tipoRecebimento === '3' && !filters.apenasAtrasados ? 'border-red-500 ring-2 ring-red-200' : 'border-transparent hover:border-red-300'
            }`}
            onClick={() => {
              const newFilters = { ...filters, tipoRecebimento: filters.tipoRecebimento === '3' ? '' : '3', apenasAtrasados: false };
              setFilters(newFilters);
              loadPedidos(1, newFilters);
            }}
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-500">Cancelados</p>
                <p className="text-xl font-bold text-red-600">{stats.cancelados}</p>
              </div>
              <span className="text-2xl">❌</span>
            </div>
          </div>

          <div
            className={`bg-white rounded-lg shadow p-3 cursor-pointer border-2 transition-all ${
              filters.apenasAtrasados ? 'border-orange-500 ring-2 ring-orange-200' : 'border-transparent hover:border-orange-300'
            }`}
            onClick={() => {
              const newFilters = { ...filters, apenasAtrasados: !filters.apenasAtrasados, tipoRecebimento: '' };
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
        </div>

        {/* Filtros */}
        <div className="bg-white rounded-lg shadow p-3 mb-4">
          <h3 className="text-sm font-semibold mb-2">Filtros</h3>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-7 gap-2">
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

            <div className="flex items-end gap-1">
              <button
                onClick={handleFilter}
                className="px-3 py-1 bg-orange-500 text-white rounded text-sm hover:bg-orange-600 transition-colors"
              >
                Filtrar
              </button>
              <button
                onClick={handleClearFilters}
                className="px-3 py-1 bg-gray-200 text-gray-700 rounded text-sm hover:bg-gray-300 transition-colors"
              >
                Limpar
              </button>
            </div>
          </div>
        </div>

        {/* Tabela de Pedidos */}
        <div className="bg-white rounded-lg shadow overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-orange-500"></div>
            </div>
          ) : error ? (
            <div className="text-center py-12 text-red-500">
              <p>{error}</p>
              <button
                onClick={() => loadPedidos()}
                className="mt-4 px-4 py-2 bg-orange-500 text-white rounded hover:bg-orange-600"
              >
                Tentar novamente
              </button>
            </div>
          ) : sortedPedidos.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              Nenhum pedido encontrado
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-orange-50 border-b border-orange-200">
                  <tr>
                    <th className="px-2 py-2 text-left text-xs font-semibold text-orange-800 whitespace-nowrap"></th>
                    <th className="px-2 py-2 text-left text-xs font-semibold text-orange-800 whitespace-nowrap cursor-pointer hover:bg-orange-100" onClick={() => handleSort('NUM_PEDIDO')}>
                      N. PEDIDO<SortIcon columnKey="NUM_PEDIDO" />
                    </th>
                    <th className="px-2 py-2 text-left text-xs font-semibold text-orange-800 whitespace-nowrap cursor-pointer hover:bg-orange-100" onClick={() => handleSort('TIPO_RECEBIMENTO')}>
                      STATUS<SortIcon columnKey="TIPO_RECEBIMENTO" />
                    </th>
                    <th className="px-2 py-2 text-left text-xs font-semibold text-orange-800 whitespace-nowrap cursor-pointer hover:bg-orange-100" onClick={() => handleSort('DES_FORNECEDOR')}>
                      FORNECEDOR<SortIcon columnKey="DES_FORNECEDOR" />
                    </th>
                    <th className="px-2 py-2 text-left text-xs font-semibold text-orange-800 whitespace-nowrap cursor-pointer hover:bg-orange-100" onClick={() => handleSort('NUM_CGC')}>
                      CNPJ<SortIcon columnKey="NUM_CGC" />
                    </th>
                    <th className="px-2 py-2 text-center text-xs font-semibold text-orange-800 whitespace-nowrap cursor-pointer hover:bg-orange-100" onClick={() => handleSort('DTA_EMISSAO')}>
                      EMISSAO<SortIcon columnKey="DTA_EMISSAO" />
                    </th>
                    <th className="px-2 py-2 text-center text-xs font-semibold text-orange-800 whitespace-nowrap cursor-pointer hover:bg-orange-100" onClick={() => handleSort('DTA_ENTREGA')}>
                      ENTREGA<SortIcon columnKey="DTA_ENTREGA" />
                    </th>
                    <th className="px-2 py-2 text-center text-xs font-semibold text-orange-800 whitespace-nowrap">ATRASO</th>
                    <th className="px-2 py-2 text-center text-xs font-semibold text-orange-800 whitespace-nowrap cursor-pointer hover:bg-orange-100" onClick={() => handleSort('DTA_PEDIDO_CANCELADO')}>
                      DT CANCEL<SortIcon columnKey="DTA_PEDIDO_CANCELADO" />
                    </th>
                    <th className="px-2 py-2 text-right text-xs font-semibold text-orange-800 whitespace-nowrap cursor-pointer hover:bg-orange-100" onClick={() => handleSort('VAL_PEDIDO')}>
                      VALOR (R$)<SortIcon columnKey="VAL_PEDIDO" />
                    </th>
                    <th className="px-2 py-2 text-left text-xs font-semibold text-orange-800 whitespace-nowrap cursor-pointer hover:bg-orange-100" onClick={() => handleSort('USUARIO')}>
                      COMPRADOR<SortIcon columnKey="USUARIO" />
                    </th>
                    <th className="px-2 py-2 text-left text-xs font-semibold text-orange-800 whitespace-nowrap">OBS</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {sortedPedidos.map((pedido) => {
                    const status = STATUS_RECEBIMENTO[pedido.TIPO_RECEBIMENTO] || STATUS_RECEBIMENTO[0];
                    const diasAtraso = calcularDiasAtraso(pedido.DTA_ENTREGA);
                    const isAtrasado = diasAtraso > 0 && pedido.TIPO_RECEBIMENTO < 2;
                    const isExpanded = expandedPedido === pedido.NUM_PEDIDO;
                    const itens = itensPedido[pedido.NUM_PEDIDO] || [];
                    const isLoadingItens = loadingItens[pedido.NUM_PEDIDO];

                    return (
                      <>
                        <tr
                          key={pedido.NUM_PEDIDO}
                          className={`hover:bg-gray-50 cursor-pointer ${isAtrasado ? 'bg-red-50' : ''} ${isExpanded ? 'bg-orange-50' : ''}`}
                          onClick={() => togglePedido(pedido.NUM_PEDIDO)}
                        >
                          <td className="px-2 py-1.5">
                            <button
                              className={`w-5 h-5 flex items-center justify-center rounded border text-xs font-bold transition-colors ${
                                isExpanded
                                  ? 'bg-orange-500 text-white border-orange-500'
                                  : 'bg-white text-gray-500 border-gray-300 hover:border-orange-500 hover:text-orange-500'
                              }`}
                            >
                              {isExpanded ? '−' : '+'}
                            </button>
                          </td>
                          <td className="px-2 py-1.5 font-semibold text-gray-900">#{pedido.NUM_PEDIDO}</td>
                          <td className="px-2 py-1.5">
                            <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-medium ${status.color}`}>
                              {status.icon} {status.label}
                            </span>
                          </td>
                          <td className="px-2 py-1.5 max-w-[180px] truncate" title={pedido.DES_FORNECEDOR}>
                            {pedido.DES_FORNECEDOR || '-'}
                          </td>
                          <td className="px-2 py-1.5 text-xs text-gray-500 font-mono">
                            {formatCNPJ(pedido.NUM_CGC)}
                          </td>
                          <td className="px-2 py-1.5 text-center text-xs">{formatDate(pedido.DTA_EMISSAO)}</td>
                          <td className={`px-2 py-1.5 text-center text-xs ${isAtrasado ? 'text-red-600 font-semibold' : ''}`}>
                            {formatDate(pedido.DTA_ENTREGA)}
                          </td>
                          <td className="px-2 py-1.5 text-center">
                            {isAtrasado ? (
                              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-red-500 text-white">
                                {diasAtraso}d
                              </span>
                            ) : (
                              <span className="text-gray-400 text-xs">-</span>
                            )}
                          </td>
                          <td className="px-2 py-1.5 text-center text-xs">
                            {pedido.TIPO_RECEBIMENTO === 3 && pedido.DTA_PEDIDO_CANCELADO ? (
                              <span className="text-red-600 font-semibold">{formatDate(pedido.DTA_PEDIDO_CANCELADO)}</span>
                            ) : (
                              <span className="text-gray-400">-</span>
                            )}
                          </td>
                          <td className="px-2 py-1.5 text-right font-semibold text-green-600">
                            {formatCurrency(pedido.VAL_PEDIDO)}
                          </td>
                          <td className="px-2 py-1.5 text-xs max-w-[80px] truncate" title={pedido.USUARIO}>
                            {pedido.USUARIO || '-'}
                          </td>
                          <td className="px-2 py-1.5 text-xs max-w-[100px] truncate text-gray-500" title={pedido.DES_OBSERVACAO || pedido.DES_CANCELAMENTO}>
                            {pedido.DES_CANCELAMENTO || pedido.DES_OBSERVACAO || '-'}
                          </td>
                        </tr>

                        {/* Linha expandida com itens */}
                        {isExpanded && (
                          <tr key={`${pedido.NUM_PEDIDO}-itens`}>
                            <td colSpan="12" className="bg-gray-50 p-3 border-t border-b border-orange-200">
                              <div className="ml-6">
                                <h4 className="text-xs font-semibold text-gray-700 mb-2">Itens do Pedido #{pedido.NUM_PEDIDO}</h4>

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

                                        return (
                                          <tr key={idx} className={`hover:bg-gray-50 ${isPendente ? (isCancelado ? 'bg-red-50' : 'bg-yellow-50') : ''}`}>
                                            <td className="px-2 py-1 font-mono">{item.COD_PRODUTO}</td>
                                            <td className="px-2 py-1 max-w-[200px] truncate" title={item.DES_PRODUTO}>
                                              {item.DES_PRODUTO || '-'}
                                            </td>
                                            <td className="px-2 py-1 text-right">{(item.QTD_PEDIDO || 0).toFixed(2)}</td>
                                            <td className={`px-2 py-1 text-right font-medium ${
                                              recebidoCompleto ? 'text-green-600' :
                                              recebidoParcial ? 'text-blue-600' : 'text-gray-600'
                                            }`}>
                                              {(item.QTD_RECEBIDA || 0).toFixed(2)}
                                            </td>
                                            <td className="px-2 py-1 text-center">
                                              {isPendente ? (
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
          {!loading && pagination.totalPages > 1 && (
            <div className="px-3 py-2 border-t border-gray-200 flex flex-col sm:flex-row items-center justify-between gap-2 text-sm">
              <div className="text-xs text-gray-500">
                {((pagination.page - 1) * pagination.limit) + 1} - {Math.min(pagination.page * pagination.limit, pagination.total)} de {pagination.total}
              </div>
              <div className="flex gap-1">
                <button
                  onClick={() => handlePageChange(pagination.page - 1)}
                  disabled={pagination.page <= 1}
                  className="px-2 py-1 border rounded text-xs disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                >
                  Anterior
                </button>
                <span className="px-2 py-1 text-xs">
                  {pagination.page} / {pagination.totalPages}
                </span>
                <button
                  onClick={() => handlePageChange(pagination.page + 1)}
                  disabled={pagination.page >= pagination.totalPages}
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
