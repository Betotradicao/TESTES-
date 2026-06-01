import type { ToolDefinition } from '../types';
import { OracleService } from '../../oracle.service';
import { MappingService } from '../../mapping.service';

const fmtBRL = (v: number) => 'R$ ' + (v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export const consultarPrecoTool: ToolDefinition = {
  name: 'consultar_preco',
  categoria: 'Pricing',
  descricao: 'Consulta preço e estoque de um produto pela descrição',
  descricaoGPT: 'Busca produto pela descricao (LIKE %nome%) e retorna preço de venda, custo, margem e estoque. Use quando perguntar "qual o preço do X", "quanto custa Y", "tem estoque de Z".',
  parameters: {
    type: 'object',
    properties: {
      descricao: { type: 'string', description: 'Nome ou parte do nome do produto (ex: "leite italac", "skol lata")' },
    },
    required: ['descricao'],
  },
  execute: async (params, ctx) => {
    try {
      const termo = String(params.descricao || '').trim();
      if (termo.length < 3) return { resposta: '❌ Descrição muito curta. Mínimo 3 letras.' };

      const schema = await MappingService.getSchema();
      const tabProd = `${schema}.${await MappingService.getRealTableName('TAB_PRODUTO')}`;
      const colCod = await MappingService.getColumnFromTable('TAB_PRODUTO', 'codigo_produto');
      const colDesc = await MappingService.getColumnFromTable('TAB_PRODUTO', 'descricao');
      const colPrecoVenda = await MappingService.getColumnFromTable('TAB_PRODUTO', 'preco_venda');
      const colCusto = await MappingService.getColumnFromTable('TAB_PRODUTO', 'custo_reposicao');
      const colEstoque = await MappingService.getColumnFromTable('TAB_PRODUTO', 'estoque_atual');

      const sql = `
        SELECT ${colCod} AS cod, ${colDesc} AS desc,
               ${colPrecoVenda} AS preco, ${colCusto} AS custo, ${colEstoque} AS estoque
        FROM ${tabProd}
        WHERE UPPER(${colDesc}) LIKE UPPER(:termo)
        ORDER BY ${colDesc}
        FETCH FIRST 10 ROWS ONLY
      `;
      const rows = await OracleService.query<any>(sql, { termo: `%${termo}%` }).catch(() => []);

      if (!rows.length) return { resposta: `❌ Nenhum produto encontrado com "${termo}"` };

      let txt = `🏷️ *PRODUTOS COM "${termo.toUpperCase()}"* (${rows.length} encontrados)\n`;
      rows.slice(0, 8).forEach((r: any, i: number) => {
        const preco = Number(r.PRECO || 0);
        const custo = Number(r.CUSTO || 0);
        const estoque = Number(r.ESTOQUE || 0);
        const margem = preco > 0 ? ((preco - custo) / preco) * 100 : 0;
        txt += `\n${i + 1}. *${r.DESC}* (cod ${r.COD})`;
        txt += `\n   💵 ${fmtBRL(preco)}`;
        if (!ctx.esconderCusto && custo > 0) {
          txt += ` · margem ${margem.toFixed(1)}%`;
        }
        txt += ` · 📦 estoque: ${estoque}`;
      });
      return { resposta: txt, dados: rows };
    } catch (e: any) {
      return { resposta: `❌ Erro: ${e.message}`, erro: e.message };
    }
  },
};
