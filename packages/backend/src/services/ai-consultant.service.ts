/**
 * AI Consultant Service
 * Consultor IA com Function Calling para análise de dados do supermercado
 * Usa OpenAI GPT-4o-mini via axios (sem dependência do pacote openai)
 */

import axios from 'axios';
import { AppDataSource } from '../config/database';
import { ConfigurationService } from './configuration.service';
import { GestaoInteligenteService } from './gestao-inteligente.service';
import { FrenteCaixaService } from './frente-caixa.service';
import { LossService } from './loss.service';
import { CompraVendaService } from './compra-venda.service';
import { RuptureSurveyService } from './rupture-survey.service';
import { LabelAuditService } from './label-audit.service';

// Interfaces
interface AIMessage {
  role: 'system' | 'user' | 'assistant' | 'function';
  content: string | null;
  function_call?: { name: string; arguments: string };
  name?: string;
}

interface ConversationRow {
  id: number;
  user_id: number;
  title: string;
  created_at: Date;
  updated_at: Date;
}

interface MessageRow {
  id: number;
  conversation_id: number;
  role: string;
  content: string;
  function_call: any;
  created_at: Date;
}

// System prompt dinâmico (inclui data atual)
function getSystemPrompt(): string {
  const now = new Date();
  const brDate = new Date(now.toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }));
  const hoje = `${brDate.getFullYear()}-${String(brDate.getMonth() + 1).padStart(2, '0')}-${String(brDate.getDate()).padStart(2, '0')}`;
  const mesAtualInicio = `${brDate.getFullYear()}-${String(brDate.getMonth() + 1).padStart(2, '0')}-01`;
  const ano = brDate.getFullYear();
  const mes = brDate.getMonth() + 1;

  // Calcular último dia do mês atual
  const ultimoDiaMes = new Date(ano, mes, 0).getDate();
  const fimMesAtual = `${ano}-${String(mes).padStart(2, '0')}-${ultimoDiaMes}`;

  return `Você é o **Radar IA**, o co-piloto de gestão do supermercado. Você NÃO é um chatbot genérico. Você é um consultor sênior com 20+ anos no varejo alimentar brasileiro que trabalha COM o gestor, lado a lado.

## REGRA DE OURO — NUNCA QUEBRE ESTA REGRA
🚫 NUNCA dê conselhos genéricos como "revise seus preços", "melhore o marketing", "otimize compras", "treine a equipe"
✅ SEMPRE busque os dados PRIMEIRO via funções, depois dê recomendações com NOMES DE PRODUTOS, VALORES EXATOS e NÚMEROS REAIS
✅ Se o usuário pedir um plano de ação, você DEVE chamar múltiplas funções para mergulhar nos dados até o nível de PRODUTO INDIVIDUAL antes de responder
✅ Você é um CO-PILOTO: diga exatamente "faça isso com o produto X", "baixe o preço de Y de R$Z para R$W", "produto K está com margem de N% — suba para M%"

**EXEMPLO DO QUE NÃO FAZER:**
❌ "Revise a precificação dos produtos para melhorar a margem" ← GENÉRICO, INÚTIL
❌ "Implemente práticas de controle de estoque" ← VAGO, NÃO AJUDA

**EXEMPLO DO QUE FAZER:**
✅ "🥩 PICANHA BOVINA (cód. 1234) está com margem de 18% — abaixo do benchmark de 28%. Custo: R$ 45,00, Preço atual: R$ 54,90. Sugiro testar R$ 59,90 (+9%) para alcançar margem de 25%. Volume: 450kg/mês, impacto estimado: +R$ 2.250/mês no lucro."
✅ "📉 LEITE INTEGRAL PIRACANJUBA vendeu 30% menos que mês passado. Está em ruptura há 3 dias. Fornecedor PIRACANJUBA tem 5 itens em falta. Ação: ligar para o representante HOJE."

## DATA E HORA ATUAL
- **Hoje**: ${hoje} (formato YYYY-MM-DD)
- **Mês atual**: de ${mesAtualInicio} até ${fimMesAtual}
- **Período até hoje**: de ${mesAtualInicio} até ${hoje}
- **Ano**: ${ano} | **Mês**: ${mes}
- CUIDADO COM DATAS: Fevereiro tem 28 dias (29 em bissexto). Meses com 30 dias: abril, junho, setembro, novembro. Demais: 31 dias.

## COMO TRABALHAR (METODOLOGIA CO-PILOTO)

### Quando pedirem PLANO DE AÇÃO para crescer lucro/vendas/margem:
1. CHAME buscar_indicadores do mês atual E do mês anterior → calcule a diferença
2. CHAME buscar_vendas_por_setor → identifique os 3 piores setores em margem
3. Para CADA setor problemático, CHAME buscar_grupos_por_secao → identifique grupos ruins
4. Para os piores grupos, CHAME buscar_subgrupos_por_grupo → detalhe subgrupos
5. Para os piores subgrupos, CHAME buscar_itens_por_subgrupo → chegue ao PRODUTO
6. CHAME buscar_perdas_quebras → identifique produtos com mais perda
7. CHAME buscar_ruptura → identifique o que está em falta
8. Com TODOS esses dados, monte um plano CONCRETO:
   - Lista de produtos para SUBIR preço (com preço atual, custo, margem atual, margem alvo, preço sugerido)
   - Lista de produtos para BAIXAR preço (se o volume caiu e a elasticidade permite recuperar)
   - Lista de produtos para DESTACAR em oferta (alta margem + bom giro)
   - Lista de produtos com PERDA ALTA para investigar
   - Lista de produtos em RUPTURA para resolver urgente
   - SALVE um insight com o plano para acompanhamento futuro

### Quando pedirem ACOMPANHAMENTO de resultados:
1. Busque os insights salvos anteriormente → veja o que foi recomendado
2. Busque os indicadores do período APÓS a recomendação
3. Compare ANTES x DEPOIS com números exatos
4. Diga claramente: "A Picanha subiu de margem 18% para 26% ✅" ou "O Leite continuou em queda ❌, vamos ajustar"
5. Atualize o plano com novas recomendações se necessário

### Quando pedirem análise de setor/produtos:
- NUNCA pare no nível de seção. SEMPRE desça até o PRODUTO INDIVIDUAL.
- Mostre os TOP 5 produtos que mais contribuem e os 5 que mais prejudicam
- Para cada produto mostre: nome, venda R$, custo R$, margem %, quantidade, variação vs anterior

### Quando pedirem "pontos cegos" ou "problemas":
1. Busque operadores → identifique cancelamentos e diferenças anormais por NOME do operador
2. Busque perdas → identifique os TOP 10 PRODUTOS com mais perda por NOME
3. Busque compra vs venda → identifique setores comprando demais com NÚMEROS
4. Busque ruptura → identifique os TOP 10 PRODUTOS em falta por NOME
5. CRUZE: setor com perda alta + margem baixa + ruptura = EMERGÊNCIA

### Quando pedirem análise de operadores:
1. Busque todos os operadores do período
2. Compare CADA UM com a MÉDIA (ex: "Maria cancelou R$ 3.200, média é R$ 800 — 4x acima")
3. Identifique outliers por NOME e sugira ação específica

## FORMATO DAS RESPOSTAS
- USE EMOJIS generosamente: 📊💰📈📉🥩🍞🥬🧀🍺🧹⚠️✅❌💡🎯
- Dados organizados com emoji + label + valor:
  💰 **Faturamento** = R$ 1.500.000,00
  📊 **Margem** = 30,00%
  🎫 **Ticket Médio** = R$ 52,30
- Use **negrito** para números importantes
- Use ## para títulos com emoji (ex: ## 📊 Diagnóstico do Mês)
- Valores monetários: R$ X.XXX,XX | Percentuais: X,XX%
- Inclua 📋 Resumo Executivo no início e 💡 Plano de Ação no final
- Português brasileiro, profissional mas acessível

## QUANDO SUGERIR PREÇOS, USE ESTA LÓGICA:
- Se margem < benchmark do setor → SUBIR preço (calcule quanto subir para atingir benchmark)
- Se volume caiu >20% vs mês anterior E margem é alta → BAIXAR preço para recuperar volume
- Se produto tem margem >50% E baixo giro → colocar em OFERTA para girar
- Se produto tem ruptura frequente → NÃO mexer no preço, resolver abastecimento
- Se produto tem perda alta → investigar antes (vencimento? furto? avaria?)
- SEMPRE mostre: preço atual, custo, margem atual, preço sugerido, margem alvo, impacto estimado em R$

## BENCHMARKS DO MERCADO
- Margem bruta média supermercados: 25-30%
- Açougue: 28-35% | Padaria: 50-65% | Hortifrúti: 35-50%
- Mercearia: 18-25% | Frios: 20-28% | Bebidas: 15-22% | Limpeza: 20-28%
- Ticket médio bom: R$ 45-65 | Itens por cupom: 7-12
- Taxa de ruptura aceitável: <5% | Perda aceitável: <2% do faturamento

## CONTEXTO DO NEGÓCIO
- Sistema "Prevenção no Radar" para supermercados brasileiros
- Dados do ERP Oracle/Intersolid em tempo real
- Foco: prevenção de perdas, gestão de margem, eficiência operacional
- Setores: Açougue, Padaria, Hortifrúti, Mercearia, Frios, Bebidas, Limpeza, Higiene

## DADOS DISPONÍVEIS (use as funções!)
- **Indicadores**: faturamento, margem, ticket médio, cupons, oferta, markdown
- **Vendas por setor**: faturamento e margem por seção
- **Vendas analíticas**: comparativo mês atual vs anterior vs ano anterior
- **Vendas anuais**: evolução mensal do ano
- **Operadores de caixa**: vendas, cancelamentos, estornos, descontos, diferença de caixa por operador
- **Perdas e quebras**: valor total, ranking de produtos, ranking de motivos
- **Compra vs Venda**: comparativo por seção com markup, margem, cobertura
- **Ruptura de estoque**: produtos em falta, taxa de ruptura, fornecedores, perda de vendas, pedidos pendentes
- **Evolução mensal da ruptura**: taxa mês a mês, tendência
- **Drill-down de produtos**: Seção → Grupo → SubGrupo → Produto individual com venda, custo, margem, markup
- **Auditoria de etiquetas**: conformidade de preços, divergências encontradas
- **Insights salvos**: memória de recomendações anteriores para acompanhamento

## PROATIVIDADE EXTREMA
- Se margem de um setor está ABAIXO do benchmark → DESÇA até o produto e diga qual subir
- Se vendas caíram → busque os PRODUTOS que mais caíram e sugira ação para cada
- Se ticket médio < R$ 40 → identifique produtos complementares para cross-sell
- Se ruptura > 5% → liste CADA produto em falta e o status do pedido
- Se perda > 2% → liste os TOP produtos em perda com nome e valor
- SEMPRE salve insights importantes para acompanhamento futuro`;
}

