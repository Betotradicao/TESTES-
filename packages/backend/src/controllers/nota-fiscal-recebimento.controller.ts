import { Request, Response } from 'express';
import bcrypt from 'bcrypt';
import { AppDataSource } from '../config/database';
import { NotaFiscalRecebimento } from '../entities/NotaFiscalRecebimento';
import { Employee } from '../entities/Employee';
import { MappingService } from '../services/mapping.service';
import { OracleService } from '../services/oracle.service';

interface AuthRequest extends Request {
  user?: any;
}

export class NotaFiscalRecebimentoController {

  /**
   * Lista NFs com filtros
   * GET /api/nota-fiscal-recebimento
   */
  static async listar(req: AuthRequest, res: Response) {
    try {
      const { data_de, data_ate, cod_loja, conferente, cpd, financeiro, fornecedor, sem_assinatura } = req.query;
      const repo = AppDataSource.getRepository(NotaFiscalRecebimento);

      let qb = repo.createQueryBuilder('nf');

      if (data_de) {
        qb = qb.andWhere('nf.data_recebimento >= :data_de', { data_de });
      }
      if (data_ate) {
        qb = qb.andWhere('nf.data_recebimento <= :data_ate', { data_ate });
      }
      if (cod_loja) {
        qb = qb.andWhere('nf.cod_loja = :cod_loja', { cod_loja: parseInt(cod_loja as string) });
      }
      if (conferente) {
        qb = qb.andWhere('nf.conferente_nome = :conferente', { conferente });
      }
      if (cpd) {
        qb = qb.andWhere('nf.cpd_nome = :cpd', { cpd });
      }
      if (financeiro) {
        qb = qb.andWhere('nf.financeiro_nome = :financeiro', { financeiro });
      }
      if (fornecedor) {
        qb = qb.andWhere('nf.fornecedor = :fornecedor', { fornecedor });
      }
      if (sem_assinatura === 'conferente') {
        qb = qb.andWhere('nf.conferente_nome IS NULL');
      } else if (sem_assinatura === 'cpd') {
        qb = qb.andWhere('nf.cpd_nome IS NULL');
      } else if (sem_assinatura === 'financeiro') {
        qb = qb.andWhere('nf.financeiro_nome IS NULL');
      }

      qb = qb.orderBy('nf.data_recebimento', 'DESC').addOrderBy('nf.id', 'DESC');

      const notas = await qb.getMany();
      res.json(notas);
    } catch (error: any) {
      console.error('Erro ao listar NFs:', error);
      res.status(500).json({ error: 'Erro ao listar notas fiscais', details: error.message });
    }
  }

  /**
   * Registrar nova NF
   * POST /api/nota-fiscal-recebimento
   */
  static async criar(req: AuthRequest, res: Response) {
    try {
      const { num_nota, fornecedor, cod_fornecedor, razao_social, data_recebimento, hora_recebimento, valor_nota, cod_loja } = req.body;

      if (!num_nota || !fornecedor || !data_recebimento || !hora_recebimento) {
        return res.status(400).json({ error: 'Campos obrigatórios: num_nota, fornecedor, data_recebimento, hora_recebimento' });
      }

      const repo = AppDataSource.getRepository(NotaFiscalRecebimento);
      const nf = repo.create({
        num_nota,
        fornecedor,
        cod_fornecedor: cod_fornecedor || null,
        razao_social: razao_social || null,
        data_recebimento,
        hora_recebimento,
        valor_nota: parseFloat(valor_nota) || 0,
        cod_loja: cod_loja || null,
        created_by: req.user?.id || null,
      });

      await repo.save(nf);
      res.json(nf);
    } catch (error: any) {
      console.error('Erro ao criar NF:', error);
      res.status(500).json({ error: 'Erro ao registrar nota fiscal', details: error.message });
    }
  }

  /**
   * Editar NF
   * PUT /api/nota-fiscal-recebimento/:id
   */
  static async editar(req: AuthRequest, res: Response) {
    try {
      const id = parseInt(req.params.id);
      const { num_nota, fornecedor, cod_fornecedor, data_recebimento, hora_recebimento, valor_nota } = req.body;

      const repo = AppDataSource.getRepository(NotaFiscalRecebimento);
      const nf = await repo.findOne({ where: { id } });

      if (!nf) {
        return res.status(404).json({ error: 'Nota fiscal não encontrada' });
      }

      if (num_nota !== undefined) nf.num_nota = num_nota;
      if (fornecedor !== undefined) nf.fornecedor = fornecedor;
      if (cod_fornecedor !== undefined) nf.cod_fornecedor = cod_fornecedor || null;
      if (data_recebimento !== undefined) nf.data_recebimento = data_recebimento;
      if (hora_recebimento !== undefined) nf.hora_recebimento = hora_recebimento;
      if (valor_nota !== undefined) nf.valor_nota = parseFloat(valor_nota) || 0;

      await repo.save(nf);
      res.json(nf);
    } catch (error: any) {
      console.error('Erro ao editar NF:', error);
      res.status(500).json({ error: 'Erro ao editar nota fiscal', details: error.message });
    }
  }

