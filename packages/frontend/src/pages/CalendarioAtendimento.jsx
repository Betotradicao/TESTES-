import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useLoja } from '../contexts/LojaContext';
import Sidebar from '../components/Sidebar';
import { api } from '../utils/api';

const TABS = [
  { id: 'cadastro', label: 'Cadastro Fornecedores', icon: '📋' },
  { id: 'mensal', label: 'Visão Mensal', icon: '📅' },
  { id: 'diario', label: 'Atendimento Diário', icon: '📦' }
];

const MESES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
];

const formatMoney = (val) => {
  if (!val && val !== 0) return 'R$ 0,00';
  return val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
};

// Opções para dropdowns de agendamento
const FREQ_OPTIONS = ['', 'Mensal', 'Quinzenal', 'Semanal', 'Diario', '21 Dias'];
const DIA_SEMANA_OPTIONS = ['', 'Segunda', 'Terca', 'Quarta', 'Quinta', 'Sexta', 'Sabado', 'Domingo', 'Todos'];
const AGENDAMENTO_FIELDS = new Set(['FREQ_VISITA', 'DIA_SEMANA_1', 'DIA_SEMANA_2', 'DIA_SEMANA_3', 'DIA_MES', 'INICIO_AGENDAMENTO']);

// Mapeamento dia da semana JS (0=Dom) → nome em português usado no agendamento
const DIA_SEMANA_MAP = { 0: 'Domingo', 1: 'Segunda', 2: 'Terca', 3: 'Quarta', 4: 'Quinta', 5: 'Sexta', 6: 'Sabado' };
const DIA_SEMANA_LABEL = { 0: 'domingo', 1: 'segunda-feira', 2: 'terça-feira', 3: 'quarta-feira', 4: 'quinta-feira', 5: 'sexta-feira', 6: 'sábado' };

// Determina se um fornecedor deve aparecer em um determinado dia
const fornecedorNoDia = (ag, date) => {
  if (!ag || !ag.freq_visita) return false;
  const dow = date.getDay(); // 0=Dom
  const dom = date.getDate();
  const dowName = DIA_SEMANA_MAP[dow];
  const dias = [ag.dia_semana_1, ag.dia_semana_2, ag.dia_semana_3].filter(Boolean);
  const matchDia = dias.length === 0 || dias.some(d => d === 'Todos' || d === dowName);

  switch (ag.freq_visita) {
    case 'Diario':
      return dow >= 1 && dow <= 6; // seg-sab
    case 'Semanal':
      return matchDia;
    case 'Quinzenal': {
      if (!matchDia) return false;
      if (ag.inicio_agendamento) {
        const start = new Date(ag.inicio_agendamento);
        const diffMs = date.getTime() - start.getTime();
        const diffWeeks = Math.floor(diffMs / (7 * 86400000));
        return diffWeeks >= 0 && diffWeeks % 2 === 0;
      }
      // Sem início: semanas pares do mês
      const firstOfMonth = new Date(date.getFullYear(), date.getMonth(), 1);
      const weekIdx = Math.floor((date.getDate() + firstOfMonth.getDay() - 1) / 7);
      return weekIdx % 2 === 0;
    }
    case '21 Dias': {
      if (ag.inicio_agendamento) {
        const start = new Date(ag.inicio_agendamento);
        const diffDays = Math.round((date.getTime() - start.getTime()) / 86400000);
        return diffDays >= 0 && diffDays % 21 === 0;
      }
      return false;
    }
    case 'Mensal':
      return ag.dia_mes ? ag.dia_mes === dom : false;
    default:
      return false;
  }
};

// ====== DEFINIÇÃO DAS COLUNAS DO CADASTRO ======
const FORNECEDOR_COLS = [
  { id: 'DES_FANTASIA', label: '🏢 FANTASIA', align: 'left' },
  { id: 'DES_FORNECEDOR', label: '📄 RAZÃO SOCIAL', align: 'left' },
  { id: 'NUM_CGC', label: '🔢 CNPJ', align: 'left' },
  { id: 'DES_CONTATO', label: '👤 CONTATO', align: 'left' },
  { id: 'CELULAR', label: '📱 CELULAR', align: 'left' },
  { id: 'NUM_FREQ_VISITA', label: '🗓️ VISITA', align: 'center' },
  { id: 'NUM_PRAZO', label: '🚚 PRAZO ENT.', align: 'center' },
  { id: 'PRAZO_MEDIO_REAL', label: '📊 PRAZO MÉD.', align: 'center' },
  { id: 'NUM_MED_CPGTO', label: '💰 COND PGTO', align: 'center' },
  { id: 'PED_MIN_VAL', label: '📦 PED. MÍN.', align: 'right' },
  { id: 'VAL_CREDITO', label: '💚 CRÉDITO', align: 'right' },
  { id: 'VAL_DEBITO', label: '❤️ DÉBITO', align: 'right' },
  { id: 'DES_CLASSIFICACAO', label: '🏷️ CLASSIFICAÇÃO', align: 'left' },
  { id: 'ULTIMO_ATENDIMENTO', label: '📅 ÚLT. ATEND.', align: 'left' },
  { id: 'FREQ_VISITA', label: '🔄 FREQ.', align: 'center' },
  { id: 'DIA_SEMANA_1', label: '📆 DIA 1', align: 'center' },
  { id: 'DIA_SEMANA_2', label: '📆 DIA 2', align: 'center' },
  { id: 'DIA_SEMANA_3', label: '📆 DIA 3', align: 'center' },
  { id: 'DIA_MES', label: '📅 DIA MÊS', align: 'center' },
  { id: 'INICIO_AGENDAMENTO', label: '🚀 INÍCIO AGEND.', align: 'center' },
];
const DEFAULT_COL_IDS = FORNECEDOR_COLS.map(c => c.id);
const COL_ORDER_KEY = 'cal-forn-col-order';

