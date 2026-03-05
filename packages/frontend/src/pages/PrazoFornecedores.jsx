import React, { useState, useEffect, useRef } from 'react';
import Layout from '../components/Layout';
import RadarLoading from '../components/RadarLoading';
import api from '../services/api';
import { useLoja } from '../contexts/LojaContext';

// IDs das colunas reordenáveis (expand fica fixo)
const DEFAULT_COL_ORDER = ['fornecedor', 'contato', 'celular', 'nNota', 'valor', 'prazo', 'prazoSistema', 'combinado', 'formaPgto', 'tipoNf', 'classificacao', 'prazoMedio', 'pago', 'prazoReal', 'dtaPago'];
const COL_ORDER_KEY = 'prazo-fornecedores-col-order';

const formatCurrency = (value) => {
  if (value == null) return '-';
  return Number(value).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
};

const formatWhatsAppUrl = (phone) => {
  if (!phone) return null;
  const digits = String(phone).replace(/\D/g, '');
  if (digits.length < 10) return null;
  const num = digits.startsWith('55') ? digits : '55' + digits;
  return `https://web.whatsapp.com/send?phone=${num}`;
};

// Classificação de prazo - cores bem distintas entre cada nível
const getClassificacao = (prazoMedio) => {
  if (prazoMedio == null || prazoMedio <= 0) return { label: '-', bg: 'bg-gray-100', text: 'text-gray-400' };
  if (prazoMedio <= 1) return { label: 'PÉSSIMO', bg: 'bg-red-600', text: 'text-white' };
  if (prazoMedio <= 7) return { label: 'RUIM', bg: 'bg-orange-500', text: 'text-white' };
  if (prazoMedio <= 14) return { label: 'REGULAR', bg: 'bg-yellow-400', text: 'text-yellow-900' };
  if (prazoMedio <= 21) return { label: 'BOM', bg: 'bg-blue-500', text: 'text-white' };
  if (prazoMedio <= 31) return { label: 'ÓTIMO', bg: 'bg-green-500', text: 'text-white' };
  return { label: 'EXCELENTE', bg: 'bg-purple-600', text: 'text-white' };
};

const legendaClassificacao = [
  { faixa: '0 a 1 dia', label: 'PÉSSIMO', bg: 'bg-red-600', text: 'text-white' },
  { faixa: '2 a 7 dias', label: 'RUIM', bg: 'bg-orange-500', text: 'text-white' },
  { faixa: '7 a 14 dias', label: 'REGULAR', bg: 'bg-yellow-400', text: 'text-yellow-900' },
  { faixa: '15 a 21 dias', label: 'BOM', bg: 'bg-blue-500', text: 'text-white' },
  { faixa: '22 a 31 dias', label: 'ÓTIMO', bg: 'bg-green-500', text: 'text-white' },
  { faixa: 'Acima de 31', label: 'EXCELENTE', bg: 'bg-purple-600', text: 'text-white' },
];

