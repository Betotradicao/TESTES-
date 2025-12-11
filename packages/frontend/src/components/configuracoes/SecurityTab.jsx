import { useState, useEffect } from 'react';
import systemService from '../../services/system.service';

export default function SecurityTab() {
  const [token, setToken] = useState('');
  const [loading, setLoading] = useState(true);
  const [showToken, setShowToken] = useState(false);
  const [copying, setCopying] = useState(false);
  const [generating, setGenerating] = useState(false);

  // Estados para senhas do banco e MinIO
  const [showPostgresPassword, setShowPostgresPassword] = useState(false);
  const [showMinioPassword, setShowMinioPassword] = useState(false);
  const [postgresPassword, setPostgresPassword] = useState('');
  const [minioUser, setMinioUser] = useState('');
  const [minioPassword, setMinioPassword] = useState('');

  useEffect(() => {
    loadToken();
    loadDatabaseCredentials();
  }, []);

  const loadToken = async () => {
    try {
      setLoading(true);
      const response = await systemService.getToken();
      setToken(response.token);
    } catch (error) {
      console.error('Erro ao carregar token:', error);
      alert('Erro ao carregar token. Verifique o console.');
    } finally {
      setLoading(false);
    }
  };

  const loadDatabaseCredentials = () => {
    // Carregar do localStorage (serão salvos na instalação)
    const savedPostgresPassword = localStorage.getItem('postgres_password') || 'postgres123';
    const savedMinioUser = localStorage.getItem('minio_user') || 'f0a02f9d4320abc34679f4742eecbad1';
    const savedMinioPassword = localStorage.getItem('minio_password') || '3e928e13c609385d81df326d680074f2d69434d752c44fa3161ddf89dcdaca55';

    setPostgresPassword(savedPostgresPassword);
    setMinioUser(savedMinioUser);
    setMinioPassword(savedMinioPassword);
  };

  const handleGenerateToken = async () => {
    if (!window.confirm(
      '⚠️ ATENÇÃO!\n\n' +
      'Gerar um novo token vai INVALIDAR o token atual!\n\n' +
      'Você precisará RECONFIGURAR TODOS os scanners instalados nos clientes com o novo token.\n\n' +
      'Tem certeza que deseja continuar?'
    )) {
      return;
    }

    try {
      setGenerating(true);
      const response = await systemService.generateToken();
      setToken(response.token);

      alert(
        '✅ Novo token gerado com sucesso!\n\n' +
        'Token: ' + response.token + '\n\n' +
        '⚠️ IMPORTANTE:\n' +
        'Copie este token e reconfigure todos os scanners instalados!'
      );
    } catch (error) {
      console.error('Erro ao gerar token:', error);
      alert('Erro ao gerar token. Verifique o console.');
    } finally {
      setGenerating(false);
    }
  };

  const handleCopyToken = async () => {
    try {
      await navigator.clipboard.writeText(token);
      setCopying(true);
      setTimeout(() => setCopying(false), 2000);
    } catch (error) {
      console.error('Erro ao copiar token:', error);
      alert('Erro ao copiar token. Copie manualmente.');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-gray-500">Carregando configurações de segurança...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h3 className="text-lg font-medium text-gray-900">Segurança</h3>
        <p className="mt-1 text-sm text-gray-500">
          Gerencie o token de autenticação para integração com scanners de código de barras
        </p>
      </div>

      {/* Token Atual */}
      <div className="bg-white shadow rounded-lg p-6">
        <div className="space-y-4">
          <div>
            <h4 className="text-base font-medium text-gray-900 flex items-center">
              🔑 Token de Autenticação (API_TOKEN)
            </h4>
            <p className="mt-1 text-sm text-gray-500">
              Este token é usado pelos scanners para autenticar as requisições ao sistema.
            </p>
          </div>

          {/* Campo do Token */}
          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700">
              Token Atual
            </label>
            <div className="flex space-x-2">
              <div className="flex-1 relative">
                <input
                  type={showToken ? 'text' : 'password'}
                  value={token}
                  readOnly
                  className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm bg-gray-50 font-mono text-sm"
                />
              </div>

              <button
                onClick={() => setShowToken(!showToken)}
                className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                {showToken ? '🙈 Ocultar' : '👁️ Mostrar'}
              </button>

              <button
                onClick={handleCopyToken}
                className={`px-4 py-2 border rounded-md shadow-sm text-sm font-medium focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition ${
                  copying
                    ? 'border-green-500 bg-green-50 text-green-700'
                    : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
                }`}
              >
                {copying ? '✅ Copiado!' : '📋 Copiar'}
              </button>
            </div>
          </div>

          {/* Informações */}
          <div className="bg-blue-50 border border-blue-200 rounded-md p-4">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-blue-400" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <h3 className="text-sm font-medium text-blue-800">
                  Como usar este token
                </h3>
                <div className="mt-2 text-sm text-blue-700">
                  <ul className="list-disc pl-5 space-y-1">
                    <li>Copie este token ao instalar o Scanner Service nos clientes</li>
                    <li>Cole no instalador visual quando solicitado</li>
                    <li>Todos os scanners precisam usar o mesmo token</li>
                    <li>Mantenha este token em segredo</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Credenciais do Banco de Dados */}
      <div className="bg-white shadow rounded-lg p-6">
        <div className="space-y-4">
          <div>
            <h4 className="text-base font-medium text-gray-900 flex items-center">
              🗄️ PostgreSQL - Banco de Dados
            </h4>
            <p className="mt-1 text-sm text-gray-500">
              Credenciais de acesso ao banco de dados PostgreSQL (somente leitura).
            </p>
          </div>

          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Usuário
              </label>
              <input
                type="text"
                value="postgres"
                readOnly
                className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm bg-gray-50 font-mono text-sm"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Senha
              </label>
              <div className="flex space-x-2">
                <div className="flex-1 relative">
                  <input
                    type={showPostgresPassword ? 'text' : 'password'}
                    value={postgresPassword}
                    readOnly
                    className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm bg-gray-50 font-mono text-sm"
                  />
                </div>
                <button
                  onClick={() => setShowPostgresPassword(!showPostgresPassword)}
                  className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                >
                  {showPostgresPassword ? '🙈 Ocultar' : '👁️ Mostrar'}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Porta
              </label>
              <input
                type="text"
                value="5434"
                readOnly
                className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm bg-gray-50 font-mono text-sm"
              />
            </div>
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-md p-3">
            <p className="text-xs text-blue-800">
              💡 Use estas credenciais para conectar ferramentas como pgAdmin, DBeaver ou outras aplicações que precisam acessar o banco de dados.
            </p>
          </div>
        </div>
      </div>

      {/* Credenciais do MinIO */}
      <div className="bg-white shadow rounded-lg p-6">
        <div className="space-y-4">
          <div>
            <h4 className="text-base font-medium text-gray-900 flex items-center">
              📦 MinIO - Armazenamento de Arquivos
            </h4>
            <p className="mt-1 text-sm text-gray-500">
              Credenciais de acesso ao MinIO para gerenciamento de arquivos (imagens/vídeos).
            </p>
          </div>

          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Access Key (Usuário)
              </label>
              <input
                type="text"
                value={minioUser}
                readOnly
                className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm bg-gray-50 font-mono text-sm"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Secret Key (Senha)
              </label>
              <div className="flex space-x-2">
                <div className="flex-1 relative">
                  <input
                    type={showMinioPassword ? 'text' : 'password'}
                    value={minioPassword}
                    readOnly
                    className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm bg-gray-50 font-mono text-sm"
                  />
                </div>
                <button
                  onClick={() => setShowMinioPassword(!showMinioPassword)}
                  className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                >
                  {showMinioPassword ? '🙈 Ocultar' : '👁️ Mostrar'}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Console (Interface Web)
              </label>
              <input
                type="text"
                value="http://localhost:9011"
                readOnly
                className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm bg-gray-50 font-mono text-sm"
              />
            </div>
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-md p-3">
            <p className="text-xs text-blue-800">
              💡 Acesse a interface web do MinIO através da porta 9011 para visualizar e gerenciar todos os arquivos armazenados (fotos e vídeos das bipagens).
            </p>
          </div>
        </div>
      </div>

      {/* Gerar Novo Token */}
      <div className="bg-white shadow rounded-lg p-6">
        <div className="space-y-4">
          <div>
            <h4 className="text-base font-medium text-gray-900 flex items-center">
              🔄 Gerar Novo Token
            </h4>
            <p className="mt-1 text-sm text-gray-500">
              Gere um novo token para renovar a segurança ou em caso de comprometimento.
            </p>
          </div>

          <div className="bg-yellow-50 border border-yellow-200 rounded-md p-4">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-yellow-400" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <h3 className="text-sm font-medium text-yellow-800">
                  ⚠️ ATENÇÃO - Consequências de gerar novo token:
                </h3>
                <div className="mt-2 text-sm text-yellow-700">
                  <ul className="list-disc pl-5 space-y-1">
                    <li><strong>Todos os scanners instalados pararão de funcionar</strong></li>
                    <li>Você precisará visitar CADA cliente e reconfigurar o scanner</li>
                    <li>Use apenas quando necessário (comprometimento de segurança)</li>
                    <li>Considere agendar com antecedência a troca</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>

          <div>
            <button
              onClick={handleGenerateToken}
              disabled={generating}
              className={`w-full sm:w-auto px-6 py-3 border border-transparent rounded-md shadow-sm text-base font-medium text-white focus:outline-none focus:ring-2 focus:ring-offset-2 transition ${
                generating
                  ? 'bg-gray-400 cursor-not-allowed'
                  : 'bg-yellow-600 hover:bg-yellow-700 focus:ring-yellow-500'
              }`}
            >
              {generating ? '⏳ Gerando...' : '🔄 Gerar Novo Token'}
            </button>
          </div>
        </div>
      </div>

      {/* Dicas de Segurança */}
      <div className="bg-white shadow rounded-lg p-6">
        <div className="space-y-4">
          <div>
            <h4 className="text-base font-medium text-gray-900 flex items-center">
              🛡️ Dicas de Segurança
            </h4>
          </div>

          <div className="space-y-3 text-sm text-gray-700">
            <div className="flex items-start">
              <span className="text-green-500 mr-2">✅</span>
              <span><strong>Renovação Regular:</strong> Considere trocar o token a cada 6-12 meses</span>
            </div>
            <div className="flex items-start">
              <span className="text-green-500 mr-2">✅</span>
              <span><strong>Sigilo:</strong> Não compartilhe o token em e-mails ou mensagens</span>
            </div>
            <div className="flex items-start">
              <span className="text-green-500 mr-2">✅</span>
              <span><strong>Backup:</strong> Anote o token em local seguro (cofre, gerenciador de senhas)</span>
            </div>
            <div className="flex items-start">
              <span className="text-red-500 mr-2">❌</span>
              <span><strong>Não Publique:</strong> Nunca exponha o token em repositórios públicos</span>
            </div>
            <div className="flex items-start">
              <span className="text-red-500 mr-2">❌</span>
              <span><strong>Não Reutilize:</strong> Use um token único para cada instalação/cliente</span>
            </div>
          </div>
        </div>
      </div>

      {/* Informações Técnicas */}
      <div className="bg-gray-50 border border-gray-200 rounded-md p-4">
        <details className="text-sm">
          <summary className="cursor-pointer font-medium text-gray-900 hover:text-gray-700">
            📖 Informações Técnicas
          </summary>
          <div className="mt-3 space-y-2 text-gray-700">
            <p><strong>Arquivo:</strong> O token é armazenado no arquivo <code className="bg-gray-200 px-1 rounded">.env</code> do backend</p>
            <p><strong>Variável:</strong> <code className="bg-gray-200 px-1 rounded">API_TOKEN</code></p>
            <p><strong>Uso:</strong> Enviado no header <code className="bg-gray-200 px-1 rounded">Authorization: Bearer [TOKEN]</code></p>
            <p><strong>Validação:</strong> Verificado no middleware de autenticação do webhook</p>
            <p><strong>Formato:</strong> String hexadecimal de 32 caracteres (16 bytes)</p>
          </div>
        </details>
      </div>
    </div>
  );
}
