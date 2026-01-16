import { useState, useEffect } from 'react';
import { fetchMyCompany, updateMyCompany, fetchAllCompanies, createCompany, updateCompany, deleteCompany } from '../../services/companies.service';
import { useAuth } from '../../contexts/AuthContext';

export default function EmpresaConfigTab() {
  const { user } = useAuth();
  const [empresaPrincipal, setEmpresaPrincipal] = useState(null);
  const [lojas, setLojas] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  // Estados para modal de visualização
  const [showViewModal, setShowViewModal] = useState(false);
  const [viewingCompany, setViewingCompany] = useState(null);

  // Estados para modal de edição
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingCompany, setEditingCompany] = useState(null);
  const [editFormData, setEditFormData] = useState({});

  // Estados para cadastro de nova loja
  const [showNewStoreForm, setShowNewStoreForm] = useState(false);
  const [newStoreData, setNewStoreData] = useState({
    nomeFantasia: '',
    razaoSocial: '',
    cnpj: '',
    identificador: '',
    cep: '',
    rua: '',
    numero: '',
    complemento: '',
    bairro: '',
    cidade: '',
    estado: '',
    telefone: '',
    email: '',
    responsavelNome: '',
    responsavelEmail: '',
    responsavelTelefone: ''
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setIsLoading(true);
      setError(null);

      // Carregar empresa principal
      const empresa = await fetchMyCompany();
      setEmpresaPrincipal(empresa);

      // Se for master, carregar todas as lojas/empresas
      if (user?.isMaster) {
        try {
          const allCompanies = await fetchAllCompanies();
          // Filtra para mostrar apenas as lojas adicionais (excluindo a principal)
          if (empresa && allCompanies) {
            const lojasAdicionais = allCompanies.filter(c => c.id !== empresa.id);
            setLojas(lojasAdicionais);
          }
        } catch (err) {
          console.log('Não foi possível carregar lojas adicionais');
        }
      }
    } catch (err) {
      setError('Erro ao carregar dados da empresa');
      console.error('Load error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleView = (company) => {
    setViewingCompany(company);
    setShowViewModal(true);
  };

  const handleEdit = (company) => {
    setEditingCompany(company);
    setEditFormData({
      nomeFantasia: company.nomeFantasia || '',
      razaoSocial: company.razaoSocial || '',
      cnpj: company.cnpj || '',
      identificador: company.identificador || '',
      cep: company.cep || '',
      rua: company.rua || '',
      numero: company.numero || '',
      complemento: company.complemento || '',
      bairro: company.bairro || '',
      cidade: company.cidade || '',
      estado: company.estado || '',
      telefone: company.telefone || '',
      email: company.email || '',
      responsavelNome: company.responsavelNome || '',
      responsavelEmail: company.responsavelEmail || '',
      responsavelTelefone: company.responsavelTelefone || ''
    });
    setShowEditModal(true);
  };

  const handleSaveEdit = async (e) => {
    e.preventDefault();
    try {
      setError(null);

      if (editingCompany.id === empresaPrincipal?.id) {
        // Atualizar empresa principal
        await updateMyCompany(editFormData);
      } else {
        // Atualizar loja adicional
        await updateCompany(editingCompany.id, editFormData);
      }

      setSuccess('Dados atualizados com sucesso!');
      setShowEditModal(false);
      await loadData();

      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError(err.response?.data?.error || 'Erro ao atualizar dados');
    }
  };

  const handleNewStoreChange = (e) => {
    const { name, value } = e.target;
    setNewStoreData(prev => ({ ...prev, [name]: value }));
  };

  const handleCreateStore = async (e) => {
    e.preventDefault();
    try {
      setError(null);

      if (!newStoreData.nomeFantasia || !newStoreData.razaoSocial || !newStoreData.cnpj) {
        setError('Preencha os campos obrigatórios: Nome Fantasia, Razão Social e CNPJ');
        return;
      }

      await createCompany(newStoreData);

      setSuccess('Nova loja cadastrada com sucesso!');
      setShowNewStoreForm(false);
      setNewStoreData({
        nomeFantasia: '',
        razaoSocial: '',
        cnpj: '',
        identificador: '',
        cep: '',
        rua: '',
        numero: '',
        complemento: '',
        bairro: '',
        cidade: '',
        estado: '',
        telefone: '',
        email: '',
        responsavelNome: '',
        responsavelEmail: '',
        responsavelTelefone: ''
      });
      await loadData();

      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError(err.response?.data?.error || 'Erro ao cadastrar loja');
    }
  };

  const handleDeleteStore = async (id) => {
    if (!window.confirm('Tem certeza que deseja excluir esta loja?')) return;

    try {
      await deleteCompany(id);
      setSuccess('Loja excluída com sucesso!');
      await loadData();
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError(err.response?.data?.error || 'Erro ao excluir loja');
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-lg">
          {error}
        </div>
      )}

      {success && (
        <div className="p-4 bg-green-50 border border-green-200 text-green-700 rounded-lg">
          {success}
        </div>
      )}

      {/* Seção: Cadastrar Nova Loja */}
      {user?.isMaster && (
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold text-gray-900">Cadastrar Nova Loja</h2>
            <button
              onClick={() => setShowNewStoreForm(!showNewStoreForm)}
              className="bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded-lg transition flex items-center gap-2"
            >
              {showNewStoreForm ? (
                <>
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                  Cancelar
                </>
              ) : (
                <>
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  Nova Loja
                </>
              )}
            </button>
          </div>

          {showNewStoreForm && (
            <form onSubmit={handleCreateStore} className="space-y-4 border-t pt-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Identificador da Loja
                  </label>
                  <input
                    type="text"
                    name="identificador"
                    value={newStoreData.identificador}
                    onChange={handleNewStoreChange}
                    placeholder="Ex: Loja 1, Filial Centro"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Nome Fantasia *
                  </label>
                  <input
                    type="text"
                    name="nomeFantasia"
                    value={newStoreData.nomeFantasia}
                    onChange={handleNewStoreChange}
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Razão Social *
                  </label>
                  <input
                    type="text"
                    name="razaoSocial"
                    value={newStoreData.razaoSocial}
                    onChange={handleNewStoreChange}
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    CNPJ *
                  </label>
                  <input
                    type="text"
                    name="cnpj"
                    value={newStoreData.cnpj}
                    onChange={handleNewStoreChange}
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Telefone
                  </label>
                  <input
                    type="text"
                    name="telefone"
                    value={newStoreData.telefone}
                    onChange={handleNewStoreChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Email
                  </label>
                  <input
                    type="email"
                    name="email"
                    value={newStoreData.email}
                    onChange={handleNewStoreChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">CEP</label>
                  <input
                    type="text"
                    name="cep"
                    value={newStoreData.cep}
                    onChange={handleNewStoreChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Rua</label>
                  <input
                    type="text"
                    name="rua"
                    value={newStoreData.rua}
                    onChange={handleNewStoreChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Número</label>
                  <input
                    type="text"
                    name="numero"
                    value={newStoreData.numero}
                    onChange={handleNewStoreChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Bairro</label>
                  <input
                    type="text"
                    name="bairro"
                    value={newStoreData.bairro}
                    onChange={handleNewStoreChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Cidade</label>
                  <input
                    type="text"
                    name="cidade"
                    value={newStoreData.cidade}
                    onChange={handleNewStoreChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Estado</label>
                  <input
                    type="text"
                    name="estado"
                    value={newStoreData.estado}
                    onChange={handleNewStoreChange}
                    maxLength={2}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Complemento</label>
                  <input
                    type="text"
                    name="complemento"
                    value={newStoreData.complemento}
                    onChange={handleNewStoreChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div className="flex justify-end pt-4">
                <button
                  type="submit"
                  className="bg-blue-500 hover:bg-blue-600 text-white px-6 py-2 rounded-lg transition"
                >
                  Cadastrar Loja
                </button>
              </div>
            </form>
          )}
        </div>
      )}

      {/* Card da Empresa Principal */}
      <div className="bg-white rounded-lg shadow">
        <div className="p-6 border-b border-gray-200">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-3">
              <div className="bg-orange-100 p-3 rounded-full">
                <svg className="w-6 h-6 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                </svg>
              </div>
              <div>
                <h2 className="text-xl font-semibold text-gray-900">Empresa Principal</h2>
                <p className="text-sm text-gray-500">Cadastrada no primeiro acesso</p>
              </div>
            </div>
            {empresaPrincipal?.identificador && (
              <span className="bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-sm font-medium">
                {empresaPrincipal.identificador}
              </span>
            )}
          </div>
        </div>

        {empresaPrincipal ? (
          <div className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <div>
                <p className="text-sm text-gray-500">Nome Fantasia</p>
                <p className="text-lg font-semibold text-gray-900">{empresaPrincipal.nomeFantasia}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Razão Social</p>
                <p className="text-lg font-medium text-gray-900">{empresaPrincipal.razaoSocial}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">CNPJ</p>
                <p className="text-lg font-medium text-gray-900">{empresaPrincipal.cnpj}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Endereço</p>
                <p className="text-lg font-medium text-gray-900">
                  {empresaPrincipal.cidade && empresaPrincipal.estado
                    ? `${empresaPrincipal.cidade} - ${empresaPrincipal.estado}`
                    : '-'}
                </p>
              </div>
            </div>

            <div className="flex gap-3 mt-6 pt-6 border-t border-gray-200">
              <button
                onClick={() => handleView(empresaPrincipal)}
                className="bg-gray-100 hover:bg-gray-200 text-gray-700 px-4 py-2 rounded-lg transition flex items-center gap-2"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                </svg>
                Ver Todos os Dados
              </button>
              <button
                onClick={() => handleEdit(empresaPrincipal)}
                className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-lg transition flex items-center gap-2"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
                Editar Dados
              </button>
            </div>
          </div>
        ) : (
          <div className="p-6 text-center text-gray-500">
            Nenhuma empresa cadastrada
          </div>
        )}
      </div>

      {/* Lista de Lojas Adicionais */}
      {user?.isMaster && lojas.length > 0 && (
        <div className="bg-white rounded-lg shadow">
          <div className="p-6 border-b border-gray-200">
            <h2 className="text-xl font-semibold text-gray-900">Lojas Cadastradas</h2>
            <p className="text-sm text-gray-500 mt-1">{lojas.length} loja(s) adicional(is)</p>
          </div>

          <div className="divide-y divide-gray-200">
            {lojas.map((loja) => (
              <div key={loja.id} className="p-6">
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-3">
                      <h3 className="text-lg font-semibold text-gray-900">{loja.nomeFantasia}</h3>
                      {loja.identificador && (
                        <span className="bg-green-100 text-green-800 px-2 py-1 rounded text-xs font-medium">
                          {loja.identificador}
                        </span>
                      )}
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                      <div>
                        <span className="text-gray-500">CNPJ:</span>
                        <span className="ml-2 text-gray-900">{loja.cnpj}</span>
                      </div>
                      <div>
                        <span className="text-gray-500">Cidade:</span>
                        <span className="ml-2 text-gray-900">{loja.cidade || '-'}</span>
                      </div>
                      <div>
                        <span className="text-gray-500">Telefone:</span>
                        <span className="ml-2 text-gray-900">{loja.telefone || '-'}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-2 ml-4">
                    <button
                      onClick={() => handleView(loja)}
                      className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition"
                      title="Ver detalhes"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                    </button>
                    <button
                      onClick={() => handleEdit(loja)}
                      className="p-2 text-blue-500 hover:text-blue-700 hover:bg-blue-50 rounded-lg transition"
                      title="Editar"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                    </button>
                    <button
                      onClick={() => handleDeleteStore(loja.id)}
                      className="p-2 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-lg transition"
                      title="Excluir"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Modal de Visualização */}
      {showViewModal && viewingCompany && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200 flex justify-between items-center">
              <h3 className="text-xl font-semibold text-gray-900">Dados da Empresa</h3>
              <button
                onClick={() => setShowViewModal(false)}
                className="text-gray-500 hover:text-gray-700"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="p-6 space-y-6">
              {/* Dados Básicos */}
              <div>
                <h4 className="text-lg font-semibold text-gray-800 mb-3">Dados Básicos</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-gray-500">Identificador</p>
                    <p className="font-medium">{viewingCompany.identificador || '-'}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Nome Fantasia</p>
                    <p className="font-medium">{viewingCompany.nomeFantasia}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Razão Social</p>
                    <p className="font-medium">{viewingCompany.razaoSocial}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">CNPJ</p>
                    <p className="font-medium">{viewingCompany.cnpj}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Telefone</p>
                    <p className="font-medium">{viewingCompany.telefone || '-'}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Email</p>
                    <p className="font-medium">{viewingCompany.email || '-'}</p>
                  </div>
                </div>
              </div>

              {/* Endereço */}
              <div>
                <h4 className="text-lg font-semibold text-gray-800 mb-3">Endereço</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-gray-500">CEP</p>
                    <p className="font-medium">{viewingCompany.cep || '-'}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Rua</p>
                    <p className="font-medium">{viewingCompany.rua || '-'}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Número</p>
                    <p className="font-medium">{viewingCompany.numero || '-'}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Complemento</p>
                    <p className="font-medium">{viewingCompany.complemento || '-'}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Bairro</p>
                    <p className="font-medium">{viewingCompany.bairro || '-'}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Cidade</p>
                    <p className="font-medium">{viewingCompany.cidade || '-'}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Estado</p>
                    <p className="font-medium">{viewingCompany.estado || '-'}</p>
                  </div>
                </div>
              </div>

              {/* Responsável */}
              <div>
                <h4 className="text-lg font-semibold text-gray-800 mb-3">Responsável</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-gray-500">Nome</p>
                    <p className="font-medium">{viewingCompany.responsavelNome || '-'}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Email</p>
                    <p className="font-medium">{viewingCompany.responsavelEmail || '-'}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Telefone</p>
                    <p className="font-medium">{viewingCompany.responsavelTelefone || '-'}</p>
                  </div>
                </div>
              </div>
            </div>
            <div className="p-6 border-t border-gray-200 flex justify-end gap-3">
              <button
                onClick={() => setShowViewModal(false)}
                className="bg-gray-100 hover:bg-gray-200 text-gray-700 px-4 py-2 rounded-lg transition"
              >
                Fechar
              </button>
              <button
                onClick={() => {
                  setShowViewModal(false);
                  handleEdit(viewingCompany);
                }}
                className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-lg transition"
              >
                Editar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Edição */}
      {showEditModal && editingCompany && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200 flex justify-between items-center">
              <h3 className="text-xl font-semibold text-gray-900">Editar Empresa</h3>
              <button
                onClick={() => setShowEditModal(false)}
                className="text-gray-500 hover:text-gray-700"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <form onSubmit={handleSaveEdit} className="p-6 space-y-6">
              {/* Dados Básicos */}
              <div>
                <h4 className="text-lg font-semibold text-gray-800 mb-3">Dados Básicos</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Identificador</label>
                    <input
                      type="text"
                      value={editFormData.identificador || ''}
                      onChange={(e) => setEditFormData({ ...editFormData, identificador: e.target.value })}
                      placeholder="Ex: Loja 1"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Nome Fantasia *</label>
                    <input
                      type="text"
                      value={editFormData.nomeFantasia}
                      onChange={(e) => setEditFormData({ ...editFormData, nomeFantasia: e.target.value })}
                      required
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Razão Social *</label>
                    <input
                      type="text"
                      value={editFormData.razaoSocial}
                      onChange={(e) => setEditFormData({ ...editFormData, razaoSocial: e.target.value })}
                      required
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">CNPJ *</label>
                    <input
                      type="text"
                      value={editFormData.cnpj}
                      onChange={(e) => setEditFormData({ ...editFormData, cnpj: e.target.value })}
                      required
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Telefone</label>
                    <input
                      type="text"
                      value={editFormData.telefone || ''}
                      onChange={(e) => setEditFormData({ ...editFormData, telefone: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                    <input
                      type="email"
                      value={editFormData.email || ''}
                      onChange={(e) => setEditFormData({ ...editFormData, email: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
              </div>

              {/* Endereço */}
              <div>
                <h4 className="text-lg font-semibold text-gray-800 mb-3">Endereço</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">CEP</label>
                    <input
                      type="text"
                      value={editFormData.cep || ''}
                      onChange={(e) => setEditFormData({ ...editFormData, cep: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Rua</label>
                    <input
                      type="text"
                      value={editFormData.rua || ''}
                      onChange={(e) => setEditFormData({ ...editFormData, rua: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Número</label>
                    <input
                      type="text"
                      value={editFormData.numero || ''}
                      onChange={(e) => setEditFormData({ ...editFormData, numero: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Complemento</label>
                    <input
                      type="text"
                      value={editFormData.complemento || ''}
                      onChange={(e) => setEditFormData({ ...editFormData, complemento: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Bairro</label>
                    <input
                      type="text"
                      value={editFormData.bairro || ''}
                      onChange={(e) => setEditFormData({ ...editFormData, bairro: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Cidade</label>
                    <input
                      type="text"
                      value={editFormData.cidade || ''}
                      onChange={(e) => setEditFormData({ ...editFormData, cidade: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Estado</label>
                    <input
                      type="text"
                      value={editFormData.estado || ''}
                      onChange={(e) => setEditFormData({ ...editFormData, estado: e.target.value })}
                      maxLength={2}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
              </div>

              {/* Responsável */}
              <div>
                <h4 className="text-lg font-semibold text-gray-800 mb-3">Responsável</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Nome</label>
                    <input
                      type="text"
                      value={editFormData.responsavelNome || ''}
                      onChange={(e) => setEditFormData({ ...editFormData, responsavelNome: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                    <input
                      type="email"
                      value={editFormData.responsavelEmail || ''}
                      onChange={(e) => setEditFormData({ ...editFormData, responsavelEmail: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Telefone</label>
                    <input
                      type="text"
                      value={editFormData.responsavelTelefone || ''}
                      onChange={(e) => setEditFormData({ ...editFormData, responsavelTelefone: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
                <button
                  type="button"
                  onClick={() => setShowEditModal(false)}
                  className="bg-gray-100 hover:bg-gray-200 text-gray-700 px-4 py-2 rounded-lg transition"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-lg transition"
                >
                  Salvar Alterações
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
