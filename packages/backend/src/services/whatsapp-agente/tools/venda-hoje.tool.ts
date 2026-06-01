import type { ToolDefinition } from '../types';
import { GestaoInteligenteService } from '../../gestao-inteligente.service';

const fmtBRL = (v: number) => 'R$ ' + (v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtPct = (v: number) => (v > 0 ? '+' : '') + v.toFixed(1) + '%';
const cor = (v: number) => v > 0 ? '🟢' : v < 0 ? '🔴' : '⚪';
const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

export const vendaHojeTool: ToolDefinition = {
  name: 'venda_hoje',
  categoria: 'Vendas',
  descricao: 'Venda total do dia atual (parcial até agora)',
  descricaoGPT: 'Retorna a venda total da loja no dia de HOJE (parcial até o momento da consulta), com comparativo vs mesmo dia da semana anterior. Use quando o usuario perguntar sobre vendas de hoje, faturamento do dia, parcial do dia, etc.',
  parameters: {
    type: 'object',
    properties: {
      codLoja: { type: 'number', description: 'Codigo da loja (opcional, padrao: todas)' },
    },
  },
  execute: async (params, ctx) => {
    const codLoja = params.codLoja || ctx.defaultCodLoja;
    const hoje = new Date();
    const dataInicio = ymd(hoje);
    const dataFim = dataInicio;

    try {
      const ind = await GestaoInteligenteService.getIndicadores({ dataInicio, dataFim, codLoja });
      const v = ind.vendas?.atual || 0;
      const semAnt = ind.vendas?.mesPassado || 0;
      const variacao = ind.vendas?.mesPassado > 0 ? ((v - semAnt) / semAnt) * 100 : 0;
      const cupons = ind.qtdCupons?.atual || 0;
      const tm = ind.ticketMedio?.atual || 0;
      const hora = hoje.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

      let txt = `💰 *VENDA DE HOJE* (parcial até ${hora})\n`;
      txt += `\n*${fmtBRL(v)}*\n`;
      if (semAnt > 0) {
        txt += `${cor(variacao)} vs período comparativo: *${fmtPct(variacao)}* (${fmtBRL(semAnt)})\n`;
      }
      txt += `\n🧾 Cupons: ${cupons.toLocaleString('pt-BR')}`;
      if (tm > 0) txt += `\n💳 Ticket médio: ${fmtBRL(tm)}`;
      const margem = ind.margemLimpa?.atual;
      if (margem) txt += `\n📈 Margem: ${margem.toFixed(2)}%`;

      return { resposta: txt, dados: { vendas: v, comparativo: semAnt, variacao, cupons, tm } };
    } catch (e: any) {
      return { resposta: `❌ Erro ao buscar vendas: ${e.message}`, erro: e.message };
    }
  },
};
