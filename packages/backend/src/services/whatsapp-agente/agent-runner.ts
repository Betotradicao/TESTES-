/**
 * Agent Runner - orquestrador do chat com GPT.
 * Recebe pergunta + config, chama OpenAI com function calling,
 * executa as tools que o GPT solicitar, e retorna resposta final.
 */
import axios from 'axios';
import { AppDataSource } from '../../config/database';
import { ConfigurationService } from '../configuration.service';
import { getTool, getEnabledToolsForOpenAI } from './tools-registry';
import type { AgenteConfig, ToolContext } from './types';

// Custos aproximados em USD por 1M tokens (input/output) - 2025
const PRECOS: Record<string, { in: number; out: number }> = {
  'gpt-4o-mini':  { in: 0.15, out: 0.60 },
  'gpt-4o':       { in: 2.50, out: 10.00 },
  'gpt-4.1-mini': { in: 0.40, out: 1.60 },
  'gpt-4.1':      { in: 2.00, out: 8.00 },
  'gpt-5-mini':   { in: 0.25, out: 2.00 },
  'gpt-5':        { in: 1.25, out: 10.00 },
  'gpt-5.2':      { in: 2.00, out: 8.00 },
};
const USD_BRL = 5.5; // aproximado, atualizar quando precisar

function calcularCustoBRL(modelo: string, inTokens: number, outTokens: number): number {
  const p = PRECOS[modelo] || PRECOS['gpt-4o-mini'];
  const usd = (inTokens / 1_000_000) * p.in + (outTokens / 1_000_000) * p.out;
  return usd * USD_BRL;
}

export interface AgentRunResult {
  resposta: string;
  toolsUsadas: Array<{ nome: string; params: any; resultado: any }>;
  tokensInput: number;
  tokensOutput: number;
  custoBRL: number;
  modelo: string;
  erro?: string;
}

