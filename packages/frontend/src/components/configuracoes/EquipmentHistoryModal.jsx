import { useState, useEffect } from 'react';
import equipmentSessionsService from '../../services/equipment-sessions.service';
import Pagination from '../common/Pagination';

export default function EquipmentHistoryModal({ equipment, onClose }) {
  const [sessions, setSessions] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 5,
    total: 0,
    totalPages: 0,
    hasNextPage: false,
    hasPreviousPage: false
  });

  useEffect(() => {
    loadHistory();
  }, [equipment.id]);

  const loadHistory = async (page = 1) => {
    try {
      setIsLoading(true);
      setError(null);
      const response = await equipmentSessionsService.getSessionHistory(equipment.id, {
        page,
        limit: pagination.limit
      });
      setSessions(response.data || []);
      setPagination(response.pagination);
    } catch (err) {
      setError('Erro ao carregar histórico');
      console.error('Load history error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handlePageChange = (newPage) => {
    if (newPage >= 1 && newPage <= pagination.totalPages) {
      loadHistory(newPage);
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return '-';
    const date = new Date(dateString);
    return date.toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getDuration = (loginTime, logoutTime) => {
    if (!logoutTime) return 'Ativo';

    const login = new Date(loginTime);
    const logout = new Date(logoutTime);
    const diffMs = logout - login;
    const diffMins = Math.floor(diffMs / 60000);

    if (diffMins < 60) {
      return `${diffMins} min`;
    }

    const hours = Math.floor(diffMins / 60);
    const mins = diffMins % 60;
    return `${hours}h ${mins}min`;
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold text-gray-900">
                Histórico de Logins
              </h2>
              <p className="text-sm text-gray-500 mt-1">
                Scaner {equipment.id} - {equipment.machine_id}
              </p>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 text-2xl leading-none"
            >
              ×
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {isLoading ? (
            <div className="text-center py-8">
              <p className="text-gray-500">Carregando histórico...</p>
            </div>
          ) : error ? (
            <div className="bg-red-50 border border-red-200 rounded p-4 text-red-800 m-6">
              {error}
            </div>
          ) : sessions.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              Nenhum histórico de login encontrado.
            </div>
          ) : (
            <>
              {/* Tabela para Desktop */}
              <div className="hidden lg:block overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Colaborador
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Setor
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Login
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Logout
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Duração
                      </th>
                      <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Status
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {sessions.map((session) => (
                      <tr key={session.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center gap-2">
                            {session.employee?.avatar ? (
                              <img
                                src={session.employee.avatar}
                                alt={session.employee.name}
                                className="w-8 h-8 rounded-full object-cover"
                              />
                            ) : (
                              <div className="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center text-white font-semibold text-sm">
                                {session.employee?.name?.charAt(0).toUpperCase() || '?'}
                              </div>
                            )}
                            <span className="text-sm text-gray-900">
                              {session.employee?.name || 'Desconhecido'}
                            </span>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {session.employee?.sector ? (
                            <span
                              className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full text-white"
                              style={{ backgroundColor: session.employee.sector.color_hash }}
                            >
                              {session.employee.sector.name}
                            </span>
                          ) : (
                            <span className="text-gray-400 text-xs">Sem setor</span>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {formatDate(session.logged_in_at)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {formatDate(session.logged_out_at)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {getDuration(session.logged_in_at, session.logged_out_at)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-center">
                          <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                            session.active
                              ? 'bg-green-100 text-green-800'
                              : 'bg-gray-100 text-gray-800'
                          }`}>
                            {session.active ? 'Ativo' : 'Encerrado'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Cards para Mobile */}
              <div className="lg:hidden">
                {sessions.map((session) => (
                  <div key={session.id} className="border-b border-gray-200 p-3">
                    {/* Colaborador */}
                    <div className="flex items-center gap-1.5 mb-2 pb-2 border-b border-gray-100">
                      {session.employee?.avatar ? (
                        <img
                          src={session.employee.avatar}
                          alt={session.employee.name}
                          className="w-8 h-8 rounded-full object-cover"
                        />
                      ) : (
                        <div className="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center text-white font-semibold text-xs">
                          {session.employee?.name?.charAt(0).toUpperCase() || '?'}
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-medium text-gray-900 truncate">
                          {session.employee?.name || 'Desconhecido'}
                        </div>
                        {session.employee?.sector && (
                          <span
                            className="px-1.5 inline-flex text-[10px] leading-4 font-semibold rounded-full text-white mt-0.5"
                            style={{ backgroundColor: session.employee.sector.color_hash }}
                          >
                            {session.employee.sector.name}
                          </span>
                        )}
                      </div>
                      <span className={`px-1.5 py-0.5 inline-flex text-[10px] leading-4 font-semibold rounded-full ${
                        session.active
                          ? 'bg-green-100 text-green-800'
                          : 'bg-gray-100 text-gray-800'
                      }`}>
                        {session.active ? 'Ativo' : 'Encerrado'}
                      </span>
                    </div>

                    {/* Informações */}
                    <div className="space-y-1">
                      <div className="flex justify-between text-xs">
                        <span className="text-gray-500">Login:</span>
                        <span className="text-gray-900 font-medium">{formatDate(session.logged_in_at)}</span>
                      </div>
                      <div className="flex justify-between text-xs">
                        <span className="text-gray-500">Logout:</span>
                        <span className="text-gray-900 font-medium">{formatDate(session.logged_out_at)}</span>
                      </div>
                      <div className="flex justify-between text-xs">
                        <span className="text-gray-500">Duração:</span>
                        <span className="text-gray-900 font-medium">{getDuration(session.logged_in_at, session.logged_out_at)}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Paginação */}
        {!isLoading && !error && sessions.length > 0 && (
          <Pagination pagination={pagination} onPageChange={handlePageChange} />
        )}

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300 transition"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
}
