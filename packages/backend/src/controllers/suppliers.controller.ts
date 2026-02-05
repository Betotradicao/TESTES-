import { Response } from 'express';
import { AppDataSource } from '../config/database';
import { Supplier } from '../entities/Supplier';
import { Company } from '../entities/Company';
import { AuthRequest } from '../middleware/auth';

// Helper para obter companyId (busca primeira empresa se usuário MASTER não tiver companyId)
async function getEffectiveCompanyId(req: AuthRequest): Promise<string | undefined> {
  let companyId = req.user?.companyId;

  // Se usuário é MASTER e não tem companyId, buscar a primeira empresa
  if (!companyId && req.user?.isMaster) {
    const companyRepository = AppDataSource.getRepository(Company);
    const companies = await companyRepository.find({
      order: { createdAt: 'ASC' },
      take: 1
    });
    if (companies.length > 0) {
      companyId = companies[0].id;
    }
  }

  return companyId || undefined;
}

export class SuppliersController {
  // Listar todos os fornecedores
  static async getAll(req: AuthRequest, res: Response) {
    try {
      const companyId = await getEffectiveCompanyId(req);
      const { active, cod_loja } = req.query;

      const supplierRepository = AppDataSource.getRepository(Supplier);

      const whereClause: any = { company_id: companyId };
      if (active !== undefined) {
        whereClause.active = active === 'true';
      }
      // Filtrar por loja se especificado
      if (cod_loja !== undefined) {
        whereClause.cod_loja = parseInt(cod_loja as string);
      }

      const suppliers = await supplierRepository.find({
        where: whereClause,
        order: { fantasyName: 'ASC' }
      });

      res.json(suppliers);
    } catch (error) {
      console.error('Erro ao buscar fornecedores:', error);
      res.status(500).json({ error: 'Erro ao buscar fornecedores' });
    }
  }

  // Buscar fornecedor por ID
  static async getById(req: AuthRequest, res: Response) {
    try {
      const companyId = await getEffectiveCompanyId(req);
      const { id } = req.params;

      const supplierRepository = AppDataSource.getRepository(Supplier);

      const supplier = await supplierRepository.findOne({
        where: { id: parseInt(id), company_id: companyId as string }
      });

      if (!supplier) {
        return res.status(404).json({ error: 'Fornecedor não encontrado' });
      }

      res.json(supplier);
    } catch (error) {
      console.error('Erro ao buscar fornecedor:', error);
      res.status(500).json({ error: 'Erro ao buscar fornecedor' });
    }
  }

  // Criar novo fornecedor
  static async create(req: AuthRequest, res: Response) {
    try {
      const companyId = await getEffectiveCompanyId(req);
      const { fantasyName, legalName, cnpj, phone, email, address, observations, cod_loja } = req.body;

      if (!fantasyName) {
        return res.status(400).json({ error: 'Nome fantasia é obrigatório' });
      }

      const supplierRepository = AppDataSource.getRepository(Supplier);

      const supplier = supplierRepository.create({
        company_id: companyId as string,
        fantasyName,
        legalName,
        cnpj,
        phone,
        email,
        address,
        observations,
        active: true,
        cod_loja: cod_loja ? parseInt(cod_loja) : null
      });

      await supplierRepository.save(supplier);

      res.status(201).json(supplier);
    } catch (error) {
      console.error('Erro ao criar fornecedor:', error);
      res.status(500).json({ error: 'Erro ao criar fornecedor' });
    }
  }

  // Atualizar fornecedor
  static async update(req: AuthRequest, res: Response) {
    try {
      const companyId = await getEffectiveCompanyId(req);
      const { id } = req.params;
      const { fantasyName, legalName, cnpj, phone, email, address, observations, active, cod_loja } = req.body;

      const supplierRepository = AppDataSource.getRepository(Supplier);

      const supplier = await supplierRepository.findOne({
        where: { id: parseInt(id), company_id: companyId as string }
      });

      if (!supplier) {
        return res.status(404).json({ error: 'Fornecedor não encontrado' });
      }

      if (fantasyName !== undefined) supplier.fantasyName = fantasyName;
      if (legalName !== undefined) supplier.legalName = legalName;
      if (cnpj !== undefined) supplier.cnpj = cnpj;
      if (phone !== undefined) supplier.phone = phone;
      if (email !== undefined) supplier.email = email;
      if (address !== undefined) supplier.address = address;
      if (observations !== undefined) supplier.observations = observations;
      if (active !== undefined) supplier.active = active;
      if (cod_loja !== undefined) supplier.cod_loja = cod_loja ? parseInt(cod_loja) : null;

      await supplierRepository.save(supplier);

      res.json(supplier);
    } catch (error) {
      console.error('Erro ao atualizar fornecedor:', error);
      res.status(500).json({ error: 'Erro ao atualizar fornecedor' });
    }
  }

  // Deletar fornecedor
  static async delete(req: AuthRequest, res: Response) {
    try {
      const companyId = await getEffectiveCompanyId(req);
      const { id } = req.params;

      const supplierRepository = AppDataSource.getRepository(Supplier);

      const supplier = await supplierRepository.findOne({
        where: { id: parseInt(id), company_id: companyId as string }
      });

      if (!supplier) {
        return res.status(404).json({ error: 'Fornecedor não encontrado' });
      }

      await supplierRepository.remove(supplier);

      res.json({ message: 'Fornecedor removido com sucesso' });
    } catch (error) {
      console.error('Erro ao deletar fornecedor:', error);
      res.status(500).json({ error: 'Erro ao deletar fornecedor' });
    }
  }
}
