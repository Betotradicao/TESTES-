/**
 * Frente de Caixa Controller
 * Controller para relatórios de vendas, cancelamentos, descontos e diferença de caixa
 */

import { Request, Response } from 'express';
import { FrenteCaixaService, FrenteCaixaFilters } from '../services/frente-caixa.service';
import { OracleService } from '../services/oracle.service';

export class FrenteCaixaController {
  /**
   * Testa conexão com Oracle
   */
  static async testConnection(req: Request, res: Response) {
    try {
      const result = await OracleService.testConnection();
      return res.json(result);
    } catch (error: any) {
      console.error('Erro ao testar conexão Oracle:', error);
      return res.status(500).json({
        success: false,
        message: `Erro ao conectar: ${error.message}`
      });
    }
  }

  /**
   * Lista operadores disponíveis
   */
  static async getOperadores(req: Request, res: Response) {
    try {
      const codLoja = req.query.codLoja ? Number(req.query.codLoja) : undefined;
      const operadores = await FrenteCaixaService.getOperadores(codLoja);
      return res.json(operadores);
    } catch (error: any) {
      console.error('Erro ao buscar operadores:', error);
      return res.status(500).json({
        error: 'Erro ao buscar operadores',
        message: error.message
      });
    }
  }

  /**
   * Busca resumo consolidado por operador
   */
  static async getResumoOperadores(req: Request, res: Response) {
    try {
      const { dataInicio, dataFim, codOperador, codLoja } = req.query;

      if (!dataInicio || !dataFim) {
        return res.status(400).json({
          error: 'Parâmetros obrigatórios',
          message: 'dataInicio e dataFim são obrigatórios'
        });
      }

      const filters: FrenteCaixaFilters = {
        dataInicio: dataInicio as string,
        dataFim: dataFim as string,
        codOperador: codOperador ? Number(codOperador) : undefined,
        codLoja: codLoja ? Number(codLoja) : undefined
      };

      console.log('📊 Buscando resumo de operadores:', filters);

      const data = await FrenteCaixaService.getResumoOperadores(filters);

      console.log(`✅ Encontrados ${data.length} operadores`);

      return res.json({
        success: true,
        data,
        filters,
        count: data.length
      });
    } catch (error: any) {
      console.error('❌ Erro ao buscar resumo de operadores:', error);
      console.error('❌ Stack:', error.stack);
      console.error('❌ Query params:', req.query);
      return res.status(500).json({
        success: false,
        error: 'Erro ao buscar dados',
        message: error.message,
        stack: error.stack
      });
    }
  }

  /**
   * Busca detalhamento por dia de um operador
   */
  static async getDetalheOperadorPorDia(req: Request, res: Response) {
    try {
      const { dataInicio, dataFim, codOperador, codLoja } = req.query;

      if (!dataInicio || !dataFim || !codOperador) {
        return res.status(400).json({
          error: 'Parâmetros obrigatórios',
          message: 'dataInicio, dataFim e codOperador são obrigatórios'
        });
      }

      const filters: FrenteCaixaFilters = {
        dataInicio: dataInicio as string,
        dataFim: dataFim as string,
        codOperador: Number(codOperador),
        codLoja: codLoja ? Number(codLoja) : undefined
      };

      console.log('📊 Buscando detalhe por dia do operador:', codOperador);

      const data = await FrenteCaixaService.getDetalheOperadorPorDia(filters);

      console.log(`✅ Encontrados ${data.length} registros`);

      return res.json({
        success: true,
        data,
        filters,
        count: data.length
      });
    } catch (error: any) {
      console.error('Erro ao buscar detalhe por dia:', error);
      return res.status(500).json({
        success: false,
        error: 'Erro ao buscar dados',
        message: error.message
      });
    }
  }

