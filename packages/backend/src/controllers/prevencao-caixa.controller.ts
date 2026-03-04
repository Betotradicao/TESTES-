/**
 * Prevenção de Caixa Controller
 * Controller para relatórios de cancelamentos (Item, Cupom, Venda)
 */

import { Request, Response } from 'express';
import { PrevencaoCaixaService, PrevencaoCaixaFilters } from '../services/prevencao-caixa.service';

export class PrevencaoCaixaController {
  /**
   * GET /prevencao-caixa/cancelamentos
   * Busca lista unificada de cancelamentos
   */
  static async getCancelamentos(req: Request, res: Response) {
    try {
      const { dataInicio, dataFim, tipo, codOperador, codLoja, numPdv } = req.query;

      if (!dataInicio || !dataFim) {
        return res.status(400).json({
          error: 'Parâmetros obrigatórios',
          message: 'dataInicio e dataFim são obrigatórios'
        });
      }

      const filters: PrevencaoCaixaFilters = {
        dataInicio: dataInicio as string,
        dataFim: dataFim as string,
        tipo: tipo as 'ITEM' | 'CUPOM' | 'VENDA' | undefined,
        codOperador: codOperador ? Number(codOperador) : undefined,
        codLoja: codLoja ? Number(codLoja) : undefined,
        numPdv: numPdv ? Number(numPdv) : undefined
      };

      console.log('📊 Buscando cancelamentos:', filters);

      const data = await PrevencaoCaixaService.getCancelamentos(filters);

      console.log(`✅ Encontrados ${data.length} cancelamentos`);

      return res.json({
        success: true,
        data,
        filters,
        count: data.length
      });
    } catch (error: any) {
      console.error('❌ Erro ao buscar cancelamentos:', error);
      console.error('❌ Stack:', error.stack);
      console.error('❌ Query params:', req.query);
      return res.status(500).json({
        success: false,
        error: 'Erro ao buscar cancelamentos',
        message: error.message,
        stack: error.stack
      });
    }
  }

  /**
   * GET /prevencao-caixa/resumo
   * Busca resumo de cancelamentos (totais por tipo)
   */
  static async getResumo(req: Request, res: Response) {
    try {
      const { dataInicio, dataFim, tipo, codOperador, codLoja, numPdv } = req.query;

      if (!dataInicio || !dataFim) {
        return res.status(400).json({
          error: 'Parâmetros obrigatórios',
          message: 'dataInicio e dataFim são obrigatórios'
        });
      }

      const filters: PrevencaoCaixaFilters = {
        dataInicio: dataInicio as string,
        dataFim: dataFim as string,
        tipo: tipo as 'ITEM' | 'CUPOM' | 'VENDA' | undefined,
        codOperador: codOperador ? Number(codOperador) : undefined,
        codLoja: codLoja ? Number(codLoja) : undefined,
        numPdv: numPdv ? Number(numPdv) : undefined
      };

      console.log('📊 Buscando resumo de cancelamentos:', filters);

      const resumo = await PrevencaoCaixaService.getResumoCancelamentos(filters);

      return res.json({
        success: true,
        resumo,
        filters
      });
    } catch (error: any) {
      console.error('❌ Erro ao buscar resumo de cancelamentos:', error);
      console.error('❌ Stack:', error.stack);
      console.error('❌ Query params:', req.query);
      return res.status(500).json({
        success: false,
        error: 'Erro ao buscar resumo',
        message: error.message,
        stack: error.stack
      });
    }
  }
}
