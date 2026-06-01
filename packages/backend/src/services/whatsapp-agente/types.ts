/**
 * Tipos compartilhados pro sistema do Agente IA do WhatsApp.
 */

export interface ToolContext {
  /** numero do usuario que perguntou (whatsapp jid) */
  fromNumber: string;
  /** nome do contato */
  fromName?: string;
  /** ID do grupo (se mensagem veio de grupo) */
  groupId?: string;
  /** Loja default da empresa (codLoja) — pode ser sobrescrito por param da tool */
  defaultCodLoja?: number;
  /** Se esconde valor de custo nas respostas (LGPD/controle) */
  esconderCusto?: boolean;
}

export interface ToolDefinition {
  /** Nome unico - igual ao function_name passado pro GPT */
  name: string;
  /** Categoria pra agrupar na UI (Vendas, Quebras, Estoque, etc) */
  categoria: string;
  /** Descricao curta pra UI */
  descricao: string;
  /** Descricao mais detalhada pra GPT entender quando chamar */
  descricaoGPT: string;
  /** JSON Schema dos parametros (formato OpenAI function calling) */
  parameters: {
    type: 'object';
    properties: Record<string, any>;
    required?: string[];
  };
  /** Implementacao - recebe params validados + contexto, retorna obj serializavel */
  execute: (params: any, ctx: ToolContext) => Promise<ToolResult>;
}

export interface ToolResult {
  /** Resposta legivel (markdown leve - WhatsApp render basico) */
  resposta: string;
  /** Dados estruturados (opcional - pra anexar como JSON/CSV no futuro) */
  dados?: any;
  /** Se a tool falhou (erro interno) */
  erro?: string;
}

export interface AgenteConfig {
  id: number;
  ativo: boolean;
  group_id: string | null;
  group_name: string | null;
  prefixo: string;
  whitelist_numeros: string[];
  horario_inicio: string;
  horario_fim: string;
  dias_semana: string[];
  mensagem_fora_horario: string;
  nome_agente: string;
  avatar_emoji: string;
  persona_descricao: string;
  tom_comunicacao: string;
  modelo_ia: string;
  max_tokens_resposta: number;
  temperatura: number;
  instrucoes_extras: string;
  tools_habilitadas: Record<string, boolean>;
  notificacoes_proativas: Record<string, any>;
  budget_mensal_brl: number;
  alertar_em_pct: number;
  bloquear_em_pct: number;
  gasto_mes_atual_brl: number;
  mes_referencia_gasto: string | null;
  lojas_permitidas: string[];
  setores_permitidos: string[];
  esconder_custo: boolean;
}
