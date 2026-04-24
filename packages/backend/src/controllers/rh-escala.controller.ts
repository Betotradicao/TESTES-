import { Request, Response } from 'express';
import { AppDataSource } from '../config/database';
import { RhEscalaTurno } from '../entities/RhEscalaTurno';
import { RhEscalaTemplate } from '../entities/RhEscalaTemplate';
import { RhEscalaLancamento } from '../entities/RhEscalaLancamento';
import { RhEscalaCobertura } from '../entities/RhEscalaCobertura';
import { RhEscalaFerias } from '../entities/RhEscalaFerias';
import { RhEscalaLicenca } from '../entities/RhEscalaLicenca';
import { RhEscalaExcessao } from '../entities/RhEscalaExcessao';

const turnoRepo = () => AppDataSource.getRepository(RhEscalaTurno);
const templateRepo = () => AppDataSource.getRepository(RhEscalaTemplate);
const lancRepo = () => AppDataSource.getRepository(RhEscalaLancamento);
const coberturaRepo = () => AppDataSource.getRepository(RhEscalaCobertura);
const feriasRepo = () => AppDataSource.getRepository(RhEscalaFerias);
const licencaRepo = () => AppDataSource.getRepository(RhEscalaLicenca);
const excessaoRepo = () => AppDataSource.getRepository(RhEscalaExcessao);

