import { randomBytes } from 'crypto';
import { AppDataSource } from '../config/database';
import { AuditAction } from '../entities/AuditAction';
import { AuditInspection } from '../entities/AuditInspection';
import { AuditResponse } from '../entities/AuditResponse';
import { AuditTemplateQuestion } from '../entities/AuditTemplateQuestion';
import { AuditAlternativeModel } from '../entities/AuditAlternativeModel';
import { WhatsAppService } from './whatsapp.service';

/**
 * Servico responsavel por processar alertas gerados durante uma auditoria.
 * Para cada resposta marcada numa alternativa com `generates_alert: true` +
 * `whatsapp_group_id`, cria um AuditAction com token de resolucao publico e
 * envia mensagem para o grupo WhatsApp configurado.
 */
export class ChecklistAlertService {
  /**
   * Gera token unico hexadecimal (32 chars) para o link publico.
   */
  private static generateToken(): string {
    return randomBytes(16).toString('hex');
  }

  /**
   * Monta a URL publica de resolucao do alerta.
   * Tenta inferir via headers; fallback para env PUBLIC_BASE_URL.
   */
  private static buildPublicUrl(token: string, baseUrl?: string): string {
    const base = baseUrl || process.env.PUBLIC_BASE_URL || '';
    if (base) return `${base.replace(/\/$/, '')}/alerta/${token}`;
    // fallback relativo
    return `/alerta/${token}`;
  }

  /**
   * Processa todos os alertas de uma inspection finalizada.
   * Idempotente: pula alertas que ja foram criados (por inspection_id + question_id).
   */
  static async processarAlertasDaInspecao(
    inspectionId: number,
    opts: { baseUrl?: string } = {}
  ): Promise<{ criados: number; enviados: number; falhas: number }> {
    const insRepo = AppDataSource.getRepository(AuditInspection);
    const respRepo = AppDataSource.getRepository(AuditResponse);
    const questionRepo = AppDataSource.getRepository(AuditTemplateQuestion);
    const modeloRepo = AppDataSource.getRepository(AuditAlternativeModel);
    const actionRepo = AppDataSource.getRepository(AuditAction);

    const inspection = await insRepo.findOne({
      where: { id: inspectionId },
      relations: ['template', 'auditor', 'auditado'],
    });
    if (!inspection) {
      console.warn(`[ChecklistAlert] Inspection ${inspectionId} nao encontrada`);
      return { criados: 0, enviados: 0, falhas: 0 };
    }

    const respostas = await respRepo.find({
      where: { inspection_id: inspectionId },
    });

    let criados = 0, enviados = 0, falhas = 0;

    for (const resp of respostas) {
      if (!resp.valor_opcao && resp.conforme == null) continue;

      const question = await questionRepo.findOne({
        where: { id: resp.question_id },
        relations: ['section'],
      });
      if (!question) continue;

      const altCfgs: any[] = Array.isArray(question.alternativas_config) ? question.alternativas_config : [];
      if (altCfgs.length === 0) continue;

      // Identifica a alternativa escolhida. valor_opcao guarda o LABEL.
      const modelo = question.modelo_alternativa_id
        ? await modeloRepo.findOne({ where: { id: question.modelo_alternativa_id } })
        : null;
      const alternativas: any[] = Array.isArray(modelo?.alternativas) ? (modelo!.alternativas as any[]) : [];

      let cfg: any = null;
      let alternativaEscolhida: any = null;

      if (resp.valor_opcao) {
        alternativaEscolhida = alternativas.find(a =>
          (a.label || '').toLowerCase().trim() === (resp.valor_opcao || '').toLowerCase().trim()
        );
        if (alternativaEscolhida) {
          cfg = altCfgs.find(c => c.ordem === alternativaEscolhida.ordem);
        }
      }

      if (!cfg || !cfg.generates_alert) continue;
      if (!cfg.whatsapp_group_id) continue;

      // Evita duplicidade (mesma inspection + question ja tem AuditAction de alerta_auditoria)
      const existente = await actionRepo.findOne({
        where: {
          inspection_id: inspection.id,
          question_id: question.id,
          origem: 'alerta_auditoria',
        } as any,
      });
      if (existente) continue;

      const token = this.generateToken();
      const action = actionRepo.create({
        inspection_id: inspection.id,
        response_id: resp.id,
        what: `[ALERTA] ${question.texto}`.substring(0, 500),
        why: resp.observacao || `Resposta "${resp.valor_opcao}" gerou alerta.`,
        criticidade: 'alta',
        status: 'aberta',
        cod_loja: inspection.cod_loja ?? null,
        resolucao_token: token,
        resolucao_historico: [],
        origem: 'alerta_auditoria',
        whatsapp_group_id: cfg.whatsapp_group_id,
        whatsapp_group_name: cfg.whatsapp_group_name || null,
        question_id: question.id,
      } as Partial<AuditAction>);

      await actionRepo.save(action);
      criados++;

      // Monta mensagem WhatsApp
      const linkResolucao = this.buildPublicUrl(token, opts.baseUrl);
      const secaoNome = (question as any).section?.nome || 'Sem secao';
      const fotosUrls: string[] = Array.isArray(resp.fotos) ? resp.fotos.map((f: any) => f.url).filter(Boolean) : [];

      const msg = [
        '🚨 *ALERTA DE AUDITORIA*',
        '',
        `🗂️ *Roteiro:* ${inspection.template?.nome || '—'}`,
        `📂 *Seção:* ${secaoNome}`,
        `❓ *Pergunta:* ${question.texto}`,
        `🔴 *Resposta:* ${resp.valor_opcao || alternativaEscolhida?.label || 'alerta'}`,
        resp.observacao ? `📝 *Observação:* ${resp.observacao}` : null,
        '',
        `👤 *Auditor:* ${inspection.auditor?.name || '—'}`,
        inspection.auditado ? `🎯 *Auditado:* ${inspection.auditado.name}` : null,
        inspection.cod_loja != null ? `🏪 *Loja:* ${inspection.cod_loja}` : null,
        `📅 *Data:* ${new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}`,
        '',
        fotosUrls.length > 0 ? `📸 *Evidências (${fotosUrls.length}):*` : null,
        ...fotosUrls.slice(0, 5).map(u => u),
        '',
        '🛠️ *Resolva esta pendência:*',
        linkResolucao,
      ].filter(Boolean).join('\n');

      const ok = await WhatsAppService.sendMessage(cfg.whatsapp_group_id, msg);
      if (ok) {
        action.whatsapp_sent_at = new Date();
        await actionRepo.save(action);
        enviados++;
      } else {
        falhas++;
        console.warn(`[ChecklistAlert] Falha ao enviar WhatsApp para grupo ${cfg.whatsapp_group_id} (action ${action.id})`);
      }
    }

    return { criados, enviados, falhas };
  }

