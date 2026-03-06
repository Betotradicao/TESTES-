import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useLoja } from '../contexts/LojaContext';
import Sidebar from '../components/Sidebar';
import { api } from '../utils/api';
import toast from 'react-hot-toast';
import RadarLoading from '../components/RadarLoading';
import { getCamerasRisco, getLiveStreamUrl } from '../services/dvr-cftv.service';

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

// Formatar segundos para mm:ss ou hh:mm:ss
function formatDuration(totalSec) {
  if (!totalSec || !isFinite(totalSec)) return '--:--';
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = Math.floor(totalSec % 60);
  if (h > 0) return `${h}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
  return `${m}:${String(s).padStart(2,'0')}`;
}

// Modal de video DVR para cancelamentos (stream direto, autoplay)
function VideoModal({ item, cameras, onClose }) {
  const [durations, setDurations] = useState({});

  // Converter DATA (DD/MM/YYYY) + HORA (HH:MM) para formato DVR
  const parts = (item.DATA || '').split('/');
  const hora = item.HORA || '00:00';
  const timeStr = parts.length === 3
    ? `${parts[2]}-${parts[1]}-${parts[0]} ${hora}:00`
    : `${new Date().toISOString().slice(0, 10)} ${hora}:00`;

  // Usa antes/depois de cada camera (config Prev. Risco)
  const streamUrls = useRef(cameras.map(cam =>
    getLiveStreamUrl(cam.channel, timeStr, Number(cam.antes) || 20, Number(cam.depois) || 60)
  ));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-2xl max-w-5xl w-full mx-4 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 bg-gradient-to-r from-purple-600 to-purple-500">
          <div>
            <h3 className="text-lg font-semibold text-white flex items-center gap-2">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
              Video do Cancelamento
            </h3>
            <p className="text-sm text-purple-100 mt-1">
              {item.DES_PRODUTO || 'Cancelamento'} - PDV {item.NUM_PDV} - {item.DATA} {item.HORA}
              {item.DES_OPERADOR && ` | ${item.DES_OPERADOR}`}
            </p>
          </div>
          <button onClick={onClose} className="p-2 text-white/70 hover:text-white hover:bg-white/20 rounded-full transition-colors">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Video Grid */}
        <div className={`p-6 grid gap-4 ${cameras.length === 1 ? 'grid-cols-1' : 'grid-cols-1 md:grid-cols-2'}`}>
          {cameras.map((cam, idx) => {
            const antes = Number(cam.antes) || 20;
            const depois = Number(cam.depois) || 60;
            const configTotal = antes + depois;
            return (
              <div key={cam.channel} className="bg-gray-900 rounded-lg overflow-hidden">
                <div className="px-3 py-2 bg-gray-800 text-white text-sm font-medium flex items-center gap-2">
                  <svg className="w-4 h-4 text-green-400" fill="currentColor" viewBox="0 0 24 24">
                    <circle cx="12" cy="12" r="5" />
                  </svg>
                  <span>{cam.label || `Canal ${cam.channel}`} - PDV {cam.pdv}</span>
                  <span className="ml-auto text-xs text-gray-400">
                    Config: {antes}s antes + {depois}s depois = {configTotal}s
                    {durations[idx] ? ` | Duracao real: ${formatDuration(durations[idx])}` : ''}
                  </span>
                </div>
                <video
                  src={streamUrls.current[idx]}
                  autoPlay
                  controls
                  className="w-full aspect-video bg-black"
                  onLoadedMetadata={(e) => {
                    const dur = e.target.duration;
                    if (dur && isFinite(dur)) setDurations(prev => ({ ...prev, [idx]: dur }));
                  }}
                  onDurationChange={(e) => {
                    const dur = e.target.duration;
                    if (dur && isFinite(dur)) setDurations(prev => ({ ...prev, [idx]: dur }));
                  }}
                />
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export default function VisionOperacoesRisco() {
  const { user, logout } = useAuth();
  const { lojaSelecionada } = useLoja();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);

  const [loading, setLoading] = useState(false);
  const [cancelamentos, setCancelamentos] = useState([]);
  const [resumo, setResumo] = useState({
    TOTAL_ITENS: 0, VALOR_ITENS: 0,
    TOTAL_CUPONS: 0, VALOR_CUPONS: 0,
    TOTAL_VENDAS: 0, VALOR_VENDAS: 0,
  });
  const [descontos, setDescontos] = useState({ TOTAL_ITENS_DESC: 0, VALOR_TOTAL_DESC: 0, TOTAL_CUPONS_DESC: 0 });
  const [itensDesconto, setItensDesconto] = useState([]);
  const [operadores, setOperadores] = useState([]);
  const [loadingFilters, setLoadingFilters] = useState(true);
  const [camerasRisco, setCamerasRisco] = useState([]);
  const [videoItem, setVideoItem] = useState(null);

  const [filters, setFilters] = useState({
    dataInicio: formatDateForInput(new Date()),
    dataFim: formatDateForInput(new Date()),
    tipo: '',
    codOperador: '',
    numPdv: '',
  });

  const [sortConfig, setSortConfig] = useState({ key: null, direction: 'asc' });
  const [expandedGroups, setExpandedGroups] = useState({});
  const [dragCol, setDragCol] = useState(null);
  const [columnOrder, setColumnOrder] = useState([
    'TIPO', 'DATA', 'HORA', 'COO', 'NUM_PDV', 'DES_OPERADOR', 'DES_FISCAL', 'COD_PRODUTO', 'DES_PRODUTO', 'VALOR'
  ]);

  // Definição de colunas para drag-and-drop
  const COLUMN_DEFS = {
    TIPO: { label: 'Tipo', sortKey: 'TIPO', align: 'text-left' },
    DATA: { label: 'Data', sortKey: 'DATA', align: 'text-left' },
    HORA: { label: 'Hora', sortKey: 'HORA', align: 'text-center' },
    COO: { label: 'COO', sortKey: 'COO', align: 'text-left' },
    NUM_PDV: { label: 'PDV', sortKey: 'NUM_PDV', align: 'text-center' },
    DES_OPERADOR: { label: 'Operador', sortKey: 'DES_OPERADOR', align: 'text-left' },
    DES_FISCAL: { label: 'Fiscal', sortKey: 'DES_FISCAL', align: 'text-left' },
    COD_PRODUTO: { label: 'Codigo', sortKey: 'COD_PRODUTO', align: 'text-left' },
    DES_PRODUTO: { label: 'Produto', sortKey: 'DES_PRODUTO', align: 'text-left' },
    VALOR: { label: 'Valor', sortKey: 'VALOR', align: 'text-right' },
  };

  const handleDragStart = (colId) => setDragCol(colId);
  const handleDragOver = (e) => e.preventDefault();
  const handleDrop = (targetColId) => {
    if (!dragCol || dragCol === targetColId) return;
    setColumnOrder(prev => {
      const arr = [...prev];
      const fromIdx = arr.indexOf(dragCol);
      const toIdx = arr.indexOf(targetColId);
      arr.splice(fromIdx, 1);
      arr.splice(toIdx, 0, dragCol);
      return arr;
    });
    setDragCol(null);
  };

  // Renderizar celula da linha principal por coluna
  const renderMainCell = (colId, first, items, isMultiple, tipo, totalValor) => {
    switch (colId) {
      case 'TIPO': return (
        <div className="flex items-center gap-1.5">
          {isMultiple && (
            <button onClick={(e) => toggleGroup(first._groupKey, e)} className="w-5 h-5 rounded flex items-center justify-center bg-orange-100 text-orange-600 hover:bg-orange-200 transition-colors text-xs font-bold flex-shrink-0">
              {expandedGroups[first._groupKey] ? '-' : '+'}
            </button>
          )}
          {renderTipoBadge(first.TIPO)}
          {isMultiple && (
            <span className="text-[10px] bg-orange-500 text-white px-1.5 py-0.5 rounded-full font-bold">{items.length}</span>
          )}
        </div>
      );
      case 'DATA': return first.DATA || '-';
      case 'HORA': return first.HORA || '-';
      case 'COO': return first.COO || '-';
      case 'NUM_PDV': return first.NUM_PDV || '-';
      case 'DES_OPERADOR': return first.DES_OPERADOR || first.COD_OPERADOR || '-';
      case 'DES_FISCAL': return first.DES_FISCAL || '-';
      case 'COD_PRODUTO': return isMultiple ? '-' : (tipo === 'ITEM' || tipo === 'VENDA' || tipo === 'DESCONTO') ? first.COD_PRODUTO || '-' : '-';
      case 'DES_PRODUTO': return isMultiple
        ? <span className="text-gray-500 italic">{items.length} itens cancelados</span>
        : (tipo === 'ITEM' || tipo === 'VENDA' || tipo === 'DESCONTO') ? first.DES_PRODUTO || '-' : '-';
      case 'VALOR': return isMultiple ? formatCurrency(totalValor) : formatCurrency(first.VALOR);
      default: return '-';
    }
  };

  // Renderizar celula da linha expandida por coluna
  const renderExpandedCell = (colId, item, subTipo) => {
    switch (colId) {
      case 'TIPO': return renderTipoBadge(item.TIPO);
      case 'DATA': return item.DATA || '-';
      case 'HORA': return item.HORA || '-';
      case 'COO': return item.COO || '-';
      case 'NUM_PDV': return item.NUM_PDV || '-';
      case 'DES_OPERADOR': return item.DES_OPERADOR || item.COD_OPERADOR || '-';
      case 'DES_FISCAL': return item.DES_FISCAL || '-';
      case 'COD_PRODUTO': return (subTipo === 'ITEM' || subTipo === 'VENDA' || subTipo === 'DESCONTO') ? item.COD_PRODUTO || '-' : '-';
      case 'DES_PRODUTO': return (subTipo === 'ITEM' || subTipo === 'VENDA' || subTipo === 'DESCONTO') ? item.DES_PRODUTO || '-' : '-';
      case 'VALOR': return formatCurrency(item.VALOR);
      default: return '-';
    }
  };

  // Classes extras por coluna para a linha principal
  const getMainCellClass = (colId) => {
    const base = 'px-4 py-3 whitespace-nowrap';
    switch (colId) {
      case 'TIPO': return base;
      case 'HORA': case 'NUM_PDV': return `${base} text-center text-gray-700 font-mono`;
      case 'COO': return `${base} text-gray-700 font-mono`;
      case 'COD_PRODUTO': return `${base} text-gray-700 font-mono text-xs`;
      case 'DES_PRODUTO': return 'px-4 py-3 text-gray-700 max-w-[250px] truncate';
      case 'VALOR': return `${base} text-right font-medium text-gray-900`;
      default: return `${base} text-gray-700`;
    }
  };

  // Classes extras por coluna para a linha expandida
  const getExpandedCellClass = (colId) => {
    const base = 'px-4 py-2 whitespace-nowrap text-gray-600 text-xs';
    switch (colId) {
      case 'TIPO': return 'px-4 py-2 pl-10 whitespace-nowrap';
      case 'HORA': case 'NUM_PDV': return `${base} text-center font-mono`;
      case 'COO': return `${base} font-mono`;
      case 'COD_PRODUTO': return `${base} font-mono`;
      case 'DES_PRODUTO': return 'px-4 py-2 text-gray-600 max-w-[250px] truncate text-xs';
      case 'VALOR': return 'px-4 py-2 whitespace-nowrap text-right font-medium text-gray-700 text-xs';
      default: return base;
    }
  };

  const totalCancelamentos = (resumo.TOTAL_ITENS || 0) + (resumo.TOTAL_CUPONS || 0) + (resumo.TOTAL_VENDAS || 0);

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
    getCamerasRisco().then(res => {
      if (res.success) setCamerasRisco(res.cameras || []);
    }).catch(() => {});
  }, [lojaSelecionada]);

  const handleSearch = async () => {
    setLoading(true);
    try {
      const baseParams = new URLSearchParams();
      baseParams.append('dataInicio', toApiDate(filters.dataInicio));
      baseParams.append('dataFim', toApiDate(filters.dataFim));
      if (lojaSelecionada) baseParams.append('codLoja', lojaSelecionada);

      const cancParams = new URLSearchParams(baseParams);
      if (filters.codOperador) cancParams.append('codOperador', filters.codOperador);
      if (filters.numPdv) cancParams.append('numPdv', filters.numPdv);

      const [resumoRes, cancRes, descRes, itensDescRes] = await Promise.all([
        api.get(`/prevencao-caixa/resumo?${baseParams.toString()}`),
        api.get(`/prevencao-caixa/cancelamentos?${cancParams.toString()}`),
        api.get(`/prevencao-caixa/descontos?${baseParams.toString()}`),
        api.get(`/prevencao-caixa/itens-desconto?${baseParams.toString()}`),
      ]);

      if (resumoRes.data?.success !== false) {
        setResumo(resumoRes.data?.resumo || resumoRes.data?.data || {
          TOTAL_ITENS: 0, VALOR_ITENS: 0,
          TOTAL_CUPONS: 0, VALOR_CUPONS: 0,
          TOTAL_VENDAS: 0, VALOR_VENDAS: 0,
        });
      }

      if (descRes.data?.success !== false) {
        setDescontos(descRes.data?.descontos || { TOTAL_ITENS_DESC: 0, VALOR_TOTAL_DESC: 0, TOTAL_CUPONS_DESC: 0 });
      }

      if (itensDescRes.data?.success !== false) {
        setItensDesconto(itensDescRes.data?.data || []);
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

  const handleSort = (key) => {
    setSortConfig(prev => {
      if (prev.key === key) {
        return { key, direction: prev.direction === 'asc' ? 'desc' : 'asc' };
      }
      return { key, direction: 'asc' };
    });
  };

  const sortedCancelamentos = React.useMemo(() => {
    if (!sortConfig.key) return cancelamentos;
    const sorted = [...cancelamentos].sort((a, b) => {
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

  // Filtrar localmente pela selecao do card de tipo
  const filteredCancelamentos = React.useMemo(() => {
    if (filters.tipo === 'DESCONTO') return itensDesconto;
    if (!filters.tipo) return sortedCancelamentos;
    return sortedCancelamentos.filter(c => (c.TIPO || '').toUpperCase() === filters.tipo);
  }, [sortedCancelamentos, itensDesconto, filters.tipo]);

  // Agrupar por COO+PDV+DATA (mesmo cupom)
  const groupedCancelamentos = React.useMemo(() => {
    const groups = [];
    const map = new Map();
    filteredCancelamentos.forEach(item => {
      const key = `${item.COO}-${item.NUM_PDV}-${item.DATA}`;
      if (!map.has(key)) {
        const group = { key, items: [item], first: item };
        map.set(key, group);
        groups.push(group);
      } else {
        map.get(key).items.push(item);
      }
    });
    return groups;
  }, [filteredCancelamentos]);

  const toggleGroup = (key, e) => {
    e.stopPropagation();
    setExpandedGroups(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const getCamerasForPdv = (numPdv) => {
    if (!numPdv || camerasRisco.length === 0) return [];
    return camerasRisco.filter(cam => cam.pdv === Number(numPdv));
  };

  const renderTipoBadge = (tipo) => {
    const t = (tipo || '').toUpperCase();
    if (t === 'ITEM') {
      return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-purple-100 text-purple-800 border border-purple-300">Item</span>;
    }
    if (t === 'CUPOM') {
      return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-red-100 text-red-800 border border-red-300">Cupom</span>;
    }
    if (t === 'VENDA') {
      return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-orange-100 text-orange-800 border border-orange-300">Venda</span>;
    }
    if (t === 'DESCONTO') {
      return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-green-100 text-green-800 border border-green-300">Desconto</span>;
    }
    return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-gray-100 text-gray-800">{tipo || '-'}</span>;
  };

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

  const DetailModal = ({ item, onClose }) => {
    if (!item) return null;
    const tipo = (item.TIPO || '').toUpperCase();
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={onClose}>
        <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full mx-4 overflow-hidden" onClick={e => e.stopPropagation()}>
          {/* Header laranja */}
          <div className="bg-gradient-to-r from-orange-600 to-orange-500 px-6 py-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="bg-white/20 rounded-full p-2">
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4.5c-.77-.833-2.694-.833-3.464 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white">Detalhe do Cancelamento</h3>
                  <p className="text-orange-200 text-sm">{renderTipoBadge(item.TIPO)}</p>
                </div>
              </div>
              <button onClick={onClose} className="text-white/70 hover:text-white transition-colors p-1">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>

          {/* Valor destaque */}
          <div className="bg-orange-50 px-6 py-4 border-b border-orange-100">
            <p className="text-xs text-orange-500 font-medium uppercase tracking-wider">Valor do Cancelamento</p>
            <p className="text-3xl font-bold text-orange-700 mt-1">{formatCurrency(item.VALOR)}</p>
          </div>

          {/* Detalhes */}
          <div className="px-6 py-5 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-gray-400 font-medium uppercase">Data</p>
                <p className="text-sm font-semibold text-gray-800 mt-0.5">{item.DATA || '-'}</p>
              </div>
              <div>
                <p className="text-xs text-gray-400 font-medium uppercase">Hora</p>
                <p className="text-sm font-semibold text-gray-800 mt-0.5 font-mono">{item.HORA || '-'}</p>
              </div>
              <div>
                <p className="text-xs text-gray-400 font-medium uppercase">COO</p>
                <p className="text-sm font-semibold text-gray-800 mt-0.5 font-mono">{item.COO || '-'}</p>
              </div>
              <div>
                <p className="text-xs text-gray-400 font-medium uppercase">PDV</p>
                <p className="text-sm font-semibold text-gray-800 mt-0.5 font-mono">{item.NUM_PDV || '-'}</p>
              </div>
            </div>

            <div className="border-t border-gray-100 pt-4">
              <div className="flex items-center gap-2 mb-3">
                <svg className="w-4 h-4 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
                <p className="text-xs text-gray-400 font-medium uppercase">Operador</p>
              </div>
              <p className="text-sm font-semibold text-gray-800">{item.DES_OPERADOR || item.COD_OPERADOR || '-'}</p>
            </div>

            {item.DES_FISCAL && (
              <div className="border-t border-gray-100 pt-4">
                <div className="flex items-center gap-2 mb-3">
                  <svg className="w-4 h-4 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                  </svg>
                  <p className="text-xs text-gray-400 font-medium uppercase">Fiscal Autorizador</p>
                </div>
                <p className="text-sm font-semibold text-gray-800">{item.DES_FISCAL}</p>
              </div>
            )}

            {(tipo === 'ITEM' || tipo === 'VENDA') && (item.COD_PRODUTO || item.DES_PRODUTO) && (
              <div className="border-t border-gray-100 pt-4">
                <div className="flex items-center gap-2 mb-3">
                  <svg className="w-4 h-4 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                  </svg>
                  <p className="text-xs text-gray-400 font-medium uppercase">Produto</p>
                </div>
                <p className="text-sm font-semibold text-gray-800">
                  {item.COD_PRODUTO && <span className="text-orange-600 font-mono mr-2">{item.COD_PRODUTO}</span>}
                  {item.DES_PRODUTO || '-'}
                </p>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 flex justify-end">
            <button
              onClick={onClose}
              className="px-5 py-2 bg-orange-600 hover:bg-orange-700 text-white font-medium rounded-lg text-sm transition-colors"
            >
              Fechar
            </button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="flex h-screen bg-gray-50">
      {selectedItem && <DetailModal item={selectedItem} onClose={() => setSelectedItem(null)} />}
      {videoItem && getCamerasForPdv(videoItem.NUM_PDV).length > 0 && (
        <VideoModal
          item={videoItem}
          cameras={getCamerasForPdv(videoItem.NUM_PDV)}
          onClose={() => setVideoItem(null)}
        />
      )}
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
          <h1 className="text-lg font-semibold text-gray-900">Vision Operacoes de Risco PDV</h1>
          <div className="w-10" />
        </div>

        {/* Header */}
        <div className="bg-gradient-to-br from-orange-600 to-orange-500 shadow-lg">
          <div className="px-4 md:px-6 py-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-white mb-1 sm:mb-2">Vision Operacoes de Risco PDV</h1>
                <p className="text-white/90 text-sm sm:text-base">Cancelamentos de itens, cupons e vendas por operador</p>
              </div>
              <div className="bg-white/20 backdrop-blur-sm rounded-full p-3 hidden lg:block">
                <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4.5c-.77-.833-2.694-.833-3.464 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z" />
                </svg>
              </div>
            </div>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="px-4 md:px-6 py-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            <div
              onClick={() => setFilters(prev => ({ ...prev, tipo: '' }))}
              className={`bg-white rounded-xl shadow-sm border-2 p-4 hover:shadow-md transition-all cursor-pointer ${filters.tipo === '' ? 'border-gray-400 ring-2 ring-gray-200' : 'border-gray-200'}`}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-gray-500">📋 Total Cancelamentos</span>
              </div>
              <p className="text-2xl font-bold text-gray-900">{totalCancelamentos}</p>
              <p className="text-xs text-gray-400 mt-1">Itens + Cupons + Vendas</p>
            </div>

            <div
              onClick={() => setFilters(prev => ({ ...prev, tipo: prev.tipo === 'ITEM' ? '' : 'ITEM' }))}
              className={`bg-white rounded-xl shadow-sm border-2 p-4 hover:shadow-md transition-all cursor-pointer ${filters.tipo === 'ITEM' ? 'border-purple-500 ring-2 ring-purple-200 bg-purple-50' : 'border-purple-200'}`}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-purple-700">🏷️ Canc. Item</span>
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-purple-100 text-purple-800 border border-purple-300">
                  {resumo.TOTAL_ITENS || 0}
                </span>
              </div>
              <p className="text-2xl font-bold text-purple-700">{formatCurrency(resumo.VALOR_ITENS || 0)}</p>
              <p className="text-xs text-purple-400 mt-1">Valor total itens cancelados</p>
            </div>

            <div
              onClick={() => setFilters(prev => ({ ...prev, tipo: prev.tipo === 'CUPOM' ? '' : 'CUPOM' }))}
              className={`bg-white rounded-xl shadow-sm border-2 p-4 hover:shadow-md transition-all cursor-pointer ${filters.tipo === 'CUPOM' ? 'border-red-500 ring-2 ring-red-200 bg-red-50' : 'border-red-200'}`}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-red-700">🧾 Canc. Cupom</span>
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-red-100 text-red-800 border border-red-300">
                  {resumo.TOTAL_CUPONS || 0}
                </span>
              </div>
              <p className="text-2xl font-bold text-red-700">{formatCurrency(resumo.VALOR_CUPONS || 0)}</p>
              <p className="text-xs text-red-400 mt-1">Valor total cupons cancelados</p>
            </div>

            <div
              onClick={() => setFilters(prev => ({ ...prev, tipo: prev.tipo === 'VENDA' ? '' : 'VENDA' }))}
              className={`bg-white rounded-xl shadow-sm border-2 p-4 hover:shadow-md transition-all cursor-pointer ${filters.tipo === 'VENDA' ? 'border-orange-500 ring-2 ring-orange-200 bg-orange-50' : 'border-orange-200'}`}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-orange-700">🛒 Canc. Venda</span>
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-orange-100 text-orange-800 border border-orange-300">
                  {resumo.TOTAL_VENDAS || 0}
                </span>
              </div>
              <p className="text-2xl font-bold text-orange-700">{formatCurrency(resumo.VALOR_VENDAS || 0)}</p>
              <p className="text-xs text-orange-400 mt-1">Valor total vendas canceladas</p>
            </div>

            <div
              onClick={() => setFilters(prev => ({ ...prev, tipo: prev.tipo === 'DESCONTO' ? '' : 'DESCONTO' }))}
              className={`bg-white rounded-xl shadow-sm border-2 p-4 hover:shadow-md transition-all cursor-pointer ${filters.tipo === 'DESCONTO' ? 'border-green-500 ring-2 ring-green-200 bg-green-50' : 'border-green-200'}`}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-green-700">💰 Descontos</span>
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-green-100 text-green-800 border border-green-300">
                  {descontos.TOTAL_ITENS_DESC || 0} itens
                </span>
              </div>
              <p className="text-2xl font-bold text-green-700">{formatCurrency(descontos.VALOR_TOTAL_DESC || 0)}</p>
              <p className="text-xs text-green-400 mt-1">{descontos.TOTAL_CUPONS_DESC || 0} cupons com desconto</p>
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white border-b border-gray-200 px-4 md:px-6 py-4">
          <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-end gap-3 sm:gap-4">
            <div className="flex flex-col w-full sm:w-auto">
              <label className="text-xs text-gray-500 mb-1">Data Inicio</label>
              <input
                type="date"
                value={filters.dataInicio}
                onChange={(e) => setFilters(prev => ({ ...prev, dataInicio: e.target.value }))}
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
              />
            </div>

            <div className="flex flex-col w-full sm:w-auto">
              <label className="text-xs text-gray-500 mb-1">Data Fim</label>
              <input
                type="date"
                value={filters.dataFim}
                onChange={(e) => setFilters(prev => ({ ...prev, dataFim: e.target.value }))}
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
              />
            </div>

            <div className="flex flex-col w-full sm:w-auto">
              <label className="text-xs text-gray-500 mb-1">Tipo</label>
              <select
                value={filters.tipo}
                onChange={(e) => setFilters(prev => ({ ...prev, tipo: e.target.value }))}
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-orange-500 focus:border-orange-500 w-full sm:min-w-[140px]"
              >
                <option value="">Todos</option>
                <option value="ITEM">Item</option>
                <option value="CUPOM">Cupom</option>
                <option value="VENDA">Venda</option>
              </select>
            </div>

            <div className="flex flex-col w-full sm:w-auto">
              <label className="text-xs text-gray-500 mb-1">Operador</label>
              <select
                value={filters.codOperador}
                onChange={(e) => setFilters(prev => ({ ...prev, codOperador: e.target.value }))}
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-orange-500 focus:border-orange-500 w-full sm:min-w-[200px]"
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

            <div className="flex flex-col w-full sm:w-auto">
              <label className="text-xs text-gray-500 mb-1">PDV</label>
              <input
                type="text"
                placeholder="Todos"
                value={filters.numPdv}
                onChange={(e) => setFilters(prev => ({ ...prev, numPdv: e.target.value }))}
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-orange-500 focus:border-orange-500 w-full sm:w-[100px]"
              />
            </div>

            <div className="flex gap-2 w-full sm:w-auto">
              <button
                onClick={handleSearch}
                disabled={loading}
                className="bg-orange-600 hover:bg-orange-700 text-white px-6 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 w-full sm:w-auto"
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
                  {filteredCancelamentos.length} cancelamento{filteredCancelamentos.length !== 1 ? 's' : ''} encontrado{filteredCancelamentos.length !== 1 ? 's' : ''}
                  {filters.tipo && <span className="ml-2 text-xs text-orange-500 font-normal">(filtro: {filters.tipo})</span>}
                </h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-200">
                      {columnOrder.map(colId => {
                        const col = COLUMN_DEFS[colId];
                        return (
                          <th
                            key={colId}
                            draggable
                            onDragStart={() => handleDragStart(colId)}
                            onDragOver={handleDragOver}
                            onDrop={() => handleDrop(colId)}
                            className={`px-4 py-3 ${col.align} text-xs font-semibold text-gray-600 uppercase tracking-wider cursor-grab hover:bg-gray-100 select-none ${dragCol === colId ? 'opacity-50 bg-purple-50' : ''}`}
                            onClick={() => handleSort(col.sortKey)}
                          >
                            <span className="flex items-center gap-1">
                              <svg className="w-3 h-3 text-gray-300 flex-shrink-0" fill="currentColor" viewBox="0 0 24 24"><path d="M8 6h2v2H8V6zm6 0h2v2h-2V6zM8 11h2v2H8v-2zm6 0h2v2h-2v-2zm-6 5h2v2H8v-2zm6 0h2v2h-2v-2z"/></svg>
                              {col.label} {renderSortIcon(col.sortKey)}
                            </span>
                          </th>
                        );
                      })}
                      {camerasRisco.length > 0 && (
                        <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider w-16">
                          Video
                        </th>
                      )}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {groupedCancelamentos.map((group, gIdx) => {
                      const { key, items, first } = group;
                      const isMultiple = items.length > 1;
                      const isExpanded = expandedGroups[key];
                      const totalValor = items.reduce((sum, i) => sum + (Number(i.VALOR) || 0), 0);
                      const tipo = (first.TIPO || '').toUpperCase();

                      return (
                        <React.Fragment key={key}>
                          {/* Linha principal do grupo */}
                          <tr
                            onClick={() => isMultiple ? toggleGroup(key, { stopPropagation: () => {} }) : setSelectedItem(first)}
                            className={`hover:bg-orange-50 transition-colors cursor-pointer ${gIdx % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'} ${isMultiple && isExpanded ? 'bg-orange-50/50' : ''}`}
                          >
                            {columnOrder.map(colId => (
                              <td key={colId} className={getMainCellClass(colId)}>
                                {renderMainCell(colId, { ...first, _groupKey: key }, items, isMultiple, tipo, totalValor)}
                              </td>
                            ))}
                            {camerasRisco.length > 0 && (
                              <td className="px-4 py-3 text-center">
                                {getCamerasForPdv(first.NUM_PDV).length > 0 ? (
                                  <button
                                    onClick={(e) => { e.stopPropagation(); setVideoItem(first); }}
                                    className="p-2 rounded-lg bg-purple-100 text-purple-600 hover:bg-purple-200 hover:text-purple-700 transition-colors"
                                    title={`Ver video do PDV ${first.NUM_PDV}`}
                                  >
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                    </svg>
                                  </button>
                                ) : (
                                  <span className="text-gray-300">-</span>
                                )}
                              </td>
                            )}
                          </tr>

                          {/* Linhas expandidas dos itens do grupo */}
                          {isMultiple && isExpanded && items.map((item, iIdx) => {
                            const subTipo = (item.TIPO || '').toUpperCase();
                            return (
                              <tr key={`${key}-${iIdx}`} onClick={() => setSelectedItem(item)} className="bg-orange-50/70 hover:bg-orange-100/60 transition-colors cursor-pointer border-l-4 border-orange-400">
                                {columnOrder.map(colId => (
                                  <td key={colId} className={getExpandedCellClass(colId)}>
                                    {renderExpandedCell(colId, item, subTipo)}
                                  </td>
                                ))}
                                {camerasRisco.length > 0 && (
                                  <td className="px-4 py-2 text-center">
                                    {getCamerasForPdv(item.NUM_PDV).length > 0 ? (
                                      <button
                                        onClick={(e) => { e.stopPropagation(); setVideoItem(item); }}
                                        className="p-1.5 rounded bg-purple-100 text-purple-600 hover:bg-purple-200 hover:text-purple-700 transition-colors"
                                        title={`Ver video do PDV ${item.NUM_PDV}`}
                                      >
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                        </svg>
                                      </button>
                                    ) : (
                                      <span className="text-gray-300 text-xs">-</span>
                                    )}
                                  </td>
                                )}
                              </tr>
                            );
                          })}
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
