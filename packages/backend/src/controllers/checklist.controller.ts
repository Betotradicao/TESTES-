import { Request, Response } from 'express';
import { AppDataSource } from '../config/database';
import { AuditTemplate } from '../entities/AuditTemplate';
import { AuditTemplateSection } from '../entities/AuditTemplateSection';
import { AuditTemplateQuestion } from '../entities/AuditTemplateQuestion';
import { AuditInspection } from '../entities/AuditInspection';
import { AuditResponse } from '../entities/AuditResponse';
import { AuditAction } from '../entities/AuditAction';
import { AuditActionHistory } from '../entities/AuditActionHistory';
import { AuditAlternativeModel } from '../entities/AuditAlternativeModel';
import { Employee } from '../entities/Employee';
import { Sector } from '../entities/Sector';
import { minioService } from '../services/minio.service';

export class ChecklistController {

  // ========== TEMPLATES ==========

  static async listarTemplates(req: Request, res: Response) {
    try {
      const codLoja = req.query.cod_loja ? parseInt(req.query.cod_loja as string) : undefined;
      const auditorId = req.query.auditor_id as string | undefined;
      const repo = AppDataSource.getRepository(AuditTemplate);
      const qb = repo.createQueryBuilder('t').orderBy('t.id', 'DESC');
      if (codLoja !== undefined) {
        qb.where('t.cod_loja IS NULL OR t.cod_loja = :codLoja', { codLoja });
      }
      let list = await qb.getMany();
      // Filtro por auditor: retorna templates onde grupos_acesso esta vazio OU contem o auditor_id
      if (auditorId) {
        list = list.filter(t => {
          const grupos = Array.isArray(t.grupos_acesso) ? t.grupos_acesso : [];
          return grupos.length === 0 || grupos.includes(auditorId);
        }).filter(t => t.ativo);
      }
      res.json({ success: true, templates: list });
    } catch (e: any) {
      console.error('[Checklist] listarTemplates:', e);
      res.status(500).json({ success: false, error: e.message });
    }
  }

  static async obterTemplate(req: Request, res: Response) {
    try {
      const id = parseInt(req.params.id);
      const repo = AppDataSource.getRepository(AuditTemplate);
      const t = await repo.findOne({ where: { id } });
      if (!t) return res.status(404).json({ success: false, error: 'Template nao encontrado' });
      const sections = await AppDataSource.getRepository(AuditTemplateSection)
        .createQueryBuilder('s').where('s.template_id = :id', { id }).orderBy('s.ordem', 'ASC').addOrderBy('s.id', 'ASC').getMany();
      const sectionIds = sections.map(s => s.id);
      const questions = sectionIds.length === 0 ? [] : await AppDataSource.getRepository(AuditTemplateQuestion)
        .createQueryBuilder('q').where('q.section_id IN (:...ids)', { ids: sectionIds }).orderBy('q.ordem', 'ASC').addOrderBy('q.id', 'ASC').getMany();
      const sectionsComPerguntas = sections.map(s => ({
        ...s,
        questions: questions.filter(q => q.section_id === s.id),
      }));
      res.json({ success: true, template: { ...t, sections: sectionsComPerguntas } });
    } catch (e: any) {
      console.error('[Checklist] obterTemplate:', e);
      res.status(500).json({ success: false, error: e.message });
    }
  }

  static async criarTemplate(req: Request, res: Response) {
    try {
      const { nome, descricao, observacao, cod_loja, ativo, minimo_esperado, grupos_acesso,
              grupos_acesso_auditados,
              prazo_alta_horas, prazo_media_dias, prazo_baixa_dias, created_by } = req.body;
      if (!nome) return res.status(400).json({ success: false, error: 'Campo "nome" obrigatorio' });
      const repo = AppDataSource.getRepository(AuditTemplate);
      const t = repo.create({
        nome, descricao: descricao ?? null, observacao: observacao ?? null, cod_loja,
        ativo: ativo !== false,
        minimo_esperado: minimo_esperado ?? 95,
        grupos_acesso: Array.isArray(grupos_acesso) ? grupos_acesso : [],
        grupos_acesso_auditados: Array.isArray(grupos_acesso_auditados) ? grupos_acesso_auditados : [],
        prazo_alta_horas: prazo_alta_horas || 24,
        prazo_media_dias: prazo_media_dias || 7,
        prazo_baixa_dias: prazo_baixa_dias || 30,
        created_by,
      });
      await repo.save(t);
      res.json({ success: true, template: t });
    } catch (e: any) {
      console.error('[Checklist] criarTemplate:', e);
      res.status(500).json({ success: false, error: e.message });
    }
  }

