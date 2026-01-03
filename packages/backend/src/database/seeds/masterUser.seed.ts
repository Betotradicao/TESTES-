import { DataSource } from 'typeorm';
import bcrypt from 'bcrypt';
import { User, UserRole } from '../../entities/User';
import { Company } from '../../entities/Company';
import { Configuration } from '../../entities/Configuration';

/**
 * Seed completo do sistema
 * Cria automaticamente:
 * - Empresa padrão
 * - Usuário master "Beto"
 * - Configurações essenciais do sistema
 */
export async function seedMasterUser(dataSource: DataSource): Promise<void> {
  try {
    console.log('🌱 Iniciando seed do sistema...');

    const userRepository = dataSource.getRepository(User);
    const companyRepository = dataSource.getRepository(Company);
    const configRepository = dataSource.getRepository(Configuration);

    // Verificar se já existe algum usuário master
    const existingMaster = await userRepository.findOne({
      where: { isMaster: true }
    });

    if (existingMaster) {
      console.log('✅ Sistema já inicializado. Pulando seed...');
      return;
    }

    console.log('🏢 Criando empresa padrão...');

    // Criar empresa padrão
    const company = companyRepository.create({
      nomeFantasia: 'Empresa Padrão',
      razaoSocial: 'Empresa Padrão LTDA',
      cnpj: '00000000000000'
    });
    await companyRepository.save(company);
    console.log('✅ Empresa criada:', company.nomeFantasia);

    console.log('👤 Criando usuário master...');

    // Hash da senha
    const hashedPassword = await bcrypt.hash('Beto3107@@##', 10);

    // Criar usuário master vinculado à empresa
    const masterUser = userRepository.create({
      name: 'Roberto',
      username: 'Roberto',
      email: 'admin@prevencao.com.br',
      password: hashedPassword,
      role: UserRole.MASTER,
      isMaster: true,
      companyId: company.id
    });
    await userRepository.save(masterUser);

    console.log('✅ Usuário master criado com sucesso!');
    console.log('📝 Credenciais:');
    console.log('   Usuário: Roberto');
    console.log('   Senha: Beto3107@@##');

    console.log('⚙️  Criando configurações do sistema...');

    // Configurações essenciais
    const configs = [
      { key: 'system_initialized', value: 'true' },
      { key: 'email_monitor_enabled', value: 'false' }
    ];

    for (const config of configs) {
      const existing = await configRepository.findOne({ where: { key: config.key } });
      if (!existing) {
        const newConfig = configRepository.create(config);
        await configRepository.save(newConfig);
        console.log(`   ✓ ${config.key}: ${config.value}`);
      }
    }

    console.log('✅ Seed completo! Sistema pronto para uso.');

  } catch (error) {
    console.error('❌ Erro ao executar seed:', error);
    // Não lançar erro para não quebrar a aplicação
  }
}
