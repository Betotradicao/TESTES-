import { Request, Response } from 'express';
import { SantanderService } from '../services/santander.service';

export class SantanderController {
  /**
   * GET /api/santander/saldo
   * Retorna saldo da conta
   */
  async getSaldo(req: Request, res: Response) {
    try {
      const balance = await SantanderService.getBalance();
      return res.json(balance);
    } catch (error: any) {
      console.error('[Santander] Erro ao buscar saldo:', error.message);
      return res.status(500).json({
        error: 'Falha ao buscar saldo',
        details: error.message
      });
    }
  }

  /**
   * GET /api/santander/extrato
   * Retorna extrato (statements) com filtros
   * Query params: initialDate, finalDate, tipo (CREDITO|DEBITO|TODOS), _limit, _offset
   */
  async getExtrato(req: Request, res: Response) {
    try {
      const { initialDate, finalDate, tipo, _limit, _offset } = req.query;

      if (!initialDate || !finalDate) {
        return res.status(400).json({ error: 'initialDate e finalDate são obrigatórios' });
      }

      const limit = parseInt(_limit as string) || 50;
      const offset = parseInt(_offset as string) || 1;

      const data = await SantanderService.getStatements(
        initialDate as string,
        finalDate as string,
        limit,
        offset
      );

      // Filtrar por tipo se necessário
      if (tipo && tipo !== 'TODOS' && data._content) {
        data._content = data._content.filter(
          (item: any) => item.creditDebitType === tipo
        );
      }

      return res.json(data);
    } catch (error: any) {
      console.error('[Santander] Erro ao buscar extrato:', error.message);
      return res.status(500).json({
        error: 'Falha ao buscar extrato',
        details: error.message
      });
    }
  }

  /**
   * GET /api/santander/transactions
   * Retorna transações efetivas (big volume, até 750/página)
   * Query params: initialDate, finalDate, _limit, _nextPage
   */
  async getTransactions(req: Request, res: Response) {
    try {
      const { initialDate, finalDate, _limit, _nextPage } = req.query;

      if (!initialDate || !finalDate) {
        return res.status(400).json({ error: 'initialDate e finalDate são obrigatórios' });
      }

      const limit = parseInt(_limit as string) || 750;

      const data = await SantanderService.getTransactions(
        initialDate as string,
        finalDate as string,
        limit,
        _nextPage as string | undefined
      );

      return res.json(data);
    } catch (error: any) {
      console.error('[Santander] Erro ao buscar transactions:', error.message);
      return res.status(500).json({
        error: 'Falha ao buscar transações',
        details: error.message
      });
    }
  }

  /**
   * GET /api/santander/config
   * Retorna configuração pública (sem secrets)
   */
  async getConfig(req: Request, res: Response) {
    try {
      const config = await SantanderService.getPublicConfig();
      return res.json(config);
    } catch (error: any) {
      console.error('[Santander] Erro ao buscar config:', error.message);
      return res.status(500).json({
        error: 'Falha ao buscar configurações',
        details: error.message
      });
    }
  }

  /**
   * GET /api/santander/extrato-completo
   * Busca TODOS os lançamentos do período via /statements (50/página) com paginação automática
   * Query params: initialDate, finalDate
   */
  /**
   * Busca todas as páginas de um período (máx 90 dias).
   * Usa lotes de 5 paralelos para não sobrecarregar a API.
   */
  private async fetchAllPages(initialDate: string, finalDate: string): Promise<any[]> {
    const pageSize = 50;
    const BATCH_SIZE = 5;

    // Página 1: descobrir totalPages
    const firstPage = await SantanderService.getStatements(initialDate, finalDate, pageSize, 1);
    let items: any[] = [];
    if (firstPage._content?.length > 0) {
      items = items.concat(firstPage._content);
    }

    const totalPages = parseInt(firstPage._pageable?.totalPages || '1');
    const totalRecords = parseInt(firstPage._pageable?.totalRecords || '0');
    console.log(`[Santander] ${initialDate} a ${finalDate}: ${totalRecords} registros em ${totalPages} páginas`);

    // Buscar restantes em lotes de 5
    for (let batchStart = 2; batchStart <= totalPages; batchStart += BATCH_SIZE) {
      const batchEnd = Math.min(batchStart + BATCH_SIZE - 1, totalPages);
      const promises: Promise<any>[] = [];

      for (let page = batchStart; page <= batchEnd; page++) {
        promises.push(
          SantanderService.getStatements(initialDate, finalDate, pageSize, page)
            .catch(err => {
              console.warn(`[Santander] Erro na página ${page}, tentando novamente...`);
              // Retry uma vez após 1s
              return new Promise(resolve => setTimeout(resolve, 1000))
                .then(() => SantanderService.getStatements(initialDate, finalDate, pageSize, page));
            })
        );
      }

      const results = await Promise.all(promises);
      for (const data of results) {
        if (data?._content?.length > 0) {
          items = items.concat(data._content);
        }
      }
    }

    return items;
  }