  static async atualizarTemplate(req: Request, res: Response) {
    try {
      const id = parseInt(req.params.id);
      const repo = AppDataSource.getRepository(AuditTemplate);
      const t = await repo.findOne({ where: { id } });
      if (!t) return res.status(404).json({ success: false, error: 'Template nao encontrado' });
      const { nome, descricao, observacao, cod_loja, ativo, minimo_esperado, grupos_acesso,
              grupos_acesso_auditados,
              prazo_alta_horas, prazo_media_dias, prazo_baixa_dias } = req.body;
      if (nome !== undefined) t.nome = nome;
      if (descricao !== undefined) t.descricao = descricao;
      if (observacao !== undefined) t.observacao = observacao;
      if (cod_loja !== undefined) t.cod_loja = cod_loja;
      if (ativo !== undefined) t.ativo = ativo;
      if (minimo_esperado !== undefined) t.minimo_esperado = minimo_esperado;
      if (grupos_acesso !== undefined) t.grupos_acesso = Array.isArray(grupos_acesso) ? grupos_acesso : [];
      if (grupos_acesso_auditados !== undefined) t.grupos_acesso_auditados = Array.isArray(grupos_acesso_auditados) ? grupos_acesso_auditados : [];
      if (prazo_alta_horas !== undefined) t.prazo_alta_horas = prazo_alta_horas;
      if (prazo_media_dias !== undefined) t.prazo_media_dias = prazo_media_dias;
      if (prazo_baixa_dias !== undefined) t.prazo_baixa_dias = prazo_baixa_dias;
      await repo.save(t);
      res.json({ success: true, template: t });
    } catch (e: any) {
      console.error('[Checklist] atualizarTemplate:', e);
      res.status(500).json({ success: false, error: e.message });
    }
  }

  static async deletarTemplate(req: Request, res: Response) {
    try {
      const id = parseInt(req.params.id);
      const tRepo = AppDataSource.getRepository(AuditTemplate);
      const template = await tRepo.findOne({ where: { id } });
      if (!template) return res.status(404).json({ success: false, error: 'Template nao encontrado' });

      // Se ja tem auditorias aplicadas, faz soft-delete pra preservar historico
      const inspCount = await AppDataSource.getRepository(AuditInspection)
        .createQueryBuilder('i').where('i.template_id = :id', { id }).getCount();
      if (inspCount > 0) {
        template.ativo = false;
        await tRepo.save(template);
        return res.json({
          success: true,
          softDelete: true,
          message: `Template possui ${inspCount} auditoria(s). Foi marcado como inativo pra preservar o historico.`,
        });
      }

      await tRepo.delete(id);
      res.json({ success: true, softDelete: false });
    } catch (e: any) {
      console.error('[Checklist] deletarTemplate:', e);
      res.status(500).json({ success: false, error: e.message });
    }
  }

  // ========== SECTIONS ==========

  static async criarSection(req: Request, res: Response) {
    try {
      const template_id = parseInt(req.params.templateId);
      const { nome, sector_id, ordem } = req.body;
      if (!nome) return res.status(400).json({ success: false, error: 'Campo "nome" obrigatorio' });
      const repo = AppDataSource.getRepository(AuditTemplateSection);
      const s = repo.create({ template_id, nome, sector_id: sector_id || null, ordem: ordem || 0 });
      await repo.save(s);
      res.json({ success: true, section: s });
    } catch (e: any) {
      console.error('[Checklist] criarSection:', e);
      res.status(500).json({ success: false, error: e.message });
    }
  }

  static async atualizarSection(req: Request, res: Response) {
    try {
      const id = parseInt(req.params.id);
      const repo = AppDataSource.getRepository(AuditTemplateSection);
      const s = await repo.findOne({ where: { id } });
      if (!s) return res.status(404).json({ success: false, error: 'Secao nao encontrada' });
      const { nome, sector_id, ordem } = req.body;
      if (nome !== undefined) s.nome = nome;
      if (sector_id !== undefined) s.sector_id = sector_id;
      if (ordem !== undefined) s.ordem = ordem;
      await repo.save(s);
      res.json({ success: true, section: s });
    } catch (e: any) {
      console.error('[Checklist] atualizarSection:', e);
      res.status(500).json({ success: false, error: e.message });
    }
  }

  static async deletarSection(req: Request, res: Response) {
    try {
      const id = parseInt(req.params.id);
      await AppDataSource.getRepository(AuditTemplateSection).delete(id);
      res.json({ success: true });
    } catch (e: any) {
      console.error('[Checklist] deletarSection:', e);
      res.status(500).json({ success: false, error: e.message });
    }
  }

  // ========== QUESTIONS ==========

  static async criarQuestion(req: Request, res: Response) {
    try {
      const section_id = parseInt(req.params.sectionId);
      const { texto, tipo, criticidade, peso, foto_obrigatoria, opcoes, ordem,
              modelo_alternativa_id, alternativas_config, imagens_referencia,
              hora_inicio, hora_fim,
              dias_semana, dias_mes_especificos, primeiro_dia_mes, ultimo_dia_mes } = req.body;
      if (!texto) return res.status(400).json({ success: false, error: 'Campo "texto" obrigatorio' });
      const repo = AppDataSource.getRepository(AuditTemplateQuestion);
      const q = repo.create({
        section_id,
        texto,
        tipo: tipo || 'conforme',
        criticidade: criticidade || 'media',
        peso: peso ?? 1,
        foto_obrigatoria: !!foto_obrigatoria,
        opcoes: opcoes || null,
        ordem: ordem || 0,
        modelo_alternativa_id: modelo_alternativa_id ?? null,
        alternativas_config: Array.isArray(alternativas_config) ? alternativas_config : [],
        imagens_referencia: Array.isArray(imagens_referencia) ? imagens_referencia : [],
        hora_inicio: hora_inicio || null,
        hora_fim: hora_fim || null,
        dias_semana: Array.isArray(dias_semana) ? dias_semana : [],
        dias_mes_especificos: Array.isArray(dias_mes_especificos) ? dias_mes_especificos : [],
        primeiro_dia_mes: !!primeiro_dia_mes,
        ultimo_dia_mes: !!ultimo_dia_mes,
      });
      await repo.save(q);
      res.json({ success: true, question: q });
    } catch (e: any) {
      console.error('[Checklist] criarQuestion:', e);
      res.status(500).json({ success: false, error: e.message });
    }
  }