export default function PrazoFornecedores() {
  const { lojaSelecionada } = useLoja();
  const [fornecedores, setFornecedores] = useState([]);
  const [resumo, setResumo] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [expandedFornecedor, setExpandedFornecedor] = useState(null);
  const [expandedNota, setExpandedNota] = useState(null);
  const [notaItens, setNotaItens] = useState({});
  const [loadingItens, setLoadingItens] = useState({});
  const [busca, setBusca] = useState('');
  const [sortConfig, setSortConfig] = useState({ key: 'PRAZO_MEDIO', direction: 'desc' });
  const [maisRecentes, setMaisRecentes] = useState(false);
  const [showLegenda, setShowLegenda] = useState(false);
  const [filtroClassif, setFiltroClassif] = useState(null); // null = todos, ou 'PÉSSIMO', 'RUIM', etc.
  const [filtroFormaPgto, setFiltroFormaPgto] = useState([]); // array de formas selecionadas
  const [showFormaPgto, setShowFormaPgto] = useState(false);
  const [filtroCombinado, setFiltroCombinado] = useState(null); // null, 'fora', 'dentro'
  const [filtroMelhorPrazo, setFiltroMelhorPrazo] = useState(false); // filtro card oportunidade
  const [mesesHistorico, setMesesHistorico] = useState(6); // Histórico de fornecedores alternativos
  const [prazoSimulado, setPrazoSimulado] = useState(''); // Simulação de prazo
  const [altPopup, setAltPopup] = useState(null); // { codProduto, desProduto, data, loading }

  // Ordem das colunas (drag-and-drop) com persistência em localStorage
  const [colOrder, setColOrder] = useState(() => {
    try {
      const saved = localStorage.getItem(COL_ORDER_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        // Validar: deve conter exatamente as mesmas colunas
        if (Array.isArray(parsed) && parsed.length === DEFAULT_COL_ORDER.length &&
            DEFAULT_COL_ORDER.every(c => parsed.includes(c))) {
          return parsed;
        }
      }
    } catch {}
    return DEFAULT_COL_ORDER;
  });
  const dragCol = useRef(null);
  const dragOverCol = useRef(null);

  const handleDragStart = (idx) => { dragCol.current = idx; };
  const handleDragOver = (e, idx) => { e.preventDefault(); dragOverCol.current = idx; };
  const handleDrop = () => {
    const from = dragCol.current;
    const to = dragOverCol.current;
    if (from == null || to == null || from === to) return;
    const newOrder = [...colOrder];
    const [moved] = newOrder.splice(from, 1);
    newOrder.splice(to, 0, moved);
    setColOrder(newOrder);
    localStorage.setItem(COL_ORDER_KEY, JSON.stringify(newOrder));
    dragCol.current = null;
    dragOverCol.current = null;
  };

  // Filtro de data: padrão 01/jan do ano vigente até hoje
  const anoAtual = new Date().getFullYear();
  const [dataInicio, setDataInicio] = useState(`${anoAtual}-01-01`);
  const [dataFim, setDataFim] = useState(new Date().toISOString().slice(0, 10));

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        setError(null);
        const params = {};
        if (lojaSelecionada?.codigo) params.codLoja = lojaSelecionada.codigo;
        if (dataInicio) params.dataInicio = dataInicio;
        if (dataFim) params.dataFim = dataFim;
        if (mesesHistorico) params.meses = mesesHistorico;

        const response = await api.get('/prazo-fornecedores', { params });
        setFornecedores(response.data.fornecedores || []);
        setResumo(response.data.resumo || {});
      } catch (err) {
        console.error('Erro ao carregar prazos:', err);
        setError(err.message || 'Erro ao carregar dados');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [lojaSelecionada, dataInicio, dataFim, mesesHistorico]);

  const toggleFornecedor = (cod) => {
    setExpandedFornecedor(expandedFornecedor === cod ? null : cod);
    setExpandedNota(null);
  };

  const toggleNota = async (codFornecedor, numNf, prazoMedio, e) => {
    e.stopPropagation();
    const notaKey = `${codFornecedor}_${numNf}`;
    if (expandedNota === notaKey) {
      setExpandedNota(null);
      return;
    }
    setExpandedNota(notaKey);

    // Se já carregou os itens, não busca de novo
    if (notaItens[notaKey]) return;

    try {
      setLoadingItens((prev) => ({ ...prev, [notaKey]: true }));
      const params = { codFornecedor, numNf, prazoAtual: prazoMedio || 0, meses: mesesHistorico };
      if (lojaSelecionada?.codigo) params.codLoja = lojaSelecionada.codigo;
      const response = await api.get('/prazo-fornecedores/itens-nota', { params });
      setNotaItens((prev) => ({ ...prev, [notaKey]: response.data.itens || [] }));
    } catch (err) {
      console.error('Erro ao carregar itens da nota:', err);
      setNotaItens((prev) => ({ ...prev, [notaKey]: [] }));
    } finally {
      setLoadingItens((prev) => ({ ...prev, [notaKey]: false }));
    }
  };

  const fetchAlternativos = async (codProduto, desProduto, codFornecedor, prazoAtual, e) => {
    e.stopPropagation();
    if (altPopup && altPopup.codProduto === codProduto && altPopup.codFornecedor === codFornecedor) {
      setAltPopup(null);
      return;
    }
    setAltPopup({ codProduto, desProduto, codFornecedor, prazoAtual, data: [], loading: true });
    try {
      const params = { codProduto, codFornecedorAtual: codFornecedor, meses: mesesHistorico };
      if (lojaSelecionada?.codigo) params.codLoja = lojaSelecionada.codigo;
      const response = await api.get('/prazo-fornecedores/fornecedores-alternativos', { params });
      const alts = (response.data.fornecedores || []).filter(f => f.PRAZO_MEDIO > prazoAtual);
      setAltPopup(prev => prev ? { ...prev, data: alts, loading: false } : null);
    } catch (err) {
      console.error('Erro ao buscar fornecedores alternativos:', err);
      setAltPopup(prev => prev ? { ...prev, data: [], loading: false } : null);
    }
  };

  const handleSort = (key) => {
    setMaisRecentes(false);
    let direction = 'desc';
    if (sortConfig.key === key && sortConfig.direction === 'desc') {
      direction = 'asc';
    }
    setSortConfig({ key, direction });
  };

  const toggleMaisRecentes = () => {
    setMaisRecentes(!maisRecentes);
  };

  const sortIndicator = (key) => (
    <span className="ml-1 text-xs">
      {sortConfig.key === key ? (
        sortConfig.direction === 'asc' ? '▲' : '▼'
      ) : (
        <span className="text-gray-300">⇅</span>
      )}
    </span>
  );

  // Extrair formas de pagamento únicas com contagem, % do valor total e prazo médio
  const todasNotas = fornecedores.flatMap(f => f.notas || []);
  const valorTotalGeral = todasNotas.reduce((s, n) => s + (n.VAL_TOTAL_NF || 0), 0);
  const formasPgtoStats = {};
  for (const nota of todasNotas) {
    if (!nota.FORMA_PGTO) continue;
    if (!formasPgtoStats[nota.FORMA_PGTO]) {
      formasPgtoStats[nota.FORMA_PGTO] = { qtd: 0, valor: 0, somaPrazo: 0, qtdComPrazo: 0 };
    }
    formasPgtoStats[nota.FORMA_PGTO].qtd++;
    formasPgtoStats[nota.FORMA_PGTO].valor += (nota.VAL_TOTAL_NF || 0);
    if (nota.PRAZO_MEDIO_NF > 0) {
      formasPgtoStats[nota.FORMA_PGTO].somaPrazo += nota.PRAZO_MEDIO_NF;
      formasPgtoStats[nota.FORMA_PGTO].qtdComPrazo++;
    }
  }
  const formasPgtoUnicas = Object.keys(formasPgtoStats).sort();

  // Filtra notas de um fornecedor pela forma de pagamento selecionada
  const getNotasFiltradas = (notas) => {
    if (!notas || filtroFormaPgto.length === 0) return notas || [];
    return notas.filter(n => filtroFormaPgto.includes(n.FORMA_PGTO));
  };

  // Stats Combinado (FORA/DENTRO) - calculado sobre dados originais
  const statsCombinado = (() => {
    let fora = 0, dentro = 0;
    for (const f of fornecedores) {
      if (!f.COND_PGTO_SISTEMA || f.COND_PGTO_SISTEMA <= 0) continue;
      const notasComPrazo = (f.notas || []).filter(n => n.PRAZO_MEDIO_NF > 0);
      if (notasComPrazo.length === 0) continue;
      const temFora = notasComPrazo.some(n => n.PRAZO_MEDIO_NF < f.COND_PGTO_SISTEMA);
      if (temFora) fora++;
      else dentro++;
    }
    return { fora, dentro };
  })();

  // Stats Oportunidade de Prazo - fornecedores com alternativa de prazo melhor
  const statsOportunidade = fornecedores.filter(f => f.TEM_MELHOR_PRAZO).length;

  // Filtrar por busca + classificação + forma de pagamento + combinado + oportunidade
  const filteredFornecedores = fornecedores
    .map((f) => {
      // Quando filtro de forma pgto ativo, recalcular dados do fornecedor com notas filtradas
      if (filtroFormaPgto.length > 0) {
        const notasFiltradas = getNotasFiltradas(f.notas);
        if (notasFiltradas.length === 0) return null;
        const notasComPrazo = notasFiltradas.filter(n => n.PRAZO !== '-' && n.PRAZO_MEDIO_NF > 0);
        const prazoMedio = notasComPrazo.length > 0
          ? Math.round((notasComPrazo.reduce((s, n) => s + n.PRAZO_MEDIO_NF, 0) / notasComPrazo.length) * 10) / 10
          : 0;
        const valTotal = Math.round(notasFiltradas.reduce((s, n) => s + (n.VAL_TOTAL_NF || 0), 0) * 100) / 100;
        return {
          ...f,
          notas: notasFiltradas,
          QTD_NFS: notasFiltradas.length,
          VAL_TOTAL: valTotal,
          PRAZO_MEDIO: prazoMedio,
        };
      }
      return f;
    })
    .filter((f) => {
      if (!f) return false;
      // Filtro por combinado (FORA/DENTRO)
      if (filtroCombinado) {
        if (!f.COND_PGTO_SISTEMA || f.COND_PGTO_SISTEMA <= 0) return false;
        const notasComPrazo = (f.notas || []).filter(n => n.PRAZO_MEDIO_NF > 0);
        if (notasComPrazo.length === 0) return false;
        const temFora = notasComPrazo.some(n => n.PRAZO_MEDIO_NF < f.COND_PGTO_SISTEMA);
        if (filtroCombinado === 'fora' && !temFora) return false;
        if (filtroCombinado === 'dentro' && temFora) return false;
      }
      // Filtro por oportunidade de prazo
      if (filtroMelhorPrazo && !f.TEM_MELHOR_PRAZO) return false;
      // Filtro por classificação
      if (filtroClassif) {
        const classif = getClassificacao(f.PRAZO_MEDIO);
        if (classif.label !== filtroClassif) return false;
      }
      if (!busca) return true;
      const termo = busca.toLowerCase();
      return (
        (f.DES_FANTASIA || '').toLowerCase().includes(termo) ||
        (f.DES_FORNECEDOR || '').toLowerCase().includes(termo) ||
        (f.NUM_CGC || '').includes(termo)
      );
    });

  // Resumo dinâmico baseado nos dados filtrados (calcula prazo médio direto das notas)
  const resumoFiltrado = {
    totalFornecedores: filteredFornecedores.length,
    prazoMedioGeral: (() => {
      const notasFiltradas = filteredFornecedores.flatMap(f => f.notas || []);
      const comPrazo = notasFiltradas.filter(n => n.PRAZO_MEDIO_NF > 0);
      if (comPrazo.length === 0) return 0;
      return Math.round((comPrazo.reduce((s, n) => s + n.PRAZO_MEDIO_NF, 0) / comPrazo.length) * 10) / 10;
    })(),
    totalNFs: filteredFornecedores.reduce((s, f) => s + (f.QTD_NFS || 0), 0),
    valorTotal: Math.round(filteredFornecedores.reduce((s, f) => s + (f.VAL_TOTAL || 0), 0) * 100) / 100,
  };

  // Média diária: valor total / dias no período selecionado
  const mediaDiaria = (() => {
    if (!resumoFiltrado.valorTotal) return 0;
    const inicio = new Date(dataInicio + 'T00:00:00');
    const fim = new Date(dataFim + 'T00:00:00');
    const diffMs = fim.getTime() - inicio.getTime();
    const dias = Math.max(1, Math.round(diffMs / (1000 * 60 * 60 * 24)) + 1);
    return resumoFiltrado.valorTotal / dias;
  })();

  // Ordenar
  const sortedFornecedores = [...filteredFornecedores].sort((a, b) => {
    if (maisRecentes) {
      const parseDate = (str) => {
        if (!str) return 0;
        const [d, m, y] = str.split('/');
        return new Date(`${y}-${m}-${d}`).getTime() || 0;
      };
      return parseDate(b.DTA_ENTRADA_RECENTE) - parseDate(a.DTA_ENTRADA_RECENTE);
    }
    const aVal = a[sortConfig.key] ?? 0;
    const bVal = b[sortConfig.key] ?? 0;
    if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
    if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
    return 0;
  });

  if (loading) {
    return (
      <Layout title="Prazo Fornecedores">
        <div className="p-6 flex justify-center items-center min-h-[60vh]">
          <RadarLoading />
        </div>
      </Layout>
    );
  }

  return (
    <Layout title="Prazo Fornecedores">
      <div className="p-4 lg:p-6">
        {/* Header com Gradiente Laranja */}
        <div className="bg-gradient-to-br from-orange-500 to-red-600 rounded-lg shadow-lg p-6 mb-6 text-white">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl lg:text-3xl font-bold flex items-center gap-3">
                📋 Prazo Fornecedores
              </h1>
              <p className="text-white/90 mt-1">
                Análise dos prazos de pagamento reais das últimas 10 notas fiscais por fornecedor
              </p>
            </div>
            {/* Engrenagem com legenda */}
            <div className="relative">
              <button
                onClick={() => setShowLegenda(!showLegenda)}
                className="p-2 rounded-full hover:bg-white/20 transition-colors"
                title="Legenda de classificação"
              >
                <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </button>
              {showLegenda && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setShowLegenda(false)} />
                  <div className="absolute right-0 top-12 z-50 bg-white rounded-lg shadow-xl border border-gray-200 p-4 w-72">
                    <h3 className="text-gray-800 font-bold text-sm mb-3 flex items-center gap-2">
                      <span>📊</span> Classificação de Prazo
                    </h3>
                    <div className="space-y-2">
                      {legendaClassificacao.map((item) => (
                        <div key={item.label} className="flex items-center justify-between">
                          <span className="text-gray-600 text-xs">{item.faixa}</span>
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold ${item.bg} ${item.text}`}>
                            {item.label}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Cards de Resumo */}
        <div className="grid grid-cols-2 lg:grid-cols-7 gap-3 mb-4">
          <div className="bg-white rounded-lg shadow p-4 border-l-4 border-orange-500">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-500 uppercase">Fornecedores</p>
                <p className="text-2xl font-bold text-orange-600">{resumoFiltrado.totalFornecedores}</p>
              </div>
              <span className="text-3xl">🏭</span>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-4 border-l-4 border-blue-500">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-500 uppercase">Prazo Médio Geral</p>
                <p className="text-2xl font-bold text-blue-600">{resumoFiltrado.prazoMedioGeral} dias</p>
              </div>
              <span className="text-3xl">📅</span>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-4 border-l-4 border-green-500">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-500 uppercase">Total de NFs</p>
                <p className="text-2xl font-bold text-green-600">{resumoFiltrado.totalNFs}</p>
              </div>
              <span className="text-3xl">📄</span>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-4 border-l-4 border-purple-500">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-500 uppercase">Valor Total</p>
                <p className="text-xl font-bold text-purple-600">{formatCurrency(resumoFiltrado.valorTotal)}</p>
              </div>
              <span className="text-3xl">💰</span>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-4 border-l-4 border-teal-500">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-500 uppercase">Média Diária</p>
                <p className="text-xl font-bold text-teal-600">{formatCurrency(mediaDiaria)}</p>
              </div>
              <span className="text-3xl">📊</span>
            </div>
          </div>

          <div
            onClick={() => setFiltroCombinado(filtroCombinado === 'fora' ? null : 'fora')}
            className={`bg-white rounded-lg shadow p-4 border-l-4 border-red-500 cursor-pointer transition-all ${filtroCombinado === 'fora' ? 'ring-2 ring-red-500 shadow-lg bg-red-50' : 'hover:shadow-md'}`}
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-500 uppercase">Fora do Combinado</p>
                <p className="text-2xl font-bold text-red-600">{statsCombinado.fora}</p>
              </div>
              <span className="text-3xl">⚠️</span>
            </div>
          </div>

          <div
            onClick={() => setFiltroMelhorPrazo(!filtroMelhorPrazo)}
            className={`bg-white rounded-lg shadow p-4 border-l-4 border-cyan-500 cursor-pointer transition-all ${filtroMelhorPrazo ? 'ring-2 ring-cyan-500 shadow-lg bg-cyan-50' : 'hover:shadow-md'}`}
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-500 uppercase">Oportunidade de Prazo</p>
                <p className="text-2xl font-bold text-cyan-600">{statsOportunidade}</p>
              </div>
              <span className="text-3xl">💡</span>
            </div>
          </div>

          {/* Card Simulação de Prazo */}
          <div className="bg-white rounded-lg shadow p-4 border-l-4 border-indigo-500 col-span-2 lg:col-span-3">
            <div className="flex items-center gap-3">
              <span className="text-2xl">🧮</span>
              <div className="flex items-center gap-2 flex-1">
                <p className="text-xs text-gray-500 uppercase whitespace-nowrap">Simular Prazo:</p>
                <input
                  type="number"
                  min="1"
                  max="365"
                  value={prazoSimulado}
                  onChange={(e) => setPrazoSimulado(e.target.value)}
                  placeholder={String(resumoFiltrado.prazoMedioGeral || 19)}
                  className="w-16 px-2 py-1 border border-gray-300 rounded text-center text-sm font-bold focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                />
                <span className="text-xs text-gray-500">dias</span>
              </div>
              <div className="text-right">
                <p className="text-xs text-gray-500">Pgto Diário Estimado</p>
                <p className="text-xl font-bold text-indigo-600">
                  {formatCurrency(
                    prazoSimulado > 0 && mediaDiaria > 0 && resumoFiltrado.prazoMedioGeral > 0
                      ? mediaDiaria * (resumoFiltrado.prazoMedioGeral / Number(prazoSimulado))
                      : mediaDiaria
                  )}
                </p>
                {prazoSimulado > 0 && resumoFiltrado.prazoMedioGeral > 0 && Number(prazoSimulado) !== resumoFiltrado.prazoMedioGeral && (
                  <p className={`text-xs font-semibold ${Number(prazoSimulado) > resumoFiltrado.prazoMedioGeral ? 'text-green-600' : 'text-red-600'}`}>
                    {Number(prazoSimulado) > resumoFiltrado.prazoMedioGeral ? '▼' : '▲'}{' '}
                    {formatCurrency(Math.abs(mediaDiaria - mediaDiaria * (resumoFiltrado.prazoMedioGeral / Number(prazoSimulado))))}
                    /dia
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Barra de busca + filtros */}
        <div className="mb-4 flex items-center gap-3 flex-wrap">
          <input
            type="text"
            placeholder="Buscar fornecedor por nome ou CNPJ..."
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            className="w-full md:w-80 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
          />

          {/* Filtro de data */}
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-gray-500">De:</span>
            <input
              type="date"
              value={dataInicio}
              onChange={(e) => setDataInicio(e.target.value)}
              className="px-2 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
            />
            <span className="text-xs text-gray-500">Até:</span>
            <input
              type="date"
              value={dataFim}
              onChange={(e) => setDataFim(e.target.value)}
              className="px-2 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
            />
          </div>

          <button
            onClick={toggleMaisRecentes}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg border text-sm font-medium transition-colors ${
              maisRecentes
                ? 'bg-orange-500 text-white border-orange-500 shadow-md'
                : 'bg-white text-gray-600 border-gray-300 hover:bg-orange-50 hover:border-orange-300'
            }`}
          >
            <span className="text-base">{maisRecentes ? '🕐' : '🕐'}</span>
            Mais recentes
          </button>

          {/* Histórico de Fornecedor (meses) - usado na busca de alternativas */}
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-300 bg-white">
            <span className="text-xs text-gray-500 whitespace-nowrap">Hist. Fornecedor</span>
            <input
              type="number"
              min="1"
              max="36"
              value={mesesHistorico}
              onChange={(e) => setMesesHistorico(Math.max(1, Math.min(36, Number(e.target.value) || 6)))}
              className="w-12 px-1 py-0.5 border border-gray-200 rounded text-sm text-center font-bold text-orange-600 focus:ring-1 focus:ring-orange-500"
            />
            <span className="text-xs text-gray-500">meses</span>
          </div>

          {/* Filtro Forma de Pagamento - dropdown multi-select */}
          <div className="relative">
            <button
              onClick={() => setShowFormaPgto(!showFormaPgto)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg border text-sm font-medium transition-colors ${
                filtroFormaPgto.length > 0
                  ? 'bg-blue-500 text-white border-blue-500 shadow-md'
                  : 'bg-white text-gray-600 border-gray-300 hover:bg-blue-50 hover:border-blue-300'
              }`}
            >
              <span className="text-base">💳</span>
              Forma Pgto {filtroFormaPgto.length > 0 && `(${filtroFormaPgto.length})`}
            </button>
            {showFormaPgto && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setShowFormaPgto(false)} />
                <div className="absolute left-0 top-11 z-50 bg-white rounded-lg shadow-xl border border-gray-200 p-4 w-[600px] max-h-[500px] overflow-y-auto">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-sm font-bold text-gray-700">Forma de Pagamento</span>
                    {filtroFormaPgto.length > 0 && (
                      <button
                        onClick={() => setFiltroFormaPgto([])}
                        className="text-sm text-red-500 hover:text-red-700 font-medium"
                      >
                        Limpar
                      </button>
                    )}
                  </div>
                  {/* Header das colunas */}
                  <div className="flex items-center gap-3 py-1 px-2 mb-1 border-b border-gray-200">
                    <span className="w-4 flex-shrink-0"></span>
                    <span className="text-xs text-gray-400 font-semibold uppercase flex-1">Forma</span>
                    <span className="text-xs text-gray-400 font-semibold uppercase flex-shrink-0 w-16 text-center">NFs</span>
                    <span className="text-xs text-gray-400 font-semibold uppercase flex-shrink-0 w-16 text-center">% Valor</span>
                    <span className="text-xs text-gray-400 font-semibold uppercase flex-shrink-0 w-20 text-center">Prazo Méd</span>
                  </div>
                  {formasPgtoUnicas.length === 0 ? (
                    <p className="text-sm text-gray-400 py-2">Nenhuma forma de pagamento encontrada</p>
                  ) : (
                    formasPgtoUnicas.map((forma) => {
                      const stats = formasPgtoStats[forma] || { qtd: 0, valor: 0, somaPrazo: 0, qtdComPrazo: 0 };
                      const pct = valorTotalGeral > 0 ? ((stats.valor / valorTotalGeral) * 100) : 0;
                      const prazoMedio = stats.qtdComPrazo > 0 ? Math.round((stats.somaPrazo / stats.qtdComPrazo) * 10) / 10 : 0;
                      return (
                        <label key={forma} className="flex items-center gap-3 py-2.5 px-2 hover:bg-gray-50 rounded cursor-pointer">
                          <input
                            type="checkbox"
                            checked={filtroFormaPgto.includes(forma)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setFiltroFormaPgto([...filtroFormaPgto, forma]);
                              } else {
                                setFiltroFormaPgto(filtroFormaPgto.filter(f => f !== forma));
                              }
                            }}
                            className="w-4 h-4 rounded border-gray-300 text-blue-500 focus:ring-blue-500 flex-shrink-0"
                          />
                          <span className="text-sm text-gray-800 truncate flex-1" title={forma}>{forma}</span>
                          <span className="text-sm text-gray-600 font-medium flex-shrink-0 w-16 text-center">{stats.qtd}</span>
                          <span className={`text-sm font-bold flex-shrink-0 w-16 text-center px-2 py-0.5 rounded ${pct >= 30 ? 'bg-orange-100 text-orange-700' : pct >= 10 ? 'bg-blue-50 text-blue-600' : 'bg-gray-100 text-gray-500'}`}>{pct.toFixed(1)}%</span>
                          <span className={`text-sm font-bold flex-shrink-0 w-20 text-center px-2 py-0.5 rounded ${prazoMedio > 0 ? 'bg-yellow-100 text-yellow-700' : 'text-gray-300'}`}>{prazoMedio > 0 ? `${prazoMedio}d` : '-'}</span>
                        </label>
                      );
                    })
                  )}
                </div>
              </>
            )}
          </div>

          {/* Filtros de Classificação */}
          <div className="flex items-center gap-1.5 flex-wrap">
            {legendaClassificacao.map((item) => (
              <button
                key={item.label}
                onClick={() => setFiltroClassif(filtroClassif === item.label ? null : item.label)}
                className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all ${
                  filtroClassif === item.label
                    ? `${item.bg} ${item.text} shadow-md ring-2 ring-offset-1 ring-gray-400`
                    : `${item.bg} ${item.text} opacity-50 hover:opacity-80`
                }`}
              >
                {item.label}
              </button>
            ))}
            {filtroClassif && (
              <button
                onClick={() => setFiltroClassif(null)}
                className="px-2 py-1.5 rounded-full text-xs font-medium bg-gray-200 text-gray-600 hover:bg-gray-300"
              >
                Limpar
              </button>
            )}
          </div>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-lg mb-4">
            {error}
          </div>
        )}

        {/* Tabela com colunas reordenáveis (drag-and-drop) */}
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-600 text-white">
                <tr>
                  {/* Coluna fixa: expand */}
                  <th className="px-4 py-3 text-left font-semibold w-8"></th>
                  {/* Colunas reordenáveis */}
                  {colOrder.map((colId, idx) => {
                    const thProps = {
                      key: colId,
                      draggable: true,
                      onDragStart: () => handleDragStart(idx),
                      onDragOver: (e) => handleDragOver(e, idx),
                      onDrop: handleDrop,
                      style: { cursor: 'grab' },
                    };
                    switch (colId) {
                      case 'fornecedor':
                        return <th {...thProps} className="px-4 py-3 text-left font-semibold cursor-pointer hover:bg-gray-500 select-none" onClick={() => handleSort('DES_FANTASIA')}>Fornecedor {sortIndicator('DES_FANTASIA')}</th>;
                      case 'contato':
                        return <th {...thProps} className="px-4 py-3 text-left font-semibold select-none">Contato</th>;
                      case 'celular':
                        return <th {...thProps} className="px-4 py-3 text-left font-semibold select-none">Celular</th>;
                      case 'nNota':
                        return <th {...thProps} className="px-4 py-3 text-left font-semibold select-none">N° Nota</th>;
                      case 'valor':
                        return <th {...thProps} className="px-4 py-3 text-right font-semibold cursor-pointer hover:bg-gray-500 select-none" onClick={() => handleSort('VAL_TOTAL')}>Valor {sortIndicator('VAL_TOTAL')}</th>;
                      case 'prazo':
                        return <th {...thProps} className="px-4 py-3 text-center font-semibold select-none">Prazo</th>;
                      case 'prazoSistema':
                        return <th {...thProps} className="px-4 py-3 text-center font-semibold cursor-pointer hover:bg-gray-500 select-none" onClick={() => handleSort('COND_PGTO_SISTEMA')}>Prazo Sistema {sortIndicator('COND_PGTO_SISTEMA')}</th>;
                      case 'combinado':
                        return <th {...thProps} className="px-4 py-3 text-center font-semibold select-none">Combinado</th>;
                      case 'formaPgto':
                        return <th {...thProps} className="px-4 py-3 text-center font-semibold select-none">Forma Pgto</th>;
                      case 'tipoNf':
                        return <th {...thProps} className="px-4 py-3 text-center font-semibold select-none">Tipo</th>;
                      case 'classificacao':
                        return <th {...thProps} className="px-4 py-3 text-center font-semibold cursor-pointer hover:bg-gray-500 select-none" onClick={() => handleSort('PRAZO_MEDIO')}>Classificação {sortIndicator('PRAZO_MEDIO')}</th>;
                      case 'prazoMedio':
                        return <th {...thProps} className="px-4 py-3 text-center font-semibold cursor-pointer hover:bg-gray-500 bg-orange-700 select-none" onClick={() => handleSort('PRAZO_MEDIO')}>Prazo Médio {sortIndicator('PRAZO_MEDIO')}</th>;
                      case 'pago':
                        return <th {...thProps} className="px-4 py-3 text-center font-semibold select-none">Pago?</th>;
                      case 'prazoReal':
                        return <th {...thProps} className="px-4 py-3 text-center font-semibold select-none">Prazo Real</th>;
                      case 'dtaPago':
                        return <th {...thProps} className="px-4 py-3 text-center font-semibold select-none">Data Pago</th>;
                      default: return null;
                    }
                  })}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {sortedFornecedores.length === 0 ? (
                  <tr>
                    <td colSpan={colOrder.length + 1} className="px-4 py-8 text-center text-gray-400">
                      {busca ? 'Nenhum fornecedor encontrado com esse filtro' : 'Nenhum dado disponível'}
                    </td>
                  </tr>
                ) : (
                  sortedFornecedores.map((forn) => {
                    const isExpanded = expandedFornecedor === forn.COD_FORNECEDOR;
                    const classif = getClassificacao(forn.PRAZO_MEDIO);

                    const renderParentCell = (colId) => {
                      switch (colId) {
                        case 'fornecedor': return <td key={colId} className="px-4 py-3"><div className="font-semibold text-gray-900">{forn.DES_FANTASIA}</div>{forn.NUM_CGC && <div className="text-xs text-gray-400">{forn.NUM_CGC}</div>}</td>;
                        case 'contato': return <td key={colId} className="px-4 py-3 text-sm text-gray-600">{forn.DES_CONTATO || '-'}</td>;
                        case 'celular': {
                          const cel = forn.NUM_CELULAR || forn.NUM_FONE || '';
                          const waUrl = formatWhatsAppUrl(cel);
                          return (
                            <td key={colId} className="px-4 py-3">
                              {cel && waUrl ? (
                                <a href={waUrl} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} className="text-green-600 hover:text-green-800 hover:underline font-medium text-sm">
                                  {cel} 📱
                                </a>
                              ) : <span className="text-gray-400 text-sm">-</span>}
                            </td>
                          );
                        }
                        case 'nNota': return <td key={colId} className="px-4 py-3 text-gray-400 text-xs">{forn.QTD_NFS} notas</td>;
                        case 'valor': return <td key={colId} className="px-4 py-3 text-right font-medium text-gray-700">{formatCurrency(forn.VAL_TOTAL)}</td>;
                        case 'prazo': return <td key={colId} className="px-4 py-3"></td>;
                        case 'prazoSistema': return <td key={colId} className="px-4 py-3 text-center">{forn.COND_PGTO_SISTEMA > 0 ? <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold bg-gray-200 text-gray-700">{forn.COND_PGTO_SISTEMA}d</span> : <span className="text-gray-300">-</span>}</td>;
                        case 'combinado': {
                          if (!forn.COND_PGTO_SISTEMA || forn.COND_PGTO_SISTEMA <= 0) return <td key={colId} className="px-4 py-3 text-center"><span className="text-gray-300">-</span></td>;
                          const notasComPrazo = (forn.notas || []).filter(n => n.PRAZO_MEDIO_NF > 0);
                          if (notasComPrazo.length === 0) return <td key={colId} className="px-4 py-3 text-center"><span className="text-gray-300">-</span></td>;
                          const dentro = notasComPrazo.filter(n => n.PRAZO_MEDIO_NF >= forn.COND_PGTO_SISTEMA).length;
                          const fora = notasComPrazo.length - dentro;
                          return (
                            <td key={colId} className="px-4 py-3 text-center">
                              <div className="flex items-center justify-center gap-1.5">
                                {dentro > 0 && <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-green-100 text-green-700">{dentro} ✓</span>}
                                {fora > 0 && <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-red-100 text-red-700">{fora} ✗</span>}
                              </div>
                            </td>
                          );
                        }
                        case 'formaPgto': return <td key={colId} className="px-4 py-3"></td>;
                        case 'tipoNf': return <td key={colId} className="px-4 py-3"></td>;
                        case 'classificacao': return <td key={colId} className="px-4 py-3 text-center"><span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold ${classif.bg} ${classif.text}`}>{classif.label}</span></td>;
                        case 'prazoMedio': return <td key={colId} className="px-4 py-3 text-center"><span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-bold ${forn.PRAZO_MEDIO > 0 ? 'bg-yellow-100 text-yellow-700' : 'bg-gray-100 text-gray-400'}`}>{forn.PRAZO_MEDIO > 0 ? `${forn.PRAZO_MEDIO} dias` : '-'}</span></td>;
                        case 'pago': {
                          const notasPagas = (forn.notas || []).filter(n => n.PAGO).length;
                          const totalNotas = (forn.notas || []).length;
                          return (
                            <td key={colId} className="px-4 py-3 text-center">
                              <div className="flex items-center justify-center gap-1">
                                {notasPagas > 0 && <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-green-100 text-green-700">{notasPagas} ✓</span>}
                                {(totalNotas - notasPagas) > 0 && <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-red-100 text-red-700">{totalNotas - notasPagas} ✗</span>}
                              </div>
                            </td>
                          );
                        }
                        case 'prazoReal': return <td key={colId} className="px-4 py-3"></td>;
                        case 'dtaPago': return <td key={colId} className="px-4 py-3"></td>;
                        default: return null;
                      }
                    };

                    return (
                      <React.Fragment key={forn.COD_FORNECEDOR}>
                        {/* Linha pai - Fornecedor */}
                        <tr className="bg-orange-50/40 hover:bg-orange-50 cursor-pointer transition-colors" onClick={() => toggleFornecedor(forn.COD_FORNECEDOR)}>
                          <td className="px-4 py-3">
                            <span className={`inline-flex items-center justify-center w-5 h-5 rounded text-xs font-bold transition-colors ${isExpanded ? 'bg-orange-500 text-white' : 'bg-gray-200 text-gray-600 hover:bg-orange-200'}`}>
                              {isExpanded ? '−' : '+'}
                            </span>
                          </td>
                          {colOrder.map(renderParentCell)}
                        </tr>

                        {/* Linhas filhas - Notas do fornecedor */}
                        {isExpanded && forn.notas.map((nota, idx) => {
                          const notaKey = `${forn.COD_FORNECEDOR}_${nota.NUM_NF_FORN}`;
                          const isNotaExpanded = expandedNota === notaKey;
                          const itens = notaItens[notaKey] || [];
                          const isLoadingItens = loadingItens[notaKey];

                          const renderChildCell = (colId) => {
                            switch (colId) {
                              case 'fornecedor': return <td key={colId} className="px-4 py-2 pl-10"><span className="text-gray-500 text-xs">{nota.DTA_ENTRADA && <span className="text-gray-400 mr-2">Entrada: {nota.DTA_ENTRADA}</span>}{nota.DTA_EMISSAO && <span className="text-gray-400">Emissão: {nota.DTA_EMISSAO}</span>}</span></td>;
                              case 'contato': return <td key={colId} className="px-4 py-2"></td>;
                              case 'celular': return <td key={colId} className="px-4 py-2"></td>;
                              case 'nNota': return <td key={colId} className="px-4 py-2 font-mono text-gray-700">{nota.NUM_NF_FORN}</td>;
                              case 'valor': return <td key={colId} className="px-4 py-2 text-right font-medium text-gray-600">{formatCurrency(nota.VAL_TOTAL_NF)}</td>;
                              case 'prazo': return <td key={colId} className="px-4 py-2 text-center"><span className={`font-semibold ${nota.PRAZO === '-' ? 'text-gray-300' : 'text-yellow-600'}`}>{nota.PRAZO}</span></td>;
                              case 'prazoSistema': return <td key={colId} className="px-4 py-2 text-center">{forn.COND_PGTO_SISTEMA > 0 ? <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold bg-gray-200 text-gray-700">{forn.COND_PGTO_SISTEMA}d</span> : <span className="text-gray-300">-</span>}</td>;
                              case 'combinado': {
                                if (!forn.COND_PGTO_SISTEMA || forn.COND_PGTO_SISTEMA <= 0 || !nota.PRAZO_MEDIO_NF || nota.PRAZO_MEDIO_NF <= 0) {
                                  return <td key={colId} className="px-4 py-2 text-center"><span className="text-gray-300">-</span></td>;
                                }
                                const isDentro = nota.PRAZO_MEDIO_NF >= forn.COND_PGTO_SISTEMA;
                                return (
                                  <td key={colId} className="px-4 py-2 text-center">
                                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold ${isDentro ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                                      {isDentro ? 'DENTRO' : 'FORA'}
                                    </span>
                                  </td>
                                );
                              }
                              case 'formaPgto': return <td key={colId} className="px-4 py-2 text-center">{nota.FORMA_PGTO ? <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-50 text-blue-700 truncate max-w-[160px]" title={nota.FORMA_PGTO}>{nota.FORMA_PGTO}</span> : <span className="text-gray-300 text-xs">-</span>}</td>;
                              case 'tipoNf': return <td key={colId} className="px-4 py-2 text-center">{nota.TIPO_NF ? <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-bold ${nota.TIPO_NF === 'REVENDA' ? 'bg-green-100 text-green-700' : nota.TIPO_NF === 'BONIFICAÇÃO' ? 'bg-purple-100 text-purple-700' : 'bg-gray-100 text-gray-600'}`}>{nota.TIPO_NF}</span> : <span className="text-gray-300 text-xs">-</span>}</td>;
                              case 'classificacao': return <td key={colId} className="px-4 py-2 text-center text-gray-400 text-xs">{nota.PRAZO_MEDIO_NF > 0 ? (() => { const c = getClassificacao(nota.PRAZO_MEDIO_NF); return <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${c.bg} ${c.text}`}>{c.label}</span>; })() : ''}</td>;
                              case 'prazoMedio': return <td key={colId} className="px-4 py-2 text-center">{nota.PRAZO_MEDIO_NF > 0 ? <span className="font-semibold text-yellow-600">{nota.PRAZO_MEDIO_NF}</span> : ''}</td>;
                              case 'pago': return <td key={colId} className="px-4 py-2 text-center"><span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold ${nota.PAGO ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>{nota.PAGO ? 'Sim' : 'Não'}</span></td>;
                              case 'prazoReal': return <td key={colId} className="px-4 py-2 text-center">{nota.PAGO && nota.PRAZO_REAL != null ? <span className="font-semibold text-blue-600">{nota.PRAZO_REAL}d</span> : <span className="text-gray-300">-</span>}</td>;
                              case 'dtaPago': return <td key={colId} className="px-4 py-2 text-center">{nota.DTA_QUITADA ? <span className="text-xs text-gray-600">{nota.DTA_QUITADA}</span> : <span className="text-gray-300">-</span>}</td>;
                              default: return null;
                            }
                          };

                          return (
                            <React.Fragment key={`${forn.COD_FORNECEDOR}_${nota.NUM_NF_FORN}_${idx}`}>
                              <tr className="bg-white hover:bg-blue-50/30 cursor-pointer" onClick={(e) => toggleNota(forn.COD_FORNECEDOR, nota.NUM_NF_FORN, forn.PRAZO_MEDIO, e)}>
                                <td className="px-4 py-2 pl-8">
                                  <span className={`inline-flex items-center justify-center w-4 h-4 rounded text-[10px] font-bold transition-colors ${isNotaExpanded ? 'bg-blue-500 text-white' : 'bg-gray-100 text-gray-400 hover:bg-blue-200'}`}>
                                    {isNotaExpanded ? '−' : '📦'}
                                  </span>
                                </td>
                                {colOrder.map(renderChildCell)}
                              </tr>

                              {/* Itens da nota (produtos) */}
                              {isNotaExpanded && (
                                <tr>
                                  <td colSpan={colOrder.length + 1} className="px-0 py-0">
                                    <div className="ml-14 mr-4 mb-2 mt-1 bg-gray-50 rounded-lg border border-gray-200 overflow-hidden">
                                      {isLoadingItens ? (
                                        <div className="p-4 text-center text-gray-400 text-xs">Carregando produtos...</div>
                                      ) : itens.length === 0 ? (
                                        <div className="p-4 text-center text-gray-400 text-xs">Nenhum produto encontrado nesta nota</div>
                                      ) : (
                                        <table className="w-full text-xs">
                                          <thead className="bg-gray-200 text-gray-600">
                                            <tr>
                                              <th className="px-3 py-1.5 text-left">Cód</th>
                                              <th className="px-3 py-1.5 text-left">Produto</th>
                                              <th className="px-3 py-1.5 text-right">Qtd</th>
                                              <th className="px-3 py-1.5 text-left">Unid</th>
                                              <th className="px-3 py-1.5 text-right">Custo Unit</th>
                                              <th className="px-3 py-1.5 text-right">Total</th>
                                              <th className="px-3 py-1.5 text-center w-10">Alt</th>
                                            </tr>
                                          </thead>
                                          <tbody className="divide-y divide-gray-100">
                                            {itens.map((item, i) => (
                                              <tr key={i} className="hover:bg-gray-100/50">
                                                <td className="px-3 py-1 text-gray-500 font-mono">{item.COD_PRODUTO}</td>
                                                <td className="px-3 py-1 text-gray-700 font-medium">{item.DES_PRODUTO || '-'}</td>
                                                <td className="px-3 py-1 text-right text-gray-600">{item.QTD_ENTRADA != null ? Number(item.QTD_ENTRADA).toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 3 }) : '-'}</td>
                                                <td className="px-3 py-1 text-gray-500">{item.DES_UNIDADE || '-'}</td>
                                                <td className="px-3 py-1 text-right text-gray-600">{formatCurrency(item.VAL_CUSTO)}</td>
                                                <td className="px-3 py-1 text-right font-medium text-gray-700">{formatCurrency(item.VAL_TOTAL)}</td>
                                                <td className="px-3 py-1 text-center">
                                                  {item.TEM_ALTERNATIVO ? (
                                                    <button
                                                      onClick={(e) => fetchAlternativos(item.COD_PRODUTO, item.DES_PRODUTO || item.COD_PRODUTO, forn.COD_FORNECEDOR, forn.PRAZO_MEDIO, e)}
                                                      className={`w-5 h-5 rounded-full text-white text-[10px] font-bold inline-flex items-center justify-center transition-colors ${
                                                        altPopup && altPopup.codProduto === item.COD_PRODUTO && altPopup.codFornecedor === forn.COD_FORNECEDOR
                                                          ? 'bg-orange-500 ring-2 ring-orange-300'
                                                          : 'bg-green-500 hover:bg-green-600'
                                                      }`}
                                                      title={`Fornecedores alternativos com prazo maior (últimos ${mesesHistorico} meses)`}
                                                    >
                                                      🔍
                                                    </button>
                                                  ) : null}
                                                </td>
                                              </tr>
                                            ))}
                                          </tbody>
                                        </table>
                                      )}
                                    </div>
                                  </td>
                                </tr>
                              )}
                            </React.Fragment>
                          );
                        })}
                      </React.Fragment>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Popup de Fornecedores Alternativos */}
        {altPopup && (
          <>
            <div className="fixed inset-0 z-40 bg-black/20" onClick={() => setAltPopup(null)} />
            <div className="fixed z-50 top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-white rounded-xl shadow-2xl border border-gray-200 p-5 w-[540px] max-h-[420px]">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h3 className="font-bold text-gray-800 text-sm flex items-center gap-2">
                    <span className="text-base">🔍</span> Fornecedores Alternativos
                  </h3>
                  <p className="text-xs text-gray-500 mt-0.5">{altPopup.desProduto} <span className="text-gray-400">(cód: {altPopup.codProduto})</span></p>
                  <p className="text-[10px] text-gray-400">Prazo maior que {altPopup.prazoAtual} dias | Últimos {mesesHistorico} meses</p>
                </div>
                <button onClick={() => setAltPopup(null)} className="text-gray-400 hover:text-gray-600 text-lg font-bold">✕</button>
              </div>
              {altPopup.loading ? (
                <div className="py-8 text-center text-gray-400 text-sm">Buscando fornecedores...</div>
              ) : altPopup.data.length === 0 ? (
                <div className="py-8 text-center text-gray-400 text-sm">Nenhum fornecedor com prazo maior encontrado</div>
              ) : (
                <div className="overflow-y-auto max-h-[300px]">
                  <table className="w-full text-xs">
                    <thead className="bg-gray-100 text-gray-600 sticky top-0">
                      <tr>
                        <th className="px-3 py-2 text-left">Fornecedor</th>
                        <th className="px-3 py-2 text-center">Prazo Médio</th>
                        <th className="px-3 py-2 text-right">Custo Unit</th>
                        <th className="px-3 py-2 text-center">Últ. Compra</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {altPopup.data.map((alt, i) => (
                        <tr key={i} className="hover:bg-green-50">
                          <td className="px-3 py-2 text-gray-800 font-medium">{alt.DES_FANTASIA}</td>
                          <td className="px-3 py-2 text-center">
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold bg-green-100 text-green-700">{alt.PRAZO_MEDIO}d</span>
                          </td>
                          <td className="px-3 py-2 text-right text-gray-600">{formatCurrency(alt.VAL_CUSTO)}</td>
                          <td className="px-3 py-2 text-center text-gray-500">{alt.DTA_ULT_COMPRA || '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </Layout>
  );
}
