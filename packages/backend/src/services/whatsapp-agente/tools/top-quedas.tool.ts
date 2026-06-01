import type { ToolDefinition } from '../types';
import { GestaoInteligenteService } from '../../gestao-inteligente.service';

const fmtBRL = (v: number) => 'R$ ' + (v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtPct = (v: number) => (v > 0 ? '+' : '') + v.toFixed(1) + '%';
const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

export const topQuedasTool: ToolDefinition = {
  name: 'top_quedas',
  categoria: 'Análise',
  descricao: 'Setores/grupos com maior queda de venda no período',
  descricaoGPT: 'Lista os setores (ou grupos) com maior queda de venda em % vs período comparativo. Use quando o usuario perguntar quais setores caíram, top quedas, setores em queda, onde estamos perdendo venda, etc.',
  parameters: {
    type: 'object',
    properties: {
      periodo: { type: 'string', enum: ['semana', 'mes'], description: 'semana = ultimos 7 dias / mes = mes corrente parcial' },
      top: { type: 'number', description: 'Quantos setores listar (default 5, max 10)' },
      codLoja: { type: 'number' },
    },
    required: ['periodo'],
  },
  execute: async (params, ctx) => {
    const codLoja = params.codLoja || ctx.defaultCodLoja;
    const top = Math.min(params.top || 5, 10);
    const hoje = new Date();

    let dataInicio: string, dataFim: string, mesAntIni: string, mesAntFim: string, label: string;
    if (params.periodo === 'semana') {
      const ontem = new Date(hoje); ontem.setDate(hoje.getDate() - 1);
      const seteAtras = new Date(hoje); seteAtras.setDate(hoje.getDate() - 7);
      dataInicio = ymd(seteAtras); dataFim = ymd(ontem);
      const mIni = new Date(seteAtras); mIni.setMonth(mIni.getMonth() - 1);
      const mFim = new Date(ontem); mFim.setMonth(mFim.getMonth() - 1);
      mesAntIni = ymd(mIni); mesAntFim = ymd(mFim);
      label = `últimos 7 dias`;
    } else {
      const ontem = new Date(hoje); ontem.setDate(hoje.getDate() - 1);
      const dia1 = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
      dataInicio = ymd(dia1); dataFim = ymd(ontem.getDate() >= 1 ? ontem : dia1);
      const mIni = new Date(hoje.getFullYear(), hoje.getMonth() - 1, 1);
      const mFim = new Date(hoje.getFullYear(), hoje.getMonth(), 0);
      mesAntIni = ymd(mIni); mesAntFim = ymd(mFim);
      label = `mês corrente`;
    }

    try {
      const [atual, ant] = await Promise.all([
        GestaoInteligenteService.getVendasPorSetor({ dataInicio, dataFim, codLoja }),
        GestaoInteligenteService.getVendasPorSetor({ dataInicio: mesAntIni, dataFim: mesAntFim, codLoja }).catch(() => []),
      ]);
      const idxAnt = new Map<number, any>();
      ant.forEach((s: any) => idxAnt.set(Number(s.codSecao), s));

      const comparados = atual.map((s: any) => {
        const a = idxAnt.get(Number(s.codSecao)) || {};
        const vAnt = a.venda || 0;
        const v = s.venda || 0;
        const varPct = vAnt > 0 ? ((v - vAnt) / vAnt) * 100 : 0;
        const varRs = v - vAnt;
        return { setor: s.setor, v, vAnt, varPct, varRs };
      });

      const quedas = comparados
        .filter(s => s.vAnt > 0 && s.varPct < 0)
        .sort((a, b) => a.varPct - b.varPct)
        .slice(0, top);

      if (!quedas.length) {
        return { resposta: `🟢 *Sem setores em queda* no período (${label})!\nTodos cresceram ou ficaram estáveis vs comparativo.` };
      }

      let txt = `📉 *TOP ${top} SETORES EM QUEDA* (${label})\n`;
      quedas.forEach((s, i) => {
        txt += `\n${i + 1}. *${s.setor}*\n`;
        txt += `   ${fmtBRL(s.v)} · ${fmtPct(s.varPct)} (perdeu ${fmtBRL(Math.abs(s.varRs))})`;
      });
      return { resposta: txt, dados: quedas };
    } catch (e: any) {
      return { resposta: `❌ Erro: ${e.message}`, erro: e.message };
    }
  },
};
