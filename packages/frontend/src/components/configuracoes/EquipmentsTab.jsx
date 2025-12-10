import { useState, useEffect } from 'react';
import EquipmentForm from './EquipmentForm';
import EquipmentsList from './EquipmentsList';
import { fetchEquipments, updateEquipment, toggleEquipmentStatus } from '../../services/equipments.service';
import equipmentSessionsService from '../../services/equipment-sessions.service';

export default function EquipmentsTab() {
  const [equipments, setEquipments] = useState([]);
  const [activeSessions, setActiveSessions] = useState([]);
  const [editingEquipment, setEditingEquipment] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    loadEquipments();
    loadActiveSessions();

    // Reload active sessions every 10 seconds
    const interval = setInterval(loadActiveSessions, 10000);
    return () => clearInterval(interval);
  }, []);

  const loadEquipments = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const data = await fetchEquipments();
      setEquipments(data || []);
    } catch (err) {
      setError('Erro ao carregar equipamentos');
      console.error('Load equipments error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const loadActiveSessions = async () => {
    try {
      const response = await equipmentSessionsService.getAllActiveSessions();
      setActiveSessions(response.data || []);
    } catch (err) {
      console.error('Load active sessions error:', err);
      // Don't show error to user, just log it
    }
  };

  const handleSave = async (equipmentData) => {
    try {
      if (editingEquipment) {
        const payload = {
          ...equipmentData,
          sector_id: equipmentData.sector_id || null
        };
        await updateEquipment(editingEquipment.id, payload);
      }
      await loadEquipments();
      setShowForm(false);
      setEditingEquipment(null);
    } catch (err) {
      console.error('Save equipment error:', err);
      throw err;
    }
  };

  const handleEdit = (equipment) => {
    setEditingEquipment(equipment);
    setShowForm(true);
  };

  const handleToggle = async (id) => {
    try {
      await toggleEquipmentStatus(id);
      await loadEquipments();
    } catch (err) {
      console.error('Toggle equipment error:', err);
      alert('Erro ao alterar status do equipamento');
    }
  };

  const handleCancel = () => {
    setShowForm(false);
    setEditingEquipment(null);
  };

  if (isLoading) {
    return (
      <div className="text-center py-8">
        <p className="text-gray-500">Carregando equipamentos...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded p-4 text-red-800">
        {error}
      </div>
    );
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-semibold">Gestão de Equipamentos</h2>
      </div>

      {showForm && (
        <EquipmentForm
          equipment={editingEquipment}
          onSave={handleSave}
          onCancel={handleCancel}
        />
      )}

      <EquipmentsList
        equipments={equipments}
        activeSessions={activeSessions}
        onEdit={handleEdit}
        onToggle={handleToggle}
      />
    </div>
  );
}