// Definição das funções disponíveis para a IA
const AVAILABLE_FUNCTIONS = [
  {
    name: 'buscar_indicadores',
    description: 'Busca indicadores consolidados de vendas do período (faturamento, margem, ticket médio, cupons, etc.)',
    parameters: {
      type: 'object',
      properties: {
        dataInicio: { type: 'string', description: 'Data início no formato YYYY-MM-DD' },
        dataFim: { type: 'string', description: 'Data fim no formato YYYY-MM-DD' },
        codLoja: { type: 'number', description: 'Código da loja (opcional, omitir para todas)' }
      },
      required: ['dataInicio', 'dataFim']
    }
  },
  {
    name: 'buscar_vendas_por_setor',
    description: 'Busca vendas agrupadas por setor/seção (açougue, padaria, mercearia, etc.) com faturamento, margem e participação de cada setor',
    parameters: {
      type: 'object',
      properties: {
        dataInicio: { type: 'string', description: 'Data início no formato YYYY-MM-DD' },
        dataFim: { type: 'string', description: 'Data fim no formato YYYY-MM-DD' },
        codLoja: { type: 'number', description: 'Código da loja (opcional)' }
      },
      required: ['dataInicio', 'dataFim']
    }
  },
  {
    name: 'buscar_vendas_analiticas_setor',
    description: 'Busca vendas por setor com comparativos: período atual, mês passado, ano passado e média linear. Ideal para análise de tendências e variações.',
    parameters: {
      type: 'object',
      properties: {
        dataInicio: { type: 'string', description: 'Data início no formato YYYY-MM-DD' },
        dataFim: { type: 'string', description: 'Data fim no formato YYYY-MM-DD' },
        codLoja: { type: 'number', description: 'Código da loja (opcional)' }
      },
      required: ['dataInicio', 'dataFim']
    }
  },
  {
    name: 'buscar_vendas_por_ano',
    description: 'Busca vendas mensais consolidadas do ano inteiro com faturamento, margem, ticket médio e cupons por mês',
    parameters: {
      type: 'object',
      properties: {
        ano: { type: 'number', description: 'Ano (ex: 2026)' },
        codLoja: { type: 'number', description: 'Código da loja (opcional)' }
      },
      required: ['ano']
    }
  },
  {
    name: 'buscar_vendas_setor_anual',
    description: 'Busca vendas por setor mês a mês durante o ano inteiro. Mostra evolução de cada setor ao longo dos meses.',
    parameters: {
      type: 'object',
      properties: {
        ano: { type: 'number', description: 'Ano (ex: 2026)' },
        codLoja: { type: 'number', description: 'Código da loja (opcional)' }
      },
      required: ['ano']
    }
  },
  {
    name: 'buscar_insights_salvos',
    description: 'Busca insights e aprendizados salvos de conversas anteriores por categoria',
    parameters: {
      type: 'object',
      properties: {
        categoria: { type: 'string', description: 'Categoria do insight (vendas, margem, setor, tendencia, operacional)' }
      },
      required: []
    }
  },
  {
    name: 'salvar_insight',
    description: 'Salva um insight ou aprendizado importante para referência futura',
    parameters: {
      type: 'object',
      properties: {
        categoria: { type: 'string', description: 'Categoria (vendas, margem, setor, tendencia, operacional)' },
        conteudo: { type: 'string', description: 'O insight ou aprendizado a salvar' },
        fonte: { type: 'string', description: 'Fonte do insight (analise, usuario, externo)' }
      },
      required: ['categoria', 'conteudo']
    }
  },
  {
    name: 'buscar_noticias_setor',
    description: 'Busca notícias e informações recentes do setor de varejo alimentar/supermercados de fontes como ABRAS, APAS, SuperVarejo',
    parameters: {
      type: 'object',
      properties: {
        tema: { type: 'string', description: 'Tema da busca (ex: tendencias, inflacao, consumo, tecnologia)' }
      },
      required: ['tema']
    }
  },
  // === FASE 1: Gestão Operacional ===
  {
    name: 'buscar_operadores_caixa',
    description: 'Busca resumo de desempenho dos operadores de caixa: vendas, cupons, cancelamentos, estornos, descontos, diferença de caixa (sobra/quebra), formas de pagamento (dinheiro, cartão, PIX). Ideal para identificar operadores com muitos cancelamentos ou diferença de caixa.',
    parameters: {
      type: 'object',
      properties: {
        dataInicio: { type: 'string', description: 'Data início no formato YYYY-MM-DD' },
        dataFim: { type: 'string', description: 'Data fim no formato YYYY-MM-DD' },
        codOperador: { type: 'number', description: 'Código do operador específico (opcional)' },
        codLoja: { type: 'number', description: 'Código da loja (opcional)' }
      },
      required: ['dataInicio', 'dataFim']
    }
  },
  {
    name: 'buscar_perdas_quebras',
    description: 'Busca perdas e quebras de estoque do período: total de perdas em R$, ranking de produtos com mais perda, ranking de motivos de perda, e entradas de estoque. Fundamental para prevenção de perdas.',
    parameters: {
      type: 'object',
      properties: {
        dataInicio: { type: 'string', description: 'Data início no formato YYYY-MM-DD' },
        dataFim: { type: 'string', description: 'Data fim no formato YYYY-MM-DD' },
        motivo: { type: 'string', description: 'Filtrar por motivo específico (opcional, ex: Vencido, Avaria, Furto)' },
        produto: { type: 'string', description: 'Filtrar por nome do produto (opcional, busca parcial)' },
        tipo: { type: 'string', description: 'Tipo: perdas, entradas ou ambos (padrão: ambos)' },
        codLoja: { type: 'number', description: 'Código da loja (opcional)' }
      },
      required: ['dataInicio', 'dataFim']
    }
  },
  {
    name: 'buscar_compra_vs_venda',
    description: 'Compara compras vs vendas por seção/setor: mostra quanto cada setor comprou, quanto vendeu, markup, margem líquida, % compra/venda. Identifica setores com excesso de compra ou cobertura insuficiente.',
    parameters: {
      type: 'object',
      properties: {
        dataInicio: { type: 'string', description: 'Data início no formato YYYY-MM-DD' },
        dataFim: { type: 'string', description: 'Data fim no formato YYYY-MM-DD' },
        codSecao: { type: 'number', description: 'Código da seção específica (opcional)' },
        codLoja: { type: 'number', description: 'Código da loja (opcional)' }
      },
      required: ['dataInicio', 'dataFim']
    }
  },
  {
    name: 'buscar_totais_compra_venda',
    description: 'Busca totais consolidados de compras vs vendas do período: total de compras, total de vendas, markup geral, margem líquida geral, diferença.',
    parameters: {
      type: 'object',
      properties: {
        dataInicio: { type: 'string', description: 'Data início no formato YYYY-MM-DD' },
        dataFim: { type: 'string', description: 'Data fim no formato YYYY-MM-DD' },
        codLoja: { type: 'number', description: 'Código da loja (opcional)' }
      },
      required: ['dataInicio', 'dataFim']
    }
  },
  // === FASE 2: Produtos e Estoque ===
  {
    name: 'buscar_ruptura',
    description: 'Busca dados de ruptura de estoque (produtos em falta na gôndola): taxa de ruptura, ranking de produtos em falta, fornecedores com mais ruptura, seções afetadas, perda de venda estimada e status de pedidos em aberto.',
    parameters: {
      type: 'object',
      properties: {
        dataInicio: { type: 'string', description: 'Data início no formato YYYY-MM-DD' },
        dataFim: { type: 'string', description: 'Data fim no formato YYYY-MM-DD' },
        produto: { type: 'string', description: 'Filtrar por nome do produto (opcional, busca parcial)' },
        fornecedor: { type: 'string', description: 'Filtrar por fornecedor (opcional)' }
      },
      required: ['dataInicio', 'dataFim']
    }
  },
  {
    name: 'buscar_evolucao_ruptura',
    description: 'Busca evolução mensal da ruptura ao longo do ano: taxa de ruptura mês a mês, itens verificados, perda de venda e perda de lucro por mês. Ideal para identificar tendências de melhora ou piora na disponibilidade de produtos.',
    parameters: {
      type: 'object',
      properties: {
        ano: { type: 'number', description: 'Ano para análise (ex: 2026)' }
      },
      required: ['ano']
    }
  },
  {
    name: 'buscar_grupos_por_secao',
    description: 'Busca vendas detalhadas por GRUPO dentro de uma seção/setor específico. Hierarquia: Seção → Grupo → SubGrupo → Produto. Ex: dentro de "Açougue" (seção), ver grupos como "Bovinos", "Suínos", "Aves". Mostra venda, custo, margem, markup de cada grupo.',
    parameters: {
      type: 'object',
      properties: {
        dataInicio: { type: 'string', description: 'Data início no formato YYYY-MM-DD' },
        dataFim: { type: 'string', description: 'Data fim no formato YYYY-MM-DD' },
        codSecao: { type: 'number', description: 'Código da seção (obrigatório). Obtenha usando buscar_vendas_por_setor.' },
        codLoja: { type: 'number', description: 'Código da loja (opcional)' }
      },
      required: ['dataInicio', 'dataFim', 'codSecao']
    }
  },
  {
    name: 'buscar_subgrupos_por_grupo',
    description: 'Busca vendas detalhadas por SUBGRUPO dentro de um grupo. Hierarquia: Seção → Grupo → SubGrupo → Produto. Ex: dentro de "Bovinos" (grupo), ver subgrupos como "Traseiro", "Dianteiro", "Miúdos". Mostra venda, custo, margem, markup.',
    parameters: {
      type: 'object',
      properties: {
        dataInicio: { type: 'string', description: 'Data início no formato YYYY-MM-DD' },
        dataFim: { type: 'string', description: 'Data fim no formato YYYY-MM-DD' },
        codGrupo: { type: 'number', description: 'Código do grupo (obrigatório). Obtenha usando buscar_grupos_por_secao.' },
        codSecao: { type: 'number', description: 'Código da seção (opcional, para contexto)' },
        codLoja: { type: 'number', description: 'Código da loja (opcional)' }
      },
      required: ['dataInicio', 'dataFim', 'codGrupo']
    }
  },
  {
    name: 'buscar_itens_por_subgrupo',
    description: 'Busca vendas detalhadas por PRODUTO INDIVIDUAL dentro de um subgrupo. Nível mais granular da hierarquia: Seção → Grupo → SubGrupo → Produto. Mostra cada produto com venda, custo, margem, markup, quantidade vendida. Ideal para identificar os produtos mais e menos vendidos.',
    parameters: {
      type: 'object',
      properties: {
        dataInicio: { type: 'string', description: 'Data início no formato YYYY-MM-DD' },
        dataFim: { type: 'string', description: 'Data fim no formato YYYY-MM-DD' },
        codSubgrupo: { type: 'number', description: 'Código do subgrupo (obrigatório). Obtenha usando buscar_subgrupos_por_grupo.' },
        codGrupo: { type: 'number', description: 'Código do grupo (opcional, para contexto)' },
        codSecao: { type: 'number', description: 'Código da seção (opcional, para contexto)' },
        codLoja: { type: 'number', description: 'Código da loja (opcional)' }
      },
      required: ['dataInicio', 'dataFim', 'codSubgrupo']
    }
  },
  // === FASE 3: Auditoria e Conformidade ===
  {
    name: 'buscar_auditoria_etiquetas',
    description: 'Busca resultados agregados de auditorias de etiquetas/preços: total de itens verificados, itens com preço divergente, valor total das divergências, ranking por seção, descontos aplicados no PDV. Identifica problemas de precificação na loja.',
    parameters: {
      type: 'object',
      properties: {
        dataInicio: { type: 'string', description: 'Data início no formato YYYY-MM-DD' },
        dataFim: { type: 'string', description: 'Data fim no formato YYYY-MM-DD' },
        produto: { type: 'string', description: 'Filtrar por nome do produto (opcional)' }
      },
      required: ['dataInicio', 'dataFim']
    }
  },
  {
    name: 'buscar_descontos_pdv',
    description: 'Busca descontos aplicados diretamente no PDV (caixa) por setor. Identifica setores com excesso de descontos manuais no caixa — indicativo de problemas de precificação ou falha de etiquetagem.',
    parameters: {
      type: 'object',
      properties: {
        dataInicio: { type: 'string', description: 'Data início no formato YYYY-MM-DD' },
        dataFim: { type: 'string', description: 'Data fim no formato YYYY-MM-DD' }
      },
      required: ['dataInicio', 'dataFim']
    }
  }
];

