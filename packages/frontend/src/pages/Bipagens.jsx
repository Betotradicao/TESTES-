import { useState, useEffect, useRef } from 'react';
import toast, { Toaster } from 'react-hot-toast';
import { useAuth } from '../contexts/AuthContext';
import Sidebar from '../components/Sidebar';
import { api } from '../utils/api';
import { fetchSectors } from '../services/sectors.service';
import { fetchEquipments } from '../services/equipments.service';
import { fetchEmployees } from '../services/employees.service';
import equipmentSessionsService from '../services/equipment-sessions.service';
import EmployeeFilter from '../components/filters/EmployeeFilter';
import Pagination from '../components/common/Pagination';
import ScannerGunIcon from '../components/icons/ScannerGunIcon';
import MotivoCancelamentoModal from '../components/bipagens/MotivoCancelamentoModal';

export default function Bipagens() {
  const { user, logout } = useAuth();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [bipages, setBipages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 0,
    hasNextPage: false,
    hasPreviousPage: false
  });

  // Filtros
  const [filters, setFilters] = useState({
    date_from: new Date().toISOString().split('T')[0], // Hoje por padrão
    date_to: new Date().toISOString().split('T')[0], // Hoje por padrão
    status: '',
    notified_filter: 'all', // 'all' ou 'notified_only'
    search: '',
    sector_id: '',
    employee_id: ''
  });

  // Ref para controle do interval de auto-refresh
  const intervalRef = useRef(null);

  // Estado para controlar se auto-refresh está ativo
  const [autoRefreshEnabled, setAutoRefreshEnabled] = useState(true);

  // Estado para controlar qual bipagem está sendo cancelada
  const [cancellingId, setCancellingId] = useState(null);

  // Estado para controlar qual bipagem está sendo reativada
  const [reactivatingId, setReactivatingId] = useState(null);

  // Estado para controlar o modal de motivo de cancelamento
  const [showMotivoCancelamentoModal, setShowMotivoCancelamentoModal] = useState(false);
  const [bipToCancel, setBipToCancel] = useState(null);

  // Estado para setores
  const [sectors, setSectors] = useState([]);

  // Estado para scanners logados
  const [activeSessions, setActiveSessions] = useState([]);

  // Estado para todos os equipamentos
  const [equipments, setEquipments] = useState([]);

  // Estado para todos os funcionários ativos
  const [employees, setEmployees] = useState([]);

  // Função para verificar se auto-refresh deve estar ativo
  const shouldAutoRefresh = (dateToFilter) => {
    if (!dateToFilter) return false;

    // Pegar apenas a parte da data (YYYY-MM-DD) para comparação
    const todayStr = new Date().toISOString().split('T')[0];
    const dateToStr = dateToFilter; // Já vem no formato YYYY-MM-DD do input

    // Comparar strings de datas (YYYY-MM-DD permite comparação direta)
    return dateToStr >= todayStr;
  };

  // Função para buscar bipagens
  const fetchBipages = async (page = 1, newFilters = filters, silent = false) => {
    try {
      if (!silent) setLoading(true);
      setError('');

      const params = {
        page,
        limit: pagination.limit
      };

      // Adicionar filtros apenas se preenchidos
      if (newFilters.date_from) params.date_from = newFilters.date_from;
      if (newFilters.date_to) params.date_to = newFilters.date_to;
      if (newFilters.status) params.status = newFilters.status;
      if (newFilters.notified_filter) params.notified_filter = newFilters.notified_filter;
      // Só adiciona search se tiver 2+ caracteres
      if (newFilters.search && newFilters.search.length >= 2) params.search = newFilters.search;
      if (newFilters.sector_id) params.sector_id = newFilters.sector_id;
      if (newFilters.employee_id) params.employee_id = newFilters.employee_id;

      const response = await api.get('/bips', { params });

      setBipages(response.data.data);
      setPagination(response.data.pagination);

      // Limpar erro em caso de sucesso
      setError('');

      // Verificar se deve ativar auto-refresh baseado na data_to
      const shouldRefresh = shouldAutoRefresh(newFilters.date_to);
      setAutoRefreshEnabled(shouldRefresh);

    } catch (err) {
      console.error('Erro ao buscar bipagens:', err);
      if (err.response?.status === 401) {
        logout();
      } else if (err.response?.status === 400) {
        // Erro 400: limpar listagem e pausar auto-refresh
        const errorMessage = err.response?.data?.error || 'Erro ao carregar dados. Tente novamente.';
        setError(errorMessage);
        setBipages([]);
        setPagination({
          page: 1,
          limit: 20,
          total: 0,
          totalPages: 0,
          hasNextPage: false,
          hasPreviousPage: false
        });
        setAutoRefreshEnabled(false);
      } else {
        // Outros erros
        const errorMessage = err.response?.data?.error || 'Erro ao carregar dados. Tente novamente.';
        setError(errorMessage);
      }
    } finally {
      if (!silent) setLoading(false);
    }
  };

  // Carregar dados iniciais e setores
  useEffect(() => {
    fetchBipages();
    loadSectors();
    loadActiveSessions();
    loadEquipments();
    loadEmployees();
  }, []);

  // Função para carregar setores
  const loadSectors = async () => {
    try {
      const data = await fetchSectors(false); // Todos os setores
      setSectors(data);
    } catch (err) {
      console.error('Erro ao carregar setores:', err);
    }
  };

  // Função para carregar scanners ativos
  const loadActiveSessions = async () => {
    try {
      const response = await equipmentSessionsService.getAllActiveSessions();
      setActiveSessions(response.data || []);
    } catch (err) {
      console.error('Erro ao carregar sessões ativas:', err);
    }
  };

  // Função para carregar todos os equipamentos
  const loadEquipments = async () => {
    try {
      const data = await fetchEquipments();
      setEquipments(data || []);
    } catch (err) {
      console.error('Erro ao carregar equipamentos:', err);
    }
  };

  // Função para carregar todos os funcionários ativos
  const loadEmployees = async () => {
    try {
      const response = await fetchEmployees(1, 1000, true); // Todos os ativos
      setEmployees(response.data || []);
    } catch (err) {
      console.error('Erro ao carregar funcionários:', err);
    }
  };

  // Função para lidar com mudança de vendedor no scanner
  const handleEmployeeChange = async (equipmentId, employeeId) => {
    try {
      if (employeeId === '') {
        // Logout
        await equipmentSessionsService.logoutEmployee(equipmentId);
        toast.success('Vendedor deslogado com sucesso!');
      } else {
        // Login
        await equipmentSessionsService.loginEmployee(equipmentId, employeeId);
        toast.success('Vendedor logado com sucesso!');
      }
      // Recarregar sessões ativas
      await loadActiveSessions();
    } catch (err) {
      console.error('Erro ao alterar vendedor:', err);
      const errorMessage = err.response?.data?.error || 'Erro ao alterar vendedor. Tente novamente.';
      toast.error(errorMessage);
    }
  };

  // Função para obter o funcionário logado em um equipamento
  const getLoggedEmployee = (equipmentId) => {
    const session = activeSessions.find(s => s.equipment.id === equipmentId);
    return session?.employee?.id || '';
  };

  // Estado para força re-render dos tempos pendentes
  const [, forceUpdate] = useState({});

  // Auto-refresh a cada 3 segundos (apenas se autoRefreshEnabled estiver true)
  useEffect(() => {
    // Limpar intervalo anterior
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    // Só ativa auto-refresh se estiver habilitado
    if (autoRefreshEnabled) {
      intervalRef.current = setInterval(() => {
        fetchBipages(pagination.page, filters, true); // silent = true
        loadActiveSessions(); // Atualiza scanners logados
        forceUpdate({}); // Força recálculo dos tempos pendentes
      }, 3000);
    }

    // Cleanup ao desmontar componente
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [pagination.page, filters, autoRefreshEnabled]);

  // Aplicar filtros
  const handleFilterChange = (newFilters) => {
    setFilters(newFilters);

    // Só faz a busca se o campo search estiver vazio ou tiver 2+ caracteres
    if (newFilters.search.length === 0 || newFilters.search.length >= 2) {
      fetchBipages(1, newFilters);
    }
  };

  // Mudança de página
  const handlePageChange = (newPage) => {
    if (newPage >= 1 && newPage <= pagination.totalPages) {
      fetchBipages(newPage);
    }
  };

  // Formatação de data e hora (mantém horário original do banco)
  // Formatação de data/hora da BIPAGEM (event_date)
  // Bipagens já são salvas com horário local correto
  const formatDateTime = (dateString) => {
    if (!dateString) return '-';

    const date = new Date(dateString);

    // Formata normalmente sem conversão de timezone
    const day = date.getDate().toString().padStart(2, '0');
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const year = date.getFullYear();
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    const seconds = date.getSeconds().toString().padStart(2, '0');

    return `${day}/${month}/${year}, ${hours}:${minutes}:${seconds}`;
  };

  // Formatação de data/hora da VENDA DO PDV (sell_date)
  // Vendas do Zanthus precisam de conversão de timezone
  const formatSellDateTime = (dateString) => {
    if (!dateString) return '-';

    // A data vem do Zanthus como 'YYYY-MM-DD HH:MM:SS' sem timezone
    // PostgreSQL salva como timestamp e o backend retorna em UTC
    // Precisamos converter de volta para horário do Brasil (UTC-3)
    const date = new Date(dateString);

    // Usa toLocaleString com timezone do Brasil para exibir horário correto
    return date.toLocaleString('pt-BR', {
      timeZone: 'America/Sao_Paulo',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    });
  };

  // Formatação de valor
  const formatPrice = (cents) => {
    return `R$ ${(cents / 100).toFixed(2).replace('.', ',')}`;
  };

  // Formatação de peso
  const formatWeight = (weight) => {
    return weight ? `${Number(weight).toFixed(3)} kg` : '-';
  };

  // Calcular tempo pendente
  const calculatePendingTime = (eventDate, status) => {
    if (status !== 'pending') return '-';

    // Usar horário local para 'now' e tratar eventTime como horário local também
    const now = new Date();

    // Parse da data do evento mantendo como horário local (sem conversão UTC)
    const eventTime = new Date(eventDate.replace('Z', ''));

    const diffMs = now - eventTime;

    if (diffMs < 0) return '0s';

    const seconds = Math.floor(diffMs / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) return `${days}d ${hours % 24}h`;
    if (hours > 0) return `${hours}h ${minutes % 60}m`;
    if (minutes > 0) return `${minutes}m`;
    return `${seconds}s`;
  };

  // Classes para status
  const getStatusColor = (status) => {
    switch (status) {
      case 'pending':
        return 'bg-yellow-100 text-yellow-800';
      case 'verified':
        return 'bg-green-100 text-green-800';
      case 'cancelled':
        return 'bg-red-100 text-red-600';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusText = (status) => {
    switch (status) {
      case 'pending':
        return 'Pendente';
      case 'verified':
        return 'Verificado';
      case 'cancelled':
        return 'Cancelado';
      default:
        return status;
    }
  };

  // Função para abrir modal de cancelamento
  const handleCancelBip = (bipId) => {
    // Primeiro confirma se quer cancelar
    if (!window.confirm('Tem certeza que deseja cancelar esta bipagem?\n\nIsso cancelará TODAS as bipagens PENDENTES com o mesmo EAN E PESO registradas no mesmo dia.')) {
      return;
    }

    // Se confirmou, abre o modal para selecionar o motivo
    setBipToCancel(bipId);
    setShowMotivoCancelamentoModal(true);
  };

  // Função que efetivamente cancela a bipagem com o motivo e funcionário responsável
  const confirmCancelBip = async (motivo, employeeResponsavelId) => {
    if (!bipToCancel) return;

    setCancellingId(bipToCancel);

    try {
      const payload = {
        motivo_cancelamento: motivo
      };

      // Adicionar employee_responsavel_id apenas se fornecido
      if (employeeResponsavelId) {
        payload.employee_responsavel_id = employeeResponsavelId;
      }

      const response = await api.put(`/bips/${bipToCancel}/cancel`, payload);

      const { cancelledCount } = response.data;

      // Fechar modal
      setShowMotivoCancelamentoModal(false);
      setBipToCancel(null);

      // Mostrar mensagem de sucesso com emoji
      toast.success(`✅ ${cancelledCount} bipagem(ns) cancelada(s) com sucesso!`);

      // Refetch para garantir sincronização
      fetchBipages(pagination.page, filters, true);

    } catch (error) {
      console.error('Erro ao cancelar bipagem:', error);
      const errorMessage = error.response?.data?.error || 'Erro ao cancelar bipagem. Tente novamente.';
      toast.error(`❌ ${errorMessage}`);
    } finally {
      setCancellingId(null);
    }
  };

  // Função para reativar bipagem
  const handleReactivateBip = async (bipId) => {
    if (!window.confirm('Tem certeza que deseja reativar esta bipagem?\n\nIsso reativará TODAS as bipagens CANCELADAS com o mesmo EAN registradas no mesmo dia.')) {
      return;
    }

    setReactivatingId(bipId);

    try {
      const response = await api.put(`/bips/${bipId}/reactivate`);

      const { reactivatedCount } = response.data;

      // Mostrar quantas foram reativadas
      alert(`${reactivatedCount} bipagem(ns) reativada(s) com sucesso!`);

      // Refetch para garantir sincronização
      fetchBipages(pagination.page, filters, true);

    } catch (error) {
      console.error('Erro ao reativar bipagem:', error);
      alert('Erro ao reativar bipagem. Tente novamente.');
    } finally {
      setReactivatingId(null);
    }
  };

  return (
    <div className="flex h-screen bg-gray-50">
      <Toaster position="top-right" />

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
          <h1 className="text-lg font-semibold text-gray-900">Bipagens Ao Vivo</h1>
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
        <div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Bipagens Ao Vivo</h1>
          <p className="text-gray-600 mb-3">
            Monitoramento em tempo real das bipagens de produtos
          </p>

          {/* Scanners com Setor e Select de Vendedor */}
          {equipments.length > 0 && (
            <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-gray-100">
              {equipments.filter(eq => eq.active).map((equipment) => {
                const loggedEmployee = activeSessions.find(s => s.equipment.id === equipment.id)?.employee;

                return (
                  <div
                    key={equipment.id}
                    className="bg-white border border-gray-200 rounded-xl p-3 whitespace-nowrap flex-shrink-0 shadow-sm"
                  >
                    {/* Parte superior: Scanner → Vendedor (horizontal) */}
                    <div className="mb-3 flex flex-col items-center">
                      {/* Ícones e Seta - centralizados */}
                      <div className="flex items-start gap-4 mb-1">
                        {/* Scanner Icon */}
                        <div className="flex flex-col items-center gap-1">
                          <div
                            className="w-10 h-10 rounded-full flex items-center justify-center text-white"
                            style={{ backgroundColor: equipment.color_hash }}
                          >
                            <ScannerGunIcon className="w-6 h-6" />
                          </div>
                          <span className="text-[10px] text-gray-600 font-medium">
                            Scaner {equipment.id}
                          </span>
                          {equipment.port_number && (
                            <span className="text-[9px] text-gray-500 font-semibold">
                              Porta {equipment.port_number}
                            </span>
                          )}
                        </div>

                        {/* Seta no meio - alinhada apenas com os ícones (h-10) */}
                        <div className="flex items-center h-10">
                          <span className="text-gray-400 text-lg">→</span>
                        </div>

                        {/* Vendedor Icon/Photo */}
                        <div className="flex flex-col items-center gap-1">
                          {loggedEmployee?.avatar ? (
                            <img
                              src={loggedEmployee.avatar}
                              alt={loggedEmployee.name}
                              className="w-10 h-10 rounded-full object-cover"
                            />
                          ) : (
                            <div className="w-10 h-10 rounded-full bg-gray-300 flex items-center justify-center text-white font-semibold text-sm">
                              ?
                            </div>
                          )}
                          <span className="text-[10px] text-gray-600 font-medium">
                            {loggedEmployee?.name?.split(' ')[0] || 'Nenhum'}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Setor */}
                    <div className="mb-2">
                      <span className="text-xs text-gray-500">
                        Setor: <span className="font-medium text-gray-700">
                          {equipment.sector?.name || 'Sem setor'}
                        </span>
                      </span>
                    </div>

                    {/* Select de Vendedor */}
                    <select
                      value={getLoggedEmployee(equipment.id)}
                      onChange={(e) => handleEmployeeChange(equipment.id, e.target.value)}
                      className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                    >
                      <option value="">Selecione o vendedor</option>
                      {employees.map((employee) => (
                        <option key={employee.id} value={employee.id}>
                          {employee.name}
                        </option>
                      ))}
                    </select>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Filtros */}
      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Filtros</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Filtro de Data Inicial */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Data inicial
            </label>
            <input
              type="date"
              value={filters.date_from}
              onChange={(e) => handleFilterChange({ ...filters, date_from: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-orange-500 focus:border-orange-500"
              required
            />
          </div>

          {/* Filtro de Data Final */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Data final
            </label>
            <input
              type="date"
              value={filters.date_to}
              onChange={(e) => handleFilterChange({ ...filters, date_to: e.target.value })}
              min={filters.date_from}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-orange-500 focus:border-orange-500"
              required
            />
          </div>

          {/* Filtro de Status */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Status
            </label>
            <select
              value={filters.status}
              onChange={(e) => handleFilterChange({ ...filters, status: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-orange-500 focus:border-orange-500"
            >
              <option value="">Todos</option>
              <option value="pending">Pendente</option>
              <option value="verified">Verificado</option>
              <option value="cancelled">Cancelado</option>
            </select>
          </div>

          {/* Filtro de Notificados */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Notificações
            </label>
            <select
              value={filters.notified_filter}
              onChange={(e) => handleFilterChange({ ...filters, notified_filter: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-orange-500 focus:border-orange-500"
            >
              <option value="all">Todos</option>
              <option value="notified_only">Apenas Notificados</option>
            </select>
          </div>

          {/* Filtro de Busca de Produto */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Buscar produto (código ou descrição)
            </label>
            <input
              type="text"
              value={filters.search}
              onChange={(e) => handleFilterChange({ ...filters, search: e.target.value })}
              placeholder="Ex: 03704 ou Coxão Mole"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-orange-500 focus:border-orange-500"
            />
          </div>

          {/* Filtro de Setor */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Setor
            </label>
            <select
              value={filters.sector_id}
              onChange={(e) => handleFilterChange({ ...filters, sector_id: e.target.value })}
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

          {/* Filtro de Vendedor */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Vendedor
            </label>
            <EmployeeFilter
              value={filters.employee_id}
              onChange={(value) => handleFilterChange({ ...filters, employee_id: value })}
              placeholder="Todos os vendedores"
            />
          </div>
        </div>
      </div>

      {/* Mensagem de erro */}
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

      {/* Tabela de Bipagens */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-medium text-gray-900">
            Resultados ({pagination.total} encontrados)
          </h3>
        </div>

        {loading ? (
          <div className="p-8 text-center">
            <div className="inline-flex items-center">
              <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-orange-500" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Carregando...
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
                      bipagem
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Produto
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Data/Hora
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Preço
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Peso
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Tempo Pendente
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Ações
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {bipages.map((bip) => (
                    <tr key={bip.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        {bip.employee ? (
                          <div className="flex items-center gap-2">
                            {bip.employee.avatar ? (
                              <img
                                src={bip.employee.avatar}
                                alt={bip.employee.name}
                                className="w-8 h-8 rounded-full object-cover"
                              />
                            ) : (
                              <div className="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center text-white font-semibold text-sm">
                                {bip.employee.name.charAt(0).toUpperCase()}
                              </div>
                            )}
                            <div>
                              <div className="text-sm text-gray-900">{bip.employee.name}</div>
                              {bip.employee.sector && (
                                <div className="text-xs text-gray-500">{bip.employee.sector.name}</div>
                              )}
                            </div>
                          </div>
                        ) : (
                          <span className="text-gray-400 text-xs">-</span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-gray-900">
                        {bip.ean}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-900">
                        <div>
                          <div className="font-medium">{bip.product_id}</div>
                          <div className="text-gray-500 text-xs">{bip.product_description}</div>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-900">
                        <div>{formatDateTime(bip.event_date)}</div>
                        {bip.sell_date && (
                          <div className="text-xs text-gray-500 mt-1">
                            {formatSellDateTime(bip.sell_date)}
                          </div>
                        )}
                        {bip.sell_point_of_sale_code && (
                          <div className="text-xs text-gray-500 mt-1">
                            PDV: {bip.sell_point_of_sale_code}
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 font-medium">
                        {formatPrice(bip.bip_price_cents)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {formatWeight(bip.bip_weight)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(bip.status)}`}>
                          {getStatusText(bip.status)}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        <span className={bip.status === 'pending' ? 'text-yellow-600 font-medium' : 'text-gray-400'}>
                          {calculatePendingTime(bip.event_date, bip.status)}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        <div className="flex gap-2">
                          {bip.status === 'pending' && (
                            <button
                              onClick={() => handleCancelBip(bip.id)}
                              disabled={cancellingId === bip.id}
                              className="px-2 py-1 text-xs bg-gray-100 text-gray-800 rounded-full hover:bg-gray-200 disabled:opacity-50 font-semibold"
                            >
                              {cancellingId === bip.id ? 'Cancelando...' : 'Cancelar'}
                            </button>
                          )}
                          {bip.status === 'cancelled' && (
                            <button
                              onClick={() => handleReactivateBip(bip.id)}
                              disabled={reactivatingId === bip.id}
                              className="px-2 py-1 text-xs bg-green-100 text-green-800 rounded-full hover:bg-green-200 disabled:opacity-50 font-semibold"
                            >
                              {reactivatingId === bip.id ? 'Reativando...' : 'Reativar'}
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Cards para Mobile */}
            <div className="lg:hidden">
              {bipages.map((bip) => (
                <div key={bip.id} className="border-b border-gray-200 p-4">
                  {/* Vendedor */}
                  {bip.employee && (
                    <div className="flex items-center gap-2 mb-3 pb-3 border-b border-gray-100">
                      {bip.employee.avatar ? (
                        <img
                          src={bip.employee.avatar}
                          alt={bip.employee.name}
                          className="w-10 h-10 rounded-full object-cover"
                        />
                      ) : (
                        <div className="w-10 h-10 rounded-full bg-blue-500 flex items-center justify-center text-white font-semibold">
                          {bip.employee.name.charAt(0).toUpperCase()}
                        </div>
                      )}
                      <div>
                        <div className="text-sm font-medium text-gray-900">{bip.employee.name}</div>
                        {bip.employee.sector && (
                          <div className="text-xs text-gray-500">{bip.employee.sector.name}</div>
                        )}
                      </div>
                    </div>
                  )}
                  <div className="flex justify-between items-start mb-2">
                    <div className="font-mono text-sm font-medium text-gray-900">
                      {bip.ean}
                    </div>
                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(bip.status)}`}>
                      {getStatusText(bip.status)}
                    </span>
                  </div>
                  <div className="text-sm text-gray-900 mb-1">
                    <span className="font-medium">{bip.product_id}</span> - {bip.product_description}
                  </div>
                  <div className="text-sm text-gray-500 mb-1">
                    <div>{formatDateTime(bip.event_date)}</div>
                    {bip.sell_date && (
                      <div className="text-xs text-gray-400 mt-0.5">
                        {formatSellDateTime(bip.sell_date)}
                      </div>
                    )}
                    {bip.sell_point_of_sale_code && (
                      <div className="text-xs text-gray-400 mt-0.5">
                        PDV: {bip.sell_point_of_sale_code}
                      </div>
                    )}
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="font-medium text-gray-900">{formatPrice(bip.bip_price_cents)}</span>
                    <span className="text-gray-600">{formatWeight(bip.bip_weight)}</span>
                  </div>
                  {bip.status === 'pending' && (
                    <div className="text-sm text-yellow-600 font-medium mt-2">
                      Pendente há: {calculatePendingTime(bip.event_date, bip.status)}
                    </div>
                  )}
                  {(bip.status === 'pending' || bip.status === 'cancelled') && (
                    <div className="mt-3 flex gap-2">
                      {bip.status === 'pending' && (
                        <button
                          onClick={() => handleCancelBip(bip.id)}
                          disabled={cancellingId === bip.id}
                          className="flex-1 px-3 py-2 text-sm bg-gray-100 text-gray-800 rounded-md hover:bg-gray-200 disabled:opacity-50 font-semibold"
                        >
                          {cancellingId === bip.id ? 'Cancelando...' : 'Cancelar'}
                        </button>
                      )}
                      {bip.status === 'cancelled' && (
                        <button
                          onClick={() => handleReactivateBip(bip.id)}
                          disabled={reactivatingId === bip.id}
                          className="flex-1 px-3 py-2 text-sm bg-green-100 text-green-800 rounded-md hover:bg-green-200 disabled:opacity-50 font-semibold"
                        >
                          {reactivatingId === bip.id ? 'Reativando...' : 'Reativar'}
                        </button>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>

            {bipages.length === 0 && !loading && (
              <div className="p-8 text-center text-gray-500">
                Nenhuma bipagem encontrada para os filtros selecionados.
              </div>
            )}
          </>
        )}

        {/* Paginação */}
        <Pagination pagination={pagination} onPageChange={handlePageChange} />
      </div>
        </main>
      </div>

      {/* Modal de Motivo de Cancelamento */}
      <MotivoCancelamentoModal
        isOpen={showMotivoCancelamentoModal}
        onClose={() => {
          setShowMotivoCancelamentoModal(false);
          setBipToCancel(null);
        }}
        onConfirm={confirmCancelBip}
        loading={cancellingId !== null}
      />
    </div>
  );
}