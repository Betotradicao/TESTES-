import { useState, useEffect } from 'react';
import Layout from '../components/Layout';
import api from '../services/api';

export default function RupturaIndustria() {
  const [fornecedores, setFornecedores] = useState([]);
  const [stats, setStats] = useState({
    TOTAL_PEDIDOS_CANCELADOS: 0,
    TOTAL_FORNECEDORES_AFETADOS: 0,
    VALOR_TOTAL_PERDIDO: 0,
    TOTAL_PRODUTOS_AFETADOS: 0
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filters, setFilters] = useState({
    dataInicio: '',
    dataFim: ''
  });
  const [expandedFornecedor, setExpandedFornecedor] = useState(null);
  const [produtosFornecedor, setProdutosFornecedor] = useState({});
  const [loadingProdutos, setLoadingProdutos] = useState({});
  const [sortConfig, setSortConfig] = useState({ key: 'QTD_PEDIDOS_CANCELADOS', direction: 'desc' });
  const [evolucao, setEvolucao] = useState([]);

  // Carregar ranking de fornecedores
  const loadRanking = async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (filters.dataInicio) params.append('dataInicio', filters.dataInicio);
      if (filters.dataFim) params.append('dataFim', filters.dataFim);
      params.append('limit', '100');

      const response = await api.get(`/ruptura-industria/ranking-fornecedores?${params.toString()}`);
      setFornecedores(response.data.fornecedores || []);
      setStats(response.data.stats || {
        TOTAL_PEDIDOS_CANCELADOS: 0,
        TOTAL_FORNECEDORES_AFETADOS: 0,
        VALOR_TOTAL_PERDIDO: 0,
        TOTAL_PRODUTOS_AFETADOS: 0
      });
    } catch (err) {
      console.error('Erro ao carregar ranking:', err);
      setError('Erro ao carregar ranking. Verifique a conexao com o Oracle.');
    } finally {
      setLoading(false);
    }
  };

  // Carregar evolucao mensal
  const loadEvolucao = async () => {
    try {
      const response = await api.get('/ruptura-industria/evolucao-mensal?meses=12');
      setEvolucao(response.data.evolucao || []);
    } catch (err) {
      console.error('Erro ao carregar evolucao:', err);
    }
  };

  // Carregar produtos de um fornecedor
  const loadProdutosFornecedor = async (codFornecedor) => {
    console.log('=== DEBUG loadProdutosFornecedor ===');
    console.log('codFornecedor:', codFornecedor);

    if (produtosFornecedor[codFornecedor]) return;

    setLoadingProdutos(prev => ({ ...prev, [codFornecedor]: true }));
    try {
      const params = new URLSearchParams();
      if (filters.dataInicio) params.append('dataInicio', filters.dataInicio);
      if (filters.dataFim) params.append('dataFim', filters.dataFim);

      console.log('URL:', `/ruptura-industria/fornecedor/${codFornecedor}/produtos?${params.toString()}`);
      const response = await api.get(`/ruptura-industria/fornecedor/${codFornecedor}/produtos?${params.toString()}`);
      console.log('Response:', response.data);
      setProdutosFornecedor(prev => ({
        ...prev,
        [codFornecedor]: response.data.produtos || []
      }));
    } catch (err) {
      console.error('Erro ao carregar produtos:', err);
      setProdutosFornecedor(prev => ({ ...prev, [codFornecedor]: [] }));
    } finally {
      setLoadingProdutos(prev => ({ ...prev, [codFornecedor]: false }));
    }
  };

  useEffect(() => {
    loadRanking();
    loadEvolucao();
  }, []);

  const handleFilter = () => {
    setExpandedFornecedor(null);
    setProdutosFornecedor({});
    loadRanking();
  };

  const handleClearFilters = () => {
    setFilters({ dataInicio: '', dataFim: '' });
    setExpandedFornecedor(null);
    setProdutosFornecedor({});
    setTimeout(() => loadRanking(), 100);
  };

  const toggleFornecedor = (codFornecedor) => {
    if (expandedFornecedor === codFornecedor) {
      setExpandedFornecedor(null);
    } else {
      setExpandedFornecedor(codFornecedor);
      loadProdutosFornecedor(codFornecedor);
    }
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '-';
    const date = new Date(dateStr);
    return date.toLocaleDateString('pt-BR');
  };

  const formatCurrency = (value) => {
    if (!value) return 'R$ 0,00';
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
  };

  const formatCNPJ = (cnpj) => {
    if (!cnpj) return '-';
    const cleaned = String(cnpj).replace(/\D/g, '');
    if (cleaned.length === 14) {
      return cleaned.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');
    }
    return cnpj;
  };

  // Ordenar fornecedores
  const handleSort = (key) => {
    let direction = 'desc';
    if (sortConfig.key === key && sortConfig.direction === 'desc') {
      direction = 'asc';
    }
    setSortConfig({ key, direction });
  };

  const sortedFornecedores = [...fornecedores].sort((a, b) => {
    if (!sortConfig.key) return 0;

    let aVal = a[sortConfig.key];
    let bVal = b[sortConfig.key];

    if (aVal === null || aVal === undefined) aVal = 0;
    if (bVal === null || bVal === undefined) bVal = 0;

    if (typeof aVal === 'string') {
      aVal = aVal.toLowerCase();
      bVal = String(bVal).toLowerCase();
    }

    if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
    if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
    return 0;
  });

  const SortIcon = ({ columnKey }) => (
    <span className="ml-1 inline-block">
      {sortConfig.key === columnKey ? (
        sortConfig.direction === 'asc' ? '▲' : '▼'
      ) : (
        <span className="text-gray-300">⇅</span>
      )}
    </span>
  );

  // Calcular valor maximo para barras de progresso
  const maxCancelamentos = Math.max(...fornecedores.map(f => f.QTD_PEDIDOS_CANCELADOS || 0), 1);

  return (
    <Layout title="Ruptura Industria">
      <div className="p-4 lg:p-6">
        {/* Header com estatisticas */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
          <div className="bg-white rounded-lg shadow p-4 border-l-4 border-red-500">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-500 uppercase">Pedidos Cancelados</p>
                <p className="text-2xl font-bold text-red-600">{stats.TOTAL_PEDIDOS_CANCELADOS || 0}</p>
              </div>
              <span className="text-3xl">📋</span>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-4 border-l-4 border-orange-500">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-500 uppercase">Fornecedores Afetados</p>
                <p className="text-2xl font-bold text-orange-600">{stats.TOTAL_FORNECEDORES_AFETADOS || 0}</p>
              </div>
              <span className="text-3xl">🏭</span>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-4 border-l-4 border-yellow-500">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-500 uppercase">Produtos Afetados</p>
                <p className="text-2xl font-bold text-yellow-600">{stats.TOTAL_PRODUTOS_AFETADOS || 0}</p>
              </div>
              <span className="text-3xl">📦</span>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-4 border-l-4 border-purple-500">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-500 uppercase">Valor Perdido</p>
                <p className="text-xl font-bold text-purple-600">{formatCurrency(stats.VALOR_TOTAL_PERDIDO)}</p>
              </div>
              <span className="text-3xl">💸</span>
            </div>
          </div>
        </div>

        {/* Evolucao Mensal */}
        {evolucao.length > 0 && (
          <div className="bg-white rounded-lg shadow p-4 mb-4">
            <h3 className="text-sm font-semibold mb-3 text-gray-700">Evolucao Mensal de Cancelamentos</h3>
            <div className="flex items-end gap-1 h-24 overflow-x-auto">
              {evolucao.map((mes, idx) => {
                const maxQtd = Math.max(...evolucao.map(e => e.QTD_PEDIDOS || 0), 1);
                const height = ((mes.QTD_PEDIDOS || 0) / maxQtd) * 100;
                return (
                  <div key={idx} className="flex flex-col items-center min-w-[40px]">
                    <div className="text-xs text-gray-600 font-medium mb-1">{mes.QTD_PEDIDOS || 0}</div>
                    <div
                      className="w-8 bg-red-400 rounded-t transition-all hover:bg-red-500"
                      style={{ height: `${Math.max(height, 5)}%` }}
                      title={`${mes.MES}: ${mes.QTD_PEDIDOS} pedidos - ${formatCurrency(mes.VALOR_TOTAL)}`}
                    ></div>
                    <div className="text-[10px] text-gray-500 mt-1 whitespace-nowrap">
                      {mes.MES?.substring(5)}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Filtros */}
        <div className="bg-white rounded-lg shadow p-3 mb-4">
          <h3 className="text-sm font-semibold mb-2">Filtros</h3>
          <div className="flex flex-wrap gap-2 items-end">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Data Inicio</label>
              <input
                type="date"
                value={filters.dataInicio}
                onChange={(e) => setFilters(prev => ({ ...prev, dataInicio: e.target.value }))}
                className="border rounded px-2 py-1 text-sm focus:ring-1 focus:ring-red-500 focus:border-red-500"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Data Fim</label>
              <input
                type="date"
                value={filters.dataFim}
                onChange={(e) => setFilters(prev => ({ ...prev, dataFim: e.target.value }))}
                className="border rounded px-2 py-1 text-sm focus:ring-1 focus:ring-red-500 focus:border-red-500"
              />
            </div>

            <button
              onClick={handleFilter}
              className="px-4 py-1.5 bg-red-500 text-white rounded text-sm hover:bg-red-600 transition-colors"
            >
              Filtrar
            </button>
            <button
              onClick={handleClearFilters}
              className="px-4 py-1.5 bg-gray-200 text-gray-700 rounded text-sm hover:bg-gray-300 transition-colors"
            >
              Limpar
            </button>
          </div>
        </div>

        {/* Tabela de Ranking */}
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="px-4 py-3 bg-red-50 border-b border-red-200">
            <h3 className="text-sm font-semibold text-red-800">
              Ranking de Fornecedores com Mais Cancelamentos
            </h3>
            <p className="text-xs text-red-600 mt-1">
              Clique no fornecedor para ver os produtos cancelados
            </p>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-red-500"></div>
            </div>
          ) : error ? (
            <div className="text-center py-12 text-red-500">
              <p>{error}</p>
              <button
                onClick={loadRanking}
                className="mt-4 px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600"
              >
                Tentar novamente
              </button>
            </div>
          ) : sortedFornecedores.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              Nenhum cancelamento encontrado no periodo
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="px-2 py-2 text-left text-xs font-semibold text-gray-600 w-8"></th>
                    <th className="px-2 py-2 text-left text-xs font-semibold text-gray-600 w-12">
                      #
                    </th>
                    <th
                      className="px-2 py-2 text-left text-xs font-semibold text-gray-600 cursor-pointer hover:bg-gray-100"
                      onClick={() => handleSort('DES_FORNECEDOR')}
                    >
                      FORNECEDOR<SortIcon columnKey="DES_FORNECEDOR" />
                    </th>
                    <th className="px-2 py-2 text-left text-xs font-semibold text-gray-600">
                      CNPJ
                    </th>
                    <th
                      className="px-2 py-2 text-center text-xs font-semibold text-gray-600 cursor-pointer hover:bg-gray-100"
                      onClick={() => handleSort('QTD_PEDIDOS_CANCELADOS')}
                    >
                      PEDIDOS CANC.<SortIcon columnKey="QTD_PEDIDOS_CANCELADOS" />
                    </th>
                    <th className="px-2 py-2 text-left text-xs font-semibold text-gray-600 w-32">
                      INDICE
                    </th>
                    <th
                      className="px-2 py-2 text-center text-xs font-semibold text-gray-600 cursor-pointer hover:bg-gray-100"
                      onClick={() => handleSort('QTD_PRODUTOS_AFETADOS')}
                    >
                      PRODUTOS<SortIcon columnKey="QTD_PRODUTOS_AFETADOS" />
                    </th>
                    <th
                      className="px-2 py-2 text-right text-xs font-semibold text-gray-600 cursor-pointer hover:bg-gray-100"
                      onClick={() => handleSort('VALOR_TOTAL_CANCELADO')}
                    >
                      VALOR PERDIDO<SortIcon columnKey="VALOR_TOTAL_CANCELADO" />
                    </th>
                    <th
                      className="px-2 py-2 text-center text-xs font-semibold text-gray-600 cursor-pointer hover:bg-gray-100"
                      onClick={() => handleSort('ULTIMO_CANCELAMENTO')}
                    >
                      ULTIMO CANC.<SortIcon columnKey="ULTIMO_CANCELAMENTO" />
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {sortedFornecedores.map((fornecedor, index) => {
                    const isExpanded = expandedFornecedor === fornecedor.COD_FORNECEDOR;
                    const produtos = produtosFornecedor[fornecedor.COD_FORNECEDOR] || [];
                    const isLoadingProds = loadingProdutos[fornecedor.COD_FORNECEDOR];
                    const percentual = ((fornecedor.QTD_PEDIDOS_CANCELADOS || 0) / maxCancelamentos) * 100;

                    return (
                      <>
                        <tr
                          key={fornecedor.COD_FORNECEDOR}
                          className={`hover:bg-gray-50 cursor-pointer ${isExpanded ? 'bg-red-50' : ''}`}
                          onClick={() => toggleFornecedor(fornecedor.COD_FORNECEDOR)}
                        >
                          <td className="px-2 py-2">
                            <button
                              className={`w-5 h-5 flex items-center justify-center rounded border text-xs font-bold transition-colors ${
                                isExpanded
                                  ? 'bg-red-500 text-white border-red-500'
                                  : 'bg-white text-gray-500 border-gray-300 hover:border-red-500 hover:text-red-500'
                              }`}
                            >
                              {isExpanded ? '−' : '+'}
                            </button>
                          </td>
                          <td className="px-2 py-2">
                            <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold ${
                              index === 0 ? 'bg-red-500 text-white' :
                              index === 1 ? 'bg-orange-500 text-white' :
                              index === 2 ? 'bg-yellow-500 text-white' :
                              'bg-gray-200 text-gray-600'
                            }`}>
                              {index + 1}
                            </span>
                          </td>
                          <td className="px-2 py-2 font-medium text-gray-900 max-w-[200px] truncate" title={fornecedor.DES_FORNECEDOR}>
                            {fornecedor.DES_FORNECEDOR || '-'}
                          </td>
                          <td className="px-2 py-2 text-xs text-gray-500 font-mono">
                            {formatCNPJ(fornecedor.NUM_CGC)}
                          </td>
                          <td className="px-2 py-2 text-center">
                            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-bold bg-red-100 text-red-800">
                              {fornecedor.QTD_PEDIDOS_CANCELADOS || 0}
                            </span>
                          </td>
                          <td className="px-2 py-2">
                            <div className="w-full bg-gray-200 rounded-full h-2">
                              <div
                                className="bg-red-500 h-2 rounded-full transition-all"
                                style={{ width: `${percentual}%` }}
                              ></div>
                            </div>
                          </td>
                          <td className="px-2 py-2 text-center text-gray-600">
                            {fornecedor.QTD_PRODUTOS_AFETADOS || 0}
                          </td>
                          <td className="px-2 py-2 text-right font-semibold text-red-600">
                            {formatCurrency(fornecedor.VALOR_TOTAL_CANCELADO)}
                          </td>
                          <td className="px-2 py-2 text-center text-xs text-gray-500">
                            {formatDate(fornecedor.ULTIMO_CANCELAMENTO)}
                          </td>
                        </tr>

                        {/* Linha expandida com produtos */}
                        {isExpanded && (
                          <tr key={`${fornecedor.COD_FORNECEDOR}-produtos`}>
                            <td colSpan="9" className="bg-gray-50 p-4 border-t border-b border-red-200">
                              <div className="ml-8">
                                <h4 className="text-sm font-semibold text-gray-700 mb-3">
                                  Produtos Cancelados de {fornecedor.DES_FORNECEDOR}
                                </h4>

                                {isLoadingProds ? (
                                  <div className="flex items-center justify-center py-4">
                                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-red-500"></div>
                                  </div>
                                ) : produtos.length === 0 ? (
                                  <p className="text-gray-500 text-sm py-2">Nenhum produto encontrado</p>
                                ) : (
                                  <table className="w-full text-xs border border-gray-200 rounded">
                                    <thead className="bg-gray-100">
                                      <tr>
                                        <th className="px-2 py-1.5 text-left font-medium text-gray-600">COD</th>
                                        <th className="px-2 py-1.5 text-left font-medium text-gray-600">PRODUTO</th>
                                        <th className="px-2 py-1.5 text-center font-medium text-gray-600">VEZES CANC.</th>
                                        <th className="px-2 py-1.5 text-right font-medium text-gray-600">QTD TOTAL</th>
                                        <th className="px-2 py-1.5 text-center font-medium text-gray-600">UN</th>
                                        <th className="px-2 py-1.5 text-right font-medium text-gray-600">VALOR PERDIDO</th>
                                        <th className="px-2 py-1.5 text-center font-medium text-gray-600">1o CANC.</th>
                                        <th className="px-2 py-1.5 text-center font-medium text-gray-600">ULTIMO CANC.</th>
                                      </tr>
                                    </thead>
                                    <tbody className="bg-white divide-y divide-gray-100">
                                      {produtos.map((produto, idx) => (
                                        <tr key={idx} className="hover:bg-gray-50">
                                          <td className="px-2 py-1.5 font-mono">{produto.COD_PRODUTO}</td>
                                          <td className="px-2 py-1.5 max-w-[250px] truncate" title={produto.DES_PRODUTO}>
                                            {produto.DES_PRODUTO || '-'}
                                          </td>
                                          <td className="px-2 py-1.5 text-center">
                                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold bg-red-100 text-red-700">
                                              {produto.VEZES_CANCELADO || 0}x
                                            </span>
                                          </td>
                                          <td className="px-2 py-1.5 text-right font-medium">
                                            {(produto.QTD_TOTAL_CANCELADA || 0).toFixed(2)}
                                          </td>
                                          <td className="px-2 py-1.5 text-center">{produto.DES_UNIDADE || '-'}</td>
                                          <td className="px-2 py-1.5 text-right font-medium text-red-600">
                                            {formatCurrency(produto.VALOR_TOTAL_CANCELADO)}
                                          </td>
                                          <td className="px-2 py-1.5 text-center text-gray-500">
                                            {formatDate(produto.PRIMEIRO_CANCELAMENTO)}
                                          </td>
                                          <td className="px-2 py-1.5 text-center text-gray-500">
                                            {formatDate(produto.ULTIMO_CANCELAMENTO)}
                                          </td>
                                        </tr>
                                      ))}
                                    </tbody>
                                    <tfoot className="bg-gray-100">
                                      <tr>
                                        <td colSpan="2" className="px-2 py-1.5 text-right font-medium">
                                          Total: {produtos.length} produtos
                                        </td>
                                        <td className="px-2 py-1.5 text-center font-bold text-red-700">
                                          {produtos.reduce((sum, p) => sum + (p.VEZES_CANCELADO || 0), 0)}x
                                        </td>
                                        <td className="px-2 py-1.5 text-right font-bold">
                                          {produtos.reduce((sum, p) => sum + (p.QTD_TOTAL_CANCELADA || 0), 0).toFixed(2)}
                                        </td>
                                        <td></td>
                                        <td className="px-2 py-1.5 text-right font-bold text-red-600">
                                          {formatCurrency(produtos.reduce((sum, p) => sum + (p.VALOR_TOTAL_CANCELADO || 0), 0))}
                                        </td>
                                        <td colSpan="2"></td>
                                      </tr>
                                    </tfoot>
                                  </table>
                                )}
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
      </div>
    </Layout>
  );
}
