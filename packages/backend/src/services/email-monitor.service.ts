import * as Imap from 'node-imap';
import { simpleParser, ParsedMail, Attachment } from 'mailparser';
import { ConfigurationService } from './configuration.service';
import { AppDataSource } from '../config/database';
import { EmailMonitorLog } from '../entities/EmailMonitorLog';
import * as fs from 'fs';
import * as path from 'path';
const pdf = require('pdf-parse');

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
    const subject_filter = await ConfigurationService.get('email_monitor_subject_filter', 'DVR');
    const check_interval = await ConfigurationService.get('email_monitor_check_interval', '30');
    const whatsapp_group_id = await ConfigurationService.get('email_monitor_whatsapp_group', '');
    const enabled = await ConfigurationService.get('email_monitor_enabled', 'false');

    return {
      email: email || '',
      app_password: app_password || '',
      subject_filter: subject_filter || 'DVR',
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
      const ImapConnection = Imap as any;
      const imap = new ImapConnection({
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
   * Extrai imagem de PDF
   */
  private static async extractImageFromPDF(pdfBuffer: Buffer): Promise<string | null> {
    try {
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

      // Check if subject matches filter
      if (!subject.toLowerCase().includes(config.subject_filter.toLowerCase())) {
        console.log(`⏭️  Email ignorado (filtro de assunto não corresponde)`);

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

      // Find PDF attachment
      const pdfAttachment = mail.attachments.find((att: Attachment) =>
        att.contentType === 'application/pdf'
      );

      if (!pdfAttachment) {
        console.log(`⚠️  Email não contém anexo PDF`);

        await logRepository.save({
          email_subject: subject,
          sender: from,
          email_body: textBody.substring(0, 500),
          status: 'error',
          error_message: 'Nenhum anexo PDF encontrado',
          has_attachment: mail.attachments.length > 0,
          whatsapp_group_id: config.whatsapp_group_id
        });

        return;
      }

      // Extract image from PDF
      const pdfPath = await this.extractImageFromPDF(pdfAttachment.content);

      if (!pdfPath) {
        throw new Error('Falha ao extrair imagem do PDF');
      }

      // Send to WhatsApp
      await this.sendToWhatsApp(config.whatsapp_group_id, textBody, pdfPath);

      // Log success
      await logRepository.save({
        email_subject: subject,
        sender: from,
        email_body: textBody.substring(0, 500),
        status: 'success',
        error_message: null,
        has_attachment: true,
        whatsapp_group_id: config.whatsapp_group_id
      });

      console.log(`✅ Email processado e enviado para WhatsApp`);

      // Clean up temp file
      if (fs.existsSync(pdfPath)) {
        fs.unlinkSync(pdfPath);
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

      // Read image file
      const imageBuffer = fs.readFileSync(imagePath);
      const base64Image = imageBuffer.toString('base64');

      // Send message with image
      const url = `${apiUrl}/message/sendMedia/${instance}`;

      const payload = {
        number: groupId,
        mediatype: 'image',
        mimetype: 'image/jpeg',
        caption: `🚨 Alerta DVR\n\n${text}`,
        media: base64Image
      };

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

      console.log(`✅ Mensagem enviada para WhatsApp grupo ${groupId}`);

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
}
