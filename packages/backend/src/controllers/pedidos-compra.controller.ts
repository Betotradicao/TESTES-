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
    console.log('=== PEDIDOS-COMPRA CONTROLLER CHAMADO ===');
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
        apenasAtrasados,
        parciaisFinalizadas,
        canceladasTotais,
        semNenhumaEntrada
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

      if (parciaisFinalizadas === 'true') {
        // Pedidos cancelados que tiveram pelo menos um item recebido
        conditions.push('p.TIPO_RECEBIMENTO = 3');
        conditions.push('EXISTS (SELECT 1 FROM INTERSOLID.TAB_PEDIDO_PRODUTO pp2 WHERE pp2.NUM_PEDIDO = p.NUM_PEDIDO AND NVL(pp2.QTD_RECEBIDA, 0) > 0)');
      }

      if (canceladasTotais === 'true') {
        // Pedidos cancelados que tiveram itens não recebidos
        conditions.push('p.TIPO_RECEBIMENTO = 3');
        conditions.push('EXISTS (SELECT 1 FROM INTERSOLID.TAB_PEDIDO_PRODUTO pp2 WHERE pp2.NUM_PEDIDO = p.NUM_PEDIDO AND NVL(pp2.QTD_RECEBIDA, 0) < pp2.QTD_PEDIDO)');
      }

      if (semNenhumaEntrada === 'true') {
        // Pedidos cancelados TOTALMENTE - nenhum item foi recebido
        conditions.push('p.TIPO_RECEBIMENTO = 3');
        conditions.push('NOT EXISTS (SELECT 1 FROM INTERSOLID.TAB_PEDIDO_PRODUTO pp2 WHERE pp2.NUM_PEDIDO = p.NUM_PEDIDO AND NVL(pp2.QTD_RECEBIDA, 0) > 0)');
      }

      const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

      // Definir ordenação baseada no filtro ativo
      let orderByClause = 'ORDER BY p.NUM_PEDIDO DESC';
      if (apenasAtrasados === 'true') {
        // Atrasados: menos atrasados primeiro, mais atrasados no final
        orderByClause = 'ORDER BY (TRUNC(SYSDATE) - TRUNC(p.DTA_ENTREGA)) ASC, p.NUM_PEDIDO DESC';
      } else if (semNenhumaEntrada === 'true') {
        // Cancelados INTEGRAL: mais recentes primeiro (pela data de cancelamento)
        orderByClause = 'ORDER BY NVL(p.DTA_PEDIDO_CANCELADO, p.DTA_ALTERACAO) DESC, p.NUM_PEDIDO DESC';
      } else if (tipoRecebimento === '0' || tipoRecebimento === '1') {
        // Pendentes e Parciais em Aberto: menos atrasados primeiro, mais atrasados no final
        // Pedidos sem atraso (DIAS_ATRASO <= 0) ficam no topo ordenados por NUM_PEDIDO DESC
        // Pedidos com atraso ficam depois, ordenados por dias de atraso ASC (menos atrasados primeiro)
        orderByClause = 'ORDER BY CASE WHEN TRUNC(SYSDATE) - TRUNC(p.DTA_ENTREGA) > 0 THEN 1 ELSE 0 END ASC, CASE WHEN TRUNC(SYSDATE) - TRUNC(p.DTA_ENTREGA) > 0 THEN TRUNC(SYSDATE) - TRUNC(p.DTA_ENTREGA) ELSE 0 END ASC, p.NUM_PEDIDO DESC';
      }

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
            p.DTA_ALTERACAO,
            p.DES_OBSERVACAO,
            p.USUARIO,
            p.COD_USUARIO,
            p.QTD_VOLUME,
            p.COD_COTA,
            f.DES_FORNECEDOR,
            f.NUM_CGC,
            f.NUM_CELULAR,
            f.DES_CONTATO,
            f.NUM_FREQ_VISITA,
            f.NUM_PRAZO as PRAZO_ENTREGA,
            f.NUM_MED_CPGTO as COND_PAGAMENTO,
            pm.PRAZO_MEDIO_REAL,
            pm.QTD_NFS_PRAZO,
            TRUNC(SYSDATE) - TRUNC(p.DTA_ENTREGA) as DIAS_ATRASO,
            ROW_NUMBER() OVER (${orderByClause}) as RN
          FROM INTERSOLID.TAB_PEDIDO p
          LEFT JOIN INTERSOLID.TAB_FORNECEDOR f ON f.COD_FORNECEDOR = p.COD_PARCEIRO
          LEFT JOIN (
            SELECT
              fn.COD_FORNECEDOR,
              ROUND(AVG(TRUNC(fn.DTA_ENTRADA) - TRUNC(ped.DTA_EMISSAO)), 1) as PRAZO_MEDIO_REAL,
              COUNT(DISTINCT fn.NUM_NF_FORN) as QTD_NFS_PRAZO
            FROM INTERSOLID.TAB_FORNECEDOR_NOTA fn
            JOIN INTERSOLID.TAB_PEDIDO ped ON ped.NUM_PEDIDO = fn.NUM_PEDIDO AND ped.TIPO_PARCEIRO = 1
            WHERE fn.DTA_ENTRADA >= SYSDATE - 90
            AND fn.NUM_PEDIDO IS NOT NULL
            AND fn.NUM_PEDIDO > 0
            AND NVL(fn.FLG_CANCELADO, 'N') = 'N'
            GROUP BY fn.COD_FORNECEDOR
          ) pm ON pm.COD_FORNECEDOR = p.COD_PARCEIRO
          ${whereClause}
        ) WHERE RN > :offset AND RN <= :maxRow
      `;

      // Construir filtro de data para estatísticas
      const statsDateConditions: string[] = [];
      const statsParams: any = {};
      if (dataInicio) {
        statsDateConditions.push('TRUNC(DTA_EMISSAO) >= TO_DATE(:statsDataInicio, \'YYYY-MM-DD\')');
        statsParams.statsDataInicio = dataInicio;
      }
      if (dataFim) {
        statsDateConditions.push('TRUNC(DTA_EMISSAO) <= TO_DATE(:statsDataFim, \'YYYY-MM-DD\')');
        statsParams.statsDataFim = dataFim;
      }
      const statsDateFilter = statsDateConditions.length > 0 ? ' AND ' + statsDateConditions.join(' AND ') : '';

      // Query para estatísticas básicas (com filtro de data opcional)
      const statsQuery = `
        SELECT
          SUM(CASE WHEN TIPO_RECEBIMENTO = 0 THEN 1 ELSE 0 END) as PENDENTES,
          SUM(CASE WHEN TIPO_RECEBIMENTO = 1 THEN 1 ELSE 0 END) as PARCIAIS_ABERTO,
          SUM(CASE WHEN TIPO_RECEBIMENTO = 2 THEN 1 ELSE 0 END) as RECEBIDOS_INTEGRAL,
          SUM(CASE WHEN TIPO_RECEBIMENTO = 3 THEN 1 ELSE 0 END) as CANCELADOS,
          SUM(CASE WHEN TIPO_RECEBIMENTO < 2 AND TRUNC(DTA_ENTREGA) < TRUNC(SYSDATE) THEN 1 ELSE 0 END) as ATRASADOS
        FROM INTERSOLID.TAB_PEDIDO
        WHERE TIPO_PARCEIRO = 1
        ${statsDateFilter}
      `;

      // Filtro de data para queries com JOIN (formato diferente)
      const joinDateConditions: string[] = [];
      const joinParams: any = {};
      if (dataInicio) {
        joinDateConditions.push('TRUNC(p.DTA_EMISSAO) >= TO_DATE(:joinDataInicio, \'YYYY-MM-DD\')');
        joinParams.joinDataInicio = dataInicio;
      }
      if (dataFim) {
        joinDateConditions.push('TRUNC(p.DTA_EMISSAO) <= TO_DATE(:joinDataFim, \'YYYY-MM-DD\')');
        joinParams.joinDataFim = dataFim;
      }
      const joinDateFilter = joinDateConditions.length > 0 ? ' AND ' + joinDateConditions.join(' AND ') : '';

      // Query para contar pedidos cancelados que tiveram itens recebidos (parciais finalizadas)
      const parciaisFinalizadasQuery = `
        SELECT COUNT(DISTINCT p.NUM_PEDIDO) as PARCIAIS_FINALIZADAS
        FROM INTERSOLID.TAB_PEDIDO p
        INNER JOIN INTERSOLID.TAB_PEDIDO_PRODUTO pp ON pp.NUM_PEDIDO = p.NUM_PEDIDO
        WHERE p.TIPO_PARCEIRO = 1
        AND p.TIPO_RECEBIMENTO = 3
        AND NVL(pp.QTD_RECEBIDA, 0) > 0
        ${joinDateFilter}
      `;

      // Query para contar NOTAS canceladas que tiveram itens não recebidos (itens cortados)
      // Conta notas distintas, não itens
      const canceladasTotaisQuery = `
        SELECT
          COUNT(DISTINCT p.NUM_PEDIDO) as NOTAS_CANCELADAS,
          SUM(pp.QTD_PEDIDO - NVL(pp.QTD_RECEBIDA, 0)) as QTD_CANCELADA,
          SUM((pp.QTD_PEDIDO - NVL(pp.QTD_RECEBIDA, 0)) * pp.VAL_TABELA) as VALOR_CANCELADO
        FROM INTERSOLID.TAB_PEDIDO p
        INNER JOIN INTERSOLID.TAB_PEDIDO_PRODUTO pp ON pp.NUM_PEDIDO = p.NUM_PEDIDO
        WHERE p.TIPO_PARCEIRO = 1
        AND p.TIPO_RECEBIMENTO = 3
        AND NVL(pp.QTD_RECEBIDA, 0) < pp.QTD_PEDIDO
        ${joinDateFilter}
      `;

      // Query para contar pedidos cancelados TOTALMENTE (nenhum item foi recebido)
      const canceladosTotalmenteQuery = `
        SELECT
          COUNT(*) as CANCELADOS_TOTALMENTE,
          SUM(p.VAL_PEDIDO) as VALOR_TOTAL
        FROM INTERSOLID.TAB_PEDIDO p
        WHERE p.TIPO_PARCEIRO = 1
        AND p.TIPO_RECEBIMENTO = 3
        AND NOT EXISTS (
          SELECT 1 FROM INTERSOLID.TAB_PEDIDO_PRODUTO pp
          WHERE pp.NUM_PEDIDO = p.NUM_PEDIDO
          AND NVL(pp.QTD_RECEBIDA, 0) > 0
        )
        ${statsDateFilter}
      `;

      // Filtro de data para NFs sem pedido (usa DTA_ENTRADA)
      const nfDateConditions: string[] = [];
      const nfParams: any = {};
      if (dataInicio) {
        nfDateConditions.push('TRUNC(fn.DTA_ENTRADA) >= TO_DATE(:nfDataInicio, \'YYYY-MM-DD\')');
        nfParams.nfDataInicio = dataInicio;
      } else {
        nfDateConditions.push('fn.DTA_ENTRADA >= SYSDATE - 30');
      }
      if (dataFim) {
        nfDateConditions.push('TRUNC(fn.DTA_ENTRADA) <= TO_DATE(:nfDataFim, \'YYYY-MM-DD\')');
        nfParams.nfDataFim = dataFim;
      }
      const nfDateFilter = nfDateConditions.join(' AND ');

      // Query para contar NFs sem pedido (notas fiscais que entraram sem pedido de compra)
      const nfSemPedidoQuery = `
        SELECT
          COUNT(*) as TOTAL_NFS,
          SUM(fn.VAL_TOTAL_NF) as VALOR_TOTAL
        FROM INTERSOLID.TAB_FORNECEDOR_NOTA fn
        WHERE ${nfDateFilter}
        AND (fn.NUM_PEDIDO IS NULL OR fn.NUM_PEDIDO = 0)
        AND NVL(fn.FLG_CANCELADO, 'N') = 'N'
        AND fn.VAL_TOTAL_NF > 0
      `;

      // Executar queries em paralelo (com parâmetros de data)
      const [countResult, pedidos, statsResult, parciaisFinalizadasResult, canceladasTotaisResult, canceladosTotalmenteResult, nfSemPedidoResult] = await Promise.all([
        OracleService.query<{ TOTAL: number }>(countQuery, params),
        OracleService.query(dataQuery, { ...params, offset, maxRow: offset + limitNum }),
        OracleService.query<{ PENDENTES: number; PARCIAIS_ABERTO: number; RECEBIDOS_INTEGRAL: number; CANCELADOS: number; ATRASADOS: number }>(statsQuery, statsParams),
        OracleService.query<{ PARCIAIS_FINALIZADAS: number }>(parciaisFinalizadasQuery, joinParams),
        OracleService.query<{ NOTAS_CANCELADAS: number; QTD_CANCELADA: number; VALOR_CANCELADO: number }>(canceladasTotaisQuery, joinParams),
        OracleService.query<{ CANCELADOS_TOTALMENTE: number; VALOR_TOTAL: number }>(canceladosTotalmenteQuery, statsParams),
        OracleService.query<{ TOTAL_NFS: number; VALOR_TOTAL: number }>(nfSemPedidoQuery, nfParams)
      ]);

      const total = countResult[0]?.TOTAL || 0;
      const totalPages = Math.ceil(total / limitNum);
      const stats = statsResult[0] || { PENDENTES: 0, PARCIAIS_ABERTO: 0, RECEBIDOS_INTEGRAL: 0, CANCELADOS: 0, ATRASADOS: 0 };
      const parciaisFin = parciaisFinalizadasResult[0]?.PARCIAIS_FINALIZADAS || 0;
      const canceladasTot = canceladasTotaisResult[0] || { NOTAS_CANCELADAS: 0, QTD_CANCELADA: 0, VALOR_CANCELADO: 0 };
      const canceladosTotalmente = canceladosTotalmenteResult[0] || { CANCELADOS_TOTALMENTE: 0, VALOR_TOTAL: 0 };
      const nfSemPedido = nfSemPedidoResult[0] || { TOTAL_NFS: 0, VALOR_TOTAL: 0 };

      // Debug log
      console.log('=== STATS DEBUG ===');
      console.log('statsResult[0]:', JSON.stringify(statsResult[0]));
      console.log('parciaisFinalizadasResult[0]:', JSON.stringify(parciaisFinalizadasResult[0]));
      console.log('canceladasTotaisResult[0]:', JSON.stringify(canceladasTotaisResult[0]));
      console.log('parciaisFin:', parciaisFin);
      console.log('canceladasTot:', canceladasTot);

      res.json({
        pedidos,
        page: pageNum,
        limit: limitNum,
        total,
        totalPages,
        stats: {
          pendentes: stats.PENDENTES || 0,
          parciaisAberto: stats.PARCIAIS_ABERTO || 0,
          recebidosIntegral: stats.RECEBIDOS_INTEGRAL || 0,
          cancelados: stats.CANCELADOS || 0,
          atrasados: stats.ATRASADOS || 0,
          parciaisFinalizadas: parciaisFin,
          notasCanceladas: canceladasTot.NOTAS_CANCELADAS || 0,
          valorCancelado: canceladasTot.VALOR_CANCELADO || 0,
          canceladosTotalmente: canceladosTotalmente.CANCELADOS_TOTALMENTE || 0,
          valorCanceladoTotalmente: canceladosTotalmente.VALOR_TOTAL || 0,
          nfSemPedido: nfSemPedido.TOTAL_NFS || 0,
          valorNfSemPedido: nfSemPedido.VALOR_TOTAL || 0
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
   * Lista notas fiscais sem pedido de compra
   */
  static async listarNfSemPedido(req: AuthRequest, res: Response) {
    console.log('=== NF SEM PEDIDO CONTROLLER CHAMADO ===');
    try {
      const {
        page = '1',
        limit = '50',
        dataInicio,
        dataFim,
        fornecedor,
        classificacoes,
        contato
      } = req.query;

      const pageNum = parseInt(page as string, 10);
      const limitNum = parseInt(limit as string, 10);
      const offset = (pageNum - 1) * limitNum;

      // Construir condições WHERE
      const conditions: string[] = [
        '(fn.NUM_PEDIDO IS NULL OR fn.NUM_PEDIDO = 0)',
        'NVL(fn.FLG_CANCELADO, \'N\') = \'N\'',
        'fn.VAL_TOTAL_NF > 0'
      ];
      const params: any = {};

      if (dataInicio) {
        conditions.push('TRUNC(fn.DTA_ENTRADA) >= TO_DATE(:dataInicio, \'YYYY-MM-DD\')');
        params.dataInicio = dataInicio;
      } else {
        // Por padrão, últimos 30 dias
        conditions.push('fn.DTA_ENTRADA >= SYSDATE - 30');
      }

      if (dataFim) {
        conditions.push('TRUNC(fn.DTA_ENTRADA) <= TO_DATE(:dataFim, \'YYYY-MM-DD\')');
        params.dataFim = dataFim;
      }

      if (fornecedor) {
        conditions.push('UPPER(f.DES_FANTASIA) LIKE UPPER(:fornecedor)');
        params.fornecedor = `%${fornecedor}%`;
      }

      // Filtro por contato
      if (contato) {
        const contatoStr = String(contato).trim();
        if (contatoStr === 'SEM CONTATO') {
          conditions.push('(f.DES_CONTATO IS NULL OR TRIM(f.DES_CONTATO) = \'\')');
        } else {
          conditions.push('UPPER(TRIM(f.DES_CONTATO)) = UPPER(:contato)');
          params.contato = contatoStr;
        }
      }

      // Filtro por classificações (múltiplas) - incluindo "SEM_CADASTRO" para fornecedores sem classificação
      if (classificacoes) {
        const classifParts = String(classificacoes).split(',').map(c => c.trim());
        const hasSemCadastro = classifParts.includes('SEM_CADASTRO');
        const classifArray = classifParts.filter(c => c !== 'SEM_CADASTRO').map(c => parseInt(c, 10)).filter(c => !isNaN(c));

        if (hasSemCadastro && classifArray.length > 0) {
          // Ambos: sem cadastro OU com classificações específicas
          conditions.push(`(f.COD_CLASSIF IS NULL OR f.COD_CLASSIF IN (${classifArray.join(',')}))`);
        } else if (hasSemCadastro) {
          // Apenas sem cadastro
          conditions.push('f.COD_CLASSIF IS NULL');
        } else if (classifArray.length > 0) {
          // Apenas classificações específicas
          conditions.push(`f.COD_CLASSIF IN (${classifArray.join(',')})`);
        }
      }

      const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

      // Query para contar total
      const countQuery = `
        SELECT COUNT(*) as TOTAL
        FROM INTERSOLID.TAB_FORNECEDOR_NOTA fn
        LEFT JOIN INTERSOLID.TAB_FORNECEDOR f ON f.COD_FORNECEDOR = fn.COD_FORNECEDOR
        ${whereClause}
      `;

      // Query para buscar NFs
      const dataQuery = `
        SELECT * FROM (
          SELECT
            fn.NUM_NF_FORN as NUM_NF,
            fn.NUM_SERIE_NF,
            fn.COD_LOJA,
            fn.COD_FORNECEDOR,
            fn.DTA_EMISSAO,
            fn.DTA_ENTRADA,
            fn.VAL_TOTAL_NF,
            fn.DES_NATUREZA,
            fn.DES_ESPECIE,
            fn.TIPO_NF,
            fn.NUM_CHAVE_ACESSO,
            f.DES_FANTASIA as FORNECEDOR,
            f.NUM_CGC,
            f.NUM_CELULAR,
            f.DES_CONTATO,
            f.COD_CLASSIF,
            c.DES_CLASSIF as DES_CLASSIFICACAO,
            ROW_NUMBER() OVER (ORDER BY fn.DTA_ENTRADA DESC, fn.NUM_NF_FORN DESC) as RN
          FROM INTERSOLID.TAB_FORNECEDOR_NOTA fn
          LEFT JOIN INTERSOLID.TAB_FORNECEDOR f ON f.COD_FORNECEDOR = fn.COD_FORNECEDOR
          LEFT JOIN INTERSOLID.TAB_CLASSIFICACAO c ON c.COD_CLASSIF = f.COD_CLASSIF
          ${whereClause}
        ) WHERE RN > :offset AND RN <= :maxRow
      `;

      // Executar queries em paralelo
      const [countResult, nfs] = await Promise.all([
        OracleService.query<{ TOTAL: number }>(countQuery, params),
        OracleService.query(dataQuery, { ...params, offset, maxRow: offset + limitNum })
      ]);

      const total = countResult[0]?.TOTAL || 0;
      const totalPages = Math.ceil(total / limitNum);

      res.json({
        nfs,
        page: pageNum,
        limit: limitNum,
        total,
        totalPages
      });
    } catch (error: any) {
      console.error('Erro ao listar NFs sem pedido:', error);
      res.status(500).json({ error: 'Erro ao buscar NFs sem pedido', details: error.message });
    }
  }

  /**
   * Lista itens de uma NF (nota fiscal)
   */
  static async itensNf(req: AuthRequest, res: Response) {
    try {
      const { numNf, codFornecedor, codLoja } = req.params;

      const query = `
        SELECT
          fp.NUM_ITEM,
          fp.COD_PRODUTO,
          fp.QTD_ENTRADA,
          fp.VAL_TABELA as VAL_CUSTO,
          fp.VAL_VENDA_VAREJO as VAL_VENDA,
          (fp.QTD_ENTRADA * fp.VAL_TABELA) as VAL_TOTAL,
          fp.DES_UNIDADE,
          pr.DES_PRODUTO,
          pr.DES_REDUZIDA,
          NVL(TRIM(pl.DES_RANK_PRODLOJA), 'X') as CURVA
        FROM INTERSOLID.TAB_FORNECEDOR_PRODUTO fp
        LEFT JOIN INTERSOLID.TAB_PRODUTO pr ON pr.COD_PRODUTO = fp.COD_PRODUTO
        LEFT JOIN INTERSOLID.TAB_PRODUTO_LOJA pl ON pl.COD_PRODUTO = fp.COD_PRODUTO AND pl.COD_LOJA = :codLoja
        WHERE fp.NUM_NF_FORN = :numNf
        AND fp.COD_FORNECEDOR = :codFornecedor
        ORDER BY fp.NUM_ITEM
      `;

      const itens = await OracleService.query(query, {
        numNf: parseInt(numNf, 10),
        codFornecedor: parseInt(codFornecedor, 10),
        codLoja: parseInt(codLoja, 10)
      });

      res.json({ itens });
    } catch (error: any) {
      console.error('Erro ao buscar itens da NF:', error);
      res.status(500).json({ error: 'Erro ao buscar itens da NF', details: error.message });
    }
  }

  /**
   * Lista itens de um pedido
   * Aceita filtro opcional:
   * - filtroItens=apenasRecebidos: só itens com QTD_RECEBIDA > 0 (para Parciais Finalizadas)
   * - filtroItens=apenasRuptura: só itens com QTD_RECEBIDA < QTD_PEDIDO (para Canceladas Totais)
   * - sem filtro: todos os itens
   */
  static async itensPedido(req: AuthRequest, res: Response) {
    try {
      const { numPedido } = req.params;
      const { filtroItens } = req.query;

      let filtroCondition = '';
      if (filtroItens === 'apenasRecebidos') {
        // Parciais Finalizadas: mostrar apenas itens OK (recebeu tudo que foi pedido)
        filtroCondition = 'AND NVL(pp.QTD_RECEBIDA, 0) >= pp.QTD_PEDIDO';
      } else if (filtroItens === 'apenasRuptura') {
        // Canceladas Totais: mostrar apenas itens cancelados (não recebeu ou recebeu menos)
        filtroCondition = 'AND NVL(pp.QTD_RECEBIDA, 0) < pp.QTD_PEDIDO';
      }
      // Nota: filtroItens === 'semNenhumaEntrada' retorna todos os itens (sem filtro adicional)

      // Buscar COD_LOJA do pedido para obter a CURVA correta
      const pedidoQuery = `SELECT COD_LOJA FROM INTERSOLID.TAB_PEDIDO WHERE NUM_PEDIDO = :numPedido`;
      const pedidoResult = await OracleService.query<{ COD_LOJA: number }>(pedidoQuery, { numPedido: parseInt(numPedido, 10) });
      const codLoja = pedidoResult[0]?.COD_LOJA || 1;

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
          pr.DES_REDUZIDA,
          NVL(TRIM(pl.DES_RANK_PRODLOJA), 'X') as CURVA
        FROM INTERSOLID.TAB_PEDIDO_PRODUTO pp
        LEFT JOIN INTERSOLID.TAB_PRODUTO pr ON pr.COD_PRODUTO = pp.COD_PRODUTO
        LEFT JOIN INTERSOLID.TAB_PRODUTO_LOJA pl ON pl.COD_PRODUTO = pp.COD_PRODUTO AND pl.COD_LOJA = :codLoja
        WHERE pp.NUM_PEDIDO = :numPedido
        ${filtroCondition}
        ORDER BY pp.NUM_ITEM
      `;

      const itens = await OracleService.query(query, { numPedido: parseInt(numPedido, 10), codLoja });

      res.json({ itens });
    } catch (error: any) {
      console.error('Erro ao buscar itens do pedido:', error);
      res.status(500).json({ error: 'Erro ao buscar itens do pedido', details: error.message });
    }
  }

  /**
   * Lista classificações de fornecedores disponíveis com contagem de NFs sem pedido
   */
  static async listarClassificacoes(_req: AuthRequest, res: Response) {
    try {
      // Query para buscar classificações com contagem de NFs sem pedido (últimos 30 dias)
      const query = `
        SELECT
          c.COD_CLASSIF as COD_CLASSIFICACAO,
          c.DES_CLASSIF as DES_CLASSIFICACAO,
          COUNT(fn.NUM_NF_FORN) as QTD_NFS
        FROM INTERSOLID.TAB_CLASSIFICACAO c
        LEFT JOIN INTERSOLID.TAB_FORNECEDOR f ON f.COD_CLASSIF = c.COD_CLASSIF
        LEFT JOIN INTERSOLID.TAB_FORNECEDOR_NOTA fn ON fn.COD_FORNECEDOR = f.COD_FORNECEDOR
          AND fn.DTA_ENTRADA >= SYSDATE - 30
          AND (fn.NUM_PEDIDO IS NULL OR fn.NUM_PEDIDO = 0)
          AND NVL(fn.FLG_CANCELADO, 'N') = 'N'
          AND fn.VAL_TOTAL_NF > 0
        WHERE EXISTS (
          SELECT 1 FROM INTERSOLID.TAB_FORNECEDOR f2
          WHERE f2.COD_CLASSIF = c.COD_CLASSIF
        )
        GROUP BY c.COD_CLASSIF, c.DES_CLASSIF
        ORDER BY c.COD_CLASSIF
      `;

      // Query para contar NFs sem cadastro (fornecedores sem classificação)
      const semCadastroQuery = `
        SELECT COUNT(*) as QTD_NFS
        FROM INTERSOLID.TAB_FORNECEDOR_NOTA fn
        LEFT JOIN INTERSOLID.TAB_FORNECEDOR f ON f.COD_FORNECEDOR = fn.COD_FORNECEDOR
        WHERE fn.DTA_ENTRADA >= SYSDATE - 30
        AND (fn.NUM_PEDIDO IS NULL OR fn.NUM_PEDIDO = 0)
        AND NVL(fn.FLG_CANCELADO, 'N') = 'N'
        AND fn.VAL_TOTAL_NF > 0
        AND f.COD_CLASSIF IS NULL
      `;

      const [result, semCadastroResult] = await Promise.all([
        OracleService.query<{ COD_CLASSIFICACAO: number; DES_CLASSIFICACAO: string; QTD_NFS: number }>(query, {}),
        OracleService.query<{ QTD_NFS: number }>(semCadastroQuery, {})
      ]);

      const classificacoes = result.map(r => ({
        cod: r.COD_CLASSIFICACAO,
        descricao: r.DES_CLASSIFICACAO,
        qtdNfs: r.QTD_NFS || 0
      }));

      const semCadastroCount = semCadastroResult[0]?.QTD_NFS || 0;

      res.json({ classificacoes, semCadastroCount });
    } catch (error: any) {
      console.error('Erro ao listar classificações:', error);
      res.status(500).json({ error: 'Erro ao buscar classificações', details: error.message });
    }
  }

  /**
   * Lista contatos de fornecedores com totais de NFs sem pedido
   */
  static async listarContatosNfSemPedido(_req: AuthRequest, res: Response) {
    try {
      // Query para buscar contatos com totais de NFs sem pedido (últimos 30 dias)
      const query = `
        SELECT
          NVL(TRIM(f.DES_CONTATO), 'SEM CONTATO') as CONTATO,
          COUNT(fn.NUM_NF_FORN) as QTD_NFS,
          SUM(fn.VAL_TOTAL_NF) as VALOR_TOTAL
        FROM INTERSOLID.TAB_FORNECEDOR_NOTA fn
        LEFT JOIN INTERSOLID.TAB_FORNECEDOR f ON f.COD_FORNECEDOR = fn.COD_FORNECEDOR
        WHERE fn.DTA_ENTRADA >= SYSDATE - 30
        AND (fn.NUM_PEDIDO IS NULL OR fn.NUM_PEDIDO = 0)
        AND NVL(fn.FLG_CANCELADO, 'N') = 'N'
        AND fn.VAL_TOTAL_NF > 0
        GROUP BY NVL(TRIM(f.DES_CONTATO), 'SEM CONTATO')
        HAVING COUNT(fn.NUM_NF_FORN) > 0
        ORDER BY SUM(fn.VAL_TOTAL_NF) DESC
      `;

      const result = await OracleService.query<{ CONTATO: string; QTD_NFS: number; VALOR_TOTAL: number }>(query, {});

      const contatos = result.map(r => ({
        contato: r.CONTATO,
        qtdNfs: r.QTD_NFS || 0,
        valorTotal: r.VALOR_TOTAL || 0
      }));

      res.json({ contatos });
    } catch (error: any) {
      console.error('Erro ao listar contatos:', error);
      res.status(500).json({ error: 'Erro ao buscar contatos', details: error.message });
    }
  }
}
