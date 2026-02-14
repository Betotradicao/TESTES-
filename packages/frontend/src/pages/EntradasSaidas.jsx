import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useLoja } from '../contexts/LojaContext';
import Sidebar from '../components/Sidebar';
import RadarLoading from '../components/RadarLoading';
import { api } from '../utils/api';
import toast from 'react-hot-toast';

const TIPO_PARCEIRO_LABELS = {
  0: 'Outros',
  1: 'Fornecedor',
  3: 'Cartão/TEF',
  4: 'Cupom PDV',
  5: 'Funcionário',
};

const INITIAL_COLUMNS = [
  { id: 'TIPO', header: '📋 Tipo', align: 'center' },
  { id: 'PARCEIRO', header: '👤 Parceiro', align: 'left', minW: '280px' },
  { id: 'CNPJ_CPF', header: '🔢 CNPJ/CPF', align: 'left' },
  { id: 'DOCUMENTO', header: '📄 Documento', align: 'left' },
  { id: 'NF', header: '🧾 NF', align: 'center' },
  { id: 'PARCELA', header: '📑 Parcela', align: 'center' },
  { id: 'DT_ENTRADA', header: '📥 Dt. Entrada', align: 'center' },
  { id: 'DT_EMISSAO', header: '📄 Dt. Emissão', align: 'center' },
  { id: 'VENCIMENTO', header: '📅 Vencimento', align: 'center' },
  { id: 'VALOR', header: '💰 Valor', align: 'right' },
  { id: 'JUROS', header: '📈 Juros', align: 'right' },
  { id: 'DESCONTO', header: '📉 Desconto', align: 'right' },
  { id: 'CREDITO', header: '💵 Crédito', align: 'right' },
  { id: 'DEVOLUCAO', header: '↩️ Devolução', align: 'right' },
  { id: 'STATUS', header: '🔖 Status', align: 'center' },
  { id: 'DT_QUITACAO', header: '✅ Dt. Quitação', align: 'center' },
  { id: 'DT_PGTO', header: '💲 Dt. Pagamento', align: 'center' },
  { id: 'BANCO', header: '🏦 Banco', align: 'left' },
  { id: 'ENTIDADE', header: '💳 Entidade', align: 'left' },
  { id: 'CATEGORIA', header: '📂 Categoria', align: 'left' },
  { id: 'SUBCATEGORIA', header: '📁 Subcategoria', align: 'left' },
  { id: 'TIPO_PARCEIRO', header: '🏷️ Tipo Parceiro', align: 'center' },
  { id: 'USUARIO', header: '👤 Usuário', align: 'left' },
  { id: 'USR_QUITACAO', header: '✍️ Usr. Quitação', align: 'left' },
  { id: 'BORDERO', header: '📋 Borderô', align: 'center' },
  { id: 'OBS', header: '📝 Obs', align: 'left', minW: '200px' },
];

