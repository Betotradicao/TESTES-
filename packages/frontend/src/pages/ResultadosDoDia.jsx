import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import Sidebar from '../components/Sidebar';
import { api } from '../utils/api';
import { fetchSectors } from '../services/sectors.service';
import EmployeeFilter from '../components/filters/EmployeeFilter';

export default function ResultadosDoDia() {
  const { user, logout } = useAuth();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [sells, setSells] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [summary, setSummary] = useState({
    total_sells: 0,
    verified_count: 0,
    not_verified_count: 0,
    cancelled_count: 0
  });
  const [metrics, setMetrics] = useState({
    total_value_cents: 0,
    total_verified_cents: 0,
    total_not_verified_cents: 0,
    count_all: 0,
    count_verified: 0,
    count_not_verified: 0
  });
  const [sectors, setSectors] = useState([]);

  // Filtros
  const [filters, setFilters] = useState({
    date_from: new Date().toISOString().split('T')[0], // Hoje por padrão
    date_to: new Date().toISOString().split('T')[0], // Hoje por padrão
    status: 'all',
    search: '',
    sector_id: '',
    employee_id: ''
  });

  // Paginação
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 25,
    total: 0,
    totalPages: 0,
    hasNextPage: false,
    hasPreviousPage: false
  });

  // Função para buscar setores
  const loadSectors = async () => {
    try {
      const data = await fetchSectors(false);
      setSectors(data || []);
    } catch (err) {
      console.error('Erro ao buscar setores:', err);
    }
  };

  // Carregar setores ao montar componente
  useEffect(() => {
    loadSectors();
  }, []);

  // Função para buscar vendas
  const fetchSells = async (page = 1) => {
    try {
      setLoading(true);
      setError('');

      const params = {
        page: page.toString(),
        limit: pagination.limit.toString()
      };

      // Adicionar filtros apenas se preenchidos
      if (filters.date_from) params.date_from = filters.date_from;
      if (filters.date_to) params.date_to = filters.date_to;
      if (filters.status && filters.status !== 'all') params.status = filters.status;
      if (filters.search && filters.search.trim()) params.product = filters.search.trim();
      if (filters.sector_id) params.sector_id = filters.sector_id;
      if (filters.employee_id) params.employee_id = filters.employee_id;

      const response = await api.get('/sells', { params });
      const data = response.data;

      setSells(data.data || []);
      setSummary(data.summary);
      setMetrics(data.metrics);

      // Atualizar paginação
      setPagination({
        page: page,
        limit: pagination.limit,
        total: data.pagination?.total || 0,
        totalPages: data.pagination?.totalPages || 1,
        hasNextPage: data.pagination?.hasNextPage || false,
        hasPreviousPage: data.pagination?.hasPrevPage || false
      });

    } catch (err) {
      console.error('Erro ao buscar vendas:', err);
      if (err.response?.status === 401) {
        logout();
      } else if (err.response?.status === 400) {
        // Erro 400: limpar listagem mas manter cards zerados
        const errorMessage = err.response?.data?.error || 'Erro ao carregar dados. Tente novamente.';
        setError(errorMessage);
        setSells([]);
        setSummary({
          total_sells: 0,
          verified_count: 0,
          not_verified_count: 0,
          cancelled_count: 0
        });
        setMetrics({
          total_value_cents: 0,
          total_verified_cents: 0,
          total_not_verified_cents: 0,
          count_all: 0,
          count_verified: 0,
          count_not_verified: 0
        });
        setPagination({
          page: 1,
          limit: 25,
          total: 0,
          totalPages: 0,
          hasNextPage: false,
          hasPreviousPage: false
        });
      } else {
        setError('Erro ao carregar vendas. Tente novamente.');
      }
    } finally {
      setLoading(false);
    }
  };

  // Carregar vendas ao montar componente e quando filtros mudam
  useEffect(() => {
    fetchSells(1);
  }, [filters.date_from, filters.date_to, filters.status, filters.search, filters.sector_id, filters.employee_id]);

  // Auto-refresh: atualiza vendas a cada 2 minutos
  useEffect(() => {
    const AUTO_REFRESH_INTERVAL = 2 * 60 * 1000; // 2 minutos em milissegundos

    const intervalId = setInterval(() => {
      // Recarrega a página atual mantendo os filtros
      fetchSells(pagination.page);
    }, AUTO_REFRESH_INTERVAL);

    // Limpa o intervalo quando o componente for desmontado
    return () => clearInterval(intervalId);
  }, [pagination.page, filters]); // Recriar intervalo se página ou filtros mudarem

  // Função para navegar páginas
  const handlePageChange = (newPage) => {
    if (newPage >= 1 && newPage <= pagination.totalPages) {
      fetchSells(newPage);
    }
  };


  // Função para formatar valor
  const formatCurrency = (cents) => {
    return `R$ ${(cents / 100).toFixed(2).replace('.', ',')}`;
  };

  /**
   * Calcula a porcentagem de um valor em relação ao total
   * @param {number} value - Valor parcial em centavos
   * @param {number} total - Valor total em centavos
   * @returns {string} - Porcentagem formatada (ex: "89.50%")
   */
  const calculatePercentage = (value, total) => {
    if (!total || total === 0) return "0%";

    const percentage = (value / total) * 100;

    // Arredondar para 2 casas decimais
    const rounded = Math.round(percentage * 100) / 100;

    // Formatar: remover decimais se for número inteiro
    return rounded % 1 === 0
      ? `${rounded.toFixed(0)}%`
      : `${rounded.toFixed(2)}%`;
  };

  // Função para formatar data e hora
  const formatDateTime = (dateTimeString) => {
    if (!dateTimeString) return '-';
    // JavaScript automaticamente converte UTC para horário local do navegador
    const date = new Date(dateTimeString);
    return date.toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      timeZone: 'America/Sao_Paulo' // Força timezone de Brasília
    });
  };

  // Função para obter cor do status
  const getStatusColor = (status) => {
    switch (status) {
      case 'verified':
        return 'bg-green-100 text-green-800';
      case 'not_verified':
        return 'bg-red-100 text-red-800';
      case 'cancelled':
        return 'bg-gray-100 text-gray-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  // Função para obter texto do status
  const getStatusText = (status) => {
    switch (status) {
      case 'verified':
        return 'Verificado';
      case 'not_verified':
        return 'Não verificado';
      case 'cancelled':
        return 'Cancelado';
      default:
        return status;
    }
  };

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
          <h1 className="text-lg font-semibold text-gray-900">Resultados do Dia</h1>
          <button
            onClick={logout}
            className="p-2 text-gray-600 hover:text-red-600"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"/>
            </svg>
          </button>
        </div>

        <main className="p-4 lg:p-8">
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Resultados do Dia</h1>
            <p className="text-gray-600">
              Monitoramento de vendas e detecção de possíveis furtos
            </p>
          </div>

          {/* Métricas de Valores */}
          <div className="mb-6">
            {/* Desktop */}
            <div className="hidden md:grid grid-cols-3 gap-4">
              <div className="bg-white p-6 rounded-lg shadow">
                <h3 className="text-sm font-medium text-gray-500 mb-2">Total</h3>
                <p className="text-2xl font-bold text-gray-900">
                  {formatCurrency(metrics.total_value_cents)}
                  <span className="text-xs font-normal text-red-600 ml-2">
                    100%
                  </span>
                </p>
              </div>
              <div className="bg-white p-6 rounded-lg shadow">
                <h3 className="text-sm font-medium text-gray-500 mb-2">Total verificado</h3>
                <p className="text-2xl font-bold text-green-600">
                  {formatCurrency(metrics.total_verified_cents)}
                  <span className="text-xs font-normal text-red-600 ml-2">
                    {calculatePercentage(metrics.total_verified_cents, metrics.total_value_cents)}
                  </span>
                </p>
              </div>
              <div className="bg-white p-6 rounded-lg shadow">
                <h3 className="text-sm font-medium text-gray-500 mb-2">Total não verificado</h3>
                <p className="text-2xl font-bold text-yellow-600">
                  {formatCurrency(metrics.total_not_verified_cents)}
                  <span className="text-xs font-normal text-red-600 ml-2">
                    {calculatePercentage(metrics.total_not_verified_cents, metrics.total_value_cents)}
                  </span>
                </p>
              </div>
            </div>

            {/* Mobile */}
            <div className="md:hidden overflow-x-auto">
              <div className="flex space-x-4 pb-2">
                <div className="bg-white p-4 rounded-lg shadow min-w-[140px] flex-shrink-0">
                  <h3 className="text-sm font-medium text-gray-500 mb-2">Total</h3>
                  <p className="text-2xl font-bold text-gray-900">
                    {formatCurrency(metrics.total_value_cents)}
                    <span className="text-xs font-normal text-red-600 ml-2">
                      100%
                    </span>
                  </p>
                </div>
                <div className="bg-white p-4 rounded-lg shadow min-w-[140px] flex-shrink-0">
                  <h3 className="text-sm font-medium text-gray-500 mb-2">Total verificado</h3>
                  <p className="text-2xl font-bold text-green-600">
                    {formatCurrency(metrics.total_verified_cents)}
                    <span className="text-xs font-normal text-red-600 ml-2">
                      {calculatePercentage(metrics.total_verified_cents, metrics.total_value_cents)}
                    </span>
                  </p>
                </div>
                <div className="bg-white p-4 rounded-lg shadow min-w-[140px] flex-shrink-0">
                  <h3 className="text-sm font-medium text-gray-500 mb-2">Total não verificado</h3>
                  <p className="text-2xl font-bold text-yellow-600">
                    {formatCurrency(metrics.total_not_verified_cents)}
                    <span className="text-xs font-normal text-red-600 ml-2">
                      {calculatePercentage(metrics.total_not_verified_cents, metrics.total_value_cents)}
                    </span>
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Resumo */}
          <div className="mb-6">
            {/* Desktop */}
            <div className="hidden md:grid grid-cols-4 gap-4">
              <div className="bg-white p-6 rounded-lg shadow">
                <h3 className="text-sm font-medium text-gray-500 mb-2">Total de vendas</h3>
                <p className="text-2xl font-bold text-gray-900">{summary.total_sells}</p>
              </div>
              <div className="bg-white p-6 rounded-lg shadow">
                <h3 className="text-sm font-medium text-gray-500 mb-2">Verificadas</h3>
                <p className="text-2xl font-bold text-green-600">{summary.verified_count}</p>
              </div>
              <div className="bg-white p-6 rounded-lg shadow">
                <h3 className="text-sm font-medium text-gray-500 mb-2">Não verificadas</h3>
                <p className="text-2xl font-bold text-red-600">{summary.not_verified_count}</p>
              </div>
              <div className="bg-white p-6 rounded-lg shadow">
                <h3 className="text-sm font-medium text-gray-500 mb-2">Canceladas</h3>
                <p className="text-2xl font-bold text-gray-600">{summary.cancelled_count || 0}</p>
              </div>
            </div>

            {/* Mobile */}
            <div className="md:hidden overflow-x-auto">
              <div className="flex space-x-4 pb-2">
                <div className="bg-white p-4 rounded-lg shadow min-w-[140px] flex-shrink-0">
                  <h3 className="text-sm font-medium text-gray-500 mb-2">Total de vendas</h3>
                  <p className="text-2xl font-bold text-gray-900">{summary.total_sells}</p>
                </div>
                <div className="bg-white p-4 rounded-lg shadow min-w-[140px] flex-shrink-0">
                  <h3 className="text-sm font-medium text-gray-500 mb-2">Verificadas</h3>
                  <p className="text-2xl font-bold text-green-600">{summary.verified_count}</p>
                </div>
                <div className="bg-white p-4 rounded-lg shadow min-w-[140px] flex-shrink-0">
                  <h3 className="text-sm font-medium text-gray-500 mb-2">Não verificadas</h3>
                  <p className="text-2xl font-bold text-red-600">{summary.not_verified_count}</p>
                </div>
                <div className="bg-white p-4 rounded-lg shadow min-w-[140px] flex-shrink-0">
                  <h3 className="text-sm font-medium text-gray-500 mb-2">Canceladas</h3>
                  <p className="text-2xl font-bold text-gray-600">{summary.cancelled_count || 0}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Filtros */}
          <div className="bg-white rounded-lg shadow p-6 mb-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
              {/* Data Inicial */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Data inicial <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  value={filters.date_from}
                  onChange={(e) => setFilters({ ...filters, date_from: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-orange-500 focus:border-orange-500"
                  required
                />
              </div>

              {/* Data Final */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Data final <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  value={filters.date_to}
                  onChange={(e) => setFilters({ ...filters, date_to: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-orange-500 focus:border-orange-500"
                  required
                />
              </div>

              {/* Status */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Status
                </label>
                <select
                  value={filters.status}
                  onChange={(e) => setFilters({ ...filters, status: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-orange-500 focus:border-orange-500"
                >
                  <option value="all">Todos os status</option>
                  <option value="verified">Verificadas</option>
                  <option value="not_verified">Não verificadas</option>
                  <option value="cancelled">Canceladas</option>
                </select>
              </div>

              {/* Setor */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Setor
                </label>
                <select
                  value={filters.sector_id}
                  onChange={(e) => setFilters({ ...filters, sector_id: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-orange-500 focus:border-orange-500"
                >
                  <option value="">Todos os setores</option>
                  {sectors.map((sector) => (
                    <option key={sector.id} value={sector.id}>
                      {sector.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Colaborador */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Colaborador
                </label>
                <EmployeeFilter
                  value={filters.employee_id}
                  onChange={(value) => setFilters({ ...filters, employee_id: value })}
                  placeholder="Todos os colaboradores"
                />
              </div>

              {/* Busca por produto */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Buscar produto
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={filters.search}
                    onChange={(e) => setFilters({ ...filters, search: e.target.value })}
                    placeholder="Código ou descrição..."
                    className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md focus:ring-orange-500 focus:border-orange-500"
                  />
                  <svg className="absolute left-3 top-2.5 h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
                  </svg>
                </div>
              </div>
            </div>
          </div>

          {/* Mensagens de Erro */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-md p-4 mb-6">
              <div className="flex">
                <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
                <div className="ml-3">
                  <h3 className="text-sm font-medium text-red-800">Erro</h3>
                  <div className="mt-2 text-sm text-red-700">{error}</div>
                </div>
              </div>
            </div>
          )}

          {/* Lista de Vendas */}
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200">
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-medium text-gray-900">
                  Vendas ({pagination.total} encontradas)
                </h3>
                <div className="text-sm text-gray-500">
                  Página {pagination.page} de {pagination.totalPages}
                </div>
              </div>
            </div>

            {loading ? (
              <div className="p-8 text-center">
                <div className="inline-flex items-center">
                  <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-orange-500" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Carregando vendas...
                </div>
              </div>
            ) : (
              <>
                {/* Tabela para Desktop */}
                <div className="hidden lg:block overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Vendedor
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Produto
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Data/Hora
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Valor
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Valor c/ Desconto
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Peso
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Setor
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Status
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Cupom Fiscal
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Bipagem
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {sells.map((sell) => (
                        <tr key={sell.id} className="hover:bg-gray-50">
                          <td className="px-6 py-4 whitespace-nowrap">
                            {sell.status === 'verified' && sell.bip?.employee ? (
                              <div className="flex items-center gap-2">
                                {sell.bip.employee.avatar ? (
                                  <img
                                    src={sell.bip.employee.avatar}
                                    alt={sell.bip.employee.name}
                                    className="w-8 h-8 rounded-full object-cover"
                                  />
                                ) : (
                                  <div className="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center text-white font-semibold text-sm">
                                    {sell.bip.employee.name.charAt(0).toUpperCase()}
                                  </div>
                                )}
                                <span className="text-sm text-gray-900">{sell.bip.employee.name}</span>
                              </div>
                            ) : (
                              <span className="text-gray-400 text-xs">-</span>
                            )}
                          </td>
                          <td className="px-6 py-4">
                            <div>
                              <div className="text-sm font-medium text-gray-900">
                                {sell.product_id}
                              </div>
                              <div className="text-sm text-gray-500">
                                {sell.product_description}
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {formatDateTime(sell.sell_date)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {formatCurrency(sell.sell_value_cents)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {formatCurrency(sell.final_value_cents || (sell.sell_value_cents - (sell.discount_cents || 0)))}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {sell.product_weight} kg
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            {sell.equipment?.sector ? (
                              <span
                                className="inline-flex px-3 py-1 text-xs font-semibold rounded-full text-white"
                                style={{ backgroundColor: sell.equipment.sector.color }}
                              >
                                {sell.equipment.sector.name}
                              </span>
                            ) : (
                              <span className="text-gray-400 text-xs">-</span>
                            )}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(sell.status)}`}>
                              {getStatusText(sell.status)}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {sell.num_cupom_fiscal ? (
                              <span className="text-gray-700 font-medium">
                                {sell.num_cupom_fiscal}
                              </span>
                            ) : (
                              <span className="text-gray-400">
                                -
                              </span>
                            )}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(sell.status)}`}>
                              {sell.bip_ean || 'Não encontrada'}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Cards para Mobile */}
                <div className="lg:hidden">
                  {sells.map((sell) => (
                    <div key={sell.id} className="border-b border-gray-200 p-4">
                      <div className="flex justify-between items-start mb-2">
                        <div className="flex-1">
                          <div className="text-sm font-medium text-gray-900">
                            {sell.product_id}
                          </div>
                          <div className="text-sm text-gray-600 mt-1">
                            {sell.product_description}
                          </div>
                          <div className="text-sm text-gray-500 mt-1">
                            {formatDateTime(sell.sell_date)}
                          </div>
                          <div className="text-sm text-gray-500 mt-1">
                            {formatCurrency(sell.sell_value_cents)} • {formatCurrency(sell.final_value_cents || (sell.sell_value_cents - (sell.discount_cents || 0)))} • {sell.product_weight} kg
                          </div>
                          <div className="mt-2">
                            <span className="text-xs text-gray-500">Setor: </span>
                            {sell.equipment?.sector ? (
                              <span
                                className="inline-flex px-2 py-0.5 text-xs font-semibold rounded-full text-white ml-1"
                                style={{ backgroundColor: sell.equipment.sector.color }}
                              >
                                {sell.equipment.sector.name}
                              </span>
                            ) : (
                              <span className="text-gray-400 text-xs">-</span>
                            )}
                          </div>
                        </div>
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(sell.status)}`}>
                          {getStatusText(sell.status)}
                        </span>
                      </div>
                      <div className="flex justify-between text-sm mt-2">
                        <div>
                          {sell.num_cupom_fiscal ? (
                            <span className="text-gray-700 font-medium">
                              Cupom: {sell.num_cupom_fiscal}
                            </span>
                          ) : (
                            <span className="text-gray-400">
                              Cupom: -
                            </span>
                          )}
                        </div>
                        <div>
                          <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(sell.status)}`}>
                            Bipagem: {sell.bip_ean || 'Não encontrada'}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {sells.length === 0 && !loading && (
                  <div className="p-8 text-center text-gray-500">
                    Nenhuma venda encontrada com os filtros selecionados.
                  </div>
                )}

                {/* Paginação */}
                {pagination.totalPages > 1 && (
                  <div className="px-6 py-4 border-t border-gray-200">
                    {/* Desktop Pagination */}
                    <div className="hidden sm:flex items-center justify-between">
                      <div className="text-sm text-gray-700">
                        Página {pagination.page} de {pagination.totalPages} ({pagination.total} registros)
                      </div>
                      <div className="flex space-x-2">
                        <button
                          onClick={() => handlePageChange(1)}
                          disabled={pagination.page === 1}
                          className="px-3 py-1 text-sm border border-gray-300 rounded-md disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                        >
                          Primeira
                        </button>
                        <button
                          onClick={() => handlePageChange(pagination.page - 1)}
                          disabled={!pagination.hasPreviousPage}
                          className="px-3 py-1 text-sm border border-gray-300 rounded-md disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                        >
                          Anterior
                        </button>
                        <button
                          onClick={() => handlePageChange(pagination.page + 1)}
                          disabled={!pagination.hasNextPage}
                          className="px-3 py-1 text-sm border border-gray-300 rounded-md disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                        >
                          Próximo
                        </button>
                        <button
                          onClick={() => handlePageChange(pagination.totalPages)}
                          disabled={pagination.page === pagination.totalPages}
                          className="px-3 py-1 text-sm border border-gray-300 rounded-md disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                        >
                          Última
                        </button>
                      </div>
                    </div>

                    {/* Mobile Pagination */}
                    <div className="sm:hidden">
                      <div className="text-center text-sm text-gray-700 mb-3">
                        Página {pagination.page} de {pagination.totalPages}
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div className="flex space-x-1">
                          <button
                            onClick={() => handlePageChange(1)}
                            disabled={pagination.page === 1}
                            className="flex-1 px-2 py-2 text-sm border border-gray-300 rounded-md disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                          >
                            ««
                          </button>
                          <button
                            onClick={() => handlePageChange(pagination.page - 1)}
                            disabled={!pagination.hasPreviousPage}
                            className="flex-1 px-2 py-2 text-sm border border-gray-300 rounded-md disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                          >
                            ‹
                          </button>
                        </div>
                        <div className="flex space-x-1">
                          <button
                            onClick={() => handlePageChange(pagination.page + 1)}
                            disabled={!pagination.hasNextPage}
                            className="flex-1 px-2 py-2 text-sm border border-gray-300 rounded-md disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                          >
                            ›
                          </button>
                          <button
                            onClick={() => handlePageChange(pagination.totalPages)}
                            disabled={pagination.page === pagination.totalPages}
                            className="flex-1 px-2 py-2 text-sm border border-gray-300 rounded-md disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                          >
                            »»
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}