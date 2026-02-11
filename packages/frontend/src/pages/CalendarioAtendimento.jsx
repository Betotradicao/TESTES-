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
const AGENDAMENTO_FIELDS = new Set(['FREQ_VISITA', 'DIA_SEMANA_1', 'DIA_SEMANA_2', 'DIA_SEMANA_3', 'DIA_MES', 'INICIO_AGENDAMENTO', 'COMPRADOR', 'TIPO_ATENDIMENTO', 'HORA_INICIO', 'HORA_TERMINO']);

// Mapeamento dia da semana JS (0=Dom) → nome em português usado no agendamento
const DIA_SEMANA_MAP = { 0: 'Domingo', 1: 'Segunda', 2: 'Terca', 3: 'Quarta', 4: 'Quinta', 5: 'Sexta', 6: 'Sabado' };
const DIA_SEMANA_LABEL = { 0: 'domingo', 1: 'segunda-feira', 2: 'terça-feira', 3: 'quarta-feira', 4: 'quinta-feira', 5: 'sexta-feira', 6: 'sábado' };

// Formata número de telefone para link WhatsApp Web direto
const formatWhatsAppUrl = (phone) => {
  if (!phone) return null;
  const digits = String(phone).replace(/\D/g, '');
  if (digits.length < 10) return null;
  const num = digits.startsWith('55') ? digits : '55' + digits;
  return `https://web.whatsapp.com/send?phone=${num}`;
};

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
  { id: 'COMPRADOR', label: '👤 COMPRADOR', align: 'center' },
  { id: 'TIPO_ATENDIMENTO', label: '📞 TIPO ATEND.', align: 'center' },
  { id: 'HORA_INICIO', label: '🕐 H. INÍCIO', align: 'center' },
  { id: 'HORA_TERMINO', label: '🕑 H. TÉRMINO', align: 'center' },
];
const DEFAULT_COL_IDS = FORNECEDOR_COLS.map(c => c.id);
const COL_ORDER_KEY = 'cal-forn-col-order';

// ====== COLUNAS DO ATENDIMENTO DIÁRIO ======
const DIARIO_COLS = [
  { id: 'AGENDA', label: 'AGENDA', align: 'center' },
  { id: 'COD', label: 'COD', align: 'center' },
  { id: 'FORNECEDOR', label: 'FORNECEDOR', align: 'left' },
  { id: 'TIPO_ATEND', label: 'TIPO ATEND.', align: 'center' },
  { id: 'CLASSIFICACAO', label: 'CLASSIFICAÇÃO', align: 'left' },
  { id: 'VISITA', label: 'VISITA', align: 'center' },
  { id: 'H_INICIO', label: 'H: INICIO', align: 'center' },
  { id: 'H_TERMINO', label: 'H: TERMINO', align: 'center' },
  { id: 'STATUS', label: 'STATUS', align: 'center' },
  { id: 'NUM_PEDIDO', label: 'Nº PEDIDO', align: 'center' },
  { id: 'VAL_PEDIDO', label: 'VALOR PEDIDO', align: 'right' },
  { id: 'DTA_ENTREGA', label: 'DATA ENTREGA', align: 'center' },
  { id: 'DEBITO', label: 'DÉBITO', align: 'right' },
  { id: 'PRAZO_PG', label: 'PRAZO PG', align: 'center' },
  { id: 'PROX_ATEND', label: 'PRÓX. ATEND', align: 'center' },
  { id: 'DIAS_TOTAIS', label: 'DIAS TOTAIS', align: 'center' },
  { id: 'DIA_SEMANA', label: 'DIA SEMANA', align: 'center' },
  { id: 'CONTATO', label: 'CONTATO', align: 'left' },
  { id: 'CELULAR', label: 'CELULAR', align: 'left' },
  { id: 'EMAIL', label: 'EMAIL', align: 'left' },
];
const DEFAULT_DIARIO_IDS = DIARIO_COLS.map(c => c.id);
const DIARIO_COL_ORDER_KEY = 'cal-diario-col-order';

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
    case 'COMPRADOR': return f._ag?.comprador || '';
    case 'TIPO_ATENDIMENTO': return f._ag?.tipo_atendimento || '';
    case 'HORA_INICIO': return f._ag?.hora_inicio || '';
    case 'HORA_TERMINO': return f._ag?.hora_termino || '';
    default: return '';
  }
};

