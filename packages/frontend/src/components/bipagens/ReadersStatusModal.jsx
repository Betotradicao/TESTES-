import { useState, useEffect } from 'react';
import { api } from '../../utils/api';
import equipmentSessionsService from '../../services/equipment-sessions.service';
import ScannerGunIcon from '../icons/ScannerGunIcon';

export default function ReadersStatusModal({ onClose }) {
  const [equipments, setEquipments] = useState([]);
  const [activeSessions, setActiveSessions] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    loadData();

    // Auto-refresh a cada 10 segundos
    const interval = setInterval(() => {
      loadData(true); // silent reload
    }, 10000);

    // Cleanup ao desmontar
    return () => clearInterval(interval);
  }, []);

  const loadData = async (silent = false) => {
    try {
      if (!silent) setIsLoading(true);
      setError(null);

      // Buscar equipamentos e sessões ativas em paralelo
      const [equipmentsRes, sessionsRes] = await Promise.all([
        api.get('/equipments'),
        equipmentSessionsService.getAllActiveSessions()
      ]);

      setEquipments(equipmentsRes.data.data || []);
      setActiveSessions(sessionsRes.data || []);
    } catch (err) {
      console.error('Erro ao carregar dados dos leitores:', err);
      setError('Erro ao carregar status dos leitores');
    } finally {
      if (!silent) setIsLoading(false);
    }
  };

  // Helper para obter colaborador logado de um equipamento
  const getLoggedEmployee = (equipmentId) => {
    const session = activeSessions.find(s => s.equipment_id === equipmentId && s.active);
    return session?.employee || null;
  };

  // Ordenar: equipamentos com colaborador primeiro, depois por ID
  const sortedEquipments = [...equipments].sort((a, b) => {
    const aHasEmployee = !!getLoggedEmployee(a.id);
    const bHasEmployee = !!getLoggedEmployee(b.id);

    if (aHasEmployee && !bHasEmployee) return -1;
    if (!aHasEmployee && bHasEmployee) return 1;
    return a.id - b.id;
  });

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-6xl max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">
              Status dos Leitores
            </h2>
            <p className="text-sm text-gray-500 mt-1">
              Atualização automática a cada 10 segundos
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-2xl leading-none"
          >
            ×
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {isLoading ? (
            <div className="text-center py-8">
              <div className="inline-block w-8 h-8 border-4 border-orange-500 border-t-transparent rounded-full animate-spin"></div>
              <p className="text-gray-500 mt-2">Carregando...</p>
            </div>
          ) : error ? (
            <div className="bg-red-50 border border-red-200 rounded p-4 text-red-800">
              {error}
            </div>
          ) : sortedEquipments.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              Nenhum equipamento cadastrado.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {sortedEquipments.map(equipment => {
                const employee = getLoggedEmployee(equipment.id);
                const hasEmployee = !!employee;

                return (
                  <div
                    key={equipment.id}
                    className={`border rounded-lg p-4 transition ${
                      hasEmployee
                        ? 'border-green-200 bg-green-50'
                        : 'border-gray-200 bg-gray-50'
                    }`}
                  >
                    {/* Scanner Info */}
                    <div className="flex items-center gap-3 mb-3">
                      <div
                        className="w-12 h-12 rounded-full flex items-center justify-center text-white flex-shrink-0"
                        style={{ backgroundColor: equipment.color_hash }}
                      >
                        <ScannerGunIcon className="w-7 h-7" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-semibold text-gray-900">
                          Scaner {equipment.id}
                        </div>
                        {equipment.port_number && (
                          <div className="text-xs text-gray-500 font-semibold">
                            Porta {equipment.port_number}
                          </div>
                        )}
                        <div className="text-xs text-gray-600 truncate">
                          {equipment.machine_id}
                        </div>
                      </div>
                    </div>

                    {/* Equipment Description */}
                    {equipment.description && (
                      <div className="text-xs text-gray-600 mb-2">
                        {equipment.description}
                      </div>
                    )}

                    {/* Equipment Sector */}
                    <div className="mb-3">
                      {equipment.sector ? (
                        <span
                          className="inline-flex px-2 py-1 text-xs font-semibold rounded-full text-white"
                          style={{ backgroundColor: equipment.sector.color_hash }}
                        >
                          {equipment.sector.name}
                        </span>
                      ) : (
                        <span className="text-gray-400 text-xs">Sem setor</span>
                      )}
                    </div>

                    {/* Status Divider */}
                    <div className="border-t border-gray-200 my-3"></div>

                    {/* Employee Info */}
                    {hasEmployee ? (
                      <div>
                        <div className="text-xs font-medium text-gray-500 uppercase mb-2">
                          Colaborador Logado
                        </div>
                        <div className="flex items-center gap-2">
                          {employee.avatar ? (
                            <img
                              src={employee.avatar}
                              alt={employee.name}
                              className="w-10 h-10 rounded-full object-cover"
                            />
                          ) : (
                            <div className="w-10 h-10 rounded-full bg-blue-500 flex items-center justify-center text-white font-semibold">
                              {employee.name.charAt(0).toUpperCase()}
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-medium text-gray-900 truncate">
                              {employee.name}
                            </div>
                            {employee.sector && (
                              <div className="text-xs text-gray-600 truncate">
                                {employee.sector.name}
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="mt-2">
                          <span className="inline-flex items-center px-2 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-800">
                            <span className="w-2 h-2 bg-green-500 rounded-full mr-1.5"></span>
                            Logado
                          </span>
                        </div>
                      </div>
                    ) : (
                      <div>
                        <div className="text-xs font-medium text-gray-500 uppercase mb-2">
                          Status
                        </div>
                        <span className="inline-flex items-center px-2 py-1 text-xs font-semibold rounded-full bg-gray-100 text-gray-800">
                          <span className="w-2 h-2 bg-gray-400 rounded-full mr-1.5"></span>
                          Sem Login
                        </span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

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
