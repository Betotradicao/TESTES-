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

const MOTIVOS_TOOLTIPS = {
  devolucao_mercadoria: {
    emoji: '✅',
    color: 'from-green-500 to-green-600',
    title: 'Cancelamento de Bipagem',
    description: 'O balconista fez corretamente a operação de cancelamento.',
    example: 'Cliente pediu 500g de queijo, balconista bipou 600g por engano e cancelou corretamente.',
    status: 'Operação correta'
  },
  produto_abandonado: {
    emoji: '📦',
    color: 'from-yellow-500 to-yellow-600',
    title: 'Produto Abandonado',
    description: 'Produto retirado no balcão mas esquecido ou descartado pelo cliente na loja.',
    example: 'Cliente pegou 1kg de carne, andou pela loja e deixou na prateleira de biscoitos.',
    status: 'Perda potencial'
  },
  falta_cancelamento: {
    emoji: '⚠️',
    color: 'from-orange-500 to-orange-600',
    title: 'Falta de Cancelamento',
    description: 'Balconista bipou duas vezes mas esqueceu de cancelar a primeira bipagem.',
    example: 'Cliente pediu 300g, balconista bipou 400g, refez com 300g mas não cancelou os 400g.',
    status: 'Erro do balconista'
  },
  erro_operador: {
    emoji: '🖥️',
    color: 'from-red-500 to-red-600',
    title: 'Erro do Operador',
    description: 'Por algum motivo o operador de caixa não registrou o produto.',
    example: 'Cliente levou 2kg de picanha mas operador passou apenas 1kg no caixa.',
    status: 'Possível fraude'
  },
  erro_balconista: {
    emoji: '🏷️',
    color: 'from-purple-500 to-purple-600',
    title: 'Erro do Balconista',
    description: 'Cliente recebeu mercadoria com código errado. Balconista esqueceu de cancelar etiqueta ao trocar.',
    example: 'Cliente pediu filé mignon, recebeu etiqueta de acém. Balconista trocou mas não cancelou.',
    status: 'Erro de etiqueta'
  },
  furto: {
    emoji: '🚨',
    color: 'from-gray-700 to-gray-900',
    title: 'Furto',
    description: 'Furto cometido pela pessoa que retirou a mercadoria no balcão.',
    example: 'Pessoa retirou mercadoria no balcão e saiu da loja sem passar no caixa.',
    status: 'Ação criminal'
  }
};

// Componente de Tooltip Moderno
const ModernTooltip = ({ motivo, children }) => {
  const [isVisible, setIsVisible] = useState(false);
  const tooltip = MOTIVOS_TOOLTIPS[motivo];

  if (!tooltip) return children;

  return (
    <div className="relative inline-block">
      <div
        onMouseEnter={() => setIsVisible(true)}
        onMouseLeave={() => setIsVisible(false)}
        onClick={(e) => {
          e.stopPropagation();
          setIsVisible(!isVisible);
        }}
      >
        {children}
      </div>

      {isVisible && (
        <div className="absolute z-50 bottom-full left-1/2 transform -translate-x-1/2 mb-2 w-72 pointer-events-none">
          <div className={`bg-gradient-to-br ${tooltip.color} rounded-xl shadow-2xl p-4 text-white`}>
            {/* Header */}
            <div className="flex items-center gap-2 mb-3 border-b border-white/20 pb-2">
              <span className="text-2xl">{tooltip.emoji}</span>
              <span className="font-bold text-lg">{tooltip.title}</span>
            </div>

            {/* Descrição */}
            <p className="text-sm text-white/90 mb-3">
              {tooltip.description}
            </p>

            {/* Exemplo */}
            <div className="bg-white/10 rounded-lg p-2 mb-2">
              <p className="text-xs font-semibold text-white/70 mb-1">💡 Exemplo:</p>
              <p className="text-xs text-white/90 italic">
                "{tooltip.example}"
              </p>
            </div>

            {/* Status */}
            <div className="flex items-center justify-end">
              <span className="text-xs bg-white/20 px-2 py-1 rounded-full">
                {tooltip.status}
              </span>
            </div>
          </div>

          {/* Seta */}
          <div className={`absolute left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-8 border-r-8 border-t-8 border-transparent`}
               style={{ borderTopColor: tooltip.color.includes('green') ? '#22c55e' :
                        tooltip.color.includes('yellow') ? '#eab308' :
                        tooltip.color.includes('orange') ? '#f97316' :
                        tooltip.color.includes('red') ? '#ef4444' :
                        tooltip.color.includes('purple') ? '#a855f7' : '#374151' }}>
          </div>
        </div>
      )}
    </div>
  );
};

