import 'reflect-metadata';
import { AppDataSource } from '../config/database';

async function clearEquipments() {
  try {
    console.log('🔄 Conectando ao banco de dados...');
    await AppDataSource.initialize();
    console.log('✅ Conectado!');

    const queryRunner = AppDataSource.createQueryRunner();

    console.log('\n🗑️  Limpando equipamentos...');

    // 1. Apagar sessões de equipamentos
    console.log('1️⃣  Apagando sessões de equipamentos...');
    await queryRunner.query('DELETE FROM equipment_sessions');
    console.log('   ✅ Sessões apagadas');

    // 2. Remover referências de equipamentos nas bipagens
    console.log('2️⃣  Removendo referências nas bipagens...');
    await queryRunner.query('UPDATE bips SET equipment_id = NULL WHERE equipment_id IS NOT NULL');
    console.log('   ✅ Referências removidas');

    // 3. Apagar todos os equipamentos
    console.log('3️⃣  Apagando equipamentos...');
    const result = await queryRunner.query('DELETE FROM equipments');
    console.log('   ✅ Equipamentos apagados');

    // 4. Resetar sequência para começar do ID 1
    console.log('4️⃣  Resetando sequência para ID 1...');
    await queryRunner.query('ALTER SEQUENCE equipments_id_seq RESTART WITH 1');
    console.log('   ✅ Sequência resetada');

    // Verificar
    const [{ count }] = await queryRunner.query('SELECT COUNT(*) as count FROM equipments');
    console.log(`\n✅ Limpeza concluída! Total de equipamentos: ${count}`);
    console.log('🎯 Próximo equipamento será ID 1 (Scaner 1)\n');

    await queryRunner.release();
    await AppDataSource.destroy();

  } catch (error) {
    console.error('❌ Erro ao limpar equipamentos:', error);
    process.exit(1);
  }
}

clearEquipments();
