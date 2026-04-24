import { Response } from 'express';
import PDFDocument from 'pdfkit';
import * as XLSX from 'xlsx';
import { AppDataSource } from '../config/database';
import { AuthRequest } from '../middleware/auth';

const CAMPOS_PROVENTOS = [
  { key: 'hora_extra_60', label: 'HE 60%' },
  { key: 'hora_extra_60_inter', label: 'HE 60% Interj.' },
  { key: 'hora_extra_100', label: 'HE 100%' },
  { key: 'adicional_noturno', label: 'Adic. Noturno' },
  { key: 'quebra_caixa', label: 'Quebra Caixa' },
  { key: 'ajuda_custo_domingo', label: 'Aj. Custo Dom.' },
  { key: 'ajuda_custo_feriado', label: 'Aj. Custo Fer.' },
  { key: 'insalubridade', label: 'Insalubridade' },
  { key: 'premio', label: 'Prêmio' },
];
const CAMPOS_DESCONTOS = [
  { key: 'falta_dias', label: 'Falta (dias)' },
  { key: 'atraso_horas', label: 'Atraso (horas)' },
  { key: 'desconto_dsr', label: 'Desc. DSR' },
  { key: 'vale_transporte', label: 'Vale Transp.' },
  { key: 'desconto_quebra_caixa', label: 'Desc. Quebra Caixa' },
  { key: 'contribuicao_sindical', label: 'Contrib. Sindical' },
  { key: 'adiantamento', label: 'Adiantamento' },
  { key: 'compras', label: 'Compras' },
];
const TODOS_CAMPOS = [...CAMPOS_PROVENTOS, ...CAMPOS_DESCONTOS];

/** Controla lancamentos financeiros (apontamentos) por periodo */
export class RhApontamentosController {
  /** Lista campos customizados (colunas extras de proventos/descontos) */
  static async listarCampos(_req: AuthRequest, res: Response) {
    try {
      const rows = await AppDataSource.query(
        `SELECT * FROM rh_apontamento_campos WHERE ativo = true ORDER BY ordem ASC, id ASC`
      );
      return res.json(rows);
    } catch (err: any) {
      console.error('[APONTAMENTOS] listarCampos:', err);
      return res.status(500).json({ error: err.message });
    }
  }

