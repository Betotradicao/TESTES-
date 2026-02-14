/**
 * Financeiro Controller
 * Endpoints para tela de Entradas e Saídas
 */

import { Request, Response } from 'express';
import { FinanceiroService } from '../services/financeiro.service';

export class FinanceiroController {

  static async getEntradasSaidas(req: Request, res: Response) {
    try {
      const filters = {
        vencInicio: req.query.vencInicio as string,
        vencFim: req.query.vencFim as string,
        entradaInicio: req.query.entradaInicio as string,
        entradaFim: req.query.entradaFim as string,
        tipoConta: req.query.tipoConta as string,
        quitado: req.query.quitado as string,
        tipoParceiro: req.query.tipoParceiro as string,
        codBanco: req.query.codBanco as string,
        codEntidade: req.query.codEntidade as string,
        codCategoria: req.query.codCategoria as string,
        parceiro: req.query.parceiro as string,
        codLoja: req.query.codLoja as string,
      };

      console.log('[FINANCEIRO] Query params recebidos:', req.query);
      console.log('[FINANCEIRO] Filtros montados:', JSON.stringify(filters));

      const result = await FinanceiroService.getEntradasSaidas(filters);
      console.log('[FINANCEIRO] Resultado: count=', result.count);
      return res.json(result);
    } catch (error: any) {
      console.error('Erro ao buscar entradas/saídas:', error);
      return res.status(500).json({ success: false, message: error.message });
    }
  }

  static async getResumo(req: Request, res: Response) {
    try {
      const filters = {
        vencInicio: req.query.vencInicio as string,
        vencFim: req.query.vencFim as string,
        entradaInicio: req.query.entradaInicio as string,
        entradaFim: req.query.entradaFim as string,
        tipoConta: req.query.tipoConta as string,
        quitado: req.query.quitado as string,
        tipoParceiro: req.query.tipoParceiro as string,
        codBanco: req.query.codBanco as string,
        codEntidade: req.query.codEntidade as string,
        codCategoria: req.query.codCategoria as string,
        parceiro: req.query.parceiro as string,
        codLoja: req.query.codLoja as string,
      };

      const result = await FinanceiroService.getResumo(filters);
      return res.json(result);
    } catch (error: any) {
      console.error('Erro ao buscar resumo financeiro:', error);
      return res.status(500).json({ success: false, message: error.message });
    }
  }

  static async getBancos(req: Request, res: Response) {
    try {
      const data = await FinanceiroService.getBancos();
      return res.json(data);
    } catch (error: any) {
      console.error('Erro ao buscar bancos:', error);
      return res.status(500).json({ success: false, message: error.message });
    }
  }

  static async getEntidades(req: Request, res: Response) {
    try {
      const data = await FinanceiroService.getEntidades();
      return res.json(data);
    } catch (error: any) {
      console.error('Erro ao buscar entidades:', error);
      return res.status(500).json({ success: false, message: error.message });
    }
  }

  static async getCategorias(req: Request, res: Response) {
    try {
      const data = await FinanceiroService.getCategorias();
      return res.json(data);
    } catch (error: any) {
      console.error('Erro ao buscar categorias:', error);
      return res.status(500).json({ success: false, message: error.message });
    }
  }
}
