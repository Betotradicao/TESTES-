import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useLoja } from '../contexts/LojaContext';
import Sidebar from '../components/Sidebar';
import { api } from '../utils/api';
import toast from 'react-hot-toast';
import RadarLoading from '../components/RadarLoading';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

const fmt = (v) => v != null ? Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '0,00';
const fmtInt = (v) => v != null ? Math.round(Number(v)).toLocaleString('pt-BR') : '0';
const fmtPct = (v) => v != null ? Number(v).toFixed(2) + '%' : '0,00%';

// Definição de todas as colunas da tabela
const ALL_COLUMNS = [
  { id: 'idx',            label: '#',            group: 'Produto',     align: 'center', minW: '45px',  sticky: true },
  { id: 'COD_PRODUTO',    label: 'Cód.Produto',  group: 'Produto',     align: 'left',   minW: '110px' },
  { id: 'COD_BARRAS',     label: 'Cód.Barras',   group: 'Produto',     align: 'left',   minW: '150px' },
  { id: 'DESCRICAO',      label: 'Descrição',    group: 'Produto',     align: 'left',   minW: '320px' },
  { id: 'SEGMENTO',       label: 'Segmento',     group: 'Produto',     align: 'left',   minW: '180px' },
  { id: 'DTA_CADASTRO',   label: 'Dt.Cadastro',  group: 'Produto',     align: 'center', minW: '110px' },
  { id: 'DIAS_CADASTRO',  label: 'Dias Cadastro',group: 'Produto',     align: 'right',  minW: '105px' },
  { id: 'FORA_MIX',       label: 'F.Mix?',       group: 'Produto',     align: 'center', minW: '70px' },
  { id: 'FORA_LINHA',     label: 'F.Linha?',     group: 'Produto',     align: 'center', minW: '70px' },
  { id: 'QTD_TOTAL',      label: 'Qtd.Total',    group: 'Vendas',      align: 'right',  minW: '105px' },
  { id: 'QTD_KG_LT',      label: 'Qtd.KG/LT',   group: 'Vendas',      align: 'right',  minW: '105px' },
  { id: 'QTD_CUPONS',     label: 'Qtd.Cupons',   group: 'Vendas',      align: 'right',  minW: '100px' },
  { id: 'TICKET_MEDIO',   label: 'Ticket Médio', group: 'Vendas',      align: 'right',  minW: '110px' },
  { id: 'VAL_VENDA',      label: 'Val.Venda',    group: 'Vendas',      align: 'right',  minW: '120px' },
  { id: 'VAL_PROMO',      label: 'Val.Promo',    group: 'Vendas',      align: 'right',  minW: '110px' },
  { id: 'VD_MEDIA',       label: 'Vd.Média',     group: 'Vendas',      align: 'right',  minW: '100px' },
  { id: 'VD_KG_LT',       label: 'Vd.KG/LT',    group: 'Vendas',      align: 'right',  minW: '100px' },
  { id: 'PAPEL',          label: 'Papel',        group: 'Vendas',      align: 'center', minW: '60px' },
  { id: 'QTD_EST_ATUAL',  label: 'Qtd.Est.Atual',group: 'Vendas',      align: 'right',  minW: '110px' },
  { id: 'CURVA',          label: 'Curva',        group: 'Vendas',      align: 'center', minW: '65px' },
  { id: 'DTA_ULTIMA_VENDA', label: 'Últ.Venda',  group: 'Vendas',      align: 'center', minW: '110px' },
  { id: 'PRECO_VENDA',    label: 'Preço Venda',  group: 'Financeiro',  align: 'right',  minW: '115px', borderL: true },
  { id: 'VAL_CUSTO',      label: 'Val.Custo',    group: 'Financeiro',  align: 'right',  minW: '110px' },
  { id: 'MARGEM_COMERCIAL',label: 'Margem C.',   group: 'Financeiro',  align: 'right',  minW: '105px' },
  { id: 'MARGEM_PCT',     label: 'Margem %',     group: 'Financeiro',  align: 'right',  minW: '100px' },
  { id: 'MARGEM_META',    label: 'Mg.Meta %',    group: 'Financeiro',  align: 'right',  minW: '100px' },
  { id: 'CONC_BARATO',    label: 'Conc.Barato',  group: 'Financeiro',  align: 'right',  minW: '110px' },
  { id: 'CONC_NOME',      label: 'Concorrente',  group: 'Financeiro',  align: 'left',   minW: '180px' },
  { id: 'IMPOSTOS',       label: 'Impostos',     group: 'Financeiro',  align: 'right',  minW: '100px' },
  { id: 'CONTRIBUICAO',   label: 'Contribuição', group: 'Financeiro',  align: 'right',  minW: '120px' },
  { id: 'PART_FAT',       label: 'Part.%Fat.',   group: 'Ponderação',  align: 'right',  minW: '100px', borderL: true },
  { id: 'PART_VOL',       label: 'Part.%Vol.',   group: 'Ponderação',  align: 'right',  minW: '100px' },
  { id: 'PART_CONT',      label: 'Part.%Cont.',  group: 'Ponderação',  align: 'right',  minW: '100px' },
  { id: 'PESO_FAT',       label: 'Peso%Fat.',    group: 'Ponderação',  align: 'right',  minW: '100px', borderL: 'thin' },
  { id: 'PESO_VOL',       label: 'Peso%Vol.',    group: 'Ponderação',  align: 'right',  minW: '100px' },
  { id: 'PESO_CONT',      label: 'Peso%Cont.',   group: 'Ponderação',  align: 'right',  minW: '100px' },
  { id: 'PONDERACAO',     label: 'Ponderação',   group: 'Ponderação',  align: 'right',  minW: '110px', borderL: true },
  { id: 'ACUMULADO',      label: 'Acumulado',    group: 'Ponderação',  align: 'right',  minW: '110px' },
];

const DEFAULT_ORDER = ALL_COLUMNS.map(c => c.id);

// Helper: valor de totais para cada coluna
const getTotalValue = (col, totais) => {
  const map = {
    QTD_TOTAL: () => fmt(totais.qtdTotal),
    QTD_KG_LT: () => fmt(totais.qtdKgLt),
    QTD_CUPONS: () => fmtInt(totais.qtdCupons),
    TICKET_MEDIO: () => '',
    VAL_VENDA: () => fmt(totais.valVenda),
    VAL_PROMO: () => fmt(totais.valPromo),
    VAL_CUSTO: () => fmt(totais.valCusto),
    MARGEM_PCT: () => fmtPct(totais.margem),
    IMPOSTOS: () => fmt(totais.impostos),
    CONTRIBUICAO: () => fmt(totais.contribuicao),
    PART_FAT: () => '100,00%',
    PART_VOL: () => '100,00%',
    PART_CONT: () => '100,00%',
    PONDERACAO: () => '100,00%',
    ACUMULADO: () => '100,00%',
    DESCRICAO: () => 'TOTAIS',
  };
  return map[col.id] ? map[col.id]() : '';
};

// Helper: calcular dias desde o cadastro até o fim do período pesquisado
const calcDiasCadastro = (dtaCadStr, dataFimStr) => {
  if (!dtaCadStr) return '';
  const parseDMY = (s) => { const p = s.split('/'); return new Date(p[2], p[1] - 1, p[0]); };
  const parseYMD = (s) => { const p = s.split('-'); return new Date(p[0], p[1] - 1, p[2]); };
  const dtaCad = parseDMY(dtaCadStr);
  const dtaFim = parseYMD(dataFimStr);
  if (dtaCad > dtaFim) return '0';
  const dias = Math.round((dtaFim - dtaCad) / (1000 * 60 * 60 * 24)) + 1;
  return fmtInt(dias);
};

