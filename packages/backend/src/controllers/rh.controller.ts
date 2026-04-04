import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { AppDataSource } from '../config/database';

export class RhController {
  static async listColaboradores(req: AuthRequest, res: Response) {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;
      const offset = (page - 1) * limit;
      const search = req.query.search as string | undefined;
      const status = req.query.status as string | undefined;
      const empresa_id = req.query.empresa_id ? parseInt(req.query.empresa_id as string) : undefined;

      let whereClause = 'WHERE 1=1';
      const params: any[] = [];
      let paramIndex = 1;

      if (search) {
        whereClause += ` AND (c.nome ILIKE $${paramIndex} OR c.cpf ILIKE $${paramIndex} OR c.matricula ILIKE $${paramIndex})`;
        params.push(`%${search}%`);
        paramIndex++;
      }

      if (status) {
        whereClause += ` AND c.status = $${paramIndex}`;
        params.push(status);
        paramIndex++;
      }

      if (empresa_id) {
        whereClause += ` AND c.empresa_id = $${paramIndex}`;
        params.push(empresa_id);
        paramIndex++;
      }

      const countResult = await AppDataSource.query(
        `SELECT COUNT(*) as total FROM rh_colaboradores c ${whereClause}`,
        params
      );
      const total = parseInt(countResult[0].total);

      const dataParams = [...params, limit, offset];
      const colaboradores = await AppDataSource.query(
        `SELECT c.*,
                ca.nome AS cargo_nome,
                e.nome AS empresa_nome,
                j.nome AS jornada_nome,
                es.nome AS escolaridade_nome
         FROM rh_colaboradores c
         LEFT JOIN rh_cargos ca ON ca.id = c.cargo_id
         LEFT JOIN rh_empresas e ON e.id = c.empresa_id
         LEFT JOIN rh_jornadas j ON j.id = c.jornada_id
         LEFT JOIN rh_escolaridades es ON es.id = c.escolaridade_id
         ${whereClause}
         ORDER BY c.nome ASC
         LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
        dataParams
      );

      res.json({
        data: colaboradores,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      });
    } catch (error) {
      console.error('List colaboradores error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  static async getColaboradorById(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;

      const result = await AppDataSource.query(
        `SELECT c.*,
                ca.nome AS cargo_nome,
                e.nome AS empresa_nome,
                j.nome AS jornada_nome,
                es.nome AS escolaridade_nome,
                td.nome AS tipo_desligamento_nome,
                md.nome AS motivo_desligamento_nome
         FROM rh_colaboradores c
         LEFT JOIN rh_cargos ca ON ca.id = c.cargo_id
         LEFT JOIN rh_empresas e ON e.id = c.empresa_id
         LEFT JOIN rh_jornadas j ON j.id = c.jornada_id
         LEFT JOIN rh_escolaridades es ON es.id = c.escolaridade_id
         LEFT JOIN rh_tipos_desligamento td ON td.id = c.tipo_desligamento_id
         LEFT JOIN rh_motivos_desligamento md ON md.id = c.motivo_desligamento_id
         WHERE c.id = $1`,
        [id]
      );

      if (result.length === 0) {
        return res.status(404).json({ error: 'Colaborador not found' });
      }

      res.json(result[0]);
    } catch (error) {
      console.error('Get colaborador by ID error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  static async createColaborador(req: AuthRequest, res: Response) {
    try {
      const {
        nome, cpf, rg, data_nascimento, sexo, estado_civil, nacionalidade, naturalidade,
        telefone, celular, email, email_pessoal,
        cep, endereco, numero, complemento, bairro, cidade, estado,
        matricula, cargo_id, empresa_id, jornada_id, escolaridade_id, regime_trabalho_id,
        data_admissao, data_desligamento, salario, status,
        vale_transporte, vale_refeicao, valor_vale_refeicao, plano_saude,
        banco, agencia, conta, tipo_conta, pix,
        ctps, serie_ctps, pis_pasep, titulo_eleitor, reservista,
        nome_mae, nome_pai,
        observacoes, filtro1, filtro2, filtro3, foto_url,
        tipo_desligamento_id, motivo_desligamento_id, observacoes_desligamento,
      } = req.body;

      if (!nome || !cpf) {
        return res.status(400).json({ error: 'Nome e CPF sao obrigatorios' });
      }

      const result = await AppDataSource.query(
        `INSERT INTO rh_colaboradores (
          nome, cpf, rg, data_nascimento, sexo, estado_civil, nacionalidade, naturalidade,
          telefone, celular, email, email_pessoal,
          cep, endereco, numero, complemento, bairro, cidade, estado,
          matricula, cargo_id, empresa_id, jornada_id, escolaridade_id, regime_trabalho_id,
          data_admissao, data_desligamento, salario, status,
          vale_transporte, vale_refeicao, valor_vale_refeicao, plano_saude,
          banco, agencia, conta, tipo_conta, pix,
          ctps, serie_ctps, pis_pasep, titulo_eleitor, reservista,
          nome_mae, nome_pai,
          observacoes, filtro1, filtro2, filtro3, foto_url,
          tipo_desligamento_id, motivo_desligamento_id, observacoes_desligamento
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8,
          $9, $10, $11, $12,
          $13, $14, $15, $16, $17, $18, $19,
          $20, $21, $22, $23, $24, $25,
          $26, $27, $28, $29,
          $30, $31, $32, $33,
          $34, $35, $36, $37, $38,
          $39, $40, $41, $42, $43,
          $44, $45,
          $46, $47, $48, $49, $50,
          $51, $52, $53
        ) RETURNING *`,
        [
          nome, cpf, rg, data_nascimento, sexo, estado_civil, nacionalidade, naturalidade,
          telefone, celular, email, email_pessoal,
          cep, endereco, numero, complemento, bairro, cidade, estado,
          matricula, cargo_id || null, empresa_id || null, jornada_id || null, escolaridade_id || null, regime_trabalho_id || null,
          data_admissao, data_desligamento, salario, status || 'ativo',
          vale_transporte || false, vale_refeicao || false, valor_vale_refeicao, plano_saude || false,
          banco, agencia, conta, tipo_conta, pix,
          ctps, serie_ctps, pis_pasep, titulo_eleitor, reservista,
          nome_mae, nome_pai,
          observacoes, filtro1, filtro2, filtro3, foto_url,
          tipo_desligamento_id || null, motivo_desligamento_id || null, observacoes_desligamento,
        ]
      );

      res.status(201).json(result[0]);
    } catch (error: any) {
      console.error('Create colaborador error:', error);
      if (error.code === '23505') {
        return res.status(409).json({ error: 'CPF ou matricula ja cadastrado' });
      }
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  static async updateColaborador(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;
      const {
        nome, cpf, rg, data_nascimento, sexo, estado_civil, nacionalidade, naturalidade,
        telefone, celular, email, email_pessoal,
        cep, endereco, numero, complemento, bairro, cidade, estado,
        matricula, cargo_id, empresa_id, jornada_id, escolaridade_id, regime_trabalho_id,
        data_admissao, data_desligamento, salario, status,
        vale_transporte, vale_refeicao, valor_vale_refeicao, plano_saude,
        banco, agencia, conta, tipo_conta, pix,
        ctps, serie_ctps, pis_pasep, titulo_eleitor, reservista,
        nome_mae, nome_pai,
        observacoes, filtro1, filtro2, filtro3, foto_url,
        tipo_desligamento_id, motivo_desligamento_id, observacoes_desligamento,
      } = req.body;

      const result = await AppDataSource.query(
        `UPDATE rh_colaboradores SET
          nome = $1, cpf = $2, rg = $3, data_nascimento = $4, sexo = $5, estado_civil = $6, nacionalidade = $7, naturalidade = $8,
          telefone = $9, celular = $10, email = $11, email_pessoal = $12,
          cep = $13, endereco = $14, numero = $15, complemento = $16, bairro = $17, cidade = $18, estado = $19,
          matricula = $20, cargo_id = $21, empresa_id = $22, jornada_id = $23, escolaridade_id = $24, regime_trabalho_id = $25,
          data_admissao = $26, data_desligamento = $27, salario = $28, status = $29,
          vale_transporte = $30, vale_refeicao = $31, valor_vale_refeicao = $32, plano_saude = $33,
          banco = $34, agencia = $35, conta = $36, tipo_conta = $37, pix = $38,
          ctps = $39, serie_ctps = $40, pis_pasep = $41, titulo_eleitor = $42, reservista = $43,
          nome_mae = $44, nome_pai = $45,
          observacoes = $46, filtro1 = $47, filtro2 = $48, filtro3 = $49, foto_url = $50,
          tipo_desligamento_id = $51, motivo_desligamento_id = $52, observacoes_desligamento = $53,
          updated_at = NOW()
        WHERE id = $54
        RETURNING *`,
        [
          nome, cpf, rg, data_nascimento, sexo, estado_civil, nacionalidade, naturalidade,
          telefone, celular, email, email_pessoal,
          cep, endereco, numero, complemento, bairro, cidade, estado,
          matricula, cargo_id || null, empresa_id || null, jornada_id || null, escolaridade_id || null, regime_trabalho_id || null,
          data_admissao, data_desligamento, salario, status || 'ativo',
          vale_transporte || false, vale_refeicao || false, valor_vale_refeicao, plano_saude || false,
          banco, agencia, conta, tipo_conta, pix,
          ctps, serie_ctps, pis_pasep, titulo_eleitor, reservista,
          nome_mae, nome_pai,
          observacoes, filtro1, filtro2, filtro3, foto_url,
          tipo_desligamento_id || null, motivo_desligamento_id || null, observacoes_desligamento,
          id,
        ]
      );

      if (result.length === 0) {
        return res.status(404).json({ error: 'Colaborador not found' });
      }

      res.json(result[0]);
    } catch (error: any) {
      console.error('Update colaborador error:', error);
      if (error.code === '23505') {
        return res.status(409).json({ error: 'CPF ou matricula ja cadastrado' });
      }
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  static async deleteColaborador(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;

      const result = await AppDataSource.query(
        'DELETE FROM rh_colaboradores WHERE id = $1 RETURNING id',
        [id]
      );

      if (result.length === 0) {
        return res.status(404).json({ error: 'Colaborador not found' });
      }

      res.json({ message: 'Colaborador deleted successfully' });
    } catch (error) {
      console.error('Delete colaborador error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  static async getStats(req: AuthRequest, res: Response) {
    try {
      const empresa_id = req.query.empresa_id ? parseInt(req.query.empresa_id as string) : undefined;

      let empresaFilter = '';
      const params: any[] = [];

      if (empresa_id) {
        empresaFilter = 'WHERE empresa_id = $1';
        params.push(empresa_id);
      }

      const totalResult = await AppDataSource.query(
        `SELECT COUNT(*) as total FROM rh_colaboradores ${empresaFilter}`,
        params
      );

      const ativosResult = await AppDataSource.query(
        `SELECT COUNT(*) as total FROM rh_colaboradores ${empresaFilter ? empresaFilter + " AND status = 'ativo'" : "WHERE status = 'ativo'"}`,
        params
      );

      const desligadosResult = await AppDataSource.query(
        `SELECT COUNT(*) as total FROM rh_colaboradores ${empresaFilter ? empresaFilter + " AND status = 'desligado'" : "WHERE status = 'desligado'"}`,
        params
      );

      const generoResult = await AppDataSource.query(
        `SELECT sexo, COUNT(*) as total FROM rh_colaboradores ${empresaFilter} GROUP BY sexo`,
        params
      );

      const admissoesRecentesResult = await AppDataSource.query(
        `SELECT COUNT(*) as total FROM rh_colaboradores
         ${empresaFilter ? empresaFilter + ' AND' : 'WHERE'} data_admissao >= NOW() - INTERVAL '30 days'`,
        params
      );

      res.json({
        total: parseInt(totalResult[0].total),
        ativos: parseInt(ativosResult[0].total),
        desligados: parseInt(desligadosResult[0].total),
        genero: generoResult.map((r: any) => ({ sexo: r.sexo, total: parseInt(r.total) })),
        admissoesRecentes: parseInt(admissoesRecentesResult[0].total),
      });
    } catch (error) {
      console.error('Get RH stats error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
}
