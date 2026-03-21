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

  /**
   * GET /prevencao-caixa/cupom-itens/:numCupom
   * Busca itens de um cupom cancelado (via cupom seguinte NUM_SEQ+1)
   */
  static async getCupomItens(req: Request, res: Response) {
    try {
      const { numCupom } = req.params;
      const { numPdv, data, codLoja } = req.query;
      const itens = await PrevencaoCaixaService.getItensCupomCancelado(
        parseInt(numCupom),
        parseInt(numPdv as string),
        data as string,
        codLoja ? parseInt(codLoja as string) : undefined
      );
      return res.json({ success: true, itens });
    } catch (error: any) {
      console.error('❌ Erro ao buscar itens do cupom cancelado:', error);
      return res.status(500).json({ success: false, error: error.message });
    }
  }

  /**
   * GET /prevencao-caixa/descontos
   * Busca resumo de vendas com desconto
   */
  static async getDescontos(req: Request, res: Response) {
    try {
      const { dataInicio, dataFim, codLoja } = req.query;

      if (!dataInicio || !dataFim) {
        return res.status(400).json({
          error: 'Parametros obrigatorios',
          message: 'dataInicio e dataFim sao obrigatorios'
        });
      }

      const filters: PrevencaoCaixaFilters = {
        dataInicio: dataInicio as string,
        dataFim: dataFim as string,
        codLoja: codLoja ? Number(codLoja) : undefined
      };

      const descontos = await PrevencaoCaixaService.getResumoDescontos(filters);

      return res.json({
        success: true,
        descontos,
        filters
      });
    } catch (error: any) {
      console.error('Erro ao buscar descontos:', error);
      return res.status(500).json({
        success: false,
        error: 'Erro ao buscar descontos',
        message: error.message
      });
    }
  }

  /**
   * GET /prevencao-caixa/itens-desconto
   * Busca lista de itens vendidos com desconto
   */
  static async getItensDesconto(req: Request, res: Response) {
    try {
      const { dataInicio, dataFim, codOperador, codLoja, numPdv } = req.query;

      if (!dataInicio || !dataFim) {
        return res.status(400).json({
          error: 'Parametros obrigatorios',
          message: 'dataInicio e dataFim sao obrigatorios'
        });
      }

      const filters: PrevencaoCaixaFilters = {
        dataInicio: dataInicio as string,
        dataFim: dataFim as string,
        codOperador: codOperador ? Number(codOperador) : undefined,
        codLoja: codLoja ? Number(codLoja) : undefined,
        numPdv: numPdv ? Number(numPdv) : undefined
      };

      const data = await PrevencaoCaixaService.getItensComDesconto(filters);

      return res.json({
        success: true,
        data,
        count: data.length
      });
    } catch (error: any) {
      console.error('Erro ao buscar itens com desconto:', error);
      return res.status(500).json({
        success: false,
        error: 'Erro ao buscar itens com desconto',
        message: error.message
      });
    }
  }
}
