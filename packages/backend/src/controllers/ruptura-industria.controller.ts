import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { OracleService } from '../services/oracle.service';

/**
 * Controller para Ruptura Indústria
 * Análise de cancelamentos de pedidos por fornecedor
 * Identifica fornecedores com maior índice de falhas de entrega
 */
export class RupturaIndustriaController {
  /**
   * Ranking de fornecedores com mais cancelamentos
   */
  static async rankingFornecedores(req: AuthRequest, res: Response) {
    try {
      const {
        dataInicio,
        dataFim,
        limit = '50'
      } = req.query;

      const conditions: string[] = [
        'p.TIPO_PARCEIRO = 1',
        'p.TIPO_RECEBIMENTO = 3' // Apenas pedidos cancelados
      ];
      const params: any = {};

      if (dataInicio) {
        conditions.push('TRUNC(p.DTA_EMISSAO) >= TO_DATE(:dataInicio, \'YYYY-MM-DD\')');
        params.dataInicio = dataInicio;
      }

      if (dataFim) {
        conditions.push('TRUNC(p.DTA_EMISSAO) <= TO_DATE(:dataFim, \'YYYY-MM-DD\')');
        params.dataFim = dataFim;
      }

      const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

      // Query para ranking de fornecedores com mais cancelamentos
      const query = `
        SELECT * FROM (
          SELECT
            f.COD_FORNECEDOR,
            f.DES_FORNECEDOR,
            f.NUM_CGC,
            COUNT(DISTINCT p.NUM_PEDIDO) as QTD_PEDIDOS_CANCELADOS,
            SUM(p.VAL_PEDIDO) as VALOR_TOTAL_CANCELADO,
            MIN(p.DTA_EMISSAO) as PRIMEIRO_CANCELAMENTO,
            MAX(p.DTA_EMISSAO) as ULTIMO_CANCELAMENTO,
            COUNT(DISTINCT pp.COD_PRODUTO) as QTD_PRODUTOS_AFETADOS,
            SUM(pp.QTD_PEDIDO) as QTD_ITENS_CANCELADOS
          FROM INTERSOLID.TAB_PEDIDO p
          INNER JOIN INTERSOLID.TAB_FORNECEDOR f ON f.COD_FORNECEDOR = p.COD_PARCEIRO
          LEFT JOIN INTERSOLID.TAB_PEDIDO_PRODUTO pp ON pp.NUM_PEDIDO = p.NUM_PEDIDO
          ${whereClause}
          GROUP BY f.COD_FORNECEDOR, f.DES_FORNECEDOR, f.NUM_CGC
          ORDER BY COUNT(DISTINCT p.NUM_PEDIDO) DESC
        ) WHERE ROWNUM <= :limitNum
      `;

      const fornecedores = await OracleService.query(query, {
        ...params,
        limitNum: parseInt(limit as string, 10)
      });

      // Query para estatísticas gerais
      const statsQuery = `
        SELECT
          COUNT(DISTINCT p.NUM_PEDIDO) as TOTAL_PEDIDOS_CANCELADOS,
          COUNT(DISTINCT p.COD_PARCEIRO) as TOTAL_FORNECEDORES_AFETADOS,
          SUM(p.VAL_PEDIDO) as VALOR_TOTAL_PERDIDO,
          COUNT(DISTINCT pp.COD_PRODUTO) as TOTAL_PRODUTOS_AFETADOS
        FROM INTERSOLID.TAB_PEDIDO p
        LEFT JOIN INTERSOLID.TAB_PEDIDO_PRODUTO pp ON pp.NUM_PEDIDO = p.NUM_PEDIDO
        ${whereClause}
      `;

      const statsResult = await OracleService.query(statsQuery, params);
      const stats = statsResult[0] || {
        TOTAL_PEDIDOS_CANCELADOS: 0,
        TOTAL_FORNECEDORES_AFETADOS: 0,
        VALOR_TOTAL_PERDIDO: 0,
        TOTAL_PRODUTOS_AFETADOS: 0
      };

      res.json({
        fornecedores,
        stats
      });
    } catch (error: any) {
      console.error('Erro ao buscar ranking de fornecedores:', error);
      res.status(500).json({ error: 'Erro ao buscar ranking de fornecedores', details: error.message });
    }
  }

