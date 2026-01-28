import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { OracleService } from '../services/oracle.service';

/**
 * Controller para Pedidos de Compra do Oracle
 * Leitura direta da TAB_PEDIDO e TAB_PEDIDO_PRODUTO
 */
export class PedidosCompraController {
  /**
   * Lista pedidos de compra com filtros e paginação
   */
  static async listarPedidos(req: AuthRequest, res: Response) {
    try {
      const {
        page = '1',
        limit = '50',
        tipoRecebimento,
        dataInicio,
        dataFim,
        fornecedor,
        numPedido,
        comprador,
        apenasAtrasados
      } = req.query;

      const pageNum = parseInt(page as string, 10);
      const limitNum = parseInt(limit as string, 10);
      const offset = (pageNum - 1) * limitNum;

      // Construir condições WHERE
      const conditions: string[] = ['p.TIPO_PARCEIRO = 1']; // Apenas pedidos de compra (fornecedor)
      const params: any = {};

      if (tipoRecebimento !== undefined && tipoRecebimento !== '') {
        conditions.push('p.TIPO_RECEBIMENTO = :tipoRecebimento');
        params.tipoRecebimento = parseInt(tipoRecebimento as string, 10);
      }

      if (dataInicio) {
        conditions.push('TRUNC(p.DTA_EMISSAO) >= TO_DATE(:dataInicio, \'YYYY-MM-DD\')');
        params.dataInicio = dataInicio;
      }

      if (dataFim) {
        conditions.push('TRUNC(p.DTA_EMISSAO) <= TO_DATE(:dataFim, \'YYYY-MM-DD\')');
        params.dataFim = dataFim;
      }

      if (fornecedor) {
        conditions.push('UPPER(f.DES_FORNECEDOR) LIKE UPPER(:fornecedor)');
        params.fornecedor = `%${fornecedor}%`;
      }

      if (numPedido) {
        conditions.push('p.NUM_PEDIDO = :numPedido');
        params.numPedido = parseInt(numPedido as string, 10);
      }

      if (comprador) {
        conditions.push('UPPER(p.USUARIO) LIKE UPPER(:comprador)');
        params.comprador = `%${comprador}%`;
      }

      if (apenasAtrasados === 'true') {
        // Pedidos atrasados: pendentes ou parciais com data de entrega no passado
        conditions.push('p.TIPO_RECEBIMENTO < 2');
        conditions.push('TRUNC(p.DTA_ENTREGA) < TRUNC(SYSDATE)');
      }

      const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

      // Query para contar total
      const countQuery = `
        SELECT COUNT(*) as TOTAL
        FROM INTERSOLID.TAB_PEDIDO p
        LEFT JOIN INTERSOLID.TAB_FORNECEDOR f ON f.COD_FORNECEDOR = p.COD_PARCEIRO
        ${whereClause}
      `;

      // Query para buscar pedidos
      const dataQuery = `
        SELECT * FROM (
          SELECT
            p.NUM_PEDIDO,
            p.COD_LOJA,
            p.COD_PARCEIRO,
            p.DTA_EMISSAO,
            p.DTA_ENTREGA,
            p.VAL_PEDIDO,
            p.TIPO_RECEBIMENTO,
            p.FLG_CANCELADO,
            p.FLG_FATURADO,
            p.DES_CANCELAMENTO,
            p.DTA_PEDIDO_CANCELADO,
            p.DES_OBSERVACAO,
            p.USUARIO,
            p.COD_USUARIO,
            p.QTD_VOLUME,
            p.COD_COTA,
            f.DES_FORNECEDOR,
            f.NUM_CGC,
            ROW_NUMBER() OVER (ORDER BY p.NUM_PEDIDO DESC) as RN
          FROM INTERSOLID.TAB_PEDIDO p
          LEFT JOIN INTERSOLID.TAB_FORNECEDOR f ON f.COD_FORNECEDOR = p.COD_PARCEIRO
          ${whereClause}
        ) WHERE RN > :offset AND RN <= :maxRow
      `;

      // Query para estatísticas
      const statsQuery = `
        SELECT
          SUM(CASE WHEN TIPO_RECEBIMENTO = 0 THEN 1 ELSE 0 END) as PENDENTES,
          SUM(CASE WHEN TIPO_RECEBIMENTO = 1 THEN 1 ELSE 0 END) as PARCIAIS,
          SUM(CASE WHEN TIPO_RECEBIMENTO = 2 THEN 1 ELSE 0 END) as RECEBIDOS,
          SUM(CASE WHEN TIPO_RECEBIMENTO = 3 THEN 1 ELSE 0 END) as CANCELADOS,
          SUM(CASE WHEN TIPO_RECEBIMENTO < 2 AND TRUNC(DTA_ENTREGA) < TRUNC(SYSDATE) THEN 1 ELSE 0 END) as ATRASADOS
        FROM INTERSOLID.TAB_PEDIDO
        WHERE TIPO_PARCEIRO = 1
      `;

      // Executar queries em paralelo
      const [countResult, pedidos, statsResult] = await Promise.all([
        OracleService.query<{ TOTAL: number }>(countQuery, params),
        OracleService.query(dataQuery, { ...params, offset, maxRow: offset + limitNum }),
        OracleService.query<{ PENDENTES: number; PARCIAIS: number; RECEBIDOS: number; CANCELADOS: number; ATRASADOS: number }>(statsQuery, {})
      ]);

      const total = countResult[0]?.TOTAL || 0;
      const totalPages = Math.ceil(total / limitNum);
      const stats = statsResult[0] || { PENDENTES: 0, PARCIAIS: 0, RECEBIDOS: 0, CANCELADOS: 0, ATRASADOS: 0 };

      res.json({
        pedidos,
        page: pageNum,
        limit: limitNum,
        total,
        totalPages,
        stats: {
          pendentes: stats.PENDENTES || 0,
          parciais: stats.PARCIAIS || 0,
          recebidos: stats.RECEBIDOS || 0,
          cancelados: stats.CANCELADOS || 0,
          atrasados: stats.ATRASADOS || 0
        }
      });
    } catch (error: any) {
      console.error('Erro ao listar pedidos:', error);
      res.status(500).json({ error: 'Erro ao buscar pedidos de compra', details: error.message });
    }
  }

