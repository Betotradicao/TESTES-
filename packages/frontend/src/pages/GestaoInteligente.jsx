import { useState, useEffect } from 'react';
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

export default function GestaoInteligente() {
  const [indicadores, setIndicadores] = useState({
    vendas: 0,
    custoVendas: 0,
    compras: 0,
    impostos: 0,
    markdown: 0,
    margemLimpa: 0,
    ticketMedio: 0,
    pctCompraVenda: 0,
    qtdCupons: 0,
    qtdItens: 0
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filters, setFilters] = useState(getDefaultDates());
  const [clearingCache, setClearingCache] = useState(false);
  const { lojaSelecionada } = useLoja();

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
      // Recarregar dados após limpar cache
      await fetchIndicadores();
    } catch (err) {
      console.error('Erro ao limpar cache:', err);
    } finally {
      setClearingCache(false);
    }
  };

  useEffect(() => {
    fetchIndicadores();
  }, [filters, lojaSelecionada]);

  // Formatar período para exibição
  const formatPeriodo = () => {
    const inicio = filters.dataInicio.split('-').reverse().join('/');
    const fim = filters.dataFim.split('-').reverse().join('/');
    return `${inicio} a ${fim}`;
  };

  return (
    <Layout>
      <div className="p-4 md:p-6">
        {/* Header Laranja */}
        <div className="bg-gradient-to-r from-orange-500 to-orange-600 rounded-lg shadow-lg p-6 mb-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-white/20 rounded-lg flex items-center justify-center">
                <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/>
                </svg>
              </div>
              <div>
                <h1 className="text-2xl font-bold text-white">Gestao Inteligente</h1>
                <p className="text-orange-100 text-sm">Dashboard de Indicadores</p>
              </div>
            </div>

            {/* Filtros */}
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2 bg-white/10 rounded-lg px-3 py-2">
                <label className="text-white text-sm font-medium">De:</label>
                <input
                  type="date"
                  value={filters.dataInicio}
                  onChange={(e) => setFilters({ ...filters, dataInicio: e.target.value })}
                  className="bg-white rounded px-2 py-1 text-sm text-gray-700"
                />
              </div>
              <div className="flex items-center gap-2 bg-white/10 rounded-lg px-3 py-2">
                <label className="text-white text-sm font-medium">Até:</label>
                <input
                  type="date"
                  value={filters.dataFim}
                  onChange={(e) => setFilters({ ...filters, dataFim: e.target.value })}
                  className="bg-white rounded px-2 py-1 text-sm text-gray-700"
                />
              </div>
              <button
                onClick={handleClearCache}
                disabled={clearingCache}
                className="flex items-center gap-2 bg-white/20 hover:bg-white/30 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
                title="Limpar cache e recarregar dados"
              >
                {clearingCache ? (
                  <>
                    <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    <span>Atualizando...</span>
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/>
                    </svg>
                    <span>Atualizar</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Período selecionado */}
          <div className="mt-4 text-center">
            <span className="bg-white/20 text-white px-4 py-1 rounded-full text-sm font-medium">
              Período: {formatPeriodo()}
            </span>
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
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-6">
            {/* Card VENDAS */}
            <div className="bg-white rounded-xl shadow-lg p-6 border-t-4 border-green-500 hover:shadow-xl transition-shadow">
              <div className="flex items-center justify-between mb-4">
                <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                  <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
                  </svg>
                </div>
                <span className="text-xs text-gray-400 uppercase font-semibold">Faturamento</span>
              </div>
              <p className="text-3xl font-bold text-gray-800 mb-1">{formatCurrency(indicadores.vendas)}</p>
              <p className="text-sm text-gray-500">VENDAS</p>
              <div className="mt-3 pt-3 border-t border-gray-100">
                <p className="text-xs text-gray-400">{formatNumber(indicadores.qtdCupons)} cupons | {formatNumber(indicadores.qtdItens)} itens</p>
              </div>
            </div>

            {/* Card MARKDOWN */}
            <div className="bg-white rounded-xl shadow-lg p-6 border-t-4 border-blue-500 hover:shadow-xl transition-shadow">
              <div className="flex items-center justify-between mb-4">
                <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                  <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z"/>
                  </svg>
                </div>
                <span className="text-xs text-gray-400 uppercase font-semibold">Margem Bruta</span>
              </div>
              <p className="text-3xl font-bold text-gray-800 mb-1">{formatPercent(indicadores.markdown)}</p>
              <p className="text-sm text-gray-500">MARKDOWN</p>
              <div className="mt-3 pt-3 border-t border-gray-100">
                <p className="text-xs text-gray-400">Custo: {formatCurrency(indicadores.custoVendas)}</p>
              </div>
            </div>

            {/* Card MARGEM LIMPA */}
            <div className="bg-white rounded-xl shadow-lg p-6 border-t-4 border-purple-500 hover:shadow-xl transition-shadow">
              <div className="flex items-center justify-between mb-4">
                <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
                  <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"/>
                  </svg>
                </div>
                <span className="text-xs text-gray-400 uppercase font-semibold">Sem Impostos</span>
              </div>
              <p className="text-3xl font-bold text-gray-800 mb-1">{formatPercent(indicadores.margemLimpa)}</p>
              <p className="text-sm text-gray-500">MARGEM LIMPA</p>
              <div className="mt-3 pt-3 border-t border-gray-100">
                <p className="text-xs text-gray-400">Impostos: {formatCurrency(indicadores.impostos)}</p>
              </div>
            </div>

            {/* Card TICKET MEDIO */}
            <div className="bg-white rounded-xl shadow-lg p-6 border-t-4 border-orange-500 hover:shadow-xl transition-shadow">
              <div className="flex items-center justify-between mb-4">
                <div className="w-12 h-12 bg-orange-100 rounded-lg flex items-center justify-center">
                  <svg className="w-6 h-6 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z"/>
                  </svg>
                </div>
                <span className="text-xs text-gray-400 uppercase font-semibold">Por Cupom</span>
              </div>
              <p className="text-3xl font-bold text-gray-800 mb-1">{formatCurrency(indicadores.ticketMedio)}</p>
              <p className="text-sm text-gray-500">TICKET MEDIO</p>
              <div className="mt-3 pt-3 border-t border-gray-100">
                <p className="text-xs text-gray-400">Vendas / Cupons</p>
              </div>
            </div>

            {/* Card % COMPRA E VENDA */}
            <div className="bg-white rounded-xl shadow-lg p-6 border-t-4 border-teal-500 hover:shadow-xl transition-shadow">
              <div className="flex items-center justify-between mb-4">
                <div className="w-12 h-12 bg-teal-100 rounded-lg flex items-center justify-center">
                  <svg className="w-6 h-6 text-teal-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4"/>
                  </svg>
                </div>
                <span className="text-xs text-gray-400 uppercase font-semibold">Compras</span>
              </div>
              <p className="text-3xl font-bold text-gray-800 mb-1">{formatPercent(indicadores.pctCompraVenda)}</p>
              <p className="text-sm text-gray-500">% COMPRA E VENDA</p>
              <div className="mt-3 pt-3 border-t border-gray-100">
                <p className="text-xs text-gray-400">Compras: {formatCurrency(indicadores.compras)}</p>
              </div>
            </div>
          </div>
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
