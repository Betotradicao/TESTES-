import React, { useState, useEffect, useRef, useCallback } from 'react';
import Layout from '../components/Layout';
import RadarLoading from '../components/RadarLoading';
import { api } from '../utils/api';
import { useLoja } from '../contexts/LojaContext';

const formatWhatsAppUrl = (phone) => {
  if (!phone) return null;
  const digits = String(phone).replace(/\D/g, '');
  if (digits.length < 10) return null;
  const num = digits.startsWith('55') ? digits : '55' + digits;
  return `https://web.whatsapp.com/send?phone=${num}`;
};

const formatCnpj = (cnpj) => {
  if (!cnpj) return '-';
  const nums = String(cnpj).replace(/\D/g, '');
  if (nums.length === 14) return nums.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5');
  return cnpj;
};

const formatCurrency = (val) => {
  if (!val && val !== 0) return 'R$ 0,00';
  return Number(val).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
};

const FILTROS = [
  { id: 'saldo', label: 'Saldo Pendente', desc: 'Saídas - Retornos - Zerados > 0' },
  { id: 'saidas', label: 'Saídas', desc: 'Sair Estoque Loja → Troca Fornecedor' },
  { id: 'retornos', label: 'Retornos', desc: 'Sair Troca Fornecedor → Estoque Loja' },
  { id: 'zerados', label: 'Zerados', desc: 'Sair Troca Fornecedor e Não Voltar' },
];

const DEFAULT_COLUMNS = [
  { id: 'num', label: '#', align: 'center', width: 45 },
  { id: 'fantasia', label: 'Fantasia', align: 'left', width: 170 },
  { id: 'razaoSocial', label: 'Razão Social', align: 'left', width: 250 },
  { id: 'cnpj', label: 'CNPJ', align: 'left', width: 165 },
  { id: 'contato', label: 'Contato', align: 'left', width: 130 },
  { id: 'celular', label: 'Celular', align: 'center', width: 160 },
  { id: 'qtdTroca', label: 'Qtd Troca', align: 'right', width: 90 },
  { id: 'totalCusto', label: 'Total Custo', align: 'right', width: 130 },
  { id: 'totalVenda', label: 'Total Venda', align: 'right', width: 130 },
];

