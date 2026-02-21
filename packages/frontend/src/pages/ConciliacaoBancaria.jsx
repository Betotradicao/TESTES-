import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useLoja } from '../contexts/LojaContext';
import Sidebar from '../components/Sidebar';
import RadarLoading from '../components/RadarLoading';
import { api } from '../utils/api';
import toast from 'react-hot-toast';

function formatCurrency(v) {
  return (v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function formatDate(d) {
  if (!d) return '';
  const dt = typeof d === 'string' ? new Date(d) : d;
  if (isNaN(dt.getTime())) return d;
  return `${String(dt.getDate()).padStart(2, '0')}/${String(dt.getMonth() + 1).padStart(2, '0')}/${dt.getFullYear()}`;
}

// Column definitions
const BANK_COLUMNS = [
  { id: 'bco_data', label: 'Data', align: 'center', width: 'w-[80px]' },
  { id: 'bco_favorecido', label: 'Favorecido', align: 'left', width: 'flex-1' },
  { id: 'bco_valor', label: 'Valor', align: 'right', width: 'w-[110px]' },
  { id: 'bco_tipo', label: 'Tipo', align: 'center', width: 'w-[55px]' },
];

const SYS_COLUMNS = [
  { id: 'sys_data', label: 'Data', align: 'center', width: 'w-[80px]' },
  { id: 'sys_parceiro', label: 'Parceiro', align: 'left', width: 'flex-1' },
  { id: 'sys_nota', label: 'Nota', align: 'center', width: 'w-[80px]' },
  { id: 'sys_bordero', label: 'Bordero', align: 'center', width: 'w-[80px]' },
  { id: 'sys_subcategoria', label: 'Subcategoria', align: 'left', width: 'w-[160px]' },
  { id: 'sys_valor', label: 'Valor', align: 'left', width: 'w-[110px]' },
  { id: 'sys_tipo', label: 'Tipo', align: 'center', width: 'w-[55px]' },
];

function useDraggableCols(initial, storageKey) {
  const [cols, setCols] = useState(() => {
    if (storageKey) {
      try {
        const saved = localStorage.getItem(storageKey);
        if (saved) {
          const savedIds = JSON.parse(saved);
          // Reorder initial columns based on saved order, keeping column definitions intact
          const ordered = [];
          for (const id of savedIds) {
            const col = initial.find(c => c.id === id);
            if (col) ordered.push(col);
          }
          // Add any new columns not in saved order
          for (const col of initial) {
            if (!ordered.find(c => c.id === col.id)) ordered.push(col);
          }
          if (ordered.length === initial.length) return ordered;
        }
      } catch {}
    }
    return initial;
  });
  const [dragIdx, setDragIdx] = useState(null);
  const [overIdx, setOverIdx] = useState(null);
  const didDrag = useRef(false);

  const reorderCols = useCallback((fromIdx, toIdx) => {
    setCols(c => {
      const next = [...c];
      const dragged = next.splice(fromIdx, 1)[0];
      next.splice(toIdx, 0, dragged);
      if (storageKey) {
        try { localStorage.setItem(storageKey, JSON.stringify(next.map(col => col.id))); } catch {}
      }
      return next;
    });
  }, [storageKey]);

  const onDragStart = useCallback((e, idx) => {
    didDrag.current = false;
    setDragIdx(idx);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', String(idx));
  }, []);

  const onDragOver = useCallback((e, idx) => {
    e.preventDefault();
    e.stopPropagation();
    didDrag.current = true;
    setOverIdx(idx);
  }, []);

  const onDrop = useCallback((e, idx) => {
    e.preventDefault();
    e.stopPropagation();
    const fromIdx = parseInt(e.dataTransfer.getData('text/plain'), 10);
    if (!isNaN(fromIdx) && fromIdx !== idx) {
      reorderCols(fromIdx, idx);
    }
    setDragIdx(null);
    setOverIdx(null);
  }, [reorderCols]);

  const onDragEnd = useCallback(() => {
    setDragIdx(null);
    setOverIdx(null);
  }, []);

  const wasDrag = useCallback(() => {
    const was = didDrag.current;
    didDrag.current = false;
    return was;
  }, []);

  return { cols, dragIdx, overIdx, onDragStart, onDragOver, onDrop, onDragEnd, wasDrag };
}

function getSortValue(row, colId) {
  switch (colId) {
    case 'bco_data': return row.banco?.DTA_ENTRADA ? new Date(row.banco.DTA_ENTRADA).getTime() : null;
    case 'bco_favorecido': return row.banco?.FAVORECIDO || null;
    case 'bco_valor': return row.banco ? Math.abs(parseFloat(row.banco.VAL_DOCTO) || 0) : null;
    case 'bco_tipo': return row.banco?.TIPO_OPERACAO ?? null;
    case 'sys_data': return row.sistema?.dtaQuitada ? new Date(row.sistema.dtaQuitada).getTime() : null;
    case 'sys_parceiro': return row.sistema?.desParceiro || null;
    case 'sys_nota': return row.sistema?.numDocto || null;
    case 'sys_bordero': return row.sistema?.numBordero || null;
    case 'sys_subcategoria': return row.sistema?.desSubcategoria || null;
    case 'sys_valor': return row.sistema?.valTotal ?? null;
    case 'sys_tipo': return row.sistema?.tipoConta ?? null;
    default: return null;
  }
}

function SortArrow({ dir }) {
  return (
    <svg className="w-3 h-3 inline-block ml-0.5" viewBox="0 0 24 24" fill="currentColor">
      {dir === 'asc'
        ? <path d="M7 14l5-5 5 5z" />
        : <path d="M7 10l5 5 5-5z" />
      }
    </svg>
  );
}

export default function ConciliacaoBancaria() {
  const { user, logout } = useAuth();
  const { lojaSelecionada } = useLoja();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // Data state
  const [rows, setRows] = useState([]);
  const [resumo, setResumo] = useState({});
  const [loading, setLoading] = useState(false);
  const [conciliando, setConciliando] = useState(false);

  // Modal state
  const [candidateModal, setCandidateModal] = useState(null);

  // Filter state
  const [bancos, setBancos] = useState([]);
  const [loadingBancos, setLoadingBancos] = useState(true);
  const [codBanco, setCodBanco] = useState('');
  const [bankAccounts, setBankAccounts] = useState([]);
  const [selectedBankAccountId, setSelectedBankAccountId] = useState('');
  const [dtaInicio, setDtaInicio] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
  });
  const [dtaFim, setDtaFim] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  });
  const [tipoFiltro, setTipoFiltro] = useState('todos');
  const [viewFilter, setViewFilter] = useState('todos');
  const [cardFilter, setCardFilter] = useState(null); // null | 'todos_banco' | 'todos_sistema' | 'correspondencias' | 'conciliados' | 'sem_sistema' | 'sem_banco'

  // Draggable columns
  const bankDrag = useDraggableCols(BANK_COLUMNS, 'conciliacao_bank_cols');
  const sysDrag = useDraggableCols(SYS_COLUMNS, 'conciliacao_sys_cols');

  const searchIdRef = useRef(0);

  // Load bancos on mount (Oracle + bank_accounts)
  useEffect(() => {
    const loadBancos = async () => {
      setLoadingBancos(true);
      try {
        const params = new URLSearchParams();
        if (lojaSelecionada) params.append('codLoja', lojaSelecionada);
        const [bancosRes, accountsRes] = await Promise.allSettled([
          api.get(`/conciliacao/bancos?${params.toString()}`),
          api.get('/bank-accounts'),
        ]);
        const list = bancosRes.status === 'fulfilled' ? (bancosRes.value.data?.data || []) : [];
        setBancos(list);
        const accs = accountsRes.status === 'fulfilled'
          ? (accountsRes.value.data?.data || []).filter(a => a.ativo)
          : [];
        setBankAccounts(accs);
        if (list.length > 0 && !codBanco) {
          // Priorizar Banco Santander como padrão
          const santander = list.find(b => (b.DES_BANCO || '').toUpperCase().includes('SANTANDER'));
          setCodBanco(String(santander ? santander.COD_BANCO : list[0].COD_BANCO));
        }
      } catch (err) {
        console.error('Erro ao carregar bancos:', err);
        toast.error('Erro ao carregar bancos - verifique a conexão Oracle');
      } finally {
        setLoadingBancos(false);
      }
    };
    loadBancos();
  }, [lojaSelecionada]);

  // Filter bank accounts that match the selected Oracle bank name
  const matchedAccounts = useMemo(() => {
    if (!codBanco || bankAccounts.length === 0) return [];
    const bancoObj = bancos.find(b => String(b.COD_BANCO) === codBanco);
    if (!bancoObj) return [];
    const desBanco = (bancoObj.DES_BANCO || '').toLowerCase();
    return bankAccounts.filter(acc => {
      const nome = (acc.nome || '').toLowerCase();
      const tipo = (acc.tipo_banco || '').toLowerCase();
      // Match by name keywords
      if (desBanco.includes('santander') && (nome.includes('santander') || tipo === 'santander')) return true;
      if (desBanco.includes('bradesco') && (nome.includes('bradesco') || tipo === 'bradesco')) return true;
      if (desBanco.includes('itau') && (nome.includes('itau') || tipo === 'itau')) return true;
      if (desBanco.includes('caixa') && (nome.includes('caixa') || tipo === 'caixa')) return true;
      return false;
    });
  }, [codBanco, bancos, bankAccounts]);

  // Auto-select first account when matched accounts change
  useEffect(() => {
    if (matchedAccounts.length > 0) {
      setSelectedBankAccountId(matchedAccounts[0].id);
    } else {
      setSelectedBankAccountId('');
    }
  }, [matchedAccounts]);

  // Fetch data
  const fetchDados = async () => {
    if (!codBanco) {
      toast.error('Selecione um banco');
      return;
    }
    const currentSearchId = ++searchIdRef.current;
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (lojaSelecionada) params.append('codLoja', lojaSelecionada);
      params.append('codBanco', codBanco);
      if (selectedBankAccountId) params.append('bankId', selectedBankAccountId);
      params.append('dtaInicio', dtaInicio);
      params.append('dtaFim', dtaFim);

      const res = await api.get(`/conciliacao/dados?${params.toString()}`);
      if (currentSearchId !== searchIdRef.current) return;

      if (res.data?.success) {
        setRows(res.data.rows || []);
        setResumo(res.data.resumo || {});
      } else {
        toast.error(res.data?.message || 'Erro ao buscar dados');
      }
    } catch (err) {
      if (currentSearchId !== searchIdRef.current) return;
      console.error('Erro:', err);
      toast.error('Erro ao buscar dados de conciliação');
    } finally {
      if (currentSearchId === searchIdRef.current) setLoading(false);
    }
  };

  // Auto-search when banco is loaded or changed
  useEffect(() => {
    if (codBanco && !loadingBancos) {
      fetchDados();
    }
  }, [codBanco, loadingBancos]);

  // Sort state
  const [sortCol, setSortCol] = useState(null); // column id
  const [sortDir, setSortDir] = useState('asc'); // 'asc' | 'desc'

  const handleSort = (colId, dragHook) => {
    // If this was a drag interaction, don't sort
    if (dragHook && dragHook.wasDrag()) return;
    if (sortCol === colId) {
      setSortDir(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortCol(colId);
      setSortDir('asc');
    }
  };

  // Step 1: Filter by tipo (entrada/saida) - used for card values
  // Cada lado deve ser do tipo filtrado: se banco existe e não é do tipo, exclui; se sistema existe e não é do tipo, exclui
  const tipoFiltered = useMemo(() => {
    let r = rows;
    if (tipoFiltro === 'entrada') {
      r = r.filter(row => {
        if (row.banco && row.banco.TIPO_OPERACAO !== 0) return false;
        if (row.sistema && row.sistema.tipoConta !== 1) return false;
        return true;
      });
    } else if (tipoFiltro === 'saida') {
      r = r.filter(row => {
        if (row.banco && row.banco.TIPO_OPERACAO !== 1) return false;
        if (row.sistema && row.sistema.tipoConta === 1) return false;
        return true;
      });
    }
    return r;
  }, [rows, tipoFiltro]);

  // Dynamic card values based on tipo filter
  const cardResumo = useMemo(() => {
    const r = tipoFiltered;
    const totalBanco = r.filter(row => row.banco).length;
    const totalSistema = r.filter(row => row.sistema).length;
    const totalMatched = r.filter(row => row.matchStatus === 'MATCHED').length;
    const totalCompensado = r.filter(row => row.isCompensado).length;
    const unmatchedBanco = r.filter(row => row.matchStatus === 'UNMATCHED_BANK').length;
    const unmatchedSistema = r.filter(row => row.matchStatus === 'UNMATCHED_SYSTEM').length;
    const valMatchedBanco = r.filter(row => row.matchStatus === 'MATCHED' && row.banco)
      .reduce((s, row) => s + Math.abs(parseFloat(row.banco.VAL_DOCTO) || 0), 0);
    const valUnmatchedBanco = r.filter(row => row.matchStatus === 'UNMATCHED_BANK' && row.banco)
      .reduce((s, row) => s + Math.abs(parseFloat(row.banco.VAL_DOCTO) || 0), 0);
    const valUnmatchedSistema = r.filter(row => row.matchStatus === 'UNMATCHED_SYSTEM' && row.sistema)
      .reduce((s, row) => s + row.sistema.valTotal, 0);
    const valTotalBanco = r.filter(row => row.banco)
      .reduce((s, row) => {
        const val = Math.abs(parseFloat(row.banco.VAL_DOCTO) || 0);
        return s + (row.banco.TIPO_OPERACAO === 0 ? val : -val);
      }, 0);
    const valTotalSistema = r.filter(row => row.sistema)
      .reduce((s, row) => {
        return s + (row.sistema.tipoConta === 1 ? row.sistema.valTotal : -row.sistema.valTotal);
      }, 0);
    // Entradas e Saídas separadas - Banco
    const valBancoEntrada = r.filter(row => row.banco && row.banco.TIPO_OPERACAO === 0)
      .reduce((s, row) => s + Math.abs(parseFloat(row.banco.VAL_DOCTO) || 0), 0);
    const valBancoSaida = r.filter(row => row.banco && row.banco.TIPO_OPERACAO === 1)
      .reduce((s, row) => s + Math.abs(parseFloat(row.banco.VAL_DOCTO) || 0), 0);
    // Entradas e Saídas separadas - Sistema
    const valSistemaEntrada = r.filter(row => row.sistema && row.sistema.tipoConta === 1)
      .reduce((s, row) => s + row.sistema.valTotal, 0);
    const valSistemaSaida = r.filter(row => row.sistema && row.sistema.tipoConta !== 1)
      .reduce((s, row) => s + row.sistema.valTotal, 0);
    return { totalBanco, totalSistema, totalMatched, totalCompensado, unmatchedBanco, unmatchedSistema, valMatchedBanco, valUnmatchedBanco, valUnmatchedSistema, valTotalBanco, valTotalSistema, valBancoEntrada, valBancoSaida, valSistemaEntrada, valSistemaSaida };
  }, [tipoFiltered]);

  // Step 2: Apply card filter + view filter + sort for table display
  const filteredRows = useMemo(() => {
    let r = tipoFiltered;
    // Card filter (click on summary cards)
    if (cardFilter === 'todos_banco') {
      r = r.filter(row => row.banco);
    } else if (cardFilter === 'todos_sistema') {
      r = r.filter(row => row.sistema);
    } else if (cardFilter === 'correspondencias') {
      r = r.filter(row => row.matchStatus === 'MATCHED');
    } else if (cardFilter === 'conciliados') {
      r = r.filter(row => row.isCompensado);
    } else if (cardFilter === 'sem_sistema') {
      r = r.filter(row => row.matchStatus === 'UNMATCHED_BANK');
    } else if (cardFilter === 'sem_banco') {
      r = r.filter(row => row.matchStatus === 'UNMATCHED_SYSTEM');
    }
    // View filter
    if (viewFilter === 'sem_sistema') {
      r = r.filter(row => row.matchStatus === 'UNMATCHED_BANK');
    } else if (viewFilter === 'sem_banco') {
      r = r.filter(row => row.matchStatus === 'UNMATCHED_SYSTEM');
    }
    if (sortCol) {
      r = [...r].sort((a, b) => {
        const va = getSortValue(a, sortCol);
        const vb = getSortValue(b, sortCol);
        if (va == null && vb == null) return 0;
        if (va == null) return 1;
        if (vb == null) return -1;
        let cmp = 0;
        if (typeof va === 'number' && typeof vb === 'number') {
          cmp = va - vb;
        } else {
          cmp = String(va).localeCompare(String(vb), 'pt-BR', { numeric: true });
        }
        return sortDir === 'asc' ? cmp : -cmp;
      });
    }
    return r;
  }, [tipoFiltered, cardFilter, viewFilter, sortCol, sortDir]);

  // Handle selecting a candidate from the modal
  const handleSelectCandidate = useCallback((rowId, selectedCandidate) => {
    setRows(prev => prev.map(r => {
      if (r.rowId === rowId) {
        return {
          ...r,
          sistema: selectedCandidate,
          matchStatus: 'MATCHED',
          isCompensado: selectedCandidate.flgCompensado || false,
        };
      }
      return r;
    }));
    setCandidateModal(null);
    toast.success('Candidato selecionado!');
  }, []);

  // Conciliar
  const handleConciliar = async () => {
    const rowsToReconcile = rows.filter(r =>
      r.matchStatus === 'MATCHED' && !r.isCompensado && r.sistema
    );
    if (rowsToReconcile.length === 0) {
      toast('Nenhuma linha pendente de conciliação', { icon: 'ℹ️' });
      return;
    }

    const allNumRegistros = rowsToReconcile.flatMap(r => r.sistema.numRegistros);
    const rowIds = new Set(rowsToReconcile.map(r => r.rowId));
    setConciliando(true);
    try {
      const res = await api.post('/conciliacao/conciliar', { numRegistros: allNumRegistros });
      if (res.data?.success !== false) {
        // Atualizar estado local - marcar como conciliado sem re-buscar
        setRows(prev => prev.map(r =>
          rowIds.has(r.rowId) ? { ...r, isCompensado: true } : r
        ));
        toast.success(`${rowsToReconcile.length} registros conciliados!`);
      }
    } catch (err) {
      toast.error('Erro ao conciliar registros');
    } finally {
      setConciliando(false);
    }
  };

  const pendingCount = rows.filter(r => r.matchStatus === 'MATCHED' && !r.isCompensado).length;

  return (
    <div className="flex h-screen bg-gray-100">
      <Sidebar
        user={user}
        onLogout={logout}
        isMobileMenuOpen={isMobileMenuOpen}
        setIsMobileMenuOpen={setIsMobileMenuOpen}
      />

      <main className="flex-1 overflow-auto">
        {/* Header */}
        <div className="bg-gradient-to-r from-orange-600 to-orange-500 text-white px-4 md:px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl md:text-2xl font-bold tracking-wide">CONCILIACAO BANCARIA</h1>
              <p className="text-orange-100 text-sm mt-0.5">Cruzamento entre movimentos bancarios e pagamentos do sistema</p>
            </div>
            <button
              className="md:hidden p-2 rounded-lg bg-orange-700/50"
              onClick={() => setIsMobileMenuOpen(true)}
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="18" x2="21" y2="18" />
              </svg>
            </button>
          </div>
        </div>

        <div className="p-3 md:p-4">
          {/* Filters */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-3 mb-4">
            <div className="flex flex-wrap items-end gap-3">
              <div className="flex flex-col">
                <label className="text-xs font-semibold text-gray-500 mb-1">Banco</label>
                <select
                  value={codBanco}
                  onChange={e => setCodBanco(e.target.value)}
                  disabled={loadingBancos}
                  className={`border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-orange-400 focus:border-orange-400 min-w-[200px] ${codBanco ? 'border-orange-400 bg-orange-50 font-semibold' : 'border-gray-300'}`}
                >
                  <option value="">{loadingBancos ? 'Carregando...' : 'Selecione'}</option>
                  {bancos.map(b => (
                    <option key={b.COD_BANCO} value={b.COD_BANCO}>{b.DES_BANCO}</option>
                  ))}
                </select>
              </div>

              {matchedAccounts.length > 0 && (
                <div className="flex flex-col">
                  <label className="text-xs font-semibold text-gray-500 mb-1">Conta</label>
                  <select
                    value={selectedBankAccountId}
                    onChange={e => setSelectedBankAccountId(e.target.value)}
                    className={`border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-orange-400 focus:border-orange-400 min-w-[220px] ${selectedBankAccountId ? 'border-orange-400 bg-orange-50 font-semibold' : 'border-gray-300'}`}
                  >
                    {matchedAccounts.map(acc => (
                      <option key={acc.id} value={acc.id}>
                        {acc.nome}{acc.conta ? ` | Conta: ${acc.conta}` : ''}
                      </option>
                    ))}
                  </select>
                </div>
              )}


              <div className="flex flex-col">
                <label className="text-xs font-semibold text-gray-500 mb-1">Inicio</label>
                <input
                  type="date"
                  value={dtaInicio}
                  onChange={e => setDtaInicio(e.target.value)}
                  className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-orange-400 focus:border-orange-400"
                />
              </div>
              <div className="flex flex-col">
                <label className="text-xs font-semibold text-gray-500 mb-1">Fim</label>
                <input
                  type="date"
                  value={dtaFim}
                  onChange={e => setDtaFim(e.target.value)}
                  className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-orange-400 focus:border-orange-400"
                />
              </div>

              <div className="flex flex-col">
                <label className="text-xs font-semibold text-gray-500 mb-1">Tipo</label>
                <div className="flex rounded-lg overflow-hidden border border-gray-300">
                  {[
                    { val: 'todos', label: 'Todos' },
                    { val: 'entrada', label: 'Entradas' },
                    { val: 'saida', label: 'Saidas' },
                  ].map(opt => (
                    <button
                      key={opt.val}
                      onClick={() => setTipoFiltro(opt.val)}
                      className={`px-3 py-2 text-xs font-semibold transition-colors ${
                        tipoFiltro === opt.val
                          ? 'bg-orange-600 text-white'
                          : 'bg-white text-gray-600 hover:bg-gray-50'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex flex-col">
                <label className="text-xs font-semibold text-gray-500 mb-1">Exibir</label>
                <div className="flex rounded-lg overflow-hidden border border-gray-300">
                  {[
                    { val: 'todos', label: 'Todos' },
                    { val: 'sem_sistema', label: 'Sem Sistema' },
                    { val: 'sem_banco', label: 'Sem Banco' },
                  ].map(opt => (
                    <button
                      key={opt.val}
                      onClick={() => setViewFilter(opt.val)}
                      className={`px-3 py-2 text-xs font-semibold transition-colors ${
                        viewFilter === opt.val
                          ? 'bg-orange-600 text-white'
                          : 'bg-white text-gray-600 hover:bg-gray-50'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              <button
                onClick={fetchDados}
                disabled={loading || !codBanco}
                className="px-5 py-2 bg-orange-600 text-white rounded-lg text-sm font-bold hover:bg-orange-700 disabled:opacity-50 transition-colors"
              >
                {loading ? 'Buscando...' : 'Buscar'}
              </button>

              <button
                onClick={handleConciliar}
                disabled={conciliando || pendingCount === 0}
                className="px-5 py-2 bg-green-600 text-white rounded-lg text-sm font-bold hover:bg-green-700 disabled:opacity-50 transition-colors flex items-center gap-2"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
                {conciliando ? 'Conciliando...' : `Conciliar (${pendingCount})`}
              </button>
            </div>
          </div>

          {rows.length > 0 && (
            <>
            <div className="grid grid-cols-2 gap-3 mb-3">
              <div className="bg-orange-50 border-2 border-orange-300 rounded-lg px-4 py-3">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-bold text-orange-600 uppercase tracking-wider">R$ Banco</span>
                  <span className="text-xl font-black text-orange-700">{formatCurrency(cardResumo.valTotalBanco || 0)}</span>
                </div>
                {tipoFiltro === 'todos' && (
                  <table className="w-full border-t border-orange-200">
                    <tbody>
                      <tr>
                        <td className="pt-1.5 w-1/2">
                          <div className="flex items-center gap-1.5">
                            <span className="w-2.5 h-2.5 rounded-full bg-green-500 flex-shrink-0"></span>
                            <span className="text-xs text-green-700 font-semibold">Entradas</span>
                          </div>
                        </td>
                        <td className="pt-1.5 text-right">
                          <span className="text-sm font-black text-green-700">{formatCurrency(cardResumo.valBancoEntrada || 0)}</span>
                        </td>
                      </tr>
                      <tr>
                        <td className="pt-1 w-1/2">
                          <div className="flex items-center gap-1.5">
                            <span className="w-2.5 h-2.5 rounded-full bg-red-500 flex-shrink-0"></span>
                            <span className="text-xs text-red-700 font-semibold">Saídas</span>
                          </div>
                        </td>
                        <td className="pt-1 text-right">
                          <span className="text-sm font-black text-red-700">{formatCurrency(cardResumo.valBancoSaida || 0)}</span>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                )}
              </div>
              <div className="bg-gray-50 border-2 border-gray-300 rounded-lg px-4 py-3">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-bold text-gray-600 uppercase tracking-wider">R$ Sistema</span>
                  <span className="text-xl font-black text-gray-700">{formatCurrency(cardResumo.valTotalSistema || 0)}</span>
                </div>
                {tipoFiltro === 'todos' && (
                  <table className="w-full border-t border-gray-200">
                    <tbody>
                      <tr>
                        <td className="pt-1.5 w-1/2">
                          <div className="flex items-center gap-1.5">
                            <span className="w-2.5 h-2.5 rounded-full bg-green-500 flex-shrink-0"></span>
                            <span className="text-xs text-green-700 font-semibold">Entradas</span>
                          </div>
                        </td>
                        <td className="pt-1.5 text-right">
                          <span className="text-sm font-black text-green-700">{formatCurrency(cardResumo.valSistemaEntrada || 0)}</span>
                        </td>
                      </tr>
                      <tr>
                        <td className="pt-1 w-1/2">
                          <div className="flex items-center gap-1.5">
                            <span className="w-2.5 h-2.5 rounded-full bg-red-500 flex-shrink-0"></span>
                            <span className="text-xs text-red-700 font-semibold">Saídas</span>
                          </div>
                        </td>
                        <td className="pt-1 text-right">
                          <span className="text-sm font-black text-red-700">{formatCurrency(cardResumo.valSistemaSaida || 0)}</span>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                )}
              </div>
            </div>
            <div className="grid grid-cols-3 md:grid-cols-6 gap-3 mb-4">
              <SummaryCard title="Total Banco" value={cardResumo.totalBanco || 0} color="orange" subtitle={`${cardResumo.totalBanco || 0} mov.`} onClick={() => setCardFilter(cardFilter === 'todos_banco' ? null : 'todos_banco')} active={cardFilter === 'todos_banco'} />
              <SummaryCard title="Total Sistema" value={cardResumo.totalSistema || 0} color="gray" subtitle={`${cardResumo.totalSistema || 0} reg.`} onClick={() => setCardFilter(cardFilter === 'todos_sistema' ? null : 'todos_sistema')} active={cardFilter === 'todos_sistema'} />
              <SummaryCard title="Correspondencias" value={cardResumo.totalMatched || 0} color="blue" subtitle={formatCurrency(cardResumo.valMatchedBanco || 0)} onClick={() => setCardFilter(cardFilter === 'correspondencias' ? null : 'correspondencias')} active={cardFilter === 'correspondencias'} />
              <SummaryCard title="Conciliados" value={cardResumo.totalCompensado || 0} color="green" onClick={() => setCardFilter(cardFilter === 'conciliados' ? null : 'conciliados')} active={cardFilter === 'conciliados'} />
              <SummaryCard title="Sem Sistema" value={cardResumo.unmatchedBanco || 0} color="red" subtitle={formatCurrency(cardResumo.valUnmatchedBanco || 0)} onClick={() => setCardFilter(cardFilter === 'sem_sistema' ? null : 'sem_sistema')} active={cardFilter === 'sem_sistema'} />
              <SummaryCard title="Sem Banco" value={cardResumo.unmatchedSistema || 0} color="orange" subtitle={formatCurrency(cardResumo.valUnmatchedSistema || 0)} onClick={() => setCardFilter(cardFilter === 'sem_banco' ? null : 'sem_banco')} active={cardFilter === 'sem_banco'} />
            </div>
            </>
          )}

          {/* Table */}
          {loading ? (
            <div className="flex justify-center py-20">
              <RadarLoading />
            </div>
          ) : rows.length === 0 ? (
            <div className="bg-white rounded-lg shadow-sm border p-12 text-center text-gray-400">
              <p className="text-lg font-medium">Selecione um banco e clique em Buscar</p>
            </div>
          ) : (
            <div className="bg-white rounded-lg shadow-sm border">
              {/* Group headers */}
              <div className="flex">
                <div className="flex-1 bg-orange-600 text-white text-center py-2 px-3 text-xs font-bold uppercase tracking-wider border-r-2 border-gray-300">
                  Banco (Movimentacao)
                </div>
                <div className="w-[42px] bg-gray-800 text-white text-center py-2 px-1 text-xs font-bold border-r-2 border-gray-300 flex-shrink-0">
                  ST
                </div>
                <div className="flex-1 bg-orange-600 text-white text-center py-2 px-3 text-xs font-bold uppercase tracking-wider">
                  Sistema (Contas Pagas)
                </div>
              </div>

              {/* Column sub-headers (draggable) */}
              <div className="flex bg-gray-100 text-gray-600 text-xs font-bold uppercase border-b border-gray-200">
                {/* Bank columns */}
                <div className="flex-1 flex">
                  {bankDrag.cols.map((col, idx) => (
                    <div
                      key={col.id}
                      draggable
                      onDragStart={(e) => bankDrag.onDragStart(e, idx)}
                      onDragOver={(e) => bankDrag.onDragOver(e, idx)}
                      onDrop={(e) => bankDrag.onDrop(e, idx)}
                      onDragEnd={bankDrag.onDragEnd}
                      onClick={() => handleSort(col.id, bankDrag)}
                      className={`py-2 px-2 cursor-grab active:cursor-grabbing select-none hover:bg-orange-100 transition-all ${col.width} text-${col.align} ${idx === bankDrag.cols.length - 1 ? 'border-r-2 border-gray-300' : ''} ${bankDrag.dragIdx === idx ? 'opacity-40 scale-95' : ''} ${bankDrag.overIdx === idx && bankDrag.dragIdx !== null && bankDrag.dragIdx !== idx ? 'bg-orange-200 border-l-2 border-orange-500' : ''}`}
                      title="Arraste para reordenar / Clique para ordenar"
                    >
                      <span className="inline-flex items-center gap-1 pointer-events-none">
                        <svg className="w-3 h-3 opacity-30 flex-shrink-0" viewBox="0 0 24 24" fill="currentColor"><circle cx="9" cy="5" r="2"/><circle cx="15" cy="5" r="2"/><circle cx="9" cy="12" r="2"/><circle cx="15" cy="12" r="2"/><circle cx="9" cy="19" r="2"/><circle cx="15" cy="19" r="2"/></svg>
                        {col.label}
                        {sortCol === col.id && <SortArrow dir={sortDir} />}
                      </span>
                    </div>
                  ))}
                </div>
                {/* ST spacer */}
                <div className="w-[42px] py-2 px-1 text-center bg-gray-200 border-r-2 border-gray-300 flex-shrink-0"></div>
                {/* System columns */}
                <div className="flex-1 flex">
                  {sysDrag.cols.map((col, idx) => (
                    <div
                      key={col.id}
                      draggable
                      onDragStart={(e) => sysDrag.onDragStart(e, idx)}
                      onDragOver={(e) => sysDrag.onDragOver(e, idx)}
                      onDrop={(e) => sysDrag.onDrop(e, idx)}
                      onDragEnd={sysDrag.onDragEnd}
                      onClick={() => handleSort(col.id, sysDrag)}
                      className={`py-2 px-2 cursor-grab active:cursor-grabbing select-none hover:bg-orange-100 transition-all ${col.width} text-${col.align} ${sysDrag.dragIdx === idx ? 'opacity-40 scale-95' : ''} ${sysDrag.overIdx === idx && sysDrag.dragIdx !== null && sysDrag.dragIdx !== idx ? 'bg-orange-200 border-l-2 border-orange-500' : ''}`}
                      title="Arraste para reordenar / Clique para ordenar"
                    >
                      <span className="inline-flex items-center gap-1 pointer-events-none">
                        <svg className="w-3 h-3 opacity-30 flex-shrink-0" viewBox="0 0 24 24" fill="currentColor"><circle cx="9" cy="5" r="2"/><circle cx="15" cy="5" r="2"/><circle cx="9" cy="12" r="2"/><circle cx="15" cy="12" r="2"/><circle cx="9" cy="19" r="2"/><circle cx="15" cy="19" r="2"/></svg>
                        {col.label}
                        {sortCol === col.id && <SortArrow dir={sortDir} />}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Data rows */}
              <div>
                {filteredRows.map((row, idx) => (
                  <ConciliacaoRow
                    key={row.rowId}
                    row={row}
                    rowIndex={idx}
                    bankCols={bankDrag.cols}
                    sysCols={sysDrag.cols}
                    onOpenCandidates={(r) => setCandidateModal({
                      rowId: r.rowId,
                      banco: r.banco,
                      candidates: r.candidates || [],
                    })}
                  />
                ))}
              </div>

              {filteredRows.length === 0 && (
                <div className="text-center py-8 text-gray-400 text-sm">
                  Nenhum resultado para o filtro selecionado
                </div>
              )}
            </div>
          )}
        </div>
      </main>

      {/* Modal de candidatos */}
      {candidateModal && (
        <CandidateModal
          modal={candidateModal}
          onSelect={(candidate) => handleSelectCandidate(candidateModal.rowId, candidate)}
          onClose={() => setCandidateModal(null)}
        />
      )}
    </div>
  );
}

/* Render a single cell for the bank side */
function BankCell({ colId, row }) {
  const banco = row.banco;
  const bancoVal = banco ? Math.abs(parseFloat(banco.VAL_DOCTO) || 0) : 0;
  const isCredito = banco?.TIPO_OPERACAO === 0;

  switch (colId) {
    case 'bco_data':
      return <span className="text-xs whitespace-nowrap">{banco ? formatDate(banco.DTA_ENTRADA) : ''}</span>;
    case 'bco_favorecido':
      return <span className="text-xs break-words whitespace-normal leading-tight" title={banco?.FAVORECIDO || ''}>{banco?.FAVORECIDO || <span className="text-gray-300 italic">--</span>}</span>;
    case 'bco_valor':
      return <span className={`text-xs font-bold whitespace-nowrap ${isCredito ? 'text-green-700' : 'text-red-700'}`}>{banco ? formatCurrency(bancoVal) : ''}</span>;
    case 'bco_tipo':
      return banco ? (
        <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-bold ${isCredito ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
          {isCredito ? 'Entrada' : 'Saída'}
        </span>
      ) : null;
    default:
      return null;
  }
}

/* Render a single cell for the system side */
function SysCell({ colId, row, expanded, onToggleBordero }) {
  const sistema = row.sistema;
  switch (colId) {
    case 'sys_data':
      return <span className="text-xs whitespace-nowrap">{sistema ? formatDate(sistema.dtaQuitada) : ''}</span>;
    case 'sys_parceiro':
      return <span className="text-xs truncate block max-w-[200px]" title={sistema?.desParceiro || ''}>{sistema?.desParceiro || <span className="text-gray-300 italic">--</span>}</span>;
    case 'sys_nota':
      return <span className="text-xs text-gray-600 whitespace-nowrap">{sistema?.numDocto || ''}</span>;
    case 'sys_subcategoria':
      return <span className="text-xs text-gray-600 truncate block max-w-[160px]" title={sistema?.desSubcategoria || ''}>{sistema?.desSubcategoria || ''}</span>;
    case 'sys_bordero':
      return (
        <span className="text-xs text-gray-500 flex items-center gap-1">
          {sistema?.numBordero || ''}
          {sistema?.type === 'bordero' && sistema?.items?.length > 1 && (
            <button
              onClick={(e) => { e.stopPropagation(); onToggleBordero && onToggleBordero(); }}
              className="inline-flex items-center justify-center w-5 h-5 rounded border border-orange-400 bg-orange-50 hover:bg-orange-200 text-orange-700 font-black text-[11px] cursor-pointer transition-colors flex-shrink-0"
              title={`${sistema.items.length} contas neste borderô - clique para expandir`}
            >
              {expanded ? '−' : '+'}
            </button>
          )}
          {sistema?.type === 'bordero' && (
            <span className="text-[9px] bg-orange-100 text-orange-600 px-1 rounded font-bold">
              {sistema.numRegistros.length}x
            </span>
          )}
        </span>
      );
    case 'sys_valor': {
      if (!sistema) return null;
      const isEnt = sistema.tipoConta === 1;
      return <span className={`text-xs font-bold whitespace-nowrap ${isEnt ? 'text-green-700' : 'text-red-700'}`}>{formatCurrency(sistema.valTotal)}</span>;
    }
    case 'sys_tipo': {
      if (!sistema) return null;
      // TIPO_CONTA: 1 = Contas a Receber (Entrada), 2 = Contas a Pagar (Saída)
      const isEntrada = sistema.tipoConta === 1;
      return (
        <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-bold ${isEntrada ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
          {isEntrada ? 'Entrada' : 'Saída'}
        </span>
      );
    }
    default:
      return null;
  }
}

function ConciliacaoRow({ row, rowIndex, bankCols, sysCols, onOpenCandidates }) {
  const [expanded, setExpanded] = useState(false);
  const isMatched = row.matchStatus === 'MATCHED';
  const isBankOnly = row.matchStatus === 'UNMATCHED_BANK';
  const isSysOnly = row.matchStatus === 'UNMATCHED_SYSTEM';
  const hasCandidates = row.candidates && row.candidates.length > 1;
  const isBordero = row.sistema?.type === 'bordero' && row.sistema?.items?.length > 1;

  const isEven = rowIndex % 2 === 0;
  const rowBg = row.isCompensado
    ? (isEven ? 'bg-green-50/70' : 'bg-white')
    : isMatched
    ? (isEven ? 'bg-yellow-50/50' : 'bg-white')
    : isBankOnly
    ? (isEven ? 'bg-red-50/50' : 'bg-white')
    : (isEven ? 'bg-orange-50/50' : 'bg-white');

  const alignClass = (a) => a === 'left' ? 'text-left' : a === 'right' ? 'text-right' : 'text-center';

  return (
    <>
      <div className={`flex ${rowBg} border-b border-gray-100 hover:brightness-95 transition-colors`}>
        {/* Bank cells */}
        <div className="flex-1 flex">
          {bankCols.map((col, idx) => (
            <div
              key={col.id}
              className={`py-1.5 px-2 ${alignClass(col.align)} ${col.width} ${idx === bankCols.length - 1 ? 'border-r-2 border-gray-200' : ''}`}
            >
              <BankCell colId={col.id} row={row} />
            </div>
          ))}
        </div>

        {/* Status badge */}
        <div className="w-[42px] py-1.5 px-1 text-center bg-gray-50/50 border-r-2 border-gray-200 flex-shrink-0 flex items-center justify-center">
          {isMatched && !row.isCompensado && !hasCandidates && (
            <span className="inline-flex items-center justify-center w-6 h-6 rounded border-2 border-gray-400 bg-white cursor-pointer hover:bg-gray-50 transition-colors" title="Correspondencia encontrada - pendente conciliacao">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#000000" strokeWidth="3.5">
                <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </span>
          )}
          {isMatched && !row.isCompensado && hasCandidates && (
            <button
              onClick={() => onOpenCandidates(row)}
              className="inline-flex items-center justify-center w-6 h-6 rounded border-2 border-amber-500 bg-amber-50 hover:bg-amber-100 hover:scale-110 transition-all cursor-pointer animate-pulse"
              title={`${row.candidates.length} candidatos com mesmo valor - clique para escolher`}
            >
              <span className="text-amber-600 font-black text-xs">!</span>
            </button>
          )}
          {isMatched && row.isCompensado && (
            <span className="inline-flex items-center justify-center w-6 h-6 rounded border-2 border-green-500 bg-green-500" title="Conciliado">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3.5">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </span>
          )}
          {isBankOnly && (
            <span className="inline-flex items-center justify-center w-6 h-6 rounded border-2 border-red-300 bg-white" title="Sem correspondencia no sistema">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="3">
                <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </span>
          )}
          {isSysOnly && (
            <span className="inline-flex items-center justify-center w-6 h-6 rounded border-2 border-orange-300 bg-white" title="Sem correspondencia no banco">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#f97316" strokeWidth="3">
                <line x1="12" y1="5" x2="12" y2="14" /><circle cx="12" cy="19" r="1.5" fill="#f97316" />
              </svg>
            </span>
          )}
        </div>

        {/* System cells */}
        <div className="flex-1 flex">
          {sysCols.map((col) => (
            <div
              key={col.id}
              className={`py-1.5 px-2 ${alignClass(col.align)} ${col.width}`}
            >
              <SysCell colId={col.id} row={row} expanded={expanded} onToggleBordero={() => setExpanded(!expanded)} />
            </div>
          ))}
        </div>
      </div>

      {/* Expanded bordero sub-rows */}
      {expanded && isBordero && row.sistema.items.map((item, idx) => {
        const isEntItem = item.tipoConta === 1;
        return (
          <div key={item.numRegistro} className={`flex ${idx % 2 === 0 ? 'bg-orange-50/30' : 'bg-white'} border-b border-dashed border-orange-200 hover:bg-orange-100/30 transition-colors`}>
            {/* Bank side empty */}
            <div className="flex-1 flex">
              {bankCols.map((col, ci) => (
                <div key={col.id} className={`py-1 px-2 ${col.width} ${ci === bankCols.length - 1 ? 'border-r-2 border-gray-200' : ''}`} />
              ))}
            </div>
            {/* Status column - small dot */}
            <div className="w-[42px] py-1 px-1 text-center bg-gray-50/50 border-r-2 border-gray-200 flex-shrink-0 flex items-center justify-center">
              <span className="w-2 h-2 rounded-full bg-orange-300" />
            </div>
            {/* System sub-row cells */}
            <div className="flex-1 flex">
              {sysCols.map((col) => {
                let content = null;
                switch (col.id) {
                  case 'sys_data':
                    content = <span className="text-[11px] text-gray-500 whitespace-nowrap">{formatDate(item.dtaQuitada)}</span>;
                    break;
                  case 'sys_parceiro':
                    content = <span className="text-[11px] text-gray-600 truncate block max-w-[200px]" title={item.desParceiro}>{item.desParceiro}</span>;
                    break;
                  case 'sys_nota':
                    content = <span className="text-[11px] text-gray-500">{item.numDocto || ''}</span>;
                    break;
                  case 'sys_subcategoria':
                    content = null;
                    break;
                  case 'sys_bordero':
                    content = null;
                    break;
                  case 'sys_valor':
                    content = <span className={`text-[11px] font-semibold whitespace-nowrap ${isEntItem ? 'text-green-600' : 'text-red-600'}`}>{formatCurrency(item.valParcela)}</span>;
                    break;
                  case 'sys_tipo':
                    content = (
                      <span className={`inline-block px-1 py-0.5 rounded text-[9px] font-bold ${isEntItem ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'}`}>
                        {isEntItem ? 'Entrada' : 'Saída'}
                      </span>
                    );
                    break;
                }
                return (
                  <div key={col.id} className={`py-1 px-2 ${alignClass(col.align)} ${col.width}`}>
                    {content}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </>
  );
}

/* Modal para escolher entre candidatos com mesmo valor */
function CandidateModal({ modal, onSelect, onClose }) {
  const { banco, candidates } = modal;
  const bancoVal = banco ? Math.abs(parseFloat(banco.VAL_DOCTO) || 0) : 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-2xl max-w-xl w-full mx-4 max-h-[80vh] overflow-auto" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="bg-amber-500 text-white px-5 py-3 rounded-t-xl flex items-center justify-between">
          <div>
            <h3 className="font-bold text-lg">Multiplos Candidatos</h3>
            <p className="text-amber-100 text-xs">Escolha qual registro do sistema corresponde a este movimento bancario</p>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-amber-600 rounded-lg transition-colors">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Banco info */}
        <div className="px-5 py-3 bg-orange-50 border-b">
          <p className="text-xs text-orange-600 font-bold uppercase">Movimento Bancario</p>
          <div className="flex items-center gap-4 mt-1">
            <span className="text-sm font-bold text-gray-800">{formatDate(banco?.DTA_ENTRADA)}</span>
            <span className="text-sm text-gray-600 flex-1 truncate">{banco?.FAVORECIDO}</span>
            <span className="text-sm font-black text-orange-700">{formatCurrency(bancoVal)}</span>
          </div>
        </div>

        {/* Candidates list */}
        <div className="px-5 py-3">
          <p className="text-xs text-gray-500 font-bold uppercase mb-2">
            {candidates.length} candidatos encontrados - selecione um:
          </p>
          <div className="space-y-2">
            {candidates.map((c, idx) => (
              <button
                key={idx}
                onClick={() => onSelect(c)}
                className="w-full text-left border border-gray-200 rounded-lg p-3 hover:bg-orange-50 hover:border-orange-400 transition-all group"
              >
                <div className="flex items-center gap-3">
                  <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-gray-100 text-gray-600 font-bold text-sm group-hover:bg-orange-100 group-hover:text-orange-700 transition-colors">
                    {idx + 1}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-gray-800 truncate">{c.desParceiro}</p>
                    <div className="flex items-center gap-3 text-xs text-gray-500 mt-0.5">
                      <span>Data: {formatDate(c.dtaQuitada)}</span>
                      {c.numBordero && <span>Bordero: {c.numBordero}</span>}
                      {c.type === 'bordero' && <span className="bg-orange-100 text-orange-600 px-1 rounded font-bold">{c.numRegistros?.length || 0}x</span>}
                      {c.desCategoria && <span>{c.desCategoria}</span>}
                    </div>
                  </div>
                  <span className="text-sm font-black text-gray-700">{formatCurrency(c.valTotal)}</span>
                  <svg className="w-5 h-5 text-gray-300 group-hover:text-orange-500 transition-colors" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polyline points="9 18 15 12 9 6" />
                  </svg>
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function SummaryCard({ title, value, color, subtitle, onClick, active }) {
  const colorMap = {
    blue: 'bg-blue-50 border-blue-200 text-blue-700',
    gray: 'bg-gray-50 border-gray-200 text-gray-700',
    green: 'bg-green-50 border-green-200 text-green-700',
    red: 'bg-red-50 border-red-200 text-red-700',
    orange: 'bg-orange-50 border-orange-200 text-orange-700',
  };
  const activeMap = {
    blue: 'bg-blue-100 border-blue-500 text-blue-800 ring-2 ring-blue-300',
    gray: 'bg-gray-100 border-gray-500 text-gray-800 ring-2 ring-gray-300',
    green: 'bg-green-100 border-green-500 text-green-800 ring-2 ring-green-300',
    red: 'bg-red-100 border-red-500 text-red-800 ring-2 ring-red-300',
    orange: 'bg-orange-100 border-orange-500 text-orange-800 ring-2 ring-orange-300',
  };

  return (
    <div
      className={`${active ? (activeMap[color] || activeMap.gray) : (colorMap[color] || colorMap.gray)} border rounded-lg px-3 py-2 text-center ${onClick ? 'cursor-pointer hover:brightness-95 transition-all' : ''}`}
      onClick={onClick}
    >
      <p className="text-[10px] font-bold uppercase tracking-wider opacity-70">{title}</p>
      <p className="text-2xl font-black">{value}</p>
      {subtitle && <p className="text-[10px] font-medium opacity-60 mt-0.5">{subtitle}</p>}
    </div>
  );
}
