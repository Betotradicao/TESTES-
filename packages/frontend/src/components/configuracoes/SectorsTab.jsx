import { useState, useEffect } from 'react';
import toast, { Toaster } from 'react-hot-toast';
import SectorForm from './SectorForm';
import SectorsList from './SectorsList';
import { fetchSectors, createSector, updateSector, toggleSectorStatus } from '../../services/sectors.service';
import { useLoja } from '../../contexts/LojaContext';

export default function SectorsTab() {
  const { lojaSelecionada, lojas } = useLoja();
  const [sectors, setSectors] = useState([]);
  const [editingSector, setEditingSector] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    loadSectors();
  }, [lojaSelecionada]);

  const loadSectors = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const data = await fetchSectors(lojaSelecionada);
      setSectors(data || []);
    } catch (err) {
      setError('Erro ao carregar setores');
      console.error('Load sectors error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async (sectorData) => {
    try {
      if (editingSector) {
        await updateSector(editingSector.id, sectorData);
        toast.success('Setor atualizado com sucesso!');
      } else {
        // cod_loja já vem do formulário
        await createSector(sectorData);
        toast.success('Setor criado com sucesso!');
      }
      await loadSectors();
      setShowForm(false);
      setEditingSector(null);
    } catch (err) {
      console.error('Save sector error:', err);
      toast.error('Erro ao salvar setor');
      throw err;
    }
  };

  const handleEdit = (sector) => {
    setEditingSector(sector);
    setShowForm(true);
  };

  const handleToggle = async (id) => {
    try {
      await toggleSectorStatus(id);
      await loadSectors();
      toast.success('Status alterado com sucesso!');
    } catch (err) {
      console.error('Toggle sector error:', err);
      toast.error('Erro ao alterar status do setor');
    }
  };

  const handleCancel = () => {
    setShowForm(false);
    setEditingSector(null);
  };

  const handleNewSector = () => {
    setEditingSector(null);
    setShowForm(true);
  };

  if (isLoading) {
    return (
      <div className="text-center py-8">
        <p className="text-gray-500">Carregando setores...</p>
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
      <Toaster />

      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-4">
        <h2 className="text-xl font-semibold">Gestão de Setores</h2>
        {!showForm && (
          <button
            onClick={handleNewSector}
            className="w-full sm:w-auto py-2 sm:py-3 px-3 sm:px-4 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-orange-500 hover:bg-orange-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-orange-500 transition-colors"
          >
            + Novo Setor
          </button>
        )}
      </div>

      {showForm && (
        <SectorForm
          sector={editingSector}
          onSave={handleSave}
          onCancel={handleCancel}
        />
      )}

      <SectorsList
        sectors={sectors}
        onEdit={handleEdit}
        onToggle={handleToggle}
        lojas={lojas}
      />
    </div>
  );
}