  /**
   * Produtos cancelados de um fornecedor específico
   */
  static async produtosFornecedor(req: AuthRequest, res: Response) {
    console.log('=== INICIO produtosFornecedor ===');

    try {
      const { codFornecedor } = req.params;
      console.log('codFornecedor:', codFornecedor, 'tipo:', typeof codFornecedor);

      const codFornecedorNum = parseInt(codFornecedor, 10);
      console.log('codFornecedorNum:', codFornecedorNum);

      // Query MUITO simples para testar
      const query = `
        SELECT
          pp.COD_PRODUTO,
          pr.DES_PRODUTO,
          COUNT(*) as VEZES_CANCELADO,
          SUM(pp.QTD_PEDIDO) as QTD_TOTAL_CANCELADA
        FROM INTERSOLID.TAB_PEDIDO p
        INNER JOIN INTERSOLID.TAB_PEDIDO_PRODUTO pp ON pp.NUM_PEDIDO = p.NUM_PEDIDO
        LEFT JOIN INTERSOLID.TAB_PRODUTO pr ON pr.COD_PRODUTO = pp.COD_PRODUTO
        WHERE p.TIPO_PARCEIRO = 1
        AND p.TIPO_RECEBIMENTO = 3
        AND p.COD_PARCEIRO = :codFornecedor
        GROUP BY pp.COD_PRODUTO, pr.DES_PRODUTO
        ORDER BY COUNT(*) DESC
        FETCH FIRST 50 ROWS ONLY
      `;

      console.log('Executando query...');
      const produtos = await OracleService.query(query, { codFornecedor: codFornecedorNum });
      console.log('Produtos encontrados:', produtos.length);

      // Buscar dados do fornecedor
      const fornecedorQuery = `
        SELECT COD_FORNECEDOR, DES_FORNECEDOR, NUM_CGC
        FROM INTERSOLID.TAB_FORNECEDOR
        WHERE COD_FORNECEDOR = :codFornecedor
      `;

      const fornecedorResult = await OracleService.query(fornecedorQuery, { codFornecedor: codFornecedorNum });
      const fornecedor = fornecedorResult[0] || null;

      console.log('=== FIM produtosFornecedor - Sucesso ===');
      res.json({
        fornecedor,
        produtos
      });
    } catch (error: any) {
      console.error('=== ERRO produtosFornecedor ===');
      console.error('Mensagem:', error.message);
      console.error('Stack:', error.stack);
      res.status(500).json({ error: 'Erro ao buscar produtos do fornecedor', details: error.message });
    }
  }

  /**
   * Histórico de cancelamentos de um produto específico
   */
  static async historicoProduto(req: AuthRequest, res: Response) {
    try {
      const { codProduto } = req.params;
      const { codFornecedor, dataInicio, dataFim } = req.query;

      const conditions: string[] = [
        'p.TIPO_PARCEIRO = 1',
        'p.TIPO_RECEBIMENTO = 3',
        'pp.COD_PRODUTO = :codProduto'
      ];
      const params: any = { codProduto: parseInt(codProduto, 10) };

      if (codFornecedor) {
        conditions.push('p.COD_PARCEIRO = :codFornecedor');
        params.codFornecedor = parseInt(codFornecedor as string, 10);
      }

      if (dataInicio) {
        conditions.push('TRUNC(p.DTA_EMISSAO) >= TO_DATE(:dataInicio, \'YYYY-MM-DD\')');
        params.dataInicio = dataInicio;
      }

      if (dataFim) {
        conditions.push('TRUNC(p.DTA_EMISSAO) <= TO_DATE(:dataFim, \'YYYY-MM-DD\')');
        params.dataFim = dataFim;
      }

      const whereClause = `WHERE ${conditions.join(' AND ')}`;

      // Histórico detalhado de cada cancelamento
      const query = `
        SELECT
          p.NUM_PEDIDO,
          p.DTA_EMISSAO,
          p.DTA_ENTREGA,
          p.DTA_PEDIDO_CANCELADO,
          p.DES_CANCELAMENTO,
          pp.QTD_PEDIDO,
          pp.VAL_TABELA,
          pp.QTD_PEDIDO * pp.VAL_TABELA as VALOR_ITEM,
          f.DES_FORNECEDOR,
          p.USUARIO
        FROM INTERSOLID.TAB_PEDIDO p
        INNER JOIN INTERSOLID.TAB_PEDIDO_PRODUTO pp ON pp.NUM_PEDIDO = p.NUM_PEDIDO
        INNER JOIN INTERSOLID.TAB_FORNECEDOR f ON f.COD_FORNECEDOR = p.COD_PARCEIRO
        ${whereClause}
        ORDER BY p.DTA_EMISSAO DESC
      `;

      const historico = await OracleService.query(query, params);

      // Dados do produto
      const produtoQuery = `
        SELECT
          COD_PRODUTO,
          DES_PRODUTO,
          DES_REDUZIDA
        FROM INTERSOLID.TAB_PRODUTO
        WHERE COD_PRODUTO = :codProduto
      `;

      const produtoResult = await OracleService.query(produtoQuery, { codProduto: parseInt(codProduto, 10) });
      const produto = produtoResult[0] || null;

      res.json({
        produto,
        historico
      });
    } catch (error: any) {
      console.error('Erro ao buscar histórico do produto:', error);
      res.status(500).json({ error: 'Erro ao buscar histórico do produto', details: error.message });
    }
  }

