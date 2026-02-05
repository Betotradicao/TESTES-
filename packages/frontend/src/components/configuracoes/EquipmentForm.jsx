import { useState, useEffect } from 'react';
import ColorPicker from './ColorPicker';
import { fetchSectors } from '../../services/sectors.service';
import { fetchStores } from '../../services/companies.service';

export default function EquipmentForm({ equipment, onSave, onCancel }) {
  const [formData, setFormData] = useState({
    sector_id: '',
    color_hash: '#3B82F6',
    description: '',
    cod_loja: null
  });
  const [sectors, setSectors] = useState([]);
  const [stores, setStores] = useState([]);
  const [errors, setErrors] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoadingSectors, setIsLoadingSectors] = useState(true);
  const [isLoadingStores, setIsLoadingStores] = useState(true);

  useEffect(() => {
    loadSectors();
    loadStores();
  }, []);

  useEffect(() => {
    if (equipment) {
      setFormData({
        sector_id: equipment.sector_id ?? '',
        color_hash: equipment.color_hash || '#3B82F6',
        description: equipment.description || '',
        cod_loja: equipment.cod_loja ?? null
      });
    }
  }, [equipment]);

  const loadSectors = async () => {
    try {
      setIsLoadingSectors(true);
      const data = await fetchSectors(null, true); // Setores ativos de todas as lojas
      setSectors(data || []);
    } catch (error) {
      console.error('Error loading sectors:', error);
      setErrors(['Erro ao carregar setores']);
    } finally {
      setIsLoadingSectors(false);
    }
  };

  const loadStores = async () => {
    try {
      setIsLoadingStores(true);
      const data = await fetchStores();
      setStores(data || []);
    } catch (error) {
      console.error('Error loading stores:', error);
      // Não mostra erro, apenas deixa o dropdown vazio
    } finally {
      setIsLoadingStores(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrors([]);
    setIsSubmitting(true);

    try {
      await onSave(formData);
    } catch (error) {
      if (error.errors) {
        setErrors(error.errors);
      } else {
        setErrors([error.message || 'Erro ao salvar equipamento']);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 flex items-center justify-center z-50" style={{ backgroundColor: 'rgba(0, 0, 0, 0.4)' }}>
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4 max-h-[90vh] flex flex-col">
        {/* Header fixo */}
        <div className="p-6 border-b border-gray-200">
          <h3 className="text-lg font-semibold">Editar Equipamento</h3>
        </div>

        {/* Conteúdo com scroll */}
        <div className="flex-1 overflow-y-auto p-6">
          {errors.length > 0 && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded">
              <p className="text-red-800 font-semibold mb-1">Erros:</p>
              <ul className="list-disc list-inside text-red-700 text-sm">
                {errors.map((error, index) => (
                  <li key={index}>{error}</li>
                ))}
              </ul>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5" id="equipment-form">
            {/* Scanner Machine ID (somente leitura) */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Identificador real do scanner
              </label>
              <input
                type="text"
                value={equipment?.scanner_machine_id || ''}
                className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50 text-gray-600"
                readOnly
              />
            </div>

            {/* Machine ID (somente leitura) */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Identificador do computador
              </label>
              <input
                type="text"
                value={equipment?.machine_id || ''}
                className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50 text-gray-600"
                readOnly
              />
            </div>

            {/* Setor */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Setor (opcional)
              </label>
              {isLoadingSectors ? (
                <p className="text-sm text-gray-500">Carregando setores...</p>
              ) : (
                <select
                  value={formData.sector_id}
                  onChange={(e) => setFormData({ ...formData, sector_id: e.target.value ? parseInt(e.target.value) : '' })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
                >
                  <option value="">Nenhum setor</option>
                  {sectors.map(sector => (
                    <option key={sector.id} value={sector.id}>
                      {sector.name}
                    </option>
                  ))}
                </select>
              )}
            </div>

            {/* Loja */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Loja
              </label>
              {isLoadingStores ? (
                <p className="text-sm text-gray-500">Carregando lojas...</p>
              ) : (
                <select
                  value={formData.cod_loja === null ? '' : formData.cod_loja}
                  onChange={(e) => setFormData({ ...formData, cod_loja: e.target.value ? parseInt(e.target.value) : null })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
                >
                  <option value="">Todas as Lojas</option>
                  {stores.map(store => (
                    <option key={store.cod_loja} value={store.cod_loja}>
                      {store.label}
                    </option>
                  ))}
                </select>
              )}
              <p className="text-xs text-gray-500 mt-1">
                Selecione a loja específica ou "Todas" para bipagens de qualquer loja
              </p>
            </div>

            {/* Cor de Identificação */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Cor de Identificação
              </label>
              <ColorPicker
                color={formData.color_hash}
                onChange={(color) => setFormData({ ...formData, color_hash: color })}
              />
            </div>

            {/* Descrição */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Descrição (opcional)
              </label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
                placeholder="Informações adicionais sobre o equipamento"
                rows={3}
              />
            </div>
          </form>
        </div>

        {/* Footer fixo com botões */}
        <div className="p-6 border-t border-gray-200">
          <div className="flex gap-2">
            <button
              type="submit"
              form="equipment-form"
              disabled={isSubmitting}
              className="py-3 px-4 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-orange-500 hover:bg-orange-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-orange-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isSubmitting ? 'Salvando...' : 'Salvar'}
            </button>
            <button
              type="button"
              onClick={onCancel}
              disabled={isSubmitting}
              className="py-3 px-4 border border-gray-300 rounded-lg shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Cancelar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