// Helper: valor de célula para cada coluna
const getCellValue = (col, row, idx, dataFimStr) => {
  const map = {
    idx: () => idx + 1,
    COD_PRODUTO: () => row.COD_PRODUTO,
    COD_BARRAS: () => row.COD_BARRAS,
    DESCRICAO: () => row.DESCRICAO,
    SEGMENTO: () => row.SEGMENTO,
    DTA_CADASTRO: () => row.DTA_CADASTRO || '',
    DIAS_CADASTRO: () => dataFimStr ? calcDiasCadastro(row.DTA_CADASTRO, dataFimStr) : '',
    QTD_TOTAL: () => fmt(row.QTD_TOTAL),
    QTD_KG_LT: () => fmt(row.QTD_KG_LT),
    QTD_CUPONS: () => fmtInt(row.QTD_CUPONS),
    TICKET_MEDIO: () => fmt(row.TICKET_MEDIO),
    VAL_VENDA: () => fmt(row.VAL_VENDA),
    VAL_PROMO: () => fmt(row.VAL_PROMO),
    VD_MEDIA: () => fmt(row.VD_MEDIA),
    VD_KG_LT: () => fmt(row.VD_KG_LT),
    PAPEL: () => null, // special render
    QTD_EST_ATUAL: () => fmt(row.QTD_EST_ATUAL),
    CURVA: () => row.CURVA || '',
    DTA_ULTIMA_VENDA: () => row.DTA_ULTIMA_VENDA || '',
    PRECO_VENDA: () => fmt(row.PRECO_VENDA),
    VAL_CUSTO: () => fmt(row.VAL_CUSTO),
    MARGEM_COMERCIAL: () => fmt(row.MARGEM_COMERCIAL),
    MARGEM_PCT: () => fmtPct(row.MARGEM_PCT),
    MARGEM_META: () => fmtPct(row.MARGEM_META),
    CONC_BARATO: () => row.CONC_BARATO > 0 ? fmt(row.CONC_BARATO) : '-',
    CONC_NOME: () => row.CONC_NOME || '-',
    IMPOSTOS: () => fmt(row.IMPOSTOS),
    CONTRIBUICAO: () => fmt(row.CONTRIBUICAO),
    PART_FAT: () => fmtPct(row.PART_FAT),
    PART_VOL: () => fmtPct(row.PART_VOL),
    PART_CONT: () => fmtPct(row.PART_CONT),
    PESO_FAT: () => fmtPct(row.PESO_FAT),
    PESO_VOL: () => fmtPct(row.PESO_VOL),
    PESO_CONT: () => fmtPct(row.PESO_CONT),
    PONDERACAO: () => fmtPct(row.PONDERACAO),
    ACUMULADO: () => fmtPct(row.ACUMULADO),
    FORA_MIX: () => null,   // special render (checkbox style)
    FORA_LINHA: () => null,  // special render (checkbox style)
  };
  return map[col.id] ? map[col.id]() : '';
};

// Extra CSS classes por coluna
const getCellExtraClass = (colId, row) => {
  const m = {
    COD_BARRAS: 'text-gray-500',
    SEGMENTO: 'text-gray-600',
    VAL_VENDA: 'font-bold',
    VAL_PROMO: 'text-purple-600',
    MARGEM_PCT: 'font-bold',
    MARGEM_META: 'text-orange-600 font-bold',
    CONC_BARATO: 'text-blue-600',
    CONC_NOME: 'text-gray-600 text-xs',
    IMPOSTOS: 'text-red-600',
    CONTRIBUICAO: 'font-bold text-blue-700',
    PESO_FAT: 'text-gray-500',
    PESO_VOL: 'text-gray-500',
    PESO_CONT: 'text-gray-500',
  };
  if (colId === 'PONDERACAO' || colId === 'ACUMULADO') {
    return `font-bold ${row?.COR === 'verde' ? 'text-green-700' : 'text-red-700'}`;
  }
  return m[colId] || '';
};

