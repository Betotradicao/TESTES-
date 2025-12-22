import Imap from 'node-imap';
import { simpleParser, ParsedMail, Attachment } from 'mailparser';
import { ConfigurationService } from './configuration.service';
import { AppDataSource } from '../config/database';
import { EmailMonitorLog } from '../entities/EmailMonitorLog';
import * as fs from 'fs';
import * as path from 'path';
import axios from 'axios';

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
      const tempDir = path.join(__dirname, '../../temp');
      if (!fs.existsSync(tempDir)) {
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

      console.log(`🖼️  Imagem salva temporariamente: ${tempFile}`);

      return tempFile;
    } catch (error) {
      console.error('❌ Erro ao salvar imagem:', error);
      return null;
    }
  }

  /**
   * Salva uma cópia permanente da imagem para a galeria
   */
  private static async savePermanentImage(tempFilePath: string): Promise<string | null> {
    try {
      const uploadsDir = path.join(__dirname, '../../uploads/dvr_images');
      if (!fs.existsSync(uploadsDir)) {
        fs.mkdirSync(uploadsDir, { recursive: true });
      }

      // Gerar nome único para a imagem permanente
      const ext = path.extname(tempFilePath);
      const filename = `dvr_${Date.now()}${ext}`;
      const permanentPath = path.join(uploadsDir, filename);

      // Copiar arquivo temporário para o diretório permanente
      fs.copyFileSync(tempFilePath, permanentPath);

      console.log(`💾 Imagem permanente salva: ${permanentPath}`);

      // Retornar apenas o nome do arquivo (não o caminho completo)
      return filename;
    } catch (error) {
      console.error('❌ Erro ao salvar imagem permanente:', error);
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

      // Find PDF or Image attachment
      const pdfAttachment = mail.attachments.find((att: Attachment) =>
        att.contentType === 'application/pdf'
      );

      const imageAttachment = mail.attachments.find((att: Attachment) =>
        att.contentType?.startsWith('image/')
      );

      let filePath: string | null = null;

      if (pdfAttachment) {
        // Process PDF
        console.log(`📄 Processando anexo PDF`);
        filePath = await this.extractImageFromPDF(pdfAttachment.content);

        if (!filePath) {
          throw new Error('Falha ao extrair imagem do PDF');
        }
      } else if (imageAttachment) {
        // Process Image directly
        console.log(`🖼️  Processando anexo de imagem`);
        filePath = await this.saveImageAttachment(imageAttachment);

        if (!filePath) {
          throw new Error('Falha ao salvar imagem');
        }
      } else {
        console.log(`⚠️  Email não contém anexo PDF ou imagem`);

        await logRepository.save({
          email_subject: subject,
          sender: from,
          email_body: textBody.substring(0, 500),
          status: 'error',
          error_message: 'Nenhum anexo PDF ou imagem encontrado',
          has_attachment: mail.attachments.length > 0,
          whatsapp_group_id: config.whatsapp_group_id
        });

        return;
      }

      // Salvar cópia permanente da imagem para a galeria
      const permanentImageFilename = await this.savePermanentImage(filePath);

      // Send to WhatsApp
      await this.sendToWhatsApp(config.whatsapp_group_id, textBody, filePath);

      // Log success
      await logRepository.save({
        email_subject: subject,
        sender: from,
        email_body: textBody.substring(0, 500),
        status: 'success',
        error_message: null,
        has_attachment: true,
        whatsapp_group_id: config.whatsapp_group_id,
        image_path: permanentImageFilename
      });

      console.log(`✅ Email processado e enviado para WhatsApp`);

      // Clean up temp file
      if (fs.existsSync(filePath)) {
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
   * Formata o texto do email com emojis para WhatsApp
   */
  private static formatEmailText(text: string): string {
    // Adicionar emojis mantendo a formatação original do email
    let formattedText = text
      .replace(/Evento de alarme:/gi, '🧠 Evento de alarme:')
      .replace(/Alarme no Canal No\.:/gi, '📡 Alarme no Canal No.:')
      .replace(/^Nome: FACIAL/gmi, '📱 Nome: FACIAL')
      .replace(/Hor[aá]rio do inicio do alarme\(D\/M\/A H:M:S\):/gi, '🕐 Horário do inicio do alarme(D/M/A H:M:S):')
      .replace(/Nome do dispositivo de alarme:/gi, '📷 Nome do dispositivo de alarme:')
      .replace(/^Nome: Reconhecimento Facial/gmi, '🧑 Nome: Reconhecimento Facial')
      .replace(/End\. IP DVR:/gi, '🌐 End. IP DVR:')
      .replace(/Detalhes do alarme:/gi, '📋 Detalhes do alarme:')
      .replace(/^\s*Modo Comum/gmi, '⚙️ Modo Comum')
      .replace(/^\s*Banco de imagens:/gmi, '📂 Banco de imagens:')
      .replace(/^\s*Nome: (?!FACIAL|Reconhecimento)/gmi, '🧑 Nome: ')
      .replace(/^\s*Similaridade:/gmi, '📊 Similaridade:')
      .replace(/^\s*Idade:/gmi, '🧓 Idade:')
      .replace(/^\s*G[eê]nero:/gmi, '⚧️ Gênero:')
      .replace(/^\s*Express[aã]o:/gmi, '👁️ Expressão:')
      .replace(/^\s*[ÓO]culos:/gmi, '😎 Óculos:')
      .replace(/^\s*M[aá]scara:/gmi, '😷 Máscara:')
      .replace(/^\s*Barba:/gmi, '🧔 Barba:');

    return formattedText;
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

      // Format text with emojis
      const formattedText = this.formatEmailText(text);

      // Send message with image
      const url = `${apiUrl}/message/sendMedia/${instance}`;

      const payload = {
        number: groupId,
        mediatype: 'image',
        mimetype: 'image/jpeg',
        caption: `🚨 ALERTA DVR 🚨\n\n${formattedText}`,
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
            ? ['SUBJECT', config.subject_filter]
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
