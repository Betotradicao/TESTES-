import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Logo from '../components/Logo';
import api from '../services/api';

export default function FirstSetup() {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Dados do administrador
  const [adminData, setAdminData] = useState({
    adminName: '',
    adminEmail: '',
    adminPassword: '',
    confirmPassword: '',
    recoveryEmail: '',
  });

  // Dados SMTP
  const [smtpData, setSmtpData] = useState({
    smtpHost: '',
    smtpPort: '587',
    smtpUser: '',
    smtpPassword: '',
    smtpSecure: true,
    smtpFromEmail: '',
    smtpFromName: 'Sistema Prevenção no Radar',
  });

  const [showPassword, setShowPassword] = useState(false);
  const [showSmtpPassword, setShowSmtpPassword] = useState(false);

  const handleAdminChange = (e) => {
    setAdminData({
      ...adminData,
      [e.target.name]: e.target.value,
    });
  };

  const handleSmtpChange = (e) => {
    const value = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
    setSmtpData({
      ...smtpData,
      [e.target.name]: value,
    });
  };

  const validateStep1 = () => {
    if (!adminData.adminName || !adminData.adminEmail || !adminData.adminPassword) {
      setError('Todos os campos são obrigatórios');
      return false;
    }

    if (adminData.adminPassword.length < 6) {
      setError('A senha deve ter no mínimo 6 caracteres');
      return false;
    }

    if (adminData.adminPassword !== adminData.confirmPassword) {
      setError('As senhas não coincidem');
      return false;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(adminData.adminEmail)) {
      setError('Email do administrador inválido');
      return false;
    }

    if (!emailRegex.test(adminData.recoveryEmail)) {
      setError('Email de recuperação inválido');
      return false;
    }

    return true;
  };

  const validateStep2 = () => {
    if (!smtpData.smtpHost || !smtpData.smtpPort || !smtpData.smtpUser ||
        !smtpData.smtpPassword || !smtpData.smtpFromEmail) {
      setError('Todos os campos SMTP são obrigatórios');
      return false;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(smtpData.smtpFromEmail)) {
      setError('Email de envio inválido');
      return false;
    }

    return true;
  };

  const handleNextStep = () => {
    setError('');

    if (step === 1 && validateStep1()) {
      setStep(2);
    }
  };

  const handlePreviousStep = () => {
    setError('');
    setStep(1);
  };

  const testSmtpConnection = async () => {
    if (!validateStep2()) return;

    setLoading(true);
    setError('');
    setSuccess('');

    try {
      const response = await api.post('/setup/test-smtp', smtpData);
      setSuccess(response.data.message || 'Conexão SMTP testada com sucesso!');
    } catch (err) {
      setError(err.response?.data?.error || 'Erro ao testar conexão SMTP');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!validateStep2()) return;

    setLoading(true);
    setError('');
    setSuccess('');

    try {
      const setupData = {
        ...adminData,
        ...smtpData,
      };

      await api.post('/setup/perform', setupData);

      setSuccess('Sistema configurado com sucesso! Redirecionando para login...');

      setTimeout(() => {
        navigate('/login');
      }, 2000);

    } catch (err) {
      setError(err.response?.data?.error || 'Erro ao configurar sistema');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
      <div className="max-w-2xl w-full space-y-8">
        <div className="bg-white rounded-2xl shadow-xl p-8">
          {/* Logo/Header */}
          <div className="text-center mb-8">
            <div className="flex justify-center mb-6">
              <Logo size="large" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900">
              Configuração Inicial do Sistema
            </h1>
            <p className="mt-2 text-sm text-gray-600">
              {step === 1
                ? 'Crie o primeiro usuário administrador'
                : 'Configure o servidor de email (SMTP)'}
            </p>
          </div>

          {/* Progress Indicator */}
          <div className="mb-8">
            <div className="flex items-center justify-center space-x-4">
              <div className={`flex items-center ${step >= 1 ? 'text-orange-600' : 'text-gray-400'}`}>
                <div className={`w-10 h-10 rounded-full flex items-center justify-center border-2 ${
                  step >= 1 ? 'border-orange-600 bg-orange-50' : 'border-gray-300'
                }`}>
                  1
                </div>
                <span className="ml-2 text-sm font-medium">Administrador</span>
              </div>
              <div className={`w-16 h-0.5 ${step >= 2 ? 'bg-orange-600' : 'bg-gray-300'}`} />
              <div className={`flex items-center ${step >= 2 ? 'text-orange-600' : 'text-gray-400'}`}>
                <div className={`w-10 h-10 rounded-full flex items-center justify-center border-2 ${
                  step >= 2 ? 'border-orange-600 bg-orange-50' : 'border-gray-300'
                }`}>
                  2
                </div>
                <span className="ml-2 text-sm font-medium">Email SMTP</span>
              </div>
            </div>
          </div>

          {/* Error Message */}
          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
              <div className="flex">
                <div className="flex-shrink-0">
                  <svg className="h-5 w-5 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div className="ml-3">
                  <p className="text-sm text-red-800">{error}</p>
                </div>
              </div>
            </div>
          )}

          {/* Success Message */}
          {success && (
            <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg">
              <div className="flex">
                <div className="flex-shrink-0">
                  <svg className="h-5 w-5 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <div className="ml-3">
                  <p className="text-sm text-green-800">{success}</p>
                </div>
              </div>
            </div>
          )}

          {/* Step 1: Admin User */}
          {step === 1 && (
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Nome Completo *
                </label>
                <input
                  type="text"
                  name="adminName"
                  value={adminData.adminName}
                  onChange={handleAdminChange}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                  placeholder="Digite o nome do administrador"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Email de Login *
                </label>
                <input
                  type="email"
                  name="adminEmail"
                  value={adminData.adminEmail}
                  onChange={handleAdminChange}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                  placeholder="email@exemplo.com"
                />
                <p className="mt-1 text-xs text-gray-500">
                  Este email será usado para fazer login no sistema
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Email de Recuperação *
                </label>
                <input
                  type="email"
                  name="recoveryEmail"
                  value={adminData.recoveryEmail}
                  onChange={handleAdminChange}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                  placeholder="recuperacao@exemplo.com"
                />
                <p className="mt-1 text-xs text-gray-500">
                  Para recuperação de senha (pode ser o mesmo email acima)
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Senha *
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    name="adminPassword"
                    value={adminData.adminPassword}
                    onChange={handleAdminChange}
                    className="w-full px-4 py-3 pr-12 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                    placeholder="Mínimo 6 caracteres"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
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
                  Confirmar Senha *
                </label>
                <input
                  type={showPassword ? "text" : "password"}
                  name="confirmPassword"
                  value={adminData.confirmPassword}
                  onChange={handleAdminChange}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                  placeholder="Digite a senha novamente"
                />
              </div>

              <button
                type="button"
                onClick={handleNextStep}
                className="w-full bg-orange-600 text-white py-3 px-4 rounded-lg hover:bg-orange-700 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2 transition-colors font-medium"
              >
                Próximo: Configurar Email
              </button>
            </div>
          )}

          {/* Step 2: SMTP Configuration */}
          {step === 2 && (
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Servidor SMTP *
                  </label>
                  <input
                    type="text"
                    name="smtpHost"
                    value={smtpData.smtpHost}
                    onChange={handleSmtpChange}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                    placeholder="smtp.gmail.com"
                  />
                  <p className="mt-1 text-xs text-gray-500">
                    Ex: smtp.gmail.com, smtp-mail.outlook.com
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Porta *
                  </label>
                  <input
                    type="number"
                    name="smtpPort"
                    value={smtpData.smtpPort}
                    onChange={handleSmtpChange}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                    placeholder="587"
                  />
                </div>

                <div className="flex items-end">
                  <label className="flex items-center space-x-3 pb-3">
                    <input
                      type="checkbox"
                      name="smtpSecure"
                      checked={smtpData.smtpSecure}
                      onChange={handleSmtpChange}
                      className="w-5 h-5 text-orange-600 border-gray-300 rounded focus:ring-orange-500"
                    />
                    <span className="text-sm font-medium text-gray-700">
                      Usar SSL/TLS
                    </span>
                  </label>
                </div>

                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Usuário SMTP *
                  </label>
                  <input
                    type="text"
                    name="smtpUser"
                    value={smtpData.smtpUser}
                    onChange={handleSmtpChange}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                    placeholder="seu-email@exemplo.com"
                  />
                </div>

                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Senha SMTP *
                  </label>
                  <div className="relative">
                    <input
                      type={showSmtpPassword ? "text" : "password"}
                      name="smtpPassword"
                      value={smtpData.smtpPassword}
                      onChange={handleSmtpChange}
                      className="w-full px-4 py-3 pr-12 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                      placeholder="Senha do email"
                    />
                    <button
                      type="button"
                      onClick={() => setShowSmtpPassword(!showSmtpPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                    >
                      {showSmtpPassword ? (
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
                  <p className="mt-1 text-xs text-gray-500">
                    Para Gmail, use uma Senha de App (não a senha normal)
                  </p>
                </div>

                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Email de Envio *
                  </label>
                  <input
                    type="email"
                    name="smtpFromEmail"
                    value={smtpData.smtpFromEmail}
                    onChange={handleSmtpChange}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                    placeholder="noreply@empresa.com"
                  />
                  <p className="mt-1 text-xs text-gray-500">
                    Email que aparecerá como remetente
                  </p>
                </div>

                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Nome do Remetente
                  </label>
                  <input
                    type="text"
                    name="smtpFromName"
                    value={smtpData.smtpFromName}
                    onChange={handleSmtpChange}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                    placeholder="Sistema Prevenção no Radar"
                  />
                </div>
              </div>

              <div className="flex space-x-4">
                <button
                  type="button"
                  onClick={handlePreviousStep}
                  className="flex-1 bg-gray-100 text-gray-700 py-3 px-4 rounded-lg hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 transition-colors font-medium"
                >
                  Voltar
                </button>
                <button
                  type="button"
                  onClick={testSmtpConnection}
                  disabled={loading}
                  className="flex-1 bg-blue-600 text-white py-3 px-4 rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors font-medium disabled:opacity-50"
                >
                  {loading ? 'Testando...' : 'Testar Conexão'}
                </button>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-orange-600 text-white py-3 px-4 rounded-lg hover:bg-orange-700 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2 transition-colors font-medium disabled:opacity-50"
              >
                {loading ? 'Configurando...' : 'Finalizar Configuração'}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
