import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../contexts/AuthContext';
import Sidebar from '../components/Sidebar';
import { api } from '../utils/api';
import toast from 'react-hot-toast';

// Configuração inicial das colunas
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
  { id: 'VAL_SOBRA', header: 'Sobra Caixa', align: 'right', sortable: true, highlight: 'green' },
  { id: 'VAL_QUEBRA', header: 'Falta Caixa', align: 'right', sortable: true, highlight: 'red' },
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
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState([]);
  const [totais, setTotais] = useState(null);
  const [oracleStatus, setOracleStatus] = useState({ connected: false, message: '' });

  // Estado para ordem das colunas (drag and drop)
  const [columns, setColumns] = useState(() => {
    const savedOrder = localStorage.getItem('frente_caixa_columns_order');
    console.log('🔄 [FrenteCaixa] Carregando ordem de colunas do localStorage:', savedOrder);
    if (savedOrder) {
      try {
        const savedIds = JSON.parse(savedOrder);
        console.log('📋 [FrenteCaixa] IDs salvos:', savedIds);
        const reordered = savedIds
          .map(id => INITIAL_COLUMNS.find(col => col.id === id))
          .filter(Boolean);
        const newColumns = INITIAL_COLUMNS.filter(col => !savedIds.includes(col.id));
        const finalOrder = [...reordered, ...newColumns];
        console.log('✅ [FrenteCaixa] Ordem restaurada:', finalOrder.map(c => c.id));
        return finalOrder;
      } catch (e) {
        console.error('❌ [FrenteCaixa] Erro ao restaurar ordem:', e);
        return INITIAL_COLUMNS;
      }
    }
    console.log('ℹ️ [FrenteCaixa] Nenhuma ordem salva, usando padrão');
    return INITIAL_COLUMNS;
  });

  const [draggedColumn, setDraggedColumn] = useState(null);
  const [dragOverColumn, setDragOverColumn] = useState(null);

  // Sincronizar ordem das colunas com localStorage sempre que mudar
  useEffect(() => {
    const columnIds = columns.map(col => col.id);
    localStorage.setItem('frente_caixa_columns_order', JSON.stringify(columnIds));
  }, [columns]);

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

  // Colunas visíveis (filtrando as ocultas)
  const visibleColumns = useMemo(() => {
    return columns.filter(col => !hiddenColumns.includes(col.id));
  }, [columns, hiddenColumns]);

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
          const opRes = await api.get('/frente-caixa/operadores');
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
  }, []);

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

  // Dados ordenados
  const sortedData = useMemo(() => {
    if (!sortConfig.key) return data;

    return [...data].sort((a, b) => {
      const aVal = a[sortConfig.key];
      const bVal = b[sortConfig.key];

      if (typeof aVal === 'string') {
        return sortConfig.direction === 'asc'
          ? aVal.localeCompare(bVal)
          : bVal.localeCompare(aVal);
      }

      return sortConfig.direction === 'asc' ? aVal - bVal : bVal - aVal;
    });
  }, [data, sortConfig]);

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

    const newColumns = [...columns];
    const draggedIndex = newColumns.findIndex(col => col.id === draggedColumn);
    const targetIndex = newColumns.findIndex(col => col.id === targetColumnId);

    const [removed] = newColumns.splice(draggedIndex, 1);
    newColumns.splice(targetIndex, 0, removed);

    setColumns(newColumns);
    setDraggedColumn(null);
    setDragOverColumn(null);

    // Salvar ordem no localStorage
    const columnIds = newColumns.map(col => col.id);
    console.log('💾 [FrenteCaixa] Salvando ordem de colunas:', columnIds);
    localStorage.setItem('frente_caixa_columns_order', JSON.stringify(columnIds));

    // Verificar se salvou corretamente
    const saved = localStorage.getItem('frente_caixa_columns_order');
    console.log('✅ [FrenteCaixa] Ordem salva no localStorage:', saved);
    toast.success('Ordem das colunas salva!');
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
    return ((row.CANCELAMENTOS || 0) / row.TOTAL_VENDAS) * 100;
  };

  const calcPctValeTroca = (row) => {
    if (!row.TOTAL_VENDAS || row.TOTAL_VENDAS === 0) return 0;
    return ((row.VALE_TROCA || 0) / row.TOTAL_VENDAS) * 100;
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
      case 'PCT_VALE_TROCA':
        return formatPercent(calcPctValeTroca(row));
      default:
        return formatCurrency(value);
    }
  };

  // Obter classe de cor para célula
  const getCellClass = (column, value) => {
    if (column.highlight === 'green' && value > 0) return 'text-green-600 font-medium';
    if (column.highlight === 'red' && value > 0) return 'text-red-600 font-medium';
    if (column.highlight === 'yellow' && value > 0) return 'text-yellow-600 font-medium';
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

            {/* Spacer para empurrar botões para direita */}
            <div className="flex-1" />

            {/* Botões Config e PDF */}
            <div className="flex gap-2 items-end">
              {/* Botão Configurar Colunas */}
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
            Dica: Arraste os cabeçalhos das colunas para reordená-las. Clique para ordenar A-Z. Use o botão de engrenagem para ocultar colunas.
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

              {/* Cancelamentos */}
              <div className="bg-white rounded-lg shadow p-3 border-l-4 border-orange-500">
                <p className="text-xs text-gray-500 font-medium">Cancelamentos</p>
                <p className="text-lg font-bold text-orange-600">{formatCurrency(totais.CANCELAMENTOS || 0)}</p>
                <p className="text-xs text-orange-500">
                  {totais.TOTAL_VENDAS ? ((totais.CANCELAMENTOS || 0) / totais.TOTAL_VENDAS * 100).toFixed(2) : '0.00'}%
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

        {/* Tabela */}
        <div className="p-4 md:p-6">
          {data.length === 0 ? (
            <div className="bg-white rounded-lg shadow p-8 text-center text-gray-500">
              {loading ? 'Carregando...' : 'Selecione os filtros e clique em Buscar para visualizar os dados.'}
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
    </div>
  );
}
