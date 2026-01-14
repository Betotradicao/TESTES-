import { useState, useEffect } from 'react';
import { api } from '../../utils/api';

export default function HortFrutBoxesTab() {
  const [boxes, setBoxes] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [editingBox, setEditingBox] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    weight: ''
  });

  useEffect(() => {
    loadBoxes();
  }, []);

  const loadBoxes = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const response = await api.get('/hortfrut/boxes');
      setBoxes(response.data || []);
    } catch (err) {
      setError('Erro ao carregar tipos de caixa');
      console.error('Load boxes error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingBox) {
        await api.put(`/hortfrut/boxes/${editingBox.id}`, formData);
      } else {
        await api.post('/hortfrut/boxes', formData);
      }
      await loadBoxes();
      resetForm();
    } catch (err) {
      console.error('Save box error:', err);
      alert('Erro ao salvar tipo de caixa');
    }
  };

  const handleEdit = (box) => {
    setEditingBox(box);
    setFormData({
      name: box.name,
      description: box.description || '',
      weight: box.weight.toString()
    });
    setShowForm(true);
  };

  const handleToggle = async (box) => {
    try {
      await api.put(`/hortfrut/boxes/${box.id}`, { active: !box.active });
      await loadBoxes();
    } catch (err) {
      console.error('Toggle box error:', err);
      alert('Erro ao alterar status');
    }
  };

  const handleDelete = async (box) => {
    if (!confirm(`Deseja excluir "${box.name}"?`)) return;
    try {
      await api.delete(`/hortfrut/boxes/${box.id}`);
      await loadBoxes();
    } catch (err) {
      console.error('Delete box error:', err);
      alert('Erro ao excluir. Pode estar em uso em alguma conferência.');
    }
  };

  const resetForm = () => {
    setShowForm(false);
    setEditingBox(null);
    setFormData({ name: '', description: '', weight: '' });
  };

  if (isLoading) {
    return (
      <div className="text-center py-8">
        <p className="text-gray-500">Carregando tipos de caixa...</p>
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
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-4">
        <div>
          <h2 className="text-xl font-semibold">Tipos de Caixa - HortFrut</h2>
          <p className="text-sm text-gray-500">Cadastre os tipos de caixa e seus pesos para desconto na conferência</p>
        </div>
        {!showForm && (
          <button
            onClick={() => setShowForm(true)}
            className="w-full sm:w-auto py-2 sm:py-3 px-3 sm:px-4 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 transition-colors"
          >
            + Nova Caixa
          </button>
        )}
      </div>

      {showForm && (
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-4">
          <h3 className="font-medium mb-3">{editingBox ? 'Editar Caixa' : 'Nova Caixa'}</h3>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Nome *
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Ex: Caixa Plástico Grande"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-green-500 focus:border-green-500"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Peso (kg) *
                </label>
                <input
                  type="number"
                  step="0.001"
                  min="0"
                  value={formData.weight}
                  onChange={(e) => setFormData({ ...formData, weight: e.target.value })}
                  placeholder="Ex: 1.500"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-green-500 focus:border-green-500"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Descrição
                </label>
                <input
                  type="text"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Ex: Caixa padrão para frutas"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-green-500 focus:border-green-500"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={resetForm}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-md hover:bg-green-700"
              >
                {editingBox ? 'Salvar' : 'Cadastrar'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Lista de caixas */}
      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Nome</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Peso (kg)</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Descrição</th>
              <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Status</th>
              <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {boxes.length === 0 ? (
              <tr>
                <td colSpan="5" className="px-4 py-8 text-center text-gray-500">
                  Nenhum tipo de caixa cadastrado
                </td>
              </tr>
            ) : (
              boxes.map((box) => (
                <tr key={box.id} className={!box.active ? 'bg-gray-50 opacity-60' : ''}>
                  <td className="px-4 py-3 text-sm font-medium text-gray-900">{box.name}</td>
                  <td className="px-4 py-3 text-sm text-gray-700">
                    {parseFloat(box.weight).toFixed(3)} kg
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-500">{box.description || '-'}</td>
                  <td className="px-4 py-3 text-center">
                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                      box.active
                        ? 'bg-green-100 text-green-800'
                        : 'bg-gray-100 text-gray-800'
                    }`}>
                      {box.active ? 'Ativo' : 'Inativo'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <div className="flex justify-center gap-2">
                      <button
                        onClick={() => handleEdit(box)}
                        className="text-blue-600 hover:text-blue-800 text-sm"
                        title="Editar"
                      >
                        ✏️
                      </button>
                      <button
                        onClick={() => handleToggle(box)}
                        className="text-yellow-600 hover:text-yellow-800 text-sm"
                        title={box.active ? 'Desativar' : 'Ativar'}
                      >
                        {box.active ? '🚫' : '✅'}
                      </button>
                      <button
                        onClick={() => handleDelete(box)}
                        className="text-red-600 hover:text-red-800 text-sm"
                        title="Excluir"
                      >
                        🗑️
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
  );
}
