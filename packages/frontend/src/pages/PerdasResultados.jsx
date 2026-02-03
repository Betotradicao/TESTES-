import { useState, useEffect } from 'react';
import Layout from '../components/Layout';
import { api } from '../utils/api';
import { useLoja } from '../contexts/LojaContext';

export default function PerdasResultados() {
  const { lojaSelecionada } = useLoja();
  // Filtros
  const [dataInicio, setDataInicio] = useState('');
  const [dataFim, setDataFim] = useState('');
  const [motivoSelecionado, setMotivoSelecionado] = useState('todos');

  // Paginação e visualização
  const [paginaAtual, setPaginaAtual] = useState(1);
  const [agrupar, setAgrupar] = useState(false);
  const [tipoVisualizacao, setTipoVisualizacao] = useState('perdas'); // 'perdas', 'entradas', 'ambos'

  // Ordenação
  const [ordenacao, setOrdenacao] = useState({ campo: null, direcao: 'asc' });

  // Dados
  // motivosAtivos: motivos que estão ATIVADOS (contabilizados nos KPIs)
  // Por padrão vazio = nenhum ativo = KPIs zerados
  const [motivosAtivos, setMotivosAtivos] = useState(new Set());
  const [resultados, setResultados] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    loadMotivosAtivos();

    // Definir período padrão: primeiro dia do mês até hoje
    const hoje = new Date();
    const primeiroDiaMes = new Date(hoje.getFullYear(), hoje.getMonth(), 1);

    setDataFim(hoje.toISOString().split('T')[0]);
    setDataInicio(primeiroDiaMes.toISOString().split('T')[0]);
  }, []);

  const loadMotivosAtivos = async () => {
    try {
      // Buscar motivos ativos (configuração local - invertido do ignorados)
      // Os que NÃO estão na lista de ignorados são os ativos
      const ignoradosRes = await api.get('/losses/motivos/ignorados');
      const ignoradosSet = new Set(ignoradosRes.data.map(m => m.motivo));
      // Motivos ativos são os que NÃO estão ignorados
      // Mas como não temos a lista completa aqui, vamos inverter a lógica:
      // Se está na lista de "ignorados" do banco, significa que está ATIVO (selecionado)
      setMotivosAtivos(ignoradosSet);
    } catch (err) {
      console.error('Erro ao carregar motivos ativos:', err);
    }
  };

  const handleFiltrar = async (page = 1) => {
    if (!dataInicio || !dataFim) {
      setError('Selecione o período (data início e fim)');
      return;
    }

    setLoading(true);
    setError('');
    setPaginaAtual(page);

    try {
      const params = new URLSearchParams({
        data_inicio: dataInicio,
        data_fim: dataFim,
        motivo: motivoSelecionado,
        tipo: tipoVisualizacao,
      });
      if (lojaSelecionada) params.append('codLoja', lojaSelecionada);

      // Buscar diretamente do Oracle (resultados principais)
      const response = await api.get(`/losses/oracle?${params}`);
      setResultados(response.data);
    } catch (err) {
      setError(err.response?.data?.error || 'Erro ao buscar resultados do Oracle');
    } finally {
      setLoading(false);
    }
  };

  // Executar filtro automaticamente quando período for definido
  useEffect(() => {
    if (dataInicio && dataFim) {
      handleFiltrar(1);
    }
  }, [dataInicio, dataFim, motivoSelecionado, tipoVisualizacao, lojaSelecionada]);

  const toggleMotivoAtivo = async (motivo) => {
    try {
      await api.post('/losses/motivos/toggle', { motivo });

      // Atualizar lista de ativos
      const newAtivos = new Set(motivosAtivos);
      if (newAtivos.has(motivo)) {
        newAtivos.delete(motivo);
      } else {
        newAtivos.add(motivo);
      }
      setMotivosAtivos(newAtivos);
    } catch (err) {
      console.error('Erro ao alternar motivo:', err);
      alert('Erro ao alternar configuração do motivo');
    }
  };

  // Cards sempre mostram todos os motivos
  const motivosRanking = resultados?.motivos_ranking || [];
  const entradasRanking = resultados?.entradas_ranking || [];
  const produtosRankingOriginal = resultados?.produtos_ranking || [];
  const paginacao = resultados?.paginacao || {};

  // Filtrar produtos pelo motivo selecionado (para a tabela)
  const produtosRanking = motivoSelecionado !== 'todos'
    ? produtosRankingOriginal.filter(p => p.motivo === motivoSelecionado)
    : produtosRankingOriginal;

  // KPIs: baseados nos motivos ATIVOS via engrenagem
  // Filtra produtos cujo motivo ESTÁ na lista de ativos
  const produtosParaKPI = produtosRankingOriginal.filter(p => motivosAtivos.has(p.motivo));

  const stats = {
    total_itens: produtosParaKPI.length,
    total_perdas: produtosParaKPI.filter(p => p.quantidade < 0).length,
    total_entradas: produtosParaKPI.filter(p => p.quantidade > 0).length,
    valor_total_perdas: Math.round(
      produtosParaKPI
        .filter(p => p.quantidade < 0)
        .reduce((acc, p) => acc + Math.abs(p.valorPerda || 0), 0) * 100
    ) / 100,
    valor_total_entradas: Math.round(
      produtosParaKPI
        .filter(p => p.quantidade > 0)
        .reduce((acc, p) => acc + (p.valorPerda || 0), 0) * 100
    ) / 100,
  };

  // Função para ordenar produtos
  const ordenarProdutos = (produtos) => {
    if (!ordenacao.campo) return produtos;

    return [...produtos].sort((a, b) => {
      let valorA = a[ordenacao.campo];
      let valorB = b[ordenacao.campo];

      // Tratamento especial para campos numéricos
      if (ordenacao.campo === 'quantidade' || ordenacao.campo === 'custoReposicao' || ordenacao.campo === 'valorPerda') {
        valorA = Number(valorA) || 0;
        valorB = Number(valorB) || 0;
      } else {
        // Para campos de texto, converter para string e lowercase
        valorA = String(valorA || '').toLowerCase();
        valorB = String(valorB || '').toLowerCase();
      }

      if (ordenacao.direcao === 'asc') {
        return valorA > valorB ? 1 : valorA < valorB ? -1 : 0;
      } else {
        return valorA < valorB ? 1 : valorA > valorB ? -1 : 0;
      }
    });
  };

  // Alternar ordenação
  const toggleOrdenacao = (campo) => {
    setOrdenacao(prev => {
      if (prev.campo === campo) {
        // Se clicar na mesma coluna, inverte a direção
        return { campo, direcao: prev.direcao === 'asc' ? 'desc' : 'asc' };
      } else {
        // Se clicar em nova coluna, ordena ascendente
        return { campo, direcao: 'asc' };
      }
    });
  };

  // Agrupar produtos se necessário (backend já filtra por tipo)
  let produtosProcessados = agrupar ? agruparProdutos(produtosRanking) : produtosRanking;

  // Aplicar ordenação
  const produtosExibicao = ordenarProdutos(produtosProcessados);

  function agruparProdutos(produtos) {
    const agrupados = {};
    produtos.forEach(produto => {
      const key = `${produto.codigoBarras}-${produto.motivo}`;
      const qtd = Number(produto.quantidade) || 0;
      const valor = Number(produto.valorPerda) || 0;
      const custo = Number(produto.custoReposicao) || 0;

      if (!agrupados[key]) {
        agrupados[key] = {
          ...produto,
          quantidade: qtd,
          valorPerda: valor,
          custoReposicao: custo,
          ocorrencias: 1
        };
      } else {
        // Somar quantidade (mantendo sinal: negativo para perdas, positivo para entradas)
        agrupados[key].quantidade += qtd;
        // Somar valor da perda/entrada
        agrupados[key].valorPerda += valor;
        // Incrementar ocorrências
        agrupados[key].ocorrencias++;

        // Recalcular custo médio: valor total / quantidade total
        const qtdTotal = Math.abs(agrupados[key].quantidade);
        if (qtdTotal > 0) {
          agrupados[key].custoReposicao = Math.abs(agrupados[key].valorPerda) / qtdTotal;
        }
      }
    });
    // Ordenar por valor absoluto da perda
    return Object.values(agrupados).sort((a, b) => Math.abs(b.valorPerda) - Math.abs(a.valorPerda));
  }

  return (
    <Layout>
      <div className="p-4 lg:p-8">
        {/* Card com Gradiente Laranja */}
        <div className="bg-gradient-to-br from-orange-500 to-red-600 rounded-lg shadow-lg p-6 mb-8 text-white">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-2xl lg:text-3xl font-bold">📊 Prevenção de Quebras</h1>
            <div className="bg-white/20 backdrop-blur-sm rounded-full p-3">
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/>
              </svg>
            </div>
          </div>
          <p className="text-white/90">
            Análise de perdas e quebras direto do sistema Oracle (Intersolid)
          </p>
        </div>

        {/* Filtros */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h2 className="text-lg font-bold text-gray-800 mb-4">🔍 Filtros</h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
          </div>

          <div className="mt-4 flex items-center justify-between">
            <div className="flex space-x-4">
              <button
                onClick={() => handleFiltrar(1)}
                disabled={loading}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
              >
                {loading ? '⏳ Carregando...' : '🔍 Aplicar Filtros'}
              </button>
              {motivoSelecionado !== 'todos' && (
                <button
                  onClick={() => setMotivoSelecionado('todos')}
                  className="px-6 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
                >
                  🔄 Limpar Filtro de Motivo
                </button>
              )}
            </div>
            <div className="text-sm text-gray-500">
              Fonte: Oracle (Intersolid)
            </div>
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
            <div className="grid grid-cols-2 md:grid-cols-6 gap-4 mb-6">
              <div className="bg-white rounded-lg shadow p-6 text-center">
                <div className="text-4xl font-bold text-gray-800">{stats.total_itens || 0}</div>
                <div className="text-sm text-gray-600 mt-1">Total Itens</div>
              </div>

              <div className="bg-white rounded-lg shadow p-6 text-center">
                <div className="text-4xl font-bold text-red-600">{stats.total_perdas || 0}</div>
                <div className="text-sm text-gray-600 mt-1">Perdas</div>
              </div>

              <div className="bg-white rounded-lg shadow p-6 text-center">
                <div className="text-4xl font-bold text-green-600">{stats.total_entradas || 0}</div>
                <div className="text-sm text-gray-600 mt-1">Entradas</div>
              </div>

              <div className="bg-red-50 border border-red-200 rounded-lg shadow p-6 text-center">
                <div className="text-3xl font-bold text-red-700">
                  R$ {Number(stats.valor_total_perdas || 0).toFixed(2)}
                </div>
                <div className="text-sm text-red-600 mt-1">Valor Perdas</div>
              </div>

              <div className="bg-green-50 border border-green-200 rounded-lg shadow p-6 text-center">
                <div className="text-3xl font-bold text-green-700">
                  R$ {Number(stats.valor_total_entradas || 0).toFixed(2)}
                </div>
                <div className="text-sm text-green-600 mt-1">Valor Entradas</div>
              </div>

              <div className={`${(stats.valor_total_perdas - stats.valor_total_entradas) > 0 ? 'bg-red-100 border-red-300' : 'bg-green-100 border-green-300'} border-2 rounded-lg shadow p-6 text-center`}>
                <div className={`text-3xl font-bold ${(stats.valor_total_perdas - stats.valor_total_entradas) > 0 ? 'text-red-700' : 'text-green-700'}`}>
                  R$ {Math.abs((stats.valor_total_perdas || 0) - (stats.valor_total_entradas || 0)).toFixed(2)}
                </div>
                <div className={`text-sm mt-1 ${(stats.valor_total_perdas - stats.valor_total_entradas) > 0 ? 'text-red-600' : 'text-green-600'}`}>
                  Perdas - Ganhos
                </div>
              </div>
            </div>

            {/* Cards de Motivos - Clicáveis como filtro */}
            <div className="mb-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-4">
                  <h2 className="text-xl font-bold text-gray-800">
                    📋 {tipoVisualizacao === 'perdas' ? 'Perdas por Motivo' : tipoVisualizacao === 'entradas' ? 'Entradas por Ajuste' : 'Perdas e Entradas por Motivo'}
                  </h2>
                  {motivoSelecionado !== 'todos' && (
                    <button
                      onClick={() => setMotivoSelecionado('todos')}
                      className="px-3 py-1 bg-blue-100 text-blue-700 rounded-lg text-sm font-medium hover:bg-blue-200 transition-colors"
                    >
                      ✕ Limpar filtro: {motivoSelecionado}
                    </button>
                  )}
                </div>

                {/* Seletor de Tipo para Cards */}
                <select
                  value={tipoVisualizacao}
                  onChange={(e) => setTipoVisualizacao(e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="perdas">📉 Saídas (Perdas)</option>
                  <option value="entradas">📈 Entradas</option>
                  <option value="ambos">📊 Todos</option>
                </select>
              </div>

              {(tipoVisualizacao === 'perdas' || tipoVisualizacao === 'ambos') && motivosRanking.length === 0 ? (
                <div className="bg-white rounded-lg shadow p-12 text-center">
                  <div className="text-6xl mb-4">🎉</div>
                  <p className="text-xl text-gray-600">
                    Nenhuma perda encontrada no período!
                  </p>
                </div>
              ) : null}

              {(tipoVisualizacao === 'perdas' || tipoVisualizacao === 'ambos') && motivosRanking.length > 0 && (
                <div className="grid grid-cols-1 md:grid-cols-4 lg:grid-cols-6 gap-4 mb-6">
                  {motivosRanking.map((motivo, idx) => {
                    const isAtivo = motivosAtivos.has(motivo.motivo);
                    const isFiltrado = motivoSelecionado === motivo.motivo;

                    // Cores alternadas para os cards
                    const colors = [
                      { bg: 'bg-red-50', border: 'border-red-200', text: 'text-red-700', icon: 'text-red-500', hover: 'hover:bg-red-100' },
                      { bg: 'bg-orange-50', border: 'border-orange-200', text: 'text-orange-700', icon: 'text-orange-500', hover: 'hover:bg-orange-100' },
                      { bg: 'bg-yellow-50', border: 'border-yellow-200', text: 'text-yellow-700', icon: 'text-yellow-500', hover: 'hover:bg-yellow-100' },
                      { bg: 'bg-blue-50', border: 'border-blue-200', text: 'text-blue-700', icon: 'text-blue-500', hover: 'hover:bg-blue-100' },
                      { bg: 'bg-purple-50', border: 'border-purple-200', text: 'text-purple-700', icon: 'text-purple-500', hover: 'hover:bg-purple-100' },
                      { bg: 'bg-pink-50', border: 'border-pink-200', text: 'text-pink-700', icon: 'text-pink-500', hover: 'hover:bg-pink-100' },
                    ];
                    const colorScheme = colors[idx % colors.length];

                    return (
                      <div
                        key={idx}
                        onClick={() => setMotivoSelecionado(isFiltrado ? 'todos' : motivo.motivo)}
                        className={`${colorScheme.bg} ${colorScheme.border} border-2 rounded-lg shadow-md p-6 ${colorScheme.hover} transition-all cursor-pointer relative ${
                          isFiltrado ? 'ring-4 ring-blue-400' : ''
                        } ${!isAtivo ? 'opacity-40' : ''}`}
                      >
                        {/* Botão de ativar/desativar */}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleMotivoAtivo(motivo.motivo);
                          }}
                          className={`absolute top-2 right-2 p-2 rounded-full transition-colors ${
                            isAtivo ? 'bg-green-500 hover:bg-green-600' : 'bg-gray-300 hover:bg-gray-400'
                          }`}
                          title={isAtivo ? "Desativar (remover do cálculo)" : "Ativar (incluir no cálculo)"}
                        >
                          {isAtivo ? (
                            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                            </svg>
                          ) : (
                            <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
                            </svg>
                          )}
                        </button>

                        {isAtivo && (
                          <div className="absolute top-2 left-2 bg-green-600 text-white text-xs px-2 py-1 rounded">
                            Ativo
                          </div>
                        )}

                        <div className="flex items-start justify-between mb-3 pr-8">
                          <div className="flex-1">
                            <h3 className={`text-base font-bold ${colorScheme.text} mb-1`}>
                              {motivo.motivo}
                            </h3>
                          </div>
                          <div className={`${colorScheme.icon} text-2xl`}>
                            📦
                          </div>
                        </div>

                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-sm text-gray-600">Total de Perdas:</span>
                            <span className={`text-lg font-bold ${colorScheme.text}`}>
                              {motivo.totalPerdas} {motivo.totalPerdas === 1 ? 'item' : 'itens'}
                            </span>
                          </div>

                          <div className="flex items-center justify-between pt-2 border-t border-gray-200">
                            <span className="text-sm text-gray-600">Valor Total:</span>
                            <span className={`text-xl font-bold ${colorScheme.text}`}>
                              R$ {Number(motivo.valorPerdas || 0).toFixed(2)}
                            </span>
                          </div>
                        </div>

                        {/* Barra de progresso - usa valores originais para referência */}
                        <div className="mt-4">
                          <div className="w-full bg-gray-200 rounded-full h-2">
                            <div
                              className={`${colorScheme.bg === 'bg-red-50' ? 'bg-red-500' :
                                          colorScheme.bg === 'bg-orange-50' ? 'bg-orange-500' :
                                          colorScheme.bg === 'bg-yellow-50' ? 'bg-yellow-500' :
                                          colorScheme.bg === 'bg-blue-50' ? 'bg-blue-500' :
                                          colorScheme.bg === 'bg-purple-50' ? 'bg-purple-500' : 'bg-pink-500'
                                        } h-2 rounded-full transition-all`}
                              style={{
                                width: `${Math.min((motivo.valorPerdas / (motivosRanking[0]?.valorPerdas || 1)) * 100, 100)}%`
                              }}
                            />
                          </div>
                        </div>

                        {isFiltrado && (
                          <div className="mt-3 text-center text-xs text-blue-600 font-bold">
                            ✓ FILTRO ATIVO - Clique para remover
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

              {/* Cards de Entradas por Ajuste */}
              {(tipoVisualizacao === 'entradas' || tipoVisualizacao === 'ambos') && entradasRanking.length > 0 && (
                <div className="grid grid-cols-1 md:grid-cols-4 lg:grid-cols-6 gap-4 mb-6">
                  {entradasRanking.map((entrada, idx) => {
                    const isAtivo = motivosAtivos.has(entrada.motivo);
                    const isFiltrado = motivoSelecionado === entrada.motivo;

                    // Cores verdes para entradas
                    const colors = [
                      { bg: 'bg-green-50', border: 'border-green-200', text: 'text-green-700', icon: 'text-green-500', hover: 'hover:bg-green-100' },
                      { bg: 'bg-emerald-50', border: 'border-emerald-200', text: 'text-emerald-700', icon: 'text-emerald-500', hover: 'hover:bg-emerald-100' },
                      { bg: 'bg-teal-50', border: 'border-teal-200', text: 'text-teal-700', icon: 'text-teal-500', hover: 'hover:bg-teal-100' },
                      { bg: 'bg-cyan-50', border: 'border-cyan-200', text: 'text-cyan-700', icon: 'text-cyan-500', hover: 'hover:bg-cyan-100' },
                      { bg: 'bg-lime-50', border: 'border-lime-200', text: 'text-lime-700', icon: 'text-lime-500', hover: 'hover:bg-lime-100' },
                      { bg: 'bg-green-100', border: 'border-green-300', text: 'text-green-800', icon: 'text-green-600', hover: 'hover:bg-green-200' },
                    ];
                    const colorScheme = colors[idx % colors.length];

                    return (
                      <div
                        key={idx}
                        onClick={() => setMotivoSelecionado(isFiltrado ? 'todos' : entrada.motivo)}
                        className={`${colorScheme.bg} ${colorScheme.border} border-2 rounded-lg shadow-md p-6 ${colorScheme.hover} transition-all cursor-pointer relative ${
                          isFiltrado ? 'ring-4 ring-blue-400' : ''
                        } ${!isAtivo ? 'opacity-40' : ''}`}
                      >
                        {/* Botão de ativar/desativar */}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleMotivoAtivo(entrada.motivo);
                          }}
                          className={`absolute top-2 right-2 p-2 rounded-full transition-colors ${
                            isAtivo ? 'bg-green-500 hover:bg-green-600' : 'bg-gray-300 hover:bg-gray-400'
                          }`}
                          title={isAtivo ? "Desativar (remover do cálculo)" : "Ativar (incluir no cálculo)"}
                        >
                          {isAtivo ? (
                            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                            </svg>
                          ) : (
                            <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
                            </svg>
                          )}
                        </button>

                        {isAtivo && (
                          <div className="absolute top-2 left-2 bg-green-600 text-white text-xs px-2 py-1 rounded">
                            Ativo
                          </div>
                        )}

                        <div className="flex items-start justify-between mb-3 pr-8">
                          <div className="flex-1">
                            <h3 className={`text-base font-bold ${colorScheme.text} mb-1`}>
                              {entrada.motivo}
                            </h3>
                          </div>
                          <div className={`${colorScheme.icon} text-2xl`}>
                            📦
                          </div>
                        </div>

                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-sm text-gray-600">Total de Entradas:</span>
                            <span className={`text-lg font-bold ${colorScheme.text}`}>
                              {entrada.totalEntradas} {entrada.totalEntradas === 1 ? 'item' : 'itens'}
                            </span>
                          </div>

                          <div className="flex items-center justify-between pt-2 border-t border-gray-200">
                            <span className="text-sm text-gray-600">Valor Total:</span>
                            <span className={`text-xl font-bold ${colorScheme.text}`}>
                              R$ {Number(entrada.valorEntradas || 0).toFixed(2)}
                            </span>
                          </div>
                        </div>

                        {/* Barra de progresso - usa valores originais para referência */}
                        <div className="mt-4">
                          <div className="w-full bg-gray-200 rounded-full h-2">
                            <div
                              className={`${colorScheme.bg === 'bg-green-50' ? 'bg-green-500' :
                                          colorScheme.bg === 'bg-emerald-50' ? 'bg-emerald-500' :
                                          colorScheme.bg === 'bg-teal-50' ? 'bg-teal-500' :
                                          colorScheme.bg === 'bg-cyan-50' ? 'bg-cyan-500' :
                                          colorScheme.bg === 'bg-lime-50' ? 'bg-lime-500' : 'bg-green-600'
                                        } h-2 rounded-full transition-all`}
                              style={{
                                width: `${Math.min((entrada.valorEntradas / (entradasRanking[0]?.valorEntradas || 1)) * 100, 100)}%`
                              }}
                            />
                          </div>
                        </div>

                        {isFiltrado && (
                          <div className="mt-3 text-center text-xs text-blue-600 font-bold">
                            ✓ FILTRO ATIVO - Clique para remover
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

            {/* Tabela de Produtos com Paginação e Agrupamento */}
            <div className="mb-6">
              <div className="bg-white rounded-lg shadow p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xl font-bold text-gray-800">
                    📦 Produtos {tipoVisualizacao === 'perdas' ? 'com Perdas' : tipoVisualizacao === 'entradas' ? 'com Entradas' : '(Perdas e Entradas)'}
                  </h2>

                  {/* Toggle Agrupamento */}
                  <label className="flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={agrupar}
                      onChange={(e) => setAgrupar(e.target.checked)}
                      className="mr-2"
                    />
                    <span className="text-sm font-medium text-gray-700">
                      {agrupar ? '📊 Agrupado' : '📋 Item a Item'}
                    </span>
                  </label>
                </div>

                {produtosExibicao.length === 0 ? (
                  <div className="text-center py-8">
                    <div className="text-4xl mb-2">🎉</div>
                    <p className="text-gray-500">
                      Nenhum produto encontrado no período!
                    </p>
                  </div>
                ) : (
                  <>
                    <div className="overflow-x-auto">
                      <table className="min-w-full text-sm">
                        <thead className="bg-gray-50 border-b">
                          <tr>
                            <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">#</th>
                            <th
                              className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase cursor-pointer hover:bg-gray-100 transition-colors"
                              onClick={() => toggleOrdenacao('codigoBarras')}
                            >
                              <div className="flex items-center gap-1">
                                Código
                                {ordenacao.campo === 'codigoBarras' && (
                                  <span>{ordenacao.direcao === 'asc' ? '↑' : '↓'}</span>
                                )}
                              </div>
                            </th>
                            <th
                              className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase cursor-pointer hover:bg-gray-100 transition-colors"
                              onClick={() => toggleOrdenacao('descricao')}
                            >
                              <div className="flex items-center gap-1">
                                Produto
                                {ordenacao.campo === 'descricao' && (
                                  <span>{ordenacao.direcao === 'asc' ? '↑' : '↓'}</span>
                                )}
                              </div>
                            </th>
                            <th
                              className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase cursor-pointer hover:bg-gray-100 transition-colors"
                              onClick={() => toggleOrdenacao('secao')}
                            >
                              <div className="flex items-center gap-1">
                                Seção
                                {ordenacao.campo === 'secao' && (
                                  <span>{ordenacao.direcao === 'asc' ? '↑' : '↓'}</span>
                                )}
                              </div>
                            </th>
                            <th
                              className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase cursor-pointer hover:bg-gray-100 transition-colors"
                              onClick={() => toggleOrdenacao('quantidade')}
                            >
                              <div className="flex items-center justify-end gap-1">
                                Quantidade
                                {ordenacao.campo === 'quantidade' && (
                                  <span>{ordenacao.direcao === 'asc' ? '↑' : '↓'}</span>
                                )}
                              </div>
                            </th>
                            <th
                              className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase cursor-pointer hover:bg-gray-100 transition-colors"
                              onClick={() => toggleOrdenacao('custoReposicao')}
                            >
                              <div className="flex items-center justify-end gap-1">
                                Custo Unit.
                                {ordenacao.campo === 'custoReposicao' && (
                                  <span>{ordenacao.direcao === 'asc' ? '↑' : '↓'}</span>
                                )}
                              </div>
                            </th>
                            <th
                              className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase cursor-pointer hover:bg-gray-100 transition-colors"
                              onClick={() => toggleOrdenacao('valorPerda')}
                            >
                              <div className="flex items-center justify-end gap-1">
                                Valor Perda
                                {ordenacao.campo === 'valorPerda' && (
                                  <span>{ordenacao.direcao === 'asc' ? '↑' : '↓'}</span>
                                )}
                              </div>
                            </th>
                            <th
                              className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase cursor-pointer hover:bg-gray-100 transition-colors"
                              onClick={() => toggleOrdenacao('motivo')}
                            >
                              <div className="flex items-center gap-1">
                                Motivo
                                {ordenacao.campo === 'motivo' && (
                                  <span>{ordenacao.direcao === 'asc' ? '↑' : '↓'}</span>
                                )}
                              </div>
                            </th>
                            {agrupar && (
                              <th className="px-3 py-2 text-center text-xs font-medium text-gray-500 uppercase">Ocorrências</th>
                            )}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200">
                          {produtosExibicao.map((item, idx) => (
                            <tr key={idx} className="hover:bg-gray-50">
                              <td className="px-3 py-2 text-gray-600">{(paginaAtual - 1) * 50 + idx + 1}</td>
                              <td className="px-3 py-2 text-gray-600 font-mono text-xs">
                                {item.codigoBarras}
                              </td>
                              <td className="px-3 py-2">
                                <p className="font-medium text-gray-800 max-w-xs truncate" title={item.descricao}>
                                  {item.descricao}
                                </p>
                              </td>
                              <td className="px-3 py-2 text-gray-600">
                                {item.secao}
                              </td>
                              <td className="px-3 py-2 text-right text-red-600 font-semibold">
                                {Number(item.quantidade || 0).toFixed(3)}
                              </td>
                              <td className="px-3 py-2 text-right text-gray-700">
                                R$ {Number(item.custoReposicao || 0).toFixed(2)}
                              </td>
                              <td className="px-3 py-2 text-right">
                                <span className="font-bold text-red-600">
                                  R$ {Number(item.valorPerda || 0).toFixed(2)}
                                </span>
                              </td>
                              <td className="px-3 py-2 text-gray-600 text-xs max-w-xs truncate" title={item.motivo}>
                                {item.motivo}
                              </td>
                              {agrupar && (
                                <td className="px-3 py-2 text-center">
                                  <span className="inline-block px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs font-bold">
                                    {item.ocorrencias || 1}
                                  </span>
                                </td>
                              )}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    {/* Paginação */}
                    {paginacao.totalPages > 1 && (
                      <div className="mt-6 flex items-center justify-between">
                        <div className="text-sm text-gray-600">
                          Mostrando {(paginaAtual - 1) * 50 + 1} a {Math.min(paginaAtual * 50, paginacao.total)} de {paginacao.total} produtos
                        </div>

                        <div className="flex gap-2">
                          <button
                            onClick={() => handleFiltrar(paginaAtual - 1)}
                            disabled={paginaAtual === 1 || loading}
                            className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors disabled:opacity-50"
                          >
                            ← Anterior
                          </button>

                          <div className="flex items-center gap-1">
                            {[...Array(Math.min(paginacao.totalPages, 5))].map((_, i) => {
                              let pageNum;
                              if (paginacao.totalPages <= 5) {
                                pageNum = i + 1;
                              } else if (paginaAtual <= 3) {
                                pageNum = i + 1;
                              } else if (paginaAtual >= paginacao.totalPages - 2) {
                                pageNum = paginacao.totalPages - 4 + i;
                              } else {
                                pageNum = paginaAtual - 2 + i;
                              }

                              return (
                                <button
                                  key={i}
                                  onClick={() => handleFiltrar(pageNum)}
                                  disabled={loading}
                                  className={`w-10 h-10 rounded-lg transition-colors ${
                                    paginaAtual === pageNum
                                      ? 'bg-blue-600 text-white'
                                      : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                                  }`}
                                >
                                  {pageNum}
                                </button>
                              );
                            })}
                          </div>

                          <button
                            onClick={() => handleFiltrar(paginaAtual + 1)}
                            disabled={paginaAtual === paginacao.totalPages || loading}
                            className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors disabled:opacity-50"
                          >
                            Próxima →
                          </button>
                        </div>
                      </div>
                    )}
                  </>
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
