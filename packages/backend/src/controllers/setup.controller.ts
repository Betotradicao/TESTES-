import { Request, Response } from 'express';
import { AppDataSource } from '../config/database';
import { User, UserRole } from '../entities/User';
import { Company } from '../entities/Company';
import * as fs from 'fs';
import * as path from 'path';

export class SetupController {
  // Verifica se o sistema precisa de setup inicial
  static async checkSetupStatus(req: Request, res: Response) {
    try {
      // Verificar se o banco de dados está inicializado
      if (!AppDataSource.isInitialized) {
        console.log('⚠️ Setup Status: Banco de dados ainda não está pronto, aguardando...');
        return res.json({
          needsSetup: true,
          message: 'Banco de dados inicializando... Aguarde alguns segundos.'
        });
      }

      const userRepository = AppDataSource.getRepository(User);

      // Verificar se existe pelo menos um usuário que NÃO seja o master Roberto
      // O sistema precisa de setup se só existe o usuário master (ou nenhum usuário)
      const adminUsers = await userRepository.count({
        where: { username: 'Roberto', isMaster: true }
      });

      const totalUsers = await userRepository.count();

      // Se só existe o master Roberto (ou nenhum usuário), precisa de setup
      const needsSetup = totalUsers === 0 || (totalUsers === 1 && adminUsers === 1);

      return res.json({
        needsSetup,
        message: needsSetup ? 'Sistema precisa de configuração inicial' : 'Sistema já configurado'
      });
    } catch (error) {
      console.error('Erro ao verificar status do setup:', error);
      return res.status(500).json({ error: 'Erro ao verificar status do sistema' });
    }
  }

  // Realiza o setup inicial: cria empresa e usuário admin vinculado
  static async performSetup(req: Request, res: Response) {
    try {
      // Verificar se o banco de dados está inicializado
      if (!AppDataSource.isInitialized) {
        console.log('⚠️ Setup Initialize: Banco de dados ainda não está pronto');
        return res.status(503).json({
          error: 'Banco de dados ainda não está pronto. Aguarde alguns segundos e tente novamente.'
        });
      }

      const {
        // Dados do Admin
        adminUsername,
        adminName,
        adminEmail,
        adminPassword,
        // Dados da Empresa
        nomeFantasia,
        razaoSocial,
        cnpj,
        responsavelNome,
        responsavelEmail,
        responsavelTelefone,
        // Endereço
        cep,
        rua,
        numero,
        complemento,
        bairro,
        cidade,
        estado,
        telefone,
        email,
        // Email de Envio
        emailUser,
        emailPass,
        welcomeMessage
      } = req.body;

      // Validações
      if (!adminUsername || !adminName || !adminEmail || !adminPassword) {
        return res.status(400).json({ error: 'Dados do administrador são obrigatórios' });
      }

      if (!nomeFantasia || !razaoSocial || !cnpj) {
        return res.status(400).json({ error: 'Dados da empresa são obrigatórios' });
      }

      // Verificar se já existe algum usuário além do master Roberto
      const userRepository = AppDataSource.getRepository(User);
      const totalUsers = await userRepository.count();
      const masterRoberto = await userRepository.count({
        where: { username: 'Roberto', isMaster: true }
      });

      // Se existem mais usuários além do Roberto, sistema já foi configurado
      if (totalUsers > 1 || (totalUsers === 1 && masterRoberto === 0)) {
        return res.status(400).json({ error: 'Sistema já foi configurado' });
      }

      // Verificar se username já existe
      const existingUsername = await userRepository.findOne({ where: { username: adminUsername } });
      if (existingUsername) {
        return res.status(400).json({ error: 'Nome de usuário já está em uso' });
      }

      // Verificar se email já existe
      const existingEmail = await userRepository.findOne({ where: { email: adminEmail } });
      if (existingEmail) {
        return res.status(400).json({ error: 'Email já está em uso' });
      }

      // Verificar se CNPJ já existe
      const companyRepository = AppDataSource.getRepository(Company);
      const cnpjLimpo = cnpj.replace(/\D/g, '');
      const existingCompany = await companyRepository.findOne({ where: { cnpj: cnpjLimpo } });

      if (existingCompany) {
        return res.status(400).json({ error: 'CNPJ já cadastrado' });
      }

      // Criar empresa
      const company = companyRepository.create({
        nomeFantasia,
        razaoSocial,
        cnpj: cnpjLimpo,
        responsavelNome,
        responsavelEmail,
        responsavelTelefone,
        cep,
        rua,
        numero,
        complemento,
        bairro,
        cidade,
        estado,
        telefone,
        email,
        active: true
      });

      await companyRepository.save(company);
      console.log('✅ Empresa criada:', company.nomeFantasia);

      // Criar usuário admin vinculado à empresa
      const adminUser = userRepository.create({
        username: adminUsername,
        name: adminName,
        email: adminEmail,
        password: adminPassword, // Será hasheado pelo @BeforeInsert
        role: UserRole.ADMIN,
        isMaster: true,
        companyId: company.id
      });

      await userRepository.save(adminUser);
      console.log('✅ Usuário admin criado:', adminUser.username, '/', adminUser.email);

      return res.status(201).json({
        message: 'Setup realizado com sucesso',
        company: {
          id: company.id,
          nomeFantasia: company.nomeFantasia,
          razaoSocial: company.razaoSocial,
          cnpj: company.cnpj
        },
        admin: {
          id: adminUser.id,
          username: adminUser.username,
          name: adminUser.name,
          email: adminUser.email,
          role: adminUser.role,
          isMaster: adminUser.isMaster
        }
      });

    } catch (error: any) {
      console.error('Erro ao realizar setup:', error);

      if (error.code === '23505') { // Unique violation
        return res.status(400).json({ error: 'Email, usuário ou CNPJ já cadastrado' });
      }

      return res.status(500).json({ error: 'Erro ao configurar sistema' });
    }
  }
}
