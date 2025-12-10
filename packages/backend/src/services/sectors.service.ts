import { AppDataSource } from '../config/database';
import { Sector } from '../entities/Sector';
import { CreateSectorDto } from '../dtos/create-sector.dto';
import { UpdateSectorDto } from '../dtos/update-sector.dto';

export class SectorsService {
  // Gera cor aleatória de paleta profissional
  private static generateRandomColor(): string {
    const palettes = [
      // Material Design Colors
      '#F44336', '#E91E63', '#9C27B0', '#673AB7', '#3F51B5',
      '#2196F3', '#03A9F4', '#00BCD4', '#009688', '#4CAF50',
      '#8BC34A', '#CDDC39', '#FFC107', '#FF9800', '#FF5722',
      // Tailwind CSS Colors
      '#EF4444', '#F97316', '#F59E0B', '#EAB308', '#84CC16',
      '#22C55E', '#10B981', '#14B8A6', '#06B6D4', '#0EA5E9',
      '#3B82F6', '#6366F1', '#8B5CF6', '#A855F7', '#D946EF',
      '#EC4899', '#F43F5E'
    ];
    return palettes[Math.floor(Math.random() * palettes.length)];
  }

  static async findAll(onlyActive: boolean = false) {
    const sectorRepository = AppDataSource.getRepository(Sector);

    if (onlyActive) {
      return sectorRepository.find({ where: { active: true }, order: { name: 'ASC' } });
    }

    return sectorRepository.find({ order: { name: 'ASC' } });
  }

  static async findById(id: number) {
    const sectorRepository = AppDataSource.getRepository(Sector);
    const sector = await sectorRepository.findOne({ where: { id } });

    if (!sector) {
      throw new Error('Sector not found');
    }

    return sector;
  }

  static async create(data: CreateSectorDto) {
    const sectorRepository = AppDataSource.getRepository(Sector);

    // Check if name already exists
    const existingSector = await sectorRepository.findOne({ where: { name: data.name } });
    if (existingSector) {
      throw new Error('Sector name already exists');
    }

    const color = data.color_hash ? data.color_hash.toUpperCase() : this.generateRandomColor();

    const sector = sectorRepository.create({
      name: data.name,
      color_hash: color,
      active: true
    });

    return sectorRepository.save(sector);
  }

  static async update(id: number, data: UpdateSectorDto) {
    const sectorRepository = AppDataSource.getRepository(Sector);

    const sector = await this.findById(id);

    // Check if new name already exists (excluding current sector)
    if (data.name && data.name !== sector.name) {
      const existingSector = await sectorRepository.findOne({ where: { name: data.name } });
      if (existingSector) {
        throw new Error('Sector name already exists');
      }
    }

    if (data.name) {
      sector.name = data.name;
    }

    if (data.color_hash) {
      sector.color_hash = data.color_hash.toUpperCase();
    }

    return sectorRepository.save(sector);
  }

  static async toggleStatus(id: number) {
    const sectorRepository = AppDataSource.getRepository(Sector);

    const sector = await this.findById(id);
    sector.active = !sector.active;

    return sectorRepository.save(sector);
  }
}
