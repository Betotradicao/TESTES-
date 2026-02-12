import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import Layout from '../components/Layout';
import api from '../services/api';
import { useLoja } from '../contexts/LojaContext';

const STORAGE_KEY_COLUMNS = 'notasAChegar_columnOrder';
const STORAGE_KEY_SORT = 'notasAChegar_sort';

// Column definitions
const ALL_COLUMNS = [
  { key: 'idx', label: '#', align: 'left', width: '40px' },
  { key: 'status', label: 'STATUS', align: 'center', width: '70px' },
  { key: 'efetivada', label: 'EFETIVADA', align: 'center', width: '80px' },
  { key: 'validada', label: 'VALIDADA', align: 'center', width: '80px' },
  { key: 'manifesto', label: 'MANIFESTO', align: 'center', width: '110px' },
  { key: 'num_nf', label: 'N. NF', align: 'left', width: '90px' },
  { key: 'serie', label: 'SERIE', align: 'center', width: '60px' },
  { key: 'cnpj', label: 'CNPJ', align: 'left', width: '160px' },
  { key: 'fornecedor', label: 'FORNECEDOR', align: 'left', width: '250px' },
  { key: 'data_emissao', label: 'EMISSAO', align: 'center', width: '100px' },
  { key: 'data_processamento', label: 'PROCESSADO', align: 'center', width: '100px' },
  { key: 'valor_total', label: 'VALOR (R$)', align: 'right', width: '120px' },
  { key: 'usuario_validacao', label: 'VALIDADOR', align: 'left', width: '120px' },
  { key: 'data_validacao', label: 'DT VALIDACAO', align: 'center', width: '130px' },
  { key: 'chave_acesso', label: 'CHAVE ACESSO', align: 'left', width: '200px' },
];

const DEFAULT_COLUMN_ORDER = ALL_COLUMNS.map(c => c.key);

function loadColumnOrder() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY_COLUMNS);
    if (saved) {
      const parsed = JSON.parse(saved);
      // Only keep keys that exist in current column definitions
      const allKeys = new Set(DEFAULT_COLUMN_ORDER);
      const validKeys = parsed.filter(k => allKeys.has(k));
      // Add any new/missing keys at the end
      const missing = DEFAULT_COLUMN_ORDER.filter(k => !validKeys.includes(k));
      if (validKeys.length === 0) return DEFAULT_COLUMN_ORDER;
      return [...validKeys, ...missing];
    }
  } catch {}
  return DEFAULT_COLUMN_ORDER;
}

function loadSortState() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY_SORT);
    if (saved) return JSON.parse(saved);
  } catch {}
  return { column: null, direction: 'asc' };
}