  static async atualizarQuestion(req: Request, res: Response) {
    try {
      const id = parseInt(req.params.id);
      const repo = AppDataSource.getRepository(AuditTemplateQuestion);
      const q = await repo.findOne({ where: { id } });
      if (!q) return res.status(404).json({ success: false, error: 'Pergunta nao encontrada' });
      const { texto, tipo, criticidade, peso, foto_obrigatoria, opcoes, ordem,
              modelo_alternativa_id, alternativas_config, imagens_referencia,
              hora_inicio, hora_fim,
              dias_semana, dias_mes_especificos, primeiro_dia_mes, ultimo_dia_mes } = req.body;
      if (texto !== undefined) q.texto = texto;
      if (tipo !== undefined) q.tipo = tipo;
      if (criticidade !== undefined) q.criticidade = criticidade;
      if (peso !== undefined) q.peso = peso;
      if (foto_obrigatoria !== undefined) q.foto_obrigatoria = foto_obrigatoria;
      if (opcoes !== undefined) q.opcoes = opcoes;
      if (ordem !== undefined) q.ordem = ordem;
      if (modelo_alternativa_id !== undefined) q.modelo_alternativa_id = modelo_alternativa_id;
      if (alternativas_config !== undefined) q.alternativas_config = Array.isArray(alternativas_config) ? alternativas_config : [];
      if (imagens_referencia !== undefined) q.imagens_referencia = Array.isArray(imagens_referencia) ? imagens_referencia : [];
      if (hora_inicio !== undefined) q.hora_inicio = hora_inicio || null;
      if (hora_fim !== undefined) q.hora_fim = hora_fim || null;
      if (dias_semana !== undefined) q.dias_semana = Array.isArray(dias_semana) ? dias_semana : [];
      if (dias_mes_especificos !== undefined) q.dias_mes_especificos = Array.isArray(dias_mes_especificos) ? dias_mes_especificos : [];
      if (primeiro_dia_mes !== undefined) q.primeiro_dia_mes = !!primeiro_dia_mes;
      if (ultimo_dia_mes !== undefined) q.ultimo_dia_mes = !!ultimo_dia_mes;
      await repo.save(q);
      res.json({ success: true, question: q });
    } catch (e: any) {
      console.error('[Checklist] atualizarQuestion:', e);
      res.status(500).json({ success: false, error: e.message });
    }
  }

  static async deletarQuestion(req: Request, res: Response) {
    try {
      const id = parseInt(req.params.id);
      await AppDataSource.getRepository(AuditTemplateQuestion).delete(id);
      res.json({ success: true });
    } catch (e: any) {
      console.error('[Checklist] deletarQuestion:', e);
      res.status(500).json({ success: false, error: e.message });
    }
  }

  // ========== MODELOS DE ALTERNATIVAS ==========

  static async listarModelos(req: Request, res: Response) {
    try {
      const list = await AppDataSource.getRepository(AuditAlternativeModel)
        .createQueryBuilder('m')
        .where('m.ativo = :a', { a: true })
        .orderBy('m.nome', 'ASC').getMany();
      res.json({ success: true, modelos: list });
    } catch (e: any) {
      console.error('[Checklist] listarModelos:', e);
      res.status(500).json({ success: false, error: e.message });
    }
  }

  static async obterModelo(req: Request, res: Response) {
    try {
      const id = parseInt(req.params.id);
      const m = await AppDataSource.getRepository(AuditAlternativeModel).findOne({ where: { id } });
      if (!m) return res.status(404).json({ success: false, error: 'Modelo nao encontrado' });
      res.json({ success: true, modelo: m });
    } catch (e: any) {
      console.error('[Checklist] obterModelo:', e);
      res.status(500).json({ success: false, error: e.message });
    }
  }

  static async criarModelo(req: Request, res: Response) {
    try {
      const { nome, tipo, alternativas, ativo } = req.body;
      if (!nome) return res.status(400).json({ success: false, error: 'Campo "nome" obrigatorio' });
      const repo = AppDataSource.getRepository(AuditAlternativeModel);
      const m = repo.create({
        nome,
        tipo: tipo || 'icones',
        alternativas: Array.isArray(alternativas) ? alternativas : [],
        ativo: ativo !== false,
      });
      await repo.save(m);
      res.json({ success: true, modelo: m });
    } catch (e: any) {
      console.error('[Checklist] criarModelo:', e);
      res.status(500).json({ success: false, error: e.message });
    }
  }

