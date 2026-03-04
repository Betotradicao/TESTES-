import { AppDataSource } from '../config/database';
import { Meta } from '../entities/Meta';
import { MetaResponsavel } from '../entities/MetaResponsavel';
import { In } from 'typeorm';

export class MetasService {
  static async findAll(codLoja?: number | null, ano?: number, mes?: number) {
    const metaRepository = AppDataSource.getRepository(Meta);

    const where: any = {};
    if (codLoja !== undefined && codLoja !== null) {
      where.cod_loja = codLoja;
    }
    if (ano) where.ano = ano;
    if (mes) where.mes = mes;

    return metaRepository.find({
      where,
      relations: ['responsaveis', 'responsaveis.employee'],
      order: { ano: 'DESC', mes: 'DESC', created_at: 'DESC' },
    });
  }

  static async findById(id: string) {
    const metaRepository = AppDataSource.getRepository(Meta);
    const meta = await metaRepository.findOne({
      where: { id },
      relations: ['responsaveis', 'responsaveis.employee'],
    });

    if (!meta) {
      throw new Error('Meta not found');
    }

    return meta;
  }

  static async create(data: {
    nome: string;
    tipo?: string;
    indicador?: string;
    mes: number;
    ano: number;
    cod_loja?: number | null;
    inflacao?: number;
    crescimento?: number;
    total_crescimento?: number;
    responsaveis?: string[];
  }) {
    const metaRepository = AppDataSource.getRepository(Meta);
    const responsavelRepository = AppDataSource.getRepository(MetaResponsavel);

    const meta = metaRepository.create({
      nome: data.nome,
      tipo: data.tipo || 'loja',
      indicador: data.indicador || 'lucro',
      mes: data.mes,
      ano: data.ano,
      cod_loja: data.cod_loja ?? null,
      inflacao: data.inflacao || 0,
      crescimento: data.crescimento || 0,
      total_crescimento: data.total_crescimento || 0,
      ativo: true,
    });

    const savedMeta = await metaRepository.save(meta);

    // Add responsaveis
    if (data.responsaveis && data.responsaveis.length > 0) {
      const responsaveis = data.responsaveis.map((employeeId) =>
        responsavelRepository.create({
          meta_id: savedMeta.id,
          employee_id: employeeId,
        })
      );
      await responsavelRepository.save(responsaveis);
    }

    return this.findById(savedMeta.id);
  }

  static async update(
    id: string,
    data: {
      nome?: string;
      tipo?: string;
      indicador?: string;
      mes?: number;
      ano?: number;
      cod_loja?: number | null;
      inflacao?: number;
      crescimento?: number;
      total_crescimento?: number;
      responsaveis?: string[];
    }
  ) {
    const metaRepository = AppDataSource.getRepository(Meta);
    const responsavelRepository = AppDataSource.getRepository(MetaResponsavel);

    const meta = await this.findById(id);

    if (data.nome !== undefined) meta.nome = data.nome;
    if (data.tipo !== undefined) meta.tipo = data.tipo;
    if (data.indicador !== undefined) meta.indicador = data.indicador;
    if (data.mes !== undefined) meta.mes = data.mes;
    if (data.ano !== undefined) meta.ano = data.ano;
    if (data.cod_loja !== undefined) meta.cod_loja = data.cod_loja;
    if (data.inflacao !== undefined) meta.inflacao = data.inflacao;
    if (data.crescimento !== undefined) meta.crescimento = data.crescimento;
    if (data.total_crescimento !== undefined) meta.total_crescimento = data.total_crescimento;

    await metaRepository.save(meta);

    // Update responsaveis if provided
    if (data.responsaveis !== undefined) {
      // Remove existing
      await responsavelRepository.delete({ meta_id: id });

      // Add new
      if (data.responsaveis.length > 0) {
        const responsaveis = data.responsaveis.map((employeeId) =>
          responsavelRepository.create({
            meta_id: id,
            employee_id: employeeId,
          })
        );
        await responsavelRepository.save(responsaveis);
      }
    }

    return this.findById(id);
  }

  static async delete(id: string) {
    const metaRepository = AppDataSource.getRepository(Meta);
    await this.findById(id); // Verify exists
    await metaRepository.delete(id);
  }

  static async toggleStatus(id: string) {
    const metaRepository = AppDataSource.getRepository(Meta);
    const meta = await this.findById(id);
    meta.ativo = !meta.ativo;
    await metaRepository.save(meta);
    return this.findById(id);
  }
}