export default function NotasAChegar() {
  const { lojaSelecionada } = useLoja();
  const [notas, setNotas] = useState([]);
  const [stats, setStats] = useState({ total: 0, efetivadas: 0, pendentes: 0, valorTotal: 0 });
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    tipo_data: 'emissao',
    data_de: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0],
    data_ate: new Date().toISOString().split('T')[0],
    fornecedor: '',
    efetivadas: 'com',
    validadas: 'todos'
  });

  // Column order and sort state (persisted)
  const [columnOrder, setColumnOrder] = useState(loadColumnOrder);
  const [sortState, setSortState] = useState(loadSortState);

  // Drag state
  const dragColRef = useRef(null);
  const dragOverColRef = useRef(null);
  const [draggingCol, setDraggingCol] = useState(null);

  // Save column order to localStorage
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY_COLUMNS, JSON.stringify(columnOrder));
  }, [columnOrder]);

  // Save sort state to localStorage
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY_SORT, JSON.stringify(sortState));
  }, [sortState]);

  const fetchNotas = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filters.tipo_data) params.append('tipo_data', filters.tipo_data);
      if (filters.data_de) params.append('data_de', filters.data_de);
      if (filters.data_ate) params.append('data_ate', filters.data_ate);
      if (filters.fornecedor) params.append('fornecedor', filters.fornecedor);
      if (filters.efetivadas) params.append('efetivadas', filters.efetivadas);
      if (filters.validadas) params.append('validadas', filters.validadas);
      if (lojaSelecionada) params.append('cod_loja', lojaSelecionada);

      const res = await api.get(`/nota-fiscal-recebimento/notas-a-chegar?${params.toString()}`);
      setNotas(res.data?.notas || []);
      setStats(res.data?.stats || { total: 0, efetivadas: 0, pendentes: 0, valorTotal: 0 });
    } catch (err) {
      console.error('Erro ao buscar notas a chegar:', err);
    } finally {
      setLoading(false);
    }
  }, [filters, lojaSelecionada]);

  useEffect(() => { fetchNotas(); }, [fetchNotas]);

  const formatCnpj = (cnpj) => {
    if (!cnpj) return '-';
    const nums = cnpj.replace(/\D/g, '');
    if (nums.length === 14) return nums.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5');
    return cnpj;
  };

  const formatCurrency = (val) => {
    if (!val && val !== 0) return '-';
    return parseFloat(val).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  };

  const formatDate = (dt) => {
    if (!dt) return '-';
    const d = new Date(dt);
    return d.toLocaleDateString('pt-BR');
  };

  const formatDateTime = (dt) => {
    if (!dt) return '-';
    const d = new Date(dt);
    return d.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' });
  };

  // Get sortable value for a given column key
  const getSortValue = (nf, key, idx) => {
    switch (key) {
      case 'idx': return idx;
      case 'status': return nf.efetivada && nf.confirmada ? 2 : nf.efetivada ? 1 : 0;
      case 'efetivada': return nf.efetivada ? 1 : 0;
      case 'validada': return nf.confirmada ? 1 : 0;
      case 'manifesto': return String(nf.manifesto || '');
      case 'num_nf': return String(nf.num_nf || '');
      case 'serie': return String(nf.serie || '');
      case 'cnpj': return String(nf.cnpj || '').replace(/\D/g, '');
      case 'fornecedor': return String(nf.fornecedor || '').toLowerCase();
      case 'data_emissao': return nf.data_emissao ? new Date(nf.data_emissao).getTime() : 0;
      case 'data_processamento': return nf.data_processamento ? new Date(nf.data_processamento).getTime() : 0;
      case 'valor_total': return parseFloat(nf.valor_total) || 0;
      case 'usuario_validacao': return String(nf.usuario_validacao || '').toLowerCase();
      case 'data_validacao': return nf.data_validacao ? new Date(nf.data_validacao).getTime() : 0;
      case 'chave_acesso': return String(nf.chave_acesso || '');
      default: return '';
    }
  };

  // Sorted notas
  const sortedNotas = useMemo(() => {
    if (!sortState.column) return notas;
    const { column, direction } = sortState;
    const sorted = [...notas].sort((a, b) => {
      const aVal = getSortValue(a, column, notas.indexOf(a));
      const bVal = getSortValue(b, column, notas.indexOf(b));
      if (typeof aVal === 'number' && typeof bVal === 'number') {
        return direction === 'asc' ? aVal - bVal : bVal - aVal;
      }
      const aStr = String(aVal);
      const bStr = String(bVal);
      return direction === 'asc' ? aStr.localeCompare(bStr, 'pt-BR') : bStr.localeCompare(aStr, 'pt-BR');
    });
    return sorted;
  }, [notas, sortState]);

  // Ordered columns
  const orderedColumns = useMemo(() => {
    const colMap = {};
    ALL_COLUMNS.forEach(c => colMap[c.key] = c);
    return columnOrder.map(key => colMap[key]).filter(Boolean);
  }, [columnOrder]);

  // Sort handler
  const handleSort = (colKey) => {
    setSortState(prev => {
      if (prev.column === colKey) {
        // Toggle: asc -> desc -> none
        if (prev.direction === 'asc') return { column: colKey, direction: 'desc' };
        return { column: null, direction: 'asc' };
      }
      return { column: colKey, direction: 'asc' };
    });
  };

  // Drag handlers for column reordering
  const handleDragStart = (e, colKey) => {
    dragColRef.current = colKey;
    setDraggingCol(colKey);
    e.dataTransfer.effectAllowed = 'move';
    // Use a transparent drag image
    const ghost = document.createElement('div');
    ghost.style.opacity = '0';
    document.body.appendChild(ghost);
    e.dataTransfer.setDragImage(ghost, 0, 0);
    setTimeout(() => document.body.removeChild(ghost), 0);
  };

  const handleDragOver = (e, colKey) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    dragOverColRef.current = colKey;
  };

  const handleDrop = (e, colKey) => {
    e.preventDefault();
    const fromKey = dragColRef.current;
    const toKey = colKey;
    if (fromKey && toKey && fromKey !== toKey) {
      setColumnOrder(prev => {
        const newOrder = [...prev];
        const fromIdx = newOrder.indexOf(fromKey);
        const toIdx = newOrder.indexOf(toKey);
        newOrder.splice(fromIdx, 1);
        newOrder.splice(toIdx, 0, fromKey);
        return newOrder;
      });
    }
    dragColRef.current = null;
    dragOverColRef.current = null;
    setDraggingCol(null);
  };

  const handleDragEnd = () => {
    dragColRef.current = null;
    dragOverColRef.current = null;
    setDraggingCol(null);
  };

  // Render sort icon
  const renderSortIcon = (colKey) => {
    if (sortState.column !== colKey) {
      return (
        <svg className="w-3 h-3 ml-1 opacity-40 inline-block" viewBox="0 0 12 12" fill="currentColor">
          <path d="M6 1L9 5H3L6 1Z" />
          <path d="M6 11L3 7H9L6 11Z" />
        </svg>
      );
    }
    if (sortState.direction === 'asc') {
      return (
        <svg className="w-3 h-3 ml-1 inline-block" viewBox="0 0 12 12" fill="currentColor">
          <path d="M6 1L9 5H3L6 1Z" />
        </svg>
      );
    }
    return (
      <svg className="w-3 h-3 ml-1 inline-block" viewBox="0 0 12 12" fill="currentColor">
        <path d="M6 11L3 7H9L6 11Z" />
      </svg>
    );
  };

  // Render cell based on column key
  const renderCell = (nf, col, idx) => {
    switch (col.key) {
      case 'idx':
        return <span className="text-gray-400 font-mono text-xs">{idx + 1}</span>;
      case 'status': {
        const isCancelada = nf.status_nfe == 101 || nf.status_nfe == 110;
        if (nf.efetivada && nf.confirmada) {
          return <span className="inline-block w-3.5 h-3.5 rounded-full bg-green-500" title="Efetivada e Validada"></span>;
        }
        if (nf.efetivada) {
          return <span className="inline-block w-3.5 h-3.5 rounded-full bg-blue-500" title="Efetivada, nao validada"></span>;
        }
        if (isCancelada) {
          return <span className="inline-block w-3.5 h-3.5 rounded-full bg-red-500" title={nf.status_nfe == 101 ? 'NFe Cancelada' : 'NFe Denegada'}></span>;
        }
        return <span className="inline-block w-3.5 h-3.5 rounded-full bg-yellow-500" title="Pendente"></span>;
      }
      case 'efetivada':
        return nf.efetivada ? (
          <span className="text-green-700 font-semibold text-xs">Sim</span>
        ) : (
          <span className="text-red-600 font-semibold text-xs">Nao</span>
        );
      case 'validada':
        return nf.confirmada ? (
          <span className="text-green-700 font-semibold text-xs">Sim</span>
        ) : (
          <span className="text-red-600 font-semibold text-xs">Nao</span>
        );
      case 'manifesto':
        if (!nf.manifesto) return <span className="text-gray-400 text-xs">-</span>;
        return (
          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
            nf.manifesto === 'Confirmacao' ? 'bg-green-100 text-green-700' :
            nf.manifesto === 'Ciencia' ? 'bg-blue-100 text-blue-700' :
            nf.manifesto === 'Desconhecimento' ? 'bg-red-100 text-red-700' :
            nf.manifesto === 'Op. Nao Realiz.' ? 'bg-orange-100 text-orange-700' :
            'bg-gray-100 text-gray-600'
          }`}>
            {nf.manifesto}
          </span>
        );
      case 'num_nf':
        return <span className="font-semibold text-gray-900 text-xs">{nf.num_nf}</span>;
      case 'serie':
        return <span className="text-gray-600 text-xs">{nf.serie || '-'}</span>;
      case 'cnpj':
        return <span className="text-gray-600 text-xs font-mono">{formatCnpj(nf.cnpj)}</span>;
      case 'fornecedor':
        return <span className="text-gray-700 text-xs max-w-[250px] truncate block" title={nf.fornecedor}>{nf.fornecedor || '-'}</span>;
      case 'data_emissao':
        return <span className="text-gray-700 text-xs">{formatDate(nf.data_emissao)}</span>;
      case 'data_processamento':
        return nf.data_processamento ? (
          <span className="text-gray-600 text-xs">{formatDateTime(nf.data_processamento)}</span>
        ) : (
          <span className="text-gray-400 text-xs">-</span>
        );
      case 'valor_total':
        return <span className="font-semibold text-gray-900 text-xs">{formatCurrency(nf.valor_total)}</span>;
      case 'usuario_validacao':
        return <span className="text-gray-700 text-xs">{nf.usuario_validacao || '-'}</span>;
      case 'data_validacao':
        return nf.data_validacao ? (
          <span className="text-green-700 text-xs">{formatDateTime(nf.data_validacao)}</span>
        ) : (
          <span className="text-gray-400 text-xs">-</span>
        );
      case 'chave_acesso':
        return <span className="text-gray-500 text-xs font-mono truncate block max-w-[200px]" title={nf.chave_acesso}>{nf.chave_acesso || '-'}</span>;
      default:
        return null;
    }
  };

  // Reset columns to default
  const handleResetColumns = () => {
    setColumnOrder(DEFAULT_COLUMN_ORDER);
    setSortState({ column: null, direction: 'asc' });
  };

  return (
    <Layout>
      <main className="p-4 lg:p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-gradient-to-br from-orange-500 to-amber-500 rounded-xl flex items-center justify-center shadow-lg">
              <span className="text-2xl">📦</span>
            </div>
            <div>
              <h1 className="text-2xl lg:text-3xl font-bold text-gray-900">Notas a Chegar</h1>
              <p className="text-sm text-gray-500">Validador XML de NFe Entradas</p>
            </div>
          </div>
          <button
            onClick={handleResetColumns}
            className="px-3 py-1.5 text-xs text-gray-500 hover:text-orange-600 hover:bg-orange-50 rounded-lg transition-colors border border-gray-200"
            title="Resetar ordem das colunas e ordenacao"
          >
            Resetar Colunas
          </button>
        </div>

        {/* Cards de resumo */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
          <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
            <div className="text-xs text-gray-500 mb-1">Total de Notas</div>
            <div className="text-2xl font-bold text-gray-900">{stats.total}</div>
          </div>
          <div className="bg-white rounded-xl border border-yellow-200 p-4 shadow-sm">
            <div className="text-xs text-yellow-600 mb-1">Pendentes</div>
            <div className="text-2xl font-bold text-yellow-700">{stats.pendentes}</div>
          </div>
          <div className="bg-white rounded-xl border border-green-200 p-4 shadow-sm">
            <div className="text-xs text-green-600 mb-1">Efetivadas</div>
            <div className="text-2xl font-bold text-green-700">{stats.efetivadas}</div>
          </div>
          <div className="bg-white rounded-xl border border-orange-200 p-4 shadow-sm">
            <div className="text-xs text-orange-600 mb-1">Valor Total</div>
            <div className="text-lg font-bold text-orange-700">{formatCurrency(stats.valorTotal)}</div>
          </div>
        </div>

        {/* Filtros */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 mb-4">
          {/* Linha 1: Fornecedor + Botao Buscar */}
          <div className="flex gap-3 mb-3">
            <div className="flex-1">
              <label className="block text-xs font-medium text-gray-500 mb-1">Fornecedor</label>
              <input
                type="text"
                value={filters.fornecedor}
                onChange={(e) => setFilters({ ...filters, fornecedor: e.target.value })}
                onKeyDown={(e) => e.key === 'Enter' && fetchNotas()}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                placeholder="Buscar por nome ou CNPJ..."
              />
            </div>
            <div className="flex items-end">
              <button
                onClick={fetchNotas}
                disabled={loading}
                className="px-6 py-2 bg-gradient-to-r from-orange-500 to-amber-500 text-white rounded-lg text-sm font-medium hover:from-orange-600 hover:to-amber-600 transition-all disabled:opacity-50"
              >
                {loading ? 'Buscando...' : 'Buscar'}
              </button>
            </div>
          </div>

          {/* Linha 2: Data (tipo + range) + NFe Efetivadas + NFe Validadas */}
          <div className="flex flex-wrap items-end gap-4">
            {/* Tipo Data (radio) */}
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Data:</label>
              <div className="flex items-center gap-3 h-[38px]">
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="radio"
                    name="tipo_data"
                    value="emissao"
                    checked={filters.tipo_data === 'emissao'}
                    onChange={() => setFilters({ ...filters, tipo_data: 'emissao' })}
                    className="w-3.5 h-3.5 text-orange-500 focus:ring-orange-500"
                  />
                  <span className="text-sm text-gray-700">Emissao</span>
                </label>
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="radio"
                    name="tipo_data"
                    value="processada"
                    checked={filters.tipo_data === 'processada'}
                    onChange={() => setFilters({ ...filters, tipo_data: 'processada' })}
                    className="w-3.5 h-3.5 text-orange-500 focus:ring-orange-500"
                  />
                  <span className="text-sm text-gray-700">Processada</span>
                </label>
              </div>
            </div>

            {/* Data De */}
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">De:</label>
              <input
                type="date"
                value={filters.data_de}
                onChange={(e) => setFilters({ ...filters, data_de: e.target.value })}
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
              />
            </div>

            {/* Data Ate */}
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Ate:</label>
              <input
                type="date"
                value={filters.data_ate}
                onChange={(e) => setFilters({ ...filters, data_ate: e.target.value })}
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
              />
            </div>

            {/* Separador */}
            <div className="hidden lg:block w-px h-10 bg-gray-200"></div>

            {/* NFe Efetivadas (radio) */}
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">NFe Efetivadas:</label>
              <div className="flex items-center gap-3 h-[38px]">
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="radio"
                    name="efetivadas"
                    value="com"
                    checked={filters.efetivadas === 'com'}
                    onChange={() => setFilters({ ...filters, efetivadas: 'com' })}
                    className="w-3.5 h-3.5 text-orange-500 focus:ring-orange-500"
                  />
                  <span className="text-sm text-gray-700">Com</span>
                </label>
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="radio"
                    name="efetivadas"
                    value="sem"
                    checked={filters.efetivadas === 'sem'}
                    onChange={() => setFilters({ ...filters, efetivadas: 'sem' })}
                    className="w-3.5 h-3.5 text-orange-500 focus:ring-orange-500"
                  />
                  <span className="text-sm text-gray-700">Sem</span>
                </label>
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="radio"
                    name="efetivadas"
                    value="somente"
                    checked={filters.efetivadas === 'somente'}
                    onChange={() => setFilters({ ...filters, efetivadas: 'somente' })}
                    className="w-3.5 h-3.5 text-orange-500 focus:ring-orange-500"
                  />
                  <span className="text-sm text-gray-700">Somente</span>
                </label>
              </div>
            </div>

            {/* Separador */}
            <div className="hidden lg:block w-px h-10 bg-gray-200"></div>

            {/* NFe Validadas (radio) */}
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">NFe Validadas:</label>
              <div className="flex items-center gap-3 h-[38px]">
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="radio"
                    name="validadas"
                    value="nao"
                    checked={filters.validadas === 'nao'}
                    onChange={() => setFilters({ ...filters, validadas: 'nao' })}
                    className="w-3.5 h-3.5 text-orange-500 focus:ring-orange-500"
                  />
                  <span className="text-sm text-gray-700">Nao</span>
                </label>
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="radio"
                    name="validadas"
                    value="sim"
                    checked={filters.validadas === 'sim'}
                    onChange={() => setFilters({ ...filters, validadas: 'sim' })}
                    className="w-3.5 h-3.5 text-orange-500 focus:ring-orange-500"
                  />
                  <span className="text-sm text-gray-700">Sim</span>
                </label>
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="radio"
                    name="validadas"
                    value="todos"
                    checked={filters.validadas === 'todos'}
                    onChange={() => setFilters({ ...filters, validadas: 'todos' })}
                    className="w-3.5 h-3.5 text-orange-500 focus:ring-orange-500"
                  />
                  <span className="text-sm text-gray-700">Todos</span>
                </label>
              </div>
            </div>
          </div>
        </div>

        {/* Dica de drag */}
        <div className="text-xs text-gray-400 mb-2 flex items-center gap-1.5">
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
          </svg>
          Arraste os cabecalhos para reordenar colunas | Clique para ordenar A-Z
        </div>

        {/* Tabela */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto overflow-y-auto max-h-[70vh]">
            <table className="w-full text-sm">
              <thead className="bg-gradient-to-r from-orange-500 to-amber-500 sticky top-0 z-10">
                <tr>
                  {orderedColumns.map(col => (
                    <th
                      key={col.key}
                      draggable
                      onDragStart={(e) => handleDragStart(e, col.key)}
                      onDragOver={(e) => handleDragOver(e, col.key)}
                      onDrop={(e) => handleDrop(e, col.key)}
                      onDragEnd={handleDragEnd}
                      onClick={() => handleSort(col.key)}
                      className={`px-3 py-2.5 font-medium text-white text-xs whitespace-nowrap cursor-pointer select-none transition-all hover:bg-white/10 ${
                        col.align === 'center' ? 'text-center' : col.align === 'right' ? 'text-right' : 'text-left'
                      } ${draggingCol === col.key ? 'opacity-50 bg-white/20' : ''}`}
                      style={{ minWidth: col.width }}
                      title={`Clique para ordenar | Arraste para mover`}
                    >
                      <span className="inline-flex items-center gap-0.5">
                        <svg className="w-3 h-3 mr-1 opacity-40 cursor-grab" viewBox="0 0 12 12" fill="currentColor">
                          <circle cx="4" cy="3" r="1" /><circle cx="8" cy="3" r="1" />
                          <circle cx="4" cy="6" r="1" /><circle cx="8" cy="6" r="1" />
                          <circle cx="4" cy="9" r="1" /><circle cx="8" cy="9" r="1" />
                        </svg>
                        {col.label}
                        {renderSortIcon(col.key)}
                      </span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {loading ? (
                  <tr>
                    <td colSpan={orderedColumns.length} className="px-4 py-16 text-center text-gray-500">
                      <div className="flex items-center justify-center gap-2">
                        <svg className="animate-spin h-5 w-5 text-orange-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                        </svg>
                        Carregando notas do sistema...
                      </div>
                    </td>
                  </tr>
                ) : sortedNotas.length === 0 ? (
                  <tr>
                    <td colSpan={orderedColumns.length} className="px-4 py-16 text-center text-gray-400">
                      Nenhuma nota fiscal encontrada para os filtros selecionados
                    </td>
                  </tr>
                ) : (
                  sortedNotas.map((nf, idx) => (
                    <tr key={`${nf.num_nf}-${nf.cod_fornecedor}-${idx}`} className={`${idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'} hover:bg-orange-50/50 transition-colors`}>
                      {orderedColumns.map(col => (
                        <td
                          key={col.key}
                          className={`px-3 py-2 ${
                            col.align === 'center' ? 'text-center' : col.align === 'right' ? 'text-right' : 'text-left'
                          }`}
                        >
                          {renderCell(nf, col, idx)}
                        </td>
                      ))}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Rodape */}
          {sortedNotas.length > 0 && (
            <div className="px-4 py-3 bg-gradient-to-r from-orange-50 to-amber-50 border-t border-orange-200 flex justify-between items-center text-sm">
              <span className="text-gray-600 font-medium">{sortedNotas.length} nota(s)</span>
              <span className="font-bold text-orange-700 text-base">
                Total: {formatCurrency(sortedNotas.reduce((s, n) => s + (parseFloat(n.valor_total) || 0), 0))}
              </span>
            </div>
          )}
        </div>
      </main>
    </Layout>
  );
}
