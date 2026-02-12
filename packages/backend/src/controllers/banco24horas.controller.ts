import { Request, Response } from 'express';
import { Banco24horasService } from '../services/banco24horas.service';

export class Banco24horasController {
  /**
   * GET /api/banco24horas/depositos
   * Retorna depósitos do período
   * Query params: dataInicial (YYYY-MM-DD), dataFinal (YYYY-MM-DD)
   */
  async getDepositos(req: Request, res: Response) {
    try {
      const { dataInicial, dataFinal } = req.query;

      if (!dataInicial || !dataFinal) {
        return res.status(400).json({ error: 'dataInicial e dataFinal são obrigatórios (formato YYYY-MM-DD)' });
      }

      // Converter datas locais (BRT) para UTC (GMT+0) - BRT = UTC-3
      // Meia-noite BRT = 03:00 UTC
      const dtInicial = `${dataInicial}T03:00:00Z`;
      const dtFinal = `${dataFinal}T23:59:59Z`;

      const data = await Banco24horasService.getAllDepositos(dtInicial, dtFinal);

      // Calcular totalizadores
      const depositos = data.resultados || [];
      const totalValor = depositos.reduce((s, d) => s + d.valor, 0);
      const totalDigitado = depositos.reduce((s, d) => s + (d.valorDigitado || 0), 0);
      const concluidos = depositos.filter(d => d.situacao === 'Concluida');
      const regularizados = depositos.filter(d => d.situacao === 'Regularizada');

      return res.json({
        depositos,
        totais: {
          totalDepositos: depositos.length,
          totalValor,
          totalDigitado,
          diferenca: totalDigitado - totalValor,
          qtdConcluidos: concluidos.length,
          valorConcluidos: concluidos.reduce((s, d) => s + d.valor, 0),
          qtdRegularizados: regularizados.length,
          valorRegularizados: regularizados.reduce((s, d) => s + d.valor, 0)
        }
      });
    } catch (error: any) {
      console.error('[Banco24h] Erro ao buscar depósitos:', error.message);
      return res.status(500).json({
        error: 'Falha ao buscar depósitos',
        details: error.message
      });
    }
  }

  /**
   * GET /api/banco24horas/config
   * Retorna configuração pública
   */
  async getConfig(req: Request, res: Response) {
    try {
      const config = await Banco24horasService.getPublicConfig();
      return res.json(config);
    } catch (error: any) {
      console.error('[Banco24h] Erro ao buscar config:', error.message);
      return res.status(500).json({
        error: 'Falha ao buscar configurações',
        details: error.message
      });
    }
  }

  /**
   * POST /api/banco24horas/test
   * Testa conexão com a API
   */
  async testConnection(req: Request, res: Response) {
    try {
      Banco24horasService.clearCache();
      const result = await Banco24horasService.testConnection();
      return res.json(result);
    } catch (error: any) {
      console.error('[Banco24h] Erro no teste de conexão:', error.message);
      return res.status(500).json({
        success: false,
        error: 'Falha ao testar conexão',
        details: error.message
      });
    }
  }
}
