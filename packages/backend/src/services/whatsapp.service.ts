import { Bip } from '../entities/Bip';
import { ConfigurationService } from './configuration.service';
import { BipPDFService } from './bip-pdf.service';
import * as fs from 'fs';

export class WhatsAppService {
  private static async validateEnvironment(): Promise<{ apiToken: string; apiUrl: string; instance: string }> {
    // Busca configurações do banco de dados (fallback para .env)
    const apiToken = await ConfigurationService.get('evolution_api_token', process.env.EVOLUTION_API_TOKEN || '') || '';
    const apiUrl = await ConfigurationService.get('evolution_api_url', process.env.EVOLUTION_API_URL || '') || '';
    const instance = await ConfigurationService.get('evolution_instance', process.env.EVOLUTION_INSTANCE || '') || '';

    const missingConfigs: string[] = [];
    if (!apiToken) missingConfigs.push('evolution_api_token');
    if (!apiUrl) missingConfigs.push('evolution_api_url');
    if (!instance) missingConfigs.push('evolution_instance');

    if (missingConfigs.length > 0) {
      throw new Error(`Configurações Evolution API não encontradas: ${missingConfigs.join(', ')}`);
    }

    return { apiToken, apiUrl, instance };
  }

  /**
   * Envia mensagem via Evolution API
   */
  static async sendMessage(phoneNumber: string, message: string): Promise<boolean> {
    try {
      const { apiToken, apiUrl, instance } = await this.validateEnvironment();

      const url = `${apiUrl}/message/sendText/${encodeURIComponent(instance)}`;

      const payload = {
        number: phoneNumber,
        text: message
      };

      console.log(`📱 Enviando mensagem para ${phoneNumber}...`);

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': apiToken
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Evolution API Error: ${response.status} - ${errorText}`);
      }

      const result = await response.json();
      console.log(`✅ Mensagem enviada com sucesso:`, result);

      return true;
    } catch (error) {
      console.error(`❌ Erro ao enviar mensagem WhatsApp:`, error);
      return false;
    }
  }

  /**
   * Gera mensagem formatada baseada no template fornecido
   */
  static generateBipMessage(bip: Bip): string {
    // Format date/time in Brazilian format
    const eventDate = new Date(bip.event_date);
    const formattedDate = eventDate.toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    });

    // Format weight with comma (Brazilian format)
    const formattedWeight = bip.bip_weight
      ? Number(bip.bip_weight).toFixed(3).replace('.', ',')
      : '0,000';

    // Format price with comma (Brazilian format)
    const formattedPrice = (bip.bip_price_cents / 100).toFixed(2).replace('.', ',');

    const message = `❌ Não Encontrado

📅 Data/Hora: ${formattedDate}

📦 Produto: ${bip.product_description || 'N/A'}
🏷️ Código (PLU): ${bip.product_id}
🔢 EAN: ${bip.ean}

⚖️ Peso: ${formattedWeight} kg
💰Valor Total: R$ ${formattedPrice}`;

    return message;
  }

  /**
   * Envia notificação de bipagem não encontrada
   */
  static async sendBipNotification(bip: Bip): Promise<boolean> {
    try {
      // Busca group_id do banco de dados (fallback para .env)
      const groupId = await ConfigurationService.get('evolution_whatsapp_group_id', process.env.EVOLUTION_WHATSAPP_GROUP_ID || '');

      if (!groupId) {
        throw new Error('evolution_whatsapp_group_id não configurado');
      }

      const message = this.generateBipMessage(bip);
      const success = await this.sendMessage(groupId, message);

      if (success) {
        console.log(`📬 Notificação enviada para bipagem ${bip.id}`);
      } else {
        console.error(`❌ Falha ao enviar notificação para bipagem ${bip.id}`);
      }

      return success;
    } catch (error) {
      console.error(`❌ Erro ao processar notificação da bipagem ${bip.id}:`, error);
      return false;
    }
  }

  /**
   * Envia múltiplas notificações com delay entre elas
   */
  static async sendMultipleNotifications(bips: Bip[]): Promise<{ success: number; failed: number; successfulBips: Bip[] }> {
    console.log(`📢 Enviando ${bips.length} notificações...`);

    let success = 0;
    let failed = 0;
    const successfulBips: Bip[] = [];

    for (let i = 0; i < bips.length; i++) {
      const bip = bips[i];
      console.log(`📱 Processando notificação ${i + 1}/${bips.length} - Bipagem ${bip.id}`);

      const result = await this.sendBipNotification(bip);

      if (result) {
        success++;
        successfulBips.push(bip);
      } else {
        failed++;
        // If notification fails, stop processing this bip (as specified)
        console.log(`⚠️  Pulando processamento da bipagem ${bip.id} devido a falha na notificação`);
        continue;
      }

      // Add random delay between notifications (4-6 seconds)
      if (i < bips.length - 1) { // Don't delay after the last one
        const delay = Math.floor(Math.random() * (6000 - 4000 + 1)) + 4000;
        console.log(`⏳ Aguardando ${delay}ms antes da próxima notificação...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }

    console.log(`📊 Notificações concluídas: ${success} sucesso, ${failed} falhas`);
    return { success, failed, successfulBips };
  }

