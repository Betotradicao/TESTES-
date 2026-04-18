import Imap from 'node-imap';
import { simpleParser, ParsedMail, Attachment } from 'mailparser';
import { ConfigurationService } from './configuration.service';
import { AppDataSource } from '../config/database';
import { EmailMonitorLog } from '../entities/EmailMonitorLog';
import * as fs from 'fs';
import * as path from 'path';
import axios from 'axios';
import { minioService } from './minio.service';

export interface EmailMonitorConfig {
  email: string;
  app_password: string;
  subject_filter: string;
  check_interval_seconds: number;
  whatsapp_group_id: string;
  enabled: boolean;
}

export class EmailMonitorService {
  private static imap: Imap | null = null;
  private static isConnected = false;

  /**
   * Busca configurações do email monitor do banco de dados
   */
  static async getConfig(): Promise<EmailMonitorConfig> {
    const email = await ConfigurationService.get('email_monitor_email', '');
    const app_password = await ConfigurationService.get('email_monitor_app_password', '');
    // IMPORTANTE: Não usar fallback 'DVR' - o filtro deve vir do banco de dados
    // Cada cliente pode ter seu próprio filtro (ex: DVR TRADICAO, DVR CENTRAL, DVR VITAL)
    const subject_filter = await ConfigurationService.get('email_monitor_subject_filter', '');
    const check_interval = await ConfigurationService.get('email_monitor_check_interval', '30');
    const whatsapp_group_id = await ConfigurationService.get('email_monitor_whatsapp_group', '');
    const enabled = await ConfigurationService.get('email_monitor_enabled', 'false');

    // Log para debug das configurações carregadas
    console.log(`📋 Config carregada - Filtro: "${subject_filter}", Grupo: "${whatsapp_group_id}", Habilitado: ${enabled}`);

    return {
      email: email || '',
      app_password: app_password || '',
      subject_filter: subject_filter || '', // Sem fallback - usa valor do banco
      check_interval_seconds: parseInt(check_interval || '30'),
      whatsapp_group_id: whatsapp_group_id || '',
      enabled: enabled === 'true'
    };
  }

  /**
   * Salva configurações do email monitor
   */
  static async saveConfig(config: Partial<EmailMonitorConfig>): Promise<void> {
    if (config.email !== undefined) {
      await ConfigurationService.set('email_monitor_email', config.email);
    }
    if (config.app_password !== undefined) {
      await ConfigurationService.set('email_monitor_app_password', config.app_password);
    }
    if (config.subject_filter !== undefined) {
      await ConfigurationService.set('email_monitor_subject_filter', config.subject_filter);
    }
    if (config.check_interval_seconds !== undefined) {
      await ConfigurationService.set('email_monitor_check_interval', config.check_interval_seconds.toString());
    }
    if (config.whatsapp_group_id !== undefined) {
      await ConfigurationService.set('email_monitor_whatsapp_group', config.whatsapp_group_id);
    }
    if (config.enabled !== undefined) {
      await ConfigurationService.set('email_monitor_enabled', config.enabled.toString());
    }
  }

  /**
   * Conecta ao Gmail via IMAP
   */
  private static async connect(): Promise<any> {
    const config = await this.getConfig();

    if (!config.email || !config.app_password) {
      throw new Error('Email e App Password não configurados');
    }

    return new Promise((resolve, reject) => {
      const imap = new Imap({
        user: config.email,
        password: config.app_password,
        host: 'imap.gmail.com',
        port: 993,
        tls: true,
        tlsOptions: { rejectUnauthorized: false }
      });

      imap.once('ready', () => {
        console.log('✅ Conectado ao Gmail IMAP');
        this.isConnected = true;
        resolve(imap);
      });

      imap.once('error', (err: Error) => {
        console.error('❌ Erro IMAP:', err);
        this.isConnected = false;
        reject(err);
      });

      imap.once('end', () => {
        console.log('📪 Conexão IMAP encerrada');
        this.isConnected = false;
      });

      imap.connect();
    });
  }

