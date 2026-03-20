import { AppDataSource } from '../config/database';
import { Equipment } from '../entities/Equipment';
import { Company } from '../entities/Company';
import { UpdateEquipmentDto } from '../dtos/update-equipment.dto';

export class EquipmentsService {
  static async findAll() {
    const equipmentRepository = AppDataSource.getRepository(Equipment);
    const companyRepository = AppDataSource.getRepository(Company);

    const equipments = await equipmentRepository.find({
      relations: ['sector'],
      order: { scanner_machine_id: 'ASC' }
    });

    // Buscar apelidos das lojas
    const companies = await companyRepository.find({
      where: { active: true },
      select: ['codLoja', 'apelido']
    });
    const apelidosMap = new Map<number, string>();
    companies.forEach(c => {
      if (c.codLoja && c.apelido) {
        apelidosMap.set(c.codLoja, c.apelido);
      }
    });

    // Adicionar apelido aos equipamentos
    return equipments.map(eq => ({
      ...eq,
      loja_apelido: eq.cod_loja ? (apelidosMap.get(eq.cod_loja) || null) : null
    }));
  }

  static async findById(id: number) {
    const equipmentRepository = AppDataSource.getRepository(Equipment);
    const equipment = await equipmentRepository.findOne({
      where: { id },
      relations: ['sector']
    });

    if (!equipment) {
      throw new Error('Equipment not found');
    }

    return equipment;
  }

  static async update(id: number, data: UpdateEquipmentDto) {
    console.log(`\n🔧 EQUIPMENTS SERVICE - update`);
    console.log(`   ID: ${id}`);
    console.log(`   Data recebida:`, JSON.stringify(data, null, 2));

    const equipmentRepository = AppDataSource.getRepository(Equipment);

    // Busca sem relações para evitar problemas com o TypeORM
    const equipment = await equipmentRepository.findOne({ where: { id } });

    if (!equipment) {
      throw new Error('Equipment not found');
    }

    console.log(`   Equipamento antes:`, JSON.stringify({
      sector_id: equipment.sector_id,
      color_hash: equipment.color_hash,
      description: equipment.description,
      cod_loja: equipment.cod_loja
    }, null, 2));

    if (data.sector_id !== undefined) {
      equipment.sector_id = data.sector_id;
    }

    if (data.color_hash) {
      equipment.color_hash = data.color_hash.toUpperCase();
    }

    if (data.description !== undefined) {
      equipment.description = data.description;
    }

    if (data.cod_loja !== undefined) {
      console.log(`   🏪 Atualizando cod_loja: ${equipment.cod_loja} -> ${data.cod_loja}`);
      equipment.cod_loja = data.cod_loja;
    }

    if (data.ean_digits !== undefined) {
      equipment.ean_digits = data.ean_digits;
    }

    console.log(`   Equipamento depois:`, JSON.stringify({
      sector_id: equipment.sector_id,
      color_hash: equipment.color_hash,
      description: equipment.description,
      cod_loja: equipment.cod_loja
    }, null, 2));

    await equipmentRepository.save(equipment);
    console.log(`   ✅ Equipamento salvo com sucesso`);

    // Recarrega com a relação atualizada
    return this.findById(id);
  }

  static async toggleStatus(id: number) {
    const equipmentRepository = AppDataSource.getRepository(Equipment);

    const equipment = await equipmentRepository.findOne({ where: { id } });

    if (!equipment) {
      throw new Error('Equipment not found');
    }

    equipment.active = !equipment.active;

    await equipmentRepository.save(equipment);

    return this.findById(id);
  }

  /**
   * Extrai o número da porta física do device_path
   * Formato esperado: \\?\HID#VID_XXXX&PID_YYYY#[PORT_NUMBER]&...
   * NOTA: Este número NÃO é a porta USB física, é um ID interno do Windows
   */
  private static extractPortNumber(devicePath?: string): string | undefined {
    if (!devicePath) return undefined;

    // Regex para capturar o número após o segundo # e antes do &
    const match = devicePath.match(/#(\d+)&/);
    return match ? `#${match[1]}` : undefined;
  }

  static async findOrCreateByScannerId(scanner_machine_id: string, machine_id: string, device_path?: string) {
    const equipmentRepository = AppDataSource.getRepository(Equipment);

    const portNumber = this.extractPortNumber(device_path);

    console.log(`\n🔍 EQUIPMENTS SERVICE - findOrCreateByScannerId`);
    console.log(`   Scanner ID físico: ${scanner_machine_id}`);
    console.log(`   Machine ID: ${machine_id}`);
    console.log(`   Device Path: ${device_path}`);
    console.log(`   Porta USB extraída: ${portNumber}`);

    // IDENTIFICAÇÃO POR SCANNER FÍSICO (scanner_machine_id)
    // Cada scanner físico = 1 equipamento único
    // Busca APENAS por scanner_machine_id, pois machine_id pode mudar
    let equipment = await equipmentRepository.findOne({
      where: {
        scanner_machine_id
      }
    });

    if (equipment) {
      console.log(`   ✅ Equipamento ENCONTRADO - ID: ${equipment.id}, Scanner: ${scanner_machine_id}`);

      // Atualizar machine_id e port_number se mudaram
      let hasChanges = false;

      if (equipment.machine_id !== machine_id) {
        console.log(`   🔄 Machine ID mudou de "${equipment.machine_id}" para "${machine_id}"`);
        equipment.machine_id = machine_id;
        hasChanges = true;
      }

      if (portNumber && equipment.port_number !== portNumber) {
        console.log(`   🔄 Porta USB mudou de "${equipment.port_number}" para "${portNumber}"`);
        equipment.port_number = portNumber;
        hasChanges = true;
      }

      if (hasChanges) {
        await equipmentRepository.save(equipment);
        console.log(`   ✅ Equipamento atualizado`);
      }
    } else {
      console.log(`   ❌ Equipamento NÃO ENCONTRADO - Criando novo para scanner ${scanner_machine_id}...`);

      const colors = [
        '#F44336', '#E91E63', '#9C27B0', '#673AB7', '#3F51B5',
        '#2196F3', '#03A9F4', '#00BCD4', '#009688', '#4CAF50',
        '#8BC34A', '#CDDC39', '#FFC107', '#FF9800', '#FF5722'
      ];
      const randomColor = colors[Math.floor(Math.random() * colors.length)];

      equipment = equipmentRepository.create({
        scanner_machine_id,
        machine_id,
        port_number: portNumber,
        color_hash: randomColor,
        description: 'Scanner cadastrado automaticamente',
        sector_id: undefined,
        active: true,
        cod_loja: null // null = Todas as Lojas (configurar manualmente depois)
      });

      await equipmentRepository.save(equipment);
      console.log(`   🎉 Novo equipamento cadastrado - ID: ${equipment.id}, Scanner: ${scanner_machine_id}, Porta: ${portNumber || 'desconhecida'}`);
    }

    return equipment;
  }

  static async delete(id: number) {
    const equipmentRepository = AppDataSource.getRepository(Equipment);

    const equipment = await equipmentRepository.findOne({ where: { id } });

    if (!equipment) {
      throw new Error('Equipment not found');
    }

    await equipmentRepository.remove(equipment);

    return { message: 'Equipment deleted successfully' };
  }
}