  /**
   * Excluir NF
   * DELETE /api/nota-fiscal-recebimento/:id
   */
  static async excluir(req: AuthRequest, res: Response) {
    try {
      const id = parseInt(req.params.id);
      const repo = AppDataSource.getRepository(NotaFiscalRecebimento);
      const nf = await repo.findOne({ where: { id } });

      if (!nf) {
        return res.status(404).json({ error: 'Nota fiscal não encontrada' });
      }

      await repo.remove(nf);
      res.json({ success: true });
    } catch (error: any) {
      console.error('Erro ao excluir NF:', error);
      res.status(500).json({ error: 'Erro ao excluir nota fiscal', details: error.message });
    }
  }

  /**
   * Assinar NF (Conferente, CPD ou Financeiro)
   * POST /api/nota-fiscal-recebimento/:id/assinar
   * Body: { tipo: 'conferente'|'cpd'|'financeiro', username: string, password: string }
   */
  static async assinar(req: AuthRequest, res: Response) {
    try {
      const id = parseInt(req.params.id);
      const { tipo, username, password } = req.body;

      if (!tipo || !username || !password) {
        return res.status(400).json({ error: 'Campos obrigatórios: tipo, username, password' });
      }

      if (!['conferente', 'cpd', 'financeiro'].includes(tipo)) {
        return res.status(400).json({ error: 'Tipo inválido. Use: conferente, cpd ou financeiro' });
      }

      // Buscar colaborador pelo username
      const empRepo = AppDataSource.getRepository(Employee);
      const employee = await empRepo.findOne({ where: { username, active: true } });

      if (!employee) {
        return res.status(401).json({ error: 'Colaborador não encontrado ou inativo' });
      }

      // Validar senha
      const isValidPassword = await bcrypt.compare(password, employee.password);
      if (!isValidPassword) {
        return res.status(401).json({ error: 'Senha incorreta' });
      }

      // Verificar flag correspondente
      const flagMap: Record<string, keyof Employee> = {
        conferente: 'is_conferente',
        cpd: 'is_cpd',
        financeiro: 'is_financeiro',
      };

      if (!employee[flagMap[tipo]]) {
        return res.status(403).json({ error: `Este colaborador não tem permissão de ${tipo.toUpperCase()}` });
      }

      // Buscar NF
      const nfRepo = AppDataSource.getRepository(NotaFiscalRecebimento);
      const nf = await nfRepo.findOne({ where: { id } });

      if (!nf) {
        return res.status(404).json({ error: 'Nota fiscal não encontrada' });
      }

      // Assinar
      const agora = new Date();
      if (tipo === 'conferente') {
        nf.conferente_id = employee.id;
        nf.conferente_nome = employee.name;
        nf.conferente_assinado_em = agora;
      } else if (tipo === 'cpd') {
        nf.cpd_id = employee.id;
        nf.cpd_nome = employee.name;
        nf.cpd_assinado_em = agora;
      } else if (tipo === 'financeiro') {
        nf.financeiro_id = employee.id;
        nf.financeiro_nome = employee.name;
        nf.financeiro_assinado_em = agora;
      }

      await nfRepo.save(nf);
      res.json({ success: true, nf });
    } catch (error: any) {
      console.error('Erro ao assinar NF:', error);
      res.status(500).json({ error: 'Erro ao assinar nota fiscal', details: error.message });
    }
  }