  /**
   * Envia PDF com bipagens pendentes para o grupo do WhatsApp
   */
  static async sendPendingBipsPDF(bips: Bip[], date: string): Promise<boolean> {
    try {
      console.log(`📄 Gerando PDF com ${bips.length} bipagens pendentes...`);

      // Buscar grupo do WhatsApp específico para Bipagens
      const groupId = await ConfigurationService.get('whatsapp_group_bipagens', null);

      if (!groupId || groupId.trim() === '') {
        console.error('❌ Grupo do WhatsApp para Bipagens não configurado');
        console.error('⚠️  Configure em: Configurações > Grupos WhatsApp > Prevenção Bipagens');
        throw new Error('Grupo do WhatsApp para Bipagens não configurado (whatsapp_group_bipagens)');
      }

      console.log(`✅ Usando grupo configurado para Bipagens: ${groupId}`);

      // Recarregar bipagens com relação employee para o PDF
      const { AppDataSource } = require('../config/database');
      const bipRepository = AppDataSource.getRepository(Bip);
      const bipIds = bips.map(b => b.id);

      const bipsWithEmployee = await bipRepository
        .createQueryBuilder('bip')
        .leftJoinAndSelect('bip.employee', 'employee')
        .where('bip.id IN (:...ids)', { ids: bipIds })
        .getMany();

      // Gerar PDF
      const pdfPath = await BipPDFService.savePendingBipsPDF(bipsWithEmployee, date);
      console.log(`✅ PDF gerado: ${pdfPath}`);

      // Enviar PDF para o grupo
      const caption = `🚨 *BIPAGENS PENDENTES - ${date}*\n\n📦 Total de produtos bipados sem venda: *${bips.length}*\n\n⚠️ Produtos que foram bipados no dia ${date} mas não tiveram venda registrada.`;

      const success = await this.sendDocument(groupId, pdfPath, caption);

      // Limpar arquivo temporário
      if (fs.existsSync(pdfPath)) {
        fs.unlinkSync(pdfPath);
        console.log(`🗑️  Arquivo temporário removido: ${pdfPath}`);
      }

      return success;
    } catch (error) {
      console.error('❌ Erro ao enviar PDF de bipagens pendentes:', error);
      return false;
    }
  }

  /**
   * Envia documento PDF via WhatsApp
   */
  static async sendDocument(
    groupId: string,
    filePath: string,
    caption?: string
  ): Promise<boolean> {
    try {
      const { apiToken, apiUrl, instance } = await this.validateEnvironment();

      // Ler arquivo como base64
      const fs = require('fs');
      const fileBuffer = fs.readFileSync(filePath);
      const base64 = fileBuffer.toString('base64');
      const fileName = filePath.split(/[\\/]/).pop() || 'documento.pdf';

      const url = `${apiUrl}/message/sendMedia/${encodeURIComponent(instance)}`;

      const payload = {
        number: groupId,
        mediatype: 'document',
        media: base64,
        fileName: fileName,
        caption: caption || ''
      };

      console.log(`📄 Enviando PDF para ${groupId}...`);
      console.log(`📄 URL: ${url}`);
      console.log(`📄 Arquivo: ${fileName} (${Math.round(base64.length / 1024)}kb base64)`);

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': apiToken
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`❌ Evolution API Response Error:`, errorText);
        throw new Error(`Evolution API Error: ${response.status} - ${errorText}`);
      }

      const result = await response.json();
      console.log(`✅ PDF enviado com sucesso:`, result);

