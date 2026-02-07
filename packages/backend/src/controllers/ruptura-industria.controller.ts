import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { OracleService } from '../services/oracle.service';
import { MappingService } from '../services/mapping.service';

/**
 * Helper para obter nomes de tabelas do MappingService com fallback para Intersolid
 */
async function getTableNames() {
  const schema = await MappingService.getSchema();
  return {
    pedido: `${schema}.${await MappingService.getRealTableName('TAB_PEDIDO', 'TAB_PEDIDO')}`,
    pedidoProduto: `${schema}.${await MappingService.getRealTableName('TAB_PEDIDO_PRODUTO', 'TAB_PEDIDO_PRODUTO')}`,
    fornecedor: `${schema}.${await MappingService.getRealTableName('TAB_FORNECEDOR', 'TAB_FORNECEDOR')}`,
    produto: `${schema}.${await MappingService.getRealTableName('TAB_PRODUTO', 'TAB_PRODUTO')}`,
    produtoLoja: `${schema}.${await MappingService.getRealTableName('TAB_PRODUTO_LOJA', 'TAB_PRODUTO_LOJA')}`,
    nf: `${schema}.${await MappingService.getRealTableName('TAB_NF', 'TAB_NF')}`,
    nfItem: `${schema}.${await MappingService.getRealTableName('TAB_NF_ITEM', 'TAB_NF_ITEM')}`
  };
}

/**
 * Helper para obter nomes de colunas dinâmicos do MappingService com fallback
 * Centraliza todas as resoluções de colunas usadas no controller de Ruptura Indústria
 */
async function getRupturaMappings() {
  // --- TAB_PEDIDO columns ---
  const pedNumPedido = await MappingService.getColumnFromTable('TAB_PEDIDO', 'numero_pedido', 'NUM_PEDIDO');
  const pedDtaEmissao = await MappingService.getColumnFromTable('TAB_PEDIDO', 'data_emissao', 'DTA_EMISSAO');
  const pedDtaEntrega = await MappingService.getColumnFromTable('TAB_PEDIDO', 'data_entrega', 'DTA_ENTREGA');
  const pedCodParceiro = await MappingService.getColumnFromTable('TAB_PEDIDO', 'codigo_fornecedor', 'COD_PARCEIRO');
  const pedTipoParceiro = await MappingService.getColumnFromTable('TAB_PEDIDO', 'tipo_parceiro', 'TIPO_PARCEIRO');
  const pedTipoRecebimento = await MappingService.getColumnFromTable('TAB_PEDIDO', 'tipo_recebimento', 'TIPO_RECEBIMENTO');
  const pedValPedido = await MappingService.getColumnFromTable('TAB_PEDIDO', 'valor_pedido', 'VAL_PEDIDO');
  // Colunas sem mapeamento no catálogo - mantidas hardcoded
  // DTA_PEDIDO_CANCELADO, DES_CANCELAMENTO, USUARIO não estão no TABLE_CATALOG

  // --- TAB_PEDIDO_PRODUTO columns ---
  const ppNumPedido = await MappingService.getColumnFromTable('TAB_PEDIDO_PRODUTO', 'numero_pedido', 'NUM_PEDIDO');
  const ppCodProduto = await MappingService.getColumnFromTable('TAB_PEDIDO_PRODUTO', 'codigo_produto', 'COD_PRODUTO');
  const ppQtdPedido = await MappingService.getColumnFromTable('TAB_PEDIDO_PRODUTO', 'quantidade_pedida', 'QTD_PEDIDO');
  const ppQtdRecebida = await MappingService.getColumnFromTable('TAB_PEDIDO_PRODUTO', 'quantidade_recebida', 'QTD_RECEBIDA');
  const ppValTabela = await MappingService.getColumnFromTable('TAB_PEDIDO_PRODUTO', 'valor_tabela', 'VAL_TABELA');
  // QTD_EMBALAGEM não está no TABLE_CATALOG - mantida hardcoded

  // --- TAB_FORNECEDOR columns ---
  const fornCodFornecedor = await MappingService.getColumnFromTable('TAB_FORNECEDOR', 'codigo_fornecedor', 'COD_FORNECEDOR');
  const fornDesFornecedor = await MappingService.getColumnFromTable('TAB_FORNECEDOR', 'razao_social', 'DES_FORNECEDOR');
  const fornNumCgc = await MappingService.getColumnFromTable('TAB_FORNECEDOR', 'cnpj', 'NUM_CGC');

  // --- TAB_PRODUTO columns ---
  const prCodProduto = await MappingService.getColumnFromTable('TAB_PRODUTO', 'codigo_produto', 'COD_PRODUTO');
  const prDesProduto = await MappingService.getColumnFromTable('TAB_PRODUTO', 'descricao_produto', 'DES_PRODUTO');
  const prDesReduzida = await MappingService.getColumnFromTable('TAB_PRODUTO', 'descricao_reduzida', 'DES_REDUZIDA');

  // --- TAB_PRODUTO_LOJA columns ---
  const plCodProduto = await MappingService.getColumnFromTable('TAB_PRODUTO_LOJA', 'codigo_produto', 'COD_PRODUTO');
  const plCodLoja = await MappingService.getColumnFromTable('TAB_PRODUTO_LOJA', 'codigo_loja', 'COD_LOJA');
  const plCurva = await MappingService.getColumnFromTable('TAB_PRODUTO_LOJA', 'curva', 'DES_RANK_PRODLOJA');
  // FORA_LINHA não está no TABLE_CATALOG - mantida hardcoded

  // --- TAB_NF columns ---
  const nfNumNf = await MappingService.getColumnFromTable('TAB_NF', 'numero_nf', 'NUM_NF');
  const nfNumSerieNf = await MappingService.getColumnFromTable('TAB_NF', 'numero_serie', 'NUM_SERIE_NF');
  const nfDtaEntrada = await MappingService.getColumnFromTable('TAB_NF', 'data_entrada', 'DTA_ENTRADA');
  const nfCodParceiro = await MappingService.getColumnFromTable('TAB_NF', 'codigo_fornecedor', 'COD_PARCEIRO');
  const nfTipoOperacao = await MappingService.getColumnFromTable('TAB_NF', 'tipo_operacao', 'TIPO_OPERACAO');

  // --- TAB_NF_ITEM columns ---
  const niNumNf = await MappingService.getColumnFromTable('TAB_NF_ITEM', 'numero_nf', 'NUM_NF');
  const niNumSerieNf = await MappingService.getColumnFromTable('TAB_NF_ITEM', 'numero_serie', 'NUM_SERIE_NF');
  const niCodParceiro = await MappingService.getColumnFromTable('TAB_NF_ITEM', 'codigo_fornecedor', 'COD_PARCEIRO');
  const niCodItem = await MappingService.getColumnFromTable('TAB_NF_ITEM', 'codigo_produto', 'COD_ITEM');
  const niQtdEntrada = await MappingService.getColumnFromTable('TAB_NF_ITEM', 'quantidade_entrada', 'QTD_ENTRADA');
  const niValCustoScred = await MappingService.getColumnFromTable('TAB_NF_ITEM', 'valor_custo', 'VAL_CUSTO_SCRED');
  const niValTotal = await MappingService.getColumnFromTable('TAB_NF_ITEM', 'valor_total', 'VAL_TOTAL');
  const niValUnitario = await MappingService.getColumnFromTable('TAB_NF_ITEM', 'valor_unitario', 'VAL_UNITARIO');

  return {
    // TAB_PEDIDO
    pedNumPedido, pedDtaEmissao, pedDtaEntrega, pedCodParceiro,
    pedTipoParceiro, pedTipoRecebimento, pedValPedido,
    // TAB_PEDIDO_PRODUTO
    ppNumPedido, ppCodProduto, ppQtdPedido, ppQtdRecebida, ppValTabela,
    // TAB_FORNECEDOR
    fornCodFornecedor, fornDesFornecedor, fornNumCgc,
    // TAB_PRODUTO
    prCodProduto, prDesProduto, prDesReduzida,
    // TAB_PRODUTO_LOJA
    plCodProduto, plCodLoja, plCurva,
    // TAB_NF
    nfNumNf, nfNumSerieNf, nfDtaEntrada, nfCodParceiro, nfTipoOperacao,
    // TAB_NF_ITEM
    niNumNf, niNumSerieNf, niCodParceiro, niCodItem,
    niQtdEntrada, niValCustoScred, niValTotal, niValUnitario
  };
}

/**
 * Controller para Ruptura Industria
 * Analise de itens cortados em pedidos finalizados (TIPO_RECEBIMENTO = 3)
 * Ruptura = item que foi pedido mas nao chegou ou chegou com quantidade menor
 * Filtra apenas pedidos cancelados/finalizados para consistencia com tela de Itens Cortados
 */
