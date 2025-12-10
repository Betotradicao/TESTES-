import { AppDataSource } from '../config/database';
import { EquipmentSession } from '../entities/EquipmentSession';
import { Equipment } from '../entities/Equipment';
import { Employee } from '../entities/Employee';
import { Between } from 'typeorm';

export class EquipmentSessionsService {
  /**
   * Faz login de um colaborador em um equipamento
   * - Desativa QUALQUER sessão ativa naquele equipamento (desloga colaborador anterior)
   * - Cria nova sessão ativa
   */
  static async loginEmployee(equipmentId: number, employeeId: string): Promise<EquipmentSession> {
    const sessionRepository = AppDataSource.getRepository(EquipmentSession);
    const equipmentRepository = AppDataSource.getRepository(Equipment);
    const employeeRepository = AppDataSource.getRepository(Employee);

    // Verificar se equipamento existe
    const equipment = await equipmentRepository.findOne({ where: { id: equipmentId } });
    if (!equipment) {
      throw new Error('Equipment not found');
    }

    // Verificar se colaborador existe e está ativo
    const employee = await employeeRepository.findOne({ where: { id: employeeId } });
    if (!employee) {
      throw new Error('Employee not found');
    }
    if (!employee.active) {
      throw new Error('Employee is inactive');
    }

    // Desativar QUALQUER sessão ativa naquele equipamento (desloga quem estiver logado)
    await sessionRepository
      .createQueryBuilder()
      .update(EquipmentSession)
      .set({
        active: false,
        logged_out_at: new Date()
      })
      .where('equipment_id = :equipmentId', { equipmentId })
      .andWhere('active = :active', { active: true })
      .execute();

    // Criar nova sessão
    const newSession = sessionRepository.create({
      equipment_id: equipmentId,
      employee_id: employeeId,
      logged_in_at: new Date(),
      active: true,
    });

    await sessionRepository.save(newSession);

    // Retornar sessão com relacionamentos
    return await sessionRepository.findOne({
      where: { id: newSession.id },
      relations: ['employee', 'employee.sector', 'equipment'],
    }) as EquipmentSession;
  }

  /**
   * Faz logout do colaborador logado em um equipamento
   */
  static async logoutEmployee(equipmentId: number): Promise<void> {
    const sessionRepository = AppDataSource.getRepository(EquipmentSession);

    await sessionRepository
      .createQueryBuilder()
      .update(EquipmentSession)
      .set({
        active: false,
        logged_out_at: new Date()
      })
      .where('equipment_id = :equipmentId', { equipmentId })
      .andWhere('active = :active', { active: true })
      .execute();
  }

  /**
   * Retorna a sessão ativa de um equipamento (colaborador logado)
   */
  static async getActiveSession(equipmentId: number): Promise<EquipmentSession | null> {
    const sessionRepository = AppDataSource.getRepository(EquipmentSession);

    const session = await sessionRepository.findOne({
      where: {
        equipment_id: equipmentId,
        active: true,
      },
      relations: ['employee', 'employee.sector', 'equipment'],
    });

    return session;
  }

  /**
   * Retorna histórico de sessões de um equipamento
   */
  static async getSessionHistory(
    equipmentId: number,
    filters?: {
      employeeId?: string;
      startDate?: Date;
      endDate?: Date;
      limit?: number;
      offset?: number;
    }
  ): Promise<{ sessions: EquipmentSession[]; total: number }> {
    const sessionRepository = AppDataSource.getRepository(EquipmentSession);

    let query = sessionRepository
      .createQueryBuilder('session')
      .leftJoinAndSelect('session.employee', 'employee')
      .leftJoinAndSelect('employee.sector', 'sector')
      .leftJoinAndSelect('session.equipment', 'equipment')
      .where('session.equipment_id = :equipmentId', { equipmentId });

    // Filtro por colaborador
    if (filters?.employeeId) {
      query = query.andWhere('session.employee_id = :employeeId', {
        employeeId: filters.employeeId
      });
    }

    // Filtro por data
    if (filters?.startDate && filters?.endDate) {
      query = query.andWhere('session.logged_in_at BETWEEN :startDate AND :endDate', {
        startDate: filters.startDate,
        endDate: filters.endDate,
      });
    } else if (filters?.startDate) {
      query = query.andWhere('session.logged_in_at >= :startDate', {
        startDate: filters.startDate,
      });
    } else if (filters?.endDate) {
      query = query.andWhere('session.logged_in_at <= :endDate', {
        endDate: filters.endDate,
      });
    }

    // Ordenar por data (mais recente primeiro)
    query = query.orderBy('session.logged_in_at', 'DESC');

    // Contar total
    const total = await query.getCount();

    // Paginação
    if (filters?.limit) {
      query = query.limit(filters.limit);
    }
    if (filters?.offset) {
      query = query.offset(filters.offset);
    }

    const sessions = await query.getMany();

    return { sessions, total };
  }

  /**
   * Retorna todas as sessões ativas (para todos os equipamentos)
   */
  static async getAllActiveSessions(): Promise<EquipmentSession[]> {
    const sessionRepository = AppDataSource.getRepository(EquipmentSession);

    return await sessionRepository.find({
      where: { active: true },
      relations: ['employee', 'employee.sector', 'equipment', 'equipment.sector'],
      order: { logged_in_at: 'DESC' },
    });
  }
}
