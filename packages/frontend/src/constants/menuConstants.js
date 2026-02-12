// IDs dos módulos principais
export const MENU_MODULES = {
  DASHBOARD: 'dashboard',
  // Gestão no Radar
  GESTAO_INTELIGENTE: 'gestao-inteligente',
  ESTOQUE_MARGEM: 'estoque-margem',
  COMPRA_VENDA: 'compra-venda',
  PEDIDOS: 'pedidos',
  RUPTURA_INDUSTRIA: 'ruptura-industria',
  CALENDARIO_ATENDIMENTO: 'calendario-atendimento',
  CONTROLE_RECEBIMENTO: 'controle-recebimento',
  // Prevenção no Radar
  BIPAGENS: 'bipagens',
  PDV: 'pdv',
  FACIAL: 'facial',
  RUPTURA: 'ruptura',
  ETIQUETAS: 'etiquetas',
  PERDAS: 'perdas',
  PRODUCAO: 'producao',
  HORTFRUT: 'hortfrut',
  // Garimpa Fácil
  GARIMPA_FORNECEDORES: 'garimpa-fornecedores',
  // IA no Radar
  ROTA_CRESCIMENTO: 'rota-crescimento',
};

// IDs dos sub-menus
export const MENU_SUBMENUS = {
  // Gestão Inteligente
  GESTAO_INTELIGENTE_PAINEL: 'gestao-inteligente-painel',

  // Estoque e Margem
  ESTOQUE_MARGEM_LANCADOR: 'estoque-margem-lancador',
  ESTOQUE_MARGEM_RESULTADOS: 'estoque-margem-resultados',

  // Compra x Venda
  COMPRA_VENDA_ANALISE: 'compra-venda-analise',

  // Pedidos
  PEDIDOS_LISTA: 'pedidos-lista',

  // Ruptura Indústria
  RUPTURA_INDUSTRIA_ANALISE: 'ruptura-industria-analise',

  // Calendário de Atendimento
  CALENDARIO_ATENDIMENTO_PAINEL: 'calendario-atendimento-painel',

  // Controle de Recebimento
  NF_A_CHEGAR: 'nf-a-chegar',
  NF_RECEBIMENTO: 'nf-recebimento',

  // Bipagens
  BIPAGENS_AO_VIVO: 'bipagens-ao-vivo',
  BIPAGENS_RESULTADOS: 'bipagens-resultados',
  BIPAGENS_RANKINGS: 'bipagens-rankings',

  // PDV
  PDV_FRENTE_CAIXA: 'pdv-frente-caixa',

  // Facial
  FACIAL_RECONHECIMENTO: 'facial-reconhecimento',

  // Rupturas
  RUPTURA_LANCADOR: 'ruptura-lancador',
  RUPTURA_AUDITORIAS: 'ruptura-auditorias',

  // Etiquetas
  ETIQUETAS_LANCAR: 'etiquetas-lancar',
  ETIQUETAS_RESULTADOS: 'etiquetas-resultados',

  // Perdas/Quebras
  PERDAS_LANCADOR: 'perdas-lancador',
  PERDAS_RESULTADOS: 'perdas-resultados',

  // Produção
  PRODUCAO_LANCADOR: 'producao-lancador',
  PRODUCAO_SUGESTAO: 'producao-sugestao',
  PRODUCAO_RESULTADOS: 'producao-resultados',

  // HortFrut
  HORTFRUT_LANCADOR: 'hortfrut-lancador',
  HORTFRUT_RESULTADOS: 'hortfrut-resultados',

  // Garimpa Fácil
  GARIMPA_FORNECEDORES_CONCORRENTES: 'garimpa-fornecedores-concorrentes',

  // IA no Radar
  ROTA_CRESCIMENTO_DASHBOARD: 'rota-crescimento-dashboard',
};