  /**
   * Top produtos mais cancelados (geral)
   */
  static async topProdutosCancelados(req: AuthRequest, res: Response) {
    try {
      const { dataInicio, dataFim, limit = '20' } = req.query;

      const conditions: string[] = [
        'p.TIPO_PARCEIRO = 1',
        'p.TIPO_RECEBIMENTO = 3'
      ];
      const params: any = {};

      if (dataInicio) {
        conditions.push('TRUNC(p.DTA_EMISSAO) >= TO_DATE(:dataInicio, \'YYYY-MM-DD\')');
        params.dataInicio = dataInicio;
      }

      if (dataFim) {
        conditions.push('TRUNC(p.DTA_EMISSAO) <= TO_DATE(:dataFim, \'YYYY-MM-DD\')');
        params.dataFim = dataFim;
      }

      const whereClause = `WHERE ${conditions.join(' AND ')}`;

      const query = `
        SELECT * FROM (
          SELECT
            pp.COD_PRODUTO,
            pr.DES_PRODUTO,
            pr.DES_REDUZIDA,
            COUNT(DISTINCT p.NUM_PEDIDO) as VEZES_CANCELADO,
            COUNT(DISTINCT p.COD_PARCEIRO) as QTD_FORNECEDORES,
            SUM(pp.QTD_PEDIDO) as QTD_TOTAL_CANCELADA,
            SUM(pp.QTD_PEDIDO * pp.VAL_TABELA) as VALOR_TOTAL_CANCELADO,
            MAX(p.DTA_EMISSAO) as ULTIMO_CANCELAMENTO
          FROM INTERSOLID.TAB_PEDIDO p
          INNER JOIN INTERSOLID.TAB_PEDIDO_PRODUTO pp ON pp.NUM_PEDIDO = p.NUM_PEDIDO
          LEFT JOIN INTERSOLID.TAB_PRODUTO pr ON pr.COD_PRODUTO = pp.COD_PRODUTO
          ${whereClause}
          GROUP BY pp.COD_PRODUTO, pr.DES_PRODUTO, pr.DES_REDUZIDA
          ORDER BY COUNT(DISTINCT p.NUM_PEDIDO) DESC
        ) WHERE ROWNUM <= :limitNum
      `;

      const produtos = await OracleService.query(query, {
        ...params,
        limitNum: parseInt(limit as string, 10)
      });

      res.json({ produtos });
    } catch (error: any) {
      console.error('Erro ao buscar top produtos cancelados:', error);
      res.status(500).json({ error: 'Erro ao buscar top produtos cancelados', details: error.message });
    }
  }

  /**
   * Evolução mensal de cancelamentos
   */
  static async evolucaoMensal(req: AuthRequest, res: Response) {
    try {
      const { meses = '12' } = req.query;

      const query = `
        SELECT
          TO_CHAR(p.DTA_EMISSAO, 'YYYY-MM') as MES,
          COUNT(DISTINCT p.NUM_PEDIDO) as QTD_PEDIDOS,
          COUNT(DISTINCT p.COD_PARCEIRO) as QTD_FORNECEDORES,
          SUM(p.VAL_PEDIDO) as VALOR_TOTAL
        FROM INTERSOLID.TAB_PEDIDO p
        WHERE p.TIPO_PARCEIRO = 1
        AND p.TIPO_RECEBIMENTO = 3
        AND p.DTA_EMISSAO >= ADD_MONTHS(TRUNC(SYSDATE, 'MM'), -:meses)
        GROUP BY TO_CHAR(p.DTA_EMISSAO, 'YYYY-MM')
        ORDER BY TO_CHAR(p.DTA_EMISSAO, 'YYYY-MM') ASC
      `;

      const evolucao = await OracleService.query(query, {
        meses: parseInt(meses as string, 10)
      });

      res.json({ evolucao });
    } catch (error: any) {
      console.error('Erro ao buscar evolução mensal:', error);
      res.status(500).json({ error: 'Erro ao buscar evolução mensal', details: error.message });
    }
  }
}
