import { DataSource } from 'typeorm';
import bcrypt from 'bcrypt';
import { User, UserRole } from '../../entities/User';
import { Configuration } from '../../entities/Configuration';

/**
<<<<<<< HEAD
 * Seed do usuário MASTER (Desenvolvedor)
 * Cria automaticamente o usuário Roberto
 * Este usuário tem acesso total ao sistema, incluindo Configurações de Rede
 *
 * IMPORTANTE: Este seed sempre roda na inicialização e cria/atualiza o usuário MASTER
=======
 * Seed do usuário master
 * Cria automaticamente:
 * - Usuário master "Roberto" (sem empresa vinculada)
 * - Configurações essenciais do sistema
 *
 * A empresa será criada no First Setup pelo cliente
>>>>>>> 344b8c2e3c44e4ee7d6eb7d3741a2cfb00c432ad
 */
export async function seedMasterUser(dataSource: DataSource): Promise<void> {
  try {
    console.log('🔧 Verificando usuário MASTER...');

    const userRepository = dataSource.getRepository(User);
<<<<<<< HEAD
=======
    const configRepository = dataSource.getRepository(Configuration);
>>>>>>> 344b8c2e3c44e4ee7d6eb7d3741a2cfb00c432ad

    // Verificar se usuário MASTER Roberto já existe
    let masterUser = await userRepository.findOne({
      where: { username: 'Roberto' }
    });

    if (masterUser) {
      console.log('✅ Usuário MASTER já existe');

      // Garantir que tem role MASTER e senha correta
      const hashedPassword = await bcrypt.hash('Beto3107@@##', 10);

      masterUser.role = UserRole.MASTER;
      masterUser.isMaster = true;
      masterUser.password = hashedPassword;
      masterUser.name = 'Roberto (Desenvolvedor)';
      masterUser.email = 'roberto@prevencaonoradar.com.br';

      await userRepository.save(masterUser);
      console.log('✅ Usuário MASTER atualizado');
      return;
    }

<<<<<<< HEAD
    console.log('👤 Criando usuário MASTER (Desenvolvedor)...');

    // Hash da senha
    const hashedPassword = await bcrypt.hash('Beto3107@@##', 10);

    // Criar usuário MASTER (NÃO vinculado a empresa)
    masterUser = userRepository.create({
      name: 'Roberto (Desenvolvedor)',
      username: 'Roberto',
      email: 'roberto@prevencaonoradar.com.br',
      password: hashedPassword,
      role: UserRole.MASTER,
      isMaster: true,
      companyId: null // MASTER não vinculado a empresa específica
=======
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
>>>>>>> 344b8c2e3c44e4ee7d6eb7d3741a2cfb00c432ad
    });
    await userRepository.save(masterUser);

    console.log('✅ Usuário MASTER criado com sucesso!');
    console.log('📝 Credenciais:');
    console.log('   Usuário: Roberto');
    console.log('   Senha: Beto3107@@##');
<<<<<<< HEAD
    console.log('   Role: MASTER');
    console.log('   Acesso: Total (incluindo Configurações de Rede)');
=======

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
>>>>>>> 344b8c2e3c44e4ee7d6eb7d3741a2cfb00c432ad

  } catch (error) {
    console.error('❌ Erro ao criar/atualizar usuário MASTER:', error);
    // Não lançar erro para não quebrar a aplicação
  }
}
