import { Request, Response } from 'express';
import { AppDataSource } from '../config/database';
import { Company } from '../entities/Company';
import { User, UserRole } from '../entities/User';
import bcrypt from 'bcrypt';

const companyRepository = AppDataSource.getRepository(Company);
const userRepository = AppDataSource.getRepository(User);

export class CompaniesController {
  // Listar todas as empresas (apenas master)
  async index(req: Request, res: Response) {
    try {
      const companies = await companyRepository.find({
        order: { createdAt: 'DESC' }
      });

      return res.json(companies);
    } catch (error) {
      console.error('Error fetching companies:', error);
      return res.status(500).json({ error: 'Failed to fetch companies' });
    }
  }

  // Buscar empresa por ID
  async show(req: Request, res: Response) {
    try {
      const { id } = req.params;

      const company = await companyRepository.findOne({
        where: { id }
      });

      if (!company) {
        return res.status(404).json({ error: 'Company not found' });
      }

      return res.json(company);
    } catch (error) {
      console.error('Error fetching company:', error);
      return res.status(500).json({ error: 'Failed to fetch company' });
    }
  }

  // Criar nova empresa (apenas master)
  async create(req: Request, res: Response) {
    try {
      const { nomeFantasia, razaoSocial, cnpj, adminEmail, adminPassword } = req.body;

      // Validar dados
      if (!nomeFantasia || !razaoSocial || !cnpj) {
        return res.status(400).json({ error: 'Missing required fields' });
      }

      // Verificar se CNPJ já existe
      const existingCompany = await companyRepository.findOne({ where: { cnpj } });
      if (existingCompany) {
        return res.status(400).json({ error: 'CNPJ already registered' });
      }

      // Criar empresa
      const company = companyRepository.create({
        nomeFantasia,
        razaoSocial,
        cnpj,
        active: true
      });

      await companyRepository.save(company);

      // Criar usuário administrador da empresa se fornecido
      if (adminEmail && adminPassword) {
        const existingUser = await userRepository.findOne({ where: { email: adminEmail } });
        if (existingUser) {
          return res.status(400).json({ error: 'Admin email already registered' });
        }

        const hashedPassword = await bcrypt.hash(adminPassword, 10);
        const adminUser = userRepository.create({
          email: adminEmail,
          password: hashedPassword,
          role: UserRole.ADMIN,
          isMaster: false,
          companyId: company.id
        });

        await userRepository.save(adminUser);
      }

      return res.status(201).json(company);
    } catch (error) {
      console.error('Error creating company:', error);
      return res.status(500).json({ error: 'Failed to create company' });
    }
  }