  /**
   * Busca detalhes de um pedido específico
   */
  static async detalhesPedido(req: AuthRequest, res: Response) {
    try {
      const { numPedido } = req.params;

      const query = `
        SELECT
          p.NUM_PEDIDO,
          p.COD_LOJA,
          p.COD_PARCEIRO,
          p.DTA_EMISSAO,
          p.DTA_ENTREGA,
          p.VAL_PEDIDO,
          p.TIPO_RECEBIMENTO,
          p.FLG_CANCELADO,
          p.FLG_FATURADO,
          p.DES_CANCELAMENTO,
          p.DTA_PEDIDO_CANCELADO,
          p.DES_OBSERVACAO,
          p.USUARIO,
          p.COD_USUARIO,
          p.QTD_VOLUME,
          p.COD_COTA,
          p.VAL_DESCONTO,
          p.VAL_FRETE,
          f.DES_FORNECEDOR,
          f.NUM_CGC,
          f.DES_BAIRRO,
          f.DES_CIDADE,
          f.DES_UF
        FROM INTERSOLID.TAB_PEDIDO p
        LEFT JOIN INTERSOLID.TAB_FORNECEDOR f ON f.COD_FORNECEDOR = p.COD_PARCEIRO
        WHERE p.NUM_PEDIDO = :numPedido
      `;

      const result = await OracleService.query(query, { numPedido: parseInt(numPedido, 10) });

      if (result.length === 0) {
        return res.status(404).json({ error: 'Pedido não encontrado' });
      }

      res.json({ pedido: result[0] });
    } catch (error: any) {
      console.error('Erro ao buscar detalhes do pedido:', error);
      res.status(500).json({ error: 'Erro ao buscar detalhes do pedido', details: error.message });
    }
  }

  /**
   * Lista compradores (usuários que fizeram pedidos)
   */
  static async listarCompradores(req: AuthRequest, res: Response) {
    try {
      const query = `
        SELECT DISTINCT USUARIO
        FROM INTERSOLID.TAB_PEDIDO
        WHERE TIPO_PARCEIRO = 1
        AND USUARIO IS NOT NULL
        ORDER BY USUARIO
      `;

      const result = await OracleService.query<{ USUARIO: string }>(query, {});
      const compradores = result.map(r => r.USUARIO).filter(Boolean);

      res.json({ compradores });
    } catch (error: any) {
      console.error('Erro ao listar compradores:', error);
      res.status(500).json({ error: 'Erro ao buscar compradores', details: error.message });
    }
  }

  /**
   * Lista itens de um pedido
   */
  static async itensPedido(req: AuthRequest, res: Response) {
    try {
      const { numPedido } = req.params;

      const query = `
        SELECT
          pp.NUM_ITEM,
          pp.COD_PRODUTO,
          pp.QTD_PEDIDO,
          pp.QTD_RECEBIDA,
          pp.DES_UNIDADE,
          pp.VAL_TABELA,
          pp.VAL_CUSTO_REP,
          pp.VAL_DESCONTO_ITEM,
          pp.BONIFICACAO,
          pp.DTA_VALIDADE,
          pr.DES_PRODUTO,
          pr.DES_REDUZIDA
        FROM INTERSOLID.TAB_PEDIDO_PRODUTO pp
        LEFT JOIN INTERSOLID.TAB_PRODUTO pr ON pr.COD_PRODUTO = pp.COD_PRODUTO
        WHERE pp.NUM_PEDIDO = :numPedido
        ORDER BY pp.NUM_ITEM
      `;

      const itens = await OracleService.query(query, { numPedido: parseInt(numPedido, 10) });

      res.json({ itens });
    } catch (error: any) {
      console.error('Erro ao buscar itens do pedido:', error);
      res.status(500).json({ error: 'Erro ao buscar itens do pedido', details: error.message });
    }
  }
}
