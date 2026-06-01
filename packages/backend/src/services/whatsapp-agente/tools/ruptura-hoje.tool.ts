import type { ToolDefinition } from '../types';
import { OracleService } from '../../oracle.service';
import { MappingService } from '../../mapping.service';

export const rupturaHojeTool: ToolDefinition = {
  name: 'ruptura_hoje',
  categoria: 'Estoque',
  descricao: 'Produtos com estoque zerado ou negativo (ruptura)',
  descricaoGPT: 'Lista produtos que estao em ruptura (estoque <= 0). Por padrao mostra so produtos de curva A (mais importantes). Use quando perguntar sobre produtos zerados, ruptura, sem estoque, faltando produto.',
  parameters: {
    type: 'object',
    properties: {
      apenasCurvaA: { type: 'boolean', description: 'So produtos curva A (default true)' },
      top: { type: 'number', description: 'Quantos listar (default 10, max 30)' },
    },
  },
  execute: async (params, _ctx) => {
    try {
      const top = Math.min(params.top || 10, 30);
      const apenasA = params.apenasCurvaA !== false; // default true
      const schema = await MappingService.getSchema();
      const tabProd = `${schema}.${await MappingService.getRealTableName('TAB_PRODUTO')}`;
      const colCodProd = await MappingService.getColumnFromTable('TAB_PRODUTO', 'codigo_produto');
      const colDesc = await MappingService.getColumnFromTable('TAB_PRODUTO', 'descricao');
      const colEstoque = await MappingService.getColumnFromTable('TAB_PRODUTO', 'estoque_atual');
      const colCurva = await MappingService.getColumnFromTable('TAB_PRODUTO', 'curva_abc');

      let where = `${colEstoque} <= 0`;
      if (apenasA) where += ` AND ${colCurva} = 'A'`;

      const sql = `
        SELECT ${colCodProd} AS cod, ${colDesc} AS desc, ${colEstoque} AS estoque, ${colCurva} AS curva
        FROM ${tabProd}
        WHERE ${where}
        ORDER BY ${colCurva} ASC, ${colDesc}
        FETCH FIRST ${top} ROWS ONLY
      `;
      const rows = await OracleService.query<any>(sql, {}).catch(() => []);

      if (!rows.length) return { resposta: apenasA ? '✅ Nenhum produto curva A em ruptura!' : '✅ Nenhum produto em ruptura!' };

      let txt = `🚨 *PRODUTOS EM RUPTURA${apenasA ? ' (Curva A)' : ''}*\n`;
      txt += `\nTotal: *${rows.length}* itens\n`;
      rows.forEach((r: any, i: number) => {
        txt += `\n${i + 1}. [${r.CURVA}] ${r.DESC} (cod ${r.COD})`;
      });
      return { resposta: txt, dados: rows };
    } catch (e: any) {
      return { resposta: `❌ Erro: ${e.message}`, erro: e.message };
    }
  },
};
