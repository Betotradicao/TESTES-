import { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import Logo from './Logo';
import { MENU_SUBMENUS } from '../constants/menuConstants';
import { useLoja } from '../contexts/LojaContext';
import { api } from '../utils/api';

export default function Sidebar({ user, onLogout, isMobileMenuOpen, setIsMobileMenuOpen }) {
  const [expandedSections, setExpandedSections] = useState(() => {
    try {
      const saved = localStorage.getItem('sidebar_expanded_sections');
      if (saved) return JSON.parse(saved);
    } catch {}
    return {
      'metas-radar': false,
      'gestao-radar': false,
      'prevencao-radar': false,
      'financas-radar': false,
      'marketing-radar': false,
      'ia-radar': false,
      'vision-360': false
    };
  });
  const [expandedItems, setExpandedItems] = useState(() => {
    try {
      const saved = localStorage.getItem('sidebar_expanded_items');
      if (saved) return JSON.parse(saved);
    } catch {}
    return {};
  });
  const [modulesConfig, setModulesConfig] = useState([]);
  const [isCollapsed, setIsCollapsed] = useState(() => {
    const saved = localStorage.getItem('sidebar_collapsed');
    return saved === 'true';
  });
  const [lojaDropdownOpen, setLojaDropdownOpen] = useState(false);
  const [dbConnected, setDbConnected] = useState(null);
  const navigate = useNavigate();
  const location = useLocation();
  const { lojas, lojaSelecionada, selecionarLoja, getLojaLabel } = useLoja();

  // Health check - verificar conexão com banco externo (ERP) a cada 30s
  useEffect(() => {
    const checkHealth = async () => {
      try {
        const res = await api.get('/health');
        const ext = res.data?.externalDatabases;
        // Só mostra "CONEXÃO = OK" se tem banco externo configurado E conectado
        if (ext?.configured) {
          setDbConnected(ext.allConnected === true);
        } else {
          // Sem banco externo configurado = sem conexão ERP
          setDbConnected(null);
        }
      } catch {
        setDbConnected(false);
      }
    };
    checkHealth();
    const interval = setInterval(checkHealth, 30000);
    return () => clearInterval(interval);
  }, []);

  // Salvar estado do collapse no localStorage
  useEffect(() => {
    localStorage.setItem('sidebar_collapsed', isCollapsed.toString());
  }, [isCollapsed]);

  // Salvar estado dos menus expandidos no localStorage
  useEffect(() => {
    localStorage.setItem('sidebar_expanded_sections', JSON.stringify(expandedSections));
  }, [expandedSections]);

  useEffect(() => {
    localStorage.setItem('sidebar_expanded_items', JSON.stringify(expandedItems));
  }, [expandedItems]);

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

  const toggleItem = (itemId) => {
    setExpandedItems(prev => ({
      ...prev,
      [itemId]: !prev[itemId]
    }));
  };

  // Manter submenus expandidos baseado na rota atual
  useEffect(() => {
    const currentPath = location.pathname;

    // Mapear rotas para seus submenus pais (expandedItems)
    const routeToSubmenu = {
      // Metas
      '/metas-ranking': 'metas',
      '/metas-parametrizar': 'metas',
      '/bipagens': 'bipagens',
      '/resultados-do-dia': 'bipagens',
      '/rankings': 'bipagens',
      '/ruptura-lancador': 'ruptura',
      '/ruptura-auditorias': 'ruptura',
      '/etiquetas/lancar': 'etiquetas',
      '/etiquetas/resultados': 'etiquetas',
      '/perdas-lancador': 'perdas',
      '/perdas-resultados': 'perdas',
      '/prevencao-trocas': 'prevencao-trocas',
      '/producao-lancador': 'producao',
      '/producao-sugestao': 'producao',
      '/producao/resultados': 'producao',
      '/hortfrut-lancador': 'hortfruti',
      '/hortfrut-resultados': 'hortfruti',
      '/nota-fiscal-recebimento': 'controle-recebimento',
      '/notas-a-chegar': 'controle-recebimento',
      '/extrato-santander': 'bancos',
      '/extrato-tribanco': 'bancos',
      '/extrato-banco24h': 'bancos',
      '/boletos-dda': 'bancos',
      '/conciliacao-bancaria': 'bancos',
      // Gestão de Estoque
      '/estoque-saude': 'gestao-estoque-margem',
      '/pricing-ponderacao': 'gestao-estoque-margem',
      '/analise-relevancia': 'pricing',
      '/margens-categoria': 'pricing',
      // Gestão de Compras
      '/compra-venda-analise': 'compras',
      '/prevencao-pedidos': 'compras',
      '/calendario-atendimento': 'compras',
      '/ruptura-industria': 'compras',
      '/prazo-fornecedores': 'compras',
      '/analise-cotacao': 'compras',
      // Gestão de Pricing
      '/saude-margens': 'pricing',
      '/pricing-ancoragem': 'pricing',
      '/pricing-competitividade': 'pricing',
      // Gestão de Ofertas
      '/gestao-ofertas/programacao-atual': 'ofertas',
      '/gestao-ofertas/analise-sugestao': 'ofertas',
      '/gestao-ofertas/simulador-venda': 'ofertas',
      // Vision 360
      '/vision-pdv': 'vision-pdv',
      '/vision-operacoes-risco': 'vision-pdv',
      '/vision-palavra-chave-2': 'vision-pdv',
      '/reconhecimento-facial': 'vision-facial',
      '/vision-facial': 'vision-facial',
    };

    // Mapear rotas para a seção principal (expandedSections)
    const routeToSection = {
      '/metas-ranking': 'metas-radar',
      '/metas-parametrizar': 'metas-radar',
      '/gestao-inteligente': 'gestao-radar',
      '/estoque-saude': 'gestao-radar',
      '/saude-margens': 'gestao-radar',
      '/pricing-ponderacao': 'gestao-radar',
      '/analise-relevancia': 'gestao-radar',
      '/compra-venda-analise': 'gestao-radar',
      '/prevencao-pedidos': 'gestao-radar',
      '/calendario-atendimento': 'gestao-radar',
      '/ruptura-industria': 'gestao-radar',
      '/prazo-fornecedores': 'gestao-radar',
      '/analise-cotacao': 'gestao-radar',
      '/pricing-ancoragem': 'gestao-radar',
      '/pricing-competitividade': 'gestao-radar',
      '/gestao-ofertas/programacao-atual': 'gestao-radar',
      '/gestao-ofertas/analise-sugestao': 'gestao-radar',
      '/gestao-ofertas/simulador-venda': 'gestao-radar',
      '/bipagens': 'vision-360',
      '/resultados-do-dia': 'vision-360',
      '/rankings': 'vision-360',
      '/ruptura-lancador': 'prevencao-radar',
      '/ruptura-auditorias': 'prevencao-radar',
      '/etiquetas/lancar': 'prevencao-radar',
      '/etiquetas/resultados': 'prevencao-radar',
      '/perdas-lancador': 'prevencao-radar',
      '/perdas-resultados': 'prevencao-radar',
      '/prevencao-trocas': 'prevencao-radar',
      '/producao-lancador': 'prevencao-radar',
      '/producao-sugestao': 'prevencao-radar',
      '/producao/resultados': 'prevencao-radar',
      '/hortfrut-lancador': 'prevencao-radar',
      '/hortfrut-resultados': 'prevencao-radar',
      '/frente-caixa': 'prevencao-radar',
      '/prevencao-caixa': 'prevencao-radar',
      '/gestao-trocas': 'prevencao-radar',
      '/controle-pdv': 'prevencao-radar',
      '/prevencao-tributaria': 'prevencao-radar',
      '/oferta-radar': 'oferta-radar',
      '/garimpa-fornecedores': 'oferta-radar',
      '/garimpador-ranking': 'oferta-radar',
      '/garimpador-ranking-concorrentes': 'oferta-radar',
      '/garimpador-projecao': 'oferta-radar',
      '/garimpador-fora-mix': 'oferta-radar',
      '/garimpador-produtos-pesquisar': 'oferta-radar',
      '/garimpador-ecommerce': 'oferta-radar',
      '/marketing-whatsapp': 'marketing-radar',
      '/disparo-whatsapp': 'marketing-radar',
      '/nota-fiscal-recebimento': 'financas-radar',
      '/notas-a-chegar': 'financas-radar',
      '/demonstrativo-caixa': 'financas-radar',
      '/entradas-saidas': 'financas-radar',
      '/extrato-santander': 'financas-radar',
      '/extrato-tribanco': 'financas-radar',
      '/extrato-banco24h': 'financas-radar',
      '/boletos-dda': 'financas-radar',
      '/conciliacao-bancaria': 'financas-radar',
      '/vision-pdv': 'vision-360',
      '/vision-operacoes-risco': 'vision-360',
      '/vision-palavra-chave-2': 'vision-360',
      '/vision-facial': 'vision-360',
      '/reconhecimento-facial': 'vision-360',
    };

    // Auto-expandir a seção principal
    const sectionId = routeToSection[currentPath];
    if (sectionId) {
      setExpandedSections(prev => {
        if (prev[sectionId]) return prev;
        return { ...prev, [sectionId]: true };
      });
    }

    // Auto-expandir o item (submenu) dentro da seção
    const submenuId = routeToSubmenu[currentPath];
    if (submenuId) {
      setExpandedItems(prev => {
        if (prev[submenuId]) return prev;
        return { ...prev, [submenuId]: true };
      });
    }
  }, [location.pathname]);

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
      id: 'metas-radar',
      title: 'METAS NO RADAR',
      titleComponent: (
        <span>
          <span className="text-gray-700">METAS NO </span>
          <span className="text-amber-500 font-bold">RADAR</span>
        </span>
      ),
      icon: (
        <div className="w-5 h-5 bg-amber-500 rounded-md flex items-center justify-center">
          <svg className="w-3 h-3 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10"/>
            <circle cx="12" cy="12" r="6"/>
            <circle cx="12" cy="12" r="2"/>
            <line x1="12" y1="2" x2="12" y2="6"/>
          </svg>
        </div>
      ),
      expandable: true,
      items: [
        {
          id: 'metas',
          moduleId: 'metas',
          title: 'METAS',
          icon: (
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <circle cx="12" cy="12" r="10" strokeWidth="2"/>
              <circle cx="12" cy="12" r="6" strokeWidth="2"/>
              <circle cx="12" cy="12" r="2" strokeWidth="2"/>
            </svg>
          ),
          expandable: true,
          subItems: [
            { id: 'metas-ranking', submenuId: 'metas-ranking', title: 'RANKING DE METAS', path: '/metas-ranking' },
            { id: 'metas-parametrizar', submenuId: 'metas-parametrizar', title: 'PARAMETRIZAR', path: '/metas-parametrizar' },
          ]
        }
      ]
    },
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
          id: 'gestao-inteligente',
          moduleId: 'gestao-inteligente',
          title: 'GESTÃO INTELIGENTE',
          path: '/gestao-inteligente',
          icon: (
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/>
            </svg>
          )
        },
        {
          id: 'gestao-estoque-margem',
          moduleId: 'estoque-margem',
          title: 'GESTÃO DE ESTOQUE',
          icon: (
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"/>
            </svg>
          ),
          expandable: true,
          subItems: [
            { id: 'estoque-saude', submenuId: 'estoque-saude', title: 'SAÚDE DO ESTOQUE', path: '/estoque-saude' },
            { id: 'analise-corte', submenuId: 'analise-corte', title: 'ANÁLISE DE CORTE', path: '/pricing-ponderacao' },
          ]
        },
        {
          id: 'compras',
          moduleId: 'compras',
          title: 'GESTÃO DE COMPRAS',
          icon: (
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z"/>
            </svg>
          ),
          expandable: true,
          subItems: [
            { id: 'gestao-compra-venda', submenuId: 'compra-venda', title: 'COMPRA X VENDA', path: '/compra-venda-analise' },
            { id: 'pedidos-lista', submenuId: 'pedidos', title: 'PEDIDOS DE COMPRAS', path: '/prevencao-pedidos' },
            { id: 'calendario-atendimento', submenuId: 'calendario-atendimento', title: 'CALENDÁRIO DE ATENDIMENTO', path: '/calendario-atendimento' },
            { id: 'ruptura-industria', submenuId: 'ruptura-industria', title: 'RUPTURA INDUSTRIA', path: '/ruptura-industria' },
            { id: 'prazo-fornecedores', submenuId: 'prazo-fornecedores', title: 'PRAZO FORNECEDORES', path: '/prazo-fornecedores' },
            { id: 'analise-cotacao', submenuId: 'analise-cotacao', title: 'ANALISE DE COTACAO', path: '/analise-cotacao' }
          ]
        },
        {
          id: 'pricing',
          moduleId: 'pricing',
          title: 'GESTÃO DE PRICING',
          icon: (
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z"/>
            </svg>
          ),
          expandable: true,
          subItems: [
            { id: 'saude-margens', submenuId: 'saude-margens', title: 'SAÚDE DE MARGENS', path: '/saude-margens' },
            { id: 'pricing-ancoragem', submenuId: 'pricing-ancoragem', title: 'ANCORAGEM DE PREÇO', path: '/pricing-ancoragem' },
            { id: 'pricing-competitividade', submenuId: 'pricing-competitividade', title: 'COMPETITIVIDADE E CONCORRÊNCIA', path: '/pricing-competitividade' },
            { id: 'analise-relevancia', submenuId: 'analise-relevancia', title: 'ANÁLISE RELEVÂNCIA', path: '/analise-relevancia' },
            { id: 'margens-categoria', submenuId: 'margens-categoria', title: 'MARGENS POR CATEGORIA', path: '/margens-categoria' }
          ]
        },
        {
          id: 'ofertas',
          moduleId: 'ofertas',
          title: 'GESTÃO DE OFERTAS',
          icon: (
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v13m0-13V6a2 2 0 112 2h-2zm0 0V5.5A2.5 2.5 0 109.5 8H12zm-7 4h14M5 12a2 2 0 110-4h14a2 2 0 110 4M5 12v7a2 2 0 002 2h10a2 2 0 002-2v-7"/>
            </svg>
          ),
          expandable: true,
          subItems: [
            { id: 'programacao-atual', submenuId: 'programacao-atual', title: 'PROGRAMAÇÃO ATUAL', path: '/gestao-ofertas/programacao-atual' },
            { id: 'analise-oferta', submenuId: 'analise-oferta', title: 'ANÁLISE E SUGESTÃO', path: '/gestao-ofertas/analise-sugestao' },
            { id: 'simulador-venda', submenuId: 'simulador-venda', title: 'SIMULADOR DE VENDA', path: '/gestao-ofertas/simulador-venda' }
          ]
        },
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
          id: 'pdv',
          moduleId: 'pdv',
          title: 'PREVENÇÃO PDV',
          icon: (
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2"/>
            </svg>
          ),
          expandable: true,
          subItems: [
            { id: 'frente-caixa', submenuId: 'pdv-frente-caixa', title: 'GESTÃO FRENTE DE CAIXA', path: '/frente-caixa' },
            { id: 'prevencao-caixa', submenuId: 'pdv-prevencao-caixa', title: 'PREVENÇÃO DE CAIXA', path: '/prevencao-caixa' }
          ]
        },
        {
          id: 'ruptura',
          moduleId: 'ruptura',
          title: 'PREVENÇÃO RUPTURAS',
          icon: (
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"/>
            </svg>
          ),
          expandable: true,
          subItems: [
            { id: 'ruptura-lancador', submenuId: 'ruptura-lancador', title: 'LANÇAR AUDITORIA', path: '/ruptura-lancador' },
            { id: 'ruptura-auditorias', submenuId: 'ruptura-auditorias', title: 'RESULTADOS AUDITORIAS', path: '/ruptura-auditorias' }
          ]
        },
        {
          id: 'etiquetas',
          moduleId: 'etiquetas',
          title: 'PREVENÇÃO ETIQUETAS',
          icon: (
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z"/>
            </svg>
          ),
          expandable: true,
          subItems: [
            { id: 'etiquetas-lancador', submenuId: 'etiquetas-lancar', title: 'LANÇAR AUDITORIA', path: '/etiquetas/lancar' },
            { id: 'etiquetas-resultados', submenuId: 'etiquetas-resultados', title: 'RESULTADOS AUDITORIAS', path: '/etiquetas/resultados' }
          ]
        },
        {
          id: 'perdas',
          moduleId: 'perdas',
          title: 'PREVENÇÃO QUEBRAS',
          icon: (
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/>
            </svg>
          ),
          expandable: true,
          subItems: [
            { id: 'perdas-lancador', submenuId: 'perdas-lancador', title: 'LANÇAR QUEBRAS', path: '/perdas-lancador' },
            { id: 'perdas-resultados', submenuId: 'perdas-resultados', title: 'RESULTADOS QUEBRAS', path: '/perdas-resultados' }
          ]
        },
        {
          id: 'prevencao-trocas',
          moduleId: 'prevencao-trocas',
          title: 'PREVENÇÃO TROCAS',
          icon: (
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4"/>
            </svg>
          ),
          path: '/prevencao-trocas',
        },
        {
          id: 'producao',
          moduleId: 'producao',
          title: 'PREVENÇÃO PRODUÇÃO',
          icon: (
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"/>
            </svg>
          ),
          expandable: true,
          subItems: [
            { id: 'producao-lancador', submenuId: 'producao-lancador', title: 'LANÇAR PRODUÇÃO', path: '/producao-lancador' },
            { id: 'producao-sugestao', submenuId: 'producao-sugestao', title: 'SUGESTÃO DE PRODUÇÃO', path: '/producao-sugestao' },
            { id: 'producao-resultados', submenuId: 'producao-resultados', title: 'RESULTADOS', path: '/producao/resultados' }
          ]
        },
        {
          id: 'hortfruti',
          moduleId: 'hortfrut',
          title: 'PREVENÇÃO HORTFRUTI',
          icon: (
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z"/>
            </svg>
          ),
          expandable: true,
          subItems: [
            { id: 'hortfrut-lancador', submenuId: 'hortfrut-lancador', title: 'LANÇAR HORTFRUTI', path: '/hortfrut-lancador' },
            { id: 'hortfrut-resultados', submenuId: 'hortfrut-resultados', title: 'RESULTADOS', path: '/hortfrut-resultados' }
          ]
        },
        {
          id: 'controle-recebimento',
          moduleId: 'controle-recebimento',
          title: 'PREVENÇÃO RECEBIMENTO',
          icon: (
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
            </svg>
          ),
          expandable: true,
          subItems: [
            { id: 'nf-a-chegar', submenuId: 'nf-a-chegar', title: 'NOTAS A CHEGAR', path: '/notas-a-chegar' },
            { id: 'nf-recebimento', submenuId: 'nf-recebimento', title: 'NOTAS ENTREGUE', path: '/nota-fiscal-recebimento' },
            { id: 'pendencias-notas', submenuId: 'pendencias-notas', title: 'PENDÊNCIAS DE NOTAS', path: '/pendencias-notas' }
          ]
        },
        {
          id: 'abastecimento',
          moduleId: 'abastecimento',
          title: 'PREVENÇÃO ABASTECIMENTO',
          icon: (
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16V6a1 1 0 00-1-1H4a1 1 0 00-1 1v10a1 1 0 001 1h1m8-1a1 1 0 01-1 1H9m4-1V8a1 1 0 011-1h2.586a1 1 0 01.707.293l3.414 3.414a1 1 0 01.293.707V16a1 1 0 01-1 1h-1m-6-1a1 1 0 001 1h1M5 17a2 2 0 104 0m-4 0a2 2 0 114 0m6 0a2 2 0 104 0m-4 0a2 2 0 114 0"/>
            </svg>
          ),
          expandable: true,
          subItems: [
            { id: 'prioridade-reposicao', submenuId: 'prioridade-reposicao', title: 'PRIORIDADE REPOSIÇÃO', path: '/prioridade-reposicao' }
          ]
        },
        {
          id: 'prevencao-tributaria',
          moduleId: 'prevencao-tributaria',
          title: 'PREVENÇÃO TRIBUTÁRIA',
          icon: (
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 14l6-6m-5.5.5h.01m4.99 5h.01M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16l3.5-2 3.5 2 3.5-2 3.5 2z"/>
            </svg>
          ),
          path: '/prevencao-tributaria',
        }
      ]
    },
    {
      id: 'financas-radar',
      title: 'FINANÇAS NO RADAR',
      titleComponent: (
        <span>
          <span className="text-gray-700">FINANÇAS NO </span>
          <span className="text-orange-500 font-bold">RADAR</span>
        </span>
      ),
      icon: (
        <div className="w-5 h-5 bg-orange-500 rounded-md flex items-center justify-center">
          <svg className="w-3 h-3 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 1v22M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/>
          </svg>
        </div>
      ),
      expandable: true,
      items: [
        {
          id: 'demonstrativo-caixa',
          moduleId: 'demonstrativo-caixa',
          title: 'DEMONSTRATIVO DE CAIXA',
          path: '/demonstrativo-caixa',
          icon: (
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 7h6m0 10v-3m-3 3v-6m-3 6v-1m6-9a2 2 0 012 2v10a2 2 0 01-2 2H9a2 2 0 01-2-2V9a2 2 0 012-2"/>
            </svg>
          )
        },
        {
          id: 'entradas-saidas',
          moduleId: 'entradas-saidas',
          title: 'ENTRADAS E SAÍDAS',
          path: '/entradas-saidas',
          icon: (
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4"/>
            </svg>
          )
        },
        {
          id: 'bancos',
          moduleId: 'bancos',
          title: 'BANCOS',
          icon: (
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 21h18M3 10h18M5 6l7-3 7 3M4 10v11M20 10v11M8 14v3M12 14v3M16 14v3"/>
            </svg>
          ),
          expandable: true,
          subItems: [
            { id: 'extrato-santander', submenuId: 'extrato-santander', title: 'EXTRATO BANCÁRIO', path: '/extrato-santander' },
            { id: 'extrato-banco24h', submenuId: 'extrato-banco24h', title: 'BANCO 24HORAS', path: '/extrato-banco24h' },
            { id: 'boletos-dda', submenuId: 'boletos-dda', title: 'BOLETOS DDA', path: '/boletos-dda' },
            { id: 'conciliacao-bancaria', submenuId: 'conciliacao-bancaria', title: 'CONCILIAÇÃO BANCÁRIA', path: '/conciliacao-bancaria' }
          ]
        }
      ]
    },
    {
      id: 'marketing-radar',
      title: 'MARKETING NO RADAR',
      titleComponent: (
        <span>
          <span className="text-gray-700">MARKETING NO </span>
          <span className="text-green-500 font-bold">RADAR</span>
        </span>
      ),
      icon: (
        <div className="w-5 h-5 bg-green-500 rounded-md flex items-center justify-center">
          <svg className="w-3 h-3 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/>
          </svg>
        </div>
      ),
      expandable: true,
      items: [
        {
          id: 'disparo-whatsapp',
          moduleId: 'disparo-whatsapp',
          title: 'DISPARO EM MASSA',
          path: '/disparo-whatsapp',
          icon: (
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"/>
            </svg>
          )
        }
      ]
    },
    {
      id: 'ia-radar',
      title: 'CONSULTOR 360',
      titleComponent: (
        <span>
          <span className="text-gray-700">CONSULTOR </span>
          <span className="text-purple-500 font-bold">360</span>
        </span>
      ),
      icon: (
        <div className="w-5 h-5 bg-gradient-to-br from-purple-500 to-indigo-500 rounded-md flex items-center justify-center">
          <svg className="w-3 h-3 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 2L2 7l10 5 10-5-10-5z"/>
            <path d="M2 17l10 5 10-5"/>
            <path d="M2 12l10 5 10-5"/>
          </svg>
        </div>
      ),
      expandable: true,
      items: [
        {
          id: 'rota-crescimento',
          moduleId: 'rota-crescimento',
          title: 'ROTA DO CRESCIMENTO',
          path: '/rota-crescimento',
          icon: (
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"/>
            </svg>
          )
        }
      ]
    },
    {
      id: 'vision-360',
      title: 'VISION 360',
      titleComponent: (
        <span>
          <span className="text-gray-700">VISION </span>
          <span className="text-purple-600 font-bold">360</span>
        </span>
      ),
      icon: (
        <div className="w-5 h-5 bg-purple-600 rounded-md flex items-center justify-center">
          <svg className="w-3 h-3 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"/>
          </svg>
        </div>
      ),
      expandable: true,
      items: [
        {
          id: 'vision-pdv',
          moduleId: 'vision-pdv',
          title: 'VISION PDV',
          icon: (
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/>
            </svg>
          ),
          expandable: true,
          subItems: [
            { id: 'vision-operacoes-risco', submenuId: 'vision-operacoes-risco', title: 'OPERAÇÕES DE RISCO PDV', path: '/vision-operacoes-risco' },
            { id: 'vision-palavra-chave-2', submenuId: 'vision-palavra-chave-2', title: 'VISION PALAVRA CHAVE', path: '/vision-palavra-chave-2' }
          ]
        },
        {
          id: 'vision-facial',
          moduleId: 'facial',
          title: 'VISION FACIAL',
          icon: (
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
            </svg>
          ),
          expandable: true,
          subItems: [
            { id: 'vision-facial-faciais', submenuId: 'vision-facial-faciais', title: 'FACIAIS', path: '/vision-facial' },
            { id: 'vision-facial-identificados', submenuId: 'vision-facial-identificados', title: 'IDENTIFICADOS EM LOJA', path: '/reconhecimento-facial' }
          ]
        },
        {
          id: 'bipagens',
          moduleId: 'bipagens',
          title: 'VISION BIPAGENS',
          icon: (
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z"/>
            </svg>
          ),
          expandable: true,
          subItems: [
            { id: 'bipagens', submenuId: 'bipagens-ao-vivo', title: 'BIPAGENS', path: '/bipagens' },
            { id: 'resultados-do-dia', submenuId: 'bipagens-resultados', title: 'RESULTADOS DO DIA', path: '/resultados-do-dia' },
            { id: 'rankings', submenuId: 'bipagens-rankings', title: 'RANKINGS', path: '/rankings' }
          ]
        }
      ]
    },
    {
      id: 'oferta-radar',
      title: 'GARIMPADOR 360',
      titleComponent: (
        <span>
          <span className="text-gray-700">GARIMPADOR </span>
          <span className="text-purple-600 font-bold">360</span>
        </span>
      ),
      icon: (
        <div className="w-5 h-5 bg-purple-600 rounded-md flex items-center justify-center">
          <svg className="w-3 h-3 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M12 2L2 12l10 10 10-10L12 2z"/>
            <path d="M12 8l-4 4 4 4 4-4-4-4z"/>
          </svg>
        </div>
      ),
      expandable: true,
      items: [
        {
          id: 'garimpa-fornecedores',
          moduleId: 'garimpa-fornecedores',
          title: 'FORNECEDORES E CONCORRENTES',
          path: '/garimpa-fornecedores',
          icon: (
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
            </svg>
          )
        },
        {
          id: 'garimpador-ranking',
          moduleId: 'garimpa-fornecedores',
          title: 'RANKING FORNECEDORES',
          path: '/garimpador-ranking',
          icon: (
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/>
            </svg>
          )
        },
        {
          id: 'garimpador-ranking-concorrentes',
          moduleId: 'garimpa-fornecedores',
          title: 'RANKING CONCORRENTES',
          path: '/garimpador-ranking-concorrentes',
          icon: (
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"/>
            </svg>
          )
        },
        {
          id: 'garimpador-projecao',
          moduleId: 'garimpa-fornecedores',
          title: 'PROJECAO DE PRECO',
          path: '/garimpador-projecao',
          icon: (
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z"/>
            </svg>
          )
        },
        {
          id: 'garimpador-fora-mix',
          moduleId: 'garimpa-fornecedores',
          title: 'FORA DO MIX',
          path: '/garimpador-fora-mix',
          icon: (
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636"/>
            </svg>
          )
        },
        {
          id: 'garimpador-produtos-pesquisar',
          moduleId: 'garimpa-fornecedores',
          title: 'PRODUTOS A ELIMINAR',
          path: '/garimpador-produtos-pesquisar',
          icon: (
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"/>
            </svg>
          )
        },
        {
          id: 'garimpador-ecommerce',
          moduleId: 'garimpa-fornecedores',
          title: 'E-COMMERCE',
          path: '/garimpador-ecommerce',
          icon: (
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 100 4 2 2 0 000-4z"/>
            </svg>
          )
        }
      ]
    },
    {
      id: 'rh-radar',
      title: 'RH NO RADAR',
      titleComponent: (
        <span>
          <span className="text-gray-700">RH NO </span>
          <span className="text-pink-500 font-bold">RADAR</span>
        </span>
      ),
      icon: (
        <div className="w-5 h-5 bg-pink-500 rounded-md flex items-center justify-center">
          <svg className="w-3 h-3 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z"/>
          </svg>
        </div>
      ),
      expandable: true,
      items: [
        {
          id: 'rh-colaboradores',
          moduleId: 'rh-colaboradores',
          title: 'COLABORADORES',
          icon: (<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"/></svg>),
          expandable: true,
          subItems: [
            { id: 'rh-dashboard', submenuId: 'rh-dashboard', title: 'DASHBOARD RH', path: '/rh/dashboard' },
            { id: 'rh-resultados', submenuId: 'rh-resultados', title: 'RESULTADOS', path: '/rh/resultados' },
            { id: 'rh-cadastro', submenuId: 'rh-cadastro-geral', title: 'CADASTRO GERAL', path: '/rh/cadastro' },
            { id: 'rh-admissoes', submenuId: 'rh-admissoes', title: 'ADMISSÕES', path: '/rh/admissoes' },
            { id: 'rh-desligamentos', submenuId: 'rh-desligamentos', title: 'DESLIGAMENTOS', path: '/rh/desligamentos' },
            { id: 'rh-documentacao', submenuId: 'rh-documentacao', title: 'DOCUMENTAÇÃO', path: '/rh/documentacao' }
          ]
        },
        {
          id: 'rh-saude',
          moduleId: 'rh-saude',
          title: 'SAÚDE OCUPACIONAL',
          icon: (<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"/></svg>),
          expandable: true,
          subItems: [
            { id: 'rh-aso', submenuId: 'rh-controle-aso', title: 'CONTROLE DE ASO', path: '/rh/aso' },
            { id: 'rh-exames', submenuId: 'rh-exames-periodicos', title: 'EXAMES PERIÓDICOS', path: '/rh/exames' },
            { id: 'rh-vencimentos', submenuId: 'rh-vencimentos', title: 'RELATÓRIO VENCIMENTOS', path: '/rh/vencimentos' }
          ]
        },
        {
          id: 'rh-ponto',
          moduleId: 'rh-ponto',
          title: 'PONTO E AUSÊNCIAS',
          icon: (<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>),
          expandable: true,
          subItems: [
            { id: 'rh-jornadas', submenuId: 'rh-jornadas', title: 'JORNADAS DE TRABALHO', path: '/rh/jornadas' },
            { id: 'rh-ausencias', submenuId: 'rh-ausencias', title: 'LANÇAR AUSÊNCIAS', path: '/rh/ausencias' },
            { id: 'rh-ferias', submenuId: 'rh-ferias', title: 'CONTROLE DE FÉRIAS', path: '/rh/ferias' },
            { id: 'rh-absenteismo', submenuId: 'rh-absenteismo', title: 'ANÁLISE ABSENTEÍSMO', path: '/rh/absenteismo' }
          ]
        },
        {
          id: 'rh-recrutamento',
          moduleId: 'rh-recrutamento',
          title: 'RECRUTAMENTO',
          icon: (<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/></svg>),
          expandable: true,
          subItems: [
            { id: 'rh-vagas', submenuId: 'rh-vagas', title: 'VAGAS ABERTAS', path: '/rh/vagas' },
            { id: 'rh-candidatos', submenuId: 'rh-candidatos', title: 'CANDIDATOS', path: '/rh/candidatos' },
            { id: 'rh-processo', submenuId: 'rh-processo-seletivo', title: 'PROCESSO SELETIVO', path: '/rh/processo-seletivo' },
            { id: 'rh-metodo-disc', submenuId: 'rh-metodo-disc', title: 'METODO DISC', path: '/rh/metodo-disc' }
          ]
        },
        {
          id: 'rh-treinamentos',
          moduleId: 'rh-treinamentos',
          title: 'TREINAMENTOS',
          icon: (<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"/></svg>),
          expandable: true,
          subItems: [
            { id: 'rh-treinamentos-cadastro', submenuId: 'rh-cadastro-treinamento', title: 'CADASTRAR TREINAMENTO', path: '/rh/treinamentos' },
            { id: 'rh-presenca', submenuId: 'rh-presenca', title: 'CONTROLE DE PRESENÇA', path: '/rh/presenca' },
            { id: 'rh-certificados', submenuId: 'rh-certificados', title: 'CERTIFICADOS', path: '/rh/certificados' }
          ]
        },
        {
          id: 'rh-financeiro',
          moduleId: 'rh-financeiro',
          title: 'FINANCEIRO RH',
          icon: (<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>),
          expandable: true,
          subItems: [
            { id: 'rh-lancamentos', submenuId: 'rh-lancamentos', title: 'LANÇAMENTOS', path: '/rh/lancamentos' },
            { id: 'rh-folha', submenuId: 'rh-folha', title: 'FOLHA DE PAGAMENTO', path: '/rh/folha' },
            { id: 'rh-beneficios', submenuId: 'rh-beneficios', title: 'BENEFÍCIOS', path: '/rh/beneficios' }
          ]
        },
        {
          id: 'rh-indicadores',
          moduleId: 'rh-indicadores',
          title: 'INDICADORES RH',
          icon: (<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/></svg>),
          expandable: true,
          subItems: [
            { id: 'rh-indicadores-dashboard', submenuId: 'rh-dashboard-executivo', title: 'DASHBOARD EXECUTIVO', path: '/rh/indicadores' },
            { id: 'rh-rotatividade', submenuId: 'rh-rotatividade', title: 'ROTATIVIDADE (TURNOVER)', path: '/rh/rotatividade' },
            { id: 'rh-perfil', submenuId: 'rh-perfil-demografico', title: 'PERFIL DEMOGRÁFICO', path: '/rh/perfil' }
          ]
        },
        {
          id: 'rh-config',
          moduleId: 'rh-configuracoes',
          title: 'CONFIGURAÇÕES RH',
          path: '/rh/configuracoes',
          icon: (<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/></svg>)
        }
      ]
    },
    {
      id: 'configuracoes',
      title: 'CONFIGURAÇÕES',
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
      title: 'CONFIGURAÇÕES DE REDE',
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
      title: 'CONFIGURAÇÕES DE TABELAS',
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

      {/* Seletor de Loja */}
      {!isCollapsed && (
        <div className="px-4 py-3 border-b border-gray-200">
          <div className="relative">
            <button
              onClick={() => setLojaDropdownOpen(!lojaDropdownOpen)}
              className="w-full flex items-center justify-between px-3 py-2 bg-orange-50 border border-orange-200 rounded-lg text-sm font-medium text-orange-700 hover:bg-orange-100 transition-colors"
            >
              <div className="flex items-center gap-2">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"/>
                </svg>
                <span>LOJA: {getLojaLabel()}</span>
              </div>
              <svg className={`w-4 h-4 transition-transform ${lojaDropdownOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"/>
              </svg>
            </button>

            {lojaDropdownOpen && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-50 max-h-60 overflow-y-auto">
                <button
                  onClick={() => {
                    selecionarLoja(null);
                    setLojaDropdownOpen(false);
                  }}
                  className={`w-full px-3 py-2 text-left text-sm hover:bg-orange-50 ${lojaSelecionada === null ? 'bg-orange-100 text-orange-700 font-medium' : 'text-gray-700'}`}
                >
                  TODAS AS LOJAS
                </button>
                {lojas.map((loja) => (
                  <button
                    key={loja.COD_LOJA}
                    onClick={() => {
                      selecionarLoja(loja.COD_LOJA);
                      setLojaDropdownOpen(false);
                    }}
                    className={`w-full px-3 py-2 text-left text-sm hover:bg-orange-50 ${lojaSelecionada === loja.COD_LOJA ? 'bg-orange-100 text-orange-700 font-medium' : 'text-gray-700'}`}
                  >
                    LOJA {loja.COD_LOJA} - {loja.DES_LOJA}{loja.APELIDO ? ` - ${loja.APELIDO}` : ''}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

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

          return true;
        }).map((item) => {
          // Se a seção tem items, verificar se TODOS estão inativos para desabilitar seção inteira
          const allItemsInactive = item.items && item.items.length > 0 && item.items.every(subItem => subItem.moduleId && !isModuleActive(subItem.moduleId));
          const moduleActive = item.moduleId ? isModuleActive(item.moduleId) : !allItemsInactive;

          // Filtrar items baseado em permissões de módulo do colaborador
          const filteredItems = item.items ? item.items.filter(subitem => {
            // Verificar permissão do módulo para employees
            if (user?.type === 'employee' && subitem.moduleId) {
              return hasPermission(subitem.moduleId);
            }
            return true;
          }).map(subitem => {
            // Se tem subItems, filtrar baseado em permissões de submenu
            if (subitem.subItems && user?.type === 'employee' && subitem.moduleId) {
              const filteredSubItems = subitem.subItems.filter(subSubItem => {
                return hasPermission(subitem.moduleId, subSubItem.submenuId || subSubItem.id);
              });
              return { ...subitem, subItems: filteredSubItems };
            }
            return subitem;
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
                {filteredItems.map((subItem, index) => {
                  const subModuleActive = subItem.moduleId ? isModuleActive(subItem.moduleId) : (subItem.submenuId ? isModuleActive(subItem.submenuId) : (subItem.id ? isModuleActive(subItem.id) : moduleActive));
                  return (
                  <div key={index}>
                    <button
                      onClick={() => {
                        // Se o módulo estiver desativado, não permite navegação
                        if (!subModuleActive) {
                          return;
                        }

                        // Se tem subItems, toggle expand
                        if (subItem.expandable && subItem.subItems) {
                          toggleItem(subItem.id);
                        } else if (subItem.path) {
                          navigate(subItem.path);
                          setIsMobileMenuOpen(false);
                        }
                      }}
                      className={`flex items-center justify-between w-full text-left py-2 text-sm transition-colors ${
                        !subModuleActive
                          ? 'text-gray-400 cursor-not-allowed opacity-60'
                          : subItem.path && location.pathname === subItem.path
                          ? 'text-orange-500 font-medium'
                          : 'text-gray-600 hover:text-orange-500'
                      }`}
                      disabled={!subModuleActive}
                    >
                      <div className="flex items-center space-x-3">
                        <span className={subModuleActive ? 'text-gray-400' : 'text-gray-300'}>{subItem.icon}</span>
                        <span>{subItem.title}</span>
                      </div>
                      {subItem.expandable && subItem.subItems && (
                        <svg
                          className={`w-3 h-3 text-gray-400 transform transition-transform ${
                            expandedItems[subItem.id] ? 'rotate-180' : ''
                          }`}
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"/>
                        </svg>
                      )}
                    </button>

                    {/* Sub-submenus */}
                    {subItem.expandable && subItem.subItems && expandedItems[subItem.id] && (
                      <div className="pl-7 pb-1">
                        {subItem.subItems.filter(ssi => {
                          const ssiActive = isModuleActive(ssi.submenuId || ssi.id);
                          return ssiActive;
                        }).map((subSubItem, subIndex) => (
                          <button
                            key={subIndex}
                            onClick={() => {
                              if (subSubItem.path) {
                                navigate(subSubItem.path);
                                setIsMobileMenuOpen(false);
                              }
                            }}
                            className={`flex items-center space-x-2 w-full text-left py-1.5 text-sm transition-colors ${
                              subSubItem.path && location.pathname === subSubItem.path
                                ? 'text-orange-500 font-medium'
                                : 'text-gray-500 hover:text-orange-500'
                            }`}
                          >
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7"/>
                            </svg>
                            <span>{subSubItem.title}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  );
                })}
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
                    {user?.name || 'Radar 360'}
                  </p>
                  <p className="text-xs text-gray-500 truncate">
                    {user?.type === 'employee' ? user?.sector?.name || 'Colaborador' : 'Sistema de Gestão'}
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

        {/* Indicador de conexão com o banco ERP */}
        <div className={`flex items-center justify-center gap-2 mt-2 py-1.5 rounded-md ${
          dbConnected === null ? 'bg-gray-100' : dbConnected ? 'bg-green-50' : 'bg-red-50'
        }`}>
          <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${
            dbConnected === null ? 'bg-gray-400' : dbConnected ? 'bg-green-500' : 'bg-red-500'
          }`} />
          {!isCollapsed && (
            <span className={`text-xs font-bold ${
              dbConnected === null ? 'text-gray-400' : dbConnected ? 'text-green-700' : 'text-red-700'
            }`}>
              {dbConnected === null ? 'SEM CONEXÃO ERP' : dbConnected ? 'CONEXÃO = OK' : 'CONEXÃO = OFF'}
            </span>
          )}
        </div>
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