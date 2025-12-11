import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import Sidebar from '../components/Sidebar';
import { api } from '../utils/api';
import { fetchSectors } from '../services/sectors.service';
import { fetchEmployees } from '../services/employees.service';

const MOTIVOS_ICONS = {
  devolucao_mercadoria: '↩️',
  produto_abandonado: '📦',
  falta_cancelamento: '❌',
  erro_operador: '👤',
  erro_balconista: '🛒',
  furto: '🚨'
};

const MOTIVOS_LABELS = {
  devolucao_mercadoria: 'Cancelamento de Bipagem',
  produto_abandonado: 'Produto Abandonado',
  falta_cancelamento: 'Falta de Cancelamento',
  erro_operador: 'Erro do Operador',
  erro_balconista: 'Erro do Balconista',
  furto: 'Furto'
};

const MOTIVOS_DESCRIPTIONS = {
  devolucao_mercadoria: 'Representa quando o Balconista faz corretamente a operação de cancelamento de uma bipagem.',
  produto_abandonado: 'Representa produtos que são retirados no balcão pelo cliente porém são esquecidos ou descartados pelo mesmo em alguma área na loja.',
  falta_cancelamento: 'Representa produtos que o Balconista acaba bipando e o cliente muitas vezes pede para aumentar ou diminuir a quantidade, gerando uma nova bipagem onde o balconista por sua vez acaba bipando novamente e esquecendo de cancelar aquela primeira bipagem.',
  erro_operador: 'Representa quando a mercadoria sai do setor porém ao ser passada no PDV o Operador de caixa acaba não registrando essa mercadoria, seja intencionalmente ou não.',
  erro_balconista: 'Representa o erro detectado pelo cliente ao receber uma mercadoria com código errado. Isso só é possível descobrir se o Balconista esquecer de fazer o Cancelamento da Etiqueta ao trocar.',
  furto: 'Representa o Furto causado pela pessoa que retirou a mercadoria no Balcão.'
};