  /**
   * Divide um range de datas em sub-ranges mensais.
   * Ex: 2025-01-01 a 2025-12-31 -> 12 sub-ranges (jan, fev, ..., dez)
   */
  private splitIntoMonths(initialDate: string, finalDate: string): Array<{start: string, end: string}> {
    const ranges: Array<{start: string, end: string}> = [];
    const startDate = new Date(initialDate + 'T00:00:00');
    const endDate = new Date(finalDate + 'T00:00:00');

    let current = new Date(startDate);
    while (current <= endDate) {
      const monthStart = new Date(current);
      // Último dia do mês ou finalDate (o que vier primeiro)
      const monthEnd = new Date(current.getFullYear(), current.getMonth() + 1, 0); // último dia do mês
      const rangeEnd = monthEnd > endDate ? endDate : monthEnd;

      const fmt = (d: Date) => d.toISOString().split('T')[0];
      ranges.push({ start: fmt(monthStart), end: fmt(rangeEnd) });

      // Próximo mês
      current = new Date(current.getFullYear(), current.getMonth() + 1, 1);
    }

    return ranges;
  }

  async getExtratoCompleto(req: Request, res: Response) {
    try {
      // Timeout de 5 minutos para consultas grandes (ano inteiro)
      req.setTimeout(300000);
      res.setTimeout(300000);

      const { initialDate, finalDate } = req.query;

      if (!initialDate || !finalDate) {
        return res.status(400).json({ error: 'initialDate e finalDate são obrigatórios' });
      }

      // Dividir em sub-ranges mensais para não sobrecarregar a API
      const monthRanges = this.splitIntoMonths(initialDate as string, finalDate as string);
      console.log(`[Santander] Consultando ${monthRanges.length} meses: ${initialDate} a ${finalDate}`);

      let allItems: any[] = [];

      // Processar cada mês sequencialmente (cada mês faz paginação interna com paralelo)
      for (const range of monthRanges) {
        try {
          const monthItems = await this.fetchAllPages(range.start, range.end);
          allItems = allItems.concat(monthItems);
          console.log(`[Santander] Mês ${range.start}: +${monthItems.length} itens (total: ${allItems.length})`);
        } catch (err: any) {
          console.error(`[Santander] Erro no mês ${range.start}: ${err.message}`);
          // Continuar com os outros meses mesmo se um falhar
        }
      }

      console.log(`[Santander] Total final: ${allItems.length} lançamentos`);

      // Calcular totais
      const creditos = allItems.filter((i: any) => i.creditDebitType === 'CREDITO');
      const debitos = allItems.filter((i: any) => i.creditDebitType === 'DEBITO');

      const totalCreditos = creditos.reduce((s: number, i: any) => s + parseFloat(i.amount || 0), 0);
      const totalDebitos = debitos.reduce((s: number, i: any) => s + Math.abs(parseFloat(i.amount || 0)), 0);

      return res.json({
        items: allItems,
        totais: {
          creditos: totalCreditos,
          debitos: totalDebitos,
          qtdCreditos: creditos.length,
          qtdDebitos: debitos.length,
          totalRegistros: allItems.length
        }
      });
    } catch (error: any) {
      console.error('[Santander] Erro ao buscar extrato completo:', error.message);
      return res.status(500).json({
        error: 'Falha ao buscar extrato completo',
        details: error.message
      });
    }
  }

  /**
   * POST /api/santander/test
   * Testa conexão com a API do Santander
   */
  async testConnection(req: Request, res: Response) {
    try {
      SantanderService.clearCache();
      const result = await SantanderService.testConnection();
      return res.json(result);
    } catch (error: any) {
      console.error('[Santander] Erro no teste de conexão:', error.message);
      return res.status(500).json({
        success: false,
        error: 'Falha ao testar conexão',
        details: error.message
      });
    }
  }
}
