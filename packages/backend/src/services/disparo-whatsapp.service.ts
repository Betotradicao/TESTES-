import { AppDataSource } from '../config/database';
import { DisparoContato } from '../entities/DisparoContato';
import { DisparoCampanha } from '../entities/DisparoCampanha';
import { DisparoMensagem } from '../entities/DisparoMensagem';
import { ConfigurationService } from './configuration.service';

// Controle de campanhas em execução (pause/cancel signals)
const runningCampaigns = new Map<string, { paused: boolean; cancelled: boolean }>();

export class DisparoWhatsAppService {

  // ========== EVOLUTION API ==========

  private static async getConfig(): Promise<{ apiUrl: string; apiToken: string; instance: string }> {
    const apiUrl = await ConfigurationService.get('disparo_whats_url') || await ConfigurationService.get('evolution_api_url', '');
    const apiToken = await ConfigurationService.get('disparo_whats_token') || await ConfigurationService.get('evolution_api_token', '');
    const instance = await ConfigurationService.get('disparo_whats_instancia') || await ConfigurationService.get('evolution_instance', '');

    if (!apiUrl || !apiToken || !instance) {
      throw new Error('Configurações de disparo WhatsApp não encontradas');
    }
    return { apiUrl, apiToken, instance };
  }

  private static async sendText(telefone: string, texto: string): Promise<{ success: boolean; msgId?: string; error?: string }> {
    try {
      const { apiUrl, apiToken, instance } = await this.getConfig();
      const url = `${apiUrl}/message/sendText/${encodeURIComponent(instance)}`;

      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'apikey': apiToken },
        body: JSON.stringify({ number: telefone, text: texto })
      });

      if (!response.ok) {
        const errText = await response.text();
        return { success: false, error: `HTTP ${response.status}: ${errText}` };
      }

      const result: any = await response.json();
      const msgId = result?.key?.id || result?.messageId || null;
      return { success: true, msgId };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  }

  private static async sendMedia(telefone: string, texto: string, imageBase64: string): Promise<{ success: boolean; msgId?: string; error?: string }> {
    try {
      const { apiUrl, apiToken, instance } = await this.getConfig();
      const url = `${apiUrl}/message/sendMedia/${encodeURIComponent(instance)}`;

      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'apikey': apiToken },
        body: JSON.stringify({
          number: telefone,
          mediatype: 'image',
          media: imageBase64,
          caption: texto,
          fileName: 'oferta.jpg'
        })
      });

      if (!response.ok) {
        const errText = await response.text();
        return { success: false, error: `HTTP ${response.status}: ${errText}` };
      }

      const result: any = await response.json();
      const msgId = result?.key?.id || result?.messageId || null;
      return { success: true, msgId };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  }

  // ========== CAMPANHA DISPATCH ==========

  static async startCampaign(campanhaId: string): Promise<void> {
    const campanhaRepo = AppDataSource.getRepository(DisparoCampanha);
    const contatoRepo = AppDataSource.getRepository(DisparoContato);
    const msgRepo = AppDataSource.getRepository(DisparoMensagem);

    const campanha = await campanhaRepo.findOne({ where: { id: campanhaId } });
    if (!campanha) throw new Error('Campanha não encontrada');
    if (campanha.status === 'running') throw new Error('Campanha já está em execução');

    // Buscar contatos ativos da lista (ou todos se não tiver lista)
    const where: any = { status: 'active' };
    if (campanha.lista_id) where.lista_id = campanha.lista_id;
    const contatosAtivos = await contatoRepo.find({ where });
    const jaEnviados = await msgRepo.find({ where: { campanha_id: campanhaId }, select: ['contato_id'] });
    const jaEnviadosIds = new Set(jaEnviados.map(m => m.contato_id));
    const contatos = contatosAtivos.filter(c => !jaEnviadosIds.has(c.id));

    // Atualizar campanha
    campanha.status = 'running';
    campanha.total_contatos = contatosAtivos.length;
    campanha.started_at = campanha.started_at || new Date();
    await campanhaRepo.save(campanha);

    // Registrar sinal de controle
    runningCampaigns.set(campanhaId, { paused: false, cancelled: false });

    console.log(`📤 Iniciando disparo "${campanha.nome}" para ${contatos.length} contatos...`);

    let failCount = 0;
    const failWindow: boolean[] = [];

    for (let i = 0; i < contatos.length; i++) {
      const signal = runningCampaigns.get(campanhaId);
      if (!signal || signal.cancelled) {
        campanha.status = 'cancelled';
        await campanhaRepo.save(campanha);
        console.log(`🚫 Campanha "${campanha.nome}" cancelada`);
        break;
      }

      // Pausa
      while (signal.paused) {
        await new Promise(r => setTimeout(r, 2000));
        const check = runningCampaigns.get(campanhaId);
        if (!check || check.cancelled) break;
      }

      // Check daily limit
      const todayCount = await this.getTodaySentCount();
      if (todayCount >= campanha.daily_limit) {
        console.log(`⚠️ Limite diário de ${campanha.daily_limit} atingido. Pausando campanha.`);
        campanha.status = 'paused';
        await campanhaRepo.save(campanha);
        break;
      }

      const contato = contatos[i];
      const telefone = contato.telefone.replace(/\D/g, '');

      // Enviar mensagem(ns)
      let result;
      const imagens = campanha.imagens_base64 || (campanha.imagem_base64 ? [campanha.imagem_base64] : []);

      if (imagens.length > 0) {
        // Primeira imagem com o texto como caption
        result = await this.sendMedia(telefone, campanha.mensagem_texto || '', imagens[0]);
        // Imagens adicionais sem caption
        for (let j = 1; j < imagens.length && result.success; j++) {
          await new Promise(r => setTimeout(r, 1500)); // delay entre imagens
          result = await this.sendMedia(telefone, '', imagens[j]);
        }
      } else {
        result = await this.sendText(telefone, campanha.mensagem_texto || '');
      }

      // Criar log
      const msg = new DisparoMensagem();
      msg.campanha_id = campanhaId;
      msg.contato_id = contato.id;
      msg.telefone = contato.telefone;
      msg.nome_contato = contato.nome;

      if (result.success) {
        msg.status = 'sent';
        msg.evolution_msg_id = result.msgId || null;
        msg.sent_at = new Date();
        campanha.enviados++;
        contato.total_enviados++;
        failWindow.push(true);
      } else {
        msg.status = 'failed';
        msg.error_message = result.error || 'Erro desconhecido';
        campanha.falharam++;
        contato.total_falhas++;
        failCount++;
        failWindow.push(false);
      }

      await msgRepo.save(msg);
      await contatoRepo.save(contato);

      // Atualizar campanha a cada 10 mensagens
      if (i % 10 === 0) {
        await campanhaRepo.save(campanha);
      }

      // Safety check: taxa de falha nos últimos 50
      if (failWindow.length > 50) failWindow.shift();
      if (failWindow.length >= 20) {
        const recentFails = failWindow.filter(x => !x).length;
        const failRate = recentFails / failWindow.length;
        if (failRate > 0.2) {
          console.log(`🛑 Taxa de falha ${(failRate * 100).toFixed(0)}% > 20%. Auto-pausando campanha.`);
          campanha.status = 'paused';
          await campanhaRepo.save(campanha);
          break;
        }
      }

      // Delay aleatório entre mensagens
      if (i < contatos.length - 1) {
        const delay = Math.floor(Math.random() * (campanha.delay_max_ms - campanha.delay_min_ms + 1)) + campanha.delay_min_ms;
        await new Promise(r => setTimeout(r, delay));
      }

      if ((i + 1) % 100 === 0) {
        console.log(`📤 Progresso: ${i + 1}/${contatos.length} (${campanha.enviados} ok, ${campanha.falharam} falhas)`);
      }
    }

    // Finalizar
    if (campanha.status === 'running') {
      campanha.status = 'completed';
      campanha.completed_at = new Date();
    }
    await campanhaRepo.save(campanha);
    runningCampaigns.delete(campanhaId);
    console.log(`✅ Campanha "${campanha.nome}" finalizada: ${campanha.enviados} enviados, ${campanha.falharam} falhas`);
  }

  static pauseCampaign(campanhaId: string) {
    const signal = runningCampaigns.get(campanhaId);
    if (signal) signal.paused = true;
  }

  static async resumeCampaign(campanhaId: string) {
    const signal = runningCampaigns.get(campanhaId);
    if (signal) {
      signal.paused = false;
    } else {
      // Re-start from where it left off
      this.startCampaign(campanhaId).catch(err => console.error('Erro ao retomar campanha:', err));
    }

    const repo = AppDataSource.getRepository(DisparoCampanha);
    await repo.update(campanhaId, { status: 'running' });
  }

  static async cancelCampaign(campanhaId: string) {
    const signal = runningCampaigns.get(campanhaId);
    if (signal) signal.cancelled = true;

    const repo = AppDataSource.getRepository(DisparoCampanha);
    await repo.update(campanhaId, { status: 'cancelled' });
  }

  static getCampaignRunning(campanhaId: string): boolean {
    return runningCampaigns.has(campanhaId);
  }

  // ========== WEBHOOK ==========

  static async handleWebhook(data: any): Promise<void> {
    try {
      // Evolution API webhook payload
      const event = data.event;
      const msgData = data.data;

      if (!msgData?.key?.id) return;

      const evolutionMsgId = msgData.key.id;
      const msgRepo = AppDataSource.getRepository(DisparoMensagem);
      const contatoRepo = AppDataSource.getRepository(DisparoContato);
      const campanhaRepo = AppDataSource.getRepository(DisparoCampanha);

      const msg = await msgRepo.findOne({ where: { evolution_msg_id: evolutionMsgId } });
      if (!msg) return;

      const now = new Date();

      if (event === 'messages.update' || event === 'message-receipt.update') {
        const status = msgData.status || msgData.receipt?.status;

        if (status === 'DELIVERY_ACK' || status === 'delivered' || status === 3) {
          if (msg.status !== 'read') {
            msg.status = 'delivered';
            msg.delivered_at = now;
            await msgRepo.save(msg);

            // Atualizar contato
            await contatoRepo.increment({ id: msg.contato_id }, 'total_entregues', 1);
            await contatoRepo.update(msg.contato_id, { last_interaction_at: now });

            // Atualizar campanha
            await campanhaRepo.increment({ id: msg.campanha_id }, 'entregues', 1);
          }
        }

        if (status === 'READ' || status === 'read' || status === 4) {
          msg.status = 'read';
          msg.read_at = now;
          if (!msg.delivered_at) msg.delivered_at = now;
          await msgRepo.save(msg);

          // Atualizar contato
          await contatoRepo.increment({ id: msg.contato_id }, 'total_lidos', 1);
          await contatoRepo.update(msg.contato_id, {
            last_interaction_at: now,
            score: () => 'LEAST(score + 5, 100)'
          });

          // Atualizar campanha
          await campanhaRepo.increment({ id: msg.campanha_id }, 'lidos', 1);
        }
      }
    } catch (err) {
      console.error('Erro no webhook de disparo:', err);
    }
  }

  // ========== SCORING / LIMPEZA ==========

  static async updateContactScores(): Promise<void> {
    const repo = AppDataSource.getRepository(DisparoContato);

    // Contatos que leram nos últimos 7 dias: score +10 (max 100)
    await repo.createQueryBuilder()
      .update()
      .set({ score: () => 'LEAST(score + 10, 100)' })
      .where('last_interaction_at > NOW() - INTERVAL \'7 days\'')
      .andWhere('status = :s', { s: 'active' })
      .execute();

    // Contatos sem interação há 14 dias: score -10 (min 0)
    await repo.createQueryBuilder()
      .update()
      .set({ score: () => 'GREATEST(score - 10, 0)' })
      .where('(last_interaction_at < NOW() - INTERVAL \'14 days\' OR last_interaction_at IS NULL)')
      .andWhere('status = :s', { s: 'active' })
      .execute();

    // Contatos sem interação há 30 dias: marcar inativo
    await repo.createQueryBuilder()
      .update()
      .set({ status: 'inactive', inactivated_at: new Date(), score: 0 })
      .where('(last_interaction_at < NOW() - INTERVAL \'30 days\' OR last_interaction_at IS NULL)')
      .andWhere('status = :s', { s: 'active' })
      .andWhere('total_enviados > 3')
      .execute();

    // Contatos com mais de 5 falhas consecutivas: marcar inválido
    await repo.createQueryBuilder()
      .update()
      .set({ status: 'invalid' })
      .where('total_falhas > 5 AND total_entregues = 0')
      .andWhere('status = :s', { s: 'active' })
      .execute();

    console.log('📊 Scores de contatos atualizados');
  }

  // ========== SYNC DO WHATSAPP ==========

  static async syncFromWhatsApp(): Promise<{ total: number; imported: number; duplicates: number }> {
    const { apiUrl, apiToken, instance } = await this.getConfig();
    const repo = AppDataSource.getRepository(DisparoContato);

    // Buscar todos os contatos da instância via Evolution API
    let contacts: any[] = [];

    // Endpoint 1: /chat/findContacts
    try {
      const resp = await fetch(`${apiUrl}/chat/findContacts/${encodeURIComponent(instance)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'apikey': apiToken },
        body: JSON.stringify({ where: {} })
      });
      if (resp.ok) {
        const data: any = await resp.json();
        contacts = Array.isArray(data) ? data : (data?.contacts || data?.records || []);
      }
    } catch (e) { /* fallback */ }

    // Se não trouxe, tenta endpoint alternativo
    if (contacts.length === 0) {
      try {
        const resp = await fetch(`${apiUrl}/chat/findChats/${encodeURIComponent(instance)}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'apikey': apiToken },
          body: JSON.stringify({})
        });
        if (resp.ok) {
          const data: any = await resp.json();
          contacts = Array.isArray(data) ? data : (data?.chats || data?.records || []);
        }
      } catch (e) { /* ignore */ }
    }

    console.log(`📱 WhatsApp retornou ${contacts.length} contatos/chats`);
    // Contar tipos
    let countWhatsapp = 0, countLid = 0, countGroup = 0, countOther = 0;
    for (const c of contacts) {
      const jid = c.remoteJid || c.id || c.jid || '';
      if (jid.includes('@s.whatsapp.net')) countWhatsapp++;
      else if (jid.includes('@lid')) countLid++;
      else if (jid.includes('@g.us')) countGroup++;
      else countOther++;
    }
    console.log(`📱 Tipos: ${countWhatsapp} números, ${countLid} LID (ocultos), ${countGroup} grupos, ${countOther} outros`);

    let imported = 0;
    let duplicates = 0;

    for (const c of contacts) {
      // Usar remoteJid como fonte principal do número
      const rawJid = c.remoteJid || c.jid || '';

      // Ignorar grupos, LID, status, broadcasts
      if (!rawJid || rawJid.includes('@g.us') || rawJid.includes('@broadcast') || rawJid.includes('@lid')) continue;

      // Extrair telefone do JID
      let phone = rawJid.replace('@s.whatsapp.net', '').replace('@c.us', '').replace(/\D/g, '');

      if (!phone || phone.length < 10) continue;

      const nome = c.pushName || c.name || c.notify || c.contactName || c.verifiedName || null;

      try {
        const existing = await repo.findOne({ where: { telefone: phone } });
        if (existing) {
          if (nome && !existing.nome) {
            existing.nome = nome;
            await repo.save(existing);
          }
          duplicates++;
          continue;
        }

        const contato = new DisparoContato();
        contato.telefone = phone;
        contato.nome = nome;
        await repo.save(contato);
        imported++;
      } catch (e) {
        // Duplicate key - skip
        duplicates++;
      }
    }

    return { total: contacts.length, imported, duplicates };
  }

  // ========== CONTATOS ==========

  static async importContacts(contacts: Array<{ telefone: string; nome?: string; tags?: string }>): Promise<{ imported: number; duplicates: number }> {
    const repo = AppDataSource.getRepository(DisparoContato);
    let imported = 0;
    let duplicates = 0;

    for (const c of contacts) {
      const telefone = c.telefone.replace(/\D/g, '');
      if (!telefone || telefone.length < 10) continue;

      const existing = await repo.findOne({ where: { telefone } });
      if (existing) {
        if (c.nome && !existing.nome) {
          existing.nome = c.nome;
          await repo.save(existing);
        }
        duplicates++;
        continue;
      }

      const contato = new DisparoContato();
      contato.telefone = telefone;
      contato.nome = c.nome || null;
      contato.tags = c.tags || null;
      await repo.save(contato);
      imported++;
    }

    return { imported, duplicates };
  }

  static async getStats(): Promise<any> {
    const contatoRepo = AppDataSource.getRepository(DisparoContato);
    const campanhaRepo = AppDataSource.getRepository(DisparoCampanha);
    const msgRepo = AppDataSource.getRepository(DisparoMensagem);

    const totalContatos = await contatoRepo.count();
    const ativos = await contatoRepo.count({ where: { status: 'active' } });
    const inativos = await contatoRepo.count({ where: { status: 'inactive' } });
    const invalidos = await contatoRepo.count({ where: { status: 'invalid' } });

    const totalCampanhas = await campanhaRepo.count();
    const campanhasAtivas = await campanhaRepo.count({ where: { status: 'running' } });

    const totalMsgs = await msgRepo.count();
    const enviadas = await msgRepo.count({ where: { status: 'sent' } });
    const entregues = await msgRepo.count({ where: { status: 'delivered' } });
    const lidas = await msgRepo.count({ where: { status: 'read' } });
    const falharam = await msgRepo.count({ where: { status: 'failed' } });

    const taxaEntrega = (enviadas + entregues + lidas) > 0
      ? ((entregues + lidas) / (enviadas + entregues + lidas) * 100).toFixed(1)
      : '0';
    const taxaLeitura = (entregues + lidas) > 0
      ? (lidas / (entregues + lidas) * 100).toFixed(1)
      : '0';

    return {
      contatos: { total: totalContatos, ativos, inativos, invalidos },
      campanhas: { total: totalCampanhas, ativas: campanhasAtivas },
      mensagens: { total: totalMsgs, enviadas, entregues, lidas, falharam },
      taxaEntrega: parseFloat(taxaEntrega as string),
      taxaLeitura: parseFloat(taxaLeitura as string),
      limiteHoje: 3500 - await this.getTodaySentCount()
    };
  }

  private static async getTodaySentCount(): Promise<number> {
    const result = await AppDataSource.getRepository(DisparoMensagem)
      .createQueryBuilder('m')
      .where('m.sent_at >= CURRENT_DATE')
      .andWhere('m.status != :s', { s: 'failed' })
      .getCount();
    return result;
  }
}
