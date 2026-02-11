/**
 * Calendário de Atendimento Service
 * Consulta fornecedores no Oracle + histórico de entregas para calendário
 */

import { OracleService } from './oracle.service';
import { MappingService } from './mapping.service';
import { AppDataSource } from '../config/database';
import { FornecedorAgendamento } from '../entities/FornecedorAgendamento';
import { OpcaoDropdown } from '../entities/OpcaoDropdown';

export interface FornecedorCadastro {
  COD_FORNECEDOR: number;
  DES_FORNECEDOR: string;
  DES_FANTASIA: string;
  NUM_CGC: string;
  DES_CONTATO: string;
  NUM_FONE: string;
  NUM_CELULAR: string;
  DES_EMAIL: string;
  NUM_PRAZO: number;
  NUM_FREQ_VISITA: number;
  NUM_MED_CPGTO: number;
  CONDICOES_PGTO: string;
  TIPO_CONDICAO: string;
  VAL_CREDITO: number;
  VAL_DEBITO: number;
  PRAZO_MEDIO_REAL: number;
  QTD_NFS_PRAZO: number;
  PED_MIN_VAL: number;
  DES_CLASSIFICACAO: string;
  COD_CLASSIF: number;
  QTD_NFS_90D: number;
  ULTIMO_ATENDIMENTO: string;
}

export interface AtendimentoDia {
  COD_FORNECEDOR: number;
  DES_FANTASIA: string;
  DES_FORNECEDOR: string;
  NUM_NF_FORN: string;
  DTA_ENTRADA: string;
  DTA_EMISSAO: string;
  VAL_TOTAL_NF: number;
  NUM_PEDIDO: number;
  PRAZO_DIAS: number;
  DES_CLASSIFICACAO: string;
}

export interface VisaoMensal {
  DIA: number;
  DIA_SEMANA: string;
  QTD_FORNECEDORES: number;
  QTD_NFS: number;
  VAL_TOTAL: number;
  FORNECEDORES: string;
}

export class CalendarioAtendimentoService {

