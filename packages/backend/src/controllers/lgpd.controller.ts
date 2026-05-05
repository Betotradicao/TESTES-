import { Request, Response } from 'express';
import * as crypto from 'crypto';
import { AppDataSource } from '../config/database';
import { AuthRequest } from '../middleware/auth';

// Hashes simples pra compor o registro de consentimento
const sha256 = (s: string) => crypto.createHash('sha256').update(s, 'utf8').digest('hex');

// Pega IP de forma confiavel atras de proxy/CDN
function getIp(req: Request): string {
  const xff = req.headers['x-forwarded-for'];
  if (typeof xff === 'string' && xff.length > 0) return xff.split(',')[0].trim();
  if (Array.isArray(xff) && xff.length > 0) return xff[0];
  return req.ip || req.socket?.remoteAddress || '';
}

export class LgpdController {
  // GET /api/lgpd/aceites
  static async listarAceites(_req: AuthRequest, res: Response) {
    try {
      const rows = await AppDataSource.query(`
        SELECT id, tipo, versao, hash_conteudo, titular_tipo, titular_id, titular_nome,
               titular_email, ip, user_agent, aceito_em, revogado_em, motivo_revogacao
        FROM lgpd_consentimentos
        ORDER BY aceito_em DESC
      `);
      res.json(rows);
    } catch (e: any) {
      console.error('[LGPD] listarAceites:', e);
      res.status(500).json({ error: e.message });
    }
  }

  // POST /api/lgpd/aceites
  static async registrarAceite(req: AuthRequest, res: Response) {
    try {
      const { tipo, versao, titular_tipo, titular_id, titular_nome, titular_email, observacoes } = req.body;

      if (!tipo || !versao || !titular_tipo || !titular_id) {
        return res.status(400).json({ error: 'tipo, versao, titular_tipo e titular_id sao obrigatorios' });
      }

      const ip = getIp(req);
      const ua = req.headers['user-agent'] || '';
      // hash_conteudo: incluir tipo + versao + titular pra ter uma fingerprint
      const hash = sha256(`${tipo}|${versao}|${titular_tipo}|${titular_id}|${ip}|${Date.now()}`);

      // Revoga aceite anterior do mesmo tipo+titular (so o ultimo vale como ativo)
      await AppDataSource.query(
        `UPDATE lgpd_consentimentos
         SET revogado_em = NOW(), motivo_revogacao = 'Substituido por novo aceite'
         WHERE tipo = $1 AND titular_tipo = $2 AND titular_id = $3 AND revogado_em IS NULL`,
        [tipo, titular_tipo, String(titular_id)]
      );

      const result = await AppDataSource.query(
        `INSERT INTO lgpd_consentimentos
          (tipo, versao, hash_conteudo, titular_tipo, titular_id, titular_nome, titular_email, ip, user_agent, observacoes)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
         RETURNING *`,
        [tipo, versao, hash, titular_tipo, String(titular_id), titular_nome || null, titular_email || null, ip, ua, observacoes || null]
      );
      res.status(201).json(result[0]);
    } catch (e: any) {
      console.error('[LGPD] registrarAceite:', e);
      res.status(500).json({ error: e.message });
    }
  }

  // POST /api/lgpd/aceites/:id/revogar
  static async revogarAceite(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;
      const { motivo } = req.body || {};
      const result = await AppDataSource.query(
        `UPDATE lgpd_consentimentos SET revogado_em = NOW(), motivo_revogacao = $2 WHERE id = $1 RETURNING *`,
        [id, motivo || 'Revogado pelo usuario']
      );
      if (result.length === 0) return res.status(404).json({ error: 'Aceite nao encontrado' });
      res.json(result[0]);
    } catch (e: any) {
      console.error('[LGPD] revogarAceite:', e);
      res.status(500).json({ error: e.message });
    }
  }

  // GET /api/lgpd/configuracoes
  static async obterConfiguracoes(_req: AuthRequest, res: Response) {
    try {
      const rows = await AppDataSource.query(`SELECT * FROM lgpd_configuracoes WHERE id = 1`);
      if (rows.length === 0) {
        return res.json({
          dpo_nome: '',
          dpo_email: '',
          dpo_telefone: '',
          retencao_curriculos_meses: 12,
          retencao_logs_meses: 12,
          retencao_gravacoes_dias: 30,
        });
      }
      res.json(rows[0]);
    } catch (e: any) {
      console.error('[LGPD] obterConfiguracoes:', e);
      res.status(500).json({ error: e.message });
    }
  }

  // PUT /api/lgpd/configuracoes
  static async atualizarConfiguracoes(req: AuthRequest, res: Response) {
    try {
      const { dpo_nome, dpo_email, dpo_telefone, retencao_curriculos_meses, retencao_logs_meses, retencao_gravacoes_dias, politica_privacidade_url } = req.body;
      await AppDataSource.query(
        `INSERT INTO lgpd_configuracoes (id, dpo_nome, dpo_email, dpo_telefone, retencao_curriculos_meses, retencao_logs_meses, retencao_gravacoes_dias, politica_privacidade_url, atualizado_em)
         VALUES (1, $1, $2, $3, $4, $5, $6, $7, NOW())
         ON CONFLICT (id) DO UPDATE SET
           dpo_nome = EXCLUDED.dpo_nome,
           dpo_email = EXCLUDED.dpo_email,
           dpo_telefone = EXCLUDED.dpo_telefone,
           retencao_curriculos_meses = EXCLUDED.retencao_curriculos_meses,
           retencao_logs_meses = EXCLUDED.retencao_logs_meses,
           retencao_gravacoes_dias = EXCLUDED.retencao_gravacoes_dias,
           politica_privacidade_url = EXCLUDED.politica_privacidade_url,
           atualizado_em = NOW()`,
        [dpo_nome || null, dpo_email || null, dpo_telefone || null,
         retencao_curriculos_meses || 12, retencao_logs_meses || 12, retencao_gravacoes_dias || 30,
         politica_privacidade_url || null]
      );
      const [row] = await AppDataSource.query(`SELECT * FROM lgpd_configuracoes WHERE id = 1`);
      res.json(row);
    } catch (e: any) {
      console.error('[LGPD] atualizarConfiguracoes:', e);
      res.status(500).json({ error: e.message });
    }
  }
}
