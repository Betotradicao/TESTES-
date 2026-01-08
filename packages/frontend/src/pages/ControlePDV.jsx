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
import { Bar, Pie } from 'react-chartjs-2';

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

  // Filtros - usando data 2025 (ano atual)
  const hoje = new Date('2025-01-08');
  const primeiroDiaMes = new Date(2025, 0, 1);

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
    <div className="flex h-screen bg-gray-50">
      <Sidebar
        currentPage="Controle PDV"
        onLogout={logout}
        user={user}
        isMobileMenuOpen={isMobileMenuOpen}
        setIsMobileMenuOpen={setIsMobileMenuOpen}
      />

      <div className="flex-1 flex flex-col h-screen overflow-hidden">
        {/* Mobile Header */}
        <div className="lg:hidden bg-white shadow-sm p-4 flex items-center justify-between">
          <button
            onClick={() => setIsMobileMenuOpen(true)}
            className="p-2 text-gray-600 hover:text-gray-900"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16"/>
            </svg>
          </button>
          <h1 className="text-lg font-semibold text-gray-900">Controle PDV</h1>
          <button
            onClick={logout}
            className="p-2 text-gray-600 hover:text-red-600"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"/>
            </svg>
          </button>
        </div>

        {/* Main content */}
        <main className="p-4 lg:p-8 flex-1 overflow-y-auto">
          {/* Filtros */}
          <div className="bg-white p-4 rounded-lg mb-6 shadow">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Data Inicio</label>
                <input
                  type="date"
                  name="dataInicio"
                  value={filters.dataInicio}
                  onChange={handleFilterChange}
                  className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Data Fim</label>
                <input
                  type="date"
                  name="dataFim"
                  value={filters.dataFim}
                  onChange={handleFilterChange}
                  className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="flex items-end">
                <button
                  onClick={handleBuscar}
                  disabled={loading}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition disabled:opacity-50"
                >
                  {loading ? 'Buscando...' : 'Buscar'}
                </button>
              </div>
            </div>
          </div>

          {/* Mensagem de erro */}
          {error && (
            <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-lg mb-6">
              <p className="font-bold">Erro</p>
              <p className="text-sm">{error}</p>
            </div>
          )}

          {/* Cards Macro */}
          {resumo && (
            <>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                {/* Card Total de Vendas */}
                <div className="bg-white p-6 rounded-lg shadow">
                  <h3 className="text-sm font-medium text-gray-500 mb-2">Total de Vendas</h3>
                  <p className="text-2xl font-bold text-gray-900">{resumo.totalVendas}</p>
                  <p className="text-lg text-gray-700 mt-1">{formatCurrency(resumo.valorTotalVendido)}</p>
                </div>

                {/* Card Descontos */}
                <div className="bg-white p-6 rounded-lg shadow">
                  <h3 className="text-sm font-medium text-gray-500 mb-2">Descontos</h3>
                  <p className="text-2xl font-bold text-yellow-600">{resumo.qtdDescontos}</p>
                  <p className="text-lg text-yellow-700 mt-1">{formatCurrency(resumo.valorTotalDescontos)}</p>
                  <p className="text-sm text-gray-600 mt-1">{resumo.percentualDescontos.toFixed(2)}% das vendas</p>
                </div>

                {/* Card Devolucoes */}
                <div className="bg-white p-6 rounded-lg shadow">
                  <h3 className="text-sm font-medium text-gray-500 mb-2">Devolucoes</h3>
                  <p className="text-2xl font-bold text-red-600">{resumo.qtdDevolucoes}</p>
                  <p className="text-lg text-red-700 mt-1">{formatCurrency(resumo.valorTotalDevolucoes)}</p>
                  <p className="text-sm text-gray-600 mt-1">{resumo.percentualDevolucoes.toFixed(2)}% das vendas</p>
                </div>
              </div>

              {/* Graficos */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                {/* Grafico de Vendas por Operador */}
                <div className="bg-white p-6 rounded-lg shadow">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Vendas por Operador</h3>
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
                            ticks: { color: '#374151' },
                            grid: { color: 'rgba(209, 213, 219, 0.5)' }
                          },
                          x: {
                            ticks: { color: '#374151' },
                            grid: { display: false }
                          }
                        }
                      }}
                    />
                  )}
                </div>

                {/* Grafico de Descontos por Operador */}
                <div className="bg-white p-6 rounded-lg shadow">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Descontos por Operador</h3>
                  {descontosPorOperadorData && descontosPorOperadorData.labels.length > 0 ? (
                    <Pie
                      data={descontosPorOperadorData}
                      options={{
                        responsive: true,
                        plugins: {
                          legend: {
                            position: 'bottom',
                            labels: { color: '#374151' }
                          }
                        }
                      }}
                    />
                  ) : (
                    <p className="text-gray-500 text-center py-8">Nenhum desconto no periodo</p>
                  )}
                </div>
              </div>

              {/* Tabela de Performance por Operador */}
              <div className="bg-white p-6 rounded-lg shadow mb-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Performance por Operador</h3>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-gray-200">
                        <th className="text-left py-3 px-4 text-gray-700 font-medium">Operador</th>
                        <th className="text-right py-3 px-4 text-gray-700 font-medium">Vendas</th>
                        <th className="text-right py-3 px-4 text-gray-700 font-medium">Valor Total</th>
                        <th className="text-right py-3 px-4 text-gray-700 font-medium">Descontos</th>
                        <th className="text-right py-3 px-4 text-gray-700 font-medium">% Desc</th>
                        <th className="text-right py-3 px-4 text-gray-700 font-medium">Devolucoes</th>
                        <th className="text-right py-3 px-4 text-gray-700 font-medium">% Devol</th>
                      </tr>
                    </thead>
                    <tbody>
                      {resumo.operadores.map((op, idx) => (
                        <tr key={idx} className="border-b border-gray-200 hover:bg-gray-50 transition">
                          <td className="py-3 px-4 font-medium text-gray-900">{op.nome}</td>
                          <td className="text-right py-3 px-4 text-gray-700">{op.totalVendas}</td>
                          <td className="text-right py-3 px-4 text-gray-700">{formatCurrency(op.valorTotalVendido)}</td>
                          <td className="text-right py-3 px-4 text-gray-700">{op.qtdDescontos}</td>
                          <td className="text-right py-3 px-4">
                            <span className={`px-2 py-1 rounded text-sm ${op.percentualDescontos > 5 ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
                              {op.percentualDescontos.toFixed(2)}%
                            </span>
                          </td>
                          <td className="text-right py-3 px-4 text-gray-700">{op.qtdDevolucoes}</td>
                          <td className="text-right py-3 px-4">
                            <span className={`px-2 py-1 rounded text-sm ${op.percentualDevolucoes > 3 ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
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
                <div className="bg-white p-6 rounded-lg shadow mb-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Descontos Detalhados ({descontos.length})</h3>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-gray-200">
                          <th className="text-left py-2 px-3 text-gray-700 font-medium">Cupom</th>
                          <th className="text-left py-2 px-3 text-gray-700 font-medium">Operador</th>
                          <th className="text-left py-2 px-3 text-gray-700 font-medium">Produto</th>
                          <th className="text-right py-2 px-3 text-gray-700 font-medium">Desconto</th>
                          <th className="text-left py-2 px-3 text-gray-700 font-medium">Motivo</th>
                          <th className="text-left py-2 px-3 text-gray-700 font-medium">Autorizado por</th>
                        </tr>
                      </thead>
                      <tbody>
                        {descontos.slice(0, 20).map((desc, idx) => (
                          <tr key={idx} className="border-b border-gray-200 hover:bg-gray-50 transition">
                            <td className="py-2 px-3 text-gray-700">{desc.cupom}</td>
                            <td className="py-2 px-3 text-gray-700">{desc.operadorNome}</td>
                            <td className="py-2 px-3 text-gray-700">{desc.descProduto}</td>
                            <td className="text-right py-2 px-3 text-yellow-600 font-semibold">{formatCurrency(desc.desconto)}</td>
                            <td className="py-2 px-3 text-gray-700">{desc.motivoDescontoDesc || `Codigo ${desc.motivoDesconto}`}</td>
                            <td className="py-2 px-3 text-gray-700">{desc.autorizadorDescontoNome || `Codigo ${desc.autorizadorDesconto}`}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {descontos.length > 20 && (
                      <p className="text-gray-500 text-sm mt-4 text-center">
                        Mostrando 20 de {descontos.length} descontos
                      </p>
                    )}
                  </div>
                </div>
              )}

              {/* Tabela de Devolucoes Detalhadas */}
              {devolucoes.length > 0 && (
                <div className="bg-white p-6 rounded-lg shadow">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Devolucoes Detalhadas ({devolucoes.length})</h3>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-gray-200">
                          <th className="text-left py-2 px-3 text-gray-700 font-medium">Cupom</th>
                          <th className="text-left py-2 px-3 text-gray-700 font-medium">Operador</th>
                          <th className="text-left py-2 px-3 text-gray-700 font-medium">Produto</th>
                          <th className="text-right py-2 px-3 text-gray-700 font-medium">Quantidade</th>
                          <th className="text-right py-2 px-3 text-gray-700 font-medium">Valor</th>
                          <th className="text-left py-2 px-3 text-gray-700 font-medium">Data/Hora</th>
                        </tr>
                      </thead>
                      <tbody>
                        {devolucoes.slice(0, 20).map((dev, idx) => (
                          <tr key={idx} className="border-b border-gray-200 hover:bg-gray-50 transition">
                            <td className="py-2 px-3 text-gray-700">{dev.cupom}</td>
                            <td className="py-2 px-3 text-gray-700">{dev.operadorNome}</td>
                            <td className="py-2 px-3 text-gray-700">{dev.descProduto}</td>
                            <td className="text-right py-2 px-3 text-red-600">{dev.quantidade}</td>
                            <td className="text-right py-2 px-3 text-red-600 font-semibold">{formatCurrency(dev.valorTotal)}</td>
                            <td className="py-2 px-3 text-gray-700">{new Date(dev.dataHora).toLocaleString('pt-BR')}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {devolucoes.length > 20 && (
                      <p className="text-gray-500 text-sm mt-4 text-center">
                        Mostrando 20 de {devolucoes.length} devolucoes
                      </p>
                    )}
                  </div>
                </div>
              )}
            </>
          )}

          {/* Estado vazio */}
          {!loading && !resumo && !error && (
            <div className="bg-white p-12 rounded-lg shadow text-center">
              <svg className="w-16 h-16 mx-auto text-gray-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
              <p className="text-gray-600">Selecione o periodo e clique em Buscar para visualizar os dados</p>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