  /**
   * Lista fornecedores com dados cadastrais completos
   */
  static async listarFornecedores(filtros: {
    busca?: string;
    classificacoes?: number[];
    codLoja?: number;
    pagina?: number;
    limite?: number;
    statusNF?: string; // 'todos' | 'com_nf' | 'sem_nf'
  }): Promise<{ fornecedores: FornecedorCadastro[]; total: number }> {
    const schema = await MappingService.getSchema();
    const tabFornecedor = `${schema}.${await MappingService.getRealTableName('TAB_FORNECEDOR')}`;
    const tabClassificacao = `${schema}.${await MappingService.getRealTableName('TAB_CLASSIFICACAO')}`;
    const tabFornecedorNota = `${schema}.${await MappingService.getRealTableName('TAB_FORNECEDOR_NOTA')}`;
    const tabCondicaoFornecedor = `${schema}.${await MappingService.getRealTableName('TAB_CONDICAO_FORNECEDOR')}`;
    const tabCondicao = `${schema}.${await MappingService.getRealTableName('TAB_CONDICAO')}`;
    const tabPedido = `${schema}.${await MappingService.getRealTableName('TAB_PEDIDO')}`;

    const conditions: string[] = [];
    const params: any = {};

    // Filtro por status de NFs nos últimos 12 meses
    if (filtros.statusNF === 'com_nf') {
      conditions.push(`EXISTS (SELECT 1 FROM ${tabFornecedorNota} fn_ativo WHERE fn_ativo.COD_FORNECEDOR = f.COD_FORNECEDOR AND fn_ativo.DTA_ENTRADA >= SYSDATE - 365)`);
    } else if (filtros.statusNF === 'sem_nf') {
      conditions.push(`NOT EXISTS (SELECT 1 FROM ${tabFornecedorNota} fn_ativo WHERE fn_ativo.COD_FORNECEDOR = f.COD_FORNECEDOR AND fn_ativo.DTA_ENTRADA >= SYSDATE - 365)`);
    }

    if (filtros.busca) {
      conditions.push(`(UPPER(f.DES_FORNECEDOR) LIKE UPPER(:busca) OR UPPER(f.DES_FANTASIA) LIKE UPPER(:busca) OR f.NUM_CGC LIKE :busca)`);
      params.busca = `%${filtros.busca}%`;
    }

    if (filtros.classificacoes && filtros.classificacoes.length > 0) {
      const temSemClassif = filtros.classificacoes.includes(0);
      const comClassif = filtros.classificacoes.filter(c => c !== 0);
      const partes: string[] = [];

      if (comClassif.length > 0) {
        const binds = comClassif.map((_, i) => `:classif${i}`).join(', ');
        partes.push(`f.COD_CLASSIF IN (${binds})`);
        comClassif.forEach((c, i) => { params[`classif${i}`] = c; });
      }

      if (temSemClassif) {
        partes.push(`(f.COD_CLASSIF IS NULL OR f.COD_CLASSIF = 0)`);
      }

      conditions.push(`(${partes.join(' OR ')})`);
    }

    const whereClause = conditions.length > 0 ? 'WHERE ' + conditions.join(' AND ') : '';
    const pagina = filtros.pagina || 1;
    const limite = filtros.limite || 50;
    const offset = (pagina - 1) * limite;

    // Query total
    const countQuery = `
      SELECT COUNT(*) as TOTAL
      FROM ${tabFornecedor} f
      ${whereClause}
    `;

    const countResult = await OracleService.query(countQuery, params);
    const total = countResult[0]?.TOTAL || 0;

    // Query principal com paginação
    const query = `
      SELECT * FROM (
        SELECT
          f.COD_FORNECEDOR,
          f.DES_FORNECEDOR,
          NVL(f.DES_FANTASIA, f.DES_FORNECEDOR) as DES_FANTASIA,
          f.NUM_CGC,
          f.DES_CONTATO,
          f.NUM_FONE,
          f.NUM_CELULAR,
          f.DES_EMAIL,
          NVL(f.NUM_PRAZO, 0) as NUM_PRAZO,
          NVL(f.NUM_FREQ_VISITA, 0) as NUM_FREQ_VISITA,
          NVL(f.NUM_MED_CPGTO, 0) as NUM_MED_CPGTO,
          NVL(conds.CONDICOES_PGTO, '') as CONDICOES_PGTO,
          NVL(conds.TIPO_CONDICAO, '') as TIPO_CONDICAO,
          NVL(f.VAL_CREDITO, 0) as VAL_CREDITO,
          NVL(f.VAL_DEBITO, 0) as VAL_DEBITO,
          NVL(pm.PRAZO_MEDIO_REAL, 0) as PRAZO_MEDIO_REAL,
          NVL(pm.QTD_NFS_PRAZO, 0) as QTD_NFS_PRAZO,
          NVL(f.PED_MIN_VAL, 0) as PED_MIN_VAL,
          NVL(c.DES_CLASSIF, 'SEM CLASSIFICAÇÃO') as DES_CLASSIFICACAO,
          f.COD_CLASSIF,
          NVL(ult.QTD_NFS_180D, 0) as QTD_NFS_90D,
          ult.ULTIMO_ATENDIMENTO,
          ROW_NUMBER() OVER (ORDER BY NVL(ult.QTD_NFS_180D, 0) DESC, f.DES_FANTASIA) as RN
        FROM ${tabFornecedor} f
        LEFT JOIN ${tabClassificacao} c ON c.COD_CLASSIF = f.COD_CLASSIF
        LEFT JOIN (
          SELECT
            cf.COD_FORNECEDOR,
            LISTAGG(cf.NUM_CONDICAO, '/') WITHIN GROUP (ORDER BY cf.NUM_CONDICAO) as CONDICOES_PGTO,
            MAX(co.DES_CONDICAO) as TIPO_CONDICAO
          FROM ${tabCondicaoFornecedor} cf
          LEFT JOIN ${tabCondicao} co ON co.COD_CONDICAO = cf.COD_CONDICAO
          GROUP BY cf.COD_FORNECEDOR
        ) conds ON conds.COD_FORNECEDOR = f.COD_FORNECEDOR
        LEFT JOIN (
          SELECT
            fn.COD_FORNECEDOR,
            COUNT(*) as QTD_NFS_180D,
            MAX(fn.DTA_ENTRADA) as ULTIMO_ATENDIMENTO
          FROM ${tabFornecedorNota} fn
          WHERE fn.DTA_ENTRADA >= SYSDATE - 180
          AND NVL(fn.FLG_CANCELADO, 'N') = 'N'
          GROUP BY fn.COD_FORNECEDOR
        ) ult ON ult.COD_FORNECEDOR = f.COD_FORNECEDOR
        LEFT JOIN (
          SELECT
            fn.COD_FORNECEDOR,
            ROUND(AVG(TRUNC(fn.DTA_ENTRADA) - TRUNC(ped.DTA_EMISSAO)), 1) as PRAZO_MEDIO_REAL,
            COUNT(DISTINCT fn.NUM_NF_FORN) as QTD_NFS_PRAZO
          FROM ${tabFornecedorNota} fn
          JOIN ${tabPedido} ped ON ped.NUM_PEDIDO = fn.NUM_PEDIDO AND ped.TIPO_PARCEIRO = 1
          WHERE fn.DTA_ENTRADA >= SYSDATE - 180
          AND fn.NUM_PEDIDO IS NOT NULL
          AND fn.NUM_PEDIDO > 0
          AND NVL(fn.FLG_CANCELADO, 'N') = 'N'
          GROUP BY fn.COD_FORNECEDOR
        ) pm ON pm.COD_FORNECEDOR = f.COD_FORNECEDOR
        ${whereClause}
      ) WHERE RN > :offset AND RN <= :maxRow
    `;

    params.offset = offset;
    params.maxRow = offset + limite;

    const fornecedores = await OracleService.query(query, params);

    return { fornecedores, total };
  }