// Cores para prazos curtos (visita, entrega)
const corPrazo = (val) => {
  const n = Number(val);
  if (!n) return 'text-gray-400';
  if (n <= 1) return 'text-emerald-600 font-semibold';
  if (n <= 3) return 'text-green-600 font-semibold';
  if (n <= 5) return 'text-blue-600 font-semibold';
  if (n <= 7) return 'text-amber-600 font-semibold';
  if (n <= 14) return 'text-purple-600 font-semibold';
  return 'text-red-600 font-semibold';
};

// Cores para prazos maiores (cond pagamento)
const corPgtoPrazo = (val) => {
  const n = Number(val);
  if (!n) return 'text-gray-400';
  if (n <= 7) return 'text-emerald-600 font-semibold';
  if (n <= 14) return 'text-green-600 font-semibold';
  if (n <= 21) return 'text-blue-600 font-semibold';
  if (n <= 28) return 'text-purple-600 font-semibold';
  return 'text-red-600 font-semibold';
};

// Valor bruto para ordenação
const getCellRaw = (colId, f) => {
  switch (colId) {
    case 'DES_FANTASIA': return (f.DES_FANTASIA || '').toUpperCase();
    case 'DES_FORNECEDOR': return (f.DES_FORNECEDOR || '').toUpperCase();
    case 'NUM_CGC': return f.NUM_CGC || '';
    case 'DES_CONTATO': return (f.DES_CONTATO || '').toUpperCase();
    case 'CELULAR': return f.NUM_CELULAR || f.NUM_FONE || '';
    case 'NUM_FREQ_VISITA': return Number(f.NUM_FREQ_VISITA) || 0;
    case 'NUM_PRAZO': return Number(f.NUM_PRAZO) || 0;
    case 'PRAZO_MEDIO_REAL': return Number(f.PRAZO_MEDIO_REAL) || 0;
    case 'NUM_MED_CPGTO': {
      if (f.CONDICOES_PGTO) {
        const first = f.CONDICOES_PGTO.split('/')[0];
        return Number(first) || 0;
      }
      return Number(f.NUM_MED_CPGTO) || 0;
    }
    case 'PED_MIN_VAL': return Number(f.PED_MIN_VAL) || 0;
    case 'VAL_CREDITO': return Number(f.VAL_CREDITO) || 0;
    case 'VAL_DEBITO': return Number(f.VAL_DEBITO) || 0;
    case 'DES_CLASSIFICACAO': return (f.DES_CLASSIFICACAO || '').toUpperCase();
    case 'ULTIMO_ATENDIMENTO': return f.ULTIMO_ATENDIMENTO || '';
    case 'FREQ_VISITA': return f._ag?.freq_visita || '';
    case 'DIA_SEMANA_1': return f._ag?.dia_semana_1 || '';
    case 'DIA_SEMANA_2': return f._ag?.dia_semana_2 || '';
    case 'DIA_SEMANA_3': return f._ag?.dia_semana_3 || '';
    case 'DIA_MES': return Number(f._ag?.dia_mes) || 0;
    case 'INICIO_AGENDAMENTO': return f._ag?.inicio_agendamento || '';
    default: return '';
  }
};

