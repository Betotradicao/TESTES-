import { Response } from 'express';
import { AppDataSource } from '../config/database';
import { Holiday } from '../entities/Holiday';

interface AuthRequest extends Request {
  user?: any;
  query: any;
  params: any;
  body: any;
}

const holidayRepository = AppDataSource.getRepository(Holiday);

// Algoritmo de Meeus para calcular a Páscoa
function calcularPascoa(year: number): Date {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(year, month - 1, day);
}

function formatMMDD(date: Date): string {
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${mm}-${dd}`;
}

// Feriados nacionais fixos (mesma data todo ano)
const FERIADOS_FIXOS = [
  { name: 'Confraternização Universal', date: '01-01' },
  { name: 'Tiradentes', date: '04-21' },
  { name: 'Dia do Trabalho', date: '05-01' },
  { name: 'Independência do Brasil', date: '09-07' },
  { name: 'Nossa Senhora Aparecida', date: '10-12' },
  { name: 'Finados', date: '11-02' },
  { name: 'Proclamação da República', date: '11-15' },
  { name: 'Consciência Negra', date: '11-20' },
  { name: 'Natal', date: '12-25' },
];

// Nomes dos feriados móveis obrigatórios (mudam de data a cada ano)
const NOMES_MOVEIS = ['Sexta-feira Santa'];

function getFeriadosMoveis(year: number): Array<{ name: string; date: string }> {
  const pascoa = calcularPascoa(year);

  const sextaSanta = new Date(pascoa);
  sextaSanta.setDate(sextaSanta.getDate() - 2);

  return [
    { name: 'Sexta-feira Santa', date: formatMMDD(sextaSanta) },
  ];
}

// Atualiza feriados móveis para o ano atual (muda a data MM-DD)
async function atualizarFeriadosMoveis(codLoja: number): Promise<void> {
  const currentYear = new Date().getFullYear();
  const moveis = getFeriadosMoveis(currentYear);

  for (const movel of moveis) {
    const existing = await holidayRepository.findOne({
      where: { name: movel.name, cod_loja: codLoja, type: 'national' },
    });

    if (existing && existing.date !== movel.date) {
      existing.date = movel.date;
      existing.year = currentYear;
      await holidayRepository.save(existing);
    }
  }
}

async function seedNationalHolidays(codLoja: number): Promise<Holiday[]> {
  const currentYear = new Date().getFullYear();
  const todosNacionais = [...FERIADOS_FIXOS, ...getFeriadosMoveis(currentYear)];
  const created: Holiday[] = [];

  for (const feriado of todosNacionais) {
    // Verificar se já existe por nome + loja + tipo national
    const existing = await holidayRepository.findOne({
      where: {
        name: feriado.name,
        cod_loja: codLoja,
        type: 'national',
      },
    });

    if (!existing) {
      const holiday = holidayRepository.create({
        name: feriado.name,
        date: feriado.date,
        year: null,
        type: 'national',
        cod_loja: codLoja,
        active: true,
      });
      const saved = await holidayRepository.save(holiday);
      created.push(saved);
    } else if (existing.date !== feriado.date) {
      // Atualizar data de feriado móvel
      existing.date = feriado.date;
      await holidayRepository.save(existing);
    }
  }

  return created;
}

export class HolidaysController {
  // GET /holidays?cod_loja=1
  static async getAll(req: any, res: Response) {
    try {
      const codLoja = req.query.cod_loja ? parseInt(req.query.cod_loja as string) : undefined;
      const currentYear = new Date().getFullYear();

      const whereClause: any = {};
      if (codLoja !== undefined) {
        whereClause.cod_loja = codLoja;
        // Atualizar feriados móveis para o ano atual
        await atualizarFeriadosMoveis(codLoja);
      }

      const holidays = await holidayRepository.find({
        where: whereClause,
        order: { date: 'ASC' },
      });

      // Adicionar ano atual para exibição no frontend
      const holidaysComAno = holidays.map(h => ({
        ...h,
        year: currentYear,
      }));

      res.json(holidaysComAno);
    } catch (error: any) {
      console.error('Erro ao buscar feriados:', error);
      res.status(500).json({ error: 'Erro ao buscar feriados' });
    }
  }

  // POST /holidays - Criar feriado regional
  static async create(req: any, res: Response) {
    try {
      const { name, date, cod_loja } = req.body;

      if (!name || !date || cod_loja === undefined) {
        return res.status(400).json({ error: 'Campos obrigatórios: name, date, cod_loja' });
      }

      const holiday = holidayRepository.create({
        name,
        date,
        year: null,
        type: 'regional',
        cod_loja,
        active: true,
      });

      const saved = await holidayRepository.save(holiday);
      res.status(201).json(saved);
    } catch (error: any) {
      console.error('Erro ao criar feriado:', error);
      res.status(500).json({ error: 'Erro ao criar feriado' });
    }
  }

  // PUT /holidays/:id - Editar feriado
  static async update(req: any, res: Response) {
    try {
      const id = parseInt(req.params.id);
      const { name, date } = req.body;

      const holiday = await holidayRepository.findOne({ where: { id } });
      if (!holiday) {
        return res.status(404).json({ error: 'Feriado não encontrado' });
      }

      if (name) holiday.name = name;
      if (date) holiday.date = date;

      const saved = await holidayRepository.save(holiday);
      res.json(saved);
    } catch (error: any) {
      console.error('Erro ao atualizar feriado:', error);
      res.status(500).json({ error: 'Erro ao atualizar feriado' });
    }
  }

  // DELETE /holidays/:id - Deletar feriado (somente regional)
  static async delete(req: any, res: Response) {
    try {
      const id = parseInt(req.params.id);

      const holiday = await holidayRepository.findOne({ where: { id } });
      if (!holiday) {
        return res.status(404).json({ error: 'Feriado não encontrado' });
      }

      if (holiday.type === 'national') {
        return res.status(403).json({ error: 'Não é possível deletar feriados nacionais' });
      }

      await holidayRepository.remove(holiday);
      res.json({ message: 'Feriado removido com sucesso' });
    } catch (error: any) {
      console.error('Erro ao deletar feriado:', error);
      res.status(500).json({ error: 'Erro ao deletar feriado' });
    }
  }

  // POST /holidays/seed/:codLoja - Preencher feriados nacionais para uma loja
  static async seedNational(req: any, res: Response) {
    try {
      const codLoja = parseInt(req.params.codLoja);

      await seedNationalHolidays(codLoja);

      // Retornar todos os feriados da loja
      const currentYear = new Date().getFullYear();
      const holidays = await holidayRepository.find({
        where: { cod_loja: codLoja },
        order: { date: 'ASC' },
      });

      const holidaysComAno = holidays.map(h => ({
        ...h,
        year: currentYear,
      }));

      res.json(holidaysComAno);
    } catch (error: any) {
      console.error('Erro ao popular feriados nacionais:', error);
      res.status(500).json({ error: 'Erro ao popular feriados nacionais' });
    }
  }
}