  /**
   * Assinar NFs em lote (Conferente, CPD ou Financeiro)
   * POST /api/nota-fiscal-recebimento/assinar-lote
   * Body: { tipo: 'conferente'|'cpd'|'financeiro', username: string, password: string, nota_ids: number[] }
   */
  static async assinarLote(req: AuthRequest, res: Response) {
    try {
      const { tipo, username, password, nota_ids } = req.body;

      console.log('[LOTE] Recebido:', { tipo, username, nota_ids_count: nota_ids?.length, nota_ids });

      if (!tipo || !username || !password || !nota_ids || !Array.isArray(nota_ids) || nota_ids.length === 0) {
        return res.status(400).json({ error: 'Campos obrigatórios: tipo, username, password, nota_ids (array)' });
      }

      if (!['conferente', 'cpd', 'financeiro'].includes(tipo)) {
        return res.status(400).json({ error: 'Tipo inválido. Use: conferente, cpd ou financeiro' });
      }

      // Buscar colaborador pelo username
      const empRepo = AppDataSource.getRepository(Employee);
      const employee = await empRepo.findOne({ where: { username, active: true } });

      if (!employee) {
        return res.status(401).json({ error: 'Colaborador não encontrado ou inativo' });
      }

      // Validar senha
      const isValidPassword = await bcrypt.compare(password, employee.password);
      if (!isValidPassword) {
        return res.status(401).json({ error: 'Senha incorreta' });
      }

      // Verificar flag correspondente
      const flagMap: Record<string, keyof Employee> = {
        conferente: 'is_conferente',
        cpd: 'is_cpd',
        financeiro: 'is_financeiro',
      };

      if (!employee[flagMap[tipo]]) {
        return res.status(403).json({ error: `Este colaborador não tem permissão de ${tipo.toUpperCase()}` });
      }

      // Buscar todas as NFs
      const nfRepo = AppDataSource.getRepository(NotaFiscalRecebimento);
      const agora = new Date();
      let assinadas = 0;

      for (const notaId of nota_ids) {
        try {
          const nfId = typeof notaId === 'string' ? parseInt(notaId) : notaId;
          console.log(`[LOTE] Processando nota id=${nfId} (original=${notaId}, type=${typeof notaId})`);

          const nf = await nfRepo.findOne({ where: { id: nfId } });
          if (!nf) {
            console.log(`[LOTE] Nota id=${nfId} NAO ENCONTRADA`);
            continue;
          }

          console.log(`[LOTE] Nota id=${nfId}: num_nota=${nf.num_nota}, conferente=${nf.conferente_nome || 'NULL'}, cpd=${nf.cpd_nome || 'NULL'}, fin=${nf.financeiro_nome || 'NULL'}`);

          // Assinar o tipo solicitado (se ainda não assinado)
          if (tipo === 'conferente' && !nf.conferente_nome) {
            nf.conferente_id = employee.id;
            nf.conferente_nome = employee.name;
            nf.conferente_assinado_em = agora;
            await nfRepo.save(nf);
            assinadas++;
            console.log(`[LOTE] ✓ Nota ${nf.num_nota} assinada como CONFERENTE`);
          } else if (tipo === 'cpd' && !nf.cpd_nome) {
            nf.cpd_id = employee.id;
            nf.cpd_nome = employee.name;
            nf.cpd_assinado_em = agora;
            await nfRepo.save(nf);
            assinadas++;
            console.log(`[LOTE] ✓ Nota ${nf.num_nota} assinada como CPD`);
          } else if (tipo === 'financeiro' && !nf.financeiro_nome) {
            nf.financeiro_id = employee.id;
            nf.financeiro_nome = employee.name;
            nf.financeiro_assinado_em = agora;
            await nfRepo.save(nf);
            assinadas++;
            console.log(`[LOTE] ✓ Nota ${nf.num_nota} assinada como FINANCEIRO`);
          } else {
            console.log(`[LOTE] Nota ${nf.num_nota} já assinada como ${tipo}, pulando`);
          }
        } catch (innerErr: any) {
          console.error(`[LOTE] Erro ao processar nota id=${notaId}:`, innerErr.message);
        }
      }

      console.log(`[LOTE] Resultado: ${assinadas}/${nota_ids.length} assinadas`);
      res.json({ success: true, assinadas, total: nota_ids.length });
    } catch (error: any) {
      console.error('Erro ao assinar NFs em lote:', error);
      res.status(500).json({ error: 'Erro ao assinar notas em lote', details: error.message });
    }
  }

  /**
   * Lista colaboradores com flags de recebimento
   * GET /api/nota-fiscal-recebimento/colaboradores
   */
  static async listarColaboradores(req: AuthRequest, res: Response) {
    try {
      const empRepo = AppDataSource.getRepository(Employee);
      const employees = await empRepo.find({
        where: { active: true },
        select: ['id', 'name', 'username', 'is_conferente', 'is_cpd', 'is_financeiro'],
        order: { name: 'ASC' },
      });

      // Agrupar por flag
      const conferentes = employees.filter((e: any) => e.is_conferente);
      const cpds = employees.filter((e: any) => e.is_cpd);
      const financeiros = employees.filter((e: any) => e.is_financeiro);

      res.json({ conferentes, cpds, financeiros, todos: employees });
    } catch (error: any) {
      console.error('Erro ao listar colaboradores:', error);
      res.status(500).json({ error: 'Erro ao listar colaboradores', details: error.message });
    }
  }

