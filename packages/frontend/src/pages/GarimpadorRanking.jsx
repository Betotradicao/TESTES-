import { useState, useEffect, useCallback } from 'react';
import Layout from '../components/Layout';
import { api } from '../utils/api';
import { Line } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  LineElement,
  PointElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js';

ChartJS.register(CategoryScale, LinearScale, LineElement, PointElement, Title, Tooltip, Legend, Filler);

const MEDALS = ['\u{1F947}', '\u{1F948}', '\u{1F949}'];

const CORES_FORNECEDORES = [
  '#f97316', '#3b82f6', '#10b981', '#ef4444', '#8b5cf6',
  '#06b6d4', '#f59e0b', '#ec4899', '#14b8a6', '#6366f1',
];

export default function GarimpadorRanking() {
  const [ranking, setRanking] = useState([]);
  const [resumo, setResumo] = useState(null);
  const [loading, setLoading] = useState(false);
  const [dataInicio, setDataInicio] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
  });
  const [dataFim, setDataFim] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  });
  const [selecionado, setSelecionado] = useState(null);
  const [detalhes, setDetalhes] = useState([]);
  const [filtrosClassif, setFiltrosClassif] = useState(new Set(['ouro', 'prata', 'bronze']));
  const [loadingDetalhes, setLoadingDetalhes] = useState(false);
  const [detalhesTodosCache, setDetalhesTodosCache] = useState([]);
  const [tabloidUrl, setTabloidUrl] = useState(null);
  const [excluidos, setExcluidos] = useState(new Set());

  // Projecao inline
  const [projecaoAberta, setProjecaoAberta] = useState(null); // indice do item na tabela de detalhes
  const [projecaoData, setProjecaoData] = useState(null);
  const [loadingProjecao, setLoadingProjecao] = useState(false);
  const [projecaoFiltro, setProjecaoFiltro] = useState('todos'); // 'todos' | 'fornecedor' | 'abaixo_custo'
  const [projecaoItem, setProjecaoItem] = useState(null); // item atual da projecao

  // Colunas reordenaveis da tabela de detalhes
  const [colunasDetalhe, setColunasDetalhe] = useState([
    { id: 'num', label: '#', align: 'left' },
    { id: 'produtoOfertado', label: 'Produto Ofertado', align: 'left' },
    { id: 'produtoLoja', label: 'Produto Loja', align: 'left' },
    { id: 'qtdEncontrado', label: 'Qtd', align: 'center' },
    { id: 'match', label: 'Match', align: 'center' },
    { id: 'tabloid', label: 'Tabloid', align: 'center' },
    { id: 'oferta', label: 'Oferta', align: 'right' },
    { id: 'custoLoja', label: 'Custo Loja', align: 'right' },
    { id: 'diferenca', label: 'Diferenca', align: 'right' },
    { id: 'curva', label: 'Curva', align: 'center' },
    { id: 'classif', label: 'Classif.', align: 'center' },
    { id: 'data', label: 'Data', align: 'left' },
    { id: 'projecao', label: 'Projecao', align: 'center' },
    { id: 'excluir', label: '', align: 'center' },
  ]);
  const [dragColIdx, setDragColIdx] = useState(null);

  const fmtBRL = (v) => Number(v || 0).toFixed(2).replace('.', ',');

  // Carregar exclusoes salvas
  useEffect(() => {
    api.get('/garimpador/produtos-excluidos').then(({ data }) => {
      setExcluidos(new Set((data.excluidos || []).map(String)));
    }).catch(() => {});
  }, []);

  const fetchRanking = useCallback(async () => {
    try {
      setLoading(true);
      const params = {};
      if (dataInicio) params.dataInicio = dataInicio;
      if (dataFim) params.dataFim = dataFim;
      const [rankRes, resumoRes] = await Promise.all([
        api.get('/garimpador/analytics/ranking', { params: { ...params, tipo: 'fornecedor' } }),
        api.get('/garimpador/analytics/resumo', { params }),
      ]);
      setRanking(rankRes.data.ranking || []);
      setResumo(resumoRes.data);
    } catch (err) {
      console.error('Erro ao buscar ranking:', err);
    } finally {
      setLoading(false);
    }
  }, [dataInicio, dataFim]);

  useEffect(() => { fetchRanking(); }, [fetchRanking]);

  const abrirDetalhes = async (fornecedor) => {
    if (selecionado?.contatoId === fornecedor.contatoId) {
      setSelecionado(null);
      setDetalhes([]);
      setProjecaoAberta(null);
      setProjecaoData(null);
      return;
    }
    setSelecionado(fornecedor);
    setFiltrosClassif(new Set(['ouro', 'prata', 'bronze']));
    setProjecaoAberta(null);
    setProjecaoData(null);
    await fetchDetalhes(fornecedor.contatoId, ['ouro', 'prata', 'bronze']);
  };

  const fetchDetalhes = async (contatoId, classifArray) => {
    try {
      setLoadingDetalhes(true);
      const params = {};
      if (dataInicio) params.dataInicio = dataInicio;
      if (dataFim) params.dataFim = dataFim;
      // Busca todos e filtra no frontend para suportar multiplos filtros
      const { data } = await api.get(`/garimpador/analytics/ranking/${contatoId}`, { params });
      const todos = data.itens || [];
      if (classifArray && classifArray.length > 0 && classifArray.length < 4) {
        setDetalhes(todos.filter(it => classifArray.includes(it.classificacao)));
      } else {
        setDetalhes(todos);
      }
      setDetalhesTodosCache(todos);
    } catch (err) {
      console.error('Erro ao buscar detalhes:', err);
    } finally {
      setLoadingDetalhes(false);
    }
  };

  const toggleFiltroClassif = (classif) => {
    setProjecaoAberta(null);
    setProjecaoData(null);
    const novos = new Set(filtrosClassif);
    if (novos.has(classif)) {
      novos.delete(classif);
    } else {
      novos.add(classif);
    }
    setFiltrosClassif(novos);
    // Filtrar do cache local
    const arr = [...novos];
    if (arr.length === 0 || arr.length === 4) {
      setDetalhes(detalhesTodosCache);
    } else {
      setDetalhes(detalhesTodosCache.filter(it => novos.has(it.classificacao)));
    }
  };

  // Excluir produto da pesquisa
  const excluirProduto = async (codProduto, produtoNome) => {
    const chave = codProduto ? String(codProduto) : (produtoNome || '').toUpperCase().trim();
    if (!chave) return;
    const novos = new Set(excluidos);
    novos.add(chave);
    setExcluidos(novos);
    try {
      await api.post('/garimpador/produtos-excluidos', { excluidos: Array.from(novos) });
    } catch (err) {
      console.error('Erro ao excluir produto:', err);
    }
  };

  // Drag-and-drop colunas
  const handleDragStartCol = (idx) => setDragColIdx(idx);
  const handleDragOverCol = (e) => e.preventDefault();
  const handleDropCol = (dropIdx) => {
    if (dragColIdx === null || dragColIdx === dropIdx) return;
    const nova = [...colunasDetalhe];
    const [removed] = nova.splice(dragColIdx, 1);
    nova.splice(dropIdx, 0, removed);
    setColunasDetalhe(nova);
    setDragColIdx(null);
  };

  // Renderizar celula baseado no id da coluna
  const renderCelDetalhe = (col, item, i, jaExcluido, chaveExclusao) => {
    switch (col.id) {
      case 'num': return <span className="text-gray-400">{i + 1}</span>;
      case 'produtoOfertado': return <span className="font-medium text-blue-700 whitespace-nowrap">{item.produtoOfertado}</span>;
      case 'produtoLoja': return <span className="text-green-700 whitespace-nowrap">{item.produtoLoja || '-'}</span>;
      case 'qtdEncontrado': {
        const qtd = item.qtdEncontrado || 0;
        return qtd > 1 ? (
          <span className="inline-block min-w-[24px] px-1.5 py-0.5 rounded text-xs font-bold bg-blue-100 text-blue-700 border border-blue-200">{qtd}</span>
        ) : qtd === 1 ? (
          <span className="text-gray-400 text-xs">1</span>
        ) : <span className="text-gray-300 text-xs">-</span>;
      }
      case 'match': {
        const score = item.matchScore || 0;
        const color = score >= 80 ? 'text-green-600 bg-green-50 border-green-200'
          : score >= 50 ? 'text-yellow-600 bg-yellow-50 border-yellow-200'
          : score > 0 ? 'text-orange-600 bg-orange-50 border-orange-200'
          : 'text-gray-400 bg-gray-50 border-gray-200';
        return score > 0 ? (
          <span className={`px-1.5 py-0.5 rounded text-xs font-bold border ${color}`}>{score}%</span>
        ) : <span className="text-gray-300 text-xs">-</span>;
      }
      case 'tabloid': return item.mediaUrl ? (
        <button onClick={(e) => { e.stopPropagation(); setTabloidUrl(item.mediaUrl); }} className="text-lg hover:scale-110 transition-transform" title="Ver tabloid">{'\u{1F4F0}'}</button>
      ) : <span className="text-gray-300 text-xs">-</span>;
      case 'oferta': return <span className="font-semibold">R$ {fmtBRL(item.precoOferta)}</span>;
      case 'custoLoja': return <span>R$ {fmtBRL(item.precoCustoLoja)}</span>;
      case 'diferenca': return <span className={`font-semibold ${item.diferenca > 0 ? 'text-green-600' : 'text-red-500'}`}>R$ {fmtBRL(item.diferenca)}</span>;
      case 'curva': return item.curva;
      case 'classif': return (
        <span className={`px-2 py-0.5 rounded text-xs font-semibold border ${classifColor(item.classificacao)}`}>
          {item.classificacao?.toUpperCase()}
        </span>
      );
      case 'data': return <span className="text-gray-500">{item.data ? new Date(item.data).toLocaleDateString('pt-BR') : '-'}</span>;
      case 'projecao': return (
        <button onClick={(e) => { e.stopPropagation(); toggleProjecao(i, item); }} className={`text-xl hover:scale-125 transition-transform ${projecaoAberta === i ? 'scale-125' : ''}`} title="Ver projecao de preco">{'\u{1F4C8}'}</button>
      );
      case 'excluir': return jaExcluido ? (
        <button onClick={(e) => { e.stopPropagation(); restaurarProduto(chaveExclusao); }} className="text-green-500 hover:text-green-700 transition-colors p-1" title="Restaurar produto">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
        </button>
      ) : (
        <button onClick={(e) => { e.stopPropagation(); excluirProduto(item.codProdutoLoja, item.produtoOfertado); }} className="text-red-400 hover:text-red-600 transition-colors p-1" title="Excluir da pesquisa">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
        </button>
      );
      default: return '-';
    }
  };

  // Restaurar produto excluido
  const restaurarProduto = async (chave) => {
    const novos = new Set(excluidos);
    novos.delete(chave);
    setExcluidos(novos);
    try {
      await api.post('/garimpador/produtos-excluidos', { excluidos: Array.from(novos) });
    } catch (err) {
      console.error('Erro ao restaurar produto:', err);
    }
  };

  // Abrir projecao inline
  const toggleProjecao = async (idx, item) => {
    if (projecaoAberta === idx) {
      setProjecaoAberta(null);
      setProjecaoData(null);
      setProjecaoItem(null);
      return;
    }
    setProjecaoAberta(idx);
    setProjecaoData(null);
    setProjecaoItem(item);
    setProjecaoFiltro('todos');
    setLoadingProjecao(true);
    try {
      const termo = item.produtoLoja || item.produtoOfertado;
      const params = { termo };
      if (dataInicio) params.dataInicio = dataInicio;
      if (dataFim) params.dataFim = dataFim;
      const { data } = await api.get('/garimpador/analytics/projecao', { params });
      setProjecaoData(data);
    } catch (err) {
      console.error('Erro ao buscar projecao:', err);
    } finally {
      setLoadingProjecao(false);
    }
  };

  // Filtrar pontos da projecao
  const filtrarPontosProjecao = (dados) => {
    if (!dados?.pontos) return dados;
    let pontosFiltrados = [...dados.pontos];
    if (projecaoFiltro === 'fornecedor' && selecionado) {
      pontosFiltrados = pontosFiltrados.filter(p => p.fornecedor === selecionado.nome);
    } else if (projecaoFiltro === 'abaixo_custo' && projecaoItem) {
      const custo = projecaoItem.precoCustoLoja || 0;
      pontosFiltrados = pontosFiltrados.filter(p => p.preco < custo);
    }
    const precos = pontosFiltrados.map(p => p.preco).filter(Boolean);
    return {
      ...dados,
      pontos: pontosFiltrados,
      totalRegistros: pontosFiltrados.length,
      precoMinimo: precos.length ? Math.min(...precos) : 0,
      precoMaximo: precos.length ? Math.max(...precos) : 0,
      precoMedio: precos.length ? precos.reduce((a, b) => a + b, 0) / precos.length : 0,
    };
  };

  // Montar chart data para projecao inline
  const montarChartData = (dados) => {
    if (!dados?.pontos?.length) return null;
    const pontos = [...dados.pontos];
    const fornecedores = [...new Set(pontos.map(p => p.fornecedor))];
    const labels = [...new Set(pontos.map(p => {
      const d = new Date(p.data);
      return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
    }))];
    const datasets = fornecedores.map((forn, i) => {
      const pontosDoForn = pontos.filter(p => p.fornecedor === forn);
      const dataMap = new Map(pontosDoForn.map(p => {
        const d = new Date(p.data);
        return [d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }), p.preco];
      }));
      return {
        label: forn,
        data: labels.map(l => dataMap.get(l) ?? null),
        borderColor: CORES_FORNECEDORES[i % CORES_FORNECEDORES.length],
        backgroundColor: CORES_FORNECEDORES[i % CORES_FORNECEDORES.length] + '20',
        tension: 0.3,
        spanGaps: true,
        pointRadius: 5,
        pointHoverRadius: 7,
      };
    });
    return { labels, datasets };
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { position: 'top' },
      tooltip: {
        callbacks: {
          label: (ctx) => `${ctx.dataset.label}: R$ ${fmtBRL(ctx.parsed.y)}`,
        },
      },
    },
    scales: {
      y: {
        beginAtZero: false,
        ticks: { callback: (v) => `R$ ${fmtBRL(v)}` },
      },
    },
  };

  const classifColor = (c) => {
    if (c === 'ouro') return 'bg-yellow-100 text-yellow-800 border-yellow-300';
    if (c === 'prata') return 'bg-gray-100 text-gray-700 border-gray-300';
    if (c === 'bronze') return 'bg-orange-100 text-orange-700 border-orange-300';
    return 'bg-red-50 text-red-600 border-red-200';
  };

  return (
    <Layout>
      <div className="p-4 lg:p-6 space-y-4">
        {/* Header */}
        <div className="bg-gradient-to-br from-orange-500 to-amber-600 rounded-xl p-5 text-white shadow-lg">
          <h1 className="text-2xl font-bold">Ranking de Fornecedores</h1>
          <p className="text-orange-100 text-sm mt-1">Melhores oportunidades encontradas pelo Garimpador</p>
        </div>

        {/* Cards de resumo */}
        {resumo && (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 text-center shadow-sm">
              <div className="text-lg">{'\u{1F947}'}</div>
              <div className="text-2xl font-bold text-yellow-700">{resumo.totalOuro}</div>
              <div className="text-xs text-yellow-600 font-medium">Ouro</div>
            </div>
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 text-center shadow-sm">
              <div className="text-lg">{'\u{1F948}'}</div>
              <div className="text-2xl font-bold text-gray-600">{resumo.totalPrata}</div>
              <div className="text-xs text-gray-500 font-medium">Prata</div>
            </div>
            <div className="bg-orange-50 border border-orange-200 rounded-lg p-3 text-center shadow-sm">
              <div className="text-lg">{'\u{1F949}'}</div>
              <div className="text-2xl font-bold text-orange-700">{resumo.totalBronze}</div>
              <div className="text-xs text-orange-600 font-medium">Bronze</div>
            </div>
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-center shadow-sm">
              <div className="text-lg">{'\u{274C}'}</div>
              <div className="text-2xl font-bold text-red-600">{resumo.totalRuim}</div>
              <div className="text-xs text-red-500 font-medium">Ruim</div>
            </div>
            <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-center shadow-sm">
              <div className="text-lg">{'\u{1F4B0}'}</div>
              <div className="text-2xl font-bold text-green-700">R$ {fmtBRL(resumo.economiaTotal)}</div>
              <div className="text-xs text-green-600 font-medium">Economia Total</div>
            </div>
            <div className="bg-purple-50 border border-purple-200 rounded-lg p-3 text-center shadow-sm">
              <div className="text-lg">{'\u{1F6AB}'}</div>
              <div className="text-2xl font-bold text-purple-700">{resumo.totalForaMix}</div>
              <div className="text-xs text-purple-600 font-medium">Fora do Mix</div>
            </div>
          </div>
        )}

        {/* Filtros */}
        <div className="bg-white rounded-lg shadow p-4 flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <label className="text-xs text-gray-500">De:</label>
            <input type="date" value={dataInicio} onChange={(e) => setDataInicio(e.target.value)}
              className="border rounded px-2 py-1 text-sm" />
          </div>
          <div className="flex items-center gap-2">
            <label className="text-xs text-gray-500">Ate:</label>
            <input type="date" value={dataFim} onChange={(e) => setDataFim(e.target.value)}
              className="border rounded px-2 py-1 text-sm" />
          </div>
          <button onClick={fetchRanking} className="bg-orange-500 text-white px-4 py-1.5 rounded text-sm hover:bg-orange-600 transition-colors">
            Atualizar
          </button>
          {resumo?.topCategorias?.length > 0 && (
            <div className="ml-auto flex items-center gap-2 text-xs text-gray-500">
              <span>Top categorias:</span>
              {resumo.topCategorias.slice(0, 3).map((c, i) => (
                <span key={i} className="bg-gray-100 px-2 py-0.5 rounded">{c.categoria} ({c.count})</span>
              ))}
            </div>
          )}
        </div>

        {/* Tabela de Ranking */}
        {loading ? (
          <div className="text-center py-10 text-gray-500">Carregando ranking...</div>
        ) : ranking.length === 0 ? (
          <div className="text-center py-10 text-gray-400">Nenhuma comparacao encontrada no periodo</div>
        ) : (
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <div className="p-3 border-b">
              <h3 className="font-semibold text-gray-700">
                {ranking.length} fornecedor{ranking.length !== 1 ? 'es' : ''} encontrado{ranking.length !== 1 ? 's' : ''}
              </h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-base">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="text-center p-3 font-semibold text-gray-600 w-16">Pos.</th>
                    <th className="text-left p-3 font-semibold text-gray-600">Fornecedor</th>
                    <th className="text-center p-3 font-semibold text-gray-600">Qtd Produtos</th>
                    <th className="text-center p-3 font-semibold text-yellow-600">Ouro</th>
                    <th className="text-center p-3 font-semibold text-gray-500">Prata</th>
                    <th className="text-center p-3 font-semibold text-orange-600">Bronze</th>
                    <th className="text-center p-3 font-semibold text-red-500">Ruim</th>
                    <th className="text-right p-3 font-semibold text-gray-600">Economia</th>
                    <th className="text-right p-3 font-semibold text-gray-600">Margem</th>
                  </tr>
                </thead>
                <tbody>
                  {ranking.map((f, idx) => (
                    <tr
                      key={f.contatoId}
                      onClick={() => abrirDetalhes(f)}
                      className={`border-b cursor-pointer transition-colors ${
                        selecionado?.contatoId === f.contatoId
                          ? 'bg-orange-50 border-l-4 border-l-orange-500'
                          : 'hover:bg-gray-50'
                      }`}
                    >
                      <td className="p-3 text-center">
                        <div className="flex items-center justify-center gap-1">
                          {idx < 3 && <span className="text-xl">{MEDALS[idx]}</span>}
                          <span className="font-bold text-gray-500">{idx + 1}&#186;</span>
                        </div>
                      </td>
                      <td className="p-3">
                        <div className="flex items-center gap-2">
                          {f.fotoUrl && (
                            <img src={f.fotoUrl} alt="" className="w-8 h-8 rounded-full object-cover" />
                          )}
                          <div>
                            <div className="font-semibold text-gray-800">{f.nome}</div>
                            <div className="text-xs text-gray-400">{f.tipo === 'concorrente' ? 'Concorrente' : 'Fornecedor'}</div>
                          </div>
                        </div>
                      </td>
                      <td className="p-3 text-center">
                        <span className="font-bold text-gray-700 text-lg">{f.totalOfertas}</span>
                      </td>
                      <td className="p-3 text-center">
                        {f.ouro > 0 ? (
                          <span className="inline-block min-w-[28px] px-2 py-0.5 rounded font-bold bg-yellow-100 text-yellow-800">{f.ouro}</span>
                        ) : (
                          <span className="text-gray-300">0</span>
                        )}
                      </td>
                      <td className="p-3 text-center">
                        {f.prata > 0 ? (
                          <span className="inline-block min-w-[28px] px-2 py-0.5 rounded font-bold bg-gray-100 text-gray-700">{f.prata}</span>
                        ) : (
                          <span className="text-gray-300">0</span>
                        )}
                      </td>
                      <td className="p-3 text-center">
                        {f.bronze > 0 ? (
                          <span className="inline-block min-w-[28px] px-2 py-0.5 rounded font-bold bg-orange-100 text-orange-700">{f.bronze}</span>
                        ) : (
                          <span className="text-gray-300">0</span>
                        )}
                      </td>
                      <td className="p-3 text-center">
                        {f.ruim > 0 ? (
                          <span className="inline-block min-w-[28px] px-2 py-0.5 rounded font-bold bg-red-50 text-red-600">{f.ruim}</span>
                        ) : (
                          <span className="text-gray-300">0</span>
                        )}
                      </td>
                      <td className="p-3 text-right">
                        <span className="font-semibold text-green-600">R$ {fmtBRL(f.totalEconomia)}</span>
                      </td>
                      <td className="p-3 text-right">
                        {f.margemMediaMelhoria > 0 ? (
                          <span className="text-blue-600 font-medium">+{fmtBRL(f.margemMediaMelhoria)}%</span>
                        ) : (
                          <span className="text-gray-300">-</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Detalhes do fornecedor selecionado */}
        {selecionado && (
          <div className="bg-white rounded-lg shadow">
            <div className="p-4 border-b flex flex-wrap items-center gap-3">
              <h2 className="font-semibold text-gray-800 text-lg">
                Itens de {selecionado.nome}
              </h2>
              <div className="flex gap-1.5 ml-auto">
                {[
                  { key: 'ouro', label: 'Ouro', emoji: '\u{1F947}', activeBg: 'bg-yellow-100 border-yellow-400 text-yellow-800' },
                  { key: 'prata', label: 'Prata', emoji: '\u{1F948}', activeBg: 'bg-gray-200 border-gray-400 text-gray-800' },
                  { key: 'bronze', label: 'Bronze', emoji: '\u{1F949}', activeBg: 'bg-orange-100 border-orange-400 text-orange-800' },
                  { key: 'ruim', label: 'Ruim', emoji: '\u{274C}', activeBg: 'bg-red-100 border-red-400 text-red-700' },
                ].map((c) => (
                  <button
                    key={c.key}
                    onClick={() => toggleFiltroClassif(c.key)}
                    className={`px-3 py-1 text-sm rounded font-medium transition-colors border ${
                      filtrosClassif.has(c.key)
                        ? c.activeBg
                        : 'bg-white border-gray-200 text-gray-400 hover:bg-gray-50'
                    }`}
                  >
                    {c.emoji} {c.label}
                  </button>
                ))}
              </div>
            </div>

            {loadingDetalhes ? (
              <div className="p-4 text-center text-gray-500">Carregando...</div>
            ) : detalhes.length === 0 ? (
              <div className="p-4 text-center text-gray-400">Nenhum item encontrado</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      {colunasDetalhe.map((col, ci) => (
                        <th
                          key={col.id}
                          className={`text-${col.align} p-2.5 font-semibold text-gray-600 ${col.id === 'excluir' ? 'w-16' : ''} cursor-grab select-none`}
                          draggable
                          onDragStart={() => handleDragStartCol(ci)}
                          onDragOver={handleDragOverCol}
                          onDrop={() => handleDropCol(ci)}
                          title="Arraste para reordenar"
                        >
                          {col.label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {detalhes.map((item, i) => {
                      const chaveExclusao = item.codProdutoLoja ? String(item.codProdutoLoja) : (item.produtoOfertado || '').toUpperCase().trim();
                      const jaExcluido = excluidos.has(chaveExclusao);
                      return (
                      <>
                        <tr key={`row-${i}`} className={`border-b hover:bg-gray-50 ${jaExcluido ? 'bg-red-50 opacity-50 line-through' : ''} ${!jaExcluido && item.boaOferta ? 'bg-green-50/50' : ''}`}>
                          {colunasDetalhe.map((col) => (
                            <td key={col.id} className={`p-2.5 text-${col.align}`}>
                              {renderCelDetalhe(col, item, i, jaExcluido, chaveExclusao)}
                            </td>
                          ))}
                        </tr>

                        {/* Projecao inline expandida */}
                        {projecaoAberta === i && (
                          <tr key={`proj-${i}`}>
                            <td colSpan={colunasDetalhe.length} className="p-0">
                              <div className="bg-blue-50 border-y-2 border-blue-200 p-4">
                                {loadingProjecao ? (
                                  <div className="text-center py-6 text-gray-500">Carregando projecao de preco...</div>
                                ) : !projecaoData ? (
                                  <div className="text-center py-6 text-gray-400">Erro ao carregar projecao</div>
                                ) : (() => {
                                  const dadosFiltrados = filtrarPontosProjecao(projecaoData);
                                  return (
                                  <div className="space-y-3">
                                    <div className="flex items-center justify-between flex-wrap gap-2">
                                      <h4 className="font-semibold text-gray-800">
                                        {'\u{1F4C8}'} Projecao de Preco: "{projecaoData.produtoBusca}"
                                      </h4>
                                      <div className="flex items-center gap-1">
                                        {[
                                          { key: 'todos', label: 'Todos Fornecedores' },
                                          { key: 'fornecedor', label: `Somente ${selecionado?.nome || 'Fornecedor'}` },
                                          { key: 'abaixo_custo', label: `Abaixo do Custo (R$ ${fmtBRL(item.precoCustoLoja)})` },
                                        ].map(f => (
                                          <button
                                            key={f.key}
                                            onClick={() => setProjecaoFiltro(f.key)}
                                            className={`px-2.5 py-1 text-xs rounded font-medium transition-colors ${
                                              projecaoFiltro === f.key
                                                ? 'bg-blue-600 text-white'
                                                : 'bg-white text-gray-600 border hover:bg-gray-50'
                                            }`}
                                          >
                                            {f.label}
                                          </button>
                                        ))}
                                        <button
                                          onClick={() => { setProjecaoAberta(null); setProjecaoData(null); setProjecaoItem(null); }}
                                          className="text-gray-400 hover:text-gray-600 text-lg ml-2"
                                        >
                                          {'\u{2716}'}
                                        </button>
                                      </div>
                                    </div>

                                    {/* Stats */}
                                    <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
                                      <div className="bg-white rounded-lg shadow-sm p-2.5 text-center border">
                                        <div className="text-lg font-bold text-green-600">R$ {fmtBRL(dadosFiltrados.precoMinimo)}</div>
                                        <div className="text-xs text-gray-500">Menor Preco</div>
                                      </div>
                                      <div className="bg-white rounded-lg shadow-sm p-2.5 text-center border">
                                        <div className="text-lg font-bold text-red-500">R$ {fmtBRL(dadosFiltrados.precoMaximo)}</div>
                                        <div className="text-xs text-gray-500">Maior Preco</div>
                                      </div>
                                      <div className="bg-white rounded-lg shadow-sm p-2.5 text-center border">
                                        <div className="text-lg font-bold text-blue-600">R$ {fmtBRL(dadosFiltrados.precoMedio)}</div>
                                        <div className="text-xs text-gray-500">Preco Medio</div>
                                      </div>
                                      <div className="bg-white rounded-lg shadow-sm p-2.5 text-center border border-amber-200 bg-amber-50">
                                        <div className="text-lg font-bold text-amber-700">R$ {fmtBRL(item.precoCustoLoja)}</div>
                                        <div className="text-xs text-amber-600">Custo Loja</div>
                                      </div>
                                      <div className="bg-white rounded-lg shadow-sm p-2.5 text-center border">
                                        <div className="text-lg font-bold text-gray-700">{dadosFiltrados.totalRegistros}</div>
                                        <div className="text-xs text-gray-500">Registros</div>
                                      </div>
                                    </div>

                                    {/* Grafico */}
                                    {(() => {
                                      const cd = montarChartData(dadosFiltrados);
                                      if (!cd || !cd.datasets.length) return (
                                        <div className="text-center py-4 text-gray-400 text-sm">Dados insuficientes para grafico</div>
                                      );
                                      // Adicionar linha de referencia do custo
                                      const custoLoja = item.precoCustoLoja || 0;
                                      if (custoLoja > 0) {
                                        cd.datasets.push({
                                          label: `Custo Loja (R$ ${fmtBRL(custoLoja)})`,
                                          data: cd.labels.map(() => custoLoja),
                                          borderColor: '#d97706',
                                          borderDash: [8, 4],
                                          borderWidth: 2,
                                          pointRadius: 0,
                                          pointHoverRadius: 0,
                                          fill: false,
                                        });
                                      }
                                      return (
                                        <div className="bg-white rounded-lg border p-3" style={{ height: 280 }}>
                                          <Line data={cd} options={chartOptions} />
                                        </div>
                                      );
                                    })()}

                                    {/* Tabela de pontos */}
                                    {dadosFiltrados.pontos?.length > 0 && (
                                      <div className="bg-white rounded-lg border overflow-hidden">
                                        <div className="p-2 border-b bg-gray-50">
                                          <span className="text-xs font-semibold text-gray-600">Detalhes ({dadosFiltrados.totalRegistros} registros)</span>
                                        </div>
                                        <div className="overflow-x-auto" style={{ maxHeight: 200, overflowY: 'auto' }}>
                                          <table className="w-full text-xs">
                                            <thead className="bg-gray-50 sticky top-0">
                                              <tr>
                                                <th className="text-left p-2">Data</th>
                                                <th className="text-left p-2">Produto Ofertado</th>
                                                <th className="text-right p-2">Preco</th>
                                                <th className="text-right p-2">Custo Loja</th>
                                                <th className="text-right p-2">Economia</th>
                                                <th className="text-left p-2">Fornecedor</th>
                                                <th className="text-left p-2">Produto Loja</th>
                                                <th className="text-center p-2">Classif.</th>
                                              </tr>
                                            </thead>
                                            <tbody>
                                              {dadosFiltrados.pontos.map((p, pi) => {
                                                const economia = (item.precoCustoLoja || 0) - (p.preco || 0);
                                                return (
                                                <tr key={pi} className={`border-b hover:bg-gray-50 ${p.preco < (item.precoCustoLoja || 0) ? 'bg-green-50/50' : ''}`}>
                                                  <td className="p-2 text-gray-500">
                                                    {p.data ? new Date(p.data).toLocaleDateString('pt-BR') : '-'}
                                                  </td>
                                                  <td className="p-2 font-medium text-blue-700">{p.produtoOfertado}</td>
                                                  <td className="p-2 text-right font-semibold">R$ {fmtBRL(p.preco)}</td>
                                                  <td className="p-2 text-right text-amber-700">R$ {fmtBRL(item.precoCustoLoja)}</td>
                                                  <td className={`p-2 text-right font-semibold ${economia > 0 ? 'text-green-600' : 'text-red-500'}`}>
                                                    {economia > 0 ? '+' : ''}R$ {fmtBRL(economia)}
                                                  </td>
                                                  <td className="p-2 text-gray-600">{p.fornecedor}</td>
                                                  <td className="p-2 text-green-700">{p.produtoLoja || '-'}</td>
                                                  <td className="p-2 text-center">
                                                    {p.classificacao && (
                                                      <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${classifColor(p.classificacao)}`}>
                                                        {p.classificacao.toUpperCase()}
                                                      </span>
                                                    )}
                                                  </td>
                                                </tr>
                                                );
                                              })}
                                            </tbody>
                                          </table>
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                  );
                                })()}
                              </div>
                            </td>
                          </tr>
                        )}
                      </>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Modal Tabloid */}
        {tabloidUrl && (
          <div
            className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4"
            onClick={() => setTabloidUrl(null)}
          >
            <div
              className="bg-white rounded-xl shadow-2xl max-w-3xl max-h-[90vh] overflow-auto relative"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="sticky top-0 bg-white border-b p-3 flex items-center justify-between">
                <h3 className="font-semibold text-gray-800">Tabloid / Imagem Original</h3>
                <button
                  onClick={() => setTabloidUrl(null)}
                  className="text-gray-400 hover:text-gray-600 text-xl leading-none"
                >
                  {'\u00D7'}
                </button>
              </div>
              <div className="p-4">
                <img
                  src={tabloidUrl}
                  alt="Tabloid"
                  className="max-w-full rounded-lg"
                  onError={(e) => { e.target.style.display = 'none'; e.target.nextSibling.style.display = 'block'; }}
                />
                <div className="hidden text-center py-8 text-gray-400">
                  <p>Nao foi possivel carregar a imagem</p>
                  <a href={tabloidUrl} target="_blank" rel="noopener noreferrer"
                    className="text-blue-500 underline text-sm mt-2 block">
                    Abrir em nova aba
                  </a>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
