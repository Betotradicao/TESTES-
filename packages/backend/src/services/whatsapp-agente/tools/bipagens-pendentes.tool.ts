import type { ToolDefinition } from '../types';
import { AppDataSource } from '../../../config/database';

export const bipagensPendentesTool: ToolDefinition = {
  name: 'bipagens_pendentes',
  categoria: 'Bipagens',
  descricao: 'Quantidade de bipagens pendentes de conferência',
  descricaoGPT: 'Conta quantas bipagens (vendas de produtos coletados pelo coletor) ainda nao foram conferidas com vendas reais. Use quando perguntar sobre bipagens pendentes, conferencia pendente, % conferido, etc.',
  parameters: {
    type: 'object',
    properties: {
      codLoja: { type: 'number' },
    },
  },
  execute: async (params, _ctx) => {
    try {
      const where = [`status IN ('pending', 'pendente', 'not_verified', 'nao_verificado')`];
      const vals: any[] = [];
      if (params.codLoja) { where.push(`cod_loja = $1`); vals.push(params.codLoja); }

      const rows = await AppDataSource.query(
        `SELECT COUNT(*) AS pendentes,
                (SELECT COUNT(*) FROM bips WHERE DATE(created_at) = CURRENT_DATE) AS total_hoje
         FROM bips
         WHERE ${where.join(' AND ')}`,
        vals
      ).catch(() => []);

      if (!rows.length) return { resposta: '✅ Nenhuma bipagem registrada.' };
      const pendentes = Number(rows[0].pendentes || 0);
      const totalHoje = Number(rows[0].total_hoje || 0);
      const pctConferido = totalHoje > 0 ? ((totalHoje - pendentes) / totalHoje) * 100 : 0;

      let emoji = pendentes === 0 ? '✅' : pendentes < 10 ? '🟡' : '🔴';
      let txt = `${emoji} *BIPAGENS PENDENTES*\n\n`;
      txt += `🔍 Pendentes de conferência: *${pendentes}*\n`;
      txt += `📦 Total bipado hoje: ${totalHoje}\n`;
      txt += `✅ % conferido hoje: ${pctConferido.toFixed(1)}%`;
      return { resposta: txt, dados: { pendentes, totalHoje, pctConferido } };
    } catch (e: any) {
      return { resposta: `❌ Erro: ${e.message}`, erro: e.message };
    }
  },
};