  /**
   * Aplica uma resolucao no AuditAction via token publico.
   */
  static async aplicarResolucao(params: {
    token: string;
    tipo: 'previamente' | 'definitivamente';
    mensagem: string;
    autor: string;
  }): Promise<AuditAction | null> {
    const { token, tipo, mensagem, autor } = params;
    const actionRepo = AppDataSource.getRepository(AuditAction);
    const action = await actionRepo.findOne({ where: { resolucao_token: token } as any });
    if (!action) return null;

    const entry = {
      tipo,
      mensagem: (mensagem || '').trim(),
      autor: (autor || '').trim() || 'Anonimo',
      timestamp: new Date().toISOString(),
    };
    const historico = Array.isArray(action.resolucao_historico) ? action.resolucao_historico : [];
    historico.push(entry);
    action.resolucao_historico = historico;

    if (tipo === 'definitivamente') {
      action.status = 'concluida';
      action.concluido_em = new Date();
      action.how = entry.mensagem;
    } else {
      action.status = 'em_andamento';
    }

    await actionRepo.save(action);
    return action;
  }

  /**
   * Busca dados publicos do alerta por token (para a pagina de resolucao).
   */
  static async obterPorToken(token: string): Promise<any | null> {
    const actionRepo = AppDataSource.getRepository(AuditAction);
    const action = await actionRepo.findOne({
      where: { resolucao_token: token } as any,
      relations: ['inspection', 'inspection.template', 'inspection.auditor', 'inspection.auditado', 'response'],
    });
    if (!action) return null;

    // Carrega a pergunta + fotos da resposta
    let questionTexto: string | null = null;
    let secaoNome: string | null = null;
    let fotos: string[] = [];
    if (action.question_id) {
      const q = await AppDataSource.getRepository(AuditTemplateQuestion).findOne({
        where: { id: action.question_id },
        relations: ['section'],
      });
      if (q) {
        questionTexto = q.texto;
        secaoNome = (q as any).section?.nome || null;
      }
    }
    if (action.response) {
      fotos = Array.isArray(action.response.fotos) ? action.response.fotos.map((f: any) => f.url).filter(Boolean) : [];
    }

    return {
      id: action.id,
      status: action.status,
      criticidade: action.criticidade,
      what: action.what,
      why: action.why,
      how: action.how,
      cod_loja: action.cod_loja,
      created_at: action.created_at,
      concluido_em: action.concluido_em,
      resolucao_historico: action.resolucao_historico || [],
      roteiro: action.inspection?.template?.nome || null,
      secao: secaoNome,
      pergunta: questionTexto,
      resposta: action.response?.valor_opcao || null,
      observacao: action.response?.observacao || null,
      auditor: action.inspection?.auditor?.name || null,
      auditado: action.inspection?.auditado?.name || null,
      fotos,
    };
  }
}