  /**
   * Resumo de NFs sem assinatura do ano vigente
   * GET /api/nota-fiscal-recebimento/resumo-pendentes
   */
  static async resumoPendentes(req: AuthRequest, res: Response) {
    try {
      const { cod_loja } = req.query;
      const repo = AppDataSource.getRepository(NotaFiscalRecebimento);
      const anoAtual = new Date().getFullYear();
      const dataInicio = `${anoAtual}-01-01`;

      let baseQb = repo.createQueryBuilder('nf')
        .where('nf.data_recebimento >= :dataInicio', { dataInicio });
      if (cod_loja) {
        baseQb = baseQb.andWhere('nf.cod_loja = :cod_loja', { cod_loja: parseInt(cod_loja as string) });
      }

      // Count NFs without each signature type
      const semConferente = await baseQb.clone().andWhere('nf.conferente_nome IS NULL').getCount();
      const semCpd = await baseQb.clone().andWhere('nf.cpd_nome IS NULL').getCount();
      const semFinanceiro = await baseQb.clone().andWhere('nf.financeiro_nome IS NULL').getCount();
      const total = await baseQb.clone().getCount();

      res.json({ semConferente, semCpd, semFinanceiro, total, ano: anoAtual });
    } catch (error: any) {
      console.error('Erro ao buscar resumo pendentes:', error);
      res.status(500).json({ error: 'Erro ao buscar resumo', details: error.message });
    }
  }

  /**
   * Verifica entrada de notas no Oracle (Validador XML de NFe Entradas)
   * POST /api/nota-fiscal-recebimento/verificar-entradas
   * Body: { notas: [{ num_nota, cod_fornecedor }] }
   * Retorna status: efetivada (DTA_ENTRADA NOT NULL), confirmada (FLG_CONFERIDO)
   */
  static async verificarEntradas(req: AuthRequest, res: Response) {
    try {
      const { notas } = req.body;

      if (!notas || !Array.isArray(notas) || notas.length === 0) {
        return res.json({});
      }

      const schema = await MappingService.getSchema();
      const tabFornecedorNota = `${schema}.${await MappingService.getRealTableName('TAB_FORNECEDOR_NOTA')}`;

      // Build conditions for each nota
      const conditions: string[] = [];
      const params: Record<string, any> = {};

      notas.forEach((n: any, idx: number) => {
        if (n.num_nota) {
          if (n.cod_fornecedor) {
            conditions.push(`(fn.NUM_NF_FORN = :nf${idx} AND fn.COD_FORNECEDOR = :forn${idx})`);
            params[`nf${idx}`] = n.num_nota.toString();
            params[`forn${idx}`] = parseInt(n.cod_fornecedor);
          } else {
            conditions.push(`(fn.NUM_NF_FORN = :nf${idx})`);
            params[`nf${idx}`] = n.num_nota.toString();
          }
        }
      });

      if (conditions.length === 0) {
        return res.json({});
      }

      const query = `
        SELECT fn.NUM_NF_FORN, fn.COD_FORNECEDOR, fn.DTA_ENTRADA, fn.DTA_EMISSAO,
               fn.VAL_TOTAL_NF,
               NVL(fn.FLG_NFE_PENDENTE, 'N') as FLG_NFE_PENDENTE,
               NVL(fn.FLG_CONFERIDO, 'N') as FLG_CONFERIDO,
               NVL(fn.FLG_CANCELADO, 'N') as FLG_CANCELADO
        FROM ${tabFornecedorNota} fn
        WHERE (${conditions.join(' OR ')})
          AND NVL(fn.FLG_CANCELADO, 'N') = 'N'
      `;

      const rows = await OracleService.query(query, params);

      // Build result map: key = "numNota_codFornecedor"
      const result: Record<string, any> = {};
      rows.forEach((r: any) => {
        const key = `${r.NUM_NF_FORN}_${r.COD_FORNECEDOR}`;
        const keySimple = `${r.NUM_NF_FORN}`;
        const efetivada = r.DTA_ENTRADA != null;
        const confirmada = r.FLG_CONFERIDO === 'S';
        const entrada = {
          encontrada: true,
          efetivada,
          confirmada,
          data_entrada: r.DTA_ENTRADA || null,
          data_emissao: r.DTA_EMISSAO || null,
          valor_oracle: r.VAL_TOTAL_NF || 0,
          status: efetivada ? 'FINALIZADA' : 'PENDENTE'
        };
        // Use cod_fornecedor key first (more specific), then simple key as fallback
        result[key] = entrada;
        if (!result[keySimple]) {
          result[keySimple] = entrada;
        }
      });

      res.json(result);
    } catch (error: any) {
      console.error('Erro ao verificar entradas Oracle:', error);
      res.status(500).json({ error: 'Erro ao verificar entradas', details: error.message });
    }
  }