  static async atualizarModelo(req: Request, res: Response) {
    try {
      const id = parseInt(req.params.id);
      const repo = AppDataSource.getRepository(AuditAlternativeModel);
      const m = await repo.findOne({ where: { id } });
      if (!m) return res.status(404).json({ success: false, error: 'Modelo nao encontrado' });
      const { nome, tipo, alternativas, ativo } = req.body;
      if (nome !== undefined) m.nome = nome;
      if (tipo !== undefined) m.tipo = tipo;
      if (alternativas !== undefined) m.alternativas = Array.isArray(alternativas) ? alternativas : [];
      if (ativo !== undefined) m.ativo = ativo;
      await repo.save(m);
      res.json({ success: true, modelo: m });
    } catch (e: any) {
      console.error('[Checklist] atualizarModelo:', e);
      res.status(500).json({ success: false, error: e.message });
    }
  }

  static async deletarModelo(req: Request, res: Response) {
    try {
      const id = parseInt(req.params.id);
      // Soft-delete: apenas marca inativo pra nao quebrar perguntas que referenciam
      const repo = AppDataSource.getRepository(AuditAlternativeModel);
      const m = await repo.findOne({ where: { id } });
      if (!m) return res.status(404).json({ success: false, error: 'Modelo nao encontrado' });
      m.ativo = false;
      await repo.save(m);
      res.json({ success: true });
    } catch (e: any) {
      console.error('[Checklist] deletarModelo:', e);
      res.status(500).json({ success: false, error: e.message });
    }
  }

  // ========== AUDITORES / AUDITADOS (employees filtrados por flag) ==========

  static async listarAuditores(req: Request, res: Response) {
    try {
      const codLoja = req.query.cod_loja ? parseInt(req.query.cod_loja as string) : undefined;
      const qb = AppDataSource.getRepository(Employee).createQueryBuilder('e')
        .where('e.is_auditor = :t', { t: true })
        .andWhere('e.active = :a', { a: true })
        .orderBy('e.name', 'ASC');
      if (codLoja !== undefined) qb.andWhere('e.cod_loja = :codLoja', { codLoja });
      const list = await qb.getMany();
      res.json({ success: true, auditores: list });
    } catch (e: any) {
      console.error('[Checklist] listarAuditores:', e);
      res.status(500).json({ success: false, error: e.message });
    }
  }

  static async listarAuditados(req: Request, res: Response) {
    try {
      const codLoja = req.query.cod_loja ? parseInt(req.query.cod_loja as string) : undefined;
      const qb = AppDataSource.getRepository(Employee).createQueryBuilder('e')
        .where('e.is_auditado = :t', { t: true })
        .andWhere('e.active = :a', { a: true })
        .orderBy('e.name', 'ASC');
      if (codLoja !== undefined) qb.andWhere('e.cod_loja = :codLoja', { codLoja });
      const list = await qb.getMany();
      res.json({ success: true, auditados: list });
    } catch (e: any) {
      console.error('[Checklist] listarAuditados:', e);
      res.status(500).json({ success: false, error: e.message });
    }
  }

  // ========== SETORES (reutiliza sectors) ==========

  static async listarSetores(req: Request, res: Response) {
    try {
      const codLoja = req.query.cod_loja ? parseInt(req.query.cod_loja as string) : undefined;
      const qb = AppDataSource.getRepository(Sector).createQueryBuilder('s')
        .where('s.active = :a', { a: true })
        .orderBy('s.name', 'ASC');
      if (codLoja !== undefined) qb.andWhere('s.cod_loja IS NULL OR s.cod_loja = :codLoja', { codLoja });
      const list = await qb.getMany();
      res.json({ success: true, setores: list });
    } catch (e: any) {
      console.error('[Checklist] listarSetores:', e);
      res.status(500).json({ success: false, error: e.message });
    }
  }

  // ========== INSPECTIONS ==========

  /**
   * DELETE /api/checklist/inspections/:id — exclui auditoria e dados relacionados (cascade via FK).
   */
  static async deletarInspection(req: Request, res: Response) {
    try {
      const id = parseInt(req.params.id);
      const repo = AppDataSource.getRepository(AuditInspection);
      const ins = await repo.findOne({ where: { id } });
      if (!ins) return res.status(404).json({ success: false, error: 'Auditoria nao encontrada' });
      await repo.delete(id);
      res.json({ success: true });
    } catch (e: any) {
      console.error('[Checklist] deletarInspection:', e);
      res.status(500).json({ success: false, error: e.message });
    }
  }