export default function Rankings() {
  const { user, logout } = useAuth();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [bipages, setBipages] = useState([]);
  const [pendingBipages, setPendingBipages] = useState([]); // Bipagens pendentes
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

  // Estado do modal de identificação de suspect
  const [identificationModal, setIdentificationModal] = useState({
    isOpen: false,
    bip: null,
    creating: false,
    nextNumber: null,
    mode: 'new', // 'new' ou 'existing'
    selectedExisting: '',
    existingIdentifications: []
  });

  // Filtros específicos para rankings - padrão: Dia 1 do mês até dia atual
  const getTodayDate = () => {
    return new Date().toISOString().split('T')[0];
  };

  const getFirstDayOfMonth = () => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
  };

  const [filters, setFilters] = useState({
    date_from: getFirstDayOfMonth(), // Dia 1 do mês atual
    date_to: getTodayDate(), // Dia atual
    sector_id: '',
    employee_id: '',
    motivo_cancelamento: '',
    identification_number: ''
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
        limit: 1000, // Buscar mais para ter contagem correta nos cards
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

      // Filtrar por identificação se selecionado
      if (filters.identification_number) {
        cancelledBips = cancelledBips.filter(
          bip => bip.suspect_identification?.identification_number === filters.identification_number
        );
        console.log('📊 Rankings - Bips após filtro de identificação:', cancelledBips.length);
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

  // Buscar bipagens pendentes (para o card "Total de Bipagens Pendentes")
  const fetchPendingBipages = async () => {
    try {
      const params = {
        page: 1,
        limit: 1000, // Buscar mais para ter contagem correta
        status: 'pending',
        date_from: filters.date_from,
        date_to: filters.date_to
      };

      // Filtros opcionais
      if (filters.sector_id) params.sector_id = filters.sector_id;
      if (filters.employee_id) params.employee_id = filters.employee_id;

      const response = await api.get('/bips', { params });
      setPendingBipages(response.data.data || []);
    } catch (error) {
      console.error('Erro ao buscar bipagens pendentes:', error);
    }
  };

  // Carregar dados iniciais
  useEffect(() => {
    loadSectors();
    loadEmployees();
    fetchCancelledBipages();
    fetchPendingBipages();
  }, []);

  // Aplicar filtros
  const handleFilterChange = (newFilters) => {
    setFilters(newFilters);
  };

  const applyFilters = () => {
    fetchCancelledBipages();
    fetchPendingBipages();
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
  const totalBipagensPendentes = pendingBipages.length;

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
    if (!targetBip) {
      console.error('❌ targetBip is null/undefined');
      return;
    }

    if (!targetBip.id) {
      console.error('❌ targetBip.id is undefined:', targetBip);
      alert('Erro: ID da bipagem não encontrado');
      return;
    }

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

  // Funções para modal de identificação de suspeito
  const openIdentificationModal = async (bip) => {
    try {
      // Buscar o próximo número disponível e todas as identificações existentes
      const [nextNumberResponse, existingResponse] = await Promise.all([
        api.get('/suspect-identifications/next-number'),
        api.get('/suspect-identifications')
      ]);

      setIdentificationModal({
        isOpen: true,
        bip,
        creating: false,
        nextNumber: nextNumberResponse.data.nextNumber,
        mode: 'new',
        selectedExisting: '',
        existingIdentifications: existingResponse.data || []
      });
    } catch (error) {
      console.error('Erro ao buscar próximo número:', error);
      alert('❌ Erro ao abrir modal de identificação');
    }
  };

  const closeIdentificationModal = () => {
    setIdentificationModal({
      isOpen: false,
      bip: null,
      creating: false,
      nextNumber: null,
      mode: 'new',
      selectedExisting: '',
      existingIdentifications: []
    });
  };

  const handleCreateIdentification = async () => {
    try {
      setIdentificationModal(prev => ({ ...prev, creating: true }));

      let identification;

      if (identificationModal.mode === 'new') {
        // Criar nova identificação
        const response = await api.post('/suspect-identifications', {
          identification_number: identificationModal.nextNumber,
          bip_id: identificationModal.bip.id,
          notes: ''
        });
        identification = response.data;
        alert(`✅ Identificação #${identification.identification_number} criada com sucesso!`);
      } else {
        // Vincular a identificação existente
        if (!identificationModal.selectedExisting) {
          alert('⚠️ Por favor, selecione uma identificação');
          return;
        }

        const response = await api.post('/suspect-identifications', {
          identification_number: identificationModal.selectedExisting,
          bip_id: identificationModal.bip.id,
          notes: ''
        });
        identification = response.data;
        alert(`✅ Cancelamento vinculado à identificação #${identification.identification_number}!`);
      }

      // Atualizar a lista de bipagens no modal de detalhes
      setDetailsModal(prev => ({
        ...prev,
        bipages: prev.bipages.map(b =>
          b.id === identificationModal.bip.id
            ? { ...b, suspect_identification: identification }
            : b
        )
      }));

      // Recarregar as bipagens para atualizar a tabela principal
      await fetchCancelledBipages();

      closeIdentificationModal();
    } catch (error) {
      console.error('Erro ao criar identificação:', error);
      alert('❌ Erro ao criar identificação: ' + (error.response?.data?.error || error.message));
    } finally {
      setIdentificationModal(prev => ({ ...prev, creating: false }));
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
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
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

            <div className="bg-gradient-to-br from-yellow-500 to-yellow-600 rounded-lg shadow-lg p-6 text-white">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-yellow-100 text-sm font-medium mb-1">Bipagens Pendentes</p>
                  <p className="text-4xl font-bold">{totalBipagensPendentes}</p>
                </div>
                <div className="bg-white bg-opacity-20 rounded-full p-4">
                  <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
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
                  >
                    {/* Ícone de informação com Tooltip Moderno */}
                    <div className="absolute top-2 right-2">
                      <ModernTooltip motivo={motivo}>
                        <div className="text-gray-400 hover:text-orange-500 transition-colors cursor-help">
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                        </div>
                      </ModernTooltip>
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

              {/* Identificação */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  🔍 Identificação
                </label>
                <input
                  type="text"
                  value={filters.identification_number}
                  onChange={(e) => handleFilterChange({ ...filters, identification_number: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-orange-500 focus:border-orange-500"
                  placeholder="Ex: 01, 02, 03..."
                />
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
                      <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Identificação</th>
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
                        {/* Coluna IDENTIFICAÇÃO */}
                        <td className="px-4 py-3 whitespace-nowrap text-center">
                          {bip.suspect_identification ? (
                            <div className="flex items-center justify-center gap-2">
                              <span className="px-3 py-1 text-sm font-bold rounded-full bg-red-100 text-red-800 border-2 border-red-300">
                                #{bip.suspect_identification.identification_number}
                              </span>
                            </div>
                          ) : (
                            <button
                              onClick={() => openIdentificationModal(bip)}
                              className="inline-flex items-center justify-center w-8 h-8 bg-orange-500 hover:bg-orange-600 text-white rounded-full transition-colors"
                              title="Adicionar identificação"
                            >
                              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                              </svg>
                            </button>
                          )}
                        </td>
                        {/* Coluna FOTO */}
                        <td className="px-4 py-3 whitespace-nowrap text-center">
                          {bip.image_url ? (
                            <div className="flex items-center justify-center">
                              <div className="relative group">
                                <img
                                  src={
                                    bip.image_url.startsWith('http')
                                      ? bip.image_url
                                      : `http://10.6.1.171:3001/uploads/images/${bip.image_url}`
                                  }
                                  alt="Foto da bipagem"
                                  onClick={() => openImageViewer(bip)}
                                  className="w-12 h-12 object-cover rounded cursor-pointer hover:opacity-80 transition-opacity border-2 border-gray-300"
                                  title="Clique para ampliar"
                                />
                                <button
                                  onClick={() => openImageViewer(bip)}
                                  className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-0 hover:bg-opacity-40 transition-all rounded opacity-0 group-hover:opacity-100"
                                  title="Ampliar foto"
                                >
                                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7" />
                                  </svg>
                                </button>
                              </div>
                            </div>
                          ) : (
                            <button
                              onClick={() => openImageUpload(bip)}
                              className="inline-flex items-center justify-center w-10 h-10 bg-blue-500 hover:bg-blue-600 text-white rounded-full transition-colors"
                              title="Adicionar foto"
                            >
                              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                              </svg>
                            </button>
                          )}
                        </td>
                        {/* Coluna VÍDEO */}
                        <td className="px-4 py-3 whitespace-nowrap text-center">
                          {bip.video_url ? (
                            <div className="flex items-center justify-center">
                              <button
                                onClick={() => openVideoPlayer(bip)}
                                className="inline-flex items-center justify-center w-12 h-12 bg-red-500 hover:bg-red-600 text-white rounded-full transition-colors"
                                title="Reproduzir vídeo"
                              >
                                <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
                                  <path d="M6.3 2.841A1.5 1.5 0 004 4.11V15.89a1.5 1.5 0 002.3 1.269l9.344-5.89a1.5 1.5 0 000-2.538L6.3 2.84z" />
                                </svg>
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => openVideoUpload(bip)}
                              className="inline-flex items-center justify-center w-10 h-10 bg-orange-500 hover:bg-orange-600 text-white rounded-full transition-colors"
                              title="Adicionar vídeo"
                            >
                              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                              </svg>
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
                onClick={() => handleDeleteVideo()}
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

      {/* Modal de Identificação de Suspeito */}
      {identificationModal.isOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">
                🔍 Criar Identificação de Suspeito
              </h3>
              <button
                onClick={closeIdentificationModal}
                className="text-gray-400 hover:text-gray-600"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Body */}
            <div className="p-6">
              {/* Abas para escolher modo */}
              <div className="flex border-b border-gray-200 mb-4">
                <button
                  onClick={() => setIdentificationModal(prev => ({ ...prev, mode: 'new' }))}
                  className={`flex-1 px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                    identificationModal.mode === 'new'
                      ? 'border-red-600 text-red-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700'
                  }`}
                >
                  Criar Novo
                </button>
                <button
                  onClick={() => setIdentificationModal(prev => ({ ...prev, mode: 'existing' }))}
                  className={`flex-1 px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                    identificationModal.mode === 'existing'
                      ? 'border-red-600 text-red-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700'
                  }`}
                >
                  Vincular Existente
                </button>
              </div>

              {/* Conteúdo baseado no modo */}
              {identificationModal.mode === 'new' ? (
                <div className="mb-4">
                  <p className="text-sm text-gray-600 mb-4">
                    Ao criar uma identificação, este suspeito receberá o número:
                  </p>
                  <div className="flex items-center justify-center p-6 bg-red-50 border-2 border-red-200 rounded-lg">
                    <span className="text-5xl font-bold text-red-600">
                      #{identificationModal.nextNumber}
                    </span>
                  </div>
                </div>
              ) : (
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Selecione uma identificação existente:
                  </label>
                  <select
                    value={identificationModal.selectedExisting}
                    onChange={(e) => setIdentificationModal(prev => ({ ...prev, selectedExisting: e.target.value }))}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
                  >
                    <option value="">-- Selecione --</option>
                    {Array.from(new Set(identificationModal.existingIdentifications.map(i => i.identification_number)))
                      .sort()
                      .map(number => (
                        <option key={number} value={number}>
                          #{number} ({identificationModal.existingIdentifications.filter(i => i.identification_number === number).length} cancelamento(s))
                        </option>
                      ))}
                  </select>
                  <p className="text-xs text-gray-500 mt-2">
                    Este cancelamento será vinculado à identificação selecionada
                  </p>
                </div>
              )}

              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4">
                <p className="text-sm text-yellow-800">
                  <strong>⚠️ Atenção:</strong> Esta identificação será vinculada ao cancelamento e poderá ser usada para correlacionar com reconhecimento facial.
                </p>
              </div>

              <div className="bg-gray-50 rounded-lg p-4">
                <h4 className="text-sm font-medium text-gray-700 mb-2">Detalhes do Cancelamento:</h4>
                <div className="text-sm text-gray-600 space-y-1">
                  <p><strong>Produto:</strong> {identificationModal.bip?.product_description}</p>
                  <p><strong>Valor:</strong> {formatCurrency(identificationModal.bip?.bip_price_cents)}</p>
                  <p><strong>Data:</strong> {identificationModal.bip ? new Date(identificationModal.bip.event_date).toLocaleString('pt-BR') : '-'}</p>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="flex gap-3 p-6 border-t border-gray-200">
              <button
                onClick={closeIdentificationModal}
                className="flex-1 px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 transition-colors"
                disabled={identificationModal.creating}
              >
                Cancelar
              </button>
              <button
                onClick={handleCreateIdentification}
                disabled={identificationModal.creating}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {identificationModal.creating ? (
                  <>
                    <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Criando...
                  </>
                ) : (
                  <>
                    {identificationModal.mode === 'new'
                      ? `✓ Criar Identificação #${identificationModal.nextNumber}`
                      : '✓ Vincular Identificação'
                    }
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
