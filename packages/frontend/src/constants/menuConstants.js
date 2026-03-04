// IDs dos módulos principais
export const MENU_MODULES = {
  DASHBOARD: 'dashboard',
  // Gestão no Radar
  GESTAO_INTELIGENTE: 'gestao-inteligente',
  ESTOQUE_MARGEM: 'estoque-margem',
  COMPRAS: 'compras',
  PRICING: 'pricing',
  OFERTAS: 'ofertas',
  // Prevenção no Radar
  BIPAGENS: 'bipagens',
  PDV: 'pdv',
  FACIAL: 'facial',
  RUPTURA: 'ruptura',
  ETIQUETAS: 'etiquetas',
  PERDAS: 'perdas',
  PREVENCAO_TROCAS: 'prevencao-trocas',
  PRODUCAO: 'producao',
  HORTFRUT: 'hortfrut',
  CONTROLE_RECEBIMENTO: 'controle-recebimento',
  ABASTECIMENTO: 'abastecimento',
  // Garimpa Fácil
  GARIMPA_FORNECEDORES: 'garimpa-fornecedores',
  // Finanças no Radar
  BANCOS: 'bancos',
  ENTRADAS_SAIDAS: 'entradas-saidas',
  DEMONSTRATIVO_CAIXA: 'demonstrativo-caixa',
  // Consultor Digital
  ROTA_CRESCIMENTO: 'rota-crescimento',
};

