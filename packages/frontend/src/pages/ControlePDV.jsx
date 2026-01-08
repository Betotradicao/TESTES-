import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import Sidebar from '../components/Sidebar';
import { api } from '../utils/api';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement,
  PointElement,
  LineElement
} from 'chart.js';
import { Bar, Pie, Line } from 'react-chartjs-2';

// Registrar componentes do Chart.js
ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement,
  PointElement,
  LineElement
);

export default function ControlePDV() {
  const { user, logout } = useAuth();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Estado do resumo
  const [resumo, setResumo] = useState(null);

  // Estado dos detalhes
  const [descontos, setDescontos] = useState([]);
  const [devolucoes, setDevolucoes] = useState([]);

  // Filtros
  const hoje = new Date();
  const primeiroDiaMes = new Date(hoje.getFullYear(), hoje.getMonth(), 1);

  const [filters, setFilters] = useState({
    dataInicio: primeiroDiaMes.toISOString().split('T')[0],
    dataFim: hoje.toISOString().split('T')[0]
  });

  // Fetch summary data
  const fetchResumo = async () => {
    try {
      setLoading(true);
      setError('');

      const response = await api.get('/pdv/resumo', {
        params: {
          dataInicio: filters.dataInicio,
          dataFim: filters.dataFim
        }
      });

      setResumo(response.data);
    } catch (err) {
      console.error('Erro ao buscar resumo PDV:', err);
      setError('Erro ao carregar resumo do PDV. Check configuration da API Zanthus.');
    } finally {
      setLoading(false);
    }
  };

  // Fetch discounts data
  const fetchDescontos = async () => {
    try {
      const response = await api.get('/pdv/descontos', {
        params: {
          dataInicio: filters.dataInicio,
          dataFim: filters.dataFim
        }
      });

      setDescontos(response.data);
    } catch (err) {
      console.error('Erro ao buscar descontos:', err);
    }
  };

  const fetchDevolucoes = async () => {
    try {
      const response = await api.get('/pdv/devolucoes', {
        params: {
          dataInicio: filters.dataInicio,
          dataFim: filters.dataFim
        }
      });

      setDevolucoes(response.data);
    } catch (err) {
      console.error('Error fetching returns:', err);
    }
  };

  // Load data on mount and when filters change
  useEffect(() => {
    fetchResumo();
    fetchDescontos();
    fetchDevolucoes();
  }, [filters]);

  const handleFilterChange = (e) => {
    const { name, value } = e.target;
    setFilters(prev => ({ ...prev, [name]: value }));
  };

  const handleBuscar = () => {
    fetchResumo();
    fetchDescontos();
    fetchDevolucoes();
  };

  // Formatar moeda
  const formatCurrency = (value) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value || 0);
  };

  // Dados para gr'afico de vendas por operador (Bar Chart)
  const vendasPorOperadorData = resumo ? {
    labels: resumo.operadores.map(op => op.nome),
    datasets: [{
      label: 'Valor Vendido (R$)',
      data: resumo.operadores.map(op => op.valorTotalVendido),
      backgroundColor: 'rgba(54, 162, 235, 0.6)',
      borderColor: 'rgba(54, 162, 235, 1)',
      borderWidth: 1
    }]
  } : null;

  // Dados para gr'afico de descontos por operador (Pie Chart)
  const descontosPorOperadorData = resumo ? {
    labels: resumo.operadores.filter(op => op.qtdDescontos > 0).map(op => op.nome),
    datasets: [{
      label: 'Descontos',
      data: resumo.operadores.filter(op => op.qtdDescontos > 0).map(op => op.qtdDescontos),
      backgroundColor: [
        'rgba(255, 99, 132, 0.6)',
        'rgba(54, 162, 235, 0.6)',
        'rgba(255, 206, 86, 0.6)',
        'rgba(75, 192, 192, 0.6)',
        'rgba(153, 102, 255, 0.6)',
        'rgba(255, 159, 64, 0.6)',
        'rgba(199, 199, 199, 0.6)'
      ],
      borderWidth: 1
    }]
  } : null;

  return (
    <div className="flex h-screen bg-gray-900 text-white overflow-hidden">
      <Sidebar
        currentPage="Controle PDV"
        onLogout={logout}
        user={user}
        isMobileMenuOpen={isMobileMenuOpen}
        setIsMobileMenuOpen={setIsMobileMenuOpen}
      />

      <div className="flex-1 flex flex-col h-screen overflow-hidden">
        {/* Cabecalho */}
        <div className="bg-gray-800 p-4 border-b border-gray-700">
          <h1 className="text-2xl font-bold">Controle PDV</h1>
          <p className="text-gray-400 text-sm mt-1">An'alise de vendas, descontos e operadores</p>
        </div>

        {/* Conte'udo principal com scroll */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* Filtros */}
          <div className="bg-gray-800 p-4 rounded-lg mb-6 border border-gray-700">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <label className="block text-sm font-medium mb-2">Data In'icio</label>
                <input
                  type="date"
                  name="dataInicio"
                  value={filters.dataInicio}
                  onChange={handleFilterChange}
                  className="w-full p-2 bg-gray-700 border border-gray-600 rounded text-white"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Data Fim</label>
                <input
                  type="date"
                  name="dataFim"
                  value={filters.dataFim}
                  onChange={handleFilterChange}
                  className="w-full p-2 bg-gray-700 border border-gray-600 rounded text-white"
                />
              </div>

              <div className="flex items-end">
                <button
                  onClick={handleBuscar}
                  disabled={loading}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded transition disabled:bg-gray-600"
                >
                  {loading ? 'Buscando...' : 'Buscar'}
                </button>
              </div>
            </div>
          </div>

          {/* Mensagem de erro */}
          {error && (
            <div className="bg-red-900/50 border border-red-700 text-red-200 px-4 py-3 rounded mb-6">
              <p className="font-bold">Erro</p>
              <p className="text-sm">{error}</p>
            </div>
          )}

          {/* Cards Macro */}
          {resumo && (
            <>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
                {/* Card Total de Vendas */}
                <div className="bg-gradient-to-br from-blue-600 to-blue-800 p-6 rounded-lg shadow-lg border border-blue-500">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-blue-200 text-sm">Total de Vendas</p>
                      <p className="text-3xl font-bold mt-2">{resumo.totalVendas}</p>
                      <p className="text-xl mt-1">{formatCurrency(resumo.valorTotalVendido)}</p>
                    </div>
                    <div className="bg-blue-500 bg-opacity-30 p-3 rounded-full">
                      <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                      </svg>
                    </div>
                  </div>
                </div>

                {/* Card Descontos */}
                <div className="bg-gradient-to-br from-yellow-600 to-yellow-800 p-6 rounded-lg shadow-lg border border-yellow-500">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-yellow-200 text-sm">Descontos</p>
                      <p className="text-3xl font-bold mt-2">{resumo.qtdDescontos}</p>
                      <p className="text-xl mt-1">{formatCurrency(resumo.valorTotalDescontos)}</p>
                      <p className="text-sm mt-1">{resumo.percentualDescontos.toFixed(2)}% das vendas</p>
                    </div>
                    <div className="bg-yellow-500 bg-opacity-30 p-3 rounded-full">
                      <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                  </div>
                </div>

                {/* Card Devoluc~oes */}
                <div className="bg-gradient-to-br from-red-600 to-red-800 p-6 rounded-lg shadow-lg border border-red-500">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-red-200 text-sm">Devoluc~oes</p>
                      <p className="text-3xl font-bold mt-2">{resumo.qtdDevolucoes}</p>
                      <p className="text-xl mt-1">{formatCurrency(resumo.valorTotalDevolucoes)}</p>
                      <p className="text-sm mt-1">{resumo.percentualDevolucoes.toFixed(2)}% das vendas</p>
                    </div>
                    <div className="bg-red-500 bg-opacity-30 p-3 rounded-full">
                      <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
                      </svg>
                    </div>
                  </div>
                </div>
              </div>

              {/* Gr'aficos */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                {/* Gr'afico de Vendas por Operador */}
                <div className="bg-gray-800 p-6 rounded-lg border border-gray-700">
                  <h3 className="text-lg font-semibold mb-4">Vendas por Operador</h3>
                  {vendasPorOperadorData && (
                    <Bar
                      data={vendasPorOperadorData}
                      options={{
                        responsive: true,
                        plugins: {
                          legend: { display: false },
                          title: { display: false }
                        },
                        scales: {
                          y: {
                            ticks: { color: '#9CA3AF' },
                            grid: { color: 'rgba(75, 85, 99, 0.3)' }
                          },
                          x: {
                            ticks: { color: '#9CA3AF' },
                            grid: { display: false }
                          }
                        }
                      }}
                    />
                  )}
                </div>

                {/* Gr'afico de Descontos por Operador */}
                <div className="bg-gray-800 p-6 rounded-lg border border-gray-700">
                  <h3 className="text-lg font-semibold mb-4">Descontos por Operador</h3>
                  {descontosPorOperadorData && descontosPorOperadorData.labels.length > 0 ? (
                    <Pie
                      data={descontosPorOperadorData}
                      options={{
                        responsive: true,
                        plugins: {
                          legend: {
                            position: 'bottom',
                            labels: { color: '#9CA3AF' }
                          }
                        }
                      }}
                    />
                  ) : (
                    <p className="text-gray-400 text-center py-8">Nenhum desconto no per'iodo</p>
                  )}
                </div>
              </div>

              {/* Tabela de Performance por Operador */}
              <div className="bg-gray-800 p-6 rounded-lg border border-gray-700 mb-6">
                <h3 className="text-lg font-semibold mb-4">Performance por Operador</h3>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-gray-700">
                        <th className="text-left py-3 px-4">Operador</th>
                        <th className="text-right py-3 px-4">Vendas</th>
                        <th className="text-right py-3 px-4">Valor Total</th>
                        <th className="text-right py-3 px-4">Descontos</th>
                        <th className="text-right py-3 px-4">% Desc</th>
                        <th className="text-right py-3 px-4">Devoluc~oes</th>
                        <th className="text-right py-3 px-4">% Devol</th>
                      </tr>
                    </thead>
                    <tbody>
                      {resumo.operadores.map((op, idx) => (
                        <tr key={idx} className="border-b border-gray-700 hover:bg-gray-700 transition">
                          <td className="py-3 px-4 font-medium">{op.nome}</td>
                          <td className="text-right py-3 px-4">{op.totalVendas}</td>
                          <td className="text-right py-3 px-4">{formatCurrency(op.valorTotalVendido)}</td>
                          <td className="text-right py-3 px-4">{op.qtdDescontos}</td>
                          <td className="text-right py-3 px-4">
                            <span className={`px-2 py-1 rounded text-sm ${op.percentualDescontos > 5 ? 'bg-red-900 text-red-200' : 'bg-green-900 text-green-200'}`}>
                              {op.percentualDescontos.toFixed(2)}%
                            </span>
                          </td>
                          <td className="text-right py-3 px-4">{op.qtdDevolucoes}</td>
                          <td className="text-right py-3 px-4">
                            <span className={`px-2 py-1 rounded text-sm ${op.percentualDevolucoes > 3 ? 'bg-red-900 text-red-200' : 'bg-green-900 text-green-200'}`}>
                              {op.percentualDevolucoes.toFixed(2)}%
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Tabela de Descontos Detalhados */}
              {descontos.length > 0 && (
                <div className="bg-gray-800 p-6 rounded-lg border border-gray-700 mb-6">
                  <h3 className="text-lg font-semibold mb-4">Descontos Detalhados ({descontos.length})</h3>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-gray-700">
                          <th className="text-left py-2 px-3">Cupom</th>
                          <th className="text-left py-2 px-3">Operador</th>
                          <th className="text-left py-2 px-3">Produto</th>
                          <th className="text-right py-2 px-3">Desconto</th>
                          <th className="text-left py-2 px-3">Motivo</th>
                          <th className="text-left py-2 px-3">Autorizado por</th>
                        </tr>
                      </thead>
                      <tbody>
                        {descontos.slice(0, 20).map((desc, idx) => (
                          <tr key={idx} className="border-b border-gray-700 hover:bg-gray-700 transition">
                            <td className="py-2 px-3">{desc.cupom}</td>
                            <td className="py-2 px-3">{desc.operadorNome}</td>
                            <td className="py-2 px-3">{desc.descProduto}</td>
                            <td className="text-right py-2 px-3 text-yellow-400 font-semibold">{formatCurrency(desc.desconto)}</td>
                            <td className="py-2 px-3">{desc.motivoDescontoDesc || `C'odigo ${desc.motivoDesconto}`}</td>
                            <td className="py-2 px-3">{desc.autorizadorDescontoNome || `C'odigo ${desc.autorizadorDesconto}`}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {descontos.length > 20 && (
                      <p className="text-gray-400 text-sm mt-4 text-center">
                        Mostrando 20 de {descontos.length} descontos
                      </p>
                    )}
                  </div>
                </div>
              )}

              {/* Tabela de Devoluc~oes Detalhadas */}
              {devolucoes.length > 0 && (
                <div className="bg-gray-800 p-6 rounded-lg border border-gray-700">
                  <h3 className="text-lg font-semibold mb-4">Devoluc~oes Detalhadas ({devolucoes.length})</h3>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-gray-700">
                          <th className="text-left py-2 px-3">Cupom</th>
                          <th className="text-left py-2 px-3">Operador</th>
                          <th className="text-left py-2 px-3">Produto</th>
                          <th className="text-right py-2 px-3">Quantidade</th>
                          <th className="text-right py-2 px-3">Valor</th>
                          <th className="text-left py-2 px-3">Data/Hora</th>
                        </tr>
                      </thead>
                      <tbody>
                        {devolucoes.slice(0, 20).map((dev, idx) => (
                          <tr key={idx} className="border-b border-gray-700 hover:bg-gray-700 transition">
                            <td className="py-2 px-3">{dev.cupom}</td>
                            <td className="py-2 px-3">{dev.operadorNome}</td>
                            <td className="py-2 px-3">{dev.descProduto}</td>
                            <td className="text-right py-2 px-3 text-red-400">{dev.quantidade}</td>
                            <td className="text-right py-2 px-3 text-red-400 font-semibold">{formatCurrency(dev.valorTotal)}</td>
                            <td className="py-2 px-3">{new Date(dev.dataHora).toLocaleString('pt-BR')}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {devolucoes.length > 20 && (
                      <p className="text-gray-400 text-sm mt-4 text-center">
                        Mostrando 20 de {devolucoes.length} devoluc~oes
                      </p>
                    )}
                  </div>
                </div>
              )}
            </>
          )}

          {/* Estado vazio */}
          {!loading && !resumo && !error && (
            <div className="bg-gray-800 p-12 rounded-lg border border-gray-700 text-center">
              <svg className="w-16 h-16 mx-auto text-gray-600 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
              <p className="text-gray-400">Selecione o per'iodo e clique em Buscar para visualizar os dados</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