export class RupturaIndustriaController {
  /**
   * Ranking de fornecedores com estatisticas de ruptura por periodo
   * Ruptura = itens onde QTD_RECEBIDA < QTD_PEDIDO (item nao chegou ou chegou incompleto)
   * Mostra: total de itens, itens com ruptura, itens OK para cada periodo
   */
  static async rankingFornecedores(req: AuthRequest, res: Response) {
    try {
      const { limit = '50', dataInicio, dataFim } = req.query;

      // Obter nomes de tabelas e colunas dinamicos do MappingService
      const tables = await getTableNames();
      const cols = await getRupturaMappings();

      // Parametros - filtro de data vai dentro dos CASE para PERIODO, nao no WHERE
      const params: any = { limitNum: parseInt(limit as string, 10) };

      // Condicoes de data para PERIODO (aplicadas dentro dos CASE, nao no WHERE)
      let periodoDateCondition = '1=1'; // default: todos os registros
      if (dataInicio && dataFim) {
        periodoDateCondition = `TRUNC(p.${cols.pedDtaEmissao}) >= TO_DATE('${dataInicio}', 'YYYY-MM-DD') AND TRUNC(p.${cols.pedDtaEmissao}) <= TO_DATE('${dataFim}', 'YYYY-MM-DD')`;
      } else if (dataInicio) {
        periodoDateCondition = `TRUNC(p.${cols.pedDtaEmissao}) >= TO_DATE('${dataInicio}', 'YYYY-MM-DD')`;
      } else if (dataFim) {
        periodoDateCondition = `TRUNC(p.${cols.pedDtaEmissao}) <= TO_DATE('${dataFim}', 'YYYY-MM-DD')`;
      }

      // Query para ranking de fornecedores baseado em ITENS com ruptura
      // Ruptura = NVL(QTD_RECEBIDA, 0) < QTD_PEDIDO * NVL(QTD_EMBALAGEM, 1)
      // QTD_PEDIDO esta em caixas/embalagens, QTD_EMBALAGEM converte para unidades
      // PERIODO usa filtro de data nos CASE, MES/SEMESTRE/ANO usam ADD_MONTHS independentemente
      const query = `
        SELECT * FROM (
          SELECT
            f.${cols.fornCodFornecedor},
            f.${cols.fornDesFornecedor},
            f.${cols.fornNumCgc},
            -- PERIODO SELECIONADO - Quantidade de pedidos (filtrado por data)
            COUNT(DISTINCT CASE WHEN ${periodoDateCondition} THEN p.${cols.pedNumPedido} END) as PERIODO_PEDIDOS,
            -- PERIODO SELECIONADO - Total de itens (filtrado por data)
            COUNT(CASE WHEN ${periodoDateCondition} THEN 1 END) as PERIODO_TOTAL,
            -- PERIODO SELECIONADO - Itens com ruptura (filtrado por data)
            COUNT(CASE WHEN ${periodoDateCondition} AND NVL(pp.${cols.ppQtdRecebida}, 0) < pp.${cols.ppQtdPedido} * NVL(pp.QTD_EMBALAGEM, 1) THEN 1 END) as PERIODO_RUPTURA,
            -- PERIODO SELECIONADO - Itens OK (filtrado por data)
            COUNT(CASE WHEN ${periodoDateCondition} AND NVL(pp.${cols.ppQtdRecebida}, 0) >= pp.${cols.ppQtdPedido} * NVL(pp.QTD_EMBALAGEM, 1) THEN 1 END) as PERIODO_OK,
            -- PERIODO SELECIONADO - Valor ruptura (filtrado por data)
            SUM(CASE WHEN ${periodoDateCondition} AND NVL(pp.${cols.ppQtdRecebida}, 0) < pp.${cols.ppQtdPedido} * NVL(pp.QTD_EMBALAGEM, 1) THEN (pp.${cols.ppQtdPedido} * NVL(pp.QTD_EMBALAGEM, 1) - NVL(pp.${cols.ppQtdRecebida}, 0)) * (pp.${cols.ppValTabela} / NVL(pp.QTD_EMBALAGEM, 1)) ELSE 0 END) as PERIODO_VALOR,
            -- Ultimo Mes - Quantidade de pedidos
            COUNT(DISTINCT CASE WHEN p.${cols.pedDtaEmissao} >= ADD_MONTHS(TRUNC(SYSDATE), -1) THEN p.${cols.pedNumPedido} END) as MES_PEDIDOS,
            -- Ultimo Mes - Total de itens pedidos
            COUNT(CASE WHEN p.${cols.pedDtaEmissao} >= ADD_MONTHS(TRUNC(SYSDATE), -1) THEN 1 END) as MES_TOTAL,
            -- Ultimo Mes - Itens com ruptura
            COUNT(CASE WHEN p.${cols.pedDtaEmissao} >= ADD_MONTHS(TRUNC(SYSDATE), -1) AND NVL(pp.${cols.ppQtdRecebida}, 0) < pp.${cols.ppQtdPedido} * NVL(pp.QTD_EMBALAGEM, 1) THEN 1 END) as MES_RUPTURA,
            -- Ultimo Mes - Itens OK
            COUNT(CASE WHEN p.${cols.pedDtaEmissao} >= ADD_MONTHS(TRUNC(SYSDATE), -1) AND NVL(pp.${cols.ppQtdRecebida}, 0) >= pp.${cols.ppQtdPedido} * NVL(pp.QTD_EMBALAGEM, 1) THEN 1 END) as MES_OK,
            -- Ultimo Mes - Valor ruptura
            SUM(CASE WHEN p.${cols.pedDtaEmissao} >= ADD_MONTHS(TRUNC(SYSDATE), -1) AND NVL(pp.${cols.ppQtdRecebida}, 0) < pp.${cols.ppQtdPedido} * NVL(pp.QTD_EMBALAGEM, 1) THEN (pp.${cols.ppQtdPedido} * NVL(pp.QTD_EMBALAGEM, 1) - NVL(pp.${cols.ppQtdRecebida}, 0)) * (pp.${cols.ppValTabela} / NVL(pp.QTD_EMBALAGEM, 1)) ELSE 0 END) as MES_VALOR,
            -- Ultimos 6 Meses - Quantidade de pedidos
            COUNT(DISTINCT CASE WHEN p.${cols.pedDtaEmissao} >= ADD_MONTHS(TRUNC(SYSDATE), -6) THEN p.${cols.pedNumPedido} END) as SEMESTRE_PEDIDOS,
            -- Ultimos 6 Meses - Total de itens
            COUNT(CASE WHEN p.${cols.pedDtaEmissao} >= ADD_MONTHS(TRUNC(SYSDATE), -6) THEN 1 END) as SEMESTRE_TOTAL,
            -- Ultimos 6 Meses - Itens com ruptura
            COUNT(CASE WHEN p.${cols.pedDtaEmissao} >= ADD_MONTHS(TRUNC(SYSDATE), -6) AND NVL(pp.${cols.ppQtdRecebida}, 0) < pp.${cols.ppQtdPedido} * NVL(pp.QTD_EMBALAGEM, 1) THEN 1 END) as SEMESTRE_RUPTURA,
            -- Ultimos 6 Meses - Itens OK
            COUNT(CASE WHEN p.${cols.pedDtaEmissao} >= ADD_MONTHS(TRUNC(SYSDATE), -6) AND NVL(pp.${cols.ppQtdRecebida}, 0) >= pp.${cols.ppQtdPedido} * NVL(pp.QTD_EMBALAGEM, 1) THEN 1 END) as SEMESTRE_OK,
            -- Ultimos 6 Meses - Valor ruptura
            SUM(CASE WHEN p.${cols.pedDtaEmissao} >= ADD_MONTHS(TRUNC(SYSDATE), -6) AND NVL(pp.${cols.ppQtdRecebida}, 0) < pp.${cols.ppQtdPedido} * NVL(pp.QTD_EMBALAGEM, 1) THEN (pp.${cols.ppQtdPedido} * NVL(pp.QTD_EMBALAGEM, 1) - NVL(pp.${cols.ppQtdRecebida}, 0)) * (pp.${cols.ppValTabela} / NVL(pp.QTD_EMBALAGEM, 1)) ELSE 0 END) as SEMESTRE_VALOR,
            -- Ultimo Ano - Quantidade de pedidos
            COUNT(DISTINCT CASE WHEN p.${cols.pedDtaEmissao} >= ADD_MONTHS(TRUNC(SYSDATE), -12) THEN p.${cols.pedNumPedido} END) as ANO_PEDIDOS,
            -- Ultimo Ano - Total de itens pedidos
            COUNT(CASE WHEN p.${cols.pedDtaEmissao} >= ADD_MONTHS(TRUNC(SYSDATE), -12) THEN 1 END) as ANO_TOTAL,
            -- Ultimo Ano - Itens com ruptura (nao chegaram ou chegaram incompletos)
            COUNT(CASE WHEN p.${cols.pedDtaEmissao} >= ADD_MONTHS(TRUNC(SYSDATE), -12) AND NVL(pp.${cols.ppQtdRecebida}, 0) < pp.${cols.ppQtdPedido} * NVL(pp.QTD_EMBALAGEM, 1) THEN 1 END) as ANO_RUPTURA,
            -- Ultimo Ano - Itens OK (chegaram completos)
            COUNT(CASE WHEN p.${cols.pedDtaEmissao} >= ADD_MONTHS(TRUNC(SYSDATE), -12) AND NVL(pp.${cols.ppQtdRecebida}, 0) >= pp.${cols.ppQtdPedido} * NVL(pp.QTD_EMBALAGEM, 1) THEN 1 END) as ANO_OK,
            -- Ultimo Ano - Valor ruptura
            SUM(CASE WHEN p.${cols.pedDtaEmissao} >= ADD_MONTHS(TRUNC(SYSDATE), -12) AND NVL(pp.${cols.ppQtdRecebida}, 0) < pp.${cols.ppQtdPedido} * NVL(pp.QTD_EMBALAGEM, 1) THEN (pp.${cols.ppQtdPedido} * NVL(pp.QTD_EMBALAGEM, 1) - NVL(pp.${cols.ppQtdRecebida}, 0)) * (pp.${cols.ppValTabela} / NVL(pp.QTD_EMBALAGEM, 1)) ELSE 0 END) as ANO_VALOR,
            -- Total geral de itens com ruptura (ultimo ano para ordenacao)
            COUNT(CASE WHEN p.${cols.pedDtaEmissao} >= ADD_MONTHS(TRUNC(SYSDATE), -12) AND NVL(pp.${cols.ppQtdRecebida}, 0) < pp.${cols.ppQtdPedido} * NVL(pp.QTD_EMBALAGEM, 1) THEN 1 END) as QTD_ITENS_RUPTURA,
            -- Quantidade total faltante (ultimo ano)
            SUM(CASE WHEN p.${cols.pedDtaEmissao} >= ADD_MONTHS(TRUNC(SYSDATE), -12) AND NVL(pp.${cols.ppQtdRecebida}, 0) < pp.${cols.ppQtdPedido} * NVL(pp.QTD_EMBALAGEM, 1) THEN pp.${cols.ppQtdPedido} * NVL(pp.QTD_EMBALAGEM, 1) - NVL(pp.${cols.ppQtdRecebida}, 0) ELSE 0 END) as QTD_FALTANTE,
            -- Valor total nao faturado (ultimo ano)
            SUM(CASE WHEN p.${cols.pedDtaEmissao} >= ADD_MONTHS(TRUNC(SYSDATE), -12) AND NVL(pp.${cols.ppQtdRecebida}, 0) < pp.${cols.ppQtdPedido} * NVL(pp.QTD_EMBALAGEM, 1) THEN (pp.${cols.ppQtdPedido} * NVL(pp.QTD_EMBALAGEM, 1) - NVL(pp.${cols.ppQtdRecebida}, 0)) * (pp.${cols.ppValTabela} / NVL(pp.QTD_EMBALAGEM, 1)) ELSE 0 END) as VALOR_NAO_FATURADO,
            -- Ultima ruptura
            MAX(CASE WHEN NVL(pp.${cols.ppQtdRecebida}, 0) < pp.${cols.ppQtdPedido} * NVL(pp.QTD_EMBALAGEM, 1) THEN p.${cols.pedDtaEmissao} END) as ULTIMA_RUPTURA,
            -- Produtos distintos afetados (ultimo ano)
            COUNT(DISTINCT CASE WHEN p.${cols.pedDtaEmissao} >= ADD_MONTHS(TRUNC(SYSDATE), -12) AND NVL(pp.${cols.ppQtdRecebida}, 0) < pp.${cols.ppQtdPedido} * NVL(pp.QTD_EMBALAGEM, 1) THEN pp.${cols.ppCodProduto} END) as QTD_PRODUTOS_AFETADOS
          FROM ${tables.pedido} p
          INNER JOIN ${tables.fornecedor} f ON f.${cols.fornCodFornecedor} = p.${cols.pedCodParceiro}
          INNER JOIN ${tables.pedidoProduto} pp ON pp.${cols.ppNumPedido} = p.${cols.pedNumPedido}
          WHERE p.${cols.pedTipoParceiro} = 1
          AND p.${cols.pedTipoRecebimento} = 3
          AND p.${cols.pedDtaEmissao} >= ADD_MONTHS(TRUNC(SYSDATE), -12)
          GROUP BY f.${cols.fornCodFornecedor}, f.${cols.fornDesFornecedor}, f.${cols.fornNumCgc}
          HAVING COUNT(CASE WHEN p.${cols.pedDtaEmissao} >= ADD_MONTHS(TRUNC(SYSDATE), -12) AND NVL(pp.${cols.ppQtdRecebida}, 0) < pp.${cols.ppQtdPedido} * NVL(pp.QTD_EMBALAGEM, 1) THEN 1 END) > 0
          ORDER BY COUNT(CASE WHEN p.${cols.pedDtaEmissao} >= ADD_MONTHS(TRUNC(SYSDATE), -12) AND NVL(pp.${cols.ppQtdRecebida}, 0) < pp.${cols.ppQtdPedido} * NVL(pp.QTD_EMBALAGEM, 1) THEN 1 END) DESC
        ) WHERE ROWNUM <= :limitNum
      `;

      const fornecedores = await OracleService.query(query, params);

      // Query para estatisticas gerais baseada em ITENS
      // Filtra apenas pedidos cancelados/finalizados (TIPO_RECEBIMENTO = 3)
      // Usa o periodo selecionado dentro dos CASE
      // QTD_PEDIDO * QTD_EMBALAGEM converte caixas para unidades
      const statsQuery = `
        SELECT
          COUNT(CASE WHEN ${periodoDateCondition} AND NVL(pp.${cols.ppQtdRecebida}, 0) < pp.${cols.ppQtdPedido} * NVL(pp.QTD_EMBALAGEM, 1) THEN 1 END) as TOTAL_ITENS_RUPTURA,
          COUNT(DISTINCT CASE WHEN ${periodoDateCondition} AND NVL(pp.${cols.ppQtdRecebida}, 0) < pp.${cols.ppQtdPedido} * NVL(pp.QTD_EMBALAGEM, 1) THEN p.${cols.pedCodParceiro} END) as TOTAL_FORNECEDORES_AFETADOS,
          SUM(CASE WHEN ${periodoDateCondition} AND NVL(pp.${cols.ppQtdRecebida}, 0) < pp.${cols.ppQtdPedido} * NVL(pp.QTD_EMBALAGEM, 1) THEN (pp.${cols.ppQtdPedido} * NVL(pp.QTD_EMBALAGEM, 1) - NVL(pp.${cols.ppQtdRecebida}, 0)) * (pp.${cols.ppValTabela} / NVL(pp.QTD_EMBALAGEM, 1)) ELSE 0 END) as VALOR_NAO_FATURADO,
          SUM(CASE WHEN ${periodoDateCondition} AND NVL(pp.${cols.ppQtdRecebida}, 0) > pp.${cols.ppQtdPedido} * NVL(pp.QTD_EMBALAGEM, 1) THEN (NVL(pp.${cols.ppQtdRecebida}, 0) - pp.${cols.ppQtdPedido} * NVL(pp.QTD_EMBALAGEM, 1)) * (pp.${cols.ppValTabela} / NVL(pp.QTD_EMBALAGEM, 1)) ELSE 0 END) as VALOR_EXCESSO,
          COUNT(DISTINCT CASE WHEN ${periodoDateCondition} AND NVL(pp.${cols.ppQtdRecebida}, 0) < pp.${cols.ppQtdPedido} * NVL(pp.QTD_EMBALAGEM, 1) THEN pp.${cols.ppCodProduto} END) as TOTAL_PRODUTOS_AFETADOS
        FROM ${tables.pedido} p
        INNER JOIN ${tables.pedidoProduto} pp ON pp.${cols.ppNumPedido} = p.${cols.pedNumPedido}
        WHERE p.${cols.pedTipoParceiro} = 1
        AND p.${cols.pedTipoRecebimento} = 3
        AND p.${cols.pedDtaEmissao} >= ADD_MONTHS(TRUNC(SYSDATE), -12)
      `;

      const statsResult = await OracleService.query(statsQuery, {});
      const stats = statsResult[0] || {
        TOTAL_ITENS_RUPTURA: 0,
        TOTAL_FORNECEDORES_AFETADOS: 0,
        VALOR_NAO_FATURADO: 0,
        VALOR_EXCESSO: 0,
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
   * Produtos com ruptura de um fornecedor especifico
   * Ruptura = itens onde QTD_RECEBIDA < QTD_PEDIDO
   * Com estatisticas por periodo (ultimo ano, 6 meses, ultimo mes)
   */
  static async produtosFornecedor(req: AuthRequest, res: Response) {
    console.log('=== INICIO produtosFornecedor ===');

    try {
      const { codFornecedor } = req.params;
      const { dataInicio, dataFim } = req.query;
      console.log('codFornecedor:', codFornecedor, 'tipo:', typeof codFornecedor);
      console.log('dataInicio:', dataInicio, 'dataFim:', dataFim);

      // Obter nomes de tabelas e colunas dinamicos do MappingService
      const tables = await getTableNames();
      const cols = await getRupturaMappings();

      const codFornecedorNum = parseInt(codFornecedor, 10);
      console.log('codFornecedorNum:', codFornecedorNum);

      // Condicao de data para PERIODO (periodo selecionado pelo usuario)
      let periodoDateCondition = '1=1'; // default: todos os registros
      if (dataInicio && dataFim) {
        periodoDateCondition = `TRUNC(p.${cols.pedDtaEmissao}) >= TO_DATE('${dataInicio}', 'YYYY-MM-DD') AND TRUNC(p.${cols.pedDtaEmissao}) <= TO_DATE('${dataFim}', 'YYYY-MM-DD')`;
      } else if (dataInicio) {
        periodoDateCondition = `TRUNC(p.${cols.pedDtaEmissao}) >= TO_DATE('${dataInicio}', 'YYYY-MM-DD')`;
      } else if (dataFim) {
        periodoDateCondition = `TRUNC(p.${cols.pedDtaEmissao}) <= TO_DATE('${dataFim}', 'YYYY-MM-DD')`;
      }

      // Query para produtos com ruptura do fornecedor
      // Ruptura = NVL(QTD_RECEBIDA, 0) < QTD_PEDIDO * NVL(QTD_EMBALAGEM, 1)
      // QTD_PEDIDO esta em caixas/embalagens, QTD_EMBALAGEM converte para unidades
      // Inclui metricas por periodo: ANO, SEMESTRE, MES e TOTAL (periodo selecionado)
      // Colunas: Pedidos Feitos, Pedidos Cortados, Qtd Cortada, Valor por periodo
      const query = `
        SELECT * FROM (
          SELECT
            pp.${cols.ppCodProduto},
            pr.${cols.prDesProduto},
            -- Curva do produto (loja matriz = 1)
            NVL(TRIM(pl.${cols.plCurva}), 'X') as CURVA,
            -- Produto fora do mix (inativo)
            NVL(pl.FORA_LINHA, 'N') as FORA_LINHA,
            -- ===== PERIODO SELECIONADO (TOTAL_) =====
            COUNT(DISTINCT CASE WHEN ${periodoDateCondition} THEN p.${cols.pedNumPedido} END) as TOTAL_PEDIDOS_FEITOS,
            COUNT(DISTINCT CASE WHEN ${periodoDateCondition} AND NVL(pp.${cols.ppQtdRecebida}, 0) < pp.${cols.ppQtdPedido} * NVL(pp.QTD_EMBALAGEM, 1) THEN p.${cols.pedNumPedido} END) as TOTAL_PEDIDOS_CORTADOS,
            SUM(CASE WHEN ${periodoDateCondition} THEN pp.${cols.ppQtdPedido} * NVL(pp.QTD_EMBALAGEM, 1) ELSE 0 END) as TOTAL_QTD_PEDIDA,
            SUM(CASE WHEN ${periodoDateCondition} THEN NVL(pp.${cols.ppQtdRecebida}, 0) ELSE 0 END) as TOTAL_QTD_ENTREGUE,
            SUM(CASE WHEN ${periodoDateCondition} AND NVL(pp.${cols.ppQtdRecebida}, 0) < pp.${cols.ppQtdPedido} * NVL(pp.QTD_EMBALAGEM, 1) THEN pp.${cols.ppQtdPedido} * NVL(pp.QTD_EMBALAGEM, 1) - NVL(pp.${cols.ppQtdRecebida}, 0) ELSE 0 END) as TOTAL_QTD_CORTADA,
            SUM(CASE WHEN ${periodoDateCondition} AND NVL(pp.${cols.ppQtdRecebida}, 0) < pp.${cols.ppQtdPedido} * NVL(pp.QTD_EMBALAGEM, 1) THEN (pp.${cols.ppQtdPedido} * NVL(pp.QTD_EMBALAGEM, 1) - NVL(pp.${cols.ppQtdRecebida}, 0)) * (pp.${cols.ppValTabela} / NVL(pp.QTD_EMBALAGEM, 1)) ELSE 0 END) as TOTAL_VALOR,
            -- ===== ULTIMO ANO =====
            COUNT(DISTINCT CASE WHEN p.${cols.pedDtaEmissao} >= ADD_MONTHS(TRUNC(SYSDATE), -12) THEN p.${cols.pedNumPedido} END) as ANO_PEDIDOS_FEITOS,
            COUNT(DISTINCT CASE WHEN p.${cols.pedDtaEmissao} >= ADD_MONTHS(TRUNC(SYSDATE), -12) AND NVL(pp.${cols.ppQtdRecebida}, 0) < pp.${cols.ppQtdPedido} * NVL(pp.QTD_EMBALAGEM, 1) THEN p.${cols.pedNumPedido} END) as ANO_PEDIDOS_CORTADOS,
            SUM(CASE WHEN p.${cols.pedDtaEmissao} >= ADD_MONTHS(TRUNC(SYSDATE), -12) THEN pp.${cols.ppQtdPedido} * NVL(pp.QTD_EMBALAGEM, 1) ELSE 0 END) as ANO_QTD_PEDIDA,
            SUM(CASE WHEN p.${cols.pedDtaEmissao} >= ADD_MONTHS(TRUNC(SYSDATE), -12) THEN NVL(pp.${cols.ppQtdRecebida}, 0) ELSE 0 END) as ANO_QTD_ENTREGUE,
            SUM(CASE WHEN p.${cols.pedDtaEmissao} >= ADD_MONTHS(TRUNC(SYSDATE), -12) AND NVL(pp.${cols.ppQtdRecebida}, 0) < pp.${cols.ppQtdPedido} * NVL(pp.QTD_EMBALAGEM, 1) THEN pp.${cols.ppQtdPedido} * NVL(pp.QTD_EMBALAGEM, 1) - NVL(pp.${cols.ppQtdRecebida}, 0) ELSE 0 END) as ANO_QTD_CORTADA,
            SUM(CASE WHEN p.${cols.pedDtaEmissao} >= ADD_MONTHS(TRUNC(SYSDATE), -12) AND NVL(pp.${cols.ppQtdRecebida}, 0) < pp.${cols.ppQtdPedido} * NVL(pp.QTD_EMBALAGEM, 1) THEN (pp.${cols.ppQtdPedido} * NVL(pp.QTD_EMBALAGEM, 1) - NVL(pp.${cols.ppQtdRecebida}, 0)) * (pp.${cols.ppValTabela} / NVL(pp.QTD_EMBALAGEM, 1)) ELSE 0 END) as ANO_VALOR,
            -- ===== ULTIMOS 6 MESES =====
            COUNT(DISTINCT CASE WHEN p.${cols.pedDtaEmissao} >= ADD_MONTHS(TRUNC(SYSDATE), -6) THEN p.${cols.pedNumPedido} END) as SEMESTRE_PEDIDOS_FEITOS,
            COUNT(DISTINCT CASE WHEN p.${cols.pedDtaEmissao} >= ADD_MONTHS(TRUNC(SYSDATE), -6) AND NVL(pp.${cols.ppQtdRecebida}, 0) < pp.${cols.ppQtdPedido} * NVL(pp.QTD_EMBALAGEM, 1) THEN p.${cols.pedNumPedido} END) as SEMESTRE_PEDIDOS_CORTADOS,
            SUM(CASE WHEN p.${cols.pedDtaEmissao} >= ADD_MONTHS(TRUNC(SYSDATE), -6) THEN pp.${cols.ppQtdPedido} * NVL(pp.QTD_EMBALAGEM, 1) ELSE 0 END) as SEMESTRE_QTD_PEDIDA,
            SUM(CASE WHEN p.${cols.pedDtaEmissao} >= ADD_MONTHS(TRUNC(SYSDATE), -6) THEN NVL(pp.${cols.ppQtdRecebida}, 0) ELSE 0 END) as SEMESTRE_QTD_ENTREGUE,
            SUM(CASE WHEN p.${cols.pedDtaEmissao} >= ADD_MONTHS(TRUNC(SYSDATE), -6) AND NVL(pp.${cols.ppQtdRecebida}, 0) < pp.${cols.ppQtdPedido} * NVL(pp.QTD_EMBALAGEM, 1) THEN pp.${cols.ppQtdPedido} * NVL(pp.QTD_EMBALAGEM, 1) - NVL(pp.${cols.ppQtdRecebida}, 0) ELSE 0 END) as SEMESTRE_QTD_CORTADA,
            SUM(CASE WHEN p.${cols.pedDtaEmissao} >= ADD_MONTHS(TRUNC(SYSDATE), -6) AND NVL(pp.${cols.ppQtdRecebida}, 0) < pp.${cols.ppQtdPedido} * NVL(pp.QTD_EMBALAGEM, 1) THEN (pp.${cols.ppQtdPedido} * NVL(pp.QTD_EMBALAGEM, 1) - NVL(pp.${cols.ppQtdRecebida}, 0)) * (pp.${cols.ppValTabela} / NVL(pp.QTD_EMBALAGEM, 1)) ELSE 0 END) as SEMESTRE_VALOR,
            -- ===== ULTIMO MES =====
            COUNT(DISTINCT CASE WHEN p.${cols.pedDtaEmissao} >= ADD_MONTHS(TRUNC(SYSDATE), -1) THEN p.${cols.pedNumPedido} END) as MES_PEDIDOS_FEITOS,
            COUNT(DISTINCT CASE WHEN p.${cols.pedDtaEmissao} >= ADD_MONTHS(TRUNC(SYSDATE), -1) AND NVL(pp.${cols.ppQtdRecebida}, 0) < pp.${cols.ppQtdPedido} * NVL(pp.QTD_EMBALAGEM, 1) THEN p.${cols.pedNumPedido} END) as MES_PEDIDOS_CORTADOS,
            SUM(CASE WHEN p.${cols.pedDtaEmissao} >= ADD_MONTHS(TRUNC(SYSDATE), -1) THEN pp.${cols.ppQtdPedido} * NVL(pp.QTD_EMBALAGEM, 1) ELSE 0 END) as MES_QTD_PEDIDA,
            SUM(CASE WHEN p.${cols.pedDtaEmissao} >= ADD_MONTHS(TRUNC(SYSDATE), -1) THEN NVL(pp.${cols.ppQtdRecebida}, 0) ELSE 0 END) as MES_QTD_ENTREGUE,
            SUM(CASE WHEN p.${cols.pedDtaEmissao} >= ADD_MONTHS(TRUNC(SYSDATE), -1) AND NVL(pp.${cols.ppQtdRecebida}, 0) < pp.${cols.ppQtdPedido} * NVL(pp.QTD_EMBALAGEM, 1) THEN pp.${cols.ppQtdPedido} * NVL(pp.QTD_EMBALAGEM, 1) - NVL(pp.${cols.ppQtdRecebida}, 0) ELSE 0 END) as MES_QTD_CORTADA,
            SUM(CASE WHEN p.${cols.pedDtaEmissao} >= ADD_MONTHS(TRUNC(SYSDATE), -1) AND NVL(pp.${cols.ppQtdRecebida}, 0) < pp.${cols.ppQtdPedido} * NVL(pp.QTD_EMBALAGEM, 1) THEN (pp.${cols.ppQtdPedido} * NVL(pp.QTD_EMBALAGEM, 1) - NVL(pp.${cols.ppQtdRecebida}, 0)) * (pp.${cols.ppValTabela} / NVL(pp.QTD_EMBALAGEM, 1)) ELSE 0 END) as MES_VALOR,
            -- Legado (manter compatibilidade)
            COUNT(CASE WHEN NVL(pp.${cols.ppQtdRecebida}, 0) < pp.${cols.ppQtdPedido} * NVL(pp.QTD_EMBALAGEM, 1) THEN 1 END) as TOTAL_RUPTURA,
            COUNT(CASE WHEN p.${cols.pedDtaEmissao} >= ADD_MONTHS(TRUNC(SYSDATE), -12) AND NVL(pp.${cols.ppQtdRecebida}, 0) < pp.${cols.ppQtdPedido} * NVL(pp.QTD_EMBALAGEM, 1) THEN 1 END) as ANO_RUPTURA,
            COUNT(CASE WHEN p.${cols.pedDtaEmissao} >= ADD_MONTHS(TRUNC(SYSDATE), -6) AND NVL(pp.${cols.ppQtdRecebida}, 0) < pp.${cols.ppQtdPedido} * NVL(pp.QTD_EMBALAGEM, 1) THEN 1 END) as SEMESTRE_RUPTURA,
            COUNT(CASE WHEN p.${cols.pedDtaEmissao} >= ADD_MONTHS(TRUNC(SYSDATE), -1) AND NVL(pp.${cols.ppQtdRecebida}, 0) < pp.${cols.ppQtdPedido} * NVL(pp.QTD_EMBALAGEM, 1) THEN 1 END) as MES_RUPTURA,
            SUM(CASE WHEN NVL(pp.${cols.ppQtdRecebida}, 0) < pp.${cols.ppQtdPedido} * NVL(pp.QTD_EMBALAGEM, 1) THEN pp.${cols.ppQtdPedido} * NVL(pp.QTD_EMBALAGEM, 1) - NVL(pp.${cols.ppQtdRecebida}, 0) ELSE 0 END) as QTD_FALTANTE,
            SUM(CASE WHEN NVL(pp.${cols.ppQtdRecebida}, 0) < pp.${cols.ppQtdPedido} * NVL(pp.QTD_EMBALAGEM, 1) THEN (pp.${cols.ppQtdPedido} * NVL(pp.QTD_EMBALAGEM, 1) - NVL(pp.${cols.ppQtdRecebida}, 0)) * (pp.${cols.ppValTabela} / NVL(pp.QTD_EMBALAGEM, 1)) ELSE 0 END) as VALOR_NAO_FATURADO,
            -- Flag: tem outros fornecedores que vendem esse produto?
            (SELECT COUNT(DISTINCT p2.${cols.pedCodParceiro})
             FROM ${tables.pedido} p2
             INNER JOIN ${tables.pedidoProduto} pp2 ON pp2.${cols.ppNumPedido} = p2.${cols.pedNumPedido}
             WHERE p2.${cols.pedTipoParceiro} = 1
             AND p2.${cols.pedTipoRecebimento} = 3
             AND pp2.${cols.ppCodProduto} = pp.${cols.ppCodProduto}
             AND p2.${cols.pedCodParceiro} != :codFornecedor
             AND p2.${cols.pedDtaEmissao} >= ADD_MONTHS(TRUNC(SYSDATE), -12)
             AND NVL(pp2.${cols.ppQtdRecebida}, 0) > 0
            ) as QTD_OUTROS_FORNECEDORES
          FROM ${tables.pedido} p
          INNER JOIN ${tables.pedidoProduto} pp ON pp.${cols.ppNumPedido} = p.${cols.pedNumPedido}
          LEFT JOIN ${tables.produto} pr ON pr.${cols.prCodProduto} = pp.${cols.ppCodProduto}
          LEFT JOIN ${tables.produtoLoja} pl ON pl.${cols.plCodProduto} = pp.${cols.ppCodProduto} AND pl.${cols.plCodLoja} = 1
          WHERE p.${cols.pedTipoParceiro} = 1
          AND p.${cols.pedTipoRecebimento} = 3
          AND p.${cols.pedCodParceiro} = :codFornecedor
          GROUP BY pp.${cols.ppCodProduto}, pr.${cols.prDesProduto}, NVL(TRIM(pl.${cols.plCurva}), 'X'), NVL(pl.FORA_LINHA, 'N')
          HAVING COUNT(CASE WHEN NVL(pp.${cols.ppQtdRecebida}, 0) < pp.${cols.ppQtdPedido} * NVL(pp.QTD_EMBALAGEM, 1) THEN 1 END) > 0
          ORDER BY
            -- Ordenar por % de ruptura no periodo selecionado (maior para menor)
            CASE
              WHEN SUM(CASE WHEN ${periodoDateCondition} THEN pp.${cols.ppQtdPedido} * NVL(pp.QTD_EMBALAGEM, 1) ELSE 0 END) > 0
              THEN SUM(CASE WHEN ${periodoDateCondition} AND NVL(pp.${cols.ppQtdRecebida}, 0) < pp.${cols.ppQtdPedido} * NVL(pp.QTD_EMBALAGEM, 1) THEN pp.${cols.ppQtdPedido} * NVL(pp.QTD_EMBALAGEM, 1) - NVL(pp.${cols.ppQtdRecebida}, 0) ELSE 0 END)
                   / SUM(CASE WHEN ${periodoDateCondition} THEN pp.${cols.ppQtdPedido} * NVL(pp.QTD_EMBALAGEM, 1) ELSE 0 END)
              ELSE 0
            END DESC,
            -- Desempate: maior quantidade cortada no periodo
            SUM(CASE WHEN ${periodoDateCondition} AND NVL(pp.${cols.ppQtdRecebida}, 0) < pp.${cols.ppQtdPedido} * NVL(pp.QTD_EMBALAGEM, 1) THEN pp.${cols.ppQtdPedido} * NVL(pp.QTD_EMBALAGEM, 1) - NVL(pp.${cols.ppQtdRecebida}, 0) ELSE 0 END) DESC
        ) WHERE ROWNUM <= 100
      `;

      console.log('Executando query...');
      const produtos = await OracleService.query(query, { codFornecedor: codFornecedorNum });
      console.log('Produtos encontrados:', produtos.length);

      // Buscar dados do fornecedor
      const fornecedorQuery = `
        SELECT ${cols.fornCodFornecedor}, ${cols.fornDesFornecedor}, ${cols.fornNumCgc}
        FROM ${tables.fornecedor}
        WHERE ${cols.fornCodFornecedor} = :codFornecedor
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
   * Historico de cancelamentos de um produto especifico
   */
  static async historicoProduto(req: AuthRequest, res: Response) {
    try {
      const { codProduto } = req.params;
      const { codFornecedor, dataInicio, dataFim } = req.query;

      // Obter nomes de tabelas e colunas dinamicos do MappingService
      const tables = await getTableNames();
      const cols = await getRupturaMappings();

      const conditions: string[] = [
        `p.${cols.pedTipoParceiro} = 1`,
        `p.${cols.pedTipoRecebimento} = 3`,
        `pp.${cols.ppCodProduto} = :codProduto`
      ];
      const params: any = { codProduto: parseInt(codProduto, 10) };

      if (codFornecedor) {
        conditions.push(`p.${cols.pedCodParceiro} = :codFornecedor`);
        params.codFornecedor = parseInt(codFornecedor as string, 10);
      }

      if (dataInicio) {
        conditions.push(`TRUNC(p.${cols.pedDtaEmissao}) >= TO_DATE(:dataInicio, 'YYYY-MM-DD')`);
        params.dataInicio = dataInicio;
      }

      if (dataFim) {
        conditions.push(`TRUNC(p.${cols.pedDtaEmissao}) <= TO_DATE(:dataFim, 'YYYY-MM-DD')`);
        params.dataFim = dataFim;
      }

      const whereClause = `WHERE ${conditions.join(' AND ')}`;

      // Historico detalhado de cada cancelamento
      // DTA_PEDIDO_CANCELADO, DES_CANCELAMENTO, USUARIO - hardcoded (nao estao no TABLE_CATALOG)
      const query = `
        SELECT
          p.${cols.pedNumPedido},
          p.${cols.pedDtaEmissao},
          p.${cols.pedDtaEntrega},
          p.DTA_PEDIDO_CANCELADO,
          p.DES_CANCELAMENTO,
          pp.${cols.ppQtdPedido},
          pp.${cols.ppValTabela},
          pp.${cols.ppQtdPedido} * pp.${cols.ppValTabela} as VALOR_ITEM,
          f.${cols.fornDesFornecedor},
          p.USUARIO
        FROM ${tables.pedido} p
        INNER JOIN ${tables.pedidoProduto} pp ON pp.${cols.ppNumPedido} = p.${cols.pedNumPedido}
        INNER JOIN ${tables.fornecedor} f ON f.${cols.fornCodFornecedor} = p.${cols.pedCodParceiro}
        ${whereClause}
        ORDER BY p.${cols.pedDtaEmissao} DESC
      `;

      const historico = await OracleService.query(query, params);

      // Dados do produto
      const produtoQuery = `
        SELECT
          ${cols.prCodProduto},
          ${cols.prDesProduto},
          ${cols.prDesReduzida}
        FROM ${tables.produto}
        WHERE ${cols.prCodProduto} = :codProduto
      `;

      const produtoResult = await OracleService.query(produtoQuery, { codProduto: parseInt(codProduto, 10) });
      const produto = produtoResult[0] || null;

      res.json({
        produto,
        historico
      });
    } catch (error: any) {
      console.error('Erro ao buscar historico do produto:', error);
      res.status(500).json({ error: 'Erro ao buscar historico do produto', details: error.message });
    }
  }

  /**
   * Top produtos mais cancelados (geral)
   */
  static async topProdutosCancelados(req: AuthRequest, res: Response) {
    try {
      const { dataInicio, dataFim, limit = '20' } = req.query;

      // Obter nomes de tabelas e colunas dinamicos do MappingService
      const tables = await getTableNames();
      const cols = await getRupturaMappings();

      const conditions: string[] = [
        `p.${cols.pedTipoParceiro} = 1`,
        `p.${cols.pedTipoRecebimento} = 3`
      ];
      const params: any = {};

      if (dataInicio) {
        conditions.push(`TRUNC(p.${cols.pedDtaEmissao}) >= TO_DATE(:dataInicio, 'YYYY-MM-DD')`);
        params.dataInicio = dataInicio;
      }

      if (dataFim) {
        conditions.push(`TRUNC(p.${cols.pedDtaEmissao}) <= TO_DATE(:dataFim, 'YYYY-MM-DD')`);
        params.dataFim = dataFim;
      }

      const whereClause = `WHERE ${conditions.join(' AND ')}`;

      const query = `
        SELECT * FROM (
          SELECT
            pp.${cols.ppCodProduto},
            pr.${cols.prDesProduto},
            pr.${cols.prDesReduzida},
            COUNT(DISTINCT p.${cols.pedNumPedido}) as VEZES_CANCELADO,
            COUNT(DISTINCT p.${cols.pedCodParceiro}) as QTD_FORNECEDORES,
            SUM(pp.${cols.ppQtdPedido}) as QTD_TOTAL_CANCELADA,
            SUM(pp.${cols.ppQtdPedido} * pp.${cols.ppValTabela}) as VALOR_TOTAL_CANCELADO,
            MAX(p.${cols.pedDtaEmissao}) as ULTIMO_CANCELAMENTO
          FROM ${tables.pedido} p
          INNER JOIN ${tables.pedidoProduto} pp ON pp.${cols.ppNumPedido} = p.${cols.pedNumPedido}
          LEFT JOIN ${tables.produto} pr ON pr.${cols.prCodProduto} = pp.${cols.ppCodProduto}
          ${whereClause}
          GROUP BY pp.${cols.ppCodProduto}, pr.${cols.prDesProduto}, pr.${cols.prDesReduzida}
          ORDER BY COUNT(DISTINCT p.${cols.pedNumPedido}) DESC
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
   * Evolucao mensal de cancelamentos
   */
  static async evolucaoMensal(req: AuthRequest, res: Response) {
    try {
      const { meses = '12' } = req.query;

      // Obter nomes de tabelas e colunas dinamicos do MappingService
      const tables = await getTableNames();
      const cols = await getRupturaMappings();

      const query = `
        SELECT
          TO_CHAR(p.${cols.pedDtaEmissao}, 'YYYY-MM') as MES,
          COUNT(DISTINCT p.${cols.pedNumPedido}) as QTD_PEDIDOS,
          COUNT(DISTINCT p.${cols.pedCodParceiro}) as QTD_FORNECEDORES,
          SUM(p.${cols.pedValPedido}) as VALOR_TOTAL
        FROM ${tables.pedido} p
        WHERE p.${cols.pedTipoParceiro} = 1
        AND p.${cols.pedTipoRecebimento} = 3
        AND p.${cols.pedDtaEmissao} >= ADD_MONTHS(TRUNC(SYSDATE, 'MM'), -:meses)
        GROUP BY TO_CHAR(p.${cols.pedDtaEmissao}, 'YYYY-MM')
        ORDER BY TO_CHAR(p.${cols.pedDtaEmissao}, 'YYYY-MM') ASC
      `;

      const evolucao = await OracleService.query(query, {
        meses: parseInt(meses as string, 10)
      });

      res.json({ evolucao });
    } catch (error: any) {
      console.error('Erro ao buscar evolucao mensal:', error);
      res.status(500).json({ error: 'Erro ao buscar evolucao mensal', details: error.message });
    }
  }

  /**
   * Historico de compras de um produto (todos os fornecedores)
   * Para mostrar alternativas de fornecedores
   */
  static async historicoComprasProduto(req: AuthRequest, res: Response) {
    try {
      const { codProduto } = req.params;
      const { codFornecedorAtual } = req.query;

      // Obter nomes de tabelas e colunas dinamicos do MappingService
      const tables = await getTableNames();
      const cols = await getRupturaMappings();

      const codProdutoNum = parseInt(codProduto, 10);
      const codFornecedorAtualNum = codFornecedorAtual ? parseInt(codFornecedorAtual as string, 10) : null;

      // Buscar historico de compras desse produto de todos os fornecedores
      // Usando TAB_NF (notas fiscais) e TAB_NF_ITEM (itens) - mesma fonte da tela de Pontuacao
      // VAL_CUSTO_SCRED = custo de reposicao unitario correto
      // TIPO_OPERACAO = 0 e entrada (compra)
      const query = `
        SELECT * FROM (
          SELECT
            nf.${cols.nfDtaEntrada} as DATA,
            TRUNC(SYSDATE) - TRUNC(nf.${cols.nfDtaEntrada}) as DIAS,
            f.${cols.fornDesFornecedor} as FORNECEDOR,
            f.${cols.fornCodFornecedor},
            ni.${cols.niQtdEntrada} as QTD,
            NVL(ni.${cols.niValCustoScred}, 0) as CUSTO_REP,
            ni.${cols.niValTotal} as TOTAL,
            nf.${cols.nfNumNf} as NF
          FROM ${tables.nf} nf
          INNER JOIN ${tables.nfItem} ni ON nf.${cols.nfNumNf} = ni.${cols.niNumNf}
            AND nf.${cols.nfNumSerieNf} = ni.${cols.niNumSerieNf}
            AND nf.${cols.nfCodParceiro} = ni.${cols.niCodParceiro}
          LEFT JOIN ${tables.fornecedor} f ON nf.${cols.nfCodParceiro} = f.${cols.fornCodFornecedor}
          WHERE ni.${cols.niCodItem} = :codProduto
          AND nf.${cols.nfTipoOperacao} = 0
          ORDER BY nf.${cols.nfDtaEntrada} DESC
        ) WHERE ROWNUM <= 50
      `;

      const historico = await OracleService.query(query, { codProduto: codProdutoNum });

      // Dados do produto
      const produtoQuery = `
        SELECT ${cols.prCodProduto}, ${cols.prDesProduto}
        FROM ${tables.produto}
        WHERE ${cols.prCodProduto} = :codProduto
      `;
      const produtoResult = await OracleService.query(produtoQuery, { codProduto: codProdutoNum });
      const produto = produtoResult[0] || null;

      // Verificar se tem fornecedores diferentes do atual
      const temOutrosFornecedores = codFornecedorAtualNum
        ? historico.some((h: any) => h.COD_FORNECEDOR !== codFornecedorAtualNum)
        : historico.length > 0;

      res.json({
        produto,
        historico,
        temOutrosFornecedores
      });
    } catch (error: any) {
      console.error('Erro ao buscar historico de compras do produto:', error);
      res.status(500).json({ error: 'Erro ao buscar historico de compras', details: error.message });
    }
  }

  /**
   * Pedidos detalhados de um produto de um fornecedor
   * Mostra cada pedido individual com data, qtd pedida, qtd entregue, qtd cortada
   */
  static async pedidosProduto(req: AuthRequest, res: Response) {
    try {
      const { codProduto } = req.params;
      const { codFornecedor } = req.query;

      // Obter nomes de tabelas e colunas dinamicos do MappingService
      const tables = await getTableNames();
      const cols = await getRupturaMappings();

      const codProdutoNum = parseInt(codProduto, 10);
      const codFornecedorNum = codFornecedor ? parseInt(codFornecedor as string, 10) : null;

      // Query para buscar todos os pedidos do produto com o fornecedor
      // QTD_PEDIDO * QTD_EMBALAGEM converte caixas para unidades
      // QTD_EMBALAGEM - hardcoded (nao esta no TABLE_CATALOG)
      const query = `
        SELECT * FROM (
          SELECT
            p.${cols.pedNumPedido},
            p.${cols.pedDtaEmissao} as DATA,
            TRUNC(SYSDATE) - TRUNC(p.${cols.pedDtaEmissao}) as DIAS,
            pp.${cols.ppQtdPedido} * NVL(pp.QTD_EMBALAGEM, 1) as QTD_PEDIDA,
            NVL(pp.${cols.ppQtdRecebida}, 0) as QTD_ENTREGUE,
            CASE
              WHEN NVL(pp.${cols.ppQtdRecebida}, 0) < pp.${cols.ppQtdPedido} * NVL(pp.QTD_EMBALAGEM, 1)
              THEN pp.${cols.ppQtdPedido} * NVL(pp.QTD_EMBALAGEM, 1) - NVL(pp.${cols.ppQtdRecebida}, 0)
              ELSE 0
            END as QTD_CORTADA,
            CASE
              WHEN NVL(pp.${cols.ppQtdRecebida}, 0) > pp.${cols.ppQtdPedido} * NVL(pp.QTD_EMBALAGEM, 1)
              THEN NVL(pp.${cols.ppQtdRecebida}, 0) - pp.${cols.ppQtdPedido} * NVL(pp.QTD_EMBALAGEM, 1)
              ELSE 0
            END as QTD_EXTRA,
            pp.${cols.ppValTabela} / NVL(pp.QTD_EMBALAGEM, 1) as PRECO_UNIT,
            CASE
              WHEN NVL(pp.${cols.ppQtdRecebida}, 0) < pp.${cols.ppQtdPedido} * NVL(pp.QTD_EMBALAGEM, 1)
              THEN (pp.${cols.ppQtdPedido} * NVL(pp.QTD_EMBALAGEM, 1) - NVL(pp.${cols.ppQtdRecebida}, 0)) * (pp.${cols.ppValTabela} / NVL(pp.QTD_EMBALAGEM, 1))
              ELSE 0
            END as VALOR_CORTADO,
            CASE
              WHEN NVL(pp.${cols.ppQtdRecebida}, 0) > pp.${cols.ppQtdPedido} * NVL(pp.QTD_EMBALAGEM, 1)
              THEN (NVL(pp.${cols.ppQtdRecebida}, 0) - pp.${cols.ppQtdPedido} * NVL(pp.QTD_EMBALAGEM, 1)) * (pp.${cols.ppValTabela} / NVL(pp.QTD_EMBALAGEM, 1))
              ELSE 0
            END as VALOR_EXCESSO,
            CASE
              WHEN NVL(pp.${cols.ppQtdRecebida}, 0) < pp.${cols.ppQtdPedido} * NVL(pp.QTD_EMBALAGEM, 1) THEN 'RUPTURA'
              WHEN NVL(pp.${cols.ppQtdRecebida}, 0) > pp.${cols.ppQtdPedido} * NVL(pp.QTD_EMBALAGEM, 1) THEN 'EXCESSO'
              ELSE 'OK'
            END as STATUS
          FROM ${tables.pedido} p
          INNER JOIN ${tables.pedidoProduto} pp ON pp.${cols.ppNumPedido} = p.${cols.pedNumPedido}
          WHERE p.${cols.pedTipoParceiro} = 1
          AND p.${cols.pedTipoRecebimento} = 3
          AND pp.${cols.ppCodProduto} = :codProduto
          AND p.${cols.pedCodParceiro} = :codFornecedor
          ORDER BY p.${cols.pedDtaEmissao} DESC
        ) WHERE ROWNUM <= 100
      `;

      const pedidos = await OracleService.query(query, {
        codProduto: codProdutoNum,
        codFornecedor: codFornecedorNum
      });

      // Dados do produto
      const produtoQuery = `
        SELECT ${cols.prCodProduto}, ${cols.prDesProduto}
        FROM ${tables.produto}
        WHERE ${cols.prCodProduto} = :codProduto
      `;
      const produtoResult = await OracleService.query(produtoQuery, { codProduto: codProdutoNum });
      const produto = produtoResult[0] || null;

      // Dados do fornecedor
      const fornecedorQuery = `
        SELECT ${cols.fornCodFornecedor}, ${cols.fornDesFornecedor}
        FROM ${tables.fornecedor}
        WHERE ${cols.fornCodFornecedor} = :codFornecedor
      `;
      const fornecedorResult = await OracleService.query(fornecedorQuery, { codFornecedor: codFornecedorNum });
      const fornecedor = fornecedorResult[0] || null;

      // Calcular totais
      const totais = {
        TOTAL_PEDIDOS: pedidos.length,
        TOTAL_QTD_PEDIDA: pedidos.reduce((sum: number, p: any) => sum + (p.QTD_PEDIDA || 0), 0),
        TOTAL_QTD_ENTREGUE: pedidos.reduce((sum: number, p: any) => sum + (p.QTD_ENTREGUE || 0), 0),
        TOTAL_QTD_CORTADA: pedidos.reduce((sum: number, p: any) => sum + (p.QTD_CORTADA || 0), 0),
        TOTAL_VALOR_CORTADO: pedidos.reduce((sum: number, p: any) => sum + (p.VALOR_CORTADO || 0), 0),
        PEDIDOS_COM_RUPTURA: pedidos.filter((p: any) => p.STATUS === 'RUPTURA').length,
        PEDIDOS_COM_EXCESSO: pedidos.filter((p: any) => p.STATUS === 'EXCESSO').length,
        PEDIDOS_OK: pedidos.filter((p: any) => p.STATUS === 'OK').length
      };

      res.json({
        produto,
        fornecedor: fornecedor?.DES_FORNECEDOR || null,
        pedidos,
        totais
      });
    } catch (error: any) {
      console.error('Erro ao buscar pedidos do produto:', error);
      res.status(500).json({ error: 'Erro ao buscar pedidos do produto', details: error.message });
    }
  }

  /**
   * Buscar nota fiscal relacionada a um pedido
   * Procura a NF do mesmo fornecedor/produto proxima a data do pedido
   */
  static async notaFiscalPedido(req: AuthRequest, res: Response) {
    try {
      const { numPedido } = req.params;
      const { codProduto, codFornecedor } = req.query;

      // Obter nomes de tabelas e colunas dinamicos do MappingService
      const tables = await getTableNames();
      const cols = await getRupturaMappings();

      const numPedidoNum = parseInt(numPedido, 10);
      const codProdutoNum = codProduto ? parseInt(codProduto as string, 10) : null;
      const codFornecedorNum = codFornecedor ? parseInt(codFornecedor as string, 10) : null;

      // Buscar dados do pedido primeiro
      const pedidoQuery = `
        SELECT
          p.${cols.pedNumPedido},
          p.${cols.pedDtaEmissao},
          p.${cols.pedDtaEntrega},
          p.${cols.pedCodParceiro},
          pp.${cols.ppCodProduto},
          pp.${cols.ppQtdPedido},
          pp.${cols.ppQtdRecebida},
          pp.${cols.ppValTabela},
          pr.${cols.prDesProduto},
          f.${cols.fornDesFornecedor}
        FROM ${tables.pedido} p
        INNER JOIN ${tables.pedidoProduto} pp ON pp.${cols.ppNumPedido} = p.${cols.pedNumPedido}
        LEFT JOIN ${tables.produto} pr ON pr.${cols.prCodProduto} = pp.${cols.ppCodProduto}
        LEFT JOIN ${tables.fornecedor} f ON f.${cols.fornCodFornecedor} = p.${cols.pedCodParceiro}
        WHERE p.${cols.pedNumPedido} = :numPedido
        ${codProdutoNum ? `AND pp.${cols.ppCodProduto} = :codProduto` : ''}
      `;

      const pedidoParams: any = { numPedido: numPedidoNum };
      if (codProdutoNum) pedidoParams.codProduto = codProdutoNum;

      const pedidoResult = await OracleService.query(pedidoQuery, pedidoParams);
      const pedido = pedidoResult[0] || null;

      if (!pedido) {
        return res.json({ pedido: null, notasFiscais: [], message: 'Pedido nao encontrado' });
      }

      // Buscar notas fiscais relacionadas
      // Procura NFs do mesmo fornecedor e produto, em um periodo de 30 dias apos a emissao do pedido
      const nfQuery = `
        SELECT * FROM (
          SELECT
            nf.${cols.nfNumNf},
            nf.${cols.nfNumSerieNf},
            nf.${cols.nfDtaEntrada},
            nf.${cols.nfCodParceiro},
            ni.${cols.niCodItem} as COD_PRODUTO,
            ni.${cols.niQtdEntrada},
            ni.${cols.niValUnitario},
            ni.${cols.niValTotal},
            NVL(ni.${cols.niValCustoScred}, 0) as CUSTO_REP,
            f.${cols.fornDesFornecedor},
            pr.${cols.prDesProduto},
            TRUNC(nf.${cols.nfDtaEntrada}) - TRUNC(:dtaEmissao) as DIAS_APOS_PEDIDO
          FROM ${tables.nf} nf
          INNER JOIN ${tables.nfItem} ni ON nf.${cols.nfNumNf} = ni.${cols.niNumNf}
            AND nf.${cols.nfNumSerieNf} = ni.${cols.niNumSerieNf}
            AND nf.${cols.nfCodParceiro} = ni.${cols.niCodParceiro}
          LEFT JOIN ${tables.fornecedor} f ON nf.${cols.nfCodParceiro} = f.${cols.fornCodFornecedor}
          LEFT JOIN ${tables.produto} pr ON pr.${cols.prCodProduto} = ni.${cols.niCodItem}
          WHERE nf.${cols.nfTipoOperacao} = 0
          AND nf.${cols.nfCodParceiro} = :codFornecedor
          AND ni.${cols.niCodItem} = :codProduto
          AND nf.${cols.nfDtaEntrada} >= TRUNC(:dtaEmissao) - 5
          AND nf.${cols.nfDtaEntrada} <= TRUNC(:dtaEmissao) + 60
          ORDER BY ABS(TRUNC(nf.${cols.nfDtaEntrada}) - TRUNC(:dtaEmissao)) ASC
        ) WHERE ROWNUM <= 10
      `;

      const notasFiscais = await OracleService.query(nfQuery, {
        dtaEmissao: pedido.DTA_EMISSAO,
        codFornecedor: pedido.COD_PARCEIRO,
        codProduto: pedido.COD_PRODUTO
      });

      res.json({
        pedido,
        notasFiscais
      });
    } catch (error: any) {
      console.error('Erro ao buscar nota fiscal do pedido:', error);
      res.status(500).json({ error: 'Erro ao buscar nota fiscal', details: error.message });
    }
  }

  /**
   * Ranking de produtos com maior indice de ruptura
   * Mostra cada produto com dados de cada fornecedor que vende
   * Formato: Produto | Fornecedor1 (Ped/Cort/%) | Fornecedor2 (Ped/Cort/%) | ...
   */
  static async rankingProdutosFornecedores(req: AuthRequest, res: Response) {
    try {
      const { dataInicio, dataFim, limit = '50' } = req.query;

      // Obter nomes de tabelas e colunas dinamicos do MappingService
      const tables = await getTableNames();
      const cols = await getRupturaMappings();

      // Condicao de data
      let dateCondition = '1=1';
      if (dataInicio && dataFim) {
        dateCondition = `TRUNC(p.${cols.pedDtaEmissao}) >= TO_DATE('${dataInicio}', 'YYYY-MM-DD') AND TRUNC(p.${cols.pedDtaEmissao}) <= TO_DATE('${dataFim}', 'YYYY-MM-DD')`;
      } else if (dataInicio) {
        dateCondition = `TRUNC(p.${cols.pedDtaEmissao}) >= TO_DATE('${dataInicio}', 'YYYY-MM-DD')`;
      } else if (dataFim) {
        dateCondition = `TRUNC(p.${cols.pedDtaEmissao}) <= TO_DATE('${dataFim}', 'YYYY-MM-DD')`;
      }

      // Query para buscar produtos com maior % de ruptura
      // Calcula totais gerais do produto (todos os fornecedores)
      // QTD_PEDIDO * QTD_EMBALAGEM converte caixas para unidades
      // Corte Total: QTD_RECEBIDA = 0 (nada foi entregue)
      // Corte Parcial: QTD_RECEBIDA > 0 mas < QTD_PEDIDO*QTD_EMBALAGEM (entrega parcial)
      // QTD_EMBALAGEM - hardcoded (nao esta no TABLE_CATALOG)
      // FORA_LINHA - hardcoded (nao esta no TABLE_CATALOG)
      const produtosQuery = `
        SELECT * FROM (
          SELECT
            pp.${cols.ppCodProduto},
            pr.${cols.prDesProduto},
            -- Curva do produto (loja matriz = 1)
            NVL(TRIM(pl.${cols.plCurva}), 'X') as CURVA,
            -- Produto fora do mix (inativo)
            NVL(pl.FORA_LINHA, 'N') as FORA_LINHA,
            -- Totais gerais do produto
            COUNT(DISTINCT p.${cols.pedNumPedido}) as TOTAL_PEDIDOS,
            COUNT(DISTINCT CASE WHEN NVL(pp.${cols.ppQtdRecebida}, 0) < pp.${cols.ppQtdPedido} * NVL(pp.QTD_EMBALAGEM, 1) THEN p.${cols.pedNumPedido} END) as TOTAL_PEDIDOS_CORTADOS,
            -- Corte Total: pedidos onde QTD_RECEBIDA = 0
            COUNT(DISTINCT CASE WHEN NVL(pp.${cols.ppQtdRecebida}, 0) = 0 AND pp.${cols.ppQtdPedido} > 0 THEN p.${cols.pedNumPedido} END) as CORTE_TOTAL,
            -- Corte Parcial: pedidos onde 0 < QTD_RECEBIDA < QTD_PEDIDO*QTD_EMBALAGEM
            COUNT(DISTINCT CASE WHEN NVL(pp.${cols.ppQtdRecebida}, 0) > 0 AND NVL(pp.${cols.ppQtdRecebida}, 0) < pp.${cols.ppQtdPedido} * NVL(pp.QTD_EMBALAGEM, 1) THEN p.${cols.pedNumPedido} END) as CORTE_PARCIAL,
            SUM(pp.${cols.ppQtdPedido} * NVL(pp.QTD_EMBALAGEM, 1)) as TOTAL_QTD_PEDIDA,
            SUM(NVL(pp.${cols.ppQtdRecebida}, 0)) as TOTAL_QTD_ENTREGUE,
            SUM(CASE WHEN NVL(pp.${cols.ppQtdRecebida}, 0) < pp.${cols.ppQtdPedido} * NVL(pp.QTD_EMBALAGEM, 1) THEN pp.${cols.ppQtdPedido} * NVL(pp.QTD_EMBALAGEM, 1) - NVL(pp.${cols.ppQtdRecebida}, 0) ELSE 0 END) as TOTAL_QTD_CORTADA,
            SUM(CASE WHEN NVL(pp.${cols.ppQtdRecebida}, 0) < pp.${cols.ppQtdPedido} * NVL(pp.QTD_EMBALAGEM, 1) THEN (pp.${cols.ppQtdPedido} * NVL(pp.QTD_EMBALAGEM, 1) - NVL(pp.${cols.ppQtdRecebida}, 0)) * (pp.${cols.ppValTabela} / NVL(pp.QTD_EMBALAGEM, 1)) ELSE 0 END) as TOTAL_VALOR_CORTADO,
            SUM(CASE WHEN NVL(pp.${cols.ppQtdRecebida}, 0) > pp.${cols.ppQtdPedido} * NVL(pp.QTD_EMBALAGEM, 1) THEN (NVL(pp.${cols.ppQtdRecebida}, 0) - pp.${cols.ppQtdPedido} * NVL(pp.QTD_EMBALAGEM, 1)) * (pp.${cols.ppValTabela} / NVL(pp.QTD_EMBALAGEM, 1)) ELSE 0 END) as TOTAL_VALOR_EXCESSO,
            SUM(CASE WHEN NVL(pp.${cols.ppQtdRecebida}, 0) > pp.${cols.ppQtdPedido} * NVL(pp.QTD_EMBALAGEM, 1) THEN NVL(pp.${cols.ppQtdRecebida}, 0) - pp.${cols.ppQtdPedido} * NVL(pp.QTD_EMBALAGEM, 1) ELSE 0 END) as TOTAL_QTD_EXCESSO,
            COUNT(DISTINCT p.${cols.pedCodParceiro}) as QTD_FORNECEDORES,
            -- % de ruptura (baseado em quantidade)
            CASE
              WHEN SUM(pp.${cols.ppQtdPedido} * NVL(pp.QTD_EMBALAGEM, 1)) > 0
              THEN ROUND(SUM(CASE WHEN NVL(pp.${cols.ppQtdRecebida}, 0) < pp.${cols.ppQtdPedido} * NVL(pp.QTD_EMBALAGEM, 1) THEN pp.${cols.ppQtdPedido} * NVL(pp.QTD_EMBALAGEM, 1) - NVL(pp.${cols.ppQtdRecebida}, 0) ELSE 0 END) * 100 / SUM(pp.${cols.ppQtdPedido} * NVL(pp.QTD_EMBALAGEM, 1)), 1)
              ELSE 0
            END as PERCENTUAL_RUPTURA
          FROM ${tables.pedido} p
          INNER JOIN ${tables.pedidoProduto} pp ON pp.${cols.ppNumPedido} = p.${cols.pedNumPedido}
          LEFT JOIN ${tables.produto} pr ON pr.${cols.prCodProduto} = pp.${cols.ppCodProduto}
          LEFT JOIN ${tables.produtoLoja} pl ON pl.${cols.plCodProduto} = pp.${cols.ppCodProduto} AND pl.${cols.plCodLoja} = 1
          WHERE p.${cols.pedTipoParceiro} = 1
          AND p.${cols.pedTipoRecebimento} = 3
          AND ${dateCondition}
          GROUP BY pp.${cols.ppCodProduto}, pr.${cols.prDesProduto}, NVL(TRIM(pl.${cols.plCurva}), 'X'), NVL(pl.FORA_LINHA, 'N')
          HAVING SUM(CASE WHEN NVL(pp.${cols.ppQtdRecebida}, 0) < pp.${cols.ppQtdPedido} * NVL(pp.QTD_EMBALAGEM, 1) THEN pp.${cols.ppQtdPedido} * NVL(pp.QTD_EMBALAGEM, 1) - NVL(pp.${cols.ppQtdRecebida}, 0) ELSE 0 END) > 0
          ORDER BY
            CASE
              WHEN SUM(pp.${cols.ppQtdPedido} * NVL(pp.QTD_EMBALAGEM, 1)) > 0
              THEN SUM(CASE WHEN NVL(pp.${cols.ppQtdRecebida}, 0) < pp.${cols.ppQtdPedido} * NVL(pp.QTD_EMBALAGEM, 1) THEN pp.${cols.ppQtdPedido} * NVL(pp.QTD_EMBALAGEM, 1) - NVL(pp.${cols.ppQtdRecebida}, 0) ELSE 0 END) / SUM(pp.${cols.ppQtdPedido} * NVL(pp.QTD_EMBALAGEM, 1))
              ELSE 0
            END DESC,
            SUM(CASE WHEN NVL(pp.${cols.ppQtdRecebida}, 0) < pp.${cols.ppQtdPedido} * NVL(pp.QTD_EMBALAGEM, 1) THEN pp.${cols.ppQtdPedido} * NVL(pp.QTD_EMBALAGEM, 1) - NVL(pp.${cols.ppQtdRecebida}, 0) ELSE 0 END) DESC
        ) WHERE ROWNUM <= :limitNum
      `;

      const produtos = await OracleService.query(produtosQuery, { limitNum: parseInt(limit as string, 10) });

      // Para cada produto, buscar os dados por fornecedor
      const produtosComFornecedores = [];

      for (const produto of produtos) {
        // Query para buscar dados por fornecedor deste produto
        // QTD_PEDIDO * QTD_EMBALAGEM converte caixas para unidades
        // QTD_EMBALAGEM - hardcoded (nao esta no TABLE_CATALOG)
        const fornecedoresQuery = `
          SELECT * FROM (
            SELECT
              f.${cols.fornCodFornecedor},
              f.${cols.fornDesFornecedor},
              COUNT(DISTINCT p.${cols.pedNumPedido}) as TOTAL_PEDIDOS,
              COUNT(DISTINCT CASE WHEN NVL(pp.${cols.ppQtdRecebida}, 0) < pp.${cols.ppQtdPedido} * NVL(pp.QTD_EMBALAGEM, 1) THEN p.${cols.pedNumPedido} END) as CORTADOS,
              -- Corte Total: pedidos onde QTD_RECEBIDA = 0
              COUNT(DISTINCT CASE WHEN NVL(pp.${cols.ppQtdRecebida}, 0) = 0 AND pp.${cols.ppQtdPedido} > 0 THEN p.${cols.pedNumPedido} END) as CORTE_TOTAL,
              -- Corte Parcial: pedidos onde 0 < QTD_RECEBIDA < QTD_PEDIDO*QTD_EMBALAGEM
              COUNT(DISTINCT CASE WHEN NVL(pp.${cols.ppQtdRecebida}, 0) > 0 AND NVL(pp.${cols.ppQtdRecebida}, 0) < pp.${cols.ppQtdPedido} * NVL(pp.QTD_EMBALAGEM, 1) THEN p.${cols.pedNumPedido} END) as CORTE_PARCIAL,
              SUM(pp.${cols.ppQtdPedido} * NVL(pp.QTD_EMBALAGEM, 1)) as QTD_PEDIDA,
              SUM(NVL(pp.${cols.ppQtdRecebida}, 0)) as QTD_ENTREGUE,
              -- QTD Cortada (quando entregou menos que pedido)
              SUM(CASE WHEN NVL(pp.${cols.ppQtdRecebida}, 0) < pp.${cols.ppQtdPedido} * NVL(pp.QTD_EMBALAGEM, 1) THEN pp.${cols.ppQtdPedido} * NVL(pp.QTD_EMBALAGEM, 1) - NVL(pp.${cols.ppQtdRecebida}, 0) ELSE 0 END) as QTD_CORTADA,
              -- QTD Excesso (quando entregou mais que pedido)
              SUM(CASE WHEN NVL(pp.${cols.ppQtdRecebida}, 0) > pp.${cols.ppQtdPedido} * NVL(pp.QTD_EMBALAGEM, 1) THEN NVL(pp.${cols.ppQtdRecebida}, 0) - pp.${cols.ppQtdPedido} * NVL(pp.QTD_EMBALAGEM, 1) ELSE 0 END) as QTD_EXCESSO,
              -- Valor Cortado (quantidade cortada * preco unitario)
              SUM(CASE WHEN NVL(pp.${cols.ppQtdRecebida}, 0) < pp.${cols.ppQtdPedido} * NVL(pp.QTD_EMBALAGEM, 1) THEN (pp.${cols.ppQtdPedido} * NVL(pp.QTD_EMBALAGEM, 1) - NVL(pp.${cols.ppQtdRecebida}, 0)) * (pp.${cols.ppValTabela} / NVL(pp.QTD_EMBALAGEM, 1)) ELSE 0 END) as VALOR_CORTADO,
              -- Valor Excesso (quantidade excesso * preco unitario)
              SUM(CASE WHEN NVL(pp.${cols.ppQtdRecebida}, 0) > pp.${cols.ppQtdPedido} * NVL(pp.QTD_EMBALAGEM, 1) THEN (NVL(pp.${cols.ppQtdRecebida}, 0) - pp.${cols.ppQtdPedido} * NVL(pp.QTD_EMBALAGEM, 1)) * (pp.${cols.ppValTabela} / NVL(pp.QTD_EMBALAGEM, 1)) ELSE 0 END) as VALOR_EXCESSO,
              CASE
                WHEN SUM(pp.${cols.ppQtdPedido} * NVL(pp.QTD_EMBALAGEM, 1)) > 0
                THEN ROUND(SUM(CASE WHEN NVL(pp.${cols.ppQtdRecebida}, 0) < pp.${cols.ppQtdPedido} * NVL(pp.QTD_EMBALAGEM, 1) THEN pp.${cols.ppQtdPedido} * NVL(pp.QTD_EMBALAGEM, 1) - NVL(pp.${cols.ppQtdRecebida}, 0) ELSE 0 END) * 100 / SUM(pp.${cols.ppQtdPedido} * NVL(pp.QTD_EMBALAGEM, 1)), 1)
                ELSE 0
              END as PERCENTUAL
            FROM ${tables.pedido} p
            INNER JOIN ${tables.pedidoProduto} pp ON pp.${cols.ppNumPedido} = p.${cols.pedNumPedido}
            INNER JOIN ${tables.fornecedor} f ON f.${cols.fornCodFornecedor} = p.${cols.pedCodParceiro}
            WHERE p.${cols.pedTipoParceiro} = 1
            AND p.${cols.pedTipoRecebimento} = 3
            AND pp.${cols.ppCodProduto} = :codProduto
            AND ${dateCondition}
            GROUP BY f.${cols.fornCodFornecedor}, f.${cols.fornDesFornecedor}
            ORDER BY
              CASE
                WHEN SUM(pp.${cols.ppQtdPedido} * NVL(pp.QTD_EMBALAGEM, 1)) > 0
                THEN SUM(CASE WHEN NVL(pp.${cols.ppQtdRecebida}, 0) < pp.${cols.ppQtdPedido} * NVL(pp.QTD_EMBALAGEM, 1) THEN pp.${cols.ppQtdPedido} * NVL(pp.QTD_EMBALAGEM, 1) - NVL(pp.${cols.ppQtdRecebida}, 0) ELSE 0 END) / SUM(pp.${cols.ppQtdPedido} * NVL(pp.QTD_EMBALAGEM, 1))
                ELSE 0
              END DESC
          ) WHERE ROWNUM <= 10
        `;

        const fornecedores = await OracleService.query(fornecedoresQuery, { codProduto: produto.COD_PRODUTO });

        produtosComFornecedores.push({
          ...produto,
          fornecedores
        });
      }

      // Coletar todos os fornecedores unicos para o cabecalho da tabela
      const fornecedoresUnicos = new Map();
      produtosComFornecedores.forEach(p => {
        p.fornecedores.forEach((f: any) => {
          if (!fornecedoresUnicos.has(f.COD_FORNECEDOR)) {
            fornecedoresUnicos.set(f.COD_FORNECEDOR, f.DES_FORNECEDOR);
          }
        });
      });

      // Converter para array e limitar aos top 5 mais frequentes
      const fornecedoresArray = Array.from(fornecedoresUnicos.entries())
        .map(([cod, nome]) => ({ COD_FORNECEDOR: cod, DES_FORNECEDOR: nome }))
        .slice(0, 5);

      res.json({
        produtos: produtosComFornecedores,
        fornecedoresHeader: fornecedoresArray
      });
    } catch (error: any) {
      console.error('Erro ao buscar ranking de produtos:', error);
      res.status(500).json({ error: 'Erro ao buscar ranking de produtos', details: error.message });
    }
  }
}