  /**
   * Visão mensal: entregas agrupadas por dia do mês
   */
  static async visaoMensal(ano: number, mes: number, codLoja?: number): Promise<VisaoMensal[]> {
    const schema = await MappingService.getSchema();
    const tabFornecedorNota = `${schema}.${await MappingService.getRealTableName('TAB_FORNECEDOR_NOTA')}`;
    const tabFornecedor = `${schema}.${await MappingService.getRealTableName('TAB_FORNECEDOR')}`;

    const params: any = { ano, mes };
    let lojaFilter = '';

    if (codLoja) {
      lojaFilter = 'AND fn.COD_LOJA = :codLoja';
      params.codLoja = codLoja;
    }

    const query = `
      SELECT
        EXTRACT(DAY FROM fn.DTA_ENTRADA) as DIA,
        TO_CHAR(fn.DTA_ENTRADA, 'DY', 'NLS_DATE_LANGUAGE=PORTUGUESE') as DIA_SEMANA,
        COUNT(DISTINCT fn.COD_FORNECEDOR) as QTD_FORNECEDORES,
        COUNT(*) as QTD_NFS,
        NVL(SUM(fn.VAL_TOTAL_NF), 0) as VAL_TOTAL,
        LISTAGG(DISTINCT NVL(f.DES_FANTASIA, f.DES_FORNECEDOR), ', ') WITHIN GROUP (ORDER BY NVL(f.DES_FANTASIA, f.DES_FORNECEDOR)) as FORNECEDORES
      FROM ${tabFornecedorNota} fn
      LEFT JOIN ${tabFornecedor} f ON f.COD_FORNECEDOR = fn.COD_FORNECEDOR
      WHERE EXTRACT(YEAR FROM fn.DTA_ENTRADA) = :ano
      AND EXTRACT(MONTH FROM fn.DTA_ENTRADA) = :mes
      AND NVL(fn.FLG_CANCELADO, 'N') = 'N'
      ${lojaFilter}
      GROUP BY EXTRACT(DAY FROM fn.DTA_ENTRADA), TO_CHAR(fn.DTA_ENTRADA, 'DY', 'NLS_DATE_LANGUAGE=PORTUGUESE')
      ORDER BY DIA
    `;

    return await OracleService.query(query, params);
  }