// Estrutura completa do menu
export const MENU_STRUCTURE = [
  // ========== GESTÃO NO RADAR ==========
  {
    id: MENU_MODULES.GESTAO_INTELIGENTE,
    title: 'Gestão Inteligente',
    icon: 'chart',
    section: 'gestao',
    submenus: [
      {
        id: MENU_SUBMENUS.GESTAO_INTELIGENTE_PAINEL,
        title: 'Painel Gestão Inteligente',
        path: '/gestao-inteligente'
      }
    ]
  },
  {
    id: MENU_MODULES.ESTOQUE_MARGEM,
    title: 'Gestão Estoque e Margem',
    icon: 'estoque',
    section: 'gestao',
    submenus: [
      {
        id: MENU_SUBMENUS.ESTOQUE_MARGEM_LANCADOR,
        title: 'Lançador de Itens',
        path: '/estoque-margem-lancador'
      },
      {
        id: MENU_SUBMENUS.ESTOQUE_MARGEM_RESULTADOS,
        title: 'Resultado dos Lançamentos',
        path: '/estoque-margem-resultados'
      }
    ]
  },
  {
    id: MENU_MODULES.COMPRA_VENDA,
    title: 'Compra x Venda',
    icon: 'compra-venda',
    section: 'gestao',
    submenus: [
      {
        id: MENU_SUBMENUS.COMPRA_VENDA_ANALISE,
        title: 'Análise',
        path: '/compra-venda-analise'
      }
    ]
  },
  {
    id: MENU_MODULES.PEDIDOS,
    title: 'Pedidos',
    icon: 'clipboard',
    section: 'gestao',
    submenus: [
      {
        id: MENU_SUBMENUS.PEDIDOS_LISTA,
        title: 'Lista de Pedidos',
        path: '/prevencao-pedidos'
      }
    ]
  },
  {
    id: MENU_MODULES.RUPTURA_INDUSTRIA,
    title: 'Ruptura Indústria',
    icon: 'clipboard',
    section: 'gestao',
    submenus: [
      {
        id: MENU_SUBMENUS.RUPTURA_INDUSTRIA_ANALISE,
        title: 'Análise de Rupturas',
        path: '/ruptura-industria'
      }
    ]
  },
  {
    id: MENU_MODULES.CALENDARIO_ATENDIMENTO,
    title: 'Calendário de Atendimento',
    icon: 'calendar',
    section: 'gestao',
    submenus: [
      {
        id: MENU_SUBMENUS.CALENDARIO_ATENDIMENTO_PAINEL,
        title: 'Calendário de Atendimento',
        path: '/calendario-atendimento'
      }
    ]
  },
  {
    id: MENU_MODULES.CONTROLE_RECEBIMENTO,
    title: 'Controle de Recebimento',
    icon: 'document',
    section: 'gestao',
    submenus: [
      {
        id: MENU_SUBMENUS.NF_A_CHEGAR,
        title: 'Notas a Chegar',
        path: '/notas-a-chegar'
      },
      {
        id: MENU_SUBMENUS.NF_RECEBIMENTO,
        title: 'Notas Entregue',
        path: '/nota-fiscal-recebimento'
      }
    ]
  },
  // ========== PREVENÇÃO NO RADAR ==========
  {
    id: MENU_MODULES.BIPAGENS,
    title: 'Prevenção de Bipagens',
    icon: 'tag',
    section: 'prevencao',
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
    section: 'prevencao',
    submenus: [
      {
        id: MENU_SUBMENUS.PDV_FRENTE_CAIXA,
        title: 'Frente de Caixa',
        path: '/frente-caixa'
      }
    ]
  },
  {
    id: MENU_MODULES.FACIAL,
    title: 'Prevenção Facial',
    icon: 'face',
    section: 'prevencao',
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
    section: 'prevencao',
    submenus: [
      {
        id: MENU_SUBMENUS.RUPTURA_LANCADOR,
        title: 'Lançar Auditoria',
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
    section: 'prevencao',
    submenus: [
      {
        id: MENU_SUBMENUS.ETIQUETAS_LANCAR,
        title: 'Lançar Auditoria',
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
    section: 'prevencao',
    submenus: [
      {
        id: MENU_SUBMENUS.PERDAS_LANCADOR,
        title: 'Lançar Quebras',
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
    section: 'prevencao',
    submenus: [
      {
        id: MENU_SUBMENUS.PRODUCAO_LANCADOR,
        title: 'Lançar Produção',
        path: '/producao-lancador'
      },
      {
        id: MENU_SUBMENUS.PRODUCAO_SUGESTAO,
        title: 'Sugestão Produção Padaria',
        path: '/producao-sugestao'
      },
      {
        id: MENU_SUBMENUS.PRODUCAO_RESULTADOS,
        title: 'Resultados',
        path: '/producao/resultados'
      }
    ]
  },
  {
    id: MENU_MODULES.HORTFRUT,
    title: 'Prevenção HortFruti',
    icon: 'hortfrut',
    section: 'prevencao',
    submenus: [
      {
        id: MENU_SUBMENUS.HORTFRUT_LANCADOR,
        title: 'Lançador de Itens',
        path: '/hortfrut-lancador'
      },
      {
        id: MENU_SUBMENUS.HORTFRUT_RESULTADOS,
        title: 'Resultado dos Lançamentos',
        path: '/hortfrut-resultados'
      }
    ]
  },
  // ========== GARIMPA FÁCIL ==========
  {
    id: MENU_MODULES.GARIMPA_FORNECEDORES,
    title: 'Fornecedores e Concorrentes',
    icon: 'search',
    section: 'garimpa',
    submenus: [
      {
        id: MENU_SUBMENUS.GARIMPA_FORNECEDORES_CONCORRENTES,
        title: 'Fornecedores e Concorrentes',
        path: '/garimpa-fornecedores'
      }
    ]
  },
  // ========== IA NO RADAR ==========
  {
    id: MENU_MODULES.ROTA_CRESCIMENTO,
    title: 'Rota do Crescimento',
    icon: 'rocket',
    section: 'ia',
    submenus: [
      {
        id: MENU_SUBMENUS.ROTA_CRESCIMENTO_DASHBOARD,
        title: 'Dashboard de Crescimento',
        path: '/rota-crescimento'
      }
    ]
  }
];
