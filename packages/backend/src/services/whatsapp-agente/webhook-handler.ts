/**
 * Webhook handler - recebe eventos da Evolution API e processa
 * mensagens que devem ser respondidas pelo agente IA.
 */
import { AppDataSource } from '../../config/database';
import { WhatsAppService } from '../whatsapp.service';
import { loadAgenteConfig, runAgent } from './agent-runner';

interface EvolutionWebhookPayload {
  event?: string;
  data?: {
    key?: { remoteJid?: string; fromMe?: boolean; id?: string; participant?: string };
    message?: any;
    pushName?: string;
    messageTimestamp?: number;
  };
}

/**
 * Extrai texto plano da mensagem da Evolution.
 * Evolution manda varios formatos dependendo do tipo (texto, audio, etc).
 */
function extrairTexto(message: any): string {
  if (!message) return '';
  return (
    message.conversation ||
    message.extendedTextMessage?.text ||
    message.imageMessage?.caption ||
    message.videoMessage?.caption ||
    ''
  ).trim();
}

function dentroDoHorario(config: any): boolean {
  const now = new Date();
  const br = new Date(now.toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }));
  const horaAtual = br.getHours() * 60 + br.getMinutes();
  const [hi, mi] = String(config.horario_inicio || '00:00').split(':').map(Number);
  const [hf, mf] = String(config.horario_fim || '23:59').split(':').map(Number);
  const hMin = hi * 60 + mi;
  const hMax = hf * 60 + mf;
  const dias = ['dom','seg','ter','qua','qui','sex','sab'];
  const diaHoje = dias[br.getDay()];
  if (config.dias_semana?.length && !config.dias_semana.includes(diaHoje)) return false;
  return horaAtual >= hMin && horaAtual <= hMax;
}

