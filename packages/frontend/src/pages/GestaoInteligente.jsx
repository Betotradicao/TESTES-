import { useState, useEffect, Fragment } from 'react';
import Layout from '../components/Layout';
import api from '../services/api';
import { useLoja } from '../contexts/LojaContext';

// Função para obter datas padrão (primeiro dia do mês atual até hoje)
const getDefaultDates = () => {
  const hoje = new Date();
  const primeiroDiaMes = new Date(hoje.getFullYear(), hoje.getMonth(), 1);

  const formatDate = (date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  return {
    dataInicio: formatDate(primeiroDiaMes),
    dataFim: formatDate(hoje)
  };
};

// Formatar valor como moeda
const formatCurrency = (value) => {
  if (value === null || value === undefined) return 'R$ 0,00';
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  }).format(value);
};

// Formatar percentual
const formatPercent = (value) => {
  if (value === null || value === undefined) return '0,00%';
  return `${value.toFixed(2).replace('.', ',')}%`;
};

// Formatar número inteiro
const formatNumber = (value) => {
  if (value === null || value === undefined) return '0';
  return new Intl.NumberFormat('pt-BR').format(Math.round(value));
};

// Formatar moeda com casas decimais completas (para comparativos)
const formatCurrencyFull = (value) => {
  if (value === null || value === undefined) return 'R$ 0,00';
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(value);
};

// Componente para exibir comparativo com valor original + diferença com setinha e cores
const Comparativo = ({ label, valor, valorAtual, tipo = 'currency', invertido = false }) => {
  // Formatar o valor original
  const formatarValor = () => {
    if (tipo === 'currency') return formatCurrencyFull(valor);
    if (tipo === 'percent') return formatPercent(valor);
    if (tipo === 'number') return formatNumber(valor);
    return valor;
  };

  // Calcular a diferença (atual - passado)
  const diferenca = (valorAtual || 0) - (valor || 0);

  // Formatar a diferença
  const formatarDiferenca = () => {
    if (valor === 0 || valorAtual === undefined) return '';
    if (tipo === 'currency') {
      const formatted = new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      }).format(Math.abs(diferenca));
      return formatted;
    }
    if (tipo === 'percent') {
      return `${Math.abs(diferenca).toFixed(2).replace('.', ',')}%`;
    }
    return formatNumber(Math.abs(diferenca));
  };

  // Determinar se é positivo ou negativo (considerando invertido)
  const isPositivo = invertido ? diferenca < 0 : diferenca > 0;

  // Cor baseada na diferença
  const getCorDiferenca = () => {
    if (diferenca === 0 || valor === 0) return 'text-gray-500';
    return isPositivo ? 'text-green-600' : 'text-red-600';
  };

  // Setinha
  const Setinha = () => {
    if (diferenca === 0 || valor === 0) return null;
    if (isPositivo) {
      return (
        <svg className="w-3 h-3 inline" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M5.293 9.707a1 1 0 010-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 01-1.414 1.414L11 7.414V15a1 1 0 11-2 0V7.414L6.707 9.707a1 1 0 01-1.414 0z" clipRule="evenodd" />
        </svg>
      );
    }
    return (
      <svg className="w-3 h-3 inline" fill="currentColor" viewBox="0 0 20 20">
        <path fillRule="evenodd" d="M14.707 10.293a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 111.414-1.414L9 12.586V5a1 1 0 012 0v7.586l2.293-2.293a1 1 0 011.414 0z" clipRule="evenodd" />
      </svg>
    );
  };

  return (
    <div className="flex justify-between items-center text-xs">
      <span className="text-gray-400">{label}:</span>
      <div className="flex items-center gap-2">
        <span className="font-medium text-gray-600">{formatarValor()}</span>
        {diferenca !== 0 && valor !== 0 && (
          <span className={`font-medium ${getCorDiferenca()}`}>
            <Setinha /> {isPositivo ? '+' : '-'}{formatarDiferenca()}
          </span>
        )}
      </div>
    </div>
  );
};

// Estado inicial dos indicadores com estrutura de comparativos
const initialIndicadores = {
  vendas: { atual: 0, mesPassado: 0, anoPassado: 0, mediaLinear: 0 },
  lucro: { atual: 0, mesPassado: 0, anoPassado: 0, mediaLinear: 0 },
  custoVendas: { atual: 0, mesPassado: 0, anoPassado: 0, mediaLinear: 0 },
  compras: { atual: 0, mesPassado: 0, anoPassado: 0, mediaLinear: 0 },
  impostos: { atual: 0, mesPassado: 0, anoPassado: 0, mediaLinear: 0 },
  markdown: { atual: 0, mesPassado: 0, anoPassado: 0, mediaLinear: 0 },
  margemLimpa: { atual: 0, mesPassado: 0, anoPassado: 0, mediaLinear: 0 },
  ticketMedio: { atual: 0, mesPassado: 0, anoPassado: 0, mediaLinear: 0 },
  pctCompraVenda: { atual: 0, mesPassado: 0, anoPassado: 0, mediaLinear: 0 },
  qtdCupons: { atual: 0, mesPassado: 0, anoPassado: 0, mediaLinear: 0 },
  qtdItens: { atual: 0, mesPassado: 0, anoPassado: 0, mediaLinear: 0 },
  pctVendasOferta: { atual: 0, mesPassado: 0, anoPassado: 0, mediaLinear: 0 },
  vendasOferta: { atual: 0, mesPassado: 0, anoPassado: 0, mediaLinear: 0 },
  markdownOferta: { atual: 0, mesPassado: 0, anoPassado: 0, mediaLinear: 0 }
};