  /**
   * Lista fornecedores do Oracle com CNPJ
   * GET /api/nota-fiscal-recebimento/fornecedores
   */
  static async listarFornecedores(req: AuthRequest, res: Response) {
    try {
      const schema = await MappingService.getSchema();
      const tabFornecedor = `${schema}.${await MappingService.getRealTableName('TAB_FORNECEDOR')}`;
      const tabFornecedorNota = `${schema}.${await MappingService.getRealTableName('TAB_FORNECEDOR_NOTA')}`;

      const query = `
        SELECT f.COD_FORNECEDOR, NVL(f.DES_FANTASIA, f.DES_FORNECEDOR) as DES_FANTASIA, f.NUM_CGC
        FROM ${tabFornecedor} f
        WHERE NVL(f.IND_ATIVO, 'S') = 'S'
          AND f.NUM_CGC IS NOT NULL
        ORDER BY DES_FANTASIA
      `;

      const rows = await OracleService.query(query, {});
      const fornecedores = rows.map((r: any) => ({
        cod: r.COD_FORNECEDOR,
        nome: r.DES_FANTASIA,
        cnpj: r.NUM_CGC || ''
      }));

      res.json(fornecedores);
    } catch (error: any) {
      console.error('Erro ao listar fornecedores Oracle:', error);
      res.status(500).json({ error: 'Erro ao listar fornecedores', details: error.message });
    }
  }

  /**
   * Busca uma NF pelo número no Oracle (SNFETNE)
   * Retorna fornecedor, valor, CNPJ e se tem cadastro local
   * GET /api/nota-fiscal-recebimento/buscar-nf-oracle/:numNota
   */
  static async buscarNfOracle(req: AuthRequest, res: Response) {
    try {
      const numNota = req.params.numNota;
      if (!numNota) return res.status(400).json({ error: 'Número da nota é obrigatório' });

      const schema = await MappingService.getSchema();

      // Buscar na SNFETNE + SNFETNM (razão social)
      const query = `
        SELECT
          n.ID_NOTA,
          n.NR_NOTA,
          n.DS_SERIE,
          n.DT_EMISSAO,
          n.VR_TOTAL,
          n.NR_CNPJE,
          n.NR_CNPJD,
          n.NR_CHAVE,
          n.ST_NFE,
          NVL(n.FG_ENT, 'P') as FG_ENT,
          m.DS_RAZAOSOCIAL
        FROM ${schema}.SNFETNE n
        LEFT JOIN ${schema}.SNFETNM m ON m.NR_CHAVE = n.NR_CHAVE
        WHERE n.NR_NOTA = :numNota
        ORDER BY n.DT_EMISSAO DESC
      `;

      const rows = await OracleService.query(query, { numNota: parseInt(numNota) });

      if (rows.length === 0) {
        return res.json({ found: false });
      }

      // Pegar a mais recente (primeira por ORDER BY)
      const r = rows[0];

      // Verificar se o fornecedor tem cadastro local no Oracle (TAB_FORNECEDOR) pelo CNPJ
      let codFornecedor: number | null = null;
      let fornecedorLocal: string | null = null;
      if (r.NR_CNPJE) {
        try {
          const tabFornecedor = `${schema}.${await MappingService.getRealTableName('TAB_FORNECEDOR')}`;
          const fornRows = await OracleService.query(
            `SELECT COD_FORNECEDOR, NVL(DES_FANTASIA, DES_FORNECEDOR) as NOME
             FROM ${tabFornecedor}
             WHERE REPLACE(REPLACE(REPLACE(NUM_CGC, '.', ''), '-', ''), '/', '') = :cnpj
             AND ROWNUM <= 1`,
            { cnpj: r.NR_CNPJE.replace(/\D/g, '') }
          );
          if (fornRows.length > 0) {
            codFornecedor = fornRows[0].COD_FORNECEDOR;
            fornecedorLocal = fornRows[0].NOME;
          }
        } catch (e) {
          // Ignore - fornecedor lookup is optional
        }
      }

      const cnpjFormatado = r.NR_CNPJE ? r.NR_CNPJE.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5') : '';

      res.json({
        found: true,
        num_nf: r.NR_NOTA,
        serie: r.DS_SERIE,
        fornecedor: r.DS_RAZAOSOCIAL || '',
        fornecedor_local: fornecedorLocal,
        cod_fornecedor: codFornecedor,
        cnpj: cnpjFormatado,
        cnpj_raw: r.NR_CNPJE || '',
        valor_total: r.VR_TOTAL || 0,
        data_emissao: r.DT_EMISSAO,
        chave_acesso: r.NR_CHAVE || '',
        status_nfe: r.ST_NFE,
        efetivada: r.FG_ENT === 'R',
        tem_cadastro: codFornecedor !== null,
        total_resultados: rows.length
      });
    } catch (error: any) {
      console.error('Erro ao buscar NF no Oracle:', error);
      res.status(500).json({ error: 'Erro ao buscar nota fiscal', details: error.message });
    }
  }

