import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import Layout from '../components/Layout';
import api from '../services/api';

// Denominações de cédulas possíveis (maior para menor)
const DENOMINACOES = [200, 100, 50, 20, 10, 5, 2];

// Cores das cédulas brasileiras (baseado nas notas reais)
const CEDULA_CORES = {
  200: { bg: '#E5E7EB', text: '#374151', border: '#9CA3AF', headerBg: '#D1D5DB', label: 'Cinza' },       // R$200 - cinza/prata
  100: { bg: '#CFFAFE', text: '#0E7490', border: '#06B6D4', headerBg: '#A5F3FC', label: 'Ciano' },       // R$100 - ciano/turquesa
  50:  { bg: '#FEF9C3', text: '#A16207', border: '#EAB308', headerBg: '#FEF08A', label: 'Amarelo' },     // R$50 - amarelo claro
  20:  { bg: '#FEF3C7', text: '#B45309', border: '#F59E0B', headerBg: '#FDE68A', label: 'Amarelo' },     // R$20 - amarelo vibrante/laranja
  10:  { bg: '#FFE4E6', text: '#BE123C', border: '#F43F5E', headerBg: '#FECDD3', label: 'Vermelho' },    // R$10 - vermelha
  5:   { bg: '#EDE9FE', text: '#7C3AED', border: '#8B5CF6', headerBg: '#DDD6FE', label: 'Roxo' },       // R$5 - roxo
  2:   { bg: '#DBEAFE', text: '#1D4ED8', border: '#3B82F6', headerBg: '#BFDBFE', label: 'Azul' },       // R$2 - azul
};

// Cores dos dias da semana
const DIA_SEMANA_CORES = {
  'Domingo':  { bg: '#FEE2E2', text: '#DC2626', border: '#FECACA' },  // vermelho
  'Segunda':  { bg: '#DBEAFE', text: '#2563EB', border: '#BFDBFE' },  // azul
  'Terca':    { bg: '#D1FAE5', text: '#059669', border: '#A7F3D0' },  // verde
  'Quarta':   { bg: '#EDE9FE', text: '#7C3AED', border: '#DDD6FE' },  // roxo
  'Quinta':   { bg: '#FEF3C7', text: '#D97706', border: '#FDE68A' },  // amarelo
  'Sexta':    { bg: '#FCE7F3', text: '#DB2777', border: '#FBCFE8' },  // rosa
  'Sabado':   { bg: '#E5E7EB', text: '#4B5563', border: '#D1D5DB' },  // cinza
};
const DIAS_SEMANA = ['Domingo', 'Segunda', 'Terca', 'Quarta', 'Quinta', 'Sexta', 'Sabado'];

// Feriados nacionais 2026 (adicionar conforme necessário)
const FERIADOS_2026 = [
  '2026-01-01', // Confraternização
  '2026-02-16', '2026-02-17', // Carnaval
  '2026-04-03', // Sexta-feira Santa
  '2026-04-21', // Tiradentes
  '2026-05-01', // Dia do Trabalho
  '2026-06-04', // Corpus Christi
  '2026-09-07', // Independência
  '2026-10-12', // N. Sra. Aparecida
  '2026-11-02', // Finados
  '2026-11-15', // Proclamação da República
  '2026-12-25', // Natal
];