// Renderizar célula com cores
const renderCell = (colId, f) => {
  switch (colId) {
    case 'DES_FANTASIA':
      return <span className="font-medium text-gray-900">{f.DES_FANTASIA || '-'}</span>;
    case 'DES_FORNECEDOR':
      return <span className="text-gray-700">{f.DES_FORNECEDOR}</span>;
    case 'NUM_CGC':
      return <span className="text-gray-600 text-xs">{f.NUM_CGC || '-'}</span>;
    case 'DES_CONTATO':
      return <span className="text-gray-600">{f.DES_CONTATO || '-'}</span>;
    case 'CELULAR':
      return <span className="text-gray-600 text-xs">{f.NUM_CELULAR || f.NUM_FONE || '-'}</span>;
    case 'NUM_FREQ_VISITA':
      return f.NUM_FREQ_VISITA
        ? <span className={corPrazo(f.NUM_FREQ_VISITA)}>{f.NUM_FREQ_VISITA}d</span>
        : <span className="text-gray-400">-</span>;
    case 'NUM_PRAZO':
      return f.NUM_PRAZO
        ? <span className="text-green-600 font-semibold">{f.NUM_PRAZO}d</span>
        : <span className="text-gray-400">-</span>;
    case 'PRAZO_MEDIO_REAL': {
      const pm = Number(f.PRAZO_MEDIO_REAL) || 0;
      const prazoCad = Number(f.NUM_PRAZO) || 0;
      if (!pm) return <span className="text-gray-400">-</span>;
      const pmRound = Math.round(pm);
      const cor = pmRound > prazoCad ? 'bg-red-100 text-red-700' :
                  pmRound < prazoCad ? 'bg-orange-100 text-orange-700' :
                  'bg-green-100 text-green-700';
      return (
        <span
          className={`inline-flex items-center px-1.5 py-0.5 rounded font-semibold text-xs ${cor}`}
          title={`Prazo médio real (${f.QTD_NFS_PRAZO || 0} NFs em 180d). Cadastro: ${prazoCad}d`}
        >
          {pmRound}d
        </span>
      );
    }
    case 'NUM_MED_CPGTO': {
      // Mostra condições detalhadas (14/21/28) se disponível, senão NUM_MED_CPGTO
      const conds = f.CONDICOES_PGTO;
      if (conds) {
        const valores = conds.split('/');
        return (
          <span className="inline-flex items-center gap-0.5 text-xs font-semibold">
            {valores.map((v, i) => (
              <span key={i}>
                {i > 0 && <span className="text-gray-300">/</span>}
                <span className={corPgtoPrazo(v)}>{v}</span>
              </span>
            ))}
          </span>
        );
      }
      return f.NUM_MED_CPGTO
        ? <span className={corPgtoPrazo(f.NUM_MED_CPGTO)}>{f.NUM_MED_CPGTO}d</span>
        : <span className="text-gray-400">-</span>;
    }
    case 'PED_MIN_VAL': {
      const v = Number(f.PED_MIN_VAL) || 0;
      return v > 0
        ? <span className="text-blue-700 font-semibold text-xs">{v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
        : <span className="text-gray-400 text-xs">-</span>;
    }
    case 'VAL_CREDITO': {
      const v = Number(f.VAL_CREDITO) || 0;
      return v > 0
        ? <span className="text-green-600 font-semibold text-xs">{v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
        : <span className="text-gray-400 text-xs">-</span>;
    }
    case 'VAL_DEBITO': {
      const v = Number(f.VAL_DEBITO) || 0;
      return v > 0
        ? <span className="text-red-600 font-semibold text-xs">{v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
        : <span className="text-gray-400 text-xs">-</span>;
    }
    case 'DES_CLASSIFICACAO':
      return <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">{f.DES_CLASSIFICACAO || '-'}</span>;
    case 'ULTIMO_ATENDIMENTO':
      return <span className="text-gray-600 text-xs">{f.ULTIMO_ATENDIMENTO ? new Date(f.ULTIMO_ATENDIMENTO).toLocaleDateString('pt-BR') : '-'}</span>;
    default:
      return '-';
  }
};

export default function CalendarioAtendimento() {
  const { user, logout } = useAuth();
  const { lojaSelecionada } = useLoja();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('cadastro');

  const hoje = new Date();
  const [mesSelecionado, setMesSelecionado] = useState(hoje.getMonth() + 1);
  const [anoSelecionado, setAnoSelecionado] = useState(hoje.getFullYear());

  // === CADASTRO FORNECEDORES ===
  const [fornecedores, setFornecedores] = useState([]);
  const [totalFornecedores, setTotalFornecedores] = useState(0);
  const [buscaFornecedor, setBuscaFornecedor] = useState('');
  const [classificacoesSel, setClassificacoesSel] = useState([]);
  const [classificacoes, setClassificacoes] = useState([]);
  const [paginaFornecedor, setPaginaFornecedor] = useState(1);
  const [loadingFornecedores, setLoadingFornecedores] = useState(false);
  const [showClassifDropdown, setShowClassifDropdown] = useState(false);
  const classifRef = useRef(null);

  // Ordem das colunas (drag-and-drop, persistido no localStorage)
  const [columnOrder, setColumnOrder] = useState(() => {
    try {
      const saved = localStorage.getItem(COL_ORDER_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length === DEFAULT_COL_IDS.length &&
            DEFAULT_COL_IDS.every(id => parsed.includes(id))) {
          return parsed;
        }
      }
    } catch (e) {}
    return [...DEFAULT_COL_IDS];
  });

  // Ordenação (sort)
  const [sortCol, setSortCol] = useState(null);
  const [sortDir, setSortDir] = useState('asc');

  // Drag state
  const dragRef = useRef({ dragIdx: null });
  const [dragOverIdx, setDragOverIdx] = useState(null);

  // === AGENDAMENTOS (PostgreSQL) ===
  const [agendamentos, setAgendamentos] = useState({});
  const [editingCell, setEditingCell] = useState(null); // { cod, campo }

  // === VISÃO MENSAL (Calendário de Visitas) ===
  const [dadosMensais, setDadosMensais] = useState([]);
  const [loadingMensal, setLoadingMensal] = useState(false);
  const [fornecedorNomes, setFornecedorNomes] = useState({}); // cod → fantasia

  // === ATENDIMENTO DIÁRIO ===
  const [diaSelecionado, setDiaSelecionado] = useState(hoje.toISOString().split('T')[0]);
  const [atendimentosDia, setAtendimentosDia] = useState([]);
  const [loadingDiario, setLoadingDiario] = useState(false);

  // Colunas na ordem definida pelo usuário
  const colunasOrdenadas = useMemo(() => {
    return columnOrder.map(id => FORNECEDOR_COLS.find(c => c.id === id)).filter(Boolean);
  }, [columnOrder]);

  // Fornecedores com agendamentos mesclados e sort aplicado
  const fornecedoresComAgendamento = useMemo(() => {
    return fornecedores.map(f => ({ ...f, _ag: agendamentos[f.COD_FORNECEDOR] || {} }));
  }, [fornecedores, agendamentos]);

  const fornecedoresOrdenados = useMemo(() => {
    if (!sortCol) return fornecedoresComAgendamento;
    return [...fornecedoresComAgendamento].sort((a, b) => {
      const va = getCellRaw(sortCol, a);
      const vb = getCellRaw(sortCol, b);
      if (typeof va === 'number' && typeof vb === 'number') {
        return sortDir === 'asc' ? va - vb : vb - va;
      }
      return sortDir === 'asc'
        ? String(va).localeCompare(String(vb), 'pt-BR')
        : String(vb).localeCompare(String(va), 'pt-BR');
    });
  }, [fornecedoresComAgendamento, sortCol, sortDir]);

  // Fechar dropdown ao clicar fora
  useEffect(() => {
    const handler = (e) => {
      if (classifRef.current && !classifRef.current.contains(e.target)) {
        setShowClassifDropdown(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Fechar edição de célula com Escape
  useEffect(() => {
    const handler = (e) => {
      if (e.key === 'Escape') setEditingCell(null);
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, []);

  useEffect(() => {
    carregarClassificacoes();
  }, []);

  useEffect(() => {
    if (activeTab === 'cadastro') carregarFornecedores();
    if (activeTab === 'mensal') carregarVisaoMensal();
    if (activeTab === 'diario') carregarAtendimentoDiario();
  }, [activeTab, mesSelecionado, anoSelecionado, lojaSelecionada]);

  useEffect(() => {
    if (activeTab === 'cadastro') carregarFornecedores();
  }, [paginaFornecedor, classificacoesSel]);

  useEffect(() => {
    if (activeTab === 'diario') carregarAtendimentoDiario();
  }, [diaSelecionado]);

  const carregarClassificacoes = async () => {
    try {
      const res = await api.get('/api/calendario-atendimento/classificacoes');
      setClassificacoes(res.data);
    } catch (err) {
      console.error('Erro ao carregar classificações:', err);
    }
  };

  const carregarAgendamentos = async () => {
    try {
      const res = await api.get('/api/calendario-atendimento/agendamentos');
      setAgendamentos(res.data || {});
    } catch (err) {
      console.error('Erro ao carregar agendamentos:', err);
    }
  };

  const saveAgendamento = useCallback(async (codFornecedor, campo, valor) => {
    try {
      const body = { [campo]: valor || null };
      await api.put(`/api/calendario-atendimento/agendamentos/${codFornecedor}`, body);
      setAgendamentos(prev => ({
        ...prev,
        [codFornecedor]: { ...(prev[codFornecedor] || {}), [campo]: valor || null }
      }));
    } catch (err) {
      console.error('Erro ao salvar agendamento:', err);
    }
    setEditingCell(null);
  }, []);

  const carregarFornecedores = async () => {
    setLoadingFornecedores(true);
    try {
      const params = new URLSearchParams();
      if (buscaFornecedor) params.append('busca', buscaFornecedor);
      if (classificacoesSel.length > 0) params.append('classificacao', classificacoesSel.join(','));
      if (lojaSelecionada) params.append('codLoja', lojaSelecionada);
      params.append('pagina', paginaFornecedor);
      params.append('limite', '30');

      const [fornRes, agRes] = await Promise.all([
        api.get(`/api/calendario-atendimento/fornecedores?${params}`),
        api.get('/api/calendario-atendimento/agendamentos')
      ]);
      setFornecedores(fornRes.data.fornecedores);
      setTotalFornecedores(fornRes.data.total);
      setAgendamentos(agRes.data || {});
    } catch (err) {
      console.error('Erro ao carregar fornecedores:', err);
    }
    setLoadingFornecedores(false);
  };

  const carregarVisaoMensal = async () => {
    setLoadingMensal(true);
    try {
      const [agRes, nomesRes] = await Promise.all([
        api.get('/api/calendario-atendimento/agendamentos'),
        api.get('/api/calendario-atendimento/fornecedores-nomes')
      ]);
      setAgendamentos(agRes.data || {});
      setFornecedorNomes(nomesRes.data || {});
    } catch (err) {
      console.error('Erro ao carregar visão mensal:', err);
    }
    setLoadingMensal(false);
  };

  // Gerar calendário de visitas agendadas
  const calendarioVisitas = useMemo(() => {
    const ultimoDia = new Date(anoSelecionado, mesSelecionado, 0).getDate();
    const dias = [];
    for (let d = 1; d <= ultimoDia; d++) {
      const date = new Date(anoSelecionado, mesSelecionado - 1, d);
      const dow = date.getDay();
      const fornecedoresNoDia = [];
      for (const [codStr, ag] of Object.entries(agendamentos)) {
        if (fornecedorNoDia(ag, date)) {
          const cod = parseInt(codStr);
          fornecedoresNoDia.push({ cod, nome: fornecedorNomes[cod] || `Forn. ${cod}` });
        }
      }
      fornecedoresNoDia.sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
      dias.push({ dia: d, dow, label: DIA_SEMANA_LABEL[dow], fornecedores: fornecedoresNoDia });
    }
    return dias;
  }, [anoSelecionado, mesSelecionado, agendamentos, fornecedorNomes]);

  const carregarAtendimentoDiario = async () => {
    setLoadingDiario(true);
    try {
      const params = new URLSearchParams({ data: diaSelecionado });
      if (lojaSelecionada) params.append('codLoja', lojaSelecionada);

      const res = await api.get(`/api/calendario-atendimento/atendimento-diario?${params}`);
      setAtendimentosDia(res.data);
    } catch (err) {
      console.error('Erro ao carregar atendimento diário:', err);
    }
    setLoadingDiario(false);
  };

  const handleBuscaFornecedor = (e) => {
    e.preventDefault();
    setPaginaFornecedor(1);
    carregarFornecedores();
  };

  // Sort: click no cabeçalho alterna asc → desc → sem sort
  const handleSort = (colId) => {
    if (sortCol === colId) {
      if (sortDir === 'asc') setSortDir('desc');
      else { setSortCol(null); setSortDir('asc'); }
    } else {
      setSortCol(colId);
      setSortDir('asc');
    }
  };

  // Drag-and-drop das colunas
  const handleDragStart = (e, idx) => {
    dragRef.current.dragIdx = idx;
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e, idx) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverIdx(idx);
  };

  const handleDrop = (dropIdx) => {
    const dragIdx = dragRef.current.dragIdx;
    if (dragIdx === null || dragIdx === dropIdx) {
      setDragOverIdx(null);
      return;
    }
    const newOrder = [...columnOrder];
    const [removed] = newOrder.splice(dragIdx, 1);
    newOrder.splice(dropIdx, 0, removed);
    setColumnOrder(newOrder);
    localStorage.setItem(COL_ORDER_KEY, JSON.stringify(newOrder));
    setDragOverIdx(null);
    dragRef.current.dragIdx = null;
  };

  const handleDragEnd = () => {
    setDragOverIdx(null);
    dragRef.current.dragIdx = null;
  };

  // Toggle classificação no filtro
  const toggleClassif = (cod) => {
    setClassificacoesSel(prev => {
      setPaginaFornecedor(1);
      return prev.includes(cod) ? prev.filter(c => c !== cod) : [...prev, cod];
    });
  };

  // Gerar dias do mês para calendário
  const gerarDiasDoMes = () => {
    const ultimoDia = new Date(anoSelecionado, mesSelecionado, 0).getDate();
    const primeiroDiaSemana = new Date(anoSelecionado, mesSelecionado - 1, 1).getDay();
    const dias = [];
    for (let i = 0; i < primeiroDiaSemana; i++) dias.push(null);
    for (let d = 1; d <= ultimoDia; d++) {
      const dadoDia = dadosMensais.find(dm => dm.DIA === d);
      dias.push({ dia: d, dados: dadoDia || null });
    }
    return dias;
  };

  const totalPaginas = Math.ceil(totalFornecedores / 30);

  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar
        user={user}
        onLogout={logout}
        isMobileMenuOpen={isMobileMenuOpen}
        setIsMobileMenuOpen={setIsMobileMenuOpen}
      />

      <div className="flex-1 overflow-auto lg:ml-0">
        {/* Mobile Header */}
        <div className="lg:hidden bg-white shadow-sm p-4 flex items-center justify-between">
          <button onClick={() => setIsMobileMenuOpen(true)} className="p-2 text-gray-600 hover:text-gray-900">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16"/>
            </svg>
          </button>
          <h1 className="text-lg font-semibold text-gray-900">Calendario de Atendimento</h1>
          <div className="w-10" />
        </div>

        <main className="p-4 lg:p-6">
          {/* Header */}
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 mb-6">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-gradient-to-br from-orange-500 to-amber-500 rounded-xl flex items-center justify-center shadow-lg">
                <span className="text-2xl">📅</span>
              </div>
              <div>
                <h1 className="text-2xl lg:text-3xl font-bold text-gray-900">Calendario de Atendimento</h1>
                <p className="text-sm text-gray-500">Controle de visitas e entregas dos fornecedores</p>
              </div>
            </div>

            {/* Filtro de Mês */}
            <div className="flex items-center gap-2">
              <select
                value={mesSelecionado}
                onChange={(e) => setMesSelecionado(parseInt(e.target.value))}
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
              >
                {MESES.map((mes, idx) => (
                  <option key={idx} value={idx + 1}>{mes}</option>
                ))}
              </select>
              <select
                value={anoSelecionado}
                onChange={(e) => setAnoSelecionado(parseInt(e.target.value))}
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
              >
                {[2024, 2025, 2026].map(a => (
                  <option key={a} value={a}>{a}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex gap-1 mb-6 bg-gray-100 rounded-xl p-1">
            {TABS.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${
                  activeTab === tab.id
                    ? 'bg-white text-orange-700 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                <span>{tab.icon}</span>
                <span className="hidden sm:inline">{tab.label}</span>
              </button>
            ))}
          </div>

          {/* ==================== ABA: CADASTRO FORNECEDORES ==================== */}
          {activeTab === 'cadastro' && (
            <div>
              {/* Filtros */}
              <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 mb-4">
                <form onSubmit={handleBuscaFornecedor} className="flex flex-col sm:flex-row gap-3">
                  <div className="flex-1">
                    <input
                      type="text"
                      value={buscaFornecedor}
                      onChange={(e) => setBuscaFornecedor(e.target.value)}
                      placeholder="Buscar por nome, fantasia ou CNPJ..."
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
                    />
                  </div>

                  {/* Dropdown multi-select de classificações */}
                  <div className="relative" ref={classifRef}>
                    <button
                      type="button"
                      onClick={() => setShowClassifDropdown(!showClassifDropdown)}
                      className="flex items-center gap-2 border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white hover:bg-gray-50 min-w-[200px] justify-between"
                    >
                      <span className="truncate text-gray-700">
                        {classificacoesSel.length === 0
                          ? 'Todas Classificações'
                          : `${classificacoesSel.length} selecionada${classificacoesSel.length > 1 ? 's' : ''}`
                        }
                      </span>
                      <svg className={`w-4 h-4 text-gray-400 transition-transform ${showClassifDropdown ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"/>
                      </svg>
                    </button>

                    {showClassifDropdown && (
                      <div className="absolute top-full left-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-50 min-w-[260px] max-h-64 overflow-y-auto">
                        {classificacoesSel.length > 0 && (
                          <button
                            type="button"
                            onClick={() => { setClassificacoesSel([]); setPaginaFornecedor(1); }}
                            className="w-full text-left px-3 py-2 text-xs text-orange-600 hover:bg-orange-50 border-b border-gray-100 font-medium"
                          >
                            Limpar filtro
                          </button>
                        )}
                        {/* Opção especial: Sem Classificação */}
                        <label
                          className="flex items-center gap-2 px-3 py-2 hover:bg-orange-50 cursor-pointer text-sm border-b border-gray-100"
                        >
                          <input
                            type="checkbox"
                            checked={classificacoesSel.includes(0)}
                            onChange={() => toggleClassif(0)}
                            className="w-4 h-4 rounded border-gray-300 text-orange-500 focus:ring-orange-500"
                          />
                          <span className="text-orange-700 font-medium">🚫 Sem Classificação</span>
                        </label>
                        {classificacoes.map(c => (
                          <label
                            key={c.COD_CLASSIF}
                            className="flex items-center gap-2 px-3 py-2 hover:bg-gray-50 cursor-pointer text-sm"
                          >
                            <input
                              type="checkbox"
                              checked={classificacoesSel.includes(c.COD_CLASSIF)}
                              onChange={() => toggleClassif(c.COD_CLASSIF)}
                              className="w-4 h-4 rounded border-gray-300 text-orange-500 focus:ring-orange-500"
                            />
                            <span className="text-gray-700">{c.DES_CLASSIF}</span>
                            <span className="text-xs text-gray-400 ml-auto">({c.QTD_FORNECEDORES})</span>
                          </label>
                        ))}
                      </div>
                    )}
                  </div>

                  <button
                    type="submit"
                    className="px-4 py-2 bg-orange-500 text-white rounded-lg text-sm font-medium hover:bg-orange-600 transition-colors"
                  >
                    Buscar
                  </button>
                </form>
                <div className="flex items-center justify-between mt-2">
                  <p className="text-xs text-gray-400">{totalFornecedores} fornecedores encontrados</p>
                  <p className="text-xs text-gray-400">💡 Arraste os cabeçalhos para reordenar | Clique para ordenar A-Z</p>
                </div>
              </div>

              {/* Tabela de Fornecedores */}
              {loadingFornecedores ? (
                <div className="flex justify-center py-12">
                  <div className="animate-spin h-8 w-8 border-4 border-orange-500 border-t-transparent rounded-full"></div>
                </div>
              ) : fornecedoresOrdenados.length > 0 ? (
                <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-gradient-to-r from-orange-500 to-amber-500">
                        <tr>
                          {colunasOrdenadas.map((col, idx) => (
                            <th
                              key={col.id}
                              draggable
                              onDragStart={(e) => handleDragStart(e, idx)}
                              onDragOver={(e) => handleDragOver(e, idx)}
                              onDrop={() => handleDrop(idx)}
                              onDragEnd={handleDragEnd}
                              onClick={() => handleSort(col.id)}
                              className={`px-3 py-2.5 font-medium text-white text-xs whitespace-nowrap select-none transition-colors
                                ${col.align === 'center' ? 'text-center' : 'text-left'}
                                ${dragOverIdx === idx ? 'bg-orange-700/40 border-l-2 border-white' : ''}
                                hover:bg-orange-600/40 cursor-pointer
                              `}
                              style={{ cursor: 'grab' }}
                            >
                              <span className="inline-flex items-center gap-1">
                                {col.label}
                                <span className="text-orange-200 text-[10px]">
                                  {sortCol === col.id
                                    ? (sortDir === 'asc' ? '▲' : '▼')
                                    : '↕'
                                  }
                                </span>
                              </span>
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {fornecedoresOrdenados.map((f) => (
                          <tr key={f.COD_FORNECEDOR} className="hover:bg-gray-50">
                            {colunasOrdenadas.map(col => {
                              const isAgCol = AGENDAMENTO_FIELDS.has(col.id);
                              const isEditing = editingCell && editingCell.cod === f.COD_FORNECEDOR && editingCell.campo === col.id;
                              const ag = f._ag || {};

                              return (
                                <td
                                  key={col.id}
                                  className={`px-1.5 py-1 whitespace-nowrap max-w-[200px] truncate ${col.align === 'center' ? 'text-center' : 'text-left'} ${isAgCol && !isEditing ? 'cursor-pointer hover:bg-orange-50' : ''}`}
                                  onClick={isAgCol && !isEditing ? () => setEditingCell({ cod: f.COD_FORNECEDOR, campo: col.id }) : undefined}
                                >
                                  {isAgCol ? (
                                    isEditing ? (
                                      // === MODO EDIÇÃO ===
                                      col.id === 'FREQ_VISITA' ? (
                                        <select
                                          autoFocus
                                          defaultValue={ag.freq_visita || ''}
                                          onChange={(e) => saveAgendamento(f.COD_FORNECEDOR, 'freq_visita', e.target.value)}
                                          onBlur={() => setEditingCell(null)}
                                          className="w-full text-xs border border-orange-300 rounded px-1 py-0.5 focus:outline-none focus:ring-1 focus:ring-orange-500"
                                        >
                                          {FREQ_OPTIONS.map(o => <option key={o} value={o}>{o || '—'}</option>)}
                                        </select>
                                      ) : col.id === 'DIA_SEMANA_1' || col.id === 'DIA_SEMANA_2' || col.id === 'DIA_SEMANA_3' ? (
                                        <select
                                          autoFocus
                                          defaultValue={ag[col.id.toLowerCase()] || ''}
                                          onChange={(e) => saveAgendamento(f.COD_FORNECEDOR, col.id.toLowerCase(), e.target.value)}
                                          onBlur={() => setEditingCell(null)}
                                          className="w-full text-xs border border-orange-300 rounded px-1 py-0.5 focus:outline-none focus:ring-1 focus:ring-orange-500"
                                        >
                                          {DIA_SEMANA_OPTIONS.map(o => <option key={o} value={o}>{o || '—'}</option>)}
                                        </select>
                                      ) : col.id === 'DIA_MES' ? (
                                        <input
                                          autoFocus
                                          type="number"
                                          min="1"
                                          max="31"
                                          defaultValue={ag.dia_mes || ''}
                                          onBlur={(e) => saveAgendamento(f.COD_FORNECEDOR, 'dia_mes', e.target.value ? parseInt(e.target.value) : null)}
                                          onKeyDown={(e) => { if (e.key === 'Enter') e.target.blur(); }}
                                          className="w-16 text-xs border border-orange-300 rounded px-1 py-0.5 text-center focus:outline-none focus:ring-1 focus:ring-orange-500"
                                        />
                                      ) : col.id === 'INICIO_AGENDAMENTO' ? (
                                        <input
                                          autoFocus
                                          type="date"
                                          defaultValue={ag.inicio_agendamento ? ag.inicio_agendamento.split('T')[0] : ''}
                                          onBlur={(e) => saveAgendamento(f.COD_FORNECEDOR, 'inicio_agendamento', e.target.value || null)}
                                          onKeyDown={(e) => { if (e.key === 'Enter') e.target.blur(); }}
                                          className="text-xs border border-orange-300 rounded px-1 py-0.5 focus:outline-none focus:ring-1 focus:ring-orange-500"
                                        />
                                      ) : null
                                    ) : (
                                      // === MODO EXIBIÇÃO (agendamento) ===
                                      col.id === 'FREQ_VISITA' ? (
                                        ag.freq_visita
                                          ? <span className="text-xs font-medium text-purple-700 bg-purple-50 px-1.5 py-0.5 rounded">{ag.freq_visita}</span>
                                          : <span className="text-gray-300 text-xs">clique</span>
                                      ) : col.id === 'DIA_SEMANA_1' || col.id === 'DIA_SEMANA_2' || col.id === 'DIA_SEMANA_3' ? (
                                        ag[col.id.toLowerCase()]
                                          ? <span className="text-xs font-medium text-teal-700 bg-teal-50 px-1.5 py-0.5 rounded">{ag[col.id.toLowerCase()]}</span>
                                          : <span className="text-gray-300 text-xs">clique</span>
                                      ) : col.id === 'DIA_MES' ? (
                                        ag.dia_mes
                                          ? <span className="text-xs font-semibold text-indigo-700 bg-indigo-50 px-1.5 py-0.5 rounded">Dia {ag.dia_mes}</span>
                                          : <span className="text-gray-300 text-xs">clique</span>
                                      ) : col.id === 'INICIO_AGENDAMENTO' ? (
                                        ag.inicio_agendamento
                                          ? <span className="text-xs font-medium text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded">{new Date(ag.inicio_agendamento).toLocaleDateString('pt-BR')}</span>
                                          : <span className="text-gray-300 text-xs">clique</span>
                                      ) : null
                                    )
                                  ) : (
                                    renderCell(col.id, f)
                                  )}
                                </td>
                              );
                            })}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : (
                <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-12 text-center text-gray-500">
                  <span className="text-4xl block mb-3">📋</span>
                  Nenhum fornecedor encontrado
                </div>
              )}

              {/* Paginação */}
              {totalPaginas > 1 && (
                <div className="flex items-center justify-center gap-2 mt-4">
                  <button
                    onClick={() => setPaginaFornecedor(Math.max(1, paginaFornecedor - 1))}
                    disabled={paginaFornecedor === 1}
                    className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg disabled:opacity-50 hover:bg-gray-50"
                  >
                    Anterior
                  </button>
                  <span className="text-sm text-gray-600">
                    Página {paginaFornecedor} de {totalPaginas}
                  </span>
                  <button
                    onClick={() => setPaginaFornecedor(Math.min(totalPaginas, paginaFornecedor + 1))}
                    disabled={paginaFornecedor === totalPaginas}
                    className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg disabled:opacity-50 hover:bg-gray-50"
                  >
                    Próxima
                  </button>
                </div>
              )}
            </div>
          )}

          {/* ==================== ABA: VISÃO MENSAL (Calendário de Visitas) ==================== */}
          {activeTab === 'mensal' && (
            <div>
              {/* Resumo */}
              {(() => {
                const diasComVisita = calendarioVisitas.filter(d => d.fornecedores.length > 0).length;
                const totalVisitas = calendarioVisitas.reduce((s, d) => s + d.fornecedores.length, 0);
                const fornUnicos = new Set(calendarioVisitas.flatMap(d => d.fornecedores.map(f => f.cod))).size;
                return (
                  <div className="grid grid-cols-3 gap-4 mb-4">
                    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-3">
                      <p className="text-xs font-medium text-gray-500">Dias com Visita</p>
                      <p className="text-2xl font-bold text-gray-900">{diasComVisita}</p>
                    </div>
                    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-3">
                      <p className="text-xs font-medium text-gray-500">Total Visitas</p>
                      <p className="text-2xl font-bold text-blue-600">{totalVisitas}</p>
                    </div>
                    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-3">
                      <p className="text-xs font-medium text-gray-500">Fornecedores Agendados</p>
                      <p className="text-2xl font-bold text-orange-600">{fornUnicos}</p>
                    </div>
                  </div>
                );
              })()}

              {loadingMensal ? (
                <div className="flex justify-center py-12">
                  <div className="animate-spin h-8 w-8 border-4 border-orange-500 border-t-transparent rounded-full"></div>
                </div>
              ) : (
                <>
                  {/* Primeira metade: dias 1-15 */}
                  <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden mb-4">
                    <div className="px-4 py-2 bg-gradient-to-r from-orange-500 to-amber-500">
                      <h3 className="text-white font-semibold text-sm">
                        {MESES[mesSelecionado - 1]} {anoSelecionado} - Dias 1 a 15
                      </h3>
                    </div>
                    <div className="overflow-x-auto">
                      <div className="flex" style={{ minWidth: '100%' }}>
                        {calendarioVisitas.slice(0, 15).map(dia => {
                          const isHoje = dia.dia === hoje.getDate() && mesSelecionado === (hoje.getMonth() + 1) && anoSelecionado === hoje.getFullYear();
                          const isDomingo = dia.dow === 0;
                          return (
                            <div key={dia.dia} className={`flex-1 min-w-[110px] border-r border-gray-200 last:border-r-0 ${isDomingo ? 'bg-red-50/30' : ''}`}>
                              <div className={`text-center py-1.5 border-b border-gray-200 ${isHoje ? 'bg-orange-100' : 'bg-gray-50'}`}>
                                <div className={`text-sm font-bold ${isHoje ? 'text-orange-600' : isDomingo ? 'text-red-500' : 'text-gray-900'}`}>
                                  {String(dia.dia).padStart(2, '0')}
                                </div>
                                <div className={`text-[10px] ${isDomingo ? 'text-red-400' : 'text-gray-500'}`}>
                                  {dia.label}
                                </div>
                              </div>
                              <div className="p-0.5">
                                {dia.fornecedores.length > 0 ? dia.fornecedores.map(f => (
                                  <div key={f.cod} className="text-[9px] leading-tight text-gray-700 border-b border-gray-50 py-0.5 px-1 truncate hover:bg-orange-50" title={f.nome}>
                                    {f.nome}
                                  </div>
                                )) : (
                                  <div className="text-[9px] text-gray-300 text-center py-2">-</div>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>

                  {/* Segunda metade: dias 16-31 */}
                  {calendarioVisitas.length > 15 && (
                    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                      <div className="px-4 py-2 bg-gradient-to-r from-orange-500 to-amber-500">
                        <h3 className="text-white font-semibold text-sm">
                          {MESES[mesSelecionado - 1]} {anoSelecionado} - Dias 16 a {calendarioVisitas.length}
                        </h3>
                      </div>
                      <div className="overflow-x-auto">
                        <div className="flex" style={{ minWidth: '100%' }}>
                          {calendarioVisitas.slice(15).map(dia => {
                            const isHoje = dia.dia === hoje.getDate() && mesSelecionado === (hoje.getMonth() + 1) && anoSelecionado === hoje.getFullYear();
                            const isDomingo = dia.dow === 0;
                            return (
                              <div key={dia.dia} className={`flex-1 min-w-[110px] border-r border-gray-200 last:border-r-0 ${isDomingo ? 'bg-red-50/30' : ''}`}>
                                <div className={`text-center py-1.5 border-b border-gray-200 ${isHoje ? 'bg-orange-100' : 'bg-gray-50'}`}>
                                  <div className={`text-sm font-bold ${isHoje ? 'text-orange-600' : isDomingo ? 'text-red-500' : 'text-gray-900'}`}>
                                    {String(dia.dia).padStart(2, '0')}
                                  </div>
                                  <div className={`text-[10px] ${isDomingo ? 'text-red-400' : 'text-gray-500'}`}>
                                    {dia.label}
                                  </div>
                                </div>
                                <div className="p-0.5">
                                  {dia.fornecedores.length > 0 ? dia.fornecedores.map(f => (
                                    <div key={f.cod} className="text-[9px] leading-tight text-gray-700 border-b border-gray-50 py-0.5 px-1 truncate hover:bg-orange-50" title={f.nome}>
                                      {f.nome}
                                    </div>
                                  )) : (
                                    <div className="text-[9px] text-gray-300 text-center py-2">-</div>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  )}

                  {Object.keys(agendamentos).length === 0 && (
                    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-12 text-center text-gray-500 mt-4">
                      <span className="text-4xl block mb-3">📅</span>
                      <p className="font-medium">Nenhum fornecedor agendado</p>
                      <p className="text-sm mt-1">Preencha as colunas de agendamento na aba Cadastro Fornecedores</p>
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {/* ==================== ABA: ATENDIMENTO DIÁRIO ==================== */}
          {activeTab === 'diario' && (
            <div>
              {/* Seletor de dia */}
              <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 mb-4 flex flex-col sm:flex-row items-start sm:items-center gap-3">
                <div className="flex items-center gap-2">
                  <span className="text-lg">📦</span>
                  <span className="text-sm font-medium text-gray-700">Dia:</span>
                  <input
                    type="date"
                    value={diaSelecionado}
                    onChange={(e) => setDiaSelecionado(e.target.value)}
                    className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      const d = new Date(diaSelecionado);
                      d.setDate(d.getDate() - 1);
                      setDiaSelecionado(d.toISOString().split('T')[0]);
                    }}
                    className="px-3 py-2 border border-gray-300 rounded-lg text-sm hover:bg-gray-50"
                  >
                    ← Anterior
                  </button>
                  <button
                    onClick={() => setDiaSelecionado(hoje.toISOString().split('T')[0])}
                    className="px-3 py-2 bg-orange-500 text-white rounded-lg text-sm hover:bg-orange-600"
                  >
                    Hoje
                  </button>
                  <button
                    onClick={() => {
                      const d = new Date(diaSelecionado);
                      d.setDate(d.getDate() + 1);
                      setDiaSelecionado(d.toISOString().split('T')[0]);
                    }}
                    className="px-3 py-2 border border-gray-300 rounded-lg text-sm hover:bg-gray-50"
                  >
                    Próximo →
                  </button>
                </div>
                {atendimentosDia.length > 0 && (
                  <div className="sm:ml-auto flex items-center gap-3 text-sm">
                    <span className="text-gray-500">{atendimentosDia.length} entregas</span>
                    <span className="font-semibold text-green-700">
                      {formatMoney(atendimentosDia.reduce((s, a) => s + (a.VAL_TOTAL_NF || 0), 0))}
                    </span>
                  </div>
                )}
              </div>

              {loadingDiario ? (
                <div className="flex justify-center py-12">
                  <div className="animate-spin h-8 w-8 border-4 border-orange-500 border-t-transparent rounded-full"></div>
                </div>
              ) : atendimentosDia.length > 0 ? (
                <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50 border-b border-gray-200">
                        <tr>
                          <th className="text-left px-4 py-3 font-medium text-gray-600">Fornecedor</th>
                          <th className="text-left px-4 py-3 font-medium text-gray-600">NF</th>
                          <th className="text-left px-4 py-3 font-medium text-gray-600">Entrada</th>
                          <th className="text-right px-4 py-3 font-medium text-gray-600">Valor</th>
                          <th className="text-center px-4 py-3 font-medium text-gray-600">Pedido</th>
                          <th className="text-center px-4 py-3 font-medium text-gray-600">Prazo</th>
                          <th className="text-left px-4 py-3 font-medium text-gray-600">Classificação</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {atendimentosDia.map((a, idx) => (
                          <tr key={idx} className="hover:bg-gray-50">
                            <td className="px-4 py-3">
                              <p className="font-medium text-gray-900">{a.DES_FANTASIA}</p>
                              <p className="text-xs text-gray-500 truncate max-w-xs">{a.DES_FORNECEDOR}</p>
                            </td>
                            <td className="px-4 py-3 text-gray-700">{a.NUM_NF_FORN}</td>
                            <td className="px-4 py-3 text-gray-700">{a.DTA_ENTRADA}</td>
                            <td className="px-4 py-3 text-right font-semibold text-gray-900">{formatMoney(a.VAL_TOTAL_NF)}</td>
                            <td className="px-4 py-3 text-center">
                              {a.NUM_PEDIDO ? (
                                <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full">#{a.NUM_PEDIDO}</span>
                              ) : (
                                <span className="text-xs bg-red-100 text-red-700 px-2 py-1 rounded-full">Sem pedido</span>
                              )}
                            </td>
                            <td className="px-4 py-3 text-center">
                              {a.PRAZO_DIAS !== null ? (
                                <span className={`text-xs font-medium ${a.PRAZO_DIAS > 7 ? 'text-red-600' : 'text-green-600'}`}>
                                  {a.PRAZO_DIAS}d
                                </span>
                              ) : '-'}
                            </td>
                            <td className="px-4 py-3">
                              <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded-full">{a.DES_CLASSIFICACAO}</span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : (
                <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-12 text-center text-gray-500">
                  <span className="text-4xl block mb-3">📦</span>
                  <p className="font-medium">Nenhuma entrega registrada neste dia</p>
                  <p className="text-sm mt-1">
                    {new Date(diaSelecionado + 'T12:00:00').toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                  </p>
                </div>
              )}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
