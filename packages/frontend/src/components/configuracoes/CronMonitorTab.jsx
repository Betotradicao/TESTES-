import { useState, useEffect } from 'react';
import api from '../../services/api';

export default function CronMonitorTab() {
  const [cronStatus, setCronStatus] = useState(null);
  const [barcodeStatus, setBarcodeStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState(new Date());

  const fetchStatus = async () => {
    try {
      setLoading(true);

      // Buscar status do cron
      const cronResponse = await api.get('/cron/status');
      setCronStatus(cronResponse.data);

      // Buscar status do barcode scanner
      const barcodeResponse = await api.get('/barcode/status');
      setBarcodeStatus(barcodeResponse.data);

      setLastUpdate(new Date());
    } catch (error) {
      console.error('Erro ao buscar status:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatus();

    // Atualizar a cada 30 segundos
    const interval = setInterval(fetchStatus, 30000);

    return () => clearInterval(interval);
  }, []);

  const getStatusColor = (status) => {
    if (!status) return 'bg-gray-100 text-gray-800';
    if (status === 'running' || status === 'active' || status === 'ok') return 'bg-green-100 text-green-800';
    if (status === 'warning') return 'bg-yellow-100 text-yellow-800';
    if (status === 'error' || status === 'stopped') return 'bg-red-100 text-red-800';
    return 'bg-gray-100 text-gray-800';
  };

  const getStatusIcon = (status) => {
    if (status === 'running' || status === 'active' || status === 'ok') {
      return (
        <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      );
    }
    if (status === 'warning') {
      return (
        <svg className="w-6 h-6 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
      );
    }
    return (
      <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    );
  };

  if (loading && !cronStatus && !barcodeStatus) {
    return (
      <div className="text-center py-12">
        <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-orange-600"></div>
        <p className="mt-4 text-gray-600">Carregando status...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Monitoramento de Serviços</h2>
          <p className="mt-1 text-sm text-gray-600">
            Acompanhe o status do cron de verificação e do barcode scanner
          </p>
          <div className="mt-2 flex items-center text-sm text-gray-500">
            <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Última atualização: {lastUpdate.toLocaleTimeString()}
          </div>
        </div>
        <button
          onClick={fetchStatus}
          disabled={loading}
          className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:opacity-50 flex items-center"
        >
          <svg className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          Atualizar
        </button>
      </div>

      {/* Cron de Verificação */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <h3 className="text-xl font-semibold text-gray-900 mb-4 flex items-center">
          <svg className="w-6 h-6 mr-2 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          Cron de Verificação (2 em 2 minutos)
        </h3>

        {cronStatus ? (
          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
              <div className="flex items-center">
                {getStatusIcon(cronStatus.status)}
                <span className="ml-3 font-medium">Status</span>
              </div>
              <span className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(cronStatus.status)}`}>
                {cronStatus.status?.toUpperCase() || 'DESCONHECIDO'}
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-4 bg-blue-50 rounded-lg">
                <div className="text-sm text-blue-600 font-medium">Última Execução</div>
                <div className="text-2xl font-bold text-blue-900 mt-1">
                  {cronStatus.lastRun ? new Date(cronStatus.lastRun).toLocaleTimeString() : 'N/A'}
                </div>
              </div>

              <div className="p-4 bg-green-50 rounded-lg">
                <div className="text-sm text-green-600 font-medium">Vendas Processadas</div>
                <div className="text-2xl font-bold text-green-900 mt-1">
                  {cronStatus.vendasProcessadas || 0}
                </div>
              </div>

              <div className="p-4 bg-purple-50 rounded-lg">
                <div className="text-sm text-purple-600 font-medium">Bipagens Verificadas</div>
                <div className="text-2xl font-bold text-purple-900 mt-1">
                  {cronStatus.bipagensVerificadas || 0}
                </div>
              </div>
            </div>

            {cronStatus.lastError && (
              <div className="p-4 bg-red-50 border-l-4 border-red-500 rounded">
                <div className="flex">
                  <svg className="w-5 h-5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <div className="ml-3">
                    <h3 className="text-sm font-medium text-red-800">Último Erro</h3>
                    <p className="mt-1 text-sm text-red-700">{cronStatus.lastError}</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="text-center py-8 text-gray-500">
            Nenhuma informação disponível
          </div>
        )}
      </div>

      {/* Barcode Scanner */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <h3 className="text-xl font-semibold text-gray-900 mb-4 flex items-center">
          <svg className="w-6 h-6 mr-2 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
          </svg>
          Status do Barcode Scanner
        </h3>

        {barcodeStatus ? (
          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
              <div className="flex items-center">
                {getStatusIcon(barcodeStatus.status)}
                <span className="ml-3 font-medium">Conexão</span>
              </div>
              <span className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(barcodeStatus.status)}`}>
                {barcodeStatus.status?.toUpperCase() || 'DESCONHECIDO'}
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-4 bg-indigo-50 rounded-lg">
                <div className="text-sm text-indigo-600 font-medium">Última Bipagem</div>
                <div className="text-2xl font-bold text-indigo-900 mt-1">
                  {barcodeStatus.lastBipTime ? new Date(barcodeStatus.lastBipTime).toLocaleTimeString() : 'N/A'}
                </div>
              </div>

              <div className="p-4 bg-orange-50 rounded-lg">
                <div className="text-sm text-orange-600 font-medium">Total Hoje</div>
                <div className="text-2xl font-bold text-orange-900 mt-1">
                  {barcodeStatus.totalToday || 0}
                </div>
              </div>

              <div className="p-4 bg-teal-50 rounded-lg">
                <div className="text-sm text-teal-600 font-medium">Pendentes</div>
                <div className="text-2xl font-bold text-teal-900 mt-1">
                  {barcodeStatus.pendentes || 0}
                </div>
              </div>
            </div>

            {barcodeStatus.token && (
              <div className="p-4 bg-gray-50 rounded-lg">
                <div className="text-sm text-gray-600 font-medium mb-2">Token de Autenticação</div>
                <div className="font-mono text-xs bg-white p-3 rounded border border-gray-200 break-all">
                  {barcodeStatus.token}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="text-center py-8 text-gray-500">
            Nenhuma informação disponível
          </div>
        )}
      </div>
    </div>
  );
}
