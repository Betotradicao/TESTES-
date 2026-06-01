import type { ToolDefinition } from '../types';
import { OracleService } from '../../oracle.service';
import { MappingService } from '../../mapping.service';

const fmtBRL = (v: number) => 'R$ ' + (v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export const fornecedoresAtrasadosTool: ToolDefinition = {
  name: 'fornecedores_atrasados',
  categoria: 'Fornecedores',
  descricao: 'Fornecedores com pedidos em atraso (acima do prazo combinado)',
  descricaoGPT: 'Lista os fornecedores que tem pedidos em atraso, ou seja, prazo de entrega ja venceu mas ainda nao chegou nota. Use quando perguntar sobre atrasos, fornecedor atrasado, pedidos atrasados, etc.',
  parameters: {
    type: 'object',
    properties: {
      top: { type: 'number', description: 'Quantos listar (default 10)' },
    },
  },
  execute: async (params, _ctx) => {
    try {
      const top = Math.min(params.top || 10, 30);
      const schema = await MappingService.getSchema();
      const tabPedido = `${schema}.${await MappingService.getRealTableName('TAB_PEDIDO')}`;
      const colNumPed = await MappingService.getColumnFromTable('TAB_PEDIDO', 'numero_pedido');
      const colDtEmissao = await MappingService.getColumnFromTable('TAB_PEDIDO', 'data_emissao');
      const colDtEntrega = await MappingService.getColumnFromTable('TAB_PEDIDO', 'data_entrega');
      const colCodParc = await MappingService.getColumnFromTable('TAB_PEDIDO', 'codigo_parceiro');
      const colValor = await MappingService.getColumnFromTable('TAB_PEDIDO', 'valor_total');
      const colStatus = await MappingService.getColumnFromTable('TAB_PEDIDO', 'status');

      const sql = `
        SELECT ${colCodParc} AS cod_parc,
               COUNT(*) AS qtd_pedidos,
               SUM(${colValor}) AS valor_total,
               MIN(${colDtEntrega}) AS data_mais_antiga
        FROM ${tabPedido}
        WHERE ${colDtEntrega} < TRUNC(SYSDATE)
          AND ${colStatus} = 'P'
        GROUP BY ${colCodParc}
        ORDER BY valor_total DESC
        FETCH FIRST ${top} ROWS ONLY
      `;
      const rows = await OracleService.query<any>(sql, {}).catch(() => []);
      if (!rows.length) return { resposta: '✅ Nenhum fornecedor em atraso no momento!' };

      let txt = `🚚 *FORNECEDORES EM ATRASO* (top ${rows.length})\n`;
      const totalGeral = rows.reduce((s: number, r: any) => s + Number(r.VALOR_TOTAL || 0), 0);
      txt += `\n💸 Valor total em atraso: *${fmtBRL(totalGeral)}*\n`;
      rows.forEach((r: any, i: number) => {
        const dias = Math.floor((Date.now() - new Date(r.DATA_MAIS_ANTIGA).getTime()) / (1000 * 60 * 60 * 24));
        txt += `\n${i + 1}. Fornec. ${r.COD_PARC} — ${r.QTD_PEDIDOS} ped(s), ${fmtBRL(Number(r.VALOR_TOTAL))} (${dias}d atrasado)`;
      });
      return { resposta: txt, dados: rows };
    } catch (e: any) {
      return { resposta: `❌ Erro ao consultar fornecedores: ${e.message}`, erro: e.message };
    }
  },
};