export async function runAgent(
  config: AgenteConfig,
  mensagem: string,
  ctx: ToolContext
): Promise<AgentRunResult> {
  const apiKey = await ConfigurationService.get('openai_api_key');
  if (!apiKey) {
    return { resposta: '❌ OpenAI API Key não configurada', toolsUsadas: [], tokensInput: 0, tokensOutput: 0, custoBRL: 0, modelo: config.modelo_ia, erro: 'sem_api_key' };
  }

  const tools = getEnabledToolsForOpenAI(config.tools_habilitadas || {});
  const tomTxt = ({
    profissional: 'profissional e direto',
    descontraido: 'descontraido e proximo',
    formal: 'formal e tecnico',
  } as any)[config.tom_comunicacao] || 'profissional e direto';

  // Data/hora atual em Sao Paulo - importante pro agente calcular "ontem", "semana passada", etc
  const agora = new Date();
  const brNow = new Date(agora.toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }));
  const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const hojeStr = ymd(brNow);
  const ontemDate = new Date(brNow); ontemDate.setDate(brNow.getDate() - 1);
  const ontemStr = ymd(ontemDate);
  const diasSemana = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];
  const meses = ['janeiro','fevereiro','março','abril','maio','junho','julho','agosto','setembro','outubro','novembro','dezembro'];
  const dataExtenso = `${diasSemana[brNow.getDay()]}, ${brNow.getDate()} de ${meses[brNow.getMonth()]} de ${brNow.getFullYear()}`;

  const systemPrompt = `Você é ${config.nome_agente}, ${config.persona_descricao || 'assistente de gestão do supermercado'}

📅 DATA DE HOJE: ${dataExtenso} (${hojeStr})
📅 ONTEM foi: ${ontemStr}
⏰ Hora atual (Brasil): ${brNow.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}

Tom: ${tomTxt}. Sempre responda em pt-BR.
Você está respondendo em um grupo de WhatsApp. Mantenha respostas CONCISAS e formatadas com:
- Emojis e *negrito* (asteriscos)
- Listas curtas com quebra de linha
- Quando chamar tool, use o resultado dela como base — não invente dados
- Não cite o nome da tool ao usuario. Apenas use o resultado.
- Quando o usuario perguntar sobre "ontem", "semana passada", "dia X", CALCULE a data exata e passe via parametro \`data\` (YYYY-MM-DD) na tool venda_hoje.

${config.instrucoes_extras || ''}

Contexto: quem perguntou é ${ctx.fromName || ctx.fromNumber}.`;

  const messages: any[] = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: mensagem },
  ];

  const toolsUsadas: AgentRunResult['toolsUsadas'] = [];
  let totalIn = 0, totalOut = 0;
  const isGpt5 = /^gpt-5/i.test(config.modelo_ia);
  const tokenField = isGpt5 ? 'max_completion_tokens' : 'max_tokens';
  const maxTokens = isGpt5 ? Math.max(config.max_tokens_resposta, 2000) : config.max_tokens_resposta;

  // Loop de tool calling - max 5 iteracoes pra evitar runaway
  for (let iter = 0; iter < 5; iter++) {
    const payload: any = {
      model: config.modelo_ia,
      messages,
      [tokenField]: maxTokens,
    };
    if (!isGpt5) payload.temperature = Number(config.temperatura);
    if (tools.length) {
      payload.tools = tools;
      payload.tool_choice = 'auto';
    }

    let r;
    try {
      r = await axios.post('https://api.openai.com/v1/chat/completions', payload, {
        headers: { Authorization: `Bearer ${apiKey}` },
        timeout: 60000,
      });
    } catch (e: any) {
      const err = e.response?.data?.error?.message || e.message;
      return { resposta: `❌ Erro OpenAI: ${err.slice(0, 200)}`, toolsUsadas, tokensInput: totalIn, tokensOutput: totalOut, custoBRL: calcularCustoBRL(config.modelo_ia, totalIn, totalOut), modelo: config.modelo_ia, erro: err };
    }

    totalIn += r.data.usage?.prompt_tokens || 0;
    totalOut += r.data.usage?.completion_tokens || 0;

    const msg = r.data.choices?.[0]?.message;
    if (!msg) break;

    // Adiciona resposta do assistente (com possíveis tool_calls)
    messages.push(msg);

    const toolCalls = msg.tool_calls || [];
    if (!toolCalls.length) {
      // Resposta final - sem mais tools
      return {
        resposta: msg.content || '(sem resposta)',
        toolsUsadas,
        tokensInput: totalIn,
        tokensOutput: totalOut,
        custoBRL: calcularCustoBRL(config.modelo_ia, totalIn, totalOut),
        modelo: config.modelo_ia,
      };
    }

    // Executar cada tool chamada
    for (const tc of toolCalls) {
      const toolName = tc.function?.name;
      let toolArgs: any = {};
      try { toolArgs = JSON.parse(tc.function?.arguments || '{}'); } catch { /* ignora */ }

      const tool = getTool(toolName);
      let resultado: any;
      if (!tool) {
        resultado = { erro: `Tool "${toolName}" desconhecida` };
      } else {
        try {
          resultado = await tool.execute(toolArgs, ctx);
        } catch (e: any) {
          resultado = { erro: e.message };
        }
      }
      toolsUsadas.push({ nome: toolName, params: toolArgs, resultado });

      messages.push({
        role: 'tool',
        tool_call_id: tc.id,
        content: JSON.stringify(resultado).slice(0, 8000),
      });
    }
  }

  return {
    resposta: '⚠️ Excesso de iterações no agente. Tente reformular a pergunta.',
    toolsUsadas,
    tokensInput: totalIn,
    tokensOutput: totalOut,
    custoBRL: calcularCustoBRL(config.modelo_ia, totalIn, totalOut),
    modelo: config.modelo_ia,
    erro: 'max_iter',
  };
}

export async function loadAgenteConfig(): Promise<AgenteConfig | null> {
  const [row] = await AppDataSource.query(`SELECT * FROM whatsapp_agente_config ORDER BY id ASC LIMIT 1`);
  return row || null;
}