  // Atualizar empresa
  async update(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const { nomeFantasia, razaoSocial, cnpj, active } = req.body;

      const company = await companyRepository.findOne({ where: { id } });
      if (!company) {
        return res.status(404).json({ error: 'Company not found' });
      }

      // Verificar se CNPJ já existe (se estiver sendo alterado)
      if (cnpj && cnpj !== company.cnpj) {
        const existingCompany = await companyRepository.findOne({ where: { cnpj } });
        if (existingCompany) {
          return res.status(400).json({ error: 'CNPJ already registered' });
        }
      }

      // Atualizar dados
      if (nomeFantasia) company.nomeFantasia = nomeFantasia;
      if (razaoSocial) company.razaoSocial = razaoSocial;
      if (cnpj) company.cnpj = cnpj;
      if (typeof active === 'boolean') company.active = active;

      await companyRepository.save(company);

      return res.json(company);
    } catch (error) {
      console.error('Error updating company:', error);
      return res.status(500).json({ error: 'Failed to update company' });
    }
  }

  // Deletar empresa (apenas master)
  async delete(req: Request, res: Response) {
    try {
      const { id } = req.params;

      const company = await companyRepository.findOne({
        where: { id }
      });

      if (!company) {
        return res.status(404).json({ error: 'Company not found' });
      }

      // Verificar se há usuários vinculados
      const usersCount = await userRepository.count({ where: { companyId: id } });
      if (usersCount > 0) {
        return res.status(400).json({
          error: 'Cannot delete company with active users. Please remove all users first.'
        });
      }

      await companyRepository.remove(company);

      return res.json({ message: 'Company deleted successfully' });
    } catch (error) {
      console.error('Error deleting company:', error);
      return res.status(500).json({ error: 'Failed to delete company' });
    }
  }

  // Buscar empresa do usuário logado
  async getMyCompany(req: Request, res: Response) {
    try {
      const userId = (req as any).userId;
      console.log('🔍 getMyCompany - userId:', userId);

      const user = await userRepository.findOne({
        where: { id: userId },
        relations: ['company']
      });

      console.log('🔍 getMyCompany - user:', user ? { id: user.id, companyId: user.companyId, hasCompany: !!user.company } : null);

      if (!user) {
        console.log('❌ getMyCompany - User not found');
        return res.status(404).json({ error: 'User not found' });
      }

      if (!user.company) {
        console.log('❌ getMyCompany - No company loaded. companyId:', user.companyId);

        // Tentar buscar a empresa diretamente
        if (user.companyId) {
          const company = await companyRepository.findOne({ where: { id: user.companyId } });
          console.log('🔍 getMyCompany - Buscou empresa diretamente:', company ? { id: company.id, nome: company.nomeFantasia } : null);

          if (company) {
            return res.json(company);
          }
        }

        // Usuário MASTER não tem empresa vinculada - busca a primeira empresa disponível
        if (user.isMaster) {
          console.log('ℹ️  getMyCompany - Usuário MASTER sem empresa vinculada, buscando primeira empresa...');
          const companies = await companyRepository.find({
            order: { createdAt: 'ASC' },
            take: 1
          });
          const firstCompany = companies.length > 0 ? companies[0] : null;

          if (firstCompany) {
            console.log('✅ getMyCompany - Primeira empresa encontrada para MASTER:', { id: firstCompany.id, nome: firstCompany.nomeFantasia });
            return res.json(firstCompany);
          }

          console.log('ℹ️  getMyCompany - Nenhuma empresa cadastrada no sistema');
          return res.json(null);
        }

        return res.status(404).json({ error: 'No company associated with this user' });
      }

      console.log('✅ getMyCompany - Company found:', { id: user.company.id, nome: user.company.nomeFantasia });
      return res.json(user.company);
    } catch (error) {
      console.error('❌ Error fetching user company:', error);
      return res.status(500).json({ error: 'Failed to fetch company' });
    }
  }

  // Atualizar empresa do usuário logado (apenas admin da empresa ou master)
  async updateMyCompany(req: Request, res: Response) {
    try {
      const userId = (req as any).userId;
      const {
        nomeFantasia, razaoSocial, cnpj,
        cep, rua, numero, complemento, bairro, cidade, estado,
        telefone, email,
        responsavelNome, responsavelEmail, responsavelTelefone
      } = req.body;

      const user = await userRepository.findOne({
        where: { id: userId },
        relations: ['company']
      });

      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }

      let company: Company | null = user.company;

      // Se usuário é MASTER e não tem empresa vinculada, busca a primeira empresa
      if (!company && user.isMaster) {
        const companies = await companyRepository.find({
          order: { createdAt: 'ASC' },
          take: 1
        });
        company = companies.length > 0 ? companies[0] : null;
      }

      if (!company) {
        return res.status(404).json({ error: 'Company not found' });
      }

      // Verificar se usuário é admin da empresa ou master
      if (user.role !== UserRole.ADMIN && !user.isMaster) {
        return res.status(403).json({ error: 'Only company admin can update company info' });
      }

      // Verificar se CNPJ já existe (se estiver sendo alterado)
      if (cnpj && cnpj !== company.cnpj) {
        const existingCompany = await companyRepository.findOne({ where: { cnpj } });
        if (existingCompany && existingCompany.id !== company.id) {
          return res.status(400).json({ error: 'CNPJ already registered' });
        }
      }

      // Atualizar dados básicos
      if (nomeFantasia !== undefined) company.nomeFantasia = nomeFantasia;
      if (razaoSocial !== undefined) company.razaoSocial = razaoSocial;
      if (cnpj !== undefined) company.cnpj = cnpj;
      if (telefone !== undefined) company.telefone = telefone;
      if (email !== undefined) company.email = email;

      // Atualizar endereço
      if (cep !== undefined) company.cep = cep;
      if (rua !== undefined) company.rua = rua;
      if (numero !== undefined) company.numero = numero;
      if (complemento !== undefined) company.complemento = complemento;
      if (bairro !== undefined) company.bairro = bairro;
      if (cidade !== undefined) company.cidade = cidade;
      if (estado !== undefined) company.estado = estado;

      // Atualizar responsável
      if (responsavelNome !== undefined) company.responsavelNome = responsavelNome;
      if (responsavelEmail !== undefined) company.responsavelEmail = responsavelEmail;
      if (responsavelTelefone !== undefined) company.responsavelTelefone = responsavelTelefone;

      await companyRepository.save(company);

      return res.json(company);
    } catch (error) {
      console.error('Error updating company:', error);
      return res.status(500).json({ error: 'Failed to update company' });
    }
  }
}