  static async listarInspections(req: Request, res: Response) {
    try {
      const codLoja = req.query.cod_loja ? parseInt(req.query.cod_loja as string) : undefined;
      const status = req.query.status as string | undefined;
      const qb = AppDataSource.getRepository(AuditInspection).createQueryBuilder('i')
        .leftJoinAndSelect('i.template', 't')
        .leftJoinAndSelect('i.auditor', 'auditor')
        .leftJoinAndSelect('i.auditado', 'auditado')
        .orderBy('i.created_at', 'DESC')
        .limit(200);
      if (codLoja !== undefined) qb.andWhere('i.cod_loja = :codLoja', { codLoja });
      if (status) qb.andWhere('i.status = :status', { status });
      const list = await qb.getMany();

      // Agrega contagem de positivas/negativas/NA por inspection
      const ids = list.map(i => i.id);
      let contagens: Record<number, { positivas: number; negativas: number; na: number }> = {};
      if (ids.length > 0) {
        const rawCounts: any[] = await AppDataSource.getRepository(AuditResponse)
          .createQueryBuilder('r')
          .select('r.inspection_id', 'inspection_id')
          .addSelect(`SUM(CASE WHEN r.conforme = 'C' THEN 1 ELSE 0 END)`, 'positivas')
          .addSelect(`SUM(CASE WHEN r.conforme = 'NC' THEN 1 ELSE 0 END)`, 'negativas')
          .addSelect(`SUM(CASE WHEN r.conforme = 'NA' AND COALESCE(r.valor_opcao,'') NOT ILIKE '%alerta%' THEN 1 ELSE 0 END)`, 'na')
          .addSelect(`SUM(CASE WHEN COALESCE(r.valor_opcao,'') ILIKE '%alerta%' THEN 1 ELSE 0 END)`, 'alertas')
          .where('r.inspection_id IN (:...ids)', { ids })
          .groupBy('r.inspection_id')
          .getRawMany();
        for (const row of rawCounts) {
          contagens[Number(row.inspection_id)] = {
            positivas: Number(row.positivas) || 0,
            negativas: Number(row.negativas) || 0,
            na: Number(row.na) || 0,
            alertas: Number(row.alertas) || 0,
          } as any;
        }
      }
      const enriched = list.map(i => ({
        ...i,
        positivas: contagens[i.id]?.positivas || 0,
        negativas: contagens[i.id]?.negativas || 0,
        nao_aplica: contagens[i.id]?.na || 0,
        alertas: (contagens[i.id] as any)?.alertas || 0,
      }));

      res.json({ success: true, inspections: enriched });
    } catch (e: any) {
      console.error('[Checklist] listarInspections:', e);
      res.status(500).json({ success: false, error: e.message });
    }
  }

  static async obterInspection(req: Request, res: Response) {
    try {
      const id = parseInt(req.params.id);
      const ins = await AppDataSource.getRepository(AuditInspection).findOne({
        where: { id },
        relations: ['template', 'auditor', 'auditado'],
      });
      if (!ins) return res.status(404).json({ success: false, error: 'Inspecao nao encontrada' });
      const responses = await AppDataSource.getRepository(AuditResponse).find({
        where: { inspection_id: id },
        relations: ['question'],
      });
      res.json({ success: true, inspection: { ...ins, responses } });
    } catch (e: any) {
      console.error('[Checklist] obterInspection:', e);
      res.status(500).json({ success: false, error: e.message });
    }
  }

  static async criarInspection(req: Request, res: Response) {
    try {
      const { template_id, auditor_id, auditado_id, cod_loja, gps_inicio_lat, gps_inicio_lng } = req.body;
      if (!template_id || !auditor_id) {
        return res.status(400).json({ success: false, error: 'template_id e auditor_id sao obrigatorios' });
      }
      const repo = AppDataSource.getRepository(AuditInspection);
      const ins = repo.create({
        template_id,
        auditor_id,
        auditado_id: auditado_id || null,
        cod_loja: cod_loja ?? null,
        status: 'rascunho',
        started_at: new Date(),
        gps_inicio_lat: gps_inicio_lat ?? null,
        gps_inicio_lng: gps_inicio_lng ?? null,
      });
      await repo.save(ins);
      res.json({ success: true, inspection: ins });
    } catch (e: any) {
      console.error('[Checklist] criarInspection:', e);
      res.status(500).json({ success: false, error: e.message });
    }
  }

  static async salvarResposta(req: Request, res: Response) {
    try {
      const inspection_id = parseInt(req.params.id);
      const { question_id, conforme, valor_texto, valor_numero, valor_opcao, observacao, fotos, gps_lat, gps_lng } = req.body;
      if (!question_id) return res.status(400).json({ success: false, error: 'question_id obrigatorio' });
      const repo = AppDataSource.getRepository(AuditResponse);
      const qRepo = AppDataSource.getRepository(AuditTemplateQuestion);
      const question = await qRepo.findOne({ where: { id: question_id } });
      if (!question) return res.status(404).json({ success: false, error: 'Pergunta nao encontrada' });
      // Upsert: uma resposta por (inspection, question)
      let resp = await repo.findOne({ where: { inspection_id, question_id } });
      if (!resp) {
        resp = repo.create({ inspection_id, question_id });
      }
      if (conforme !== undefined) resp.conforme = conforme;
      if (valor_texto !== undefined) resp.valor_texto = valor_texto;
      if (valor_numero !== undefined) resp.valor_numero = valor_numero;
      if (valor_opcao !== undefined) resp.valor_opcao = valor_opcao;
      if (observacao !== undefined) resp.observacao = observacao;
      if (Array.isArray(fotos)) resp.fotos = fotos;
      if (gps_lat !== undefined) resp.gps_lat = gps_lat;
      if (gps_lng !== undefined) resp.gps_lng = gps_lng;
      // Calculo simples de score: conforme=peso, NC=0, NA=peso (nao penaliza)
      const peso = Number(question.peso) || 1;
      if (resp.conforme === 'C' || resp.conforme === 'NA') resp.score_obtido = peso;
      else if (resp.conforme === 'NC') resp.score_obtido = 0;
      await repo.save(resp);
      res.json({ success: true, response: resp });
    } catch (e: any) {
      console.error('[Checklist] salvarResposta:', e);
      res.status(500).json({ success: false, error: e.message });
    }
  }

