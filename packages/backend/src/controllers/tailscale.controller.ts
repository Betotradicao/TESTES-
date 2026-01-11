import { Request, Response } from 'express';
import { TailscaleService } from '../services/tailscale.service';

export class TailscaleController {
  /**
   * GET /api/tailscale/config
   * Obter configurações do Tailscale
   */
  async getConfig(req: Request, res: Response) {
    try {
      const config = await TailscaleService.getConfig();
      return res.json(config);
    } catch (error) {
      console.error('Error fetching Tailscale config:', error);
      return res.status(500).json({
        error: 'Falha ao buscar configurações do Tailscale'
      });
    }
  }

  /**
   * PUT /api/tailscale/config
   * Atualizar configurações do Tailscale
   */
  async updateConfig(req: Request, res: Response) {
    try {
      const { vps_ip, client_ip, client_subnet } = req.body;

      const updates: any = {};
      if (vps_ip !== undefined) updates.vps_ip = vps_ip;
      if (client_ip !== undefined) updates.client_ip = client_ip;
      if (client_subnet !== undefined) updates.client_subnet = client_subnet;

      const config = await TailscaleService.saveConfig(updates);

      return res.json({
        message: 'Configurações atualizadas com sucesso',
        config
      });
    } catch (error) {
      console.error('Error updating Tailscale config:', error);
      return res.status(500).json({
        error: 'Falha ao atualizar configurações do Tailscale'
      });
    }
  }

  /**
   * POST /api/tailscale/test
   * Testar conectividade do Tailscale
   */
  async testConnectivity(req: Request, res: Response) {
    try {
      const results = await TailscaleService.testConnectivity();

      return res.json({
        success: true,
        ...results
      });
    } catch (error: any) {
      console.error('Error testing Tailscale connectivity:', error);
      return res.status(500).json({
        success: false,
        error: 'Falha ao testar conectividade',
        details: error.message
      });
    }
  }
}
