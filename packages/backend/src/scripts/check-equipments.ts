import { AppDataSource } from '../config/database';
import { Equipment } from '../entities/Equipment';

async function checkEquipments() {
  try {
    await AppDataSource.initialize();
    const equipmentRepository = AppDataSource.getRepository(Equipment);
    const all = await equipmentRepository.find();

    console.log('=== EQUIPAMENTOS NO BANCO ===');
    all.forEach(e => {
      console.log(`ID: ${e.id} | scanner_machine_id: ${e.scanner_machine_id} | machine_id: ${e.machine_id}`);
    });
    console.log(`Total: ${all.length}`);

    await AppDataSource.destroy();
  } catch (error) {
    console.error('Erro:', error);
    process.exit(1);
  }
}

checkEquipments();
