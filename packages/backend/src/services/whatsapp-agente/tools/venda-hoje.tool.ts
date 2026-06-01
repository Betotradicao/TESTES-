import type { ToolDefinition } from '../types';
import { GestaoInteligenteService } from '../../gestao-inteligente.service';

const fmtBRL = (v: number) => 'R$ ' + (v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtPct = (v: number) => (v > 0 ? '+' : '') + v.toFixed(1) + '%';
const cor = (v: number) => v > 0 ? '🟢' : v < 0 ? '🔴' : '⚪';
const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

export const vendaHojeTool: ToolDefinition = {
  name: 'venda_hoje',
  categoria: 'Vendas',
  descricao: 'Venda de um dia especifico (hoje, ontem, ou data exata)',
  descricaoGPT: 'Retorna a venda total da loja em UM DIA específico. Por padrão é HOJE (parcial). Aceita parâmetro `data` no formato YYYY-MM-DD pra consultar ontem, dia X do mês passado, etc. IMPORTANTE: para "ontem" calcule a data D-1 e passe via `data`. Para datas relativas tipo "semana passada terça" calcule e passe a data exata. Use sempre que o usuário perguntar sobre vendas de UM DIA ÚNICO.',
  parameters: {
    type: 'object',
    properties: {
      data: { type: 'string', description: 'Data no formato YYYY-MM-DD. Se omitido, usa HOJE.' },
      codLoja: { type: 'number', description: 'Codigo da loja (opcional, padrao: todas)' },
    },
  },
  execute: async (params, ctx) => {
    const codLoja = params.codLoja || ctx.defaultCodLoja;
    const hoje = new Date();
    const dataAlvo = params.data || ymd(hoje);
    const dataInicio = dataAlvo;
    const dataFim = dataAlvo;
    const isHoje = dataAlvo === ymd(hoje);

    try {
      const ind = await GestaoInteligenteService.getIndicadores({ dataInicio, dataFim, codLoja });
      const v = ind.vendas?.atual || 0;
      const semAnt = ind.vendas?.mesPassado || 0;
      const variacao = ind.vendas?.mesPassado > 0 ? ((v - semAnt) / semAnt) * 100 : 0;
      const cupons = ind.qtdCupons?.atual || 0;
      const tm = ind.ticketMedio?.atual || 0;

      const dataFmt = dataAlvo.split('-').reverse().join('/');
      const titulo = isHoje
        ? `💰 *VENDA DE HOJE* (parcial até ${hoje.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })})`
        : `💰 *VENDA DE ${dataFmt}*`;

      let txt = `${titulo}\n`;
      txt += `\n*${fmtBRL(v)}*\n`;
      if (v === 0) {
        txt += `\n⚠️ Nenhuma venda registrada nesse dia.`;
        return { resposta: txt, dados: { vendas: 0, data: dataAlvo } };
      }
      if (semAnt > 0) {
        txt += `${cor(variacao)} vs período comparativo: *${fmtPct(variacao)}* (${fmtBRL(semAnt)})\n`;
      }
      txt += `\n🧾 Cupons: ${cupons.toLocaleString('pt-BR')}`;
      if (tm > 0) txt += `\n💳 Ticket médio: ${fmtBRL(tm)}`;
      const margem = ind.margemLimpa?.atual;
      if (margem) txt += `\n📈 Margem: ${margem.toFixed(2)}%`;

      return { resposta: txt, dados: { vendas: v, comparativo: semAnt, variacao, cupons, tm, data: dataAlvo } };
    } catch (e: any) {
      return { resposta: `❌ Erro ao buscar vendas: ${e.message}`, erro: e.message };
    }
  },
};