  /**
   * Atendimento de um dia específico: detalhamento das NFs recebidas
   */
  static async atendimentoDiario(data: string, codLoja?: number): Promise<AtendimentoDia[]> {
    const schema = await MappingService.getSchema();
    const tabFornecedorNota = `${schema}.${await MappingService.getRealTableName('TAB_FORNECEDOR_NOTA')}`;
    const tabFornecedor = `${schema}.${await MappingService.getRealTableName('TAB_FORNECEDOR')}`;
    const tabClassificacao = `${schema}.${await MappingService.getRealTableName('TAB_CLASSIFICACAO')}`;

    const params: any = { data };
    let lojaFilter = '';

    if (codLoja) {
      lojaFilter = 'AND fn.COD_LOJA = :codLoja';
      params.codLoja = codLoja;
    }

    const query = `
      SELECT
        fn.COD_FORNECEDOR,
        NVL(f.DES_FANTASIA, f.DES_FORNECEDOR) as DES_FANTASIA,
        f.DES_FORNECEDOR,
        fn.NUM_NF_FORN,
        TO_CHAR(fn.DTA_ENTRADA, 'DD/MM/YYYY HH24:MI') as DTA_ENTRADA,
        TO_CHAR(fn.DTA_EMISSAO, 'DD/MM/YYYY') as DTA_EMISSAO,
        NVL(fn.VAL_TOTAL_NF, 0) as VAL_TOTAL_NF,
        fn.NUM_PEDIDO,
        CASE WHEN fn.NUM_PEDIDO IS NOT NULL AND fn.NUM_PEDIDO > 0
          THEN TRUNC(fn.DTA_ENTRADA) - TRUNC(fn.DTA_EMISSAO)
          ELSE NULL
        END as PRAZO_DIAS,
        NVL(c.DES_CLASSIF, 'SEM CLASSIFICAÇÃO') as DES_CLASSIFICACAO
      FROM ${tabFornecedorNota} fn
      LEFT JOIN ${tabFornecedor} f ON f.COD_FORNECEDOR = fn.COD_FORNECEDOR
      LEFT JOIN ${tabClassificacao} c ON c.COD_CLASSIF = f.COD_CLASSIF
      WHERE TRUNC(fn.DTA_ENTRADA) = TO_DATE(:data, 'YYYY-MM-DD')
      AND NVL(fn.FLG_CANCELADO, 'N') = 'N'
      ${lojaFilter}
      ORDER BY fn.DTA_ENTRADA DESC
    `;

    return await OracleService.query(query, params);
  }

  /**
   * Pedidos emitidos em um dia específico (TAB_FORNECEDOR_PEDIDO)
   */
  static async pedidosDoDia(data: string, codLoja?: number): Promise<any[]> {
    const schema = await MappingService.getSchema();
    const tabPedido = `${schema}.${await MappingService.getRealTableName('TAB_PEDIDO')}`;
    const tabFornecedor = `${schema}.${await MappingService.getRealTableName('TAB_FORNECEDOR')}`;

    const params: any = { data };

    const query = `
      SELECT
        p.NUM_PEDIDO,
        p.COD_PARCEIRO as COD_FORNECEDOR,
        NVL(f.DES_FANTASIA, f.DES_FORNECEDOR) as DES_FANTASIA,
        f.NUM_CELULAR,
        f.NUM_FONE,
        NVL(p.VAL_PEDIDO, 0) as VAL_TOTAL_PEDIDO,
        TO_CHAR(p.DTA_ENTREGA, 'DD/MM/YYYY') as DTA_ENTREGA
      FROM ${tabPedido} p
      LEFT JOIN ${tabFornecedor} f ON f.COD_FORNECEDOR = p.COD_PARCEIRO
      WHERE p.TIPO_PARCEIRO = 1
      AND TRUNC(p.DTA_EMISSAO) = TO_DATE(:data, 'YYYY-MM-DD')
      AND (p.FLG_CANCELADO IS NULL OR p.FLG_CANCELADO = 'N')
      ORDER BY p.COD_PARCEIRO, p.NUM_PEDIDO
    `;

    return await OracleService.query(query, params);
  }

  /**
   * Lista classificações de fornecedores (para filtro)
   */
  static async listarClassificacoes(): Promise<{ COD_CLASSIF: number; DES_CLASSIF: string; QTD_FORNECEDORES: number }[]> {
    const schema = await MappingService.getSchema();
    const tabFornecedor = `${schema}.${await MappingService.getRealTableName('TAB_FORNECEDOR')}`;
    const tabClassificacao = `${schema}.${await MappingService.getRealTableName('TAB_CLASSIFICACAO')}`;

    const query = `
      SELECT
        c.COD_CLASSIF,
        c.DES_CLASSIF,
        COUNT(f.COD_FORNECEDOR) as QTD_FORNECEDORES
      FROM ${tabClassificacao} c
      LEFT JOIN ${tabFornecedor} f ON f.COD_CLASSIF = c.COD_CLASSIF
      GROUP BY c.COD_CLASSIF, c.DES_CLASSIF
      HAVING COUNT(f.COD_FORNECEDOR) > 0
      ORDER BY c.DES_CLASSIF
    `;

    return await OracleService.query(query, {});
  }

