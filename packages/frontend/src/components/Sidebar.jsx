import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import Logo from './Logo';
import { MENU_SUBMENUS } from '../constants/menuConstants';

export default function Sidebar({ user, onLogout, isMobileMenuOpen, setIsMobileMenuOpen }) {
  const [expandedSections, setExpandedSections] = useState({
    'gestao-radar': true,
    'prevencao-radar': true
  });
  const [modulesConfig, setModulesConfig] = useState([]);
  const [isCollapsed, setIsCollapsed] = useState(() => {
    const saved = localStorage.getItem('sidebar_collapsed');
    return saved === 'true';
  });
  const navigate = useNavigate();
  const location = useLocation();

  // Salvar estado do collapse no localStorage
  useEffect(() => {
    localStorage.setItem('sidebar_collapsed', isCollapsed.toString());
  }, [isCollapsed]);

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

  // Função para verificar se colaborador tem permissão
  const hasPermission = (moduleId, submenuId = null) => {
    // Admin e Master sempre têm acesso total
    if (user?.type === 'admin' || user?.isMaster) return true;

    // Employees verificam permissões
    if (user?.type === 'employee') {
      if (!user.permissions) return false;

      const modulePerms = user.permissions[moduleId];
      if (!modulePerms) return false; // Sem permissão no módulo

      // Se submenuId não especificado, verifica se tem acesso ao módulo
      if (!submenuId) return true;

      // Se modulePerms é array vazio = acesso total ao módulo
      if (Array.isArray(modulePerms) && modulePerms.length === 0) return true;

      // Verifica se tem permissão específica no sub-menu
      return Array.isArray(modulePerms) && modulePerms.includes(submenuId);
    }

    return false;
  };

  const menuItems = [
    {
      id: 'gestao-radar',
      title: 'GESTÃO NO RADAR',
      titleComponent: (
        <span>
          <span className="text-gray-700">GESTÃO NO </span>
          <span className="text-orange-500 font-bold">RADAR</span>
        </span>
      ),
      icon: (
        <div className="w-5 h-5 bg-orange-500 rounded-md flex items-center justify-center">
          <svg className="w-3 h-3 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M3 3h7v7H3zM14 3h7v7h-7zM14 14h7v7h-7zM3 14h7v7H3z"/>
          </svg>
        </div>
      ),
      expandable: true,
      items: [
        {
          id: 'gestao-estoque-margem',
          title: 'Gestão Estoque e Margem',
          path: '/estoque-saude',
          icon: (
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"/>
            </svg>
          )
        },
        {
          id: 'gestao-compra-venda',
          title: 'Compra x Venda',
          path: '/compra-venda-analise',
          icon: (
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z"/>
            </svg>
          )
        },
        {
          id: 'pedidos-lista',
          title: 'Pedidos',
          path: '/prevencao-pedidos',
          icon: (
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01"/>
            </svg>
          )
        },
        {
          id: 'ruptura-industria',
          title: 'Ruptura INDUSTRIA',
          path: '/ruptura-industria',
          icon: (
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/>
            </svg>
          )
        }
      ]
    },
    {
      id: 'prevencao-radar',
      title: 'PREVENÇÃO NO RADAR',
      titleComponent: (
        <span>
          <span className="text-gray-700">PREVENÇÃO NO </span>
          <span className="text-orange-500 font-bold">RADAR</span>
        </span>
      ),
      icon: (
        <div className="w-5 h-5 bg-orange-500 rounded-md flex items-center justify-center">
          <svg className="w-3 h-3 text-white" viewBox="0 0 24 24" fill="currentColor">
            <circle cx="12" cy="12" r="3"/>
            <path d="M12 6c-3.31 0-6 2.69-6 6h2c0-2.21 1.79-4 4-4V6z"/>
            <path d="M12 2c-5.52 0-10 4.48-10 10h2c0-4.42 3.58-8 8-8V2z"/>
          </svg>
        </div>
      ),
      expandable: true,
      items: [
        {
          id: 'dashboard',
          title: 'Dashboard',
          path: '/dashboard',
          icon: (
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z"/>
            </svg>
          )
        },
        {
          id: 'bipagens',
          title: 'Prevenção de Bipagens',
          path: '/bipagens',
          icon: (
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z"/>
            </svg>
          )
        },
        {
          id: 'pdv',
          title: 'Prevenção PDV',
          path: '/frente-caixa',
          icon: (
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2"/>
            </svg>
          )
        },
        {
          id: 'facial',
          title: 'Prevenção Facial',
          path: '/reconhecimento-facial',
          icon: (
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/>
            </svg>
          )
        },
        {
          id: 'ruptura',
          title: 'Prevenção Rupturas',
          path: '/ruptura-lancador',
          icon: (
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"/>
            </svg>
          )
        },
        {
          id: 'etiquetas',
          title: 'Prevenção Etiquetas',
          path: '/etiquetas/lancar',
          icon: (
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z"/>
            </svg>
          )
        },
        {
          id: 'perdas',
          title: 'Prevenção Quebras',
          path: '/perdas-resultados',
          icon: (
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/>
            </svg>
          )
        },
        {
          id: 'producao',
          title: 'Prevenção Produção',
          path: '/producao-lancador',
          icon: (
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"/>
            </svg>
          )
        },
        {
          id: 'hortfruti',
          title: 'Prevenção HortFruti',
          path: '/hortfrut-lancador',
          icon: (
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z"/>
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
    },
    {
      id: 'configuracoes-rede',
      title: 'Configurações de REDE',
      path: '/configuracoes-rede',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9"/>
        </svg>
      ),
      items: []
    },
    {
      id: 'configuracoes-tabelas',
      title: 'Configurações de TABELAS',
      path: '/configuracoes-tabelas',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4"/>
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
        ${isCollapsed ? 'w-16' : 'w-80'} bg-white h-screen shadow-lg flex flex-col
        transform transition-all duration-300 ease-in-out lg:transform-none
        ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
      `}>
      {/* Logo Section */}
      <div className={`${isCollapsed ? 'p-2' : 'p-6'} border-b border-gray-200 flex justify-center relative`}>
        {isCollapsed ? (
          <div className="w-10 h-10 bg-orange-500 rounded-lg flex items-center justify-center">
            <span className="text-white font-bold text-sm">PR</span>
          </div>
        ) : (
          <Logo size="medium" />
        )}

        {/* Botão de Toggle - Desktop only */}
        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="hidden lg:flex absolute -right-3 top-1/2 -translate-y-1/2 w-6 h-6 bg-white border border-gray-200 rounded-full items-center justify-center shadow-sm hover:bg-gray-50 transition-colors"
          title={isCollapsed ? 'Expandir menu' : 'Minimizar menu'}
        >
          <svg
            className={`w-3 h-3 text-gray-500 transition-transform ${isCollapsed ? 'rotate-180' : ''}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7"/>
          </svg>
        </button>
      </div>

      {/* Menu Items */}
      <div className="flex-1 overflow-y-auto py-4">
        {menuItems.filter((item) => {
          // Hide Configurações for employees
          if (item.id === 'configuracoes' && user?.type === 'employee') {
            return false;
          }
          // Hide Configurações de REDE for non-master users
          if (item.id === 'configuracoes-rede' && !user?.isMaster) {
            return false;
          }
          // Hide Configurações de TABELAS for non-master users
          if (item.id === 'configuracoes-tabelas' && !user?.isMaster) {
            return false;
          }

          // Verificar permissão no módulo (para employees)
          if (user?.type === 'employee' && item.moduleId) {
            return hasPermission(item.moduleId);
          }

          return true;
        }).map((item) => {
          const moduleActive = item.moduleId ? isModuleActive(item.moduleId) : true;

          // Filtrar sub-menus baseado em permissões
          const filteredItems = item.items ? item.items.filter(subitem => {
            if (user?.type === 'employee' && item.moduleId && subitem.id) {
              return hasPermission(item.moduleId, subitem.id);
            }
            return true;
          }) : item.items;

          return <div key={item.id} className={isCollapsed ? 'mb-1' : 'mb-2'}>
            <button
              onClick={() => {
                // Se o módulo estiver desativado, não faz nada
                if (!moduleActive) {
                  return;
                }

                // Se colapsado e tem path direto, navega
                if (isCollapsed && item.path) {
                  navigate(item.path);
                  setIsMobileMenuOpen(false);
                  return;
                }

                // Se colapsado e expandable, expande a sidebar primeiro
                if (isCollapsed && item.expandable) {
                  setIsCollapsed(false);
                  toggleSection(item.id);
                  return;
                }

                if (item.expandable) {
                  toggleSection(item.id);
                } else if (item.path) {
                  navigate(item.path);
                  setIsMobileMenuOpen(false);
                }
              }}
              className={`w-full flex items-center ${isCollapsed ? 'justify-center px-2' : 'justify-between px-6'} py-3 text-left transition-colors ${
                moduleActive
                  ? 'text-gray-700 hover:bg-gray-50 cursor-pointer'
                  : 'text-gray-400 cursor-not-allowed opacity-60'
              }`}
              disabled={!moduleActive}
              title={isCollapsed ? item.title : ''}
            >
              <div className={`flex items-center ${isCollapsed ? '' : 'space-x-3'}`}>
                <span className={moduleActive ? 'text-gray-500' : 'text-gray-400'}>{item.icon}</span>
                {!isCollapsed && <span className="text-sm font-medium">{item.titleComponent || item.title}</span>}
              </div>
              {!isCollapsed && item.expandable && (
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

            {/* Submenu Items - Só mostra se não colapsado */}
            {!isCollapsed && item.expandable && expandedSections[item.id] && (
              <div className="pl-14 pr-6 pb-2">
                {filteredItems.map((subItem, index) => (
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
        })}
      </div>

      {/* User Section at Bottom */}
      <div className={`border-t border-gray-200 ${isCollapsed ? 'p-2' : 'p-4'}`}>
        {isCollapsed ? (
          // Versão colapsada - só o avatar e logout
          <div className="flex flex-col items-center gap-2">
            <button
              onClick={() => {
                if (user?.type === 'employee') {
                  navigate('/perfil');
                  setIsMobileMenuOpen(false);
                }
              }}
              className={user?.type === 'employee' ? 'cursor-pointer' : 'cursor-default'}
              title={user?.name || 'Usuário'}
            >
              {user?.avatar ? (
                <img
                  src={user.avatar}
                  alt={user.name || user.email}
                  className="w-8 h-8 rounded-full object-cover"
                />
              ) : (
                <div className="w-8 h-8 bg-orange-500 rounded-full flex items-center justify-center">
                  <span className="text-white text-sm font-medium">
                    {(user?.name?.charAt(0) || user?.email?.charAt(0) || 'U').toUpperCase()}
                  </span>
                </div>
              )}
            </button>
            <button
              onClick={onLogout}
              className="p-1.5 text-gray-400 hover:text-red-500 transition-colors"
              title="Sair"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"/>
              </svg>
            </button>
          </div>
        ) : (
          // Versão expandida - completa
          <>
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
          </>
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