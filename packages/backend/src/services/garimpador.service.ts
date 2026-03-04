import { AppDataSource } from '../config/database';
import { GarimpadorContato } from '../entities/GarimpadorContato';
import { GarimpadorMensagem } from '../entities/GarimpadorMensagem';
import { ConfigurationService } from './configuration.service';
import { minioService } from './minio.service';
import { GarimpadorProcessadorService } from './garimpador-processador.service';
import { GarimpadorComparadorService } from './garimpador-comparador.service';

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

      // Se é imagem/áudio/documento, baixar a mídia e salvar no MinIO (async, não bloqueia)
      if (tipoMidia !== 'texto' && messageId) {
        this.baixarESalvarMidia(mensagem, data).then(async () => {
          // Apos baixar midia, processar automaticamente se habilitado
          await this.autoProcessar(mensagem);
        }).catch(err => {
          console.error('[Garimpador] Erro ao baixar mídia (background):', err.message);
        });
      } else {
        // Texto: processar automaticamente se habilitado
        this.autoProcessar(mensagem).catch(() => {});
      }

      return { contato, mensagem };
    } catch (error) {
      console.error('[Garimpador] Erro ao processar webhook:', error);
      return null;
    }
  }

  /**
   * Processa mensagem automaticamente se habilitado nas configs
   * Fluxo: Extrair dados -> Comparar com Oracle -> Enviar para WhatsApp
   */
  private static async autoProcessar(mensagem: GarimpadorMensagem): Promise<void> {
    try {
      const autoProcessar = await ConfigurationService.get('garimpador_auto_processar', 'true');
      if (autoProcessar === 'false') return;

      // Recarregar a mensagem (pode ter sido atualizada com media_url do MinIO)
      const repo = AppDataSource.getRepository(GarimpadorMensagem);
      const msgAtualizada = await repo.findOne({ where: { id: mensagem.id }, relations: ['contato'] });
      if (!msgAtualizada || msgAtualizada.processado) return;

      // Etapa 1: Extrair produtos/precos da mensagem
      const extraido = await GarimpadorProcessadorService.processarMensagem(msgAtualizada);

      // Etapa 2: Se extraiu dados E o contato esta classificado, comparar e enviar
      if (extraido && msgAtualizada.contato?.tipo && msgAtualizada.contato.tipo !== 'nao_classificado') {
        try {
          const resultado = await GarimpadorComparadorService.compararEEnviar(msgAtualizada.id);
          console.log(`[Garimpador] Auto-comparacao: ${resultado.enviadas}/${resultado.total} enviadas para WhatsApp`);
        } catch (err: any) {
          console.error('[Garimpador] Erro na auto-comparacao:', err.message);
        }
      } else if (extraido) {
        console.log(`[Garimpador] Dados extraidos mas contato nao classificado - aguardando classificacao`);
      }
    } catch (error: any) {
      console.error('[Garimpador] Erro no auto-processamento:', error.message);
    }
  }

  /**
   * Baixa a mídia da Evolution API e salva no MinIO
   */
  private static async baixarESalvarMidia(mensagem: GarimpadorMensagem, webhookData: any): Promise<void> {
    try {
      const apiUrl = await ConfigurationService.get('evolution_api_url', process.env.EVOLUTION_API_URL || '');
      const apiToken = await ConfigurationService.get('evolution_api_token', process.env.EVOLUTION_API_TOKEN || '');
      const instance = await ConfigurationService.get('evolution_instance', process.env.EVOLUTION_INSTANCE || '');

      if (!apiUrl || !apiToken || !instance) return;

      // Endpoint para baixar mídia em base64
      const downloadUrl = `${apiUrl}/chat/getBase64FromMediaMessage/${encodeURIComponent(instance)}`;

      const response = await fetch(downloadUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'apikey': apiToken },
        body: JSON.stringify({ message: webhookData, convertToMp4: false })
      });

      if (!response.ok) {
        console.log(`[Garimpador] Não conseguiu baixar mídia: ${response.status}`);
        return;
      }

      const result = await response.json() as any;
      const base64Data = result?.base64;

      if (!base64Data) {
        console.log('[Garimpador] Resposta sem base64');
        return;
      }

      // Converter base64 para Buffer
      const buffer = Buffer.from(base64Data, 'base64');

      // Gerar nome do arquivo
      const ext = mensagem.media_mimetype?.split('/')[1] || 'bin';
      const fileName = `garimpador/${mensagem.contato_id}/${Date.now()}_${mensagem.id}.${ext}`;

      // Upload para MinIO
      const publicUrl = await minioService.uploadFile(fileName, buffer, mensagem.media_mimetype || 'application/octet-stream');

      // Atualizar a mensagem com a URL permanente do MinIO
      const msgRepo = AppDataSource.getRepository(GarimpadorMensagem);
      await msgRepo.update(mensagem.id, { media_url: publicUrl });

      console.log(`[Garimpador] Mídia salva no MinIO: ${publicUrl}`);
    } catch (error: any) {
      console.error('[Garimpador] Erro ao baixar/salvar mídia:', error.message);
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
      // Buscar foto se ainda não tem
      if (!contato.foto_url) {
        this.buscarFotoPerfil(contato).catch(() => {});
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

    // Buscar foto de perfil em background
    this.buscarFotoPerfil(contato).catch(err => {
      console.log('[Garimpador] Não conseguiu buscar foto de perfil:', err.message);
    });

    return contato;
  }

  /**
   * Busca a foto de perfil do contato via Evolution API
   */
  private static async buscarFotoPerfil(contato: GarimpadorContato): Promise<void> {
    const apiUrl = await ConfigurationService.get('evolution_api_url', process.env.EVOLUTION_API_URL || '');
    const apiToken = await ConfigurationService.get('evolution_api_token', process.env.EVOLUTION_API_TOKEN || '');
    const instance = await ConfigurationService.get('evolution_instance', process.env.EVOLUTION_INSTANCE || '');

    if (!apiUrl || !apiToken || !instance) return;

    const jid = `${contato.telefone}@s.whatsapp.net`;
    const profileUrl = `${apiUrl}/chat/fetchProfile/${encodeURIComponent(instance)}`;

    const response = await fetch(profileUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'apikey': apiToken },
      body: JSON.stringify({ number: jid })
    });

    if (!response.ok) return;

    const data = await response.json() as any;
    const pictureUrl = data?.picture || data?.profilePictureUrl || data?.imgUrl || null;

    if (pictureUrl) {
      const repo = AppDataSource.getRepository(GarimpadorContato);
      await repo.update(contato.id, { foto_url: pictureUrl });
      console.log(`[Garimpador] Foto de perfil salva para ${contato.nome || contato.telefone}`);
    }
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
        'c.foto_url as "fotoUrl"',
        'c.created_at as "createdAt"',
        'COUNT(m.id) as "totalMensagens"',
        'MAX(m.received_at) as "ultimaMensagem"',
      ])
      .groupBy('c.id')
      .orderBy('MAX(m.received_at)', 'DESC', 'NULLS LAST')
      .getRawMany();

    // Buscar fotos em background para contatos que ainda não têm
    const semFoto = contatos.filter(c => !c.fotoUrl && c.telefone);
    if (semFoto.length > 0) {
      for (const c of semFoto) {
        const contatoObj = Object.assign(new GarimpadorContato(), { id: c.id, telefone: c.telefone, nome: c.nome });
        this.buscarFotoPerfil(contatoObj).catch(() => {});
      }
    }

    return contatos;
  }

  /**
   * Atualiza o tipo de um contato (fornecedor/concorrente/nao_classificado)
   */
  static async atualizarTipoContato(id: number, tipo: string): Promise<GarimpadorContato | null> {
    const repo = AppDataSource.getRepository(GarimpadorContato);
    const contato = await repo.findOne({ where: { id } });

    if (!contato) return null;

    const tiposValidos = ['fornecedor', 'concorrente', 'neutro', 'nao_classificado'];
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
    neutros: number;
    naoProcessadas: number;
  }> {
    const contatoRepo = AppDataSource.getRepository(GarimpadorContato);
    const msgRepo = AppDataSource.getRepository(GarimpadorMensagem);

    const [totalContatos, totalMensagens, naoClassificados, fornecedores, concorrentes, neutros, naoProcessadas] =
      await Promise.all([
        contatoRepo.count(),
        msgRepo.count(),
        contatoRepo.count({ where: { tipo: 'nao_classificado' } }),
        contatoRepo.count({ where: { tipo: 'fornecedor' } }),
        contatoRepo.count({ where: { tipo: 'concorrente' } }),
        contatoRepo.count({ where: { tipo: 'neutro' } }),
        msgRepo.count({ where: { processado: false } }),
      ]);

    return {
      totalContatos,
      totalMensagens,
      naoClassificados,
      fornecedores,
      concorrentes,
      neutros,
      naoProcessadas,
    };
  }
}