  /** Cria campo customizado */
  static async criarCampo(req: AuthRequest, res: Response) {
    try {
      const { label, tipo } = req.body;
      if (!label?.trim() || !['provento', 'desconto'].includes(tipo)) {
        return res.status(400).json({ error: 'label e tipo (provento|desconto) obrigatorios' });
      }
      // Gera chave slug
      const chave = 'extra_' + label.toLowerCase()
        .normalize('NFD').replace(/[̀-ͯ]/g, '')
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/^_|_$/g, '')
        .slice(0, 40);
      const [row] = await AppDataSource.query(
        `INSERT INTO rh_apontamento_campos (chave, label, tipo)
         VALUES ($1, $2, $3)
         ON CONFLICT (chave) DO UPDATE SET label = EXCLUDED.label, tipo = EXCLUDED.tipo, ativo = true
         RETURNING *`,
        [chave, label.trim().toUpperCase(), tipo]
      );
      return res.status(201).json(row);
    } catch (err: any) {
      console.error('[APONTAMENTOS] criarCampo:', err);
      return res.status(500).json({ error: err.message });
    }
  }

  /** Deleta campo customizado */
  static async deletarCampo(req: AuthRequest, res: Response) {
    try {
      const id = parseInt(req.params.id);
      await AppDataSource.query(`UPDATE rh_apontamento_campos SET ativo = false WHERE id = $1`, [id]);
      return res.json({ success: true });
    } catch (err: any) {
      console.error('[APONTAMENTOS] deletarCampo:', err);
      return res.status(500).json({ error: err.message });
    }
  }

  /** Lista colaboradores com seus apontamentos do periodo, para montar a grid */
  static async listar(req: AuthRequest, res: Response) {
    try {
      const { company_id, data_inicio, data_fim } = req.query as any;
      if (!data_inicio || !data_fim) return res.status(400).json({ error: 'data_inicio e data_fim obrigatorios' });

      const params: any[] = [data_inicio, data_fim];
      let whereCompany = '';
      if (company_id && company_id !== '') {
        params.push(company_id);
        whereCompany = ` AND c.company_id = $${params.length}`;
      }

      const rows = await AppDataSource.query(`
        SELECT c.id AS colaborador_id, c.nome, c.matricula, c.data_admissao, c.salario, c.foto_url,
               ca.nome AS cargo_nome,
               a.id AS apontamento_id,
               a.hora_extra_60, a.hora_extra_60_inter, a.hora_extra_100, a.adicional_noturno,
               a.quebra_caixa, a.ajuda_custo_domingo, a.ajuda_custo_feriado, a.insalubridade, a.premio,
               a.falta_dias, a.atraso_horas, a.desconto_dsr, a.vale_transporte, a.desconto_quebra_caixa,
               a.contribuicao_sindical, a.adiantamento, a.compras, a.observacao,
               a.campos_extras
        FROM rh_colaboradores c
        LEFT JOIN rh_cargos ca ON ca.id = c.cargo_id
        LEFT JOIN rh_apontamentos a ON a.colaborador_id = c.id
          AND a.data_inicio = $1 AND a.data_fim = $2
        WHERE c.status = 'ativo'${whereCompany}
        ORDER BY c.nome ASC
      `, params);

      return res.json(rows);
    } catch (err: any) {
      console.error('[APONTAMENTOS] listar:', err);
      return res.status(500).json({ error: err.message });
    }
  }

  /** Salva/atualiza em lote os apontamentos de varios colaboradores */
  static async salvarLote(req: AuthRequest, res: Response) {
    try {
      const { data_inicio, data_fim, company_id, apontamentos } = req.body;
      if (!data_inicio || !data_fim || !Array.isArray(apontamentos)) {
        return res.status(400).json({ error: 'data_inicio, data_fim e apontamentos obrigatorios' });
      }
      let salvos = 0;
      for (const a of apontamentos) {
        const num = (v: any) => {
          if (v === '' || v === null || v === undefined) return 0;
          const n = Number(v);
          return isNaN(n) ? 0 : n;
        };
        // Converte campos_extras em JSON (apenas numeros)
        const extras: any = {};
        if (a.campos_extras && typeof a.campos_extras === 'object') {
          for (const k of Object.keys(a.campos_extras)) extras[k] = num(a.campos_extras[k]);
        }
        await AppDataSource.query(`
          INSERT INTO rh_apontamentos (
            colaborador_id, company_id, data_inicio, data_fim,
            hora_extra_60, hora_extra_60_inter, hora_extra_100, adicional_noturno,
            quebra_caixa, ajuda_custo_domingo, ajuda_custo_feriado, insalubridade, premio,
            falta_dias, atraso_horas, desconto_dsr, vale_transporte, desconto_quebra_caixa,
            contribuicao_sindical, adiantamento, compras, observacao, campos_extras
          ) VALUES (
            $1, $2, $3::date, $4::date,
            $5, $6, $7, $8, $9, $10, $11, $12, $13,
            $14, $15, $16, $17, $18, $19, $20, $21, $22, $23::jsonb
          )
          ON CONFLICT (colaborador_id, data_inicio, data_fim) DO UPDATE SET
            company_id = EXCLUDED.company_id,
            hora_extra_60 = EXCLUDED.hora_extra_60,
            hora_extra_60_inter = EXCLUDED.hora_extra_60_inter,
            hora_extra_100 = EXCLUDED.hora_extra_100,
            adicional_noturno = EXCLUDED.adicional_noturno,
            quebra_caixa = EXCLUDED.quebra_caixa,
            ajuda_custo_domingo = EXCLUDED.ajuda_custo_domingo,
            ajuda_custo_feriado = EXCLUDED.ajuda_custo_feriado,
            insalubridade = EXCLUDED.insalubridade,
            premio = EXCLUDED.premio,
            falta_dias = EXCLUDED.falta_dias,
            atraso_horas = EXCLUDED.atraso_horas,
            desconto_dsr = EXCLUDED.desconto_dsr,
            vale_transporte = EXCLUDED.vale_transporte,
            desconto_quebra_caixa = EXCLUDED.desconto_quebra_caixa,
            contribuicao_sindical = EXCLUDED.contribuicao_sindical,
            adiantamento = EXCLUDED.adiantamento,
            compras = EXCLUDED.compras,
            observacao = EXCLUDED.observacao,
            campos_extras = EXCLUDED.campos_extras,
            updated_at = NOW()
        `, [
          a.colaborador_id, company_id || null, data_inicio, data_fim,
          num(a.hora_extra_60), num(a.hora_extra_60_inter), num(a.hora_extra_100), num(a.adicional_noturno),
          num(a.quebra_caixa), num(a.ajuda_custo_domingo), num(a.ajuda_custo_feriado), num(a.insalubridade), num(a.premio),
          num(a.falta_dias), num(a.atraso_horas), num(a.desconto_dsr), num(a.vale_transporte), num(a.desconto_quebra_caixa),
          num(a.contribuicao_sindical), num(a.adiantamento), num(a.compras), a.observacao || null, JSON.stringify(extras)
        ]);
        salvos++;
      }
      return res.json({ success: true, salvos });
    } catch (err: any) {
      console.error('[APONTAMENTOS] salvarLote:', err);
      return res.status(500).json({ error: err.message });
    }
  }

  /** Exporta PDF do apontamento de um periodo */
  static async exportarPdf(req: AuthRequest, res: Response) {
    try {
      const { company_id, data_inicio, data_fim } = req.query as any;
      if (!data_inicio || !data_fim) return res.status(400).json({ error: 'data_inicio e data_fim obrigatorios' });

      const params: any[] = [data_inicio, data_fim];
      let whereCompany = '';
      if (company_id && company_id !== '') { params.push(company_id); whereCompany = ` AND c.company_id = $${params.length}`; }

      const rows = await AppDataSource.query(`
        SELECT c.nome, c.matricula, ca.nome AS cargo_nome, c.salario, c.data_admissao,
               a.*
        FROM rh_colaboradores c
        LEFT JOIN rh_cargos ca ON ca.id = c.cargo_id
        LEFT JOIN rh_apontamentos a ON a.colaborador_id = c.id
          AND a.data_inicio = $1 AND a.data_fim = $2
        WHERE c.status = 'ativo'${whereCompany}
        ORDER BY c.nome ASC
      `, params);

      const doc = new PDFDocument({ size: 'A4', layout: 'landscape', margin: 20 });
      const fname = `apontamento_${data_inicio}_${data_fim}.pdf`;
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${fname}"`);
      doc.pipe(res);

      doc.fontSize(14).fillColor('#1f2937').text('APONTAMENTO DE FOLHA DE PAGAMENTO', { align: 'center' });
      doc.fontSize(10).fillColor('#6b7280').text(`Periodo: ${data_inicio} a ${data_fim}`, { align: 'center' });
      doc.moveDown(0.5);

      // Tabela simples: Nome | Cargo | Salario | Proventos total | Descontos total | Liquido
      doc.fontSize(9).fillColor('#1f2937');
      let y = doc.y;
      const colW = [120, 90, 70, 70, 70, 70];
      const headers = ['Colaborador', 'Cargo', 'Salario', 'Proventos', 'Descontos', 'Liquido'];
      let x = 20;
      doc.rect(20, y, colW.reduce((a, b) => a + b, 0), 18).fill('#f3f4f6');
      doc.fillColor('#1f2937');
      headers.forEach((h, i) => { doc.text(h, x + 4, y + 5, { width: colW[i] - 8 }); x += colW[i]; });
      y += 18;

      for (const r of rows) {
        const proventos = CAMPOS_PROVENTOS.reduce((s, c) => s + Number(r[c.key] || 0), 0);
        const descontos = CAMPOS_DESCONTOS.reduce((s, c) => s + Number(r[c.key] || 0), 0);
        const liquido = Number(r.salario || 0) + proventos - descontos;
        if (y > 560) { doc.addPage(); y = 40; }
        x = 20;
        [r.nome, r.cargo_nome || '-', Number(r.salario || 0).toFixed(2), proventos.toFixed(2), descontos.toFixed(2), liquido.toFixed(2)]
          .forEach((v, i) => { doc.text(String(v), x + 4, y + 4, { width: colW[i] - 8 }); x += colW[i]; });
        y += 16;
      }
      doc.end();
    } catch (err: any) {
      console.error('[APONTAMENTOS] exportarPdf:', err);
      if (!res.headersSent) res.status(500).json({ error: err.message });
    }
  }

  /** Exporta Excel do apontamento de um periodo (layout igual ao original) */
  static async exportarExcel(req: AuthRequest, res: Response) {
    try {
      const { company_id, data_inicio, data_fim } = req.query as any;
      if (!data_inicio || !data_fim) return res.status(400).json({ error: 'data_inicio e data_fim obrigatorios' });

      const params: any[] = [data_inicio, data_fim];
      let whereCompany = '';
      if (company_id && company_id !== '') { params.push(company_id); whereCompany = ` AND c.company_id = $${params.length}`; }

      const rows = await AppDataSource.query(`
        SELECT c.nome, c.matricula, ca.nome AS cargo_nome, c.salario, c.data_admissao,
               a.*
        FROM rh_colaboradores c
        LEFT JOIN rh_cargos ca ON ca.id = c.cargo_id
        LEFT JOIN rh_apontamentos a ON a.colaborador_id = c.id
          AND a.data_inicio = $1 AND a.data_fim = $2
        WHERE c.status = 'ativo'${whereCompany}
        ORDER BY c.nome ASC
      `, params);

      const head = ['Matricula', 'Funcionario', 'Admissao', 'Funcao', 'Salario',
        ...CAMPOS_PROVENTOS.map(c => c.label),
        ...CAMPOS_DESCONTOS.map(c => c.label),
        'Total Proventos', 'Total Descontos', 'Liquido', 'Observacao'];
      const data: any[][] = [head];
      for (const r of rows) {
        const proventos = CAMPOS_PROVENTOS.reduce((s, c) => s + Number(r[c.key] || 0), 0);
        const descontos = CAMPOS_DESCONTOS.reduce((s, c) => s + Number(r[c.key] || 0), 0);
        const liquido = Number(r.salario || 0) + proventos - descontos;
        data.push([
          r.matricula || '',
          r.nome || '',
          r.data_admissao ? new Date(r.data_admissao).toLocaleDateString('pt-BR') : '',
          r.cargo_nome || '',
          Number(r.salario || 0),
          ...CAMPOS_PROVENTOS.map(c => Number(r[c.key] || 0)),
          ...CAMPOS_DESCONTOS.map(c => Number(r[c.key] || 0)),
          proventos,
          descontos,
          liquido,
          r.observacao || '',
        ]);
      }

      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.aoa_to_sheet(data);
      XLSX.utils.book_append_sheet(wb, ws, 'Apontamento');
      const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
      const fname = `apontamento_${data_inicio}_${data_fim}.xlsx`;
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="${fname}"`);
      res.send(buf);
    } catch (err: any) {
      console.error('[APONTAMENTOS] exportarExcel:', err);
      return res.status(500).json({ error: err.message });
    }
  }
}
