import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useSearchParams, useNavigate } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import TabsNavigation from '../components/configuracoes/TabsNavigation';
import ModulosTab from '../components/configuracoes/ModulosTab';
import EmpresaTab from '../components/configuracoes/EmpresaTab';
import APIsTab from '../components/configuracoes/APIsTab';
import SecurityTab from '../components/configuracoes/SecurityTab';

export default function ConfiguracoesRede() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [searchParams, setSearchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState(() => {
    return searchParams.get('tab') || 'modulos';
  });

  // Estado para controle de autenticação master
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(true);
  const [authUsername, setAuthUsername] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authError, setAuthError] = useState('');

  useEffect(() => {
    const tabFromUrl = searchParams.get('tab');
    if (tabFromUrl && (tabFromUrl === 'modulos' || tabFromUrl === 'empresa' || tabFromUrl === 'apis' || tabFromUrl === 'security')) {
      setActiveTab(tabFromUrl);
    }
  }, [searchParams]);

  const handleTabChange = (tab) => {
    setActiveTab(tab);
    setSearchParams({ tab });
  };

  const handleAuthSubmit = (e) => {
    e.preventDefault();

    // Credenciais do usuário master
    const MASTER_USERNAME = 'Beto';
    const MASTER_PASSWORD = 'Beto3107@';

    if (authUsername === MASTER_USERNAME && authPassword === MASTER_PASSWORD) {
      setIsAuthenticated(true);
      setShowAuthModal(false);
      setAuthError('');
    } else {
      setAuthError('Usuário ou senha incorretos. Apenas o usuário master tem acesso.');
      setAuthPassword('');
    }
  };

  const handleCancelAuth = () => {
    navigate('/dashboard');
  };

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Modal de Autenticação Master */}
      {showAuthModal && !isAuthenticated && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl p-8 max-w-md w-full mx-4">
            <div className="text-center mb-6">
              <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-orange-100 mb-4">
                <svg className="h-6 w-6 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
              </div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">Acesso Restrito</h3>
              <p className="text-sm text-gray-500">
                Esta área requer autenticação do usuário master
              </p>
            </div>

            <form onSubmit={handleAuthSubmit} className="space-y-4">
              <div>
                <label htmlFor="auth-username" className="block text-sm font-medium text-gray-700 mb-1">
                  Usuário
                </label>
                <input
                  id="auth-username"
                  type="text"
                  value={authUsername}
                  onChange={(e) => setAuthUsername(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
                  placeholder=""
                  autoComplete="off"
                  autoFocus
                  required
                />
              </div>

              <div>
                <label htmlFor="auth-password" className="block text-sm font-medium text-gray-700 mb-1">
                  Senha
                </label>
                <input
                  id="auth-password"
                  type="password"
                  value={authPassword}
                  onChange={(e) => setAuthPassword(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
                  placeholder=""
                  autoComplete="off"
                  required
                />
              </div>

              {authError && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md text-sm">
                  {authError}
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={handleCancelAuth}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-orange-600 text-white rounded-md hover:bg-orange-700 transition-colors"
                >
                  Entrar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Sidebar */}
      <Sidebar
        user={user}
        onLogout={logout}
        isMobileMenuOpen={isMobileMenuOpen}
        setIsMobileMenuOpen={setIsMobileMenuOpen}
      />

      {/* Main Content - Só aparece se autenticado */}
      {isAuthenticated ? (
        <div className="flex-1 overflow-auto lg:ml-0">
          {/* Mobile Header */}
          <div className="lg:hidden bg-white shadow-sm p-4 flex items-center justify-between">
            <button
              onClick={() => setIsMobileMenuOpen(true)}
              className="p-2 text-gray-600 hover:text-gray-900"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16"/>
              </svg>
            </button>
            <h1 className="text-lg font-semibold text-gray-900">Configurações de REDE</h1>
            <button
              onClick={logout}
              className="p-2 text-gray-600 hover:text-red-600"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"/>
              </svg>
            </button>
          </div>

          {/* Content Area */}
          <div className="p-6">
            <div className="hidden lg:block mb-6">
              <h1 className="text-2xl font-bold text-gray-900">Configurações de REDE</h1>
            </div>

            <TabsNavigation activeTab={activeTab} onChange={handleTabChange} pageType="rede" />

            <div className="mt-6">
              {activeTab === 'modulos' && <ModulosTab />}
              {activeTab === 'empresa' && <EmpresaTab />}
              {activeTab === 'apis' && <APIsTab />}
              {activeTab === 'security' && <SecurityTab />}
            </div>
          </div>
        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center text-gray-400">
            <svg className="mx-auto h-12 w-12 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
            <p>Autenticação necessária</p>
          </div>
        </div>
      )}
    </div>
  );
}
