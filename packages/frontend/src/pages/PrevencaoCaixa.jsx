import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useLoja } from '../contexts/LojaContext';
import Sidebar from '../components/Sidebar';
import { api } from '../utils/api';
import toast from 'react-hot-toast';
import RadarLoading from '../components/RadarLoading';

// Helpers
function formatDateForInput(date) {
  const d = new Date(date);
  return d.toISOString().split('T')[0];
}

function toApiDate(isoDate) {
  if (!isoDate) return '';
  const [y, m, d] = isoDate.split('-');
  return `${d}/${m}/${y}`;
}

const formatCurrency = (value) => {
  if (value === null || value === undefined) return '-';
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
};

const formatDateTime = (dateStr) => {
  if (!dateStr) return '-';
  return dateStr;
};

export default function PrevencaoCaixa() {
  const { user, logout } = useAuth();
  const { lojaSelecionada } = useLoja();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const [loading, setLoading] = useState(false);
  const [cancelamentos, setCancelamentos] = useState([]);
  const [resumo, setResumo] = useState({
    TOTAL_ITENS: 0, VALOR_ITENS: 0,
    TOTAL_CUPONS: 0, VALOR_CUPONS: 0,
    TOTAL_VENDAS: 0, VALOR_VENDAS: 0,
  });
  const [operadores, setOperadores] = useState([]);
  const [loadingFilters, setLoadingFilters] = useState(true);

  const [filters, setFilters] = useState({
    dataInicio: formatDateForInput(new Date()),
    dataFim: formatDateForInput(new Date()),
    tipo: '',
    codOperador: '',
    numPdv: '',
  });

  // Sort state
  const [sortConfig, setSortConfig] = useState({ key: null, direction: 'asc' });

  // Total count helper
  const totalCancelamentos = (resumo.TOTAL_ITENS || 0) + (resumo.TOTAL_CUPONS || 0) + (resumo.TOTAL_VENDAS || 0);

  // Load operators on mount / store change
  useEffect(() => {
    const loadOperadores = async () => {
      setLoadingFilters(true);
      try {
        const params = new URLSearchParams();
        if (lojaSelecionada) params.append('codLoja', lojaSelecionada);
        const res = await api.get(`/frente-caixa/operadores?${params.toString()}`);
        setOperadores(res.data || []);
      } catch (err) {
        console.error('Erro ao carregar operadores:', err);
      } finally {
        setLoadingFilters(false);
      }
    };
    loadOperadores();
  }, [lojaSelecionada]);

  // Re-buscar quando tipo muda via card
  useEffect(() => {
    if (cancelamentos.length > 0 || resumo.TOTAL_ITENS > 0 || resumo.TOTAL_CUPONS > 0 || resumo.TOTAL_VENDAS > 0) {
      handleSearch();
    }
  }, [filters.tipo]);

  // Fetch summary + cancelamentos
  const handleSearch = async () => {
    setLoading(true);
    try {
      const baseParams = new URLSearchParams();
      baseParams.append('dataInicio', toApiDate(filters.dataInicio));
      baseParams.append('dataFim', toApiDate(filters.dataFim));
      if (lojaSelecionada) baseParams.append('codLoja', lojaSelecionada);

      const cancParams = new URLSearchParams(baseParams);
      if (filters.tipo) cancParams.append('tipo', filters.tipo);
      if (filters.codOperador) cancParams.append('codOperador', filters.codOperador);
      if (filters.numPdv) cancParams.append('numPdv', filters.numPdv);

      const [resumoRes, cancRes] = await Promise.all([
        api.get(`/prevencao-caixa/resumo?${baseParams.toString()}`),
        api.get(`/prevencao-caixa/cancelamentos?${cancParams.toString()}`),
      ]);

      if (resumoRes.data?.success !== false) {
        setResumo(resumoRes.data?.resumo || resumoRes.data?.data || {
          TOTAL_ITENS: 0, VALOR_ITENS: 0,
          TOTAL_CUPONS: 0, VALOR_CUPONS: 0,
          TOTAL_VENDAS: 0, VALOR_VENDAS: 0,
        });
      }

      if (cancRes.data?.success !== false) {
        setCancelamentos(cancRes.data?.data || cancRes.data || []);
        const count = (cancRes.data?.data || cancRes.data || []).length;
        if (count === 0) {
          toast('Nenhum cancelamento encontrado no periodo', { icon: 'i' });
        } else {
          toast.success(`${count} cancelamento(s) encontrado(s)`);
        }
      }
    } catch (error) {
      console.error('Erro ao buscar dados:', error);
      toast.error('Erro ao buscar dados de cancelamentos');
    } finally {
      setLoading(false);
    }
  };

  // Sort handler
  const [expandedCupom, setExpandedCupom] = useState(null); // 'COO-NUM_PDV-DATA'
  const [cupomItens, setCupomItens] = useState([]);
  const [loadingItens, setLoadingItens] = useState(false);

  const toggleCupomExpand = async (row) => {
    const key = `${row.COO}-${row.NUM_PDV}-${row.DATA}`;
    if (expandedCupom === key) {
      setExpandedCupom(null);
      setCupomItens([]);
      return;
    }
    setExpandedCupom(key);
    // VENDA: itens já estão em _itens, não precisa chamar API
    if ((row.TIPO || '').toUpperCase() === 'VENDA' && row._itens) {
      setCupomItens([]);
      return;
    }
    // CUPOM: buscar itens via API (cupom seguinte)
    setLoadingItens(true);
    try {
      const params = new URLSearchParams();
      params.append('numPdv', row.NUM_PDV);
      params.append('data', row.DATA);
      if (lojaSelecionada) params.append('codLoja', lojaSelecionada);
      const res = await api.get(`/prevencao-caixa/cupom-itens/${row.COO}?${params.toString()}`);
      setCupomItens(res.data?.itens || []);
    } catch (err) {
      console.error('Erro ao buscar itens:', err);
      setCupomItens([]);
    } finally {
      setLoadingItens(false);
    }
  };

  const handleSort = (key) => {
    setSortConfig(prev => {
      if (prev.key === key) {
        return { key, direction: prev.direction === 'asc' ? 'desc' : 'asc' };
      }
      return { key, direction: 'asc' };
    });
  };

  // Agrupar vendas do mesmo cupom (TIPO=VENDA com mesmo COO+NUM_PDV+DATA)
  const cancelamentosAgrupados = React.useMemo(() => {
    const grupos = {};
    const resultado = [];
    for (const item of cancelamentos) {
      if ((item.TIPO || '').toUpperCase() === 'VENDA') {
        const key = `${item.COO}-${item.NUM_PDV}-${item.DATA}`;
        if (!grupos[key]) {
          grupos[key] = { ...item, _itens: [{ COD_PRODUTO: item.COD_PRODUTO, DES_PRODUTO: item.DES_PRODUTO, QTD: item.QTD || 1, VALOR: item.VALOR }], VALOR: item.VALOR };
          resultado.push(grupos[key]);
        } else {
          grupos[key]._itens.push({ COD_PRODUTO: item.COD_PRODUTO, DES_PRODUTO: item.DES_PRODUTO, QTD: item.QTD || 1, VALOR: item.VALOR });
          grupos[key].VALOR += item.VALOR;
        }
      } else {
        resultado.push(item);
      }
    }
    return resultado;
  }, [cancelamentos]);

  // Sorted data
  const sortedCancelamentos = React.useMemo(() => {
    if (!sortConfig.key) return cancelamentosAgrupados;
    const sorted = [...cancelamentosAgrupados].sort((a, b) => {
      let aVal = a[sortConfig.key];
      let bVal = b[sortConfig.key];
      if (aVal == null) aVal = '';
      if (bVal == null) bVal = '';
      if (typeof aVal === 'number' && typeof bVal === 'number') {
        return sortConfig.direction === 'asc' ? aVal - bVal : bVal - aVal;
      }
      const strA = String(aVal).toLowerCase();
      const strB = String(bVal).toLowerCase();
      if (strA < strB) return sortConfig.direction === 'asc' ? -1 : 1;
      if (strA > strB) return sortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    });
    return sorted;
  }, [cancelamentos, sortConfig]);

  // Badge for type
  const renderTipoBadge = (tipo) => {
    const t = (tipo || '').toUpperCase();
    if (t === 'ITEM') {
      return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-yellow-100 text-yellow-800 border border-yellow-300">Item</span>;
    }
    if (t === 'CUPOM') {
      return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-red-100 text-red-800 border border-red-300">Cupom</span>;
    }
    if (t === 'VENDA') {
      return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-orange-100 text-orange-800 border border-orange-300">Venda</span>;
    }
    return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-gray-100 text-gray-800">{tipo || '-'}</span>;
  };

  // Sort indicator
  const renderSortIcon = (key) => {
    if (sortConfig.key !== key) {
      return (
        <svg className="w-3 h-3 text-gray-400 ml-1 inline" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
        </svg>
      );
    }
    return sortConfig.direction === 'asc' ? (
      <svg className="w-3 h-3 text-orange-600 ml-1 inline" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
      </svg>
    ) : (
      <svg className="w-3 h-3 text-orange-600 ml-1 inline" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
      </svg>
    );
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
          <h1 className="text-lg font-semibold text-gray-900">Prevencao de Caixa</h1>
          <div className="w-10" />
        </div>

        {/* Header */}
        <div className="bg-gradient-to-br from-red-600 to-orange-600 shadow-lg">
          <div className="px-4 md:px-6 py-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-white mb-1 sm:mb-2">Prevencao de Caixa</h1>
                <p className="text-white/90 text-sm sm:text-base">Cancelamentos de itens, cupons e vendas por operador</p>
              </div>
              <div className="bg-white/20 backdrop-blur-sm rounded-full p-3 hidden lg:block">
                <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                </svg>
              </div>
            </div>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="px-4 md:px-6 py-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Total Cancelamentos */}
            <div onClick={() => setFilters(prev => ({ ...prev, tipo: '' }))} className={`bg-white rounded-xl shadow-sm border p-4 hover:shadow-md transition-shadow cursor-pointer ${filters.tipo === '' ? 'border-gray-400 ring-2 ring-gray-300' : 'border-gray-200'}`}>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-gray-500">Total Cancelamentos</span>
                <div className="bg-gray-100 rounded-full p-2">
                  <svg className="w-5 h-5 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                  </svg>
                </div>
              </div>
              <p className="text-2xl font-bold text-gray-900">{totalCancelamentos}</p>
              <p className="text-xs text-gray-400 mt-1">Itens + Cupons + Vendas</p>
            </div>

            {/* Canc. Item */}
            <div onClick={() => setFilters(prev => ({ ...prev, tipo: prev.tipo === 'ITEM' ? '' : 'ITEM' }))} className={`bg-white rounded-xl shadow-sm border p-4 hover:shadow-md transition-shadow cursor-pointer ${filters.tipo === 'ITEM' ? 'border-yellow-400 ring-2 ring-yellow-300' : 'border-yellow-200'}`}>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-yellow-700">Canc. Item</span>
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-yellow-100 text-yellow-800 border border-yellow-300">
                  {resumo.TOTAL_ITENS || 0}
                </span>
              </div>
              <p className="text-2xl font-bold text-yellow-700">{formatCurrency(resumo.VALOR_ITENS || 0)}</p>
              <p className="text-xs text-yellow-500 mt-1">Valor total itens cancelados</p>
            </div>

            {/* Canc. Cupom */}
            <div onClick={() => setFilters(prev => ({ ...prev, tipo: prev.tipo === 'CUPOM' ? '' : 'CUPOM' }))} className={`bg-white rounded-xl shadow-sm border p-4 hover:shadow-md transition-shadow cursor-pointer ${filters.tipo === 'CUPOM' ? 'border-red-400 ring-2 ring-red-300' : 'border-red-200'}`}>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-red-700">Canc. Cupom</span>
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-red-100 text-red-800 border border-red-300">
                  {resumo.TOTAL_CUPONS || 0}
                </span>
              </div>
              <p className="text-2xl font-bold text-red-700">{formatCurrency(resumo.VALOR_CUPONS || 0)}</p>
              <p className="text-xs text-red-400 mt-1">Valor total cupons cancelados</p>
            </div>

            {/* Canc. Venda */}
            <div onClick={() => setFilters(prev => ({ ...prev, tipo: prev.tipo === 'VENDA' ? '' : 'VENDA' }))} className={`bg-white rounded-xl shadow-sm border p-4 hover:shadow-md transition-shadow cursor-pointer ${filters.tipo === 'VENDA' ? 'border-orange-400 ring-2 ring-orange-300' : 'border-orange-200'}`}>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-orange-700">Canc. Venda</span>
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-orange-100 text-orange-800 border border-orange-300">
                  {resumo.TOTAL_VENDAS || 0}
                </span>
              </div>
              <p className="text-2xl font-bold text-orange-700">{formatCurrency(resumo.VALOR_VENDAS || 0)}</p>
              <p className="text-xs text-orange-400 mt-1">Valor total vendas canceladas</p>
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white border-b border-gray-200 px-4 md:px-6 py-4">
          <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-end gap-3 sm:gap-4">
            {/* Data Inicio */}
            <div className="flex flex-col w-full sm:w-auto">
              <label className="text-xs text-gray-500 mb-1">Data Inicio</label>
              <input
                type="date"
                value={filters.dataInicio}
                onChange={(e) => setFilters(prev => ({ ...prev, dataInicio: e.target.value }))}
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-red-500 focus:border-red-500"
              />
            </div>

            {/* Data Fim */}
            <div className="flex flex-col w-full sm:w-auto">
              <label className="text-xs text-gray-500 mb-1">Data Fim</label>
              <input
                type="date"
                value={filters.dataFim}
                onChange={(e) => setFilters(prev => ({ ...prev, dataFim: e.target.value }))}
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-red-500 focus:border-red-500"
              />
            </div>

            {/* Tipo */}
            <div className="flex flex-col w-full sm:w-auto">
              <label className="text-xs text-gray-500 mb-1">Tipo</label>
              <select
                value={filters.tipo}
                onChange={(e) => setFilters(prev => ({ ...prev, tipo: e.target.value }))}
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-red-500 focus:border-red-500 w-full sm:min-w-[140px]"
              >
                <option value="">Todos</option>
                <option value="ITEM">Item</option>
                <option value="CUPOM">Cupom</option>
                <option value="VENDA">Venda</option>
              </select>
            </div>

            {/* Operador */}
            <div className="flex flex-col w-full sm:w-auto">
              <label className="text-xs text-gray-500 mb-1">Operador</label>
              <select
                value={filters.codOperador}
                onChange={(e) => setFilters(prev => ({ ...prev, codOperador: e.target.value }))}
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-red-500 focus:border-red-500 w-full sm:min-w-[200px]"
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

            {/* PDV */}
            <div className="flex flex-col w-full sm:w-auto">
              <label className="text-xs text-gray-500 mb-1">PDV</label>
              <input
                type="text"
                placeholder="Todos"
                value={filters.numPdv}
                onChange={(e) => setFilters(prev => ({ ...prev, numPdv: e.target.value }))}
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-red-500 focus:border-red-500 w-full sm:w-[100px]"
              />
            </div>

            {/* Buscar */}
            <div className="flex gap-2 w-full sm:w-auto">
              <button
                onClick={handleSearch}
                disabled={loading}
                className="bg-red-600 hover:bg-red-700 text-white px-6 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 w-full sm:w-auto"
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
          </div>
        </div>

        {/* Content */}
        <div className="px-4 md:px-6 py-4">
          {loading ? (
            <RadarLoading message="Buscando cancelamentos..." />
          ) : cancelamentos.length === 0 ? (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
              <svg className="w-16 h-16 text-gray-300 mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
              <p className="text-gray-500 text-lg font-medium">Nenhum cancelamento encontrado</p>
              <p className="text-gray-400 text-sm mt-1">Selecione o periodo e clique em Buscar</p>
            </div>
          ) : (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between">
                <h3 className="text-sm font-semibold text-gray-700">
                  {cancelamentos.length} cancelamento{cancelamentos.length !== 1 ? 's' : ''} encontrado{cancelamentos.length !== 1 ? 's' : ''}
                </h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-200">
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider cursor-pointer hover:bg-gray-100" onClick={() => handleSort('TIPO')}>
                        Tipo {renderSortIcon('TIPO')}
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider cursor-pointer hover:bg-gray-100" onClick={() => handleSort('DATA')}>
                        Data {renderSortIcon('DATA')}
                      </th>
                      <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider cursor-pointer hover:bg-gray-100" onClick={() => handleSort('HORA')}>
                        Hora {renderSortIcon('HORA')}
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider cursor-pointer hover:bg-gray-100" onClick={() => handleSort('COO')}>
                        COO {renderSortIcon('COO')}
                      </th>
                      <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider cursor-pointer hover:bg-gray-100" onClick={() => handleSort('NUM_PDV')}>
                        PDV {renderSortIcon('NUM_PDV')}
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider cursor-pointer hover:bg-gray-100" onClick={() => handleSort('DES_OPERADOR')}>
                        Operador {renderSortIcon('DES_OPERADOR')}
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider cursor-pointer hover:bg-gray-100" onClick={() => handleSort('DES_FISCAL')}>
                        Fiscal {renderSortIcon('DES_FISCAL')}
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider cursor-pointer hover:bg-gray-100" onClick={() => handleSort('DES_PRODUTO')}>
                        Produto {renderSortIcon('DES_PRODUTO')}
                      </th>
                      <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider cursor-pointer hover:bg-gray-100" onClick={() => handleSort('VALOR')}>
                        Valor {renderSortIcon('VALOR')}
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {sortedCancelamentos.map((item, idx) => {
                      const tipo = (item.TIPO || '').toUpperCase();
                      const isExpandable = tipo === 'CUPOM' || (tipo === 'VENDA' && item._itens);
                      const rowKey = `${item.COO}-${item.NUM_PDV}-${item.DATA}`;
                      const isExpanded = expandedCupom === rowKey;
                      return (
                        <React.Fragment key={idx}>
                        <tr
                          onClick={() => isExpandable && toggleCupomExpand(item)}
                          className={`hover:bg-gray-50 transition-colors ${idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'} ${isExpandable ? 'cursor-pointer' : ''} ${isExpanded ? 'bg-blue-50' : ''}`}
                        >
                          <td className="px-4 py-3 whitespace-nowrap">
                            <div className="flex items-center gap-1">
                              {isExpandable && (
                                <svg className={`w-4 h-4 text-gray-400 transition-transform ${isExpanded ? 'rotate-90' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7"/>
                                </svg>
                              )}
                              {renderTipoBadge(item.TIPO)}
                            </div>
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-gray-700">
                            {item.DATA || '-'}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-center text-gray-700 font-mono">
                            {item.HORA || '-'}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-gray-700 font-mono">
                            {item.COO || '-'}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-center text-gray-700 font-mono">
                            {item.NUM_PDV || '-'}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-gray-700">
                            {item.DES_OPERADOR || item.COD_OPERADOR || '-'}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-gray-700">
                            {item.DES_FISCAL || '-'}
                          </td>
                          <td className="px-4 py-3 text-gray-700 max-w-[300px] truncate">
                            {(tipo === 'ITEM' || tipo === 'VENDA')
                              ? `${item.COD_PRODUTO || ''} ${item.DES_PRODUTO || ''}`.trim() || '-'
                              : isExpandable ? <span className="text-blue-500 text-xs">clique para ver itens</span> : '-'
                            }
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-right font-medium text-gray-900">
                            {formatCurrency(item.VALOR)}
                          </td>
                        </tr>
                        {isExpanded && (
                          <tr>
                            <td colSpan={9} className="px-0 py-0">
                              <div className="bg-blue-50 border-l-4 border-blue-400 px-8 py-3">
                                {(() => {
                                  // VENDA: itens já agrupados em _itens
                                  const itensToShow = tipo === 'VENDA' && item._itens ? item._itens : cupomItens;
                                  const isLoading = tipo === 'CUPOM' && loadingItens;
                                  if (isLoading) return <p className="text-sm text-gray-500">Carregando itens...</p>;
                                  if (itensToShow.length === 0) return <p className="text-sm text-gray-500">Nenhum item encontrado</p>;
                                  return (
                                    <table className="w-full text-sm">
                                      <thead>
                                        <tr className="text-xs text-gray-500 uppercase">
                                          <th className="text-left py-1 px-2">Código</th>
                                          <th className="text-left py-1 px-2">Produto</th>
                                          <th className="text-right py-1 px-2">Qtd</th>
                                          <th className="text-right py-1 px-2">Valor</th>
                                        </tr>
                                      </thead>
                                      <tbody>
                                        {itensToShow.map((it, i) => (
                                          <tr key={i} className="border-t border-blue-200">
                                            <td className="py-1 px-2 font-mono text-gray-600">{it.COD_PRODUTO}</td>
                                            <td className="py-1 px-2 text-gray-800">{it.DES_PRODUTO}</td>
                                            <td className="py-1 px-2 text-right text-gray-600">{it.QTD}</td>
                                            <td className="py-1 px-2 text-right font-medium text-gray-900">{formatCurrency(it.VALOR)}</td>
                                          </tr>
                                        ))}
                                      </tbody>
                                    </table>
                                  );
                                })()}
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
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