// Calcula previsão de crédito no banco Santander
// Regras descobertas empiricamente:
// - Dia útil antes das 17h → crédito no MESMO DIA (D+0)
// - Dia útil após 17h → próximo dia útil (D+1 útil)
// - Sábado/Domingo → segunda-feira (próximo dia útil)
function calcularPrevisaoCredito(dataHoraTransacao) {
  if (!dataHoraTransacao) return null;

  const dt = new Date(dataHoraTransacao);
  const hora = dt.getUTCHours();
  const minuto = dt.getUTCMinutes();
  const horaDecimal = hora + minuto / 60;
  const diaSemana = dt.getUTCDay(); // 0=dom, 6=sab

  const CUTOFF = 17; // 17:00

  const isFeriado = (d) => {
    const str = d.toISOString().split('T')[0];
    return FERIADOS_2026.includes(str);
  };

  const isDiaUtil = (d) => {
    const dow = d.getUTCDay();
    return dow >= 1 && dow <= 5 && !isFeriado(d);
  };

  const proximoDiaUtil = (d) => {
    const next = new Date(d);
    next.setUTCDate(next.getUTCDate() + 1);
    while (!isDiaUtil(next)) {
      next.setUTCDate(next.getUTCDate() + 1);
    }
    return next;
  };

  const dataDeposito = new Date(Date.UTC(dt.getUTCFullYear(), dt.getUTCMonth(), dt.getUTCDate()));
  let dataCredito;

  if (diaSemana >= 1 && diaSemana <= 5 && !isFeriado(dataDeposito)) {
    // Dia útil
    if (horaDecimal < CUTOFF) {
      dataCredito = new Date(dataDeposito); // Mesmo dia
    } else {
      dataCredito = proximoDiaUtil(dataDeposito); // Próximo dia útil
    }
  } else {
    // Fim de semana ou feriado → próximo dia útil
    dataCredito = proximoDiaUtil(dataDeposito);
  }

  const diffMs = dataCredito - dataDeposito;
  const diffDias = Math.round(diffMs / (1000 * 60 * 60 * 24));

  return { dataCredito, diffDias };
}

// Definição de colunas base
const DEFAULT_COLUMNS = [
  { id: 'data', label: 'Data', sortable: true, align: 'left' },
  { id: 'diaSemana', label: 'Dia', sortable: true, align: 'center' },
  { id: 'hora', label: 'Hora', sortable: true, align: 'left' },
  { id: 'previsaoCredito', label: 'Credito Banco', sortable: true, align: 'center' },
  { id: 'situacao', label: 'Situacao', sortable: true, align: 'left' },
  { id: 'valor', label: 'Valor Depositado', sortable: true, align: 'right', numeric: true },
  { id: 'valorDigitado', label: 'Valor Digitado', sortable: true, align: 'right', numeric: true },
  { id: 'diferenca', label: 'Diferenca', sortable: true, align: 'right', numeric: true },
  { id: 'ced_200', label: 'R$ 200', sortable: true, align: 'center', cedula: 200 },
  { id: 'ced_100', label: 'R$ 100', sortable: true, align: 'center', cedula: 100 },
  { id: 'ced_50', label: 'R$ 50', sortable: true, align: 'center', cedula: 50 },
  { id: 'ced_20', label: 'R$ 20', sortable: true, align: 'center', cedula: 20 },
  { id: 'ced_10', label: 'R$ 10', sortable: true, align: 'center', cedula: 10 },
  { id: 'ced_5', label: 'R$ 5', sortable: true, align: 'center', cedula: 5 },
  { id: 'ced_2', label: 'R$ 2', sortable: true, align: 'center', cedula: 2 },
  { id: 'nsuTransacao', label: 'NSU', sortable: true, align: 'right' },
];

