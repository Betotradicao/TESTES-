import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import Logo from './Logo';

export default function Sidebar({ user, onLogout, isMobileMenuOpen, setIsMobileMenuOpen }) {
  const [expandedSections, setExpandedSections] = useState({});
  const [modulesConfig, setModulesConfig] = useState([]);
  const navigate = useNavigate();
  const location = useLocation();

  // Carregar configuração de módulos do localStorage
  useEffect(() => {
    const loadModulesConfig = () => {
      const savedModules = localStorage.getItem('modules_config');
      if (savedModules) {
        try {
          setModulesConfig(JSON.parse(savedModules));
        } catch (err) {
          console.error('Erro ao carregar módulos:', err);
        }
      }
    };

    loadModulesConfig();

    // Listener para atualizar quando módulos mudarem
    const handleStorageChange = () => {
      loadModulesConfig();
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  // Função para verificar se um módulo está ativo
  const isModuleActive = (moduleId) => {
    if (modulesConfig.length === 0) return true; // Default: todos ativos
    const module = modulesConfig.find(m => m.id === moduleId);
    return module ? module.active : true;
  };

  const toggleSection = (section) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  };

  const menuItems = [
    {
      id: 'dashboards',
      title: 'Dashboard',
      path: '/dashboard',
      moduleId: 'dashboard', // ID do módulo para verificar status
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <rect x="3" y="3" width="7" height="7" strokeWidth="2"/>
          <rect x="14" y="3" width="7" height="7" strokeWidth="2"/>
          <rect x="14" y="14" width="7" height="7" strokeWidth="2"/>
          <rect x="3" y="14" width="7" height="7" strokeWidth="2"/>
        </svg>
      ),
      items: []
    },
    {
      id: 'cameras',
      title: 'Cameras',
      moduleId: 'cameras', // ID do módulo para verificar status
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"/>
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z"/>
        </svg>
      ),
      expandable: true,
      items: [
        {
          title: 'Ao Vivo',
          icon: (
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"/>
            </svg>
          )
        },
        {
          title: 'Busca Agrupada',
          icon: (
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
            </svg>
          )
        }
      ]
    },
    {
      id: 'etiquetas',
      title: 'Prevenção de Bipagens',
      moduleId: 'bipagens', // ID do módulo para verificar status
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z"/>
        </svg>
      ),
      expandable: true,
      items: [
        {
          title: 'Bipagens Ao Vivo (VAR)',
          path: '/bipagens',
          icon: (
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z"/>
            </svg>
          )
        },
        {
          title: 'Ativar Produtos',
          path: '/ativar-produtos',
          icon: (
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"/>
            </svg>
          )
        },
        {
          title: 'Resultados do Dia',
          path: '/resultados-do-dia',
          icon: (
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/>
            </svg>
          )
        },
        {
          title: 'Rankings',
          path: '/rankings',
          icon: (
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z"/>
            </svg>
          )
        }
      ]
    },
    {
      id: 'pdv',
      title: 'Prevenção PDV',
      moduleId: 'pdv', // ID do módulo para verificar status
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2"/>
        </svg>
      ),
      expandable: true,
      items: [
        {
          title: 'Cadastrar Eventos',
          icon: (
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6"/>
            </svg>
          )
        },
        {
          title: 'Buscar Eventos',
          icon: (
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
            </svg>
          )
        },
        {
          title: 'Resultados do Dia',
          path: '/resultados-do-dia',
          icon: (
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/>
            </svg>
          )
        }
      ]
    },
    {
      id: 'facial',
      title: 'Prevenção Facial',
      moduleId: 'facial', // ID do módulo para verificar status
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/>
        </svg>
      ),
      expandable: true,
      items: [
        {
          title: 'Reconhecimento Facial',
          icon: (
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/>
            </svg>
          )
        },
        {
          title: 'Capturar Facial',
          icon: (
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"/>
            </svg>
          )
        },
        {
          title: 'Cadastrar Facial',
          icon: (
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z"/>
            </svg>
          )
        },
        {
          title: 'Reconhecidos do Dia',
          icon: (
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/>
            </svg>
          )
        }
      ]
    },
    {
      id: 'configuracoes',
      title: 'Configurações',
      path: '/configuracoes',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"/>
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>
        </svg>
      ),
      items: []
    }
  ];

  return (
    <>
      {/* Mobile overlay */}
      {isMobileMenuOpen && (
        <div
          className="fixed inset-0 bg-black/30 z-40 lg:hidden"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      {/* Sidebar */}
      <div className={`
        fixed lg:static inset-y-0 left-0 z-50 lg:z-auto
        w-80 bg-white h-screen shadow-lg flex flex-col
        transform transition-transform duration-300 ease-in-out lg:transform-none
        ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
      `}>
      {/* Logo Section */}
      <div className="p-6 border-b border-gray-200 flex justify-center">
        <Logo size="medium" />
      </div>

      {/* Menu Items */}
      <div className="flex-1 overflow-y-auto py-4">
        {menuItems.filter((item) => {
          // Hide Configurações for employees
          if (item.id === 'configuracoes' && user?.type === 'employee') {
            return false;
          }
          return true;
        }).map((item) => {
          const moduleActive = item.moduleId ? isModuleActive(item.moduleId) : true;

          return (
          <div key={item.id} className="mb-2">
            <button
              onClick={() => {
                // Se o módulo estiver desativado, não faz nada
                if (!moduleActive) {
                  return;
                }

                if (item.expandable) {
                  toggleSection(item.id);
                } else if (item.path) {
                  navigate(item.path);
                  setIsMobileMenuOpen(false);
                }
              }}
              className={`w-full flex items-center justify-between px-6 py-3 text-left transition-colors ${
                moduleActive
                  ? 'text-gray-700 hover:bg-gray-50 cursor-pointer'
                  : 'text-gray-400 cursor-not-allowed opacity-60'
              }`}
              disabled={!moduleActive}
            >
              <div className="flex items-center space-x-3">
                <span className={moduleActive ? 'text-gray-500' : 'text-gray-400'}>{item.icon}</span>
                <span className="text-sm font-medium">{item.title}</span>
              </div>
              {item.expandable && (
                <svg
                  className={`w-4 h-4 text-gray-400 transform transition-transform ${
                    expandedSections[item.id] ? 'rotate-180' : ''
                  }`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"/>
                </svg>
              )}
            </button>

            {/* Submenu Items */}
            {item.expandable && expandedSections[item.id] && (
              <div className="pl-14 pr-6 pb-2">
                {item.items.map((subItem, index) => (
                  <button
                    key={index}
                    onClick={() => {
                      // Se o módulo estiver desativado, não permite navegação
                      if (!moduleActive) {
                        return;
                      }

                      if (subItem.path) {
                        navigate(subItem.path);
                        setIsMobileMenuOpen(false);
                      }
                    }}
                    className={`flex items-center space-x-3 w-full text-left py-2 text-sm transition-colors ${
                      !moduleActive
                        ? 'text-gray-400 cursor-not-allowed opacity-60'
                        : subItem.path && location.pathname === subItem.path
                        ? 'text-orange-500 font-medium'
                        : 'text-gray-600 hover:text-orange-500'
                    }`}
                    disabled={!moduleActive}
                  >
                    <span className={moduleActive ? 'text-gray-400' : 'text-gray-300'}>{subItem.icon}</span>
                    <span>{subItem.title}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
          );
        })}
      </div>

      {/* User Section at Bottom */}
      <div className="border-t border-gray-200 p-4">
        <div className="flex items-center justify-between mb-3">
          <button
            onClick={() => {
              if (user?.type === 'employee') {
                navigate('/perfil');
                setIsMobileMenuOpen(false);
              }
            }}
            className={`flex items-center space-x-3 flex-1 ${
              user?.type === 'employee' ? 'cursor-pointer' : 'cursor-default'
            }`}
          >
            {user?.avatar ? (
              <img
                src={user.avatar}
                alt={user.name || user.email}
                className="w-8 h-8 rounded-full object-cover flex-shrink-0"
              />
            ) : (
              <div className="w-8 h-8 bg-orange-500 rounded-full flex items-center justify-center flex-shrink-0">
                <span className="text-white text-sm font-medium">
                  {(user?.name?.charAt(0) || user?.email?.charAt(0) || 'U').toUpperCase()}
                </span>
              </div>
            )}
            <div className="flex-1 min-w-0 text-center">
              <p className="text-sm font-medium text-gray-900 truncate">
                {user?.name || 'Prevenção Radar'}
              </p>
              <p className="text-xs text-gray-500 truncate">
                {user?.type === 'employee' ? user?.sector?.name || 'Colaborador' : 'Sistema de Segurança'}
              </p>
            </div>
          </button>
          <button
            onClick={onLogout}
            className="p-2 text-gray-400 hover:text-red-500 transition-colors flex-shrink-0"
            title="Sair"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"/>
            </svg>
          </button>
        </div>
        {user?.type === 'employee' && (
          <p className="text-xs text-gray-500 text-center">
            Clique no seu nome para acessar o perfil
          </p>
        )}
      </div>

      {/* Close button for mobile */}
      <button
        onClick={() => setIsMobileMenuOpen(false)}
        className="absolute top-4 right-4 lg:hidden p-2 text-gray-400 hover:text-gray-600"
      >
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"/>
        </svg>
      </button>
      </div>
    </>
  );
}