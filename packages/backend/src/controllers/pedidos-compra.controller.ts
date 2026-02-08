import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { OracleService } from '../services/oracle.service';
import { MappingService } from '../services/mapping.service';

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

      // Busca schema e nomes de tabelas dinâmicos
      const schema = await MappingService.getSchema();
      const tabPedido = `${schema}.${await MappingService.getRealTableName('TAB_PEDIDO')}`;
      const tabPedidoProduto = `${schema}.${await MappingService.getRealTableName('TAB_PEDIDO_PRODUTO')}`;
      const tabFornecedor = `${schema}.${await MappingService.getRealTableName('TAB_FORNECEDOR')}`;
      const tabFornecedorNota = `${schema}.${await MappingService.getRealTableName('TAB_FORNECEDOR_NOTA')}`;

      // Busca mapeamentos dinâmicos para campos de notas fiscais
      const numeroNfCol = await MappingService.getColumnFromTable('TAB_NOTA_FISCAL', 'numero_nf');
      const dataEntradaCol = await MappingService.getColumnFromTable('TAB_NOTA_FISCAL', 'data_entrada');
      const codFornecedorCol = await MappingService.getColumnFromTable('TAB_NOTA_FISCAL', 'codigo_fornecedor');
      const valorTotalCol = await MappingService.getColumnFromTable('TAB_NOTA_FISCAL', 'valor_total');
      const nfFlgCanceladoCol = await MappingService.getColumnFromTable('TAB_NOTA_FISCAL', 'flag_cancelado');

      // Busca mapeamentos dinâmicos para campos de fornecedores
      const fornCodigoCol = await MappingService.getColumnFromTable('TAB_FORNECEDOR', 'codigo_fornecedor');
      const fornRazaoSocialCol = await MappingService.getColumnFromTable('TAB_FORNECEDOR', 'razao_social');
      const fornCnpjCol = await MappingService.getColumnFromTable('TAB_FORNECEDOR', 'cnpj');
      const fornTelefoneCol = await MappingService.getColumnFromTable('TAB_FORNECEDOR', 'telefone');

      // Busca mapeamentos dinâmicos para campos de pedidos
      const pedNumPedidoCol = await MappingService.getColumnFromTable('TAB_PEDIDO', 'numero_pedido');
      const pedCodParceiroCol = await MappingService.getColumnFromTable('TAB_PEDIDO', 'codigo_fornecedor');
      const pedDtaEmissaoCol = await MappingService.getColumnFromTable('TAB_PEDIDO', 'data_emissao');
      const pedDtaEntregaCol = await MappingService.getColumnFromTable('TAB_PEDIDO', 'data_entrega');
      const pedTipoRecebimentoCol = await MappingService.getColumnFromTable('TAB_PEDIDO', 'tipo_recebimento');
      const pedTipoParceiroCol = await MappingService.getColumnFromTable('TAB_PEDIDO', 'tipo_parceiro');
      const pedValPedidoCol = await MappingService.getColumnFromTable('TAB_PEDIDO', 'valor_pedido');
      const pedFlgCanceladoCol = await MappingService.getColumnFromTable('TAB_PEDIDO', 'flag_cancelado');
      const pedCodLojaCol = await MappingService.getColumnFromTable('TAB_PEDIDO', 'codigo_loja');

      // Busca mapeamentos dinâmicos para campos de pedido_produto
      const ppNumPedidoCol = await MappingService.getColumnFromTable('TAB_PEDIDO_PRODUTO', 'numero_pedido');
      const ppQtdPedidoCol = await MappingService.getColumnFromTable('TAB_PEDIDO_PRODUTO', 'quantidade_pedida');
      const ppQtdRecebidaCol = await MappingService.getColumnFromTable('TAB_PEDIDO_PRODUTO', 'quantidade_recebida');
      const ppValTabelaCol = await MappingService.getColumnFromTable('TAB_PEDIDO_PRODUTO', 'valor_tabela');

      // Construir condições WHERE
      const conditions: string[] = [`p.${pedTipoParceiroCol} = 1`]; // Apenas pedidos de compra (fornecedor)
      const params: any = {};

      if (tipoRecebimento !== undefined && tipoRecebimento !== '') {
        conditions.push(`p.${pedTipoRecebimentoCol} = :tipoRecebimento`);
        params.tipoRecebimento = parseInt(tipoRecebimento as string, 10);
      }

      if (dataInicio) {
        conditions.push(`TRUNC(p.${pedDtaEmissaoCol}) >= TO_DATE(:dataInicio, 'YYYY-MM-DD')`);
        params.dataInicio = dataInicio;
      }

      if (dataFim) {
        conditions.push(`TRUNC(p.${pedDtaEmissaoCol}) <= TO_DATE(:dataFim, 'YYYY-MM-DD')`);
        params.dataFim = dataFim;
      }

      if (fornecedor) {
        conditions.push(`UPPER(f.${fornRazaoSocialCol}) LIKE UPPER(:fornecedor)`);
        params.fornecedor = `%${fornecedor}%`;
      }

      if (numPedido) {
        conditions.push(`p.${pedNumPedidoCol} = :numPedido`);
        params.numPedido = parseInt(numPedido as string, 10);
      }

      if (comprador) {
        conditions.push('UPPER(p.USUARIO) LIKE UPPER(:comprador)');
        params.comprador = `%${comprador}%`;
      }

      if (apenasAtrasados === 'true') {
        // Pedidos atrasados: pendentes ou parciais com data de entrega no passado
        conditions.push(`p.${pedTipoRecebimentoCol} < 2`);
        conditions.push(`TRUNC(p.${pedDtaEntregaCol}) < TRUNC(SYSDATE)`);
      }

      if (parciaisFinalizadas === 'true') {
        // Pedidos cancelados que tiveram pelo menos um item recebido
        conditions.push(`p.${pedTipoRecebimentoCol} = 3`);
        conditions.push(`EXISTS (SELECT 1 FROM ${tabPedidoProduto} pp2 WHERE pp2.${ppNumPedidoCol} = p.${pedNumPedidoCol} AND NVL(pp2.${ppQtdRecebidaCol}, 0) > 0)`);
      }

      if (canceladasTotais === 'true') {
        // Pedidos cancelados que tiveram itens não recebidos
        conditions.push(`p.${pedTipoRecebimentoCol} = 3`);
        conditions.push(`EXISTS (SELECT 1 FROM ${tabPedidoProduto} pp2 WHERE pp2.${ppNumPedidoCol} = p.${pedNumPedidoCol} AND NVL(pp2.${ppQtdRecebidaCol}, 0) < pp2.${ppQtdPedidoCol})`);
      }

      if (semNenhumaEntrada === 'true') {
        // Pedidos cancelados TOTALMENTE - nenhum item foi recebido
        conditions.push(`p.${pedTipoRecebimentoCol} = 3`);
        conditions.push(`NOT EXISTS (SELECT 1 FROM ${tabPedidoProduto} pp2 WHERE pp2.${ppNumPedidoCol} = p.${pedNumPedidoCol} AND NVL(pp2.${ppQtdRecebidaCol}, 0) > 0)`);
      }

      const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

      // Definir ordenação baseada no filtro ativo
      let orderByClause = `ORDER BY p.${pedNumPedidoCol} DESC`;
      if (apenasAtrasados === 'true') {
        // Atrasados: menos atrasados primeiro, mais atrasados no final
        orderByClause = `ORDER BY (TRUNC(SYSDATE) - TRUNC(p.${pedDtaEntregaCol})) ASC, p.${pedNumPedidoCol} DESC`;
      } else if (semNenhumaEntrada === 'true') {
        // Cancelados INTEGRAL: mais recentes primeiro (pela data de cancelamento)
        orderByClause = `ORDER BY NVL(p.DTA_PEDIDO_CANCELADO, p.DTA_ALTERACAO) DESC, p.${pedNumPedidoCol} DESC`;
      } else if (tipoRecebimento === '0' || tipoRecebimento === '1') {
        // Pendentes e Parciais em Aberto: menos atrasados primeiro, mais atrasados no final
        // Pedidos sem atraso (DIAS_ATRASO <= 0) ficam no topo ordenados por NUM_PEDIDO DESC
        // Pedidos com atraso ficam depois, ordenados por dias de atraso ASC (menos atrasados primeiro)
        orderByClause = `ORDER BY CASE WHEN TRUNC(SYSDATE) - TRUNC(p.${pedDtaEntregaCol}) > 0 THEN 1 ELSE 0 END ASC, CASE WHEN TRUNC(SYSDATE) - TRUNC(p.${pedDtaEntregaCol}) > 0 THEN TRUNC(SYSDATE) - TRUNC(p.${pedDtaEntregaCol}) ELSE 0 END ASC, p.${pedNumPedidoCol} DESC`;
      }

      // Query para contar total
      const countQuery = `
        SELECT COUNT(*) as TOTAL
        FROM ${tabPedido} p
        LEFT JOIN ${tabFornecedor} f ON f.${fornCodigoCol} = p.${pedCodParceiroCol}
        ${whereClause}
      `;

      // Query para buscar pedidos
      const dataQuery = `
        SELECT * FROM (
          SELECT
            p.${pedNumPedidoCol} as NUM_PEDIDO,
            p.${pedCodLojaCol} as COD_LOJA,
            p.${pedCodParceiroCol} as COD_PARCEIRO,
            p.${pedDtaEmissaoCol} as DTA_EMISSAO,
            p.${pedDtaEntregaCol} as DTA_ENTREGA,
            p.${pedValPedidoCol} as VAL_PEDIDO,
            p.${pedTipoRecebimentoCol} as TIPO_RECEBIMENTO,
            p.${pedFlgCanceladoCol} as FLG_CANCELADO,
            p.FLG_FATURADO,
            p.DES_CANCELAMENTO,
            p.DTA_PEDIDO_CANCELADO,
            p.DTA_ALTERACAO,
            p.DES_OBSERVACAO,
            p.USUARIO,
            p.COD_USUARIO,
            p.QTD_VOLUME,
            p.COD_COTA,
            f.${fornRazaoSocialCol} as DES_FORNECEDOR,
            f.${fornCnpjCol} as NUM_CGC,
            f.${fornTelefoneCol} as NUM_CELULAR,
            f.DES_CONTATO,
            f.NUM_FREQ_VISITA,
            f.NUM_PRAZO as PRAZO_ENTREGA,
            f.NUM_MED_CPGTO as COND_PAGAMENTO,
            pm.PRAZO_MEDIO_REAL,
            pm.QTD_NFS_PRAZO,
            TRUNC(SYSDATE) - TRUNC(p.${pedDtaEntregaCol}) as DIAS_ATRASO,
            NVL(nfc.QTD_NF_A_CONFIRMAR, 0) as QTD_NF_A_CONFIRMAR,
            ROW_NUMBER() OVER (${orderByClause}) as RN
          FROM ${tabPedido} p
          LEFT JOIN ${tabFornecedor} f ON f.${fornCodigoCol} = p.${pedCodParceiroCol}
          LEFT JOIN (
            SELECT
              fn.${codFornecedorCol} as COD_FORNECEDOR,
              ROUND(AVG(TRUNC(fn.${dataEntradaCol}) - TRUNC(ped.${pedDtaEmissaoCol})), 1) as PRAZO_MEDIO_REAL,
              COUNT(DISTINCT fn.${numeroNfCol}) as QTD_NFS_PRAZO
            FROM ${tabFornecedorNota} fn
            JOIN ${tabPedido} ped ON ped.${pedNumPedidoCol} = fn.NUM_PEDIDO AND ped.${pedTipoParceiroCol} = 1
            WHERE fn.${dataEntradaCol} >= SYSDATE - 90
            AND fn.NUM_PEDIDO IS NOT NULL
            AND fn.NUM_PEDIDO > 0
            AND NVL(fn.${nfFlgCanceladoCol}, 'N') = 'N'
            GROUP BY fn.${codFornecedorCol}
          ) pm ON pm.COD_FORNECEDOR = p.${pedCodParceiroCol}
          LEFT JOIN (
            SELECT
              nf.${codFornecedorCol} as COD_FORNECEDOR,
              COUNT(*) as QTD_NF_A_CONFIRMAR
            FROM ${tabFornecedorNota} nf
            WHERE nf.${dataEntradaCol} IS NULL
            AND NVL(nf.${nfFlgCanceladoCol}, 'N') = 'N'
            GROUP BY nf.${codFornecedorCol}
          ) nfc ON nfc.COD_FORNECEDOR = p.${pedCodParceiroCol}
          ${whereClause}
        ) WHERE RN > :offset AND RN <= :maxRow
      `;

      // Construir filtro de data para estatísticas
      const statsDateConditions: string[] = [];
      const statsParams: any = {};
      if (dataInicio) {
        statsDateConditions.push(`TRUNC(${pedDtaEmissaoCol}) >= TO_DATE(:statsDataInicio, 'YYYY-MM-DD')`);
        statsParams.statsDataInicio = dataInicio;
      }
      if (dataFim) {
        statsDateConditions.push(`TRUNC(${pedDtaEmissaoCol}) <= TO_DATE(:statsDataFim, 'YYYY-MM-DD')`);
        statsParams.statsDataFim = dataFim;
      }
      const statsDateFilter = statsDateConditions.length > 0 ? ' AND ' + statsDateConditions.join(' AND ') : '';

      // Query para estatísticas básicas (com filtro de data opcional)
      const statsQuery = `
        SELECT
          SUM(CASE WHEN ${pedTipoRecebimentoCol} = 0 THEN 1 ELSE 0 END) as PENDENTES,
          SUM(CASE WHEN ${pedTipoRecebimentoCol} = 1 THEN 1 ELSE 0 END) as PARCIAIS_ABERTO,
          SUM(CASE WHEN ${pedTipoRecebimentoCol} = 2 THEN 1 ELSE 0 END) as RECEBIDOS_INTEGRAL,
          SUM(CASE WHEN ${pedTipoRecebimentoCol} = 3 THEN 1 ELSE 0 END) as CANCELADOS,
          SUM(CASE WHEN ${pedTipoRecebimentoCol} < 2 AND TRUNC(${pedDtaEntregaCol}) < TRUNC(SYSDATE) THEN 1 ELSE 0 END) as ATRASADOS
        FROM ${tabPedido}
        WHERE ${pedTipoParceiroCol} = 1
        ${statsDateFilter}
      `;

      // Filtro de data para queries com JOIN (formato diferente)
      const joinDateConditions: string[] = [];
      const joinParams: any = {};
      if (dataInicio) {
        joinDateConditions.push(`TRUNC(p.${pedDtaEmissaoCol}) >= TO_DATE(:joinDataInicio, 'YYYY-MM-DD')`);
        joinParams.joinDataInicio = dataInicio;
      }
      if (dataFim) {
        joinDateConditions.push(`TRUNC(p.${pedDtaEmissaoCol}) <= TO_DATE(:joinDataFim, 'YYYY-MM-DD')`);
        joinParams.joinDataFim = dataFim;
      }
      const joinDateFilter = joinDateConditions.length > 0 ? ' AND ' + joinDateConditions.join(' AND ') : '';

      // Query para contar pedidos cancelados que tiveram itens recebidos (parciais finalizadas)
      const parciaisFinalizadasQuery = `
        SELECT COUNT(DISTINCT p.${pedNumPedidoCol}) as PARCIAIS_FINALIZADAS
        FROM ${tabPedido} p
        INNER JOIN ${tabPedidoProduto} pp ON pp.${ppNumPedidoCol} = p.${pedNumPedidoCol}
        WHERE p.${pedTipoParceiroCol} = 1
        AND p.${pedTipoRecebimentoCol} = 3
        AND NVL(pp.${ppQtdRecebidaCol}, 0) > 0
        ${joinDateFilter}
      `;

      // Query para contar NOTAS canceladas que tiveram itens não recebidos (itens cortados)
      // Conta notas distintas, não itens
      const canceladasTotaisQuery = `
        SELECT
          COUNT(DISTINCT p.${pedNumPedidoCol}) as NOTAS_CANCELADAS,
          SUM(pp.${ppQtdPedidoCol} - NVL(pp.${ppQtdRecebidaCol}, 0)) as QTD_CANCELADA,
          SUM((pp.${ppQtdPedidoCol} - NVL(pp.${ppQtdRecebidaCol}, 0)) * pp.${ppValTabelaCol}) as VALOR_CANCELADO
        FROM ${tabPedido} p
        INNER JOIN ${tabPedidoProduto} pp ON pp.${ppNumPedidoCol} = p.${pedNumPedidoCol}
        WHERE p.${pedTipoParceiroCol} = 1
        AND p.${pedTipoRecebimentoCol} = 3
        AND NVL(pp.${ppQtdRecebidaCol}, 0) < pp.${ppQtdPedidoCol}
        ${joinDateFilter}
      `;

      // Query para contar pedidos cancelados TOTALMENTE (nenhum item foi recebido)
      const canceladosTotalmenteQuery = `
        SELECT
          COUNT(*) as CANCELADOS_TOTALMENTE,
          SUM(p.${pedValPedidoCol}) as VALOR_TOTAL
        FROM ${tabPedido} p
        WHERE p.${pedTipoParceiroCol} = 1
        AND p.${pedTipoRecebimentoCol} = 3
        AND NOT EXISTS (
          SELECT 1 FROM ${tabPedidoProduto} pp
          WHERE pp.${ppNumPedidoCol} = p.${pedNumPedidoCol}
          AND NVL(pp.${ppQtdRecebidaCol}, 0) > 0
        )
        ${statsDateFilter}
      `;

      // Filtro de data para NFs sem pedido (usa mapeamento dinâmico)
      const nfDateConditions: string[] = [];
      const nfParams: any = {};
      if (dataInicio) {
        nfDateConditions.push(`TRUNC(fn.${dataEntradaCol}) >= TO_DATE(:nfDataInicio, 'YYYY-MM-DD')`);
        nfParams.nfDataInicio = dataInicio;
      } else {
        nfDateConditions.push(`fn.${dataEntradaCol} >= SYSDATE - 30`);
      }
      if (dataFim) {
        nfDateConditions.push(`TRUNC(fn.${dataEntradaCol}) <= TO_DATE(:nfDataFim, 'YYYY-MM-DD')`);
        nfParams.nfDataFim = dataFim;
      }
      const nfDateFilter = nfDateConditions.join(' AND ');

      // Query para contar NFs sem pedido (notas fiscais que entraram sem pedido de compra)
      const nfSemPedidoQuery = `
        SELECT
          COUNT(*) as TOTAL_NFS,
          SUM(fn.${valorTotalCol}) as VALOR_TOTAL
        FROM ${tabFornecedorNota} fn
        WHERE ${nfDateFilter}
        AND (fn.NUM_PEDIDO IS NULL OR fn.NUM_PEDIDO = 0)
        AND NVL(fn.${nfFlgCanceladoCol}, 'N') = 'N'
        AND fn.${valorTotalCol} > 0
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

      // Busca schema e nomes de tabelas dinâmicos
      const schema = await MappingService.getSchema();
      const tabPedido = `${schema}.${await MappingService.getRealTableName('TAB_PEDIDO')}`;
      const tabFornecedor = `${schema}.${await MappingService.getRealTableName('TAB_FORNECEDOR')}`;

      // Busca mapeamentos dinâmicos para campos de fornecedores
      const fornCodigoCol = await MappingService.getColumnFromTable('TAB_FORNECEDOR', 'codigo_fornecedor');
      const fornRazaoSocialCol = await MappingService.getColumnFromTable('TAB_FORNECEDOR', 'razao_social');
      const fornCnpjCol = await MappingService.getColumnFromTable('TAB_FORNECEDOR', 'cnpj');

      // Busca mapeamentos dinâmicos para campos de pedidos
      const pedNumPedidoCol = await MappingService.getColumnFromTable('TAB_PEDIDO', 'numero_pedido');
      const pedCodParceiroCol = await MappingService.getColumnFromTable('TAB_PEDIDO', 'codigo_fornecedor');
      const pedDtaEmissaoCol = await MappingService.getColumnFromTable('TAB_PEDIDO', 'data_emissao');
      const pedDtaEntregaCol = await MappingService.getColumnFromTable('TAB_PEDIDO', 'data_entrega');
      const pedTipoRecebimentoCol = await MappingService.getColumnFromTable('TAB_PEDIDO', 'tipo_recebimento');
      const pedValPedidoCol = await MappingService.getColumnFromTable('TAB_PEDIDO', 'valor_pedido');
      const pedFlgCanceladoCol = await MappingService.getColumnFromTable('TAB_PEDIDO', 'flag_cancelado');
      const pedCodLojaCol = await MappingService.getColumnFromTable('TAB_PEDIDO', 'codigo_loja');

      const query = `
        SELECT
          p.${pedNumPedidoCol} as NUM_PEDIDO,
          p.${pedCodLojaCol} as COD_LOJA,
          p.${pedCodParceiroCol} as COD_PARCEIRO,
          p.${pedDtaEmissaoCol} as DTA_EMISSAO,
          p.${pedDtaEntregaCol} as DTA_ENTREGA,
          p.${pedValPedidoCol} as VAL_PEDIDO,
          p.${pedTipoRecebimentoCol} as TIPO_RECEBIMENTO,
          p.${pedFlgCanceladoCol} as FLG_CANCELADO,
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
          f.${fornRazaoSocialCol} as DES_FORNECEDOR,
          f.${fornCnpjCol} as NUM_CGC,
          f.DES_BAIRRO,
          f.DES_CIDADE,
          f.DES_UF
        FROM ${tabPedido} p
        LEFT JOIN ${tabFornecedor} f ON f.${fornCodigoCol} = p.${pedCodParceiroCol}
        WHERE p.${pedNumPedidoCol} = :numPedido
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
      // Busca schema e nomes de tabelas dinâmicos
      const schema = await MappingService.getSchema();
      const tabPedido = `${schema}.${await MappingService.getRealTableName('TAB_PEDIDO')}`;

      // Busca mapeamentos dinâmicos para campos de pedidos
      const pedTipoParceiroCol = await MappingService.getColumnFromTable('TAB_PEDIDO', 'tipo_parceiro');

      const query = `
        SELECT DISTINCT USUARIO
        FROM ${tabPedido}
        WHERE ${pedTipoParceiroCol} = 1
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

      // Busca schema e nomes de tabelas dinâmicos
      const schema = await MappingService.getSchema();
      const tabFornecedorNota = `${schema}.${await MappingService.getRealTableName('TAB_FORNECEDOR_NOTA')}`;
      const tabFornecedor = `${schema}.${await MappingService.getRealTableName('TAB_FORNECEDOR')}`;
      const tabClassificacao = `${schema}.${await MappingService.getRealTableName('TAB_CLASSIFICACAO')}`;

      // Busca mapeamentos dinâmicos para campos de notas fiscais
      const numeroNfCol = await MappingService.getColumnFromTable('TAB_NOTA_FISCAL', 'numero_nf');
      const serieCol = await MappingService.getColumnFromTable('TAB_NOTA_FISCAL', 'serie');
      const dataEntradaCol = await MappingService.getColumnFromTable('TAB_NOTA_FISCAL', 'data_entrada');
      const codFornecedorCol = await MappingService.getColumnFromTable('TAB_NOTA_FISCAL', 'codigo_fornecedor');
      const valorTotalCol = await MappingService.getColumnFromTable('TAB_NOTA_FISCAL', 'valor_total');
      const chaveAcessoCol = await MappingService.getColumnFromTable('TAB_NOTA_FISCAL', 'chave_acesso');
      const nfFlgCanceladoCol = await MappingService.getColumnFromTable('TAB_NOTA_FISCAL', 'flag_cancelado');
      const nfCodLojaCol = await MappingService.getColumnFromTable('TAB_NOTA_FISCAL', 'codigo_loja');

      // Busca mapeamentos dinâmicos para campos de fornecedores
      const fornCodigoCol = await MappingService.getColumnFromTable('TAB_FORNECEDOR', 'codigo_fornecedor');
      const fornFantasiaCol = await MappingService.getColumnFromTable('TAB_FORNECEDOR', 'nome_fantasia');
      const fornCnpjCol = await MappingService.getColumnFromTable('TAB_FORNECEDOR', 'cnpj');
      const fornTelefoneCol = await MappingService.getColumnFromTable('TAB_FORNECEDOR', 'telefone');

      console.log(`📋 [MAPEAMENTO NF] Usando colunas: ${numeroNfCol}, ${serieCol}, ${dataEntradaCol}, ${codFornecedorCol}, ${valorTotalCol}, ${chaveAcessoCol}`);
      console.log(`📋 [MAPEAMENTO FORN] Usando colunas: ${fornCodigoCol}, ${fornFantasiaCol}, ${fornCnpjCol}, ${fornTelefoneCol}`);

      // Construir condições WHERE
      const conditions: string[] = [
        '(fn.NUM_PEDIDO IS NULL OR fn.NUM_PEDIDO = 0)',
        `NVL(fn.${nfFlgCanceladoCol}, 'N') = 'N'`,
        `fn.${valorTotalCol} > 0`
      ];
      const params: any = {};

      if (dataInicio) {
        conditions.push(`TRUNC(fn.${dataEntradaCol}) >= TO_DATE(:dataInicio, 'YYYY-MM-DD')`);
        params.dataInicio = dataInicio;
      } else {
        // Por padrão, últimos 30 dias
        conditions.push(`fn.${dataEntradaCol} >= SYSDATE - 30`);
      }

      if (dataFim) {
        conditions.push(`TRUNC(fn.${dataEntradaCol}) <= TO_DATE(:dataFim, 'YYYY-MM-DD')`);
        params.dataFim = dataFim;
      }

      if (fornecedor) {
        conditions.push(`UPPER(f.${fornFantasiaCol}) LIKE UPPER(:fornecedor)`);
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
        FROM ${tabFornecedorNota} fn
        LEFT JOIN ${tabFornecedor} f ON f.${fornCodigoCol} = fn.${codFornecedorCol}
        ${whereClause}
      `;

      // Query para buscar NFs (usando mapeamentos dinâmicos)
      const dataQuery = `
        SELECT * FROM (
          SELECT
            fn.${numeroNfCol} as NUM_NF,
            fn.${serieCol} as NUM_SERIE_NF,
            fn.${nfCodLojaCol} as COD_LOJA,
            fn.${codFornecedorCol} as COD_FORNECEDOR,
            fn.DTA_EMISSAO,
            fn.${dataEntradaCol} as DTA_ENTRADA,
            fn.${valorTotalCol} as VAL_TOTAL_NF,
            fn.DES_NATUREZA,
            fn.DES_ESPECIE,
            fn.TIPO_NF,
            fn.${chaveAcessoCol} as NUM_CHAVE_ACESSO,
            f.${fornFantasiaCol} as FORNECEDOR,
            f.${fornCnpjCol} as NUM_CGC,
            f.${fornTelefoneCol} as NUM_CELULAR,
            f.DES_CONTATO,
            f.COD_CLASSIF,
            c.DES_CLASSIF as DES_CLASSIFICACAO,
            ROW_NUMBER() OVER (ORDER BY fn.${dataEntradaCol} DESC, fn.${numeroNfCol} DESC) as RN
          FROM ${tabFornecedorNota} fn
          LEFT JOIN ${tabFornecedor} f ON f.${fornCodigoCol} = fn.${codFornecedorCol}
          LEFT JOIN ${tabClassificacao} c ON c.COD_CLASSIF = f.COD_CLASSIF
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

      // Busca schema e nomes de tabelas dinâmicos
      const schema = await MappingService.getSchema();
      const tabFornecedorProduto = `${schema}.${await MappingService.getRealTableName('TAB_FORNECEDOR_PRODUTO')}`;
      const tabProduto = `${schema}.${await MappingService.getRealTableName('TAB_PRODUTO')}`;
      const tabProdutoLoja = `${schema}.${await MappingService.getRealTableName('TAB_PRODUTO_LOJA')}`;

      // Busca mapeamentos dinâmicos para campos de produtos
      const prCodProdutoCol = await MappingService.getColumnFromTable('TAB_PRODUTO', 'codigo_produto');
      const prDesProdutoCol = await MappingService.getColumnFromTable('TAB_PRODUTO', 'descricao');
      const prDesReduzidaCol = await MappingService.getColumnFromTable('TAB_PRODUTO', 'descricao_reduzida');

      // Busca mapeamentos dinâmicos para campos de produto_loja
      const plCodProdutoCol = await MappingService.getColumnFromTable('TAB_PRODUTO_LOJA', 'codigo_produto');
      const plCodLojaCol = await MappingService.getColumnFromTable('TAB_PRODUTO_LOJA', 'codigo_loja');
      const plCurvaCol = await MappingService.getColumnFromTable('TAB_PRODUTO_LOJA', 'curva');

      // Busca mapeamentos dinâmicos para campos de nota fiscal
      const nfNumeroNfCol = await MappingService.getColumnFromTable('TAB_NOTA_FISCAL', 'numero_nf');
      const nfCodFornecedorCol = await MappingService.getColumnFromTable('TAB_NOTA_FISCAL', 'codigo_fornecedor');

      const query = `
        SELECT
          fp.NUM_ITEM,
          fp.COD_PRODUTO,
          fp.QTD_ENTRADA,
          fp.VAL_TABELA as VAL_CUSTO,
          fp.VAL_VENDA_VAREJO as VAL_VENDA,
          (fp.QTD_ENTRADA * fp.VAL_TABELA) as VAL_TOTAL,
          fp.DES_UNIDADE,
          pr.${prDesProdutoCol} as DES_PRODUTO,
          pr.${prDesReduzidaCol} as DES_REDUZIDA,
          NVL(TRIM(pl.${plCurvaCol}), 'X') as CURVA
        FROM ${tabFornecedorProduto} fp
        LEFT JOIN ${tabProduto} pr ON pr.${prCodProdutoCol} = fp.COD_PRODUTO
        LEFT JOIN ${tabProdutoLoja} pl ON pl.${plCodProdutoCol} = fp.COD_PRODUTO AND pl.${plCodLojaCol} = :codLoja
        WHERE fp.${nfNumeroNfCol} = :numNf
        AND fp.${nfCodFornecedorCol} = :codFornecedor
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

      // Busca schema e nomes de tabelas dinâmicos
      const schema = await MappingService.getSchema();
      const tabPedido = `${schema}.${await MappingService.getRealTableName('TAB_PEDIDO')}`;
      const tabPedidoProduto = `${schema}.${await MappingService.getRealTableName('TAB_PEDIDO_PRODUTO')}`;
      const tabProduto = `${schema}.${await MappingService.getRealTableName('TAB_PRODUTO')}`;
      const tabProdutoLoja = `${schema}.${await MappingService.getRealTableName('TAB_PRODUTO_LOJA')}`;

      // Busca mapeamentos dinâmicos para campos de pedidos
      const pedNumPedidoCol = await MappingService.getColumnFromTable('TAB_PEDIDO', 'numero_pedido');
      const pedCodLojaCol = await MappingService.getColumnFromTable('TAB_PEDIDO', 'codigo_loja');

      // Busca mapeamentos dinâmicos para campos de pedido_produto
      const ppNumPedidoCol = await MappingService.getColumnFromTable('TAB_PEDIDO_PRODUTO', 'numero_pedido');
      const ppCodProdutoCol = await MappingService.getColumnFromTable('TAB_PEDIDO_PRODUTO', 'codigo_produto');
      const ppQtdPedidoCol = await MappingService.getColumnFromTable('TAB_PEDIDO_PRODUTO', 'quantidade_pedida');
      const ppQtdRecebidaCol = await MappingService.getColumnFromTable('TAB_PEDIDO_PRODUTO', 'quantidade_recebida');
      const ppValTabelaCol = await MappingService.getColumnFromTable('TAB_PEDIDO_PRODUTO', 'valor_tabela');

      // Busca mapeamentos dinâmicos para campos de produtos
      const prCodProdutoCol = await MappingService.getColumnFromTable('TAB_PRODUTO', 'codigo_produto');
      const prDesProdutoCol = await MappingService.getColumnFromTable('TAB_PRODUTO', 'descricao');
      const prDesReduzidaCol = await MappingService.getColumnFromTable('TAB_PRODUTO', 'descricao_reduzida');

      // Busca mapeamentos dinâmicos para campos de produto_loja
      const plCodProdutoCol = await MappingService.getColumnFromTable('TAB_PRODUTO_LOJA', 'codigo_produto');
      const plCodLojaCol = await MappingService.getColumnFromTable('TAB_PRODUTO_LOJA', 'codigo_loja');
      const plCurvaCol = await MappingService.getColumnFromTable('TAB_PRODUTO_LOJA', 'curva');

      let filtroCondition = '';
      if (filtroItens === 'apenasRecebidos') {
        // Parciais Finalizadas: mostrar apenas itens OK (recebeu tudo que foi pedido)
        filtroCondition = `AND NVL(pp.${ppQtdRecebidaCol}, 0) >= pp.${ppQtdPedidoCol}`;
      } else if (filtroItens === 'apenasRuptura') {
        // Canceladas Totais: mostrar apenas itens cancelados (não recebeu ou recebeu menos)
        filtroCondition = `AND NVL(pp.${ppQtdRecebidaCol}, 0) < pp.${ppQtdPedidoCol}`;
      }
      // Nota: filtroItens === 'semNenhumaEntrada' retorna todos os itens (sem filtro adicional)

      // Buscar COD_LOJA do pedido para obter a CURVA correta
      const pedidoQuery = `SELECT ${pedCodLojaCol} as COD_LOJA FROM ${tabPedido} WHERE ${pedNumPedidoCol} = :numPedido`;
      const pedidoResult = await OracleService.query<{ COD_LOJA: number }>(pedidoQuery, { numPedido: parseInt(numPedido, 10) });
      const codLoja = pedidoResult[0]?.COD_LOJA || 1;

      const query = `
        SELECT
          pp.NUM_ITEM,
          pp.${ppCodProdutoCol} as COD_PRODUTO,
          pp.${ppQtdPedidoCol} as QTD_PEDIDO,
          pp.${ppQtdRecebidaCol} as QTD_RECEBIDA,
          pp.DES_UNIDADE,
          pp.${ppValTabelaCol} as VAL_TABELA,
          pp.VAL_CUSTO_REP,
          pp.VAL_DESCONTO_ITEM,
          pp.BONIFICACAO,
          pp.DTA_VALIDADE,
          pr.${prDesProdutoCol} as DES_PRODUTO,
          pr.${prDesReduzidaCol} as DES_REDUZIDA,
          NVL(TRIM(pl.${plCurvaCol}), 'X') as CURVA
        FROM ${tabPedidoProduto} pp
        LEFT JOIN ${tabProduto} pr ON pr.${prCodProdutoCol} = pp.${ppCodProdutoCol}
        LEFT JOIN ${tabProdutoLoja} pl ON pl.${plCodProdutoCol} = pp.${ppCodProdutoCol} AND pl.${plCodLojaCol} = :codLoja
        WHERE pp.${ppNumPedidoCol} = :numPedido
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
      // Busca schema e nomes de tabelas dinâmicos
      const schema = await MappingService.getSchema();
      const tabClassificacao = `${schema}.${await MappingService.getRealTableName('TAB_CLASSIFICACAO')}`;
      const tabFornecedor = `${schema}.${await MappingService.getRealTableName('TAB_FORNECEDOR')}`;
      const tabFornecedorNota = `${schema}.${await MappingService.getRealTableName('TAB_FORNECEDOR_NOTA')}`;

      // Busca mapeamentos dinâmicos para campos de notas fiscais
      const numeroNfCol = await MappingService.getColumnFromTable('TAB_NOTA_FISCAL', 'numero_nf');
      const dataEntradaCol = await MappingService.getColumnFromTable('TAB_NOTA_FISCAL', 'data_entrada');
      const codFornecedorCol = await MappingService.getColumnFromTable('TAB_NOTA_FISCAL', 'codigo_fornecedor');
      const valorTotalCol = await MappingService.getColumnFromTable('TAB_NOTA_FISCAL', 'valor_total');
      const nfFlgCanceladoCol = await MappingService.getColumnFromTable('TAB_NOTA_FISCAL', 'flag_cancelado');

      // Busca mapeamentos dinâmicos para campos de fornecedores
      const fornCodigoCol = await MappingService.getColumnFromTable('TAB_FORNECEDOR', 'codigo_fornecedor');

      // Query para buscar classificações com contagem de NFs sem pedido (últimos 30 dias)
      const query = `
        SELECT
          c.COD_CLASSIF as COD_CLASSIFICACAO,
          c.DES_CLASSIF as DES_CLASSIFICACAO,
          COUNT(fn.${numeroNfCol}) as QTD_NFS
        FROM ${tabClassificacao} c
        LEFT JOIN ${tabFornecedor} f ON f.COD_CLASSIF = c.COD_CLASSIF
        LEFT JOIN ${tabFornecedorNota} fn ON fn.${codFornecedorCol} = f.${fornCodigoCol}
          AND fn.${dataEntradaCol} >= SYSDATE - 30
          AND (fn.NUM_PEDIDO IS NULL OR fn.NUM_PEDIDO = 0)
          AND NVL(fn.${nfFlgCanceladoCol}, 'N') = 'N'
          AND fn.${valorTotalCol} > 0
        WHERE EXISTS (
          SELECT 1 FROM ${tabFornecedor} f2
          WHERE f2.COD_CLASSIF = c.COD_CLASSIF
        )
        GROUP BY c.COD_CLASSIF, c.DES_CLASSIF
        ORDER BY c.COD_CLASSIF
      `;

      // Query para contar NFs sem cadastro (fornecedores sem classificação)
      const semCadastroQuery = `
        SELECT COUNT(*) as QTD_NFS
        FROM ${tabFornecedorNota} fn
        LEFT JOIN ${tabFornecedor} f ON f.${fornCodigoCol} = fn.${codFornecedorCol}
        WHERE fn.${dataEntradaCol} >= SYSDATE - 30
        AND (fn.NUM_PEDIDO IS NULL OR fn.NUM_PEDIDO = 0)
        AND NVL(fn.${nfFlgCanceladoCol}, 'N') = 'N'
        AND fn.${valorTotalCol} > 0
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
      // Busca schema e nomes de tabelas dinâmicos
      const schema = await MappingService.getSchema();
      const tabFornecedorNota = `${schema}.${await MappingService.getRealTableName('TAB_FORNECEDOR_NOTA')}`;
      const tabFornecedor = `${schema}.${await MappingService.getRealTableName('TAB_FORNECEDOR')}`;

      // Busca mapeamentos dinâmicos para campos de notas fiscais
      const numeroNfCol = await MappingService.getColumnFromTable('TAB_NOTA_FISCAL', 'numero_nf');
      const dataEntradaCol = await MappingService.getColumnFromTable('TAB_NOTA_FISCAL', 'data_entrada');
      const codFornecedorCol = await MappingService.getColumnFromTable('TAB_NOTA_FISCAL', 'codigo_fornecedor');
      const valorTotalCol = await MappingService.getColumnFromTable('TAB_NOTA_FISCAL', 'valor_total');
      const nfFlgCanceladoCol = await MappingService.getColumnFromTable('TAB_NOTA_FISCAL', 'flag_cancelado');

      // Busca mapeamentos dinâmicos para campos de fornecedores
      const fornCodigoCol = await MappingService.getColumnFromTable('TAB_FORNECEDOR', 'codigo_fornecedor');

      // Query para buscar contatos com totais de NFs sem pedido (últimos 30 dias)
      const query = `
        SELECT
          NVL(TRIM(f.DES_CONTATO), 'SEM CONTATO') as CONTATO,
          COUNT(fn.${numeroNfCol}) as QTD_NFS,
          SUM(fn.${valorTotalCol}) as VALOR_TOTAL
        FROM ${tabFornecedorNota} fn
        LEFT JOIN ${tabFornecedor} f ON f.${fornCodigoCol} = fn.${codFornecedorCol}
        WHERE fn.${dataEntradaCol} >= SYSDATE - 30
        AND (fn.NUM_PEDIDO IS NULL OR fn.NUM_PEDIDO = 0)
        AND NVL(fn.${nfFlgCanceladoCol}, 'N') = 'N'
        AND fn.${valorTotalCol} > 0
        GROUP BY NVL(TRIM(f.DES_CONTATO), 'SEM CONTATO')
        HAVING COUNT(fn.${numeroNfCol}) > 0
        ORDER BY SUM(fn.${valorTotalCol}) DESC
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

  /**
   * Lista NFs com bloqueio pendente de liberação
   * Somente NFs que têm bloqueio ativo E ainda não foram liberadas (autorizador/liberador IS NULL)
   */
  static async listarNfComBloqueio(req: AuthRequest, res: Response) {
    try {
      const { dataInicio, dataFim, fornecedor, tipoBloqueio } = req.query;

      // Busca schema e nomes de tabelas dinâmicos
      const schema = await MappingService.getSchema();
      const tabFornecedorNota = `${schema}.${await MappingService.getRealTableName('TAB_FORNECEDOR_NOTA')}`;
      const tabFornecedor = `${schema}.${await MappingService.getRealTableName('TAB_FORNECEDOR')}`;
      const tabComprador = `${schema}.${await MappingService.getRealTableName('TAB_COMPRADOR')}`;

      // Busca mapeamentos dinâmicos para campos de notas fiscais
      const nfNumeroNfCol = await MappingService.getColumnFromTable('TAB_NOTA_FISCAL', 'numero_nf');
      const nfSerieCol = await MappingService.getColumnFromTable('TAB_NOTA_FISCAL', 'serie');
      const nfDataEntradaCol = await MappingService.getColumnFromTable('TAB_NOTA_FISCAL', 'data_entrada');
      const nfCodFornecedorCol = await MappingService.getColumnFromTable('TAB_NOTA_FISCAL', 'codigo_fornecedor');
      const nfValorTotalCol = await MappingService.getColumnFromTable('TAB_NOTA_FISCAL', 'valor_total');
      const nfCodLojaCol = await MappingService.getColumnFromTable('TAB_NOTA_FISCAL', 'codigo_loja');

      // Busca mapeamentos dinâmicos para campos de fornecedores
      const fornCodigoCol = await MappingService.getColumnFromTable('TAB_FORNECEDOR', 'codigo_fornecedor');
      const fornRazaoSocialCol = await MappingService.getColumnFromTable('TAB_FORNECEDOR', 'razao_social');
      const fornCnpjCol = await MappingService.getColumnFromTable('TAB_FORNECEDOR', 'cnpj');

      // Condição base: NF com bloqueio pendente = tem flag de bloqueio ativo E não tem autorizador/liberador
      // Uma NF só aparece se tiver pelo menos um bloqueio PENDENTE de liberação
      const bloqueiosPendentes = `(
        (n.FLG_BLOQUEADO_1F = 'S' AND n.USU_AUTORIZ_1F IS NULL) OR
        (n.FLG_BLOQUEADO_2F = 'S' AND n.USU_AUTORIZ_2F IS NULL) OR
        (n.FLG_BLOQUEADO_CUSTO = 'S' AND n.USU_LIBER_CUSTO IS NULL)
      )`;

      const conditions: string[] = [bloqueiosPendentes];
      const params: any = {};

      if (dataInicio) {
        conditions.push(`TRUNC(n.${nfDataEntradaCol}) >= TO_DATE(:dataInicio, 'YYYY-MM-DD')`);
        params.dataInicio = dataInicio;
      }

      if (dataFim) {
        conditions.push(`TRUNC(n.${nfDataEntradaCol}) <= TO_DATE(:dataFim, 'YYYY-MM-DD')`);
        params.dataFim = dataFim;
      }

      if (fornecedor) {
        conditions.push(`UPPER(f.${fornRazaoSocialCol}) LIKE UPPER(:fornecedor)`);
        params.fornecedor = `%${fornecedor}%`;
      }

      if (tipoBloqueio === '1f') {
        conditions.push("(n.FLG_BLOQUEADO_1F = 'S' AND n.USU_AUTORIZ_1F IS NULL)");
      } else if (tipoBloqueio === '2f') {
        conditions.push("(n.FLG_BLOQUEADO_2F = 'S' AND n.USU_AUTORIZ_2F IS NULL)");
      } else if (tipoBloqueio === 'custo') {
        conditions.push("(n.FLG_BLOQUEADO_CUSTO = 'S' AND n.USU_LIBER_CUSTO IS NULL)");
      }

      const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

      // Query para contar totais por tipo de bloqueio PENDENTE (não liberado ainda)
      const statsQuery = `
        SELECT
          COUNT(CASE WHEN n.FLG_BLOQUEADO_1F = 'S' AND n.USU_AUTORIZ_1F IS NULL THEN 1 END) as TOTAL_BLOQ_1F,
          COUNT(CASE WHEN n.FLG_BLOQUEADO_2F = 'S' AND n.USU_AUTORIZ_2F IS NULL THEN 1 END) as TOTAL_BLOQ_2F,
          COUNT(CASE WHEN n.FLG_BLOQUEADO_CUSTO = 'S' AND n.USU_LIBER_CUSTO IS NULL THEN 1 END) as TOTAL_BLOQ_CUSTO,
          COUNT(*) as TOTAL_COM_BLOQUEIO,
          NVL(SUM(n.${nfValorTotalCol}), 0) as VALOR_TOTAL_BLOQUEADO
        FROM ${tabFornecedorNota} n
        WHERE (
          (n.FLG_BLOQUEADO_1F = 'S' AND n.USU_AUTORIZ_1F IS NULL) OR
          (n.FLG_BLOQUEADO_2F = 'S' AND n.USU_AUTORIZ_2F IS NULL) OR
          (n.FLG_BLOQUEADO_CUSTO = 'S' AND n.USU_LIBER_CUSTO IS NULL)
        )
      `;

      // Query para buscar NFs com bloqueio (usa ROWNUM para compatibilidade com Oracle 11g)
      const dataQuery = `
        SELECT * FROM (
          SELECT
            n.${nfCodLojaCol} as LOJA,
            n.${nfCodFornecedorCol} as COD_FORNECEDOR,
            f.${fornCnpjCol} as CNPJ,
            f.${fornRazaoSocialCol} as DES_FORNECEDOR,
            n.${nfNumeroNfCol} as NUMERO_NF,
            n.NUM_ROMANEIO as ROMANEIO,
            n.${nfSerieCol} as SERIE,
            n.${nfValorTotalCol} as VAL_TOTAL_NF,
            TO_CHAR(n.${nfDataEntradaCol}, 'DD/MM/YYYY') as DTA_ENTRADA,
            n.USUARIO as USUARIO_ENTRADA,
            n.FLG_BLOQUEADO_1F as BLOQ_1F,
            n.USU_AUTORIZ_1F as AUTORIZADOR_1F,
            n.FLG_BLOQUEADO_2F as BLOQ_2F,
            n.USU_AUTORIZ_2F as AUTORIZADOR_2F,
            n.FLG_BLOQUEADO_CUSTO as BLOQ_CUSTO,
            n.USU_LIBER_CUSTO as LIBERADOR_CUSTO,
            c.DES_COMPRADOR as COMPRADOR,
            n.OBS_LIBERACAO_PEDIDO as OBS_LIBERACAO,
            n.NUM_PEDIDO
          FROM ${tabFornecedorNota} n
          JOIN ${tabFornecedor} f ON n.${nfCodFornecedorCol} = f.${fornCodigoCol}
          LEFT JOIN ${tabComprador} c ON n.COD_COMPRADOR = c.COD_COMPRADOR
          ${whereClause}
          ORDER BY n.${nfDataEntradaCol} DESC
        ) WHERE ROWNUM <= 100
      `;

      console.log('=== DEBUG NF BLOQUEIO ===');
      console.log('statsQuery:', statsQuery);
      console.log('dataQuery whereClause:', whereClause);

      const [statsResult, dataResult] = await Promise.all([
        OracleService.query<any>(statsQuery, {}),
        OracleService.query<any>(dataQuery, params)
      ]);

      console.log('statsResult:', JSON.stringify(statsResult));
      console.log('dataResult count:', dataResult.length);
      if (dataResult.length > 0) {
        console.log('dataResult[0]:', JSON.stringify(dataResult[0]));
      }

      const stats = statsResult[0] || {
        TOTAL_BLOQ_1F: 0,
        TOTAL_BLOQ_2F: 0,
        TOTAL_BLOQ_CUSTO: 0,
        TOTAL_COM_BLOQUEIO: 0,
        VALOR_TOTAL_BLOQUEADO: 0
      };

      const nfs = dataResult.map((r: any) => ({
        loja: r.LOJA,
        codFornecedor: r.COD_FORNECEDOR,
        cnpj: r.CNPJ,
        fornecedor: r.DES_FORNECEDOR,
        numeroNf: r.NUMERO_NF,
        romaneio: r.ROMANEIO || 0,
        serie: r.SERIE,
        valorTotal: r.VAL_TOTAL_NF || 0,
        dataEntrada: r.DTA_ENTRADA,
        usuarioEntrada: r.USUARIO_ENTRADA,
        bloqueio1f: r.BLOQ_1F === 'S',
        autorizador1f: r.AUTORIZADOR_1F,
        bloqueio2f: r.BLOQ_2F === 'S',
        autorizador2f: r.AUTORIZADOR_2F,
        bloqueioCusto: r.BLOQ_CUSTO === 'S',
        liberadorCusto: r.LIBERADOR_CUSTO,
        comprador: r.COMPRADOR,
        obsLiberacao: r.OBS_LIBERACAO,
        numPedido: r.NUM_PEDIDO
      }));

      res.json({
        stats: {
          totalBloq1f: stats.TOTAL_BLOQ_1F || 0,
          totalBloq2f: stats.TOTAL_BLOQ_2F || 0,
          totalBloqCusto: stats.TOTAL_BLOQ_CUSTO || 0,
          totalComBloqueio: stats.TOTAL_COM_BLOQUEIO || 0,
          valorTotalBloqueado: stats.VALOR_TOTAL_BLOQUEADO || 0
        },
        nfs
      });
    } catch (error: any) {
      console.error('Erro ao listar NFs com bloqueio:', error);
      res.status(500).json({ error: 'Erro ao buscar NFs com bloqueio', details: error.message });
    }
  }

  /**
   * Lista itens de uma NF com bloqueio
   * Mostra os produtos que compõem a nota fiscal
   */
  static async listarItensNfBloqueio(req: AuthRequest, res: Response) {
    try {
      const { numNf, codFornecedor, codLoja } = req.params;

      // Busca schema e nomes de tabelas dinâmicos
      const schema = await MappingService.getSchema();
      const tabFornecedorProduto = `${schema}.${await MappingService.getRealTableName('TAB_FORNECEDOR_PRODUTO')}`;
      const tabProduto = `${schema}.${await MappingService.getRealTableName('TAB_PRODUTO')}`;
      const tabProdutoLoja = `${schema}.${await MappingService.getRealTableName('TAB_PRODUTO_LOJA')}`;

      // Busca mapeamentos dinâmicos para campos de produtos
      const prCodProdutoCol = await MappingService.getColumnFromTable('TAB_PRODUTO', 'codigo_produto');
      const prDesProdutoCol = await MappingService.getColumnFromTable('TAB_PRODUTO', 'descricao');

      // Busca mapeamentos dinâmicos para campos de produto_loja
      const plCodProdutoCol = await MappingService.getColumnFromTable('TAB_PRODUTO_LOJA', 'codigo_produto');
      const plCodLojaCol = await MappingService.getColumnFromTable('TAB_PRODUTO_LOJA', 'codigo_loja');
      const plCurvaCol = await MappingService.getColumnFromTable('TAB_PRODUTO_LOJA', 'curva');

      // Busca mapeamentos dinâmicos para campos de nota fiscal
      const nfNumeroNfCol = await MappingService.getColumnFromTable('TAB_NOTA_FISCAL', 'numero_nf');
      const nfCodFornecedorCol = await MappingService.getColumnFromTable('TAB_NOTA_FISCAL', 'codigo_fornecedor');

      // Usa TAB_FORNECEDOR_PRODUTO que contém os itens das NFs de entrada
      const query = `
        SELECT * FROM (
          SELECT
            fp.NUM_ITEM as ITEM,
            fp.COD_PRODUTO,
            fp.COD_PRODUTO as REFERENCIA,
            pr.${prDesProdutoCol} as DESCRICAO,
            fp.DES_UNIDADE as UNIDADE,
            fp.QTD_ENTRADA,
            fp.VAL_TABELA as VAL_CUSTO,
            fp.VAL_VENDA_VAREJO as VAL_VENDA,
            (fp.QTD_ENTRADA * fp.VAL_TABELA) as VAL_TOTAL,
            NVL(TRIM(pl.${plCurvaCol}), 'X') as CURVA
          FROM ${tabFornecedorProduto} fp
          LEFT JOIN ${tabProduto} pr ON pr.${prCodProdutoCol} = fp.COD_PRODUTO
          LEFT JOIN ${tabProdutoLoja} pl ON pl.${plCodProdutoCol} = fp.COD_PRODUTO AND pl.${plCodLojaCol} = :codLoja
          WHERE fp.${nfNumeroNfCol} = :numNf
            AND fp.${nfCodFornecedorCol} = :codFornecedor
          ORDER BY fp.NUM_ITEM
        ) WHERE ROWNUM <= 500
      `;

      const itens = await OracleService.query<any>(query, {
        numNf: parseInt(numNf),
        codFornecedor: parseInt(codFornecedor),
        codLoja: parseInt(codLoja)
      });

      res.json({
        itens: itens.map((i: any) => ({
          item: i.ITEM,
          codProduto: i.COD_PRODUTO,
          referencia: i.REFERENCIA,
          descricao: i.DESCRICAO,
          unidade: i.UNIDADE,
          qtdEntrada: i.QTD_ENTRADA || 0,
          valCusto: i.VAL_CUSTO || 0,
          valVenda: i.VAL_VENDA || 0,
          valTotal: i.VAL_TOTAL || 0,
          curva: i.CURVA
        }))
      });
    } catch (error: any) {
      console.error('Erro ao listar itens NF bloqueio:', error);
      res.status(500).json({ error: 'Erro ao buscar itens da NF', details: error.message });
    }
  }
}
