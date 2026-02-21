import { Request, Response } from 'express';
import { DDAService } from '../services/dda.service';

export class DDAController {
  /**
   * Resolve bankId: usa query param ou busca primeiro banco ativo com certificado
   */
  private async resolveBankId(req: Request): Promise<string | null> {
    const bankId = req.query.bankId as string;
    if (bankId) return bankId;

    try {
      const { AppDataSource } = await import('../config/database');
      const { BankAccount } = await import('../entities/BankAccount');
      const repo = AppDataSource.getRepository(BankAccount);
      const first = await repo.findOne({
        where: { ativo: true },
        order: { created_at: 'ASC' }
      });
      return first?.id || null;
    } catch {
      return null;
    }
  }

  /**
   * GET /api/dda/boletos
   * Busca boletos DDA do banco selecionado
   * Query: bankId, initialDate, finalDate, status
   */
  async getBoletos(req: Request, res: Response) {
    try {
      const { initialDate, finalDate, status } = req.query;
      const bankId = await this.resolveBankId(req);

      if (!bankId) {
        return res.status(400).json({ error: 'Nenhum banco configurado' });
      }

      const titleSituation = (status as string) || 'ALL';

      const data = await DDAService.getBoletos(
        bankId,
        initialDate as string || undefined,
        finalDate as string || undefined,
        titleSituation
      );

      return res.json(data);
    } catch (error: any) {
      console.error('[DDA] Erro ao buscar boletos:', error.message);

      // Tratar erros específicos do Santander
      if (error.response?.status === 403) {
        return res.status(403).json({
          error: 'Sem permissão para acessar DDA',
          details: 'O produto "Pagamento de Contas" precisa estar habilitado no portal Santander para este banco.'
        });
      }

      return res.status(500).json({
        error: 'Falha ao buscar boletos DDA',
        details: error.message
      });
    }
  }

  /**
   * GET /api/dda/workspace-status
   * Verifica se o banco tem workspace configurado
   */
  async getWorkspaceStatus(req: Request, res: Response) {
    try {
      const bankId = await this.resolveBankId(req);
      if (!bankId) {
        return res.json({ hasWorkspace: false, error: 'Nenhum banco configurado' });
      }
      const status = await DDAService.getWorkspaceStatus(bankId);
      return res.json(status);
    } catch (error: any) {
      console.error('[DDA] Erro ao verificar workspace:', error.message);
      return res.status(500).json({
        error: 'Falha ao verificar workspace',
        details: error.message
      });
    }
  }
}
