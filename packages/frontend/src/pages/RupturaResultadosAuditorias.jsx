import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Layout from '../components/Layout';
import api from '../services/api';

export default function RupturaResultadosAuditorias() {
  const navigate = useNavigate();

  // Filtros
  const [dataInicio, setDataInicio] = useState('');
  const [dataFim, setDataFim] = useState('');
  const [produtoSelecionado, setProdutoSelecionado] = useState('todos');
  const [fornecedorSelecionado, setFornecedorSelecionado] = useState('todos');
  const [auditorSelecionado, setAuditorSelecionado] = useState('todos');

  // Dados
  const [produtos, setProdutos] = useState([]);
  const [fornecedores, setFornecedores] = useState([]);
  const [auditores, setAuditores] = useState([]);
  const [resultados, setResultados] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    loadFilterOptions();

    // Definir período padrão: últimos 30 dias
    const hoje = new Date();
    const trintaDiasAtras = new Date();
    trintaDiasAtras.setDate(hoje.getDate() - 30);

    setDataFim(hoje.toISOString().split('T')[0]);
    setDataInicio(trintaDiasAtras.toISOString().split('T')[0]);
  }, []);

  const loadFilterOptions = async () => {
    try {
      // Buscar produtos únicos
      const produtosRes = await api.get('/rupture-surveys/filters/produtos');
      setProdutos(Array.isArray(produtosRes.data) ? produtosRes.data : []);

      // Buscar fornecedores únicos
      const fornecedoresRes = await api.get('/rupture-surveys/filters/fornecedores');
      setFornecedores(Array.isArray(fornecedoresRes.data) ? fornecedoresRes.data : []);

      // Buscar auditores (employees) - endpoint retorna { data: [...], total, page, limit }
      const auditoresRes = await api.get('/employees?active=true&limit=100');
      const auditorList = Array.isArray(auditoresRes.data?.data) ? auditoresRes.data.data : [];
      setAuditores(auditorList);
    } catch (err) {
      console.error('Erro ao carregar filtros:', err);
      setProdutos([]);
      setFornecedores([]);
      setAuditores([]);
    }
  };

  const handleFiltrar = async () => {
    if (!dataInicio || !dataFim) {
      setError('Selecione o período (data início e fim)');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const params = new URLSearchParams({
        data_inicio: dataInicio,
        data_fim: dataFim,
        produto: produtoSelecionado,
        fornecedor: fornecedorSelecionado,
        auditor: auditorSelecionado,
      });

      const response = await api.get(`/rupture-surveys/agregado?${params}`);
      setResultados(response.data);
    } catch (err) {
      setError(err.response?.data?.error || 'Erro ao buscar resultados');
    } finally {
      setLoading(false);
    }
  };

  // Executar filtro automaticamente quando período for definido
  useEffect(() => {
    if (dataInicio && dataFim) {
      handleFiltrar();
    }
  }, [dataInicio, dataFim]);

  const stats = resultados?.estatisticas || {};
  const itensRuptura = resultados?.itens_ruptura || [];
  const fornecedoresRanking = resultados?.fornecedores_ranking || [];
  const secoesRanking = resultados?.secoes_ranking || [];

  return (
    <Layout>
      <div className="p-4 lg:p-8">
        {/* Card com Gradiente Laranja */}
        <div className="bg-gradient-to-br from-orange-500 to-red-600 rounded-lg shadow-lg p-6 mb-8 text-white">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-2xl lg:text-3xl font-bold">📊 Resultados das Auditorias</h1>
            <div className="bg-white/20 backdrop-blur-sm rounded-full p-3">
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/>
              </svg>
            </div>
          </div>
          <p className="text-white/90">
            Análise agregada de múltiplas pesquisas de ruptura com filtros avançados
          </p>
        </div>

        {/* Filtros */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h2 className="text-lg font-bold text-gray-800 mb-4">🔍 Filtros</h2>

          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            {/* Data Início */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Data Início
              </label>
              <input
                type="date"
                value={dataInicio}
                onChange={(e) => setDataInicio(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Data Fim */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Data Fim
              </label>
              <input
                type="date"
                value={dataFim}
                onChange={(e) => setDataFim(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Produto */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Produto
              </label>
              <input
                type="text"
                value={produtoSelecionado === 'todos' ? '' : produtoSelecionado}
                onChange={(e) => setProdutoSelecionado(e.target.value || 'todos')}
                placeholder="Digite o nome do produto ou deixe vazio para todos"
                list="produtos-list"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
              <datalist id="produtos-list">
                {Array.isArray(produtos) && produtos.map((p) => (
                  <option key={p} value={p} />
                ))}
              </datalist>
            </div>

            {/* Fornecedor */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Fornecedor
              </label>
              <select
                value={fornecedorSelecionado}
                onChange={(e) => setFornecedorSelecionado(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value="todos">Todos</option>
                {Array.isArray(fornecedores) && fornecedores.map((f) => (
                  <option key={f} value={f}>{f}</option>
                ))}
              </select>
            </div>

            {/* Auditor */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Auditor
              </label>
              <select
                value={auditorSelecionado}
                onChange={(e) => setAuditorSelecionado(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value="todos">Todos</option>
                {Array.isArray(auditores) && auditores.map((a) => (
                  <option key={a.id} value={a.name}>{a.name}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="mt-4 flex space-x-4">
            <button
              onClick={handleFiltrar}
              disabled={loading}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
            >
              {loading ? '⏳ Carregando...' : '🔍 Aplicar Filtros'}
            </button>
            <button
              onClick={() => {
                setProdutoSelecionado('todos');
                setFornecedorSelecionado('todos');
                setAuditorSelecionado('todos');
              }}
              className="px-6 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
            >
              🔄 Limpar Filtros
            </button>
          </div>

          {error && (
            <div className="mt-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded">
              {error}
            </div>
          )}
        </div>

        {/* Resultados */}
        {resultados && (
          <>
            {/* KPI Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              <div className="bg-white rounded-lg shadow p-6 text-center">
                <div className="text-4xl font-bold text-gray-800">{stats.total_itens_verificados || 0}</div>
                <div className="text-sm text-gray-600 mt-1">Itens Verificados</div>
              </div>

              <div className="bg-white rounded-lg shadow p-6 text-center">
                <div className="text-4xl font-bold text-green-600">{stats.total_encontrados || 0}</div>
                <div className="text-sm text-gray-600 mt-1">Encontrados</div>
              </div>

              <div className="bg-white rounded-lg shadow p-6 text-center">
                <div className="text-4xl font-bold text-red-600">{stats.total_rupturas || 0}</div>
                <div className="text-sm text-gray-600 mt-1">Rupturas Total</div>
                {(stats.rupturas_nao_encontrado > 0 || stats.rupturas_em_estoque > 0) && (
                  <div className="text-xs text-gray-500 mt-2">
                    {stats.rupturas_nao_encontrado > 0 && <div>{stats.rupturas_nao_encontrado} Não Encontrado</div>}
                    {stats.rupturas_em_estoque > 0 && <div>{stats.rupturas_em_estoque} Em Estoque</div>}
                  </div>
                )}
              </div>

              <div className="bg-white rounded-lg shadow p-6 text-center">
                <div className="text-4xl font-bold text-blue-600">
                  {stats.taxa_ruptura ? Number(stats.taxa_ruptura).toFixed(1) : '0'}%
                </div>
                <div className="text-sm text-gray-600 mt-1">Taxa Ruptura</div>
              </div>
            </div>

            {/* Financial Impact - Baseado no Período */}
            <div className="grid grid-cols-2 md:grid-cols-2 gap-4 mb-6">
              <div className="bg-red-50 border border-red-200 rounded-lg shadow p-6 text-center">
                <div className="text-3xl font-bold text-red-700">
                  R$ {Number(stats.perda_venda_periodo || 0).toFixed(2)}
                </div>
                <div className="text-sm text-red-600 mt-1">Perda Venda no Período</div>
              </div>

              <div className="bg-orange-50 border border-orange-200 rounded-lg shadow p-6 text-center">
                <div className="text-3xl font-bold text-orange-700">
                  R$ {Number(stats.perda_lucro_periodo || 0).toFixed(2)}
                </div>
                <div className="text-sm text-orange-600 mt-1">Perda Lucro no Período</div>
              </div>
            </div>

            {/* Produtos com Ruptura - Largura Total */}
            <div className="mb-6">
              <div className="bg-white rounded-lg shadow p-6">
                <h2 className="text-xl font-bold text-gray-800 mb-4">
                  📦 Produtos com Ruptura ({itensRuptura.length})
                </h2>

                {itensRuptura.length === 0 ? (
                  <p className="text-gray-500 text-center py-8">
                    🎉 Nenhuma ruptura encontrada no período!
                  </p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="min-w-full text-sm">
                      <thead className="bg-gray-50 border-b">
                        <tr>
                          <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">#</th>
                          <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Produto</th>
                          <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Fornecedor</th>
                          <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Seção</th>
                          <th className="px-3 py-2 text-center text-xs font-medium text-gray-500 uppercase">Curva</th>
                          <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">Estoque</th>
                          <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">V.Média/Dia</th>
                          <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">Valor Venda</th>
                          <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">Margem %</th>
                          <th className="px-3 py-2 text-center text-xs font-medium text-gray-500 uppercase">Pedido</th>
                          <th className="px-3 py-2 text-center text-xs font-medium text-gray-500 uppercase">Ocorrências</th>
                          <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">Perda Total</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        {itensRuptura.slice(0, 20).map((item, idx) => (
                          <tr key={idx} className="hover:bg-gray-50">
                            <td className="px-3 py-2 text-gray-600">{idx + 1}</td>
                            <td className="px-3 py-2">
                              <p className="font-medium text-gray-800 max-w-xs truncate" title={item.descricao}>
                                {item.descricao}
                              </p>
                            </td>
                            <td className="px-3 py-2 text-gray-600 max-w-xs truncate" title={item.fornecedor}>
                              {item.fornecedor}
                            </td>
                            <td className="px-3 py-2 text-gray-600 max-w-xs truncate" title={item.secao}>
                              {item.secao}
                            </td>
                            <td className="px-3 py-2 text-center">
                              <span className={`inline-block px-2 py-1 rounded text-xs font-bold ${
                                item.curva === 'A' ? 'bg-red-100 text-red-700' :
                                item.curva === 'B' ? 'bg-yellow-100 text-yellow-700' :
                                item.curva === 'C' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'
                              }`}>
                                {item.curva}
                              </span>
                            </td>
                            <td className="px-3 py-2 text-right">
                              <span className={item.estoque_atual > 0 ? 'text-green-600' : 'text-red-600'}>
                                {Number(item.estoque_atual || 0).toFixed(0)}
                              </span>
                            </td>
                            <td className="px-3 py-2 text-right text-gray-700">
                              {Number(item.venda_media_dia || 0).toFixed(2)}
                            </td>
                            <td className="px-3 py-2 text-right text-gray-700">
                              R$ {Number(item.valor_venda || 0).toFixed(2)}
                            </td>
                            <td className="px-3 py-2 text-right text-gray-700">
                              {Number(item.margem_lucro || 0).toFixed(1)}%
                            </td>
                            <td className="px-3 py-2 text-center">
                              <span className={`inline-block px-2 py-1 rounded text-xs font-bold ${
                                item.tem_pedido === 'Sim' ? 'bg-green-100 text-green-700' :
                                item.tem_pedido === 'Não' ? 'bg-red-100 text-red-700' :
                                'bg-gray-100 text-gray-600'
                              }`}>
                                {item.tem_pedido || '-'}
                              </span>
                            </td>
                            <td className="px-3 py-2 text-center">
                              <span className="inline-block px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs font-bold">
                                {item.ocorrencias}
                              </span>
                            </td>
                            <td className="px-3 py-2 text-right">
                              <span className="font-bold text-red-600">
                                R$ {Number(item.perda_total || 0).toFixed(2)}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>

            {/* Fornecedores e Setores */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">

              {/* Fornecedores com mais Rupturas */}
              <div className="bg-white rounded-lg shadow p-6">
                <h2 className="text-xl font-bold text-gray-800 mb-4">
                  🏪 Fornecedores
                </h2>

                {fornecedoresRanking.length === 0 ? (
                  <p className="text-gray-500 text-center py-8">
                    Nenhuma ruptura
                  </p>
                ) : (
                  <div className="space-y-4 max-h-96 overflow-y-auto">
                    {fornecedoresRanking.slice(0, 15).map((forn, idx) => {
                      const maxRupturas = Math.max(...fornecedoresRanking.map(f => f.rupturas));
                      const percentage = (forn.rupturas / maxRupturas) * 100;

                      return (
                        <div key={idx}>
                          <div className="flex items-center justify-between mb-1">
                            <div className="flex-1">
                              <p className="font-semibold text-gray-800 text-sm truncate" title={forn.fornecedor}>
                                {forn.fornecedor}
                              </p>
                              <p className="text-xs text-gray-500">
                                {forn.rupturas} {forn.rupturas === 1 ? 'ruptura' : 'rupturas'}
                              </p>
                            </div>
                            <div className="text-right ml-4">
                              <p className="text-sm font-bold text-red-600">
                                R$ {Number(forn.perda_total || 0).toFixed(2)}
                              </p>
                            </div>
                          </div>
                          <div className="w-full bg-gray-200 rounded-full h-2">
                            <div
                              className="bg-red-500 h-2 rounded-full transition-all"
                              style={{ width: `${percentage}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Setores (Seções) com mais Rupturas */}
              <div className="bg-white rounded-lg shadow p-6">
                <h2 className="text-xl font-bold text-gray-800 mb-4">
                  🏬 Setores
                </h2>

                {secoesRanking.length === 0 ? (
                  <p className="text-gray-500 text-center py-8">
                    Nenhuma ruptura
                  </p>
                ) : (
                  <div className="space-y-4 max-h-96 overflow-y-auto">
                    {secoesRanking.slice(0, 15).map((sec, idx) => {
                      const maxRupturas = Math.max(...secoesRanking.map(s => s.rupturas));
                      const percentage = (sec.rupturas / maxRupturas) * 100;

                      return (
                        <div key={idx}>
                          <div className="flex items-center justify-between mb-1">
                            <div className="flex-1">
                              <p className="font-semibold text-gray-800 text-sm truncate" title={sec.secao}>
                                {sec.secao}
                              </p>
                              <p className="text-xs text-gray-500">
                                {sec.rupturas} {sec.rupturas === 1 ? 'ruptura' : 'rupturas'}
                              </p>
                            </div>
                            <div className="text-right ml-4">
                              <p className="text-sm font-bold text-red-600">
                                R$ {Number(sec.perda_total || 0).toFixed(2)}
                              </p>
                            </div>
                          </div>
                          <div className="w-full bg-gray-200 rounded-full h-2">
                            <div
                              className="bg-orange-500 h-2 rounded-full transition-all"
                              style={{ width: `${percentage}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </>
        )}

        {!resultados && !loading && (
          <div className="bg-white rounded-lg shadow p-12 text-center">
            <div className="text-6xl mb-4">📊</div>
            <p className="text-xl text-gray-600">
              Selecione um período e clique em "Aplicar Filtros" para ver os resultados
            </p>
          </div>
        )}
      </div>
    </Layout>
  );
}
