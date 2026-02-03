import { useState, useEffect } from 'react';
import Layout from '../components/Layout';
import { api } from '../utils/api';
import { useLoja } from '../contexts/LojaContext';

export default function GestaoTrocas() {
  const { lojaSelecionada } = useLoja();
  // Aba selecionada: 'saidas' ou 'entradas'
  const [abaAtiva, setAbaAtiva] = useState('saidas');

  // Filtro de período (em dias) - 0 = todos
  const [diasFiltro, setDiasFiltro] = useState(0);

  // Dados
  const [resultados, setResultados] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Fornecedores expandidos (para mostrar itens)
  const [expandidos, setExpandidos] = useState(new Set());
  const [itensCarregando, setItensCarregando] = useState(new Set());
  const [itensPorFornecedor, setItensPorFornecedor] = useState({});

  // Carregar dados quando a aba, filtro ou loja mudar
  useEffect(() => {
    carregarTrocas();
  }, [abaAtiva, diasFiltro, lojaSelecionada]);

  const carregarTrocas = async () => {
    setLoading(true);
    setError('');
    setExpandidos(new Set());
    setItensPorFornecedor({});

    try {
      const params = new URLSearchParams({ tipo: abaAtiva });
      if (diasFiltro > 0) {
        params.append('dias', diasFiltro.toString());
      }
      if (lojaSelecionada) {
        params.append('codLoja', lojaSelecionada);
      }
      const response = await api.get(`/losses/oracle/trocas?${params}`);
      setResultados(response.data);
    } catch (err) {
      setError(err.response?.data?.error || 'Erro ao buscar trocas do Oracle');
    } finally {
      setLoading(false);
    }
  };

  const toggleFornecedor = async (codFornecedor) => {
    const newExpandidos = new Set(expandidos);

    if (newExpandidos.has(codFornecedor)) {
      // Fechar
      newExpandidos.delete(codFornecedor);
      setExpandidos(newExpandidos);
    } else {
      // Abrir e carregar itens se ainda não carregou
      newExpandidos.add(codFornecedor);
      setExpandidos(newExpandidos);

      if (!itensPorFornecedor[codFornecedor]) {
        // Carregar itens do fornecedor
        setItensCarregando(prev => new Set(prev).add(codFornecedor));

        try {
          const params = new URLSearchParams({
            cod_fornecedor: codFornecedor.toString(),
            tipo: abaAtiva,
          });
          if (diasFiltro > 0) {
            params.append('dias', diasFiltro.toString());
          }
          if (lojaSelecionada) {
            params.append('codLoja', lojaSelecionada);
          }

          const response = await api.get(`/losses/oracle/trocas/itens?${params}`);
          setItensPorFornecedor(prev => ({
            ...prev,
            [codFornecedor]: response.data.itens,
          }));
        } catch (err) {
          console.error('Erro ao carregar itens:', err);
        } finally {
          setItensCarregando(prev => {
            const newSet = new Set(prev);
            newSet.delete(codFornecedor);
            return newSet;
          });
        }
      }
    }
  };

  const stats = resultados?.estatisticas || {};
  const fornecedores = resultados?.fornecedores || [];

  return (
    <Layout>
      <div className="p-4 lg:p-8">
        {/* Card com Gradiente Laranja */}
        <div className="bg-gradient-to-br from-orange-500 to-orange-600 rounded-lg shadow-lg p-6 mb-8 text-white">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-2xl lg:text-3xl font-bold">Gestão das Trocas</h1>
            <div className="bg-white/20 backdrop-blur-sm rounded-full p-3">
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4"/>
              </svg>
            </div>
          </div>
          <p className="text-white/90">
            Análise de trocas com fornecedores direto do sistema Oracle (Intersolid)
          </p>
        </div>

        {/* Abas */}
        <div className="bg-white rounded-lg shadow-md mb-6">
          <div className="flex border-b">
            <button
              onClick={() => setAbaAtiva('saidas')}
              className={`flex-1 py-4 px-6 text-center font-semibold transition-colors ${
                abaAtiva === 'saidas'
                  ? 'text-orange-600 border-b-2 border-orange-600 bg-orange-50'
                  : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
              }`}
            >
              <div className="flex items-center justify-center gap-2">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"/>
                </svg>
                <span>Saídas para Troca</span>
              </div>
            </button>
            <button
              onClick={() => setAbaAtiva('entradas')}
              className={`flex-1 py-4 px-6 text-center font-semibold transition-colors ${
                abaAtiva === 'entradas'
                  ? 'text-green-600 border-b-2 border-green-600 bg-green-50'
                  : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
              }`}
            >
              <div className="flex items-center justify-center gap-2">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1"/>
                </svg>
                <span>Retorno de Troca</span>
              </div>
            </button>
          </div>

          {/* Filtro de Período */}
          <div className="p-4 bg-gray-50 border-t flex items-center justify-between">
            <div className="flex items-center gap-2">
              <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/>
              </svg>
              <span className="text-sm font-medium text-gray-700">Período:</span>
            </div>
            <select
              value={diasFiltro}
              onChange={(e) => setDiasFiltro(parseInt(e.target.value))}
              className="px-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
            >
              <option value={0}>Todos os registros</option>
              <option value={30}>Últimos 30 dias</option>
              <option value={60}>Últimos 60 dias</option>
              <option value={90}>Últimos 90 dias</option>
              <option value={95}>Últimos 95 dias (64 forn)</option>
              <option value={120}>Últimos 120 dias</option>
              <option value={180}>Últimos 180 dias</option>
              <option value={365}>Último ano</option>
            </select>
          </div>
        </div>

        {/* Loading */}
        {loading && (
          <div className="bg-white rounded-lg shadow-md p-6 mb-6 text-center">
            <div className={`animate-spin w-8 h-8 border-4 ${abaAtiva === 'saidas' ? 'border-orange-500' : 'border-green-500'} border-t-transparent rounded-full mx-auto mb-2`}></div>
            <p className="text-gray-500">Carregando {abaAtiva === 'saidas' ? 'saídas' : 'entradas'}...</p>
          </div>
        )}

        {/* Erro */}
        {error && (
          <div className="bg-white rounded-lg shadow-md p-6 mb-6">
            <div className="p-3 bg-red-100 border border-red-400 text-red-700 rounded">
              {error}
            </div>
            <button
              onClick={carregarTrocas}
              className={`mt-4 px-6 py-2 text-white rounded-lg transition-colors ${
                abaAtiva === 'saidas' ? 'bg-orange-600 hover:bg-orange-700' : 'bg-green-600 hover:bg-green-700'
              }`}
            >
              Tentar Novamente
            </button>
          </div>
        )}

        {/* Resultados */}
        {resultados && !loading && (
          <>
            {/* KPI Cards */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
              <div className="bg-white rounded-lg shadow p-6 text-center">
                <div className={`text-4xl font-bold ${abaAtiva === 'saidas' ? 'text-orange-600' : 'text-green-600'}`}>
                  {stats.total_fornecedores || 0}
                </div>
                <div className="text-sm text-gray-600 mt-1">Fornecedores</div>
              </div>

              <div className="bg-white rounded-lg shadow p-6 text-center">
                <div className="text-4xl font-bold text-purple-600">{stats.total_produtos || 0}</div>
                <div className="text-sm text-gray-600 mt-1">Produtos</div>
              </div>

              <div className="bg-white rounded-lg shadow p-6 text-center">
                <div className="text-4xl font-bold text-blue-600">{stats.total_itens || 0}</div>
                <div className="text-sm text-gray-600 mt-1">Total Itens</div>
              </div>

              <div className={`${abaAtiva === 'saidas' ? 'bg-orange-50 border-orange-200' : 'bg-green-50 border-green-200'} border rounded-lg shadow p-6 text-center`}>
                <div className={`text-3xl font-bold ${abaAtiva === 'saidas' ? 'text-orange-700' : 'text-green-700'}`}>
                  R$ {Number(stats.total_custo || stats.valor_total || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </div>
                <div className={`text-sm mt-1 ${abaAtiva === 'saidas' ? 'text-orange-600' : 'text-green-600'}`}>
                  Total Custo
                </div>
              </div>

              <div className="bg-gray-50 border border-gray-200 rounded-lg shadow p-6 text-center">
                <div className="text-3xl font-bold text-gray-700">
                  R$ {Number(stats.total_venda || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </div>
                <div className="text-sm mt-1 text-gray-600">
                  Total Venda
                </div>
              </div>
            </div>

            {/* Lista de Fornecedores em Cascata */}
            <div className="bg-white rounded-lg shadow-md p-6">
              <h2 className="text-xl font-bold text-gray-800 mb-4">
                {abaAtiva === 'saidas' ? '📤 Saídas por Fornecedor' : '📥 Entradas por Fornecedor'}
              </h2>

              {fornecedores.length === 0 ? (
                <div className="text-center py-8">
                  <div className="text-4xl mb-2">{abaAtiva === 'saidas' ? '📤' : '📥'}</div>
                  <p className="text-gray-500">
                    Nenhuma {abaAtiva === 'saidas' ? 'saída' : 'entrada'} encontrada!
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {fornecedores.map((fornecedor, idx) => {
                    const isExpanded = expandidos.has(fornecedor.codFornecedor);
                    const isCarregando = itensCarregando.has(fornecedor.codFornecedor);
                    const itens = itensPorFornecedor[fornecedor.codFornecedor] || [];

                    // Calcular percentual do total (baseado no custo)
                    const custoForn = fornecedor.totalCusto || fornecedor.valorTotal || 0;
                    const custoTotal = stats.total_custo || stats.valor_total || 0;
                    const percentual = custoTotal > 0
                      ? ((custoForn / custoTotal) * 100).toFixed(1)
                      : 0;

                    const corPrimaria = abaAtiva === 'saidas' ? 'orange' : 'green';

                    return (
                      <div key={fornecedor.codFornecedor} className="border border-gray-200 rounded-lg overflow-hidden">
                        {/* Header do Fornecedor - Clicável */}
                        <div
                          onClick={() => toggleFornecedor(fornecedor.codFornecedor)}
                          className={`flex items-center justify-between p-4 cursor-pointer transition-colors ${
                            isExpanded
                              ? `bg-${corPrimaria}-50`
                              : 'bg-gray-50 hover:bg-gray-100'
                          }`}
                          style={isExpanded ? { backgroundColor: abaAtiva === 'saidas' ? '#fff7ed' : '#f0fdf4' } : {}}
                        >
                          <div className="flex items-center gap-4">
                            {/* Botão Expandir/Colapsar */}
                            <button
                              className={`w-8 h-8 flex items-center justify-center rounded-full transition-all ${
                                isExpanded
                                  ? abaAtiva === 'saidas' ? 'bg-orange-500 text-white' : 'bg-green-500 text-white'
                                  : 'bg-gray-300 text-gray-600'
                              }`}
                            >
                              {isCarregando ? (
                                <svg className="w-5 h-5 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 12a8 8 0 018-8v8H4z"/>
                                </svg>
                              ) : (
                                <svg className={`w-5 h-5 transition-transform ${isExpanded ? 'rotate-45' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4"/>
                                </svg>
                              )}
                            </button>

                            {/* Info do Fornecedor */}
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="text-sm text-gray-500">#{idx + 1}</span>
                                <h3 className="font-bold text-gray-800">
                                  {fornecedor.fantasia || fornecedor.fornecedor}
                                </h3>
                              </div>
                              {fornecedor.fantasia && fornecedor.fantasia !== fornecedor.fornecedor && (
                                <p className="text-sm text-gray-500">{fornecedor.fornecedor}</p>
                              )}
                            </div>
                          </div>

                          {/* Valores */}
                          <div className="flex items-center gap-6">
                            <div className="text-center">
                              <div className="text-lg font-bold text-purple-600">{fornecedor.qtdProdutos}</div>
                              <div className="text-xs text-gray-500">Produtos</div>
                            </div>
                            <div className="text-center">
                              <div className="text-lg font-bold text-blue-600">{fornecedor.qtdItens}</div>
                              <div className="text-xs text-gray-500">Total Troca</div>
                            </div>
                            <div className="text-center min-w-[100px]">
                              <div className={`text-lg font-bold ${abaAtiva === 'saidas' ? 'text-orange-600' : 'text-green-600'}`}>
                                R$ {(fornecedor.totalCusto || fornecedor.valorTotal || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                              </div>
                              <div className="text-xs text-gray-500">Total Custo</div>
                            </div>
                            <div className="text-center min-w-[100px]">
                              <div className="text-lg font-bold text-gray-700">
                                R$ {(fornecedor.totalVenda || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                              </div>
                              <div className="text-xs text-gray-500">Total Venda</div>
                            </div>
                          </div>
                        </div>

                        {/* Barra de Progresso */}
                        <div className="h-1 bg-gray-200">
                          <div
                            className={`h-full transition-all ${abaAtiva === 'saidas' ? 'bg-orange-500' : 'bg-green-500'}`}
                            style={{ width: `${percentual}%` }}
                          />
                        </div>

                        {/* Itens do Fornecedor (Expandido) */}
                        {isExpanded && (
                          <div className="bg-white border-t border-gray-200">
                            {isCarregando ? (
                              <div className="p-8 text-center">
                                <div className={`animate-spin w-8 h-8 border-4 ${abaAtiva === 'saidas' ? 'border-orange-500' : 'border-green-500'} border-t-transparent rounded-full mx-auto mb-2`}></div>
                                <p className="text-gray-500">Carregando itens...</p>
                              </div>
                            ) : itens.length === 0 ? (
                              <div className="p-4 text-center text-gray-500">
                                Nenhum item encontrado
                              </div>
                            ) : (
                              <div className="overflow-x-auto">
                                <table className="min-w-full text-sm">
                                  <thead className="bg-gray-50 border-b">
                                    <tr>
                                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Código</th>
                                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Produto</th>
                                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Seção</th>
                                      <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">Qtd</th>
                                      <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">Custo Unit.</th>
                                      <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">Valor</th>
                                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Data</th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-gray-200">
                                    {itens.map((item, itemIdx) => (
                                      <tr key={itemIdx} className="hover:bg-gray-50">
                                        <td className="px-3 py-2 text-gray-600 font-mono text-xs">
                                          {item.codigoBarras}
                                        </td>
                                        <td className="px-3 py-2">
                                          <p className="font-medium text-gray-800 max-w-xs truncate" title={item.descricao}>
                                            {item.descricao}
                                          </p>
                                        </td>
                                        <td className="px-3 py-2 text-gray-600 text-xs">
                                          {item.secao}
                                        </td>
                                        <td className={`px-3 py-2 text-right font-semibold ${
                                          item.quantidade < 0 ? 'text-red-600' : 'text-green-600'
                                        }`}>
                                          {Math.abs(item.quantidade).toFixed(3)}
                                        </td>
                                        <td className="px-3 py-2 text-right text-gray-700">
                                          R$ {item.custoReposicao.toFixed(2)}
                                        </td>
                                        <td className={`px-3 py-2 text-right font-bold ${
                                          abaAtiva === 'saidas' ? 'text-orange-600' : 'text-green-600'
                                        }`}>
                                          R$ {Math.abs(item.valorTotal).toFixed(2)}
                                        </td>
                                        <td className="px-3 py-2 text-gray-600 text-xs">
                                          {item.dataAjuste}
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </Layout>
  );
}
