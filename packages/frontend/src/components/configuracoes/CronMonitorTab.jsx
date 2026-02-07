import { useState, useEffect } from 'react';
import api from '../../services/api';

export default function CronMonitorTab() {
  const [cronStatus, setCronStatus] = useState(null);
  const [barcodeStatus, setBarcodeStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [restarting, setRestarting] = useState(false);
  const [lastUpdate, setLastUpdate] = useState(new Date());

  // Estados para logs de webhook
  const [webhookLogs, setWebhookLogs] = useState([]);
  const [logsSummary, setLogsSummary] = useState({ ok: 0, rejected: 0, error: 0 });
  const [logsPage, setLogsPage] = useState(1);
  const [logsTotalPages, setLogsTotalPages] = useState(1);
  const [logsFilter, setLogsFilter] = useState('all');
  const [logsLoading, setLogsLoading] = useState(false);

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

  const fetchWebhookLogs = async (page = 1, filter = 'all') => {
    try {
      setLogsLoading(true);
      const response = await api.get('/webhook/logs', {
        params: { page, limit: 20, status: filter }
      });
      setWebhookLogs(response.data.logs);
      setLogsSummary(response.data.summary);
      setLogsTotalPages(response.data.pagination.totalPages);
      setLogsPage(page);
    } catch (error) {
      console.error('Erro ao buscar logs de webhook:', error);
    } finally {
      setLogsLoading(false);
    }
  };

  const forceSyncSells = async () => {
    try {
      setRestarting(true);
      await api.post('/cron/force-sync');
      alert('✅ Sincronização forçada iniciada!');

      // Aguardar 5 segundos e atualizar status
      setTimeout(() => {
        fetchStatus();
      }, 5000);
    } catch (error) {
      console.error('Erro ao forçar sync:', error);
      alert('❌ Erro ao forçar sincronização: ' + (error.response?.data?.error || error.message));
    } finally {
      setRestarting(false);
    }
  };

  useEffect(() => {
    fetchStatus();
    fetchWebhookLogs();

    // Atualizar a cada 30 segundos
    const interval = setInterval(() => {
      fetchStatus();
      fetchWebhookLogs(logsPage, logsFilter);
    }, 30000);

    return () => clearInterval(interval);
  }, []);

  const handleLogsFilterChange = (filter) => {
    setLogsFilter(filter);
    fetchWebhookLogs(1, filter);
  };

  const handleLogsPageChange = (newPage) => {
    if (newPage >= 1 && newPage <= logsTotalPages) {
      fetchWebhookLogs(newPage, logsFilter);
    }
  };

  const getReasonLabel = (reason) => {
    const labels = {
      success: 'Sucesso',
      ean_invalid: 'EAN Inválido',
      product_not_found: 'Produto não encontrado',
      equipment_disabled: 'Equipamento desabilitado',
      employee_not_found: 'Colaborador não encontrado',
      cancellation_limit: 'Limite de cancelamento',
      internal_error: 'Erro interno',
      employee_login: 'Login de colaborador'
    };
    return labels[reason] || reason;
  };

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
        <div className="flex gap-2">
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
          <button
            onClick={forceSyncSells}
            disabled={restarting}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center"
          >
            <svg className={`w-4 h-4 mr-2 ${restarting ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            {restarting ? 'Sincronizando...' : 'Forçar Sync'}
          </button>
        </div>
      </div>

      {/* Cron de Verificação */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <h3 className="text-xl font-semibold text-gray-900 mb-4 flex items-center">
          <svg className="w-6 h-6 mr-2 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          Cron de Verificação (1 em 1 minuto)
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
                  {barcodeStatus.lastBipTime ? new Date(barcodeStatus.lastBipTime).toISOString().substring(11, 19) : 'N/A'}
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

      {/* Logs de Webhook */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <h3 className="text-xl font-semibold text-gray-900 mb-4 flex items-center">
          <svg className="w-6 h-6 mr-2 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
          </svg>
          Logs de Webhook (Hoje)
        </h3>

        {/* Resumo */}
        <div className="grid grid-cols-3 gap-4 mb-4">
          <div className="p-3 bg-green-50 rounded-lg text-center cursor-pointer hover:bg-green-100" onClick={() => handleLogsFilterChange('ok')}>
            <div className="text-sm text-green-600 font-medium">OK</div>
            <div className="text-2xl font-bold text-green-900">{logsSummary.ok}</div>
          </div>
          <div className="p-3 bg-red-50 rounded-lg text-center cursor-pointer hover:bg-red-100" onClick={() => handleLogsFilterChange('rejected')}>
            <div className="text-sm text-red-600 font-medium">Rejeitados</div>
            <div className="text-2xl font-bold text-red-900">{logsSummary.rejected}</div>
          </div>
          <div className="p-3 bg-yellow-50 rounded-lg text-center cursor-pointer hover:bg-yellow-100" onClick={() => handleLogsFilterChange('error')}>
            <div className="text-sm text-yellow-600 font-medium">Erros</div>
            <div className="text-2xl font-bold text-yellow-900">{logsSummary.error}</div>
          </div>
        </div>

        {/* Filtros */}
        <div className="flex gap-2 mb-4">
          <button
            onClick={() => handleLogsFilterChange('all')}
            className={`px-3 py-1 rounded-full text-sm ${logsFilter === 'all' ? 'bg-orange-600 text-white' : 'bg-gray-200 text-gray-700'}`}
          >
            Todos
          </button>
          <button
            onClick={() => handleLogsFilterChange('ok')}
            className={`px-3 py-1 rounded-full text-sm ${logsFilter === 'ok' ? 'bg-green-600 text-white' : 'bg-gray-200 text-gray-700'}`}
          >
            OK
          </button>
          <button
            onClick={() => handleLogsFilterChange('rejected')}
            className={`px-3 py-1 rounded-full text-sm ${logsFilter === 'rejected' ? 'bg-red-600 text-white' : 'bg-gray-200 text-gray-700'}`}
          >
            Rejeitados
          </button>
          <button
            onClick={() => handleLogsFilterChange('error')}
            className={`px-3 py-1 rounded-full text-sm ${logsFilter === 'error' ? 'bg-yellow-600 text-white' : 'bg-gray-200 text-gray-700'}`}
          >
            Erros
          </button>
          <button
            onClick={() => fetchWebhookLogs(logsPage, logsFilter)}
            className="ml-auto px-3 py-1 rounded bg-gray-200 text-gray-700 hover:bg-gray-300 text-sm flex items-center"
          >
            <svg className={`w-4 h-4 mr-1 ${logsLoading ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Atualizar
          </button>
        </div>

        {/* Tabela de Logs */}
        {logsLoading ? (
          <div className="text-center py-8">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-orange-600"></div>
          </div>
        ) : webhookLogs.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Hora</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Motivo</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">EAN/PLU</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Produto</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Equipamento</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Erro</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {webhookLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-gray-50">
                    <td className="px-3 py-2 text-sm text-gray-900">
                      {new Date(log.created_at).toLocaleTimeString()}
                    </td>
                    <td className="px-3 py-2">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                        log.status === 'ok' ? 'bg-green-100 text-green-800' :
                        log.status === 'rejected' ? 'bg-red-100 text-red-800' :
                        'bg-yellow-100 text-yellow-800'
                      }`}>
                        {log.status.toUpperCase()}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-sm text-gray-600">
                      {getReasonLabel(log.reason)}
                    </td>
                    <td className="px-3 py-2 text-sm font-mono text-gray-900">
                      {log.ean || log.plu || '-'}
                    </td>
                    <td className="px-3 py-2 text-sm text-gray-600 max-w-xs truncate" title={log.product_description}>
                      {log.product_description || log.employee_name || '-'}
                    </td>
                    <td className="px-3 py-2 text-sm text-gray-600">
                      {log.scanner_id ? `${log.scanner_id.slice(0, 8)}...` : '-'}
                    </td>
                    <td className="px-3 py-2 text-sm text-red-600 max-w-xs truncate" title={log.error_message}>
                      {log.error_message || '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center py-8 text-gray-500">
            Nenhum log encontrado
          </div>
        )}

        {/* Paginação */}
        {logsTotalPages > 1 && (
          <div className="flex justify-center items-center gap-2 mt-4">
            <button
              onClick={() => handleLogsPageChange(logsPage - 1)}
              disabled={logsPage === 1}
              className="px-3 py-1 rounded bg-gray-200 text-gray-700 disabled:opacity-50"
            >
              Anterior
            </button>
            <span className="text-sm text-gray-600">
              Página {logsPage} de {logsTotalPages}
            </span>
            <button
              onClick={() => handleLogsPageChange(logsPage + 1)}
              disabled={logsPage === logsTotalPages}
              className="px-3 py-1 rounded bg-gray-200 text-gray-700 disabled:opacity-50"
            >
              Próxima
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
