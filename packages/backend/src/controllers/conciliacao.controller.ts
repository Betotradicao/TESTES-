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

  // ============ MODO "DIRETO MANUAL" ============

  /** GET /api/conciliacao/dados-manual — extrato do banco + amarrações (sem Oracle) */
  static async getDadosManual(req: Request, res: Response) {
    try {
      const filters = {
        codLoja: req.query.codLoja as string,
        codBanco: req.query.codBanco as string,
        bankId: req.query.bankId as string,
        dtaInicio: req.query.dtaInicio as string,
        dtaFim: req.query.dtaFim as string,
        mesAno: req.query.mesAno as string,
      };
      if (!filters.dtaInicio && !filters.mesAno) {
        return res.status(400).json({ success: false, message: 'dtaInicio ou mesAno é obrigatório' });
      }
      const result = await ConciliacaoService.getDadosManual(filters);
      res.json({ success: true, ...result });
    } catch (error: any) {
      console.error('Erro getDadosManual:', error.message);
      res.status(500).json({ success: false, message: error.message });
    }
  }

  /** GET /api/conciliacao/demonstrativo-manual — demonstrativo montado pelas amarrações */
  static async getDemonstrativoManual(req: Request, res: Response) {
    try {
      const filters = {
        codLoja: req.query.codLoja as string,
        bankId: req.query.bankId as string,
        dtaInicio: req.query.dtaInicio as string,
        dtaFim: req.query.dtaFim as string,
        mesAno: req.query.mesAno as string,
      };
      if (!filters.dtaInicio && !filters.mesAno) {
        return res.status(400).json({ success: false, message: 'dtaInicio ou mesAno é obrigatório' });
      }
      const result = await ConciliacaoService.getDemonstrativoManual(filters);
      res.json({ success: true, ...result });
    } catch (error: any) {
      console.error('Erro getDemonstrativoManual:', error.message);
      res.status(500).json({ success: false, message: error.message });
    }
  }

  /** GET /api/conciliacao/amarracoes?codLoja= — mapa texto_exato -> conta */
  static async getAmarracoes(req: Request, res: Response) {
    try {
      const codLoja = Number(req.query.codLoja) || 1;
      const data = await ConciliacaoService.getAmarracoes(codLoja);
      res.json({ success: true, data });
    } catch (error: any) {
      console.error('Erro getAmarracoes:', error.message);
      res.status(500).json({ success: false, message: error.message });
    }
  }

  /** POST /api/conciliacao/amarracoes — cria/atualiza amarração */
  static async salvarAmarracao(req: Request, res: Response) {
    try {
      const codLoja = Number(req.body?.cod_loja ?? req.query.codLoja) || 1;
      const { texto_exato, plano_conta_id } = req.body || {};
      if (!texto_exato || !plano_conta_id) {
        return res.status(400).json({ success: false, message: 'texto_exato e plano_conta_id são obrigatórios' });
      }
      const row = await ConciliacaoService.salvarAmarracao(codLoja, texto_exato, Number(plano_conta_id));
      res.json({ success: true, data: row });
    } catch (error: any) {
      console.error('Erro salvarAmarracao:', error.message);
      res.status(400).json({ success: false, message: error.message });
    }
  }

  /** DELETE /api/conciliacao/amarracoes — remove amarração de um texto */
  static async removerAmarracao(req: Request, res: Response) {
    try {
      const codLoja = Number(req.body?.cod_loja ?? req.query.codLoja) || 1;
      const texto = (req.body?.texto_exato ?? req.query.texto_exato) as string;
      if (!texto) return res.status(400).json({ success: false, message: 'texto_exato é obrigatório' });
      const removed = await ConciliacaoService.removerAmarracao(codLoja, texto);
      res.json({ success: true, removed });
    } catch (error: any) {
      console.error('Erro removerAmarracao:', error.message);
      res.status(400).json({ success: false, message: error.message });
    }
  }

  /** POST /api/conciliacao/movimento/unica — classificação pontual de um movimento */
  static async movimentoUnica(req: Request, res: Response) {
    try {
      const codLoja = Number(req.body?.cod_loja ?? req.query.codLoja) || 1;
      const { mov_key, plano_conta_id } = req.body || {};
      if (!mov_key || !plano_conta_id) {
        return res.status(400).json({ success: false, message: 'mov_key e plano_conta_id são obrigatórios' });
      }
      const row = await ConciliacaoService.salvarMovimentoUnica(codLoja, mov_key, Number(plano_conta_id));
      res.json({ success: true, data: row });
    } catch (error: any) {
      console.error('Erro movimentoUnica:', error.message);
      res.status(400).json({ success: false, message: error.message });
    }
  }

  /** POST /api/conciliacao/movimento/transferencia — marca movimento como transferência */
  static async movimentoTransferencia(req: Request, res: Response) {
    try {
      const codLoja = Number(req.body?.cod_loja ?? req.query.codLoja) || 1;
      const { mov_key, sourceAccountId, targetAccountId, amount, date, description } = req.body || {};
      if (!mov_key || !sourceAccountId || !targetAccountId || !amount || !date) {
        return res.status(400).json({ success: false, message: 'mov_key, sourceAccountId, targetAccountId, amount e date são obrigatórios' });
      }
      const result = await ConciliacaoService.salvarMovimentoTransferencia(codLoja, mov_key, {
        sourceAccountId, targetAccountId, amount: Number(amount), date, description,
      });
      res.json({ success: true, data: result });
    } catch (error: any) {
      console.error('Erro movimentoTransferencia:', error.message);
      res.status(400).json({ success: false, message: error.message });
    }
  }

  /** POST /api/conciliacao/movimento/fatura — vários lançamentos num movimento (cartão) */
  static async movimentoFatura(req: Request, res: Response) {
    try {
      const codLoja = Number(req.body?.cod_loja ?? req.query.codLoja) || 1;
      const { mov_key, itens } = req.body || {};
      if (!mov_key || !Array.isArray(itens)) {
        return res.status(400).json({ success: false, message: 'mov_key e itens (array) são obrigatórios' });
      }
      const row = await ConciliacaoService.salvarMovimentoFatura(codLoja, mov_key, itens);
      res.json({ success: true, data: row });
    } catch (error: any) {
      console.error('Erro movimentoFatura:', error.message);
      res.status(400).json({ success: false, message: error.message });
    }
  }

  /** DELETE /api/conciliacao/movimento — remove classificação por movimento */
  static async removerMovimento(req: Request, res: Response) {
    try {
      const codLoja = Number(req.body?.cod_loja ?? req.query.codLoja) || 1;
      const movKey = (req.body?.mov_key ?? req.query.mov_key) as string;
      if (!movKey) return res.status(400).json({ success: false, message: 'mov_key é obrigatório' });
      const removed = await ConciliacaoService.removerMovimento(codLoja, movKey);
      res.json({ success: true, removed });
    } catch (error: any) {
      console.error('Erro removerMovimento:', error.message);
      res.status(400).json({ success: false, message: error.message });
    }
  }
}