export default function AnalisePonderacao() {
  const { user, logout } = useAuth();
  const { lojaSelecionada } = useLoja();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showColConfig, setShowColConfig] = useState(false);
  const colConfigRef = useRef(null);
  const dragColRef = useRef(null);

  // Colunas visíveis e ordem - persistidas no localStorage
  const [visibleCols, setVisibleCols] = useState(() => {
    try {
      const saved = localStorage.getItem('ponderacao_visible');
      const savedKnown = localStorage.getItem('ponderacao_known_cols');
      if (saved) {
        const arr = JSON.parse(saved);
        const known = savedKnown ? JSON.parse(savedKnown) : [];
        if (Array.isArray(arr)) {
          // Colunas genuinamente novas = existem em DEFAULT_ORDER mas NÃO eram conhecidas
          const genuinelyNew = DEFAULT_ORDER.filter(id => !known.includes(id));
          return genuinelyNew.length > 0 ? [...arr, ...genuinelyNew] : arr;
        }
      }
    } catch {}
    return [...DEFAULT_ORDER];
  });
  const [columnOrder, setColumnOrder] = useState(() => {
    try {
      const saved = localStorage.getItem('ponderacao_order');
      if (saved) {
        const arr = JSON.parse(saved);
        if (Array.isArray(arr) && arr.length > 0) {
          const newCols = DEFAULT_ORDER.filter(id => !arr.includes(id));
          const cleaned = arr.filter(id => DEFAULT_ORDER.includes(id));
          return newCols.length > 0 ? [...cleaned, ...newCols] : cleaned;
        }
      }
    } catch {}
    return [...DEFAULT_ORDER];
  });

  // Salvar no localStorage quando muda
  useEffect(() => {
    localStorage.setItem('ponderacao_visible', JSON.stringify(visibleCols));
    localStorage.setItem('ponderacao_known_cols', JSON.stringify(DEFAULT_ORDER));
  }, [visibleCols]);
  useEffect(() => { localStorage.setItem('ponderacao_order', JSON.stringify(columnOrder)); }, [columnOrder]);

  // Fechar painel ao clicar fora
  useEffect(() => {
    const handler = (e) => {
      if (colConfigRef.current && !colConfigRef.current.contains(e.target)) setShowColConfig(false);
    };
    if (showColConfig) document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showColConfig]);

  // Colunas ativas (na ordem certa, só as visíveis)
  const activeCols = columnOrder
    .filter(id => visibleCols.includes(id))
    .map(id => ALL_COLUMNS.find(c => c.id === id))
    .filter(Boolean);

  // Toggle visibilidade de coluna
  const toggleCol = (colId) => {
    setVisibleCols(prev => prev.includes(colId) ? prev.filter(id => id !== colId) : [...prev, colId]);
  };

  // Toggle grupo inteiro
  const toggleGroup = (group) => {
    const groupIds = ALL_COLUMNS.filter(c => c.group === group).map(c => c.id);
    const allVisible = groupIds.every(id => visibleCols.includes(id));
    if (allVisible) {
      setVisibleCols(prev => prev.filter(id => !groupIds.includes(id)));
    } else {
      setVisibleCols(prev => [...new Set([...prev, ...groupIds])]);
    }
  };

  // Drag-and-drop de colunas no header
  const onDragStartCol = (e, colId) => { dragColRef.current = colId; e.dataTransfer.effectAllowed = 'move'; };
  const onDragOverCol = (e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; };
  const onDropCol = (e, targetColId) => {
    e.preventDefault();
    const srcId = dragColRef.current;
    if (!srcId || srcId === targetColId) return;
    setColumnOrder(prev => {
      const arr = [...prev];
      const srcIdx = arr.indexOf(srcId);
      const tgtIdx = arr.indexOf(targetColId);
      if (srcIdx === -1 || tgtIdx === -1) return prev;
      arr.splice(srcIdx, 1);
      arr.splice(tgtIdx, 0, srcId);
      return arr;
    });
    dragColRef.current = null;
  };

  // Restaurar padrão
  const resetCols = () => { setVisibleCols([...DEFAULT_ORDER]); setColumnOrder([...DEFAULT_ORDER]); };

  // Dados
  const [rows, setRows] = useState([]);
  const [totais, setTotais] = useState(null);

  // Dropdowns
  const [lojas, setLojas] = useState([]);
  const [secoes, setSecoes] = useState([]);
  const [grupos, setGrupos] = useState([]);
  const [subgrupos, setSubgrupos] = useState([]);
  const [segmentos, setSegmentos] = useState([]);

  // Filtros
  const [codLoja, setCodLoja] = useState('');
  const [codSecao, setCodSecao] = useState('');
  const [codGrupo, setCodGrupo] = useState('');
  const [codSubGrupo, setCodSubGrupo] = useState('');
  const [codSegmento, setCodSegmento] = useState('');

  const hoje = new Date();
  const anoAnterior = hoje.getFullYear() - 1;
  const formatDate = (d) => d.toISOString().split('T')[0];
  const formatDateBR = (d) => {
    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const yyyy = d.getFullYear();
    return `${dd}/${mm}/${yyyy}`;
  };

  const [dataInicio, setDataInicio] = useState(formatDate(new Date(anoAnterior, 0, 1)));
  const [dataFim, setDataFim] = useState(formatDate(new Date(anoAnterior, 11, 31)));

  // Pesos e diagnóstico
  const [diagnostico, setDiagnostico] = useState(95);
  const [pesoFat, setPesoFat] = useState(35);
  const [pesoVol, setPesoVol] = useState(35);
  const [pesoCont, setPesoCont] = useState(30);

  // Modal PADRÃO %
  const [showPadraoModal, setShowPadraoModal] = useState(false);
  const [hierarquiaData, setHierarquiaData] = useState([]);
  const [segmentosData, setSegmentosData] = useState([]);
  const [hierarquiaLoading, setHierarquiaLoading] = useState(false);
  const [hierarquiaExpandedSecoes, setHierarquiaExpandedSecoes] = useState({});
  const [hierarquiaExpandedGrupos, setHierarquiaExpandedGrupos] = useState({});
  const [hierarquiaExpandedSubgrupos, setHierarquiaExpandedSubgrupos] = useState({});
  const [hierarquiaBusca, setHierarquiaBusca] = useState('');
  const [padraoConfig, setPadraoConfig] = useState(() => {
    try {
      const saved = localStorage.getItem('ponderacao_padrao_pesos');
      if (saved) return JSON.parse(saved);
    } catch {}
    return {};
  });

  // Salvar padraoConfig no localStorage
  useEffect(() => {
    localStorage.setItem('ponderacao_padrao_pesos', JSON.stringify(padraoConfig));
  }, [padraoConfig]);

  // Abrir modal e carregar hierarquia
  const abrirPadraoModal = async () => {
    setShowPadraoModal(true);
    if (hierarquiaData.length > 0) return; // já carregou
    setHierarquiaLoading(true);
    try {
      const res = await api.get('/ponderacao/hierarquia');
      const d = res.data || {};
      setHierarquiaData(d.hierarquia || []);
      setSegmentosData(d.segmentos || []);
    } catch (err) {
      console.error('Erro ao buscar hierarquia:', err);
    } finally {
      setHierarquiaLoading(false);
    }
  };

  // Montar mapa de segmentos por subgrupo: "sec-grp-sg" -> [{cod, des}]
  const segmentosPorSubgrupo = useMemo(() => {
    const m = {};
    for (const row of segmentosData) {
      const key = `${row.COD_SECAO}-${row.COD_GRUPO}-${row.COD_SUBGRUPO}`;
      if (!m[key]) m[key] = [];
      m[key].push({ cod: row.COD_SEGMENTO, des: row.DES_SEGMENTO });
    }
    return m;
  }, [segmentosData]);

  // Montar estrutura hierárquica a partir dos dados flat
  const hierarquiaTree = useMemo(() => {
    const busca = hierarquiaBusca.toLowerCase().trim();
    const map = {};
    for (const row of hierarquiaData) {
      const sk = row.COD_SECAO;
      const gk = row.COD_GRUPO;
      const sgk = row.COD_SUBGRUPO;
      if (!map[sk]) map[sk] = { cod: sk, des: row.DES_SECAO, grupos: {} };
      if (!map[sk].grupos[gk]) map[sk].grupos[gk] = { cod: gk, des: row.DES_GRUPO, subgrupos: {} };
      const sgKey = `${sk}-${gk}-${sgk}`;
      const segs = segmentosPorSubgrupo[sgKey] || [];
      map[sk].grupos[gk].subgrupos[sgk] = { cod: sgk, des: row.DES_SUBGRUPO, segmentos: segs };
    }
    // Converter para array e filtrar por busca
    const result = [];
    for (const s of Object.values(map)) {
      const gruposArr = [];
      for (const g of Object.values(s.grupos)) {
        const subsArr = Object.values(g.subgrupos);
        const subsFiltrados = busca
          ? subsArr.filter(sg => sg.des?.toLowerCase().includes(busca) || g.des?.toLowerCase().includes(busca) || s.des?.toLowerCase().includes(busca)
              || sg.segmentos?.some(seg => seg.des?.toLowerCase().includes(busca)))
          : subsArr;
        if (subsFiltrados.length > 0) {
          gruposArr.push({ ...g, subgrupos: subsFiltrados });
        }
      }
      if (gruposArr.length > 0) {
        result.push({ ...s, grupos: gruposArr });
      }
    }
    return result;
  }, [hierarquiaData, hierarquiaBusca, segmentosPorSubgrupo]);

  // Atualizar peso de um segmento (ou subgrupo se codSeg=0)
  const setPadraoPeso = (codSec, codGrp, codSG, codSeg, campo, valor) => {
    const key = `${codSec}-${codGrp}-${codSG}-${codSeg}`;
    setPadraoConfig(prev => ({
      ...prev,
      [key]: { ...(prev[key] || { fat: 35, vol: 35, cont: 30 }), [campo]: Number(valor) || 0 }
    }));
  };

  // Auto-preencher pesos quando segmento/subgrupo/grupo/seção muda
  useEffect(() => {
    if (!codSecao) return;
    // Tentar segmento específico
    if (codSubGrupo && codSegmento) {
      const key = `${codSecao}-${codGrupo}-${codSubGrupo}-${codSegmento}`;
      if (padraoConfig[key]) {
        setPesoFat(padraoConfig[key].fat);
        setPesoVol(padraoConfig[key].vol);
        setPesoCont(padraoConfig[key].cont);
        return;
      }
    }
    // Fallback: subgrupo sem segmento (codSeg=0)
    if (codSubGrupo) {
      const key0 = `${codSecao}-${codGrupo}-${codSubGrupo}-0`;
      if (padraoConfig[key0]) {
        setPesoFat(padraoConfig[key0].fat);
        setPesoVol(padraoConfig[key0].vol);
        setPesoCont(padraoConfig[key0].cont);
        return;
      }
      // Fallback: qualquer segmento desse subgrupo
      const prefix = `${codSecao}-${codGrupo}-${codSubGrupo}-`;
      const match = Object.keys(padraoConfig).find(k => k.startsWith(prefix));
      if (match) {
        setPesoFat(padraoConfig[match].fat);
        setPesoVol(padraoConfig[match].vol);
        setPesoCont(padraoConfig[match].cont);
        return;
      }
    }
    // Fallback: qualquer subgrupo do grupo
    if (codGrupo) {
      const prefix = `${codSecao}-${codGrupo}-`;
      const match = Object.keys(padraoConfig).find(k => k.startsWith(prefix));
      if (match) {
        setPesoFat(padraoConfig[match].fat);
        setPesoVol(padraoConfig[match].vol);
        setPesoCont(padraoConfig[match].cont);
        return;
      }
    }
  }, [codSecao, codGrupo, codSubGrupo, codSegmento]);

  // Sugestão de pesos baseada em análise de dados
  const [sugestaoLoading, setSugestaoLoading] = useState(false);
  const [sugestaoData, setSugestaoData] = useState(null); // map: "sec-grp-sg" -> { PESO_FAT, PESO_VOL, PESO_CONT, PERFIL }

  const buscarSugestao = async () => {
    if (!codLoja) {
      toast.error('Selecione uma Loja antes de pedir sugestão');
      return;
    }
    setSugestaoLoading(true);
    try {
      const di = dataInicio.includes('/') ? dataInicio : formatDateBR(new Date(dataInicio));
      const df = dataFim.includes('/') ? dataFim : formatDateBR(new Date(dataFim));
      const res = await api.get(`/ponderacao/sugestao-pesos?codLoja=${codLoja}&dataInicio=${di}&dataFim=${df}`);
      const data = res.data || [];
      // Montar map e aplicar nos campos (chave com segmento)
      const map = {};
      const newConfig = { ...padraoConfig };
      for (const r of data) {
        const key = `${r.COD_SECAO}-${r.COD_GRUPO}-${r.COD_SUBGRUPO}-${r.COD_SEGMENTO || 0}`;
        map[key] = r;
        newConfig[key] = { fat: r.PESO_FAT, vol: r.PESO_VOL, cont: r.PESO_CONT };
      }
      setSugestaoData(map);
      setPadraoConfig(newConfig);
      toast.success(`${data.length} segmentos analisados e pesos sugeridos!`);
    } catch (err) {
      console.error('Erro ao buscar sugestão:', err);
      toast.error('Erro ao analisar dados');
    } finally {
      setSugestaoLoading(false);
    }
  };

  // Carregar dropdowns iniciais
  useEffect(() => {
    const loadDropdowns = async () => {
      try {
        const [lojasRes, secoesRes] = await Promise.all([
          api.get('/ponderacao/lojas'),
          api.get('/ponderacao/secoes'),
        ]);
        setLojas(lojasRes.data || []);
        setSecoes(secoesRes.data || []);

        // Auto-selecionar loja se lojaSelecionada
        if (lojaSelecionada && lojasRes.data?.length) {
          const match = lojasRes.data.find(l => l.COD_LOJA === lojaSelecionada);
          if (match) setCodLoja(String(match.COD_LOJA));
        }
        if (!codLoja && lojasRes.data?.length) {
          setCodLoja(String(lojasRes.data[0].COD_LOJA));
        }
      } catch (err) {
        console.error('Erro ao carregar dropdowns:', err);
      }
    };
    loadDropdowns();
  }, []);

  // Carregar grupos quando muda seção
  useEffect(() => {
    if (!codSecao) { setGrupos([]); setCodGrupo(''); return; }
    api.get(`/ponderacao/grupos?codSecao=${codSecao}`)
      .then(r => { setGrupos(r.data || []); setCodGrupo(''); setSubgrupos([]); setCodSubGrupo(''); })
      .catch(() => setGrupos([]));
  }, [codSecao]);

  // Carregar subgrupos quando muda grupo
  useEffect(() => {
    if (!codSecao || !codGrupo) { setSubgrupos([]); setCodSubGrupo(''); return; }
    api.get(`/ponderacao/subgrupos?codSecao=${codSecao}&codGrupo=${codGrupo}`)
      .then(r => { setSubgrupos(r.data || []); setCodSubGrupo(''); })
      .catch(err => { console.error('Erro subgrupos:', err); setSubgrupos([]); });
  }, [codSecao, codGrupo]);

  // Carregar segmentos filtrados quando muda seção/grupo/subgrupo
  useEffect(() => {
    if (!codSecao) return;
    const params = new URLSearchParams({ codSecao });
    if (codGrupo) params.set('codGrupo', codGrupo);
    if (codSubGrupo) params.set('codSubGrupo', codSubGrupo);
    api.get(`/ponderacao/segmentos?${params.toString()}`)
      .then(r => { setSegmentos(r.data || []); setCodSegmento(''); })
      .catch(() => setSegmentos([]));
  }, [codSecao, codGrupo, codSubGrupo]);

  // Buscar dados
  const buscarDados = useCallback(async () => {
    if (!codLoja || !codSecao) {
      toast.error('Selecione Loja e Seção');
      return;
    }

    setLoading(true);
    try {
      const di = dataInicio.includes('/') ? dataInicio : formatDateBR(new Date(dataInicio));
      const df = dataFim.includes('/') ? dataFim : formatDateBR(new Date(dataFim));

      const params = new URLSearchParams({
        dataInicio: di,
        dataFim: df,
        codLoja,
        codSecao,
        pesoFat: String(pesoFat),
        pesoVol: String(pesoVol),
        pesoCont: String(pesoCont),
        diagnostico: String(diagnostico),
      });
      if (codGrupo) params.set('codGrupo', codGrupo);
      if (codSubGrupo) params.set('codSubGrupo', codSubGrupo);
      if (codSegmento) params.set('codSegmento', codSegmento);

      const res = await api.get(`/ponderacao/dados?${params.toString()}`);
      setRows(res.data.rows || []);
      setTotais(res.data.totais || null);

      if ((res.data.rows || []).length === 0) {
        toast('Nenhum produto encontrado para os filtros selecionados', { icon: 'ℹ️' });
      } else {
        toast.success(`${res.data.rows.length} produtos encontrados`);
      }
    } catch (err) {
      console.error('Erro ao buscar ponderação:', err);
      toast.error('Erro ao buscar dados de ponderação');
    } finally {
      setLoading(false);
    }
  }, [codLoja, codSecao, codGrupo, codSubGrupo, codSegmento, dataInicio, dataFim, pesoFat, pesoVol, pesoCont, diagnostico]);

  // Filtros extras
  const [minDiasCadastro, setMinDiasCadastro] = useState(100);
  const [ocultarForaMix, setOcultarForaMix] = useState(true);
  const [ocultarForaLinha, setOcultarForaLinha] = useState(false);

  const filteredRows = rows.filter(row => {
    // Filtro dias cadastro
    if (minDiasCadastro && minDiasCadastro > 0 && row.DTA_CADASTRO) {
      const p = row.DTA_CADASTRO.split('/');
      const dtaCad = new Date(p[2], p[1] - 1, p[0]);
      const pf = dataFim.split('-');
      const dtaFim = new Date(pf[0], pf[1] - 1, pf[2]);
      const dias = Math.round((dtaFim - dtaCad) / (1000 * 60 * 60 * 24)) + 1;
      if (dias < minDiasCadastro) return false;
    }
    // Filtro fora do mix
    if (ocultarForaMix && row.FORA_MIX === 'S') return false;
    // Filtro fora de linha
    if (ocultarForaLinha && row.FORA_LINHA === 'S') return false;
    return true;
  });

  // Exportar PDF
  const exportarPDF = () => {
    if (!filteredRows.length) return;
    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a3' });
    doc.setFontSize(14);
    doc.text('ANÁLISE DE PONDERAÇÃO', 14, 15);
    doc.setFontSize(9);
    const secaoNome = secoes.find(s => String(s.COD_SECAO) === codSecao)?.DES_SECAO || codSecao;
    doc.text(`Seção: ${secaoNome} | Período: ${dataInicio} a ${dataFim} | Diag: ${diagnostico}% | Pesos: Fat=${pesoFat}% Vol=${pesoVol}% Cont=${pesoCont}%`, 14, 22);

    autoTable(doc, {
      startY: 28,
      head: [['Cód', 'Descrição', 'Qtd', 'Venda', 'Custo', 'Margem%', 'Impostos', 'Contrib.', 'P.%Fat', 'P.%Vol', 'P.%Cont', 'Pond.', 'Acum.', 'Papel']],
      body: filteredRows.map(r => [
        r.COD_PRODUTO,
        r.DESCRICAO?.substring(0, 30),
        fmt(r.QTD_TOTAL),
        fmt(r.VAL_VENDA),
        fmt(r.VAL_CUSTO),
        fmtPct(r.MARGEM_PCT),
        fmt(r.IMPOSTOS),
        fmt(r.CONTRIBUICAO),
        fmtPct(r.PART_FAT),
        fmtPct(r.PART_VOL),
        fmtPct(r.PART_CONT),
        fmtPct(r.PONDERACAO),
        fmtPct(r.ACUMULADO),
        r.PAPEL,
      ]),
      styles: { fontSize: 6 },
      headStyles: { fillColor: [255, 120, 0] },
      didParseCell: (data) => {
        if (data.section === 'body') {
          const row = filteredRows[data.row.index];
          if (row?.COR === 'vermelho') {
            data.cell.styles.fillColor = [255, 220, 220];
          } else {
            data.cell.styles.fillColor = [220, 255, 220];
          }
        }
      },
    });

    doc.save(`ponderacao_${codSecao}_${dataInicio.replace(/\//g, '-')}.pdf`);
  };

  // Nomes para display no PDF
  const secaoDisplay = secoes.find(s => String(s.COD_SECAO) === codSecao);

  return (
    <div className="flex h-screen bg-gray-100">
      <Sidebar
        activeItem="analise-corte"
        user={user}
        onLogout={logout}
        isMobileMenuOpen={isMobileMenuOpen}
        setIsMobileMenuOpen={setIsMobileMenuOpen}
      />

      <div className="flex-1 overflow-auto">
        {/* Header */}
        <div className="bg-gradient-to-r from-orange-500 to-orange-600 p-4 shadow-lg">
          <div className="flex items-center gap-3">
            <span className="text-3xl hidden sm:inline">🎯</span>
            <div>
              <h1 className="text-lg sm:text-2xl font-bold text-white">ANÁLISE DE CORTE</h1>
              <p className="text-orange-100 text-xs sm:text-sm">Relevância de produtos por Faturamento, Volume e Contribuição</p>
            </div>
          </div>
        </div>

        {/* Filtros */}
        <div className="bg-white border-b p-4 shadow-sm">
          {/* Linha 1: Loja, Seção, Grupo, Subgrupo, Segmento - todos na mesma linha */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 mb-3">
            <div>
              <label className="text-xs font-bold text-gray-600 block mb-1">Loja</label>
              <select value={codLoja} onChange={e => setCodLoja(e.target.value)}
                className="w-full border rounded px-2 py-1.5 text-sm">
                <option value="">Selecione...</option>
                {lojas.map(l => <option key={l.COD_LOJA} value={l.COD_LOJA}>{l.COD_LOJA} - {l.DES_LOJA}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-bold text-gray-600 block mb-1">Seção</label>
              <select value={codSecao} onChange={e => setCodSecao(e.target.value)}
                className="w-full border rounded px-2 py-1.5 text-sm">
                <option value="">Selecione...</option>
                {secoes.map(s => <option key={s.COD_SECAO} value={s.COD_SECAO}>{s.COD_SECAO} - {s.DES_SECAO}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-bold text-gray-600 block mb-1">Grupo</label>
              <select value={codGrupo} onChange={e => setCodGrupo(e.target.value)}
                className="w-full border rounded px-2 py-1.5 text-sm" disabled={!codSecao}>
                <option value="">Todos</option>
                {grupos.map(g => <option key={g.COD_GRUPO} value={g.COD_GRUPO}>{g.COD_GRUPO} - {g.DES_GRUPO}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-bold text-gray-600 block mb-1">Subgrupo</label>
              <select value={codSubGrupo} onChange={e => setCodSubGrupo(e.target.value)}
                className="w-full border rounded px-2 py-1.5 text-sm" disabled={!codGrupo}>
                <option value="">Todos</option>
                {subgrupos.map(sg => <option key={sg.COD_SUB_GRUPO} value={sg.COD_SUB_GRUPO}>{sg.COD_SUB_GRUPO} - {sg.DES_SUB_GRUPO}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-bold text-gray-600 block mb-1">Segmento</label>
              <select value={codSegmento} onChange={e => setCodSegmento(e.target.value)}
                className="w-full border rounded px-2 py-1.5 text-sm" disabled={!codSecao}>
                <option value="">Todos</option>
                {segmentos.map(s => <option key={s.COD_SEGMENTO} value={s.COD_SEGMENTO}>{s.DES_SEGMENTO}</option>)}
              </select>
            </div>
          </div>

          {/* Linha 2: Datas + Diagnóstico + Pesos + Botão */}
          <div className="flex gap-3 items-end flex-wrap">
            <div>
              <label className="text-xs font-bold text-gray-600 block mb-1">Início</label>
              <input type="date" value={dataInicio} onChange={e => setDataInicio(e.target.value)}
                className="border rounded px-2 py-1.5 text-sm" />
            </div>
            <div>
              <label className="text-xs font-bold text-gray-600 block mb-1">Fim</label>
              <input type="date" value={dataFim} onChange={e => setDataFim(e.target.value)}
                className="border rounded px-2 py-1.5 text-sm" />
            </div>
            <div className="border-l pl-3 ml-1">
              <label className="text-xs font-bold text-red-600 block mb-1">LINHA DE CORTE</label>
              <div className="flex items-center gap-1">
                <input type="number" value={diagnostico} onChange={e => setDiagnostico(Number(e.target.value))}
                  className="border rounded px-2 py-1.5 text-sm w-16 text-center font-bold" min={0} max={100} />
                <span className="text-xs text-gray-500">%</span>
              </div>
            </div>
            <div>
              <label className="text-xs font-bold text-blue-600 block mb-1">Faturamento R$</label>
              <div className="flex items-center gap-1">
                <input type="number" value={pesoFat} onChange={e => setPesoFat(Number(e.target.value))}
                  className="border rounded px-2 py-1.5 text-sm w-16 text-center" min={0} max={100} />
                <span className="text-xs text-gray-500">%</span>
              </div>
            </div>
            <div>
              <label className="text-xs font-bold text-purple-600 block mb-1">Volume em QTD</label>
              <div className="flex items-center gap-1">
                <input type="number" value={pesoVol} onChange={e => setPesoVol(Number(e.target.value))}
                  className="border rounded px-2 py-1.5 text-sm w-16 text-center" min={0} max={100} />
                <span className="text-xs text-gray-500">%</span>
              </div>
            </div>
            <div>
              <label className="text-xs font-bold text-green-600 block mb-1">Margem %</label>
              <div className="flex items-center gap-1">
                <input type="number" value={pesoCont} onChange={e => setPesoCont(Number(e.target.value))}
                  className="border rounded px-2 py-1.5 text-sm w-16 text-center" min={0} max={100} />
                <span className="text-xs text-gray-500">%</span>
              </div>
            </div>
            <div className="border-l pl-3 ml-1">
              <label className="text-xs font-bold text-gray-600 block mb-1">Mín. Dias Cadastrado</label>
              <div className="flex items-center gap-1">
                <input type="number" value={minDiasCadastro} onChange={e => setMinDiasCadastro(Number(e.target.value))}
                  className="border rounded px-2 py-1.5 text-sm w-16 text-center" min={0} />
                <span className="text-xs text-gray-500">dias</span>
              </div>
            </div>
            <div className="border-l pl-3 ml-1 flex flex-col gap-1">
              <label className="flex items-center gap-1.5 cursor-pointer text-xs">
                <input type="checkbox" checked={ocultarForaMix} onChange={e => setOcultarForaMix(e.target.checked)}
                  className="rounded text-orange-500 focus:ring-orange-400 w-3.5 h-3.5" />
                <span className="text-gray-700 font-medium">Ocultar Fora do Mix</span>
              </label>
              <label className="flex items-center gap-1.5 cursor-pointer text-xs">
                <input type="checkbox" checked={ocultarForaLinha} onChange={e => setOcultarForaLinha(e.target.checked)}
                  className="rounded text-orange-500 focus:ring-orange-400 w-3.5 h-3.5" />
                <span className="text-gray-700 font-medium">Ocultar Fora de Linha</span>
              </label>
            </div>
            <button
              onClick={buscarDados}
              disabled={loading}
              className="bg-orange-500 hover:bg-orange-600 text-white px-6 py-1.5 rounded font-bold text-sm disabled:opacity-50"
            >
              {loading ? 'Buscando...' : 'Aplicar'}
            </button>
            <button
              onClick={abrirPadraoModal}
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-1.5 rounded font-bold text-sm"
              title="Configurar pesos padrão por Seção/Grupo/Subgrupo"
            >
              ⚙️ Padrão %
            </button>
            <button
              onClick={exportarPDF}
              disabled={!filteredRows.length}
              className="bg-red-600 hover:bg-red-700 text-white px-4 py-1.5 rounded font-bold text-sm disabled:opacity-50"
            >
              📄 PDF
            </button>
            <span className="ml-auto text-xs font-bold text-orange-600">{filteredRows.length > 0 ? `${filteredRows.length} registros` : ''}</span>
          </div>
        </div>

        {/* Loading */}
        {loading && (
          <div className="flex justify-center items-center py-20">
            <RadarLoading />
          </div>
        )}

        {/* Tabela */}
        {!loading && filteredRows.length > 0 && (
          <div className="p-3">
            {/* Botão engrenagem + painel de colunas */}
            <div className="flex items-center justify-between mb-2">
              <div className="text-xs text-gray-500">{activeCols.length} de {ALL_COLUMNS.length} colunas visíveis &middot; Arraste os cabeçalhos para reordenar</div>
              <div className="relative" ref={colConfigRef}>
                <button
                  onClick={() => setShowColConfig(!showColConfig)}
                  className="flex items-center gap-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 px-3 py-1.5 rounded-lg text-sm font-medium border"
                  title="Configurar colunas"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                  Colunas
                </button>
                {showColConfig && (
                  <div className="absolute right-0 top-full mt-1 bg-white border rounded-lg shadow-xl z-50 w-full sm:w-[340px] max-h-[480px] overflow-y-auto p-3">
                    <div className="flex justify-between items-center mb-2 pb-2 border-b">
                      <span className="font-bold text-sm text-gray-700">Configurar Colunas</span>
                      <button onClick={resetCols} className="text-xs text-orange-600 hover:underline font-medium">Restaurar padrão</button>
                    </div>
                    {['Produto', 'Vendas', 'Financeiro', 'Ponderação'].map(group => {
                      const groupCols = ALL_COLUMNS.filter(c => c.group === group);
                      const allOn = groupCols.every(c => visibleCols.includes(c.id));
                      const someOn = groupCols.some(c => visibleCols.includes(c.id));
                      return (
                        <div key={group} className="mb-2">
                          <label className="flex items-center gap-2 cursor-pointer mb-1">
                            <input type="checkbox" checked={allOn} ref={el => { if (el) el.indeterminate = someOn && !allOn; }}
                              onChange={() => toggleGroup(group)}
                              className="rounded text-orange-500 focus:ring-orange-400" />
                            <span className="text-xs font-bold text-gray-800 uppercase">{group}</span>
                          </label>
                          <div className="ml-5 grid grid-cols-2 gap-x-2 gap-y-0.5">
                            {groupCols.map(col => (
                              <label key={col.id} className="flex items-center gap-1.5 cursor-pointer text-xs text-gray-600 hover:text-gray-900">
                                <input type="checkbox" checked={visibleCols.includes(col.id)} onChange={() => toggleCol(col.id)}
                                  className="rounded text-orange-500 focus:ring-orange-400 w-3.5 h-3.5" />
                                {col.label}
                              </label>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            <div className="overflow-x-auto border rounded-lg shadow">
              <table className="text-sm w-full">
                <thead>
                  <tr className="bg-gray-600 text-white">
                    {activeCols.map((col) => (
                      <th key={col.id}
                        draggable
                        onDragStart={(e) => onDragStartCol(e, col.id)}
                        onDragOver={onDragOverCol}
                        onDrop={(e) => onDropCol(e, col.id)}
                        className={`px-4 py-2.5 whitespace-nowrap cursor-grab active:cursor-grabbing select-none
                          ${col.align === 'right' ? 'text-right' : col.align === 'center' ? 'text-center' : 'text-left'}
                          ${col.borderL === true ? 'border-l-2 border-green-900' : col.borderL === 'thin' ? 'border-l border-green-900' : ''}
                          ${col.sticky ? 'sticky left-0 bg-gray-600 z-10' : ''}
                          ${(col.id === 'PONDERACAO' || col.id === 'ACUMULADO') ? 'font-bold' : ''}
                        `}
                        style={{ minWidth: col.minW }}
                      >
                        {col.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredRows.map((row, idx) => {
                    const isVerde = row.COR === 'verde';
                    const bgClass = isVerde ? 'bg-green-50 hover:bg-green-100' : 'bg-red-50 hover:bg-red-100';
                    const isTransicao = idx > 0 && filteredRows[idx - 1]?.COR === 'verde' && row.COR === 'vermelho';

                    return (
                      <React.Fragment key={row.COD_PRODUTO + '-' + idx}>
                        {isTransicao && (
                          <tr><td colSpan={activeCols.length} className="bg-gray-800 h-1.5"></td></tr>
                        )}
                        <tr className={`${bgClass} border-b border-gray-200`}>
                          {activeCols.map((col) => {
                            // Coluna PAPEL: render especial
                            if (col.id === 'PAPEL') {
                              return (
                                <td key={col.id} className="px-4 py-2 text-center">
                                  <span className={`px-2 py-0.5 rounded text-white text-[11px] font-bold ${
                                    row.PAPEL === 'D' ? 'bg-blue-600' : row.PAPEL === 'R' ? 'bg-yellow-500' : 'bg-gray-400'
                                  }`}>{row.PAPEL}</span>
                                </td>
                              );
                            }
                            // Colunas FORA_MIX e FORA_LINHA: checkbox visual
                            if (col.id === 'FORA_MIX' || col.id === 'FORA_LINHA') {
                              const val = col.id === 'FORA_MIX' ? row.FORA_MIX : row.FORA_LINHA;
                              const isSim = val === 'S';
                              return (
                                <td key={col.id} className="px-4 py-2 text-center">
                                  <span className={`inline-block w-5 h-5 rounded border-2 text-center leading-5 text-xs font-bold ${
                                    isSim ? 'bg-red-500 border-red-600 text-white' : 'bg-white border-gray-300 text-transparent'
                                  }`}>{isSim ? 'S' : ''}</span>
                                </td>
                              );
                            }
                            // Coluna DESCRICAO: truncate
                            if (col.id === 'DESCRICAO') {
                              return (
                                <td key={col.id} className="px-4 py-2 font-semibold truncate max-w-[300px]" title={row.DESCRICAO}>
                                  {row.DESCRICAO}
                                </td>
                              );
                            }
                            const extraClass = getCellExtraClass(col.id, row);
                            const isSticky = col.sticky;
                            return (
                              <td key={col.id}
                                className={`px-4 py-2 font-mono
                                  ${col.align === 'right' ? 'text-right' : col.align === 'center' ? 'text-center' : 'text-left'}
                                  ${col.borderL === true ? 'border-l-2 border-gray-300' : col.borderL === 'thin' ? 'border-l border-gray-300' : ''}
                                  ${isSticky ? `sticky left-0 z-10 ${isVerde ? 'bg-green-50' : 'bg-red-50'} text-gray-500` : ''}
                                  ${extraClass}
                                `}
                              >
                                {getCellValue(col, row, idx, dataFim)}
                              </td>
                            );
                          })}
                        </tr>
                      </React.Fragment>
                    );
                  })}
                </tbody>
                {totais && (
                  <tfoot>
                    <tr className="bg-green-700 text-white font-bold text-sm">
                      {activeCols.map((col) => {
                        const val = getTotalValue(col, totais);
                        const isSticky = col.sticky;
                        return (
                          <td key={col.id}
                            className={`px-4 py-2.5 font-mono
                              ${col.align === 'right' ? 'text-right' : col.align === 'center' ? 'text-center' : 'text-left'}
                              ${col.borderL === true ? 'border-l-2 border-green-900' : col.borderL === 'thin' ? 'border-l border-green-900' : ''}
                              ${isSticky ? 'sticky left-0 bg-green-700 z-10' : ''}
                              ${col.id === 'DESCRICAO' ? 'font-bold' : ''}
                            `}
                          >
                            {val}
                          </td>
                        );
                      })}
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>

            {/* Legenda */}
            <div className="mt-3 flex flex-col sm:flex-row flex-wrap gap-3 sm:gap-6 text-xs text-gray-600">
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 bg-green-200 border border-green-400 rounded"></div>
                <span>Acumulado &le; {diagnostico}% (dentro do diagnóstico)</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 bg-red-200 border border-red-400 rounded"></div>
                <span>Acumulado &gt; {diagnostico}% (fora do diagnóstico)</span>
              </div>
              <div className="flex items-center gap-2 sm:ml-4">
                <span className="px-1.5 py-0.5 rounded text-white text-[10px] font-bold bg-blue-600">D</span>
                <span>Destaque (&le;50%)</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="px-1.5 py-0.5 rounded text-white text-[10px] font-bold bg-yellow-500">R</span>
                <span>Regular (&le;80%)</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="px-1.5 py-0.5 rounded text-white text-[10px] font-bold bg-gray-400">C</span>
                <span>Complementar (&gt;80%)</span>
              </div>
            </div>
          </div>
        )}

        {/* Estado vazio */}
        {!loading && filteredRows.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 text-gray-400">
            <svg className="w-16 h-16 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
            <p className="text-lg font-semibold">Selecione Loja e Seção</p>
            <p className="text-sm">Clique em "Aplicar" para ver a análise de ponderação</p>
          </div>
        )}
      </div>

      {/* Modal PADRÃO % */}
      {showPadraoModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center" onClick={() => setShowPadraoModal(false)}>
          <div className="bg-white rounded-lg shadow-2xl w-full max-w-5xl mx-4 max-h-[90vh] overflow-hidden flex flex-col" onClick={e => e.stopPropagation()}>
            {/* Header */}
            <div className="bg-gradient-to-r from-blue-600 to-blue-700 p-4 flex justify-between items-center text-white shrink-0">
              <div>
                <h2 className="text-lg font-bold">⚙️ PADRÃO DE PESOS POR SUBGRUPO</h2>
                <p className="text-blue-200 text-xs mt-0.5">Configure os pesos padrão de Faturamento, Volume e Margem para cada subgrupo</p>
              </div>
              <button onClick={() => setShowPadraoModal(false)} className="text-white hover:text-gray-200">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Busca + ações */}
            <div className="px-4 py-3 border-b flex items-center gap-3 flex-wrap shrink-0">
              <input
                type="text"
                value={hierarquiaBusca}
                onChange={e => setHierarquiaBusca(e.target.value)}
                placeholder="🔍 Buscar seção, grupo ou subgrupo..."
                className="flex-1 min-w-0 sm:min-w-[200px] border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
              <button
                onClick={buscarSugestao}
                disabled={sugestaoLoading || !codLoja}
                className="bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white px-4 py-2 rounded-lg font-bold text-sm flex items-center gap-1.5"
                title="Analisar dados de vendas do ano anterior e sugerir pesos ideais"
              >
                {sugestaoLoading ? (
                  <>
                    <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                    Analisando...
                  </>
                ) : '🤖 Sugerir Pesos'}
              </button>
              <span className="text-xs text-gray-500">{Object.keys(padraoConfig).length} configurado(s)</span>
              <button
                onClick={() => { if (confirm('Limpar todas as configurações de pesos?')) { setPadraoConfig({}); setSugestaoData(null); } }}
                className="text-xs text-red-500 hover:text-red-700 font-medium"
              >
                Limpar Tudo
              </button>
            </div>

            {/* Conteúdo com scroll */}
            <div className="flex-1 overflow-y-auto p-4">
              {hierarquiaLoading ? (
                <div className="flex justify-center py-10"><RadarLoading /></div>
              ) : hierarquiaTree.length === 0 ? (
                <p className="text-center text-gray-400 py-10">Nenhum dado encontrado</p>
              ) : (
                <div className="space-y-2">
                  {hierarquiaTree.map(secao => {
                    const secExpanded = hierarquiaExpandedSecoes[secao.cod] !== false; // aberto por padrão
                    return (
                      <div key={secao.cod} className="border rounded-lg overflow-hidden">
                        {/* Seção header */}
                        <button
                          onClick={() => setHierarquiaExpandedSecoes(prev => ({ ...prev, [secao.cod]: !secExpanded }))}
                          className="w-full flex items-center justify-between px-4 py-2.5 bg-orange-50 hover:bg-orange-100 text-left transition-colors"
                        >
                          <div className="flex items-center gap-2">
                            <svg className={`w-4 h-4 text-orange-500 transition-transform ${secExpanded ? 'rotate-90' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                            </svg>
                            <span className="text-sm font-bold text-orange-700">{secao.cod} - {secao.des}</span>
                          </div>
                          <span className="text-xs text-orange-500">{secao.grupos.length} grupo(s)</span>
                        </button>

                        {/* Grupos */}
                        {secExpanded && (
                          <div className="pl-4">
                            {secao.grupos.map(grupo => {
                              const grpKey = `${secao.cod}-${grupo.cod}`;
                              const grpExpanded = hierarquiaExpandedGrupos[grpKey] !== false;
                              return (
                                <div key={grupo.cod} className="border-t">
                                  {/* Grupo header */}
                                  <button
                                    onClick={() => setHierarquiaExpandedGrupos(prev => ({ ...prev, [grpKey]: !grpExpanded }))}
                                    className="w-full flex items-center justify-between px-4 py-2 bg-blue-50 hover:bg-blue-100 text-left transition-colors"
                                  >
                                    <div className="flex items-center gap-2">
                                      <svg className={`w-3.5 h-3.5 text-blue-500 transition-transform ${grpExpanded ? 'rotate-90' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                      </svg>
                                      <span className="text-sm font-semibold text-blue-700">{grupo.cod} - {grupo.des}</span>
                                    </div>
                                    <span className="text-xs text-blue-500">{grupo.subgrupos.length} subgrupo(s)</span>
                                  </button>

                                  {/* Subgrupos */}
                                  {grpExpanded && (
                                    <div className="bg-white">
                                      {grupo.subgrupos.map(sg => {
                                        const sgKey = `${secao.cod}-${grupo.cod}-${sg.cod}`;
                                        const hasSegmentos = sg.segmentos && sg.segmentos.length > 0;
                                        const sgExpanded = hierarquiaExpandedSubgrupos[sgKey] !== false;

                                        // Renderizar linha de inputs para um item (segmento ou subgrupo sem segmentos)
                                        const renderPesoRow = (codSeg, label, bgClass) => {
                                          const cfgKey = `${secao.cod}-${grupo.cod}-${sg.cod}-${codSeg}`;
                                          const cfg = padraoConfig[cfgKey] || { fat: '', vol: '', cont: '' };
                                          const soma = (Number(cfg.fat) || 0) + (Number(cfg.vol) || 0) + (Number(cfg.cont) || 0);
                                          const somaOk = soma === 0 || soma === 100;
                                          return (
                                            <div key={codSeg} className={`grid grid-cols-12 gap-2 px-4 py-1.5 border-t items-center ${!somaOk ? 'bg-red-50' : bgClass || 'hover:bg-gray-50'}`}>
                                              <div className="col-span-4 text-sm text-gray-700 truncate" title={label}>
                                                {label}
                                                {!somaOk && <span className="text-red-500 text-xs ml-2">({soma}%)</span>}
                                              </div>
                                              <div className="col-span-2 text-center">
                                                {sugestaoData?.[cfgKey] ? (
                                                  <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-bold text-white ${
                                                    sugestaoData[cfgKey].PERFIL === 'FATURAMENTO' ? 'bg-blue-500' :
                                                    sugestaoData[cfgKey].PERFIL === 'VOLUME' ? 'bg-purple-500' :
                                                    sugestaoData[cfgKey].PERFIL === 'MARGEM' ? 'bg-green-500' :
                                                    'bg-gray-500'
                                                  }`}>
                                                    {sugestaoData[cfgKey].PERFIL === 'FATURAMENTO' ? 'FAT' :
                                                     sugestaoData[cfgKey].PERFIL === 'VOLUME' ? 'VOL' :
                                                     sugestaoData[cfgKey].PERFIL === 'MARGEM' ? 'MG' : 'EQ'}
                                                  </span>
                                                ) : (
                                                  <span className="text-gray-300 text-xs">—</span>
                                                )}
                                              </div>
                                              <div className="col-span-2">
                                                <input type="number" value={cfg.fat}
                                                  onChange={e => setPadraoPeso(secao.cod, grupo.cod, sg.cod, codSeg, 'fat', e.target.value)}
                                                  placeholder="35" min={0} max={100}
                                                  className="w-full border rounded px-2 py-1 text-sm text-center focus:ring-2 focus:ring-blue-400 focus:outline-none" />
                                              </div>
                                              <div className="col-span-2">
                                                <input type="number" value={cfg.vol}
                                                  onChange={e => setPadraoPeso(secao.cod, grupo.cod, sg.cod, codSeg, 'vol', e.target.value)}
                                                  placeholder="35" min={0} max={100}
                                                  className="w-full border rounded px-2 py-1 text-sm text-center focus:ring-2 focus:ring-purple-400 focus:outline-none" />
                                              </div>
                                              <div className="col-span-2">
                                                <input type="number" value={cfg.cont}
                                                  onChange={e => setPadraoPeso(secao.cod, grupo.cod, sg.cod, codSeg, 'cont', e.target.value)}
                                                  placeholder="30" min={0} max={100}
                                                  className="w-full border rounded px-2 py-1 text-sm text-center focus:ring-2 focus:ring-green-400 focus:outline-none" />
                                              </div>
                                            </div>
                                          );
                                        };

                                        return (
                                          <div key={sg.cod}>
                                            {hasSegmentos ? (
                                              <>
                                                {/* Subgrupo como header expansível (tem segmentos) */}
                                                <button
                                                  onClick={() => setHierarquiaExpandedSubgrupos(prev => ({ ...prev, [sgKey]: !sgExpanded }))}
                                                  className="w-full flex items-center justify-between px-4 py-1.5 bg-green-50 hover:bg-green-100 text-left transition-colors border-t"
                                                >
                                                  <div className="flex items-center gap-2">
                                                    <svg className={`w-3 h-3 text-green-500 transition-transform ${sgExpanded ? 'rotate-90' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                                    </svg>
                                                    <span className="text-xs font-semibold text-green-700">{sg.cod} - {sg.des}</span>
                                                  </div>
                                                  <span className="text-[10px] text-green-500">{sg.segmentos.length} segmento(s)</span>
                                                </button>
                                                {/* Segmentos */}
                                                {sgExpanded && (
                                                  <div className="pl-4 bg-white">
                                                    <div className="grid grid-cols-12 gap-2 px-4 py-1 bg-gray-100 text-[10px] font-bold text-gray-500 border-t">
                                                      <div className="col-span-4">Segmento</div>
                                                      <div className="col-span-2 text-center">Perfil</div>
                                                      <div className="col-span-2 text-center">Fat. %</div>
                                                      <div className="col-span-2 text-center">Vol. %</div>
                                                      <div className="col-span-2 text-center">Mg. %</div>
                                                    </div>
                                                    {sg.segmentos.map(seg =>
                                                      renderPesoRow(seg.cod, `${seg.cod} - ${seg.des}`, 'hover:bg-green-50')
                                                    )}
                                                    {/* Linha "Sem segmento" para produtos sem classificação */}
                                                    {renderPesoRow(0, 'SEM SEGMENTO', 'bg-gray-50 hover:bg-gray-100')}
                                                  </div>
                                                )}
                                              </>
                                            ) : (
                                              <>
                                                {/* Subgrupo sem segmentos: inputs diretos (codSeg=0) */}
                                                <div className="grid grid-cols-12 gap-2 px-4 py-1 bg-gray-100 text-[10px] font-bold text-gray-500 border-t first:border-t-0">
                                                  <div className="col-span-4">Subgrupo</div>
                                                  <div className="col-span-2 text-center">Perfil</div>
                                                  <div className="col-span-2 text-center">Fat. %</div>
                                                  <div className="col-span-2 text-center">Vol. %</div>
                                                  <div className="col-span-2 text-center">Mg. %</div>
                                                </div>
                                                {renderPesoRow(0, `${sg.cod} - ${sg.des}`)}
                                              </>
                                            )}
                                          </div>
                                        );
                                      })}
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="border-t px-4 py-3 bg-gray-50 flex justify-between items-center shrink-0">
              <p className="text-xs text-gray-500">Os pesos salvos serão aplicados automaticamente ao selecionar Seção/Grupo/Subgrupo nos filtros</p>
              <button
                onClick={() => setShowPadraoModal(false)}
                className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold text-sm"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
