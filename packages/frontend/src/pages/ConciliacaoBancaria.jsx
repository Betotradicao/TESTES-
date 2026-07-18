import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useLoja } from '../contexts/LojaContext';
import Sidebar from '../components/Sidebar';
import RadarLoading from '../components/RadarLoading';
import { api } from '../utils/api';
import toast from 'react-hot-toast';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

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
  const [loading, setLoading] = useState(false);

  // Modal state
  const [candidateModal, setCandidateModal] = useState(null);
  const [transferModal, setTransferModal] = useState(null);

  // Filter state
  const [bancos, setBancos] = useState([]);
  const [loadingBancos, setLoadingBancos] = useState(true);
  const [codBanco, setCodBanco] = useState('');
  const [codBancoSistema, setCodBancoSistema] = useState(''); // Grupo de banco do sistema
  const [contaCorrenteSistema, setContaCorrenteSistema] = useState(''); // DES_CC da conta corrente selecionada
  const [contasCorrentesList, setContasCorrentesList] = useState([]); // Lista de contas correntes do banco (da API)
  const [loadingContas, setLoadingContas] = useState(false);
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
  const [cardFilter, setCardFilter] = useState(null); // null | 'todos_banco' | 'todos_sistema' | 'conciliados' | 'sem_sistema' | 'sem_banco'

  // Draggable columns
  const bankDrag = useDraggableCols(BANK_COLUMNS, 'conciliacao_bank_cols');
  const sysDrag = useDraggableCols(SYS_COLUMNS, 'conciliacao_sys_cols');

  const searchIdRef = useRef(0);

  // Modo: 'sistema' (cruza com Oracle) | 'manual' (amarra no plano de contas)
  const [modo, setModo] = useState('sistema');
  const [manualRows, setManualRows] = useState([]);
  const [loadingManual, setLoadingManual] = useState(false);
  const [planoContasTree, setPlanoContasTree] = useState([]);
  const [manualTransferModal, setManualTransferModal] = useState(null);
  const [manualSelected, setManualSelected] = useState(() => new Set()); // mov_keys selecionados
  const toggleManualSel = useCallback((movKey) => setManualSelected(prev => {
    const n = new Set(prev); n.has(movKey) ? n.delete(movKey) : n.add(movKey); return n;
  }), []);

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
          const defaultBanco = String(santander ? santander.COD_BANCO : list[0].COD_BANCO);
          setCodBanco(defaultBanco);
          setCodBancoSistema(defaultBanco);
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

  // Bancos únicos (dedup por DES_BANCO) para dropdowns de Banco Extrato e Banco Sistema
  const bancosUnicos = useMemo(() => {
    const seen = new Map();
    for (const b of bancos) {
      const nome = (b.DES_BANCO || '').toUpperCase().trim();
      if (!seen.has(nome)) {
        seen.set(nome, b);
      }
    }
    return Array.from(seen.values());
  }, [bancos]);

  // Filter bank accounts that match the selected Oracle bank name
  const matchedAccounts = useMemo(() => {
    if (!codBanco || bankAccounts.length === 0) return [];
    const bancoObj = bancos.find(b => String(b.COD_BANCO) === codBanco);
    if (!bancoObj) return [];
    const desBanco = (bancoObj.DES_BANCO || '').toLowerCase();
    return bankAccounts.filter(acc => {
      const nome = (acc.nome || '').toLowerCase();
      const tipo = (acc.tipo_banco || '').toLowerCase();
      if (desBanco.includes('santander') && (nome.includes('santander') || tipo === 'santander')) return true;
      if (desBanco.includes('bradesco') && (nome.includes('bradesco') || tipo === 'bradesco')) return true;
      if (desBanco.includes('itau') && (nome.includes('itau') || tipo === 'itau')) return true;
      if (desBanco.includes('caixa') && (nome.includes('caixa') || tipo === 'caixa')) return true;
      return false;
    });
  }, [codBanco, bancos, bankAccounts]);

  // Auto-select account when matched accounts change (priorizar Tradição LTDA 130075973)
  useEffect(() => {
    if (matchedAccounts.length > 0) {
      const tradicao = matchedAccounts.find(a => a.conta && a.conta.includes('130075973'));
      setSelectedBankAccountId(tradicao ? tradicao.id : matchedAccounts[0].id);
    } else {
      setSelectedBankAccountId('');
    }
  }, [matchedAccounts]);

  // Buscar contas correntes da API quando Banco (Sistema) mudar
  useEffect(() => {
    const codBancoNum = Number(codBancoSistema || codBanco);
    if (!codBancoNum) {
      setContasCorrentesList([]);
      setContaCorrenteSistema('');
      return;
    }
    const fetchContas = async () => {
      setLoadingContas(true);
      try {
        const res = await api.get(`/conciliacao/contas-correntes?codBanco=${codBancoNum}`);
        const list = res.data?.data || [];
        setContasCorrentesList(list);
        // Auto-selecionar a primeira conta corrente (ordenada por DES_APELIDO)
        if (list.length > 0) {
          setContaCorrenteSistema(list[0].DES_CC);
        } else {
          setContaCorrenteSistema('');
        }
      } catch (err) {
        console.error('Erro ao buscar contas correntes:', err);
        setContasCorrentesList([]);
        setContaCorrenteSistema('');
      } finally {
        setLoadingContas(false);
      }
    };
    fetchContas();
  }, [codBancoSistema, codBanco]);

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
      const bancoSistemaFinal = codBancoSistema || codBanco;
      if (bancoSistemaFinal !== codBanco) params.append('codBancoSistema', bancoSistemaFinal);
      if (contaCorrenteSistema) params.append('desCc', contaCorrenteSistema);
      if (selectedBankAccountId) params.append('bankId', selectedBankAccountId);
      params.append('dtaInicio', dtaInicio);
      params.append('dtaFim', dtaFim);

      const res = await api.get(`/conciliacao/dados?${params.toString()}`);
      if (currentSearchId !== searchIdRef.current) return;

      if (res.data?.success) {
        setRows(res.data.rows || []);
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

  // Modo Manual: busca extrato do banco + amarrações + plano de contas
  const fetchManual = async () => {
    setLoadingManual(true);
    try {
      const params = new URLSearchParams();
      if (lojaSelecionada) params.append('codLoja', lojaSelecionada);
      if (selectedBankAccountId) params.append('bankId', selectedBankAccountId);
      params.append('dtaInicio', dtaInicio);
      params.append('dtaFim', dtaFim);
      const [dadosRes, planoRes] = await Promise.all([
        api.get(`/conciliacao/dados-manual?${params.toString()}`),
        api.get(`/plano-contas${lojaSelecionada ? `?codLoja=${lojaSelecionada}` : ''}`),
      ]);
      if (dadosRes.data?.success) setManualRows(dadosRes.data.rows || []);
      setPlanoContasTree(planoRes.data?.data || []);
      if (!(dadosRes.data?.rows || []).length) toast('Nenhum lançamento no banco pro período', { icon: 'ℹ️' });
    } catch (err) {
      console.error(err);
      toast.error('Erro ao buscar dados (modo manual)');
    } finally {
      setLoadingManual(false);
    }
  };

  const acharContaInfo = useCallback((contaId) => {
    for (const g of planoContasTree) {
      const c = (g.contas || []).find(x => String(x.id) === String(contaId));
      if (c) return { plano_conta_id: c.id, conta_nome: c.nome, grupo_nome: g.nome, is_receita: g.is_receita };
    }
    return null;
  }, [planoContasTree]);

  // Alvos da ação: se há seleção, aplica em lote; senão só na linha clicada
  const alvosDaAcao = (row) => (manualSelected.size > 0 ? manualRows.filter(r => manualSelected.has(r.mov_key)) : [row]);

  // AUTOMÁTICA: texto exato -> conta (aplica a todas as linhas com o mesmo texto)
  const handleAuto = useCallback(async (row, contaId) => {
    const info = acharContaInfo(contaId);
    const cls = info ? { origem: 'automatica', ...info } : null;
    const targets = alvosDaAcao(row);
    const textos = [...new Set(targets.map(t => t.texto_exato))];
    const textoSet = new Set(textos);
    setManualRows(prev => prev.map(r => {
      if (!textoSet.has(r.texto_exato)) return r;
      if (r.classificacao && r.classificacao.origem !== 'automatica') return r;
      return { ...r, classificacao: cls };
    }));
    setManualSelected(new Set());
    try {
      await Promise.all(textos.map(txt => api.post('/conciliacao/amarracoes', { ...(lojaSelecionada ? { cod_loja: Number(lojaSelecionada) } : {}), texto_exato: txt, plano_conta_id: Number(contaId) })));
    } catch { toast.error('Erro ao salvar (automática)'); }
  }, [acharContaInfo, lojaSelecionada, manualSelected, manualRows]);

  // ÚNICA: por movimento (lote = cada selecionado)
  const handleUnica = useCallback(async (row, contaId) => {
    const info = acharContaInfo(contaId);
    const cls = info ? { origem: 'unica', ...info } : null;
    const targets = alvosDaAcao(row);
    const keys = new Set(targets.map(t => t.mov_key));
    setManualRows(prev => prev.map(r => keys.has(r.mov_key) ? { ...r, classificacao: cls } : r));
    setManualSelected(new Set());
    try {
      await Promise.all(targets.map(t => api.post('/conciliacao/movimento/unica', { ...(lojaSelecionada ? { cod_loja: Number(lojaSelecionada) } : {}), mov_key: t.mov_key, plano_conta_id: Number(contaId) })));
    } catch { toast.error('Erro ao salvar (única)'); }
  }, [acharContaInfo, lojaSelecionada, manualSelected, manualRows]);

  // TRANSFERÊNCIA: entre contas, fora do DRE (lote = mesmo destino pra todos)
  const handleTransferManual = useCallback(async (row, targetAccountId) => {
    const targets = alvosDaAcao(row);
    const keys = new Set(targets.map(t => t.mov_key));
    setManualRows(prev => prev.map(r => keys.has(r.mov_key) ? { ...r, classificacao: { origem: 'transferencia' } } : r));
    setManualSelected(new Set());
    setManualTransferModal(null);
    try {
      await Promise.all(targets.map(t => {
        const val = Math.abs(parseFloat(t.banco.VAL_DOCTO) || 0);
        const isSaida = t.banco.TIPO_OPERACAO === 1;
        return api.post('/conciliacao/movimento/transferencia', {
          ...(lojaSelecionada ? { cod_loja: Number(lojaSelecionada) } : {}),
          mov_key: t.mov_key,
          sourceAccountId: isSaida ? selectedBankAccountId : targetAccountId,
          targetAccountId: isSaida ? targetAccountId : selectedBankAccountId,
          amount: val, date: t.banco.DTA_ENTRADA, description: t.banco.FAVORECIDO || 'Transferência entre contas',
        });
      }));
      toast.success('Transferência registrada!');
    } catch { toast.error('Erro ao registrar transferência'); }
  }, [lojaSelecionada, selectedBankAccountId, manualSelected, manualRows]);

  const handleLimpar = useCallback(async (row) => {
    const origem = row.classificacao?.origem;
    if (origem === 'automatica') {
      setManualRows(prev => prev.map(r => (r.texto_exato === row.texto_exato && r.classificacao?.origem === 'automatica') ? { ...r, classificacao: null } : r));
      try {
        await api.delete('/conciliacao/amarracoes', { data: { ...(lojaSelecionada ? { cod_loja: Number(lojaSelecionada) } : {}), texto_exato: row.texto_exato } });
      } catch { toast.error('Erro ao limpar'); }
    } else {
      setManualRows(prev => prev.map(r => r.mov_key === row.mov_key ? { ...r, classificacao: null } : r));
      try {
        await api.delete('/conciliacao/movimento', { data: { ...(lojaSelecionada ? { cod_loja: Number(lojaSelecionada) } : {}), mov_key: row.mov_key } });
      } catch { toast.error('Erro ao limpar'); }
    }
  }, [lojaSelecionada]);

  // Sem auto-search - busca somente ao clicar Buscar

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
    } else if (cardFilter === 'conciliados') {
      r = r.filter(row => row.matchStatus === 'MATCHED');
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

  // Modo Manual: aplica o filtro Tipo (Entradas/Saídas) e o Exibir (Classificado/Não)
  const manualRowsFiltered = useMemo(() => {
    let r = manualRows;
    if (tipoFiltro === 'entrada') r = r.filter(row => row.banco?.TIPO_OPERACAO === 0);
    else if (tipoFiltro === 'saida') r = r.filter(row => row.banco?.TIPO_OPERACAO === 1);
    // Reaproveita o "Exibir": Sem Sistema = não classificado | Sem Banco = classificado
    if (viewFilter === 'sem_sistema') r = r.filter(row => !row.classificacao);
    else if (viewFilter === 'sem_banco') r = r.filter(row => !!row.classificacao);
    return r;
  }, [manualRows, tipoFiltro, viewFilter]);

  // Handle selecting a candidate from the modal
  const handleSelectCandidate = useCallback((rowId, selectedCandidate) => {
    setRows(prev => {
      const newRows = [];
      for (const r of prev) {
        if (r.rowId === rowId) {
          // Row selecionada: vincular candidato escolhido e limpar candidates (fica verde)
          newRows.push({
            ...r,
            sistema: selectedCandidate,
            matchStatus: 'MATCHED',
            isCompensado: selectedCandidate.flgCompensado || false,
            candidates: null,
          });
          // Candidatos não selecionados voltam como "Sem Banco"
          const others = (r.candidates || []).filter(c => c !== selectedCandidate);
          for (let i = 0; i < others.length; i++) {
            newRows.push({
              rowId: `resolved_${rowId}_${i}_${Date.now()}`,
              banco: null,
              sistema: others[i],
              matchStatus: 'UNMATCHED_SYSTEM',
              isCompensado: false,
              candidates: null,
            });
          }
        } else {
          newRows.push(r);
        }
      }
      return newRows;
    });
    setCandidateModal(null);
    toast.success('Conciliado com sucesso!');
  }, []);

  // Handle confirming a transfer between accounts
  const handleConfirmTransfer = useCallback(async (rowId, targetAccountId, bancoData) => {
    const targetAccount = bankAccounts.find(a => String(a.id) === String(targetAccountId));

    const val = Math.abs(parseFloat(bancoData.VAL_DOCTO) || 0);
    const isSaida = bancoData.TIPO_OPERACAO === 1;
    const targetLabel = targetAccount
      ? `${targetAccount.nome}${targetAccount.conta ? ` | ${targetAccount.conta}` : ''}`
      : 'outra conta';

    setTransferModal(null);

    // Persist to API first, then update UI with real transferId
    try {
      const res = await api.post('/conciliacao/transferencia', {
        sourceAccountId: isSaida ? selectedBankAccountId : targetAccountId,
        targetAccountId: isSaida ? targetAccountId : selectedBankAccountId,
        amount: val,
        date: bancoData.DTA_ENTRADA,
        description: bancoData.FAVORECIDO || 'Transferência entre contas',
      });
      const transferId = res.data?.data?.id;

      setRows(prev => prev.map(r => {
        if (r.rowId === rowId) {
          return {
            ...r,
            sistema: {
              dtaQuitada: r.banco.DTA_ENTRADA,
              desParceiro: isSaida
                ? `Transferido para ${targetLabel}`
                : `Recebido de ${targetLabel}`,
              numDocto: '',
              numBordero: '',
              desSubcategoria: 'Transferência entre Contas',
              desCategoria: 'Transferência entre Contas',
              valTotal: val,
              tipoConta: isSaida ? 2 : 1,
              flgCompensado: false,
              transferId,
            },
            matchStatus: 'MATCHED',
            isCompensado: false,
            isTransfer: true,
            transferId,
            candidates: null,
          };
        }
        return r;
      }));
      toast.success('Transferência registrada!');
    } catch (err) {
      console.error('Erro ao registrar transferência:', err);
      toast.error('Erro ao salvar transferência');
    }
  }, [bankAccounts, selectedBankAccountId]);

  // Handle deleting a transfer (undo)
  const handleDeleteTransfer = useCallback(async (rowId, transferId) => {
    try {
      await api.delete(`/conciliacao/transferencia/${transferId}`);
      setRows(prev => {
        const row = prev.find(r => r.rowId === rowId);
        // Se banco era sintético (criado pelo Step D), remover a row inteira
        if (row?.banco?.isSynthetic) {
          return prev.filter(r => r.rowId !== rowId);
        }
        // Se tinha movimento real, voltar para UNMATCHED_BANK
        return prev.map(r => {
          if (r.rowId === rowId) {
            return {
              ...r,
              sistema: null,
              matchStatus: 'UNMATCHED_BANK',
              isCompensado: false,
              isTransfer: false,
              transferId: null,
              candidates: null,
            };
          }
          return r;
        });
      });
      toast.success('Transferência removida!');
    } catch (err) {
      console.error('Erro ao remover transferência:', err);
      toast.error('Erro ao remover transferência');
    }
  }, []);

  // PDF Export - Banco (Movimentação)
  const gerarPdfBanco = useCallback(() => {
    const bancoRows = filteredRows.filter(r => r.banco);
    if (!bancoRows.length) return toast.error('Nenhum movimento bancário para exportar');

    const doc = new jsPDF('landscape', 'mm', 'a4');
    const pageWidth = doc.internal.pageSize.getWidth();

    // Header
    doc.setFillColor(234, 88, 12);
    doc.rect(0, 0, pageWidth, 22, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('CONCILIAÇÃO BANCÁRIA - BANCO (MOVIMENTAÇÃO)', pageWidth / 2, 10, { align: 'center' });
    doc.setFontSize(9);
    doc.text(`Período: ${formatDate(dtaInicio)} a ${formatDate(dtaFim)}`, pageWidth / 2, 17, { align: 'center' });

    // Resumo
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    const totalEntradas = bancoRows.filter(r => r.banco.TIPO_OPERACAO === 0).reduce((s, r) => s + Math.abs(parseFloat(r.banco.VAL_DOCTO) || 0), 0);
    const totalSaidas = bancoRows.filter(r => r.banco.TIPO_OPERACAO === 1).reduce((s, r) => s + Math.abs(parseFloat(r.banco.VAL_DOCTO) || 0), 0);
    doc.text(`Total: ${bancoRows.length} mov.  |  Entradas: ${formatCurrency(totalEntradas)}  |  Saídas: ${formatCurrency(totalSaidas)}  |  Saldo: ${formatCurrency(totalEntradas - totalSaidas)}`, 14, 30);

    // Tabela
    const tableData = bancoRows.map(r => [
      formatDate(r.banco.DTA_ENTRADA),
      r.banco.FAVORECIDO || '-',
      r.banco.TIPO_OPERACAO === 0 ? 'Entrada' : 'Saída',
      formatCurrency(Math.abs(parseFloat(r.banco.VAL_DOCTO) || 0)),
      r.matchStatus === 'MATCHED' ? 'Conciliado' : 'Sem Sistema',
    ]);

    autoTable(doc, {
      startY: 35,
      head: [['Data', 'Favorecido', 'Tipo', 'Valor', 'Status']],
      body: tableData,
      styles: { fontSize: 8, cellPadding: 2 },
      headStyles: { fillColor: [234, 88, 12], textColor: 255, fontStyle: 'bold' },
      columnStyles: {
        0: { cellWidth: 22, halign: 'center' },
        1: { cellWidth: 'auto' },
        2: { cellWidth: 20, halign: 'center' },
        3: { cellWidth: 30, halign: 'right' },
        4: { cellWidth: 28, halign: 'center' },
      },
      alternateRowStyles: { fillColor: [255, 247, 237] },
      didDrawCell: (data) => {
        // Badge colorido no Status (coluna 4)
        if (data.section === 'body' && data.column.index === 4) {
          const text = data.cell.raw;
          const x = data.cell.x + 1;
          const y = data.cell.y + 1;
          const w = data.cell.width - 2;
          const h = data.cell.height - 2;
          if (text === 'Conciliado') {
            doc.setFillColor(220, 252, 231);
            doc.roundedRect(x, y, w, h, 1.5, 1.5, 'F');
            doc.setTextColor(22, 101, 52);
          } else {
            doc.setFillColor(254, 226, 226);
            doc.roundedRect(x, y, w, h, 1.5, 1.5, 'F');
            doc.setTextColor(153, 27, 27);
          }
          doc.setFontSize(7);
          doc.setFont('helvetica', 'bold');
          doc.text(text, data.cell.x + data.cell.width / 2, data.cell.y + data.cell.height / 2 + 1, { align: 'center' });
        }
      },
      willDrawCell: (data) => {
        // Esconder texto padrão do Status para desenhar custom
        if (data.section === 'body' && data.column.index === 4) {
          data.cell.text = [];
        }
      },
      didDrawPage: (data) => {
        doc.setFontSize(7);
        doc.setTextColor(150);
        doc.text(`Página ${doc.internal.getNumberOfPages()}`, pageWidth - 14, doc.internal.pageSize.getHeight() - 5, { align: 'right' });
      },
    });

    doc.save(`conciliacao-banco-${dtaInicio}-${dtaFim}.pdf`);
    toast.success('PDF Banco gerado!');
  }, [filteredRows, dtaInicio, dtaFim]);

  // PDF Export - Sistema (Contas Pagas)
  const gerarPdfSistema = useCallback(() => {
    const sistemaRows = filteredRows.filter(r => r.sistema);
    if (!sistemaRows.length) return toast.error('Nenhum movimento do sistema para exportar');

    const doc = new jsPDF('landscape', 'mm', 'a4');
    const pageWidth = doc.internal.pageSize.getWidth();

    // Header
    doc.setFillColor(234, 88, 12);
    doc.rect(0, 0, pageWidth, 22, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('CONCILIAÇÃO BANCÁRIA - SISTEMA (CONTAS PAGAS)', pageWidth / 2, 10, { align: 'center' });
    doc.setFontSize(9);
    doc.text(`Período: ${formatDate(dtaInicio)} a ${formatDate(dtaFim)}`, pageWidth / 2, 17, { align: 'center' });

    // Resumo
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    const totalEntradas = sistemaRows.filter(r => r.sistema.tipoConta === 1).reduce((s, r) => s + r.sistema.valTotal, 0);
    const totalSaidas = sistemaRows.filter(r => r.sistema.tipoConta !== 1).reduce((s, r) => s + r.sistema.valTotal, 0);
    doc.text(`Total: ${sistemaRows.length} reg.  |  Entradas: ${formatCurrency(totalEntradas)}  |  Saídas: ${formatCurrency(totalSaidas)}  |  Saldo: ${formatCurrency(totalEntradas - totalSaidas)}`, 14, 30);

    // Tabela
    const tableData = sistemaRows.map(r => [
      formatDate(r.sistema.dtaQuitada),
      r.sistema.desParceiro || '-',
      r.sistema.numDocto || '-',
      r.sistema.numBordero || '-',
      r.sistema.desSubcategoria || '-',
      r.sistema.tipoConta === 1 ? 'Entrada' : 'Saída',
      formatCurrency(r.sistema.valTotal || 0),
      r.matchStatus === 'MATCHED' ? 'Conciliado' : 'Sem Banco',
    ]);

    autoTable(doc, {
      startY: 35,
      head: [['Data', 'Parceiro', 'Nota', 'Bordero', 'Subcategoria', 'Tipo', 'Valor', 'Status']],
      body: tableData,
      styles: { fontSize: 7, cellPadding: 2 },
      headStyles: { fillColor: [234, 88, 12], textColor: 255, fontStyle: 'bold' },
      columnStyles: {
        0: { cellWidth: 20, halign: 'center' },
        1: { cellWidth: 'auto' },
        2: { cellWidth: 18, halign: 'center' },
        3: { cellWidth: 18, halign: 'center' },
        4: { cellWidth: 40 },
        5: { cellWidth: 18, halign: 'center' },
        6: { cellWidth: 28, halign: 'right' },
        7: { cellWidth: 25, halign: 'center' },
      },
      alternateRowStyles: { fillColor: [255, 247, 237] },
      didDrawCell: (data) => {
        if (data.section === 'body' && data.column.index === 7) {
          const text = data.cell.raw;
          const x = data.cell.x + 1;
          const y = data.cell.y + 1;
          const w = data.cell.width - 2;
          const h = data.cell.height - 2;
          if (text === 'Conciliado') {
            doc.setFillColor(220, 252, 231);
            doc.roundedRect(x, y, w, h, 1.5, 1.5, 'F');
            doc.setTextColor(22, 101, 52);
          } else {
            doc.setFillColor(254, 226, 226);
            doc.roundedRect(x, y, w, h, 1.5, 1.5, 'F');
            doc.setTextColor(153, 27, 27);
          }
          doc.setFontSize(6);
          doc.setFont('helvetica', 'bold');
          doc.text(text, data.cell.x + data.cell.width / 2, data.cell.y + data.cell.height / 2 + 1, { align: 'center' });
        }
      },
      willDrawCell: (data) => {
        if (data.section === 'body' && data.column.index === 7) {
          data.cell.text = [];
        }
      },
      didDrawPage: (data) => {
        doc.setFontSize(7);
        doc.setTextColor(150);
        doc.text(`Página ${doc.internal.getNumberOfPages()}`, pageWidth - 14, doc.internal.pageSize.getHeight() - 5, { align: 'right' });
      },
    });

    doc.save(`conciliacao-sistema-${dtaInicio}-${dtaFim}.pdf`);
    toast.success('PDF Sistema gerado!');
  }, [filteredRows, dtaInicio, dtaFim]);

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
          {/* Filters - Row 1: Banco Extrato + Conta API + Datas + Tipo + Exibir + Botões */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-3 mb-2">
            <div className="flex flex-wrap items-end gap-3">
              <div className="flex flex-col">
                <label className="text-xs font-semibold text-orange-600 mb-1">Banco (Extrato)</label>
                <select
                  value={codBanco}
                  onChange={e => setCodBanco(e.target.value)}
                  disabled={loadingBancos}
                  className={`border rounded-lg px-3 py-1.5 text-sm focus:ring-2 focus:ring-orange-400 focus:border-orange-400 min-w-[200px] ${codBanco ? 'border-orange-400 bg-orange-50 font-semibold' : 'border-gray-300'}`}
                >
                  <option value="">{loadingBancos ? 'Carregando...' : 'Selecione'}</option>
                  {bancosUnicos.map(b => (
                    <option key={b.COD_BANCO} value={b.COD_BANCO}>{b.DES_BANCO}</option>
                  ))}
                </select>
              </div>
              {matchedAccounts.length > 0 && (
                <div className="flex flex-col">
                  <label className="text-xs font-semibold text-orange-500 mb-1">Conta API</label>
                  <select
                    value={selectedBankAccountId}
                    onChange={e => setSelectedBankAccountId(e.target.value)}
                    className={`border rounded-lg px-3 py-1.5 text-sm focus:ring-2 focus:ring-orange-400 focus:border-orange-400 min-w-[220px] ${selectedBankAccountId ? 'border-orange-400 bg-orange-50 font-semibold' : 'border-gray-300'}`}
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
                  className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:ring-2 focus:ring-orange-400 focus:border-orange-400"
                />
              </div>
              <div className="flex flex-col">
                <label className="text-xs font-semibold text-gray-500 mb-1">Fim</label>
                <input
                  type="date"
                  value={dtaFim}
                  onChange={e => setDtaFim(e.target.value)}
                  className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:ring-2 focus:ring-orange-400 focus:border-orange-400"
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
                      className={`px-3 py-1.5 text-xs font-semibold transition-colors ${
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
                      className={`px-3 py-1.5 text-xs font-semibold transition-colors ${
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

              <div className="flex flex-col">
                <label className="text-xs font-semibold text-orange-600 mb-1">Modo</label>
                <div className="flex rounded-lg overflow-hidden border border-orange-400">
                  {[
                    { val: 'sistema', label: 'Direto Sistema' },
                    { val: 'manual', label: 'Direto Manual' },
                  ].map(opt => (
                    <button
                      key={opt.val}
                      onClick={() => setModo(opt.val)}
                      className={`px-3 py-1.5 text-xs font-bold transition-colors ${
                        modo === opt.val ? 'bg-orange-600 text-white' : 'bg-white text-orange-600 hover:bg-orange-50'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              <button
                onClick={modo === 'sistema' ? fetchDados : fetchManual}
                disabled={(loading || loadingManual) || (modo === 'sistema' && !codBanco)}
                className="px-5 py-1.5 bg-orange-600 text-white rounded-lg text-sm font-bold hover:bg-orange-700 disabled:opacity-50 transition-colors"
              >
                {(loading || loadingManual) ? 'Buscando...' : 'Buscar'}
              </button>

            </div>
          </div>

          {/* Filters - Row 2: Banco Sistema + Conta Corrente */}
          <div className="bg-blue-50 rounded-lg shadow-sm border border-blue-200 p-3 mb-4">
            <div className="flex flex-wrap items-end gap-3">
              <div className="flex flex-col">
                <label className="text-xs font-semibold text-blue-600 mb-1">Banco (Sistema)</label>
                <select
                  value={codBancoSistema}
                  onChange={e => setCodBancoSistema(e.target.value)}
                  disabled={loadingBancos}
                  className={`border rounded-lg px-3 py-1.5 text-sm focus:ring-2 focus:ring-blue-400 focus:border-blue-400 min-w-[200px] ${codBancoSistema ? 'border-blue-400 bg-blue-50 font-semibold' : 'border-gray-300 bg-white'}`}
                >
                  <option value="">Mesmo do Extrato</option>
                  {bancosUnicos.map(b => (
                    <option key={b.COD_BANCO} value={b.COD_BANCO}>{b.DES_BANCO}</option>
                  ))}
                </select>
              </div>
              <div className="flex flex-col">
                <label className="text-xs font-semibold text-blue-500 mb-1">Conta Corrente</label>
                <select
                  value={contaCorrenteSistema}
                  onChange={e => setContaCorrenteSistema(e.target.value)}
                  disabled={loadingContas}
                  className={`border rounded-lg px-3 py-1.5 text-sm focus:ring-2 focus:ring-blue-400 focus:border-blue-400 min-w-[320px] ${contaCorrenteSistema ? 'border-blue-400 bg-blue-50 font-semibold' : 'border-gray-300 bg-white'}`}
                >
                  <option value="">{loadingContas ? 'Carregando...' : 'Todas as contas'}</option>
                  {contasCorrentesList.map(cc => (
                    <option key={cc.DES_CC} value={cc.DES_CC}>
                      {cc.DES_APELIDO || cc.DES_CC} | CC: {cc.DES_CC}{cc.DES_AGENCIA ? ` | Ag: ${cc.DES_AGENCIA}` : ''}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {modo === 'sistema' && rows.length > 0 && (
            <>
            <div className="grid grid-cols-2 gap-3 mb-3">
              <div className="bg-orange-50 border-2 border-orange-300 rounded-lg px-4 py-3">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-bold text-orange-600 uppercase tracking-wider">R$ Banco</span>
                  <span className="text-xl font-black text-orange-700">{formatCurrency(cardResumo.valTotalBanco || 0)}</span>
                </div>
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
              </div>
              <div className="bg-gray-50 border-2 border-gray-300 rounded-lg px-4 py-3">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-bold text-gray-600 uppercase tracking-wider">R$ Sistema</span>
                  <span className="text-xl font-black text-gray-700">{formatCurrency(cardResumo.valTotalSistema || 0)}</span>
                </div>
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
              </div>
            </div>
            <div className="grid grid-cols-3 md:grid-cols-5 gap-3 mb-4">
              <SummaryCard title="Total Banco" value={cardResumo.totalBanco || 0} color="gray" subtitle={`${cardResumo.totalBanco || 0} mov.`} onClick={() => setCardFilter(cardFilter === 'todos_banco' ? null : 'todos_banco')} active={cardFilter === 'todos_banco'} />
              <SummaryCard title="Sem Banco" value={cardResumo.unmatchedSistema || 0} color="red" subtitle={formatCurrency(cardResumo.valUnmatchedSistema || 0)} onClick={() => setCardFilter(cardFilter === 'sem_banco' ? null : 'sem_banco')} active={cardFilter === 'sem_banco'} />
              <SummaryCard title="Conciliados" value={cardResumo.totalMatched || 0} color="green" subtitle={formatCurrency(cardResumo.valMatchedBanco || 0)} onClick={() => setCardFilter(cardFilter === 'conciliados' ? null : 'conciliados')} active={cardFilter === 'conciliados'} />
              <SummaryCard title="Sem Sistema" value={cardResumo.unmatchedBanco || 0} color="red" subtitle={formatCurrency(cardResumo.valUnmatchedBanco || 0)} onClick={() => setCardFilter(cardFilter === 'sem_sistema' ? null : 'sem_sistema')} active={cardFilter === 'sem_sistema'} />
              <SummaryCard title="Total Sistema" value={cardResumo.totalSistema || 0} color="gray" subtitle={`${cardResumo.totalSistema || 0} reg.`} onClick={() => setCardFilter(cardFilter === 'todos_sistema' ? null : 'todos_sistema')} active={cardFilter === 'todos_sistema'} />
            </div>
            </>
          )}

          {/* Table (modo Sistema) */}
          {modo === 'sistema' && (loading ? (
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
                <div className="flex-1 bg-orange-600 text-white py-2 px-3 text-xs font-bold uppercase tracking-wider border-r-2 border-gray-300 flex items-center justify-between">
                  <span className="flex-1 text-center">Banco (Movimentacao)</span>
                  <button onClick={gerarPdfBanco} className="ml-2 bg-white/20 hover:bg-white/30 rounded px-2 py-0.5 text-[10px] font-bold transition-colors flex items-center gap-1" title="Exportar PDF Banco">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
                    PDF
                  </button>
                </div>
                <div className="w-[66px] bg-gray-800 text-white text-center py-2 px-1 text-xs font-bold border-r-2 border-gray-300 flex-shrink-0">
                  ST
                </div>
                <div className="flex-1 bg-orange-600 text-white py-2 px-3 text-xs font-bold uppercase tracking-wider flex items-center justify-between">
                  <button onClick={gerarPdfSistema} className="mr-2 bg-white/20 hover:bg-white/30 rounded px-2 py-0.5 text-[10px] font-bold transition-colors flex items-center gap-1" title="Exportar PDF Sistema">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
                    PDF
                  </button>
                  <span className="flex-1 text-center">Sistema (Contas Pagas)</span>
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
                <div className="w-[66px] py-2 px-1 text-center bg-gray-200 border-r-2 border-gray-300 flex-shrink-0"></div>
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
                    onOpenTransfer={(r) => setTransferModal({
                      rowId: r.rowId,
                      banco: r.banco,
                    })}
                    onDeleteTransfer={(r) => handleDeleteTransfer(r.rowId, r.transferId || r.sistema?.transferId)}
                  />
                ))}
              </div>

              {filteredRows.length === 0 && (
                <div className="text-center py-8 text-gray-400 text-sm">
                  Nenhum resultado para o filtro selecionado
                </div>
              )}
            </div>
          ))}

          {/* Table (modo Manual) */}
          {modo === 'manual' && (
            <ManualConciliacao
              rows={manualRowsFiltered}
              loading={loadingManual}
              planoContas={planoContasTree}
              selected={manualSelected}
              onToggleSel={toggleManualSel}
              onToggleAll={(keys, marcar) => setManualSelected(prev => {
                const n = new Set(prev);
                keys.forEach(k => marcar ? n.add(k) : n.delete(k));
                return n;
              })}
              onUnica={handleUnica}
              onAuto={handleAuto}
              onTransfer={(row) => setManualTransferModal({ row })}
              onLimpar={handleLimpar}
            />
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

      {/* Modal de transferência (modo Sistema) */}
      {transferModal && (
        <TransferModal
          modal={transferModal}
          bankAccounts={bankAccounts}
          currentAccountId={selectedBankAccountId}
          onConfirm={handleConfirmTransfer}
          onClose={() => setTransferModal(null)}
        />
      )}

      {/* Modal de transferência (modo Manual) */}
      {manualTransferModal && (
        <TransferModal
          modal={{ rowId: manualTransferModal.row.rowId, banco: manualTransferModal.row.banco }}
          bankAccounts={bankAccounts}
          currentAccountId={selectedBankAccountId}
          onConfirm={(rowId, targetAccountId) => handleTransferManual(manualTransferModal.row, targetAccountId)}
          onClose={() => setManualTransferModal(null)}
        />
      )}
    </div>
  );
}

/* ============ MODO "DIRETO MANUAL" ============ */
function SummaryCardMini({ title, value, color }) {
  const colors = {
    gray: 'border-gray-300 text-gray-700',
    green: 'border-green-400 text-green-700',
    red: 'border-red-400 text-red-700',
  };
  return (
    <div className={`bg-white border-2 rounded-lg px-4 py-3 text-center ${colors[color] || colors.gray}`}>
      <div className="text-2xl font-black">{value}</div>
      <div className="text-xs font-bold uppercase tracking-wider">{title}</div>
    </div>
  );
}

function ManualConciliacao({ rows, loading, planoContas, selected, onToggleSel, onToggleAll, onUnica, onAuto, onTransfer, onLimpar }) {
  if (loading) {
    return <div className="flex justify-center py-20"><RadarLoading /></div>;
  }
  if (!rows || rows.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow-sm border p-12 text-center text-gray-400">
        <p className="text-lg font-medium">Selecione o período e clique em Buscar</p>
        <p className="text-sm mt-1">No modo Manual você classifica cada linha do banco: Única, Transferência ou Automática.</p>
      </div>
    );
  }

  const total = rows.length;
  const classificados = rows.filter(r => r.classificacao).length;
  const naoClass = total - classificados;
  // Ordenação por coluna (clique no cabeçalho) + busca por palavra-chave
  const [sortCol, setSortCol] = useState(null);
  const [sortDir, setSortDir] = useState('asc');
  const [busca, setBusca] = useState('');
  const sortBy = (col) => {
    if (sortCol === col) setSortDir(d => (d === 'asc' ? 'desc' : 'asc'));
    else { setSortCol(col); setSortDir('asc'); }
  };
  const arrow = (col) => (sortCol === col ? (sortDir === 'asc' ? ' ▲' : ' ▼') : '');
  const sortedRows = useMemo(() => {
    if (!sortCol) return rows;
    const val = (r) => {
      switch (sortCol) {
        case 'data': return r.banco?.DTA_ENTRADA ? new Date(r.banco.DTA_ENTRADA).getTime() : 0;
        case 'favorecido': return (r.banco?.FAVORECIDO || '').toUpperCase();
        case 'valor': return Math.abs(parseFloat(r.banco?.VAL_DOCTO) || 0);
        case 'tipo': return r.banco?.TIPO_OPERACAO ?? 0;
        default: return 0;
      }
    };
    return [...rows].sort((a, b) => {
      const va = val(a), vb = val(b);
      const cmp = typeof va === 'number' ? va - vb : String(va).localeCompare(String(vb), 'pt-BR', { numeric: true });
      return sortDir === 'asc' ? cmp : -cmp;
    });
  }, [rows, sortCol, sortDir]);
  const visibleRows = useMemo(() => {
    const q = busca.trim().toUpperCase();
    if (!q) return sortedRows;
    return sortedRows.filter(r =>
      (r.banco?.FAVORECIDO || '').toUpperCase().includes(q) ||
      (r.classificacao?.conta_nome || '').toUpperCase().includes(q)
    );
  }, [sortedRows, busca]);

  const selCount = visibleRows.filter(r => selected?.has(r.mov_key)).length;
  const allKeys = visibleRows.map(r => r.mov_key);
  const allChecked = selCount > 0 && selCount === visibleRows.length;

  return (
    <div>
      <div className="grid grid-cols-3 gap-3 mb-3">
        <SummaryCardMini title="Total Banco" value={total} color="gray" />
        <SummaryCardMini title="Classificados" value={classificados} color="green" />
        <SummaryCardMini title="Não Classificado" value={naoClass} color="red" />
      </div>

      {selCount > 0 && (
        <div className="mb-2 px-3 py-2 bg-orange-100 border border-orange-300 rounded-lg text-sm font-bold text-orange-800">
          {selCount} linha(s) selecionada(s) · clique em ✓ Única, ⇄ Transf. ou ⚡ Auto em qualquer linha e escolha a conta — aplica em todas.
        </div>
      )}

      <div className="mb-2 flex items-center gap-2">
        <div className="relative flex-1 max-w-md">
          <input
            value={busca}
            onChange={e => setBusca(e.target.value)}
            placeholder="🔎 Buscar por palavra-chave (favorecido, conta)…"
            className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:ring-2 focus:ring-orange-400 focus:border-orange-400"
          />
          {busca && <button onClick={() => setBusca('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-700 text-sm">✕</button>}
        </div>
        <span className="text-xs text-gray-500">{visibleRows.length} de {total} linha(s)</span>
      </div>

      <div className="bg-white rounded-lg shadow-sm border">
        <div className="flex">
          <div className="flex-1 bg-orange-600 text-white py-2 px-3 text-xs font-bold uppercase tracking-wider border-r-2 border-gray-300 text-center">Banco (Movimentação)</div>
          <div className="w-[360px] bg-orange-600 text-white py-2 px-3 text-xs font-bold uppercase tracking-wider text-center">Classificação (Manual)</div>
        </div>
        <div className="flex bg-gray-100 text-gray-600 text-xs font-bold uppercase border-b border-gray-200">
          <div className="w-[32px] py-2 px-1 text-center">
            <input type="checkbox" checked={allChecked} onChange={e => onToggleAll(allKeys, e.target.checked)} className="w-4 h-4 accent-orange-600 cursor-pointer" title="Selecionar todos" />
          </div>
          <div onClick={() => sortBy('data')} className="w-[85px] py-2 px-2 text-center cursor-pointer hover:bg-orange-100 select-none">Data{arrow('data')}</div>
          <div onClick={() => sortBy('favorecido')} className="flex-1 py-2 px-2 cursor-pointer hover:bg-orange-100 select-none">Favorecido{arrow('favorecido')}</div>
          <div onClick={() => sortBy('valor')} className="w-[110px] py-2 px-2 text-right cursor-pointer hover:bg-orange-100 select-none">Valor{arrow('valor')}</div>
          <div onClick={() => sortBy('tipo')} className="w-[60px] py-2 px-2 text-center border-r-2 border-gray-300 cursor-pointer hover:bg-orange-100 select-none">Tipo{arrow('tipo')}</div>
          <div className="w-[360px] py-2 px-2">Ação / Conta</div>
        </div>
        <div>
          {visibleRows.map((row, idx) => (
            <ManualRow
              key={row.rowId}
              row={row}
              idx={idx}
              planoContas={planoContas}
              checked={!!selected?.has(row.mov_key)}
              onToggleSel={onToggleSel}
              onUnica={onUnica}
              onAuto={onAuto}
              onTransfer={onTransfer}
              onLimpar={onLimpar}
            />
          ))}
          {visibleRows.length === 0 && (
            <div className="text-center py-8 text-gray-400 text-sm">Nenhuma linha para "{busca}"</div>
          )}
        </div>
      </div>
    </div>
  );
}

function ManualRow({ row, idx, planoContas, checked, onToggleSel, onUnica, onAuto, onTransfer, onLimpar }) {
  const [picking, setPicking] = useState(null); // null | 'unica' | 'auto'
  const banco = row.banco;
  const val = Math.abs(parseFloat(banco.VAL_DOCTO) || 0);
  const isCred = banco.TIPO_OPERACAO === 0;
  const cls = row.classificacao;
  // Por linha: saída -> só despesa | entrada -> só receita
  const contas = (planoContas || []).filter(g => isCred ? g.is_receita : !g.is_receita);
  const bg = checked ? 'bg-orange-50' : cls ? 'bg-green-50/70' : (idx % 2 === 0 ? 'bg-red-50/30' : 'bg-white');

  const chip = cls && ({
    unica: { label: 'Única', color: 'bg-green-100 text-green-700 border-green-300' },
    automatica: { label: 'Auto', color: 'bg-blue-100 text-blue-700 border-blue-300' },
    transferencia: { label: 'Transferência', color: 'bg-purple-100 text-purple-700 border-purple-300' },
  }[cls.origem] || { label: cls.origem, color: 'bg-gray-100 text-gray-700 border-gray-300' });

  const pick = (contaId) => {
    if (contaId) { picking === 'unica' ? onUnica(row, contaId) : onAuto(row, contaId); }
    setPicking(null);
  };

  return (
    <div className={`flex items-center ${bg} border-b border-gray-100 hover:brightness-95`}>
      <div className="w-[32px] py-1.5 px-1 text-center flex-shrink-0">
        <input type="checkbox" checked={checked} onChange={() => onToggleSel(row.mov_key)} className="w-4 h-4 accent-orange-600 cursor-pointer" />
      </div>
      <div className="w-[85px] py-1.5 px-2 text-center text-xs whitespace-nowrap">{formatDate(banco.DTA_ENTRADA)}</div>
      <div className="flex-1 py-1.5 px-2 text-xs break-words leading-tight" title={banco.FAVORECIDO}>{banco.FAVORECIDO || <span className="text-gray-300 italic">--</span>}</div>
      <div className={`w-[110px] py-1.5 px-2 text-right text-xs font-bold whitespace-nowrap ${isCred ? 'text-green-700' : 'text-red-700'}`}>{formatCurrency(val)}</div>
      <div className="w-[60px] py-1.5 px-2 text-center border-r-2 border-gray-200">
        <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-bold ${isCred ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>{isCred ? 'Entrada' : 'Saída'}</span>
      </div>
      <div className="w-[360px] py-1.5 px-2">
        {cls ? (
          <div className="flex items-center gap-2">
            <span className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold border ${chip.color}`}>{chip.label}</span>
            <span className="text-xs text-gray-700 truncate flex-1" title={cls.conta_nome || 'Transferência entre contas'}>
              {cls.origem === 'transferencia' ? 'Entre contas (fora do DRE)' : cls.conta_nome}
            </span>
            <button onClick={() => onLimpar(row)} className="text-xs text-gray-400 hover:text-red-600 font-bold" title="Limpar">✕</button>
          </div>
        ) : picking ? (
          <div className="flex items-center gap-1">
            <select autoFocus defaultValue="" onChange={e => pick(e.target.value)} className="flex-1 border border-orange-400 rounded px-2 py-1 text-xs">
              <option value="">{picking === 'unica' ? 'Conta (só esta linha)…' : 'Conta (todas iguais)…'}</option>
              {contas.map(g => (
                <optgroup key={g.id} label={g.nome}>
                  {(g.contas || []).map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
                </optgroup>
              ))}
            </select>
            <button onClick={() => setPicking(null)} className="text-xs text-gray-400 hover:text-gray-700 font-bold">✕</button>
          </div>
        ) : (
          <div className="flex items-center gap-1">
            <button onClick={() => setPicking('unica')} className="px-2 py-1 text-[11px] font-bold rounded bg-green-100 text-green-700 hover:bg-green-200" title="Conciliação única (só esta linha)">✓ Única</button>
            <button onClick={() => onTransfer(row)} className="px-2 py-1 text-[11px] font-bold rounded bg-purple-100 text-purple-700 hover:bg-purple-200" title="Transferência entre contas (fora do DRE)">⇄ Transf.</button>
            <button onClick={() => setPicking('auto')} className="px-2 py-1 text-[11px] font-bold rounded bg-blue-100 text-blue-700 hover:bg-blue-200" title="Automática (todas as linhas com este texto)">⚡ Auto</button>
          </div>
        )}
      </div>
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

function ConciliacaoRow({ row, rowIndex, bankCols, sysCols, onOpenCandidates, onOpenTransfer, onDeleteTransfer }) {
  const [expanded, setExpanded] = useState(false);
  const isMatched = row.matchStatus === 'MATCHED';
  const isBankOnly = row.matchStatus === 'UNMATCHED_BANK';
  const isSysOnly = row.matchStatus === 'UNMATCHED_SYSTEM';
  const hasCandidates = row.candidates && row.candidates.length > 1;
  const isTransfer = row.isTransfer || row.sistema?.transferId;
  const isBordero = row.sistema?.type === 'bordero' && row.sistema?.items?.length > 1;

  const isEven = rowIndex % 2 === 0;
  const rowBg = isMatched
    ? (isEven ? 'bg-green-50/70' : 'bg-white')
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
        <div className="w-[66px] py-1.5 px-1 text-center bg-gray-50/50 border-r-2 border-gray-200 flex-shrink-0 flex items-center justify-center gap-1">
          {isMatched && !hasCandidates && !isTransfer && (
            <span className="inline-flex items-center justify-center w-6 h-6 rounded border-2 border-green-500 bg-green-500" title="Conciliado">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3.5">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </span>
          )}
          {isMatched && !hasCandidates && isTransfer && (
            <>
              {/* Check verde para transferência */}
              <span className="inline-flex items-center justify-center w-6 h-6 rounded border-2 border-green-500 bg-green-500" title="Transferência entre contas">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3.5">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              </span>
              {/* Botão lixeira para desfazer */}
              <button
                onClick={() => onDeleteTransfer && onDeleteTransfer(row)}
                className="inline-flex items-center justify-center w-6 h-6 rounded border-2 border-red-300 bg-white hover:bg-red-50 hover:border-red-500 hover:scale-110 transition-all cursor-pointer"
                title="Desfazer transferência"
              >
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2.5">
                  <polyline points="3 6 5 6 21 6" />
                  <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                </svg>
              </button>
            </>
          )}
          {isMatched && hasCandidates && (
            <button
              onClick={() => onOpenCandidates(row)}
              className="inline-flex items-center justify-center w-6 h-6 rounded border-2 border-amber-500 bg-amber-50 hover:bg-amber-100 hover:scale-110 transition-all cursor-pointer animate-pulse"
              title={`${row.candidates.length} candidatos com mesmo valor - clique para escolher`}
            >
              <span className="text-amber-600 font-black text-xs">!</span>
            </button>
          )}
          {isBankOnly && !isTransfer && (
            <>
              {/* X vermelho - indicador estático */}
              <span className="inline-flex items-center justify-center w-6 h-6 rounded border-2 border-red-300 bg-white" title="Sem correspondência no sistema">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="3">
                  <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </span>
              {/* Botão de transferência - setinha */}
              <button
                onClick={() => onOpenTransfer && onOpenTransfer(row)}
                className="inline-flex items-center justify-center w-6 h-6 rounded border-2 border-blue-400 bg-blue-50 hover:bg-blue-100 hover:border-blue-600 hover:scale-110 transition-all cursor-pointer"
                title="Marcar como transferência entre contas"
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="3">
                  <line x1="5" y1="12" x2="19" y2="12" />
                  <polyline points="14 7 19 12 14 17" />
                </svg>
              </button>
            </>
          )}
          {isBankOnly && isTransfer && (
            <>
              {/* Indicador de transferência esperada (setinha azul estática) */}
              <span className="inline-flex items-center justify-center w-6 h-6 rounded border-2 border-blue-400 bg-blue-100" title="Transferência registrada - aguardando movimento no banco">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="3">
                  <line x1="5" y1="12" x2="19" y2="12" />
                  <polyline points="14 7 19 12 14 17" />
                </svg>
              </span>
              {/* Botão lixeira para desfazer */}
              <button
                onClick={() => onDeleteTransfer && onDeleteTransfer(row)}
                className="inline-flex items-center justify-center w-6 h-6 rounded border-2 border-red-300 bg-white hover:bg-red-50 hover:border-red-500 hover:scale-110 transition-all cursor-pointer"
                title="Desfazer transferência"
              >
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2.5">
                  <polyline points="3 6 5 6 21 6" />
                  <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                </svg>
              </button>
            </>
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
            <div className="w-[66px] py-1 px-1 text-center bg-gray-50/50 border-r-2 border-gray-200 flex-shrink-0 flex items-center justify-center">
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
                    content = item.desSubcategoria ? <span className="text-[11px] text-gray-500 truncate block max-w-[160px]" title={item.desSubcategoria}>{item.desSubcategoria}</span> : null;
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

/* Modal para marcar transferência entre contas */
function TransferModal({ modal, bankAccounts, currentAccountId, onConfirm, onClose }) {
  const [targetAccountId, setTargetAccountId] = useState('');
  const currentAccount = bankAccounts.find(a => String(a.id) === String(currentAccountId));
  const otherAccounts = bankAccounts.filter(a => String(a.id) !== String(currentAccountId));
  const bancoVal = modal.banco ? Math.abs(parseFloat(modal.banco.VAL_DOCTO) || 0) : 0;
  const isSaida = modal.banco?.TIPO_OPERACAO === 1;

  useEffect(() => {
    if (otherAccounts.length > 0 && !targetAccountId) {
      setTargetAccountId(String(otherAccounts[0].id));
    }
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-2xl max-w-md w-full mx-4" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="bg-blue-600 text-white px-5 py-3 rounded-t-xl flex items-center justify-between">
          <div>
            <h3 className="font-bold text-lg">Transferencia entre Contas</h3>
            <p className="text-blue-200 text-xs">Marcar movimento como transferencia interna</p>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-blue-700 rounded-lg transition-colors">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Banco info */}
        <div className="px-5 py-3 bg-orange-50 border-b">
          <p className="text-xs text-orange-600 font-bold uppercase">Movimento Bancario</p>
          <div className="flex items-center gap-4 mt-1">
            <span className="text-sm font-bold text-gray-800">{formatDate(modal.banco?.DTA_ENTRADA)}</span>
            <span className="text-sm text-gray-600 flex-1 truncate">{modal.banco?.FAVORECIDO}</span>
            <span className="text-sm font-black text-orange-700">{formatCurrency(bancoVal)}</span>
          </div>
        </div>

        {/* Transfer form */}
        <div className="px-5 py-4 space-y-3">
          <div>
            <label className="text-xs font-bold text-red-500 uppercase tracking-wide">
              {isSaida ? 'Sai da conta' : 'Entra na conta'}
            </label>
            <div className="mt-1 bg-gray-100 border border-gray-200 rounded-lg px-3 py-2.5 text-sm font-semibold text-gray-700">
              {currentAccount?.nome || 'Conta atual'}
              {currentAccount?.conta ? ` | Conta: ${currentAccount.conta}` : ''}
            </div>
          </div>

          <div className="flex items-center justify-center py-1">
            <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="2.5">
                <path d="M12 5v14M5 12l7 7 7-7"/>
              </svg>
            </div>
          </div>

          <div>
            <label className="text-xs font-bold text-green-600 uppercase tracking-wide">
              {isSaida ? 'Entra na conta' : 'Sai da conta'}
            </label>
            <select
              value={targetAccountId}
              onChange={e => setTargetAccountId(e.target.value)}
              className="mt-1 w-full border-2 border-blue-300 bg-blue-50 rounded-lg px-3 py-2.5 text-sm font-semibold focus:ring-2 focus:ring-blue-400 focus:border-blue-400"
            >
              {otherAccounts.length === 0 && <option value="">Nenhuma outra conta disponivel</option>}
              {otherAccounts.map(acc => (
                <option key={acc.id} value={acc.id}>
                  {acc.nome}{acc.conta ? ` | Conta: ${acc.conta}` : ''}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Actions */}
        <div className="px-5 py-3 bg-gray-50 rounded-b-xl flex justify-end gap-2 border-t">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-200 rounded-lg transition-colors font-medium">
            Cancelar
          </button>
          <button
            onClick={() => onConfirm(modal.rowId, targetAccountId, modal.banco)}
            disabled={!targetAccountId}
            className="px-5 py-2 bg-blue-600 text-white text-sm font-bold rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            Confirmar Transferencia
          </button>
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
