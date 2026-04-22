import { Request, Response } from 'express';
import { AppDataSource } from '../config/database';
import { ArvoreAba } from '../entities/ArvoreAba';
import { ArvoreNota } from '../entities/ArvoreNota';
import { ArvoreAnexo } from '../entities/ArvoreAnexo';
import { Sector } from '../entities/Sector';
import { minioService } from '../services/minio.service';

export class ArvoreConhecimentoController {
  // ========== ABAS ==========

  static async listarAbas(req: Request, res: Response) {
    try {
      const setorId = req.query.setor_id ? parseInt(req.query.setor_id as string) : undefined;
      const qb = AppDataSource.getRepository(ArvoreAba).createQueryBuilder('a').orderBy('a.ordem', 'ASC').addOrderBy('a.id', 'ASC');
      if (setorId !== undefined) qb.where('a.setor_id = :setorId', { setorId });
      const abas = await qb.getMany();
      res.json({ success: true, abas });
    } catch (e: any) {
      console.error('[Arvore] listarAbas:', e);
      res.status(500).json({ success: false, error: e.message });
    }
  }

  static async criarAba(req: Request, res: Response) {
    try {
      const { setor_id, nome, descricao, cod_loja } = req.body;
      if (!setor_id || !nome?.trim()) return res.status(400).json({ success: false, error: 'setor_id e nome sao obrigatorios' });

      const setor = await AppDataSource.getRepository(Sector).findOne({ where: { id: setor_id } });
      if (!setor) return res.status(404).json({ success: false, error: 'Setor nao encontrado' });

      const repo = AppDataSource.getRepository(ArvoreAba);
      const maxOrdem = await repo.createQueryBuilder('a')
        .select('COALESCE(MAX(a.ordem), 0)', 'max')
        .where('a.setor_id = :setorId', { setorId: setor_id })
        .getRawOne();

      const aba = repo.create({
        setor_id,
        nome: nome.trim(),
        descricao: descricao || null,
        cod_loja: cod_loja ?? null,
        ordem: Number(maxOrdem?.max || 0) + 1,
      });
      await repo.save(aba);
      res.json({ success: true, aba });
    } catch (e: any) {
      console.error('[Arvore] criarAba:', e);
      res.status(500).json({ success: false, error: e.message });
    }
  }

  static async atualizarAba(req: Request, res: Response) {
    try {
      const id = parseInt(req.params.id);
      const { nome, descricao, ordem } = req.body;
      const repo = AppDataSource.getRepository(ArvoreAba);
      const aba = await repo.findOne({ where: { id } });
      if (!aba) return res.status(404).json({ success: false, error: 'Aba nao encontrada' });
      if (nome !== undefined) aba.nome = String(nome).trim();
      if (descricao !== undefined) aba.descricao = descricao || null;
      if (ordem !== undefined) aba.ordem = Number(ordem) || 0;
      await repo.save(aba);
      res.json({ success: true, aba });
    } catch (e: any) {
      console.error('[Arvore] atualizarAba:', e);
      res.status(500).json({ success: false, error: e.message });
    }
  }

  static async deletarAba(req: Request, res: Response) {
    try {
      const id = parseInt(req.params.id);
      const repo = AppDataSource.getRepository(ArvoreAba);
      const aba = await repo.findOne({ where: { id } });
      if (!aba) return res.status(404).json({ success: false, error: 'Aba nao encontrada' });
      await repo.remove(aba);
      res.json({ success: true });
    } catch (e: any) {
      console.error('[Arvore] deletarAba:', e);
      res.status(500).json({ success: false, error: e.message });
    }
  }

  // ========== NOTAS ==========

  static async listarNotas(req: Request, res: Response) {
    try {
      const abaId = req.query.aba_id ? parseInt(req.query.aba_id as string) : undefined;
      if (!abaId) return res.status(400).json({ success: false, error: 'aba_id obrigatorio' });
      const notas = await AppDataSource.getRepository(ArvoreNota).find({
        where: { aba_id: abaId },
        relations: ['anexos'],
        order: { ordem: 'ASC', id: 'ASC' } as any,
      });
      res.json({ success: true, notas });
    } catch (e: any) {
      console.error('[Arvore] listarNotas:', e);
      res.status(500).json({ success: false, error: e.message });
    }
  }

  static async criarNota(req: Request, res: Response) {
    try {
      const { aba_id, titulo, conteudo } = req.body;
      if (!aba_id || !titulo?.trim()) return res.status(400).json({ success: false, error: 'aba_id e titulo sao obrigatorios' });
      const repo = AppDataSource.getRepository(ArvoreNota);
      const maxOrdem = await repo.createQueryBuilder('n')
        .select('COALESCE(MAX(n.ordem), 0)', 'max')
        .where('n.aba_id = :abaId', { abaId: aba_id })
        .getRawOne();
      const nota = repo.create({
        aba_id,
        titulo: String(titulo).trim(),
        conteudo: conteudo || null,
        ordem: Number(maxOrdem?.max || 0) + 1,
      });
      await repo.save(nota);
      res.json({ success: true, nota });
    } catch (e: any) {
      console.error('[Arvore] criarNota:', e);
      res.status(500).json({ success: false, error: e.message });
    }
  }

