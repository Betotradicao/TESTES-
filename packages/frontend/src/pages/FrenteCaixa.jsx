import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useLoja } from '../contexts/LojaContext';
import Sidebar from '../components/Sidebar';
import { api } from '../utils/api';
import toast from 'react-hot-toast';
import RadarLoading from '../components/RadarLoading';

// Configuração inicial das colunas - Visão GERAL (completa)
const INITIAL_COLUMNS = [
  { id: 'DES_OPERADOR', header: 'Colaborador', align: 'left', sortable: true },
  { id: 'TOTAL_VENDAS', header: 'Total Vendas', align: 'right', sortable: true },
  { id: 'TOTAL_ITENS', header: 'Itens', align: 'right', sortable: true },
  { id: 'TOTAL_CUPONS', header: 'Cupons', align: 'right', sortable: true },
  { id: 'DINHEIRO', header: 'Dinheiro', align: 'right', sortable: true },
  { id: 'CARTAO_DEBITO', header: 'Débito', align: 'right', sortable: true },
  { id: 'CARTAO_CREDITO', header: 'Crédito', align: 'right', sortable: true },
  { id: 'PIX', header: 'PIX', align: 'right', sortable: true },
  { id: 'FUNCIONARIO', header: 'Funcionário', align: 'right', sortable: true },
  { id: 'CARTAO_POS', header: 'Cartão POS', align: 'right', sortable: true },
  { id: 'TRICARD_PARCELADO', header: 'Tricard', align: 'right', sortable: true },
  { id: 'VALE_TROCA', header: 'Vale Troca', align: 'right', sortable: true },
  { id: 'VALE_DESCONTO', header: 'Vale Desc.', align: 'right', sortable: true },
  { id: 'TOTAL_DESCONTOS', header: 'Descontos', align: 'right', sortable: true, highlight: 'yellow' },
  { id: 'PCT_DESCONTO', header: '% Desc.', align: 'right', sortable: true, highlight: 'yellow', calculated: true },
  { id: 'CANCELAMENTOS', header: 'Cancelamentos', align: 'right', sortable: true, highlight: 'red' },
  { id: 'PCT_CANCELAMENTOS', header: '% Cancel.', align: 'right', sortable: true, highlight: 'red', calculated: true },
  { id: 'ESTORNOS_ORFAOS', header: 'Canc. Cupom', align: 'right', sortable: true, highlight: 'orange' },
  { id: 'PCT_ESTORNOS_ORFAOS', header: '% Cupom', align: 'right', sortable: true, highlight: 'orange', calculated: true },
  { id: 'VAL_SOBRA', header: 'Sobra Caixa', align: 'right', sortable: true, highlight: 'green' },
  { id: 'VAL_QUEBRA', header: 'Falta Caixa', align: 'right', sortable: true, highlight: 'red' },
];

// Configuração das colunas - Visão META (simplificada)
const META_COLUMNS = [
  { id: 'DES_OPERADOR', header: 'Colaborador', align: 'left', sortable: true },
  { id: 'AUSENCIA', header: 'Ausência', align: 'center', sortable: false, isAusencia: true },
  { id: 'HORAS_TRABALHADAS', header: 'Horas Trab.', align: 'center', sortable: false, isHoras: true },
  { id: 'TOTAL_VENDAS', header: 'Total Vendas', align: 'center', sortable: true },
  { id: 'META_VENDA', header: 'Meta Venda', align: 'center', sortable: false, isMeta: true },
  { id: 'PCT_CANCELAMENTOS', header: '% Cancelamento', align: 'center', sortable: true, highlight: 'red', calculated: true },
  { id: 'META_CANCELAMENTO', header: 'Meta % Canc.', align: 'center', sortable: false, isMeta: true },
  { id: 'TOTAL_DESCONTOS', header: 'Descontos', align: 'center', sortable: true, highlight: 'yellow' },
  { id: 'META_DESCONTO', header: 'Meta Desc.', align: 'center', sortable: false, isMeta: true },
  { id: 'TOTAL_ITENS', header: 'Itens Vendidos', align: 'center', sortable: true },
  { id: 'PCT_ITENS', header: '% Itens', align: 'center', sortable: true, calculated: true },
  { id: 'TOTAL_CUPONS', header: 'Cupons Vendidos', align: 'center', sortable: true },
  { id: 'CUPONS_POR_HORA', header: 'Cupons/Hora', align: 'center', sortable: true, highlight: 'blue', calculated: true },
  { id: 'PCT_CUPONS', header: '% Cupons', align: 'center', sortable: true, calculated: true },
  { id: 'VAL_SOBRA', header: 'Sobra de Caixa', align: 'center', sortable: true, highlight: 'green' },
  { id: 'META_SOBRA', header: 'Meta Sobra', align: 'center', sortable: false, isMeta: true },
  { id: 'VAL_QUEBRA', header: 'Falta de Caixa', align: 'center', sortable: true, highlight: 'red' },
  { id: 'META_QUEBRA', header: 'Meta Quebra', align: 'center', sortable: false, isMeta: true },
];

// Funções auxiliares de data
function getFirstDayOfMonth() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1);
}

function formatDateForInput(date) {
  const d = new Date(date);
  return d.toISOString().split('T')[0];
}

function formatDateForApi(dateStr) {
  const [year, month, day] = dateStr.split('-');
  return `${day}/${month}/${year}`;
}