  /**
   * Lista notas a chegar do Oracle (Validador XML de NFe Entradas)
   * Tabela principal: SNFETNE (NFe eletrônicas recebidas do SEFAZ)
   * JOIN com SNFETNM (Manifesto) para obter razão social do fornecedor
   * GET /api/nota-fiscal-recebimento/notas-a-chegar
   */
  static async listarNotasAChegar(req: AuthRequest, res: Response) {
    try {
      const { data_de, data_ate, fornecedor, efetivadas, validadas, tipo_data, cod_loja } = req.query;

      const schema = await MappingService.getSchema();

      let where = `1=1`;
      const params: Record<string, any> = {};

      // Tipo de data: 'emissao' (DT_EMISSAO) ou 'processada' (DT_PROC)
      const campoData = tipo_data === 'processada' ? 'n.DT_PROC' : 'n.DT_EMISSAO';

      // Filtro de datas
      if (data_de) {
        where += ` AND ${campoData} >= TO_DATE(:data_de, 'YYYY-MM-DD')`;
        params.data_de = data_de;
      }
      if (data_ate) {
        where += ` AND ${campoData} <= TO_DATE(:data_ate, 'YYYY-MM-DD') + 1`;
        params.data_ate = data_ate;
      }

      // Se nenhuma data informada, ultimos 30 dias
      if (!data_de && !data_ate) {
        where += ` AND ${campoData} >= SYSDATE - 30`;
      }

      // Filtro por fornecedor (nome ou CNPJ)
      if (fornecedor && String(fornecedor).trim()) {
        const searchTerm = String(fornecedor).trim();
        const digits = searchTerm.replace(/\D/g, '');
        if (digits.length > 0) {
          // Search by name OR CNPJ
          where += ` AND (UPPER(m.DS_RAZAOSOCIAL) LIKE UPPER(:fornecedor) OR REPLACE(REPLACE(REPLACE(n.NR_CNPJE,'.',''),'-',''),'/','') LIKE :fornecedor_cnpj)`;
          params.fornecedor = `%${searchTerm}%`;
          params.fornecedor_cnpj = `%${digits}%`;
        } else {
          // Search only by name (no digits = not a CNPJ)
          where += ` AND UPPER(m.DS_RAZAOSOCIAL) LIKE UPPER(:fornecedor)`;
          params.fornecedor = `%${searchTerm}%`;
        }
      }

      // Filtro NFe Efetivadas: 'com' = todas, 'sem' = sem entrada, 'somente' = apenas efetivadas
      // FG_ENT: 'R' = Realizada/Efetivada, 'P' = Pendente, 'D' = Desconhecida
      if (efetivadas === 'sem') {
        where += ` AND NVL(n.FG_ENT, 'P') != 'R'`;
      } else if (efetivadas === 'somente') {
        where += ` AND n.FG_ENT = 'R'`;
      }
      // 'com' = sem filtro adicional (mostra todas)

      // Filtro NFe Validadas (FLG_CONFIRMA_VAL): 'S' = validada, 'N' = nao validada
      if (validadas === 'nao') {
        where += ` AND NVL(n.FLG_CONFIRMA_VAL, 'N') != 'S'`;
      } else if (validadas === 'sim') {
        where += ` AND n.FLG_CONFIRMA_VAL = 'S'`;
      }
      // 'todos' = sem filtro adicional

      // Ordenacao baseada no tipo de data
      const campoOrdem = tipo_data === 'processada' ? 'n.DT_PROC' : 'n.DT_EMISSAO';

      const query = `
        SELECT * FROM (
          SELECT
            n.ID_NOTA,
            n.NR_NOTA,
            n.DS_SERIE,
            n.DT_EMISSAO,
            n.DT_PROC,
            n.VR_TOTAL,
            n.NR_CNPJE,
            n.NR_CNPJD,
            n.NR_CHAVE,
            n.ST_NFE,
            NVL(n.FG_ENT, 'P') as FG_ENT,
            NVL(n.FLG_CONFIRMA_VAL, 'N') as FLG_CONFIRMA_VAL,
            n.USUARIO_VALIDACAO,
            n.DTA_VALIDACAO,
            n.DT_RECMERC,
            NVL(n.FG_PROC, 'N') as FG_PROC,
            m.DS_RAZAOSOCIAL,
            m.ST_MANIFESTO as MANIFESTO_STATUS,
            NVL(m.FG_CIENCIA, 'N') as FG_CIENCIA,
            NVL(m.FG_CONFIRMACAO, 'N') as FG_CONFIRMACAO,
            NVL(m.FG_DESCONHEC, 'N') as FG_DESCONHEC,
            NVL(m.FG_OPNAOREALIZ, 'N') as FG_OPNAOREALIZ
          FROM ${schema}.SNFETNE n
          LEFT JOIN ${schema}.SNFETNM m ON m.NR_CHAVE = n.NR_CHAVE
          WHERE ${where}
          ORDER BY ${campoOrdem} DESC, n.NR_NOTA DESC
        ) WHERE ROWNUM <= 500
      `;

      console.log('[Notas a Chegar] SNFETNE query - params:', JSON.stringify({ data_de, data_ate, fornecedor, efetivadas, validadas, tipo_data }));

      const rows = await OracleService.query(query, params);
      console.log('[Notas a Chegar] Rows returned:', rows.length);

      // Determine manifesto label from SNFETNM flags
      const getManifestoLabel = (r: any) => {
        if (r.FG_CONFIRMACAO === 'S') return 'Confirmacao';
        if (r.FG_CIENCIA === 'S') return 'Ciencia';
        if (r.FG_DESCONHEC === 'S') return 'Desconhecimento';
        if (r.FG_OPNAOREALIZ === 'S') return 'Op. Nao Realiz.';
        return '';
      };

      const notas = rows.map((r: any) => ({
        id_nota: r.ID_NOTA,
        num_nf: r.NR_NOTA,
        serie: r.DS_SERIE,
        fornecedor: r.DS_RAZAOSOCIAL || '',
        cnpj: r.NR_CNPJE || '',
        cnpj_dest: r.NR_CNPJD || '',
        data_emissao: r.DT_EMISSAO,
        data_processamento: r.DT_PROC,
        data_recebimento: r.DT_RECMERC,
        valor_total: r.VR_TOTAL || 0,
        chave_acesso: r.NR_CHAVE || '',
        status_nfe: r.ST_NFE || '',
        efetivada: r.FG_ENT === 'R',
        confirmada: r.FLG_CONFIRMA_VAL === 'S',
        manifesto: getManifestoLabel(r),
        usuario_validacao: r.USUARIO_VALIDACAO || '',
        data_validacao: r.DTA_VALIDACAO,
        processado: r.FG_PROC === 'S',
        status: r.FG_ENT === 'R' ? 'FINALIZADA' : 'PENDENTE'
      }));

      // Stats
      const total = notas.length;
      const efetiv = notas.filter((n: any) => n.efetivada).length;
      const pend = notas.filter((n: any) => !n.efetivada).length;
      const valorTotal = notas.reduce((s: number, n: any) => s + (parseFloat(n.valor_total) || 0), 0);

      res.json({
        notas,
        stats: { total, efetivadas: efetiv, pendentes: pend, valorTotal }
      });
    } catch (error: any) {
      console.error('Erro ao listar notas a chegar:', error);
      res.status(500).json({ error: 'Erro ao listar notas a chegar', details: error.message });
    }
  }

