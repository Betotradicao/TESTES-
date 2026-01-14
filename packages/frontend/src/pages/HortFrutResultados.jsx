import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Layout from '../components/Layout';
import { api } from '../utils/api';

export default function HortFrutResultados() {
  const navigate = useNavigate();
  const [conferences, setConferences] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [selectedConference, setSelectedConference] = useState(null);

  useEffect(() => {
    // Definir período padrão (últimos 30 dias)
    const end = new Date();
    const start = new Date();
    start.setDate(start.getDate() - 30);

    setStartDate(start.toISOString().split('T')[0]);
    setEndDate(end.toISOString().split('T')[0]);

    loadConferences();
  }, []);

  const loadConferences = async () => {
    try {
      setLoading(true);
      let url = '/hortfrut/conferences';
      const params = new URLSearchParams();

      if (startDate) params.append('startDate', startDate);
      if (endDate) params.append('endDate', endDate);
      if (statusFilter) params.append('status', statusFilter);

      if (params.toString()) {
        url += '?' + params.toString();
      }

      const response = await api.get(url);
      setConferences(response.data || []);
    } catch (err) {
      console.error('Erro ao carregar conferências:', err);
      setError('Erro ao carregar conferências');
    } finally {
      setLoading(false);
    }
  };

  const handleFilter = () => {
    loadConferences();
  };

  const handleViewDetails = async (conf) => {
    try {
      const response = await api.get(`/hortfrut/conferences/${conf.id}`);
      setSelectedConference(response.data);
    } catch (err) {
      console.error('Erro ao carregar detalhes:', err);
      setError('Erro ao carregar detalhes da conferência');
    }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'pending':
        return <span className="px-2 py-1 text-xs bg-yellow-100 text-yellow-800 rounded-full">Pendente</span>;
      case 'in_progress':
        return <span className="px-2 py-1 text-xs bg-blue-100 text-blue-800 rounded-full">Em Andamento</span>;
      case 'completed':
        return <span className="px-2 py-1 text-xs bg-green-100 text-green-800 rounded-full">Finalizada</span>;
      default:
        return <span className="px-2 py-1 text-xs bg-gray-100 text-gray-800 rounded-full">{status}</span>;
    }
  };

  const getQualityBadge = (quality) => {
    switch (quality) {
      case 'good':
        return <span className="text-green-600">🟢 Boa</span>;
      case 'regular':
        return <span className="text-yellow-600">🟡 Regular</span>;
      case 'bad':
        return <span className="text-red-600">🔴 Ruim</span>;
      default:
        return <span className="text-gray-400">-</span>;
    }
  };

  // Calcular totais gerais
  const totals = conferences.reduce((acc, conf) => {
    acc.totalCost += parseFloat(conf.totalCost || 0);
    acc.totalWeight += parseFloat(conf.totalActualWeight || 0);
    return acc;
  }, { totalCost: 0, totalWeight: 0 });

  return (
    <Layout title="Resultados HortFruti">
      <div className="p-4 lg:p-8">
        {/* Card com Gradiente Laranja */}
        <div className="bg-gradient-to-br from-orange-500 to-red-600 rounded-lg shadow-lg p-6 mb-8 text-white">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-2xl lg:text-3xl font-bold">📊 Resultados HortFruti</h1>
            <div className="bg-white/20 backdrop-blur-sm rounded-full p-3">
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/>
              </svg>
            </div>
          </div>
          <p className="text-white/90">
            Acompanhe os resultados das conferências de HortFruti
          </p>
        </div>

        {error && (
          <div className="mb-4 p-4 bg-red-100 border border-red-400 text-red-700 rounded">
            {error}
          </div>
        )}

        {/* Filtros */}
        <div className="bg-white rounded-lg shadow-md p-4 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Data Inicial:</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Data Final:</label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Status:</label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500"
              >
                <option value="">Todos</option>
                <option value="pending">Pendente</option>
                <option value="in_progress">Em Andamento</option>
                <option value="completed">Finalizada</option>
              </select>
            </div>
            <div className="flex items-end">
              <button
                onClick={handleFilter}
                className="w-full px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700"
              >
                🔍 Filtrar
              </button>
            </div>
          </div>
        </div>

        {/* Cards de resumo */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="bg-white rounded-lg shadow-md p-4">
            <p className="text-sm text-gray-500">Total de Conferências</p>
            <p className="text-3xl font-bold text-gray-800">{conferences.length}</p>
          </div>
          <div className="bg-white rounded-lg shadow-md p-4">
            <p className="text-sm text-gray-500">Peso Total Conferido</p>
            <p className="text-3xl font-bold text-blue-600">{totals.totalWeight.toFixed(2)} kg</p>
          </div>
          <div className="bg-white rounded-lg shadow-md p-4">
            <p className="text-sm text-gray-500">Custo Total</p>
            <p className="text-3xl font-bold text-green-600">R$ {totals.totalCost.toFixed(2)}</p>
          </div>
        </div>

        {/* Lista de conferências */}
        <div className="bg-white rounded-lg shadow-md overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Data</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Fornecedor</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">NF</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Status</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Peso Total</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Custo Total</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {loading ? (
                  <tr>
                    <td colSpan="7" className="px-4 py-8 text-center text-gray-500">
                      Carregando...
                    </td>
                  </tr>
                ) : conferences.length === 0 ? (
                  <tr>
                    <td colSpan="7" className="px-4 py-8 text-center text-gray-500">
                      Nenhuma conferência encontrada
                    </td>
                  </tr>
                ) : (
                  conferences.map((conf) => (
                    <tr key={conf.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-sm text-gray-900">
                        {new Date(conf.conferenceDate).toLocaleDateString('pt-BR')}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-700">
                        {conf.supplierName || '-'}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-700">
                        {conf.invoiceNumber || '-'}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {getStatusBadge(conf.status)}
                      </td>
                      <td className="px-4 py-3 text-sm text-right text-gray-700">
                        {conf.totalActualWeight ? `${parseFloat(conf.totalActualWeight).toFixed(2)} kg` : '-'}
                      </td>
                      <td className="px-4 py-3 text-sm text-right font-semibold text-green-700">
                        {conf.totalCost ? `R$ ${parseFloat(conf.totalCost).toFixed(2)}` : '-'}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <div className="flex justify-center gap-2">
                          <button
                            onClick={() => handleViewDetails(conf)}
                            className="text-blue-600 hover:text-blue-800 text-sm"
                            title="Ver detalhes"
                          >
                            👁️
                          </button>
                          <button
                            onClick={() => navigate(`/hortfrut-conferencia/${conf.id}`)}
                            className="text-orange-600 hover:text-orange-800 text-sm"
                            title="Abrir conferência"
                          >
                            📋
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Modal de detalhes */}
        {selectedConference && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
              <div className="bg-gradient-to-r from-orange-500 to-red-600 text-white p-4 rounded-t-lg">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-bold">
                      Conferência {new Date(selectedConference.conferenceDate).toLocaleDateString('pt-BR')}
                    </h3>
                    <p className="text-sm text-white/80">
                      {selectedConference.supplierName || 'Sem fornecedor'}
                      {selectedConference.invoiceNumber && ` | NF: ${selectedConference.invoiceNumber}`}
                    </p>
                  </div>
                  <button
                    onClick={() => setSelectedConference(null)}
                    className="text-white hover:text-white/80"
                  >
                    ✕
                  </button>
                </div>
              </div>

              <div className="p-6">
                {/* Resumo da conferência */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                  <div className="bg-gray-50 rounded-lg p-3">
                    <p className="text-xs text-gray-500">Total de Itens</p>
                    <p className="text-xl font-bold text-gray-800">
                      {selectedConference.items?.length || 0}
                    </p>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-3">
                    <p className="text-xs text-gray-500">Peso Total</p>
                    <p className="text-xl font-bold text-blue-600">
                      {selectedConference.totalActualWeight
                        ? `${parseFloat(selectedConference.totalActualWeight).toFixed(2)} kg`
                        : '-'}
                    </p>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-3">
                    <p className="text-xs text-gray-500">Custo Total</p>
                    <p className="text-xl font-bold text-green-600">
                      {selectedConference.totalCost
                        ? `R$ ${parseFloat(selectedConference.totalCost).toFixed(2)}`
                        : '-'}
                    </p>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-3">
                    <p className="text-xs text-gray-500">Status</p>
                    <div className="mt-1">{getStatusBadge(selectedConference.status)}</div>
                  </div>
                </div>

                {/* Lista de itens */}
                <h4 className="font-semibold text-gray-800 mb-3">📦 Itens Conferidos</h4>
                <div className="overflow-x-auto border border-gray-200 rounded-lg">
                  <table className="min-w-full divide-y divide-gray-200 text-sm">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Produto</th>
                        <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">Custo Ant.</th>
                        <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">Novo Custo</th>
                        <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">Preço Sug.</th>
                        <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">Margem Manter</th>
                        <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">Peso Líq.</th>
                        <th className="px-3 py-2 text-center text-xs font-medium text-gray-500 uppercase">Qualidade</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {selectedConference.items?.map((item) => (
                        <tr key={item.id} className={item.checked ? 'bg-green-50' : ''}>
                          <td className="px-3 py-2">
                            <p className="font-medium text-gray-900">{item.productName}</p>
                            <p className="text-xs text-gray-500">{item.barcode || '-'}</p>
                          </td>
                          <td className="px-3 py-2 text-right text-gray-600">
                            {item.currentCost ? `R$ ${parseFloat(item.currentCost).toFixed(2)}` : '-'}
                          </td>
                          <td className="px-3 py-2 text-right font-semibold text-orange-700">
                            {item.newCost ? `R$ ${parseFloat(item.newCost).toFixed(2)}` : '-'}
                          </td>
                          <td className="px-3 py-2 text-right font-semibold text-green-700">
                            {item.suggestedPrice ? `R$ ${parseFloat(item.suggestedPrice).toFixed(2)}` : '-'}
                          </td>
                          <td className="px-3 py-2 text-right">
                            {item.marginIfKeepPrice !== null && item.marginIfKeepPrice !== undefined ? (
                              <span className={`font-semibold ${
                                parseFloat(item.marginIfKeepPrice) < 0 ? 'text-red-600' :
                                parseFloat(item.marginIfKeepPrice) < 10 ? 'text-yellow-600' :
                                'text-green-600'
                              }`}>
                                {parseFloat(item.marginIfKeepPrice).toFixed(1)}%
                              </span>
                            ) : '-'}
                          </td>
                          <td className="px-3 py-2 text-right text-gray-700">
                            {item.netWeight ? `${parseFloat(item.netWeight).toFixed(3)} kg` : '-'}
                          </td>
                          <td className="px-3 py-2 text-center">
                            {getQualityBadge(item.quality)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Botões */}
                <div className="flex justify-end gap-3 mt-6 pt-4 border-t">
                  <button
                    onClick={() => setSelectedConference(null)}
                    className="px-6 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
                  >
                    Fechar
                  </button>
                  <button
                    onClick={() => {
                      setSelectedConference(null);
                      navigate(`/hortfrut-conferencia/${selectedConference.id}`);
                    }}
                    className="px-6 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700"
                  >
                    📋 Abrir Conferência
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
