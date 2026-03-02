import { useState, useEffect, useCallback } from 'react';
import Layout from '../components/Layout';
import { api } from '../utils/api';

const COLUNAS_DEFAULT = [
  { id: 'produtoNome', label: 'Produto', align: 'left', type: 'text' },
  { id: 'preco', label: 'Preco Ofertado', align: 'right', type: 'money' },
  { id: 'fornecedor', label: 'Fornecedor', align: 'left', type: 'text' },
  { id: 'dataRecebido', label: 'Data', align: 'left', type: 'date' },
  { id: 'ocorrencias', label: 'Ocorrencias', align: 'center', type: 'number' },
  { id: 'tabloid', label: 'Tabloid', align: 'center', type: 'action' },
];

export default function GarimpadorForaMix() {
  const [produtos, setProdutos] = useState([]);
  const [loading, setLoading] = useState(false);
  const [dataInicio, setDataInicio] = useState('');
  const [dataFim, setDataFim] = useState('');
  const [busca, setBusca] = useState('');
  const [sortCol, setSortCol] = useState(null);
  const [sortDir, setSortDir] = useState('asc');
  const [colunas, setColunas] = useState(COLUNAS_DEFAULT);
  const [dragIdx, setDragIdx] = useState(null);
  const [tabloidUrl, setTabloidUrl] = useState(null);
  const [excluidos, setExcluidos] = useState(new Set());
  const [salvando, setSalvando] = useState(false);

  const fmtBRL = (v) => Number(v || 0).toFixed(2).replace('.', ',');

  // Carregar exclusoes salvas
  useEffect(() => {
    api.get('/garimpador/produtos-excluidos').then(({ data }) => {
      setExcluidos(new Set((data.excluidos || []).map(String)));
    }).catch(() => {});
  }, []);

  const fetchProdutos = useCallback(async () => {
    try {
      setLoading(true);
      const params = {};
      if (dataInicio) params.dataInicio = dataInicio;
      if (dataFim) params.dataFim = dataFim;
      const { data } = await api.get('/garimpador/analytics/fora-mix', { params });
      setProdutos(data.produtos || []);
    } catch (err) {
      console.error('Erro ao buscar fora do mix:', err);
    } finally {
      setLoading(false);
    }
  }, [dataInicio, dataFim]);

  useEffect(() => { fetchProdutos(); }, [fetchProdutos]);

  // Excluir produto (adiciona nome normalizado a lista)
  const excluirProduto = async (produtoNome) => {
    const nomeNorm = produtoNome.toUpperCase().trim();
    const novosExcluidos = new Set(excluidos);
    novosExcluidos.add(nomeNorm);
    setExcluidos(novosExcluidos);

    // Salvar no backend
    try {
      await api.post('/garimpador/produtos-excluidos', {
        excluidos: Array.from(novosExcluidos),
      });
    } catch (err) {
      console.error('Erro ao salvar exclusao:', err);
    }
  };

  // Restaurar produto excluido
  const restaurarProduto = async (produtoNome) => {
    const nomeNorm = produtoNome.toUpperCase().trim();
    const novosExcluidos = new Set(excluidos);
    novosExcluidos.delete(nomeNorm);
    setExcluidos(novosExcluidos);

    try {
      await api.post('/garimpador/produtos-excluidos', {
        excluidos: Array.from(novosExcluidos),
      });
    } catch (err) {
      console.error('Erro ao restaurar produto:', err);
    }
  };

  // Filtro local por busca (e remove excluidos)
  const produtosFiltrados = produtos.filter(p => {
    const nomeNorm = (p.produtoNome || '').toUpperCase().trim();
    if (excluidos.has(nomeNorm)) return false;
    if (!busca.trim()) return true;
    return p.produtoNome.toUpperCase().includes(busca.toUpperCase()) ||
           p.fornecedor.toUpperCase().includes(busca.toUpperCase());
  });

  // Ordenacao
  const produtosOrdenados = [...produtosFiltrados];
  if (sortCol) {
    produtosOrdenados.sort((a, b) => {
      let va = a[sortCol];
      let vb = b[sortCol];
      if (sortCol === 'dataRecebido') {
        va = va ? new Date(va).getTime() : 0;
        vb = vb ? new Date(vb).getTime() : 0;
      } else if (typeof va === 'string') {
        va = va.toUpperCase();
        vb = (vb || '').toUpperCase();
      }
      if (va < vb) return sortDir === 'asc' ? -1 : 1;
      if (va > vb) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });
  }

  // Sort handler
  const handleSort = (colId) => {
    if (colId === 'tabloid') return;
    if (sortCol === colId) {
      setSortDir(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortCol(colId);
      setSortDir('asc');
    }
  };

  // Drag & drop reorder columns
  const handleDragStart = (idx) => setDragIdx(idx);
  const handleDragOver = (e) => e.preventDefault();
  const handleDrop = (targetIdx) => {
    if (dragIdx === null || dragIdx === targetIdx) return;
    const newCols = [...colunas];
    const [moved] = newCols.splice(dragIdx, 1);
    newCols.splice(targetIdx, 0, moved);
    setColunas(newCols);
    setDragIdx(null);
  };

  // Sort indicator
  const SortIcon = ({ colId }) => {
    if (sortCol !== colId) return <span className="text-gray-300 ml-1">{'\u2195'}</span>;
    return <span className="text-orange-500 ml-1">{sortDir === 'asc' ? '\u2191' : '\u2193'}</span>;
  };

  // Stats
  const fornecedoresUnicos = new Set(produtos.map(p => p.fornecedor)).size;

  // Render cell value
  const renderCell = (p, col) => {
    switch (col.id) {
      case 'produtoNome':
        return <span className="font-medium text-gray-800">{p.produtoNome}</span>;
      case 'preco':
        return <span className="font-semibold text-orange-600">R$ {fmtBRL(p.preco)}</span>;
      case 'fornecedor':
        return <span className="text-gray-600">{p.fornecedor}</span>;
      case 'dataRecebido':
        return <span className="text-gray-500">{p.dataRecebido ? new Date(p.dataRecebido).toLocaleDateString('pt-BR') : '-'}</span>;
      case 'ocorrencias':
        return (
          <span className={`px-2 py-0.5 rounded text-xs font-semibold ${
            p.ocorrencias > 2 ? 'bg-red-100 text-red-700' :
            p.ocorrencias > 1 ? 'bg-yellow-100 text-yellow-700' :
            'bg-gray-100 text-gray-600'
          }`}>
            {p.ocorrencias}x
          </span>
        );
      case 'tabloid':
        return p.mediaUrl ? (
          <button
            onClick={(e) => { e.stopPropagation(); setTabloidUrl(p.mediaUrl); }}
            className="text-blue-600 hover:text-blue-800 underline text-xs font-medium"
          >
            Ver
          </button>
        ) : (
          <span className="text-gray-300 text-xs">-</span>
        );
      default:
        return '-';
    }
  };

  return (
    <Layout>
      <div className="p-4 lg:p-6 space-y-4">
        {/* Header */}
        <div className="bg-gradient-to-br from-orange-500 to-amber-600 rounded-xl p-5 text-white shadow-lg">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold">Produtos Fora do Mix</h1>
              <p className="text-orange-100 text-sm mt-1">Produtos ofertados que nao foram encontrados no sistema</p>
            </div>
            <div className="flex gap-3">
              <div className="bg-white/20 rounded-lg p-3 text-center min-w-[80px]">
                <div className="text-2xl font-bold">{produtosOrdenados.length}</div>
                <div className="text-xs text-orange-100">Produtos</div>
              </div>
              <div className="bg-white/20 rounded-lg p-3 text-center min-w-[80px]">
                <div className="text-2xl font-bold">{fornecedoresUnicos}</div>
                <div className="text-xs text-orange-100">Fornecedores</div>
              </div>
              {excluidos.size > 0 && (
                <div className="bg-white/20 rounded-lg p-3 text-center min-w-[80px]">
                  <div className="text-2xl font-bold">{excluidos.size}</div>
                  <div className="text-xs text-orange-100">Excluidos</div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Filtros */}
        <div className="bg-white rounded-lg shadow p-4 flex flex-wrap items-center gap-3">
          <input
            type="text"
            placeholder="Buscar produto ou fornecedor..."
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            className="flex-1 min-w-[200px] border rounded-lg px-3 py-1.5 text-sm focus:ring-2 focus:ring-orange-300 focus:border-orange-400 outline-none"
          />
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
          <button onClick={fetchProdutos}
            className="bg-orange-500 text-white px-4 py-1.5 rounded text-sm hover:bg-orange-600 transition-colors">
            Atualizar
          </button>
        </div>

        {/* Dica de reordenacao */}
        <div className="text-xs text-gray-400 text-right">
          Arraste os cabecalhos para reordenar colunas | Clique para ordenar A-Z
        </div>

        {/* Tabela */}
        {loading ? (
          <div className="text-center py-10 text-gray-500">Carregando...</div>
        ) : produtosOrdenados.length === 0 ? (
          <div className="text-center py-10 text-gray-400">
            {busca ? `Nenhum produto encontrado para "${busca}"` : 'Nenhum produto fora do mix encontrado'}
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <div className="p-3 border-b flex items-center justify-between">
              <h3 className="text-sm font-semibold text-gray-700">
                {produtosOrdenados.length} produto{produtosOrdenados.length !== 1 ? 's' : ''} fora do mix
              </h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="text-left p-2.5 font-semibold text-gray-600 w-8">#</th>
                    {colunas.map((col, idx) => (
                      <th
                        key={col.id}
                        draggable
                        onDragStart={() => handleDragStart(idx)}
                        onDragOver={handleDragOver}
                        onDrop={() => handleDrop(idx)}
                        onClick={() => handleSort(col.id)}
                        className={`p-2.5 font-semibold text-gray-600 cursor-pointer select-none hover:bg-gray-100 transition-colors ${
                          col.align === 'right' ? 'text-right' : col.align === 'center' ? 'text-center' : 'text-left'
                        } ${dragIdx === idx ? 'bg-orange-50 opacity-70' : ''}`}
                      >
                        <span className="inline-flex items-center gap-0.5">
                          {col.label}
                          {col.id !== 'tabloid' && <SortIcon colId={col.id} />}
                        </span>
                      </th>
                    ))}
                    <th className="p-2.5 font-semibold text-gray-600 text-center w-20">Acao</th>
                  </tr>
                </thead>
                <tbody>
                  {produtosOrdenados.map((p, i) => (
                    <tr key={i} className="border-b hover:bg-gray-50">
                      <td className="p-2.5 text-gray-400">{i + 1}</td>
                      {colunas.map((col) => (
                        <td key={col.id} className={`p-2.5 ${
                          col.align === 'right' ? 'text-right' : col.align === 'center' ? 'text-center' : 'text-left'
                        }`}>
                          {renderCell(p, col)}
                        </td>
                      ))}
                      <td className="p-2.5 text-center">
                        <button
                          onClick={() => excluirProduto(p.produtoNome)}
                          className="bg-red-50 text-red-600 hover:bg-red-100 px-2 py-1 rounded text-xs font-medium transition-colors"
                          title="Excluir dos cruzamentos"
                        >
                          Excluir
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
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
                <h3 className="font-semibold text-gray-800 text-sm">Tabloid / Imagem Original</h3>
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
