import { useState, useEffect, useCallback } from 'react';
import Layout from '../components/Layout';
import { api } from '../utils/api';
import toast from 'react-hot-toast';

const fmtBRL = (v) => v != null ? Number(v).toFixed(2).replace('.', ',') : '-';
const fmtData = (d) => {
  if (!d) return '-';
  const dt = new Date(d);
  return `${String(dt.getDate()).padStart(2, '0')}/${String(dt.getMonth() + 1).padStart(2, '0')}/${dt.getFullYear()}`;
};

const MEDALS = ['\u{1F947}', '\u{1F948}', '\u{1F949}'];

export default function AnaliseCotacao() {
  const [cotacoes, setCotacoes] = useState([]);
  const [cotacaoSelecionada, setCotacaoSelecionada] = useState(null);
  const [produtos, setProdutos] = useState([]);
  const [ranking, setRanking] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadingCotacoes, setLoadingCotacoes] = useState(false);
  const [busca, setBusca] = useState('');
  const [sortCol, setSortCol] = useState(null);
  const [sortDir, setSortDir] = useState('asc');
  const [showRanking, setShowRanking] = useState(true);

  // Colunas reordenaveis
  const [colunas, setColunas] = useState([
    { id: 'num', label: '#', align: 'center', width: 'w-10' },
    { id: 'codProduto', label: 'Codigo', align: 'left', width: 'w-20' },
    { id: 'desProduto', label: 'Produto', align: 'left', width: 'min-w-[200px]' },
    { id: 'unidade', label: 'Un', align: 'center', width: 'w-12' },
    { id: 'embalagem', label: 'Emb', align: 'center', width: 'w-12' },
    { id: 'codBarra', label: 'Cod.Barras', align: 'center', width: 'w-28' },
    { id: 'estoque', label: 'Estoque', align: 'right', width: 'w-16' },
    { id: 'cobertura', label: 'Cobert.', align: 'right', width: 'w-16' },
    { id: 'vda30d', label: 'Vda 30d', align: 'right', width: 'w-16' },
    { id: 'custoRep', label: 'Custo Rep', align: 'right', width: 'w-20' },
    { id: 'valVenda', label: 'Pr.Venda', align: 'right', width: 'w-20' },
    { id: 'dtaUltCompra', label: 'Ult.Compra', align: 'center', width: 'w-24' },
    { id: 'vencedor', label: '1o Mais Barato', align: 'left', width: 'min-w-[180px]' },
    { id: 'valVencedor', label: 'Valor 1o', align: 'right', width: 'w-20' },
    { id: 'segundo', label: '2o Mais Barato', align: 'left', width: 'min-w-[180px]' },
    { id: 'valSegundo', label: 'Valor 2o', align: 'right', width: 'w-20' },
    { id: 'terceiro', label: '3o Mais Barato', align: 'left', width: 'min-w-[150px]' },
    { id: 'valTerceiro', label: 'Valor 3o', align: 'right', width: 'w-20' },
  ]);
  const [dragColIdx, setDragColIdx] = useState(null);

  // Drag-and-drop colunas
  const handleDragStartCol = (idx) => setDragColIdx(idx);
  const handleDragOverCol = (e) => e.preventDefault();
  const handleDropCol = (dropIdx) => {
    if (dragColIdx === null || dragColIdx === dropIdx) return;
    const nova = [...colunas];
    const [removed] = nova.splice(dragColIdx, 1);
    nova.splice(dropIdx, 0, removed);
    setColunas(nova);
    setDragColIdx(null);
  };

  // Carregar lista de cotacoes
  useEffect(() => {
    loadCotacoes();
  }, []);

  const loadCotacoes = async () => {
    try {
      setLoadingCotacoes(true);
      const { data } = await api.get('/analise-cotacao/cotacoes');
      setCotacoes(data.cotacoes || []);
      // Auto-selecionar a mais recente
      if (data.cotacoes?.length > 0 && !cotacaoSelecionada) {
        setCotacaoSelecionada(data.cotacoes[0]);
      }
    } catch (err) {
      toast.error('Erro ao carregar cotacoes');
    } finally {
      setLoadingCotacoes(false);
    }
  };

  // Carregar detalhes ao selecionar cotacao
  useEffect(() => {
    if (cotacaoSelecionada) {
      loadDetalhes(cotacaoSelecionada.codCota, cotacaoSelecionada.codLoja);
    }
  }, [cotacaoSelecionada]);

  const loadDetalhes = async (codCota, codLoja) => {
    try {
      setLoading(true);
      const [detRes, rankRes] = await Promise.all([
        api.get('/analise-cotacao/detalhes', { params: { codCota, codLoja } }),
        api.get('/analise-cotacao/ranking', { params: { codCota, codLoja } }),
      ]);
      setProdutos(detRes.data.produtos || []);
      setRanking(rankRes.data.ranking || []);
    } catch (err) {
      toast.error('Erro ao carregar detalhes da cotacao');
    } finally {
      setLoading(false);
    }
  };

  // Filtrar por busca
  const produtosFiltrados = produtos.filter(p => {
    if (!busca) return true;
    const term = busca.toUpperCase();
    return (p.desProduto || '').toUpperCase().includes(term) ||
      (p.codProduto || '').includes(term) ||
      (p.codBarra || '').includes(term) ||
      (p.vencedor?.desFornecedor || '').toUpperCase().includes(term);
  });

  // Ordenar
  const produtosOrdenados = [...produtosFiltrados].sort((a, b) => {
    if (!sortCol) return 0;
    let va, vb;
    switch (sortCol) {
      case 'codProduto': va = a.codProduto; vb = b.codProduto; break;
      case 'desProduto': va = a.desProduto; vb = b.desProduto; break;
      case 'estoque': va = a.qtdEstoque; vb = b.qtdEstoque; break;
      case 'cobertura': va = a.qtdCobertura; vb = b.qtdCobertura; break;
      case 'vda30d': va = a.qtdVda30d; vb = b.qtdVda30d; break;
      case 'custoRep': va = a.valCustoRep; vb = b.valCustoRep; break;
      case 'valVenda': va = a.valVenda; vb = b.valVenda; break;
      case 'dtaUltCompra': va = a.dtaUltCompra || ''; vb = b.dtaUltCompra || ''; break;
      case 'valVencedor': va = a.vencedor?.valCustoTab || 999999; vb = b.vencedor?.valCustoTab || 999999; break;
      case 'valSegundo': va = a.segundo?.valCustoTab || 999999; vb = b.segundo?.valCustoTab || 999999; break;
      case 'valTerceiro': va = a.terceiro?.valCustoTab || 999999; vb = b.terceiro?.valCustoTab || 999999; break;
      case 'vencedor': va = a.vencedor?.desFornecedor || ''; vb = b.vencedor?.desFornecedor || ''; break;
      case 'segundo': va = a.segundo?.desFornecedor || ''; vb = b.segundo?.desFornecedor || ''; break;
      case 'terceiro': va = a.terceiro?.desFornecedor || ''; vb = b.terceiro?.desFornecedor || ''; break;
      default: return 0;
    }
    if (typeof va === 'string') {
      return sortDir === 'asc' ? va.localeCompare(vb) : vb.localeCompare(va);
    }
    return sortDir === 'asc' ? (va || 0) - (vb || 0) : (vb || 0) - (va || 0);
  });

  const handleSort = (colId) => {
    if (colId === 'num') return;
    if (sortCol === colId) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortCol(colId);
      setSortDir('asc');
    }
  };

  // Renderizar celula
  const renderCel = (col, item, i) => {
    switch (col.id) {
      case 'num': return <span className="text-gray-400 text-xs">{i + 1}</span>;
      case 'codProduto': return <span className="text-xs font-mono text-gray-600">{item.codProduto}</span>;
      case 'desProduto': return <span className="font-medium text-gray-800 whitespace-nowrap">{item.desProduto}</span>;
      case 'unidade': return <span className="text-xs text-gray-500">{item.unidadeCompra}</span>;
      case 'embalagem': return <span className="text-xs text-gray-500">{item.qtdEmbalagem || '-'}</span>;
      case 'codBarra': return <span className="text-xs font-mono text-gray-500">{item.codBarra || '-'}</span>;
      case 'estoque': return <span className={`text-sm font-semibold ${item.qtdEstoque <= 0 ? 'text-red-600' : 'text-gray-700'}`}>{item.qtdEstoque}</span>;
      case 'cobertura': return <span className={`text-sm ${item.qtdCobertura <= 3 ? 'text-red-600 font-bold' : 'text-gray-600'}`}>{item.qtdCobertura}d</span>;
      case 'vda30d': return <span className="text-sm text-gray-600">{Number(item.qtdVda30d || 0).toFixed(0)}</span>;
      case 'custoRep': return <span className="text-sm text-gray-700">R$ {fmtBRL(item.valCustoRep)}</span>;
      case 'valVenda': return <span className="text-sm text-blue-700 font-semibold">R$ {fmtBRL(item.valVenda)}</span>;
      case 'dtaUltCompra': return <span className="text-xs text-gray-500">{fmtData(item.dtaUltCompra)}</span>;
      case 'vencedor':
        if (!item.vencedor) return <span className="text-gray-300 text-xs">-</span>;
        return (
          <div className="flex items-center gap-1">
            {item.vencedor.ganhouPedido && <span className="text-green-600" title="Ganhou pedido">&#10003;</span>}
            <span className="text-sm text-green-700 font-semibold whitespace-nowrap truncate max-w-[180px]" title={item.vencedor.desFornecedor}>
              {item.vencedor.desFornecedor}
            </span>
          </div>
        );
      case 'valVencedor':
        if (!item.vencedor) return <span className="text-gray-300">-</span>;
        return <span className="text-sm text-green-700 font-bold">R$ {fmtBRL(item.vencedor.valCustoTab)}</span>;
      case 'segundo':
        if (!item.segundo) return <span className="text-gray-300 text-xs">-</span>;
        return (
          <span className="text-sm text-gray-600 whitespace-nowrap truncate max-w-[180px]" title={item.segundo.desFornecedor}>
            {item.segundo.desFornecedor}
          </span>
        );
      case 'valSegundo':
        if (!item.segundo) return <span className="text-gray-300">-</span>;
        return <span className="text-sm text-gray-600">R$ {fmtBRL(item.segundo.valCustoTab)}</span>;
      case 'terceiro':
        if (!item.terceiro) return <span className="text-gray-300 text-xs">-</span>;
        return (
          <span className="text-sm text-gray-500 whitespace-nowrap truncate max-w-[150px]" title={item.terceiro.desFornecedor}>
            {item.terceiro.desFornecedor}
          </span>
        );
      case 'valTerceiro':
        if (!item.terceiro) return <span className="text-gray-300">-</span>;
        return <span className="text-sm text-gray-500">R$ {fmtBRL(item.terceiro.valCustoTab)}</span>;
      default: return '-';
    }
  };

  // Stats da cotacao
  const totalCotaram = produtos.filter(p => p.vencedor).length;
  const totalSemCotacao = produtos.length - totalCotaram;

  return (
    <Layout>
      <div className="flex flex-col h-full">
        {/* Header */}
        <div className="bg-white border-b px-4 py-3">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z"/>
                </svg>
              </div>
              <div>
                <h1 className="text-lg font-bold text-gray-800">Analise de Cotacao</h1>
                <p className="text-xs text-gray-500">Comparativo de precos entre fornecedores</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {/* Seletor de Cotacao */}
              <select
                value={cotacaoSelecionada?.codCota || ''}
                onChange={(e) => {
                  const cot = cotacoes.find(c => c.codCota === Number(e.target.value));
                  setCotacaoSelecionada(cot);
                }}
                className="border rounded-lg px-3 py-1.5 text-sm bg-white min-w-[300px]"
                disabled={loadingCotacoes}
              >
                <option value="">Selecione uma cotacao...</option>
                {cotacoes.map(c => (
                  <option key={c.codCota} value={c.codCota}>
                    {c.desCota} ({fmtData(c.dtaCota)}) - {c.totalProdutos} prod. / {c.totalFornecedores} forn.
                  </option>
                ))}
              </select>
              <button
                onClick={() => showRanking ? setShowRanking(false) : setShowRanking(true)}
                className={`px-3 py-1.5 rounded-lg text-sm border transition-colors ${showRanking ? 'bg-blue-50 border-blue-300 text-blue-700' : 'bg-white text-gray-600'}`}
                title="Mostrar/ocultar ranking"
              >
                Ranking
              </button>
            </div>
          </div>
        </div>

        {/* Stats Cards */}
        {cotacaoSelecionada && !loading && (
          <div className="px-4 py-2 bg-gray-50 border-b flex gap-3 flex-wrap">
            <div className="bg-white rounded-lg px-3 py-2 border flex items-center gap-2">
              <span className="text-xs text-gray-500">Produtos:</span>
              <span className="font-bold text-gray-800">{produtos.length}</span>
            </div>
            <div className="bg-white rounded-lg px-3 py-2 border flex items-center gap-2">
              <span className="text-xs text-gray-500">Cotados:</span>
              <span className="font-bold text-green-600">{totalCotaram}</span>
            </div>
            <div className="bg-white rounded-lg px-3 py-2 border flex items-center gap-2">
              <span className="text-xs text-gray-500">Sem cotacao:</span>
              <span className="font-bold text-red-600">{totalSemCotacao}</span>
            </div>
            <div className="bg-white rounded-lg px-3 py-2 border flex items-center gap-2">
              <span className="text-xs text-gray-500">Fornecedores:</span>
              <span className="font-bold text-blue-600">{ranking.length}</span>
            </div>
            <div className="ml-auto flex items-center gap-2">
              <input
                type="text"
                placeholder="Buscar produto, codigo ou fornecedor..."
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                className="border rounded-lg px-3 py-1.5 text-sm w-72"
              />
            </div>
          </div>
        )}

        {/* Main Content */}
        <div className="flex flex-1 overflow-hidden">
          {/* Tabela Principal */}
          <div className="flex-1 overflow-auto">
            {loading ? (
              <div className="flex items-center justify-center h-64">
                <div className="text-center">
                  <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600 mx-auto mb-3"></div>
                  <p className="text-gray-500">Carregando cotacao...</p>
                </div>
              </div>
            ) : !cotacaoSelecionada ? (
              <div className="flex items-center justify-center h-64 text-gray-400">
                Selecione uma cotacao para visualizar
              </div>
            ) : produtosOrdenados.length === 0 ? (
              <div className="flex items-center justify-center h-64 text-gray-400">
                Nenhum produto encontrado
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-gray-50 sticky top-0 z-10">
                  <tr>
                    {colunas.map((col, ci) => (
                      <th
                        key={col.id}
                        className={`text-${col.align} p-2 font-semibold text-gray-600 text-xs cursor-grab select-none hover:bg-gray-100 whitespace-nowrap ${col.width || ''}`}
                        draggable
                        onDragStart={() => handleDragStartCol(ci)}
                        onDragOver={handleDragOverCol}
                        onDrop={() => handleDropCol(ci)}
                        onClick={() => handleSort(col.id)}
                        title="Arraste para reordenar / Clique para ordenar"
                      >
                        <span className="flex items-center gap-1 justify-center">
                          {col.label}
                          {sortCol === col.id && (
                            <span className="text-blue-500">{sortDir === 'asc' ? '\u25B2' : '\u25BC'}</span>
                          )}
                        </span>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {produtosOrdenados.map((item, i) => (
                    <tr key={item.codProduto} className="border-b hover:bg-blue-50/30 transition-colors">
                      {colunas.map((col) => (
                        <td key={col.id} className={`p-2 text-${col.align}`}>
                          {renderCel(col, item, i)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* Ranking Lateral */}
          {showRanking && ranking.length > 0 && (
            <div className="w-80 border-l bg-white overflow-auto flex-shrink-0">
              <div className="p-3 border-b bg-blue-50">
                <h3 className="font-bold text-blue-800 text-sm flex items-center gap-2">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/>
                  </svg>
                  RANKING MAIS BARATO
                </h3>
              </div>
              <div className="divide-y">
                {ranking.map((f, idx) => (
                  <div key={f.codFornecedor} className="p-3 hover:bg-gray-50 transition-colors">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-lg">{idx < 3 ? MEDALS[idx] : ''}</span>
                      <span className="text-xs font-bold text-gray-400">{idx + 1}&#186;</span>
                      <span className="text-sm font-semibold text-gray-800 truncate flex-1" title={f.desFornecedor}>
                        {f.desFornecedor}
                      </span>
                    </div>
                    <div className="flex gap-3 text-xs ml-8">
                      <div className="flex items-center gap-1">
                        <span className="w-2 h-2 rounded-full bg-green-500"></span>
                        <span className="text-gray-600">1&#186;: <strong className="text-green-700">{f.qtdMaisBarato}</strong></span>
                      </div>
                      <div className="flex items-center gap-1">
                        <span className="w-2 h-2 rounded-full bg-blue-400"></span>
                        <span className="text-gray-600">2&#186;: <strong className="text-blue-600">{f.qtdSegundo}</strong></span>
                      </div>
                      <div className="flex items-center gap-1">
                        <span className="w-2 h-2 rounded-full bg-orange-400"></span>
                        <span className="text-gray-600">3&#186;: <strong className="text-orange-600">{f.qtdTerceiro}</strong></span>
                      </div>
                    </div>
                    <div className="flex gap-3 text-xs ml-8 mt-1">
                      <span className="text-gray-500">Cotou: {f.qtdCotou}</span>
                      {f.qtdGanhouPedido > 0 && (
                        <span className="text-green-600 font-semibold">
                          Pedidos: {f.qtdGanhouPedido} (R$ {fmtBRL(f.valorTotalPedidos)})
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}