export default function PrevencaoTrocas() {
  const { lojaSelecionada } = useLoja();
  const [activeTab, setActiveTab] = useState('produtos');
  const [resultados, setResultados] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [tipoFiltro, setTipoFiltro] = useState('saldo');
  const [expandidos, setExpandidos] = useState(new Set());
  const [itensCarregando, setItensCarregando] = useState(new Set());
  const [itensPorFornecedor, setItensPorFornecedor] = useState({});
  const [columnOrder, setColumnOrder] = useState(DEFAULT_COLUMNS.map(c => c.id));
  const [busca, setBusca] = useState('');
  const dragCol = useRef(null);
  const dragOverCol = useRef(null);
  // Notas Bonificadas
  const [bonifData, setBonifData] = useState([]);
  const [bonifPerfis, setBonifPerfis] = useState([]);
  const [bonifLoading, setBonifLoading] = useState(false);
  const [bonifExpanded, setBonifExpanded] = useState({});
  const [bonifNotas, setBonifNotas] = useState({});
  const [bonifItens, setBonifItens] = useState({});
  const [bonifDataInicio, setBonifDataInicio] = useState(`${new Date().getFullYear()}-01-01`);
  const [bonifDataFim, setBonifDataFim] = useState(new Date().toISOString().split('T')[0]);

  useEffect(() => {
    carregarTrocas();
  }, [lojaSelecionada, tipoFiltro]);

  const carregarTrocas = async () => {
    setLoading(true);
    setError('');
    setExpandidos(new Set());
    setItensPorFornecedor({});
    try {
      const params = new URLSearchParams({ tipo: tipoFiltro });
      if (lojaSelecionada) params.append('loja', lojaSelecionada);
      const response = await api.get(`/losses/oracle/trocas?${params}`);
      setResultados(response.data);
    } catch (err) {
      setError(err.response?.data?.error || 'Erro ao buscar trocas do Oracle');
    } finally {
      setLoading(false);
    }
  };

  // Notas Bonificadas
  const carregarBonificadas = async () => {
    setBonifLoading(true);
    setBonifExpanded({});
    setBonifNotas({});
    setBonifItens({});
    try {
      const paramsBonif = new URLSearchParams();
      if (lojaSelecionada) paramsBonif.append('loja', lojaSelecionada);
      if (bonifDataInicio) paramsBonif.append('dataInicio', bonifDataInicio);
      if (bonifDataFim) paramsBonif.append('dataFim', bonifDataFim);

      const paramsTrocas = new URLSearchParams({ tipo: 'saldo' });
      if (lojaSelecionada) paramsTrocas.append('loja', lojaSelecionada);

      const [resBonif, resTrocas] = await Promise.all([
        api.get(`/losses/oracle/notas-bonificadas?${paramsBonif}`),
        api.get(`/losses/oracle/trocas?${paramsTrocas}`)
      ]);

      const trocasMap = {};
      if (resTrocas.data?.fornecedores) {
        for (const f of resTrocas.data.fornecedores) {
          trocasMap[f.codFornecedor] = { totalCusto: f.totalCusto || 0, totalVenda: f.totalVenda || 0, qtdItens: f.qtdItens || 0 };
        }
      }

      // Juntar fornecedores das bonificadas + trocas
      const bonifMap = {};
      for (const f of (resBonif.data.data || [])) {
        bonifMap[f.codFornecedor] = {
          ...f,
          trocaPendente: trocasMap[f.codFornecedor]?.totalCusto || 0,
          trocaVenda: trocasMap[f.codFornecedor]?.totalVenda || 0,
          trocaQtd: trocasMap[f.codFornecedor]?.qtdItens || 0
        };
      }
      // Adicionar fornecedores que têm trocas mas não têm bonificação
      if (resTrocas.data?.fornecedores) {
        for (const f of resTrocas.data.fornecedores) {
          if (!bonifMap[f.codFornecedor]) {
            bonifMap[f.codFornecedor] = {
              codFornecedor: f.codFornecedor,
              fantasia: f.fantasia || f.fornecedor,
              razaoSocial: f.fornecedor,
              perfis: {},
              totalGeral: 0,
              trocaPendente: f.totalCusto || 0,
              trocaVenda: f.totalVenda || 0,
              trocaQtd: f.qtdItens || 0
            };
          }
        }
      }

      const data = Object.values(bonifMap).sort((a, b) => (b.trocaPendente || 0) - (a.trocaPendente || 0));
      setBonifData(data);
      setBonifPerfis(resBonif.data.perfisDisponiveis || []);
    } catch (err) {
      console.error('Erro bonificadas:', err);
    } finally {
      setBonifLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'bonificadas') carregarBonificadas();
  }, [activeTab, lojaSelecionada]);

  const toggleBonifFornecedor = async (codFornecedor, codPerfil) => {
    const key = `${codFornecedor}_${codPerfil}`;
    if (bonifExpanded[key]) {
      setBonifExpanded(prev => ({ ...prev, [key]: false }));
      return;
    }
    if (!bonifNotas[key]) {
      try {
        const params = new URLSearchParams();
        if (lojaSelecionada) params.append('loja', lojaSelecionada);
        const res = await api.get(`/losses/oracle/notas-bonificadas/${codFornecedor}/${codPerfil}?${params}`);
        setBonifNotas(prev => ({ ...prev, [key]: res.data.data || [] }));
      } catch (err) { console.error(err); }
    }
    setBonifExpanded(prev => ({ ...prev, [key]: true }));
  };

  const toggleBonifNota = async (codFornecedor, numNf) => {
    const key = `nota_${numNf}_${codFornecedor}`;
    if (bonifItens[key]) {
      setBonifItens(prev => ({ ...prev, [key]: null }));
      return;
    }
    try {
      const res = await api.get(`/losses/oracle/notas-bonificadas/${codFornecedor}/nota/${numNf}/itens`);
      setBonifItens(prev => ({ ...prev, [key]: res.data.data || [] }));
    } catch (err) { console.error(err); }
  };

  const perfilLabel = (cod) => {
    const labels = { 5: 'Rebaixa Preço', 10: 'Outras Entradas', 27: 'Amostra Gratis', 41: 'Troca', 43: 'Brindes', 88: 'Acordo Comercial' };
    return labels[cod] || `Perfil ${cod}`;
  };

  const perfilColor = (cod) => {
    const colors = { 5: 'text-purple-700 bg-purple-50', 10: 'text-gray-700 bg-gray-50', 27: 'text-cyan-700 bg-cyan-50', 41: 'text-orange-700 bg-orange-50', 43: 'text-pink-700 bg-pink-50', 88: 'text-blue-700 bg-blue-50' };
    return colors[cod] || 'text-gray-700 bg-gray-50';
  };

  const toggleFornecedor = async (codFornecedor) => {
    const newExpandidos = new Set(expandidos);
    if (newExpandidos.has(codFornecedor)) {
      newExpandidos.delete(codFornecedor);
      setExpandidos(newExpandidos);
    } else {
      newExpandidos.add(codFornecedor);
      setExpandidos(newExpandidos);
      if (!itensPorFornecedor[codFornecedor]) {
        setItensCarregando(prev => new Set(prev).add(codFornecedor));
        try {
          const params = new URLSearchParams({ cod_fornecedor: codFornecedor.toString(), tipo: tipoFiltro });
          if (lojaSelecionada) params.append('loja', lojaSelecionada);
          const response = await api.get(`/losses/oracle/trocas/itens?${params}`);
          setItensPorFornecedor(prev => ({ ...prev, [codFornecedor]: response.data.itens }));
        } catch (err) {
          console.error('Erro ao carregar itens:', err);
        } finally {
          setItensCarregando(prev => { const s = new Set(prev); s.delete(codFornecedor); return s; });
        }
      }
    }
  };

  const handleDragStart = useCallback((colId) => { dragCol.current = colId; }, []);
  const handleDragOver = useCallback((e, colId) => { e.preventDefault(); dragOverCol.current = colId; }, []);
  const handleDrop = useCallback(() => {
    if (dragCol.current && dragOverCol.current && dragCol.current !== dragOverCol.current) {
      setColumnOrder(prev => {
        const newOrder = [...prev];
        const fromIdx = newOrder.indexOf(dragCol.current);
        const toIdx = newOrder.indexOf(dragOverCol.current);
        if (fromIdx !== -1 && toIdx !== -1) { newOrder.splice(fromIdx, 1); newOrder.splice(toIdx, 0, dragCol.current); }
        return newOrder;
      });
    }
    dragCol.current = null;
    dragOverCol.current = null;
  }, []);

  const renderCell = (colId, f, idx) => {
    const cel = f.celular || f.fone || '';
    const waUrl = formatWhatsAppUrl(cel);
    switch (colId) {
      case 'num': {
        const isExp = expandidos.has(f.codFornecedor);
        const isLoad = itensCarregando.has(f.codFornecedor);
        return isLoad ? (
          <svg className="w-4 h-4 animate-spin text-orange-500 mx-auto" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
        ) : (
          <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-[10px] font-bold ${isExp ? 'bg-orange-500 text-white' : 'bg-gray-200 text-gray-600'}`}>
            {isExp ? '−' : idx + 1}
          </span>
        );
      }
      case 'fantasia':
        return <span className="font-semibold text-gray-900">{f.fantasia}</span>;
      case 'razaoSocial':
        return <span className="text-gray-600 text-xs">{f.fornecedor}</span>;
      case 'cnpj':
        return <span className="text-gray-500 text-xs font-mono">{formatCnpj(f.cnpj)}</span>;
      case 'contato':
        return <span className="text-gray-600 text-xs">{f.contato || '-'}</span>;
      case 'celular':
        return cel && waUrl ? (
          <a href={waUrl} target="_blank" rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="inline-flex items-center gap-1 px-2 py-0.5 bg-green-100 text-green-700 rounded text-xs hover:bg-green-200 transition-colors whitespace-nowrap"
            title="Abrir WhatsApp">
            <span>📱</span><span className="font-medium">{cel}</span>
          </a>
        ) : <span className="text-gray-300 text-xs">-</span>;
      case 'qtdTroca':
        return <span className="font-semibold text-blue-600">{f.qtdItens}</span>;
      case 'totalCusto':
        return <span className="font-bold text-orange-600">{formatCurrency(f.totalCusto)}</span>;
      case 'totalVenda':
        return <span className="font-semibold text-gray-700">{formatCurrency(f.totalVenda)}</span>;
      default:
        return '-';
    }
  };

  const orderedColumns = columnOrder.map(id => DEFAULT_COLUMNS.find(c => c.id === id)).filter(Boolean);
  const colCount = orderedColumns.length;
  const stats = resultados?.estatisticas || {};
  const todosFornecedores = resultados?.fornecedores || [];
  const fornecedores = busca.trim()
    ? todosFornecedores.filter(f => {
        const termo = busca.trim().toLowerCase();
        return (f.fantasia || '').toLowerCase().includes(termo) || (f.fornecedor || '').toLowerCase().includes(termo);
      })
    : todosFornecedores;

  return (
    <Layout>
      <div className="p-4 lg:p-6">
        {/* Header Laranja */}
        <div className="bg-gradient-to-br from-orange-500 to-orange-600 rounded-xl shadow-lg p-6 mb-6 text-white">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center">
                <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4"/>
                </svg>
              </div>
              <div>
                <h1 className="text-2xl lg:text-3xl font-bold">Prevenção Trocas</h1>
                <p className="text-white/80 text-sm">Análise de trocas com fornecedores - Oracle</p>
              </div>
            </div>
            <div className="hidden sm:flex items-center gap-3 text-right">
              <div>
                <p className="text-white/70 text-xs">Fornecedores</p>
                <p className="text-2xl font-bold">{stats.total_fornecedores || 0}</p>
              </div>
              <div className="w-px h-10 bg-white/30"></div>
              <div>
                <p className="text-white/70 text-xs">Total Custo</p>
                <p className="text-xl font-bold">{formatCurrency(stats.total_custo || 0)}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Abas principais */}
        <div className="flex gap-2 mb-4">
          <button onClick={() => setActiveTab('produtos')}
            className={`px-6 py-2.5 rounded-lg text-sm font-bold transition-all ${activeTab === 'produtos' ? 'bg-orange-500 text-white shadow-md' : 'bg-white text-gray-600 border hover:bg-gray-50'}`}>
            Produtos
          </button>
          <button onClick={() => setActiveTab('bonificadas')}
            className={`px-6 py-2.5 rounded-lg text-sm font-bold transition-all ${activeTab === 'bonificadas' ? 'bg-blue-600 text-white shadow-md' : 'bg-white text-gray-600 border hover:bg-gray-50'}`}>
            Notas Bonificadas
          </button>
        </div>

        {activeTab === 'produtos' && <>
        {/* Filtros: Abas + Busca */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 mb-6 p-3">
          {/* Abas de tipo */}
          <div className="flex flex-wrap gap-2 mb-3">
            {FILTROS.map(f => (
              <button
                key={f.id}
                onClick={() => setTipoFiltro(f.id)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  tipoFiltro === f.id
                    ? 'bg-orange-500 text-white shadow-md'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
                title={f.desc}
              >
                {f.label}
              </button>
            ))}
          </div>
          {/* Busca */}
          <div className="relative">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
            </svg>
            <input
              type="text" value={busca} onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar por Razão Social ou Nome Fantasia..."
              className="w-full pl-9 pr-8 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
            />
            {busca && (
              <button onClick={() => setBusca('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"/>
                </svg>
              </button>
            )}
          </div>
        </div>

        {/* Loading */}
        {loading && (
          <div className="bg-white rounded-xl shadow-sm p-8 text-center">
            <RadarLoading size="sm" message="Carregando trocas..." />
          </div>
        )}

        {/* Erro */}
        {error && (
          <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
            <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">{error}</div>
            <button onClick={carregarTrocas} className="mt-3 px-4 py-2 bg-orange-500 text-white rounded-lg text-sm hover:bg-orange-600">Tentar Novamente</button>
          </div>
        )}

        {/* Resultados */}
        {resultados && !loading && (
          <>
            {/* KPI Cards */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
              {[
                { label: 'Fornecedores', value: stats.total_fornecedores || 0, color: 'text-orange-600' },
                { label: 'Produtos', value: stats.total_produtos || 0, color: 'text-purple-600' },
                { label: 'Total Itens', value: stats.total_itens || 0, color: 'text-blue-600' },
                { label: 'Total Custo', value: formatCurrency(stats.total_custo || 0), color: 'text-orange-700', bg: 'bg-orange-50 border-orange-200' },
                { label: 'Total Venda', value: formatCurrency(stats.total_venda || 0), color: 'text-gray-700', bg: 'bg-gray-50 border-gray-200' },
              ].map((card, i) => (
                <div key={i} className={`rounded-xl shadow-sm border p-4 text-center ${card.bg || 'bg-white border-gray-200'}`}>
                  <div className={`text-xl sm:text-2xl font-bold ${card.color}`}>{card.value}</div>
                  <div className="text-xs text-gray-500 mt-1">{card.label}</div>
                </div>
              ))}
            </div>

            {/* Indicador de busca */}
            {busca.trim() && (
              <div className="mb-3 text-sm text-gray-500">
                Mostrando <span className="font-bold text-orange-600">{fornecedores.length}</span> de {todosFornecedores.length} fornecedores para "<span className="font-medium">{busca}</span>"
              </div>
            )}

            {/* Dica de arraste */}
            <div className="mb-2 text-xs text-gray-400 flex items-center gap-1">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4"/>
              </svg>
              Arraste os cabeçalhos para reorganizar colunas
            </div>

            {/* Tabela de Fornecedores */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm border-collapse" style={{ minWidth: orderedColumns.reduce((s, c) => s + c.width, 0) }}>
                  <colgroup>
                    {orderedColumns.map(col => (
                      <col key={col.id} style={{ width: col.width, minWidth: col.width }} />
                    ))}
                  </colgroup>
                  <thead className="sticky top-0 z-10">
                    <tr className="bg-gradient-to-r from-orange-500 to-amber-500 text-white">
                      {orderedColumns.map((col) => (
                        <th key={col.id} draggable
                          onDragStart={() => handleDragStart(col.id)}
                          onDragOver={(e) => handleDragOver(e, col.id)}
                          onDrop={handleDrop}
                          className={`px-3 py-2.5 text-xs font-medium whitespace-nowrap select-none border-r border-orange-400/30 last:border-r-0 ${
                            col.align === 'right' ? 'text-right' : col.align === 'center' ? 'text-center' : 'text-left'
                          }`}
                          style={{ cursor: 'grab' }}
                        >
                          <span className="inline-flex items-center gap-1">
                            <svg className="w-3 h-3 opacity-40 shrink-0" fill="currentColor" viewBox="0 0 24 24">
                              <circle cx="9" cy="5" r="1.5"/><circle cx="15" cy="5" r="1.5"/>
                              <circle cx="9" cy="12" r="1.5"/><circle cx="15" cy="12" r="1.5"/>
                              <circle cx="9" cy="19" r="1.5"/><circle cx="15" cy="19" r="1.5"/>
                            </svg>
                            {col.label}
                          </span>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {fornecedores.length === 0 ? (
                      <tr>
                        <td colSpan={colCount} className="px-4 py-12 text-center text-gray-400">
                          {busca.trim() ? 'Nenhum fornecedor encontrado para a busca' : 'Nenhuma troca encontrada'}
                        </td>
                      </tr>
                    ) : fornecedores.map((f, idx) => {
                      const isExpanded = expandidos.has(f.codFornecedor);
                      const isCarregando = itensCarregando.has(f.codFornecedor);
                      const itens = itensPorFornecedor[f.codFornecedor] || [];
                      const pct = (stats.total_custo || 0) > 0 ? ((f.totalCusto / stats.total_custo) * 100) : 0;

                      return [
                        <tr key={`row-${f.codFornecedor}`}
                          onClick={() => toggleFornecedor(f.codFornecedor)}
                          className={`cursor-pointer transition-colors border-b border-gray-100 ${
                            isExpanded ? 'bg-orange-50' : idx % 2 === 0 ? 'bg-white hover:bg-orange-50/50' : 'bg-gray-50/30 hover:bg-orange-50/50'
                          }`}
                        >
                          {orderedColumns.map((col) => (
                            <td key={col.id} className={`px-3 py-2.5 ${col.align === 'right' ? 'text-right' : col.align === 'center' ? 'text-center' : 'text-left'}`}>
                              {renderCell(col.id, f, idx)}
                            </td>
                          ))}
                        </tr>,

                        <tr key={`bar-${f.codFornecedor}`} className="h-0.5">
                          <td colSpan={colCount} className="p-0 bg-gray-100">
                            <div className="h-0.5 bg-orange-400" style={{ width: `${pct}%` }} />
                          </td>
                        </tr>,

                        isExpanded && (
                          <tr key={`detail-${f.codFornecedor}`}>
                            <td colSpan={colCount} className="p-0 border-b-2 border-orange-200">
                              <div className="bg-orange-50/30">
                                {isCarregando ? (
                                  <div className="p-6 text-center"><RadarLoading size="sm" message="Carregando itens..." /></div>
                                ) : itens.length === 0 ? (
                                  <div className="p-4 text-center text-gray-400 text-sm">Nenhum item encontrado</div>
                                ) : (
                                  <div className="p-3">
                                    <div className="overflow-x-auto rounded-lg border border-orange-200">
                                      <table className="w-full text-xs border-collapse">
                                        <thead className="bg-orange-100/80">
                                          <tr>
                                            <th className="px-3 py-2 text-left font-medium text-orange-800">Cód. Barras</th>
                                            <th className="px-3 py-2 text-left font-medium text-orange-800">Produto</th>
                                            <th className="px-3 py-2 text-left font-medium text-orange-800">Seção</th>
                                            <th className="px-3 py-2 text-center font-medium text-orange-800">Curva</th>
                                            <th className="px-3 py-2 text-right font-medium text-orange-800">Qtd</th>
                                            <th className="px-3 py-2 text-right font-medium text-orange-800">Custo Unit.</th>
                                            <th className="px-3 py-2 text-right font-medium text-orange-800">Pç. Venda</th>
                                            <th className="px-3 py-2 text-right font-medium text-orange-800">Margem</th>
                                            <th className="px-3 py-2 text-right font-medium text-orange-800">Vd Média</th>
                                            <th className="px-3 py-2 text-right font-medium text-orange-800">Valor Total</th>
                                            <th className="px-3 py-2 text-left font-medium text-orange-800">Data</th>
                                          </tr>
                                        </thead>
                                        <tbody className="divide-y divide-orange-100 bg-white">
                                          {itens.map((item, i) => (
                                            <tr key={i} className="hover:bg-orange-50/50">
                                              <td className="px-3 py-1.5 text-gray-500 font-mono">{item.codigoBarras}</td>
                                              <td className="px-3 py-1.5 font-medium text-gray-800 max-w-xs truncate" title={item.descricao}>{item.descricao}</td>
                                              <td className="px-3 py-1.5 text-gray-500">{item.secao}</td>
                                              <td className="px-3 py-1.5 text-center">
                                                <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-[10px] font-bold ${
                                                  item.curva === 'A' ? 'bg-green-100 text-green-700' :
                                                  item.curva === 'B' ? 'bg-yellow-100 text-yellow-700' :
                                                  item.curva === 'C' ? 'bg-orange-100 text-orange-700' :
                                                  'bg-gray-100 text-gray-500'
                                                }`}>{item.curva || 'X'}</span>
                                              </td>
                                              <td className={`px-3 py-1.5 text-right font-semibold ${item.quantidade < 0 ? 'text-red-600' : 'text-green-600'}`}>
                                                {Math.abs(item.quantidade).toFixed(3)}
                                              </td>
                                              <td className="px-3 py-1.5 text-right text-gray-600">{formatCurrency(item.custoReposicao)}</td>
                                              <td className="px-3 py-1.5 text-right text-gray-600">{formatCurrency(item.precoVenda)}</td>
                                              <td className={`px-3 py-1.5 text-right font-semibold ${(item.margem || 0) >= 30 ? 'text-green-600' : (item.margem || 0) >= 15 ? 'text-yellow-600' : 'text-red-600'}`}>
                                                {(item.margem || 0).toFixed(1)}%
                                              </td>
                                              <td className="px-3 py-1.5 text-right text-blue-600 font-medium">
                                                {(item.vdMedia || 0).toFixed(3)}
                                              </td>
                                              <td className="px-3 py-1.5 text-right font-bold text-orange-600">
                                                {formatCurrency(Math.abs(item.valorTotal))}
                                              </td>
                                              <td className="px-3 py-1.5 text-gray-500">
                                                {item.dataAjuste ? new Date(item.dataAjuste + 'T00:00:00').toLocaleDateString('pt-BR') : '-'}
                                              </td>
                                            </tr>
                                          ))}
                                        </tbody>
                                        <tfoot className="bg-orange-100/60 border-t border-orange-200 font-semibold">
                                          <tr>
                                            <td colSpan={4} className="px-3 py-2 text-orange-800">{itens.length} itens</td>
                                            <td className="px-3 py-2 text-right text-gray-700">
                                              {itens.reduce((s, it) => s + Math.abs(it.quantidade || 0), 0).toFixed(3)}
                                            </td>
                                            <td className="px-3 py-2"></td>
                                            <td className="px-3 py-2"></td>
                                            <td className="px-3 py-2"></td>
                                            <td className="px-3 py-2"></td>
                                            <td className="px-3 py-2 text-right text-orange-700">
                                              {formatCurrency(itens.reduce((s, it) => s + Math.abs(it.valorTotal || 0), 0))}
                                            </td>
                                            <td className="px-3 py-2"></td>
                                          </tr>
                                        </tfoot>
                                      </table>
                                    </div>
                                  </div>
                                )}
                              </div>
                            </td>
                          </tr>
                        ),
                      ];
                    })}
                  </tbody>
                </table>
              </div>

              {/* Total rodapé */}
              {fornecedores.length > 0 && (
                <div className="px-4 py-3 bg-gradient-to-r from-orange-50 to-amber-50 border-t border-orange-200 flex justify-between items-center text-sm">
                  <span className="text-gray-600 font-medium">{fornecedores.length} fornecedor(es)</span>
                  <span className="font-bold text-orange-700">Total Custo: {formatCurrency(
                    busca.trim()
                      ? fornecedores.reduce((s, f) => s + (f.totalCusto || 0), 0)
                      : stats.total_custo || 0
                  )}</span>
                </div>
              )}
            </div>
          </>
        )}
        </>}

        {/* Aba Notas Bonificadas */}
        {activeTab === 'bonificadas' && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-lg font-bold text-gray-800">Notas Bonificadas por Fornecedor</h2>
                <div className="flex items-center gap-3 mt-2">
                  <div>
                    <label className="text-xs text-gray-500">De</label>
                    <input type="date" value={bonifDataInicio} onChange={e => setBonifDataInicio(e.target.value)}
                      className="ml-1 border rounded px-2 py-1 text-sm" />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500">Até</label>
                    <input type="date" value={bonifDataFim} onChange={e => setBonifDataFim(e.target.value)}
                      className="ml-1 border rounded px-2 py-1 text-sm" />
                  </div>
                  <button onClick={carregarBonificadas}
                    className="bg-blue-600 text-white px-4 py-1.5 rounded text-sm font-semibold hover:bg-blue-700">
                    Buscar
                  </button>
                </div>
              </div>
              <div className="text-right">
                <p className="text-xs text-gray-500">Total Geral</p>
                <p className="text-xl font-bold text-red-600">{formatCurrency(bonifData.reduce((s, f) => s + (f.trocaPendente || 0), 0))}</p>
              </div>
            </div>

            {bonifLoading ? (
              <div className="text-center py-8 text-gray-400">Carregando...</div>
            ) : bonifData.length === 0 ? (
              <div className="text-center py-8 text-gray-400">Nenhuma nota bonificada encontrada</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm" style={{ tableLayout: 'fixed' }}>
                  <colgroup>
                    <col style={{ width: '40px' }} />
                    <col style={{ width: '220px' }} />
                    <col style={{ width: '130px' }} />
                    {bonifPerfis.map(p => <col key={p} style={{ width: '140px' }} />)}
                  </colgroup>
                  <thead className="bg-blue-600 text-white">
                    <tr>
                      <th className="px-3 py-2 text-center text-xs font-semibold">#</th>
                      <th className="px-3 py-2 text-left text-xs font-semibold">Fornecedor</th>
                      <th className="px-3 py-2 text-right text-xs font-semibold">Total Custo Trocas</th>
                      {bonifPerfis.map(p => (
                        <th key={p} className="px-3 py-2 text-right text-xs font-semibold whitespace-nowrap">{perfilLabel(p)}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {bonifData.map((forn, idx) => (
                      <React.Fragment key={forn.codFornecedor}>
                        <tr className={`border-b ${idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'} hover:bg-blue-50`}>
                          <td className="px-3 py-2 text-center text-xs text-gray-400">{idx + 1}</td>
                          <td className="px-3 py-2 text-sm font-medium text-gray-800 truncate">{forn.fantasia || forn.razaoSocial}</td>
                          <td className="px-3 py-2 text-right text-sm font-bold text-red-600">{formatCurrency(forn.trocaPendente)}</td>
                          {bonifPerfis.map(p => {
                            const perfil = forn.perfis[p];
                            const valor = perfil?.valor || 0;
                            return (
                              <td key={p} className="px-3 py-2 text-right text-sm">
                                {valor > 0 ? (
                                  <button onClick={() => toggleBonifFornecedor(forn.codFornecedor, p)}
                                    className={`px-2 py-0.5 rounded text-xs font-semibold hover:opacity-80 ${perfilColor(p)}`}>
                                    {formatCurrency(valor)} ({perfil.qtdNotas})
                                  </button>
                                ) : (
                                  <span className="text-gray-300">-</span>
                                )}
                              </td>
                            );
                          })}
                        </tr>
                        {/* Drill-down: Notas do perfil */}
                        {bonifPerfis.map(p => {
                          const key = `${forn.codFornecedor}_${p}`;
                          if (!bonifExpanded[key]) return null;
                          const notas = bonifNotas[key] || [];
                          return (
                            <tr key={key}>
                              <td colSpan={3 + bonifPerfis.length} className="bg-blue-50 px-8 py-3">
                                <p className="text-xs font-bold text-blue-700 mb-2">{perfilLabel(p)} — {notas.length} notas</p>
                                {notas.length === 0 ? <p className="text-xs text-gray-400">Carregando...</p> : (
                                  <table className="w-full bg-white rounded shadow-sm text-xs">
                                    <thead className="bg-blue-100">
                                      <tr>
                                        <th className="px-3 py-1.5 text-left font-semibold text-blue-800">NF</th>
                                        <th className="px-3 py-1.5 text-left font-semibold text-blue-800">Série</th>
                                        <th className="px-3 py-1.5 text-left font-semibold text-blue-800">Data Entrada</th>
                                        <th className="px-3 py-1.5 text-right font-semibold text-blue-800">Valor</th>
                                        <th className="px-3 py-1.5 text-center font-semibold text-blue-800">Loja</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {notas.map((nota, ni) => {
                                        const notaKey = `nota_${nota.numNf}_${forn.codFornecedor}`;
                                        const itens = bonifItens[notaKey];
                                        return (
                                          <React.Fragment key={ni}>
                                            <tr className="border-b hover:bg-blue-50 cursor-pointer" onClick={() => toggleBonifNota(forn.codFornecedor, nota.numNf)}>
                                              <td className="px-3 py-1.5 font-medium">{nota.numNf}</td>
                                              <td className="px-3 py-1.5">{nota.serie || '-'}</td>
                                              <td className="px-3 py-1.5">{nota.dtaEntrada ? new Date(nota.dtaEntrada).toLocaleDateString('pt-BR') : '-'}</td>
                                              <td className="px-3 py-1.5 text-right font-semibold text-green-700">{formatCurrency(nota.valorTotal)}</td>
                                              <td className="px-3 py-1.5 text-center">{nota.codLoja || '-'}</td>
                                            </tr>
                                            {itens && (
                                              <tr><td colSpan={5} className="bg-yellow-50 px-6 py-2">
                                                <p className="text-xs font-bold text-yellow-700 mb-1">Itens ({itens.length})</p>
                                                <table className="w-full text-xs">
                                                  <thead><tr className="text-yellow-800">
                                                    <th className="px-2 py-1 text-left">Código</th>
                                                    <th className="px-2 py-1 text-left">Descrição</th>
                                                    <th className="px-2 py-1 text-right">Qtd</th>
                                                    <th className="px-2 py-1 text-right">Valor</th>
                                                  </tr></thead>
                                                  <tbody>
                                                    {itens.map((it, ii) => (
                                                      <tr key={ii} className="border-b border-yellow-200">
                                                        <td className="px-2 py-1">{it.codProduto}</td>
                                                        <td className="px-2 py-1">{it.descricao}</td>
                                                        <td className="px-2 py-1 text-right">{Number(it.qtdEntrada).toLocaleString('pt-BR')}</td>
                                                        <td className="px-2 py-1 text-right font-semibold">{formatCurrency(it.valorTabela)}</td>
                                                      </tr>
                                                    ))}
                                                  </tbody>
                                                </table>
                                              </td></tr>
                                            )}
                                          </React.Fragment>
                                        );
                                      })}
                                    </tbody>
                                  </table>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </React.Fragment>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
    </Layout>
  );
}
