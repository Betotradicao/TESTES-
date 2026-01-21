import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Layout from '../components/Layout';
import { api } from '../utils/api';

export default function HortFrutConferencia() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [conference, setConference] = useState(null);
  const [items, setItems] = useState([]);
  const [boxes, setBoxes] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [filter, setFilter] = useState('all'); // all, pending, checked
  const [searchTerm, setSearchTerm] = useState('');
  const [editingItem, setEditingItem] = useState(null);
  const [showEmptyModal, setShowEmptyModal] = useState(false);
  const [productSearchTerm, setProductSearchTerm] = useState('');
  const [itemForm, setItemForm] = useState({
    productType: 'kg', // 'kg' ou 'unit'
    totalPaidValue: '',
    invoiceBoxQuantity: '',
    invoiceStatus: 'immediate', // 'immediate' ou 'later'
    supplier_id: '',
    box_id: '',
    boxQuantity: '',
    grossWeight: '',
    unitsPerBox: '',
    quality: '',
    observations: '',
    photos: [] // Array de até 6 fotos
  });
  const [expandedBoxPhoto, setExpandedBoxPhoto] = useState(null);
  const [uploadingPhotoIndex, setUploadingPhotoIndex] = useState(null); // Qual slot está fazendo upload

  useEffect(() => {
    loadConference();
    loadBoxes();
    loadSuppliers();
  }, [id]);

  const loadConference = async () => {
    try {
      setLoading(true);
      const response = await api.get(`/hortfrut/conferences/${id}`);
      setConference(response.data);
      setItems(response.data.items || []);
    } catch (err) {
      console.error('Erro ao carregar conferência:', err);
      setError('Erro ao carregar conferência');
    } finally {
      setLoading(false);
    }
  };

  const loadBoxes = async () => {
    try {
      const response = await api.get('/hortfrut/boxes?active=true');
      setBoxes(response.data || []);
    } catch (err) {
      console.error('Erro ao carregar caixas:', err);
    }
  };

  const loadSuppliers = async () => {
    try {
      const response = await api.get('/suppliers?active=true');
      setSuppliers(response.data || []);
    } catch (err) {
      console.error('Erro ao carregar fornecedores:', err);
    }
  };

  const handleEditItem = (item) => {
    setEditingItem(item);
    // Converter photoUrl para array de photos (compatibilidade - string separada por vírgula)
    let photos = [];
    if (item.photos && Array.isArray(item.photos)) {
      photos = item.photos;
    } else if (item.photoUrl) {
      // Se photoUrl contém vírgulas, é um array serializado
      photos = item.photoUrl.split(',').filter(p => p.trim());
    }
    setItemForm({
      productType: item.productType || 'kg',
      totalPaidValue: item.totalPaidValue ? item.totalPaidValue.toString() : '',
      invoiceBoxQuantity: item.invoiceBoxQuantity ? item.invoiceBoxQuantity.toString() : '',
      invoiceStatus: item.invoiceStatus || 'immediate',
      supplier_id: item.supplier_id ? item.supplier_id.toString() : '',
      box_id: item.box_id ? item.box_id.toString() : '',
      boxQuantity: item.boxQuantity ? item.boxQuantity.toString() : '',
      grossWeight: item.grossWeight ? item.grossWeight.toString() : '',
      unitsPerBox: item.unitsPerBox ? item.unitsPerBox.toString() : '',
      quality: item.quality || '',
      observations: item.observations || '',
      photos: photos
    });
  };

  // Upload de foto do produto (para um slot específico)
  const handlePhotoUpload = async (e, slotIndex) => {
    const file = e.target.files[0];
    if (!file) return;

    // Validar tipo
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      setError('Apenas imagens JPEG, PNG ou WebP são permitidas');
      return;
    }

    // Validar tamanho (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      setError('Imagem muito grande. Máximo 5MB');
      return;
    }

    setUploadingPhotoIndex(slotIndex);
    setError('');

    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await api.post('/hortfrut/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      // Adicionar foto ao array
      const newPhotos = [...itemForm.photos];
      newPhotos[slotIndex] = response.data.url;
      setItemForm({ ...itemForm, photos: newPhotos });
    } catch (err) {
      console.error('Erro ao fazer upload:', err);
      setError('Erro ao fazer upload da foto');
    } finally {
      setUploadingPhotoIndex(null);
    }
  };

  // Remover foto de um slot específico
  const handleRemovePhoto = (slotIndex) => {
    const newPhotos = [...itemForm.photos];
    newPhotos[slotIndex] = null;
    // Remover nulls do final do array
    while (newPhotos.length > 0 && !newPhotos[newPhotos.length - 1]) {
      newPhotos.pop();
    }
    setItemForm({ ...itemForm, photos: newPhotos });
  };

  // Validar se pode salvar (pelo menos 1 foto obrigatória para qualidade Ruim)
  const canSaveItem = () => {
    if (itemForm.quality === 'bad' && itemForm.photos.filter(p => p).length === 0) {
      return false;
    }
    return true;
  };

  const handleSaveItem = async () => {
    if (!editingItem) return;

    // Validar foto obrigatória para qualidade Ruim
    if (!canSaveItem()) {
      setError('Foto obrigatória quando a qualidade é Ruim!');
      return;
    }

    setSaving(true);
    setError('');

    try {
      // Calcular valores antes de enviar
      const calculatedValues = calculatePreviewValues();

      const payload = {
        productType: itemForm.productType,
        totalPaidValue: itemForm.totalPaidValue ? parseFloat(itemForm.totalPaidValue.replace(',', '.')) : null,
        newCost: calculatedValues.unitCost || null,
        invoiceBoxQuantity: itemForm.invoiceBoxQuantity ? parseInt(itemForm.invoiceBoxQuantity) : null,
        invoiceStatus: itemForm.invoiceStatus || null,
        supplier_id: itemForm.supplier_id ? parseInt(itemForm.supplier_id) : null,
        box_id: itemForm.box_id ? parseInt(itemForm.box_id) : null,
        boxQuantity: itemForm.boxQuantity ? parseInt(itemForm.boxQuantity) : null,
        grossWeight: itemForm.grossWeight ? parseFloat(itemForm.grossWeight.replace(',', '.')) : null,
        unitsPerBox: itemForm.unitsPerBox ? parseInt(itemForm.unitsPerBox) : null,
        totalUnits: calculatedValues.totalUnits || null,
        quality: itemForm.quality || null,
        observations: itemForm.observations || null,
        photoUrl: itemForm.photos.filter(p => p).join(',') || null, // Salvar como string separada por vírgula
        checked: true
      };

      await api.put(`/hortfrut/conferences/${id}/items/${editingItem.id}`, payload);

      // Recarregar conferência
      await loadConference();

      setEditingItem(null);
      setItemForm({
        productType: 'kg',
        totalPaidValue: '',
        invoiceBoxQuantity: '',
        invoiceStatus: 'immediate',
        supplier_id: '',
        box_id: '',
        boxQuantity: '',
        grossWeight: '',
        unitsPerBox: '',
        quality: '',
        observations: '',
        photos: []
      });

      setSuccess('Item conferido com sucesso!');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      console.error('Erro ao salvar item:', err);
      setError(err.response?.data?.error || 'Erro ao salvar item');
    } finally {
      setSaving(false);
    }
  };

  const handleMarkUnchecked = async (item) => {
    try {
      await api.put(`/hortfrut/conferences/${id}/items/${item.id}`, {
        checked: false
      });
      await loadConference();
    } catch (err) {
      console.error('Erro ao desmarcar item:', err);
    }
  };

  const handleFinalizeConference = async () => {
    if (!window.confirm('Tem certeza que deseja finalizar esta conferência?')) {
      return;
    }

    try {
      await api.post(`/hortfrut/conferences/${id}/finalize`);
      await loadConference();
      setSuccess('Conferência finalizada com sucesso!');
    } catch (err) {
      console.error('Erro ao finalizar:', err);
      setError(err.response?.data?.error || 'Erro ao finalizar conferência');
    }
  };

  const calculatePreviewValues = () => {
    if (!editingItem) return { suggestedPrice: null, marginIfKeep: null, netWeight: null, unitCost: null, totalUnits: null };

    let suggestedPrice = null;
    let marginIfKeep = null;
    let netWeight = null;
    let unitCost = null;
    let totalUnits = null;

    const totalPaid = itemForm.totalPaidValue ? parseFloat(itemForm.totalPaidValue.replace(',', '.')) : 0;

    // Calcular peso líquido (sempre que tiver os dados)
    if (itemForm.grossWeight && itemForm.box_id && itemForm.boxQuantity) {
      const box = boxes.find(b => b.id === parseInt(itemForm.box_id));
      if (box) {
        const gross = parseFloat(itemForm.grossWeight.toString().replace(',', '.'));
        const boxWeight = parseFloat(box.weight) * parseInt(itemForm.boxQuantity);
        netWeight = gross - boxWeight;
      }
    }

    // MODO KG
    if (itemForm.productType === 'kg') {
      // Preço por KG = Valor Total Pago / Peso Líquido
      if (totalPaid > 0 && netWeight && netWeight > 0) {
        unitCost = totalPaid / netWeight;
      }
    }
    // MODO UNIDADE
    else if (itemForm.productType === 'unit') {
      // Total de Unidades = Qtd Unidades por Caixa * Qtd de Caixas
      if (itemForm.unitsPerBox && itemForm.boxQuantity) {
        totalUnits = parseInt(itemForm.unitsPerBox) * parseInt(itemForm.boxQuantity);
      }
      // Preço por Unidade = Valor Total Pago / Total de Unidades
      if (totalPaid > 0 && totalUnits && totalUnits > 0) {
        unitCost = totalPaid / totalUnits;
      }
    }

    // Calcular preço sugerido se tiver custo unitário e margem de referência
    if (unitCost && editingItem.referenceMargin) {
      const margin = parseFloat(editingItem.referenceMargin) / 100;
      suggestedPrice = unitCost / (1 - margin);
    }

    // Calcular margem futura (se manter preço atual)
    if (unitCost && editingItem.currentSalePrice) {
      const price = parseFloat(editingItem.currentSalePrice);
      marginIfKeep = ((price - unitCost) / price) * 100;
    }

    return { suggestedPrice, marginIfKeep, netWeight, unitCost, totalUnits };
  };

  const filteredItems = items.filter(item => {
    // Filtro por status
    if (filter === 'pending' && item.checked) return false;
    if (filter === 'checked' && !item.checked) return false;

    // Filtro por busca
    if (searchTerm) {
      const search = searchTerm.toLowerCase();
      return (
        item.productName?.toLowerCase().includes(search) ||
        item.barcode?.toLowerCase().includes(search)
      );
    }

    return true;
  });

  const stats = {
    total: items.length,
    checked: items.filter(i => i.checked).length,
    pending: items.filter(i => !i.checked).length
  };

  const { suggestedPrice, marginIfKeep, netWeight, unitCost, totalUnits } = calculatePreviewValues();

  // Função para ir para o próximo item pendente
  const goToNextPendingItem = () => {
    const pendingItems = items.filter(i => !i.checked && i.id !== editingItem?.id);
    if (pendingItems.length > 0) {
      handleEditItem(pendingItems[0]);
    } else {
      setEditingItem(null);
    }
  };

  // Função para salvar e ir para o próximo
  const handleSaveAndNext = async () => {
    if (!editingItem) return;

    // Validar foto obrigatória para qualidade Ruim
    if (!canSaveItem()) {
      setError('Foto obrigatória quando a qualidade é Ruim!');
      return;
    }

    setSaving(true);
    setError('');

    try {
      const calculatedValues = calculatePreviewValues();

      const payload = {
        productType: itemForm.productType,
        totalPaidValue: itemForm.totalPaidValue ? parseFloat(itemForm.totalPaidValue.replace(',', '.')) : null,
        newCost: calculatedValues.unitCost || null,
        invoiceBoxQuantity: itemForm.invoiceBoxQuantity ? parseInt(itemForm.invoiceBoxQuantity) : null,
        invoiceStatus: itemForm.invoiceStatus || null,
        supplier_id: itemForm.supplier_id ? parseInt(itemForm.supplier_id) : null,
        box_id: itemForm.box_id ? parseInt(itemForm.box_id) : null,
        boxQuantity: itemForm.boxQuantity ? parseInt(itemForm.boxQuantity) : null,
        grossWeight: itemForm.grossWeight ? parseFloat(itemForm.grossWeight.replace(',', '.')) : null,
        unitsPerBox: itemForm.unitsPerBox ? parseInt(itemForm.unitsPerBox) : null,
        totalUnits: calculatedValues.totalUnits || null,
        quality: itemForm.quality || null,
        observations: itemForm.observations || null,
        photoUrl: itemForm.photos.filter(p => p).join(',') || null,
        checked: true
      };

      await api.put(`/hortfrut/conferences/${id}/items/${editingItem.id}`, payload);
      await loadConference();

      // Ir para o próximo item pendente
      const updatedItems = items.map(i => i.id === editingItem.id ? { ...i, checked: true } : i);
      const pendingItems = updatedItems.filter(i => !i.checked);

      if (pendingItems.length > 0) {
        // Resetar form e carregar próximo
        setItemForm({
          productType: 'kg',
          totalPaidValue: '',
          invoiceBoxQuantity: '',
          invoiceStatus: 'immediate',
          supplier_id: '',
          box_id: '',
          boxQuantity: '',
          grossWeight: '',
          unitsPerBox: '',
          quality: '',
          observations: '',
          photos: []
        });

        // Aguarda um pouco e carrega próximo
        setTimeout(() => {
          const nextItem = items.find(i => !i.checked && i.id !== editingItem.id);
          if (nextItem) {
            handleEditItem(nextItem);
          } else {
            setEditingItem(null);
          }
        }, 100);
      } else {
        setEditingItem(null);
        setSuccess('Todos os itens foram conferidos!');
      }
    } catch (err) {
      console.error('Erro ao salvar item:', err);
      setError(err.response?.data?.error || 'Erro ao salvar item');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Layout title="Conferência HortFruti">
        <div className="p-8 text-center">
          <p className="text-gray-500">Carregando conferência...</p>
        </div>
      </Layout>
    );
  }

  if (!conference) {
    return (
      <Layout title="Conferência HortFruti">
        <div className="p-8 text-center">
          <p className="text-red-500">Conferência não encontrada</p>
          <button
            onClick={() => navigate('/hortfrut-lancador')}
            className="mt-4 px-4 py-2 bg-orange-600 text-white rounded hover:bg-orange-700"
          >
            Voltar
          </button>
        </div>
      </Layout>
    );
  }

  return (
    <Layout title="Conferência HortFruti">
      <div className="p-4 lg:p-8">
        {/* Header com info da conferência */}
        <div className="bg-gradient-to-br from-orange-500 to-red-600 rounded-lg shadow-lg p-6 mb-6 text-white">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h1 className="text-2xl lg:text-3xl font-bold mb-2">
                🥬 Conferência {conference.conferenceDate ? conference.conferenceDate.split('T')[0].split('-').reverse().join('/') : ''}
              </h1>
              <p className="text-white/90">
                {conference.supplierName || 'Sem fornecedor'}
                {conference.invoiceNumber && ` | NF: ${conference.invoiceNumber}`}
              </p>
            </div>
            <div className="flex gap-4 mt-4 lg:mt-0">
              <div className="bg-white/20 backdrop-blur-sm rounded-lg px-4 py-2 text-center">
                <p className="text-2xl font-bold">{stats.checked}/{stats.total}</p>
                <p className="text-xs">Conferidos</p>
              </div>
              <div className="bg-white/20 backdrop-blur-sm rounded-lg px-4 py-2 text-center">
                <p className="text-2xl font-bold">{stats.pending}</p>
                <p className="text-xs">Pendentes</p>
              </div>
            </div>
          </div>
        </div>

        {error && (
          <div className="mb-4 p-4 bg-red-100 border border-red-400 text-red-700 rounded">
            {error}
          </div>
        )}

        {success && (
          <div className="mb-4 p-4 bg-green-100 border border-green-400 text-green-700 rounded">
            {success}
          </div>
        )}

        {/* Barra de filtros */}
        <div className="bg-white rounded-lg shadow-md p-4 mb-6">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div className="flex gap-2 flex-wrap">
              <button
                onClick={() => {
                  setShowEmptyModal(true);
                  setEditingItem(null);
                  setProductSearchTerm('');
                }}
                className="px-4 py-2 rounded-lg text-sm font-medium transition-colors bg-green-600 text-white hover:bg-green-700"
              >
                🚀 Iniciar Conferência
              </button>
              <button
                onClick={() => setFilter('all')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  filter === 'all' ? 'bg-orange-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                Todos ({stats.total})
              </button>
              <button
                onClick={() => setFilter('pending')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  filter === 'pending' ? 'bg-yellow-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                Pendentes ({stats.pending})
              </button>
              <button
                onClick={() => setFilter('checked')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  filter === 'checked' ? 'bg-green-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                Conferidos ({stats.checked})
              </button>
            </div>

            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Buscar produto..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
              />

              {conference.status !== 'completed' && stats.pending === 0 && (
                <button
                  onClick={handleFinalizeConference}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm font-medium"
                >
                  ✅ Finalizar Conferência
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Modal de edição - Mobile First */}
        {(editingItem || showEmptyModal) && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-2">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-lg max-h-[95vh] overflow-y-auto">
              {/* Header com info do produto */}
              <div className="bg-gradient-to-r from-orange-500 to-red-600 text-white p-4 rounded-t-lg sticky top-0 z-10">
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="text-lg font-bold">{editingItem ? editingItem.productName : 'Selecione um produto'}</h3>
                    <p className="text-sm text-white/80">Codigo: {editingItem?.barcode || '-'}</p>
                  </div>
                  <button
                    onClick={() => {
                      setEditingItem(null);
                      setShowEmptyModal(false);
                      setProductSearchTerm('');
                    }}
                    className="text-white/80 hover:text-white text-2xl leading-none"
                  >
                    &times;
                  </button>
                </div>
                {/* Info compacta do produto */}
                {editingItem && (
                  <div className="grid grid-cols-4 gap-2 mt-3 text-center">
                    <div className="bg-white/20 rounded px-1 py-1">
                      <p className="text-[10px] text-white/70">Custo</p>
                      <p className="text-xs font-bold">
                        {editingItem.currentCost ? `R$${parseFloat(editingItem.currentCost).toFixed(2)}` : '-'}
                      </p>
                    </div>
                    <div className="bg-white/20 rounded px-1 py-1">
                      <p className="text-[10px] text-white/70">Venda</p>
                      <p className="text-xs font-bold">
                        {editingItem.currentSalePrice ? `R$${parseFloat(editingItem.currentSalePrice).toFixed(2)}` : '-'}
                      </p>
                    </div>
                    <div className="bg-white/20 rounded px-1 py-1">
                      <p className="text-[10px] text-white/70">Marg.Ref</p>
                      <p className="text-xs font-bold">
                        {editingItem.referenceMargin ? `${parseFloat(editingItem.referenceMargin).toFixed(0)}%` : '-'}
                      </p>
                    </div>
                    <div className="bg-white/20 rounded px-1 py-1">
                      <p className="text-[10px] text-white/70">Marg.Atual</p>
                      <p className="text-xs font-bold">
                        {editingItem.currentMargin ? `${parseFloat(editingItem.currentMargin).toFixed(0)}%` : '-'}
                      </p>
                    </div>
                  </div>
                )}
              </div>

              <div className="p-4 space-y-4">
                {/* Busca de Produto por Nome/Código */}
                <div className="bg-orange-50 rounded-lg p-3 -mx-1 border border-orange-200">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    🔍 Buscar Produto (nome ou código):
                  </label>
                  <input
                    type="text"
                    value={productSearchTerm}
                    onChange={(e) => setProductSearchTerm(e.target.value)}
                    placeholder="Digite o nome ou código do produto..."
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 text-sm mb-2"
                  />
                  {productSearchTerm && (
                    <div className="max-h-40 overflow-y-auto bg-white border border-gray-200 rounded-lg">
                      {items
                        .filter(item =>
                          item.productName.toLowerCase().includes(productSearchTerm.toLowerCase()) ||
                          (item.barcode && item.barcode.includes(productSearchTerm))
                        )
                        .slice(0, 10)
                        .map(item => (
                          <button
                            key={item.id}
                            onClick={() => {
                              handleEditItem(item);
                              setShowEmptyModal(false);
                              setProductSearchTerm('');
                            }}
                            className={`w-full text-left px-3 py-2 hover:bg-orange-100 border-b border-gray-100 last:border-b-0 text-sm ${
                              item.checked ? 'bg-green-50' : ''
                            }`}
                          >
                            <span className={item.checked ? 'text-green-700' : 'text-gray-800'}>
                              {item.checked ? '✅ ' : '⏳ '}{item.productName}
                            </span>
                            <span className="text-xs text-gray-500 ml-2">({item.barcode || 'sem código'})</span>
                          </button>
                        ))}
                      {items.filter(item =>
                        item.productName.toLowerCase().includes(productSearchTerm.toLowerCase()) ||
                        (item.barcode && item.barcode.includes(productSearchTerm))
                      ).length === 0 && (
                        <p className="px-3 py-2 text-sm text-gray-500">Nenhum produto encontrado</p>
                      )}
                    </div>
                  )}
                </div>

                {/* Seletor de Produto (dropdown) */}
                <div className="bg-gray-50 rounded-lg p-3 -mx-1">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Selecionar Produto:
                  </label>
                  <select
                    value={editingItem?.id || ''}
                    onChange={(e) => {
                      const selectedItem = items.find(i => i.id === parseInt(e.target.value));
                      if (selectedItem) {
                        handleEditItem(selectedItem);
                        setShowEmptyModal(false);
                      }
                    }}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 text-sm"
                  >
                    <option value="">-- Selecione um produto --</option>
                    <optgroup label="⏳ Pendentes">
                      {items.filter(i => !i.checked).map(item => (
                        <option key={item.id} value={item.id}>
                          {item.productName || item.barcode || `Item ${item.id}`}
                        </option>
                      ))}
                    </optgroup>
                    <optgroup label="✅ Conferidos">
                      {items.filter(i => i.checked).map(item => (
                        <option key={item.id} value={item.id}>
                          {item.productName || item.barcode || `Item ${item.id}`}
                        </option>
                      ))}
                    </optgroup>
                  </select>
                </div>

                {/* Fornecedor */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Fornecedor:
                  </label>
                  <select
                    value={itemForm.supplier_id}
                    onChange={(e) => setItemForm({ ...itemForm, supplier_id: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500"
                  >
                    <option value="">Selecione o fornecedor...</option>
                    {suppliers.map(supplier => (
                      <option key={supplier.id} value={supplier.id}>
                        {supplier.fantasyName}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Tipo de Produto */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Tipo de Produto:
                  </label>
                  <div className="flex gap-4">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="productType"
                        value="kg"
                        checked={itemForm.productType === 'kg'}
                        onChange={(e) => setItemForm({ ...itemForm, productType: e.target.value })}
                        className="w-4 h-4 text-orange-600"
                      />
                      <span className="text-sm font-medium">Por KG</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="productType"
                        value="unit"
                        checked={itemForm.productType === 'unit'}
                        onChange={(e) => setItemForm({ ...itemForm, productType: e.target.value })}
                        className="w-4 h-4 text-orange-600"
                      />
                      <span className="text-sm font-medium">Por Unidade</span>
                    </label>
                  </div>
                </div>

                {/* Valor Total Pago */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Valor Total Pago (R$):
                  </label>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={itemForm.totalPaidValue}
                    onChange={(e) => setItemForm({ ...itemForm, totalPaidValue: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 text-lg"
                    placeholder="Ex: 150.00"
                  />
                </div>

                {/* Tipo de Caixa */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Tipo de Caixa:
                  </label>
                  <select
                    value={itemForm.box_id}
                    onChange={(e) => setItemForm({ ...itemForm, box_id: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500"
                  >
                    <option value="">Selecione...</option>
                    {boxes.map(box => (
                      <option key={box.id} value={box.id}>
                        {box.name} ({parseFloat(box.weight).toFixed(3)} kg)
                      </option>
                    ))}
                  </select>
                  {/* Preview da foto da caixa selecionada */}
                  {itemForm.box_id && (() => {
                    const selectedBox = boxes.find(b => b.id === parseInt(itemForm.box_id));
                    if (selectedBox?.photoUrl) {
                      return (
                        <div className="mt-2 flex items-center gap-3">
                          <img
                            src={selectedBox.photoUrl}
                            alt={selectedBox.name}
                            className="w-16 h-16 object-cover rounded-lg border-2 border-orange-300 cursor-pointer hover:border-orange-500 transition-colors"
                            onClick={() => setExpandedBoxPhoto({ url: selectedBox.photoUrl, name: selectedBox.name })}
                          />
                          <span className="text-xs text-gray-500">Clique para ampliar</span>
                        </div>
                      );
                    }
                    return null;
                  })()}
                </div>

                {/* Qtd de Caixas Recebidas */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Qtd. de Caixas Recebidas:
                  </label>
                  <input
                    type="number"
                    inputMode="numeric"
                    min="0"
                    value={itemForm.boxQuantity}
                    onChange={(e) => setItemForm({ ...itemForm, boxQuantity: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 text-lg"
                    placeholder="Ex: 5"
                  />
                </div>

                {/* Qtd de Caixas na Nota (verificacao) */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Qtd. Caixas na Nota (verificacao):
                  </label>
                  <input
                    type="number"
                    inputMode="numeric"
                    min="0"
                    value={itemForm.invoiceBoxQuantity}
                    onChange={(e) => setItemForm({ ...itemForm, invoiceBoxQuantity: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 text-lg"
                    placeholder="Ex: 5"
                  />
                  {itemForm.boxQuantity && itemForm.invoiceBoxQuantity &&
                   parseInt(itemForm.boxQuantity) !== parseInt(itemForm.invoiceBoxQuantity) && (
                    <p className="mt-1 text-sm text-red-600 font-medium">
                      Atencao: Qtd recebida diferente da nota!
                    </p>
                  )}
                </div>

                {/* Peso Bruto (apenas para KG) */}
                {itemForm.productType === 'kg' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Peso Bruto (kg):
                    </label>
                    <input
                      type="text"
                      inputMode="decimal"
                      value={itemForm.grossWeight}
                      onChange={(e) => setItemForm({ ...itemForm, grossWeight: e.target.value })}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 text-lg"
                      placeholder="Ex: 25.500"
                    />
                  </div>
                )}

                {/* Unidades por Caixa (apenas para UNIDADE) */}
                {itemForm.productType === 'unit' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Qtd. Unidades por Caixa:
                    </label>
                    <input
                      type="number"
                      inputMode="numeric"
                      min="0"
                      value={itemForm.unitsPerBox}
                      onChange={(e) => setItemForm({ ...itemForm, unitsPerBox: e.target.value })}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 text-lg"
                      placeholder="Ex: 12"
                    />
                  </div>
                )}

                {/* Nota Fiscal */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Nota Fiscal:
                  </label>
                  <div className="flex gap-4">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="invoiceStatus"
                        value="immediate"
                        checked={itemForm.invoiceStatus === 'immediate'}
                        onChange={(e) => setItemForm({ ...itemForm, invoiceStatus: e.target.value })}
                        className="w-4 h-4 text-orange-600"
                      />
                      <span className="text-sm">No ato</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="invoiceStatus"
                        value="later"
                        checked={itemForm.invoiceStatus === 'later'}
                        onChange={(e) => setItemForm({ ...itemForm, invoiceStatus: e.target.value })}
                        className="w-4 h-4 text-orange-600"
                      />
                      <span className="text-sm">Posterior</span>
                    </label>
                  </div>
                </div>

                {/* Qualidade */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Qualidade:
                  </label>
                  <select
                    value={itemForm.quality}
                    onChange={(e) => setItemForm({ ...itemForm, quality: e.target.value })}
                    className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-orange-500 ${
                      itemForm.quality === 'bad' ? 'border-red-400 bg-red-50' : 'border-gray-300'
                    }`}
                  >
                    <option value="">Selecione...</option>
                    <option value="good">Boa</option>
                    <option value="regular">Regular</option>
                    <option value="bad">Ruim</option>
                  </select>
                </div>

                {/* Fotos do Produto (obrigatória pelo menos 1 se qualidade = Ruim) */}
                {itemForm.quality === 'bad' && (
                  <div className="bg-red-50 border border-red-300 rounded-lg p-3">
                    <label className="block text-sm font-medium text-red-700 mb-2">
                      Fotos do Produto: <span className="text-red-600 text-xs">*Mínimo 1 foto obrigatória</span>
                    </label>

                    {/* Grid de 6 caixinhas de foto */}
                    <div className="grid grid-cols-3 gap-2">
                      {[0, 1, 2, 3, 4, 5].map((slotIndex) => {
                        const photoUrl = itemForm.photos[slotIndex];
                        const isUploading = uploadingPhotoIndex === slotIndex;
                        const isFirstSlot = slotIndex === 0;

                        return (
                          <div key={slotIndex} className="relative">
                            {photoUrl ? (
                              // Foto já carregada
                              <div className="relative">
                                <img
                                  src={photoUrl}
                                  alt={`Foto ${slotIndex + 1}`}
                                  className="w-full h-16 object-cover rounded border-2 border-red-300 cursor-pointer hover:opacity-80"
                                  onClick={() => setExpandedBoxPhoto({ url: photoUrl, name: `Foto ${slotIndex + 1}` })}
                                />
                                <button
                                  type="button"
                                  onClick={() => handleRemovePhoto(slotIndex)}
                                  className="absolute -top-1 -right-1 bg-red-600 text-white rounded-full w-4 h-4 flex items-center justify-center text-xs hover:bg-red-700"
                                >
                                  &times;
                                </button>
                              </div>
                            ) : (
                              // Slot vazio - upload
                              <div>
                                <input
                                  type="file"
                                  accept="image/jpeg,image/jpg,image/png,image/webp"
                                  capture="environment"
                                  onChange={(e) => handlePhotoUpload(e, slotIndex)}
                                  className="hidden"
                                  id={`photo-upload-${slotIndex}`}
                                />
                                <label
                                  htmlFor={`photo-upload-${slotIndex}`}
                                  className={`flex flex-col items-center justify-center w-full h-16 border-2 border-dashed rounded cursor-pointer transition-colors ${
                                    isUploading
                                      ? 'border-gray-300 bg-gray-100'
                                      : isFirstSlot && itemForm.photos.filter(p => p).length === 0
                                        ? 'border-red-400 bg-red-100 hover:bg-red-200'
                                        : 'border-gray-300 bg-white hover:bg-gray-50'
                                  }`}
                                >
                                  {isUploading ? (
                                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-orange-600"></div>
                                  ) : (
                                    <svg className={`w-6 h-6 ${isFirstSlot && itemForm.photos.filter(p => p).length === 0 ? 'text-red-400' : 'text-gray-400'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                                    </svg>
                                  )}
                                </label>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                    <p className="text-xs text-gray-500 mt-2 text-center">
                      {itemForm.photos.filter(p => p).length}/6 fotos | Clique para ampliar
                    </p>
                  </div>
                )}

                {/* Observacoes */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Observacoes:
                  </label>
                  <input
                    type="text"
                    value={itemForm.observations}
                    onChange={(e) => setItemForm({ ...itemForm, observations: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500"
                    placeholder="Observacoes..."
                  />
                </div>

                {/* Calculos em tempo real */}
                <div className="bg-gradient-to-br from-orange-50 to-red-50 border border-orange-200 rounded-lg p-4">
                  <h4 className="font-semibold text-orange-900 mb-3 text-sm">CALCULOS:</h4>
                  <div className="space-y-2">
                    {/* Peso Liquido (modo KG) */}
                    {itemForm.productType === 'kg' && netWeight !== null && (
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-600">Peso Liquido:</span>
                        <span className="font-bold text-orange-900">{netWeight.toFixed(3)} kg</span>
                      </div>
                    )}

                    {/* Total de Unidades (modo UNIDADE) */}
                    {itemForm.productType === 'unit' && totalUnits !== null && (
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-600">Total Unidades:</span>
                        <span className="font-bold text-orange-900">{totalUnits} un</span>
                      </div>
                    )}

                    {/* Preco Unitario Calculado */}
                    {unitCost !== null && (
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-600">
                          {itemForm.productType === 'kg' ? 'Preco por KG:' : 'Preco por Unidade:'}
                        </span>
                        <span className="font-bold text-orange-700 text-lg">R$ {unitCost.toFixed(2)}</span>
                      </div>
                    )}

                    {/* Preco Sugerido */}
                    {suggestedPrice !== null && (
                      <div className="flex justify-between items-center border-t border-orange-200 pt-2">
                        <span className="text-sm text-gray-600">Preco Sugerido (Marg. {editingItem.referenceMargin}%):</span>
                        <span className="font-bold text-green-700 text-lg">R$ {suggestedPrice.toFixed(2)}</span>
                      </div>
                    )}

                    {/* Margem Futura */}
                    {marginIfKeep !== null && (
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-600">Margem Futura (se manter R${parseFloat(editingItem.currentSalePrice).toFixed(2)}):</span>
                        <span className={`font-bold text-lg ${marginIfKeep < 0 ? 'text-red-700' : marginIfKeep < 10 ? 'text-yellow-700' : 'text-green-700'}`}>
                          {marginIfKeep.toFixed(1)}%
                        </span>
                      </div>
                    )}

                    {/* Mensagem se nao tiver dados suficientes */}
                    {!unitCost && (
                      <p className="text-sm text-gray-500 italic text-center py-2">
                        Preencha os campos acima para ver os calculos
                      </p>
                    )}
                  </div>
                </div>

                {/* Botoes */}
                <div className="flex flex-col gap-3 pt-4 border-t">
                  <button
                    onClick={handleSaveAndNext}
                    disabled={saving}
                    className="w-full px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 font-medium text-lg"
                  >
                    {saving ? 'Salvando...' : 'Conferir e Proximo'}
                  </button>
                  <button
                    onClick={handleSaveItem}
                    disabled={saving}
                    className="w-full px-6 py-3 bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:opacity-50 font-medium"
                  >
                    {saving ? 'Salvando...' : 'Conferir Item'}
                  </button>
                  <button
                    onClick={() => setEditingItem(null)}
                    className="w-full px-6 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Modal de foto da caixa expandida */}
        {expandedBoxPhoto && (
          <div
            className="fixed inset-0 z-[60] flex items-center justify-center bg-black bg-opacity-80"
            onClick={() => setExpandedBoxPhoto(null)}
          >
            <div className="relative max-w-lg max-h-[80vh] mx-4">
              <button
                onClick={() => setExpandedBoxPhoto(null)}
                className="absolute -top-10 right-0 text-white hover:text-gray-300 transition"
              >
                <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
              <img
                src={expandedBoxPhoto.url}
                alt={expandedBoxPhoto.name}
                className="max-w-full max-h-[70vh] rounded-lg shadow-2xl object-contain"
                onClick={(e) => e.stopPropagation()}
              />
              <p className="text-white text-center mt-3 text-lg font-medium">{expandedBoxPhoto.name}</p>
            </div>
          </div>
        )}

        {/* Lista de Itens Pendentes */}
        {filter !== 'checked' && items.filter(i => !i.checked).length > 0 && (
          <div className="bg-white rounded-lg shadow-md overflow-hidden mb-6">
            <div className="bg-yellow-50 px-4 py-3 border-b border-yellow-200">
              <h2 className="text-lg font-semibold text-yellow-800">
                ⏳ Itens Pendentes ({items.filter(i => !i.checked).length})
              </h2>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Produto</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Curva</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Custo Atual</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Preço Venda</th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {items
                    .filter(i => !i.checked)
                    .filter(item => {
                      if (!searchTerm) return true;
                      const search = searchTerm.toLowerCase();
                      return item.productName?.toLowerCase().includes(search) || item.barcode?.toLowerCase().includes(search);
                    })
                    .map((item) => (
                      <tr key={item.id} className="hover:bg-yellow-50 cursor-pointer" onClick={() => handleEditItem(item)}>
                        <td className="px-4 py-3">
                          <p className="font-medium text-gray-900 text-sm">{item.productName}</p>
                          <p className="text-xs text-gray-500">{item.barcode || '-'}</p>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-700">{item.curve || '-'}</td>
                        <td className="px-4 py-3 text-sm text-right text-gray-700">
                          {item.currentCost ? `R$ ${parseFloat(item.currentCost).toFixed(2)}` : '-'}
                        </td>
                        <td className="px-4 py-3 text-sm text-right text-gray-700">
                          {item.currentSalePrice ? `R$ ${parseFloat(item.currentSalePrice).toFixed(2)}` : '-'}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <button
                            onClick={(e) => { e.stopPropagation(); handleEditItem(item); }}
                            className="px-3 py-1 bg-orange-600 text-white rounded hover:bg-orange-700 text-sm"
                          >
                            Conferir
                          </button>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Lista de Itens Conferidos (Auditados) */}
        {items.filter(i => i.checked).length > 0 && (
          <div className="bg-white rounded-lg shadow-md overflow-hidden">
            <div className="bg-green-50 px-4 py-3 border-b border-green-200 flex justify-between items-center">
              <h2 className="text-lg font-semibold text-green-800">
                ✅ Itens Conferidos ({items.filter(i => i.checked).length})
              </h2>
              {conference && conference.status !== 'completed' && (
                <button
                  onClick={handleFinalizeConference}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm font-medium"
                >
                  🏁 Finalizar Auditoria
                </button>
              )}
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Produto</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Curva</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Custo Atual</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Novo Custo</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Preço Sug.</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Margem Manter</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Peso Líq.</th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Qualidade</th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {items
                    .filter(i => i.checked)
                    .filter(item => {
                      if (filter === 'pending') return false;
                      if (!searchTerm) return true;
                      const search = searchTerm.toLowerCase();
                      return item.productName?.toLowerCase().includes(search) || item.barcode?.toLowerCase().includes(search);
                    })
                    .map((item) => (
                      <tr key={item.id} className="bg-green-50 hover:bg-green-100 cursor-pointer" onClick={() => handleEditItem(item)}>
                        <td className="px-4 py-3">
                          <p className="font-medium text-gray-900 text-sm">{item.productName}</p>
                          <p className="text-xs text-gray-500">{item.barcode || '-'}</p>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-700">{item.curve || '-'}</td>
                        <td className="px-4 py-3 text-sm text-right text-gray-700">
                          {item.currentCost ? `R$ ${parseFloat(item.currentCost).toFixed(2)}` : '-'}
                        </td>
                        <td className="px-4 py-3 text-sm text-right font-semibold text-orange-700">
                          {item.newCost ? `R$ ${parseFloat(item.newCost).toFixed(2)}` : '-'}
                        </td>
                        <td className="px-4 py-3 text-sm text-right font-semibold text-green-700">
                          {item.suggestedPrice ? `R$ ${parseFloat(item.suggestedPrice).toFixed(2)}` : '-'}
                        </td>
                        <td className="px-4 py-3 text-sm text-right">
                          {item.marginIfKeepPrice !== null && item.marginIfKeepPrice !== undefined ? (
                            <span className={`font-semibold ${
                              parseFloat(item.marginIfKeepPrice) < 0 ? 'text-red-600' :
                              parseFloat(item.marginIfKeepPrice) < 10 ? 'text-yellow-600' :
                              'text-green-600'
                            }`}>
                              {parseFloat(item.marginIfKeepPrice).toFixed(1)}%
                            </span>
                          ) : '-'}
                        </td>
                        <td className="px-4 py-3 text-sm text-right text-gray-700">
                          {item.netWeight ? `${parseFloat(item.netWeight).toFixed(3)} kg` : '-'}
                        </td>
                        <td className="px-4 py-3 text-center">
                          {item.quality === 'good' && <span className="text-green-600">🟢 Boa</span>}
                          {item.quality === 'regular' && <span className="text-yellow-600">🟡 Regular</span>}
                          {item.quality === 'bad' && <span className="text-red-600">🔴 Ruim</span>}
                          {!item.quality && <span className="text-gray-400">-</span>}
                        </td>
                        <td className="px-4 py-3 text-center">
                          {conference && conference.status !== 'completed' && (
                            <div className="flex justify-center gap-2">
                              <button
                                onClick={(e) => { e.stopPropagation(); handleEditItem(item); }}
                                className="text-blue-600 hover:text-blue-800 text-sm"
                                title="Editar"
                              >
                                ✏️
                              </button>
                              <button
                                onClick={(e) => { e.stopPropagation(); handleMarkUnchecked(item); }}
                                className="text-yellow-600 hover:text-yellow-800 text-sm"
                                title="Desmarcar"
                              >
                                ↩️
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>

            {/* Botão Finalizar no final da lista */}
            {conference && conference.status !== 'completed' && items.filter(i => i.checked).length > 0 && (
              <div className="bg-green-50 px-4 py-4 border-t border-green-200 flex justify-center">
                <button
                  onClick={handleFinalizeConference}
                  className="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium text-lg shadow-lg"
                >
                  🏁 Finalizar Auditoria ({items.filter(i => i.checked).length} itens conferidos)
                </button>
              </div>
            )}
          </div>
        )}

        {/* Mensagem quando não há itens */}
        {items.length === 0 && (
          <div className="bg-white rounded-lg shadow-md p-8 text-center">
            <p className="text-gray-500">Nenhum item na conferência</p>
          </div>
        )}

        {/* Botão Voltar */}
        <div className="mt-6">
          <button
            onClick={() => navigate('/hortfrut-lancador')}
            className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
          >
            ← Voltar para Lançador
          </button>
        </div>
      </div>
    </Layout>
  );
}
