import { useState, useEffect } from 'react';
import { fetchMyCompany, updateMyCompany, fetchAllCompanies, createCompany, updateCompany, deleteCompany } from '../../services/companies.service';
import { useAuth } from '../../contexts/AuthContext';
import api from '../../services/api';
import Logo from '../Logo';

export default function EmpresaConfigTab() {
  const { user, updateUser } = useAuth();
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

  // Estados para segurança da conta (email e senha)
  const [securityData, setSecurityData] = useState({
    newEmail: '',
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });
  const [isChangingEmail, setIsChangingEmail] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [securityError, setSecurityError] = useState(null);
  const [securitySuccess, setSecuritySuccess] = useState(null);
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Estados para cadastro de nova loja
  const [showNewStoreForm, setShowNewStoreForm] = useState(false);
  const [newStoreData, setNewStoreData] = useState({
    nomeFantasia: '',
    razaoSocial: '',
    cnpj: '',
    codLoja: '',
    apelido: '',
    cep: '',
    rua: '',
    numero: '',
    complemento: '',
    bairro: '',
    cidade: '',
    estado: '',
    telefone: '',
    email: '',
    fotoFachadaUrl: null,
    responsavelNome: '',
    responsavelEmail: '',
    responsavelTelefone: ''
  });
  const [uploadingFachadaNew, setUploadingFachadaNew] = useState(false);

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
      codLoja: company.codLoja ?? '',
      apelido: company.apelido || '',
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
      responsavelTelefone: company.responsavelTelefone || '',
      metaChecklist: company.metaChecklist != null ? company.metaChecklist : 95,
      fotoFachadaUrl: company.fotoFachadaUrl || null
    });
    setShowEditModal(true);
  };

  // Upload da foto da fachada da loja
  const [uploadingFachada, setUploadingFachada] = useState(false);
  const handleUploadFachada = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingFachada(true);
    try {
      const fd = new FormData();
      fd.append('imagem', file);
      const res = await api.post('/checklist/upload-imagem', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      if (res.data?.url) {
        setEditFormData(f => ({ ...f, fotoFachadaUrl: res.data.url }));
      }
    } catch (err) {
      setError('Erro ao enviar foto da fachada.');
    } finally {
      setUploadingFachada(false);
      e.target.value = '';
    }
  };

  const handleSaveEdit = async (e) => {
    e.preventDefault();
    try {
      setError(null);
      console.log('📤 Salvando empresa - editFormData:', editFormData);
      console.log('📤 codLoja:', editFormData.codLoja, 'apelido:', editFormData.apelido);

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

  // Upload da foto da fachada no cadastro de nova loja
  const handleUploadFachadaNew = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingFachadaNew(true);
    try {
      const fd = new FormData();
      fd.append('imagem', file);
      const res = await api.post('/checklist/upload-imagem', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      if (res.data?.url) {
        setNewStoreData(f => ({ ...f, fotoFachadaUrl: res.data.url }));
      }
    } catch (err) {
      setError('Erro ao enviar foto da fachada.');
    } finally {
      setUploadingFachadaNew(false);
      e.target.value = '';
    }
  };

  // Calcula o proximo numero de loja automaticamente (max + 1)
  const getProximoCodLoja = () => {
    const numeros = [
      empresaPrincipal?.codLoja,
      ...lojas.map(l => l.codLoja),
    ].map(n => (n != null && !isNaN(Number(n)) ? Number(n) : null))
     .filter(n => n != null);
    return numeros.length ? Math.max(...numeros) + 1 : 1;
  };

  const handleCreateStore = async (e) => {
    e.preventDefault();
    try {
      setError(null);

      // Nenhum campo obrigatorio - cod_loja e definido automaticamente
      const payload = {
        ...newStoreData,
        codLoja: newStoreData.codLoja !== '' ? newStoreData.codLoja : getProximoCodLoja(),
      };

      await createCompany(payload);

      setSuccess('Nova loja cadastrada com sucesso!');
      setShowNewStoreForm(false);
      setNewStoreData({
        nomeFantasia: '',
        razaoSocial: '',
        cnpj: '',
        codLoja: '',
        apelido: '',
        cep: '',
        rua: '',
        numero: '',
        complemento: '',
        bairro: '',
        cidade: '',
        estado: '',
        telefone: '',
        email: '',
        fotoFachadaUrl: null,
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

  // Função para trocar email de recuperação
  const handleChangeEmail = async (e) => {
    e.preventDefault();
    setSecurityError(null);
    setSecuritySuccess(null);

    if (!securityData.newEmail) {
      setSecurityError('Digite o novo email');
      return;
    }

    // Validar formato do email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(securityData.newEmail)) {
      setSecurityError('Digite um email válido');
      return;
    }

    try {
      console.log('Atualizando email para:', securityData.newEmail);
      const response = await api.put('/auth/update-profile', {
        email: securityData.newEmail
      });
      console.log('Resposta da API:', response.data);

      setSecuritySuccess('Email de recuperação atualizado com sucesso!');
      setIsChangingEmail(false);
      setSecurityData(prev => ({ ...prev, newEmail: '' }));

      // Atualizar dados do usuário no contexto
      if (updateUser) {
        updateUser({ email: securityData.newEmail });
      }

      setTimeout(() => setSecuritySuccess(null), 5000);
    } catch (err) {
      console.error('Erro ao atualizar email:', err);
      const errorMsg = err.response?.data?.error || 'Erro ao atualizar email. Verifique sua conexão.';
      setSecurityError(errorMsg);
    }
  };

  // Função para trocar senha
  const handleChangePassword = async (e) => {
    e.preventDefault();
    setSecurityError(null);
    setSecuritySuccess(null);

    if (!securityData.currentPassword) {
      setSecurityError('Digite a senha atual');
      return;
    }

    if (!securityData.newPassword) {
      setSecurityError('Digite a nova senha');
      return;
    }

    if (securityData.newPassword.length < 6) {
      setSecurityError('A nova senha deve ter no mínimo 6 caracteres');
      return;
    }

    if (securityData.newPassword !== securityData.confirmPassword) {
      setSecurityError('As senhas não coincidem');
      return;
    }

    try {
      await api.put('/auth/update-profile', {
        currentPassword: securityData.currentPassword,
        newPassword: securityData.newPassword
      });

      setSecuritySuccess('Senha alterada com sucesso!');
      setIsChangingPassword(false);
      setSecurityData(prev => ({
        ...prev,
        currentPassword: '',
        newPassword: '',
        confirmPassword: ''
      }));

      setTimeout(() => setSecuritySuccess(null), 3000);
    } catch (err) {
      setSecurityError(err.response?.data?.error || 'Erro ao alterar senha');
    }
  };

  // Resetar estados de segurança ao fechar modal
  const handleCloseEditModal = () => {
    setShowEditModal(false);
    setIsChangingEmail(false);
    setIsChangingPassword(false);
    setSecurityData({
      newEmail: '',
      currentPassword: '',
      newPassword: '',
      confirmPassword: ''
    });
    setSecurityError(null);
    setSecuritySuccess(null);
  };

  // Estado para personalização White Label (hooks ANTES de qualquer return condicional)
  const [brandName, setBrandName] = useState('');
  const [brandNameSaved, setBrandNameSaved] = useState('');
  const [brandLogo, setBrandLogo] = useState('');
  const [brandLogoSaved, setBrandLogoSaved] = useState('');
  const [isSavingBrand, setIsSavingBrand] = useState(false);
  const [isUploadingLogo, setIsUploadingLogo] = useState(false);

  useEffect(() => {
    api.get('/config/configurations')
      .then(res => {
        const configs = res.data?.data || res.data || {};
        if (configs.client_brand_name) { setBrandName(configs.client_brand_name); setBrandNameSaved(configs.client_brand_name); }
        if (configs.client_logo_url) { setBrandLogo(configs.client_logo_url); setBrandLogoSaved(configs.client_logo_url); }
      })
      .catch(() => {});
  }, []);

  if (isLoading) {
    return (
      <div className="flex justify-center items-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  const saveBrandName = async () => {
    setIsSavingBrand(true);
    try {
      await api.post('/config/configurations', { client_brand_name: brandName || '', client_logo_url: brandLogo || '' });
      setBrandNameSaved(brandName);
      setBrandLogoSaved(brandLogo);
      if (Logo.clearCache) Logo.clearCache();
      setSuccess('Personalização salva! A página vai recarregar...');
      setTimeout(() => window.location.reload(), 1500);
    } catch (err) {
      setError('Erro ao salvar nome da marca');
      setTimeout(() => setError(null), 3000);
    }
    setIsSavingBrand(false);
  };

  const restoreLogo = async () => {
    setBrandName('');
    setBrandLogo('');
    setIsSavingBrand(true);
    try {
      await api.post('/config/configurations', { client_brand_name: '', client_logo_url: '' });
      setBrandNameSaved('');
      setBrandLogoSaved('');
      // Limpar cache do Logo pra nao piscar o antigo
      if (Logo.clearCache) Logo.clearCache();
      setSuccess('Logo restaurado para Radar 360! A página vai recarregar...');
      setTimeout(() => window.location.reload(), 1500);
    } catch (err) {
      setError('Erro ao restaurar');
      setTimeout(() => setError(null), 3000);
    }
    setIsSavingBrand(false);
  };

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

      {/* Seção: Personalização White Label */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Personalização do Sistema</h2>
        <p className="text-sm text-gray-500 mb-4">
          Personalize o logo e nome que aparecem no menu lateral. Deixe vazio para usar o padrão (Radar 360).
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Logo Upload */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Logo da Empresa</label>
            <div className="flex items-center gap-4">
              {/* Preview */}
              <div className="w-16 h-16 border-2 border-dashed border-gray-300 rounded-lg flex items-center justify-center overflow-hidden bg-gray-50">
                {brandLogo ? (
                  <img src={brandLogo} alt="Logo" className="w-full h-full object-contain" />
                ) : (
                  <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                )}
              </div>
              <div className="flex flex-col gap-2">
                <label className="cursor-pointer bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-lg transition text-sm font-medium inline-block text-center">
                  {isUploadingLogo ? 'Enviando...' : 'Enviar Logo'}
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/svg+xml,image/webp"
                    className="hidden"
                    disabled={isUploadingLogo}
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      if (file.size > 500 * 1024) { setError('Imagem muito grande (max 500KB)'); setTimeout(() => setError(null), 3000); return; }
                      setIsUploadingLogo(true);
                      try {
                        // Converte pra base64 e salva direto na config (sem MinIO)
                        const reader = new FileReader();
                        reader.onload = async () => {
                          const base64 = reader.result;
                          setBrandLogo(base64);
                          setIsUploadingLogo(false);
                          setSuccess('Logo carregado! Clique em Salvar para aplicar.');
                          setTimeout(() => setSuccess(null), 3000);
                        };
                        reader.onerror = () => {
                          setError('Erro ao ler imagem');
                          setTimeout(() => setError(null), 3000);
                          setIsUploadingLogo(false);
                        };
                        reader.readAsDataURL(file);
                      } catch (err) {
                        setError('Erro ao processar logo');
                        setTimeout(() => setError(null), 3000);
                        setIsUploadingLogo(false);
                      }
                      e.target.value = '';
                    }}
                  />
                </label>
                <p className="text-xs text-gray-400">PNG, JPG ou SVG. Max 500KB.</p>
              </div>
            </div>
          </div>

          {/* Nome da Marca */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Nome da Empresa / Marca</label>
            <input
              type="text"
              value={brandName}
              onChange={(e) => setBrandName(e.target.value)}
              placeholder="Ex: SUPERMERCADO NUNES"
              className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
              maxLength={50}
            />
            <p className="text-xs text-gray-400 mt-1">Aparece embaixo do logo no menu lateral</p>
          </div>
        </div>

        {/* Botões */}
        <div className="flex items-center gap-3 mt-6 pt-4 border-t border-gray-100">
          <button
            onClick={saveBrandName}
            disabled={isSavingBrand || (brandName === brandNameSaved && brandLogo === brandLogoSaved)}
            className="bg-orange-500 hover:bg-orange-600 disabled:bg-gray-300 text-white px-6 py-2 rounded-lg transition font-medium"
          >
            {isSavingBrand ? 'Salvando...' : 'Salvar'}
          </button>
          {(brandNameSaved || brandLogoSaved) && (
            <button
              onClick={restoreLogo}
              disabled={isSavingBrand}
              className="bg-gray-200 hover:bg-gray-300 text-gray-700 px-4 py-2 rounded-lg transition text-sm flex items-center gap-2"
              title="Restaurar logo e nome originais (Radar 360)"
            >
              <div className="w-6 h-6 bg-orange-500 rounded flex items-center justify-center">
                <svg className="h-4 w-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.5">
                  <circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="7"/><circle cx="12" cy="12" r="4"/>
                  <path d="M12 12l7-7"/><circle cx="12" cy="12" r="1" fill="currentColor"/>
                </svg>
              </div>
              Restaurar Logo Original (Radar 360)
            </button>
          )}
        </div>
      </div>

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
              {/* Foto da Fachada */}
              <div className="bg-gray-50 border-2 border-dashed border-gray-300 rounded-lg p-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  🏪 Foto da Fachada da Loja
                </label>
                <div className="flex items-center gap-4">
                  <div className="w-40 h-28 rounded-lg border-2 border-gray-200 bg-white overflow-hidden flex items-center justify-center shrink-0">
                    {newStoreData.fotoFachadaUrl ? (
                      <img src={newStoreData.fotoFachadaUrl} alt="Fachada" className="w-full h-full object-cover" />
                    ) : (
                      <div className="text-center text-gray-400">
                        <div className="text-4xl">🏪</div>
                        <div className="text-[10px] mt-1">Sem foto</div>
                      </div>
                    )}
                  </div>
                  <div className="flex flex-col gap-2">
                    <input type="file" accept="image/*" id="upload-fachada-new" className="hidden"
                      onChange={handleUploadFachadaNew} />
                    <label htmlFor="upload-fachada-new"
                      className={`cursor-pointer px-4 py-2 rounded-lg text-sm font-bold text-white inline-block text-center ${uploadingFachadaNew ? 'bg-gray-400' : 'bg-blue-500 hover:bg-blue-600'}`}>
                      {uploadingFachadaNew ? 'Enviando…' : (newStoreData.fotoFachadaUrl ? '🔄 Trocar foto' : '📷 Adicionar foto')}
                    </label>
                    {newStoreData.fotoFachadaUrl && (
                      <button type="button"
                        onClick={() => setNewStoreData(f => ({ ...f, fotoFachadaUrl: null }))}
                        className="px-4 py-2 rounded-lg text-sm font-bold bg-red-100 text-red-700 hover:bg-red-200">
                        🗑️ Remover
                      </button>
                    )}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Nº da Loja (automático)
                  </label>
                  <div className="w-full px-3 py-2 border border-gray-200 rounded-lg bg-gray-50 text-gray-700 font-semibold">
                    Loja {getProximoCodLoja()}
                  </div>
                  <p className="text-xs text-gray-500 mt-1">Definido automaticamente</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Apelido / Localização
                  </label>
                  <input
                    type="text"
                    name="apelido"
                    value={newStoreData.apelido}
                    onChange={handleNewStoreChange}
                    placeholder="Ex: Porteirão, Centro, Silveiras"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                  <p className="text-xs text-gray-500 mt-1">Aparece após o nome da loja</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Nome Fantasia
                  </label>
                  <input
                    type="text"
                    name="nomeFantasia"
                    value={newStoreData.nomeFantasia}
                    onChange={handleNewStoreChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Razão Social
                  </label>
                  <input
                    type="text"
                    name="razaoSocial"
                    value={newStoreData.razaoSocial}
                    onChange={handleNewStoreChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    CNPJ
                  </label>
                  <input
                    type="text"
                    name="cnpj"
                    value={newStoreData.cnpj}
                    onChange={handleNewStoreChange}
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
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
              {empresaPrincipal?.fotoFachadaUrl ? (
                <img
                  src={empresaPrincipal.fotoFachadaUrl}
                  alt="Fachada da loja"
                  className="w-20 h-20 rounded-lg object-cover border-2 border-orange-200 shrink-0"
                />
              ) : (
                <div className="w-20 h-20 rounded-lg bg-orange-50 border-2 border-orange-100 flex items-center justify-center shrink-0 text-3xl text-orange-300">
                  🏪
                </div>
              )}
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
            {/* Badge de Loja se definida */}
            {empresaPrincipal.codLoja && (
              <div className="mb-4 flex items-center gap-2">
                <span className="bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-sm font-medium">
                  Loja {empresaPrincipal.codLoja}
                </span>
                {empresaPrincipal.apelido && (
                  <span className="text-gray-600">- {empresaPrincipal.apelido}</span>
                )}
              </div>
            )}
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

      {/* Lista de Lojas Adicionais - mesmo layout do card Empresa Principal */}
      {user?.isMaster && lojas.length > 0 && (
        <>
          <div className="text-xl font-semibold text-gray-900 pt-2">Lojas Cadastradas</div>
          <p className="text-sm text-gray-500 -mt-4">{lojas.length} loja(s) adicional(is)</p>

          {lojas.map((loja) => (
            <div key={loja.id} className="bg-white rounded-lg shadow">
              {/* Header: foto + nome fantasia + apelido */}
              <div className="p-6 border-b border-gray-200">
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-3">
                    {loja.fotoFachadaUrl ? (
                      <img
                        src={loja.fotoFachadaUrl}
                        alt="Fachada da loja"
                        className="w-20 h-20 rounded-lg object-cover border-2 border-orange-200 shrink-0"
                      />
                    ) : (
                      <div className="w-20 h-20 rounded-lg bg-orange-50 border-2 border-orange-100 flex items-center justify-center shrink-0 text-3xl text-orange-300">
                        🏪
                      </div>
                    )}
                    <div>
                      <h2 className="text-xl font-semibold text-gray-900">{loja.nomeFantasia || 'Loja sem nome'}</h2>
                      <p className="text-sm text-gray-500">{loja.apelido || 'Loja adicional'}</p>
                    </div>
                  </div>
                  {loja.identificador && (
                    <span className="bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-sm font-medium">
                      {loja.identificador}
                    </span>
                  )}
                </div>
              </div>

              {/* Corpo: badge + grid 4 colunas + botoes */}
              <div className="p-6">
                {loja.codLoja && (
                  <div className="mb-4 flex items-center gap-2">
                    <span className="bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-sm font-medium">
                      Loja {loja.codLoja}
                    </span>
                    {loja.apelido && (
                      <span className="text-gray-600">- {loja.apelido}</span>
                    )}
                  </div>
                )}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                  <div>
                    <p className="text-sm text-gray-500">Nome Fantasia</p>
                    <p className="text-lg font-semibold text-gray-900">{loja.nomeFantasia || '-'}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Razão Social</p>
                    <p className="text-lg font-medium text-gray-900">{loja.razaoSocial || '-'}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">CNPJ</p>
                    <p className="text-lg font-medium text-gray-900">{loja.cnpj || '-'}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Endereço</p>
                    <p className="text-lg font-medium text-gray-900">
                      {loja.cidade && loja.estado ? `${loja.cidade} - ${loja.estado}` : '-'}
                    </p>
                  </div>
                </div>

                <div className="flex gap-3 mt-6 pt-6 border-t border-gray-200">
                  <button
                    onClick={() => handleView(loja)}
                    className="bg-gray-100 hover:bg-gray-200 text-gray-700 px-4 py-2 rounded-lg transition flex items-center gap-2"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                    Ver Todos os Dados
                  </button>
                  <button
                    onClick={() => handleEdit(loja)}
                    className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-lg transition flex items-center gap-2"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                    Editar Dados
                  </button>
                  <button
                    onClick={() => handleDeleteStore(loja.id)}
                    className="bg-red-50 hover:bg-red-100 text-red-600 px-4 py-2 rounded-lg transition flex items-center gap-2 ml-auto"
                    title="Excluir loja"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                    Excluir
                  </button>
                </div>
              </div>
            </div>
          ))}
        </>
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
              {/* Configuração de Loja */}
              {(viewingCompany.codLoja || viewingCompany.apelido) && (
                <div className="bg-blue-50 p-4 rounded-lg">
                  <h4 className="text-lg font-semibold text-gray-800 mb-3 flex items-center gap-2">
                    <svg className="w-5 h-5 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                    </svg>
                    Configuração de Loja
                  </h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm text-gray-500">Nº da Loja (ERP)</p>
                      <p className="font-medium">
                        {viewingCompany.codLoja ? (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-sm font-medium bg-blue-100 text-blue-800">
                            Loja {viewingCompany.codLoja}
                          </span>
                        ) : '-'}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">Apelido / Localização</p>
                      <p className="font-medium">{viewingCompany.apelido || '-'}</p>
                    </div>
                  </div>
                </div>
              )}

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
                onClick={handleCloseEditModal}
                className="text-gray-500 hover:text-gray-700"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <form onSubmit={handleSaveEdit} className="p-6 space-y-6">
              {/* Configuração de Loja */}
              <div>
                <h4 className="text-lg font-semibold text-gray-800 mb-3 flex items-center gap-2">
                  <svg className="w-5 h-5 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                  </svg>
                  Configuração de Loja
                </h4>
                <div className="grid grid-cols-2 gap-4 bg-blue-50 p-4 rounded-lg">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Nº da Loja (ERP)</label>
                    <select
                      value={editFormData.codLoja ?? ''}
                      onChange={(e) => setEditFormData({ ...editFormData, codLoja: e.target.value ? parseInt(e.target.value) : null })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">Não definido</option>
                      {[...Array(20)].map((_, i) => (
                        <option key={i + 1} value={i + 1}>Loja {i + 1}</option>
                      ))}
                    </select>
                    <p className="text-xs text-gray-500 mt-1">Código usado no sistema Intersolid (COD_LOJA)</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Apelido / Localização</label>
                    <input
                      type="text"
                      value={editFormData.apelido || ''}
                      onChange={(e) => setEditFormData({ ...editFormData, apelido: e.target.value })}
                      placeholder="Ex: Porteirão, Centro, Silveiras"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                    <p className="text-xs text-gray-500 mt-1">Aparece após o nome: "Loja 1 - Nome - Apelido"</p>
                  </div>
                </div>
              </div>

              {/* Foto da Fachada */}
              <div>
                <h4 className="text-lg font-semibold text-gray-800 mb-3 flex items-center gap-2">
                  <span className="text-xl">🏪</span>
                  Foto da Fachada da Loja
                </h4>
                <p className="text-sm text-gray-500 mb-3">
                  Aparece na tela inicial do formulário público de currículo, ajudando o candidato a identificar visualmente a loja que está escolhendo.
                </p>
                <div className="flex items-start gap-4 bg-gray-50 p-4 rounded-lg border border-gray-200">
                  {/* Preview */}
                  <div className="w-40 h-28 rounded-lg border-2 border-gray-300 bg-white overflow-hidden flex items-center justify-center shrink-0">
                    {editFormData.fotoFachadaUrl ? (
                      <img src={editFormData.fotoFachadaUrl} alt="Fachada" className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-4xl text-gray-300">🏪</span>
                    )}
                  </div>
                  {/* Ações */}
                  <div className="flex-1 space-y-2">
                    <input
                      id="fachada-upload-input"
                      type="file"
                      accept="image/*"
                      onChange={handleUploadFachada}
                      className="hidden"
                    />
                    <button
                      type="button"
                      onClick={() => document.getElementById('fachada-upload-input')?.click()}
                      disabled={uploadingFachada}
                      className={`px-4 py-2 rounded-lg text-sm font-bold text-white ${uploadingFachada ? 'bg-gray-400' : 'bg-blue-500 hover:bg-blue-600'}`}
                    >
                      {uploadingFachada ? 'Enviando…' : (editFormData.fotoFachadaUrl ? '🔄 Trocar foto' : '📷 Adicionar foto')}
                    </button>
                    {editFormData.fotoFachadaUrl && (
                      <button
                        type="button"
                        onClick={() => setEditFormData(f => ({ ...f, fotoFachadaUrl: null }))}
                        className="ml-2 px-3 py-2 text-xs font-semibold text-red-600 border border-red-200 rounded hover:bg-red-50"
                      >
                        🗑️ Remover
                      </button>
                    )}
                    <p className="text-xs text-gray-500">Formatos: JPG, PNG, WEBP. Recomendado: foto horizontal, clara, da fachada.</p>
                  </div>
                </div>
              </div>

              {/* Dados Básicos */}
              <div>
                <h4 className="text-lg font-semibold text-gray-800 mb-3">Dados Básicos</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Nome Fantasia</label>
                    <input
                      type="text"
                      value={editFormData.nomeFantasia || ''}
                      onChange={(e) => setEditFormData({ ...editFormData, nomeFantasia: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Razão Social</label>
                    <input
                      type="text"
                      value={editFormData.razaoSocial || ''}
                      onChange={(e) => setEditFormData({ ...editFormData, razaoSocial: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">CNPJ</label>
                    <input
                      type="text"
                      value={editFormData.cnpj || ''}
                      onChange={(e) => setEditFormData({ ...editFormData, cnpj: e.target.value })}
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

              {/* Meta de Conformidade do Checklist */}
              <div className="border-t border-gray-200 pt-6">
                <h4 className="text-lg font-semibold text-gray-800 mb-3 flex items-center gap-2">
                  <span className="text-2xl">🎯</span>
                  Meta de Conformidade — Check List no Radar
                </h4>
                <p className="text-sm text-gray-500 mb-4">
                  Percentual mínimo esperado de conformidade nas auditorias desta loja. Usado nos dashboards para colorir o ranking e avaliar se a meta foi atingida.
                </p>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Meta (%)</label>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      step="0.5"
                      value={editFormData.metaChecklist ?? 95}
                      onChange={(e) => setEditFormData({ ...editFormData, metaChecklist: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500"
                      placeholder="95"
                    />
                    <p className="text-xs text-gray-400 mt-1">Padrão: 95%</p>
                  </div>
                </div>
              </div>

              {/* Segurança da Conta - Apenas para empresa principal */}
              {editingCompany?.id === empresaPrincipal?.id && (
                <div className="border-t border-gray-200 pt-6">
                  <h4 className="text-lg font-semibold text-gray-800 mb-3 flex items-center gap-2">
                    <svg className="w-5 h-5 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                    </svg>
                    Segurança da Conta
                  </h4>
                  <p className="text-sm text-gray-500 mb-4">
                    Gerencie o email de recuperação de senha e altere sua senha de acesso.
                  </p>

                  {/* Mensagens de erro/sucesso */}
                  {securityError && (
                    <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
                      {securityError}
                    </div>
                  )}
                  {securitySuccess && (
                    <div className="mb-4 p-3 bg-green-50 border border-green-200 text-green-700 rounded-lg text-sm">
                      {securitySuccess}
                    </div>
                  )}

                  <div className="space-y-4">
                    {/* Trocar Email */}
                    <div className="bg-gray-50 rounded-lg p-4">
                      <div className="flex justify-between items-center mb-2">
                        <div>
                          <p className="font-medium text-gray-800">Email de Recuperação</p>
                          <p className="text-sm text-gray-500">Email atual: {user?.email || 'Não definido'}</p>
                        </div>
                        {!isChangingEmail && (
                          <button
                            type="button"
                            onClick={() => setIsChangingEmail(true)}
                            className="text-orange-500 hover:text-orange-600 text-sm font-medium"
                          >
                            Alterar Email
                          </button>
                        )}
                      </div>

                      {isChangingEmail && (
                        <div className="mt-3 space-y-3">
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Novo Email</label>
                            <input
                              type="email"
                              value={securityData.newEmail}
                              onChange={(e) => setSecurityData({ ...securityData, newEmail: e.target.value })}
                              placeholder="Digite o novo email"
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500"
                            />
                          </div>
                          <div className="flex gap-2">
                            <button
                              type="button"
                              onClick={handleChangeEmail}
                              className="px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg text-sm transition"
                            >
                              Salvar Email
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setIsChangingEmail(false);
                                setSecurityData(prev => ({ ...prev, newEmail: '' }));
                                setSecurityError(null);
                              }}
                              className="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-lg text-sm transition"
                            >
                              Cancelar
                            </button>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Trocar Senha */}
                    <div className="bg-gray-50 rounded-lg p-4">
                      <div className="flex justify-between items-center mb-2">
                        <div>
                          <p className="font-medium text-gray-800">Senha de Acesso</p>
                          <p className="text-sm text-gray-500">Altere sua senha de login</p>
                        </div>
                        {!isChangingPassword && (
                          <button
                            type="button"
                            onClick={() => setIsChangingPassword(true)}
                            className="text-orange-500 hover:text-orange-600 text-sm font-medium"
                          >
                            Alterar Senha
                          </button>
                        )}
                      </div>

                      {isChangingPassword && (
                        <div className="mt-3 space-y-3">
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Senha Atual</label>
                            <div className="relative">
                              <input
                                type={showCurrentPassword ? "text" : "password"}
                                value={securityData.currentPassword}
                                onChange={(e) => setSecurityData({ ...securityData, currentPassword: e.target.value })}
                                placeholder="Digite sua senha atual"
                                className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500"
                              />
                              <button
                                type="button"
                                onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                                className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-500 hover:text-gray-700"
                              >
                                {showCurrentPassword ? (
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
                            <label className="block text-sm font-medium text-gray-700 mb-1">Nova Senha</label>
                            <div className="relative">
                              <input
                                type={showNewPassword ? "text" : "password"}
                                value={securityData.newPassword}
                                onChange={(e) => setSecurityData({ ...securityData, newPassword: e.target.value })}
                                placeholder="Digite a nova senha (mín. 6 caracteres)"
                                className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500"
                              />
                              <button
                                type="button"
                                onClick={() => setShowNewPassword(!showNewPassword)}
                                className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-500 hover:text-gray-700"
                              >
                                {showNewPassword ? (
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
                            <label className="block text-sm font-medium text-gray-700 mb-1">Confirmar Nova Senha</label>
                            <div className="relative">
                              <input
                                type={showConfirmPassword ? "text" : "password"}
                                value={securityData.confirmPassword}
                                onChange={(e) => setSecurityData({ ...securityData, confirmPassword: e.target.value })}
                                placeholder="Confirme a nova senha"
                                className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500"
                              />
                              <button
                                type="button"
                                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                                className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-500 hover:text-gray-700"
                              >
                                {showConfirmPassword ? (
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
                          <div className="flex gap-2">
                            <button
                              type="button"
                              onClick={handleChangePassword}
                              className="px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg text-sm transition"
                            >
                              Salvar Senha
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setIsChangingPassword(false);
                                setSecurityData(prev => ({
                                  ...prev,
                                  currentPassword: '',
                                  newPassword: '',
                                  confirmPassword: ''
                                }));
                                setSecurityError(null);
                              }}
                              className="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-lg text-sm transition"
                            >
                              Cancelar
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
                <button
                  type="button"
                  onClick={handleCloseEditModal}
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
