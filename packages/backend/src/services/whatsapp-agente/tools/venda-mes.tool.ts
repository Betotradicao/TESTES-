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
  descricao: 'Venda total de um mês (atual parcial ou mês especifico fechado)',
  descricaoGPT: 'Retorna a venda total de UM MÊS. Sem parâmetros = mês corrente (parcial dia 1 ate hoje). Com `mes` e `ano` = mês fechado especifico (ex: maio/2026, abril/2025). IMPORTANTE: se usuario falar "venda de maio", "venda de abril", "fechamento do mês passado", CALCULE mes/ano e passe via parametros. Inclui comparativo vs mes anterior, vs ano anterior, margem e ticket medio.',
  parameters: {
    type: 'object',
    properties: {
      mes: { type: 'number', description: 'Numero do mes (1-12). Omitir = mes atual.' },
      ano: { type: 'number', description: 'Ano (ex: 2026). Omitir = ano atual.' },
      codLoja: { type: 'number', description: 'Codigo da loja (opcional)' },
    },
  },
  execute: async (params, ctx) => {
    const codLoja = params.codLoja || ctx.defaultCodLoja;
    const hoje = new Date();
    const mesAlvo = params.mes ? params.mes - 1 : hoje.getMonth();
    const anoAlvo = params.ano || hoje.getFullYear();
    const isMesCorrente = mesAlvo === hoje.getMonth() && anoAlvo === hoje.getFullYear();
    const dia1 = new Date(anoAlvo, mesAlvo, 1);
    const ultimoDia = new Date(anoAlvo, mesAlvo + 1, 0);
    const dataInicio = ymd(dia1);
    const dataFim = isMesCorrente ? ymd(hoje) : ymd(ultimoDia);

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

      const parcial = isMesCorrente ? ' (parcial)' : '';
      let txt = `📊 *VENDA DO MÊS ${meses[mesAlvo]}/${anoAlvo}${parcial}*\n`;
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
