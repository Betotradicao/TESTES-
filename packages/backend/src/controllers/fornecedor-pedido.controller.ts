import { Request, Response } from 'express';
import { AppDataSource } from '../config/database';
import { OracleService } from '../services/oracle.service';
import { MappingService } from '../services/mapping.service';
import { FornecedorPedidoSugerido, PedidoSugeridoItem } from '../entities/FornecedorPedidoSugerido';
import { Company } from '../entities/Company';
import { AuthRequest } from '../middleware/auth';

/**
 * Controller pro fluxo "Pedido Sugerido pelo Fornecedor" (link publico).
 *
 * Fluxo:
 * 1. Fornecedor abre /fornecedor-pedido no celular
 * 2. Digita codigo do ERP (TAB_FORNECEDOR.COD_FORNECEDOR) OU CNPJ
 * 3. Sistema busca no Oracle, retorna nome + codigo
 * 4. Frontend pede lista de produtos (onde cod_forn_ult_compra = codFornecedor)
 * 5. Fornecedor informa qtdEstoque (dele) + qtdSugerida e envia
 * 6. Backoffice ve em Gestao de Compras -> Pedidos Sugeridos
 */
export class FornecedorPedidoController {

  // ============================================================
  // PUBLICO — usado pelo fornecedor (sem autenticacao)
  // ============================================================

  /**
   * GET /api/fornecedor-pedido/publico/lojas
   * Lista lojas ativas do cliente para o selector no celular.
   */
  static async listarLojasPublicas(req: Request, res: Response) {
    try {
      const repo = AppDataSource.getRepository(Company);
      const companies = await repo.createQueryBuilder('c')
        .where('c.active = :a', { a: true })
        .orderBy('c.codLoja', 'ASC')
        .getMany();

      const lojas = companies
        .map((c: any) => ({
          codLoja: c.codLoja ?? c.cod_loja ?? null,
          nome: (c.apelido || c.nome_fantasia || c.razao_social || '').trim() || `Loja ${c.codLoja ?? '?'}`
        }))
        .filter((l: any) => l.codLoja != null);

      res.json({ success: true, lojas });
    } catch (error: any) {
      console.error('[FornecedorPedido] listarLojasPublicas:', error?.message || error);
      res.status(500).json({ error: 'Erro ao listar lojas', details: error?.message });
    }
  }

  /**
   * GET /api/fornecedor-pedido/publico/buscar?identificador=X&codLoja=Y
   *
   * identificador = codigo numerico do ERP OU CNPJ (com/sem mascara)
   */
  static async buscarFornecedor(req: Request, res: Response) {
    try {
      const identificador = String(req.query.identificador || '').trim();
      const codLoja = req.query.codLoja ? parseInt(String(req.query.codLoja)) : 1;

      if (!identificador) {
        return res.status(400).json({ error: 'Informe codigo ou CNPJ do fornecedor' });
      }

      // Normaliza: remove tudo que nao for numero (CNPJ: 00.000.000/0000-00 -> 00000000000000)
      const apenasNumeros = identificador.replace(/\D/g, '');
      const ehCnpj = apenasNumeros.length === 14;
      const ehCodigo = !ehCnpj && /^\d+$/.test(identificador);

      if (!ehCnpj && !ehCodigo) {
        return res.status(400).json({ error: 'Identificador invalido. Use codigo numerico ou CNPJ.' });
      }

      const schema = await MappingService.getSchema();
      const tabFornecedor = await MappingService.getRealTableName('TAB_FORNECEDOR');

      // Colunas reais do TAB_FORNECEDOR no Intersolid:
      // COD_FORNECEDOR, NUM_CGC (CNPJ raw), DES_FANTASIA, DES_FORNECEDOR
      let where = '';
      const params: any = {};
      if (ehCnpj) {
        // NUM_CGC armazena CNPJ sem formatacao (so digitos)
        where = `NUM_CGC = :cnpj`;
        params.cnpj = apenasNumeros;
      } else {
        where = `COD_FORNECEDOR = :cod`;
        params.cod = parseInt(identificador);
      }

      const sql = `
        SELECT * FROM (
          SELECT COD_FORNECEDOR, NUM_CGC, DES_FANTASIA, DES_FORNECEDOR
          FROM ${schema}.${tabFornecedor}
          WHERE ${where}
          ORDER BY COD_FORNECEDOR
        ) WHERE ROWNUM = 1
      `;

      const rows = await OracleService.query(sql, params);
      if (!rows || rows.length === 0) {
        return res.status(404).json({ error: 'Fornecedor nao encontrado' });
      }

      const row: any = rows[0];
      res.json({
        success: true,
        fornecedor: {
          codigo: Number(row.COD_FORNECEDOR),
          cnpj: row.NUM_CGC || null,
          fantasia: (row.DES_FANTASIA || '').trim(),
          razaoSocial: (row.DES_FORNECEDOR || '').trim(),
          codLoja
        }
      });
    } catch (error: any) {
      console.error('[FornecedorPedido] buscarFornecedor:', error?.message || error);
      res.status(500).json({ error: 'Erro ao buscar fornecedor', details: error?.message });
    }
  }

