import { useState, useEffect } from 'react';
import toast, { Toaster } from 'react-hot-toast';
import { api } from '../../utils/api';
import { useLoja } from '../../contexts/LojaContext';

export default function SuppliersTab() {
  const { lojaSelecionada, lojas } = useLoja();
  const [suppliers, setSuppliers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [form, setForm] = useState({
    fantasyName: '',
    legalName: '',
    cnpj: '',
    phone: '',
    email: '',
    address: '',
    observations: '',
    cod_loja: null
  });

  useEffect(() => {
    loadSuppliers();
  }, [lojaSelecionada]);

  // Função para obter nome da loja
  const getNomeLoja = (codLoja) => {
    if (!codLoja) return <span className="text-gray-400">-</span>;
    const loja = lojas.find(l => l.COD_LOJA === codLoja);
    return loja?.APELIDO || `Loja ${codLoja}`;
  };

  const loadSuppliers = async () => {
    try {
      setLoading(true);
      const params = lojaSelecionada !== null ? `?cod_loja=${lojaSelecionada}` : '';
      const response = await api.get(`/suppliers${params}`);
      setSuppliers(response.data || []);
    } catch (err) {
      console.error('Erro ao carregar fornecedores:', err);
      toast.error('Erro ao carregar fornecedores');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenModal = (supplier = null) => {
    if (supplier) {
      setEditingSupplier(supplier);
      setForm({
        fantasyName: supplier.fantasyName || '',
        legalName: supplier.legalName || '',
        cnpj: supplier.cnpj || '',
        phone: supplier.phone || '',
        email: supplier.email || '',
        address: supplier.address || '',
        observations: supplier.observations || '',
        cod_loja: supplier.cod_loja || null
      });
    } else {
      setEditingSupplier(null);
      setForm({
        fantasyName: '',
        legalName: '',
        cnpj: '',
        phone: '',
        email: '',
        address: '',
        observations: '',
        cod_loja: lojaSelecionada || (lojas.length > 0 ? lojas[0].COD_LOJA : null)
      });
    }
    setShowModal(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setEditingSupplier(null);
  };

  const formatCNPJ = (value) => {
    const numbers = value.replace(/\D/g, '');
    if (numbers.length <= 14) {
      return numbers
        .replace(/(\d{2})(\d)/, '$1.$2')
        .replace(/(\d{3})(\d)/, '$1.$2')
        .replace(/(\d{3})(\d)/, '$1/$2')
        .replace(/(\d{4})(\d)/, '$1-$2');
    }
    return value;
  };

  const formatPhone = (value) => {
    const numbers = value.replace(/\D/g, '');
    if (numbers.length <= 11) {
      if (numbers.length <= 10) {
        return numbers.replace(/(\d{2})(\d)/, '($1) $2').replace(/(\d{4})(\d)/, '$1-$2');
      } else {
        return numbers.replace(/(\d{2})(\d)/, '($1) $2').replace(/(\d{5})(\d)/, '$1-$2');
      }
    }
    return value;
  };

  const handleSave = async () => {
    if (!form.fantasyName.trim()) {
      toast.error('Nome fantasia é obrigatório');
      return;
    }

    if (!form.cod_loja) {
      toast.error('Selecione uma loja');
      return;
    }

    try {
      if (editingSupplier) {
        await api.put(`/suppliers/${editingSupplier.id}`, form);
        toast.success('Fornecedor atualizado!');
      } else {
        await api.post('/suppliers', form);
        toast.success('Fornecedor criado!');
      }
      handleCloseModal();
      loadSuppliers();
    } catch (err) {
      console.error('Erro ao salvar fornecedor:', err);
      toast.error(err.response?.data?.error || 'Erro ao salvar fornecedor');
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Tem certeza que deseja excluir este fornecedor?')) return;

    try {
      await api.delete(`/suppliers/${id}`);
      toast.success('Fornecedor excluído!');
      loadSuppliers();
    } catch (err) {
      console.error('Erro ao excluir fornecedor:', err);
      toast.error('Erro ao excluir fornecedor');
    }
  };

  const handleToggleActive = async (supplier) => {
    try {
      await api.put(`/suppliers/${supplier.id}`, { active: !supplier.active });
      loadSuppliers();
      toast.success('Status alterado!');
    } catch (err) {
      console.error('Erro ao alterar status:', err);
      toast.error('Erro ao alterar status');
    }
  };

  const filteredSuppliers = suppliers.filter(s => {
    const search = searchTerm.toLowerCase();
    return (
      s.fantasyName?.toLowerCase().includes(search) ||
      s.legalName?.toLowerCase().includes(search) ||
      s.cnpj?.includes(search)
    );
  });

  if (loading) {
    return (
      <div className="p-8 text-center">
        <p className="text-gray-500">Carregando fornecedores...</p>
      </div>
    );
  }

  return (
    <div>
      <Toaster />

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h2 className="text-xl font-bold text-gray-800">Fornecedores</h2>
          <p className="text-sm text-gray-600">Gerencie seus fornecedores de HortFruti</p>
        </div>
        <button
          onClick={() => handleOpenModal()}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
        >
          + Novo Fornecedor
        </button>
      </div>

      {/* Busca */}
      <div className="mb-4">
        <input
          type="text"
          placeholder="Buscar por nome, razão social ou CNPJ..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {/* Lista */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        {filteredSuppliers.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            {searchTerm ? 'Nenhum fornecedor encontrado' : 'Nenhum fornecedor cadastrado'}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Nome Fantasia</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Razão Social</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Loja</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">CNPJ</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Telefone</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Status</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {filteredSuppliers.map((supplier) => (
                  <tr key={supplier.id} className={!supplier.active ? 'bg-gray-50' : 'hover:bg-gray-50'}>
                    <td className="px-4 py-3">
                      <p className={`font-medium ${!supplier.active ? 'text-gray-400' : 'text-gray-900'}`}>
                        {supplier.fantasyName}
                      </p>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">{supplier.legalName || '-'}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">{getNomeLoja(supplier.cod_loja)}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">{supplier.cnpj || '-'}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">{supplier.phone || '-'}</td>
                    <td className="px-4 py-3 text-center">
                      <button
                        onClick={() => handleToggleActive(supplier)}
                        className={`px-3 py-1 rounded-full text-xs font-medium ${
                          supplier.active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                        }`}
                      >
                        {supplier.active ? 'Ativo' : 'Inativo'}
                      </button>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <div className="flex justify-center gap-2">
                        <button onClick={() => handleOpenModal(supplier)} className="text-blue-600 hover:text-blue-800 text-sm">
                          Editar
                        </button>
                        <button onClick={() => handleDelete(supplier.id)} className="text-red-600 hover:text-red-800 text-sm">
                          Excluir
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="bg-gradient-to-r from-blue-600 to-indigo-700 text-white p-4 rounded-t-lg">
              <h3 className="text-lg font-bold">
                {editingSupplier ? 'Editar Fornecedor' : 'Novo Fornecedor'}
              </h3>
            </div>

            <div className="p-6 space-y-4">
              {/* Campo de Loja */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Loja *</label>
                <select
                  value={form.cod_loja || ''}
                  onChange={(e) => setForm({ ...form, cod_loja: e.target.value ? parseInt(e.target.value) : null })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
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

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nome Fantasia *</label>
                <input
                  type="text"
                  value={form.fantasyName}
                  onChange={(e) => setForm({ ...form, fantasyName: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="Nome fantasia do fornecedor"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Razão Social</label>
                <input
                  type="text"
                  value={form.legalName}
                  onChange={(e) => setForm({ ...form, legalName: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="Razão social completa"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">CNPJ</label>
                <input
                  type="text"
                  value={form.cnpj}
                  onChange={(e) => setForm({ ...form, cnpj: formatCNPJ(e.target.value) })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="00.000.000/0000-00"
                  maxLength={18}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Telefone</label>
                <input
                  type="text"
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: formatPhone(e.target.value) })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="(00) 00000-0000"
                  maxLength={15}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="email@fornecedor.com"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Endereço</label>
                <textarea
                  value={form.address}
                  onChange={(e) => setForm({ ...form, address: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="Endereço completo"
                  rows={2}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Observações</label>
                <textarea
                  value={form.observations}
                  onChange={(e) => setForm({ ...form, observations: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="Observações sobre o fornecedor..."
                  rows={2}
                />
              </div>

              <div className="flex gap-3 pt-4 border-t">
                <button onClick={handleCloseModal} className="flex-1 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300">
                  Cancelar
                </button>
                <button onClick={handleSave} className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
                  Salvar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