export default function Rankings() {
  const { user, logout } = useAuth();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [bipages, setBipages] = useState([]);
  const [sectors, setSectors] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [activeView, setActiveView] = useState('motivos');

  // Estado do modal de detalhes
  const [detailsModal, setDetailsModal] = useState({
    isOpen: false,
    title: '',
    bipages: []
  });

  // Estado do modal de upload de vídeo
  const [uploadModal, setUploadModal] = useState({
    isOpen: false,
    bip: null,
    uploading: false
  });

  // Estado do modal de player de vídeo
  const [playerModal, setPlayerModal] = useState({
    isOpen: false,
    bip: null
  });

  // Estado do modal de upload de imagem
  const [imageUploadModal, setImageUploadModal] = useState({
    isOpen: false,
    bip: null,
    uploading: false,
    preview: null
  });

  // Estado do modal de visualização de imagem
  const [imageViewerModal, setImageViewerModal] = useState({
    isOpen: false,
    bip: null
  });

  const [imageZoom, setImageZoom] = useState(100); // Zoom percentage (50% to 200%)

  // Filtros específicos para rankings - padrão: DIA ATUAL
  const getTodayDate = () => {
    return new Date().toISOString().split('T')[0];
  };

  const [filters, setFilters] = useState({
    date_from: getTodayDate(), // Dia atual (não últimos 30 dias)
    date_to: getTodayDate(), // Dia atual
    sector_id: '',
    employee_id: '',
    motivo_cancelamento: ''
  });

  // Carregar setores
  const loadSectors = async () => {
    try {
      const data = await fetchSectors(1, 100);
      setSectors(data.data || []);
    } catch (error) {
      console.error('Erro ao carregar setores:', error);
    }
  };

  // Carregar funcionários
  const loadEmployees = async () => {
    try {
      const data = await fetchEmployees(1, 100, true);
      setEmployees(data.data || []);
    } catch (error) {
      console.error('Erro ao carregar funcionários:', error);
    }
  };

  // Debug: Monitorar mudanças no estado do modal
  useEffect(() => {
    console.log('🎬 Modal state changed:', imageViewerModal);
  }, [imageViewerModal]);

  // Buscar bipagens canceladas
  const fetchCancelledBipages = async () => {
    try {
      setLoading(true);

      const params = {
        page: 1,
        limit: 100, // Máximo permitido pelo backend
        status: 'cancelled', // Só cancelamentos
        date_from: filters.date_from, // SEMPRE enviar (obrigatório no backend)
        date_to: filters.date_to // SEMPRE enviar (obrigatório no backend)
      };

      // Filtros opcionais
      if (filters.sector_id) params.sector_id = filters.sector_id;
      if (filters.employee_id) params.employee_id = filters.employee_id;

      const response = await api.get('/bips', { params });

      console.log('📊 Rankings - Resposta da API:', response.data);
      console.log('📊 Rankings - Total de bips:', response.data.data.length);
      console.log('📊 Rankings - Filtros aplicados:', params);

      let cancelledBips = response.data.data;

      console.log('📊 Rankings - Bips cancelados (antes do filtro de motivo):', cancelledBips.length);

      // Filtrar por motivo se selecionado
      if (filters.motivo_cancelamento) {
        cancelledBips = cancelledBips.filter(
          bip => bip.motivo_cancelamento === filters.motivo_cancelamento
        );
        console.log('📊 Rankings - Bips após filtro de motivo:', cancelledBips.length);
      }

      console.log('📊 Rankings - Bips finais:', cancelledBips);

      setBipages(cancelledBips);
    } catch (error) {
      console.error('Erro ao buscar cancelamentos:', error);
      if (error.response?.status === 401) {
        logout();
      }
    } finally {
      setLoading(false);
    }
  };

  // Carregar dados iniciais
  useEffect(() => {
    loadSectors();
    loadEmployees();
    fetchCancelledBipages();
  }, []);

  // Aplicar filtros
  const handleFilterChange = (newFilters) => {
    setFilters(newFilters);
  };

  const applyFilters = () => {
    fetchCancelledBipages();
  };

  // Calcular estatísticas
  const cancelledBips = bipages;

  // Ranking por Motivos
  const motivosStats = cancelledBips.reduce((acc, bip) => {
    if (!bip.motivo_cancelamento) return acc;

    const motivo = bip.motivo_cancelamento;
    if (!acc[motivo]) {
      acc[motivo] = {
        motivo,
        icon: MOTIVOS_ICONS[motivo] || '❓',
        label: MOTIVOS_LABELS[motivo] || motivo,
        count: 0,
        totalValue: 0
      };
    }

    acc[motivo].count++;
    acc[motivo].totalValue += bip.bip_price_cents || 0;

    return acc;
  }, {});

  const motivosRanking = Object.values(motivosStats).sort((a, b) => b.count - a.count);

  // Ranking por Funcionários Responsáveis
  const funcionariosStats = cancelledBips.reduce((acc, bip) => {
    if (!bip.employee_responsavel) return acc;

    const employeeId = bip.employee_responsavel.id;
    if (!acc[employeeId]) {
      acc[employeeId] = {
        employee: bip.employee_responsavel,
        count: 0,
        totalValue: 0,
        motivos: {}
      };
    }

    acc[employeeId].count++;
    acc[employeeId].totalValue += bip.bip_price_cents || 0;

    const motivo = bip.motivo_cancelamento;
    if (motivo) {
      if (!acc[employeeId].motivos[motivo]) {
        acc[employeeId].motivos[motivo] = 0;
      }
      acc[employeeId].motivos[motivo]++;
    }

    return acc;
  }, {});

  const funcionariosRanking = Object.values(funcionariosStats).sort((a, b) => b.count - a.count);

  // Ranking por Setores
  const setoresStats = cancelledBips.reduce((acc, bip) => {
    if (!bip.equipment?.sector) return acc;

    const sectorId = bip.equipment.sector.id;
    if (!acc[sectorId]) {
      acc[sectorId] = {
        sector: bip.equipment.sector,
        count: 0,
        totalValue: 0,
        motivos: {}
      };
    }

    acc[sectorId].count++;
    acc[sectorId].totalValue += bip.bip_price_cents || 0;

    const motivo = bip.motivo_cancelamento;
    if (motivo) {
      if (!acc[sectorId].motivos[motivo]) {
        acc[sectorId].motivos[motivo] = 0;
      }
      acc[sectorId].motivos[motivo]++;
    }

    return acc;
  }, {});

  const setoresRanking = Object.values(setoresStats).sort((a, b) => b.count - a.count);

  // Ranking por Valores
  const valoresRanking = [...motivosRanking].sort((a, b) => b.totalValue - a.totalValue);

  // Função para formatar moeda
  const formatCurrency = (cents) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(cents / 100);
  };

  // Totais
  const totalCancelamentos = cancelledBips.length;
  const totalValorCancelado = cancelledBips.reduce((sum, bip) => sum + (bip.bip_price_cents || 0), 0);

  // Funções para abrir modal de detalhes
  const openMotivoDetails = (motivo) => {
    const filteredBips = cancelledBips.filter(bip => bip.motivo_cancelamento === motivo);
    setDetailsModal({
      isOpen: true,
      title: `Cancelamentos: ${MOTIVOS_LABELS[motivo]}`,
      bipages: filteredBips
    });
  };

  const openFuncionarioMotivoDetails = (employee, motivo) => {
    const filteredBips = cancelledBips.filter(
      bip => bip.employee_responsavel?.id === employee.id && bip.motivo_cancelamento === motivo
    );
    setDetailsModal({
      isOpen: true,
      title: `${employee.name} - ${MOTIVOS_LABELS[motivo]}`,
      bipages: filteredBips
    });
  };

  const openSetorMotivoDetails = (sector, motivo) => {
    const filteredBips = cancelledBips.filter(
      bip => bip.equipment?.sector?.id === sector.id && bip.motivo_cancelamento === motivo
    );
    setDetailsModal({
      isOpen: true,
      title: `${sector.name} - ${MOTIVOS_LABELS[motivo]}`,
      bipages: filteredBips
    });
  };

  const closeDetailsModal = () => {
    setDetailsModal({
      isOpen: false,
      title: '',
      bipages: []
    });
  };

  // Funções para modal de upload de vídeo
  const openVideoUpload = (bip) => {
    setUploadModal({
      isOpen: true,
      bip,
      uploading: false
    });
  };

  const closeVideoUpload = () => {
    setUploadModal({
      isOpen: false,
      bip: null,
      uploading: false
    });
  };

  const handleVideoUpload = async (file) => {
    if (!uploadModal.bip || !file) return;

    setUploadModal(prev => ({ ...prev, uploading: true }));

    try {
      const formData = new FormData();
      formData.append('video', file);

      const response = await api.post(`/bips/${uploadModal.bip.id}/video`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });

      if (response.data.success) {
        alert('✅ Vídeo enviado com sucesso!');

        // Atualizar a lista de bipagens
        await fetchCancelledBipages();

        closeVideoUpload();
      }
    } catch (error) {
      console.error('Erro ao fazer upload do vídeo:', error);
      alert('❌ Erro ao enviar vídeo: ' + (error.response?.data?.error || error.message));
    } finally {
      setUploadModal(prev => ({ ...prev, uploading: false }));
    }
  };

  // Funções para modal de player de vídeo
  const openVideoPlayer = (bip) => {
    setPlayerModal({
      isOpen: true,
      bip
    });
  };

  const closeVideoPlayer = () => {
    setPlayerModal({
      isOpen: false,
      bip: null
    });
  };

  const handleDeleteVideo = async (bip) => {
    const targetBip = bip || playerModal.bip;
    if (!targetBip) return;

    try {
      const response = await api.delete(`/bips/${targetBip.id}/video`);

      if (response.data.success) {
        alert('✅ Vídeo deletado com sucesso!');

        // Atualizar a lista de bipagens
        await fetchCancelledBipages();

        if (playerModal.isOpen) {
          closeVideoPlayer();
        }
      }
    } catch (error) {
      console.error('Erro ao deletar vídeo:', error);
      alert('❌ Erro ao deletar vídeo: ' + (error.response?.data?.error || error.message));
    }
  };

  // Funções para modal de upload de imagem
  const openImageUpload = (bip) => {
    setImageUploadModal({
      isOpen: true,
      bip,
      uploading: false,
      preview: null
    });
  };

  const closeImageUpload = () => {
    setImageUploadModal({
      isOpen: false,
      bip: null,
      uploading: false,
      preview: null
    });
  };

  const handleImageSelect = (file) => {
    if (!file) return;

    // Criar preview da imagem
    const reader = new FileReader();
    reader.onload = (e) => {
      setImageUploadModal(prev => ({ ...prev, preview: e.target.result }));
    };
    reader.readAsDataURL(file);
  };

  const handleImageUpload = async (file) => {
    if (!imageUploadModal.bip || !file) return;

    setImageUploadModal(prev => ({ ...prev, uploading: true }));

    try {
      const formData = new FormData();
      formData.append('image', file);

      const response = await api.post(`/bips/${imageUploadModal.bip.id}/image`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });

      if (response.data.success) {
        alert('✅ Imagem enviada com sucesso!');

        // Atualizar a lista de bipagens
        await fetchCancelledBipages();

        closeImageUpload();
      }
    } catch (error) {
      console.error('Erro ao fazer upload da imagem:', error);
      alert('❌ Erro ao enviar imagem: ' + (error.response?.data?.error || error.message));
    } finally {
      setImageUploadModal(prev => ({ ...prev, uploading: false }));
    }
  };

  // Funções para modal de visualização de imagem
  const openImageViewer = (bip) => {
    if (!bip || !bip.image_url) {
      console.error('❌ Bip inválido ou sem imagem:', bip);
      return;
    }

    setImageViewerModal({
      isOpen: true,
      bip: bip
    });
  };

  const closeImageViewer = () => {
    setImageViewerModal({
      isOpen: false,
      bip: null
    });
    setImageZoom(100); // Reset zoom
  };

  const handleZoomIn = () => {
    setImageZoom(prev => Math.min(prev + 25, 200)); // Max 200%
  };

  const handleZoomOut = () => {
    setImageZoom(prev => Math.max(prev - 25, 50)); // Min 50%
  };

  const handleZoomReset = () => {
    setImageZoom(100);
  };

  const handleDeleteImage = async (bip) => {
    const targetBip = bip || imageViewerModal.bip;
    if (!targetBip) return;

    try {
      const response = await api.delete(`/bips/${targetBip.id}/image`);

      if (response.data.success) {
        alert('✅ Imagem deletada com sucesso!');

        // Atualizar a lista de bipagens
        await fetchCancelledBipages();

        if (imageViewerModal.isOpen) {
          closeImageViewer();
        }
      }
    } catch (error) {
      console.error('Erro ao deletar imagem:', error);
      alert('❌ Erro ao deletar imagem: ' + (error.response?.data?.error || error.message));
    }
  };

  return (
    <div className="h-screen bg-gray-100 flex overflow-hidden">
      <Sidebar
        user={user}
        currentPage="rankings"
        isMobileMenuOpen={isMobileMenuOpen}
        setIsMobileMenuOpen={setIsMobileMenuOpen}
      />

      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Mobile menu button */}
        <div className="lg:hidden bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between">
          <h1 className="text-xl font-bold text-gray-900">Rankings</h1>
          <button
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="text-gray-500 hover:text-gray-700"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
        </div>

        <main className="p-4 lg:p-8 overflow-y-auto">
          {/* Cabeçalho */}
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">🏆 Rankings de Cancelamentos</h1>
            <p className="text-gray-600">
              Análise detalhada dos cancelamentos por motivo, valor, funcionário e setor
            </p>
          </div>

          {/* Cards de Resumo */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
            <div className="bg-gradient-to-br from-orange-500 to-orange-600 rounded-lg shadow-lg p-6 text-white">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-orange-100 text-sm font-medium mb-1">Total de Cancelamentos</p>
                  <p className="text-4xl font-bold">{totalCancelamentos}</p>
                </div>
                <div className="bg-white bg-opacity-20 rounded-full p-4">
                  <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </div>
              </div>
            </div>

            <div className="bg-gradient-to-br from-red-500 to-red-600 rounded-lg shadow-lg p-6 text-white">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-red-100 text-sm font-medium mb-1">Valor Total Cancelado</p>
                  <p className="text-4xl font-bold">{formatCurrency(totalValorCancelado)}</p>
                </div>
                <div className="bg-white bg-opacity-20 rounded-full p-4">
                  <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
              </div>
            </div>
          </div>

          {/* Cards Individuais por Tipo de Cancelamento */}
          <div className="mb-8">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Cancelamentos por Tipo</h2>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
              {Object.entries(MOTIVOS_LABELS).map(([motivo, label]) => {
                const motivoData = motivosStats[motivo] || {
                  motivo,
                  icon: MOTIVOS_ICONS[motivo],
                  label,
                  count: 0,
                  totalValue: 0
                };

                return (
                  <div
                    key={motivo}
                    onClick={() => motivoData.count > 0 && openMotivoDetails(motivo)}
                    className={`bg-white rounded-lg shadow-md p-4 transition-all border-2 border-gray-100 relative group ${
                      motivoData.count > 0
                        ? 'cursor-pointer hover:shadow-lg hover:border-orange-300'
                        : 'opacity-60'
                    }`}
                    title={MOTIVOS_DESCRIPTIONS[motivo]}
                  >
                    {/* Ícone de informação no canto superior direito */}
                    <div className="absolute top-2 right-2 text-gray-400 group-hover:text-orange-500 transition-colors">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>

                    <div className="text-center">
                      <div className="text-4xl mb-2">{motivoData.icon}</div>
                      <p className="text-xs font-medium text-gray-600 mb-2 line-clamp-2">
                        {motivoData.label}
                      </p>
                      <p className={`text-2xl font-bold mb-1 ${
                        motivoData.count > 0 ? 'text-orange-600' : 'text-gray-400'
                      }`}>
                        {motivoData.count}
                      </p>
                      <p className={`text-lg font-semibold ${
                        motivoData.count > 0 ? 'text-gray-900' : 'text-gray-400'
                      }`}>
                        {formatCurrency(motivoData.totalValue)}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Filtros */}
          <div className="bg-white rounded-lg shadow p-6 mb-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Filtros</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Data Inicial */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Data inicial
                </label>
                <input
                  type="date"
                  value={filters.date_from}
                  onChange={(e) => handleFilterChange({ ...filters, date_from: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-orange-500 focus:border-orange-500"
                />
              </div>

              {/* Data Final */}
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
                />
              </div>

              {/* Setor */}
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

              {/* Funcionário */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Funcionário Responsável
                </label>
                <select
                  value={filters.employee_id}
                  onChange={(e) => handleFilterChange({ ...filters, employee_id: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-orange-500 focus:border-orange-500"
                >
                  <option value="">Todos os funcionários</option>
                  {employees.map((employee) => (
                    <option key={employee.id} value={employee.id}>
                      {employee.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Motivo */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Motivo de Cancelamento
                </label>
                <select
                  value={filters.motivo_cancelamento}
                  onChange={(e) => handleFilterChange({ ...filters, motivo_cancelamento: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-orange-500 focus:border-orange-500"
                >
                  <option value="">Todos os motivos</option>
                  {Object.entries(MOTIVOS_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>
                      {MOTIVOS_ICONS[value]} {label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Botão Aplicar */}
              <div className="flex items-end">
                <button
                  onClick={applyFilters}
                  disabled={loading}
                  className="w-full px-4 py-2 bg-orange-600 text-white rounded-md hover:bg-orange-700 focus:ring-4 focus:ring-orange-200 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? 'Carregando...' : 'Aplicar Filtros'}
                </button>
              </div>
            </div>
          </div>

          {/* Abas de Visualização */}
          <div className="bg-white rounded-lg shadow mb-6">
            <div className="border-b border-gray-200">
              <div className="flex flex-wrap gap-2 p-4">
                <button
                  onClick={() => setActiveView('motivos')}
                  className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                    activeView === 'motivos'
                      ? 'bg-orange-500 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  📋 Por Motivo
                </button>
                <button
                  onClick={() => setActiveView('valores')}
                  className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                    activeView === 'valores'
                      ? 'bg-orange-500 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  💰 Por Valor
                </button>
                <button
                  onClick={() => setActiveView('funcionarios')}
                  className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                    activeView === 'funcionarios'
                      ? 'bg-orange-500 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  👥 Por Funcionário
                </button>
                <button
                  onClick={() => setActiveView('setores')}
                  className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                    activeView === 'setores'
                      ? 'bg-orange-500 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  🏢 Por Setor
                </button>
              </div>
            </div>

            {/* Conteúdo dos Rankings */}
            <div className="p-6">
              {loading ? (
                <div className="text-center py-12">
                  <svg className="animate-spin h-10 w-10 text-orange-500 mx-auto" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  <p className="mt-4 text-gray-600">Carregando rankings...</p>
                </div>
              ) : totalCancelamentos === 0 ? (
                <div className="text-center py-12">
                  <p className="text-gray-500 text-lg">Nenhum cancelamento encontrado para os filtros selecionados</p>
                </div>
              ) : (
                <>
                  {/* Ranking por Motivos */}
                  {activeView === 'motivos' && (
                    <div className="space-y-3">
                      {motivosRanking.map((item, index) => (
                        <div
                          key={item.motivo}
                          onClick={() => openMotivoDetails(item.motivo)}
                          className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border border-gray-200 hover:border-orange-300 transition-colors cursor-pointer"
                        >
                          <div className="flex items-center gap-4">
                            <div className="flex items-center justify-center w-10 h-10 rounded-full bg-orange-100 text-orange-600 font-bold">
                              #{index + 1}
                            </div>
                            <span className="text-3xl">{item.icon}</span>
                            <div>
                              <p className="font-semibold text-gray-900">{item.label}</p>
                              <p className="text-sm text-gray-600">
                                Valor total: {formatCurrency(item.totalValue)}
                              </p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="text-2xl font-bold text-orange-600">{item.count}</p>
                            <p className="text-sm text-gray-500">cancelamentos</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Ranking por Valores */}
                  {activeView === 'valores' && (
                    <div className="space-y-3">
                      {valoresRanking.map((item, index) => (
                        <div
                          key={item.motivo}
                          onClick={() => openMotivoDetails(item.motivo)}
                          className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border border-gray-200 hover:border-green-300 transition-colors cursor-pointer"
                        >
                          <div className="flex items-center gap-4">
                            <div className="flex items-center justify-center w-10 h-10 rounded-full bg-green-100 text-green-600 font-bold">
                              #{index + 1}
                            </div>
                            <span className="text-3xl">{item.icon}</span>
                            <div>
                              <p className="font-semibold text-gray-900">{item.label}</p>
                              <p className="text-sm text-gray-600">
                                {item.count} cancelamentos
                              </p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="text-xl font-bold text-green-600">
                              {formatCurrency(item.totalValue)}
                            </p>
                            <p className="text-sm text-gray-500">valor total</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Ranking por Funcionários */}
                  {activeView === 'funcionarios' && (
                    <div className="space-y-3">
                      {funcionariosRanking.length === 0 ? (
                        <p className="text-gray-500 text-center py-8">
                          Nenhum erro de funcionário registrado
                        </p>
                      ) : (
                        funcionariosRanking.map((item, index) => (
                          <div
                            key={item.employee.id}
                            className="p-4 bg-gray-50 rounded-lg border border-gray-200 hover:border-red-300 transition-colors"
                          >
                            <div className="flex items-center justify-between mb-3">
                              <div className="flex items-center gap-4">
                                <div className="flex items-center justify-center w-10 h-10 rounded-full bg-red-100 text-red-600 font-bold">
                                  #{index + 1}
                                </div>
                                {item.employee.avatar ? (
                                  <img
                                    src={item.employee.avatar}
                                    alt={item.employee.name}
                                    className="w-12 h-12 rounded-full object-cover"
                                  />
                                ) : (
                                  <div className="w-12 h-12 rounded-full bg-gray-300 flex items-center justify-center text-white font-semibold">
                                    {item.employee.name.charAt(0).toUpperCase()}
                                  </div>
                                )}
                                <div>
                                  <p className="font-semibold text-gray-900">{item.employee.name}</p>
                                  <p className="text-sm text-gray-600">
                                    Valor total: {formatCurrency(item.totalValue)}
                                  </p>
                                </div>
                              </div>
                              <div className="text-right">
                                <p className="text-2xl font-bold text-red-600">{item.count}</p>
                                <p className="text-sm text-gray-500">erros</p>
                              </div>
                            </div>
                            <div className="flex flex-wrap gap-2 ml-14">
                              {Object.entries(item.motivos).map(([motivo, count]) => (
                                <button
                                  key={motivo}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    openFuncionarioMotivoDetails(item.employee, motivo);
                                  }}
                                  className="px-2 py-1 bg-white border border-gray-300 rounded-md text-xs text-gray-700 hover:bg-orange-50 hover:border-orange-400 transition-colors cursor-pointer"
                                >
                                  {MOTIVOS_ICONS[motivo]} {MOTIVOS_LABELS[motivo]}: {count}
                                </button>
                              ))}
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  )}

                  {/* Ranking por Setores */}
                  {activeView === 'setores' && (
                    <div className="space-y-3">
                      {setoresRanking.length === 0 ? (
                        <p className="text-gray-500 text-center py-8">
                          Nenhum cancelamento por setor registrado
                        </p>
                      ) : (
                        setoresRanking.map((item, index) => (
                          <div
                            key={item.sector.id}
                            className="p-4 bg-gray-50 rounded-lg border border-gray-200 hover:border-blue-300 transition-colors"
                          >
                            <div className="flex items-center justify-between mb-3">
                              <div className="flex items-center gap-4">
                                <div className="flex items-center justify-center w-10 h-10 rounded-full bg-blue-100 text-blue-600 font-bold">
                                  #{index + 1}
                                </div>
                                <div>
                                  <p className="font-semibold text-gray-900">{item.sector.name}</p>
                                  <p className="text-sm text-gray-600">
                                    Valor total: {formatCurrency(item.totalValue)}
                                  </p>
                                </div>
                              </div>
                              <div className="text-right">
                                <p className="text-2xl font-bold text-blue-600">{item.count}</p>
                                <p className="text-sm text-gray-500">cancelamentos</p>
                              </div>
                            </div>
                            <div className="flex flex-wrap gap-2 ml-14">
                              {Object.entries(item.motivos).map(([motivo, count]) => (
                                <button
                                  key={motivo}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    openSetorMotivoDetails(item.sector, motivo);
                                  }}
                                  className="px-2 py-1 bg-white border border-gray-300 rounded-md text-xs text-gray-700 hover:bg-orange-50 hover:border-orange-400 transition-colors cursor-pointer"
                                >
                                  {MOTIVOS_ICONS[motivo]} {MOTIVOS_LABELS[motivo]}: {count}
                                </button>
                              ))}
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </main>
      </div>

      {/* Modal de Detalhes */}
      {detailsModal.isOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-6xl w-full max-h-[90vh] overflow-hidden flex flex-col">
            {/* Header */}
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between bg-gray-50">
              <h3 className="text-xl font-semibold text-gray-900">{detailsModal.title}</h3>
              <button
                onClick={closeDetailsModal}
                className="text-gray-500 hover:text-gray-700 transition-colors"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Body - Scrollable */}
            <div className="flex-1 overflow-y-auto p-6">
              <p className="text-sm text-gray-600 mb-4">
                Total: {detailsModal.bipages.length} cancelamento(s)
              </p>

              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50 sticky top-0">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Vendedor</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Bipagem</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Produto</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Data/Hora</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Preço</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Peso</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Setor</th>
                      <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Foto</th>
                      <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Vídeo</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {detailsModal.bipages.map((bip) => (
                      <tr key={bip.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 whitespace-nowrap">
                          <div className="flex items-center">
                            <div className="text-sm font-medium text-gray-900">
                              {bip.employee?.name || '-'}
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                          {bip.ean}
                        </td>
                        <td className="px-4 py-3">
                          <div className="text-sm text-gray-900">{bip.product_description}</div>
                          <div className="text-xs text-gray-500">ID: {bip.product_id}</div>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                          {new Date(bip.event_date).toLocaleString('pt-BR')}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900">
                          {formatCurrency(bip.bip_price_cents)}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                          {bip.bip_weight ? `${parseFloat(bip.bip_weight).toFixed(3)} kg` : '-'}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <span className="px-2 py-1 text-xs font-medium rounded-full bg-blue-100 text-blue-800">
                            {bip.equipment?.sector?.name || '-'}
                          </span>
                        </td>
                        {/* Coluna FOTO */}
                        <td className="px-4 py-3 whitespace-nowrap text-center">
                          {bip.image_url ? (
                            <div className="flex items-center justify-center gap-2">
                              <div className="relative group">
                                <img
                                  src={
                                    bip.image_url.startsWith('http')
                                      ? bip.image_url
                                      : `http://10.6.1.171:3001/uploads/images/${bip.image_url}`
                                  }
                                  alt="Foto da bipagem"
                                  onClick={() => openImageViewer(bip)}
                                  className="w-10 h-10 object-cover rounded cursor-pointer hover:opacity-80 transition-opacity border-2 border-gray-300"
                                  title="Clique para ampliar"
                                />
                                <button
                                  onClick={() => openImageViewer(bip)}
                                  className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-0 hover:bg-opacity-40 transition-all rounded opacity-0 group-hover:opacity-100"
                                  title="Ampliar foto"
                                >
                                  <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7" />
                                  </svg>
                                </button>
                              </div>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (confirm('Deletar esta foto?')) {
                                    handleDeleteImage(bip);
                                  }
                                }}
                                className="p-1 bg-red-500 hover:bg-red-600 text-white rounded transition-colors"
                                title="Deletar foto"
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                </svg>
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => openImageUpload(bip)}
                              className="inline-flex items-center gap-1 px-3 py-1.5 bg-blue-500 hover:bg-blue-600 text-white text-xs rounded-md transition-colors"
                              title="Adicionar foto"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                              </svg>
                              Adicionar
                            </button>
                          )}
                        </td>
                        {/* Coluna VÍDEO */}
                        <td className="px-4 py-3 whitespace-nowrap text-center">
                          {bip.video_url ? (
                            <div className="flex items-center justify-center gap-2">
                              <button
                                onClick={() => openVideoPlayer(bip)}
                                className="inline-flex items-center justify-center w-10 h-10 bg-red-500 hover:bg-red-600 text-white rounded-full transition-colors"
                                title="Reproduzir vídeo"
                              >
                                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                                  <path d="M6.3 2.841A1.5 1.5 0 004 4.11V15.89a1.5 1.5 0 002.3 1.269l9.344-5.89a1.5 1.5 0 000-2.538L6.3 2.84z" />
                                </svg>
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (confirm('Deletar este vídeo?')) {
                                    handleDeleteVideo(bip);
                                  }
                                }}
                                className="p-1 bg-red-500 hover:bg-red-600 text-white rounded transition-colors"
                                title="Deletar vídeo"
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                </svg>
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => openVideoUpload(bip)}
                              className="inline-flex items-center gap-1 px-3 py-1.5 bg-orange-500 hover:bg-orange-600 text-white text-xs rounded-md transition-colors"
                              title="Adicionar vídeo"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                              </svg>
                              Adicionar
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Footer */}
            <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 flex justify-end">
              <button
                onClick={closeDetailsModal}
                className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 transition-colors"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Upload de Vídeo */}
      {uploadModal.isOpen && uploadModal.bip && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
            <div className="px-6 py-4 border-b border-gray-200">
              <h3 className="text-xl font-semibold text-gray-900">Adicionar Vídeo</h3>
              <p className="text-sm text-gray-600 mt-1">
                Bipagem #{uploadModal.bip.id} - {uploadModal.bip.product_description}
              </p>
            </div>

            <div className="p-6">
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
                <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                </svg>
                <p className="mt-2 text-sm text-gray-600">
                  Selecione um arquivo de vídeo
                </p>
                <p className="mt-1 text-xs text-gray-500">
                  MP4, MPEG, MOV, AVI, WMV (máx. 500MB)
                </p>
                <input
                  type="file"
                  accept="video/*"
                  onChange={(e) => {
                    if (e.target.files && e.target.files[0]) {
                      handleVideoUpload(e.target.files[0]);
                    }
                  }}
                  disabled={uploadModal.uploading}
                  className="mt-4 block w-full text-sm text-gray-500
                    file:mr-4 file:py-2 file:px-4
                    file:rounded-md file:border-0
                    file:text-sm file:font-semibold
                    file:bg-orange-50 file:text-orange-700
                    hover:file:bg-orange-100
                    disabled:opacity-50 disabled:cursor-not-allowed"
                />
              </div>

              {uploadModal.uploading && (
                <div className="mt-4 flex items-center justify-center gap-2 text-orange-600">
                  <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  <span>Enviando vídeo...</span>
                </div>
              )}
            </div>

            <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 flex justify-end">
              <button
                onClick={closeVideoUpload}
                disabled={uploadModal.uploading}
                className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Player de Vídeo */}
      {playerModal.isOpen && playerModal.bip && (
        <div className="fixed inset-0 bg-black bg-opacity-90 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between bg-gray-50">
              <div>
                <h3 className="text-xl font-semibold text-gray-900">Vídeo da Bipagem</h3>
                <p className="text-sm text-gray-600 mt-1">
                  #{playerModal.bip.id} - {playerModal.bip.product_description}
                </p>
              </div>
              <button
                onClick={closeVideoPlayer}
                className="text-gray-500 hover:text-gray-700 transition-colors"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="flex-1 bg-black flex items-center justify-center p-4">
              <video
                controls
                autoPlay
                className="max-w-full max-h-full"
                src={
                  playerModal.bip.video_url.startsWith('http')
                    ? playerModal.bip.video_url
                    : `http://10.6.1.171:3001/uploads/videos/${playerModal.bip.video_url}`
                }
              >
                Seu navegador não suporta a tag de vídeo.
              </video>
            </div>

            <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 flex justify-between">
              <button
                onClick={handleDeleteVideo}
                className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors"
              >
                🗑️ Deletar Vídeo
              </button>
              <button
                onClick={closeVideoPlayer}
                className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 transition-colors"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Upload de Imagem */}
      {imageUploadModal.isOpen && imageUploadModal.bip && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
            <div className="px-6 py-4 border-b border-gray-200">
              <h3 className="text-xl font-semibold text-gray-900">Adicionar Foto</h3>
              <p className="text-sm text-gray-600 mt-1">
                Bipagem #{imageUploadModal.bip.id} - {imageUploadModal.bip.product_description}
              </p>
            </div>

            <div className="p-6">
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
                {imageUploadModal.preview ? (
                  <div className="space-y-4">
                    <img
                      src={imageUploadModal.preview}
                      alt="Preview"
                      className="max-w-full max-h-64 mx-auto rounded border-2 border-blue-300"
                    />
                    <p className="text-sm text-green-600 font-medium">✓ Imagem pronta para enviar</p>
                  </div>
                ) : (
                  <>
                    <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    <p className="mt-2 text-sm text-gray-600">
                      Selecione uma imagem
                    </p>
                    <p className="mt-1 text-xs text-gray-500">
                      JPG, PNG, GIF, WebP (máx. 10MB)
                    </p>
                  </>
                )}
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => {
                    if (e.target.files && e.target.files[0]) {
                      handleImageSelect(e.target.files[0]);
                    }
                  }}
                  disabled={imageUploadModal.uploading}
                  className="mt-4 block w-full text-sm text-gray-500
                    file:mr-4 file:py-2 file:px-4
                    file:rounded-md file:border-0
                    file:text-sm file:font-semibold
                    file:bg-blue-50 file:text-blue-700
                    hover:file:bg-blue-100
                    disabled:opacity-50 disabled:cursor-not-allowed"
                />
              </div>

              {imageUploadModal.uploading && (
                <div className="mt-4 flex items-center justify-center gap-2 text-blue-600">
                  <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  <span>Enviando imagem...</span>
                </div>
              )}
            </div>

            <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 flex justify-end gap-2">
              <button
                onClick={closeImageUpload}
                disabled={imageUploadModal.uploading}
                className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Cancelar
              </button>
              {imageUploadModal.preview && (
                <button
                  onClick={async (e) => {
                    const fileInput = e.currentTarget.parentElement.parentElement.querySelector('input[type="file"]');
                    if (fileInput && fileInput.files && fileInput.files[0]) {
                      await handleImageUpload(fileInput.files[0]);
                    }
                  }}
                  disabled={imageUploadModal.uploading}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Enviar
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal de Visualização de Imagem com Zoom */}
      {imageViewerModal.isOpen && imageViewerModal.bip && (
        <div
          className="fixed inset-0 bg-black bg-opacity-95 flex items-center justify-center"
          style={{ zIndex: 9999 }}
          onClick={closeImageViewer}
        >
          <div
            className="w-full h-full flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header com controles de zoom */}
            <div className="px-6 py-3 bg-gray-900 bg-opacity-90 flex items-center justify-between text-white">
              <div>
                <h3 className="text-lg font-semibold">Foto da Bipagem</h3>
                <p className="text-sm text-gray-300">
                  #{imageViewerModal.bip.id} - {imageViewerModal.bip.product_description}
                </p>
              </div>

              {/* Controles de Zoom */}
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2 bg-gray-800 rounded-lg px-3 py-2">
                  <button
                    onClick={handleZoomOut}
                    disabled={imageZoom <= 50}
                    className="text-white hover:text-blue-400 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                    title="Diminuir zoom"
                  >
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM13 10H7" />
                    </svg>
                  </button>

                  <button
                    onClick={handleZoomReset}
                    className="text-white hover:text-blue-400 transition-colors text-sm font-mono px-2"
                    title="Resetar zoom (100%)"
                  >
                    {imageZoom}%
                  </button>

                  <button
                    onClick={handleZoomIn}
                    disabled={imageZoom >= 200}
                    className="text-white hover:text-blue-400 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                    title="Aumentar zoom"
                  >
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7" />
                    </svg>
                  </button>
                </div>

                <button
                  onClick={closeImageViewer}
                  className="text-white hover:text-gray-300 transition-colors p-2"
                >
                  <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Imagem com zoom ajustável */}
            <div className="flex-1 bg-black flex items-center justify-center p-4 overflow-auto">
              <img
                src={
                  imageViewerModal.bip.image_url.startsWith('http')
                    ? imageViewerModal.bip.image_url
                    : `http://10.6.1.171:3001/uploads/images/${imageViewerModal.bip.image_url}`
                }
                alt="Foto da bipagem"
                className="object-contain transition-all duration-200"
                style={{
                  width: `${imageZoom}%`,
                  height: 'auto',
                  maxHeight: `calc((100vh - 140px) * ${imageZoom / 100})`
                }}
              />
            </div>

            {/* Footer */}
            <div className="px-6 py-3 bg-gray-900 bg-opacity-90 flex justify-between">
              <button
                onClick={() => {
                  if (confirm('Tem certeza que deseja deletar esta foto?')) {
                    handleDeleteImage(imageViewerModal.bip);
                    closeImageViewer();
                  }
                }}
                className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors"
              >
                🗑️ Deletar Foto
              </button>
              <button
                onClick={closeImageViewer}
                className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 transition-colors"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