// IDs dos sub-menus
export const MENU_SUBMENUS = {
  // Gestão Inteligente
  GESTAO_INTELIGENTE_PAINEL: 'gestao-inteligente-painel',

  // Gestão de Estoque
  ESTOQUE_SAUDE: 'estoque-saude',
  ANALISE_CORTE: 'analise-corte',

  // Gestão de Compras
  COMPRA_VENDA: 'compra-venda',
  PEDIDOS: 'pedidos',
  CALENDARIO_ATENDIMENTO: 'calendario-atendimento',
  RUPTURA_INDUSTRIA: 'ruptura-industria',
  PRAZO_FORNECEDORES: 'prazo-fornecedores',

  // Gestão de Pricing
  SAUDE_MARGENS: 'saude-margens',
  PRICING_ANCORAGEM: 'pricing-ancoragem',
  PRICING_COMPETITIVIDADE: 'pricing-competitividade',

  // Gestão de Ofertas
  PROGRAMACAO_ATUAL: 'programacao-atual',
  OFERTAS_SALVAS: 'ofertas-salvas',

  // Controle de Recebimento
  NF_A_CHEGAR: 'nf-a-chegar',
  NF_RECEBIMENTO: 'nf-recebimento',

  // Bipagens
  BIPAGENS_AO_VIVO: 'bipagens-ao-vivo',
  BIPAGENS_RESULTADOS: 'bipagens-resultados',
  BIPAGENS_RANKINGS: 'bipagens-rankings',

  // PDV
  PDV_FRENTE_CAIXA: 'pdv-frente-caixa',
  PDV_PREVENCAO_CAIXA: 'pdv-prevencao-caixa',
  PDV_GESTAO_TROCAS: 'pdv-gestao-trocas',
  PDV_CONTROLE_PDV: 'pdv-controle-pdv',

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

  // Trocas
  PREVENCAO_TROCAS: 'prevencao-trocas',

  // Produção
  PRODUCAO_LANCADOR: 'producao-lancador',
  PRODUCAO_SUGESTAO: 'producao-sugestao',
  PRODUCAO_RESULTADOS: 'producao-resultados',

  // HortFrut
  HORTFRUT_LANCADOR: 'hortfrut-lancador',
  HORTFRUT_RESULTADOS: 'hortfrut-resultados',

  // Abastecimento
  PRIORIDADE_REPOSICAO: 'prioridade-reposicao',

  // Garimpa Fácil
  GARIMPA_FORNECEDORES_CONCORRENTES: 'garimpa-fornecedores-concorrentes',

  // Finanças no Radar
  EXTRATO_SANTANDER: 'extrato-santander',
  EXTRATO_TRIBANCO: 'extrato-tribanco',
  EXTRATO_BANCO24H: 'extrato-banco24h',
  BOLETOS_DDA: 'boletos-dda',
  CONCILIACAO_BANCARIA: 'conciliacao-bancaria',
  ANALISE_OFERTA: 'analise-oferta',
  SIMULADOR_VENDA: 'simulador-venda',
  ENTRADAS_SAIDAS: 'entradas-saidas',
  DEMONSTRATIVO_CAIXA: 'demonstrativo-caixa',

  // Consultor Digital
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
    title: 'Gestão de Estoque',
    icon: 'estoque',
    section: 'gestao',
    submenus: [
      {
        id: MENU_SUBMENUS.ESTOQUE_SAUDE,
        title: 'Saúde do Estoque',
        path: '/estoque-saude'
      },
      {
        id: MENU_SUBMENUS.ANALISE_CORTE,
        title: 'Análise de Corte',
        path: '/pricing-ponderacao'
      }
    ]
  },
  {
    id: MENU_MODULES.COMPRAS,
    title: 'Gestão de Compras',
    icon: 'compra-venda',
    section: 'gestao',
    submenus: [
      {
        id: MENU_SUBMENUS.COMPRA_VENDA,
        title: 'Compra x Venda',
        path: '/compra-venda-analise'
      },
      {
        id: MENU_SUBMENUS.PEDIDOS,
        title: 'Pedidos de Compras',
        path: '/prevencao-pedidos'
      },
      {
        id: MENU_SUBMENUS.CALENDARIO_ATENDIMENTO,
        title: 'Calendário de Atendimento',
        path: '/calendario-atendimento'
      },
      {
        id: MENU_SUBMENUS.RUPTURA_INDUSTRIA,
        title: 'Ruptura Indústria',
        path: '/ruptura-industria'
      },
      {
        id: MENU_SUBMENUS.PRAZO_FORNECEDORES,
        title: 'Prazo Fornecedores',
        path: '/prazo-fornecedores'
      }
    ]
  },
  {
    id: MENU_MODULES.PRICING,
    title: 'Gestão de Pricing',
    icon: 'tag',
    section: 'gestao',
    submenus: [
      {
        id: MENU_SUBMENUS.SAUDE_MARGENS,
        title: 'Saúde de Margens',
        path: '/saude-margens'
      },
      {
        id: MENU_SUBMENUS.PRICING_ANCORAGEM,
        title: 'Ancoragem de Preço',
        path: '/pricing-ancoragem'
      },
      {
        id: MENU_SUBMENUS.PRICING_COMPETITIVIDADE,
        title: 'Competitividade e Concorrência',
        path: '/pricing-competitividade'
      }
    ]
  },
  {
    id: MENU_MODULES.OFERTAS,
    title: 'Gestão de Ofertas',
    icon: 'gift',
    section: 'gestao',
    submenus: [
      {
        id: MENU_SUBMENUS.PROGRAMACAO_ATUAL,
        title: 'Programação Atual',
        path: '/gestao-ofertas/programacao-atual'
      },
      {
        id: MENU_SUBMENUS.ANALISE_OFERTA,
        title: 'Análise e Sugestão',
        path: '/gestao-ofertas/analise-sugestao'
      },
      {
        id: MENU_SUBMENUS.OFERTAS_SALVAS,
        title: 'Ofertas Salvas',
        path: '/gestao-ofertas/ofertas-salvas'
      },
      {
        id: MENU_SUBMENUS.SIMULADOR_VENDA,
        title: 'Simulador de Venda',
        path: '/gestao-ofertas/simulador-venda'
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
      },
      {
        id: MENU_SUBMENUS.PDV_GESTAO_TROCAS,
        title: 'Gestão de Trocas',
        path: '/gestao-trocas'
      },
      {
        id: MENU_SUBMENUS.PDV_CONTROLE_PDV,
        title: 'Controle de PDV',
        path: '/controle-pdv'
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
    id: MENU_MODULES.PREVENCAO_TROCAS,
    title: 'Prevenção Trocas',
    icon: 'exchange',
    section: 'prevencao',
    submenus: [
      {
        id: MENU_SUBMENUS.PREVENCAO_TROCAS,
        title: 'Trocas com Fornecedores',
        path: '/prevencao-trocas'
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
  {
    id: MENU_MODULES.CONTROLE_RECEBIMENTO,
    title: 'Prevenção Recebimento',
    icon: 'document',
    section: 'prevencao',
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
  {
    id: MENU_MODULES.ABASTECIMENTO,
    title: 'Prevenção Abastecimento',
    icon: 'truck',
    section: 'prevencao',
    submenus: [
      {
        id: MENU_SUBMENUS.PRIORIDADE_REPOSICAO,
        title: 'Prioridade Reposição',
        path: '/prioridade-reposicao'
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
  // ========== FINANÇAS NO RADAR ==========
  {
    id: MENU_MODULES.ENTRADAS_SAIDAS,
    title: 'Entradas e Saídas',
    icon: 'dollar',
    section: 'financas',
    submenus: [
      {
        id: MENU_SUBMENUS.ENTRADAS_SAIDAS,
        title: 'Entradas e Saídas',
        path: '/entradas-saidas'
      }
    ]
  },
  {
    id: MENU_MODULES.DEMONSTRATIVO_CAIXA,
    title: 'Demonstrativo de Caixa',
    icon: 'chart',
    section: 'financas',
    submenus: [
      {
        id: MENU_SUBMENUS.DEMONSTRATIVO_CAIXA,
        title: 'Demonstrativo de Caixa',
        path: '/demonstrativo-caixa'
      }
    ]
  },
  {
    id: MENU_MODULES.BANCOS,
    title: 'Bancos',
    icon: 'bank',
    section: 'financas',
    submenus: [
      {
        id: MENU_SUBMENUS.EXTRATO_SANTANDER,
        title: 'Extrato Bancário',
        path: '/extrato-santander'
      },
      {
        id: MENU_SUBMENUS.EXTRATO_TRIBANCO,
        title: 'Extrato Tribanco',
        path: '/extrato-tribanco'
      },
      {
        id: MENU_SUBMENUS.EXTRATO_BANCO24H,
        title: 'Extrato Banco 24horas',
        path: '/extrato-banco24h'
      },
      {
        id: MENU_SUBMENUS.BOLETOS_DDA,
        title: 'Boletos DDA',
        path: '/boletos-dda'
      },
      {
        id: MENU_SUBMENUS.CONCILIACAO_BANCARIA,
        title: 'Conciliação Bancária',
        path: '/conciliacao-bancaria'
      }
    ]
  },
  // ========== CONSULTOR DIGITAL ==========
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