      return true;
    } catch (error) {
      console.error(`❌ Erro ao enviar PDF via WhatsApp:`, error);
      return false;
    }
  }

  /**
   * Busca todos os grupos do WhatsApp da instância configurada
   */
  static async fetchGroups(): Promise<any[]> {
    try {
      const { apiToken, apiUrl, instance } = await this.validateEnvironment();

      const url = `${apiUrl}/group/fetchAllGroups/${encodeURIComponent(instance)}?getParticipants=false`;

      console.log(`📱 Buscando grupos do WhatsApp da instância ${instance}...`);

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'apikey': apiToken
        }
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Evolution API Error: ${response.status} - ${errorText}`);
      }

      const result = await response.json() as any[];
      console.log(`✅ ${Array.isArray(result) ? result.length : 0} grupos encontrados`);

      return result;
    } catch (error) {
      console.error(`❌ Erro ao buscar grupos do WhatsApp:`, error);
      throw error;
    }
  }

  /**
   * Envia relatório de perdas/quebras para grupo do WhatsApp
   */
  static async sendLossesReport(
    filePath: string,
    nomeLote: string,
    totalItens: number,
    totalSaidas: number,
    totalEntradas: number,
    valorSaidas: number,
    valorEntradas: number,
    saidasPorMotivo?: Map<string, number>,
    entradasPorMotivo?: Map<string, number>
  ): Promise<boolean> {
    try {
      // Buscar grupo do WhatsApp específico para Quebras (com fallback para o grupo padrão)
      const groupId = await ConfigurationService.get('whatsapp_group_quebras', '') ||
                      await ConfigurationService.get('evolution_whatsapp_group_id', process.env.EVOLUTION_WHATSAPP_GROUP_ID || '');

      if (!groupId) {
        console.warn('⚠️  Grupo do WhatsApp não configurado (whatsapp_group_quebras ou evolution_whatsapp_group_id)');
        return false;
      }

      console.log(`📊 Enviando relatório de quebras para grupo: ${groupId}`);

      let caption = `📊 *RELATÓRIO DE AJUSTE DE ESTOQUE*\n\n` +
                   `📋 Lote: ${nomeLote}\n` +
                   `📅 Data: ${new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}\n\n` +
                   `📦 Total de Itens: ${totalItens}\n` +
                   `🔴 Saídas: ${totalSaidas} itens (R$ ${valorSaidas.toFixed(2)})\n` +
                   `🟢 Entradas: ${totalEntradas} itens (R$ ${valorEntradas.toFixed(2)})\n\n`;

      // Adicionar detalhamento por motivo de saídas
      if (saidasPorMotivo && saidasPorMotivo.size > 0) {
        caption += `*📉 SAÍDAS POR MOTIVO:*\n`;
        // Ordenar por valor decrescente
        const saidasOrdenadas = Array.from(saidasPorMotivo.entries())
          .sort((a, b) => b[1] - a[1]);
        let totalSaidasMotivos = 0;
        saidasOrdenadas.forEach(([motivo, valor]) => {
          caption += `📦 ${motivo}: R$ ${valor.toFixed(2)}\n`;
          totalSaidasMotivos += valor;
        });
        caption += `➖➖➖➖➖➖➖➖➖➖➖\n`;
        caption += `💰 *TOTAL SAÍDAS: R$ ${totalSaidasMotivos.toFixed(2)}*\n\n`;
      }

      // Adicionar detalhamento por motivo de entradas
      if (entradasPorMotivo && entradasPorMotivo.size > 0) {
        caption += `*📈 ENTRADAS POR MOTIVO:*\n`;
        // Ordenar por valor decrescente
        const entradasOrdenadas = Array.from(entradasPorMotivo.entries())
          .sort((a, b) => b[1] - a[1]);
        let totalEntradasMotivos = 0;
        entradasOrdenadas.forEach(([motivo, valor]) => {
          caption += `📦 ${motivo}: R$ ${valor.toFixed(2)}\n`;
          totalEntradasMotivos += valor;
        });
        caption += `➖➖➖➖➖➖➖➖➖➖➖\n`;
        caption += `💰 *TOTAL ENTRADAS: R$ ${totalEntradasMotivos.toFixed(2)}*\n\n`;
      }

      caption += `📄 Confira o relatório detalhado em PDF anexo.`;

      const success = await this.sendDocument(groupId, filePath, caption);

      if (success) {
        console.log(`✅ Relatório de quebras enviado para grupo ${groupId}`);
      } else {
        console.error(`❌ Falha ao enviar relatório de quebras`);
      }

      return success;
    } catch (error) {
      console.error(`❌ Erro ao enviar relatório de quebras:`, error);
      return false;
    }
  }

  /**
   * Envia relatório de auditoria de ruptura para grupo do WhatsApp
   */
  static async sendRuptureReport(
    filePath: string,
    auditoriaNome: string,
    totalRupturas: number,
    naoEncontrado: number,
    emEstoque: number,
    perdaVenda: number = 0,
    perdaLucro: number = 0
  ): Promise<boolean> {
    try {
      // Buscar grupo do WhatsApp específico para Ruptura (com fallback para o grupo padrão)
      const groupId = await ConfigurationService.get('whatsapp_group_ruptura', '') ||
                      await ConfigurationService.get('evolution_whatsapp_group_id', process.env.EVOLUTION_WHATSAPP_GROUP_ID || '');

      if (!groupId) {
        console.warn('⚠️  Grupo do WhatsApp não configurado (whatsapp_group_ruptura ou evolution_whatsapp_group_id)');
        return false;
      }

      console.log(`📊 Enviando relatório para grupo: ${groupId}`);

      const caption = `📊 *RELATÓRIO DE AUDITORIA DE RUPTURAS*\n\n` +
                     `📋 Auditoria: ${auditoriaNome}\n` +
                     `📅 Data: ${new Date().toLocaleString('pt-BR')}\n\n` +
                     `📦 Total de Rupturas: ${totalRupturas}\n` +
                     `🔴 Não Encontrado: ${naoEncontrado}\n` +
                     `🟠 Em Estoque: ${emEstoque}\n\n` +
                     `💰 Perda de Venda: R$ ${perdaVenda.toFixed(2)}\n` +
                     `📉 Perda de Lucro: R$ ${perdaLucro.toFixed(2)}\n\n` +
                     `📄 Confira o relatório detalhado em PDF anexo.`;

      const success = await this.sendDocument(groupId, filePath, caption);

      if (success) {
        console.log(`✅ Relatório de ruptura enviado para grupo ${groupId}`);
      } else {
        console.error(`❌ Falha ao enviar relatório de ruptura`);
      }

      return success;
    } catch (error) {
      console.error(`❌ Erro ao enviar relatório de ruptura:`, error);
      return false;
    }
  }

  /**
   * Envia relatório de sugestão de produção para grupo do WhatsApp
   */
  static async sendProductionReport(
    filePath: string,
    auditDate: string,
    totalProducts: number,
    withSuggestion: number,
    withoutSuggestion: number
  ): Promise<boolean> {
    try {
      // Buscar grupo do WhatsApp específico para Produção (com fallback para o grupo padrão)
      const groupId = await ConfigurationService.get('whatsapp_group_producao', '') ||
                      await ConfigurationService.get('evolution_whatsapp_group_id', process.env.EVOLUTION_WHATSAPP_GROUP_ID || '');

      if (!groupId) {
        console.warn('⚠️  Grupo do WhatsApp não configurado (whatsapp_group_producao ou evolution_whatsapp_group_id)');
        return false;
      }

      console.log(`🥖 Enviando relatório de produção para grupo: ${groupId}`);

      const caption = `🥖 *RELATÓRIO DE PRODUÇÃO - PADARIA*\n\n` +
                     `📋 Auditoria: ${auditDate}\n` +
                     `📅 Data: ${new Date().toLocaleString('pt-BR')}\n\n` +
                     `📦 Total de Produtos: ${totalProducts}\n` +
                     `🟢 Com Sugestão: ${withSuggestion} itens\n` +
                     `⚪ Sem Necessidade: ${withoutSuggestion} itens\n\n` +
                     `📄 Confira o relatório detalhado em PDF anexo.`;

      const success = await this.sendDocument(groupId, filePath, caption);

      if (success) {
        console.log(`✅ Relatório de produção enviado para grupo ${groupId}`);
      } else {
        console.error(`❌ Falha ao enviar relatório de produção`);
      }

      return success;
    } catch (error) {
      console.error(`❌ Erro ao enviar relatório de produção:`, error);
      return false;
    }
  }

  /**
   * Envia relatório de prioridade de abastecimento para grupo do WhatsApp
   */
  static async sendAbastecimentoReport(
    filePath: string,
    dataNf: string,
    total: number,
    prioridade1: number,
    prioridade2: number,
    prioridade3: number,
    prioridade4: number
  ): Promise<boolean> {
    try {
      const groupId = await ConfigurationService.get('whatsapp_group_abastecimento', '');

      if (!groupId) {
        console.warn('⚠️  Grupo do WhatsApp não configurado (whatsapp_group_abastecimento)');
        return false;
      }

      console.log(`📦 Enviando relatório de abastecimento para grupo: ${groupId}`);

      const caption = `📦 *PRIORIDADE REPOSIÇÃO - ABASTECIMENTO*\n\n` +
                     `📅 Data NF: ${dataNf}\n` +
                     `⏰ Enviado: ${new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}\n\n` +
                     `📦 Total de Itens: ${total}\n` +
                     `🔴 P1 - Curva A: ${prioridade1} itens\n` +
                     `🟠 P2 - Ruptura: ${prioridade2} itens\n` +
                     `🟡 P3 - Pré-Ruptura: ${prioridade3} itens\n` +
                     `⚪ P4 - Demais: ${prioridade4} itens\n\n` +
                     `📄 Confira o relatório detalhado em PDF anexo.`;

      const success = await this.sendDocument(groupId, filePath, caption);

      if (success) {
        console.log(`✅ Relatório de abastecimento enviado para grupo ${groupId}`);
      } else {
        console.error(`❌ Falha ao enviar relatório de abastecimento`);
      }

      return success;
    } catch (error) {
      console.error(`❌ Erro ao enviar relatório de abastecimento:`, error);
      return false;
    }
  }
}