  /**
   * Busca totais gerais do período
   */
  static async getTotais(req: Request, res: Response) {
    try {
      const { dataInicio, dataFim, codLoja } = req.query;

      if (!dataInicio || !dataFim) {
        return res.status(400).json({
          error: 'Parâmetros obrigatórios',
          message: 'dataInicio e dataFim são obrigatórios'
        });
      }

      const filters: FrenteCaixaFilters = {
        dataInicio: dataInicio as string,
        dataFim: dataFim as string,
        codLoja: codLoja ? Number(codLoja) : undefined
      };

      console.log('📊 Buscando totais gerais:', filters);

      const totais = await FrenteCaixaService.getTotais(filters);

      return res.json({
        success: true,
        totais
      });
    } catch (error: any) {
      console.error('❌ Erro ao buscar totais:', error);
      console.error('❌ Stack:', error.stack);
      console.error('❌ Query params:', req.query);
      return res.status(500).json({
        success: false,
        error: 'Erro ao buscar totais',
        message: error.message,
        stack: error.stack
      });
    }
  }

  /**
   * Busca cupons de um operador em uma data específica
   */
  static async getCuponsPorDia(req: Request, res: Response) {
    try {
      const { codOperador, data, codLoja } = req.query;

      if (!codOperador || !data) {
        return res.status(400).json({
          error: 'Parâmetros obrigatórios',
          message: 'codOperador e data são obrigatórios'
        });
      }

      console.log('📋 Buscando cupons do operador:', codOperador, 'em', data);

      const cupons = await FrenteCaixaService.getCuponsPorDia(
        Number(codOperador),
        data as string,
        codLoja ? Number(codLoja) : undefined
      );

      return res.json({
        success: true,
        data: cupons,
        count: cupons.length
      });
    } catch (error: any) {
      console.error('❌ Erro ao buscar cupons:', error);
      return res.status(500).json({
        success: false,
        error: 'Erro ao buscar cupons',
        message: error.message
      });
    }
  }

  /**
   * Busca itens de um cupom específico
   */
  static async getItensPorCupom(req: Request, res: Response) {
    try {
      const { numCupom, codLoja, data } = req.query;

      if (!numCupom || !codLoja) {
        return res.status(400).json({
          error: 'Parâmetros obrigatórios',
          message: 'numCupom e codLoja são obrigatórios'
        });
      }

      console.log('📋 Buscando itens do cupom:', numCupom, 'loja:', codLoja, 'data:', data || 'todas');

      const itens = await FrenteCaixaService.getItensPorCupom(
        Number(numCupom),
        Number(codLoja),
        data as string | undefined
      );

      return res.json({
        success: true,
        data: itens,
        count: itens.length
      });
    } catch (error: any) {
      console.error('❌ Erro ao buscar itens:', error);
      return res.status(500).json({
        success: false,
        error: 'Erro ao buscar itens',
        message: error.message
      });
    }
  }

  /**
   * Busca estornos órfãos de um operador em uma data específica
   * Estornos órfãos são cancelamentos que não têm cupom associado no mesmo PDV
   */
  static async getEstornosOrfaos(req: Request, res: Response) {
    try {
      const { codOperador, data, codLoja } = req.query;

      if (!codOperador || !data) {
        return res.status(400).json({
          error: 'Parâmetros obrigatórios',
          message: 'codOperador e data são obrigatórios'
        });
      }

      console.log('📋 Buscando estornos órfãos do operador:', codOperador, 'em', data);

      const estornos = await FrenteCaixaService.getEstornosOrfaos(
        Number(codOperador),
        data as string,
        codLoja ? Number(codLoja) : undefined
      );

      // Calcular total
      const total = estornos.reduce((sum, e) => sum + (e.VAL_TOTAL_PRODUTO || 0), 0);

      return res.json({
        success: true,
        data: estornos,
        count: estornos.length,
        total
      });
    } catch (error: any) {
      console.error('❌ Erro ao buscar estornos órfãos:', error);
      return res.status(500).json({
        success: false,
        error: 'Erro ao buscar estornos órfãos',
        message: error.message
      });
    }
  }
}
