import { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { fetchMyCompany, updateMyCompany } from '../../services/companies.service';
import api from '../../services/api';

export default function EmpresaTab() {
  const { user } = useAuth();
  const [company, setCompany] = useState(null);
  const [masterUser, setMasterUser] = useState(null);
  const [isEditingCompany, setIsEditingCompany] = useState(false);
  const [isEditingUser, setIsEditingUser] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [showPassword, setShowPassword] = useState(false);

  const [companyFormData, setCompanyFormData] = useState({
    nomeFantasia: '',
    razaoSocial: '',
    cnpj: '',
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

  const [userFormData, setUserFormData] = useState({
    name: '',
    username: '',
    email: '',
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setIsLoading(true);
      setError(null);

      // Carregar dados da empresa
      const companyData = await fetchMyCompany();
      setCompany(companyData);
      setCompanyFormData({
        nomeFantasia: companyData.nomeFantasia || '',
        razaoSocial: companyData.razaoSocial || '',
        cnpj: companyData.cnpj || '',
        cep: companyData.cep || '',
        rua: companyData.rua || '',
        numero: companyData.numero || '',
        complemento: companyData.complemento || '',
        bairro: companyData.bairro || '',
        cidade: companyData.cidade || '',
        estado: companyData.estado || '',
        telefone: companyData.telefone || '',
        email: companyData.email || '',
        responsavelNome: companyData.responsavelNome || '',
        responsavelEmail: companyData.responsavelEmail || '',
        responsavelTelefone: companyData.responsavelTelefone || ''
      });

      // Carregar dados do usuário master
      if (user?.isMaster) {
        const response = await api.get('/auth/me');
        const userData = response.data.user;
        setMasterUser(userData);
        setUserFormData({
          name: userData.name || '',
          username: userData.username || '',
          email: userData.email || '',
          currentPassword: '',
          newPassword: '',
          confirmPassword: ''
        });
      }
    } catch (err) {
      setError('Erro ao carregar dados');
      console.error('Load data error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCompanyInputChange = (e) => {
    const { name, value } = e.target;
    setCompanyFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleUserInputChange = (e) => {
    const { name, value } = e.target;
    setUserFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSaveCompany = async (e) => {
    e.preventDefault();
    try {
      setError(null);
      setSuccess(null);

      await updateMyCompany(companyFormData);

      setSuccess('Dados da empresa atualizados com sucesso!');
      setIsEditingCompany(false);
      await loadData();
    } catch (err) {
      setError(err.response?.data?.error || 'Erro ao salvar empresa');
      console.error('Save company error:', err);
    }
  };

  const handleSaveUser = async (e) => {
    e.preventDefault();
    try {
      setError(null);
      setSuccess(null);

      // Validar senhas se estiver alterando
      if (userFormData.newPassword) {
        if (!userFormData.currentPassword) {
          setError('Senha atual é obrigatória para alterar a senha');
          return;
        }
        if (userFormData.newPassword !== userFormData.confirmPassword) {
          setError('As senhas não coincidem');
          return;
        }
        if (userFormData.newPassword.length < 6) {
          setError('A nova senha deve ter no mínimo 6 caracteres');
          return;
        }
      }

      const updateData = {
        name: userFormData.name,
        username: userFormData.username,
        email: userFormData.email
      };

      if (userFormData.newPassword) {
        updateData.currentPassword = userFormData.currentPassword;
        updateData.newPassword = userFormData.newPassword;
      }

      await api.put('/auth/update-profile', updateData);

      setSuccess('Dados do usuário atualizados com sucesso!');
      setIsEditingUser(false);
      setUserFormData(prev => ({
        ...prev,
        currentPassword: '',
        newPassword: '',
        confirmPassword: ''
      }));
      await loadData();
    } catch (err) {
      setError(err.response?.data?.error || 'Erro ao salvar usuário');
      console.error('Save user error:', err);
    }
  };

  const handleCancel = () => {
    setIsEditingCompany(false);
    setIsEditingUser(false);
    setError(null);
    setSuccess(null);
    loadData();
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

      {/* Dados da Empresa */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-semibold text-gray-900">Dados da Empresa</h2>
          {!isEditingCompany && (
            <button
              onClick={() => setIsEditingCompany(true)}
              className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-lg transition"
            >
              Editar
            </button>
          )}
        </div>

        {!company ? (
          <p className="text-gray-500 text-center py-8">Nenhuma empresa vinculada a este usuário</p>
        ) : isEditingCompany ? (
          <form onSubmit={handleSaveCompany}>
            <div className="space-y-6">
              {/* Dados Básicos */}
              <div>
                <h3 className="text-lg font-semibold text-gray-800 mb-4">Dados Básicos</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Nome Fantasia *
                    </label>
                    <input
                      type="text"
                      name="nomeFantasia"
                      value={companyFormData.nomeFantasia}
                      onChange={handleCompanyInputChange}
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
                      value={companyFormData.razaoSocial}
                      onChange={handleCompanyInputChange}
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
                      value={companyFormData.cnpj}
                      onChange={handleCompanyInputChange}
                      required
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Telefone
                    </label>
                    <input
                      type="text"
                      name="telefone"
                      value={companyFormData.telefone}
                      onChange={handleCompanyInputChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Email
                    </label>
                    <input
                      type="email"
                      name="email"
                      value={companyFormData.email}
                      onChange={handleCompanyInputChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                </div>
              </div>

              {/* Endereço */}
              <div className="pt-6 border-t border-gray-200">
                <h3 className="text-lg font-semibold text-gray-800 mb-4">Endereço</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      CEP
                    </label>
                    <input
                      type="text"
                      name="cep"
                      value={companyFormData.cep}
                      onChange={handleCompanyInputChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Rua
                    </label>
                    <input
                      type="text"
                      name="rua"
                      value={companyFormData.rua}
                      onChange={handleCompanyInputChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Número
                    </label>
                    <input
                      type="text"
                      name="numero"
                      value={companyFormData.numero}
                      onChange={handleCompanyInputChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Complemento
                    </label>
                    <input
                      type="text"
                      name="complemento"
                      value={companyFormData.complemento}
                      onChange={handleCompanyInputChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Bairro
                    </label>
                    <input
                      type="text"
                      name="bairro"
                      value={companyFormData.bairro}
                      onChange={handleCompanyInputChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Cidade
                    </label>
                    <input
                      type="text"
                      name="cidade"
                      value={companyFormData.cidade}
                      onChange={handleCompanyInputChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Estado (UF)
                    </label>
                    <input
                      type="text"
                      name="estado"
                      value={companyFormData.estado}
                      onChange={handleCompanyInputChange}
                      maxLength="2"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                </div>
              </div>

              {/* Responsável */}
              <div className="pt-6 border-t border-gray-200">
                <h3 className="text-lg font-semibold text-gray-800 mb-4">Responsável</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Nome do Responsável
                    </label>
                    <input
                      type="text"
                      name="responsavelNome"
                      value={companyFormData.responsavelNome}
                      onChange={handleCompanyInputChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Email do Responsável
                    </label>
                    <input
                      type="email"
                      name="responsavelEmail"
                      value={companyFormData.responsavelEmail}
                      onChange={handleCompanyInputChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Telefone do Responsável
                    </label>
                    <input
                      type="text"
                      name="responsavelTelefone"
                      value={companyFormData.responsavelTelefone}
                      onChange={handleCompanyInputChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                </div>
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
          <div className="space-y-6">
            {/* Dados Básicos */}
            <div>
              <h3 className="text-lg font-semibold text-gray-800 mb-4">Dados Básicos</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                <div>
                  <p className="text-sm text-gray-500">Telefone</p>
                  <p className="text-lg font-medium text-gray-900">{company.telefone || '-'}</p>
                </div>
                <div className="md:col-span-2">
                  <p className="text-sm text-gray-500">Email</p>
                  <p className="text-lg font-medium text-gray-900">{company.email || '-'}</p>
                </div>
              </div>
            </div>

            {/* Endereço */}
            <div className="pt-6 border-t border-gray-200">
              <h3 className="text-lg font-semibold text-gray-800 mb-4">Endereço</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-500">CEP</p>
                  <p className="text-lg font-medium text-gray-900">{company.cep || '-'}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Rua</p>
                  <p className="text-lg font-medium text-gray-900">{company.rua || '-'}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Número</p>
                  <p className="text-lg font-medium text-gray-900">{company.numero || '-'}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Complemento</p>
                  <p className="text-lg font-medium text-gray-900">{company.complemento || '-'}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Bairro</p>
                  <p className="text-lg font-medium text-gray-900">{company.bairro || '-'}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Cidade</p>
                  <p className="text-lg font-medium text-gray-900">{company.cidade || '-'}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Estado</p>
                  <p className="text-lg font-medium text-gray-900">{company.estado || '-'}</p>
                </div>
              </div>
            </div>

            {/* Responsável */}
            <div className="pt-6 border-t border-gray-200">
              <h3 className="text-lg font-semibold text-gray-800 mb-4">Responsável</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-500">Nome</p>
                  <p className="text-lg font-medium text-gray-900">{company.responsavelNome || '-'}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Email</p>
                  <p className="text-lg font-medium text-gray-900">{company.responsavelEmail || '-'}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Telefone</p>
                  <p className="text-lg font-medium text-gray-900">{company.responsavelTelefone || '-'}</p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Dados do Usuário Master - Só aparece se for master */}
      {user?.isMaster && masterUser && (
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-semibold text-gray-900">Usuário Administrador Master</h2>
            {!isEditingUser && (
              <button
                onClick={() => setIsEditingUser(true)}
                className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-lg transition"
              >
                Editar
              </button>
            )}
          </div>

          {isEditingUser ? (
            <form onSubmit={handleSaveUser}>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Nome Completo *
                  </label>
                  <input
                    type="text"
                    name="name"
                    value={userFormData.name}
                    onChange={handleUserInputChange}
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Nome de Usuário *
                  </label>
                  <input
                    type="text"
                    name="username"
                    value={userFormData.username}
                    onChange={handleUserInputChange}
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Email *
                  </label>
                  <input
                    type="email"
                    name="email"
                    value={userFormData.email}
                    onChange={handleUserInputChange}
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                <div className="pt-6 border-t border-gray-200">
                  <h3 className="text-lg font-semibold text-gray-800 mb-4">Alterar Senha (opcional)</h3>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Senha Atual
                      </label>
                      <div className="relative">
                        <input
                          type={showPassword ? "text" : "password"}
                          name="currentPassword"
                          value={userFormData.currentPassword}
                          onChange={handleUserInputChange}
                          className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                        >
                          {showPassword ? (
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                            </svg>
                          ) : (
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                            </svg>
                          )}
                        </button>
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Nova Senha
                      </label>
                      <input
                        type={showPassword ? "text" : "password"}
                        name="newPassword"
                        value={userFormData.newPassword}
                        onChange={handleUserInputChange}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Confirmar Nova Senha
                      </label>
                      <input
                        type={showPassword ? "text" : "password"}
                        name="confirmPassword"
                        value={userFormData.confirmPassword}
                        onChange={handleUserInputChange}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>
                  </div>
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
                <p className="text-sm text-gray-500">Nome Completo</p>
                <p className="text-lg font-medium text-gray-900">{masterUser.name}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Nome de Usuário</p>
                <p className="text-lg font-medium text-gray-900">{masterUser.username}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Email</p>
                <p className="text-lg font-medium text-gray-900">{masterUser.email}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Tipo</p>
                <p className="text-lg font-medium text-gray-900">
                  <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-orange-100 text-orange-800">
                    Administrador Master
                  </span>
                </p>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
