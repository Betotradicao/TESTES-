import { AppDataSource } from '../config/database';
import { GarimpadorContato } from '../entities/GarimpadorContato';
import { GarimpadorMensagem } from '../entities/GarimpadorMensagem';

export class GarimpadorService {

  /**
   * Processa webhook da Evolution API
   * Extrai contato + mensagem e salva no banco
   */
  static async processarWebhook(payload: any): Promise<{ contato: GarimpadorContato; mensagem: GarimpadorMensagem } | null> {
    try {
      // Validar evento
      const event = payload.event;
      if (event !== 'messages.upsert') {
        console.log(`[Garimpador] Evento ignorado: ${event}`);
        return null;
      }

      const data = payload.data;
      if (!data || !data.key) {
        console.log('[Garimpador] Payload sem data/key');
        return null;
      }

      // Ignorar mensagens enviadas por nós
      if (data.key.fromMe) {
        return null;
      }

      const remoteJid = data.key.remoteJid;
      const messageId = data.key.id;
      const pushName = data.pushName || null;
      const messageTimestamp = data.messageTimestamp;

      // Extrair telefone do JID (remove @s.whatsapp.net ou @g.us)
      const telefone = remoteJid.replace(/@.*$/, '');

      // Detectar tipo de mídia e conteúdo
      const { tipoMidia, conteudoOriginal, mediaUrl, mediaMimetype } = this.extrairConteudo(data);

      // Se não tem conteúdo nenhum, ignorar
      if (!conteudoOriginal && !mediaUrl) {
        console.log('[Garimpador] Mensagem sem conteúdo relevante, ignorando');
        return null;
      }

      // Upsert contato
      const contato = await this.upsertContato(telefone, pushName);

      // Verificar duplicata pelo message_id
      const msgRepo = AppDataSource.getRepository(GarimpadorMensagem);
      const existente = await msgRepo.findOne({ where: { message_id: messageId } });
      if (existente) {
        console.log(`[Garimpador] Mensagem duplicada ignorada: ${messageId}`);
        return null;
      }

      // Criar mensagem
      const mensagem = msgRepo.create({
        contato_id: contato.id,
        remote_jid: remoteJid,
        sender_name: pushName,
        tipo_midia: tipoMidia,
        conteudo_original: conteudoOriginal,
        media_url: mediaUrl,
        media_mimetype: mediaMimetype,
        processado: false,
        message_id: messageId,
        received_at: messageTimestamp ? new Date(messageTimestamp * 1000) : new Date(),
      });

      await msgRepo.save(mensagem);
      console.log(`[Garimpador] Mensagem salva: ${tipoMidia} de ${pushName || telefone}`);

      return { contato, mensagem };
    } catch (error) {
      console.error('[Garimpador] Erro ao processar webhook:', error);
      return null;
    }
  }

  /**
   * Extrai tipo de mídia e conteúdo do payload da Evolution
   */
  private static extrairConteudo(data: any): {
    tipoMidia: string;
    conteudoOriginal: string | null;
    mediaUrl: string | null;
    mediaMimetype: string | null;
  } {
    const message = data.message || {};
    const messageType = data.messageType || '';

    // Texto simples
    if (message.conversation) {
      return {
        tipoMidia: 'texto',
        conteudoOriginal: message.conversation,
        mediaUrl: null,
        mediaMimetype: null,
      };
    }

    // Texto estendido (com formatação, links, etc)
    if (message.extendedTextMessage) {
      return {
        tipoMidia: 'texto',
        conteudoOriginal: message.extendedTextMessage.text || null,
        mediaUrl: null,
        mediaMimetype: null,
      };
    }

    // Imagem
    if (message.imageMessage) {
      return {
        tipoMidia: 'imagem',
        conteudoOriginal: message.imageMessage.caption || null,
        mediaUrl: message.imageMessage.url || null,
        mediaMimetype: message.imageMessage.mimetype || 'image/jpeg',
      };
    }

    // Áudio
    if (message.audioMessage) {
      return {
        tipoMidia: 'audio',
        conteudoOriginal: null,
        mediaUrl: message.audioMessage.url || null,
        mediaMimetype: message.audioMessage.mimetype || 'audio/ogg',
      };
    }

    // Documento
    if (message.documentMessage) {
      return {
        tipoMidia: 'documento',
        conteudoOriginal: message.documentMessage.caption || message.documentMessage.fileName || null,
        mediaUrl: message.documentMessage.url || null,
        mediaMimetype: message.documentMessage.mimetype || 'application/pdf',
      };
    }

    // Tipo desconhecido - tenta pegar algum texto
    return {
      tipoMidia: 'texto',
      conteudoOriginal: messageType ? `[${messageType}]` : null,
      mediaUrl: null,
      mediaMimetype: null,
    };
  }