// Valor bruto para ordenação no Diário
const getDiarioCellRaw = (colId, row) => {
  switch (colId) {
    case 'AGENDA': return row.isScheduled ? 'SIM' : 'NÃO';
    case 'COD': return row.cod;
    case 'FORNECEDOR': return (row.fantasia || '').toUpperCase();
    case 'TIPO_ATEND': return (row.tipoAtendimento || '').toUpperCase();
    case 'CLASSIFICACAO': return (row.classificacao || '').toUpperCase();
    case 'VISITA': return row.visita || '';
    case 'H_INICIO': return row.horaInicio || '';
    case 'H_TERMINO': return row.horaTermino || '';
    case 'STATUS': return row.status;
    case 'NUM_PEDIDO': return row.pedidosOracle.length > 0 ? row.pedidosOracle[0].NUM_PEDIDO : 0;
    case 'VAL_PEDIDO': return row.pedidosOracle.reduce((s, p) => s + (p.VAL_TOTAL_PEDIDO || 0), 0);
    case 'DTA_ENTREGA': return row.pedidosOracle.length > 0 ? row.pedidosOracle[0].DTA_ENTREGA || '' : '';
    case 'DEBITO': return Number(row.debito) || 0;
    case 'PRAZO_PG': return row.prazoPg || '';
    case 'PROX_ATEND': return row.proximoAtend ? row.proximoAtend.getTime() : 0;
    case 'DIAS_TOTAIS': return row.diasTotais || 0;
    case 'DIA_SEMANA': return row.diaSemana;
    case 'CONTATO': return (row.contato || '').toUpperCase();
    case 'CELULAR': return row.celular || '';
    case 'EMAIL': return (row.email || '').toUpperCase();
    default: return '';
  }
};

