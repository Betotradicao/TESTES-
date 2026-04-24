import { Response } from 'express';
import { AppDataSource } from '../config/database';
import { AuthRequest } from '../middleware/auth';
import { minioService } from '../services/minio.service';

/** Departamento Pessoal: documentos da EMPRESA (nao por colaborador) */
export class RhDpController {
  // --- PASTAS ---
  static async listarPastas(req: AuthRequest, res: Response) {
    try {
      const companyId = req.query.company_id as string | undefined;
      const params: any[] = [];
      let where = '';
      if (companyId && companyId !== '') {
        params.push(companyId);
        where = `WHERE p.company_id = $1`;
      }
      const pastas = await AppDataSource.query(
        `SELECT p.*,
                (SELECT COUNT(*) FROM dp_documentos d WHERE d.pasta_id = p.id)::int AS qtd_arquivos
         FROM dp_pastas p
         ${where}
         ORDER BY COALESCE(p.ordem, 999999) ASC, p.nome ASC`,
        params
      );
      return res.json(pastas);
    } catch (err: any) {
      console.error('[DP] listarPastas:', err);
      return res.status(500).json({ error: err.message });
    }
  }

  static async criarPasta(req: AuthRequest, res: Response) {
    try {
      const { nome, company_id } = req.body;
      if (!nome?.trim()) return res.status(400).json({ error: 'nome obrigatorio' });
      if (!company_id) return res.status(400).json({ error: 'company_id obrigatorio' });
      const [pasta] = await AppDataSource.query(
        `INSERT INTO dp_pastas (nome, company_id) VALUES ($1, $2)
         ON CONFLICT (company_id, nome) DO UPDATE SET updated_at = NOW() RETURNING *`,
        [nome.trim().toUpperCase(), company_id]
      );
      return res.status(201).json(pasta);
    } catch (err: any) {
      console.error('[DP] criarPasta:', err);
      return res.status(500).json({ error: err.message });
    }
  }

  /** Seed das 3 pastas padrao (DOCS EMPRESA, DOCS VIGILANCIA, DOCS MODELOS RH) para uma empresa */
  static async seedPadraoPorEmpresa(req: AuthRequest, res: Response) {
    try {
      const companyId = req.params.companyId;
      if (!companyId) return res.status(400).json({ error: 'companyId obrigatorio' });
      await AppDataSource.query(`
        INSERT INTO dp_pastas (nome, ordem, company_id)
        SELECT v.nome, v.ordem, $1
        FROM (VALUES
          ('DOCS EMPRESA', 1),
          ('DOCS VIGILANCIA', 2),
          ('DOCS MODELOS RH', 3)
        ) AS v(nome, ordem)
        WHERE NOT EXISTS (SELECT 1 FROM dp_pastas x WHERE x.nome = v.nome AND x.company_id = $1)
      `, [companyId]);
      return res.json({ success: true });
    } catch (err: any) {
      console.error('[DP] seedPadrao:', err);
      return res.status(500).json({ error: err.message });
    }
  }

  static async atualizarPasta(req: AuthRequest, res: Response) {
    try {
      const id = parseInt(req.params.id);
      const { nome } = req.body;
      if (!nome?.trim()) return res.status(400).json({ error: 'nome obrigatorio' });
      const [pasta] = await AppDataSource.query(
        `UPDATE dp_pastas SET nome = $1, updated_at = NOW() WHERE id = $2 RETURNING *`,
        [nome.trim().toUpperCase(), id]
      );
      if (!pasta) return res.status(404).json({ error: 'Pasta nao encontrada' });
      return res.json(pasta);
    } catch (err: any) {
      console.error('[DP] atualizarPasta:', err);
      return res.status(500).json({ error: err.message });
    }
  }

  static async reordenarPastas(req: AuthRequest, res: Response) {
    try {
      const { pasta_ids } = req.body;
      if (!Array.isArray(pasta_ids)) return res.status(400).json({ error: 'pasta_ids array obrigatorio' });
      for (let i = 0; i < pasta_ids.length; i++) {
        await AppDataSource.query(
          `UPDATE dp_pastas SET ordem = $1, updated_at = NOW() WHERE id = $2`,
          [i + 1, pasta_ids[i]]
        );
      }
      return res.json({ success: true });
    } catch (err: any) {
      console.error('[DP] reordenarPastas:', err);
      return res.status(500).json({ error: err.message });
    }
  }

  static async deletarPasta(req: AuthRequest, res: Response) {
    try {
      const id = parseInt(req.params.id);
      const r = await AppDataSource.query(`DELETE FROM dp_pastas WHERE id = $1 RETURNING id`, [id]);
      if (r.length === 0) return res.status(404).json({ error: 'Pasta nao encontrada' });
      return res.json({ success: true });
    } catch (err: any) {
      console.error('[DP] deletarPasta:', err);
      return res.status(500).json({ error: err.message });
    }
  }