  /**
   * GET /api/fornecedor-pedido/publico/produtos?codFornecedor=X&codLoja=Y
   *
   * Lista produtos ativos onde cod_forn_ult_compra = codFornecedor.
   * Retorna apenas campos uteis pro fornecedor sugerir pedido.
   */
  static async listarProdutosFornecedor(req: Request, res: Response) {
    try {
      const codFornecedor = parseInt(String(req.query.codFornecedor || '0'));
      const codLoja = req.query.codLoja ? parseInt(String(req.query.codLoja)) : 1;

      if (!codFornecedor || codFornecedor <= 0) {
        return res.status(400).json({ error: 'codFornecedor invalido' });
      }

      // Pega mapeamentos das colunas (nomes conforme products.controller.ts)
      const codigoCol = await MappingService.getColumnFromTable('TAB_PRODUTO', 'codigo_produto');
      const eanCol = await MappingService.getColumnFromTable('TAB_PRODUTO', 'ean');
      const descricaoCol = await MappingService.getColumnFromTable('TAB_PRODUTO', 'descricao');
      const inativoCol = await MappingService.getColumnFromTable('TAB_PRODUTO_LOJA', 'inativo');
      const estoqueAtualCol = await MappingService.getColumnFromTable('TAB_PRODUTO_LOJA', 'estoque_atual');
      const coberturaCol = await MappingService.getColumnFromTable('TAB_PRODUTO_LOJA', 'cobertura');
      const dataUltCompraCol = await MappingService.getColumnFromTable('TAB_PRODUTO_LOJA', 'data_ultima_compra');
      const curvaCol = await MappingService.getColumnFromTable('TAB_PRODUTO_LOJA', 'curva');
      const codFornUltCompraCol = await MappingService.getColumnFromTable('TAB_PRODUTO_LOJA', 'cod_forn_ult_compra');
      const codLojaCol = await MappingService.getColumnFromTable('TAB_PRODUTO_LOJA', 'codigo_loja');

      const schema = await MappingService.getSchema();
      const tabProduto = await MappingService.getRealTableName('TAB_PRODUTO');
      const tabProdutoLoja = await MappingService.getRealTableName('TAB_PRODUTO_LOJA');

      const sql = `
        SELECT
          p.${codigoCol} AS CODIGO,
          p.${eanCol} AS EAN,
          p.${descricaoCol} AS DESCRICAO,
          TO_CHAR(pl.${dataUltCompraCol}, 'DD/MM/YYYY') AS DTA_ULT_COMPRA,
          NVL(pl.${estoqueAtualCol}, 0) AS ESTOQUE_ATUAL,
          NVL(pl.${coberturaCol}, 0) AS COBERTURA,
          NVL(TRIM(pl.${curvaCol}), 'X') AS CURVA
        FROM ${schema}.${tabProduto} p
        INNER JOIN ${schema}.${tabProdutoLoja} pl ON p.${codigoCol} = pl.${codigoCol}
        WHERE pl.${codFornUltCompraCol} = :codFornecedor
          AND pl.${codLojaCol} = :codLoja
          AND NVL(pl.${inativoCol}, 'N') = 'N'
        ORDER BY p.${descricaoCol}
      `;

      const rows = await OracleService.query(sql, { codFornecedor, codLoja });

      const produtos = rows.map((row: any) => ({
        codigo: String(row.CODIGO),
        ean: row.EAN || '',
        descricao: (row.DESCRICAO || '').trim(),
        dtaUltCompra: row.DTA_ULT_COMPRA || null,
        estoqueAtual: parseFloat(row.ESTOQUE_ATUAL) || 0,
        estoqueTroca: 0, // TODO: integrar com /losses/oracle/trocas
        cobertura: parseInt(row.COBERTURA) || 0,
        curva: row.CURVA || 'X'
      }));

      res.json({ success: true, total: produtos.length, produtos });
    } catch (error: any) {
      console.error('[FornecedorPedido] listarProdutosFornecedor:', error?.message || error);
      res.status(500).json({ error: 'Erro ao listar produtos', details: error?.message });
    }
  }

