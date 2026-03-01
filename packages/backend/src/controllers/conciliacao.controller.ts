import { Request, Response } from 'express';
import { ConciliacaoService } from '../services/conciliacao.service';

export class ConciliacaoController {

  static async getDados(req: Request, res: Response) {
    try {
      const filters = {
        codLoja: req.query.codLoja as string,
        codBanco: req.query.codBanco as string,
        codBancoSistema: req.query.codBancoSistema as string,
        bankId: req.query.bankId as string,
        desCc: req.query.desCc as string,
        dtaInicio: req.query.dtaInicio as string,
        dtaFim: req.query.dtaFim as string,
        mesAno: req.query.mesAno as string,
      };

      if (!filters.codBanco) {
        return res.status(400).json({ success: false, message: 'codBanco é obrigatório' });
      }
      if (!filters.dtaInicio && !filters.mesAno) {
        return res.status(400).json({ success: false, message: 'dtaInicio ou mesAno é obrigatório' });
      }

      const result = await ConciliacaoService.getDadosConciliacao(filters);
      res.json({ success: true, ...result });
    } catch (error: any) {
      console.error('Erro getDados conciliacao:', error.message);
      res.status(500).json({ success: false, message: error.message });
    }
  }

  static async getBancos(req: Request, res: Response) {
    try {
      const codLoja = req.query.codLoja as string;
      const bancos = await ConciliacaoService.getBancos(codLoja);
      res.json({ success: true, data: bancos });
    } catch (error: any) {
      console.error('Erro getBancos conciliacao:', error.message);
      res.status(500).json({ success: false, message: error.message });
    }
  }

  static async getContasCorrentes(req: Request, res: Response) {
    try {
      const codBanco = Number(req.query.codBanco);
      if (!codBanco) {
        return res.status(400).json({ success: false, message: 'codBanco é obrigatório' });
      }
      const contas = await ConciliacaoService.getContasCorrentes(codBanco);
      res.json({ success: true, data: contas });
    } catch (error: any) {
      console.error('Erro getContasCorrentes:', error.message);
      res.status(500).json({ success: false, message: error.message });
    }
  }

  static async conciliar(req: Request, res: Response) {
    try {
      const { numRegistros } = req.body;
      if (!numRegistros || !Array.isArray(numRegistros) || numRegistros.length === 0) {
        return res.status(400).json({ success: false, message: 'numRegistros é obrigatório (array de IDs)' });
      }
      const result = await ConciliacaoService.conciliarRegistros(numRegistros);
      res.json({ success: true, ...result });
    } catch (error: any) {
      console.error('Erro conciliar:', error.message);
      res.status(500).json({ success: false, message: error.message });
    }
  }

  static async registrarTransferencia(req: Request, res: Response) {
    try {
      const { sourceAccountId, targetAccountId, amount, date, description } = req.body;
      if (!sourceAccountId || !targetAccountId || !amount || !date) {
        return res.status(400).json({ success: false, message: 'sourceAccountId, targetAccountId, amount e date são obrigatórios' });
      }
      const transfer = await ConciliacaoService.registrarTransferencia({
        sourceAccountId,
        targetAccountId,
        amount: Number(amount),
        date,
        description,
      });
      res.json({ success: true, data: transfer });
    } catch (error: any) {
      console.error('Erro registrarTransferencia:', error.message);
      res.status(500).json({ success: false, message: error.message });
    }
  }

  static async removerTransferencia(req: Request, res: Response) {
    try {
      const { id } = req.params;
      if (!id) {
        return res.status(400).json({ success: false, message: 'id é obrigatório' });
      }
      const removed = await ConciliacaoService.removerTransferencia(id);
      res.json({ success: true, removed });
    } catch (error: any) {
      console.error('Erro removerTransferencia:', error.message);
      res.status(500).json({ success: false, message: error.message });
    }
  }
}
