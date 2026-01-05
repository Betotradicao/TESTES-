import { AppDataSource } from '../config/database';
import { User, UserRole } from '../entities/User';

/**
 * Script para criar usuário MASTER (desenvolvedor)
 *
 * Usuário: Roberto
 * Senha: Beto3107@@##
 * Role: MASTER
 *
 * Este usuário é criado automaticamente na inicialização
 * e tem acesso total ao sistema, incluindo Configurações de Rede
 */
async function seedMasterUser() {
  try {
    console.log('🔧 Verificando usuário MASTER...');

    if (!AppDataSource.isInitialized) {
      await AppDataSource.initialize();
    }

    const userRepository = AppDataSource.getRepository(User);

    // Verificar se usuário MASTER já existe
    const existingMaster = await userRepository.findOne({
      where: { username: 'Roberto' }
    });

    if (existingMaster) {
      console.log('✅ Usuário MASTER já existe');

      // Garantir que tem role MASTER
      if (existingMaster.role !== UserRole.MASTER) {
        existingMaster.role = UserRole.MASTER;
        existingMaster.isMaster = true;
        await userRepository.save(existingMaster);
        console.log('✅ Role atualizado para MASTER');
      }

      return;
    }

    // Criar usuário MASTER
    // IMPORTANTE: NÃO fazer hash manual aqui - o @BeforeInsert() do User entity já faz isso
    const masterUser = userRepository.create({
      username: 'Roberto',
      name: 'Roberto (Desenvolvedor)',
      email: 'roberto@prevencaonoradar.com.br',
      password: 'Beto3107@@##', // Senha em texto puro - será hashada pelo @BeforeInsert()
      role: UserRole.MASTER,
      isMaster: true
      // companyId não definido - MASTER não vinculado a empresa específica
    });

    await userRepository.save(masterUser);

    console.log('✅ Usuário MASTER criado com sucesso!');
    console.log('   Username: Roberto');
    console.log('   Email: roberto@prevencaonoradar.com.br');
    console.log('   Role: MASTER');
    console.log('   ⚠️  Senha: Beto3107@@##');

  } catch (error) {
    console.error('❌ Erro ao criar usuário MASTER:', error);
    throw error;
  }
}

// Executar se chamado diretamente
if (require.main === module) {
  seedMasterUser()
    .then(() => {
      console.log('✅ Seed concluído');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Erro no seed:', error);
      process.exit(1);
    });
}

export { seedMasterUser };
