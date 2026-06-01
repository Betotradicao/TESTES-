import type { ToolDefinition } from '../types';
import { AppDataSource } from '../../../config/database';

const fmtBRL = (v: number) => 'R$ ' + (v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export const quebrasHojeTool: ToolDefinition = {
  name: 'quebras_hoje',
  categoria: 'Quebras',
  descricao: 'Quebras/ajustes lançados hoje (valor + motivos)',
  descricaoGPT: 'Lista as quebras (perdas/ajustes de estoque) registradas no dia, com valor total, quantidade de itens e top 5 motivos. Use quando perguntar sobre quebras, ajustes, perdas do dia.',
  parameters: {
    type: 'object',
    properties: {
      codLoja: { type: 'number' },
    },
  },
  execute: async (params, _ctx) => {
    try {
      const hoje = new Date();
      const ymd = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}-${String(hoje.getDate()).padStart(2, '0')}`;

      const where = [`DATE(data_quebra) = $1`];
      const vals: any[] = [ymd];
      if (params.codLoja) { where.push(`cod_loja = $2`); vals.push(params.codLoja); }

      // tenta tabela losses (legacy) - se nao existir retorna vazio
      const rows = await AppDataSource.query(
        `SELECT COALESCE(motivo, 'Não informado') AS motivo,
                SUM(valor_total) AS total,
                COUNT(*) AS qtd
         FROM losses
         WHERE ${where.join(' AND ')}
         GROUP BY motivo
         ORDER BY total DESC NULLS LAST
         LIMIT 10`,
        vals
      ).catch(() => []);

      if (!rows.length) return { resposta: '✅ Nenhuma quebra registrada hoje.' };

      const total = rows.reduce((s: number, r: any) => s + Number(r.total || 0), 0);
      const qtdTotal = rows.reduce((s: number, r: any) => s + Number(r.qtd || 0), 0);

      let txt = `📉 *QUEBRAS DE HOJE*\n\n`;
      txt += `💸 Total: *${fmtBRL(total)}*\n`;
      txt += `📦 Itens: ${qtdTotal}\n\n`;
      txt += `*Top motivos:*\n`;
      rows.slice(0, 5).forEach((r: any, i: number) => {
        txt += `${i + 1}. ${r.motivo} — ${fmtBRL(Number(r.total))} (${r.qtd} itens)\n`;
      });
      return { resposta: txt.trim(), dados: { total, motivos: rows } };
    } catch (e: any) {
      return { resposta: `❌ Erro ao buscar quebras: ${e.message}`, erro: e.message };
    }
  },
};
