import { useState } from 'react';
import ScannerGunIcon from '../icons/ScannerGunIcon';
import EquipmentHistoryModal from './EquipmentHistoryModal';

export default function EquipmentsList({ equipments, activeSessions = [], onEdit, onToggle }) {
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [selectedEquipment, setSelectedEquipment] = useState(null);
  if (!equipments || equipments.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        Nenhum equipamento cadastrado.
      </div>
    );
  }

  // Helper function to get logged employee for equipment
  const getLoggedEmployee = (equipmentId) => {
    const session = activeSessions.find(s => s.equipment_id === equipmentId && s.active);
    return session?.employee || null;
  };

  const handleShowHistory = (equipment) => {
    setSelectedEquipment(equipment);
    setShowHistoryModal(true);
  };

  return (
    <>
      {showHistoryModal && selectedEquipment && (
        <EquipmentHistoryModal
          equipment={selectedEquipment}
          onClose={() => {
            setShowHistoryModal(false);
            setSelectedEquipment(null);
          }}
        />
      )}

    <div className="overflow-x-auto">
      <table className="min-w-full bg-white border border-gray-200 rounded-lg">
        <thead>
          <tr className="bg-gray-100">
            <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
              Scanner
            </th>
            <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
              Porta
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Computador
            </th>
            <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
              Loja
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Apelido
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Setor
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Colaborador Logado
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Status
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Ações
            </th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {equipments.map(equipment => (
            <tr key={equipment.id} className="hover:bg-gray-50">
              <td className="px-6 py-4 whitespace-nowrap">
                <div className="flex flex-col items-center gap-2">
                  <div
                    className="w-10 h-10 rounded-full flex items-center justify-center text-white"
                    style={{ backgroundColor: equipment.color_hash }}
                    title={equipment.color_hash}
                  >
                    <ScannerGunIcon className="w-6 h-6" />
                  </div>
                  <span className="text-xs text-gray-600 font-medium">
                    Scaner {equipment.id}
                  </span>
                </div>
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-center">
                <span className="text-sm text-gray-900 font-semibold">
                  {equipment.port_number || '-'}
                </span>
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 font-medium">
                {equipment.machine_id}
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-center">
                {equipment.cod_loja ? (
                  <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-blue-100 text-blue-800">
                    Loja {equipment.cod_loja}
                  </span>
                ) : (
                  <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-gray-100 text-gray-600">
                    Todas
                  </span>
                )}
              </td>
              <td className="px-6 py-4 text-sm text-gray-900">
                {equipment.loja_apelido || '-'}
              </td>
              <td className="px-6 py-4 whitespace-nowrap">
                {equipment.sector ? (
                  <span
                    className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full text-white"
                    style={{ backgroundColor: equipment.sector.color_hash }}
                  >
                    {equipment.sector.name}
                  </span>
                ) : (
                  <span className="text-gray-400 text-xs">Sem setor</span>
                )}
              </td>
              <td className="px-6 py-4 whitespace-nowrap">
                {(() => {
                  const employee = getLoggedEmployee(equipment.id);
                  if (!employee) {
                    return <span className="text-gray-400 text-xs">Nenhum</span>;
                  }

                  return (
                    <div className="flex items-center gap-2">
                      {employee.avatar ? (
                        <img
                          src={employee.avatar}
                          alt={employee.name}
                          className="w-8 h-8 rounded-full object-cover"
                        />
                      ) : (
                        <div className="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center text-white font-semibold text-sm">
                          {employee.name.charAt(0).toUpperCase()}
                        </div>
                      )}
                      <span className="text-sm text-gray-900">{employee.name}</span>
                    </div>
                  );
                })()}
              </td>
              <td className="px-6 py-4 whitespace-nowrap">
                <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                  equipment.active
                    ? 'bg-green-100 text-green-800'
                    : 'bg-red-100 text-red-800'
                }`}>
                  {equipment.active ? 'Ativo' : 'Inativo'}
                </span>
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => onEdit(equipment)}
                    className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-orange-100 text-orange-800 hover:bg-orange-200 transition"
                  >
                    Editar
                  </button>
                  <button
                    onClick={() => handleShowHistory(equipment)}
                    className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-blue-100 text-blue-800 hover:bg-blue-200 transition"
                  >
                    Histórico
                  </button>
                  <button
                    onClick={() => onToggle(equipment.id)}
                    className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full transition ${
                      equipment.active
                        ? 'bg-red-100 text-red-800 hover:bg-red-200'
                        : 'bg-green-100 text-green-800 hover:bg-green-200'
                    }`}
                  >
                    {equipment.active ? 'Desativar' : 'Ativar'}
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
    </>
  );
}