  static async finalizarInspection(req: Request, res: Response) {
    try {
      const id = parseInt(req.params.id);
      const { observacao_geral, assinatura_auditor_url, assinatura_auditado_url } = req.body;
      const repo = AppDataSource.getRepository(AuditInspection);
      const ins = await repo.findOne({ where: { id } });
      if (!ins) return res.status(404).json({ success: false, error: 'Inspecao nao encontrada' });
      // Calcular score final a partir das respostas
      const responses = await AppDataSource.getRepository(AuditResponse).find({
        where: { inspection_id: id },
        relations: ['question'],
      });
      let score = 0;
      let scoreMax = 0;
      for (const r of responses) {
        const peso = Number(r.question?.peso) || 1;
        if (r.conforme === 'NA') continue; // nao conta
        scoreMax += peso;
        score += Number(r.score_obtido) || 0;
      }
      ins.score_final = score;
      ins.score_max = scoreMax;
      ins.percentual_conformidade = scoreMax > 0 ? Math.round((score / scoreMax) * 10000) / 100 : 0;
      ins.finished_at = new Date();
      ins.status = 'enviada';
      if (observacao_geral !== undefined) ins.observacao_geral = observacao_geral;
      if (assinatura_auditor_url !== undefined) ins.assinatura_auditor_url = assinatura_auditor_url;
      if (assinatura_auditado_url !== undefined) ins.assinatura_auditado_url = assinatura_auditado_url;
      await repo.save(ins);
      res.json({ success: true, inspection: ins });
    } catch (e: any) {
      console.error('[Checklist] finalizarInspection:', e);
      res.status(500).json({ success: false, error: e.message });
    }
  }

  // ========== ACTIONS (5W2H) ==========

  static async listarActions(req: Request, res: Response) {
    try {
      const codLoja = req.query.cod_loja ? parseInt(req.query.cod_loja as string) : undefined;
      const status = req.query.status as string | undefined;
      const qb = AppDataSource.getRepository(AuditAction).createQueryBuilder('a')
        .leftJoinAndSelect('a.who', 'who')
        .leftJoinAndSelect('a.inspection', 'ins')
        .orderBy('a.when_prazo', 'ASC');
      if (codLoja !== undefined) qb.andWhere('a.cod_loja = :codLoja', { codLoja });
      if (status) qb.andWhere('a.status = :status', { status });
      const list = await qb.getMany();
      res.json({ success: true, actions: list });
    } catch (e: any) {
      console.error('[Checklist] listarActions:', e);
      res.status(500).json({ success: false, error: e.message });
    }
  }

  static async criarAction(req: Request, res: Response) {
    try {
      const { inspection_id, response_id, what, why, who_employee_id, when_prazo, where_setor, how, how_much, criticidade, cod_loja } = req.body;
      if (!inspection_id || !what) {
        return res.status(400).json({ success: false, error: 'inspection_id e what obrigatorios' });
      }
      const repo = AppDataSource.getRepository(AuditAction);
      const a = repo.create({
        inspection_id, response_id: response_id || null,
        what, why: why || null,
        who_employee_id: who_employee_id || null,
        when_prazo: when_prazo ? new Date(when_prazo) : null,
        where_setor: where_setor || null,
        how: how || null,
        how_much: how_much ?? null,
        criticidade: criticidade || 'media',
        cod_loja: cod_loja ?? null,
        status: 'aberta',
      });
      await repo.save(a);
      res.json({ success: true, action: a });
    } catch (e: any) {
      console.error('[Checklist] criarAction:', e);
      res.status(500).json({ success: false, error: e.message });
    }
  }

  static async atualizarActionStatus(req: Request, res: Response) {
    try {
      const id = parseInt(req.params.id);
      const { status, comentario, alterado_por } = req.body;
      const repo = AppDataSource.getRepository(AuditAction);
      const a = await repo.findOne({ where: { id } });
      if (!a) return res.status(404).json({ success: false, error: 'Acao nao encontrada' });
      const anterior = a.status;
      a.status = status;
      if (status === 'concluida') {
        a.concluido_em = new Date();
        if (alterado_por) a.concluido_por = alterado_por;
      }
      await repo.save(a);
      const hist = AppDataSource.getRepository(AuditActionHistory).create({
        action_id: id,
        status_anterior: anterior,
        status_novo: status,
        alterado_por: alterado_por || null,
        comentario: comentario || null,
      });
      await AppDataSource.getRepository(AuditActionHistory).save(hist);
      res.json({ success: true, action: a });
    } catch (e: any) {
      console.error('[Checklist] atualizarActionStatus:', e);
      res.status(500).json({ success: false, error: e.message });
    }
  }

  // ========== UPLOAD DE IMAGEM (referencia / evidencia) ==========

  static async uploadImagem(req: any, res: Response) {
    try {
      const file = req.file;
      if (!file) return res.status(400).json({ success: false, error: 'Arquivo nao enviado' });
      const ok = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif'];
      if (!ok.includes(file.mimetype)) {
        return res.status(400).json({ success: false, error: 'Formato invalido. Use jpg, png, webp ou gif.' });
      }
      const ext = (file.originalname.split('.').pop() || 'jpg').toLowerCase();
      const fileName = `checklist/${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext}`;
      const url = await minioService.uploadFile(fileName, file.buffer, file.mimetype);
      res.json({ success: true, url, titulo: file.originalname });
    } catch (e: any) {
      console.error('[Checklist] uploadImagem:', e);
      res.status(500).json({ success: false, error: e.message });
    }
  }