export async function processarWebhook(payload: EvolutionWebhookPayload): Promise<void> {
  try {
    if (payload.event !== 'messages.upsert') return;
    const data = payload.data;
    if (!data?.key) return;
    if (data.key.fromMe) return; // ignora mensagens do proprio bot

    const remoteJid = data.key.remoteJid || '';
    const isGroup = remoteJid.endsWith('@g.us');
    const texto = extrairTexto(data.message);
    if (!texto) return;

    const config = await loadAgenteConfig();
    if (!config || !config.ativo) return;

    // Filtro de grupo - so responde no grupo configurado
    if (config.group_id && remoteJid !== config.group_id) return;

    // Filtro de whitelist (se configurada)
    const fromNumber = isGroup ? (data.key.participant || '') : remoteJid;
    if (config.whitelist_numeros?.length) {
      const numeroLimpo = fromNumber.replace(/[^0-9]/g, '');
      const naWhitelist = config.whitelist_numeros.some((w: string) => w.replace(/[^0-9]/g, '') === numeroLimpo);
      if (!naWhitelist) {
        await logIgnorada(fromNumber, data.pushName, remoteJid, texto, 'fora_whitelist');
        return;
      }
    }

    // Filtro de prefixo - so responde quando chamado
    const prefixo = (config.prefixo || '@radar').toLowerCase();
    const txtLower = texto.toLowerCase().trim();
    const mencaoComEspaco = txtLower.startsWith(prefixo + ' ');
    const mencaoSemEspaco = txtLower === prefixo;
    const slash = prefixo.startsWith('/') && txtLower.startsWith(prefixo);
    if (!mencaoComEspaco && !mencaoSemEspaco && !slash) return;
    let perguntaLimpa = texto.replace(new RegExp('^' + escapeRegex(prefixo), 'i'), '').trim();
    if (!perguntaLimpa) {
      await WhatsAppService.sendMessage(remoteJid, `Oi! Sou o ${config.nome_agente}. Pergunte algo tipo "${prefixo} venda hoje".`);
      return;
    }

    // Horario de funcionamento
    if (!dentroDoHorario(config)) {
      await WhatsAppService.sendMessage(remoteJid, config.mensagem_fora_horario || 'Fora do horário de atendimento');
      await logIgnorada(fromNumber, data.pushName, remoteJid, texto, 'fora_horario');
      return;
    }

    // Checa budget
    const mesAtual = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`;
    if (config.mes_referencia_gasto === mesAtual && config.budget_mensal_brl > 0) {
      const pctUsado = (config.gasto_mes_atual_brl / config.budget_mensal_brl) * 100;
      if (pctUsado >= (config.bloquear_em_pct || 100)) {
        await WhatsAppService.sendMessage(remoteJid, '⚠️ Orçamento mensal do agente atingido. Aguarde o próximo mês ou ajuste o limite.');
        return;
      }
    }

    // Log inicial (sem resposta ainda)
    const logId = await criarLog(fromNumber, data.pushName, remoteJid, texto);

    // Executa o agente
    const result = await runAgent(config, perguntaLimpa, {
      fromNumber,
      fromName: data.pushName,
      groupId: isGroup ? remoteJid : undefined,
      esconderCusto: config.esconder_custo,
    });

    // Envia resposta
    await WhatsAppService.sendMessage(remoteJid, result.resposta);

    // Atualiza log + atualiza gasto acumulado
    await atualizarLog(logId, result);
    await atualizarGastoMes(result.custoBRL, mesAtual);

    // Alerta de budget se passou de X%
    if (config.budget_mensal_brl > 0) {
      const novoGasto = (config.mes_referencia_gasto === mesAtual ? config.gasto_mes_atual_brl : 0) + result.custoBRL;
      const novoPct = (novoGasto / config.budget_mensal_brl) * 100;
      if (novoPct >= (config.alertar_em_pct || 80) && (novoGasto - result.custoBRL) / config.budget_mensal_brl * 100 < (config.alertar_em_pct || 80)) {
        // acabou de cruzar o limite de alerta
        await WhatsAppService.sendMessage(remoteJid, `⚠️ Orçamento do mês atingiu ${novoPct.toFixed(0)}% (R$ ${novoGasto.toFixed(2)} de R$ ${config.budget_mensal_brl.toFixed(2)})`);
      }
    }
  } catch (e: any) {
    console.error('[WhatsappAgente] processarWebhook erro:', e?.message || e);
  }
}

function escapeRegex(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

async function criarLog(from: string, fromName: string | undefined, groupId: string, msg: string): Promise<number> {
  const [r] = await AppDataSource.query(
    `INSERT INTO whatsapp_agente_logs (from_number, from_name, group_id, mensagem_recebida)
     VALUES ($1, $2, $3, $4) RETURNING id`,
    [from, fromName || null, groupId, msg]
  );
  return r.id;
}

async function logIgnorada(from: string, fromName: string | undefined, groupId: string, msg: string, motivo: string): Promise<void> {
  await AppDataSource.query(
    `INSERT INTO whatsapp_agente_logs (from_number, from_name, group_id, mensagem_recebida, ignorada, motivo_ignorada)
     VALUES ($1, $2, $3, $4, true, $5)`,
    [from, fromName || null, groupId, msg, motivo]
  );
}

async function atualizarLog(logId: number, result: any): Promise<void> {
  const toolNome = result.toolsUsadas?.[0]?.nome || null;
  const toolParams = result.toolsUsadas?.[0]?.params || null;
  await AppDataSource.query(
    `UPDATE whatsapp_agente_logs
     SET timestamp_respondido = NOW(),
         resposta_enviada = $2,
         tool_name = $3,
         tool_params = $4,
         tokens_input = $5,
         tokens_output = $6,
         custo_estimado_brl = $7,
         modelo = $8,
         sucesso = $9,
         erro = $10
     WHERE id = $1`,
    [
      logId,
      result.resposta?.slice(0, 5000),
      toolNome,
      toolParams ? JSON.stringify(toolParams) : null,
      result.tokensInput,
      result.tokensOutput,
      result.custoBRL,
      result.modelo,
      !result.erro,
      result.erro || null,
    ]
  );
}

async function atualizarGastoMes(custoBRL: number, mesRef: string): Promise<void> {
  await AppDataSource.query(
    `UPDATE whatsapp_agente_config
     SET gasto_mes_atual_brl = CASE
       WHEN mes_referencia_gasto = $2 THEN gasto_mes_atual_brl + $1
       ELSE $1
     END,
     mes_referencia_gasto = $2,
     updated_at = NOW()`,
    [custoBRL, mesRef]
  );
}