  /**
   * Debug: retorna colunas relevantes de SNFETNE e SNFETNM para uma nota específica
   * GET /api/nota-fiscal-recebimento/debug-nota/:nrNota
   */
  static async debugNota(req: AuthRequest, res: Response) {
    try {
      const nrNota = req.params.nrNota;
      const schema = await MappingService.getSchema();

      // 1. SNFETNE - exclude LOB columns (DS_PROTOCOLO)
      const snfetne = await OracleService.query(
        `SELECT ID_NOTA, NR_NOTA, DS_SERIE, DT_EMISSAO, SQ_MSG, DT_PROC, DT_MSG, HR_MSG,
                VR_TOTAL, NR_CNPJE, NR_CNPJD, NR_CHAVE, TIPO_STATUS, ST_NFE, COD_PERFIL,
                FG_PROC, FG_ENT, DT_RECMERC, FG_EXP, NR_PROTOCOLO, DS_VERSAO, TIPO_PERFIL,
                FLG_CONFIRMA_VAL, TIPO_MANIFESTO, FG_IMPORTADO, ST_MANIFESTO, NR_PLACA,
                FG_IGNORA_TRIB, USUARIO_VALIDACAO, DTA_VALIDACAO, FG_IGNORA_TRIB_ICMS,
                COD_LOJA_VAL, FG_IGNORA_TRIB_PIS, FG_PROC_AUDITOR_IF, FG_CONS_TRIB_DIST,
                FLG_ENVIADO_IF, TIPO_ENT_PROC_NFE, DES_LOG_PROC_NFE, TP_ORIG,
                FG_IGNORA_IBS_CBS, FG_PROC_COMPRA_OBRIGATORIA
         FROM ${schema}.SNFETNE WHERE NR_NOTA = :nr`, { nr: nrNota }
      );

      // 2. SNFETNM
      let snfetnm: any[] = [];
      if (snfetne.length > 0 && snfetne[0].NR_CHAVE) {
        snfetnm = await OracleService.query(
          `SELECT * FROM ${schema}.SNFETNM WHERE NR_CHAVE = :chave`, { chave: snfetne[0].NR_CHAVE }
        );
      }

      // 3. SNFETNEI items - find by ID_NOTA or NR_NOTA
      let snfetnei_info: any = {};
      try {
        // Get column names first
        const cols = await OracleService.query(
          `SELECT COLUMN_NAME FROM ALL_TAB_COLUMNS WHERE OWNER = :owner AND TABLE_NAME = 'SNFETNEI' ORDER BY COLUMN_ID`,
          { owner: schema }
        );
        snfetnei_info.columns = cols.map((c: any) => c.COLUMN_NAME);

        if (snfetne.length > 0) {
          // Try linking by ID_NOTA
          const cnt = await OracleService.query(
            `SELECT COUNT(*) as CNT FROM ${schema}.SNFETNEI WHERE ID_NOTA = :id`, { id: snfetne[0].ID_NOTA }
          );
          snfetnei_info.count_by_id = cnt[0]?.CNT || 0;

          // Get sample items (first 3, non-LOB columns only)
          const safeCols = snfetnei_info.columns.filter((c: string) => !['DS_XML', 'DS_PROTOCOLO', 'DS_OBS'].includes(c));
          const items = await OracleService.query(
            `SELECT ${safeCols.join(', ')} FROM ${schema}.SNFETNEI WHERE ID_NOTA = :id AND ROWNUM <= 3`, { id: snfetne[0].ID_NOTA }
          );
          snfetnei_info.sample_items = items;
        }
      } catch (e: any) {
        snfetnei_info.error = e.message;
        // Fallback: try with NR_NOTA if ID_NOTA failed
        try {
          const cols2 = await OracleService.query(
            `SELECT COLUMN_NAME, DATA_TYPE FROM ALL_TAB_COLUMNS WHERE OWNER = :owner AND TABLE_NAME = 'SNFETNEI' ORDER BY COLUMN_ID`,
            { owner: schema }
          );
          snfetnei_info.columns_detail = cols2.map((c: any) => `${c.COLUMN_NAME}(${c.DATA_TYPE})`);
        } catch (e2: any) {
          snfetnei_info.error2 = e2.message;
        }
      }

      // 4. Related SNFETN* tables
      let relatedTables: any[] = [];
      try {
        relatedTables = await OracleService.query(
          `SELECT TABLE_NAME FROM ALL_TABLES WHERE OWNER = :owner AND TABLE_NAME LIKE 'SNFETN%' ORDER BY TABLE_NAME`, { owner: schema }
        );
      } catch (e: any) {
        relatedTables = [{ error: e.message }];
      }

      res.json({
        nota: nrNota,
        snfetne: snfetne,
        snfetnm: snfetnm,
        snfetnei_info,
        related_tables: relatedTables.map((t: any) => t.TABLE_NAME || t)
      });
    } catch (error: any) {
      console.error('Erro debug nota:', error);
      res.status(500).json({ error: error.message });
    }
  }
}
