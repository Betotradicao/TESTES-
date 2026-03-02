import { useState, useEffect, useCallback } from 'react';
import Layout from '../components/Layout';
import { api } from '../utils/api';

export default function GarimpadorForaMix() {
  const [produtos, setProdutos] = useState([]);
  const [loading, setLoading] = useState(false);
  const [dataInicio, setDataInicio] = useState('');
  const [dataFim, setDataFim] = useState('');
  const [busca, setBusca] = useState('');

  const fmtBRL = (v) => Number(v || 0).toFixed(2).replace('.', ',');

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

  // Filtro local por busca
  const produtosFiltrados = busca.trim()
    ? produtos.filter(p =>
        p.produtoNome.toUpperCase().includes(busca.toUpperCase()) ||
        p.fornecedor.toUpperCase().includes(busca.toUpperCase())
      )
    : produtos;

  // Agrupar por fornecedor para stats
  const fornecedoresUnicos = new Set(produtos.map(p => p.fornecedor)).size;

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
                <div className="text-2xl font-bold">{produtos.length}</div>
                <div className="text-xs text-orange-100">Produtos</div>
              </div>
              <div className="bg-white/20 rounded-lg p-3 text-center min-w-[80px]">
                <div className="text-2xl font-bold">{fornecedoresUnicos}</div>
                <div className="text-xs text-orange-100">Fornecedores</div>
              </div>
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

        {/* Tabela */}
        {loading ? (
          <div className="text-center py-10 text-gray-500">Carregando...</div>
        ) : produtosFiltrados.length === 0 ? (
          <div className="text-center py-10 text-gray-400">
            {busca ? `Nenhum produto encontrado para "${busca}"` : 'Nenhum produto fora do mix encontrado'}
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <div className="p-3 border-b flex items-center justify-between">
              <h3 className="text-sm font-semibold text-gray-700">
                {produtosFiltrados.length} produto{produtosFiltrados.length !== 1 ? 's' : ''} fora do mix
              </h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="text-left p-2.5 font-semibold text-gray-600">#</th>
                    <th className="text-left p-2.5 font-semibold text-gray-600">Produto</th>
                    <th className="text-right p-2.5 font-semibold text-gray-600">Preco Ofertado</th>
                    <th className="text-left p-2.5 font-semibold text-gray-600">Fornecedor</th>
                    <th className="text-left p-2.5 font-semibold text-gray-600">Data</th>
                    <th className="text-center p-2.5 font-semibold text-gray-600">Ocorrencias</th>
                  </tr>
                </thead>
                <tbody>
                  {produtosFiltrados.map((p, i) => (
                    <tr key={i} className="border-b hover:bg-gray-50">
                      <td className="p-2.5 text-gray-400">{i + 1}</td>
                      <td className="p-2.5 font-medium text-gray-800">{p.produtoNome}</td>
                      <td className="p-2.5 text-right font-semibold text-orange-600">R$ {fmtBRL(p.preco)}</td>
                      <td className="p-2.5 text-gray-600">{p.fornecedor}</td>
                      <td className="p-2.5 text-gray-500">
                        {p.dataRecebido ? new Date(p.dataRecebido).toLocaleDateString('pt-BR') : '-'}
                      </td>
                      <td className="p-2.5 text-center">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                          p.ocorrencias > 2 ? 'bg-red-100 text-red-700' :
                          p.ocorrencias > 1 ? 'bg-yellow-100 text-yellow-700' :
                          'bg-gray-100 text-gray-600'
                        }`}>
                          {p.ocorrencias}x
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
