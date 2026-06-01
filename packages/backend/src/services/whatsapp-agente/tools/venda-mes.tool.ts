import type { ToolDefinition } from '../types';
import { GestaoInteligenteService } from '../../gestao-inteligente.service';

const fmtBRL = (v: number) => 'R$ ' + (v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtPct = (v: number) => (v > 0 ? '+' : '') + v.toFixed(1) + '%';
const fmtPP = (v: number) => (v > 0 ? '+' : '') + v.toFixed(1) + ' p.p.';
const cor = (v: number) => v > 0 ? '🟢' : v < 0 ? '🔴' : '⚪';
const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

export const vendaMesTool: ToolDefinition = {
  name: 'venda_mes',
  categoria: 'Vendas',
  descricao: 'Venda total do mês corrente (parcial)',
  descricaoGPT: 'Retorna a venda acumulada do mês corrente (do dia 1 até ontem), com comparativo vs mesmos dias do mês passado e ano passado. Inclui margem e ticket médio. Use quando o usuario perguntar sobre vendas do mês, fechamento mensal parcial, como tá o mês, etc.',
  parameters: {
    type: 'object',
    properties: {
      codLoja: { type: 'number', description: 'Codigo da loja (opcional)' },
    },
  },
  execute: async (params, ctx) => {
    const codLoja = params.codLoja || ctx.defaultCodLoja;
    const hoje = new Date();
    const dia1 = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
    const dataInicio = ymd(dia1);
    // Se hoje for dia 1, intervalo eh so o proprio dia 1 (parcial); caso contrario, dia 1 ate hoje
    const dataFim = ymd(hoje);

    try {
      const ind = await GestaoInteligenteService.getIndicadores({ dataInicio, dataFim, codLoja });
      const v = ind.vendas?.atual || 0;
      const vMesAnt = ind.vendas?.mesPassado || 0;
      const vAnoAnt = ind.vendas?.anoPassado || 0;
      const margem = ind.margemLimpa?.atual || 0;
      const margemMA = ind.margemLimpa?.mesPassado || 0;
      const tm = ind.ticketMedio?.atual || 0;
      const cupons = ind.qtdCupons?.atual || 0;

      const varMA = vMesAnt > 0 ? ((v - vMesAnt) / vMesAnt) * 100 : 0;
      const varAA = vAnoAnt > 0 ? ((v - vAnoAnt) / vAnoAnt) * 100 : 0;
      const varMargem = margem - margemMA;

      const meses = ['JAN','FEV','MAR','ABR','MAI','JUN','JUL','AGO','SET','OUT','NOV','DEZ'];

      let txt = `📊 *VENDA DO MÊS (${meses[hoje.getMonth()]}/${hoje.getFullYear()})*\n`;
      txt += `Período: ${dataInicio.split('-').reverse().join('/')} a ${dataFim.split('-').reverse().join('/')}\n`;
      txt += `\n💰 *${fmtBRL(v)}*\n`;
      txt += `${cor(varMA)} vs mês anterior: *${fmtPct(varMA)}* (${fmtBRL(vMesAnt)})\n`;
      txt += `${cor(varAA)} vs ano anterior: *${fmtPct(varAA)}* (${fmtBRL(vAnoAnt)})\n`;
      txt += `\n🧾 Cupons: ${cupons.toLocaleString('pt-BR')}\n`;
      txt += `💳 Ticket médio: ${fmtBRL(tm)}\n`;
      txt += `📈 Margem: ${margem.toFixed(2)}% ${cor(varMargem)} *${fmtPP(varMargem)}*`;

      return { resposta: txt, dados: { vendas: v, mesAnt: vMesAnt, anoAnt: vAnoAnt } };
    } catch (e: any) {
      return { resposta: `❌ Erro: ${e.message}`, erro: e.message };
    }
  },
};
