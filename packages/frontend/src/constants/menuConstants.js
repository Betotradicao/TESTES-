// IDs dos módulos principais
export const MENU_MODULES = {
  DASHBOARD: 'dashboard',
  BIPAGENS: 'bipagens',
  PDV: 'pdv',
  FACIAL: 'facial',
  RUPTURA: 'ruptura',
  ETIQUETAS: 'etiquetas',
  PERDAS: 'perdas',
  PRODUCAO: 'producao',
};

// IDs dos sub-menus
export const MENU_SUBMENUS = {
  // Bipagens
  BIPAGENS_AO_VIVO: 'bipagens-ao-vivo',
  BIPAGENS_RESULTADOS: 'bipagens-resultados',
  BIPAGENS_ATIVAR: 'bipagens-ativar',
  BIPAGENS_RANKINGS: 'bipagens-rankings',

  // PDV
  PDV_CADASTRAR: 'pdv-cadastrar',
  PDV_BUSCAR: 'pdv-buscar',
  PDV_RESULTADOS: 'pdv-resultados',
  PDV_CONTROLE: 'pdv-controle',

  // Facial
  FACIAL_RECONHECIMENTO: 'facial-reconhecimento',

  // Rupturas
  RUPTURA_LANCADOR: 'ruptura-lancador',
  RUPTURA_AUDITORIAS: 'ruptura-auditorias',

  // Etiquetas
  ETIQUETAS_LANCAR: 'etiquetas-lancar',
  ETIQUETAS_RESULTADOS: 'etiquetas-resultados',

  // Perdas
  PERDAS_LANCADOR: 'perdas-lancador',
  PERDAS_RESULTADOS: 'perdas-resultados',

  // Produção
  PRODUCAO_SUGESTAO: 'producao-sugestao',
  PRODUCAO_RESULTADOS: 'producao-resultados',
};

// Estrutura completa do menu
export const MENU_STRUCTURE = [
  {
    id: MENU_MODULES.DASHBOARD,
    title: 'Boas Vindas',
    icon: 'dashboard',
    submenus: []
  },
  {
    id: MENU_MODULES.BIPAGENS,
    title: 'Prevenção de Bipagens',
    icon: 'tag',
    submenus: [
      {
        id: MENU_SUBMENUS.BIPAGENS_AO_VIVO,
        title: 'Bipagens Ao Vivo (VAR)',
        path: '/bipagens'
      },
      {
        id: MENU_SUBMENUS.BIPAGENS_RESULTADOS,
        title: 'Resultados do Dia',
        path: '/resultados-do-dia'
      },
      {
        id: MENU_SUBMENUS.BIPAGENS_ATIVAR,
        title: 'Ativar Produtos',
        path: '/ativar-produtos'
      },
      {
        id: MENU_SUBMENUS.BIPAGENS_RANKINGS,
        title: 'Rankings',
        path: '/rankings'
      }
    ]
  },
  {
    id: MENU_MODULES.PDV,
    title: 'Prevenção PDV',
    icon: 'pdv',
    submenus: [
      {
        id: MENU_SUBMENUS.PDV_CADASTRAR,
        title: 'Cadastrar Eventos'
      },
      {
        id: MENU_SUBMENUS.PDV_BUSCAR,
        title: 'Buscar Eventos'
      },
      {
        id: MENU_SUBMENUS.PDV_RESULTADOS,
        title: 'Resultados do Dia',
        path: '/resultados-do-dia'
      },
      {
        id: MENU_SUBMENUS.PDV_CONTROLE,
        title: 'Controle PDV',
        path: '/controle-pdv'
      }
    ]
  },
  {
    id: MENU_MODULES.FACIAL,
    title: 'Prevenção Facial',
    icon: 'face',
    submenus: [
      {
        id: MENU_SUBMENUS.FACIAL_RECONHECIMENTO,
        title: 'Reconhecimento Facial',
        path: '/reconhecimento-facial'
      }
    ]
  },
  {
    id: MENU_MODULES.RUPTURA,
    title: 'Prevenção Rupturas',
    icon: 'clipboard',
    submenus: [
      {
        id: MENU_SUBMENUS.RUPTURA_LANCADOR,
        title: 'Lançador de Itens',
        path: '/ruptura-lancador'
      },
      {
        id: MENU_SUBMENUS.RUPTURA_AUDITORIAS,
        title: 'Resultados das Auditorias',
        path: '/ruptura-auditorias'
      }
    ]
  },
  {
    id: MENU_MODULES.ETIQUETAS,
    title: 'Prevenção Etiquetas',
    icon: 'tag-alt',
    submenus: [
      {
        id: MENU_SUBMENUS.ETIQUETAS_LANCAR,
        title: 'Lançador de Itens',
        path: '/etiquetas/lancar'
      },
      {
        id: MENU_SUBMENUS.ETIQUETAS_RESULTADOS,
        title: 'Resultados das Auditorias',
        path: '/etiquetas/resultados'
      }
    ]
  },
  {
    id: MENU_MODULES.PERDAS,
    title: 'Prevenção Quebras',
    icon: 'chart',
    submenus: [
      {
        id: MENU_SUBMENUS.PERDAS_LANCADOR,
        title: 'Lançador de Itens',
        path: '/perdas-lancador'
      },
      {
        id: MENU_SUBMENUS.PERDAS_RESULTADOS,
        title: 'Resultados dos Lançamentos',
        path: '/perdas-resultados'
      }
    ]
  },
  {
    id: MENU_MODULES.PRODUCAO,
    title: 'Prevenção Produção',
    icon: 'production',
    submenus: [
      {
        id: MENU_SUBMENUS.PRODUCAO_SUGESTAO,
        title: 'Sugestão Produção Padaria',
        path: '/producao/sugestao'
      },
      {
        id: MENU_SUBMENUS.PRODUCAO_RESULTADOS,
        title: 'Resultados',
        path: '/producao/resultados'
      }
    ]
  }
];