  // ========== DASHBOARDS ==========

  /**
   * Dashboard completo (estilo Octopo): dados gerais + rankings (lojas, auditados, questionarios) + acoes em aberto.
   */
  static async dashboardCompleto(req: Request, res: Response) {
    try {
      const codLoja = req.query.cod_loja ? parseInt(req.query.cod_loja as string) : undefined;
      const dias = req.query.dias ? parseInt(req.query.dias as string) : 30;
      const dataLimite = new Date();
      dataLimite.setDate(dataLimite.getDate() - dias);

      // Auditorias concluidas no periodo (enviada ou aprovada)
      const insRepo = AppDataSource.getRepository(AuditInspection);
      const qb = insRepo.createQueryBuilder('i')
        .leftJoinAndSelect('i.template', 't')
        .leftJoinAndSelect('i.auditor', 'auditor')
        .leftJoinAndSelect('i.auditado', 'auditado')
        .where('i.status IN (:...s)', { s: ['enviada', 'aprovada'] })
        .andWhere('i.finished_at >= :dt', { dt: dataLimite });
      if (codLoja !== undefined) qb.andWhere('i.cod_loja = :codLoja', { codLoja });
      const inspections = await qb.getMany();

      const totalAuditorias = inspections.length;
      const pcts = inspections.map(i => Number(i.percentual_conformidade) || 0);
      const desempenhoMedio = totalAuditorias > 0
        ? pcts.reduce((a, b) => a + b, 0) / totalAuditorias : 0;

      // Contadores auxiliares
      const totalSetores = await AppDataSource.getRepository(Sector).count({ where: { active: true, ...(codLoja !== undefined ? { cod_loja: codLoja } : {}) } as any });
      const totalAuditores = await AppDataSource.getRepository(Employee).count({ where: { is_auditor: true, active: true, ...(codLoja !== undefined ? { cod_loja: codLoja } : {}) } as any });
      const totalTemplates = await AppDataSource.getRepository(AuditTemplate).count({ where: { ativo: true } });
      // "Filiais" ~ lojas distintas nas auditorias
      const filiaisSet = new Set<number>();
      for (const i of inspections) if (i.cod_loja != null) filiaisSet.add(i.cod_loja);

      // Ultimas auditorias (top 10)
      const ultimas = [...inspections]
        .sort((a, b) => new Date(b.finished_at || b.created_at).getTime() - new Date(a.finished_at || a.created_at).getTime())
        .slice(0, 10)
        .map(i => ({
          id: i.id,
          data: i.finished_at || i.created_at,
          template: i.template?.nome,
          auditor: i.auditor?.name,
          auditado: i.auditado?.name,
          cod_loja: i.cod_loja,
          percentual: Number(i.percentual_conformidade) || 0,
          meta: Number(i.template?.minimo_esperado) || 95,
        }));

      // Ranking por loja
      const rankLojaMap: Record<string, { cod_loja: number | null; total: number; soma: number }> = {};
      for (const i of inspections) {
        const key = String(i.cod_loja ?? 'null');
        if (!rankLojaMap[key]) rankLojaMap[key] = { cod_loja: i.cod_loja, total: 0, soma: 0 };
        rankLojaMap[key].total += 1;
        rankLojaMap[key].soma += Number(i.percentual_conformidade) || 0;
      }
      const rankingLojas = Object.values(rankLojaMap).map(r => ({
        cod_loja: r.cod_loja,
        total: r.total,
        media: r.total > 0 ? r.soma / r.total : 0,
      })).sort((a, b) => b.media - a.media);

      // Ranking por questionario
      const rankTplMap: Record<string, { id: number; nome: string; total: number; soma: number; meta: number }> = {};
      for (const i of inspections) {
        const tId = i.template?.id;
        if (!tId) continue;
        const key = String(tId);
        if (!rankTplMap[key]) rankTplMap[key] = { id: tId, nome: i.template!.nome, total: 0, soma: 0, meta: Number(i.template?.minimo_esperado) || 95 };
        rankTplMap[key].total += 1;
        rankTplMap[key].soma += Number(i.percentual_conformidade) || 0;
      }
      const rankingQuestionarios = Object.values(rankTplMap).map(r => ({
        id: r.id, nome: r.nome, total: r.total, meta: r.meta,
        media: r.total > 0 ? r.soma / r.total : 0,
      })).sort((a, b) => b.media - a.media);

      // Ranking por auditado (colaborador avaliado)
      const rankAudMap: Record<string, { id: string; nome: string; avatar: string | null; cod_loja: number | null; total: number; soma: number }> = {};
      for (const i of inspections) {
        const a = i.auditado;
        if (!a) continue;
        const key = a.id;
        if (!rankAudMap[key]) rankAudMap[key] = { id: a.id, nome: a.name, avatar: a.avatar, cod_loja: a.cod_loja, total: 0, soma: 0 };
        rankAudMap[key].total += 1;
        rankAudMap[key].soma += Number(i.percentual_conformidade) || 0;
      }
      const rankingAuditados = Object.values(rankAudMap).map(r => ({
        id: r.id, nome: r.nome, avatar: r.avatar, cod_loja: r.cod_loja,
        total: r.total,
        media: r.total > 0 ? r.soma / r.total : 0,
      })).sort((a, b) => b.media - a.media);

      // Planos de acao em aberto
      const actionsRepo = AppDataSource.getRepository(AuditAction);
      const aQb = actionsRepo.createQueryBuilder('a')
        .leftJoinAndSelect('a.who', 'who')
        .leftJoinAndSelect('a.inspection', 'ins')
        .where('a.status IN (:...s)', { s: ['aberta', 'em_andamento'] })
        .orderBy('a.when_prazo', 'ASC')
        .limit(20);
      if (codLoja !== undefined) aQb.andWhere('a.cod_loja = :codLoja', { codLoja });
      const acoesAbertas = await aQb.getMany();
      const agora = new Date();
      const planosAcaoResumo = acoesAbertas.map(a => ({
        id: a.id,
        what: a.what,
        prazo: a.when_prazo,
        criticidade: a.criticidade,
        responsavel: a.who?.name || null,
        atrasada: !!(a.when_prazo && new Date(a.when_prazo) < agora),
      }));

      const totalAcoes = await actionsRepo.count({ where: codLoja !== undefined ? { cod_loja: codLoja } as any : {} });
      const totalAcoesAbertas = planosAcaoResumo.length;
      const totalAcoesAtrasadas = planosAcaoResumo.filter(p => p.atrasada).length;
      const totalAcoesConcluidas = await actionsRepo.count({
        where: { status: 'concluida', ...(codLoja !== undefined ? { cod_loja: codLoja } : {}) } as any,
      });

      res.json({
        success: true,
        dados_gerais: {
          auditorias_concluidas: totalAuditorias,
          setores: totalSetores,
          filiais: filiaisSet.size,
          auditores: totalAuditores,
          questionarios: totalTemplates,
        },
        desempenho: {
          total: totalAuditorias,
          percentual_medio: Math.round(desempenhoMedio * 100) / 100,
          periodo_dias: dias,
        },
        ultimas_auditorias: ultimas,
        ranking_lojas: rankingLojas,
        ranking_questionarios: rankingQuestionarios,
        ranking_auditados: rankingAuditados,
        planos_acao: {
          abertas: totalAcoesAbertas,
          atrasadas: totalAcoesAtrasadas,
          concluidas: totalAcoesConcluidas,
          total: totalAcoes,
          lista: planosAcaoResumo,
        },
      });
    } catch (e: any) {
      console.error('[Checklist] dashboardCompleto:', e);
      res.status(500).json({ success: false, error: e.message });
    }
  }