export class AIConsultantService {

  /**
   * Envia mensagem e obtém resposta da IA com Function Calling
   */
  static async chat(userId: number, conversationId: number | null, message: string): Promise<{
    conversationId: number;
    reply: string;
    title: string;
  }> {
    const apiKey = await ConfigurationService.get('openai_api_key');
    if (!apiKey) {
      throw new Error('Chave da API OpenAI não configurada. Vá em Configurações > IA para configurar.');
    }

    // Ler modelo e prompt customizado das configurações
    const configModel = await ConfigurationService.get('openai_model', 'gpt-4o');
    const customPrompt = await ConfigurationService.get('openai_system_prompt');

    // Criar ou recuperar conversa
    let convId = conversationId;
    if (!convId) {
      const result = await AppDataSource.query(
        `INSERT INTO ai_conversations (user_id, title) VALUES ($1, $2) RETURNING id`,
        [userId, 'Nova conversa']
      );
      convId = result[0].id;
    }

    // Salvar mensagem do usuário
    await AppDataSource.query(
      `INSERT INTO ai_messages (conversation_id, role, content) VALUES ($1, $2, $3)`,
      [convId, 'user', message]
    );

    // Buscar histórico da conversa (últimas 20 mensagens)
    const history: MessageRow[] = await AppDataSource.query(
      `SELECT role, content, function_call FROM ai_messages
       WHERE conversation_id = $1
       ORDER BY created_at ASC
       LIMIT 20`,
      [convId]
    );

    // Montar mensagens para a OpenAI (usa prompt customizado se configurado)
    const systemPrompt = customPrompt && customPrompt.trim()
      ? getSystemPrompt() + '\n\n## INSTRUÇÕES ADICIONAIS DO ADMINISTRADOR\n' + customPrompt.trim()
      : getSystemPrompt();
    const messages: AIMessage[] = [
      { role: 'system', content: systemPrompt }
    ];

    // Adicionar histórico
    for (const msg of history) {
      if (msg.role === 'function') {
        messages.push({
          role: 'function',
          name: msg.function_call?.name || 'unknown',
          content: msg.content
        });
      } else {
        messages.push({
          role: msg.role as 'user' | 'assistant',
          content: msg.content
        });
      }
    }

    // Chamar OpenAI com Function Calling (loop para múltiplas chamadas)
    let reply = '';
    let attempts = 0;
    const maxAttempts = 10; // Máximo de function calls — co-piloto precisa de muitas chamadas para análise profunda

    while (attempts < maxAttempts) {
      attempts++;

      const response = await axios.post(
        'https://api.openai.com/v1/chat/completions',
        {
          model: configModel || 'gpt-4o',
          messages,
          functions: AVAILABLE_FUNCTIONS,
          function_call: 'auto',
          temperature: 0.7,
          max_tokens: 15000
        },
        {
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json'
          },
          timeout: 120000
        }
      );

      const choice = response.data.choices[0];
      const assistantMessage = choice.message;

      // Se a IA quer chamar uma função
      if (assistantMessage.function_call) {
        const functionName = assistantMessage.function_call.name;
        const functionArgs = JSON.parse(assistantMessage.function_call.arguments);

        console.log(`🤖 [AI] Chamando função: ${functionName}`, functionArgs);

        // Adicionar a mensagem do assistant com function_call
        messages.push({
          role: 'assistant',
          content: null,
          function_call: assistantMessage.function_call
        });

        // Executar a função
        const functionResult = await this.executeFunction(functionName, functionArgs);

        // Adicionar resultado da função
        messages.push({
          role: 'function',
          name: functionName,
          content: JSON.stringify(functionResult)
        });

        // Salvar chamada de função no histórico
        await AppDataSource.query(
          `INSERT INTO ai_messages (conversation_id, role, content, function_call) VALUES ($1, $2, $3, $4)`,
          [convId, 'function', JSON.stringify(functionResult), JSON.stringify({ name: functionName, arguments: functionArgs })]
        );

        // Continuar o loop para a IA processar o resultado
        continue;
      }

      // Resposta final (sem function call)
      reply = assistantMessage.content || 'Desculpe, não consegui gerar uma resposta.';
      break;
    }

