import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import Logo from './Logo';
import { MENU_SUBMENUS } from '../constants/menuConstants';

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
      id: 'dashboards',
      title: 'Boas Vindas',
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
      id: 'bipagens',
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
          id: MENU_SUBMENUS.BIPAGENS_AO_VIVO,
          title: 'Bipagens Ao Vivo (VAR)',
          path: '/bipagens',
          icon: (
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z"/>
            </svg>
          )
        },
        {
          id: MENU_SUBMENUS.BIPAGENS_RESULTADOS,
          title: 'Resultados do Dia',
          path: '/resultados-do-dia',
          icon: (
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/>
            </svg>
          )
        },
        {
          id: MENU_SUBMENUS.BIPAGENS_ATIVAR,
          title: 'Ativar Produtos',
          path: '/ativar-produtos',
          icon: (
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
            </svg>
          )
        },
        {
          id: MENU_SUBMENUS.BIPAGENS_RANKINGS,
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
        },
        {
          title: 'Controle PDV',
          path: '/controle-pdv',
          icon: (
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z"/>
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
          path: '/reconhecimento-facial',
          icon: (
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/>
            </svg>
          )
        }
      ]
    },
    {
      id: 'ruptura',
      title: 'Prevenção Rupturas',
      moduleId: 'ruptura',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"/>
        </svg>
      ),
      expandable: true,
      items: [
        {
          title: 'Lançador de Itens',
          path: '/ruptura-lancador',
          icon: (
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"/>
            </svg>
          )
        },
        {
          title: 'Resultados das Auditorias',
          path: '/ruptura-auditorias',
          icon: (
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/>
            </svg>
          )
        }
      ]
    },
    {
      id: 'etiquetas',
      title: 'Prevenção Etiquetas',
      moduleId: 'etiquetas',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z"/>
        </svg>
      ),
      expandable: true,
      items: [
        {
          title: 'Lançador de Itens',
          path: '/etiquetas/lancar',
          icon: (
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"/>
            </svg>
          )
        },
        {
          title: 'Resultados das Auditorias',
          path: '/etiquetas/resultados',
          icon: (
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/>
            </svg>
          )
        }
      ]
    },
    {
      id: 'perdas',
      title: 'Prevenção Quebras',
      moduleId: 'perdas',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/>
        </svg>
      ),
      expandable: true,
      items: [
        {
          title: 'Lançador de Itens',
          path: '/perdas-lancador',
          icon: (
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"/>
            </svg>
          )
        },
        {
          title: 'Resultados dos Lançamentos',
          path: '/perdas-resultados',
          icon: (
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/>
            </svg>
          )
        }
      ]
    },
    {
      id: 'producao',
      title: 'Prevenção Produção',
      moduleId: 'producao',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"/>
        </svg>
      ),
      expandable: true,
      items: [
        {
          title: 'Sugestão Produção Padaria',
          path: '/producao/sugestao',
          icon: (
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/>
            </svg>
          )
        },
        {
          title: 'Resultados',
          path: '/producao/resultados',
          icon: (
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/>
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
          // Hide Configurações de REDE for non-master users
          if (item.id === 'configuracoes-rede' && !user?.isMaster) {
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

          return <div key={item.id} className="mb-2">
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