function ymd(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export class RhEscalaController {
  // ============ TURNOS (catalogo) ============
  static async listarTurnos(_req: Request, res: Response) {
    try {
      const rows = await turnoRepo().find({ where: { ativo: true }, order: { tipo: 'ASC', codigo: 'ASC' } });
      res.json(rows);
    } catch (e: any) {
      console.error('[RhEscala] listarTurnos:', e);
      res.status(500).json({ error: e.message });
    }
  }

  static async criarTurno(req: Request, res: Response) {
    try {
      const b = req.body || {};
      if (!b.codigo || !b.nome) return res.status(400).json({ error: 'codigo e nome obrigatorios' });
      const t = turnoRepo().create({
        codigo: String(b.codigo).trim().toUpperCase(),
        nome: String(b.nome).trim(),
        horaInicio: b.horaInicio || null,
        horaFim: b.horaFim || null,
        totalHoras: b.totalHoras != null ? Number(b.totalHoras) : null,
        pausaMinutos: b.pausaMinutos != null ? Number(b.pausaMinutos) : 0,
        tipo: b.tipo || 'turno',
        cor: b.cor || null,
        companyId: b.companyId || null,
        ativo: true,
      });
      await turnoRepo().save(t);
      res.status(201).json(t);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  }

  static async atualizarTurno(req: Request, res: Response) {
    try {
      const t = await turnoRepo().findOne({ where: { id: req.params.id } });
      if (!t) return res.status(404).json({ error: 'Turno nao encontrado' });
      const b = req.body || {};
      if (b.codigo !== undefined) t.codigo = String(b.codigo).trim().toUpperCase();
      if (b.nome !== undefined) t.nome = String(b.nome).trim();
      if (b.horaInicio !== undefined) t.horaInicio = b.horaInicio || null;
      if (b.horaFim !== undefined) t.horaFim = b.horaFim || null;
      if (b.totalHoras !== undefined) t.totalHoras = b.totalHoras != null ? Number(b.totalHoras) : null;
      if (b.pausaMinutos !== undefined) t.pausaMinutos = b.pausaMinutos != null ? Number(b.pausaMinutos) : 0;
      if (b.tipo !== undefined) t.tipo = b.tipo;
      if (b.cor !== undefined) t.cor = b.cor || null;
      if (b.ativo !== undefined) t.ativo = !!b.ativo;
      await turnoRepo().save(t);
      res.json(t);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  }

  static async deletarTurno(req: Request, res: Response) {
    try {
      const t = await turnoRepo().findOne({ where: { id: req.params.id } });
      if (!t) return res.status(404).json({ error: 'Turno nao encontrado' });
      t.ativo = false;
      await turnoRepo().save(t);
      res.json({ success: true });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  }

  // ============ COBERTURA por setor x turno x dia-da-semana ============
  static async listarCobertura(req: Request, res: Response) {
    try {
      const { company_id, departamento_id } = req.query;
      const where: any = {};
      if (company_id) where.companyId = company_id;
      if (departamento_id) where.departamentoId = Number(departamento_id);
      const rows = await coberturaRepo().find({ where });
      res.json(rows);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  }

  static async salvarCobertura(req: Request, res: Response) {
    try {
      // payload: [{ companyId, departamentoId, turnoId, diaSemana, minimo }, ...]
      const items: any[] = Array.isArray(req.body) ? req.body : [];
      for (const it of items) {
        const existing = await coberturaRepo().findOne({
          where: {
            companyId: it.companyId || null,
            departamentoId: it.departamentoId || null,
            turnoId: it.turnoId,
            diaSemana: it.diaSemana,
          },
        });
        if (existing) {
          existing.minimo = Number(it.minimo) || 0;
          await coberturaRepo().save(existing);
        } else {
          await coberturaRepo().save(coberturaRepo().create({
            companyId: it.companyId || null,
            departamentoId: it.departamentoId || null,
            turnoId: it.turnoId,
            diaSemana: Number(it.diaSemana),
            minimo: Number(it.minimo) || 0,
          }));
        }
      }
      res.json({ success: true, total: items.length });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  }

  // ============ TEMPLATES (por colaborador) ============
  static async obterTemplate(req: Request, res: Response) {
    try {
      const t = await templateRepo().findOne({
        where: { colaboradorId: Number(req.params.colaboradorId), ativo: true },
        order: { createdAt: 'DESC' },
      });
      res.json(t || null);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  }

  static async salvarTemplate(req: Request, res: Response) {
    try {
      const colaboradorId = Number(req.params.colaboradorId);
      const b = req.body || {};
      let t = await templateRepo().findOne({ where: { colaboradorId, ativo: true } });
      if (!t) {
        t = templateRepo().create({ colaboradorId, tipoRotacao: '6x1', padraoSemanal: [] });
      }
      if (b.tipoRotacao !== undefined) t.tipoRotacao = b.tipoRotacao;
      if (b.folgaPreferida !== undefined) t.folgaPreferida = b.folgaPreferida || null;
      if (b.trabalhaFeriado !== undefined) t.trabalhaFeriado = !!b.trabalhaFeriado;
      if (b.padraoSemanal !== undefined) t.padraoSemanal = b.padraoSemanal;
      if (b.vigenciaInicio !== undefined) t.vigenciaInicio = b.vigenciaInicio || null;
      if (b.vigenciaFim !== undefined) t.vigenciaFim = b.vigenciaFim || null;
      if (b.observacao !== undefined) t.observacao = b.observacao || null;
      t.ativo = true;
      await templateRepo().save(t);
      res.json(t);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  }

  // ============ GRID MENSAL (com resolucao de camadas) ============
  // GET /rh/escala/grid?company_id=X&departamento_id=Y&mes=2026-03
  static async obterGrid(req: Request, res: Response) {
    try {
      const company_id = req.query.company_id as string | undefined;
      const departamento_id = req.query.departamento_id ? Number(req.query.departamento_id) : undefined;
      const mes = (req.query.mes as string) || ymd(new Date()).slice(0, 7); // YYYY-MM
      const [yr, mn] = mes.split('-').map(Number);
      const primeiroDia = new Date(yr, mn - 1, 1);
      const ultimoDia = new Date(yr, mn, 0);
      const dataInicio = ymd(primeiroDia);
      const dataFim = ymd(ultimoDia);
      const qtdDias = ultimoDia.getDate();

      // Colaboradores do setor/empresa
      const whereParts: string[] = [`c.status = 'ativo'`];
      const params: any[] = [];
      if (company_id) { params.push(company_id); whereParts.push(`c.company_id = $${params.length}::uuid`); }
      if (departamento_id) { params.push(departamento_id); whereParts.push(`c.departamento_id = $${params.length}`); }

      const colaboradores = await AppDataSource.query(
        `SELECT c.id, c.nome, c.matricula, c.foto_url, c.company_id,
                ca.nome AS cargo_nome,
                dep.nome AS setor_nome,
                j.nome AS jornada_nome, j.carga_horaria AS jornada_carga,
                t.tipo_rotacao, t.padrao_semanal, t.trabalha_feriado, t.folga_preferida
         FROM rh_colaboradores c
         LEFT JOIN rh_cargos ca ON ca.id = c.cargo_id
         LEFT JOIN rh_departamentos dep ON dep.id = c.departamento_id
         LEFT JOIN rh_jornadas j ON j.id = c.jornada_id
         LEFT JOIN rh_escala_templates t ON t.colaborador_id = c.id AND t.ativo = true
         WHERE ${whereParts.join(' AND ')}
         ORDER BY c.nome`,
        params
      );

      // Mapa de turnos pra hidratar codigo/cor a partir do id
      const turnos = await turnoRepo().find({ where: { ativo: true } });
      const turnoById = new Map(turnos.map(t => [t.id, t]));
      const turnoByCodigo = new Map(turnos.map(t => [t.codigo, t]));
      const turnoFG = turnoByCodigo.get('FG');
      const turnoFE = turnoByCodigo.get('FE');
      const turnoFR = turnoByCodigo.get('FR');
      const turnoLI = turnoByCodigo.get('LI');

      const colabIds = colaboradores.map((c: any) => c.id);
      if (colabIds.length === 0) {
        return res.json({ mes, qtdDias, colaboradores: [], turnos, feriados: [] });
      }

      // Eventos do periodo
      const [lancamentos, excessoes, ferias, licencas, feriadosRaw] = await Promise.all([
        AppDataSource.query(
          `SELECT colaborador_id, data, turno_id, origem FROM rh_escala_lancamentos
           WHERE colaborador_id = ANY($1::int[]) AND data BETWEEN $2::date AND $3::date`,
          [colabIds, dataInicio, dataFim]
        ),
        AppDataSource.query(
          `SELECT colaborador_id, data, turno_id, motivo FROM rh_escala_excessoes
           WHERE colaborador_id = ANY($1::int[]) AND data BETWEEN $2::date AND $3::date`,
          [colabIds, dataInicio, dataFim]
        ),
        AppDataSource.query(
          `SELECT colaborador_id, data_inicio, data_fim FROM rh_escala_ferias
           WHERE colaborador_id = ANY($1::int[])
             AND NOT (data_fim < $2::date OR data_inicio > $3::date)`,
          [colabIds, dataInicio, dataFim]
        ),
        AppDataSource.query(
          `SELECT colaborador_id, data_inicio, data_fim, motivo FROM rh_escala_licencas
           WHERE colaborador_id = ANY($1::int[])
             AND NOT (data_fim < $2::date OR data_inicio > $3::date)`,
          [colabIds, dataInicio, dataFim]
        ),
        // Feriados: tabela holidays usa date "MM-DD" + cod_loja
        AppDataSource.query(
          `SELECT date, name, cod_loja FROM holidays`
        ),
      ]);

      // Feriados do mes (date em MM-DD) aplicaveis à loja dos colabs (matched por company_id->cod_loja)
      const feriadosPorMMDD = new Map<string, { name: string; cod_loja: number | null }[]>();
      for (const f of feriadosRaw) {
        if (!feriadosPorMMDD.has(f.date)) feriadosPorMMDD.set(f.date, []);
        feriadosPorMMDD.get(f.date)!.push({ name: f.name, cod_loja: f.cod_loja });
      }

      // Monta dias do mes com dia-semana
      const dias: { data: string; diaSemana: number; ehFeriado: boolean; nomeFeriado: string | null }[] = [];
      for (let d = 1; d <= qtdDias; d++) {
        const dt = new Date(yr, mn - 1, d);
        const mmdd = `${String(mn).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
        const feriado = feriadosPorMMDD.get(mmdd);
        dias.push({
          data: ymd(dt),
          diaSemana: dt.getDay(),
          ehFeriado: !!feriado && feriado.length > 0,
          nomeFeriado: feriado && feriado.length > 0 ? feriado[0].name : null,
        });
      }

      // Indexa eventos por colaborador+data
      const excPorChave = new Map<string, any>();
      for (const e of excessoes) excPorChave.set(`${e.colaborador_id}|${e.data}`, e);
      const feriasPorColab = new Map<string, { ini: string; fim: string }[]>();
      for (const f of ferias) {
        if (!feriasPorColab.has(f.colaborador_id)) feriasPorColab.set(f.colaborador_id, []);
        feriasPorColab.get(f.colaborador_id)!.push({ ini: f.data_inicio, fim: f.data_fim });
      }
      const licencasPorColab = new Map<string, { ini: string; fim: string; motivo: string | null }[]>();
      for (const l of licencas) {
        if (!licencasPorColab.has(l.colaborador_id)) licencasPorColab.set(l.colaborador_id, []);
        licencasPorColab.get(l.colaborador_id)!.push({ ini: l.data_inicio, fim: l.data_fim, motivo: l.motivo });
      }
      const lancPorChave = new Map<string, any>();
      for (const l of lancamentos) lancPorChave.set(`${l.colaborador_id}|${l.data}`, l);

      // Para cada colaborador, resolve cada dia em ordem de precedencia:
      // excessao > ferias > licenca > feriado(se !trabalha_feriado) > lancamento manual > template
      const colaboradoresOut = colaboradores.map((c: any) => {
        const padraoSemanal: (string | null)[][] = Array.isArray(c.padrao_semanal) ? c.padrao_semanal : [];
        const ciclo = padraoSemanal.length || 0;
        const trabalhaFeriado = c.trabalha_feriado !== false;
        const ferPeriodos = feriasPorColab.get(c.id) || [];
        const licPeriodos = licencasPorColab.get(c.id) || [];

        const celulas = dias.map((dia, idx) => {
          const chave = `${c.id}|${dia.data}`;
          let origem = 'template';
          let turnoId: string | null = null;
          let observacao: string | null = null;

          // 1. Excessao
          const exc = excPorChave.get(chave);
          if (exc) {
            origem = 'excessao';
            turnoId = exc.turno_id;
            observacao = exc.motivo;
          } else if (ferPeriodos.some(p => dia.data >= p.ini && dia.data <= p.fim)) {
            // 2. Ferias
            origem = 'ferias';
            turnoId = turnoFE?.id || null;
          } else if (licPeriodos.some(p => dia.data >= p.ini && dia.data <= p.fim)) {
            // 3. Licenca
            const per = licPeriodos.find(p => dia.data >= p.ini && dia.data <= p.fim)!;
            origem = 'licenca';
            turnoId = turnoLI?.id || null;
            observacao = per.motivo;
          } else if (dia.ehFeriado && !trabalhaFeriado) {
            // 4. Feriado (se colab nao trabalha em feriado)
            origem = 'feriado';
            turnoId = turnoFR?.id || null;
          } else {
            // 5. Lancamento manual salvo (se houver override manual na tabela lancamentos)
            const lan = lancPorChave.get(chave);
            if (lan && lan.origem === 'manual') {
              origem = 'manual';
              turnoId = lan.turno_id;
            } else if (ciclo > 0) {
              // 6. Template: aplica a semana do ciclo (idx da semana do mes % ciclo)
              const semanaDoMes = Math.floor(idx / 7);
              const padraoSemana = padraoSemanal[semanaDoMes % ciclo] || [];
              const slot = padraoSemana[dia.diaSemana];
              if (slot) turnoId = slot;
            }
          }

          const turno = turnoId ? turnoById.get(turnoId) : null;
          return {
            data: dia.data,
            diaSemana: dia.diaSemana,
            ehFeriado: dia.ehFeriado,
            nomeFeriado: dia.nomeFeriado,
            origem,
            observacao,
            turnoId,
            codigo: turno?.codigo || null,
            cor: turno?.cor || null,
            totalHoras: turno?.totalHoras ? Number(turno.totalHoras) : 0,
          };
        });

        // Total horas do mes (soma total_horas dos turnos)
        const horasMes = celulas.reduce((s, c) => s + (c.totalHoras || 0), 0);

        return {
          id: c.id,
          nome: c.nome,
          matricula: c.matricula,
          fotoUrl: c.foto_url,
          cargoNome: c.cargo_nome,
          setorNome: c.setor_nome,
          jornadaNome: c.jornada_nome,
          jornadaCarga: c.jornada_carga,
          tipoRotacao: c.tipo_rotacao,
          temTemplate: Array.isArray(c.padrao_semanal) && c.padrao_semanal.length > 0,
          celulas,
          horasMes: Math.round(horasMes * 100) / 100,
        };
      });

      res.json({
        mes,
        qtdDias,
        dias,
        turnos,
        colaboradores: colaboradoresOut,
      });
    } catch (e: any) {
      console.error('[RhEscala] obterGrid:', e);
      res.status(500).json({ error: e.message });
    }
  }

  // ============ LANCAMENTO MANUAL (editar celula) ============
  static async salvarCelulaManual(req: Request, res: Response) {
    try {
      const { colaboradorId, data, turnoId, observacao } = req.body || {};
      if (!colaboradorId || !data) return res.status(400).json({ error: 'colaboradorId e data obrigatorios' });
      const cid = Number(colaboradorId);
      let l = await lancRepo().findOne({ where: { colaboradorId: cid, data } });
      if (!l) {
        l = lancRepo().create({ colaboradorId: cid, data, turnoId: turnoId || null, origem: 'manual', observacao });
      } else {
        l.turnoId = turnoId || null;
        l.origem = 'manual';
        l.observacao = observacao || null;
      }
      await lancRepo().save(l);
      res.json(l);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  }

  static async limparCelulaManual(req: Request, res: Response) {
    try {
      const { colaboradorId, data } = req.body || {};
      await lancRepo().delete({ colaboradorId: Number(colaboradorId), data });
      res.json({ success: true });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  }

  // ============ EVENTOS: FERIAS / LICENCAS / EXCESSOES ============
  static async listarFerias(req: Request, res: Response) {
    try {
      const { colaborador_id } = req.query;
      const where: any = {};
      if (colaborador_id) where.colaboradorId = Number(colaborador_id);
      const rows = await feriasRepo().find({ where, order: { dataInicio: 'DESC' } });
      res.json(rows);
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  }
  static async criarFerias(req: Request, res: Response) {
    try {
      const b = req.body || {};
      if (!b.colaboradorId || !b.dataInicio || !b.dataFim) return res.status(400).json({ error: 'obrigatorios' });
      const f = feriasRepo().create({ colaboradorId: Number(b.colaboradorId), dataInicio: b.dataInicio, dataFim: b.dataFim, observacao: b.observacao || null });
      await feriasRepo().save(f);
      res.status(201).json(f);
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  }
  static async deletarFerias(req: Request, res: Response) {
    try { await feriasRepo().delete({ id: req.params.id }); res.json({ success: true }); }
    catch (e: any) { res.status(500).json({ error: e.message }); }
  }

  static async listarLicencas(req: Request, res: Response) {
    try {
      const { colaborador_id } = req.query;
      const where: any = {};
      if (colaborador_id) where.colaboradorId = Number(colaborador_id);
      const rows = await licencaRepo().find({ where, order: { dataInicio: 'DESC' } });
      res.json(rows);
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  }
  static async criarLicenca(req: Request, res: Response) {
    try {
      const b = req.body || {};
      if (!b.colaboradorId || !b.dataInicio || !b.dataFim) return res.status(400).json({ error: 'obrigatorios' });
      const l = licencaRepo().create({ colaboradorId: Number(b.colaboradorId), dataInicio: b.dataInicio, dataFim: b.dataFim, motivo: b.motivo || null, arquivoUrl: b.arquivoUrl || null });
      await licencaRepo().save(l);
      res.status(201).json(l);
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  }
  static async deletarLicenca(req: Request, res: Response) {
    try { await licencaRepo().delete({ id: req.params.id }); res.json({ success: true }); }
    catch (e: any) { res.status(500).json({ error: e.message }); }
  }

  static async listarExcessoes(req: Request, res: Response) {
    try {
      const { colaborador_id } = req.query;
      const where: any = {};
      if (colaborador_id) where.colaboradorId = Number(colaborador_id);
      const rows = await excessaoRepo().find({ where, order: { data: 'DESC' } });
      res.json(rows);
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  }
  static async criarExcessao(req: Request, res: Response) {
    try {
      const b = req.body || {};
      if (!b.colaboradorId || !b.data) return res.status(400).json({ error: 'obrigatorios' });
      const cid = Number(b.colaboradorId);
      let e = await excessaoRepo().findOne({ where: { colaboradorId: cid, data: b.data } });
      if (!e) {
        e = excessaoRepo().create({ colaboradorId: cid, data: b.data, turnoId: b.turnoId || null, motivo: b.motivo || null });
      } else {
        e.turnoId = b.turnoId || null;
        e.motivo = b.motivo || null;
      }
      await excessaoRepo().save(e);
      res.status(201).json(e);
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  }
  static async deletarExcessao(req: Request, res: Response) {
    try { await excessaoRepo().delete({ id: req.params.id }); res.json({ success: true }); }
    catch (e: any) { res.status(500).json({ error: e.message }); }
  }
}
