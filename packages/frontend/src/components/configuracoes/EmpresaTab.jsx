import { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { fetchMyCompany, updateMyCompany, fetchAllCompanies, createCompany } from '../../services/companies.service';

export default function EmpresaTab() {
  const { user } = useAuth();
  const [company, setCompany] = useState(null);
  const [allCompanies, setAllCompanies] = useState([]);
  const [isEditing, setIsEditing] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [showCreateForm, setShowCreateForm] = useState(false);

  const [formData, setFormData] = useState({
    nomeFantasia: '',
    razaoSocial: '',
    cnpj: '',
    adminEmail: '',
    adminPassword: ''
  });

  useEffect(() => {
    loadCompanyData();
  }, []);

  const loadCompanyData = async () => {
    try {
      setIsLoading(true);
      setError(null);

      if (user?.type === 'admin') {
        if (user?.isMaster) {
          // Master can see all companies
          const companies = await fetchAllCompanies();
          setAllCompanies(companies || []);
        } else {
          // Regular admin sees their company
          const companyData = await fetchMyCompany();
          setCompany(companyData);
          setFormData({
            nomeFantasia: companyData.nomeFantasia || '',
            razaoSocial: companyData.razaoSocial || '',
            cnpj: companyData.cnpj || '',
            adminEmail: '',
            adminPassword: ''
          });
        }
      }
    } catch (err) {
      setError('Erro ao carregar dados da empresa');
      console.error('Load company error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSave = async (e) => {
    e.preventDefault();
    try {
      setError(null);
      setSuccess(null);

      await updateMyCompany({
        nomeFantasia: formData.nomeFantasia,
        razaoSocial: formData.razaoSocial,
        cnpj: formData.cnpj
      });

      setSuccess('Empresa atualizada com sucesso!');
      setIsEditing(false);
      await loadCompanyData();
    } catch (err) {
      setError(err.response?.data?.error || 'Erro ao salvar empresa');
      console.error('Save company error:', err);
    }
  };

  const handleCreateCompany = async (e) => {
    e.preventDefault();
    try {
      setError(null);
      setSuccess(null);

      await createCompany(formData);

      setSuccess('Empresa criada com sucesso!');
      setShowCreateForm(false);
      setFormData({
        nomeFantasia: '',
        razaoSocial: '',
        cnpj: '',
        adminEmail: '',
        adminPassword: ''
      });
      await loadCompanyData();
    } catch (err) {
      setError(err.response?.data?.error || 'Erro ao criar empresa');
      console.error('Create company error:', err);
    }
  };

  const handleCancel = () => {
    setIsEditing(false);
    setShowCreateForm(false);
    if (company) {
      setFormData({
        nomeFantasia: company.nomeFantasia || '',
        razaoSocial: company.razaoSocial || '',
        cnpj: company.cnpj || '',
        adminEmail: '',
        adminPassword: ''
      });
    } else {
      setFormData({
        nomeFantasia: '',
        razaoSocial: '',
        cnpj: '',
        adminEmail: '',
        adminPassword: ''
      });
    }
    setError(null);
    setSuccess(null);
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  // Master user view - can create and manage multiple companies
  if (user?.isMaster) {
    return (
      <div className="space-y-6">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-semibold text-gray-900">Gerenciar Empresas</h2>
            <button
              onClick={() => setShowCreateForm(true)}
              className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-lg transition"
            >
              Criar Nova Empresa
            </button>
          </div>

          {error && (
            <div className="mb-4 p-4 bg-red-50 border border-red-200 text-red-700 rounded-lg">
              {error}
            </div>
          )}

          {success && (
            <div className="mb-4 p-4 bg-green-50 border border-green-200 text-green-700 rounded-lg">
              {success}
            </div>
          )}

          {showCreateForm && (
            <form onSubmit={handleCreateCompany} className="mb-6 p-6 bg-gray-50 rounded-lg border border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Nova Empresa</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Nome Fantasia *
                  </label>
                  <input
                    type="text"
                    name="nomeFantasia"
                    value={formData.nomeFantasia}
                    onChange={handleInputChange}
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Razão Social *
                  </label>
                  <input
                    type="text"
                    name="razaoSocial"
                    value={formData.razaoSocial}
                    onChange={handleInputChange}
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    CNPJ *
                  </label>
                  <input
                    type="text"
                    name="cnpj"
                    value={formData.cnpj}
                    onChange={handleInputChange}
                    required
                    placeholder="00.000.000/0000-00"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Email do Administrador *
                  </label>
                  <input
                    type="email"
                    name="adminEmail"
                    value={formData.adminEmail}
                    onChange={handleInputChange}
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Senha Inicial do Administrador *
                  </label>
                  <input
                    type="password"
                    name="adminPassword"
                    value={formData.adminPassword}
                    onChange={handleInputChange}
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>
              <div className="flex gap-2 mt-4">
                <button
                  type="submit"
                  className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-lg transition"
                >
                  Criar Empresa
                </button>
                <button
                  type="button"
                  onClick={handleCancel}
                  className="bg-gray-300 hover:bg-gray-400 text-gray-700 px-4 py-2 rounded-lg transition"
                >
                  Cancelar
                </button>
              </div>
            </form>
          )}

          <div className="space-y-4">
            {allCompanies.length === 0 ? (
              <p className="text-gray-500 text-center py-8">Nenhuma empresa cadastrada</p>
            ) : (
              allCompanies.map(comp => (
                <div key={comp.id} className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <p className="text-sm text-gray-500">Nome Fantasia</p>
                      <p className="font-medium text-gray-900">{comp.nomeFantasia}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">Razão Social</p>
                      <p className="font-medium text-gray-900">{comp.razaoSocial}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">CNPJ</p>
                      <p className="font-medium text-gray-900">{comp.cnpj}</p>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    );
  }

  // Regular admin view - can only edit their company
  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-semibold text-gray-900">Dados da Empresa</h2>
          {!isEditing && (
            <button
              onClick={() => setIsEditing(true)}
              className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-lg transition"
            >
              Editar
            </button>
          )}
        </div>

        {error && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 text-red-700 rounded-lg">
            {error}
          </div>
        )}

        {success && (
          <div className="mb-4 p-4 bg-green-50 border border-green-200 text-green-700 rounded-lg">
            {success}
          </div>
        )}

        {!company ? (
          <p className="text-gray-500 text-center py-8">Nenhuma empresa vinculada a este usuário</p>
        ) : isEditing ? (
          <form onSubmit={handleSave}>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Nome Fantasia *
                </label>
                <input
                  type="text"
                  name="nomeFantasia"
                  value={formData.nomeFantasia}
                  onChange={handleInputChange}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Razão Social *
                </label>
                <input
                  type="text"
                  name="razaoSocial"
                  value={formData.razaoSocial}
                  onChange={handleInputChange}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  CNPJ *
                </label>
                <input
                  type="text"
                  name="cnpj"
                  value={formData.cnpj}
                  onChange={handleInputChange}
                  required
                  placeholder="00.000.000/0000-00"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>
            <div className="flex gap-2 mt-6">
              <button
                type="submit"
                className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-lg transition"
              >
                Salvar
              </button>
              <button
                type="button"
                onClick={handleCancel}
                className="bg-gray-300 hover:bg-gray-400 text-gray-700 px-4 py-2 rounded-lg transition"
              >
                Cancelar
              </button>
            </div>
          </form>
        ) : (
          <div className="space-y-4">
            <div>
              <p className="text-sm text-gray-500">Nome Fantasia</p>
              <p className="text-lg font-medium text-gray-900">{company.nomeFantasia}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Razão Social</p>
              <p className="text-lg font-medium text-gray-900">{company.razaoSocial}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">CNPJ</p>
              <p className="text-lg font-medium text-gray-900">{company.cnpj}</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