  // --- SUBPASTAS ---
  static async listarSubpastas(req: AuthRequest, res: Response) {
    try {
      const pastaId = parseInt(req.query.pasta_id as string);
      if (!pastaId) return res.status(400).json({ error: 'pasta_id obrigatorio' });
      const subs = await AppDataSource.query(
        `SELECT s.*,
                (SELECT COUNT(*) FROM dp_documentos d WHERE d.subpasta_id = s.id)::int AS qtd_arquivos
         FROM dp_subpastas s
         WHERE s.pasta_id = $1
         ORDER BY COALESCE(s.ordem, 999999) ASC, s.nome ASC`,
        [pastaId]
      );
      return res.json(subs);
    } catch (err: any) {
      console.error('[DP] listarSubpastas:', err);
      return res.status(500).json({ error: err.message });
    }
  }

  static async criarSubpasta(req: AuthRequest, res: Response) {
    try {
      const { pasta_id, nome, obrigatorio } = req.body;
      if (!pasta_id || !nome?.trim()) return res.status(400).json({ error: 'pasta_id e nome obrigatorios' });
      const [sub] = await AppDataSource.query(
        `INSERT INTO dp_subpastas (pasta_id, nome, obrigatorio) VALUES ($1, $2, $3) RETURNING *`,
        [pasta_id, nome.trim().toUpperCase(), !!obrigatorio]
      );
      return res.status(201).json(sub);
    } catch (err: any) {
      console.error('[DP] criarSubpasta:', err);
      return res.status(500).json({ error: err.message });
    }
  }

  static async atualizarSubpasta(req: AuthRequest, res: Response) {
    try {
      const id = parseInt(req.params.id);
      const { nome, obrigatorio } = req.body;
      const [sub] = await AppDataSource.query(
        `UPDATE dp_subpastas
         SET nome = COALESCE($1, nome),
             obrigatorio = COALESCE($2, obrigatorio),
             updated_at = NOW()
         WHERE id = $3 RETURNING *`,
        [nome ? nome.trim().toUpperCase() : null, obrigatorio !== undefined ? !!obrigatorio : null, id]
      );
      if (!sub) return res.status(404).json({ error: 'Subpasta nao encontrada' });
      return res.json(sub);
    } catch (err: any) {
      console.error('[DP] atualizarSubpasta:', err);
      return res.status(500).json({ error: err.message });
    }
  }

  static async deletarSubpasta(req: AuthRequest, res: Response) {
    try {
      const id = parseInt(req.params.id);
      const r = await AppDataSource.query(`DELETE FROM dp_subpastas WHERE id = $1 RETURNING id`, [id]);
      if (r.length === 0) return res.status(404).json({ error: 'Subpasta nao encontrada' });
      return res.json({ success: true });
    } catch (err: any) {
      console.error('[DP] deletarSubpasta:', err);
      return res.status(500).json({ error: err.message });
    }
  }

  // --- DOCUMENTOS ---
  static async listarDocumentos(req: AuthRequest, res: Response) {
    try {
      const pastaId = parseInt(req.query.pasta_id as string);
      if (!pastaId) return res.status(400).json({ error: 'pasta_id obrigatorio' });
      const docs = await AppDataSource.query(
        `SELECT * FROM dp_documentos WHERE pasta_id = $1 ORDER BY uploaded_at DESC`,
        [pastaId]
      );
      return res.json(docs);
    } catch (err: any) {
      console.error('[DP] listarDocumentos:', err);
      return res.status(500).json({ error: err.message });
    }
  }

  static async uploadDocumento(req: AuthRequest, res: Response) {
    try {
      const file = (req as any).file;
      const { pasta_id, subpasta_id, observacao } = req.body;
      if (!file) return res.status(400).json({ error: 'Arquivo obrigatorio' });
      if (!pasta_id) return res.status(400).json({ error: 'pasta_id obrigatorio' });
      const ext = (file.originalname || 'bin').split('.').pop() || 'bin';
      const objectName = `rh/dp/${pasta_id}/${Date.now()}_${Math.random().toString(36).slice(2, 10)}.${ext}`;
      const url = await minioService.uploadFile(objectName, file.buffer, file.mimetype || 'application/octet-stream');
      const subpastaIdNum = subpasta_id && subpasta_id !== '' ? parseInt(subpasta_id) : null;
      const [doc] = await AppDataSource.query(
        `INSERT INTO dp_documentos (pasta_id, subpasta_id, nome, arquivo_url, mime_type, tamanho_bytes, observacao)
         VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
        [pasta_id, subpastaIdNum, file.originalname, url, file.mimetype, file.size, observacao || null]
      );
      return res.status(201).json(doc);
    } catch (err: any) {
      console.error('[DP] uploadDocumento:', err);
      return res.status(500).json({ error: err.message });
    }
  }

  static async deletarDocumento(req: AuthRequest, res: Response) {
    try {
      const id = parseInt(req.params.id);
      const r = await AppDataSource.query(`DELETE FROM dp_documentos WHERE id = $1 RETURNING id`, [id]);
      if (r.length === 0) return res.status(404).json({ error: 'Documento nao encontrado' });
      return res.json({ success: true });
    } catch (err: any) {
      console.error('[DP] deletarDocumento:', err);
      return res.status(500).json({ error: err.message });
    }
  }
}
