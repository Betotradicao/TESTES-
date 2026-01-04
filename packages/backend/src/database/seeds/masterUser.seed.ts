import { DataSource } from 'typeorm';
import bcrypt from 'bcrypt';
import { User, UserRole } from '../../entities/User';
import { Configuration } from '../../entities/Configuration';

/**
 * Seed do usuário master
 * Cria automaticamente:
 * - Usuário master "Roberto" (sem empresa vinculada)
 * - Configurações essenciais do sistema
 *
 * A empresa será criada no First Setup pelo cliente
 */
export async function seedMasterUser(dataSource: DataSource): Promise<void> {
  try {
    console.log('🌱 Iniciando seed do sistema...');

    const userRepository = dataSource.getRepository(User);
    const configRepository = dataSource.getRepository(Configuration);

    // Verificar se já existe algum usuário master
    const existingMaster = await userRepository.findOne({
      where: { isMaster: true }
    });

    if (existingMaster) {
      console.log('✅ Sistema já inicializado. Pulando seed...');
      return;
    }

    console.log('👤 Criando usuário master...');

    // Criar usuário master SEM vincular a empresa
    // A empresa será criada no First Setup pelo cliente
    // IMPORTANTE: Senha em texto puro - o @BeforeInsert() da entidade User fará o hash
    const masterUser = userRepository.create({
      name: 'Roberto',
      username: 'Roberto',
      email: 'admin@prevencao.com.br',
      password: 'Beto3107@@##', // Texto puro - será hasheado pelo @BeforeInsert()
      role: UserRole.MASTER,
      isMaster: true
      // companyId não definido - será associado no First Setup
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
