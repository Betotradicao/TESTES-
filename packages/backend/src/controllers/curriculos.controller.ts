import { Request, Response } from 'express';
import { AppDataSource } from '../config/database';
import { CurriculoCargo } from '../entities/CurriculoCargo';
import { CurriculoHabilidade } from '../entities/CurriculoHabilidade';
import { Curriculo, CurriculoStatus } from '../entities/Curriculo';
import { ILike } from 'typeorm';
import { minioService } from '../services/minio.service';

export class CurriculosController {
  // ========== CARGOS (catalogo editavel) ==========
  static async listarCargos(_req: Request, res: Response) {
    try {
      const cargos = await AppDataSource.getRepository(CurriculoCargo).find({
        order: { ordem: 'ASC', nome: 'ASC' },
      });
      res.json({ success: true, cargos });
    } catch (e: any) {
      console.error('[Curriculos] listarCargos:', e);
      res.status(500).json({ success: false, error: e.message });
    }
  }

  static async criarCargo(req: Request, res: Response) {
    try {
      const { nome } = req.body;
      if (!nome?.trim()) return res.status(400).json({ success: false, error: 'nome obrigatorio' });
      const repo = AppDataSource.getRepository(CurriculoCargo);
      const existe = await repo.findOne({ where: { nome: ILike(nome.trim()) } });
      if (existe) return res.status(400).json({ success: false, error: 'Cargo ja existe' });
      const cargo = repo.create({ nome: nome.trim().toUpperCase(), ativo: true });
      await repo.save(cargo);
      res.json({ success: true, cargo });
    } catch (e: any) {
      console.error('[Curriculos] criarCargo:', e);
      res.status(500).json({ success: false, error: e.message });
    }
  }

  static async atualizarCargo(req: Request, res: Response) {
    try {
      const id = parseInt(req.params.id);
      const { nome, ativo, ordem } = req.body;
      const repo = AppDataSource.getRepository(CurriculoCargo);
      const cargo = await repo.findOne({ where: { id } });
      if (!cargo) return res.status(404).json({ success: false, error: 'Cargo nao encontrado' });
      if (nome !== undefined) cargo.nome = String(nome).trim().toUpperCase();
      if (ativo !== undefined) cargo.ativo = !!ativo;
      if (ordem !== undefined) cargo.ordem = Number(ordem) || 0;
      await repo.save(cargo);
      res.json({ success: true, cargo });
    } catch (e: any) {
      console.error('[Curriculos] atualizarCargo:', e);
      res.status(500).json({ success: false, error: e.message });
    }
  }

  static async deletarCargo(req: Request, res: Response) {
    try {
      const id = parseInt(req.params.id);
      const repo = AppDataSource.getRepository(CurriculoCargo);
      const cargo = await repo.findOne({ where: { id } });
      if (!cargo) return res.status(404).json({ success: false, error: 'Cargo nao encontrado' });
      await repo.remove(cargo);
      res.json({ success: true });
    } catch (e: any) {
      console.error('[Curriculos] deletarCargo:', e);
      res.status(500).json({ success: false, error: e.message });
    }
  }

  // ========== HABILIDADES (catalogo editavel) ==========
  static async listarHabilidades(_req: Request, res: Response) {
    try {
      const habilidades = await AppDataSource.getRepository(CurriculoHabilidade).find({
        order: { ordem: 'ASC', nome: 'ASC' },
      });
      res.json({ success: true, habilidades });
    } catch (e: any) {
      console.error('[Curriculos] listarHabilidades:', e);
      res.status(500).json({ success: false, error: e.message });
    }
  }

  static async criarHabilidade(req: Request, res: Response) {
    try {
      const { nome } = req.body;
      if (!nome?.trim()) return res.status(400).json({ success: false, error: 'nome obrigatorio' });
      const repo = AppDataSource.getRepository(CurriculoHabilidade);
      const existe = await repo.findOne({ where: { nome: ILike(nome.trim()) } });
      if (existe) return res.status(400).json({ success: false, error: 'Habilidade ja existe' });
      const h = repo.create({ nome: nome.trim().toUpperCase(), ativo: true });
      await repo.save(h);
      res.json({ success: true, habilidade: h });
    } catch (e: any) {
      console.error('[Curriculos] criarHabilidade:', e);
      res.status(500).json({ success: false, error: e.message });
    }
  }

