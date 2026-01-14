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
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [filter, setFilter] = useState('all'); // all, pending, checked
  const [searchTerm, setSearchTerm] = useState('');
  const [editingItem, setEditingItem] = useState(null);
  const [itemForm, setItemForm] = useState({
    newCost: '',
    box_id: '',
    boxQuantity: '',
    grossWeight: '',
    quality: '',
    observations: ''
  });

  useEffect(() => {
    loadConference();
    loadBoxes();
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

  const handleEditItem = (item) => {
    setEditingItem(item);
    setItemForm({
      newCost: item.newCost ? item.newCost.toString() : '',
      box_id: item.box_id ? item.box_id.toString() : '',
      boxQuantity: item.boxQuantity ? item.boxQuantity.toString() : '',
      grossWeight: item.grossWeight ? item.grossWeight.toString() : '',
      quality: item.quality || '',
      observations: item.observations || ''
    });
  };

  const handleSaveItem = async () => {
    if (!editingItem) return;

    setSaving(true);
    setError('');

    try {
      const payload = {
        newCost: itemForm.newCost ? parseFloat(itemForm.newCost) : null,
        box_id: itemForm.box_id ? parseInt(itemForm.box_id) : null,
        boxQuantity: itemForm.boxQuantity ? parseInt(itemForm.boxQuantity) : null,
        grossWeight: itemForm.grossWeight ? parseFloat(itemForm.grossWeight) : null,
        quality: itemForm.quality || null,
        observations: itemForm.observations || null,
        checked: true
      };

      await api.put(`/hortfrut/conferences/${id}/items/${editingItem.id}`, payload);

      // Recarregar conferência
      await loadConference();

      setEditingItem(null);
      setItemForm({
        newCost: '',
        box_id: '',
        boxQuantity: '',
        grossWeight: '',
        quality: '',
        observations: ''
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
    if (!itemForm.newCost || !editingItem) return { suggestedPrice: null, marginIfKeep: null, netWeight: null };

    const newCost = parseFloat(itemForm.newCost);
    let suggestedPrice = null;
    let marginIfKeep = null;
    let netWeight = null;

    // Calcular preço sugerido
    if (editingItem.referenceMargin) {
      const margin = parseFloat(editingItem.referenceMargin) / 100;
      suggestedPrice = newCost / (1 - margin);
    }

    // Calcular margem se manter preço
    if (editingItem.currentSalePrice) {
      const price = parseFloat(editingItem.currentSalePrice);
      marginIfKeep = ((price - newCost) / price) * 100;
    }

    // Calcular peso líquido
    if (itemForm.grossWeight && itemForm.box_id && itemForm.boxQuantity) {
      const box = boxes.find(b => b.id === parseInt(itemForm.box_id));
      if (box) {
        const gross = parseFloat(itemForm.grossWeight);
        const boxWeight = parseFloat(box.weight) * parseInt(itemForm.boxQuantity);
        netWeight = gross - boxWeight;
      }
    }

    return { suggestedPrice, marginIfKeep, netWeight };
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

  const { suggestedPrice, marginIfKeep, netWeight } = calculatePreviewValues();

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
                🥬 Conferência {new Date(conference.conferenceDate).toLocaleDateString('pt-BR')}
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
            <div className="flex gap-2">
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

        {/* Modal de edição */}
        {editingItem && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
              <div className="bg-gradient-to-r from-orange-500 to-red-600 text-white p-4 rounded-t-lg">
                <h3 className="text-lg font-bold">{editingItem.productName}</h3>
                <p className="text-sm text-white/80">Código: {editingItem.barcode || '-'}</p>
              </div>

              <div className="p-6">
                {/* Informações atuais do produto */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6 bg-gray-50 rounded-lg p-4">
                  <div>
                    <p className="text-xs text-gray-500">Custo Atual</p>
                    <p className="font-semibold text-gray-800">
                      {editingItem.currentCost ? `R$ ${parseFloat(editingItem.currentCost).toFixed(2)}` : '-'}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Preço Venda</p>
                    <p className="font-semibold text-gray-800">
                      {editingItem.currentSalePrice ? `R$ ${parseFloat(editingItem.currentSalePrice).toFixed(2)}` : '-'}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Margem Ref.</p>
                    <p className="font-semibold text-gray-800">
                      {editingItem.referenceMargin ? `${parseFloat(editingItem.referenceMargin).toFixed(1)}%` : '-'}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Margem Atual</p>
                    <p className="font-semibold text-gray-800">
                      {editingItem.currentMargin ? `${parseFloat(editingItem.currentMargin).toFixed(1)}%` : '-'}
                    </p>
                  </div>
                </div>

                {/* Formulário de conferência */}
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        💰 Novo Custo (R$):
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        value={itemForm.newCost}
                        onChange={(e) => setItemForm({ ...itemForm, newCost: e.target.value })}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500"
                        placeholder="Ex: 5.50"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        📦 Tipo de Caixa:
                      </label>
                      <select
                        value={itemForm.box_id}
                        onChange={(e) => setItemForm({ ...itemForm, box_id: e.target.value })}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500"
                      >
                        <option value="">Selecione...</option>
                        {boxes.map(box => (
                          <option key={box.id} value={box.id}>
                            {box.name} ({parseFloat(box.weight).toFixed(3)} kg)
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        🔢 Qtd. de Caixas:
                      </label>
                      <input
                        type="number"
                        min="0"
                        value={itemForm.boxQuantity}
                        onChange={(e) => setItemForm({ ...itemForm, boxQuantity: e.target.value })}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500"
                        placeholder="Ex: 5"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        ⚖️ Peso Bruto (kg):
                      </label>
                      <input
                        type="number"
                        step="0.001"
                        value={itemForm.grossWeight}
                        onChange={(e) => setItemForm({ ...itemForm, grossWeight: e.target.value })}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500"
                        placeholder="Ex: 25.500"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        ⭐ Qualidade:
                      </label>
                      <select
                        value={itemForm.quality}
                        onChange={(e) => setItemForm({ ...itemForm, quality: e.target.value })}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500"
                      >
                        <option value="">Selecione...</option>
                        <option value="good">Boa</option>
                        <option value="regular">Regular</option>
                        <option value="bad">Ruim</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        📝 Observações:
                      </label>
                      <input
                        type="text"
                        value={itemForm.observations}
                        onChange={(e) => setItemForm({ ...itemForm, observations: e.target.value })}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500"
                        placeholder="Observações..."
                      />
                    </div>
                  </div>
                </div>

                {/* Cálculos em tempo real */}
                {(suggestedPrice || marginIfKeep || netWeight) && (
                  <div className="mt-6 bg-orange-50 border border-orange-200 rounded-lg p-4">
                    <h4 className="font-semibold text-orange-900 mb-3">📊 Cálculos:</h4>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      {netWeight !== null && (
                        <div>
                          <p className="text-xs text-orange-700">Peso Líquido</p>
                          <p className="font-bold text-orange-900">{netWeight.toFixed(3)} kg</p>
                        </div>
                      )}
                      {suggestedPrice !== null && (
                        <div>
                          <p className="text-xs text-orange-700">Preço Sugerido</p>
                          <p className="font-bold text-green-700">R$ {suggestedPrice.toFixed(2)}</p>
                          <p className="text-xs text-gray-500">
                            (Margem Ref: {editingItem.referenceMargin}%)
                          </p>
                        </div>
                      )}
                      {marginIfKeep !== null && (
                        <div>
                          <p className="text-xs text-orange-700">Margem se Manter Preço</p>
                          <p className={`font-bold ${marginIfKeep < 0 ? 'text-red-700' : marginIfKeep < 10 ? 'text-yellow-700' : 'text-green-700'}`}>
                            {marginIfKeep.toFixed(1)}%
                          </p>
                          <p className="text-xs text-gray-500">
                            (Preço: R$ {parseFloat(editingItem.currentSalePrice).toFixed(2)})
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Botões */}
                <div className="flex justify-end gap-3 mt-6 pt-4 border-t">
                  <button
                    onClick={() => setEditingItem(null)}
                    className="px-6 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={handleSaveItem}
                    disabled={saving}
                    className="px-6 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:opacity-50"
                  >
                    {saving ? '⏳ Salvando...' : '✅ Conferir Item'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Lista de itens */}
        <div className="bg-white rounded-lg shadow-md overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
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
                {filteredItems.length === 0 ? (
                  <tr>
                    <td colSpan="10" className="px-4 py-8 text-center text-gray-500">
                      Nenhum item encontrado
                    </td>
                  </tr>
                ) : (
                  filteredItems.map((item) => (
                    <tr key={item.id} className={item.checked ? 'bg-green-50' : 'hover:bg-gray-50'}>
                      <td className="px-4 py-3">
                        {item.checked ? (
                          <span className="text-green-600 text-xl">✅</span>
                        ) : (
                          <span className="text-yellow-600 text-xl">⏳</span>
                        )}
                      </td>
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
                        {conference.status !== 'completed' && (
                          <div className="flex justify-center gap-2">
                            <button
                              onClick={() => handleEditItem(item)}
                              className="text-blue-600 hover:text-blue-800 text-sm"
                              title="Conferir"
                            >
                              ✏️
                            </button>
                            {item.checked && (
                              <button
                                onClick={() => handleMarkUnchecked(item)}
                                className="text-yellow-600 hover:text-yellow-800 text-sm"
                                title="Desmarcar"
                              >
                                ↩️
                              </button>
                            )}
                          </div>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

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