  static async atualizarNota(req: Request, res: Response) {
    try {
      const id = parseInt(req.params.id);
      const { titulo, conteudo, ordem } = req.body;
      const repo = AppDataSource.getRepository(ArvoreNota);
      const nota = await repo.findOne({ where: { id } });
      if (!nota) return res.status(404).json({ success: false, error: 'Nota nao encontrada' });
      if (titulo !== undefined) nota.titulo = String(titulo).trim();
      if (conteudo !== undefined) nota.conteudo = conteudo || null;
      if (ordem !== undefined) nota.ordem = Number(ordem) || 0;
      await repo.save(nota);
      res.json({ success: true, nota });
    } catch (e: any) {
      console.error('[Arvore] atualizarNota:', e);
      res.status(500).json({ success: false, error: e.message });
    }
  }

  static async deletarNota(req: Request, res: Response) {
    try {
      const id = parseInt(req.params.id);
      const repo = AppDataSource.getRepository(ArvoreNota);
      const nota = await repo.findOne({ where: { id } });
      if (!nota) return res.status(404).json({ success: false, error: 'Nota nao encontrada' });
      await repo.remove(nota);
      res.json({ success: true });
    } catch (e: any) {
      console.error('[Arvore] deletarNota:', e);
      res.status(500).json({ success: false, error: e.message });
    }
  }

  // ========== ANEXOS ==========

  private static detectarTipo(mime: string | undefined, url: string): 'imagem' | 'video' | 'pdf' | 'arquivo' | 'youtube' | 'link' {
    const u = (url || '').toLowerCase();
    if (u.includes('youtube.com') || u.includes('youtu.be')) return 'youtube';
    if (mime?.startsWith('image/') || /\.(jpg|jpeg|png|gif|webp|bmp)$/.test(u)) return 'imagem';
    if (mime?.startsWith('video/') || /\.(mp4|webm|mov|mkv|avi)$/.test(u)) return 'video';
    if (mime === 'application/pdf' || u.endsWith('.pdf')) return 'pdf';
    if (mime || /\.(doc|docx|xls|xlsx|ppt|pptx|txt|csv|zip|rar)$/.test(u)) return 'arquivo';
    return 'link';
  }

  static async uploadAnexo(req: Request, res: Response) {
    try {
      const notaId = parseInt(req.body.nota_id);
      if (!notaId) return res.status(400).json({ success: false, error: 'nota_id obrigatorio' });

      const nota = await AppDataSource.getRepository(ArvoreNota).findOne({ where: { id: notaId } });
      if (!nota) return res.status(404).json({ success: false, error: 'Nota nao encontrada' });

      const file = (req as any).file;
      if (!file) return res.status(400).json({ success: false, error: 'Arquivo obrigatorio' });

      // Sobe pro MinIO (reusa minioService)
      const ext = (file.originalname || '').split('.').pop() || 'bin';
      const objectName = `arvore/nota_${notaId}/${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext}`;
      const url = await minioService.uploadFile(objectName, file.buffer, file.mimetype || 'application/octet-stream');

      const tipo = this.detectarTipo(file.mimetype, file.originalname || '');
      const anexo = AppDataSource.getRepository(ArvoreAnexo).create({
        nota_id: notaId,
        tipo,
        url,
        nome_original: file.originalname || null,
        tamanho_bytes: file.size || null,
      });
      await AppDataSource.getRepository(ArvoreAnexo).save(anexo);
      res.json({ success: true, anexo });
    } catch (e: any) {
      console.error('[Arvore] uploadAnexo:', e);
      res.status(500).json({ success: false, error: e.message });
    }
  }

  static async criarAnexoLink(req: Request, res: Response) {
    try {
      const { nota_id, url, nome_original } = req.body;
      if (!nota_id || !url) return res.status(400).json({ success: false, error: 'nota_id e url obrigatorios' });
      const nota = await AppDataSource.getRepository(ArvoreNota).findOne({ where: { id: nota_id } });
      if (!nota) return res.status(404).json({ success: false, error: 'Nota nao encontrada' });

      const tipo = this.detectarTipo(undefined, url);
      const anexo = AppDataSource.getRepository(ArvoreAnexo).create({
        nota_id,
        tipo,
        url,
        nome_original: nome_original || null,
        tamanho_bytes: null,
      });
      await AppDataSource.getRepository(ArvoreAnexo).save(anexo);
      res.json({ success: true, anexo });
    } catch (e: any) {
      console.error('[Arvore] criarAnexoLink:', e);
      res.status(500).json({ success: false, error: e.message });
    }
  }

  static async deletarAnexo(req: Request, res: Response) {
    try {
      const id = parseInt(req.params.id);
      const repo = AppDataSource.getRepository(ArvoreAnexo);
      const anexo = await repo.findOne({ where: { id } });
      if (!anexo) return res.status(404).json({ success: false, error: 'Anexo nao encontrado' });
      await repo.remove(anexo);
      res.json({ success: true });
    } catch (e: any) {
      console.error('[Arvore] deletarAnexo:', e);
      res.status(500).json({ success: false, error: e.message });
    }
  }
}