  static async atualizarHabilidade(req: Request, res: Response) {
    try {
      const id = parseInt(req.params.id);
      const { nome, ativo, ordem } = req.body;
      const repo = AppDataSource.getRepository(CurriculoHabilidade);
      const h = await repo.findOne({ where: { id } });
      if (!h) return res.status(404).json({ success: false, error: 'Habilidade nao encontrada' });
      if (nome !== undefined) h.nome = String(nome).trim().toUpperCase();
      if (ativo !== undefined) h.ativo = !!ativo;
      if (ordem !== undefined) h.ordem = Number(ordem) || 0;
      await repo.save(h);
      res.json({ success: true, habilidade: h });
    } catch (e: any) {
      console.error('[Curriculos] atualizarHabilidade:', e);
      res.status(500).json({ success: false, error: e.message });
    }
  }

  static async deletarHabilidade(req: Request, res: Response) {
    try {
      const id = parseInt(req.params.id);
      const repo = AppDataSource.getRepository(CurriculoHabilidade);
      const h = await repo.findOne({ where: { id } });
      if (!h) return res.status(404).json({ success: false, error: 'Habilidade nao encontrada' });
      await repo.remove(h);
      res.json({ success: true });
    } catch (e: any) {
      console.error('[Curriculos] deletarHabilidade:', e);
      res.status(500).json({ success: false, error: e.message });
    }
  }

  // ========== PUBLICO (formulario do candidato) ==========

  /** Devolve as listas ativas de cargos e habilidades para o formulario publico */
  static async obterFormularioPublico(_req: Request, res: Response) {
    try {
      const [cargos, habilidades] = await Promise.all([
        AppDataSource.getRepository(CurriculoCargo).find({ where: { ativo: true }, order: { ordem: 'ASC', nome: 'ASC' } }),
        AppDataSource.getRepository(CurriculoHabilidade).find({ where: { ativo: true }, order: { ordem: 'ASC', nome: 'ASC' } }),
      ]);
      res.json({
        success: true,
        cargos: cargos.map(c => c.nome),
        habilidades: habilidades.map(h => h.nome),
      });
    } catch (e: any) {
      console.error('[Curriculos] obterFormularioPublico:', e);
      res.status(500).json({ success: false, error: e.message });
    }
  }

  /** Upload publico de foto do candidato (para o currículo) */
  static async uploadFotoPublico(req: Request, res: Response) {
    try {
      const file = (req as any).file;
      if (!file) return res.status(400).json({ success: false, error: 'Arquivo obrigatorio' });
      const ext = (file.originalname || 'jpg').split('.').pop() || 'jpg';
      const objectName = `curriculos/fotos/${Date.now()}_${Math.random().toString(36).slice(2, 10)}.${ext}`;
      const url = await minioService.uploadFile(objectName, file.buffer, file.mimetype || 'image/jpeg');
      res.json({ success: true, url });
    } catch (e: any) {
      console.error('[Curriculos] uploadFotoPublico:', e);
      res.status(500).json({ success: false, error: e.message });
    }
  }

  /** Recebe o currículo enviado pelo candidato (publico, sem auth) */
  static async enviarCurriculoPublico(req: Request, res: Response) {
    try {
      const {
        nome, data_nascimento, whatsapp, email, instagram,
        cep, rua, numero, complemento, bairro, cidade, estado,
        cargos, habilidades, experiencia_texto,
        foto_url, resumo, experiencias_detalhadas, formacoes, cursos_adicionais,
        interesse_vaga,
      } = req.body;

      if (!nome?.trim()) return res.status(400).json({ success: false, error: 'Nome obrigatorio' });
      if (interesse_vaga !== 'clt' && interesse_vaga !== 'aprendiz') {
        return res.status(400).json({ success: false, error: 'Interesse de vaga obrigatorio (CLT ou Aprendiz)' });
      }

      const repo = AppDataSource.getRepository(Curriculo);
      const cv = repo.create({
        nome: String(nome).trim(),
        data_nascimento: data_nascimento || null,
        whatsapp: whatsapp || null,
        email: email || null,
        instagram: instagram || null,
        linkedin: null,
        cep: cep || null,
        rua: rua || null,
        numero: numero || null,
        complemento: complemento || null,
        bairro: bairro || null,
        cidade: cidade || null,
        estado: estado || null,
        cargos: Array.isArray(cargos) ? cargos : [],
        habilidades: Array.isArray(habilidades) ? habilidades : [],
        experiencia_texto: experiencia_texto || null,
        foto_url: foto_url || null,
        resumo: resumo || null,
        interesse_vaga,
        experiencias_detalhadas: Array.isArray(experiencias_detalhadas) ? experiencias_detalhadas : [],
        formacoes: Array.isArray(formacoes) ? formacoes : [],
        cursos_adicionais: Array.isArray(cursos_adicionais) ? cursos_adicionais : [],
        status: 'novo',
      });
      await repo.save(cv);
      res.json({ success: true, id: cv.id });
    } catch (e: any) {
      console.error('[Curriculos] enviarCurriculoPublico:', e);
      res.status(500).json({ success: false, error: e.message });
    }
  }

