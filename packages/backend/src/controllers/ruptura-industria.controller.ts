import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { OracleService } from '../services/oracle.service';

/**
 * Controller para Ruptura Indústria
 * Análise de itens cortados em pedidos finalizados (TIPO_RECEBIMENTO = 3)
 * Ruptura = item que foi pedido mas não chegou ou chegou com quantidade menor
 * Filtra apenas pedidos cancelados/finalizados para consistência com tela de Itens Cortados
 */
export class RupturaIndustriaController {
  /**
   * Ranking de fornecedores com estatísticas de ruptura por período
   * Ruptura = itens onde QTD_RECEBIDA < QTD_PEDIDO (item não chegou ou chegou incompleto)
   * Mostra: total de itens, itens com ruptura, itens OK para cada período
   */
  static async rankingFornecedores(req: AuthRequest, res: Response) {
    try {
      const { limit = '50', dataInicio, dataFim } = req.query;

      // Parâmetros - filtro de data vai dentro dos CASE para PERIODO, não no WHERE
      const params: any = { limitNum: parseInt(limit as string, 10) };

      // Condições de data para PERIODO (aplicadas dentro dos CASE, não no WHERE)
      let periodoDateCondition = '1=1'; // default: todos os registros
      if (dataInicio && dataFim) {
        periodoDateCondition = `TRUNC(p.DTA_EMISSAO) >= TO_DATE('${dataInicio}', 'YYYY-MM-DD') AND TRUNC(p.DTA_EMISSAO) <= TO_DATE('${dataFim}', 'YYYY-MM-DD')`;
      } else if (dataInicio) {
        periodoDateCondition = `TRUNC(p.DTA_EMISSAO) >= TO_DATE('${dataInicio}', 'YYYY-MM-DD')`;
      } else if (dataFim) {
        periodoDateCondition = `TRUNC(p.DTA_EMISSAO) <= TO_DATE('${dataFim}', 'YYYY-MM-DD')`;
      }

      // Query para ranking de fornecedores baseado em ITENS com ruptura
      // Ruptura = NVL(QTD_RECEBIDA, 0) < QTD_PEDIDO * NVL(QTD_EMBALAGEM, 1)
      // QTD_PEDIDO está em caixas/embalagens, QTD_EMBALAGEM converte para unidades
      // PERIODO usa filtro de data nos CASE, MES/SEMESTRE/ANO usam ADD_MONTHS independentemente
      const query = `
        SELECT * FROM (
          SELECT
            f.COD_FORNECEDOR,
            f.DES_FORNECEDOR,
            f.NUM_CGC,
            -- PERÍODO SELECIONADO - Quantidade de pedidos (filtrado por data)
            COUNT(DISTINCT CASE WHEN ${periodoDateCondition} THEN p.NUM_PEDIDO END) as PERIODO_PEDIDOS,
            -- PERÍODO SELECIONADO - Total de itens (filtrado por data)
            COUNT(CASE WHEN ${periodoDateCondition} THEN 1 END) as PERIODO_TOTAL,
            -- PERÍODO SELECIONADO - Itens com ruptura (filtrado por data)
            COUNT(CASE WHEN ${periodoDateCondition} AND NVL(pp.QTD_RECEBIDA, 0) < pp.QTD_PEDIDO * NVL(pp.QTD_EMBALAGEM, 1) THEN 1 END) as PERIODO_RUPTURA,
            -- PERÍODO SELECIONADO - Itens OK (filtrado por data)
            COUNT(CASE WHEN ${periodoDateCondition} AND NVL(pp.QTD_RECEBIDA, 0) >= pp.QTD_PEDIDO * NVL(pp.QTD_EMBALAGEM, 1) THEN 1 END) as PERIODO_OK,
            -- PERÍODO SELECIONADO - Valor ruptura (filtrado por data)
            SUM(CASE WHEN ${periodoDateCondition} AND NVL(pp.QTD_RECEBIDA, 0) < pp.QTD_PEDIDO * NVL(pp.QTD_EMBALAGEM, 1) THEN (pp.QTD_PEDIDO * NVL(pp.QTD_EMBALAGEM, 1) - NVL(pp.QTD_RECEBIDA, 0)) * (pp.VAL_TABELA / NVL(pp.QTD_EMBALAGEM, 1)) ELSE 0 END) as PERIODO_VALOR,
            -- Último Mês - Quantidade de pedidos
            COUNT(DISTINCT CASE WHEN p.DTA_EMISSAO >= ADD_MONTHS(TRUNC(SYSDATE), -1) THEN p.NUM_PEDIDO END) as MES_PEDIDOS,
            -- Último Mês - Total de itens pedidos
            COUNT(CASE WHEN p.DTA_EMISSAO >= ADD_MONTHS(TRUNC(SYSDATE), -1) THEN 1 END) as MES_TOTAL,
            -- Último Mês - Itens com ruptura
            COUNT(CASE WHEN p.DTA_EMISSAO >= ADD_MONTHS(TRUNC(SYSDATE), -1) AND NVL(pp.QTD_RECEBIDA, 0) < pp.QTD_PEDIDO * NVL(pp.QTD_EMBALAGEM, 1) THEN 1 END) as MES_RUPTURA,
            -- Último Mês - Itens OK
            COUNT(CASE WHEN p.DTA_EMISSAO >= ADD_MONTHS(TRUNC(SYSDATE), -1) AND NVL(pp.QTD_RECEBIDA, 0) >= pp.QTD_PEDIDO * NVL(pp.QTD_EMBALAGEM, 1) THEN 1 END) as MES_OK,
            -- Último Mês - Valor ruptura
            SUM(CASE WHEN p.DTA_EMISSAO >= ADD_MONTHS(TRUNC(SYSDATE), -1) AND NVL(pp.QTD_RECEBIDA, 0) < pp.QTD_PEDIDO * NVL(pp.QTD_EMBALAGEM, 1) THEN (pp.QTD_PEDIDO * NVL(pp.QTD_EMBALAGEM, 1) - NVL(pp.QTD_RECEBIDA, 0)) * (pp.VAL_TABELA / NVL(pp.QTD_EMBALAGEM, 1)) ELSE 0 END) as MES_VALOR,
            -- Últimos 6 Meses - Quantidade de pedidos
            COUNT(DISTINCT CASE WHEN p.DTA_EMISSAO >= ADD_MONTHS(TRUNC(SYSDATE), -6) THEN p.NUM_PEDIDO END) as SEMESTRE_PEDIDOS,
            -- Últimos 6 Meses - Total de itens
            COUNT(CASE WHEN p.DTA_EMISSAO >= ADD_MONTHS(TRUNC(SYSDATE), -6) THEN 1 END) as SEMESTRE_TOTAL,
            -- Últimos 6 Meses - Itens com ruptura
            COUNT(CASE WHEN p.DTA_EMISSAO >= ADD_MONTHS(TRUNC(SYSDATE), -6) AND NVL(pp.QTD_RECEBIDA, 0) < pp.QTD_PEDIDO * NVL(pp.QTD_EMBALAGEM, 1) THEN 1 END) as SEMESTRE_RUPTURA,
            -- Últimos 6 Meses - Itens OK
            COUNT(CASE WHEN p.DTA_EMISSAO >= ADD_MONTHS(TRUNC(SYSDATE), -6) AND NVL(pp.QTD_RECEBIDA, 0) >= pp.QTD_PEDIDO * NVL(pp.QTD_EMBALAGEM, 1) THEN 1 END) as SEMESTRE_OK,
            -- Últimos 6 Meses - Valor ruptura
            SUM(CASE WHEN p.DTA_EMISSAO >= ADD_MONTHS(TRUNC(SYSDATE), -6) AND NVL(pp.QTD_RECEBIDA, 0) < pp.QTD_PEDIDO * NVL(pp.QTD_EMBALAGEM, 1) THEN (pp.QTD_PEDIDO * NVL(pp.QTD_EMBALAGEM, 1) - NVL(pp.QTD_RECEBIDA, 0)) * (pp.VAL_TABELA / NVL(pp.QTD_EMBALAGEM, 1)) ELSE 0 END) as SEMESTRE_VALOR,
            -- Último Ano - Quantidade de pedidos
            COUNT(DISTINCT CASE WHEN p.DTA_EMISSAO >= ADD_MONTHS(TRUNC(SYSDATE), -12) THEN p.NUM_PEDIDO END) as ANO_PEDIDOS,
            -- Último Ano - Total de itens pedidos
            COUNT(CASE WHEN p.DTA_EMISSAO >= ADD_MONTHS(TRUNC(SYSDATE), -12) THEN 1 END) as ANO_TOTAL,
            -- Último Ano - Itens com ruptura (não chegaram ou chegaram incompletos)
            COUNT(CASE WHEN p.DTA_EMISSAO >= ADD_MONTHS(TRUNC(SYSDATE), -12) AND NVL(pp.QTD_RECEBIDA, 0) < pp.QTD_PEDIDO * NVL(pp.QTD_EMBALAGEM, 1) THEN 1 END) as ANO_RUPTURA,
            -- Último Ano - Itens OK (chegaram completos)
            COUNT(CASE WHEN p.DTA_EMISSAO >= ADD_MONTHS(TRUNC(SYSDATE), -12) AND NVL(pp.QTD_RECEBIDA, 0) >= pp.QTD_PEDIDO * NVL(pp.QTD_EMBALAGEM, 1) THEN 1 END) as ANO_OK,
            -- Último Ano - Valor ruptura
            SUM(CASE WHEN p.DTA_EMISSAO >= ADD_MONTHS(TRUNC(SYSDATE), -12) AND NVL(pp.QTD_RECEBIDA, 0) < pp.QTD_PEDIDO * NVL(pp.QTD_EMBALAGEM, 1) THEN (pp.QTD_PEDIDO * NVL(pp.QTD_EMBALAGEM, 1) - NVL(pp.QTD_RECEBIDA, 0)) * (pp.VAL_TABELA / NVL(pp.QTD_EMBALAGEM, 1)) ELSE 0 END) as ANO_VALOR,
            -- Total geral de itens com ruptura (último ano para ordenação)
            COUNT(CASE WHEN p.DTA_EMISSAO >= ADD_MONTHS(TRUNC(SYSDATE), -12) AND NVL(pp.QTD_RECEBIDA, 0) < pp.QTD_PEDIDO * NVL(pp.QTD_EMBALAGEM, 1) THEN 1 END) as QTD_ITENS_RUPTURA,
            -- Quantidade total faltante (último ano)
            SUM(CASE WHEN p.DTA_EMISSAO >= ADD_MONTHS(TRUNC(SYSDATE), -12) AND NVL(pp.QTD_RECEBIDA, 0) < pp.QTD_PEDIDO * NVL(pp.QTD_EMBALAGEM, 1) THEN pp.QTD_PEDIDO * NVL(pp.QTD_EMBALAGEM, 1) - NVL(pp.QTD_RECEBIDA, 0) ELSE 0 END) as QTD_FALTANTE,
            -- Valor total não faturado (último ano)
            SUM(CASE WHEN p.DTA_EMISSAO >= ADD_MONTHS(TRUNC(SYSDATE), -12) AND NVL(pp.QTD_RECEBIDA, 0) < pp.QTD_PEDIDO * NVL(pp.QTD_EMBALAGEM, 1) THEN (pp.QTD_PEDIDO * NVL(pp.QTD_EMBALAGEM, 1) - NVL(pp.QTD_RECEBIDA, 0)) * (pp.VAL_TABELA / NVL(pp.QTD_EMBALAGEM, 1)) ELSE 0 END) as VALOR_NAO_FATURADO,
            -- Última ruptura
            MAX(CASE WHEN NVL(pp.QTD_RECEBIDA, 0) < pp.QTD_PEDIDO * NVL(pp.QTD_EMBALAGEM, 1) THEN p.DTA_EMISSAO END) as ULTIMA_RUPTURA,
            -- Produtos distintos afetados (último ano)
            COUNT(DISTINCT CASE WHEN p.DTA_EMISSAO >= ADD_MONTHS(TRUNC(SYSDATE), -12) AND NVL(pp.QTD_RECEBIDA, 0) < pp.QTD_PEDIDO * NVL(pp.QTD_EMBALAGEM, 1) THEN pp.COD_PRODUTO END) as QTD_PRODUTOS_AFETADOS
          FROM INTERSOLID.TAB_PEDIDO p
          INNER JOIN INTERSOLID.TAB_FORNECEDOR f ON f.COD_FORNECEDOR = p.COD_PARCEIRO
          INNER JOIN INTERSOLID.TAB_PEDIDO_PRODUTO pp ON pp.NUM_PEDIDO = p.NUM_PEDIDO
          WHERE p.TIPO_PARCEIRO = 1
          AND p.TIPO_RECEBIMENTO = 3
          AND p.DTA_EMISSAO >= ADD_MONTHS(TRUNC(SYSDATE), -12)
          GROUP BY f.COD_FORNECEDOR, f.DES_FORNECEDOR, f.NUM_CGC
          HAVING COUNT(CASE WHEN p.DTA_EMISSAO >= ADD_MONTHS(TRUNC(SYSDATE), -12) AND NVL(pp.QTD_RECEBIDA, 0) < pp.QTD_PEDIDO * NVL(pp.QTD_EMBALAGEM, 1) THEN 1 END) > 0
          ORDER BY COUNT(CASE WHEN p.DTA_EMISSAO >= ADD_MONTHS(TRUNC(SYSDATE), -12) AND NVL(pp.QTD_RECEBIDA, 0) < pp.QTD_PEDIDO * NVL(pp.QTD_EMBALAGEM, 1) THEN 1 END) DESC
        ) WHERE ROWNUM <= :limitNum
      `;

      const fornecedores = await OracleService.query(query, params);

      // Query para estatísticas gerais baseada em ITENS
      // Filtra apenas pedidos cancelados/finalizados (TIPO_RECEBIMENTO = 3)
      // Usa o período selecionado dentro dos CASE
      // QTD_PEDIDO * QTD_EMBALAGEM converte caixas para unidades
      const statsQuery = `
        SELECT
          COUNT(CASE WHEN ${periodoDateCondition} AND NVL(pp.QTD_RECEBIDA, 0) < pp.QTD_PEDIDO * NVL(pp.QTD_EMBALAGEM, 1) THEN 1 END) as TOTAL_ITENS_RUPTURA,
          COUNT(DISTINCT CASE WHEN ${periodoDateCondition} AND NVL(pp.QTD_RECEBIDA, 0) < pp.QTD_PEDIDO * NVL(pp.QTD_EMBALAGEM, 1) THEN p.COD_PARCEIRO END) as TOTAL_FORNECEDORES_AFETADOS,
          SUM(CASE WHEN ${periodoDateCondition} AND NVL(pp.QTD_RECEBIDA, 0) < pp.QTD_PEDIDO * NVL(pp.QTD_EMBALAGEM, 1) THEN (pp.QTD_PEDIDO * NVL(pp.QTD_EMBALAGEM, 1) - NVL(pp.QTD_RECEBIDA, 0)) * (pp.VAL_TABELA / NVL(pp.QTD_EMBALAGEM, 1)) ELSE 0 END) as VALOR_NAO_FATURADO,
          SUM(CASE WHEN ${periodoDateCondition} AND NVL(pp.QTD_RECEBIDA, 0) > pp.QTD_PEDIDO * NVL(pp.QTD_EMBALAGEM, 1) THEN (NVL(pp.QTD_RECEBIDA, 0) - pp.QTD_PEDIDO * NVL(pp.QTD_EMBALAGEM, 1)) * (pp.VAL_TABELA / NVL(pp.QTD_EMBALAGEM, 1)) ELSE 0 END) as VALOR_EXCESSO,
          COUNT(DISTINCT CASE WHEN ${periodoDateCondition} AND NVL(pp.QTD_RECEBIDA, 0) < pp.QTD_PEDIDO * NVL(pp.QTD_EMBALAGEM, 1) THEN pp.COD_PRODUTO END) as TOTAL_PRODUTOS_AFETADOS
        FROM INTERSOLID.TAB_PEDIDO p
        INNER JOIN INTERSOLID.TAB_PEDIDO_PRODUTO pp ON pp.NUM_PEDIDO = p.NUM_PEDIDO
        WHERE p.TIPO_PARCEIRO = 1
        AND p.TIPO_RECEBIMENTO = 3
        AND p.DTA_EMISSAO >= ADD_MONTHS(TRUNC(SYSDATE), -12)
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
   * Produtos com ruptura de um fornecedor específico
   * Ruptura = itens onde QTD_RECEBIDA < QTD_PEDIDO
   * Com estatísticas por período (último ano, 6 meses, último mês)
   */
  static async produtosFornecedor(req: AuthRequest, res: Response) {
    console.log('=== INICIO produtosFornecedor ===');

    try {
      const { codFornecedor } = req.params;
      const { dataInicio, dataFim } = req.query;
      console.log('codFornecedor:', codFornecedor, 'tipo:', typeof codFornecedor);
      console.log('dataInicio:', dataInicio, 'dataFim:', dataFim);

      const codFornecedorNum = parseInt(codFornecedor, 10);
      console.log('codFornecedorNum:', codFornecedorNum);

      // Condição de data para PERIODO (período selecionado pelo usuário)
      let periodoDateCondition = '1=1'; // default: todos os registros
      if (dataInicio && dataFim) {
        periodoDateCondition = `TRUNC(p.DTA_EMISSAO) >= TO_DATE('${dataInicio}', 'YYYY-MM-DD') AND TRUNC(p.DTA_EMISSAO) <= TO_DATE('${dataFim}', 'YYYY-MM-DD')`;
      } else if (dataInicio) {
        periodoDateCondition = `TRUNC(p.DTA_EMISSAO) >= TO_DATE('${dataInicio}', 'YYYY-MM-DD')`;
      } else if (dataFim) {
        periodoDateCondition = `TRUNC(p.DTA_EMISSAO) <= TO_DATE('${dataFim}', 'YYYY-MM-DD')`;
      }

      // Query para produtos com ruptura do fornecedor
      // Ruptura = NVL(QTD_RECEBIDA, 0) < QTD_PEDIDO * NVL(QTD_EMBALAGEM, 1)
      // QTD_PEDIDO está em caixas/embalagens, QTD_EMBALAGEM converte para unidades
      // Inclui métricas por período: ANO, SEMESTRE, MES e TOTAL (período selecionado)
      // Colunas: Pedidos Feitos, Pedidos Cortados, Qtd Cortada, Valor por período
      const query = `
        SELECT * FROM (
          SELECT
            pp.COD_PRODUTO,
            pr.DES_PRODUTO,
            -- Curva do produto (loja matriz = 1)
            NVL(TRIM(pl.DES_RANK_PRODLOJA), 'X') as CURVA,
            -- Produto fora do mix (inativo)
            NVL(pl.FORA_LINHA, 'N') as FORA_LINHA,
            -- ===== PERÍODO SELECIONADO (TOTAL_) =====
            COUNT(DISTINCT CASE WHEN ${periodoDateCondition} THEN p.NUM_PEDIDO END) as TOTAL_PEDIDOS_FEITOS,
            COUNT(DISTINCT CASE WHEN ${periodoDateCondition} AND NVL(pp.QTD_RECEBIDA, 0) < pp.QTD_PEDIDO * NVL(pp.QTD_EMBALAGEM, 1) THEN p.NUM_PEDIDO END) as TOTAL_PEDIDOS_CORTADOS,
            SUM(CASE WHEN ${periodoDateCondition} THEN pp.QTD_PEDIDO * NVL(pp.QTD_EMBALAGEM, 1) ELSE 0 END) as TOTAL_QTD_PEDIDA,
            SUM(CASE WHEN ${periodoDateCondition} THEN NVL(pp.QTD_RECEBIDA, 0) ELSE 0 END) as TOTAL_QTD_ENTREGUE,
            SUM(CASE WHEN ${periodoDateCondition} AND NVL(pp.QTD_RECEBIDA, 0) < pp.QTD_PEDIDO * NVL(pp.QTD_EMBALAGEM, 1) THEN pp.QTD_PEDIDO * NVL(pp.QTD_EMBALAGEM, 1) - NVL(pp.QTD_RECEBIDA, 0) ELSE 0 END) as TOTAL_QTD_CORTADA,
            SUM(CASE WHEN ${periodoDateCondition} AND NVL(pp.QTD_RECEBIDA, 0) < pp.QTD_PEDIDO * NVL(pp.QTD_EMBALAGEM, 1) THEN (pp.QTD_PEDIDO * NVL(pp.QTD_EMBALAGEM, 1) - NVL(pp.QTD_RECEBIDA, 0)) * (pp.VAL_TABELA / NVL(pp.QTD_EMBALAGEM, 1)) ELSE 0 END) as TOTAL_VALOR,
            -- ===== ÚLTIMO ANO =====
            COUNT(DISTINCT CASE WHEN p.DTA_EMISSAO >= ADD_MONTHS(TRUNC(SYSDATE), -12) THEN p.NUM_PEDIDO END) as ANO_PEDIDOS_FEITOS,
            COUNT(DISTINCT CASE WHEN p.DTA_EMISSAO >= ADD_MONTHS(TRUNC(SYSDATE), -12) AND NVL(pp.QTD_RECEBIDA, 0) < pp.QTD_PEDIDO * NVL(pp.QTD_EMBALAGEM, 1) THEN p.NUM_PEDIDO END) as ANO_PEDIDOS_CORTADOS,
            SUM(CASE WHEN p.DTA_EMISSAO >= ADD_MONTHS(TRUNC(SYSDATE), -12) THEN pp.QTD_PEDIDO * NVL(pp.QTD_EMBALAGEM, 1) ELSE 0 END) as ANO_QTD_PEDIDA,
            SUM(CASE WHEN p.DTA_EMISSAO >= ADD_MONTHS(TRUNC(SYSDATE), -12) THEN NVL(pp.QTD_RECEBIDA, 0) ELSE 0 END) as ANO_QTD_ENTREGUE,
            SUM(CASE WHEN p.DTA_EMISSAO >= ADD_MONTHS(TRUNC(SYSDATE), -12) AND NVL(pp.QTD_RECEBIDA, 0) < pp.QTD_PEDIDO * NVL(pp.QTD_EMBALAGEM, 1) THEN pp.QTD_PEDIDO * NVL(pp.QTD_EMBALAGEM, 1) - NVL(pp.QTD_RECEBIDA, 0) ELSE 0 END) as ANO_QTD_CORTADA,
            SUM(CASE WHEN p.DTA_EMISSAO >= ADD_MONTHS(TRUNC(SYSDATE), -12) AND NVL(pp.QTD_RECEBIDA, 0) < pp.QTD_PEDIDO * NVL(pp.QTD_EMBALAGEM, 1) THEN (pp.QTD_PEDIDO * NVL(pp.QTD_EMBALAGEM, 1) - NVL(pp.QTD_RECEBIDA, 0)) * (pp.VAL_TABELA / NVL(pp.QTD_EMBALAGEM, 1)) ELSE 0 END) as ANO_VALOR,
            -- ===== ÚLTIMOS 6 MESES =====
            COUNT(DISTINCT CASE WHEN p.DTA_EMISSAO >= ADD_MONTHS(TRUNC(SYSDATE), -6) THEN p.NUM_PEDIDO END) as SEMESTRE_PEDIDOS_FEITOS,
            COUNT(DISTINCT CASE WHEN p.DTA_EMISSAO >= ADD_MONTHS(TRUNC(SYSDATE), -6) AND NVL(pp.QTD_RECEBIDA, 0) < pp.QTD_PEDIDO * NVL(pp.QTD_EMBALAGEM, 1) THEN p.NUM_PEDIDO END) as SEMESTRE_PEDIDOS_CORTADOS,
            SUM(CASE WHEN p.DTA_EMISSAO >= ADD_MONTHS(TRUNC(SYSDATE), -6) THEN pp.QTD_PEDIDO * NVL(pp.QTD_EMBALAGEM, 1) ELSE 0 END) as SEMESTRE_QTD_PEDIDA,
            SUM(CASE WHEN p.DTA_EMISSAO >= ADD_MONTHS(TRUNC(SYSDATE), -6) THEN NVL(pp.QTD_RECEBIDA, 0) ELSE 0 END) as SEMESTRE_QTD_ENTREGUE,
            SUM(CASE WHEN p.DTA_EMISSAO >= ADD_MONTHS(TRUNC(SYSDATE), -6) AND NVL(pp.QTD_RECEBIDA, 0) < pp.QTD_PEDIDO * NVL(pp.QTD_EMBALAGEM, 1) THEN pp.QTD_PEDIDO * NVL(pp.QTD_EMBALAGEM, 1) - NVL(pp.QTD_RECEBIDA, 0) ELSE 0 END) as SEMESTRE_QTD_CORTADA,
            SUM(CASE WHEN p.DTA_EMISSAO >= ADD_MONTHS(TRUNC(SYSDATE), -6) AND NVL(pp.QTD_RECEBIDA, 0) < pp.QTD_PEDIDO * NVL(pp.QTD_EMBALAGEM, 1) THEN (pp.QTD_PEDIDO * NVL(pp.QTD_EMBALAGEM, 1) - NVL(pp.QTD_RECEBIDA, 0)) * (pp.VAL_TABELA / NVL(pp.QTD_EMBALAGEM, 1)) ELSE 0 END) as SEMESTRE_VALOR,
            -- ===== ÚLTIMO MÊS =====
            COUNT(DISTINCT CASE WHEN p.DTA_EMISSAO >= ADD_MONTHS(TRUNC(SYSDATE), -1) THEN p.NUM_PEDIDO END) as MES_PEDIDOS_FEITOS,
            COUNT(DISTINCT CASE WHEN p.DTA_EMISSAO >= ADD_MONTHS(TRUNC(SYSDATE), -1) AND NVL(pp.QTD_RECEBIDA, 0) < pp.QTD_PEDIDO * NVL(pp.QTD_EMBALAGEM, 1) THEN p.NUM_PEDIDO END) as MES_PEDIDOS_CORTADOS,
            SUM(CASE WHEN p.DTA_EMISSAO >= ADD_MONTHS(TRUNC(SYSDATE), -1) THEN pp.QTD_PEDIDO * NVL(pp.QTD_EMBALAGEM, 1) ELSE 0 END) as MES_QTD_PEDIDA,
            SUM(CASE WHEN p.DTA_EMISSAO >= ADD_MONTHS(TRUNC(SYSDATE), -1) THEN NVL(pp.QTD_RECEBIDA, 0) ELSE 0 END) as MES_QTD_ENTREGUE,
            SUM(CASE WHEN p.DTA_EMISSAO >= ADD_MONTHS(TRUNC(SYSDATE), -1) AND NVL(pp.QTD_RECEBIDA, 0) < pp.QTD_PEDIDO * NVL(pp.QTD_EMBALAGEM, 1) THEN pp.QTD_PEDIDO * NVL(pp.QTD_EMBALAGEM, 1) - NVL(pp.QTD_RECEBIDA, 0) ELSE 0 END) as MES_QTD_CORTADA,
            SUM(CASE WHEN p.DTA_EMISSAO >= ADD_MONTHS(TRUNC(SYSDATE), -1) AND NVL(pp.QTD_RECEBIDA, 0) < pp.QTD_PEDIDO * NVL(pp.QTD_EMBALAGEM, 1) THEN (pp.QTD_PEDIDO * NVL(pp.QTD_EMBALAGEM, 1) - NVL(pp.QTD_RECEBIDA, 0)) * (pp.VAL_TABELA / NVL(pp.QTD_EMBALAGEM, 1)) ELSE 0 END) as MES_VALOR,
            -- Legado (manter compatibilidade)
            COUNT(CASE WHEN NVL(pp.QTD_RECEBIDA, 0) < pp.QTD_PEDIDO * NVL(pp.QTD_EMBALAGEM, 1) THEN 1 END) as TOTAL_RUPTURA,
            COUNT(CASE WHEN p.DTA_EMISSAO >= ADD_MONTHS(TRUNC(SYSDATE), -12) AND NVL(pp.QTD_RECEBIDA, 0) < pp.QTD_PEDIDO * NVL(pp.QTD_EMBALAGEM, 1) THEN 1 END) as ANO_RUPTURA,
            COUNT(CASE WHEN p.DTA_EMISSAO >= ADD_MONTHS(TRUNC(SYSDATE), -6) AND NVL(pp.QTD_RECEBIDA, 0) < pp.QTD_PEDIDO * NVL(pp.QTD_EMBALAGEM, 1) THEN 1 END) as SEMESTRE_RUPTURA,
            COUNT(CASE WHEN p.DTA_EMISSAO >= ADD_MONTHS(TRUNC(SYSDATE), -1) AND NVL(pp.QTD_RECEBIDA, 0) < pp.QTD_PEDIDO * NVL(pp.QTD_EMBALAGEM, 1) THEN 1 END) as MES_RUPTURA,
            SUM(CASE WHEN NVL(pp.QTD_RECEBIDA, 0) < pp.QTD_PEDIDO * NVL(pp.QTD_EMBALAGEM, 1) THEN pp.QTD_PEDIDO * NVL(pp.QTD_EMBALAGEM, 1) - NVL(pp.QTD_RECEBIDA, 0) ELSE 0 END) as QTD_FALTANTE,
            SUM(CASE WHEN NVL(pp.QTD_RECEBIDA, 0) < pp.QTD_PEDIDO * NVL(pp.QTD_EMBALAGEM, 1) THEN (pp.QTD_PEDIDO * NVL(pp.QTD_EMBALAGEM, 1) - NVL(pp.QTD_RECEBIDA, 0)) * (pp.VAL_TABELA / NVL(pp.QTD_EMBALAGEM, 1)) ELSE 0 END) as VALOR_NAO_FATURADO,
            -- Flag: tem outros fornecedores que vendem esse produto?
            (SELECT COUNT(DISTINCT p2.COD_PARCEIRO)
             FROM INTERSOLID.TAB_PEDIDO p2
             INNER JOIN INTERSOLID.TAB_PEDIDO_PRODUTO pp2 ON pp2.NUM_PEDIDO = p2.NUM_PEDIDO
             WHERE p2.TIPO_PARCEIRO = 1
             AND p2.TIPO_RECEBIMENTO = 3
             AND pp2.COD_PRODUTO = pp.COD_PRODUTO
             AND p2.COD_PARCEIRO != :codFornecedor
             AND p2.DTA_EMISSAO >= ADD_MONTHS(TRUNC(SYSDATE), -12)
             AND NVL(pp2.QTD_RECEBIDA, 0) > 0
            ) as QTD_OUTROS_FORNECEDORES
          FROM INTERSOLID.TAB_PEDIDO p
          INNER JOIN INTERSOLID.TAB_PEDIDO_PRODUTO pp ON pp.NUM_PEDIDO = p.NUM_PEDIDO
          LEFT JOIN INTERSOLID.TAB_PRODUTO pr ON pr.COD_PRODUTO = pp.COD_PRODUTO
          LEFT JOIN INTERSOLID.TAB_PRODUTO_LOJA pl ON pl.COD_PRODUTO = pp.COD_PRODUTO AND pl.COD_LOJA = 1
          WHERE p.TIPO_PARCEIRO = 1
          AND p.TIPO_RECEBIMENTO = 3
          AND p.COD_PARCEIRO = :codFornecedor
          GROUP BY pp.COD_PRODUTO, pr.DES_PRODUTO, NVL(TRIM(pl.DES_RANK_PRODLOJA), 'X'), NVL(pl.FORA_LINHA, 'N')
          HAVING COUNT(CASE WHEN NVL(pp.QTD_RECEBIDA, 0) < pp.QTD_PEDIDO * NVL(pp.QTD_EMBALAGEM, 1) THEN 1 END) > 0
          ORDER BY
            -- Ordenar por % de ruptura no período selecionado (maior para menor)
            CASE
              WHEN SUM(CASE WHEN ${periodoDateCondition} THEN pp.QTD_PEDIDO * NVL(pp.QTD_EMBALAGEM, 1) ELSE 0 END) > 0
              THEN SUM(CASE WHEN ${periodoDateCondition} AND NVL(pp.QTD_RECEBIDA, 0) < pp.QTD_PEDIDO * NVL(pp.QTD_EMBALAGEM, 1) THEN pp.QTD_PEDIDO * NVL(pp.QTD_EMBALAGEM, 1) - NVL(pp.QTD_RECEBIDA, 0) ELSE 0 END)
                   / SUM(CASE WHEN ${periodoDateCondition} THEN pp.QTD_PEDIDO * NVL(pp.QTD_EMBALAGEM, 1) ELSE 0 END)
              ELSE 0
            END DESC,
            -- Desempate: maior quantidade cortada no período
            SUM(CASE WHEN ${periodoDateCondition} AND NVL(pp.QTD_RECEBIDA, 0) < pp.QTD_PEDIDO * NVL(pp.QTD_EMBALAGEM, 1) THEN pp.QTD_PEDIDO * NVL(pp.QTD_EMBALAGEM, 1) - NVL(pp.QTD_RECEBIDA, 0) ELSE 0 END) DESC
        ) WHERE ROWNUM <= 100
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

  /**
   * Histórico de compras de um produto (todos os fornecedores)
   * Para mostrar alternativas de fornecedores
   */
  static async historicoComprasProduto(req: AuthRequest, res: Response) {
    try {
      const { codProduto } = req.params;
      const { codFornecedorAtual } = req.query;

      const codProdutoNum = parseInt(codProduto, 10);
      const codFornecedorAtualNum = codFornecedorAtual ? parseInt(codFornecedorAtual as string, 10) : null;

      // Buscar histórico de compras desse produto de todos os fornecedores
      // Usando TAB_NF (notas fiscais) e TAB_NF_ITEM (itens) - mesma fonte da tela de Pontuação
      // VAL_CUSTO_SCRED = custo de reposição unitário correto
      // TIPO_OPERACAO = 0 é entrada (compra)
      const query = `
        SELECT * FROM (
          SELECT
            nf.DTA_ENTRADA as DATA,
            TRUNC(SYSDATE) - TRUNC(nf.DTA_ENTRADA) as DIAS,
            f.DES_FORNECEDOR as FORNECEDOR,
            f.COD_FORNECEDOR,
            ni.QTD_ENTRADA as QTD,
            NVL(ni.VAL_CUSTO_SCRED, 0) as CUSTO_REP,
            ni.VAL_TOTAL as TOTAL,
            nf.NUM_NF as NF
          FROM INTERSOLID.TAB_NF nf
          INNER JOIN INTERSOLID.TAB_NF_ITEM ni ON nf.NUM_NF = ni.NUM_NF
            AND nf.NUM_SERIE_NF = ni.NUM_SERIE_NF
            AND nf.COD_PARCEIRO = ni.COD_PARCEIRO
          LEFT JOIN INTERSOLID.TAB_FORNECEDOR f ON nf.COD_PARCEIRO = f.COD_FORNECEDOR
          WHERE ni.COD_ITEM = :codProduto
          AND nf.TIPO_OPERACAO = 0
          ORDER BY nf.DTA_ENTRADA DESC
        ) WHERE ROWNUM <= 50
      `;

      const historico = await OracleService.query(query, { codProduto: codProdutoNum });

      // Dados do produto
      const produtoQuery = `
        SELECT COD_PRODUTO, DES_PRODUTO
        FROM INTERSOLID.TAB_PRODUTO
        WHERE COD_PRODUTO = :codProduto
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
      console.error('Erro ao buscar histórico de compras do produto:', error);
      res.status(500).json({ error: 'Erro ao buscar histórico de compras', details: error.message });
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

      const codProdutoNum = parseInt(codProduto, 10);
      const codFornecedorNum = codFornecedor ? parseInt(codFornecedor as string, 10) : null;

      // Query para buscar todos os pedidos do produto com o fornecedor
      // QTD_PEDIDO * QTD_EMBALAGEM converte caixas para unidades
      const query = `
        SELECT * FROM (
          SELECT
            p.NUM_PEDIDO,
            p.DTA_EMISSAO as DATA,
            TRUNC(SYSDATE) - TRUNC(p.DTA_EMISSAO) as DIAS,
            pp.QTD_PEDIDO * NVL(pp.QTD_EMBALAGEM, 1) as QTD_PEDIDA,
            NVL(pp.QTD_RECEBIDA, 0) as QTD_ENTREGUE,
            CASE
              WHEN NVL(pp.QTD_RECEBIDA, 0) < pp.QTD_PEDIDO * NVL(pp.QTD_EMBALAGEM, 1)
              THEN pp.QTD_PEDIDO * NVL(pp.QTD_EMBALAGEM, 1) - NVL(pp.QTD_RECEBIDA, 0)
              ELSE 0
            END as QTD_CORTADA,
            CASE
              WHEN NVL(pp.QTD_RECEBIDA, 0) > pp.QTD_PEDIDO * NVL(pp.QTD_EMBALAGEM, 1)
              THEN NVL(pp.QTD_RECEBIDA, 0) - pp.QTD_PEDIDO * NVL(pp.QTD_EMBALAGEM, 1)
              ELSE 0
            END as QTD_EXTRA,
            pp.VAL_TABELA / NVL(pp.QTD_EMBALAGEM, 1) as PRECO_UNIT,
            CASE
              WHEN NVL(pp.QTD_RECEBIDA, 0) < pp.QTD_PEDIDO * NVL(pp.QTD_EMBALAGEM, 1)
              THEN (pp.QTD_PEDIDO * NVL(pp.QTD_EMBALAGEM, 1) - NVL(pp.QTD_RECEBIDA, 0)) * (pp.VAL_TABELA / NVL(pp.QTD_EMBALAGEM, 1))
              ELSE 0
            END as VALOR_CORTADO,
            CASE
              WHEN NVL(pp.QTD_RECEBIDA, 0) > pp.QTD_PEDIDO * NVL(pp.QTD_EMBALAGEM, 1)
              THEN (NVL(pp.QTD_RECEBIDA, 0) - pp.QTD_PEDIDO * NVL(pp.QTD_EMBALAGEM, 1)) * (pp.VAL_TABELA / NVL(pp.QTD_EMBALAGEM, 1))
              ELSE 0
            END as VALOR_EXCESSO,
            CASE
              WHEN NVL(pp.QTD_RECEBIDA, 0) < pp.QTD_PEDIDO * NVL(pp.QTD_EMBALAGEM, 1) THEN 'RUPTURA'
              WHEN NVL(pp.QTD_RECEBIDA, 0) > pp.QTD_PEDIDO * NVL(pp.QTD_EMBALAGEM, 1) THEN 'EXCESSO'
              ELSE 'OK'
            END as STATUS
          FROM INTERSOLID.TAB_PEDIDO p
          INNER JOIN INTERSOLID.TAB_PEDIDO_PRODUTO pp ON pp.NUM_PEDIDO = p.NUM_PEDIDO
          WHERE p.TIPO_PARCEIRO = 1
          AND p.TIPO_RECEBIMENTO = 3
          AND pp.COD_PRODUTO = :codProduto
          AND p.COD_PARCEIRO = :codFornecedor
          ORDER BY p.DTA_EMISSAO DESC
        ) WHERE ROWNUM <= 100
      `;

      const pedidos = await OracleService.query(query, {
        codProduto: codProdutoNum,
        codFornecedor: codFornecedorNum
      });

      // Dados do produto
      const produtoQuery = `
        SELECT COD_PRODUTO, DES_PRODUTO
        FROM INTERSOLID.TAB_PRODUTO
        WHERE COD_PRODUTO = :codProduto
      `;
      const produtoResult = await OracleService.query(produtoQuery, { codProduto: codProdutoNum });
      const produto = produtoResult[0] || null;

      // Dados do fornecedor
      const fornecedorQuery = `
        SELECT COD_FORNECEDOR, DES_FORNECEDOR
        FROM INTERSOLID.TAB_FORNECEDOR
        WHERE COD_FORNECEDOR = :codFornecedor
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
   * Procura a NF do mesmo fornecedor/produto próxima à data do pedido
   */
  static async notaFiscalPedido(req: AuthRequest, res: Response) {
    try {
      const { numPedido } = req.params;
      const { codProduto, codFornecedor } = req.query;

      const numPedidoNum = parseInt(numPedido, 10);
      const codProdutoNum = codProduto ? parseInt(codProduto as string, 10) : null;
      const codFornecedorNum = codFornecedor ? parseInt(codFornecedor as string, 10) : null;

      // Buscar dados do pedido primeiro
      const pedidoQuery = `
        SELECT
          p.NUM_PEDIDO,
          p.DTA_EMISSAO,
          p.DTA_ENTREGA,
          p.COD_PARCEIRO,
          pp.COD_PRODUTO,
          pp.QTD_PEDIDO,
          pp.QTD_RECEBIDA,
          pp.VAL_TABELA,
          pr.DES_PRODUTO,
          f.DES_FORNECEDOR
        FROM INTERSOLID.TAB_PEDIDO p
        INNER JOIN INTERSOLID.TAB_PEDIDO_PRODUTO pp ON pp.NUM_PEDIDO = p.NUM_PEDIDO
        LEFT JOIN INTERSOLID.TAB_PRODUTO pr ON pr.COD_PRODUTO = pp.COD_PRODUTO
        LEFT JOIN INTERSOLID.TAB_FORNECEDOR f ON f.COD_FORNECEDOR = p.COD_PARCEIRO
        WHERE p.NUM_PEDIDO = :numPedido
        ${codProdutoNum ? 'AND pp.COD_PRODUTO = :codProduto' : ''}
      `;

      const pedidoParams: any = { numPedido: numPedidoNum };
      if (codProdutoNum) pedidoParams.codProduto = codProdutoNum;

      const pedidoResult = await OracleService.query(pedidoQuery, pedidoParams);
      const pedido = pedidoResult[0] || null;

      if (!pedido) {
        return res.json({ pedido: null, notasFiscais: [], message: 'Pedido não encontrado' });
      }

      // Buscar notas fiscais relacionadas
      // Procura NFs do mesmo fornecedor e produto, em um período de 30 dias após a emissão do pedido
      const nfQuery = `
        SELECT * FROM (
          SELECT
            nf.NUM_NF,
            nf.NUM_SERIE_NF,
            nf.DTA_ENTRADA,
            nf.COD_PARCEIRO,
            ni.COD_ITEM as COD_PRODUTO,
            ni.QTD_ENTRADA,
            ni.VAL_UNITARIO,
            ni.VAL_TOTAL,
            NVL(ni.VAL_CUSTO_SCRED, 0) as CUSTO_REP,
            f.DES_FORNECEDOR,
            pr.DES_PRODUTO,
            TRUNC(nf.DTA_ENTRADA) - TRUNC(:dtaEmissao) as DIAS_APOS_PEDIDO
          FROM INTERSOLID.TAB_NF nf
          INNER JOIN INTERSOLID.TAB_NF_ITEM ni ON nf.NUM_NF = ni.NUM_NF
            AND nf.NUM_SERIE_NF = ni.NUM_SERIE_NF
            AND nf.COD_PARCEIRO = ni.COD_PARCEIRO
          LEFT JOIN INTERSOLID.TAB_FORNECEDOR f ON nf.COD_PARCEIRO = f.COD_FORNECEDOR
          LEFT JOIN INTERSOLID.TAB_PRODUTO pr ON pr.COD_PRODUTO = ni.COD_ITEM
          WHERE nf.TIPO_OPERACAO = 0
          AND nf.COD_PARCEIRO = :codFornecedor
          AND ni.COD_ITEM = :codProduto
          AND nf.DTA_ENTRADA >= TRUNC(:dtaEmissao) - 5
          AND nf.DTA_ENTRADA <= TRUNC(:dtaEmissao) + 60
          ORDER BY ABS(TRUNC(nf.DTA_ENTRADA) - TRUNC(:dtaEmissao)) ASC
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
   * Ranking de produtos com maior índice de ruptura
   * Mostra cada produto com dados de cada fornecedor que vende
   * Formato: Produto | Fornecedor1 (Ped/Cort/%) | Fornecedor2 (Ped/Cort/%) | ...
   */
  static async rankingProdutosFornecedores(req: AuthRequest, res: Response) {
    try {
      const { dataInicio, dataFim, limit = '50' } = req.query;

      // Condição de data
      let dateCondition = '1=1';
      if (dataInicio && dataFim) {
        dateCondition = `TRUNC(p.DTA_EMISSAO) >= TO_DATE('${dataInicio}', 'YYYY-MM-DD') AND TRUNC(p.DTA_EMISSAO) <= TO_DATE('${dataFim}', 'YYYY-MM-DD')`;
      } else if (dataInicio) {
        dateCondition = `TRUNC(p.DTA_EMISSAO) >= TO_DATE('${dataInicio}', 'YYYY-MM-DD')`;
      } else if (dataFim) {
        dateCondition = `TRUNC(p.DTA_EMISSAO) <= TO_DATE('${dataFim}', 'YYYY-MM-DD')`;
      }

      // Query para buscar produtos com maior % de ruptura
      // Calcula totais gerais do produto (todos os fornecedores)
      // QTD_PEDIDO * QTD_EMBALAGEM converte caixas para unidades
      // Corte Total: QTD_RECEBIDA = 0 (nada foi entregue)
      // Corte Parcial: QTD_RECEBIDA > 0 mas < QTD_PEDIDO*QTD_EMBALAGEM (entrega parcial)
      const produtosQuery = `
        SELECT * FROM (
          SELECT
            pp.COD_PRODUTO,
            pr.DES_PRODUTO,
            -- Curva do produto (loja matriz = 1)
            NVL(TRIM(pl.DES_RANK_PRODLOJA), 'X') as CURVA,
            -- Produto fora do mix (inativo)
            NVL(pl.FORA_LINHA, 'N') as FORA_LINHA,
            -- Totais gerais do produto
            COUNT(DISTINCT p.NUM_PEDIDO) as TOTAL_PEDIDOS,
            COUNT(DISTINCT CASE WHEN NVL(pp.QTD_RECEBIDA, 0) < pp.QTD_PEDIDO * NVL(pp.QTD_EMBALAGEM, 1) THEN p.NUM_PEDIDO END) as TOTAL_PEDIDOS_CORTADOS,
            -- Corte Total: pedidos onde QTD_RECEBIDA = 0
            COUNT(DISTINCT CASE WHEN NVL(pp.QTD_RECEBIDA, 0) = 0 AND pp.QTD_PEDIDO > 0 THEN p.NUM_PEDIDO END) as CORTE_TOTAL,
            -- Corte Parcial: pedidos onde 0 < QTD_RECEBIDA < QTD_PEDIDO*QTD_EMBALAGEM
            COUNT(DISTINCT CASE WHEN NVL(pp.QTD_RECEBIDA, 0) > 0 AND NVL(pp.QTD_RECEBIDA, 0) < pp.QTD_PEDIDO * NVL(pp.QTD_EMBALAGEM, 1) THEN p.NUM_PEDIDO END) as CORTE_PARCIAL,
            SUM(pp.QTD_PEDIDO * NVL(pp.QTD_EMBALAGEM, 1)) as TOTAL_QTD_PEDIDA,
            SUM(NVL(pp.QTD_RECEBIDA, 0)) as TOTAL_QTD_ENTREGUE,
            SUM(CASE WHEN NVL(pp.QTD_RECEBIDA, 0) < pp.QTD_PEDIDO * NVL(pp.QTD_EMBALAGEM, 1) THEN pp.QTD_PEDIDO * NVL(pp.QTD_EMBALAGEM, 1) - NVL(pp.QTD_RECEBIDA, 0) ELSE 0 END) as TOTAL_QTD_CORTADA,
            SUM(CASE WHEN NVL(pp.QTD_RECEBIDA, 0) < pp.QTD_PEDIDO * NVL(pp.QTD_EMBALAGEM, 1) THEN (pp.QTD_PEDIDO * NVL(pp.QTD_EMBALAGEM, 1) - NVL(pp.QTD_RECEBIDA, 0)) * (pp.VAL_TABELA / NVL(pp.QTD_EMBALAGEM, 1)) ELSE 0 END) as TOTAL_VALOR_CORTADO,
            SUM(CASE WHEN NVL(pp.QTD_RECEBIDA, 0) > pp.QTD_PEDIDO * NVL(pp.QTD_EMBALAGEM, 1) THEN (NVL(pp.QTD_RECEBIDA, 0) - pp.QTD_PEDIDO * NVL(pp.QTD_EMBALAGEM, 1)) * (pp.VAL_TABELA / NVL(pp.QTD_EMBALAGEM, 1)) ELSE 0 END) as TOTAL_VALOR_EXCESSO,
            SUM(CASE WHEN NVL(pp.QTD_RECEBIDA, 0) > pp.QTD_PEDIDO * NVL(pp.QTD_EMBALAGEM, 1) THEN NVL(pp.QTD_RECEBIDA, 0) - pp.QTD_PEDIDO * NVL(pp.QTD_EMBALAGEM, 1) ELSE 0 END) as TOTAL_QTD_EXCESSO,
            COUNT(DISTINCT p.COD_PARCEIRO) as QTD_FORNECEDORES,
            -- % de ruptura (baseado em quantidade)
            CASE
              WHEN SUM(pp.QTD_PEDIDO * NVL(pp.QTD_EMBALAGEM, 1)) > 0
              THEN ROUND(SUM(CASE WHEN NVL(pp.QTD_RECEBIDA, 0) < pp.QTD_PEDIDO * NVL(pp.QTD_EMBALAGEM, 1) THEN pp.QTD_PEDIDO * NVL(pp.QTD_EMBALAGEM, 1) - NVL(pp.QTD_RECEBIDA, 0) ELSE 0 END) * 100 / SUM(pp.QTD_PEDIDO * NVL(pp.QTD_EMBALAGEM, 1)), 1)
              ELSE 0
            END as PERCENTUAL_RUPTURA
          FROM INTERSOLID.TAB_PEDIDO p
          INNER JOIN INTERSOLID.TAB_PEDIDO_PRODUTO pp ON pp.NUM_PEDIDO = p.NUM_PEDIDO
          LEFT JOIN INTERSOLID.TAB_PRODUTO pr ON pr.COD_PRODUTO = pp.COD_PRODUTO
          LEFT JOIN INTERSOLID.TAB_PRODUTO_LOJA pl ON pl.COD_PRODUTO = pp.COD_PRODUTO AND pl.COD_LOJA = 1
          WHERE p.TIPO_PARCEIRO = 1
          AND p.TIPO_RECEBIMENTO = 3
          AND ${dateCondition}
          GROUP BY pp.COD_PRODUTO, pr.DES_PRODUTO, NVL(TRIM(pl.DES_RANK_PRODLOJA), 'X'), NVL(pl.FORA_LINHA, 'N')
          HAVING SUM(CASE WHEN NVL(pp.QTD_RECEBIDA, 0) < pp.QTD_PEDIDO * NVL(pp.QTD_EMBALAGEM, 1) THEN pp.QTD_PEDIDO * NVL(pp.QTD_EMBALAGEM, 1) - NVL(pp.QTD_RECEBIDA, 0) ELSE 0 END) > 0
          ORDER BY
            CASE
              WHEN SUM(pp.QTD_PEDIDO * NVL(pp.QTD_EMBALAGEM, 1)) > 0
              THEN SUM(CASE WHEN NVL(pp.QTD_RECEBIDA, 0) < pp.QTD_PEDIDO * NVL(pp.QTD_EMBALAGEM, 1) THEN pp.QTD_PEDIDO * NVL(pp.QTD_EMBALAGEM, 1) - NVL(pp.QTD_RECEBIDA, 0) ELSE 0 END) / SUM(pp.QTD_PEDIDO * NVL(pp.QTD_EMBALAGEM, 1))
              ELSE 0
            END DESC,
            SUM(CASE WHEN NVL(pp.QTD_RECEBIDA, 0) < pp.QTD_PEDIDO * NVL(pp.QTD_EMBALAGEM, 1) THEN pp.QTD_PEDIDO * NVL(pp.QTD_EMBALAGEM, 1) - NVL(pp.QTD_RECEBIDA, 0) ELSE 0 END) DESC
        ) WHERE ROWNUM <= :limitNum
      `;

      const produtos = await OracleService.query(produtosQuery, { limitNum: parseInt(limit as string, 10) });

      // Para cada produto, buscar os dados por fornecedor
      const produtosComFornecedores = [];

      for (const produto of produtos) {
        // Query para buscar dados por fornecedor deste produto
        // QTD_PEDIDO * QTD_EMBALAGEM converte caixas para unidades
        const fornecedoresQuery = `
          SELECT * FROM (
            SELECT
              f.COD_FORNECEDOR,
              f.DES_FORNECEDOR,
              COUNT(DISTINCT p.NUM_PEDIDO) as TOTAL_PEDIDOS,
              COUNT(DISTINCT CASE WHEN NVL(pp.QTD_RECEBIDA, 0) < pp.QTD_PEDIDO * NVL(pp.QTD_EMBALAGEM, 1) THEN p.NUM_PEDIDO END) as CORTADOS,
              -- Corte Total: pedidos onde QTD_RECEBIDA = 0
              COUNT(DISTINCT CASE WHEN NVL(pp.QTD_RECEBIDA, 0) = 0 AND pp.QTD_PEDIDO > 0 THEN p.NUM_PEDIDO END) as CORTE_TOTAL,
              -- Corte Parcial: pedidos onde 0 < QTD_RECEBIDA < QTD_PEDIDO*QTD_EMBALAGEM
              COUNT(DISTINCT CASE WHEN NVL(pp.QTD_RECEBIDA, 0) > 0 AND NVL(pp.QTD_RECEBIDA, 0) < pp.QTD_PEDIDO * NVL(pp.QTD_EMBALAGEM, 1) THEN p.NUM_PEDIDO END) as CORTE_PARCIAL,
              SUM(pp.QTD_PEDIDO * NVL(pp.QTD_EMBALAGEM, 1)) as QTD_PEDIDA,
              SUM(NVL(pp.QTD_RECEBIDA, 0)) as QTD_ENTREGUE,
              -- QTD Cortada (quando entregou menos que pedido)
              SUM(CASE WHEN NVL(pp.QTD_RECEBIDA, 0) < pp.QTD_PEDIDO * NVL(pp.QTD_EMBALAGEM, 1) THEN pp.QTD_PEDIDO * NVL(pp.QTD_EMBALAGEM, 1) - NVL(pp.QTD_RECEBIDA, 0) ELSE 0 END) as QTD_CORTADA,
              -- QTD Excesso (quando entregou mais que pedido)
              SUM(CASE WHEN NVL(pp.QTD_RECEBIDA, 0) > pp.QTD_PEDIDO * NVL(pp.QTD_EMBALAGEM, 1) THEN NVL(pp.QTD_RECEBIDA, 0) - pp.QTD_PEDIDO * NVL(pp.QTD_EMBALAGEM, 1) ELSE 0 END) as QTD_EXCESSO,
              -- Valor Cortado (quantidade cortada * preço unitário)
              SUM(CASE WHEN NVL(pp.QTD_RECEBIDA, 0) < pp.QTD_PEDIDO * NVL(pp.QTD_EMBALAGEM, 1) THEN (pp.QTD_PEDIDO * NVL(pp.QTD_EMBALAGEM, 1) - NVL(pp.QTD_RECEBIDA, 0)) * (pp.VAL_TABELA / NVL(pp.QTD_EMBALAGEM, 1)) ELSE 0 END) as VALOR_CORTADO,
              -- Valor Excesso (quantidade excesso * preço unitário)
              SUM(CASE WHEN NVL(pp.QTD_RECEBIDA, 0) > pp.QTD_PEDIDO * NVL(pp.QTD_EMBALAGEM, 1) THEN (NVL(pp.QTD_RECEBIDA, 0) - pp.QTD_PEDIDO * NVL(pp.QTD_EMBALAGEM, 1)) * (pp.VAL_TABELA / NVL(pp.QTD_EMBALAGEM, 1)) ELSE 0 END) as VALOR_EXCESSO,
              CASE
                WHEN SUM(pp.QTD_PEDIDO * NVL(pp.QTD_EMBALAGEM, 1)) > 0
                THEN ROUND(SUM(CASE WHEN NVL(pp.QTD_RECEBIDA, 0) < pp.QTD_PEDIDO * NVL(pp.QTD_EMBALAGEM, 1) THEN pp.QTD_PEDIDO * NVL(pp.QTD_EMBALAGEM, 1) - NVL(pp.QTD_RECEBIDA, 0) ELSE 0 END) * 100 / SUM(pp.QTD_PEDIDO * NVL(pp.QTD_EMBALAGEM, 1)), 1)
                ELSE 0
              END as PERCENTUAL
            FROM INTERSOLID.TAB_PEDIDO p
            INNER JOIN INTERSOLID.TAB_PEDIDO_PRODUTO pp ON pp.NUM_PEDIDO = p.NUM_PEDIDO
            INNER JOIN INTERSOLID.TAB_FORNECEDOR f ON f.COD_FORNECEDOR = p.COD_PARCEIRO
            WHERE p.TIPO_PARCEIRO = 1
            AND p.TIPO_RECEBIMENTO = 3
            AND pp.COD_PRODUTO = :codProduto
            AND ${dateCondition}
            GROUP BY f.COD_FORNECEDOR, f.DES_FORNECEDOR
            ORDER BY
              CASE
                WHEN SUM(pp.QTD_PEDIDO * NVL(pp.QTD_EMBALAGEM, 1)) > 0
                THEN SUM(CASE WHEN NVL(pp.QTD_RECEBIDA, 0) < pp.QTD_PEDIDO * NVL(pp.QTD_EMBALAGEM, 1) THEN pp.QTD_PEDIDO * NVL(pp.QTD_EMBALAGEM, 1) - NVL(pp.QTD_RECEBIDA, 0) ELSE 0 END) / SUM(pp.QTD_PEDIDO * NVL(pp.QTD_EMBALAGEM, 1))
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

      // Coletar todos os fornecedores únicos para o cabeçalho da tabela
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
