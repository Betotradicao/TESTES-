import { AppDataSource } from '../config/database';

async function runMigrations() {
  try {
    console.log('🔌 Conectando ao banco de dados...');
    await AppDataSource.initialize();

    console.log('🏃 Rodando migrações pendentes...');
    const migrations = await AppDataSource.runMigrations();

    if (migrations.length === 0) {
      console.log('✅ Nenhuma migração pendente!');
    } else {
      console.log(`✅ ${migrations.length} migrações executadas com sucesso:`);
      migrations.forEach(migration => {
        console.log(`   - ${migration.name}`);
      });
    }

    await AppDataSource.destroy();
    process.exit(0);
  } catch (error) {
    console.error('❌ Erro ao executar migrações:', error);
    process.exit(1);
  }
}

runMigrations();