export default function GestaoInteligente() {
  const [indicadores, setIndicadores] = useState(initialIndicadores);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filters, setFilters] = useState(getDefaultDates());
  const [clearingCache, setClearingCache] = useState(false);
  const [cardExpandido, setCardExpandido] = useState(null); // 'vendas', 'margens', 'compras', 'financeiro'
  const [analiseAtiva, setAnaliseAtiva] = useState(null); // 'vendas-setor', 'vendas-ano', 'vendas-dia-semana'
  const [dadosAnalise, setDadosAnalise] = useState([]);
  const [loadingAnalise, setLoadingAnalise] = useState(false);
  const { lojaSelecionada } = useLoja();

  // Estados para hierarquia expansível
  const [expandedSecoes, setExpandedSecoes] = useState({}); // { codSecao: { grupos: [], loading: false } }
  const [expandedGrupos, setExpandedGrupos] = useState({}); // { codGrupo: { subgrupos: [], loading: false } }
  const [expandedSubgrupos, setExpandedSubgrupos] = useState({}); // { codSubgrupo: { itens: [], loading: false } }

  // Buscar indicadores
  const fetchIndicadores = async () => {
    setLoading(true);
    setError(null);
    try {
      const params = {
        dataInicio: filters.dataInicio,
        dataFim: filters.dataFim
      };
      if (lojaSelecionada) {
        params.codLoja = lojaSelecionada;
      }
      const response = await api.get('/gestao-inteligente/indicadores', { params });
      setIndicadores(response.data);
    } catch (err) {
      console.error('Erro ao buscar indicadores:', err);
      setError(err.response?.data?.error || 'Erro ao carregar indicadores');
    } finally {
      setLoading(false);
    }
  };

  // Limpar cache
  const handleClearCache = async () => {
    setClearingCache(true);
    try {
      await api.post('/gestao-inteligente/clear-cache');
      await fetchIndicadores();
    } catch (err) {
      console.error('Erro ao limpar cache:', err);
    } finally {
      setClearingCache(false);
    }
  };

  // Buscar vendas por setor
  const fetchVendasPorSetor = async () => {
    if (analiseAtiva === 'vendas-setor') {
      setAnaliseAtiva(null);
      setDadosAnalise([]);
      // Limpar expansões
      setExpandedSecoes({});
      setExpandedGrupos({});
      setExpandedSubgrupos({});
      return;
    }

    setLoadingAnalise(true);
    setAnaliseAtiva('vendas-setor');
    // Limpar expansões anteriores
    setExpandedSecoes({});
    setExpandedGrupos({});
    setExpandedSubgrupos({});
    try {
      const params = {
        dataInicio: filters.dataInicio,
        dataFim: filters.dataFim
      };
      if (lojaSelecionada) {
        params.codLoja = lojaSelecionada;
      }
      const response = await api.get('/gestao-inteligente/vendas-por-setor', { params });
      setDadosAnalise(response.data);
    } catch (err) {
      console.error('Erro ao buscar vendas por setor:', err);
      setDadosAnalise([]);
    } finally {
      setLoadingAnalise(false);
    }
  };

  // Expandir/Recolher seção para ver grupos
  const toggleSecao = async (codSecao) => {
    if (expandedSecoes[codSecao]) {
      // Recolher
      setExpandedSecoes(prev => {
        const newState = { ...prev };
        delete newState[codSecao];
        return newState;
      });
      return;
    }

    // Expandir - buscar grupos
    setExpandedSecoes(prev => ({
      ...prev,
      [codSecao]: { grupos: [], loading: true }
    }));

    try {
      const params = {
        dataInicio: filters.dataInicio,
        dataFim: filters.dataFim,
        codSecao
      };
      if (lojaSelecionada) {
        params.codLoja = lojaSelecionada;
      }
      const response = await api.get('/gestao-inteligente/grupos-por-secao', { params });
      setExpandedSecoes(prev => ({
        ...prev,
        [codSecao]: { grupos: response.data, loading: false }
      }));
    } catch (err) {
      console.error('Erro ao buscar grupos:', err);
      setExpandedSecoes(prev => ({
        ...prev,
        [codSecao]: { grupos: [], loading: false }
      }));
    }
  };

  // Expandir/Recolher grupo para ver subgrupos
  const toggleGrupo = async (codGrupo, codSecao) => {
    if (expandedGrupos[codGrupo]) {
      // Recolher
      setExpandedGrupos(prev => {
        const newState = { ...prev };
        delete newState[codGrupo];
        return newState;
      });
      return;
    }

    // Expandir - buscar subgrupos
    setExpandedGrupos(prev => ({
      ...prev,
      [codGrupo]: { subgrupos: [], loading: true }
    }));

    try {
      const params = {
        dataInicio: filters.dataInicio,
        dataFim: filters.dataFim,
        codGrupo,
        codSecao // Filtrar também por seção
      };
      if (lojaSelecionada) {
        params.codLoja = lojaSelecionada;
      }
      const response = await api.get('/gestao-inteligente/subgrupos-por-grupo', { params });
      setExpandedGrupos(prev => ({
        ...prev,
        [codGrupo]: { subgrupos: response.data, loading: false, codSecao }
      }));
    } catch (err) {
      console.error('Erro ao buscar subgrupos:', err);
      setExpandedGrupos(prev => ({
        ...prev,
        [codGrupo]: { subgrupos: [], loading: false }
      }));
    }
  };

  // Expandir/Recolher subgrupo para ver itens
  const toggleSubgrupo = async (codSubgrupo, codGrupo, codSecao) => {
    if (expandedSubgrupos[codSubgrupo]) {
      // Recolher
      setExpandedSubgrupos(prev => {
        const newState = { ...prev };
        delete newState[codSubgrupo];
        return newState;
      });
      return;
    }

    // Expandir - buscar itens
    setExpandedSubgrupos(prev => ({
      ...prev,
      [codSubgrupo]: { itens: [], loading: true }
    }));

    try {
      const params = {
        dataInicio: filters.dataInicio,
        dataFim: filters.dataFim,
        codSubgrupo,
        codGrupo,   // Filtrar também por grupo
        codSecao    // Filtrar também por seção
      };
      if (lojaSelecionada) {
        params.codLoja = lojaSelecionada;
      }
      const response = await api.get('/gestao-inteligente/itens-por-subgrupo', { params });
      setExpandedSubgrupos(prev => ({
        ...prev,
        [codSubgrupo]: { itens: response.data, loading: false }
      }));
    } catch (err) {
      console.error('Erro ao buscar itens:', err);
      setExpandedSubgrupos(prev => ({
        ...prev,
        [codSubgrupo]: { itens: [], loading: false }
      }));
    }
  };

  useEffect(() => {
    fetchIndicadores();
  }, [filters, lojaSelecionada]);

  // Re-executar análise ativa quando filtros mudarem
  useEffect(() => {
    if (analiseAtiva === 'vendas-setor') {
      // Limpar expansões quando filtros mudam
      setExpandedSecoes({});
      setExpandedGrupos({});
      setExpandedSubgrupos({});

      const fetchData = async () => {
        setLoadingAnalise(true);
        try {
          const params = {
            dataInicio: filters.dataInicio,
            dataFim: filters.dataFim
          };
          if (lojaSelecionada) {
            params.codLoja = lojaSelecionada;
          }
          const response = await api.get('/gestao-inteligente/vendas-por-setor', { params });
          setDadosAnalise(response.data);
        } catch (err) {
          console.error('Erro ao buscar vendas por setor:', err);
          setDadosAnalise([]);
        } finally {
          setLoadingAnalise(false);
        }
      };
      fetchData();
    }
  }, [filters, lojaSelecionada, analiseAtiva]);

  // Formatar período para exibição
  const formatPeriodo = () => {
    const inicio = filters.dataInicio.split('-').reverse().join('/');
    const fim = filters.dataFim.split('-').reverse().join('/');
    return `${inicio} a ${fim}`;
  };

  return (
    <Layout>
      <div className="p-4 md:p-6">
        {/* Header Laranja - Compacto */}
        <div className="bg-gradient-to-r from-orange-500 to-orange-600 rounded-lg shadow-lg px-4 py-3 mb-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-2xl">📊</span>
              <h1 className="text-lg font-bold text-white">Gestao Inteligente</h1>
              <span className="bg-white/20 text-white px-3 py-0.5 rounded-full text-xs font-medium ml-2">
                {formatPeriodo()}
              </span>
            </div>

            {/* Filtros */}
            <div className="flex items-center gap-2">
              <input
                type="date"
                value={filters.dataInicio}
                onChange={(e) => setFilters({ ...filters, dataInicio: e.target.value })}
                className="bg-white rounded px-2 py-1 text-sm text-gray-700"
              />
              <span className="text-white text-sm">a</span>
              <input
                type="date"
                value={filters.dataFim}
                onChange={(e) => setFilters({ ...filters, dataFim: e.target.value })}
                className="bg-white rounded px-2 py-1 text-sm text-gray-700"
              />
              <button
                onClick={handleClearCache}
                disabled={clearingCache}
                className="flex items-center gap-1 bg-white/20 hover:bg-white/30 text-white px-3 py-1.5 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
                title="Atualizar dados"
              >
                {clearingCache ? (
                  <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                ) : (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/>
                  </svg>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Loading */}
        {loading && (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500"></div>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
            <p className="text-red-600">{error}</p>
          </div>
        )}

        {/* Cards de Indicadores */}
        {!loading && !error && (
          <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
            {/* Card VENDAS */}
            <div className="bg-white rounded-xl shadow-lg p-4 border-t-4 border-green-500 hover:shadow-xl transition-shadow">
              <div className="flex items-center justify-between mb-3">
                <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                  <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
                  </svg>
                </div>
                <span className="text-xs text-gray-400 uppercase font-semibold">Faturamento</span>
              </div>
              <p className="text-2xl font-bold text-gray-800 mb-1">{formatCurrency(indicadores.vendas?.atual)}</p>
              <p className="text-xs text-gray-500 mb-3">VENDAS</p>
              <div className="space-y-1 pt-2 border-t border-gray-100">
                <Comparativo label="Mes Passado" valor={indicadores.vendas?.mesPassado} valorAtual={indicadores.vendas?.atual} tipo="currency" />
                <Comparativo label="Ano Passado" valor={indicadores.vendas?.anoPassado} valorAtual={indicadores.vendas?.atual} tipo="currency" />
                <Comparativo label="Media Linear" valor={indicadores.vendas?.mediaLinear} valorAtual={indicadores.vendas?.atual} tipo="currency" />
              </div>
            </div>

            {/* Card LUCRO */}
            <div className="bg-white rounded-xl shadow-lg p-4 border-t-4 border-cyan-500 hover:shadow-xl transition-shadow">
              <div className="flex items-center justify-between mb-3">
                <div className="w-10 h-10 bg-cyan-100 rounded-lg flex items-center justify-center">
                  <svg className="w-5 h-5 text-cyan-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"/>
                  </svg>
                </div>
                <span className="text-xs text-gray-400 uppercase font-semibold">Lucro Bruto</span>
              </div>
              <p className="text-2xl font-bold text-gray-800 mb-1">{formatCurrency(indicadores.lucro?.atual)}</p>
              <p className="text-xs text-gray-500 mb-3">LUCRO</p>
              <div className="space-y-1 pt-2 border-t border-gray-100">
                <Comparativo label="Mes Passado" valor={indicadores.lucro?.mesPassado} valorAtual={indicadores.lucro?.atual} tipo="currency" />
                <Comparativo label="Ano Passado" valor={indicadores.lucro?.anoPassado} valorAtual={indicadores.lucro?.atual} tipo="currency" />
                <Comparativo label="Media Linear" valor={indicadores.lucro?.mediaLinear} valorAtual={indicadores.lucro?.atual} tipo="currency" />
              </div>
            </div>

            {/* Card MARKDOWN */}
            <div className="bg-white rounded-xl shadow-lg p-4 border-t-4 border-blue-500 hover:shadow-xl transition-shadow">
              <div className="flex items-center justify-between mb-3">
                <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                  <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z"/>
                  </svg>
                </div>
                <span className="text-xs text-gray-400 uppercase font-semibold">Margem Bruta</span>
              </div>
              <p className="text-2xl font-bold text-gray-800 mb-1">{formatPercent(indicadores.markdown?.atual)}</p>
              <p className="text-xs text-gray-500 mb-3">MARKDOWN</p>
              <div className="space-y-1 pt-2 border-t border-gray-100">
                <Comparativo label="Mes Passado" valor={indicadores.markdown?.mesPassado} valorAtual={indicadores.markdown?.atual} tipo="percent" />
                <Comparativo label="Ano Passado" valor={indicadores.markdown?.anoPassado} valorAtual={indicadores.markdown?.atual} tipo="percent" />
                <Comparativo label="Media Linear" valor={indicadores.markdown?.mediaLinear} valorAtual={indicadores.markdown?.atual} tipo="percent" />
              </div>
            </div>

            {/* Card MARGEM LIMPA */}
            <div className="bg-white rounded-xl shadow-lg p-4 border-t-4 border-purple-500 hover:shadow-xl transition-shadow">
              <div className="flex items-center justify-between mb-3">
                <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                  <svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"/>
                  </svg>
                </div>
                <span className="text-xs text-gray-400 uppercase font-semibold">Sem Impostos</span>
              </div>
              <p className="text-2xl font-bold text-gray-800 mb-1">{formatPercent(indicadores.margemLimpa?.atual)}</p>
              <p className="text-xs text-gray-500 mb-3">MARGEM LIMPA</p>
              <div className="space-y-1 pt-2 border-t border-gray-100">
                <Comparativo label="Mes Passado" valor={indicadores.margemLimpa?.mesPassado} valorAtual={indicadores.margemLimpa?.atual} tipo="percent" />
                <Comparativo label="Ano Passado" valor={indicadores.margemLimpa?.anoPassado} valorAtual={indicadores.margemLimpa?.atual} tipo="percent" />
                <Comparativo label="Media Linear" valor={indicadores.margemLimpa?.mediaLinear} valorAtual={indicadores.margemLimpa?.atual} tipo="percent" />
              </div>
            </div>

            {/* Card TICKET MEDIO */}
            <div className="bg-white rounded-xl shadow-lg p-4 border-t-4 border-orange-500 hover:shadow-xl transition-shadow">
              <div className="flex items-center justify-between mb-3">
                <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center">
                  <svg className="w-5 h-5 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z"/>
                  </svg>
                </div>
                <span className="text-xs text-gray-400 uppercase font-semibold">Por Cupom</span>
              </div>
              <div className="flex items-baseline gap-2 mb-1">
                <p className="text-2xl font-bold text-gray-800">{formatCurrency(indicadores.ticketMedio?.atual)}</p>
                <span className="text-sm font-semibold text-green-600">({formatNumber(indicadores.qtdCupons?.atual)} cupons)</span>
              </div>
              <p className="text-xs text-gray-500 mb-3">TICKET MEDIO</p>
              <div className="space-y-1 pt-2 border-t border-gray-100">
                <Comparativo label="Mes Passado" valor={indicadores.ticketMedio?.mesPassado} valorAtual={indicadores.ticketMedio?.atual} tipo="currency" />
                <Comparativo label="Ano Passado" valor={indicadores.ticketMedio?.anoPassado} valorAtual={indicadores.ticketMedio?.atual} tipo="currency" />
                <Comparativo label="Media Linear" valor={indicadores.ticketMedio?.mediaLinear} valorAtual={indicadores.ticketMedio?.atual} tipo="currency" />
              </div>
            </div>

            {/* Card % COMPRA E VENDA */}
            <div className="bg-white rounded-xl shadow-lg p-4 border-t-4 border-teal-500 hover:shadow-xl transition-shadow">
              <div className="flex items-center justify-between mb-3">
                <div className="w-10 h-10 bg-teal-100 rounded-lg flex items-center justify-center">
                  <svg className="w-5 h-5 text-teal-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4"/>
                  </svg>
                </div>
                <span className="text-xs text-gray-400 uppercase font-semibold">Compras</span>
              </div>
              <p className="text-2xl font-bold text-gray-800 mb-1">{formatPercent(indicadores.pctCompraVenda?.atual)}</p>
              <p className="text-xs text-gray-500 mb-3">% COMPRA E VENDA</p>
              <div className="space-y-1 pt-2 border-t border-gray-100">
                <Comparativo label="Mes Passado" valor={indicadores.pctCompraVenda?.mesPassado} valorAtual={indicadores.pctCompraVenda?.atual} tipo="percent" invertido />
                <Comparativo label="Ano Passado" valor={indicadores.pctCompraVenda?.anoPassado} valorAtual={indicadores.pctCompraVenda?.atual} tipo="percent" invertido />
                <Comparativo label="Media Linear" valor={indicadores.pctCompraVenda?.mediaLinear} valorAtual={indicadores.pctCompraVenda?.atual} tipo="percent" invertido />
              </div>
            </div>
          </div>

          {/* Linha 2 - Card Promoções + Cards em Branco */}
          <div className="mt-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
            {/* Card VENDAS EM OFERTA */}
            <div className="bg-white rounded-xl shadow-lg p-4 border-t-4 border-rose-500 hover:shadow-xl transition-shadow">
              <div className="flex items-center justify-between mb-3">
                <div className="w-10 h-10 bg-rose-100 rounded-lg flex items-center justify-center">
                  <span className="text-xl">🏷️</span>
                </div>
                <span className="text-xs text-gray-400 uppercase font-semibold">Promocoes</span>
              </div>
              <div className="flex items-baseline gap-2 mb-1">
                <p className="text-2xl font-bold text-gray-800">{formatPercent(indicadores.pctVendasOferta?.atual)}</p>
                <span className="text-sm font-semibold text-rose-600">({formatCurrency(indicadores.vendasOferta?.atual)})</span>
                <span className="text-sm font-semibold text-blue-600">MKD: {formatPercent(indicadores.markdownOferta?.atual)}</span>
              </div>
              <p className="text-xs text-gray-500 mb-3">VENDAS EM OFERTA</p>
              <div className="space-y-1 pt-2 border-t border-gray-100">
                <Comparativo label="Mes Passado" valor={indicadores.pctVendasOferta?.mesPassado} valorAtual={indicadores.pctVendasOferta?.atual} tipo="percent" />
                <Comparativo label="Ano Passado" valor={indicadores.pctVendasOferta?.anoPassado} valorAtual={indicadores.pctVendasOferta?.atual} tipo="percent" />
                <Comparativo label="Media Linear" valor={indicadores.pctVendasOferta?.mediaLinear} valorAtual={indicadores.pctVendasOferta?.atual} tipo="percent" />
              </div>
            </div>

            {/* Card em Branco 1 - Cyan */}
            <div className="bg-white rounded-xl shadow-lg p-4 border-t-4 border-cyan-500 hover:shadow-xl transition-shadow ">
              <div className="flex items-center justify-between mb-3">
                <div className="w-10 h-10 bg-cyan-100 rounded-lg flex items-center justify-center">
                  <span className="text-xl">📋</span>
                </div>
                <span className="text-xs text-gray-400 uppercase font-semibold">Em breve</span>
              </div>
              <p className="text-lg font-bold text-gray-400 mb-1">-</p>
              <p className="text-xs text-gray-400">Indicador em desenvolvimento</p>
            </div>

            {/* Card em Branco 2 - Indigo */}
            <div className="bg-white rounded-xl shadow-lg p-4 border-t-4 border-indigo-500 hover:shadow-xl transition-shadow ">
              <div className="flex items-center justify-between mb-3">
                <div className="w-10 h-10 bg-indigo-100 rounded-lg flex items-center justify-center">
                  <span className="text-xl">📊</span>
                </div>
                <span className="text-xs text-gray-400 uppercase font-semibold">Em breve</span>
              </div>
              <p className="text-lg font-bold text-gray-400 mb-1">-</p>
              <p className="text-xs text-gray-400">Indicador em desenvolvimento</p>
            </div>

            {/* Card em Branco 3 - Pink */}
            <div className="bg-white rounded-xl shadow-lg p-4 border-t-4 border-pink-500 hover:shadow-xl transition-shadow ">
              <div className="flex items-center justify-between mb-3">
                <div className="w-10 h-10 bg-pink-100 rounded-lg flex items-center justify-center">
                  <span className="text-xl">📈</span>
                </div>
                <span className="text-xs text-gray-400 uppercase font-semibold">Em breve</span>
              </div>
              <p className="text-lg font-bold text-gray-400 mb-1">-</p>
              <p className="text-xs text-gray-400">Indicador em desenvolvimento</p>
            </div>

            {/* Card em Branco 4 - Lime */}
            <div className="bg-white rounded-xl shadow-lg p-4 border-t-4 border-lime-500 hover:shadow-xl transition-shadow">
              <div className="flex items-center justify-between mb-3">
                <div className="w-10 h-10 bg-lime-100 rounded-lg flex items-center justify-center">
                  <span className="text-xl">🔍</span>
                </div>
                <span className="text-xs text-gray-400 uppercase font-semibold">Em breve</span>
              </div>
              <p className="text-lg font-bold text-gray-400 mb-1">-</p>
              <p className="text-xs text-gray-400">Indicador em desenvolvimento</p>
            </div>

            {/* Card em Branco 5 - Fuchsia */}
            <div className="bg-white rounded-xl shadow-lg p-4 border-t-4 border-fuchsia-500 hover:shadow-xl transition-shadow">
              <div className="flex items-center justify-between mb-3">
                <div className="w-10 h-10 bg-fuchsia-100 rounded-lg flex items-center justify-center">
                  <span className="text-xl">⚡</span>
                </div>
                <span className="text-xs text-gray-400 uppercase font-semibold">Em breve</span>
              </div>
              <p className="text-lg font-bold text-gray-400 mb-1">-</p>
              <p className="text-xs text-gray-400">Indicador em desenvolvimento</p>
            </div>
          </div>

          {/* Linha de Cards de Categorias - Vendas, Margens, Compras, Financeiro */}
          <div className="mt-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Card VENDAS */}
            <div
              onClick={() => {
                if (cardExpandido === 'vendas') {
                  setCardExpandido(null);
                  setAnaliseAtiva(null);
                  setDadosAnalise([]);
                } else {
                  setCardExpandido('vendas');
                }
              }}
              className={`bg-emerald-50 rounded-xl shadow-md p-4 border border-emerald-200 hover:shadow-lg transition-all cursor-pointer ${cardExpandido === 'vendas' ? 'ring-2 ring-emerald-400' : ''}`}
            >
              <div className="flex items-center justify-between mb-3">
                <div className="w-10 h-10 bg-emerald-200 rounded-lg flex items-center justify-center">
                  <span className="text-xl">💰</span>
                </div>
                <span className="text-xs text-emerald-600 uppercase font-semibold">Análise</span>
              </div>
              <p className="text-xl font-bold text-emerald-800 mb-1">Vendas</p>
              <p className="text-xs text-emerald-600">Análise detalhada de vendas por período, produto e setor</p>
            </div>

            {/* Card MARGENS */}
            <div
              onClick={() => setCardExpandido(cardExpandido === 'margens' ? null : 'margens')}
              className={`bg-violet-50 rounded-xl shadow-md p-4 border border-violet-200 hover:shadow-lg transition-all cursor-pointer ${cardExpandido === 'margens' ? 'ring-2 ring-violet-400' : ''}`}
            >
              <div className="flex items-center justify-between mb-3">
                <div className="w-10 h-10 bg-violet-200 rounded-lg flex items-center justify-center">
                  <span className="text-xl">📈</span>
                </div>
                <span className="text-xs text-violet-600 uppercase font-semibold">Análise</span>
              </div>
              <p className="text-xl font-bold text-violet-800 mb-1">Margens</p>
              <p className="text-xs text-violet-600">Acompanhamento de margens por categoria e produto</p>
            </div>

            {/* Card COMPRAS */}
            <div
              onClick={() => setCardExpandido(cardExpandido === 'compras' ? null : 'compras')}
              className={`bg-amber-50 rounded-xl shadow-md p-4 border border-amber-200 hover:shadow-lg transition-all cursor-pointer ${cardExpandido === 'compras' ? 'ring-2 ring-amber-400' : ''}`}
            >
              <div className="flex items-center justify-between mb-3">
                <div className="w-10 h-10 bg-amber-200 rounded-lg flex items-center justify-center">
                  <span className="text-xl">🛒</span>
                </div>
                <span className="text-xs text-amber-600 uppercase font-semibold">Análise</span>
              </div>
              <p className="text-xl font-bold text-amber-800 mb-1">Compras</p>
              <p className="text-xs text-amber-600">Gestão de compras, pedidos e fornecedores</p>
            </div>

            {/* Card FINANCEIRO */}
            <div
              onClick={() => setCardExpandido(cardExpandido === 'financeiro' ? null : 'financeiro')}
              className={`bg-sky-50 rounded-xl shadow-md p-4 border border-sky-200 hover:shadow-lg transition-all cursor-pointer ${cardExpandido === 'financeiro' ? 'ring-2 ring-sky-400' : ''}`}
            >
              <div className="flex items-center justify-between mb-3">
                <div className="w-10 h-10 bg-sky-200 rounded-lg flex items-center justify-center">
                  <span className="text-xl">🏦</span>
                </div>
                <span className="text-xs text-sky-600 uppercase font-semibold">Análise</span>
              </div>
              <p className="text-xl font-bold text-sky-800 mb-1">Financeiro</p>
              <p className="text-xs text-sky-600">Controle financeiro, fluxo de caixa e DRE</p>
            </div>
          </div>

          {/* Área Expandida - Botões simples em linha */}
          {cardExpandido === 'vendas' && (
            <>
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  onClick={fetchVendasPorSetor}
                  className={`px-4 py-2 border rounded-lg text-sm font-medium transition-colors ${
                    analiseAtiva === 'vendas-setor'
                      ? 'bg-orange-500 text-white border-orange-500'
                      : 'bg-white text-gray-700 border-gray-300 hover:bg-orange-50 hover:border-orange-400'
                  }`}
                >
                  {loadingAnalise && analiseAtiva === 'vendas-setor' ? 'Carregando...' : 'Venda Por Setor'}
                </button>
                <button className="px-4 py-2 bg-white border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-orange-50 hover:border-orange-400 transition-colors">
                  Venda por Ano
                </button>
                <button className="px-4 py-2 bg-white border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-orange-50 hover:border-orange-400 transition-colors">
                  Venda Por Dia da Semana
                </button>
              </div>

              {/* Tabela de Vendas por Setor - Hierárquica */}
              {analiseAtiva === 'vendas-setor' && dadosAnalise.length > 0 && (
                <div className="mt-4 bg-white rounded-xl shadow-lg overflow-hidden border border-gray-200">
                  <div className="bg-orange-500 px-4 py-3">
                    <h3 className="text-white font-semibold">Vendas por Setor - {formatPeriodo()}</h3>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-gray-100">
                        <tr>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase border-b border-gray-200">Setor / Grupo / Subgrupo / Item</th>
                          <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase border-b border-gray-200">Venda</th>
                          <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase border-b border-gray-200">Margem %</th>
                          <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase border-b border-gray-200">Qtd</th>
                        </tr>
                      </thead>
                      <tbody>
                        {dadosAnalise.map((secao, index) => (
                          <Fragment key={`secao-${secao.codSecao || index}`}>
                            {/* Linha da Seção (Nível 1) - Fundo cinza claro */}
                            <tr className={`hover:bg-gray-100 ${index % 2 === 0 ? 'bg-gray-50' : 'bg-white'} border-b border-gray-100`}>
                              <td className="px-4 py-3 text-sm text-gray-800">
                                <button
                                  onClick={() => toggleSecao(secao.codSecao)}
                                  className="flex items-center gap-2 font-semibold text-gray-800"
                                >
                                  <span className={`w-5 h-5 flex items-center justify-center rounded text-xs font-bold transition-colors ${expandedSecoes[secao.codSecao] ? 'bg-orange-500 text-white' : 'bg-gray-300 text-gray-700'}`}>
                                    {expandedSecoes[secao.codSecao]?.loading ? '...' : expandedSecoes[secao.codSecao] ? '−' : '+'}
                                  </span>
                                  {secao.setor}
                                </button>
                              </td>
                              <td className="px-4 py-3 text-sm text-right font-semibold text-gray-800">
                                {formatCurrency(secao.venda)}
                              </td>
                              <td className={`px-4 py-3 text-sm text-right font-semibold ${secao.margem >= 30 ? 'text-green-600' : secao.margem >= 20 ? 'text-yellow-600' : 'text-red-600'}`}>
                                {formatPercent(secao.margem)}
                              </td>
                              <td className="px-4 py-3 text-sm text-right text-gray-600 font-semibold">
                                {formatNumber(secao.qtd)}
                              </td>
                            </tr>

                            {/* Linhas dos Grupos (Nível 2) */}
                            {expandedSecoes[secao.codSecao]?.grupos?.map((grupo, gIndex) => (
                              <Fragment key={`grupo-${grupo.codGrupo || gIndex}`}>
                                <tr className={`hover:bg-gray-100 ${gIndex % 2 === 0 ? 'bg-white' : 'bg-gray-50'} border-b border-gray-100`}>
                                  <td className="px-4 py-2 text-sm text-gray-700 pl-10">
                                    <button
                                      onClick={() => toggleGrupo(grupo.codGrupo, secao.codSecao)}
                                      className="flex items-center gap-2 font-medium text-gray-700"
                                    >
                                      <span className={`w-4 h-4 flex items-center justify-center rounded text-xs font-bold transition-colors ${expandedGrupos[grupo.codGrupo] ? 'bg-orange-500 text-white' : 'bg-gray-300 text-gray-700'}`}>
                                        {expandedGrupos[grupo.codGrupo]?.loading ? '.' : expandedGrupos[grupo.codGrupo] ? '−' : '+'}
                                      </span>
                                      {grupo.grupo}
                                    </button>
                                  </td>
                                  <td className="px-4 py-2 text-sm text-right font-medium text-gray-700">
                                    {formatCurrency(grupo.venda)}
                                  </td>
                                  <td className={`px-4 py-2 text-sm text-right font-medium ${grupo.margem >= 30 ? 'text-green-600' : grupo.margem >= 20 ? 'text-yellow-600' : 'text-red-600'}`}>
                                    {formatPercent(grupo.margem)}
                                  </td>
                                  <td className="px-4 py-2 text-sm text-right text-gray-600">
                                    {formatNumber(grupo.qtd)}
                                  </td>
                                </tr>

                                {/* Linhas dos Subgrupos (Nível 3) */}
                                {expandedGrupos[grupo.codGrupo]?.subgrupos?.map((subgrupo, sgIndex) => (
                                  <Fragment key={`subgrupo-${subgrupo.codSubgrupo || sgIndex}`}>
                                    <tr className={`hover:bg-gray-100 ${sgIndex % 2 === 0 ? 'bg-white' : 'bg-gray-50'} border-b border-gray-100`}>
                                      <td className="px-4 py-2 text-sm text-gray-600 pl-16">
                                        <button
                                          onClick={() => toggleSubgrupo(subgrupo.codSubgrupo, grupo.codGrupo, secao.codSecao)}
                                          className="flex items-center gap-2 text-gray-600"
                                        >
                                          <span className={`w-4 h-4 flex items-center justify-center rounded text-xs font-bold transition-colors ${expandedSubgrupos[subgrupo.codSubgrupo] ? 'bg-orange-500 text-white' : 'bg-gray-300 text-gray-700'}`}>
                                            {expandedSubgrupos[subgrupo.codSubgrupo]?.loading ? '.' : expandedSubgrupos[subgrupo.codSubgrupo] ? '−' : '+'}
                                          </span>
                                          {subgrupo.subgrupo}
                                        </button>
                                      </td>
                                      <td className="px-4 py-2 text-sm text-right text-gray-600">
                                        {formatCurrency(subgrupo.venda)}
                                      </td>
                                      <td className={`px-4 py-2 text-sm text-right ${subgrupo.margem >= 30 ? 'text-green-600' : subgrupo.margem >= 20 ? 'text-yellow-600' : 'text-red-600'}`}>
                                        {formatPercent(subgrupo.margem)}
                                      </td>
                                      <td className="px-4 py-2 text-sm text-right text-gray-600">
                                        {formatNumber(subgrupo.qtd)}
                                      </td>
                                    </tr>

                                    {/* Linhas dos Itens (Nível 4) */}
                                    {expandedSubgrupos[subgrupo.codSubgrupo]?.itens?.map((item, iIndex) => (
                                      <tr key={`item-${item.codProduto || iIndex}`} className={`hover:bg-gray-100 ${iIndex % 2 === 0 ? 'bg-white' : 'bg-gray-50'} border-b border-gray-50`}>
                                        <td className="px-4 py-1.5 text-xs text-gray-500 pl-24">
                                          <span className="flex items-center gap-2">
                                            <span className="w-1.5 h-1.5 rounded-full bg-gray-400"></span>
                                            {item.produto}
                                          </span>
                                        </td>
                                        <td className="px-4 py-1.5 text-xs text-right text-gray-600">
                                          {formatCurrency(item.venda)}
                                        </td>
                                        <td className={`px-4 py-1.5 text-xs text-right ${item.margem >= 30 ? 'text-green-600' : item.margem >= 20 ? 'text-yellow-600' : 'text-red-600'}`}>
                                          {formatPercent(item.margem)}
                                        </td>
                                        <td className="px-4 py-1.5 text-xs text-right text-gray-500">
                                          {formatNumber(item.qtd)}
                                        </td>
                                      </tr>
                                    ))}
                                  </Fragment>
                                ))}
                              </Fragment>
                            ))}
                          </Fragment>
                        ))}
                      </tbody>
                      <tfoot className="bg-gray-200">
                        <tr>
                          <td className="px-4 py-3 text-sm font-bold text-gray-800">TOTAL</td>
                          <td className="px-4 py-3 text-sm text-right font-bold text-gray-800">
                            {formatCurrency(dadosAnalise.reduce((acc, item) => acc + item.venda, 0))}
                          </td>
                          <td className="px-4 py-3 text-sm text-right font-bold text-gray-800">
                            {formatPercent(
                              dadosAnalise.reduce((acc, item) => acc + item.venda, 0) > 0
                                ? ((dadosAnalise.reduce((acc, item) => acc + item.venda, 0) - dadosAnalise.reduce((acc, item) => acc + (item.venda * (1 - item.margem / 100)), 0)) / dadosAnalise.reduce((acc, item) => acc + item.venda, 0)) * 100
                                : 0
                            )}
                          </td>
                          <td className="px-4 py-3 text-sm text-right font-bold text-gray-600">
                            {formatNumber(dadosAnalise.reduce((acc, item) => acc + item.qtd, 0))}
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </div>
              )}
            </>
          )}

          {cardExpandido === 'margens' && (
            <div className="mt-3 flex flex-wrap gap-2">
              <button className="px-4 py-2 bg-white border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50 hover:border-gray-400 transition-colors">
                Margem por Categoria
              </button>
              <button className="px-4 py-2 bg-white border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50 hover:border-gray-400 transition-colors">
                Margem por Produto
              </button>
              <button className="px-4 py-2 bg-white border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50 hover:border-gray-400 transition-colors">
                Evolução de Margem
              </button>
            </div>
          )}

          {cardExpandido === 'compras' && (
            <div className="mt-3 flex flex-wrap gap-2">
              <button className="px-4 py-2 bg-white border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50 hover:border-gray-400 transition-colors">
                Compras por Fornecedor
              </button>
              <button className="px-4 py-2 bg-white border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50 hover:border-gray-400 transition-colors">
                Pedidos em Aberto
              </button>
              <button className="px-4 py-2 bg-white border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50 hover:border-gray-400 transition-colors">
                Curva ABC Compras
              </button>
            </div>
          )}

          {cardExpandido === 'financeiro' && (
            <div className="mt-3 flex flex-wrap gap-2">
              <button className="px-4 py-2 bg-white border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50 hover:border-gray-400 transition-colors">
                Fluxo de Caixa
              </button>
              <button className="px-4 py-2 bg-white border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50 hover:border-gray-400 transition-colors">
                DRE
              </button>
              <button className="px-4 py-2 bg-white border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50 hover:border-gray-400 transition-colors">
                Contas a Pagar
              </button>
            </div>
          )}
          </>
        )}

        {/* Informativo do Cache */}
        <div className="mt-6 text-center">
          <p className="text-xs text-gray-400">
            Os dados sao atualizados automaticamente a cada 5 minutos. Clique em "Atualizar" para forcar uma nova consulta.
          </p>
        </div>
      </div>
    </Layout>
  );
}
