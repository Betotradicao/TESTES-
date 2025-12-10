import { Request, Response } from 'express';
import { EquipmentSessionsService } from '../services/equipment-sessions.service';

export class EquipmentSessionsController {
  /**
   * Retorna todas as sessões ativas (todos os equipamentos com colaborador logado)
   * GET /api/equipment-sessions/active
   */
  static async getAllActiveSessions(req: Request, res: Response): Promise<void> {
    try {
      const sessions = await EquipmentSessionsService.getAllActiveSessions();

      res.status(200).json({
        success: true,
        data: sessions,
        count: sessions.length,
      });
    } catch (error) {
      console.error('Error fetching active sessions:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch active sessions',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Retorna a sessão ativa de um equipamento específico
   * GET /api/equipment-sessions/equipment/:equipmentId
   */
  static async getActiveSessionByEquipment(req: Request, res: Response): Promise<void> {
    try {
      const { equipmentId } = req.params;

      const session = await EquipmentSessionsService.getActiveSession(parseInt(equipmentId, 10));

      if (!session) {
        res.status(200).json({
          success: true,
          data: null,
          message: 'No active session for this equipment',
        });
        return;
      }

      res.status(200).json({
        success: true,
        data: session,
      });
    } catch (error) {
      console.error('Error fetching active session:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch active session',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Retorna o histórico de sessões de um equipamento
   * GET /api/equipment-sessions/equipment/:equipmentId/history
   * Query params: employeeId, startDate, endDate, page, limit
   */
  static async getSessionHistory(req: Request, res: Response): Promise<void> {
    try {
      const { equipmentId } = req.params;
      const { employeeId, startDate, endDate, page, limit } = req.query;

      const currentPage = page ? parseInt(page as string, 10) : 1;
      const pageLimit = limit ? parseInt(limit as string, 10) : 20;
      const offset = (currentPage - 1) * pageLimit;

      const filters = {
        employeeId: employeeId as string | undefined,
        startDate: startDate ? new Date(startDate as string) : undefined,
        endDate: endDate ? new Date(endDate as string) : undefined,
        limit: pageLimit,
        offset: offset,
      };

      const { sessions, total } = await EquipmentSessionsService.getSessionHistory(
        parseInt(equipmentId, 10),
        filters
      );

      const totalPages = Math.ceil(total / pageLimit);

      res.status(200).json({
        success: true,
        data: sessions,
        pagination: {
          page: currentPage,
          limit: pageLimit,
          total,
          totalPages,
          hasNextPage: currentPage < totalPages,
          hasPreviousPage: currentPage > 1,
        },
      });
    } catch (error) {
      console.error('Error fetching session history:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch session history',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Faz login manual de um colaborador em um equipamento
   * POST /api/equipment-sessions/login
   * Body: { equipmentId: number, employeeId: string }
   */
  static async loginEmployee(req: Request, res: Response): Promise<void> {
    try {
      const { equipmentId, employeeId } = req.body;

      if (!equipmentId || !employeeId) {
        res.status(400).json({
          success: false,
          error: 'equipmentId and employeeId are required',
        });
        return;
      }

      const session = await EquipmentSessionsService.loginEmployee(
        parseInt(equipmentId, 10),
        employeeId
      );

      res.status(200).json({
        success: true,
        data: session,
        message: 'Employee logged in successfully',
      });
    } catch (error) {
      console.error('Error logging in employee:', error);

      // Handle specific errors
      if (error instanceof Error) {
        if (error.message === 'Equipment not found') {
          res.status(404).json({
            success: false,
            error: 'Equipment not found',
          });
          return;
        }
        if (error.message === 'Employee not found') {
          res.status(404).json({
            success: false,
            error: 'Employee not found',
          });
          return;
        }
        if (error.message === 'Employee is inactive') {
          res.status(400).json({
            success: false,
            error: 'Employee is inactive',
          });
          return;
        }
      }

      res.status(500).json({
        success: false,
        error: 'Failed to login employee',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Faz logout manual do colaborador logado em um equipamento
   * POST /api/equipment-sessions/logout/:equipmentId
   */
  static async logoutEmployee(req: Request, res: Response): Promise<void> {
    try {
      const { equipmentId } = req.params;

      await EquipmentSessionsService.logoutEmployee(parseInt(equipmentId, 10));

      res.status(200).json({
        success: true,
        message: 'Employee logged out successfully',
      });
    } catch (error) {
      console.error('Error logging out employee:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to logout employee',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
}
