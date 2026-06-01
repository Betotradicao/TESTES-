import type { ToolDefinition } from '../types';
import { vendaHojeTool } from './venda-hoje.tool';
import { quebrasHojeTool } from './quebras-hoje.tool';
import { bipagensPendentesTool } from './bipagens-pendentes.tool';
import { fornecedoresAtrasadosTool } from './fornecedores-atrasados.tool';

export const resumoDiaTool: ToolDefinition = {
  name: 'resumo_dia',
  categoria: 'Análise',
  descricao: 'Resumo consolidado do dia (venda + quebras + bipagens + fornecedores)',
  descricaoGPT: 'Retorna um resumo geral do dia juntando: venda do dia, quebras, bipagens pendentes e fornecedores em atraso. Use quando perguntar "me dá um resumo do dia", "fechamento do dia", "como tá tudo hoje", etc.',
  parameters: {
    type: 'object',
    properties: {
      codLoja: { type: 'number' },
    },
  },
  execute: async (params, ctx) => {
    const [venda, quebras, bipagens, fornec] = await Promise.all([
      vendaHojeTool.execute({ codLoja: params.codLoja }, ctx).catch(() => null),
      quebrasHojeTool.execute({ codLoja: params.codLoja }, ctx).catch(() => null),
      bipagensPendentesTool.execute({ codLoja: params.codLoja }, ctx).catch(() => null),
      fornecedoresAtrasadosTool.execute({ top: 3 }, ctx).catch(() => null),
    ]);

    let txt = `📊 *RESUMO DO DIA*\n`;
    txt += `\n${venda?.resposta || '❌ Venda indisponível'}\n`;
    txt += `\n${'━'.repeat(20)}\n${quebras?.resposta || ''}\n`;
    txt += `\n${'━'.repeat(20)}\n${bipagens?.resposta || ''}\n`;
    txt += `\n${'━'.repeat(20)}\n${fornec?.resposta || ''}`;
    return { resposta: txt };
  },
};