  /**
   * POST /api/fornecedor-pedido/publico/enviar
   *
   * Body: {
   *   codFornecedor, nomeFornecedor, cnpjFornecedor, codLoja,
   *   itens: [{ ean, codigo, descricao, qtdEstoqueInformada, qtdSugerida, ... }],
   *   observacoes?
   * }
   */
  static async enviarPedido(req: Request, res: Response) {
    try {
      const {
        codFornecedor, nomeFornecedor, cnpjFornecedor, codLoja,
        itens, observacoes
      } = req.body;

      if (!codFornecedor || !Array.isArray(itens) || itens.length === 0) {
        return res.status(400).json({ error: 'codFornecedor e ao menos 1 item sao obrigatorios' });
      }

      // Filtra apenas itens com qtdSugerida > 0 (descarta os zerados)
      const itensValidos: PedidoSugeridoItem[] = itens
        .filter((i: any) => Number(i?.qtdSugerida) > 0)
        .map((i: any) => ({
          ean: i.ean || null,
          codigo: i.codigo || null,
          descricao: String(i.descricao || ''),
          dtaUltCompra: i.dtaUltCompra || null,
          estoqueAtual: i.estoqueAtual != null ? Number(i.estoqueAtual) : null,
          estoqueTroca: i.estoqueTroca != null ? Number(i.estoqueTroca) : null,
          cobertura: i.cobertura != null ? Number(i.cobertura) : null,
          curva: i.curva || null,
          qtdEstoqueInformada: i.qtdEstoqueInformada != null ? Number(i.qtdEstoqueInformada) : null,
          qtdSugerida: Number(i.qtdSugerida)
        }));

      if (itensValidos.length === 0) {
        return res.status(400).json({ error: 'Informe ao menos 1 produto com quantidade sugerida > 0' });
      }

      // Captura IP de origem (varios proxies)
      const ipOrigem = (
        req.headers['x-forwarded-for'] ||
        req.headers['x-real-ip'] ||
        req.socket.remoteAddress ||
        ''
      ).toString().split(',')[0].trim();

      const repo = AppDataSource.getRepository(FornecedorPedidoSugerido);
      const pedido = repo.create({
        cod_fornecedor: Number(codFornecedor),
        nome_fornecedor: nomeFornecedor || null,
        cnpj_fornecedor: cnpjFornecedor || null,
        cod_loja: codLoja ? Number(codLoja) : null,
        status: 'pendente',
        itens: itensValidos,
        observacoes: observacoes || null,
        ip_origem: ipOrigem.substring(0, 45)
      });

      const saved = await repo.save(pedido);
      res.json({
        success: true,
        pedidoId: saved.id,
        totalItens: itensValidos.length,
        message: 'Pedido enviado com sucesso. O supermercado vai avaliar e entrar em contato.'
      });
    } catch (error: any) {
      console.error('[FornecedorPedido] enviarPedido:', error?.message || error);
      res.status(500).json({ error: 'Erro ao enviar pedido', details: error?.message });
    }
  }

  // ============================================================
  // BACKOFFICE — autenticado (Gestao de Compras -> Pedidos Sugeridos)
  // ============================================================

  /**
   * GET /api/fornecedor-pedido?status=pendente&codLoja=X
   */
  static async listarPedidos(req: AuthRequest, res: Response) {
    try {
      const status = req.query.status ? String(req.query.status) : null;
      const codLoja = req.query.codLoja ? parseInt(String(req.query.codLoja)) : null;
      const limit = Math.min(Number(req.query.limit) || 100, 500);

      const repo = AppDataSource.getRepository(FornecedorPedidoSugerido);
      const qb = repo.createQueryBuilder('p').orderBy('p.enviado_em', 'DESC').limit(limit);
      if (status) qb.andWhere('p.status = :status', { status });
      if (codLoja) qb.andWhere('p.cod_loja = :codLoja', { codLoja });
      const rows = await qb.getMany();

      res.json({ success: true, total: rows.length, pedidos: rows });
    } catch (error: any) {
      console.error('[FornecedorPedido] listarPedidos:', error?.message || error);
      res.status(500).json({ error: 'Erro ao listar pedidos', details: error?.message });
    }
  }

  /**
   * GET /api/fornecedor-pedido/:id
   */
  static async obterPedido(req: AuthRequest, res: Response) {
    try {
      const id = parseInt(req.params.id);
      const repo = AppDataSource.getRepository(FornecedorPedidoSugerido);
      const pedido = await repo.findOne({ where: { id } });
      if (!pedido) return res.status(404).json({ error: 'Pedido nao encontrado' });
      res.json({ success: true, pedido });
    } catch (error: any) {
      console.error('[FornecedorPedido] obterPedido:', error?.message || error);
      res.status(500).json({ error: 'Erro ao obter pedido', details: error?.message });
    }
  }

  /**
   * PUT /api/fornecedor-pedido/:id/status
   * Body: { status: 'aprovado' | 'rejeitado' }
   */
  static async atualizarStatus(req: AuthRequest, res: Response) {
    try {
      const id = parseInt(req.params.id);
      const { status } = req.body;
      if (!['aprovado', 'rejeitado', 'pendente'].includes(status)) {
        return res.status(400).json({ error: 'Status invalido. Use: pendente, aprovado, rejeitado' });
      }

      const repo = AppDataSource.getRepository(FornecedorPedidoSugerido);
      const pedido = await repo.findOne({ where: { id } });
      if (!pedido) return res.status(404).json({ error: 'Pedido nao encontrado' });

      pedido.status = status;
      pedido.atualizado_em = new Date();
      pedido.atualizado_por = req.user?.email || req.user?.username || 'admin';
      await repo.save(pedido);

      res.json({ success: true, pedido });
    } catch (error: any) {
      console.error('[FornecedorPedido] atualizarStatus:', error?.message || error);
      res.status(500).json({ error: 'Erro ao atualizar status', details: error?.message });
    }
  }
}