// Renderizar célula com cores
const renderCell = (colId, f) => {
  switch (colId) {
    case 'DES_FANTASIA':
      return <span className="text-gray-900">{f.DES_FANTASIA || '-'}</span>;
    case 'DES_FORNECEDOR':
      return <span className="text-gray-700">{f.DES_FORNECEDOR}</span>;
    case 'NUM_CGC':
      return <span className="text-gray-600">{f.NUM_CGC || '-'}</span>;
    case 'DES_CONTATO':
      return <span className="text-gray-600">{f.DES_CONTATO || '-'}</span>;
    case 'CELULAR': {
      const cel = f.NUM_CELULAR || f.NUM_FONE || '';
      const waUrl = formatWhatsAppUrl(cel);
      return cel && waUrl
        ? <a href={waUrl} target="_blank" rel="noopener noreferrer" className="text-green-600 hover:text-green-800 hover:underline font-medium" title="Abrir WhatsApp">{cel} 📱</a>
        : <span className="text-gray-600">{cel || '-'}</span>;
    }
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
          className={`inline-flex items-center px-1.5 py-0.5 rounded font-semibold ${cor}`}
          title={`Prazo médio real (${f.QTD_NFS_PRAZO || 0} NFs em 180d). Cadastro: ${prazoCad}d`}
        >
          {pmRound}d
        </span>
      );
    }
    case 'NUM_MED_CPGTO': {
      const conds = f.CONDICOES_PGTO;
      if (conds) {
        const valores = conds.split('/');
        return (
          <span className="inline-flex items-center gap-0.5 font-semibold">
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
        ? <span className="text-blue-700 font-semibold">{v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
        : <span className="text-gray-400">-</span>;
    }
    case 'VAL_CREDITO': {
      const v = Number(f.VAL_CREDITO) || 0;
      return v > 0
        ? <span className="text-green-600 font-semibold">{v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
        : <span className="text-gray-400">-</span>;
    }
    case 'VAL_DEBITO': {
      const v = Number(f.VAL_DEBITO) || 0;
      return v > 0
        ? <span className="text-red-600 font-semibold">{v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
        : <span className="text-gray-400">-</span>;
    }
    case 'DES_CLASSIFICACAO':
      return <span className="bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">{f.DES_CLASSIFICACAO || '-'}</span>;
    case 'ULTIMO_ATENDIMENTO':
      return <span className="text-gray-600">{f.ULTIMO_ATENDIMENTO ? new Date(f.ULTIMO_ATENDIMENTO).toLocaleDateString('pt-BR') : '-'}</span>;
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
  const [loadingFornecedores, setLoadingFornecedores] = useState(false);
  const [statusNF, setStatusNF] = useState('com_nf');
  const [showClassifDropdown, setShowClassifDropdown] = useState(false);
  const classifRef = useRef(null);

  // Ordem das colunas (drag-and-drop, persistido no localStorage)
  const [columnOrder, setColumnOrder] = useState(() => {
    try {
      const saved = localStorage.getItem(COL_ORDER_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          // Append any new columns not in saved order
          const missing = DEFAULT_COL_IDS.filter(id => !parsed.includes(id));
          // Remove any old columns no longer in defaults
          const valid = parsed.filter(id => DEFAULT_COL_IDS.includes(id));
          if (valid.length > 0) {
            const merged = [...valid, ...missing];
            if (missing.length > 0) localStorage.setItem(COL_ORDER_KEY, JSON.stringify(merged));
            return merged;
          }
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
  const [opcoesComprador, setOpcoesComprador] = useState([]); // [{id, valor}]
  const [opcoesTipoAtendimento, setOpcoesTipoAtendimento] = useState([]); // [{id, valor}]
  const [showOpcoesModalRaw, setShowOpcoesModalRaw] = useState(null); // 'comprador' | 'tipo_atendimento' | null
  const openOpcoesModal = (tipo) => { setShowOpcoesModalRaw(tipo); carregarOpcoes(); };
  const closeOpcoesModal = () => { setShowOpcoesModalRaw(null); setNovaOpcao(''); };
  const [novaOpcao, setNovaOpcao] = useState('');

  // === VISÃO MENSAL (Calendário de Visitas) ===
  const [dadosMensais, setDadosMensais] = useState([]);
  const [loadingMensal, setLoadingMensal] = useState(false);
  const [fornecedorNomes, setFornecedorNomes] = useState({}); // cod → fantasia

  // === ATENDIMENTO DIÁRIO ===
  const [diaSelecionado, setDiaSelecionado] = useState(hoje.toISOString().split('T')[0]);
  const [atendimentosDia, setAtendimentosDia] = useState([]);
  const [pedidosDia, setPedidosDia] = useState({}); // cod_forn → [pedidos]
  const [loadingDiario, setLoadingDiario] = useState(false);
  const [fornecedorDetalhes, setFornecedorDetalhes] = useState({});
  const [compradorFilterDiario, setCompradorFilterDiario] = useState(() => localStorage.getItem('cal-comprador-filter') || '');
  const [diarioSortCol, setDiarioSortCol] = useState(null);
  const [diarioSortDir, setDiarioSortDir] = useState('asc');

  // Colunas do Diário (drag-and-drop, persistido)
  const [diarioColOrder, setDiarioColOrder] = useState(() => {
    try {
      const saved = localStorage.getItem(DIARIO_COL_ORDER_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          const missing = DEFAULT_DIARIO_IDS.filter(id => !parsed.includes(id));
          const valid = parsed.filter(id => DEFAULT_DIARIO_IDS.includes(id));
          if (valid.length > 0) return [...valid, ...missing];
        }
      }
    } catch (e) {}
    return [...DEFAULT_DIARIO_IDS];
  });
  const diarioDragRef = useRef({ dragIdx: null });
  const [diarioDragOverIdx, setDiarioDragOverIdx] = useState(null);

  // Colunas na ordem definida pelo usuário
  const colunasOrdenadas = useMemo(() => {
    return columnOrder.map(id => FORNECEDOR_COLS.find(c => c.id === id)).filter(Boolean);
  }, [columnOrder]);

  // Colunas do Diário na ordem definida
  const diarioColunasOrdenadas = useMemo(() => {
    return diarioColOrder.map(id => DIARIO_COLS.find(c => c.id === id)).filter(Boolean);
  }, [diarioColOrder]);

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
    carregarOpcoes();
  }, []);

  useEffect(() => {
    if (activeTab === 'cadastro') carregarFornecedores();
    if (activeTab === 'mensal') carregarVisaoMensal();
    if (activeTab === 'diario') carregarAtendimentoDiario();
  }, [activeTab, mesSelecionado, anoSelecionado, lojaSelecionada]);

  useEffect(() => {
    if (activeTab === 'cadastro') carregarFornecedores();
  }, [classificacoesSel, statusNF]);

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

  const carregarOpcoes = async () => {
    try {
      const res = await api.get('/api/calendario-atendimento/opcoes-dropdown');
      setOpcoesComprador(res.data.compradores || []);
      setOpcoesTipoAtendimento(res.data.tipos_atendimento || []);
    } catch (err) {
      console.error('Erro ao carregar opções:', err);
    }
  };

  const adicionarOpcao = async (tipo, valor) => {
    if (!valor.trim()) return;
    try {
      await api.post('/api/calendario-atendimento/opcoes-dropdown', { tipo, valor: valor.trim().toUpperCase() });
      await carregarOpcoes();
      setNovaOpcao('');
    } catch (err) {
      console.error('Erro ao adicionar opção:', err);
    }
  };

  const removerOpcao = async (id) => {
    try {
      await api.delete(`/api/calendario-atendimento/opcoes-dropdown/${id}`);
      await carregarOpcoes();
    } catch (err) {
      console.error('Erro ao remover opção:', err);
    }
  };

  const carregarFornecedores = async () => {
    setLoadingFornecedores(true);
    try {
      const params = new URLSearchParams();
      if (buscaFornecedor) params.append('busca', buscaFornecedor);
      if (classificacoesSel.length > 0) params.append('classificacao', classificacoesSel.join(','));
      if (lojaSelecionada) params.append('codLoja', lojaSelecionada);
      if (statusNF) params.append('statusNF', statusNF);
      params.append('limite', '9999');

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
        // Só mostra no calendário se tem ao menos um dia da semana preenchido
        const temDiaSemana = ag.dia_semana_1 || ag.dia_semana_2 || ag.dia_semana_3;
        if (!temDiaSemana) continue;
        if (fornecedorNoDia(ag, date)) {
          const cod = parseInt(codStr);
          const nome = fornecedorNomes[cod];
          if (!nome) continue; // Ignora se não existe no Oracle
          fornecedoresNoDia.push({ cod, nome });
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

      const [nfRes, agRes, detRes, pedRes] = await Promise.all([
        api.get(`/api/calendario-atendimento/atendimento-diario?${params}`),
        api.get('/api/calendario-atendimento/agendamentos'),
        api.get('/api/calendario-atendimento/fornecedores-detalhes'),
        api.get(`/api/calendario-atendimento/pedidos-dia?${params}`).catch(() => ({ data: [] }))
      ]);
      setAtendimentosDia(nfRes.data);
      setAgendamentos(agRes.data || {});
      setFornecedorDetalhes(detRes.data || {});
      // Agrupar pedidos por fornecedor
      const pedMap = {};
      for (const ped of (pedRes.data || [])) {
        if (!pedMap[ped.COD_FORNECEDOR]) pedMap[ped.COD_FORNECEDOR] = [];
        pedMap[ped.COD_FORNECEDOR].push(ped);
      }
      setPedidosDia(pedMap);
    } catch (err) {
      console.error('Erro ao carregar atendimento diário:', err);
    }
    setLoadingDiario(false);
  };

  const handleBuscaFornecedor = (e) => {
    e.preventDefault();
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

  // Sort do Diário
  const handleDiarioSort = (colId) => {
    if (diarioSortCol === colId) {
      if (diarioSortDir === 'asc') setDiarioSortDir('desc');
      else { setDiarioSortCol(null); setDiarioSortDir('asc'); }
    } else {
      setDiarioSortCol(colId);
      setDiarioSortDir('asc');
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
      return prev.includes(cod) ? prev.filter(c => c !== cod) : [...prev, cod];
    });
  };

  // Atendimento diário: merge agendados + NFs + detalhes
  const diarioMerged = useMemo(() => {
    const dataSel = new Date(diaSelecionado + 'T12:00:00');
    const dow = dataSel.getDay();
    const diaSemanaLabel = DIA_SEMANA_LABEL[dow];

    // Fornecedores agendados para este dia (mesmo filtro da Visão Mensal)
    const agendadosHoje = {};
    for (const [codStr, ag] of Object.entries(agendamentos)) {
      const temDiaSemana = ag.dia_semana_1 || ag.dia_semana_2 || ag.dia_semana_3;
      if (!temDiaSemana) continue; // Só mostra se tem dia da semana configurado
      if (fornecedorNoDia(ag, dataSel)) {
        agendadosHoje[parseInt(codStr)] = ag;
      }
    }

    // NFs agrupadas por fornecedor
    const nfsPorFornecedor = {};
    for (const nf of atendimentosDia) {
      if (!nfsPorFornecedor[nf.COD_FORNECEDOR]) nfsPorFornecedor[nf.COD_FORNECEDOR] = [];
      nfsPorFornecedor[nf.COD_FORNECEDOR].push(nf);
    }

    // Apenas fornecedores agendados ou com pedidos (NFs sozinhas não entram)
    const allCods = new Set([
      ...Object.keys(agendadosHoje).map(Number),
      ...Object.keys(pedidosDia).map(Number)
    ]);

    const rows = [];
    for (const cod of allCods) {
      const ag = agendamentos[cod] || {};
      const det = fornecedorDetalhes[cod] || {};
      const nfs = nfsPorFornecedor[cod] || [];
      const peds = pedidosDia[cod] || [];
      const isScheduled = !!agendadosHoje[cod];
      const hasNF = nfs.length > 0;
      const hasPedido = peds.length > 0;

      // Pegar nome fantasia - se não tem no Oracle, pular
      const fantasia = det.DES_FANTASIA || (nfs[0]?.DES_FANTASIA) || null;
      if (!fantasia) continue; // Ignora fornecedores sem nome

      // Próximo atendimento: busca até 60 dias à frente
      let proximoAtend = null;
      if (ag.freq_visita) {
        for (let i = 1; i <= 60; i++) {
          const futureDate = new Date(dataSel);
          futureDate.setDate(futureDate.getDate() + i);
          if (fornecedorNoDia(ag, futureDate)) {
            proximoAtend = futureDate;
            break;
          }
        }
      }

      // Status baseado em PEDIDOS emitidos no dia
      let status = hasPedido ? 'Realizado' : 'Pendente';

      rows.push({
        cod,
        fantasia,
        comprador: ag.comprador || '',
        tipoAtendimento: ag.tipo_atendimento || '',
        classificacao: det.DES_CLASSIFICACAO || nfs[0]?.DES_CLASSIFICACAO || '',
        visita: ag.freq_visita || '',
        horaInicio: ag.hora_inicio || null,
        horaTermino: ag.hora_termino || null,
        status,
        isScheduled,
        hasNF,
        hasPedido,
        pedidosOracle: peds,
        debito: det.VAL_DEBITO || 0,
        prazoPg: det.CONDICOES_PGTO || (det.NUM_MED_CPGTO ? `${det.NUM_MED_CPGTO}d` : ''),
        proximoAtend,
        diasTotais: proximoAtend ? Math.round((proximoAtend.getTime() - dataSel.getTime()) / 86400000) : null,
        diaSemana: diaSemanaLabel,
        contato: det.DES_CONTATO || '',
        celular: det.NUM_CELULAR || det.NUM_FONE || '',
        email: det.DES_EMAIL || '',
        nfs,
        valorTotal: nfs.reduce((s, n) => s + (n.VAL_TOTAL_NF || 0), 0)
      });
    }

    // Filtrar por comprador se selecionado
    const filtered = compradorFilterDiario
      ? rows.filter(r => r.comprador === compradorFilterDiario)
      : rows;

    // Ordenar: agendados primeiro, depois por nome
    filtered.sort((a, b) => {
      if (a.isScheduled && !b.isScheduled) return -1;
      if (!a.isScheduled && b.isScheduled) return 1;
      return a.fantasia.localeCompare(b.fantasia, 'pt-BR');
    });

    return filtered;
  }, [diaSelecionado, agendamentos, atendimentosDia, fornecedorDetalhes, pedidosDia, compradorFilterDiario]);

  // Ordenação do Diário
  const diarioSorted = useMemo(() => {
    if (!diarioSortCol) return diarioMerged;
    return [...diarioMerged].sort((a, b) => {
      const va = getDiarioCellRaw(diarioSortCol, a);
      const vb = getDiarioCellRaw(diarioSortCol, b);
      if (typeof va === 'number' && typeof vb === 'number') {
        return diarioSortDir === 'asc' ? va - vb : vb - va;
      }
      return diarioSortDir === 'asc'
        ? String(va).localeCompare(String(vb), 'pt-BR')
        : String(vb).localeCompare(String(va), 'pt-BR');
    });
  }, [diarioMerged, diarioSortCol, diarioSortDir]);

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
          <div className="flex gap-1 mb-6 bg-gradient-to-r from-orange-500 to-amber-500 rounded-xl p-1">
            {TABS.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${
                  activeTab === tab.id
                    ? 'bg-white text-orange-700 shadow-sm'
                    : 'text-white/90 hover:text-white hover:bg-white/10'
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
                            onClick={() => { setClassificacoesSel([]); }}
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

                  {/* Filtro status NF */}
                  <select
                    value={statusNF}
                    onChange={(e) => setStatusNF(e.target.value)}
                    className="border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white hover:bg-gray-50 min-w-[180px]"
                  >
                    <option value="todos">Todos</option>
                    <option value="com_nf">Com NFs 12 meses</option>
                    <option value="sem_nf">Sem NFs 12 meses</option>
                  </select>

                  <button
                    type="submit"
                    className="px-4 py-2 bg-orange-500 text-white rounded-lg text-sm font-medium hover:bg-orange-600 transition-colors"
                  >
                    Buscar
                  </button>
                </form>
                <div className="flex items-center justify-between mt-2">
                  <p className="text-xs text-gray-400">{totalFornecedores} fornecedores encontrados</p>
                  <p className="text-xs text-gray-400">Arraste os cabeçalhos para reordenar | Clique para ordenar A-Z</p>
                </div>
              </div>

              {/* Tabela de Fornecedores */}
              {loadingFornecedores ? (
                <div className="flex justify-center py-12">
                  <div className="animate-spin h-8 w-8 border-4 border-orange-500 border-t-transparent rounded-full"></div>
                </div>
              ) : fornecedoresOrdenados.length > 0 ? (
                <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                  <div className="overflow-x-auto overflow-y-auto max-h-[78vh]">
                    <table className="w-full text-sm">
                      <thead className="bg-gradient-to-r from-orange-500 to-amber-500 sticky top-0 z-10">
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
                                {(col.id === 'COMPRADOR' || col.id === 'TIPO_ATENDIMENTO') && (
                                  <button
                                    type="button"
                                    onClick={(e) => { e.stopPropagation(); openOpcoesModal(col.id === 'COMPRADOR' ? 'comprador' : 'tipo_atendimento'); }}
                                    className="text-orange-200 hover:text-white ml-0.5"
                                    title="Gerenciar opções"
                                  >
                                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/></svg>
                                  </button>
                                )}
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
                                      ) : col.id === 'COMPRADOR' ? (
                                        <div className="flex items-center gap-1">
                                          <select
                                            autoFocus
                                            defaultValue={ag.comprador || ''}
                                            onChange={(e) => saveAgendamento(f.COD_FORNECEDOR, 'comprador', e.target.value)}
                                            onBlur={() => setEditingCell(null)}
                                            className="w-full text-xs border border-orange-300 rounded px-1 py-0.5 focus:outline-none focus:ring-1 focus:ring-orange-500"
                                          >
                                            <option value="">—</option>
                                            {opcoesComprador.map(o => <option key={o.id} value={o.valor}>{o.valor}</option>)}
                                          </select>
                                          <button
                                            type="button"
                                            onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); setEditingCell(null); openOpcoesModal('comprador'); }}
                                            className="text-gray-400 hover:text-orange-500 shrink-0"
                                            title="Gerenciar opções"
                                          >
                                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6"/></svg>
                                          </button>
                                        </div>
                                      ) : col.id === 'TIPO_ATENDIMENTO' ? (
                                        <div className="flex items-center gap-1">
                                          <select
                                            autoFocus
                                            defaultValue={ag.tipo_atendimento || ''}
                                            onChange={(e) => saveAgendamento(f.COD_FORNECEDOR, 'tipo_atendimento', e.target.value)}
                                            onBlur={() => setEditingCell(null)}
                                            className="w-full text-xs border border-orange-300 rounded px-1 py-0.5 focus:outline-none focus:ring-1 focus:ring-orange-500"
                                          >
                                            <option value="">—</option>
                                            {opcoesTipoAtendimento.map(o => <option key={o.id} value={o.valor}>{o.valor}</option>)}
                                          </select>
                                          <button
                                            type="button"
                                            onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); setEditingCell(null); openOpcoesModal('tipo_atendimento'); }}
                                            className="text-gray-400 hover:text-orange-500 shrink-0"
                                            title="Gerenciar opções"
                                          >
                                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6"/></svg>
                                          </button>
                                        </div>
                                      ) : col.id === 'HORA_INICIO' ? (
                                        <input
                                          autoFocus
                                          type="time"
                                          defaultValue={ag.hora_inicio || ''}
                                          onBlur={(e) => saveAgendamento(f.COD_FORNECEDOR, 'hora_inicio', e.target.value || null)}
                                          onKeyDown={(e) => { if (e.key === 'Enter') e.target.blur(); }}
                                          className="text-xs border border-orange-300 rounded px-1 py-0.5 focus:outline-none focus:ring-1 focus:ring-orange-500"
                                        />
                                      ) : col.id === 'HORA_TERMINO' ? (
                                        <input
                                          autoFocus
                                          type="time"
                                          defaultValue={ag.hora_termino || ''}
                                          onBlur={(e) => saveAgendamento(f.COD_FORNECEDOR, 'hora_termino', e.target.value || null)}
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
                                      ) : col.id === 'COMPRADOR' ? (
                                        ag.comprador
                                          ? <span className="text-xs font-medium text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded">{ag.comprador}</span>
                                          : <span className="text-gray-300 text-xs">clique</span>
                                      ) : col.id === 'TIPO_ATENDIMENTO' ? (
                                        ag.tipo_atendimento
                                          ? <span className="text-xs font-medium text-rose-700 bg-rose-50 px-1.5 py-0.5 rounded truncate max-w-[120px] inline-block" title={ag.tipo_atendimento}>{ag.tipo_atendimento}</span>
                                          : <span className="text-gray-300 text-xs">clique</span>
                                      ) : col.id === 'HORA_INICIO' ? (
                                        ag.hora_inicio
                                          ? <span className="text-xs font-medium text-sky-700 bg-sky-50 px-1.5 py-0.5 rounded">{ag.hora_inicio}</span>
                                          : <span className="text-gray-300 text-xs">clique</span>
                                      ) : col.id === 'HORA_TERMINO' ? (
                                        ag.hora_termino
                                          ? <span className="text-xs font-medium text-sky-700 bg-sky-50 px-1.5 py-0.5 rounded">{ag.hora_termino}</span>
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
                                <div className={`text-xs font-medium ${isDomingo ? 'text-red-400' : 'text-gray-500'}`}>
                                  {dia.label}
                                </div>
                              </div>
                              <div className="p-0.5">
                                {dia.fornecedores.length > 0 ? dia.fornecedores.map(f => (
                                  <div key={f.cod} className="text-[13px] leading-normal text-blue-700 font-semibold border-b border-blue-100 py-1 px-1.5 truncate hover:bg-blue-50" title={f.nome}>
                                    {f.nome}
                                  </div>
                                )) : (
                                  <div className="text-[11px] text-gray-300 text-center py-2">-</div>
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
                                  <div className={`text-xs font-medium ${isDomingo ? 'text-red-400' : 'text-gray-500'}`}>
                                    {dia.label}
                                  </div>
                                </div>
                                <div className="p-0.5">
                                  {dia.fornecedores.length > 0 ? dia.fornecedores.map(f => (
                                    <div key={f.cod} className="text-[13px] leading-normal text-blue-700 font-semibold border-b border-blue-100 py-1 px-1.5 truncate hover:bg-blue-50" title={f.nome}>
                                      {f.nome}
                                    </div>
                                  )) : (
                                    <div className="text-[11px] text-gray-300 text-center py-2">-</div>
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
              {/* Filtros do Diário */}
              <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 mb-4">
                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
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

                  {/* Filtro de Comprador */}
                  <select
                    value={compradorFilterDiario}
                    onChange={(e) => {
                      setCompradorFilterDiario(e.target.value);
                      localStorage.setItem('cal-comprador-filter', e.target.value);
                    }}
                    className="border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white hover:bg-gray-50 min-w-[160px]"
                  >
                    <option value="">Todos Compradores</option>
                    {opcoesComprador.map(o => (
                      <option key={o.id} value={o.valor}>{o.valor}</option>
                    ))}
                  </select>

                  <div className="sm:ml-auto flex items-center gap-3 text-sm">
                    <span className="text-gray-500">
                      {new Date(diaSelecionado + 'T12:00:00').toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}
                    </span>
                    {diarioSorted.length > 0 && (
                      <>
                        <span className="text-blue-600 font-medium">{diarioSorted.filter(r => r.isScheduled).length} agendados</span>
                        <span className="text-green-600 font-medium">{diarioSorted.filter(r => r.status === 'Realizado').length} realizados</span>
                        <span className="font-semibold text-green-700">
                          {formatMoney(diarioSorted.reduce((s, r) => s + r.valorTotal, 0))}
                        </span>
                      </>
                    )}
                  </div>
                </div>
                <p className="text-xs text-gray-400 mt-2">Arraste os cabeçalhos para reordenar colunas</p>
              </div>

              {loadingDiario ? (
                <div className="flex justify-center py-12">
                  <div className="animate-spin h-8 w-8 border-4 border-orange-500 border-t-transparent rounded-full"></div>
                </div>
              ) : diarioSorted.length > 0 ? (
                <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                  <div className="overflow-x-auto overflow-y-auto max-h-[78vh]">
                    <table className="w-full text-base">
                      <thead className="bg-gradient-to-r from-orange-500 to-amber-500 sticky top-0 z-10">
                        <tr>
                          {diarioColunasOrdenadas.map((col, idx) => (
                            <th
                              key={col.id}
                              draggable
                              onDragStart={(e) => { diarioDragRef.current.dragIdx = idx; e.dataTransfer.effectAllowed = 'move'; }}
                              onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; setDiarioDragOverIdx(idx); }}
                              onDrop={() => {
                                const dragIdx = diarioDragRef.current.dragIdx;
                                if (dragIdx !== null && dragIdx !== idx) {
                                  const newOrder = [...diarioColOrder];
                                  const [removed] = newOrder.splice(dragIdx, 1);
                                  newOrder.splice(idx, 0, removed);
                                  setDiarioColOrder(newOrder);
                                  localStorage.setItem(DIARIO_COL_ORDER_KEY, JSON.stringify(newOrder));
                                }
                                setDiarioDragOverIdx(null);
                                diarioDragRef.current.dragIdx = null;
                              }}
                              onDragEnd={() => { setDiarioDragOverIdx(null); diarioDragRef.current.dragIdx = null; }}
                              onClick={() => handleDiarioSort(col.id)}
                              className={`px-3 py-3 font-semibold text-white text-sm whitespace-nowrap select-none cursor-pointer
                                ${col.align === 'center' ? 'text-center' : 'text-left'}
                                ${diarioDragOverIdx === idx ? 'bg-orange-700/40 border-l-2 border-white' : ''}
                                hover:bg-orange-600/40
                              `}
                            >
                              <span className="inline-flex items-center gap-1">
                                {col.label}
                                <span className="text-orange-200 text-xs">
                                  {diarioSortCol === col.id
                                    ? (diarioSortDir === 'asc' ? '▲' : '▼')
                                    : '↕'
                                  }
                                </span>
                              </span>
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {diarioSorted.map((row, rowIdx) => {
                          const horaInicio = row.horaInicio || '';
                          const horaTermino = row.horaTermino || '';
                          const statusCor = row.status === 'Realizado'
                            ? 'bg-green-100 text-green-700'
                            : 'bg-yellow-100 text-yellow-700';
                          const zebraBg = rowIdx % 2 === 0 ? 'bg-white' : 'bg-gray-50';

                          const renderDiarioCell = (colId) => {
                            switch (colId) {
                              case 'AGENDA': return row.isScheduled
                                ? <span className="font-semibold text-green-700 bg-green-100 px-2.5 py-1 rounded-full">SIM</span>
                                : <span className="font-semibold text-red-600 bg-red-100 px-2.5 py-1 rounded-full">NÃO</span>;
                              case 'COD': return <span className="text-gray-500 font-medium">{row.cod}</span>;
                              case 'FORNECEDOR': return <span className="font-semibold text-gray-900 whitespace-nowrap" title={row.fantasia}>{row.fantasia}</span>;
                              case 'TIPO_ATEND': return row.tipoAtendimento
                                ? <span className="font-medium text-rose-700 bg-rose-50 px-2 py-1 rounded whitespace-nowrap">{row.tipoAtendimento}</span>
                                : <span className="text-gray-300">-</span>;
                              case 'CLASSIFICACAO': return row.classificacao ? <span className="font-medium bg-gray-100 text-gray-600 px-2 py-1 rounded-full whitespace-nowrap" title={row.classificacao}>{row.classificacao}</span> : <span className="text-gray-300">-</span>;
                              case 'VISITA': return row.visita ? <span className="font-medium text-purple-700 bg-purple-50 px-2 py-1 rounded">{row.visita}</span> : <span className="text-gray-300">-</span>;
                              case 'H_INICIO': return horaInicio ? <span className="text-gray-700 font-medium">{horaInicio}</span> : <span className="text-gray-300">-</span>;
                              case 'H_TERMINO': return horaTermino ? <span className="text-gray-700 font-medium">{horaTermino}</span> : <span className="text-gray-300">-</span>;
                              case 'STATUS': return <span className={`font-semibold px-2.5 py-1 rounded-full ${statusCor}`}>{row.status}</span>;
                              case 'NUM_PEDIDO': return row.pedidosOracle.length > 0
                                ? <div className="flex flex-col gap-0.5">{row.pedidosOracle.map(p => <span key={p.NUM_PEDIDO} className="bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-semibold">#{p.NUM_PEDIDO}</span>)}</div>
                                : <span className="text-gray-300">-</span>;
                              case 'VAL_PEDIDO': {
                                const totalPed = row.pedidosOracle.reduce((s, p) => s + (p.VAL_TOTAL_PEDIDO || 0), 0);
                                return totalPed > 0
                                  ? <span className="font-semibold text-green-700">{formatMoney(totalPed)}</span>
                                  : <span className="text-gray-300">-</span>;
                              }
                              case 'DTA_ENTREGA': return row.pedidosOracle.length > 0
                                ? <div className="flex flex-col gap-0.5">{row.pedidosOracle.map(p => <span key={p.NUM_PEDIDO} className="font-medium text-blue-700">{p.DTA_ENTREGA || '-'}</span>)}</div>
                                : <span className="text-gray-300">-</span>;
                              case 'DEBITO': {
                                const deb = Number(row.debito) || 0;
                                return deb > 0
                                  ? <span className="font-semibold text-red-600">{formatMoney(deb)}</span>
                                  : <span className="text-gray-300">-</span>;
                              }
                              case 'PRAZO_PG': return row.prazoPg ? <span className="text-gray-700 font-medium">{row.prazoPg}</span> : <span className="text-gray-300">-</span>;
                              case 'PROX_ATEND': return row.proximoAtend
                                ? <span className="font-medium text-purple-700 bg-purple-50 px-2 py-1 rounded">{row.proximoAtend.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}</span>
                                : <span className="text-gray-300">-</span>;
                              case 'DIAS_TOTAIS': return row.diasTotais !== null
                                ? <span className={`font-semibold ${row.diasTotais > 30 ? 'text-red-600' : row.diasTotais > 14 ? 'text-amber-600' : 'text-green-600'}`}>{row.diasTotais}d</span>
                                : <span className="text-gray-300">-</span>;
                              case 'DIA_SEMANA': return <span className="text-gray-600 capitalize font-medium">{row.diaSemana}</span>;
                              case 'CONTATO': return <span className="text-gray-600 whitespace-nowrap" title={row.contato}>{row.contato || '-'}</span>;
                              case 'CELULAR': {
                                const waUrl = formatWhatsAppUrl(row.celular);
                                return row.celular && waUrl
                                  ? <a href={waUrl} target="_blank" rel="noopener noreferrer" className="text-green-600 hover:text-green-800 hover:underline font-medium whitespace-nowrap" title="Abrir WhatsApp">{row.celular} 📱</a>
                                  : <span className="text-gray-300">{row.celular || '-'}</span>;
                              }
                              case 'EMAIL': return <span className="text-gray-600 truncate max-w-[200px] inline-block" title={row.email}>{row.email || '-'}</span>;
                              default: return '-';
                            }
                          };

                          return (
                            <tr key={row.cod} className={`${zebraBg} hover:bg-gray-100 border-b border-gray-100`}>
                              {diarioColunasOrdenadas.map(col => (
                                <td key={col.id} className={`px-3 py-2.5 whitespace-nowrap ${col.align === 'center' ? 'text-center' : 'text-left'}`}>
                                  {renderDiarioCell(col.id)}
                                </td>
                              ))}
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : (
                <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-12 text-center text-gray-500">
                  <span className="text-4xl block mb-3">📦</span>
                  <p className="font-medium">Nenhum fornecedor agendado ou atendido neste dia</p>
                  <p className="text-sm mt-1">
                    {new Date(diaSelecionado + 'T12:00:00').toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                  </p>
                </div>
              )}
            </div>
          )}
          {/* ==================== MODAL: GERENCIAR OPÇÕES ==================== */}
          {showOpcoesModalRaw && (
            <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center" onClick={closeOpcoesModal}>
              <div className="bg-white rounded-xl shadow-2xl w-full max-w-md mx-4" onClick={(e) => e.stopPropagation()}>
                <div className="px-5 py-4 border-b border-gray-200 flex items-center justify-between">
                  <h3 className="text-lg font-semibold text-gray-900">
                    {showOpcoesModalRaw === 'comprador' ? 'Gerenciar Compradores' : 'Gerenciar Tipos de Atendimento'}
                  </h3>
                  <button onClick={closeOpcoesModal} className="text-gray-400 hover:text-gray-600">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"/></svg>
                  </button>
                </div>
                <div className="p-5">
                  {/* Adicionar nova opção */}
                  <div className="flex gap-2 mb-4">
                    <input
                      type="text"
                      value={novaOpcao}
                      onChange={(e) => setNovaOpcao(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter') adicionarOpcao(showOpcoesModalRaw, novaOpcao); }}
                      placeholder={showOpcoesModalRaw === 'comprador' ? 'Nome do comprador...' : 'Tipo de atendimento...'}
                      className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
                    />
                    <button
                      onClick={() => adicionarOpcao(showOpcoesModalRaw, novaOpcao)}
                      disabled={!novaOpcao.trim()}
                      className="px-4 py-2 bg-orange-500 text-white rounded-lg text-sm font-medium hover:bg-orange-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                    >
                      Adicionar
                    </button>
                  </div>

                  {/* Lista de opções existentes */}
                  <div className="space-y-1 max-h-64 overflow-y-auto">
                    {(showOpcoesModalRaw === 'comprador' ? opcoesComprador : opcoesTipoAtendimento).map(opcao => (
                      <div key={opcao.id} className="flex items-center justify-between py-2 px-3 bg-gray-50 rounded-lg group hover:bg-gray-100">
                        <span className="text-sm text-gray-700">{opcao.valor}</span>
                        <button
                          onClick={() => removerOpcao(opcao.id)}
                          className="text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all"
                          title="Remover opção"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
                        </button>
                      </div>
                    ))}
                    {(showOpcoesModalRaw === 'comprador' ? opcoesComprador : opcoesTipoAtendimento).length === 0 && (
                      <p className="text-center text-gray-400 text-sm py-4">Nenhuma opção cadastrada</p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
