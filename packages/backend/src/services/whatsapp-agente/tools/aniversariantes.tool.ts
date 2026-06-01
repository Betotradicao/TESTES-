import type { ToolDefinition } from '../types';
import { AppDataSource } from '../../../config/database';

export const aniversariantesTool: ToolDefinition = {
  name: 'aniversariantes',
  categoria: 'RH',
  descricao: 'Lista aniversariantes do dia, semana ou mês',
  descricaoGPT: 'Retorna lista de colaboradores aniversariantes. Por padrao do dia de hoje. Use quando perguntar sobre aniversariantes, niver de hoje, niver do mes, parabens funcionario.',
  parameters: {
    type: 'object',
    properties: {
      periodo: {
        type: 'string',
        enum: ['hoje', 'semana', 'mes'],
        description: 'Quando: hoje / semana / mês corrente',
      },
    },
    required: ['periodo'],
  },
  execute: async (params, _ctx) => {
    try {
      const periodo = params.periodo || 'hoje';
      const hoje = new Date();
      let where: string;
      let titulo: string;
      if (periodo === 'hoje') {
        where = `EXTRACT(MONTH FROM data_nascimento) = ${hoje.getMonth() + 1} AND EXTRACT(DAY FROM data_nascimento) = ${hoje.getDate()}`;
        titulo = `🎂 *ANIVERSARIANTES DE HOJE*`;
      } else if (periodo === 'semana') {
        const fim = new Date(hoje); fim.setDate(hoje.getDate() + 7);
        where = `(
          (EXTRACT(MONTH FROM data_nascimento) = ${hoje.getMonth() + 1} AND EXTRACT(DAY FROM data_nascimento) BETWEEN ${hoje.getDate()} AND ${Math.min(hoje.getDate() + 7, 31)})
          OR
          (EXTRACT(MONTH FROM data_nascimento) = ${fim.getMonth() + 1} AND EXTRACT(DAY FROM data_nascimento) <= ${fim.getDate()})
        )`;
        titulo = `🎂 *ANIVERSARIANTES DA SEMANA*`;
      } else {
        where = `EXTRACT(MONTH FROM data_nascimento) = ${hoje.getMonth() + 1}`;
        titulo = `🎂 *ANIVERSARIANTES DO MÊS*`;
      }

      // Tenta diferentes nomes de tabela (varia entre projetos)
      let rows: any[] = [];
      const tabelas = ['rh_colaboradores', 'colaboradores', 'employees'];
      for (const tab of tabelas) {
        try {
          rows = await AppDataSource.query(
            `SELECT nome, data_nascimento,
                    EXTRACT(DAY FROM data_nascimento) AS dia,
                    EXTRACT(MONTH FROM data_nascimento) AS mes
             FROM ${tab}
             WHERE ativo = true AND data_nascimento IS NOT NULL AND ${where}
             ORDER BY EXTRACT(MONTH FROM data_nascimento), EXTRACT(DAY FROM data_nascimento)
             LIMIT 50`
          );
          if (rows) break;
        } catch { /* tenta proxima */ }
      }

      if (!rows.length) return { resposta: `${titulo}\n\nNenhum aniversariante encontrado.` };

      let txt = `${titulo}\n`;
      rows.forEach((r: any) => {
        const dia = String(r.dia).padStart(2, '0');
        const mes = String(r.mes).padStart(2, '0');
        txt += `\n🎉 ${dia}/${mes} - *${r.nome}*`;
      });
      return { resposta: txt, dados: rows };
    } catch (e: any) {
      return { resposta: `❌ Erro: ${e.message}`, erro: e.message };
    }
  },
};