  /**
   * Salva anexo de imagem (JPG, PNG, etc)
   */
  private static async saveImageAttachment(attachment: Attachment): Promise<string | null> {
    try {
      console.log(`📎 Processando anexo: tipo=${attachment.contentType}, tamanho=${attachment.content?.length || 0} bytes`);

      // Verificar se o conteúdo existe
      if (!attachment.content || attachment.content.length === 0) {
        console.error('❌ Anexo sem conteúdo');
        return null;
      }

      const tempDir = path.join(__dirname, '../../temp');
      console.log(`📁 Diretório temporário: ${tempDir}`);

      if (!fs.existsSync(tempDir)) {
        console.log(`📁 Criando diretório temporário: ${tempDir}`);
        fs.mkdirSync(tempDir, { recursive: true });
      }

      // Determine file extension from content type
      let ext = 'jpg';
      if (attachment.contentType?.includes('png')) {
        ext = 'png';
      } else if (attachment.contentType?.includes('gif')) {
        ext = 'gif';
      } else if (attachment.contentType?.includes('bmp')) {
        ext = 'bmp';
      }

      const tempFile = path.join(tempDir, `image_${Date.now()}.${ext}`);
      fs.writeFileSync(tempFile, attachment.content);

      // Verificar se o arquivo foi salvo
      if (fs.existsSync(tempFile)) {
        const stats = fs.statSync(tempFile);
        console.log(`🖼️  Imagem salva temporariamente: ${tempFile} (${(stats.size / 1024).toFixed(2)} KB)`);
      } else {
        console.error(`❌ Arquivo não foi salvo: ${tempFile}`);
        return null;
      }

      return tempFile;
    } catch (error) {
      console.error('❌ Erro ao salvar imagem:', error);
      console.error('❌ Stack:', error instanceof Error ? error.stack : 'N/A');
      return null;
    }
  }

  /**
   * Salva uma cópia permanente da imagem para a galeria
   * Tenta fazer upload para o MinIO primeiro, com fallback para armazenamento local
   */
  private static async savePermanentImage(tempFilePath: string): Promise<string | null> {
    try {
      // Verificar se o arquivo temporário existe
      if (!fs.existsSync(tempFilePath)) {
        console.error(`❌ Arquivo temporário não existe: ${tempFilePath}`);
        return null;
      }

      // Verificar se é um arquivo de imagem válido (não PDF)
      const ext = path.extname(tempFilePath).toLowerCase();
      if (ext === '.pdf') {
        console.warn(`⚠️ Arquivo PDF não pode ser salvo como imagem: ${tempFilePath}`);
        return null;
      }

      // Ler o conteúdo do arquivo
      const fileBuffer = fs.readFileSync(tempFilePath);
      const stats = fs.statSync(tempFilePath);
      console.log(`📊 Tamanho do arquivo: ${(stats.size / 1024).toFixed(2)} KB`);

      // Gerar nome único para a imagem
      const filename = `dvr_${Date.now()}${ext}`;

      // Determinar content type
      let contentType = 'image/jpeg';
      if (ext === '.png') contentType = 'image/png';
      else if (ext === '.gif') contentType = 'image/gif';
      else if (ext === '.bmp') contentType = 'image/bmp';

      // Tentar fazer upload para o MinIO
      try {
        console.log(`☁️ Tentando upload para MinIO: ${filename}`);
        const minioUrl = await minioService.uploadFile(filename, fileBuffer, contentType);
        console.log(`✅ Imagem enviada para MinIO: ${minioUrl}`);
        return minioUrl; // Retorna a URL completa do MinIO
      } catch (minioError) {
        console.warn(`⚠️ Falha no upload para MinIO, usando armazenamento local:`, minioError);
      }

      // Fallback: salvar localmente se MinIO falhar
      const uploadsDir = path.join(__dirname, '../../uploads/dvr_images');
      console.log(`📂 Fallback - Diretório de uploads: ${uploadsDir}`);

      if (!fs.existsSync(uploadsDir)) {
        console.log(`📁 Criando diretório de uploads: ${uploadsDir}`);
        fs.mkdirSync(uploadsDir, { recursive: true });
      }

      const permanentPath = path.join(uploadsDir, filename);

      // Copiar arquivo temporário para o diretório permanente
      fs.copyFileSync(tempFilePath, permanentPath);

      // Verificar se o arquivo foi copiado corretamente
      if (!fs.existsSync(permanentPath)) {
        console.error(`❌ Falha ao copiar arquivo para: ${permanentPath}`);
        return null;
      }

      const savedStats = fs.statSync(permanentPath);
      console.log(`💾 Imagem permanente salva localmente: ${permanentPath} (${(savedStats.size / 1024).toFixed(2)} KB)`);

      // Retornar apenas o nome do arquivo (não o caminho completo) para fallback local
      return filename;
    } catch (error) {
      console.error('❌ Erro ao salvar imagem permanente:', error);
      console.error('❌ Stack:', error instanceof Error ? error.stack : 'N/A');
      return null;
    }
  }