    // Salvar resposta do assistant
    await AppDataSource.query(
      `INSERT INTO ai_messages (conversation_id, role, content) VALUES ($1, $2, $3)`,
      [convId, 'assistant', reply]
    );

    // Atualizar título da conversa se for a primeira mensagem
    const msgCount = await AppDataSource.query(
      `SELECT COUNT(*) as count FROM ai_messages WHERE conversation_id = $1 AND role = 'user'`,
      [convId]
    );

    let title = 'Nova conversa';
    if (parseInt(msgCount[0].count) <= 1) {
      // Gerar título baseado na primeira mensagem
      title = message.length > 50 ? message.substring(0, 50) + '...' : message;
      await AppDataSource.query(
        `UPDATE ai_conversations SET title = $1, updated_at = now() WHERE id = $2`,
        [title, convId]
      );
    } else {
      const conv = await AppDataSource.query(
        `SELECT title FROM ai_conversations WHERE id = $1`,
        [convId]
      );
      title = conv[0]?.title || 'Nova conversa';
      await AppDataSource.query(
        `UPDATE ai_conversations SET updated_at = now() WHERE id = $1`,
        [convId]
      );
    }

    return { conversationId: convId!, reply, title };
  }

  /**
   * Executa uma função chamada pela IA
   */
  private static async executeFunction(name: string, args: any): Promise<any> {
    try {
      switch (name) {
        case 'buscar_indicadores':
          return await GestaoInteligenteService.getIndicadores({
            dataInicio: args.dataInicio,
            dataFim: args.dataFim,
            codLoja: args.codLoja
          });

        case 'buscar_vendas_por_setor':
          return await GestaoInteligenteService.getVendasPorSetor({
            dataInicio: args.dataInicio,
            dataFim: args.dataFim,
            codLoja: args.codLoja
          });

        case 'buscar_vendas_analiticas_setor':
          return await GestaoInteligenteService.getVendasAnaliticasPorSetor({
            dataInicio: args.dataInicio,
            dataFim: args.dataFim,
            codLoja: args.codLoja
          });

        case 'buscar_vendas_por_ano':
          return await GestaoInteligenteService.getVendasPorAno(
            args.ano,
            args.codLoja
          );

        case 'buscar_vendas_setor_anual':
          return await GestaoInteligenteService.getVendasPorSetorAnual(
            args.ano,
            args.codLoja
          );

        case 'buscar_insights_salvos':
          return await this.getInsights(args.categoria);

        case 'salvar_insight':
          return await this.saveInsight(args.categoria, args.conteudo, args.fonte || 'analise');

        case 'buscar_noticias_setor':
          return await this.searchSectorNews(args.tema);

        // === FASE 1: Gestão Operacional ===
        case 'buscar_operadores_caixa': {
          // FrenteCaixaService usa DD/MM/YYYY
          const dtIni = this.toDateBR(args.dataInicio);
          const dtFim = this.toDateBR(args.dataFim);
          return await FrenteCaixaService.getResumoOperadores({
            dataInicio: dtIni,
            dataFim: dtFim,
            codOperador: args.codOperador,
            codLoja: args.codLoja
          });
        }

        case 'buscar_perdas_quebras':
          // LossService usa YYYY-MM-DD (mesmo formato da IA)
          return await LossService.getAgregatedResults({
            data_inicio: args.dataInicio,
            data_fim: args.dataFim,
            motivo: args.motivo,
            produto: args.produto,
            tipo: args.tipo || 'ambos',
            codLoja: args.codLoja,
            page: 1,
            limit: 30
          });

        case 'buscar_compra_vs_venda': {
          // CompraVendaService usa DD/MM/YYYY
          const dtIniCV = this.toDateBR(args.dataInicio);
          const dtFimCV = this.toDateBR(args.dataFim);
          return await CompraVendaService.getCompraVendaPorSecao({
            dataInicio: dtIniCV,
            dataFim: dtFimCV,
            codSecao: args.codSecao,
            codLoja: args.codLoja,
            tipoVenda: { pdv: true, nfCliente: true, vendaBalcao: true, nfTransferencia: false },
            tipoNotaFiscal: { compras: true, bonificacao: false, outras: false },
            produtosBonificados: 'com',
            decomposicao: 'ambos'
          });
        }

        case 'buscar_totais_compra_venda': {
          const dtIniT = this.toDateBR(args.dataInicio);
          const dtFimT = this.toDateBR(args.dataFim);
          return await CompraVendaService.getTotais({
            dataInicio: dtIniT,
            dataFim: dtFimT,
            codLoja: args.codLoja,
            tipoVenda: { pdv: true, nfCliente: true, vendaBalcao: true, nfTransferencia: false },
            tipoNotaFiscal: { compras: true, bonificacao: false, outras: false },
            produtosBonificados: 'com',
            decomposicao: 'ambos'
          });
        }

        // === FASE 2: Produtos e Estoque ===
        case 'buscar_ruptura':
          return await RuptureSurveyService.getAgregatedResults({
            data_inicio: args.dataInicio,
            data_fim: args.dataFim,
            produto: args.produto || 'todos',
            fornecedor: args.fornecedor || 'todos',
            auditor: 'todos'
          });

        case 'buscar_evolucao_ruptura':
          return await RuptureSurveyService.getEvolucaoMensal(args.ano);

        case 'buscar_grupos_por_secao':
          return await GestaoInteligenteService.getGruposPorSecao({
            dataInicio: args.dataInicio,
            dataFim: args.dataFim,
            codSecao: args.codSecao,
            codLoja: args.codLoja
          });

        case 'buscar_subgrupos_por_grupo':
          return await GestaoInteligenteService.getSubgruposPorGrupo({
            dataInicio: args.dataInicio,
            dataFim: args.dataFim,
            codGrupo: args.codGrupo,
            codSecao: args.codSecao,
            codLoja: args.codLoja
          });

        case 'buscar_itens_por_subgrupo':
          return await GestaoInteligenteService.getItensPorSubgrupo({
            dataInicio: args.dataInicio,
            dataFim: args.dataFim,
            codSubgrupo: args.codSubgrupo,
            codGrupo: args.codGrupo,
            codSecao: args.codSecao,
            codLoja: args.codLoja
          });

        // === FASE 3: Auditoria e Conformidade ===
        case 'buscar_auditoria_etiquetas':
          return await LabelAuditService.getAgregatedResults({
            data_inicio: args.dataInicio,
            data_fim: args.dataFim,
            produto: args.produto || 'todos',
            fornecedor: 'todos',
            auditor: 'todos'
          });

        case 'buscar_descontos_pdv':
          return await LabelAuditService.getDescontosPDV(
            args.dataInicio,
            args.dataFim
          );

        default:
          return { error: `Função ${name} não encontrada` };
      }
    } catch (error: any) {
      console.error(`❌ [AI] Erro ao executar função ${name}:`, error.message);
      return { error: `Erro ao buscar dados: ${error.message}` };
    }
  }

  /**
   * Converte data YYYY-MM-DD para DD/MM/YYYY (formato Oracle/ERP)
   */
  private static toDateBR(dateStr: string): string {
    if (!dateStr) return dateStr;
    // Se já está em DD/MM/YYYY, retorna como está
    if (dateStr.includes('/')) return dateStr;
    // Converte YYYY-MM-DD para DD/MM/YYYY
    const [year, month, day] = dateStr.split('-');
    return `${day}/${month}/${year}`;
  }

  /**
   * Busca insights salvos
   */
  private static async getInsights(categoria?: string): Promise<any[]> {
    let query = `SELECT * FROM ai_insights ORDER BY created_at DESC LIMIT 20`;
    const params: any[] = [];

    if (categoria) {
      query = `SELECT * FROM ai_insights WHERE category = $1 ORDER BY created_at DESC LIMIT 20`;
      params.push(categoria);
    }

    return await AppDataSource.query(query, params);
  }

  /**
   * Salva um insight
   */
  private static async saveInsight(category: string, content: string, source: string): Promise<{ saved: boolean }> {
    await AppDataSource.query(
      `INSERT INTO ai_insights (category, content, source) VALUES ($1, $2, $3)`,
      [category, content, source]
    );
    return { saved: true };
  }

  /**
   * Busca notícias do setor via web scraping simplificado
   */
  private static async searchSectorNews(tema: string): Promise<any> {
    try {
      // Buscar via Google Search API simulada (DuckDuckGo instant)
      const query = encodeURIComponent(`supermercado varejo ${tema} site:abras.com.br OR site:portalapas.org.br OR site:superhiper.com.br`);
      const response = await axios.get(
        `https://api.duckduckgo.com/?q=${query}&format=json&no_redirect=1`,
        { timeout: 10000 }
      );

      const results = [];
      if (response.data.AbstractText) {
        results.push({
          titulo: response.data.Heading || tema,
          resumo: response.data.AbstractText,
          fonte: response.data.AbstractSource || 'Web'
        });
      }

      if (response.data.RelatedTopics) {
        for (const topic of response.data.RelatedTopics.slice(0, 5)) {
          if (topic.Text) {
            results.push({
              titulo: topic.Text.substring(0, 80),
              resumo: topic.Text,
              fonte: topic.FirstURL || 'Web'
            });
          }
        }
      }

      if (results.length === 0) {
        return {
          mensagem: `Não encontrei notícias recentes sobre "${tema}" no momento. Posso analisar seus dados internos para dar insights sobre este tema.`,
          sugestao: 'Tente perguntar sobre seus próprios indicadores de vendas e margem.'
        };
      }

      return { noticias: results };
    } catch (error: any) {
      console.error('❌ [AI] Erro ao buscar notícias:', error.message);
      return {
        mensagem: `Não consegui acessar notícias externas no momento. Posso analisar seus dados internos para dar insights.`,
        sugestao: 'Pergunte sobre seus indicadores e eu analiso com base nos dados do seu sistema.'
      };
    }
  }

  /**
   * Lista conversas do usuário
   */
  static async getConversations(userId: number): Promise<ConversationRow[]> {
    return await AppDataSource.query(
      `SELECT id, title, created_at, updated_at
       FROM ai_conversations
       WHERE user_id = $1
       ORDER BY updated_at DESC
       LIMIT 50`,
      [userId]
    );
  }

  /**
   * Busca histórico de uma conversa
   */
  static async getConversationHistory(conversationId: number, userId: number): Promise<{
    conversation: ConversationRow;
    messages: MessageRow[];
  }> {
    const conversations = await AppDataSource.query(
      `SELECT * FROM ai_conversations WHERE id = $1 AND user_id = $2`,
      [conversationId, userId]
    );

    if (conversations.length === 0) {
      throw new Error('Conversa não encontrada');
    }

    const messages = await AppDataSource.query(
      `SELECT id, role, content, function_call, created_at
       FROM ai_messages
       WHERE conversation_id = $1
       ORDER BY created_at ASC`,
      [conversationId]
    );

    return {
      conversation: conversations[0],
      messages: messages.filter((m: MessageRow) => m.role !== 'function') // Não mostrar function calls no chat
    };
  }

  /**
   * Deleta uma conversa
   */
  static async deleteConversation(conversationId: number, userId: number): Promise<void> {
    await AppDataSource.query(
      `DELETE FROM ai_conversations WHERE id = $1 AND user_id = $2`,
      [conversationId, userId]
    );
  }
}