  static async dashboardResumo(req: Request, res: Response) {
    try {
      const codLoja = req.query.cod_loja ? parseInt(req.query.cod_loja as string) : undefined;
      const repo = AppDataSource.getRepository(AuditInspection);
      const qb = repo.createQueryBuilder('i').where('i.status IN (:...s)', { s: ['enviada', 'aprovada'] });
      if (codLoja !== undefined) qb.andWhere('i.cod_loja = :codLoja', { codLoja });
      const inspections = await qb.getMany();
      const total = inspections.length;
      const pcts = inspections.map(i => Number(i.percentual_conformidade) || 0);
      const mediaConformidade = total > 0 ? pcts.reduce((a, b) => a + b, 0) / total : 0;

      // Ranking por loja
      const rankLojaMap: Record<string, { cod_loja: number | null; total: number; soma: number }> = {};
      for (const i of inspections) {
        const key = String(i.cod_loja ?? 'null');
        if (!rankLojaMap[key]) rankLojaMap[key] = { cod_loja: i.cod_loja, total: 0, soma: 0 };
        rankLojaMap[key].total += 1;
        rankLojaMap[key].soma += Number(i.percentual_conformidade) || 0;
      }
      const rankingLojas = Object.values(rankLojaMap).map(r => ({
        cod_loja: r.cod_loja,
        total_auditorias: r.total,
        media_conformidade: r.total > 0 ? r.soma / r.total : 0,
      })).sort((a, b) => b.media_conformidade - a.media_conformidade);

      // Acoes em aberto e atrasadas
      const actionsRepo = AppDataSource.getRepository(AuditAction);
      const aQb = actionsRepo.createQueryBuilder('a');
      if (codLoja !== undefined) aQb.where('a.cod_loja = :codLoja', { codLoja });
      const actions = await aQb.getMany();
      const agora = new Date();
      const abertas = actions.filter(a => a.status === 'aberta' || a.status === 'em_andamento').length;
      const atrasadas = actions.filter(a =>
        (a.status === 'aberta' || a.status === 'em_andamento') &&
        a.when_prazo && new Date(a.when_prazo) < agora
      ).length;
      const concluidas = actions.filter(a => a.status === 'concluida').length;

      res.json({
        success: true,
        resumo: {
          total_auditorias: total,
          media_conformidade: Math.round(mediaConformidade * 100) / 100,
          ranking_lojas: rankingLojas,
          acoes: { abertas, atrasadas, concluidas, total: actions.length },
        },
      });
    } catch (e: any) {
      console.error('[Checklist] dashboardResumo:', e);
      res.status(500).json({ success: false, error: e.message });
    }
  }
}