export default function FrenteCaixa() {
  const { user, logout } = useAuth();
  const { lojaSelecionada } = useLoja();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState([]);
  const [totais, setTotais] = useState(null);
  const [oracleStatus, setOracleStatus] = useState({ connected: false, message: '' });

  // Estado para alternar entre visão Geral e Meta
  const [viewMode, setViewMode] = useState('geral'); // 'geral' ou 'meta'

  // Estado para modal de configuração de metas
  const [showMetaConfigModal, setShowMetaConfigModal] = useState(false);

  // Configuração de metas por operador
  // Formato: { [codOperador]: { vendaMinima: { enabled: bool, value: number }, descontoMaximo: { enabled: bool, value: number }, pctCancelamentoMax: { enabled: bool, value: number } } }
  const [metaConfig, setMetaConfig] = useState(() => {
    const saved = localStorage.getItem('frente_caixa_meta_config');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        return {};
      }
    }
    return {};
  });

  // Configuração global de metas (aplica a todos que não têm config individual)
  const defaultMetaGlobal = {
    vendaMinima: { enabled: false, value: 0 },
    descontoMaximo: { enabled: false, value: 0 },
    pctCancelamentoMax: { enabled: false, value: 0 },
    sobraMaxima: { enabled: false, value: 0 },
    quebraMaxima: { enabled: false, value: 0 }
  };

  const [metaGlobal, setMetaGlobal] = useState(() => {
    const saved = localStorage.getItem('frente_caixa_meta_global');
    if (saved) {
      try {
        return { ...defaultMetaGlobal, ...JSON.parse(saved) };
      } catch (e) {
        return defaultMetaGlobal;
      }
    }
    return defaultMetaGlobal;
  });

  // Estado para ausência por operador: { [codOperador]: 'positiva' | 'negativa' | null }
  const [ausenciaOperador, setAusenciaOperador] = useState(() => {
    const saved = localStorage.getItem('frente_caixa_ausencia');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        return {};
      }
    }
    return {};
  });

  // Estado para horas trabalhadas por operador: { [codOperador]: 'HH:MM' }
  const [horasTrabalhadas, setHorasTrabalhadas] = useState(() => {
    const saved = localStorage.getItem('frente_caixa_horas');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        return {};
      }
    }
    return {};
  });

  // Estado para minimizar/expandir o Quadro de Destaque
  const [destaqueMinimizado, setDestaqueMinimizado] = useState(() => {
    const saved = localStorage.getItem('frente_caixa_destaque_minimizado');
    return saved === 'true';
  });

  // Função para toggle do destaque
  const toggleDestaque = () => {
    const newValue = !destaqueMinimizado;
    setDestaqueMinimizado(newValue);
    localStorage.setItem('frente_caixa_destaque_minimizado', String(newValue));
  };

  // Estado para ordem das colunas GERAL (drag and drop)
  const [columns, setColumns] = useState(() => {
    const savedOrder = localStorage.getItem('frente_caixa_columns_order');
    if (savedOrder) {
      try {
        const savedIds = JSON.parse(savedOrder);
        const reordered = savedIds
          .map(id => INITIAL_COLUMNS.find(col => col.id === id))
          .filter(Boolean);
        const newColumns = INITIAL_COLUMNS.filter(col => !savedIds.includes(col.id));
        return [...reordered, ...newColumns];
      } catch (e) {
        return INITIAL_COLUMNS;
      }
    }
    return INITIAL_COLUMNS;
  });

  // Estado para ordem das colunas META (drag and drop)
  const [metaColumns, setMetaColumns] = useState(() => {
    const savedOrder = localStorage.getItem('frente_caixa_meta_columns_order');
    if (savedOrder) {
      try {
        const savedIds = JSON.parse(savedOrder);
        const reordered = savedIds
          .map(id => META_COLUMNS.find(col => col.id === id))
          .filter(Boolean);
        const newColumns = META_COLUMNS.filter(col => !savedIds.includes(col.id));
        return [...reordered, ...newColumns];
      } catch (e) {
        return META_COLUMNS;
      }
    }
    return META_COLUMNS;
  });

  const [draggedColumn, setDraggedColumn] = useState(null);
  const [dragOverColumn, setDragOverColumn] = useState(null);

  // Sincronizar ordem das colunas GERAL com localStorage sempre que mudar
  useEffect(() => {
    const columnIds = columns.map(col => col.id);
    localStorage.setItem('frente_caixa_columns_order', JSON.stringify(columnIds));
  }, [columns]);

  // Sincronizar ordem das colunas META com localStorage sempre que mudar
  useEffect(() => {
    const columnIds = metaColumns.map(col => col.id);
    localStorage.setItem('frente_caixa_meta_columns_order', JSON.stringify(columnIds));
  }, [metaColumns]);

  // Estado para ordenação
  const [sortConfig, setSortConfig] = useState({ key: 'TOTAL_VENDAS', direction: 'desc' });

  // Estado para expansão por operador
  const [expandedOperadores, setExpandedOperadores] = useState({});
  const [operadorDetalhe, setOperadorDetalhe] = useState({});
  const [loadingDetalhe, setLoadingDetalhe] = useState({});

  // Estado para expansão por dia (cupons)
  const [expandedDias, setExpandedDias] = useState({});
  const [diaCupons, setDiaCupons] = useState({});
  const [loadingCupons, setLoadingCupons] = useState({});

  // Estado para expansão por cupom (itens)
  const [expandedCupons, setExpandedCupons] = useState({});
  const [cupomItens, setCupomItens] = useState({});
  const [loadingItens, setLoadingItens] = useState({});

  // Filtros
  const [operadores, setOperadores] = useState([]);
  const [loadingFilters, setLoadingFilters] = useState(true);

  const [filters, setFilters] = useState({
    dataInicio: formatDateForInput(getFirstDayOfMonth()),
    dataFim: formatDateForInput(new Date()),
    codOperador: '',
  });

  // Estado para visibilidade das colunas
  const [hiddenColumns, setHiddenColumns] = useState(() => {
    const saved = localStorage.getItem('frente_caixa_hidden_columns');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        return [];
      }
    }
    return [];
  });

  // Estado para mostrar dropdown de configurações
  const [showColumnConfig, setShowColumnConfig] = useState(false);

  // Colunas visíveis (filtrando as ocultas ou usando metaColumns)
  const visibleColumns = useMemo(() => {
    // Se estiver no modo Meta, usar colunas simplificadas (com ordem salva)
    if (viewMode === 'meta') {
      return metaColumns;
    }
    // Modo Geral: usar colunas normais filtrando as ocultas
    return columns.filter(col => !hiddenColumns.includes(col.id));
  }, [columns, metaColumns, hiddenColumns, viewMode]);

  // Toggle visibilidade de coluna
  const toggleColumnVisibility = (columnId) => {
    setHiddenColumns(prev => {
      const newHidden = prev.includes(columnId)
        ? prev.filter(id => id !== columnId)
        : [...prev, columnId];
      localStorage.setItem('frente_caixa_hidden_columns', JSON.stringify(newHidden));
      return newHidden;
    });
  };

  // Fechar dropdown ao clicar fora
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (showColumnConfig && !e.target.closest('.relative')) {
        setShowColumnConfig(false);
      }
    };
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, [showColumnConfig]);

  // Carregar operadores e testar conexão
  useEffect(() => {
    const loadFilters = async () => {
      setLoadingFilters(true);
      try {
        // Testar conexão Oracle
        const statusRes = await api.get('/frente-caixa/test-connection');
        setOracleStatus({
          connected: statusRes.data.success,
          message: statusRes.data.message
        });

        if (statusRes.data.success) {
          // Carregar operadores
          const params = new URLSearchParams();
          if (lojaSelecionada) params.append('codLoja', lojaSelecionada);
          const opRes = await api.get(`/frente-caixa/operadores?${params.toString()}`);
          setOperadores(opRes.data || []);
        }
      } catch (error) {
        console.error('Erro ao carregar filtros:', error);
        setOracleStatus({ connected: false, message: 'Erro de conexão' });
      } finally {
        setLoadingFilters(false);
      }
    };

    loadFilters();
  }, [lojaSelecionada]);

  // Buscar dados
  const handleSearch = async () => {
    if (!oracleStatus.connected) {
      toast.error('Sem conexão com Oracle');
      return;
    }

    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.append('dataInicio', formatDateForApi(filters.dataInicio));
      params.append('dataFim', formatDateForApi(filters.dataFim));
      if (filters.codOperador) params.append('codOperador', filters.codOperador);
      if (lojaSelecionada) params.append('codLoja', lojaSelecionada);

      const [resumoRes, totaisRes] = await Promise.all([
        api.get(`/frente-caixa/resumo?${params.toString()}`),
        api.get(`/frente-caixa/totais?${params.toString()}`)
      ]);

      if (resumoRes.data.success) {
        setData(resumoRes.data.data);
      }
      if (totaisRes.data.success) {
        setTotais(totaisRes.data.totais);
      }

      // Limpar expansões
      setExpandedOperadores({});
      setOperadorDetalhe({});
      setExpandedDias({});
      setDiaCupons({});
      setExpandedCupons({});
      setCupomItens({});
    } catch (error) {
      console.error('Erro ao buscar dados:', error);
      toast.error('Erro ao buscar dados');
    } finally {
      setLoading(false);
    }
  };

  // Toggle expansão de operador -> mostra dias
  const toggleOperador = async (codOperador) => {
    const key = String(codOperador);
    const isExpanded = expandedOperadores[key];
    console.log('🔍 [FrenteCaixa] toggleOperador chamado:', { codOperador, key, isExpanded });

    if (isExpanded) {
      setExpandedOperadores(prev => ({ ...prev, [key]: false }));
    } else {
      if (!operadorDetalhe[key]) {
        setLoadingDetalhe(prev => ({ ...prev, [key]: true }));
        try {
          const params = new URLSearchParams();
          params.append('dataInicio', formatDateForApi(filters.dataInicio));
          params.append('dataFim', formatDateForApi(filters.dataFim));
          params.append('codOperador', key);
          if (lojaSelecionada) params.append('codLoja', lojaSelecionada);

          console.log('📡 [FrenteCaixa] Buscando detalhe por dia:', `/frente-caixa/detalhe-dia?${params.toString()}`);
          const response = await api.get(`/frente-caixa/detalhe-dia?${params.toString()}`);
          console.log('📦 [FrenteCaixa] Resposta detalhe:', response.data);

          if (response.data.success) {
            setOperadorDetalhe(prev => ({ ...prev, [key]: response.data.data }));
            if (response.data.data.length === 0) {
              toast('Nenhum dia encontrado para este operador', { icon: 'ℹ️' });
            } else {
              toast.success(`${response.data.data.length} dias carregados`);
            }
          } else {
            toast.error('Erro na resposta da API');
          }
        } catch (error) {
          console.error('❌ [FrenteCaixa] Erro ao carregar detalhe:', error);
          toast.error(`Erro ao carregar detalhe: ${error.message}`);
        } finally {
          setLoadingDetalhe(prev => ({ ...prev, [key]: false }));
        }
      }
      setExpandedOperadores(prev => ({ ...prev, [key]: true }));
    }
  };

  // Toggle expansão de dia -> mostra cupons
  const toggleDia = async (codOperador, data) => {
    const key = `${codOperador}-${data}`;
    const isExpanded = expandedDias[key];
    console.log('🔍 [FrenteCaixa] toggleDia chamado:', { codOperador, data, key, isExpanded });

    if (isExpanded) {
      setExpandedDias(prev => ({ ...prev, [key]: false }));
    } else {
      if (!diaCupons[key]) {
        setLoadingCupons(prev => ({ ...prev, [key]: true }));
        try {
          const params = new URLSearchParams();
          params.append('codOperador', codOperador);
          params.append('data', data);
          if (lojaSelecionada) params.append('codLoja', lojaSelecionada);

          console.log('📡 [FrenteCaixa] Buscando cupons:', `/frente-caixa/cupons?${params.toString()}`);
          const response = await api.get(`/frente-caixa/cupons?${params.toString()}`);
          console.log('📦 [FrenteCaixa] Resposta cupons:', response.data);

          if (response.data.success) {
            setDiaCupons(prev => ({ ...prev, [key]: response.data.data }));
            if (response.data.data.length === 0) {
              toast('Nenhum cupom encontrado para este dia', { icon: 'ℹ️' });
            } else {
              toast.success(`${response.data.data.length} cupons carregados`);
            }
          } else {
            toast.error('Erro na resposta da API');
          }
        } catch (error) {
          console.error('❌ [FrenteCaixa] Erro ao carregar cupons:', error);
          toast.error(`Erro ao carregar cupons: ${error.message}`);
        } finally {
          setLoadingCupons(prev => ({ ...prev, [key]: false }));
        }
      }
      setExpandedDias(prev => ({ ...prev, [key]: true }));
    }
  };

  // Toggle expansão de cupom -> mostra itens
  const toggleCupom = async (numCupom, codLoja, data) => {
    const key = `${numCupom}-${codLoja}`;
    const isExpanded = expandedCupons[key];
    console.log('🔍 [FrenteCaixa] toggleCupom chamado:', { numCupom, codLoja, data, key, isExpanded });

    if (isExpanded) {
      setExpandedCupons(prev => ({ ...prev, [key]: false }));
    } else {
      if (!cupomItens[key]) {
        setLoadingItens(prev => ({ ...prev, [key]: true }));
        try {
          const params = new URLSearchParams();
          params.append('numCupom', numCupom);
          params.append('codLoja', codLoja);
          if (data) params.append('data', data);

          console.log('📡 [FrenteCaixa] Buscando itens:', `/frente-caixa/itens?${params.toString()}`);
          const response = await api.get(`/frente-caixa/itens?${params.toString()}`);
          console.log('📦 [FrenteCaixa] Resposta itens:', response.data);

          if (response.data.success) {
            setCupomItens(prev => ({ ...prev, [key]: response.data.data }));
            if (response.data.data.length === 0) {
              toast('Nenhum item encontrado neste cupom', { icon: 'ℹ️' });
            } else {
              toast.success(`${response.data.data.length} itens carregados`);
            }
          } else {
            toast.error('Erro na resposta da API');
          }
        } catch (error) {
          console.error('❌ [FrenteCaixa] Erro ao carregar itens:', error);
          toast.error(`Erro ao carregar itens: ${error.message}`);
        } finally {
          setLoadingItens(prev => ({ ...prev, [key]: false }));
        }
      }
      setExpandedCupons(prev => ({ ...prev, [key]: true }));
    }
  };

  // Ordenação
  const handleSort = (columnId) => {
    const column = columns.find(c => c.id === columnId);
    if (!column?.sortable) return;

    setSortConfig(prev => ({
      key: columnId,
      direction: prev.key === columnId && prev.direction === 'asc' ? 'desc' : 'asc'
    }));
  };

  // Drag and Drop
  const handleDragStart = (e, columnId) => {
    setDraggedColumn(columnId);
    e.dataTransfer.effectAllowed = 'move';
    e.target.style.opacity = '0.5';
  };

  const handleDragEnd = (e) => {
    e.target.style.opacity = '1';
    setDraggedColumn(null);
    setDragOverColumn(null);
  };

  const handleDragOver = (e, columnId) => {
    e.preventDefault();
    if (draggedColumn !== columnId) {
      setDragOverColumn(columnId);
    }
  };

  const handleDragLeave = () => {
    setDragOverColumn(null);
  };

  const handleDrop = (e, targetColumnId) => {
    e.preventDefault();
    if (!draggedColumn || draggedColumn === targetColumnId) return;

    // Determinar qual conjunto de colunas usar baseado no modo de visualização
    if (viewMode === 'meta') {
      const newColumns = [...metaColumns];
      const draggedIndex = newColumns.findIndex(col => col.id === draggedColumn);
      const targetIndex = newColumns.findIndex(col => col.id === targetColumnId);

      if (draggedIndex === -1 || targetIndex === -1) return;

      const [removed] = newColumns.splice(draggedIndex, 1);
      newColumns.splice(targetIndex, 0, removed);

      setMetaColumns(newColumns);
      setDraggedColumn(null);
      setDragOverColumn(null);

      // Salvar ordem no localStorage
      const columnIds = newColumns.map(col => col.id);
      localStorage.setItem('frente_caixa_meta_columns_order', JSON.stringify(columnIds));
      toast.success('Ordem das colunas Meta salva!');
    } else {
      const newColumns = [...columns];
      const draggedIndex = newColumns.findIndex(col => col.id === draggedColumn);
      const targetIndex = newColumns.findIndex(col => col.id === targetColumnId);

      if (draggedIndex === -1 || targetIndex === -1) return;

      const [removed] = newColumns.splice(draggedIndex, 1);
      newColumns.splice(targetIndex, 0, removed);

      setColumns(newColumns);
      setDraggedColumn(null);
      setDragOverColumn(null);

      // Salvar ordem no localStorage
      const columnIds = newColumns.map(col => col.id);
      localStorage.setItem('frente_caixa_columns_order', JSON.stringify(columnIds));
      toast.success('Ordem das colunas salva!');
    }
  };

  // Formatação
  const formatCurrency = (value) => {
    if (value === null || value === undefined) return '-';
    return Number(value).toLocaleString('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    });
  };

  const formatNumber = (value) => {
    if (value === null || value === undefined) return '-';
    return Number(value).toLocaleString('pt-BR');
  };

  const formatPercent = (value) => {
    if (value === null || value === undefined || isNaN(value)) return '-';
    return `${Number(value).toFixed(2)}%`;
  };

  // Calcular percentuais
  const calcPctDesconto = (row) => {
    if (!row.TOTAL_VENDAS || row.TOTAL_VENDAS === 0) return 0;
    return (row.TOTAL_DESCONTOS / row.TOTAL_VENDAS) * 100;
  };

  const calcPctCancelamentos = (row) => {
    if (!row.TOTAL_VENDAS || row.TOTAL_VENDAS === 0) return 0;
    // Soma Cancelamentos + Canc. Cupom (estornos órfãos)
    return (((row.CANCELAMENTOS || 0) + (row.ESTORNOS_ORFAOS || 0)) / row.TOTAL_VENDAS) * 100;
  };

  const calcPctValeTroca = (row) => {
    if (!row.TOTAL_VENDAS || row.TOTAL_VENDAS === 0) return 0;
    return ((row.VALE_TROCA || 0) / row.TOTAL_VENDAS) * 100;
  };

  const calcPctEstornosOrfaos = (row) => {
    if (!row.TOTAL_VENDAS || row.TOTAL_VENDAS === 0) return 0;
    return ((row.ESTORNOS_ORFAOS || 0) / row.TOTAL_VENDAS) * 100;
  };

  // % Itens = Itens / Faturamento (quanto itens por real vendido)
  const calcPctItens = (row) => {
    if (!row.TOTAL_VENDAS || row.TOTAL_VENDAS === 0) return 0;
    return ((row.TOTAL_ITENS || 0) / row.TOTAL_VENDAS) * 100;
  };

  // % Cupons = Cupons / Faturamento (quanto cupons por real vendido)
  const calcPctCupons = (row) => {
    if (!row.TOTAL_VENDAS || row.TOTAL_VENDAS === 0) return 0;
    return ((row.TOTAL_CUPONS || 0) / row.TOTAL_VENDAS) * 100;
  };

  // Salvar configurações de meta no localStorage
  const saveMetaConfig = (newConfig) => {
    setMetaConfig(newConfig);
    localStorage.setItem('frente_caixa_meta_config', JSON.stringify(newConfig));
  };

  const saveMetaGlobal = (newGlobal) => {
    setMetaGlobal(newGlobal);
    localStorage.setItem('frente_caixa_meta_global', JSON.stringify(newGlobal));
  };

  // Obter config de meta para um operador (individual ou global)
  const getMetaForOperador = (codOperador) => {
    if (metaConfig[codOperador]) {
      return metaConfig[codOperador];
    }
    return metaGlobal;
  };

  // Verificar se bateu a meta de venda
  const checkMetaVenda = (row) => {
    const config = getMetaForOperador(row.COD_OPERADOR);
    if (!config.vendaMinima?.enabled) return null; // Meta não configurada
    const vendas = row.TOTAL_VENDAS || 0;
    return vendas >= config.vendaMinima.value;
  };

  // Verificar se bateu a meta de desconto (não ultrapassou máximo)
  const checkMetaDesconto = (row) => {
    const config = getMetaForOperador(row.COD_OPERADOR);
    if (!config.descontoMaximo?.enabled) return null; // Meta não configurada
    const descontos = row.TOTAL_DESCONTOS || 0;
    return descontos <= config.descontoMaximo.value;
  };

  // Verificar se bateu a meta de cancelamento (não ultrapassou % máximo)
  const checkMetaCancelamento = (row) => {
    const config = getMetaForOperador(row.COD_OPERADOR);
    if (!config.pctCancelamentoMax?.enabled) return null; // Meta não configurada
    const pctCancel = calcPctCancelamentos(row);
    return pctCancel <= config.pctCancelamentoMax.value;
  };

  // Verificar se bateu a meta de sobra (não ultrapassou máximo)
  const checkMetaSobra = (row) => {
    const config = getMetaForOperador(row.COD_OPERADOR);
    if (!config.sobraMaxima?.enabled) return null; // Meta não configurada
    const sobra = row.VAL_SOBRA || 0;
    return sobra <= config.sobraMaxima.value;
  };

  // Verificar se bateu a meta de quebra (não ultrapassou máximo)
  const checkMetaQuebra = (row) => {
    const config = getMetaForOperador(row.COD_OPERADOR);
    if (!config.quebraMaxima?.enabled) return null; // Meta não configurada
    const quebra = row.VAL_QUEBRA || 0;
    return quebra <= config.quebraMaxima.value;
  };

  // Salvar ausência no localStorage
  const saveAusencia = (codOperador, valor) => {
    const newAusencia = { ...ausenciaOperador, [codOperador]: valor };
    setAusenciaOperador(newAusencia);
    localStorage.setItem('frente_caixa_ausencia', JSON.stringify(newAusencia));
  };

  // Salvar horas trabalhadas no localStorage
  const saveHoras = (codOperador, valor) => {
    const newHoras = { ...horasTrabalhadas, [codOperador]: valor };
    setHorasTrabalhadas(newHoras);
    localStorage.setItem('frente_caixa_horas', JSON.stringify(newHoras));
  };

  // Converter HH:MM para horas decimais (ex: 7:30 -> 7.5)
  const horasParaDecimal = (horasStr) => {
    if (!horasStr) return 0;
    const parts = horasStr.split(':');
    if (parts.length !== 2) return 0;
    const horas = parseInt(parts[0]) || 0;
    const minutos = parseInt(parts[1]) || 0;
    return horas + (minutos / 60);
  };

  // Calcular cupons por hora
  const calcCuponsPorHora = (row) => {
    const horas = horasParaDecimal(horasTrabalhadas[row.COD_OPERADOR]);
    if (horas <= 0) return null;
    const cupons = row.TOTAL_CUPONS || 0;
    return cupons / horas;
  };

  // Calcular itens (produtos) por hora
  const calcItensPorHora = (row) => {
    const horas = horasParaDecimal(horasTrabalhadas[row.COD_OPERADOR]);
    if (horas <= 0) return null;
    const itens = row.TOTAL_ITENS || 0;
    return itens / horas;
  };

  // Contar quantos "BATEU" um operador tem
  const contarBateu = (row) => {
    let count = 0;
    if (checkMetaVenda(row) === true) count++;
    if (checkMetaDesconto(row) === true) count++;
    if (checkMetaCancelamento(row) === true) count++;
    if (checkMetaSobra(row) === true) count++;
    if (checkMetaQuebra(row) === true) count++;
    return count;
  };

  // Dados ordenados (movido para depois das funções auxiliares)
  const sortedData = useMemo(() => {
    let sorted = [...data];

    // No modo Meta, ordenar com prioridades:
    // 1. AUSÊNCIA NEGATIVA vai para o final (peso mais alto)
    // 2. Quantidade de "BATEU" (mais bateu = primeiro)
    // 3. Cupons/Hora como desempate
    if (viewMode === 'meta') {
      sorted.sort((a, b) => {
        // PRIORIDADE 1: Ausência NEGATIVA vai para o final
        const aAusencia = ausenciaOperador[a.COD_OPERADOR];
        const bAusencia = ausenciaOperador[b.COD_OPERADOR];

        // Se um tem NEGATIVA e outro não, NEGATIVA vai por último
        if (aAusencia === 'negativa' && bAusencia !== 'negativa') return 1;
        if (bAusencia === 'negativa' && aAusencia !== 'negativa') return -1;

        // PRIORIDADE 2: Quantidade de BATEU (mais = primeiro)
        const aBateu = contarBateu(a);
        const bBateu = contarBateu(b);
        if (bBateu !== aBateu) {
          return bBateu - aBateu; // Mais BATEU primeiro
        }

        // PRIORIDADE 3: Cupons/hora como desempate
        const aCuponsHora = calcCuponsPorHora(a) || 0;
        const bCuponsHora = calcCuponsPorHora(b) || 0;
        return bCuponsHora - aCuponsHora;
      });
    } else if (sortConfig.key) {
      // Modo Geral: usar ordenação padrão
      sorted.sort((a, b) => {
        const aVal = a[sortConfig.key];
        const bVal = b[sortConfig.key];

        if (typeof aVal === 'string') {
          return sortConfig.direction === 'asc'
            ? aVal.localeCompare(bVal)
            : bVal.localeCompare(aVal);
        }

        return sortConfig.direction === 'asc' ? aVal - bVal : bVal - aVal;
      });
    }

    return sorted;
  }, [data, sortConfig, viewMode, metaConfig, metaGlobal, horasTrabalhadas, ausenciaOperador]);

  // Calcular destaques (pontos) - só válido para quem tem ausência POSITIVA
  const destaques = useMemo(() => {
    if (data.length === 0) return { vencedores: [], categorias: {} };

    // Filtrar apenas operadores com ausência POSITIVA (válidos para pontos)
    const validos = data.filter(row => ausenciaOperador[row.COD_OPERADOR] === 'positiva');

    if (validos.length === 0) return { vencedores: [], categorias: {} };

    // Calcular métricas para cada operador válido
    const metricas = validos.map(row => ({
      COD_OPERADOR: row.COD_OPERADOR,
      DES_OPERADOR: row.DES_OPERADOR,
      itensPorHora: calcItensPorHora(row),
      pctCancelamento: calcPctCancelamentos(row),
      totalDescontos: row.TOTAL_DESCONTOS || 0,
      pontos: 0
    }));

    // Categoria 1: Maior Itens/Hora (só considera quem tem horas preenchidas)
    const comHoras = metricas.filter(m => m.itensPorHora !== null && m.itensPorHora > 0);
    let melhorItensPorHora = null;
    let vencedoresItensPorHora = [];
    if (comHoras.length > 0) {
      melhorItensPorHora = Math.max(...comHoras.map(m => m.itensPorHora));
      vencedoresItensPorHora = comHoras
        .filter(m => m.itensPorHora === melhorItensPorHora)
        .map(m => m.COD_OPERADOR);
      // Dar ponto para os vencedores
      metricas.forEach(m => {
        if (vencedoresItensPorHora.includes(m.COD_OPERADOR)) m.pontos++;
      });
    }

    // Categoria 2: Menor % Cancelamento
    const menorPctCancel = Math.min(...metricas.map(m => m.pctCancelamento));
    const vencedoresCancelamento = metricas
      .filter(m => m.pctCancelamento === menorPctCancel)
      .map(m => m.COD_OPERADOR);
    metricas.forEach(m => {
      if (vencedoresCancelamento.includes(m.COD_OPERADOR)) m.pontos++;
    });

    // Categoria 3: Menor Desconto
    const menorDesconto = Math.min(...metricas.map(m => m.totalDescontos));
    const vencedoresDesconto = metricas
      .filter(m => m.totalDescontos === menorDesconto)
      .map(m => m.COD_OPERADOR);
    metricas.forEach(m => {
      if (vencedoresDesconto.includes(m.COD_OPERADOR)) m.pontos++;
    });

    // Encontrar pontuação máxima
    const maxPontos = Math.max(...metricas.map(m => m.pontos));

    // Vencedores são todos que têm a pontuação máxima
    const vencedores = metricas
      .filter(m => m.pontos === maxPontos && m.pontos > 0)
      .sort((a, b) => b.pontos - a.pontos);

    // Todos os participantes ordenados por pontos
    const ranking = [...metricas].sort((a, b) => b.pontos - a.pontos);

    return {
      vencedores,
      ranking,
      categorias: {
        itensPorHora: {
          valor: melhorItensPorHora,
          vencedores: vencedoresItensPorHora,
          nomes: metricas.filter(m => vencedoresItensPorHora.includes(m.COD_OPERADOR)).map(m => m.DES_OPERADOR)
        },
        cancelamento: {
          valor: menorPctCancel,
          vencedores: vencedoresCancelamento,
          nomes: metricas.filter(m => vencedoresCancelamento.includes(m.COD_OPERADOR)).map(m => m.DES_OPERADOR)
        },
        desconto: {
          valor: menorDesconto,
          vencedores: vencedoresDesconto,
          nomes: metricas.filter(m => vencedoresDesconto.includes(m.COD_OPERADOR)).map(m => m.DES_OPERADOR)
        }
      },
      maxPontos
    };
  }, [data, ausenciaOperador, horasTrabalhadas]);

  // Renderizar badge BATEU/NÃO BATEU
  const renderMetaBadge = (result) => {
    if (result === null) {
      return <span className="text-gray-400 text-xs">-</span>;
    }
    if (result) {
      return (
        <span className="bg-green-100 text-green-700 text-xs px-2 py-1 rounded-full font-medium">
          BATEU
        </span>
      );
    }
    return (
      <span className="bg-red-100 text-red-700 text-xs px-2 py-1 rounded-full font-medium">
        NÃO BATEU
      </span>
    );
  };

  // Renderizar coluna de horas trabalhadas com input
  const renderHorasTrabalhadas = (row) => {
    const codOp = row.COD_OPERADOR;
    const horasAtual = horasTrabalhadas[codOp] || '';

    return (
      <input
        type="text"
        placeholder="0:00"
        value={horasAtual}
        onChange={(e) => {
          // Permitir apenas números e :
          const value = e.target.value.replace(/[^0-9:]/g, '');
          saveHoras(codOp, value);
        }}
        onClick={(e) => e.stopPropagation()}
        className="w-14 text-center text-xs px-1 py-0.5 border rounded focus:ring-blue-500 focus:border-blue-500"
      />
    );
  };

  // Renderizar coluna de ausência com dropdown
  const renderAusencia = (row) => {
    const codOp = row.COD_OPERADOR;
    const atual = ausenciaOperador[codOp] || null;

    return (
      <div className="flex items-center gap-1 justify-center">
        <button
          onClick={(e) => {
            e.stopPropagation();
            saveAusencia(codOp, atual === 'positiva' ? null : 'positiva');
          }}
          className={`text-xs px-2 py-1 rounded-full font-medium transition-all ${
            atual === 'positiva'
              ? 'bg-green-500 text-white shadow-sm'
              : 'bg-gray-100 text-gray-400 hover:bg-green-100 hover:text-green-600'
          }`}
        >
          POSITIVA
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation();
            saveAusencia(codOp, atual === 'negativa' ? null : 'negativa');
          }}
          className={`text-xs px-2 py-1 rounded-full font-medium transition-all ${
            atual === 'negativa'
              ? 'bg-red-500 text-white shadow-sm'
              : 'bg-gray-100 text-gray-400 hover:bg-red-100 hover:text-red-600'
          }`}
        >
          NEGATIVA
        </button>
      </div>
    );
  };

  // Renderizar valor da célula
  const renderCellValue = (row, columnId) => {
    const value = row[columnId];

    switch (columnId) {
      case 'DES_OPERADOR':
        return value || 'N/A';
      case 'TOTAL_ITENS':
      case 'TOTAL_CUPONS':
        return formatNumber(value);
      case 'PCT_DESCONTO':
        return formatPercent(calcPctDesconto(row));
      case 'PCT_CANCELAMENTOS':
        return formatPercent(calcPctCancelamentos(row));
      case 'PCT_ESTORNOS_ORFAOS':
        return formatPercent(calcPctEstornosOrfaos(row));
      case 'PCT_VALE_TROCA':
        return formatPercent(calcPctValeTroca(row));
      case 'PCT_ITENS':
        return formatPercent(calcPctItens(row));
      case 'PCT_CUPONS':
        return formatPercent(calcPctCupons(row));
      // Colunas de Meta - BATEU / NÃO BATEU
      case 'META_VENDA':
        return renderMetaBadge(checkMetaVenda(row));
      case 'META_DESCONTO':
        return renderMetaBadge(checkMetaDesconto(row));
      case 'META_CANCELAMENTO':
        return renderMetaBadge(checkMetaCancelamento(row));
      case 'META_SOBRA':
        return renderMetaBadge(checkMetaSobra(row));
      case 'META_QUEBRA':
        return renderMetaBadge(checkMetaQuebra(row));
      case 'AUSENCIA':
        return renderAusencia(row);
      case 'HORAS_TRABALHADAS':
        return renderHorasTrabalhadas(row);
      case 'CUPONS_POR_HORA':
        const cuponsPorHora = calcCuponsPorHora(row);
        if (cuponsPorHora === null) return <span className="text-gray-400 text-xs">-</span>;
        return <span className="font-medium text-blue-600">{cuponsPorHora.toFixed(1)}</span>;
      default:
        return formatCurrency(value);
    }
  };

  // Obter classe de cor para célula
  const getCellClass = (column, value) => {
    if (column.highlight === 'green' && value > 0) return 'text-green-600 font-medium';
    if (column.highlight === 'red' && value > 0) return 'text-red-600 font-medium';
    if (column.highlight === 'yellow' && value > 0) return 'text-yellow-600 font-medium';
    if (column.highlight === 'orange' && value > 0) return 'text-orange-600 font-medium';
    if (column.highlight === 'blue' && value > 0) return 'text-blue-600 font-medium';
    return 'text-gray-900';
  };

  // Exportar para PDF
  const handleExportPDF = () => {
    if (data.length === 0) {
      toast.error('Nenhum dado para exportar');
      return;
    }

    // Criar conteúdo HTML para impressão
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      toast.error('Popup bloqueado. Permita popups para exportar.');
      return;
    }

    const tableRows = sortedData.map(row => `
      <tr>
        ${visibleColumns.map(col => `<td style="border: 1px solid #ddd; padding: 8px; text-align: ${col.align};">${renderCellValue(row, col.id)}</td>`).join('')}
      </tr>
    `).join('');

    const totaisRow = totais ? `
      <tr style="background: #f3f4f6; font-weight: bold;">
        ${visibleColumns.map(col => `<td style="border: 1px solid #ddd; padding: 8px; text-align: ${col.align};">${col.id === 'DES_OPERADOR' ? `TOTAIS (${totais.TOTAL_OPERADORES} colaboradores)` : renderCellValue(totais, col.id)}</td>`).join('')}
      </tr>
    ` : '';

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Frente de Caixa - ${filters.dataInicio} a ${filters.dataFim}</title>
        <style>
          body { font-family: Arial, sans-serif; font-size: 10px; margin: 20px; }
          h1 { font-size: 16px; margin-bottom: 5px; }
          h2 { font-size: 12px; color: #666; margin-bottom: 15px; }
          table { border-collapse: collapse; width: 100%; }
          th { background: #f97316; color: white; padding: 8px; text-align: left; border: 1px solid #ddd; font-size: 9px; }
          td { font-size: 9px; }
          @media print { body { margin: 10px; } }
        </style>
      </head>
      <body>
        <h1>Relatório Frente de Caixa</h1>
        <h2>Período: ${formatDateForApi(filters.dataInicio)} a ${formatDateForApi(filters.dataFim)}</h2>
        <table>
          <thead>
            <tr>
              ${visibleColumns.map(col => `<th style="text-align: ${col.align};">${col.header}</th>`).join('')}
            </tr>
          </thead>
          <tbody>
            ${tableRows}
            ${totaisRow}
          </tbody>
        </table>
        <script>window.print(); window.close();</script>
      </body>
      </html>
    `;

    printWindow.document.write(html);
    printWindow.document.close();
  };

  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar
        user={user}
        onLogout={logout}
        isMobileMenuOpen={isMobileMenuOpen}
        setIsMobileMenuOpen={setIsMobileMenuOpen}
      />

      <div className="flex-1 overflow-auto">
        {/* Mobile Header */}
        <div className="md:hidden bg-white border-b border-gray-200 p-4 flex items-center justify-between">
          <button
            onClick={() => setIsMobileMenuOpen(true)}
            className="p-2 rounded-md text-gray-500 hover:text-gray-600 hover:bg-gray-100"
          >
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          <h1 className="text-lg font-semibold text-gray-900">Frente de Caixa</h1>
          <div className="w-10" />
        </div>

        {/* Header Laranja */}
        <div className="bg-gradient-to-br from-orange-500 to-red-600 shadow-lg">
          <div className="px-4 md:px-6 py-6">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl lg:text-3xl font-bold text-white mb-2">🛒 Frente de Caixa</h1>
                <p className="text-white/90">Vendas, cancelamentos, descontos e diferença de caixa por colaborador</p>
              </div>
              <div className="flex items-center gap-3">
                <div className={`flex items-center gap-2 px-4 py-2 rounded-lg ${oracleStatus.connected ? 'bg-green-500 text-white' : 'bg-red-500 text-white'}`}>
                  <div className={`w-2 h-2 rounded-full ${oracleStatus.connected ? 'bg-white animate-pulse' : 'bg-white'}`}></div>
                  <span className="text-sm font-medium">
                    {oracleStatus.connected ? 'Oracle Conectado' : 'Oracle Desconectado'}
                  </span>
                </div>
                <div className="bg-white/20 backdrop-blur-sm rounded-full p-3 hidden lg:block">
                  <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Filtros */}
        <div className="bg-white border-b border-gray-200 px-4 md:px-6 py-4">
          <div className="flex flex-wrap items-end gap-4">
            {/* Data Início */}
            <div className="flex flex-col">
              <label className="text-xs text-gray-500 mb-1">Data Início</label>
              <input
                type="date"
                value={filters.dataInicio}
                onChange={(e) => setFilters(prev => ({ ...prev, dataInicio: e.target.value }))}
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
              />
            </div>

            {/* Data Fim */}
            <div className="flex flex-col">
              <label className="text-xs text-gray-500 mb-1">Data Fim</label>
              <input
                type="date"
                value={filters.dataFim}
                onChange={(e) => setFilters(prev => ({ ...prev, dataFim: e.target.value }))}
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
              />
            </div>

            {/* Colaborador */}
            <div className="flex flex-col">
              <label className="text-xs text-gray-500 mb-1">Colaborador</label>
              <select
                value={filters.codOperador}
                onChange={(e) => setFilters(prev => ({ ...prev, codOperador: e.target.value }))}
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-orange-500 focus:border-orange-500 min-w-[200px]"
                disabled={loadingFilters}
              >
                <option value="">Todos</option>
                {operadores.map(op => (
                  <option key={op.COD_OPERADOR} value={op.COD_OPERADOR}>
                    {op.DES_OPERADOR}
                  </option>
                ))}
              </select>
            </div>

            {/* Botão Buscar */}
            <div className="flex gap-2">
              <button
                onClick={handleSearch}
                disabled={loading || !oracleStatus.connected}
                className="bg-orange-500 hover:bg-orange-600 text-white px-6 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {loading ? (
                  <>
                    <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    Buscando...
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                    Buscar
                  </>
                )}
              </button>
            </div>

            {/* Toggle Geral / Meta */}
            <div className="flex flex-col">
              <label className="text-xs text-gray-500 mb-1">Visualização</label>
              <div className="flex items-center gap-2">
                <div className="flex bg-gray-100 rounded-lg p-1">
                  <button
                    onClick={() => setViewMode('geral')}
                    className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${
                      viewMode === 'geral'
                        ? 'bg-white text-orange-600 shadow-sm'
                        : 'text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    Geral
                  </button>
                  <button
                    onClick={() => setViewMode('meta')}
                    className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${
                      viewMode === 'meta'
                        ? 'bg-white text-orange-600 shadow-sm'
                        : 'text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    Meta
                  </button>
                </div>
                {/* Botão Config META */}
                <button
                  onClick={() => setShowMetaConfigModal(true)}
                  className="px-3 py-1.5 text-sm font-medium bg-purple-500 hover:bg-purple-600 text-white rounded-lg transition-colors flex items-center gap-1"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  Config META
                </button>
              </div>
            </div>

            {/* Spacer para empurrar botões para direita */}
            <div className="flex-1" />

            {/* Botões Config e PDF */}
            <div className="flex gap-2 items-end">
              {/* Botão Configurar Colunas - Apenas no modo Geral */}
              {viewMode === 'geral' && (
              <div className="relative">
                <button
                  onClick={() => setShowColumnConfig(!showColumnConfig)}
                  className="p-2 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-lg transition-colors"
                  title="Configurar colunas"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                </button>

                {/* Dropdown de configuração de colunas */}
                {showColumnConfig && (
                  <div className="absolute right-0 top-full mt-2 w-64 bg-white rounded-lg shadow-lg border border-gray-200 z-50 max-h-96 overflow-y-auto">
                    <div className="p-3 border-b border-gray-200">
                      <h3 className="font-medium text-gray-900 text-sm">Exibir Colunas</h3>
                      <p className="text-xs text-gray-500 mt-1">Selecione as colunas para exibir</p>
                    </div>
                    <div className="p-2">
                      {columns.map(col => (
                        <label
                          key={col.id}
                          className="flex items-center gap-2 px-2 py-1.5 hover:bg-gray-50 rounded cursor-pointer"
                        >
                          <input
                            type="checkbox"
                            checked={!hiddenColumns.includes(col.id)}
                            onChange={() => toggleColumnVisibility(col.id)}
                            className="w-4 h-4 text-orange-500 border-gray-300 rounded focus:ring-orange-500"
                          />
                          <span className="text-sm text-gray-700">{col.header}</span>
                        </label>
                      ))}
                    </div>
                    <div className="p-2 border-t border-gray-200">
                      <button
                        onClick={() => {
                          setHiddenColumns([]);
                          localStorage.removeItem('frente_caixa_hidden_columns');
                        }}
                        className="w-full text-xs text-orange-600 hover:text-orange-700 py-1"
                      >
                        Mostrar todas
                      </button>
                    </div>
                  </div>
                )}
              </div>
              )}

              {/* Botão Exportar PDF */}
              <button
                onClick={handleExportPDF}
                disabled={data.length === 0}
                className="p-2 bg-red-500 hover:bg-red-600 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                title="Exportar PDF"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                </svg>
              </button>
            </div>
          </div>

          {/* Dica de arraste */}
          <p className="text-xs text-gray-400 mt-3">
            Dica: Arraste os cabeçalhos das colunas para reordená-las. {viewMode === 'geral' ? 'Use o botão de engrenagem para ocultar colunas.' : 'A ordem é salva automaticamente.'}
          </p>
        </div>

        {/* Cards de Resumo */}
        {totais && (
          <div className="px-4 md:px-6 pt-4">
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3">
              {/* Total Cupons */}
              <div className="bg-white rounded-lg shadow p-3 border-l-4 border-indigo-500">
                <p className="text-xs text-gray-500 font-medium">Total Cupons</p>
                <p className="text-lg font-bold text-indigo-600">{formatNumber(totais.TOTAL_CUPONS || 0)}</p>
              </div>

              {/* Ticket Médio */}
              <div className="bg-white rounded-lg shadow p-3 border-l-4 border-teal-500">
                <p className="text-xs text-gray-500 font-medium">Ticket Médio</p>
                <p className="text-lg font-bold text-teal-600">
                  {formatCurrency(totais.TOTAL_CUPONS ? (totais.TOTAL_VENDAS || 0) / totais.TOTAL_CUPONS : 0)}
                </p>
              </div>

              {/* Cancelamentos (soma de Cancelamentos + Canc. Cupom) */}
              <div className="bg-white rounded-lg shadow p-3 border-l-4 border-orange-500">
                <p className="text-xs text-gray-500 font-medium">Cancelamentos</p>
                <p className="text-lg font-bold text-orange-600">{formatCurrency((totais.CANCELAMENTOS || 0) + (totais.ESTORNOS_ORFAOS || 0))}</p>
                <p className="text-xs text-orange-500">
                  {totais.TOTAL_VENDAS ? (((totais.CANCELAMENTOS || 0) + (totais.ESTORNOS_ORFAOS || 0)) / totais.TOTAL_VENDAS * 100).toFixed(2) : '0.00'}%
                </p>
              </div>

              {/* Descontos */}
              <div className="bg-white rounded-lg shadow p-3 border-l-4 border-yellow-500">
                <p className="text-xs text-gray-500 font-medium">Descontos</p>
                <p className="text-lg font-bold text-yellow-600">{formatCurrency(totais.TOTAL_DESCONTOS || 0)}</p>
                <p className="text-xs text-yellow-600">
                  {totais.TOTAL_VENDAS ? ((totais.TOTAL_DESCONTOS || 0) / totais.TOTAL_VENDAS * 100).toFixed(2) : '0.00'}%
                </p>
              </div>

              {/* Vale Troca */}
              <div className="bg-white rounded-lg shadow p-3 border-l-4 border-blue-500">
                <p className="text-xs text-gray-500 font-medium">Vale Troca</p>
                <p className="text-lg font-bold text-blue-600">{formatCurrency(totais.VALE_TROCA || 0)}</p>
                <p className="text-xs text-blue-500">
                  {totais.TOTAL_VENDAS ? ((totais.VALE_TROCA || 0) / totais.TOTAL_VENDAS * 100).toFixed(2) : '0.00'}%
                </p>
              </div>

              {/* Vale Desconto */}
              <div className="bg-white rounded-lg shadow p-3 border-l-4 border-purple-500">
                <p className="text-xs text-gray-500 font-medium">Vale Desconto</p>
                <p className="text-lg font-bold text-purple-600">{formatCurrency(totais.VALE_DESCONTO || 0)}</p>
              </div>

              {/* Sobra Caixa */}
              <div className="bg-white rounded-lg shadow p-3 border-l-4 border-green-500">
                <p className="text-xs text-gray-500 font-medium">Sobra Caixa</p>
                <p className="text-lg font-bold text-green-600">{formatCurrency(totais.TOTAL_SOBRA || 0)}</p>
              </div>

              {/* Quebra Caixa */}
              <div className="bg-white rounded-lg shadow p-3 border-l-4 border-red-600">
                <p className="text-xs text-gray-500 font-medium">Falta Caixa</p>
                <p className="text-lg font-bold text-red-600">{formatCurrency(totais.TOTAL_QUEBRA || 0)}</p>
              </div>
            </div>
          </div>
        )}

        {/* Tabela Destaque - Apenas no modo Meta */}
        {viewMode === 'meta' && data.length > 0 && destaques.ranking && destaques.ranking.length > 0 && (
          <div className="px-4 md:px-6 pt-4">
            <div className={`bg-gradient-to-r from-yellow-50 to-orange-50 rounded-lg shadow border border-yellow-200 overflow-hidden ${destaqueMinimizado ? 'cursor-pointer' : ''}`}>
              <div
                className="bg-gradient-to-r from-yellow-400 to-orange-400 px-4 py-3 flex items-center justify-between cursor-pointer hover:from-yellow-500 hover:to-orange-500 transition-all"
                onClick={toggleDestaque}
              >
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  🏆 Quadro de Destaque
                  <span className="text-sm font-normal text-white/80">(Apenas ausência POSITIVA concorre)</span>
                </h3>
                <button
                  className="p-1.5 bg-white/20 hover:bg-white/30 rounded-lg transition-colors"
                  title={destaqueMinimizado ? 'Expandir' : 'Minimizar'}
                >
                  <svg
                    className={`w-5 h-5 text-white transition-transform ${destaqueMinimizado ? 'rotate-180' : ''}`}
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                  </svg>
                </button>
              </div>

              {!destaqueMinimizado && (
              <div className="p-4">
                {/* Categorias de Pontuação */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                  {/* Maior Itens/Hora */}
                  <div className="bg-white rounded-lg p-3 border border-blue-200 shadow-sm">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-xl">📦</span>
                      <span className="font-semibold text-blue-700 text-sm">Maior Itens/Hora</span>
                      <span className="ml-auto bg-blue-100 text-blue-700 text-xs px-2 py-0.5 rounded-full">+1 pt</span>
                    </div>
                    {destaques.categorias.itensPorHora.nomes.length > 0 ? (
                      <>
                        <p className="text-lg font-bold text-blue-600">
                          {destaques.categorias.itensPorHora.valor?.toFixed(1)} itens/h
                        </p>
                        <p className="text-xs text-gray-600 mt-1">
                          {destaques.categorias.itensPorHora.nomes.join(', ')}
                        </p>
                      </>
                    ) : (
                      <p className="text-sm text-gray-400">Sem dados de horas</p>
                    )}
                  </div>

                  {/* Menor % Cancelamento */}
                  <div className="bg-white rounded-lg p-3 border border-green-200 shadow-sm">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-xl">✅</span>
                      <span className="font-semibold text-green-700 text-sm">Menor % Cancelamento</span>
                      <span className="ml-auto bg-green-100 text-green-700 text-xs px-2 py-0.5 rounded-full">+1 pt</span>
                    </div>
                    <p className="text-lg font-bold text-green-600">
                      {destaques.categorias.cancelamento.valor?.toFixed(2)}%
                    </p>
                    <p className="text-xs text-gray-600 mt-1">
                      {destaques.categorias.cancelamento.nomes.join(', ')}
                    </p>
                  </div>

                  {/* Menor Desconto */}
                  <div className="bg-white rounded-lg p-3 border border-purple-200 shadow-sm">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-xl">💰</span>
                      <span className="font-semibold text-purple-700 text-sm">Menor Desconto</span>
                      <span className="ml-auto bg-purple-100 text-purple-700 text-xs px-2 py-0.5 rounded-full">+1 pt</span>
                    </div>
                    <p className="text-lg font-bold text-purple-600">
                      {formatCurrency(destaques.categorias.desconto.valor || 0)}
                    </p>
                    <p className="text-xs text-gray-600 mt-1">
                      {destaques.categorias.desconto.nomes.join(', ')}
                    </p>
                  </div>
                </div>

                {/* Ranking de Pontos */}
                <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                  <table className="min-w-full">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Posição</th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Colaborador</th>
                        <th className="px-4 py-2 text-center text-xs font-medium text-gray-500 uppercase">Itens/Hora</th>
                        <th className="px-4 py-2 text-center text-xs font-medium text-gray-500 uppercase">% Cancel.</th>
                        <th className="px-4 py-2 text-center text-xs font-medium text-gray-500 uppercase">Desconto</th>
                        <th className="px-4 py-2 text-center text-xs font-medium text-gray-500 uppercase">Pontos</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {destaques.ranking.map((op, idx) => {
                        const isVencedor = op.pontos === destaques.maxPontos && op.pontos > 0;
                        const posicao = idx + 1;
                        return (
                          <tr
                            key={op.COD_OPERADOR}
                            className={isVencedor ? 'bg-yellow-50' : 'hover:bg-gray-50'}
                          >
                            <td className="px-4 py-2 text-sm">
                              {posicao === 1 && isVencedor && '🥇'}
                              {posicao === 2 && op.pontos > 0 && '🥈'}
                              {posicao === 3 && op.pontos > 0 && '🥉'}
                              {posicao > 3 && `${posicao}º`}
                              {posicao <= 3 && !isVencedor && op.pontos === 0 && `${posicao}º`}
                            </td>
                            <td className="px-4 py-2">
                              <span className={`font-medium ${isVencedor ? 'text-yellow-700' : 'text-gray-900'}`}>
                                {op.DES_OPERADOR}
                              </span>
                              {isVencedor && (
                                <span className="ml-2 text-xs bg-yellow-400 text-yellow-900 px-2 py-0.5 rounded-full">
                                  DESTAQUE
                                </span>
                              )}
                            </td>
                            <td className="px-4 py-2 text-center text-sm">
                              {op.itensPorHora !== null ? (
                                <span className={destaques.categorias.itensPorHora.vencedores.includes(op.COD_OPERADOR) ? 'text-blue-600 font-semibold' : ''}>
                                  {op.itensPorHora.toFixed(1)}
                                </span>
                              ) : (
                                <span className="text-gray-400">-</span>
                              )}
                            </td>
                            <td className="px-4 py-2 text-center text-sm">
                              <span className={destaques.categorias.cancelamento.vencedores.includes(op.COD_OPERADOR) ? 'text-green-600 font-semibold' : ''}>
                                {op.pctCancelamento.toFixed(2)}%
                              </span>
                            </td>
                            <td className="px-4 py-2 text-center text-sm">
                              <span className={destaques.categorias.desconto.vencedores.includes(op.COD_OPERADOR) ? 'text-purple-600 font-semibold' : ''}>
                                {formatCurrency(op.totalDescontos)}
                              </span>
                            </td>
                            <td className="px-4 py-2 text-center">
                              <span className={`inline-flex items-center justify-center w-8 h-8 rounded-full font-bold ${
                                op.pontos === 3 ? 'bg-yellow-400 text-yellow-900' :
                                op.pontos === 2 ? 'bg-orange-200 text-orange-800' :
                                op.pontos === 1 ? 'bg-gray-200 text-gray-700' :
                                'bg-gray-100 text-gray-400'
                              }`}>
                                {op.pontos}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Mensagem se não houver participantes */}
                {destaques.ranking.length === 0 && (
                  <div className="text-center py-4 text-gray-500">
                    <p>Nenhum colaborador com ausência POSITIVA para participar do destaque.</p>
                    <p className="text-sm">Marque a ausência como POSITIVA para habilitar a competição.</p>
                  </div>
                )}
              </div>
              )}
            </div>
          </div>
        )}

        {/* Tabela */}
        <div className="p-4 md:p-6">
          {data.length === 0 ? (
            <div className="bg-white rounded-lg shadow p-8 text-center text-gray-500">
              {loading ? <RadarLoading message="Atualizando dados..." /> : 'Selecione os filtros e clique em Buscar para visualizar os dados.'}
            </div>
          ) : (
            <div className="bg-white rounded-lg shadow overflow-hidden">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-orange-100">
                    <tr>
                      {/* Coluna de expansão */}
                      <th className="w-10 px-2 py-3"></th>
                      {visibleColumns.map(column => (
                        <th
                          key={column.id}
                          draggable
                          onDragStart={(e) => handleDragStart(e, column.id)}
                          onDragEnd={handleDragEnd}
                          onDragOver={(e) => handleDragOver(e, column.id)}
                          onDragLeave={handleDragLeave}
                          onDrop={(e) => handleDrop(e, column.id)}
                          onClick={() => handleSort(column.id)}
                          className={`px-3 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer select-none transition-colors
                            ${column.align === 'right' ? 'text-right' : 'text-left'}
                            ${dragOverColumn === column.id ? 'bg-orange-100' : 'hover:bg-gray-100'}
                            ${column.sortable ? 'hover:text-orange-600' : ''}
                          `}
                        >
                          <div className="flex items-center gap-1 justify-between">
                            <span className="truncate">{column.header}</span>
                            {column.sortable && sortConfig.key === column.id && (
                              <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                {sortConfig.direction === 'asc' ? (
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                                ) : (
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                )}
                              </svg>
                            )}
                          </div>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {sortedData.map((row, rowIndex) => (
                      <React.Fragment key={row.COD_OPERADOR || rowIndex}>
                        {/* Linha principal do operador */}
                        <tr className="hover:bg-gray-50 transition-colors">
                          {/* Botão de expansão */}
                          <td className="px-2 py-3">
                            <button
                              onClick={() => toggleOperador(row.COD_OPERADOR)}
                              className="p-1 hover:bg-gray-200 rounded transition-colors"
                            >
                              {loadingDetalhe[row.COD_OPERADOR] ? (
                                <svg className="w-4 h-4 animate-spin text-orange-500" fill="none" viewBox="0 0 24 24">
                                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                                </svg>
                              ) : (
                                <svg
                                  className={`w-4 h-4 text-gray-500 transition-transform ${expandedOperadores[row.COD_OPERADOR] ? 'rotate-90' : ''}`}
                                  fill="none"
                                  viewBox="0 0 24 24"
                                  stroke="currentColor"
                                >
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                </svg>
                              )}
                            </button>
                          </td>
                          {visibleColumns.map(column => (
                            <td
                              key={column.id}
                              className={`px-3 py-3 whitespace-nowrap text-sm ${column.align === 'right' ? 'text-right' : 'text-left'} ${getCellClass(column, row[column.id])}`}
                            >
                              {renderCellValue(row, column.id)}
                            </td>
                          ))}
                        </tr>

                        {/* Linhas expandidas por dia */}
                        {expandedOperadores[row.COD_OPERADOR] && operadorDetalhe[row.COD_OPERADOR] && (
                          operadorDetalhe[row.COD_OPERADOR].map((dia, diaIndex) => {
                            const diaKey = `${row.COD_OPERADOR}-${dia.DATA}`;
                            return (
                              <React.Fragment key={`${row.COD_OPERADOR}-${diaIndex}`}>
                                {/* Linha do dia */}
                                <tr className="bg-orange-50/50 hover:bg-orange-100/50 cursor-pointer" onClick={() => toggleDia(row.COD_OPERADOR, dia.DATA)}>
                                  <td className="px-2 py-2">
                                    {loadingCupons[diaKey] ? (
                                      <svg className="w-3 h-3 animate-spin text-orange-500 ml-4" fill="none" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                                      </svg>
                                    ) : (
                                      <svg className={`w-3 h-3 text-gray-400 ml-4 transition-transform ${expandedDias[diaKey] ? 'rotate-90' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                      </svg>
                                    )}
                                  </td>
                                  {visibleColumns.map(column => (
                                    <td
                                      key={column.id}
                                      className={`px-3 py-2 whitespace-nowrap text-sm ${column.align === 'right' ? 'text-right' : 'text-left'} ${getCellClass(column, dia[column.id])}`}
                                    >
                                      {column.id === 'DES_OPERADOR' ? (
                                        <span className="text-gray-500 pl-4">
                                          📅 Dia {dia.DIA} - {dia.DATA}
                                        </span>
                                      ) : (
                                        renderCellValue(dia, column.id)
                                      )}
                                    </td>
                                  ))}
                                </tr>

                                {/* Linhas de cupons expandidos */}
                                {expandedDias[diaKey] && diaCupons[diaKey] && (
                                  diaCupons[diaKey].map((cupom, cupomIndex) => {
                                    const cupomKey = `${cupom.NUM_CUPOM_FISCAL}-${cupom.COD_LOJA}`;
                                    return (
                                      <React.Fragment key={`cupom-${cupomIndex}`}>
                                        {/* Linha do cupom - vermelho se tem cancelamento */}
                                        <tr
                                          className={`cursor-pointer transition-colors ${
                                            cupom.FLG_CANCELADO === 'S'
                                              ? 'bg-red-100 hover:bg-red-200 line-through'
                                              : cupom.QTD_ITENS_CANCELADOS > 0
                                                ? 'bg-red-50 hover:bg-red-100'
                                                : cupom.TOTAL_DESCONTO > 0
                                                  ? 'bg-yellow-50 hover:bg-yellow-100'
                                                  : 'bg-blue-50/50 hover:bg-blue-100/50'
                                          }`}
                                          onClick={() => toggleCupom(cupom.NUM_CUPOM_FISCAL, cupom.COD_LOJA, dia.DATA)}
                                        >
                                          <td className="px-2 py-1">
                                            {loadingItens[cupomKey] ? (
                                              <svg className="w-3 h-3 animate-spin text-blue-500 ml-8" fill="none" viewBox="0 0 24 24">
                                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                                              </svg>
                                            ) : (
                                              <svg className={`w-3 h-3 text-gray-400 ml-8 transition-transform ${expandedCupons[cupomKey] ? 'rotate-90' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                              </svg>
                                            )}
                                          </td>
                                          <td colSpan={visibleColumns.length} className="px-3 py-1 text-sm">
                                            <div className="flex items-center gap-4 pl-8">
                                              <span className="text-blue-600 font-medium">🧾 Cupom #{cupom.NUM_CUPOM_FISCAL}</span>
                                              <span className="text-gray-500">{cupom.DATA_HORA}</span>
                                              <span className={`font-medium ${cupom.FLG_CANCELADO === 'S' ? 'text-red-500' : 'text-green-600'}`}>
                                                {formatCurrency(cupom.VALOR_CUPOM)}
                                              </span>
                                              {cupom.QTD_ITENS_TOTAL > 0 && (
                                                <span className="text-gray-400 text-xs">
                                                  ({cupom.QTD_ITENS_TOTAL} {cupom.QTD_ITENS_TOTAL === 1 ? 'item' : 'itens'})
                                                </span>
                                              )}
                                              {cupom.TOTAL_DESCONTO > 0 && (
                                                <span className="bg-yellow-100 text-yellow-700 text-xs px-2 py-0.5 rounded flex items-center gap-1">
                                                  🏷️ Desc: {formatCurrency(cupom.TOTAL_DESCONTO)}
                                                  {cupom.QTD_ITENS_DESCONTO > 0 && (
                                                    <span className="text-yellow-600">({cupom.QTD_ITENS_DESCONTO})</span>
                                                  )}
                                                </span>
                                              )}
                                              {cupom.QTD_ITENS_CANCELADOS > 0 && (
                                                <span className="bg-red-100 text-red-600 text-xs px-2 py-0.5 rounded flex items-center gap-1">
                                                  ❌ Cancel: {formatCurrency(cupom.TOTAL_CANCELADO)}
                                                  <span>({cupom.QTD_ITENS_CANCELADOS} {cupom.QTD_ITENS_CANCELADOS === 1 ? 'item' : 'itens'})</span>
                                                </span>
                                              )}
                                              {cupom.FLG_CANCELADO === 'S' && (
                                                <span className="bg-red-200 text-red-700 text-xs px-2 py-0.5 rounded font-bold">CUPOM CANCELADO</span>
                                              )}
                                            </div>
                                          </td>
                                        </tr>

                                        {/* Linhas de itens do cupom */}
                                        {expandedCupons[cupomKey] && cupomItens[cupomKey] && (
                                          cupomItens[cupomKey].map((item, itemIndex) => (
                                            <tr
                                              key={`item-${itemIndex}`}
                                              className={`${
                                                item.FLG_ESTORNADO === 'S'
                                                  ? 'bg-red-100 line-through'
                                                  : item.VAL_DESCONTO > 0
                                                    ? 'bg-yellow-50'
                                                    : 'bg-gray-50/80'
                                              }`}
                                            >
                                              <td className="px-2 py-1"></td>
                                              <td colSpan={visibleColumns.length} className="px-3 py-1 text-xs">
                                                <div className="flex items-center gap-4 pl-12">
                                                  <span className={`w-8 ${item.FLG_ESTORNADO === 'S' ? 'text-red-400' : 'text-gray-400'}`}>#{item.NUM_SEQ_ITEM}</span>
                                                  <span className={`w-16 ${item.FLG_ESTORNADO === 'S' ? 'text-red-500' : 'text-gray-600'}`}>{item.COD_PRODUTO}</span>
                                                  <span className={`flex-1 truncate max-w-xs ${item.FLG_ESTORNADO === 'S' ? 'text-red-600' : 'text-gray-800'}`}>{item.DES_PRODUTO}</span>
                                                  <span className={`w-12 text-right ${item.FLG_ESTORNADO === 'S' ? 'text-red-400' : 'text-gray-500'}`}>{Number(item.QTD_PRODUTO).toFixed(3)}x</span>
                                                  <span className={`w-20 text-right ${item.FLG_ESTORNADO === 'S' ? 'text-red-400' : 'text-gray-500'}`}>{formatCurrency(item.VAL_UNITARIO)}</span>
                                                  <span className={`w-24 text-right font-medium ${item.FLG_ESTORNADO === 'S' ? 'text-red-600' : 'text-gray-800'}`}>
                                                    {formatCurrency(item.VAL_TOTAL_PRODUTO)}
                                                  </span>
                                                  {item.VAL_DESCONTO > 0 && (
                                                    <span className="bg-yellow-200 text-yellow-800 text-xs px-1.5 py-0.5 rounded font-medium">
                                                      🏷️ -{formatCurrency(item.VAL_DESCONTO)}
                                                    </span>
                                                  )}
                                                  {item.ITEM_ESTORNO === 'S' ? (
                                                    <span className="bg-red-300 text-red-800 text-xs px-1.5 py-0.5 rounded font-bold">🔄 ESTORNADO</span>
                                                  ) : item.FLG_ESTORNADO === 'S' && (
                                                    <span className="bg-red-200 text-red-700 text-xs px-1.5 py-0.5 rounded font-bold">❌ CANCELADO</span>
                                                  )}
                                                </div>
                                              </td>
                                            </tr>
                                          ))
                                        )}
                                      </React.Fragment>
                                    );
                                  })
                                )}
                              </React.Fragment>
                            );
                          })
                        )}
                      </React.Fragment>
                    ))}

                    {/* Linha de totais */}
                    {totais && (
                      <tr className="bg-gray-100 font-medium">
                        <td className="px-2 py-3"></td>
                        {visibleColumns.map(column => (
                          <td
                            key={column.id}
                            className={`px-3 py-3 whitespace-nowrap text-sm ${column.align === 'right' ? 'text-right' : 'text-left'} text-gray-900 font-semibold`}
                          >
                            {column.id === 'DES_OPERADOR' ? (
                              <span>TOTAIS ({totais.TOTAL_OPERADORES} colaboradores)</span>
                            ) : column.id === 'VAL_SOBRA' ? (
                              <span className="text-green-600 font-bold">{formatCurrency(totais.TOTAL_SOBRA)}</span>
                            ) : column.id === 'VAL_QUEBRA' ? (
                              <span className="text-red-600 font-bold">{formatCurrency(totais.TOTAL_QUEBRA)}</span>
                            ) : column.isMeta || column.isAusencia || column.isHoras || column.id === 'CUPONS_POR_HORA' ? (
                              <span className="text-gray-400">-</span>
                            ) : (
                              renderCellValue(totais, column.id)
                            )}
                          </td>
                        ))}
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Modal de Configuração de Metas */}
      {showMetaConfigModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
            {/* Header do Modal */}
            <div className="bg-purple-600 text-white px-6 py-4 flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold">Configuração de Metas</h2>
                <p className="text-purple-200 text-sm">Defina as metas para cada operador</p>
              </div>
              <button
                onClick={() => setShowMetaConfigModal(false)}
                className="p-2 hover:bg-purple-500 rounded-lg transition-colors"
              >
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Configuração Global */}
            <div className="px-6 py-4 bg-purple-50 border-b">
              <h3 className="font-semibold text-purple-800 mb-3">Meta Global (aplicada a todos os operadores sem config individual)</h3>
              <div className="flex flex-wrap gap-4">
                {/* Venda Mínima Global */}
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="global-venda"
                    checked={metaGlobal.vendaMinima?.enabled || false}
                    onChange={(e) => saveMetaGlobal({
                      ...metaGlobal,
                      vendaMinima: { ...metaGlobal.vendaMinima, enabled: e.target.checked }
                    })}
                    className="w-4 h-4 text-purple-600 rounded focus:ring-purple-500"
                  />
                  <label htmlFor="global-venda" className="text-sm text-gray-700">Venda Mín:</label>
                  <div className="relative">
                    <span className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-500 text-sm">R$</span>
                    <input
                      type="number"
                      value={metaGlobal.vendaMinima?.value || 0}
                      onChange={(e) => saveMetaGlobal({
                        ...metaGlobal,
                        vendaMinima: { ...metaGlobal.vendaMinima, value: parseFloat(e.target.value) || 0 }
                      })}
                      className="w-24 pl-8 pr-2 py-1 border rounded text-sm focus:ring-purple-500 focus:border-purple-500"
                      disabled={!metaGlobal.vendaMinima?.enabled}
                    />
                  </div>
                </div>

                {/* Desconto Máximo Global */}
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="global-desconto"
                    checked={metaGlobal.descontoMaximo?.enabled || false}
                    onChange={(e) => saveMetaGlobal({
                      ...metaGlobal,
                      descontoMaximo: { ...metaGlobal.descontoMaximo, enabled: e.target.checked }
                    })}
                    className="w-4 h-4 text-purple-600 rounded focus:ring-purple-500"
                  />
                  <label htmlFor="global-desconto" className="text-sm text-gray-700">Desc. Máx:</label>
                  <div className="relative">
                    <span className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-500 text-sm">R$</span>
                    <input
                      type="number"
                      value={metaGlobal.descontoMaximo?.value || 0}
                      onChange={(e) => saveMetaGlobal({
                        ...metaGlobal,
                        descontoMaximo: { ...metaGlobal.descontoMaximo, value: parseFloat(e.target.value) || 0 }
                      })}
                      className="w-24 pl-8 pr-2 py-1 border rounded text-sm focus:ring-purple-500 focus:border-purple-500"
                      disabled={!metaGlobal.descontoMaximo?.enabled}
                    />
                  </div>
                </div>

                {/* % Cancelamento Máximo Global */}
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="global-cancel"
                    checked={metaGlobal.pctCancelamentoMax?.enabled || false}
                    onChange={(e) => saveMetaGlobal({
                      ...metaGlobal,
                      pctCancelamentoMax: { ...metaGlobal.pctCancelamentoMax, enabled: e.target.checked }
                    })}
                    className="w-4 h-4 text-purple-600 rounded focus:ring-purple-500"
                  />
                  <label htmlFor="global-cancel" className="text-sm text-gray-700">% Canc. Máx:</label>
                  <input
                    type="number"
                    step="0.1"
                    value={metaGlobal.pctCancelamentoMax?.value || 0}
                    onChange={(e) => saveMetaGlobal({
                      ...metaGlobal,
                      pctCancelamentoMax: { ...metaGlobal.pctCancelamentoMax, value: parseFloat(e.target.value) || 0 }
                    })}
                    className="w-16 px-2 py-1 border rounded text-sm focus:ring-purple-500 focus:border-purple-500"
                    disabled={!metaGlobal.pctCancelamentoMax?.enabled}
                  />
                  <span className="text-gray-500 text-sm">%</span>
                </div>

                {/* Sobra Máxima Global */}
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="global-sobra"
                    checked={metaGlobal.sobraMaxima?.enabled || false}
                    onChange={(e) => saveMetaGlobal({
                      ...metaGlobal,
                      sobraMaxima: { ...metaGlobal.sobraMaxima, enabled: e.target.checked }
                    })}
                    className="w-4 h-4 text-green-600 rounded focus:ring-green-500"
                  />
                  <label htmlFor="global-sobra" className="text-sm text-gray-700">Sobra Máx:</label>
                  <div className="relative">
                    <span className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-500 text-sm">R$</span>
                    <input
                      type="number"
                      value={metaGlobal.sobraMaxima?.value || 0}
                      onChange={(e) => saveMetaGlobal({
                        ...metaGlobal,
                        sobraMaxima: { ...metaGlobal.sobraMaxima, value: parseFloat(e.target.value) || 0 }
                      })}
                      className="w-24 pl-8 pr-2 py-1 border rounded text-sm focus:ring-green-500 focus:border-green-500"
                      disabled={!metaGlobal.sobraMaxima?.enabled}
                    />
                  </div>
                </div>

                {/* Quebra Máxima Global */}
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="global-quebra"
                    checked={metaGlobal.quebraMaxima?.enabled || false}
                    onChange={(e) => saveMetaGlobal({
                      ...metaGlobal,
                      quebraMaxima: { ...metaGlobal.quebraMaxima, enabled: e.target.checked }
                    })}
                    className="w-4 h-4 text-red-600 rounded focus:ring-red-500"
                  />
                  <label htmlFor="global-quebra" className="text-sm text-gray-700">Quebra Máx:</label>
                  <div className="relative">
                    <span className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-500 text-sm">R$</span>
                    <input
                      type="number"
                      value={metaGlobal.quebraMaxima?.value || 0}
                      onChange={(e) => saveMetaGlobal({
                        ...metaGlobal,
                        quebraMaxima: { ...metaGlobal.quebraMaxima, value: parseFloat(e.target.value) || 0 }
                      })}
                      className="w-24 pl-8 pr-2 py-1 border rounded text-sm focus:ring-red-500 focus:border-red-500"
                      disabled={!metaGlobal.quebraMaxima?.enabled}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Lista de Operadores */}
            <div className="flex-1 overflow-auto px-6 py-4">
              <h3 className="font-semibold text-gray-800 mb-3">Configuração Individual por Operador</h3>

              {data.length === 0 ? (
                <p className="text-gray-500 text-center py-8">Faça uma busca primeiro para ver os operadores.</p>
              ) : (
                <div className="space-y-3">
                  {sortedData.map((row) => {
                    const opConfig = metaConfig[row.COD_OPERADOR] || {
                      vendaMinima: { enabled: false, value: 0 },
                      descontoMaximo: { enabled: false, value: 0 },
                      pctCancelamentoMax: { enabled: false, value: 0 },
                      sobraMaxima: { enabled: false, value: 0 },
                      quebraMaxima: { enabled: false, value: 0 }
                    };

                    const updateOpConfig = (newConfig) => {
                      saveMetaConfig({
                        ...metaConfig,
                        [row.COD_OPERADOR]: newConfig
                      });
                    };

                    return (
                      <div key={row.COD_OPERADOR} className="bg-gray-50 rounded-lg p-3 border">
                        <div className="flex items-center gap-3 flex-wrap">
                          {/* Nome do Operador */}
                          <div className="min-w-[150px]">
                            <span className="font-medium text-gray-800 text-sm">{row.DES_OPERADOR}</span>
                            <span className="text-xs text-gray-400 ml-1">#{row.COD_OPERADOR}</span>
                          </div>

                          {/* Venda Mínima */}
                          <div className="flex items-center gap-1">
                            <input
                              type="checkbox"
                              checked={opConfig.vendaMinima?.enabled || false}
                              onChange={(e) => updateOpConfig({
                                ...opConfig,
                                vendaMinima: { ...opConfig.vendaMinima, enabled: e.target.checked }
                              })}
                              className="w-3 h-3 text-green-600 rounded focus:ring-green-500"
                            />
                            <span className="text-xs text-gray-600">Venda:</span>
                            <div className="relative">
                              <span className="absolute left-1 top-1/2 -translate-y-1/2 text-gray-400 text-xs">R$</span>
                              <input
                                type="number"
                                value={opConfig.vendaMinima?.value || 0}
                                onChange={(e) => updateOpConfig({
                                  ...opConfig,
                                  vendaMinima: { ...opConfig.vendaMinima, value: parseFloat(e.target.value) || 0 }
                                })}
                                className="w-20 pl-5 pr-1 py-0.5 border rounded text-xs focus:ring-green-500 focus:border-green-500"
                                disabled={!opConfig.vendaMinima?.enabled}
                              />
                            </div>
                          </div>

                          {/* Desconto Máximo */}
                          <div className="flex items-center gap-1">
                            <input
                              type="checkbox"
                              checked={opConfig.descontoMaximo?.enabled || false}
                              onChange={(e) => updateOpConfig({
                                ...opConfig,
                                descontoMaximo: { ...opConfig.descontoMaximo, enabled: e.target.checked }
                              })}
                              className="w-3 h-3 text-yellow-600 rounded focus:ring-yellow-500"
                            />
                            <span className="text-xs text-gray-600">Desc:</span>
                            <div className="relative">
                              <span className="absolute left-1 top-1/2 -translate-y-1/2 text-gray-400 text-xs">R$</span>
                              <input
                                type="number"
                                value={opConfig.descontoMaximo?.value || 0}
                                onChange={(e) => updateOpConfig({
                                  ...opConfig,
                                  descontoMaximo: { ...opConfig.descontoMaximo, value: parseFloat(e.target.value) || 0 }
                                })}
                                className="w-20 pl-5 pr-1 py-0.5 border rounded text-xs focus:ring-yellow-500 focus:border-yellow-500"
                                disabled={!opConfig.descontoMaximo?.enabled}
                              />
                            </div>
                          </div>

                          {/* % Cancelamento Máximo */}
                          <div className="flex items-center gap-1">
                            <input
                              type="checkbox"
                              checked={opConfig.pctCancelamentoMax?.enabled || false}
                              onChange={(e) => updateOpConfig({
                                ...opConfig,
                                pctCancelamentoMax: { ...opConfig.pctCancelamentoMax, enabled: e.target.checked }
                              })}
                              className="w-3 h-3 text-red-600 rounded focus:ring-red-500"
                            />
                            <span className="text-xs text-gray-600">%Canc:</span>
                            <input
                              type="number"
                              step="0.1"
                              value={opConfig.pctCancelamentoMax?.value || 0}
                              onChange={(e) => updateOpConfig({
                                ...opConfig,
                                pctCancelamentoMax: { ...opConfig.pctCancelamentoMax, value: parseFloat(e.target.value) || 0 }
                              })}
                              className="w-14 px-1 py-0.5 border rounded text-xs focus:ring-red-500 focus:border-red-500"
                              disabled={!opConfig.pctCancelamentoMax?.enabled}
                            />
                            <span className="text-xs text-gray-400">%</span>
                          </div>

                          {/* Sobra Máxima */}
                          <div className="flex items-center gap-1">
                            <input
                              type="checkbox"
                              checked={opConfig.sobraMaxima?.enabled || false}
                              onChange={(e) => updateOpConfig({
                                ...opConfig,
                                sobraMaxima: { ...opConfig.sobraMaxima, enabled: e.target.checked }
                              })}
                              className="w-3 h-3 text-green-600 rounded focus:ring-green-500"
                            />
                            <span className="text-xs text-gray-600">Sobra:</span>
                            <div className="relative">
                              <span className="absolute left-1 top-1/2 -translate-y-1/2 text-gray-400 text-xs">R$</span>
                              <input
                                type="number"
                                value={opConfig.sobraMaxima?.value || 0}
                                onChange={(e) => updateOpConfig({
                                  ...opConfig,
                                  sobraMaxima: { ...opConfig.sobraMaxima, value: parseFloat(e.target.value) || 0 }
                                })}
                                className="w-20 pl-5 pr-1 py-0.5 border rounded text-xs focus:ring-green-500 focus:border-green-500"
                                disabled={!opConfig.sobraMaxima?.enabled}
                              />
                            </div>
                          </div>

                          {/* Quebra Máxima */}
                          <div className="flex items-center gap-1">
                            <input
                              type="checkbox"
                              checked={opConfig.quebraMaxima?.enabled || false}
                              onChange={(e) => updateOpConfig({
                                ...opConfig,
                                quebraMaxima: { ...opConfig.quebraMaxima, enabled: e.target.checked }
                              })}
                              className="w-3 h-3 text-red-600 rounded focus:ring-red-500"
                            />
                            <span className="text-xs text-gray-600">Quebra:</span>
                            <div className="relative">
                              <span className="absolute left-1 top-1/2 -translate-y-1/2 text-gray-400 text-xs">R$</span>
                              <input
                                type="number"
                                value={opConfig.quebraMaxima?.value || 0}
                                onChange={(e) => updateOpConfig({
                                  ...opConfig,
                                  quebraMaxima: { ...opConfig.quebraMaxima, value: parseFloat(e.target.value) || 0 }
                                })}
                                className="w-20 pl-5 pr-1 py-0.5 border rounded text-xs focus:ring-red-500 focus:border-red-500"
                                disabled={!opConfig.quebraMaxima?.enabled}
                              />
                            </div>
                          </div>

                          {/* Botão Limpar Config Individual */}
                          {metaConfig[row.COD_OPERADOR] && (
                            <button
                              onClick={() => {
                                const newConfig = { ...metaConfig };
                                delete newConfig[row.COD_OPERADOR];
                                saveMetaConfig(newConfig);
                              }}
                              className="text-xs text-gray-400 hover:text-red-500 transition-colors"
                              title="Remover config individual (usar global)"
                            >
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Footer do Modal */}
            <div className="px-6 py-4 bg-gray-50 border-t flex justify-end gap-3">
              <button
                onClick={() => {
                  saveMetaConfig({});
                  saveMetaGlobal(defaultMetaGlobal);
                  toast.success('Todas as metas foram resetadas');
                }}
                className="px-4 py-2 text-sm text-red-600 hover:bg-red-50 rounded-lg transition-colors"
              >
                Resetar Tudo
              </button>
              <button
                onClick={() => setShowMetaConfigModal(false)}
                className="px-6 py-2 text-sm bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors font-medium"
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