  // ========== BANCO (autenticado, RH) ==========

  static async listarCurriculos(req: Request, res: Response) {
    try {
      const { cidade, bairro, cargo, habilidade, status, dataDe, dataAte, q, interesse_vaga } = req.query as any;
      const qb = AppDataSource.getRepository(Curriculo).createQueryBuilder('c').orderBy('c.created_at', 'DESC').take(500);
      if (cidade) qb.andWhere('c.cidade ILIKE :cidade', { cidade: `%${cidade}%` });
      if (bairro) qb.andWhere('c.bairro ILIKE :bairro', { bairro: `%${bairro}%` });
      if (cargo) qb.andWhere(`c.cargos @> :cargo::jsonb`, { cargo: JSON.stringify([cargo]) });
      if (habilidade) qb.andWhere(`c.habilidades @> :habilidade::jsonb`, { habilidade: JSON.stringify([habilidade]) });
      if (status) qb.andWhere('c.status = :status', { status });
      if (interesse_vaga) qb.andWhere('c.interesse_vaga = :interesse', { interesse: interesse_vaga });
      if (dataDe) qb.andWhere('c.created_at >= :dataDe', { dataDe });
      if (dataAte) {
        const dt = new Date(dataAte); dt.setHours(23, 59, 59, 999);
        qb.andWhere('c.created_at <= :dataAte', { dataAte: dt });
      }
      if (q) qb.andWhere('(c.nome ILIKE :q OR c.whatsapp ILIKE :q OR c.email ILIKE :q)', { q: `%${q}%` });

      const lista = await qb.getMany();
      // Resumo pra cards
      const resumo = {
        total: lista.length,
        novo: lista.filter(c => c.status === 'novo').length,
        em_analise: lista.filter(c => c.status === 'em_analise').length,
        aprovado: lista.filter(c => c.status === 'aprovado').length,
        reprovado: lista.filter(c => c.status === 'reprovado').length,
        contratado: lista.filter(c => c.status === 'contratado').length,
      };
      res.json({ success: true, curriculos: lista, resumo });
    } catch (e: any) {
      console.error('[Curriculos] listarCurriculos:', e);
      res.status(500).json({ success: false, error: e.message });
    }
  }

  static async obterCurriculo(req: Request, res: Response) {
    try {
      const id = parseInt(req.params.id);
      const cv = await AppDataSource.getRepository(Curriculo).findOne({ where: { id } });
      if (!cv) return res.status(404).json({ success: false, error: 'Curriculo nao encontrado' });
      res.json({ success: true, curriculo: cv });
    } catch (e: any) {
      console.error('[Curriculos] obterCurriculo:', e);
      res.status(500).json({ success: false, error: e.message });
    }
  }

  static async atualizarCurriculo(req: Request, res: Response) {
    try {
      const id = parseInt(req.params.id);
      const { status, avaliacao_rh, observacao_rh } = req.body;
      const repo = AppDataSource.getRepository(Curriculo);
      const cv = await repo.findOne({ where: { id } });
      if (!cv) return res.status(404).json({ success: false, error: 'Curriculo nao encontrado' });

      if (status !== undefined) {
        const statusOk: CurriculoStatus[] = ['novo', 'em_analise', 'aprovado', 'reprovado', 'contratado'];
        if (!statusOk.includes(status)) return res.status(400).json({ success: false, error: 'status invalido' });
        cv.status = status;
      }
      if (avaliacao_rh !== undefined) {
        const n = Number(avaliacao_rh);
        cv.avaliacao_rh = isNaN(n) ? null : Math.max(0, Math.min(5, n));
      }
      if (observacao_rh !== undefined) cv.observacao_rh = observacao_rh || null;
      await repo.save(cv);
      res.json({ success: true, curriculo: cv });
    } catch (e: any) {
      console.error('[Curriculos] atualizarCurriculo:', e);
      res.status(500).json({ success: false, error: e.message });
    }
  }

  static async deletarCurriculo(req: Request, res: Response) {
    try {
      const id = parseInt(req.params.id);
      const repo = AppDataSource.getRepository(Curriculo);
      const cv = await repo.findOne({ where: { id } });
      if (!cv) return res.status(404).json({ success: false, error: 'Curriculo nao encontrado' });
      await repo.remove(cv);
      res.json({ success: true });
    } catch (e: any) {
      console.error('[Curriculos] deletarCurriculo:', e);
      res.status(500).json({ success: false, error: e.message });
    }
  }
}
