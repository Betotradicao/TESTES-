import { AppDataSource } from '../config/database';
import { User, UserRole } from '../entities/User';
import bcrypt from 'bcryptjs';

/**
 * Script para criar o usuário master padrão do sistema
 * Este usuário é criado automaticamente em toda instalação nova
 *
 * Usuário: Roberto
 * Senha: Beto3107@@##
 * isMaster: true
 */
async function createMasterUser() {
  try {
    console.log('🔧 Iniciando criação do usuário master...');

    if (!AppDataSource.isInitialized) {
      await AppDataSource.initialize();
    }

    const userRepository = AppDataSource.getRepository(User);

    // Verificar se já existe usuário master
    const existingMaster = await userRepository.findOne({
      where: { username: 'Roberto' }
    });

    if (existingMaster) {
      console.log('✅ Usuário master Roberto já existe');

      // Atualizar senha e garantir que é master
      const hashedPassword = await bcrypt.hash('Beto3107@@##', 10);
      existingMaster.password = hashedPassword;
      existingMaster.isMaster = true;
      existingMaster.role = UserRole.ADMIN;

      await userRepository.save(existingMaster);
      console.log('✅ Senha e permissões do usuário master atualizadas');

      process.exit(0);
      return;
    }

    // Criar novo usuário master
    const hashedPassword = await bcrypt.hash('Beto3107@@##', 10);

    const masterUser = userRepository.create({
      name: 'ROBERTO BASTOS RUIVO',
      username: 'Roberto',
      email: 'betotradicao76@gmail.com',
      password: hashedPassword,
      role: UserRole.ADMIN,
      isMaster: true,
      active: true,
    });

    await userRepository.save(masterUser);

    console.log('✅ Usuário master criado com sucesso!');
    console.log('   Username: Roberto');
    console.log('   Senha: Beto3107@@##');
    console.log('   Email: betotradicao76@gmail.com');
    console.log('   isMaster: true');

    process.exit(0);
  } catch (error) {
    console.error('❌ Erro ao criar usuário master:', error);
    process.exit(1);
  }
}

// Executar se chamado diretamente
if (require.main === module) {
  createMasterUser();
}

export default createMasterUser;
