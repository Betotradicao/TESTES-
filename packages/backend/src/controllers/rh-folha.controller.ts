import { Request, Response } from 'express';
import { AppDataSource } from '../config/database';

// Catalogo dos lancamentos (mesma ordem da tela Lancamentos)
const PROVENTOS = [
  { key: 'hora_extra_60', label: 'HE 60%' },
  { key: 'hora_extra_60_inter', label: 'HE 60% Interjornada' },
  { key: 'hora_extra_100', label: 'HE 100%' },
  { key: 'adicional_noturno', label: 'Adic. Noturno' },
  { key: 'quebra_caixa', label: 'Quebra Caixa' },
  { key: 'ajuda_custo_domingo', label: 'Aj. Custo Domingo' },
  { key: 'ajuda_custo_feriado', label: 'Aj. Custo Feriado' },
  { key: 'insalubridade', label: 'Insalubridade' },
  { key: 'premio', label: 'Premio' },
];
const DESCONTOS = [
  { key: 'falta_dias', label: 'Falta (dias)' },
  { key: 'atraso_horas', label: 'Atraso (horas)' },
  { key: 'desconto_dsr', label: 'Desc. DSR' },
  { key: 'vale_transporte', label: 'Vale Transporte' },
  { key: 'desconto_quebra_caixa', label: 'Desc. Quebra Caixa' },
  { key: 'contribuicao_sindical', label: 'Contrib. Sindical' },
  { key: 'adiantamento', label: 'Adiantamento' },
  { key: 'compras', label: 'Compras' },
];

export class RhFolhaController {
  /**
   * Pivot anual: linhas = lancamento (provento ou desconto), colunas = jan..dez (R$).
   * Filtros opcionais: empresa, colaborador, base (competencia|caixa), tipo (todos|proventos|descontos), lancamento (key especifico).
   * Default: ano = atual, base = competencia, tipo = todos.
   */
  static async resumoAnual(req: Request, res: Response) {
    try {
      const ano = parseInt(req.query.ano as string) || new Date().getFullYear();
      const base = (req.query.base as string) === 'caixa' ? 'mes_caixa' : 'mes_referencia';
      const tipo = (req.query.tipo as string) || 'todos'; // todos | proventos | descontos
      const empresaId = req.query.empresa_id as string | undefined;
      const colaboradorId = req.query.colaborador_id as string | undefined;
      const lancamentoKey = req.query.lancamento as string | undefined;

      // Filtra os lancamentos a retornar
      let lancamentos: { key: string; label: string; tipo: 'provento' | 'desconto' }[] = [
        ...PROVENTOS.map(p => ({ ...p, tipo: 'provento' as const })),
        ...DESCONTOS.map(d => ({ ...d, tipo: 'desconto' as const })),
      ];
      if (tipo === 'proventos') lancamentos = lancamentos.filter(l => l.tipo === 'provento');
      if (tipo === 'descontos') lancamentos = lancamentos.filter(l => l.tipo === 'desconto');
      if (lancamentoKey) lancamentos = lancamentos.filter(l => l.key === lancamentoKey);

      // Monta SQL de agregacao por mes
      const params: any[] = [ano];
      let where = `EXTRACT(YEAR FROM a.${base}) = $1`;
      if (empresaId) { params.push(empresaId); where += ` AND a.company_id = $${params.length}::uuid`; }
      if (colaboradorId) { params.push(Number(colaboradorId)); where += ` AND a.colaborador_id = $${params.length}`; }

      // Para cada lancamento da lista, soma o valor R$ (em campos_extras com sufixo _valor)
      const selects = lancamentos.map(l =>
        `SUM(COALESCE((a.campos_extras->>'${l.key}_valor')::numeric, 0)) AS "${l.key}"`
      ).join(', ');

      const rows = await AppDataSource.query(
        `SELECT EXTRACT(MONTH FROM a.${base})::int AS mes, ${selects}
         FROM rh_apontamentos a
         WHERE ${where} AND a.${base} IS NOT NULL
         GROUP BY EXTRACT(MONTH FROM a.${base})
         ORDER BY mes`,
        params
      );

      // Indexa por mes
      const porMes: Record<number, any> = {};
      for (const r of rows) porMes[r.mes] = r;

      // Monta resultado: 1 linha por lancamento, com 12 colunas + total
      const linhas = lancamentos.map(l => {
        const meses: number[] = [];
        let total = 0;
        for (let m = 1; m <= 12; m++) {
          const v = Number(porMes[m]?.[l.key] || 0);
          meses.push(v);
          total += v;
        }
        return { key: l.key, label: l.label, tipo: l.tipo, meses, total };
      });

      // Total geral por mes (separa proventos vs descontos)
      const totaisProv = Array(12).fill(0);
      const totaisDesc = Array(12).fill(0);
      for (const l of linhas) {
        for (let i = 0; i < 12; i++) {
          if (l.tipo === 'provento') totaisProv[i] += l.meses[i];
          else totaisDesc[i] += l.meses[i];
        }
      }
      const totalProvAno = totaisProv.reduce((a, b) => a + b, 0);
      const totalDescAno = totaisDesc.reduce((a, b) => a + b, 0);

      res.json({
        ano,
        base,
        linhas,
        totaisProv,
        totaisDesc,
        totalProvAno,
        totalDescAno,
        liquidoAno: totalProvAno - totalDescAno,
      });
    } catch (e: any) {
      console.error('[RhFolha] resumoAnual:', e);
      res.status(500).json({ error: e.message });
    }
  }
}