  /**
   * Retorna todos os agendamentos do PostgreSQL indexados por cod_fornecedor
   */
  static async getAgendamentos(): Promise<Record<number, FornecedorAgendamento>> {
    const repo = AppDataSource.getRepository(FornecedorAgendamento);
    const rows = await repo.find();
    const map: Record<number, FornecedorAgendamento> = {};
    for (const r of rows) {
      map[r.cod_fornecedor] = r;
    }
    return map;
  }

  /**
   * Upsert de agendamento para um fornecedor
   */
  static async upsertAgendamento(codFornecedor: number, dados: {
    freq_visita?: string | null;
    dia_semana_1?: string | null;
    dia_semana_2?: string | null;
    dia_semana_3?: string | null;
    dia_mes?: number | null;
    inicio_agendamento?: string | null;
    comprador?: string | null;
    tipo_atendimento?: string | null;
    hora_inicio?: string | null;
    hora_termino?: string | null;
  }): Promise<FornecedorAgendamento> {
    const repo = AppDataSource.getRepository(FornecedorAgendamento);

    let agendamento = await repo.findOne({ where: { cod_fornecedor: codFornecedor } });

    if (!agendamento) {
      agendamento = repo.create({ cod_fornecedor: codFornecedor });
    }

    if (dados.freq_visita !== undefined) agendamento.freq_visita = dados.freq_visita || null;
    if (dados.dia_semana_1 !== undefined) agendamento.dia_semana_1 = dados.dia_semana_1 || null;
    if (dados.dia_semana_2 !== undefined) agendamento.dia_semana_2 = dados.dia_semana_2 || null;
    if (dados.dia_semana_3 !== undefined) agendamento.dia_semana_3 = dados.dia_semana_3 || null;
    if (dados.dia_mes !== undefined) agendamento.dia_mes = dados.dia_mes || null;
    if (dados.inicio_agendamento !== undefined) {
      agendamento.inicio_agendamento = dados.inicio_agendamento ? new Date(dados.inicio_agendamento) : null;
    }
    if (dados.comprador !== undefined) agendamento.comprador = dados.comprador || null;
    if (dados.tipo_atendimento !== undefined) agendamento.tipo_atendimento = dados.tipo_atendimento || null;
    if (dados.hora_inicio !== undefined) agendamento.hora_inicio = dados.hora_inicio || null;
    if (dados.hora_termino !== undefined) agendamento.hora_termino = dados.hora_termino || null;

    return await repo.save(agendamento);
  }

  /**
   * Retorna opções de dropdown (comprador / tipo_atendimento)
   */
  static async getOpcoesDropdown(): Promise<{ compradores: { id: number; valor: string }[]; tipos_atendimento: { id: number; valor: string }[] }> {
    const repo = AppDataSource.getRepository(OpcaoDropdown);
    const rows = await repo.find({ order: { valor: 'ASC' } });
    const compradores = rows.filter(r => r.tipo === 'comprador').map(r => ({ id: r.id, valor: r.valor }));
    const tipos_atendimento = rows.filter(r => r.tipo === 'tipo_atendimento').map(r => ({ id: r.id, valor: r.valor }));
    return { compradores, tipos_atendimento };
  }

  /**
   * Adiciona uma opção de dropdown
   */
  static async addOpcaoDropdown(tipo: string, valor: string): Promise<OpcaoDropdown> {
    const repo = AppDataSource.getRepository(OpcaoDropdown);
    const existing = await repo.findOne({ where: { tipo, valor } });
    if (existing) return existing;
    const opcao = repo.create({ tipo, valor: valor.trim() });
    return await repo.save(opcao);
  }

  /**
   * Remove uma opção de dropdown
   */
  static async removeOpcaoDropdown(id: number): Promise<void> {
    const repo = AppDataSource.getRepository(OpcaoDropdown);
    await repo.delete(id);
  }