  /**
   * Extrai imagem de PDF
   */
  private static async extractImageFromPDF(pdfBuffer: Buffer): Promise<string | null> {
    try {
      // Lazy load pdf-parse para evitar erros de inicialização
      const pdf = require('pdf-parse');

      // Parse PDF
      const data = await pdf(pdfBuffer);

      // Try to find embedded images in PDF
      // Note: pdf-parse doesn't extract images directly, but we can save the PDF
      // and return a base64 string for the entire PDF preview
      // For actual image extraction, we'd need pdf2pic or similar

      // For now, let's save the PDF temporarily and return its path
      const tempDir = path.join(__dirname, '../../temp');
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
      }

      const tempFile = path.join(tempDir, `pdf_${Date.now()}.pdf`);
      fs.writeFileSync(tempFile, pdfBuffer);

      console.log(`📄 PDF salvo temporariamente: ${tempFile}`);
      console.log(`📝 PDF texto extraído: ${data.text.substring(0, 200)}...`);

      // Return the file path for now
      // In production, you'd want to convert PDF to image using pdf2pic
      return tempFile;
    } catch (error) {
      console.error('❌ Erro ao extrair imagem do PDF:', error);
      return null;
    }
  }

  /**
   * Processa um email e envia para WhatsApp
   */
  private static async processEmail(mail: ParsedMail, config: EmailMonitorConfig): Promise<void> {
    const logRepository = AppDataSource.getRepository(EmailMonitorLog);

    try {
      const subject = mail.subject || 'Sem assunto';
      const from = mail.from?.text || 'Desconhecido';
      const textBody = mail.text || '';

      console.log(`📧 Processando email: ${subject} de ${from}`);
      // Suporte a multiplos filtros (objeto com filter/group/message ou string simples)
      let filterObjs: { filter: string; type: string; group: string; message: string }[] = [];
      try {
        const raw = config.subject_filter?.trim() || '';
        if (raw.startsWith('[')) {
          const parsed = JSON.parse(raw);
          filterObjs = parsed.map((f: any, i: number) => {
            if (typeof f === 'string') return { filter: f, type: i === 0 ? 'dvr' : 'custom', group: '', message: '' };
            return { filter: f.filter || '', type: f.type || (i === 0 ? 'dvr' : 'custom'), group: f.group || '', message: f.message || '' };
          }).filter((f: any) => f.filter && f.filter.trim());
        } else if (raw) {
          filterObjs = [{ filter: raw, type: 'dvr', group: '', message: '' }];
        }
      } catch { filterObjs = config.subject_filter ? [{ filter: config.subject_filter, type: 'dvr', group: '', message: '' }] : []; }
      console.log(`🔍 Filtros configurados (${filterObjs.length}): ${filterObjs.map(f => `"${f.filter}" [${f.type}]`).join(', ')}`);

      const hasFilter = filterObjs.length > 0;
      const subjectLower = subject.trim().toLowerCase();
      const matchedFilterObj = hasFilter ? filterObjs.find(f => subjectLower.includes(f.filter.trim().toLowerCase())) : null;
      const matchesFilter = !!matchedFilterObj;

      if (!matchesFilter) {
        console.log(`⏭️  Email ignorado - assunto "${subject}" nao contem nenhum dos ${filterObjs.length} filtros`);

        await logRepository.save({
          email_subject: subject,
          sender: from,
          email_body: textBody.substring(0, 500),
          status: 'skipped',
          error_message: 'Assunto não corresponde ao filtro',
          has_attachment: mail.attachments.length > 0,
          whatsapp_group_id: null
        });

        return;
      }

      // Filtro customizado NÃO precisa de PDF — pula extração e vai direto pro envio
      const isCustomFilter = matchedFilterObj && matchedFilterObj.type === 'custom' && matchedFilterObj.group;
      let filePath: string | null = null;
      let permanentImageFilename: string | null = null;

      if (!isCustomFilter) {
        // DVR: precisa de PDF/imagem
        const pdfAttachment = mail.attachments.find((att: Attachment) =>
          att.contentType === 'application/pdf'
        );

        const imageAttachment = mail.attachments.find((att: Attachment) =>
          att.contentType?.startsWith('image/')
        );

        if (pdfAttachment) {
          console.log(`📄 Processando anexo PDF`);
          filePath = await this.extractImageFromPDF(pdfAttachment.content);
          if (!filePath) throw new Error('Falha ao extrair imagem do PDF');
        } else if (imageAttachment) {
          console.log(`🖼️  Processando anexo de imagem`);
          filePath = await this.saveImageAttachment(imageAttachment);
          if (!filePath) throw new Error('Falha ao salvar imagem');
        } else {
          console.log(`⚠️  Email não contém anexo PDF ou imagem`);
          await logRepository.save({
            email_subject: subject, sender: from,
            email_body: textBody.substring(0, 500), status: 'error',
            error_message: 'Nenhum anexo PDF ou imagem encontrado',
            has_attachment: mail.attachments.length > 0,
            whatsapp_group_id: config.whatsapp_group_id
          });
          return;
        }
        permanentImageFilename = await this.savePermanentImage(filePath);
      } else {
        console.log(`📨 Filtro customizado "${matchedFilterObj!.filter}" — pulando extração de PDF`);
      }

      // Log warning se imagem não foi salva para galeria
      if (!permanentImageFilename) {
        console.warn(`⚠️ Imagem não foi salva para galeria (pode ser PDF ou erro de salvamento)`);
      }

      // Determinar grupo e mensagem baseado no filtro que bateu
      let targetGroup = config.whatsapp_group_id;
      let targetMessage = textBody;
      let targetFilePath = filePath;

      if (matchedFilterObj && matchedFilterObj.type === 'custom' && matchedFilterObj.group) {
        // Filtro customizado: usa grupo e mensagem do filtro
        targetGroup = matchedFilterObj.group;
        targetMessage = matchedFilterObj.message
          ? `${matchedFilterObj.message}\n\n📧 Assunto: ${subject}\n📬 De: ${from}\n\n${textBody.substring(0, 500)}`
          : `📧 *Email recebido*\n\n*Assunto:* ${subject}\n*De:* ${from}\n\n${textBody.substring(0, 500)}`;
        targetFilePath = ''; // Filtro custom não extrai PDF, só envia texto
        console.log(`📨 Filtro customizado: grupo=${targetGroup}, msg="${matchedFilterObj.message?.substring(0, 50)}..."`);
      }

      const whatsappSent = targetGroup && targetGroup.trim() !== '';
      if (!whatsappSent) {
        console.log(`⏭️ WhatsApp desabilitado - nenhum grupo configurado. Email processado e imagem salva na galeria.`);
      } else {
        // Send to WhatsApp
        await this.sendToWhatsApp(targetGroup, targetMessage, targetFilePath || '');
      }

      // Determinar status e mensagem do log
      let logStatus = 'success';
      let logMessage: string | null = null;

      if (!whatsappSent && !permanentImageFilename && !isCustomFilter) {
        logStatus = 'partial';
        logMessage = 'WhatsApp desabilitado e imagem não salva na galeria';
      } else if (!whatsappSent) {
        logStatus = 'partial';
        logMessage = 'WhatsApp desabilitado (nenhum grupo configurado)';
      } else if (!permanentImageFilename && !isCustomFilter) {
        logStatus = 'partial';
        logMessage = 'WhatsApp enviado, mas imagem não salva na galeria';
      }
      // Filtro custom sem imagem = success (nao precisa de imagem)

      // Log success
      await logRepository.save({
        email_subject: subject,
        sender: from,
        email_body: textBody.substring(0, 500),
        status: logStatus,
        error_message: logMessage,
        has_attachment: mail.attachments.length > 0,
        whatsapp_group_id: targetGroup || null,
        image_path: permanentImageFilename
      });

      console.log(`✅ Email processado${whatsappSent ? ' e enviado para WhatsApp' : ' (WhatsApp desabilitado)'}${permanentImageFilename ? ' (imagem salva na galeria)' : ' (sem imagem na galeria)'}`);
      console.log(`📷 Image path salvo: ${permanentImageFilename || 'null'}`);

      // Clean up temp file
      if (filePath && fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }

    } catch (error) {
      console.error(`❌ Erro ao processar email:`, error);

      await logRepository.save({
        email_subject: mail.subject || 'Sem assunto',
        sender: mail.from?.text || 'Desconhecido',
        email_body: mail.text?.substring(0, 500) || '',
        status: 'error',
        error_message: error instanceof Error ? error.message : 'Erro desconhecido',
        has_attachment: mail.attachments.length > 0,
        whatsapp_group_id: config.whatsapp_group_id
      });
    }
  }

  /**
   * Formata o texto do email extraindo apenas as informacoes essenciais para WhatsApp
   */
  private static formatEmailText(text: string): string {
    const lines = text.split(/\r?\n/);
    const parts: string[] = [];

    // Extrair: Evento de alarme
    const eventoLine = lines.find(l => /evento de alarme/i.test(l));
    if (eventoLine) parts.push('🧠 ' + eventoLine.trim());

    // Extrair: Horario do alarme
    const horarioLine = lines.find(l => /hor[aá]rio do inicio do alarme/i.test(l));
    if (horarioLine) parts.push('🕐 ' + horarioLine.trim());

    // Extrair: Banco de imagens
    const bancoLine = lines.find(l => /banco de imagens/i.test(l));
    if (bancoLine) parts.push('\n📂 ' + bancoLine.trim());

    // Extrair: Nome da pessoa (a linha "Nome:" logo apos "Banco de imagens")
    if (bancoLine) {
      const bancoIdx = lines.indexOf(bancoLine);
      for (let i = bancoIdx + 1; i < lines.length; i++) {
        const trimmed = lines[i].trim();
        if (/^nome:/i.test(trimmed)) {
          parts.push('🧑 ' + trimmed);
          break;
        }
        if (trimmed.length > 0) break; // parar se achou outra linha nao vazia que nao e Nome
      }
    }

    // Se nao conseguiu extrair nada, retorna texto original resumido
    if (parts.length === 0) return text.substring(0, 500);

    return parts.join('\n');
  }

  /**
   * Envia mensagem e imagem para WhatsApp via Evolution API
   */
  private static async sendToWhatsApp(groupId: string, text: string, imagePath: string): Promise<void> {
    try {
      const apiToken = await ConfigurationService.get('evolution_api_token', process.env.EVOLUTION_API_TOKEN || '');
      const apiUrl = await ConfigurationService.get('evolution_api_url', process.env.EVOLUTION_API_URL || '');
      const instance = await ConfigurationService.get('evolution_instance', process.env.EVOLUTION_INSTANCE || '');

      if (!apiToken || !apiUrl || !instance) {
        throw new Error('Configurações Evolution API não encontradas');
      }

      const hasImage = imagePath && imagePath.trim() !== '' && fs.existsSync(imagePath);
      const formattedText = this.formatEmailText(text);

      let url: string;
      let payload: any;

      if (hasImage) {
        // Enviar mídia (imagem + texto como caption)
        const imageBuffer = fs.readFileSync(imagePath);
        const base64Image = imageBuffer.toString('base64');
        url = `${apiUrl}/message/sendMedia/${instance}`;
        payload = {
          number: groupId,
          mediatype: 'image',
          mimetype: 'image/jpeg',
          caption: `🚨 ALERTA DVR 🚨\n\n${formattedText}`,
          media: base64Image
        };
      } else {
        // Enviar apenas texto (filtro customizado)
        url = `${apiUrl}/message/sendText/${instance}`;
        payload = { number: groupId, text: formattedText };
      }

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

      console.log(`✅ Mensagem enviada para WhatsApp grupo ${groupId} (${hasImage ? 'com imagem' : 'só texto'})`);

    } catch (error) {
      console.error(`❌ Erro ao enviar para WhatsApp:`, error);
      throw error;
    }
  }

  /**
   * Verifica novos emails (executado pelo cron)
   */
  static async checkNewEmails(): Promise<void> {
    const config = await this.getConfig();

    if (!config.enabled) {
      console.log('⏸️  Email monitor desabilitado');
      return;
    }

    if (!config.email || !config.app_password) {
      console.log('⚠️  Email monitor não configurado');
      return;
    }

    let imap: any = null;

    try {
      console.log('🔍 Verificando novos emails...');

      imap = await this.connect();

      await new Promise<void>((resolve, reject) => {
        imap!.openBox('INBOX', false, (err: any, box: any) => {
          if (err) {
            reject(err);
            return;
          }

          // Search for unseen emails from last 24 hours
          const searchCriteria = ['UNSEEN', ['SINCE', new Date(Date.now() - 24 * 60 * 60 * 1000)]];
          const fetchOptions = {
            bodies: '',
            markSeen: true
          };

          imap!.search(searchCriteria, (err: any, results: any) => {
            if (err) {
              reject(err);
              return;
            }

            if (!results || results.length === 0) {
              console.log('📭 Nenhum email novo encontrado');
              resolve();
              return;
            }

            console.log(`📬 ${results.length} emails novos encontrados`);

            const fetch = imap!.fetch(results, fetchOptions);
            let processed = 0;

            fetch.on('message', (msg: any, seqno: any) => {
              msg.on('body', async (stream: any) => {
                try {
                  const mail = await simpleParser(stream);
                  await this.processEmail(mail, config);
                  processed++;

                  if (processed === results.length) {
                    resolve();
                  }
                } catch (err) {
                  console.error(`❌ Erro ao parsear email:`, err);
                }
              });
            });

            fetch.once('error', (err: any) => {
              console.error('❌ Erro ao buscar emails:', err);
              reject(err);
            });

            fetch.once('end', () => {
              console.log('✅ Busca de emails concluída');
            });
          });
        });
      });

    } catch (error) {
      console.error('❌ Erro ao verificar emails:', error);
    } finally {
      if (imap) {
        imap.end();
      }
    }
  }

  /**
   * Testa conexão com Gmail
   */
  static async testConnection(): Promise<{ success: boolean; message: string }> {
    try {
      const config = await this.getConfig();

      if (!config.email || !config.app_password) {
        return {
          success: false,
          message: 'Email e App Password devem ser configurados'
        };
      }

      const imap = await this.connect();

      await new Promise<void>((resolve, reject) => {
        imap.openBox('INBOX', true, (err: any) => {
          if (err) {
            reject(err);
          } else {
            resolve();
          }
        });
      });

      imap.end();

      return {
        success: true,
        message: 'Conexão realizada com sucesso!'
      };

    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Erro desconhecido'
      };
    }
  }

  /**
   * Retorna logs de emails processados
   */
  static async getLogs(limit: number = 50): Promise<EmailMonitorLog[]> {
    const logRepository = AppDataSource.getRepository(EmailMonitorLog);

    return await logRepository.find({
      order: {
        processed_at: 'DESC'
      },
      take: limit
    });
  }

  /**
   * Reprocessa o último email recebido (para testes)
   */
  static async reprocessLastEmail(): Promise<{ success: boolean; message: string }> {
    const config = await this.getConfig();

    if (!config.enabled) {
      return {
        success: false,
        message: 'Email monitor está desabilitado'
      };
    }

    if (!config.email || !config.app_password) {
      return {
        success: false,
        message: 'Email monitor não está configurado'
      };
    }

    let imap: any = null;

    try {
      console.log('🔄 Reprocessando último email...');

      imap = await this.connect();

      const result = await new Promise<{ success: boolean; message: string }>((resolve, reject) => {
        imap!.openBox('INBOX', false, (err: any, box: any) => {
          if (err) {
            reject(err);
            return;
          }

          // Search for last email matching our criteria (seen or unseen)
          const searchCriteria: any[] = config.subject_filter
            ? [['SUBJECT', config.subject_filter]]
            : ['ALL'];
          const fetchOptions = {
            bodies: '',
            markSeen: false // Don't mark as seen when reprocessing
          };

          imap!.search(searchCriteria, (err: any, results: any) => {
            if (err) {
              reject(err);
              return;
            }

            if (!results || results.length === 0) {
              resolve({
                success: false,
                message: `Nenhum email encontrado com assunto "${config.subject_filter}"`
              });
              return;
            }

            // Get the last email (most recent)
            const lastEmailId = results[results.length - 1];
            console.log(`📧 Reprocessando email ID: ${lastEmailId}`);

            const fetch = imap!.fetch([lastEmailId], fetchOptions);

            fetch.on('message', (msg: any, seqno: any) => {
              msg.on('body', async (stream: any) => {
                try {
                  const mail = await simpleParser(stream);
                  await this.processEmail(mail, config);
                  resolve({
                    success: true,
                    message: `Email "${mail.subject}" reprocessado com sucesso`
                  });
                } catch (err) {
                  console.error(`❌ Erro ao parsear email:`, err);
                  resolve({
                    success: false,
                    message: `Erro ao processar email: ${err instanceof Error ? err.message : 'Erro desconhecido'}`
                  });
                }
              });
            });

            fetch.once('error', (err: any) => {
              console.error('❌ Erro ao buscar email:', err);
              resolve({
                success: false,
                message: `Erro ao buscar email: ${err.message}`
              });
            });
          });
        });
      });

      return result;

    } catch (error) {
      console.error('❌ Erro ao reprocessar email:', error);
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Erro desconhecido'
      };
    } finally {
      if (imap) {
        imap.end();
      }
    }
  }

  /**
   * Busca grupos do WhatsApp via Evolution API
   */
  static async getWhatsAppGroups(): Promise<Array<{ id: string; name: string }>> {
    try {
      // Buscar configurações da Evolution API
      const evolutionApiUrl = await ConfigurationService.get('evolution_api_url', '');
      const evolutionInstance = await ConfigurationService.get('evolution_instance', '');

      if (!evolutionApiUrl || !evolutionInstance) {
        throw new Error('Evolution API não configurada');
      }

      // Usar a chave global de autenticação da Evolution
      const globalApiKey = '47de291022054bdb65f49d59579338f7';

      // Fazer requisição para buscar grupos
      const response = await axios.get(
        `${evolutionApiUrl}/group/fetchAllGroups/${evolutionInstance}`,
        {
          params: {
            getParticipants: 'false'
          },
          headers: {
            'apikey': globalApiKey
          }
        }
      );

      // Mapear resposta para formato esperado
      const groups = response.data.map((group: any) => ({
        id: group.id,
        name: group.subject || group.name || 'Sem nome'
      }));

      return groups;
    } catch (error) {
      console.error('Erro ao buscar grupos do WhatsApp:', error);
      throw error;
    }
  }

  /**
   * Deletar um log específico e sua imagem associada
   */
  static async deleteLog(logId: string): Promise<{ success: boolean; message: string }> {
    try {
      const logRepository = AppDataSource.getRepository(EmailMonitorLog);

      // Buscar o log
      const log = await logRepository.findOne({ where: { id: logId } });

      if (!log) {
        return {
          success: false,
          message: 'Log não encontrado'
        };
      }

      // Deletar arquivo físico da imagem se existir
      if (log.image_path) {
        const uploadsDir = path.join(__dirname, '..', '..', 'uploads', 'dvr_images');
        const imagePath = path.join(uploadsDir, log.image_path);

        try {
          if (fs.existsSync(imagePath)) {
            fs.unlinkSync(imagePath);
            console.log(`🗑️ Imagem deletada: ${log.image_path}`);
          }
        } catch (error) {
          console.error('Erro ao deletar arquivo de imagem:', error);
          // Continua mesmo se falhar ao deletar o arquivo
        }
      }

      // Deletar o log do banco
      await logRepository.remove(log);

      return {
        success: true,
        message: 'Log e imagem deletados com sucesso'
      };
    } catch (error) {
      console.error('Erro ao deletar log:', error);
      throw error;
    }
  }
}