export default function ExtratoBanco24h() {
  const [loading, setLoading] = useState(true);
  const [depositos, setDepositos] = useState([]);
  const [totais, setTotais] = useState({
    totalDepositos: 0, totalValor: 0, totalDigitado: 0, diferenca: 0,
    qtdConcluidos: 0, valorConcluidos: 0, qtdRegularizados: 0, valorRegularizados: 0
  });
  const [error, setError] = useState(null);
  const [sortConfig, setSortConfig] = useState({ key: 'data', direction: 'desc' });
  const [columns, setColumns] = useState(() => {
    try {
      const saved = localStorage.getItem('banco24h_column_order');
      if (saved) {
        const savedIds = JSON.parse(saved);
        // Reconstruir colunas na ordem salva, usando dados atuais de DEFAULT_COLUMNS
        const colMap = {};
        DEFAULT_COLUMNS.forEach(c => { colMap[c.id] = c; });
        const restored = savedIds
          .filter(id => colMap[id])
          .map(id => colMap[id]);
        // Adicionar colunas novas que não existiam quando o usuário salvou
        DEFAULT_COLUMNS.forEach(c => {
          if (!savedIds.includes(c.id)) restored.push(c);
        });
        if (restored.length === DEFAULT_COLUMNS.length) return restored;
      }
    } catch (e) { /* ignore */ }
    return DEFAULT_COLUMNS;
  });
  const [draggedCol, setDraggedCol] = useState(null);
  const [dragOverCol, setDragOverCol] = useState(null);

  const hoje = new Date();
  const primeiroDiaMes = new Date(hoje.getFullYear(), hoje.getMonth(), 1);

  const [filters, setFilters] = useState({
    dataInicial: primeiroDiaMes.toISOString().split('T')[0],
    dataFinal: hoje.toISOString().split('T')[0]
  });

  const fetchDepositos = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get('/banco24horas/depositos', {
        params: { dataInicial: filters.dataInicial, dataFinal: filters.dataFinal },
        timeout: 60000
      });
      setDepositos(res.data.depositos || []);
      setTotais(res.data.totais || {});
    } catch (err) {
      console.error('Erro ao buscar depósitos:', err);
      setError(err.response?.data?.details || err.message || 'Erro ao buscar depósitos');
      setDepositos([]);
    } finally {
      setLoading(false);
    }
  }, [filters.dataInicial, filters.dataFinal]);

  useEffect(() => { fetchDepositos(); }, [fetchDepositos]);

  // Detectar quais denominações existem nos dados
  const denominacoesPresentes = useMemo(() => {
    const set = new Set();
    depositos.forEach(d => {
      (d.quantidadeCedulas || []).forEach(c => set.add(c.denominacao));
    });
    return DENOMINACOES.filter(d => set.has(d));
  }, [depositos]);

  // Filtrar colunas: só mostrar cédulas que existem nos dados
  const visibleColumns = useMemo(() => {
    return columns.filter(col => {
      if (col.cedula) return denominacoesPresentes.includes(col.cedula);
      return true;
    });
  }, [columns, denominacoesPresentes]);

  // Helper: extrair quantidade de cédula de um depósito
  const getCedulaQtd = (dep, denominacao) => {
    const ced = (dep.quantidadeCedulas || []).find(c => c.denominacao === denominacao);
    return ced ? ced.quantidade : 0;
  };

  // Agrupar por dia
  const depositosPorDia = useMemo(() => {
    const map = {};
    depositos.forEach(d => {
      const data = d.dataHoraTransacao?.split('T')[0] || 'sem-data';
      if (!map[data]) map[data] = [];
      map[data].push(d);
    });
    return map;
  }, [depositos]);

  // Ordenação genérica
  const depositosOrdenados = useMemo(() => {
    if (!sortConfig.key) return depositos;
    return [...depositos].sort((a, b) => {
      let aVal, bVal;
      const key = sortConfig.key;

      if (key === 'data') {
        aVal = a.dataHoraTransacao?.split('T')[0] || '';
        bVal = b.dataHoraTransacao?.split('T')[0] || '';
      } else if (key === 'diaSemana') {
        aVal = a.dataHoraTransacao ? new Date(a.dataHoraTransacao).getUTCDay() : 0;
        bVal = b.dataHoraTransacao ? new Date(b.dataHoraTransacao).getUTCDay() : 0;
        return sortConfig.direction === 'asc' ? aVal - bVal : bVal - aVal;
      } else if (key === 'hora') {
        aVal = a.dataHoraTransacao?.split('T')[1]?.substring(0, 5) || '';
        bVal = b.dataHoraTransacao?.split('T')[1]?.substring(0, 5) || '';
      } else if (key === 'valor' || key === 'valorDigitado') {
        aVal = a[key] || 0;
        bVal = b[key] || 0;
        return sortConfig.direction === 'asc' ? aVal - bVal : bVal - aVal;
      } else if (key === 'diferenca') {
        aVal = (a.valorDigitado || 0) - a.valor;
        bVal = (b.valorDigitado || 0) - b.valor;
        return sortConfig.direction === 'asc' ? aVal - bVal : bVal - aVal;
      } else if (key === 'previsaoCredito') {
        const pA = calcularPrevisaoCredito(a.dataHoraTransacao);
        const pB = calcularPrevisaoCredito(b.dataHoraTransacao);
        aVal = pA ? pA.diffDias : 999;
        bVal = pB ? pB.diffDias : 999;
        return sortConfig.direction === 'asc' ? aVal - bVal : bVal - aVal;
      } else if (key === 'situacao') {
        aVal = a.situacao || '';
        bVal = b.situacao || '';
      } else if (key === 'nsuTransacao') {
        aVal = a.nsuTransacao || 0;
        bVal = b.nsuTransacao || 0;
        return sortConfig.direction === 'asc' ? aVal - bVal : bVal - aVal;
      } else if (key.startsWith('ced_')) {
        const denom = parseInt(key.split('_')[1]);
        aVal = getCedulaQtd(a, denom);
        bVal = getCedulaQtd(b, denom);
        return sortConfig.direction === 'asc' ? aVal - bVal : bVal - aVal;
      } else {
        return 0;
      }

      if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    });
  }, [depositos, sortConfig]);

  const handleSort = (key) => {
    setSortConfig(prev => ({
      key,
      direction: prev.key === key && prev.direction === 'desc' ? 'asc' : 'desc'
    }));
  };

  // Drag & Drop de colunas
  const handleDragStart = (e, colId) => {
    setDraggedCol(colId);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e, colId) => {
    e.preventDefault();
    if (colId !== draggedCol) setDragOverCol(colId);
  };

  const handleDrop = (e, targetColId) => {
    e.preventDefault();
    if (!draggedCol || draggedCol === targetColId) return;

    setColumns(prev => {
      const newCols = [...prev];
      const fromIdx = newCols.findIndex(c => c.id === draggedCol);
      const toIdx = newCols.findIndex(c => c.id === targetColId);
      const [moved] = newCols.splice(fromIdx, 1);
      newCols.splice(toIdx, 0, moved);
      try { localStorage.setItem('banco24h_column_order', JSON.stringify(newCols.map(c => c.id))); } catch(e) {}
      return newCols;
    });
    setDraggedCol(null);
    setDragOverCol(null);
  };

  const handleDragEnd = () => {
    setDraggedCol(null);
    setDragOverCol(null);
  };

  const SortIcon = ({ columnKey }) => {
    if (sortConfig.key !== columnKey) {
      return (
        <svg className="w-3 h-3 text-gray-400 ml-1 inline" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4"/>
        </svg>
      );
    }
    return sortConfig.direction === 'asc' ? (
      <svg className="w-3 h-3 text-orange-500 ml-1 inline" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 15l7-7 7 7"/>
      </svg>
    ) : (
      <svg className="w-3 h-3 text-orange-500 ml-1 inline" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"/>
      </svg>
    );
  };

  const formatCentavos = (centavos) => {
    const reais = (centavos || 0) / 100;
    return reais.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  };

  const formatDateTime = (dt) => {
    if (!dt) return '-';
    const [date, time] = dt.split('T');
    const [y, m, d] = date.split('-');
    const hora = time ? time.substring(0, 5) : '';
    return `${d}/${m} ${hora}`;
  };

  const formatDate = (dt) => {
    if (!dt) return '-';
    const [y, m, d] = dt.split('-');
    return `${d}/${m}/${y}`;
  };

  // Renderizar célula conforme a coluna
  const renderCell = (dep, col) => {
    const diff = (dep.valorDigitado || 0) - dep.valor;
    const isConcluida = dep.situacao === 'Concluida';

    switch (col.id) {
      case 'data': {
        if (!dep.dataHoraTransacao) return '-';
        const [y, m, d] = dep.dataHoraTransacao.split('T')[0].split('-');
        return <span className="font-semibold text-gray-700 whitespace-nowrap">{d}/{m}/{y}</span>;
      }

      case 'diaSemana': {
        if (!dep.dataHoraTransacao) return '-';
        const dt = new Date(dep.dataHoraTransacao);
        const dia = DIAS_SEMANA[dt.getUTCDay()];
        const cores = DIA_SEMANA_CORES[dia] || {};
        return (
          <span className="inline-flex items-center justify-center px-2.5 py-1 rounded-full text-xs font-bold whitespace-nowrap"
            style={{ backgroundColor: cores.bg, color: cores.text, border: `1.5px solid ${cores.border}` }}>
            {dia}
          </span>
        );
      }

      case 'hora': {
        if (!dep.dataHoraTransacao) return '-';
        const hora = dep.dataHoraTransacao.split('T')[1]?.substring(0, 5) || '';
        return <span className="font-medium text-gray-500 whitespace-nowrap">{hora}</span>;
      }

      case 'previsaoCredito': {
        const previsao = calcularPrevisaoCredito(dep.dataHoraTransacao);
        if (!previsao) return '-';
        const { dataCredito, diffDias } = previsao;
        const dc = dataCredito;
        const diaCredStr = String(dc.getUTCDate()).padStart(2, '0') + '/' + String(dc.getUTCMonth() + 1).padStart(2, '0');
        const diaSemCredito = DIAS_SEMANA[dc.getUTCDay()];
        const coresDia = DIA_SEMANA_CORES[diaSemCredito] || {};

        let label, bgClass, textClass;
        if (diffDias === 0) {
          label = 'Mesmo dia';
          bgClass = 'bg-green-100 border-green-300';
          textClass = 'text-green-700';
        } else if (diffDias === 1) {
          label = 'Dia seguinte';
          bgClass = 'bg-blue-100 border-blue-300';
          textClass = 'text-blue-700';
        } else {
          label = diffDias + ' dias depois';
          bgClass = 'bg-amber-100 border-amber-300';
          textClass = 'text-amber-700';
        }

        return (
          <span className="inline-flex flex-col items-center gap-0.5">
            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold border ${bgClass} ${textClass}`}>
              {label}
            </span>
            <span className="text-xs font-semibold" style={{ color: coresDia.text }}>
              {diaSemCredito} {diaCredStr}
            </span>
          </span>
        );
      }

      case 'situacao':
        return (
          <span className="inline-flex flex-col">
            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
              isConcluida ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'
            }`}>
              {isConcluida ? (
                <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"/></svg>
              ) : (
                <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd"/></svg>
              )}
              {dep.situacao}
            </span>
            {dep.dataRegularizacao && (
              <span className="text-xs text-gray-400 mt-0.5">({formatDate(dep.dataRegularizacao)})</span>
            )}
          </span>
        );

      case 'valor':
        return <span className="font-bold text-green-600 whitespace-nowrap">{formatCentavos(dep.valor)}</span>;

      case 'valorDigitado':
        return <span className="text-gray-600 whitespace-nowrap">{dep.valorDigitado != null ? formatCentavos(dep.valorDigitado) : '-'}</span>;

      case 'diferenca':
        return (
          <span className={`font-medium whitespace-nowrap ${diff === 0 ? 'text-gray-400' : diff > 0 ? 'text-amber-600' : 'text-red-600'}`}>
            {dep.valorDigitado != null ? (diff === 0 ? '-' : formatCentavos(diff)) : '-'}
          </span>
        );

      case 'nsuTransacao':
        return (
          <span className="inline-flex items-center justify-center px-2.5 py-1 rounded-full bg-orange-100 border border-orange-300 text-orange-700 font-mono font-bold text-xs whitespace-nowrap">
            {dep.nsuTransacao}
          </span>
        );

      default:
        // Colunas de cédulas (ced_200, ced_100, etc.)
        if (col.cedula) {
          const qtd = getCedulaQtd(dep, col.cedula);
          if (qtd === 0) return <span className="text-gray-300">-</span>;
          const total = qtd * col.cedula * 100; // em centavos
          const cores = CEDULA_CORES[col.cedula] || { text: '#374151' };
          return (
            <span className="inline-flex flex-col items-center">
              <span className="text-base font-extrabold" style={{ color: cores.text }}>{qtd}</span>
              <span className="font-bold" style={{ color: cores.text, fontSize: '12px' }}>{formatCentavos(total)}</span>
            </span>
          );
        }
        return '-';
    }
  };

  const totalColSpan = visibleColumns.length;

  return (
    <Layout>
      <div className="p-4 md:p-6">
        {/* Header laranja */}
        <div className="bg-gradient-to-r from-orange-500 to-amber-500 rounded-xl p-5 mb-6 text-white shadow-lg">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-3">
              <div className="bg-white/20 rounded-lg p-2.5">
                <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z"/>
                </svg>
              </div>
              <div>
                <h1 className="text-xl md:text-2xl font-bold">Depositos - Banco 24horas</h1>
                <p className="text-white/80 text-sm">ATM Coletora | Loja 50113 - SUP TRADICAO</p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-white/70 text-xs uppercase tracking-wider">Total no Periodo</p>
              {loading ? (
                <div className="animate-pulse bg-white/20 h-8 w-40 rounded mt-1"></div>
              ) : (
                <p className="text-2xl md:text-3xl font-bold">{formatCentavos(totais.totalValor)}</p>
              )}
            </div>
          </div>
        </div>

        {/* Cards de resumo */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
          <div className="bg-white rounded-xl p-4 shadow-sm border border-green-200">
            <div className="flex items-center gap-2 mb-1">
              <div className="w-2 h-2 bg-green-500 rounded-full"></div>
              <p className="text-xs text-gray-500 uppercase">Valor Depositado</p>
            </div>
            <p className="text-lg font-bold text-green-600">{formatCentavos(totais.totalValor)}</p>
            <p className="text-xs text-gray-400">{totais.totalDepositos} depositos</p>
          </div>
          <div className="bg-white rounded-xl p-4 shadow-sm border border-blue-200">
            <div className="flex items-center gap-2 mb-1">
              <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
              <p className="text-xs text-gray-500 uppercase">Valor Digitado</p>
            </div>
            <p className="text-lg font-bold text-blue-600">{formatCentavos(totais.totalDigitado)}</p>
            <p className="text-xs text-gray-400">informado pelo operador</p>
          </div>
          <div className={`rounded-xl p-4 shadow-sm border ${totais.diferenca !== 0 ? 'border-amber-300 bg-amber-50' : 'border-gray-200 bg-white'}`}>
            <div className="flex items-center gap-2 mb-1">
              <div className={`w-2 h-2 rounded-full ${totais.diferenca !== 0 ? 'bg-amber-500' : 'bg-gray-400'}`}></div>
              <p className="text-xs text-gray-500 uppercase">Diferenca</p>
            </div>
            <p className={`text-lg font-bold ${totais.diferenca !== 0 ? 'text-amber-600' : 'text-gray-500'}`}>
              {formatCentavos(totais.diferenca)}
            </p>
            <p className="text-xs text-gray-400">digitado - depositado</p>
          </div>
          <div className="bg-white rounded-xl p-4 shadow-sm border border-green-200">
            <div className="flex items-center gap-2 mb-1">
              <svg className="w-3.5 h-3.5 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"/>
              </svg>
              <p className="text-xs text-gray-500 uppercase">Concluidos</p>
            </div>
            <p className="text-lg font-bold text-green-600">{totais.qtdConcluidos || 0}</p>
            <p className="text-xs text-gray-400">{formatCentavos(totais.valorConcluidos)}</p>
          </div>
          <div className="bg-white rounded-xl p-4 shadow-sm border border-orange-200">
            <div className="flex items-center gap-2 mb-1">
              <svg className="w-3.5 h-3.5 text-orange-500" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd"/>
              </svg>
              <p className="text-xs text-gray-500 uppercase">Regularizados</p>
            </div>
            <p className="text-lg font-bold text-orange-600">{totais.qtdRegularizados || 0}</p>
            <p className="text-xs text-gray-400">{formatCentavos(totais.valorRegularizados)}</p>
          </div>
        </div>

        {/* Filtros */}
        <div className="bg-white rounded-xl p-4 mb-4 shadow-sm border border-gray-100">
          <div className="flex flex-wrap items-end gap-3">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Data Inicio</label>
              <input type="date" value={filters.dataInicial}
                onChange={(e) => setFilters(f => ({ ...f, dataInicial: e.target.value }))}
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500" />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Data Fim</label>
              <input type="date" value={filters.dataFinal}
                onChange={(e) => setFilters(f => ({ ...f, dataFinal: e.target.value }))}
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500" />
            </div>
            <button onClick={fetchDepositos} disabled={loading}
              className="bg-orange-500 text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-orange-600 transition-colors flex items-center gap-2 disabled:opacity-50">
              {loading ? (
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                </svg>
              ) : (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
                </svg>
              )}
              Consultar
            </button>
            {loading && <span className="text-xs text-orange-600 animate-pulse">Buscando depositos...</span>}
          </div>
        </div>

        {/* Erro */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-4">
            <p className="text-red-700 text-sm font-medium">Erro: {error}</p>
            <p className="text-red-500 text-xs mt-1">Verifique as configuracoes do Banco 24horas em Configuracoes do sistema.</p>
          </div>
        )}

        {/* Tabela de depositos */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto" style={{ maxHeight: '65vh', overflowY: 'auto' }}>
            <table className="w-full">
              <thead className="sticky top-0 z-10">
                {/* Linha de grupo: Cedulas */}
                <tr className="bg-gray-100 border-b border-gray-200">
                  {visibleColumns.map(col => (
                    col.cedula ? null : <th key={col.id} rowSpan={2}
                      draggable
                      onDragStart={(e) => handleDragStart(e, col.id)}
                      onDragOver={(e) => handleDragOver(e, col.id)}
                      onDrop={(e) => handleDrop(e, col.id)}
                      onDragEnd={handleDragEnd}
                      onClick={() => col.sortable && handleSort(col.id)}
                      className={`px-3 py-2.5 text-xs font-semibold text-gray-600 uppercase select-none
                        ${col.sortable ? 'cursor-pointer hover:text-orange-600' : ''}
                        ${col.align === 'right' ? 'text-right' : col.align === 'center' ? 'text-center' : 'text-left'}
                        ${dragOverCol === col.id ? 'bg-orange-100' : 'bg-gray-50'}
                        ${col.id === 'nsuTransacao' ? 'border-l-2 border-l-gray-300' : ''}
                      `}
                      style={{ cursor: 'grab' }}
                    >
                      <span className="inline-flex items-center gap-0.5">
                        <svg className="w-2.5 h-2.5 text-gray-300 mr-1" fill="currentColor" viewBox="0 0 20 20">
                          <circle cx="6" cy="4" r="1.5"/><circle cx="14" cy="4" r="1.5"/>
                          <circle cx="6" cy="10" r="1.5"/><circle cx="14" cy="10" r="1.5"/>
                          <circle cx="6" cy="16" r="1.5"/><circle cx="14" cy="16" r="1.5"/>
                        </svg>
                        {col.label}
                        {col.sortable && <SortIcon columnKey={col.id} />}
                      </span>
                    </th>
                  ))}
                  {/* Grupo Cédulas */}
                  {denominacoesPresentes.length > 0 && (
                    <th colSpan={denominacoesPresentes.length}
                      className="px-3 py-1.5 text-xs font-bold text-orange-700 uppercase text-center bg-orange-50 border-b border-orange-200">
                      Cedulas
                    </th>
                  )}
                </tr>
                {/* Sub-headers das cedulas - com cores das notas reais */}
                {denominacoesPresentes.length > 0 && (
                  <tr className="border-b border-gray-200">
                    {visibleColumns.filter(c => c.cedula).map(col => {
                      const cores = CEDULA_CORES[col.cedula] || {};
                      return (
                        <th key={col.id}
                          draggable
                          onDragStart={(e) => handleDragStart(e, col.id)}
                          onDragOver={(e) => handleDragOver(e, col.id)}
                          onDrop={(e) => handleDrop(e, col.id)}
                          onDragEnd={handleDragEnd}
                          onClick={() => handleSort(col.id)}
                          className="px-2 py-2 text-sm font-bold text-center cursor-pointer select-none whitespace-nowrap"
                          style={{
                            backgroundColor: cores.headerBg || '#FEF08A',
                            color: cores.text || '#374151',
                            borderBottom: `3px solid ${cores.border || '#EAB308'}`,
                          }}
                        >
                          <div className="flex flex-col items-center">
                            <span className="text-sm font-extrabold">{col.label}</span>
                            <SortIcon columnKey={col.id} />
                          </div>
                        </th>
                      );
                    })}
                  </tr>
                )}
              </thead>
              <tbody className="divide-y divide-gray-100">
                {loading ? (
                  Array.from({ length: 10 }).map((_, i) => (
                    <tr key={i}>
                      <td colSpan={totalColSpan} className="px-3 py-2.5">
                        <div className="animate-pulse flex gap-3">
                          <div className="bg-gray-200 h-3.5 w-20 rounded"></div>
                          <div className="bg-gray-200 h-3.5 w-16 rounded"></div>
                          <div className="bg-gray-200 h-3.5 flex-1 rounded"></div>
                          <div className="bg-gray-200 h-3.5 w-24 rounded"></div>
                        </div>
                      </td>
                    </tr>
                  ))
                ) : depositosOrdenados.length === 0 ? (
                  <tr>
                    <td colSpan={totalColSpan} className="px-3 py-12 text-center text-gray-400 text-sm">
                      Nenhum deposito encontrado no periodo
                    </td>
                  </tr>
                ) : (
                  depositosOrdenados.map((dep, idx) => (
                    <tr key={idx} className="hover:bg-gray-50 transition-colors">
                      {visibleColumns.map(col => {
                        const cedulaCor = col.cedula ? CEDULA_CORES[col.cedula] : null;
                        return (
                          <td key={col.id}
                            className={`px-3 py-2 text-sm
                              ${col.align === 'right' ? 'text-right' : col.align === 'center' ? 'text-center' : 'text-left'}
                              ${col.id === 'nsuTransacao' ? 'border-l-2 border-l-gray-200' : ''}
                            `}
                            style={cedulaCor ? { backgroundColor: cedulaCor.bg + '60' } : undefined}
                          >
                            {renderCell(dep, col)}
                          </td>
                        );
                      })}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Rodape da tabela */}
          {!loading && depositosOrdenados.length > 0 && (
            <div className="bg-gray-50 px-4 py-3 border-t border-gray-200 flex flex-wrap justify-between items-center gap-3">
              <span className="text-xs text-gray-500">{depositosOrdenados.length} depositos no periodo</span>
              <div className="flex items-center gap-4">
                <span className="text-xs text-gray-500">
                  Depositado: <strong className="text-green-600">{formatCentavos(totais.totalValor)}</strong>
                </span>
                <span className="text-xs text-gray-500">
                  Digitado: <strong className="text-blue-600">{formatCentavos(totais.totalDigitado)}</strong>
                </span>
                {totais.diferenca !== 0 && (
                  <span className="text-xs text-gray-500">
                    Dif: <strong className="text-amber-600">{formatCentavos(totais.diferenca)}</strong>
                  </span>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Resumo por dia */}
        {!loading && Object.keys(depositosPorDia).length > 1 && (
          <div className="mt-4 bg-gray-800 rounded-xl p-4 text-white">
            <p className="text-xs text-gray-400 uppercase mb-3 font-semibold">Resumo por Dia</p>
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-2">
              {Object.entries(depositosPorDia)
                .sort(([a], [b]) => a.localeCompare(b))
                .map(([data, deps]) => {
                  const totalDia = deps.reduce((s, d) => s + d.valor, 0);
                  const [y, m, d] = data.split('-');
                  return (
                    <div key={data} className="bg-gray-700/50 rounded-lg p-2.5">
                      <p className="text-xs text-gray-400">{d}/{m}</p>
                      <p className="text-sm font-bold text-green-400">{formatCentavos(totalDia)}</p>
                      <p className="text-xs text-gray-500">{deps.length} dep.</p>
                    </div>
                  );
                })}
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