  /**
   * Retorna mapa COD_FORNECEDOR → detalhes (contato, celular, email, prazo pgto)
   */
  static async listarFornecedoresDetalhes(): Promise<Record<number, any>> {
    const schema = await MappingService.getSchema();
    const tabFornecedor = `${schema}.${await MappingService.getRealTableName('TAB_FORNECEDOR')}`;
    const tabFornecedorNota = `${schema}.${await MappingService.getRealTableName('TAB_FORNECEDOR_NOTA')}`;
    const tabCondicaoFornecedor = `${schema}.${await MappingService.getRealTableName('TAB_CONDICAO_FORNECEDOR')}`;
    const tabClassificacao = `${schema}.${await MappingService.getRealTableName('TAB_CLASSIFICACAO')}`;

    const query = `
      SELECT
        f.COD_FORNECEDOR,
        NVL(f.DES_FANTASIA, f.DES_FORNECEDOR) as DES_FANTASIA,
        f.DES_CONTATO,
        f.NUM_CELULAR,
        f.NUM_FONE,
        f.DES_EMAIL,
        NVL(f.NUM_MED_CPGTO, 0) as NUM_MED_CPGTO,
        NVL(f.NUM_PRAZO, 0) as NUM_PRAZO,
        NVL(f.VAL_DEBITO, 0) as VAL_DEBITO,
        NVL(conds.CONDICOES_PGTO, '') as CONDICOES_PGTO,
        NVL(c.DES_CLASSIF, 'SEM CLASSIFICAÇÃO') as DES_CLASSIFICACAO,
        ult.ULTIMO_ATENDIMENTO,
        ult.DIAS_DESDE_ULTIMO
      FROM ${tabFornecedor} f
      LEFT JOIN ${tabClassificacao} c ON c.COD_CLASSIF = f.COD_CLASSIF
      LEFT JOIN (
        SELECT
          cf.COD_FORNECEDOR,
          LISTAGG(cf.NUM_CONDICAO, '/') WITHIN GROUP (ORDER BY cf.NUM_CONDICAO) as CONDICOES_PGTO
        FROM ${tabCondicaoFornecedor} cf
        GROUP BY cf.COD_FORNECEDOR
      ) conds ON conds.COD_FORNECEDOR = f.COD_FORNECEDOR
      LEFT JOIN (
        SELECT
          fn.COD_FORNECEDOR,
          MAX(fn.DTA_ENTRADA) as ULTIMO_ATENDIMENTO,
          ROUND(SYSDATE - MAX(fn.DTA_ENTRADA)) as DIAS_DESDE_ULTIMO
        FROM ${tabFornecedorNota} fn
        WHERE NVL(fn.FLG_CANCELADO, 'N') = 'N'
        GROUP BY fn.COD_FORNECEDOR
      ) ult ON ult.COD_FORNECEDOR = f.COD_FORNECEDOR
      WHERE EXISTS (SELECT 1 FROM ${tabFornecedorNota} fn2 WHERE fn2.COD_FORNECEDOR = f.COD_FORNECEDOR AND fn2.DTA_ENTRADA >= SYSDATE - 365)
    `;

    const rows = await OracleService.query(query, {});
    const map: Record<number, any> = {};
    for (const r of rows) {
      map[r.COD_FORNECEDOR] = r;
    }
    return map;
  }

  /**
   * Retorna mapa COD_FORNECEDOR → DES_FANTASIA (leve, sem joins pesados)
   */
  static async listarFornecedoresNomes(): Promise<Record<number, string>> {
    const schema = await MappingService.getSchema();
    const tabFornecedor = `${schema}.${await MappingService.getRealTableName('TAB_FORNECEDOR')}`;
    const tabFornecedorNota = `${schema}.${await MappingService.getRealTableName('TAB_FORNECEDOR_NOTA')}`;

    const query = `
      SELECT f.COD_FORNECEDOR, NVL(f.DES_FANTASIA, f.DES_FORNECEDOR) as DES_FANTASIA
      FROM ${tabFornecedor} f
      WHERE EXISTS (SELECT 1 FROM ${tabFornecedorNota} fn WHERE fn.COD_FORNECEDOR = f.COD_FORNECEDOR AND fn.DTA_ENTRADA >= SYSDATE - 365)
    `;

    const rows = await OracleService.query(query, {});
    const map: Record<number, string> = {};
    for (const r of rows) {
      map[r.COD_FORNECEDOR] = r.DES_FANTASIA;
    }
    return map;
  }
}