export default function EntradasSaidas() {
  const { user, logout } = useAuth();
  const { lojaSelecionada } = useLoja();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const [loading, setLoading] = useState(false);
  const [data, setData] = useState([]);
  const [resumo, setResumo] = useState({});
  const [columns, setColumns] = useState(() => {
    const saved = localStorage.getItem('entradas_saidas_columns_order');
    if (saved) {
      try {
        const savedIds = JSON.parse(saved);
        const colMap = {};
        INITIAL_COLUMNS.forEach(c => colMap[c.id] = c);
        const ordered = savedIds.filter(id => colMap[id]).map(id => colMap[id]);
        INITIAL_COLUMNS.forEach(c => { if (!savedIds.includes(c.id)) ordered.push(c); });
        return ordered;
      } catch { return INITIAL_COLUMNS; }
    }
    return INITIAL_COLUMNS;
  });

  // Filtros
  const [filters, setFilters] = useState({
    vencInicio: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0],
    vencFim: new Date().toISOString().split('T')[0],
    entradaInicio: '',
    entradaFim: '',
    tipoConta: '',
    quitado: '',
    tipoParceiro: '',
    codBanco: '',
    codEntidade: '',
    codCategoria: '',
    parceiro: '',
  });

  // Dropdowns
  const [bancos, setBancos] = useState([]);
  const [entidades, setEntidades] = useState([]);
  const [categorias, setCategorias] = useState([]);
  const [loadingFilters, setLoadingFilters] = useState(true);

  // Ordenação por coluna
  const [sortColumn, setSortColumn] = useState(null);
  const [sortDirection, setSortDirection] = useState('asc');

  // Drag & drop columns
  const [draggedColumn, setDraggedColumn] = useState(null);
  const [dragOverColumn, setDragOverColumn] = useState(null);
  const isDragging = useRef(false);

  // Visibilidade de colunas (engrenagem)
  const [showColumnConfig, setShowColumnConfig] = useState(false);
  const [hiddenColumns, setHiddenColumns] = useState(() => {
    const saved = localStorage.getItem('entradas_saidas_hidden_cols');
    if (saved) { try { return new Set(JSON.parse(saved)); } catch { return new Set(); } }
    return new Set();
  });
  const columnConfigRef = useRef(null);

  // Controle de race condition na busca
  const searchIdRef = useRef(0);

  // Colunas visíveis (filtradas por hiddenColumns)
  const visibleColumns = columns.filter(c => !hiddenColumns.has(c.id));

  useEffect(() => { loadFilterData(); handleSearch(); }, []);

  const loadFilterData = async () => {
    setLoadingFilters(true);
    try {
      const [bancosRes, entidadesRes, categoriasRes] = await Promise.all([
        api.get('/financeiro/bancos').catch(() => ({ data: [] })),
        api.get('/financeiro/entidades').catch(() => ({ data: [] })),
        api.get('/financeiro/categorias').catch(() => ({ data: [] })),
      ]);
      setBancos(bancosRes.data || []);
      setEntidades(entidadesRes.data || []);
      setCategorias(categoriasRes.data || []);
    } catch (error) {
      console.error('Erro ao carregar filtros:', error);
    } finally {
      setLoadingFilters(false);
    }
  };

  const handleSearch = async () => {
    setLoading(true);
    const currentSearchId = ++searchIdRef.current;
    try {
      const params = new URLSearchParams();
      if (filters.vencInicio) params.append('vencInicio', filters.vencInicio);
      if (filters.vencFim) params.append('vencFim', filters.vencFim);
      if (filters.entradaInicio) params.append('entradaInicio', filters.entradaInicio);
      if (filters.entradaFim) params.append('entradaFim', filters.entradaFim);
      if (filters.tipoConta !== undefined && filters.tipoConta !== '') params.append('tipoConta', filters.tipoConta);
      if (filters.quitado && filters.quitado !== '') params.append('quitado', filters.quitado);
      if (filters.tipoParceiro !== undefined && filters.tipoParceiro !== '') params.append('tipoParceiro', filters.tipoParceiro);
      if (filters.codBanco && filters.codBanco !== '') params.append('codBanco', filters.codBanco);
      if (filters.codEntidade && filters.codEntidade !== '') params.append('codEntidade', filters.codEntidade);
      if (filters.codCategoria && filters.codCategoria !== '') params.append('codCategoria', filters.codCategoria);
      if (filters.parceiro) params.append('parceiro', filters.parceiro);
      if (lojaSelecionada) params.append('codLoja', lojaSelecionada);

      console.log('[EntradasSaidas] Filtros:', JSON.stringify(filters));
      console.log('[EntradasSaidas] Params URL:', params.toString());

      const [dadosRes, resumoRes] = await Promise.all([
        api.get(`/financeiro/dados?${params.toString()}`),
        api.get(`/financeiro/resumo?${params.toString()}`),
      ]);

      // Ignora resposta se outra busca já foi disparada (race condition)
      if (currentSearchId !== searchIdRef.current) return;

      setData(dadosRes.data?.data || []);
      setResumo(resumoRes.data || {});

      const filtrosAtivos = [];
      if (filters.tipoConta === '1') filtrosAtivos.push('Entradas');
      else if (filters.tipoConta === '0') filtrosAtivos.push('Saídas');
      if (filters.quitado === 'N') filtrosAtivos.push('Abertos');
      else if (filters.quitado === 'S') filtrosAtivos.push('Quitados');
      if (filters.tipoParceiro !== '') filtrosAtivos.push('Tipo Parceiro: ' + (TIPO_PARCEIRO_LABELS[filters.tipoParceiro] || filters.tipoParceiro));
      if (filters.parceiro) filtrosAtivos.push('Parceiro: ' + filters.parceiro);
      const filtroTexto = filtrosAtivos.length > 0 ? ` | Filtros: ${filtrosAtivos.join(', ')}` : '';
      toast.success(`${dadosRes.data?.count || 0} registros encontrados${filtroTexto}`);
    } catch (error) {
      if (currentSearchId !== searchIdRef.current) return;
      console.error('Erro ao buscar dados:', error);
      toast.error('Erro ao buscar dados financeiros');
    } finally {
      if (currentSearchId === searchIdRef.current) setLoading(false);
    }
  };

  const handleClear = () => {
    setFilters({
      vencInicio: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0],
      vencFim: new Date().toISOString().split('T')[0],
      entradaInicio: '',
      entradaFim: '',
      tipoConta: '',
      quitado: '',
      tipoParceiro: '',
      codBanco: '',
      codEntidade: '',
      codCategoria: '',
      parceiro: '',
    });
    setData([]);
    setResumo({});
  };

  const formatCurrency = (val) => {
    if (val === null || val === undefined) return 'R$ 0,00';
    return Number(val).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  };

  const formatDate = (val) => {
    if (!val) return '-';
    return new Date(val).toLocaleDateString('pt-BR');
  };

  const renderCellValue = (row, colId) => {
    switch (colId) {
      case 'TIPO':
        return row.TIPO_CONTA === 0
          ? <span className="inline-flex px-2 py-0.5 text-xs font-bold rounded-full bg-red-100 text-red-700">SAÍDA</span>
          : <span className="inline-flex px-2 py-0.5 text-xs font-bold rounded-full bg-green-100 text-green-700">ENTRADA</span>;
      case 'PARCEIRO':
        return row.DES_PARCEIRO || '-';
      case 'CNPJ_CPF':
        return row.NUM_CGC_CPF || '-';
      case 'DOCUMENTO':
        return row.NUM_DOCTO || '-';
      case 'NF':
        return row.NUM_NF ? `${row.NUM_NF}${row.NUM_SERIE_NF ? '/' + row.NUM_SERIE_NF : ''}` : '-';
      case 'PARCELA':
        return row.QTD_PARCELA > 1 ? `${row.NUM_PARCELA}/${row.QTD_PARCELA}` : '-';
      case 'DT_ENTRADA':
        return formatDate(row.DTA_ENTRADA);
      case 'DT_EMISSAO':
        return formatDate(row.DTA_EMISSAO);
      case 'VENCIMENTO':
        return formatDate(row.DTA_VENCIMENTO);
      case 'VALOR':
        return formatCurrency(row.VAL_PARCELA);
      case 'JUROS':
        return row.VAL_JUROS > 0 ? formatCurrency(row.VAL_JUROS) : '-';
      case 'DESCONTO':
        return row.VAL_DESCONTO > 0 ? formatCurrency(row.VAL_DESCONTO) : '-';
      case 'CREDITO':
        return row.VAL_CREDITO > 0 ? formatCurrency(row.VAL_CREDITO) : '-';
      case 'DEVOLUCAO':
        return row.VAL_DEVOLUCAO > 0 ? formatCurrency(row.VAL_DEVOLUCAO) : '-';
      case 'STATUS':
        return row.FLG_QUITADO === 'S'
          ? <span className="inline-flex px-2 py-0.5 text-xs font-bold rounded-full bg-green-100 text-green-700">Quitado</span>
          : <span className="inline-flex px-2 py-0.5 text-xs font-bold rounded-full bg-yellow-100 text-yellow-700">Aberto</span>;
      case 'DT_QUITACAO':
        return formatDate(row.DTA_QUITADA);
      case 'DT_PGTO':
        return formatDate(row.DTA_PGTO);
      case 'BANCO':
        return row.DES_BANCO || '-';
      case 'ENTIDADE':
        return row.DES_ENTIDADE || '-';
      case 'CATEGORIA':
        return row.DES_CATEGORIA || '-';
      case 'SUBCATEGORIA':
        return row.DES_SUBCATEGORIA || '-';
      case 'TIPO_PARCEIRO':
        return TIPO_PARCEIRO_LABELS[row.TIPO_PARCEIRO] || row.TIPO_PARCEIRO;
      case 'USUARIO':
        return row.USUARIO || '-';
      case 'USR_QUITACAO':
        return row.DES_USUARIO_QUIT || '-';
      case 'BORDERO':
        return row.NUM_BORDERO || '-';
      case 'OBS':
        return row.DES_OBSERVACAO || '-';
      default:
        return '-';
    }
  };

  // Sort handler (ignora se estava arrastando coluna)
  const handleSort = (colId) => {
    if (isDragging.current) return;
    if (sortColumn === colId) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(colId);
      setSortDirection('asc');
    }
  };

  const getSortValue = (row, colId) => {
    switch (colId) {
      case 'TIPO': return row.TIPO_CONTA;
      case 'PARCEIRO': return (row.DES_PARCEIRO || '').toUpperCase();
      case 'CNPJ_CPF': return row.NUM_CGC_CPF || '';
      case 'DOCUMENTO': return row.NUM_DOCTO || '';
      case 'NF': return row.NUM_NF || '';
      case 'PARCELA': return row.NUM_PARCELA || 0;
      case 'DT_ENTRADA': return row.DTA_ENTRADA || '';
      case 'DT_EMISSAO': return row.DTA_EMISSAO || '';
      case 'VENCIMENTO': return row.DTA_VENCIMENTO || '';
      case 'VALOR': return Number(row.VAL_PARCELA) || 0;
      case 'JUROS': return Number(row.VAL_JUROS) || 0;
      case 'DESCONTO': return Number(row.VAL_DESCONTO) || 0;
      case 'CREDITO': return Number(row.VAL_CREDITO) || 0;
      case 'DEVOLUCAO': return Number(row.VAL_DEVOLUCAO) || 0;
      case 'STATUS': return row.FLG_QUITADO || '';
      case 'DT_QUITACAO': return row.DTA_QUITADA || '';
      case 'DT_PGTO': return row.DTA_PGTO || '';
      case 'BANCO': return (row.DES_BANCO || '').toUpperCase();
      case 'ENTIDADE': return (row.DES_ENTIDADE || '').toUpperCase();
      case 'CATEGORIA': return (row.DES_CATEGORIA || '').toUpperCase();
      case 'SUBCATEGORIA': return (row.DES_SUBCATEGORIA || '').toUpperCase();
      case 'TIPO_PARCEIRO': return row.TIPO_PARCEIRO || 0;
      case 'USUARIO': return (row.USUARIO || '').toUpperCase();
      case 'USR_QUITACAO': return (row.DES_USUARIO_QUIT || '').toUpperCase();
      case 'BORDERO': return row.NUM_BORDERO || '';
      case 'OBS': return (row.DES_OBSERVACAO || '').toUpperCase();
      default: return '';
    }
  };

  const sortedData = React.useMemo(() => {
    if (!sortColumn || data.length === 0) return data;
    return [...data].sort((a, b) => {
      const valA = getSortValue(a, sortColumn);
      const valB = getSortValue(b, sortColumn);
      let cmp = 0;
      if (typeof valA === 'number' && typeof valB === 'number') {
        cmp = valA - valB;
      } else {
        cmp = String(valA).localeCompare(String(valB), 'pt-BR');
      }
      return sortDirection === 'asc' ? cmp : -cmp;
    });
  }, [data, sortColumn, sortDirection]);

  // Toggle visibilidade de coluna
  const toggleColumn = (colId) => {
    setHiddenColumns(prev => {
      const next = new Set(prev);
      if (next.has(colId)) next.delete(colId); else next.add(colId);
      localStorage.setItem('entradas_saidas_hidden_cols', JSON.stringify([...next]));
      return next;
    });
  };

  // Fechar dropdown ao clicar fora
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (columnConfigRef.current && !columnConfigRef.current.contains(e.target)) setShowColumnConfig(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Drag & drop handlers
  const handleDragStart = (e, colId) => { isDragging.current = true; setDraggedColumn(colId); e.dataTransfer.effectAllowed = 'move'; };
  const handleDragEnd = () => { setDraggedColumn(null); setDragOverColumn(null); setTimeout(() => { isDragging.current = false; }, 100); };
  const handleDragOver = (e, colId) => { e.preventDefault(); setDragOverColumn(colId); };
  const handleDragLeave = () => { setDragOverColumn(null); };
  const handleDrop = (e, targetColId) => {
    e.preventDefault();
    if (!draggedColumn || draggedColumn === targetColId) return;
    const newCols = [...columns];
    const fromIdx = newCols.findIndex(c => c.id === draggedColumn);
    const toIdx = newCols.findIndex(c => c.id === targetColId);
    const [moved] = newCols.splice(fromIdx, 1);
    newCols.splice(toIdx, 0, moved);
    setColumns(newCols);
    localStorage.setItem('entradas_saidas_columns_order', JSON.stringify(newCols.map(c => c.id)));
    setDraggedColumn(null);
    setDragOverColumn(null);
  };

  return (
    <div className="flex h-screen bg-gray-100">
      <Sidebar user={user} onLogout={logout} isMobileMenuOpen={isMobileMenuOpen} setIsMobileMenuOpen={setIsMobileMenuOpen} />

      <main className="flex-1 overflow-auto">
        {/* Header */}
        <div className="bg-gradient-to-r from-orange-600 to-orange-500 text-white px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold">ENTRADAS E SAÍDAS</h1>
              <p className="text-orange-100 text-sm">Contas a Pagar e Receber - Fluxo Financeiro</p>
            </div>
          </div>
        </div>

        <div className="p-6 space-y-4">
          {/* Cards de Resumo */}
          {(resumo.TOTAL_ENTRADAS !== undefined) && (
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <p className="text-xs text-green-600 font-medium uppercase">Total Entradas</p>
                <p className="text-lg font-bold text-green-700">{formatCurrency(resumo.TOTAL_ENTRADAS)}</p>
              </div>
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <p className="text-xs text-red-600 font-medium uppercase">Total Saídas</p>
                <p className="text-lg font-bold text-red-700">{formatCurrency(resumo.TOTAL_SAIDAS)}</p>
              </div>
              <div className={`${Number(resumo.SALDO) >= 0 ? 'bg-blue-50 border-blue-200' : 'bg-orange-50 border-orange-200'} border rounded-lg p-4`}>
                <p className={`text-xs font-medium uppercase ${Number(resumo.SALDO) >= 0 ? 'text-blue-600' : 'text-orange-600'}`}>Saldo</p>
                <p className={`text-lg font-bold ${Number(resumo.SALDO) >= 0 ? 'text-blue-700' : 'text-orange-700'}`}>{formatCurrency(resumo.SALDO)}</p>
              </div>
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <p className="text-xs text-yellow-600 font-medium uppercase">Abertos</p>
                <p className="text-lg font-bold text-yellow-700">{Number(resumo.QTD_ABERTOS || 0).toLocaleString('pt-BR')}</p>
                <p className="text-xs text-yellow-500">{formatCurrency(resumo.SAIDAS_ABERTAS)} a pagar</p>
              </div>
              <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4">
                <p className="text-xs text-emerald-600 font-medium uppercase">Quitados</p>
                <p className="text-lg font-bold text-emerald-700">{Number(resumo.QTD_QUITADOS || 0).toLocaleString('pt-BR')}</p>
              </div>
            </div>
          )}

          {/* Filtros */}
          <div className="bg-white rounded-lg shadow p-4">
            <div className="grid grid-cols-3 md:grid-cols-6 gap-3 mb-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">📅 Venc. De</label>
                <input type="date" value={filters.vencInicio} onChange={(e) => setFilters({...filters, vencInicio: e.target.value})}
                  className="w-full border border-gray-300 rounded-md px-2 py-1.5 text-sm focus:ring-orange-500 focus:border-orange-500" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">📅 Venc. Até</label>
                <input type="date" value={filters.vencFim} onChange={(e) => setFilters({...filters, vencFim: e.target.value})}
                  className="w-full border border-gray-300 rounded-md px-2 py-1.5 text-sm focus:ring-orange-500 focus:border-orange-500" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">📥 Entrada De</label>
                <input type="date" value={filters.entradaInicio} onChange={(e) => setFilters({...filters, entradaInicio: e.target.value})}
                  className="w-full border border-gray-300 rounded-md px-2 py-1.5 text-sm focus:ring-orange-500 focus:border-orange-500" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">📥 Entrada Até</label>
                <input type="date" value={filters.entradaFim} onChange={(e) => setFilters({...filters, entradaFim: e.target.value})}
                  className="w-full border border-gray-300 rounded-md px-2 py-1.5 text-sm focus:ring-orange-500 focus:border-orange-500" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">📋 Tipo</label>
                <select value={filters.tipoConta} onChange={(e) => setFilters({...filters, tipoConta: e.target.value})}
                  className="w-full border border-gray-300 rounded-md px-2 py-1.5 text-sm focus:ring-orange-500 focus:border-orange-500">
                  <option value="">Todos</option>
                  <option value="1">Entradas</option>
                  <option value="0">Saídas</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">🔖 Status</label>
                <select value={filters.quitado} onChange={(e) => setFilters({...filters, quitado: e.target.value})}
                  className="w-full border border-gray-300 rounded-md px-2 py-1.5 text-sm focus:ring-orange-500 focus:border-orange-500">
                  <option value="">Todos</option>
                  <option value="N">Abertos</option>
                  <option value="S">Quitados</option>
                </select>
              </div>
            </div>
            <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">🏷️ Tipo Parceiro</label>
                <select value={filters.tipoParceiro} onChange={(e) => setFilters({...filters, tipoParceiro: e.target.value})}
                  className="w-full border border-gray-300 rounded-md px-2 py-1.5 text-sm focus:ring-orange-500 focus:border-orange-500">
                  <option value="">Todos</option>
                  <option value="1">Fornecedor</option>
                  <option value="3">Cartão/TEF</option>
                  <option value="4">Cupom PDV</option>
                  <option value="5">Funcionário</option>
                  <option value="0">Outros</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">🏦 Banco</label>
                <select value={filters.codBanco} onChange={(e) => setFilters({...filters, codBanco: e.target.value})}
                  className="w-full border border-gray-300 rounded-md px-2 py-1.5 text-sm focus:ring-orange-500 focus:border-orange-500"
                  disabled={loadingFilters}>
                  <option value="">{loadingFilters ? 'Carregando...' : 'Todos'}</option>
                  {bancos.map(b => <option key={b.COD_BANCO} value={b.COD_BANCO}>{b.DES_BANCO}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">💳 Entidade</label>
                <select value={filters.codEntidade} onChange={(e) => setFilters({...filters, codEntidade: e.target.value})}
                  className="w-full border border-gray-300 rounded-md px-2 py-1.5 text-sm focus:ring-orange-500 focus:border-orange-500"
                  disabled={loadingFilters}>
                  <option value="">{loadingFilters ? 'Carregando...' : 'Todas'}</option>
                  {entidades.map(e => <option key={e.COD_ENTIDADE} value={e.COD_ENTIDADE}>{e.DES_ENTIDADE}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">📂 Categoria</label>
                <select value={filters.codCategoria} onChange={(e) => setFilters({...filters, codCategoria: e.target.value})}
                  className="w-full border border-gray-300 rounded-md px-2 py-1.5 text-sm focus:ring-orange-500 focus:border-orange-500"
                  disabled={loadingFilters}>
                  <option value="">{loadingFilters ? 'Carregando...' : 'Todas'}</option>
                  {categorias.map(c => <option key={c.COD_CATEGORIA} value={c.COD_CATEGORIA}>{c.DES_CATEGORIA}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">🔍 Buscar Parceiro</label>
                <input type="text" placeholder="Nome..." value={filters.parceiro}
                  onChange={(e) => setFilters({...filters, parceiro: e.target.value})}
                  className="w-full border border-gray-300 rounded-md px-2 py-1.5 text-sm focus:ring-orange-500 focus:border-orange-500" />
              </div>
              <div className="flex items-end gap-2">
                <button onClick={handleSearch} disabled={loading}
                  className="flex-1 px-3 py-1.5 bg-orange-600 text-white rounded-md hover:bg-orange-700 text-sm font-medium disabled:opacity-50 flex items-center justify-center gap-1">
                  {loading ? (
                    <>
                      <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Buscando...
                    </>
                  ) : 'Pesquisar'}
                </button>
                <button onClick={handleClear}
                  className="px-3 py-1.5 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 text-sm">
                  Limpar
                </button>
              </div>
            </div>
          </div>

          {/* Tabela */}
          <div className="bg-white rounded-lg shadow overflow-hidden relative">
            {loading && data.length === 0 && (
              <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/80">
                <RadarLoading message="Buscando dados financeiros..." />
              </div>
            )}

            {/* Botão engrenagem discreto */}
            <div className="flex justify-end px-3 py-1.5 bg-gray-50 border-b" ref={columnConfigRef}>
              <div className="relative">
                <button onClick={() => setShowColumnConfig(!showColumnConfig)}
                  className="p-1 text-gray-400 hover:text-gray-600 rounded transition-colors" title="Configurar colunas visíveis">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                </button>
                {showColumnConfig && (
                  <div className="absolute right-0 top-8 z-50 bg-white border border-gray-200 rounded-lg shadow-lg p-3 w-56 max-h-80 overflow-y-auto">
                    <p className="text-xs font-semibold text-gray-500 uppercase mb-2">Colunas visíveis</p>
                    {INITIAL_COLUMNS.map(col => (
                      <label key={col.id} className="flex items-center gap-2 py-0.5 cursor-pointer hover:bg-gray-50 rounded px-1">
                        <input type="checkbox" checked={!hiddenColumns.has(col.id)} onChange={() => toggleColumn(col.id)}
                          className="rounded border-gray-300 text-orange-500 focus:ring-orange-500 h-3.5 w-3.5" />
                        <span className="text-xs text-gray-700">{col.header.replace(/[\u{1F000}-\u{1FFFF}\u{2600}-\u{27FF}\u{FE00}-\u{FEFF}]/gu, '').trim()}</span>
                      </label>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-600">
                  <tr>
                    {visibleColumns.map((col) => (
                      <th key={col.id} draggable
                        onDragStart={(e) => handleDragStart(e, col.id)}
                        onDragEnd={handleDragEnd}
                        onDragOver={(e) => handleDragOver(e, col.id)}
                        onDragLeave={handleDragLeave}
                        onDrop={(e) => handleDrop(e, col.id)}
                        onClick={() => handleSort(col.id)}
                        style={{ minWidth: col.minW || 'auto' }}
                        className={`px-3 py-3 text-xs font-medium text-white uppercase tracking-wider cursor-pointer select-none whitespace-nowrap
                          ${col.align === 'right' ? 'text-right' : col.align === 'center' ? 'text-center' : 'text-left'}
                          ${dragOverColumn === col.id ? 'bg-gray-500 border-l-2 border-orange-400' : ''}
                          ${draggedColumn === col.id ? 'opacity-50' : ''}
                          hover:bg-gray-500`}
                        title="Clique para ordenar | Arraste para reordenar">
                        <div className="flex items-center gap-1">
                          <svg className="w-3 h-3 text-gray-300 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                            <path d="M7 2a2 2 0 1 0 .001 4.001A2 2 0 0 0 7 2zm0 6a2 2 0 1 0 .001 4.001A2 2 0 0 0 7 8zm0 6a2 2 0 1 0 .001 4.001A2 2 0 0 0 7 14zm6-8a2 2 0 1 0-.001-4.001A2 2 0 0 0 13 6zm0 2a2 2 0 1 0 .001 4.001A2 2 0 0 0 13 8zm0 6a2 2 0 1 0 .001 4.001A2 2 0 0 0 13 14z"/>
                          </svg>
                          <span>{col.header}</span>
                          {sortColumn === col.id && (
                            <svg className="w-3 h-3 text-orange-300 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                              {sortDirection === 'asc'
                                ? <path fillRule="evenodd" d="M5.293 9.707a1 1 0 010-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 01-1.414 1.414L10 6.414l-3.293 3.293a1 1 0 01-1.414 0z" clipRule="evenodd"/>
                                : <path fillRule="evenodd" d="M14.707 10.293a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 111.414-1.414L10 13.586l3.293-3.293a1 1 0 011.414 0z" clipRule="evenodd"/>
                              }
                            </svg>
                          )}
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {sortedData.length === 0 ? (
                    <tr>
                      <td colSpan={visibleColumns.length} className="px-4 py-8 text-center text-gray-500">
                        {loading ? '' : 'Nenhum dado encontrado. Selecione os filtros e clique em Pesquisar.'}
                      </td>
                    </tr>
                  ) : (
                    sortedData.map((row, idx) => (
                      <tr key={row.NUM_REGISTRO || idx} className={`hover:bg-gray-50 ${row.TIPO_CONTA === 0 ? 'bg-red-50/20' : 'bg-green-50/20'}`}>
                        {visibleColumns.map((col) => (
                          <td key={col.id}
                            style={col.minW ? { minWidth: col.minW } : undefined}
                            className={`px-3 py-2 text-sm whitespace-nowrap ${col.align === 'right' ? 'text-right' : col.align === 'center' ? 'text-center' : 'text-left'}`}>
                            {renderCellValue(row, col.id)}
                          </td>
                        ))}
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            {data.length > 0 && (
              <div className="px-4 py-2 bg-gray-50 text-sm text-gray-500 border-t">
                Exibindo {data.length} registros (máximo 500)
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
