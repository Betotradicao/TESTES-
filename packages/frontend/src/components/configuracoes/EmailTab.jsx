import { useState, useEffect } from 'react';
import api from '../../services/api';

export default function EmailTab() {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState(null); // 'valid', 'invalid', null
  const [emailConfig, setEmailConfig] = useState({
    email_user: '',
    email_pass: ''
  });
  const [message, setMessage] = useState({ type: '', text: '' });

  useEffect(() => {
    fetchEmailConfig();
  }, []);

  const fetchEmailConfig = async () => {
    try {
      setLoading(true);
      const response = await api.get('/configurations/email');
      setEmailConfig({
        email_user: response.data.email_user || '',
        email_pass: response.data.email_pass || ''
      });
    } catch (error) {
      console.error('Erro ao buscar configurações de email:', error);
      setMessage({
        type: 'error',
        text: 'Erro ao carregar configurações de email'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleTestConnection = async () => {
    try {
      setTesting(true);
      setMessage({ type: '', text: '' });

      const response = await api.post('/configurations/email/test', emailConfig);

      if (response.data.success) {
        setConnectionStatus('valid');
        setMessage({
          type: 'success',
          text: 'Conexão bem sucedida! Credenciais válidas.'
        });
      } else {
        setConnectionStatus('invalid');
        setMessage({
          type: 'error',
          text: 'Falha na conexão. Verifique suas credenciais.'
        });
      }

      setTimeout(() => setMessage({ type: '', text: '' }), 5000);
    } catch (error) {
      console.error('Erro ao testar conexão:', error);
      setConnectionStatus('invalid');
      setMessage({
        type: 'error',
        text: error.response?.data?.error || 'Erro ao testar conexão'
      });
    } finally {
      setTesting(false);
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      setMessage({ type: '', text: '' });

      await api.put('/configurations/email', emailConfig);

      setConnectionStatus(null); // Reset status ao salvar
      setMessage({
        type: 'success',
        text: 'Configurações de email salvas com sucesso!'
      });

      // Limpar mensagem após 5 segundos
      setTimeout(() => setMessage({ type: '', text: '' }), 5000);
    } catch (error) {
      console.error('Erro ao salvar configurações:', error);
      setMessage({
        type: 'error',
        text: error.response?.data?.error || 'Erro ao salvar configurações'
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="bg-white shadow rounded-lg p-6">
      <div className="mb-6">
        <h2 className="text-xl font-semibold text-gray-900">Configurações de Email</h2>
        <p className="mt-1 text-sm text-gray-600">
          Configure o email usado para enviar notificações e recuperação de senha
        </p>
      </div>

      {message.text && (
        <div className={`mb-4 p-4 rounded-lg ${
          message.type === 'success'
            ? 'bg-green-50 text-green-800 border border-green-200'
            : 'bg-red-50 text-red-800 border border-red-200'
        }`}>
          <div className="flex">
            <svg
              className={`w-5 h-5 mr-2 ${message.type === 'success' ? 'text-green-600' : 'text-red-600'}`}
              fill="currentColor"
              viewBox="0 0 20 20"
            >
              {message.type === 'success' ? (
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              ) : (
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              )}
            </svg>
            <span>{message.text}</span>
          </div>
        </div>
      )}

      <div className="space-y-6">
        {/* Indicador de Status da Conexão */}
        {connectionStatus && (
          <div className={`p-4 rounded-lg border-2 ${
            connectionStatus === 'valid'
              ? 'bg-green-50 border-green-300'
              : 'bg-red-50 border-red-300'
          }`}>
            <div className="flex items-center gap-3">
              <div className={`w-3 h-3 rounded-full ${
                connectionStatus === 'valid'
                  ? 'bg-green-500 animate-pulse'
                  : 'bg-red-500'
              }`}></div>
              <div>
                <h4 className="font-semibold text-gray-900">
                  {connectionStatus === 'valid'
                    ? '✅ Conexão SMTP ATIVA'
                    : '❌ Conexão SMTP INVÁLIDA'}
                </h4>
                <p className="text-xs text-gray-600 mt-1">
                  {connectionStatus === 'valid'
                    ? 'Credenciais válidas - Pronto para enviar emails'
                    : 'Verifique o email e senha de app'}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Email */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Email de Envio
          </label>
          <input
            type="email"
            value={emailConfig.email_user}
            onChange={(e) => {
              setEmailConfig({ ...emailConfig, email_user: e.target.value });
              setConnectionStatus(null); // Reset status ao mudar credenciais
            }}
            placeholder="exemplo@gmail.com"
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
          <p className="mt-1 text-xs text-gray-500">
            Email usado para enviar notificações do sistema
          </p>
        </div>

        {/* Senha de App */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Senha de App do Gmail
          </label>
          <div className="relative">
            <input
              type={showPassword ? 'text' : 'password'}
              value={emailConfig.email_pass}
              onChange={(e) => {
                setEmailConfig({ ...emailConfig, email_pass: e.target.value });
                setConnectionStatus(null); // Reset status ao mudar credenciais
              }}
              placeholder="Senha de app de 16 caracteres"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent pr-10"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
            >
              {showPassword ? (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21"/>
                </svg>
              ) : (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/>
                </svg>
              )}
            </button>
          </div>
          <div className="mt-2 text-xs text-gray-500 space-y-1">
            <p>• Para Gmail: crie uma "Senha de app" nas configurações da sua conta Google</p>
            <p>• Acesse: <a href="https://myaccount.google.com/apppasswords" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">myaccount.google.com/apppasswords</a></p>
            <p>• A senha deve ter 16 caracteres (sem espaços)</p>
          </div>
        </div>

        {/* Botões de Ação */}
        <div className="flex gap-3 pt-4 border-t border-gray-200">
          <button
            onClick={handleTestConnection}
            disabled={testing || !emailConfig.email_user || !emailConfig.email_pass}
            className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition font-medium"
          >
            {testing ? 'Testando...' : '🔌 Testar Conexão'}
          </button>
          <button
            onClick={handleSave}
            disabled={saving || !emailConfig.email_user || !emailConfig.email_pass}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition font-medium"
          >
            {saving ? 'Salvando...' : 'Salvar Configurações'}
          </button>
        </div>
      </div>

      {/* Informações Adicionais */}
      <div className="mt-6 pt-6 border-t border-gray-200">
        <h3 className="text-sm font-medium text-gray-900 mb-2">Informações</h3>
        <ul className="text-xs text-gray-600 space-y-1 list-disc list-inside">
          <li>Use uma senha de app, não sua senha normal do Gmail</li>
          <li>O email será usado para recuperação de senha e notificações</li>
          <li>As configurações são aplicadas automaticamente ao salvar</li>
        </ul>
      </div>
    </div>
  );
}