  /**
   * Cria ou atualiza contato pelo telefone
   */
  private static async upsertContato(telefone: string, nome: string | null): Promise<GarimpadorContato> {
    const repo = AppDataSource.getRepository(GarimpadorContato);

    let contato = await repo.findOne({ where: { telefone } });
    if (contato) {
      // Atualizar nome se veio um novo
      if (nome && nome !== contato.nome) {
        contato.nome = nome;
        await repo.save(contato);
      }
      return contato;
    }

    // Criar novo
    contato = repo.create({
      telefone,
      nome,
      tipo: 'nao_classificado',
      ativo: true,
    });
    await repo.save(contato);
    console.log(`[Garimpador] Novo contato criado: ${nome || telefone}`);
    return contato;
  }

  /**
   * Lista todos os contatos com contagem de mensagens
   */
  static async listarContatos(): Promise<any[]> {
    const repo = AppDataSource.getRepository(GarimpadorContato);

    const contatos = await repo
      .createQueryBuilder('c')
      .leftJoin('c.mensagens', 'm')
      .select([
        'c.id as id',
        'c.telefone as telefone',
        'c.nome as nome',
        'c.tipo as tipo',
        'c.ativo as ativo',
        'c.created_at as "createdAt"',
        'COUNT(m.id) as "totalMensagens"',
        'MAX(m.received_at) as "ultimaMensagem"',
      ])
      .groupBy('c.id')
      .orderBy('MAX(m.received_at)', 'DESC', 'NULLS LAST')
      .getRawMany();

    return contatos;
  }

  /**
   * Atualiza o tipo de um contato (fornecedor/concorrente/nao_classificado)
   */
  static async atualizarTipoContato(id: number, tipo: string): Promise<GarimpadorContato | null> {
    const repo = AppDataSource.getRepository(GarimpadorContato);
    const contato = await repo.findOne({ where: { id } });

    if (!contato) return null;

    const tiposValidos = ['fornecedor', 'concorrente', 'nao_classificado'];
    if (!tiposValidos.includes(tipo)) {
      throw new Error(`Tipo inválido: ${tipo}. Valores aceitos: ${tiposValidos.join(', ')}`);
    }

    contato.tipo = tipo;
    await repo.save(contato);
    return contato;
  }

  /**
   * Lista mensagens com filtros e paginação
   */
  static async listarMensagens(filtros: {
    contatoId?: number;
    tipoMidia?: string;
    processado?: boolean;
    page?: number;
    limit?: number;
  }): Promise<{ mensagens: GarimpadorMensagem[]; total: number }> {
    const repo = AppDataSource.getRepository(GarimpadorMensagem);
    const page = filtros.page || 1;
    const limit = filtros.limit || 50;

    const qb = repo
      .createQueryBuilder('m')
      .leftJoinAndSelect('m.contato', 'c')
      .orderBy('m.received_at', 'DESC');

    if (filtros.contatoId) {
      qb.andWhere('m.contato_id = :contatoId', { contatoId: filtros.contatoId });
    }

    if (filtros.tipoMidia) {
      qb.andWhere('m.tipo_midia = :tipoMidia', { tipoMidia: filtros.tipoMidia });
    }

    if (filtros.processado !== undefined) {
      qb.andWhere('m.processado = :processado', { processado: filtros.processado });
    }

    const total = await qb.getCount();
    const mensagens = await qb
      .skip((page - 1) * limit)
      .take(limit)
      .getMany();

    return { mensagens, total };
  }

  /**
   * Estatísticas gerais
   */
  static async getEstatisticas(): Promise<{
    totalContatos: number;
    totalMensagens: number;
    naoClassificados: number;
    fornecedores: number;
    concorrentes: number;
    naoProcessadas: number;
  }> {
    const contatoRepo = AppDataSource.getRepository(GarimpadorContato);
    const msgRepo = AppDataSource.getRepository(GarimpadorMensagem);

    const [totalContatos, totalMensagens, naoClassificados, fornecedores, concorrentes, naoProcessadas] =
      await Promise.all([
        contatoRepo.count(),
        msgRepo.count(),
        contatoRepo.count({ where: { tipo: 'nao_classificado' } }),
        contatoRepo.count({ where: { tipo: 'fornecedor' } }),
        contatoRepo.count({ where: { tipo: 'concorrente' } }),
        msgRepo.count({ where: { processado: false } }),
      ]);

    return {
      totalContatos,
      totalMensagens,
      naoClassificados,
      fornecedores,
      concorrentes,
      naoProcessadas,
    };
  }
}
