import { useState, useEffect } from 'react';

const AVAILABLE_MODULES = [
  // Gestão no Radar
  {
    id: 'gestao-inteligente',
    name: 'Gestão Inteligente',
    description: 'Painel de gestão inteligente com indicadores do negócio',
    icon: '📊'
  },
  {
    id: 'estoque-margem',
    name: 'Gestão de Estoque',
    description: 'Saúde do Estoque e Análise de Corte (Curva ABC ponderada)',
    icon: '📦'
  },
  {
    id: 'compras',
    name: 'Gestão de Compras',
    description: 'Compra x Venda, Pedidos, Calendário de Atendimento e Ruptura Indústria',
    icon: '🛒'
  },
  {
    id: 'pricing',
    name: 'Gestão de Pricing',
    description: 'Saúde de Margens, Ancoragem de Preço e Competitividade',
    icon: '🏷️'
  },
  // Prevenção no Radar
  {
    id: 'bipagens',
    name: 'Prevenção de Bipagens',
    description: 'Bipagens ao vivo, resultados do dia, ativar produtos e rankings',
    icon: '🔖'
  },
  {
    id: 'pdv',
    name: 'Prevenção PDV',
    description: 'Cadastrar e buscar eventos de prevenção no PDV',
    icon: '💻'
  },
  {
    id: 'facial',
    name: 'Prevenção Facial',
    description: 'Sistema de reconhecimento facial',
    icon: '👤'
  },
  {
    id: 'ruptura',
    name: 'Prevenção Rupturas',
    description: 'Lançador de itens e resultados de auditorias de ruptura',
    icon: '📋'
  },
  {
    id: 'etiquetas',
    name: 'Prevenção Etiquetas',
    description: 'Auditoria de etiquetas de preços e verificação de divergências',
    icon: '🔖'
  },
  {
    id: 'perdas',
    name: 'Prevenção Quebras',
    description: 'Lançador de itens e resultados de quebras',
    icon: '📉'
  },
  {
    id: 'producao',
    name: 'Prevenção Produção',
    description: 'Lançar produção, sugestão padaria e resultados',
    icon: '🥖'
  },
  {
    id: 'hortfrut',
    name: 'Prevenção HortFruti',
    description: 'Lançador e resultados de conferência HortFruti',
    icon: '🥬'
  },
  {
    id: 'controle-recebimento',
    name: 'Prevenção Recebimento',
    description: 'Notas a Chegar e Notas Entregue',
    icon: '📄'
  },
  // Oferta no Radar
  {
    id: 'garimpa-fornecedores',
    name: 'Garimpa Fornecedores',
    description: 'Pesquisa e comparação de fornecedores e concorrentes',
    icon: '🔎'
  },
  // Finanças no Radar
  {
    id: 'entradas-saidas',
    name: 'Entradas e Saídas',
    description: 'Controle de entradas e saídas financeiras',
    icon: '💰'
  },
  {
    id: 'bancos',
    name: 'Bancos',
    description: 'Extratos Santander, Tribanco e Banco 24horas',
    icon: '🏦'
  },
  // IA no Radar
  {
    id: 'rota-crescimento',
    name: 'Rota do Crescimento',
    description: 'Dashboard de crescimento com inteligência artificial',
    icon: '🚀'
  }
];

export default function ModulesTab() {
  const [modules, setModules] = useState([]);

  useEffect(() => {
    loadModules();
  }, []);

  const loadModules = () => {
    const savedModules = localStorage.getItem('modules_config');
    if (savedModules) {
      try {
        setModules(JSON.parse(savedModules));
      } catch (err) {
        console.error('Erro ao carregar módulos:', err);
        initializeModules();
      }
    } else {
      initializeModules();
    }
  };

  const initializeModules = () => {
    const defaultModules = AVAILABLE_MODULES.map(module => ({
      id: module.id,
      name: module.name,
      active: true
    }));
    setModules(defaultModules);
    localStorage.setItem('modules_config', JSON.stringify(defaultModules));
  };

  const toggleModule = (moduleId) => {
    const updatedModules = modules.map(module => {
      if (module.id === moduleId) {
        return { ...module, active: !module.active };
      }
      return module;
    });

    setModules(updatedModules);
    localStorage.setItem('modules_config', JSON.stringify(updatedModules));

    // Disparar evento para sidebar atualizar
    window.dispatchEvent(new Event('storage'));
  };

  const getModuleStatus = (moduleId) => {
    const module = modules.find(m => m.id === moduleId);
    return module ? module.active : true;
  };

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-xl font-bold text-gray-900 mb-2">Gerenciar Módulos</h2>
        <p className="text-sm text-gray-600">
          Ative ou desative módulos do sistema. Módulos desativados não aparecerão no menu lateral.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {AVAILABLE_MODULES.map((module) => {
          const isActive = getModuleStatus(module.id);

          return (
            <div
              key={module.id}
              className={`
                bg-white rounded-lg border-2 p-4 transition-all
                ${isActive ? 'border-green-500 shadow-md' : 'border-gray-300 opacity-60'}
              `}
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center space-x-3">
                  <span className="text-3xl">{module.icon}</span>
                  <div>
                    <h3 className="font-semibold text-gray-900">{module.name}</h3>
                    <p className="text-xs text-gray-500">ID: {module.id}</p>
                  </div>
                </div>
              </div>

              <p className="text-sm text-gray-600 mb-4">{module.description}</p>

              <div className="flex items-center justify-between">
                <span className={`text-sm font-medium ${isActive ? 'text-green-600' : 'text-gray-500'}`}>
                  {isActive ? '✅ Ativo' : '❌ Desativado'}
                </span>

                <button
                  onClick={() => toggleModule(module.id)}
                  className={`
                    px-4 py-2 rounded-lg font-medium text-sm transition-colors
                    ${isActive
                      ? 'bg-red-100 text-red-700 hover:bg-red-200'
                      : 'bg-green-100 text-green-700 hover:bg-green-200'
                    }
                  `}
                >
                  {isActive ? 'Desativar' : 'Ativar'}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
        <div className="flex items-start">
          <svg className="w-5 h-5 text-blue-600 mt-0.5 mr-3 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
          </svg>
          <div className="text-sm text-blue-800">
            <p className="font-semibold mb-1">💡 Dica:</p>
            <p>As alterações são salvas automaticamente e aplicadas imediatamente no menu lateral.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
