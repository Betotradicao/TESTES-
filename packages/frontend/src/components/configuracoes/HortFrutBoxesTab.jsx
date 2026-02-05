import { useState, useEffect, useRef } from 'react';
import toast, { Toaster } from 'react-hot-toast';
import { api } from '../../utils/api';
import { useLoja } from '../../contexts/LojaContext';

export default function HortFrutBoxesTab() {
  const { lojaSelecionada, lojas } = useLoja();
  const [boxes, setBoxes] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [editingBox, setEditingBox] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    weight: '',
    photoUrl: '',
    cod_loja: null
  });
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [photoPreview, setPhotoPreview] = useState(null);
  const [expandedPhoto, setExpandedPhoto] = useState(null);
  const fileInputRef = useRef(null);

  useEffect(() => {
    loadBoxes();
  }, [lojaSelecionada]);

  // Função para obter o badge da loja
  const getLojaLabel = (codLoja) => {
    if (!codLoja) return <span className="text-gray-400">-</span>;
    return (
      <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-blue-100 text-blue-800">
        Loja {codLoja}
      </span>
    );
  };

  // Função para obter o apelido da loja
  const getApelidoLoja = (codLoja) => {
    if (!codLoja) return <span className="text-gray-400">-</span>;
    const loja = lojas.find(l => l.COD_LOJA === codLoja);
    return loja?.APELIDO || <span className="text-gray-400">-</span>;
  };

  const loadBoxes = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const params = lojaSelecionada !== null ? `?cod_loja=${lojaSelecionada}` : '';
      const response = await api.get(`/hortfrut/boxes${params}`);
      setBoxes(response.data || []);
    } catch (err) {
      setError('Erro ao carregar tipos de caixa');
      console.error('Load boxes error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handlePhotoChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error('Por favor, selecione apenas imagens');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error('A imagem deve ter no máximo 5MB');
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      setPhotoPreview(reader.result);
    };
    reader.readAsDataURL(file);

    try {
      setUploadingPhoto(true);
      const uploadFormData = new FormData();
      uploadFormData.append('file', file);

      const response = await api.post('/hortfrut/upload', uploadFormData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      if (response.data?.url) {
        setFormData({ ...formData, photoUrl: response.data.url });
      }
    } catch (err) {
      console.error('Upload error:', err);
      toast.error('Erro ao fazer upload da foto');
      setPhotoPreview(null);
    } finally {
      setUploadingPhoto(false);
    }
  };

  const handleRemovePhoto = () => {
    setFormData({ ...formData, photoUrl: '' });
    setPhotoPreview(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    // Validar loja
    if (!formData.cod_loja) {
      toast.error('Selecione uma loja');
      return;
    }

    try {
      if (editingBox) {
        await api.put(`/hortfrut/boxes/${editingBox.id}`, formData);
        toast.success('Caixa atualizada com sucesso!');
      } else {
        await api.post('/hortfrut/boxes', formData);
        toast.success('Caixa criada com sucesso!');
      }
      await loadBoxes();
      resetForm();
    } catch (err) {
      console.error('Save box error:', err);
      toast.error('Erro ao salvar tipo de caixa');
    }
  };

  const handleEdit = (box) => {
    setEditingBox(box);
    setFormData({
      name: box.name,
      weight: box.weight.toString(),
      photoUrl: box.photoUrl || '',
      cod_loja: box.cod_loja || null
    });
    setPhotoPreview(box.photoUrl || null);
    setShowForm(true);
  };

  const handleToggle = async (box) => {
    try {
      await api.put(`/hortfrut/boxes/${box.id}`, { active: !box.active });
      await loadBoxes();
      toast.success('Status alterado!');
    } catch (err) {
      console.error('Toggle box error:', err);
      toast.error('Erro ao alterar status');
    }
  };

  const handleDelete = async (box) => {
    if (!confirm(`Deseja excluir "${box.name}"?`)) return;
    try {
      await api.delete(`/hortfrut/boxes/${box.id}`);
      await loadBoxes();
      toast.success('Caixa excluída!');
    } catch (err) {
      console.error('Delete box error:', err);
      toast.error('Erro ao excluir. Pode estar em uso.');
    }
  };

  const resetForm = () => {
    setShowForm(false);
    setEditingBox(null);
    setFormData({
      name: '',
      weight: '',
      photoUrl: '',
      cod_loja: lojaSelecionada || (lojas.length > 0 ? lojas[0].COD_LOJA : null)
    });
    setPhotoPreview(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleNewBox = () => {
    setEditingBox(null);
    setFormData({
      name: '',
      weight: '',
      photoUrl: '',
      cod_loja: lojaSelecionada || (lojas.length > 0 ? lojas[0].COD_LOJA : null)
    });
    setPhotoPreview(null);
    setShowForm(true);
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
      <Toaster />

      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-4">
        <div>
          <h2 className="text-xl font-semibold">Tipos de Caixa - HortFrut</h2>
          <p className="text-sm text-gray-500">Cadastre os tipos de caixa e seus pesos para desconto na conferência</p>
        </div>
        {!showForm && (
          <button
            onClick={handleNewBox}
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
            {/* Campo de Loja */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Loja *
              </label>
              <select
                value={formData.cod_loja || ''}
                onChange={(e) => setFormData({ ...formData, cod_loja: e.target.value ? parseInt(e.target.value) : null })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                required
              >
                <option value="">Selecione uma loja</option>
                {lojas.map((loja) => (
                  <option key={loja.COD_LOJA} value={loja.COD_LOJA}>
                    {loja.APELIDO || `Loja ${loja.COD_LOJA}`}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
            </div>

            {/* Campo de Foto */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Foto da Caixa
              </label>
              <div className="flex items-start gap-4">
                <div className="w-24 h-24 border-2 border-dashed border-gray-300 rounded-lg overflow-hidden bg-gray-100 flex items-center justify-center">
                  {uploadingPhoto ? (
                    <div className="text-center">
                      <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-green-600 mx-auto"></div>
                      <span className="text-xs text-gray-500 mt-1">Enviando...</span>
                    </div>
                  ) : photoPreview || formData.photoUrl ? (
                    <img src={photoPreview || formData.photoUrl} alt="Preview" className="w-full h-full object-cover" />
                  ) : (
                    <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                  )}
                </div>

                <div className="flex flex-col gap-2">
                  <input ref={fileInputRef} type="file" accept="image/*" onChange={handlePhotoChange} className="hidden" id="photo-upload" />
                  <label htmlFor="photo-upload" className="inline-flex items-center px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 cursor-pointer">
                    <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                    </svg>
                    Escolher Foto
                  </label>
                  {(photoPreview || formData.photoUrl) && (
                    <button type="button" onClick={handleRemovePhoto} className="inline-flex items-center px-3 py-2 text-sm font-medium text-red-700 bg-red-50 border border-red-200 rounded-md hover:bg-red-100">
                      <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                      Remover
                    </button>
                  )}
                  <p className="text-xs text-gray-500">JPG, PNG ou GIF. Máximo 5MB.</p>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <button type="button" onClick={resetForm} className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50">
                Cancelar
              </button>
              <button type="submit" disabled={uploadingPhoto} className="px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-md hover:bg-green-700 disabled:opacity-50">
                {editingBox ? 'Salvar' : 'Cadastrar'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Modal de foto expandida */}
      {expandedPhoto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-75" onClick={() => setExpandedPhoto(null)}>
          <div className="relative max-w-2xl max-h-[90vh] mx-4">
            <button onClick={() => setExpandedPhoto(null)} className="absolute -top-10 right-0 text-white hover:text-gray-300 transition">
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
            <img src={expandedPhoto.url} alt={expandedPhoto.name} className="max-w-full max-h-[80vh] rounded-lg shadow-2xl object-contain" onClick={(e) => e.stopPropagation()} />
            <p className="text-white text-center mt-3 text-lg font-medium">{expandedPhoto.name}</p>
          </div>
        </div>
      )}

      {/* Lista de caixas */}
      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Foto</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Nome</th>
              <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Loja</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Apelido</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Peso (kg)</th>
              <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Status</th>
              <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {boxes.length === 0 ? (
              <tr>
                <td colSpan="7" className="px-4 py-8 text-center text-gray-500">
                  Nenhum tipo de caixa cadastrado
                </td>
              </tr>
            ) : (
              boxes.map((box) => (
                <tr key={box.id} className={!box.active ? 'bg-gray-50 opacity-60' : ''}>
                  <td className="px-4 py-3">
                    <div
                      className={`h-10 w-10 rounded-full overflow-hidden bg-gray-100 flex items-center justify-center ${box.photoUrl ? 'cursor-pointer hover:ring-2 hover:ring-green-500 transition-all' : ''}`}
                      onClick={() => box.photoUrl && setExpandedPhoto({ url: box.photoUrl, name: box.name })}
                    >
                      {box.photoUrl ? (
                        <img src={box.photoUrl} alt={box.name} className="h-10 w-10 rounded-full object-cover" />
                      ) : (
                        <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                        </svg>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm font-medium text-gray-900">{box.name}</td>
                  <td className="px-4 py-3 text-center">{getLojaLabel(box.cod_loja)}</td>
                  <td className="px-4 py-3 text-sm text-gray-900">{getApelidoLoja(box.cod_loja)}</td>
                  <td className="px-4 py-3 text-sm text-gray-700">{parseFloat(box.weight).toFixed(3)} kg</td>
                  <td className="px-4 py-3 text-center">
                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${box.active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>
                      {box.active ? 'Ativo' : 'Inativo'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <div className="flex justify-center gap-2">
                      <button onClick={() => handleEdit(box)} className="text-blue-600 hover:text-blue-800 text-sm" title="Editar">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                      </button>
                      <button onClick={() => handleToggle(box)} className={`text-sm ${box.active ? 'text-yellow-600 hover:text-yellow-800' : 'text-green-600 hover:text-green-800'}`} title={box.active ? 'Desativar' : 'Ativar'}>
                        {box.active ? (
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                          </svg>
                        ) : (
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                        )}
                      </button>
                      <button onClick={() => handleDelete(box)} className="text-red-600 hover:text-red-800 text-sm" title="Excluir">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
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
