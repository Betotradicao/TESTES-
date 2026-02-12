import { Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { AppDataSource } from '../config/database';
import { CotacaoPedido } from '../entities/CotacaoPedido';
import { CotacaoPedidoItem } from '../entities/CotacaoPedidoItem';
import { OracleService } from '../services/oracle.service';
import { MappingService } from '../services/mapping.service';

interface AuthRequest extends Request {
  user?: any;
}

export class CotacaoController {

  /**
   * Cria uma cotação a partir de um pedido Oracle
   * POST /api/cotacao/criar
   * Body: { numPedido: number }
   */
  static async criar(req: AuthRequest, res: Response) {
    try {
      const { numPedido } = req.body;
      if (!numPedido) {
        return res.status(400).json({ error: 'numPedido é obrigatório' });
      }

      // Verificar se já existe cotação para este pedido
      const cotacaoRepo = AppDataSource.getRepository(CotacaoPedido);
      const existente = await cotacaoRepo.findOne({ where: { num_pedido: numPedido } });
      if (existente) {
        return res.json({ token: existente.token, status: existente.status, jaExiste: true });
      }

      // Buscar dados do pedido e fornecedor no Oracle
      const schema = await MappingService.getSchema();
      const tabPedido = `${schema}.${await MappingService.getRealTableName('TAB_PEDIDO')}`;
      const tabFornecedor = `${schema}.${await MappingService.getRealTableName('TAB_FORNECEDOR')}`;
      const tabPedidoProduto = `${schema}.${await MappingService.getRealTableName('TAB_PEDIDO_PRODUTO')}`;
      const tabProduto = `${schema}.${await MappingService.getRealTableName('TAB_PRODUTO')}`;
      const tabProdutoLoja = `${schema}.${await MappingService.getRealTableName('TAB_PRODUTO_LOJA')}`;

      const pedNumPedidoCol = await MappingService.getColumnFromTable('TAB_PEDIDO', 'numero_pedido');
      const pedCodParceiroCol = await MappingService.getColumnFromTable('TAB_PEDIDO', 'codigo_fornecedor');
      const pedCodLojaCol = await MappingService.getColumnFromTable('TAB_PEDIDO', 'codigo_loja');
      const fornCodigoCol = await MappingService.getColumnFromTable('TAB_FORNECEDOR', 'codigo_fornecedor');
      const fornRazaoSocialCol = await MappingService.getColumnFromTable('TAB_FORNECEDOR', 'razao_social');
      const ppNumPedidoCol = await MappingService.getColumnFromTable('TAB_PEDIDO_PRODUTO', 'numero_pedido');
      const ppCodProdutoCol = await MappingService.getColumnFromTable('TAB_PEDIDO_PRODUTO', 'codigo_produto');
      const ppQtdPedidoCol = await MappingService.getColumnFromTable('TAB_PEDIDO_PRODUTO', 'quantidade_pedida');
      const ppValTabelaCol = await MappingService.getColumnFromTable('TAB_PEDIDO_PRODUTO', 'valor_tabela');
      const ppQtdEmbalagemCol = await MappingService.getColumnFromTable('TAB_PEDIDO_PRODUTO', 'quantidade_embalagem');
      const prCodProdutoCol = await MappingService.getColumnFromTable('TAB_PRODUTO', 'codigo_produto');
      const prDesProdutoCol = await MappingService.getColumnFromTable('TAB_PRODUTO', 'descricao');
      const plCodProdutoCol = await MappingService.getColumnFromTable('TAB_PRODUTO_LOJA', 'codigo_produto');
      const plCodLojaCol = await MappingService.getColumnFromTable('TAB_PRODUTO_LOJA', 'codigo_loja');
      const plCurvaCol = await MappingService.getColumnFromTable('TAB_PRODUTO_LOJA', 'curva');
      const plPrecoVendaCol = await MappingService.getColumnFromTable('TAB_PRODUTO_LOJA', 'preco_venda');
      const plMargemCol = await MappingService.getColumnFromTable('TAB_PRODUTO_LOJA', 'margem');
      const prCodBarrasCol = await MappingService.getColumnFromTable('TAB_PRODUTO', 'codigo_barras');

      // Buscar info do pedido
      const pedidoQuery = `
        SELECT p.${pedCodParceiroCol} as COD_FORNECEDOR,
               p.${pedCodLojaCol} as COD_LOJA,
               f.${fornRazaoSocialCol} as NOME_FORNECEDOR
        FROM ${tabPedido} p
        LEFT JOIN ${tabFornecedor} f ON f.${fornCodigoCol} = p.${pedCodParceiroCol}
        WHERE p.${pedNumPedidoCol} = :numPedido
      `;
      const pedidoResult = await OracleService.query<any>(pedidoQuery, { numPedido });
      if (!pedidoResult.length) {
        return res.status(404).json({ error: 'Pedido não encontrado no Oracle' });
      }

      const { COD_FORNECEDOR, NOME_FORNECEDOR, COD_LOJA } = pedidoResult[0];
      const codLoja = COD_LOJA || 1;

      // Buscar itens do pedido com código de barras, curva e custo ideal
      const itensQuery = `
        SELECT
          pp.${ppCodProdutoCol} as COD_PRODUTO,
          pr.${prDesProdutoCol} as DES_PRODUTO,
          pr.${prCodBarrasCol} as COD_BARRA,
          pp.DES_UNIDADE,
          NVL(pp.${ppQtdPedidoCol}, 0) as QTD_PEDIDO,
          NVL(pp.${ppQtdEmbalagemCol}, 0) as QTD_EMBALAGEM,
          NVL(pp.${ppValTabelaCol}, 0) as VAL_TABELA,
          NVL(TRIM(pl.${plCurvaCol}), 'X') as CURVA,
          CASE WHEN NVL(pl.${plMargemCol}, 0) > 0 AND NVL(pl.${plPrecoVendaCol}, 0) > 0
            THEN ROUND(NVL(pl.${plPrecoVendaCol}, 0) * (1 - NVL(pl.${plMargemCol}, 0) / 100), 2)
            ELSE 0
          END as CUSTO_IDEAL
        FROM ${tabPedidoProduto} pp
        LEFT JOIN ${tabProduto} pr ON pr.${prCodProdutoCol} = pp.${ppCodProdutoCol}
        LEFT JOIN ${tabProdutoLoja} pl ON pl.${plCodProdutoCol} = pp.${ppCodProdutoCol} AND pl.${plCodLojaCol} = :codLoja
        WHERE pp.${ppNumPedidoCol} = :numPedido
        ORDER BY (NVL(pp.${ppQtdPedidoCol}, 0) * NVL(pp.${ppValTabelaCol}, 0)) DESC
      `;
      const itensOracle = await OracleService.query<any>(itensQuery, { numPedido, codLoja });

      if (!itensOracle.length) {
        return res.status(404).json({ error: 'Pedido sem itens no Oracle' });
      }

      // Gerar token curto
      const token = uuidv4().replace(/-/g, '').substring(0, 12);

      // Salvar no PostgreSQL
      const cotacao = cotacaoRepo.create({
        token,
        num_pedido: numPedido,
        cod_fornecedor: COD_FORNECEDOR,
        nome_fornecedor: NOME_FORNECEDOR || `Fornecedor ${COD_FORNECEDOR}`,
        status: 'pendente',
      });
      await cotacaoRepo.save(cotacao);

      // Salvar itens
      const itemRepo = AppDataSource.getRepository(CotacaoPedidoItem);
      const itensParaSalvar = itensOracle.map((item: any) => {
        const custoIdeal = parseFloat(item.CUSTO_IDEAL) || 0;
        const valTabela = parseFloat(item.VAL_TABELA) || 0;
        return itemRepo.create({
          cotacao_id: cotacao.id,
          cod_produto: item.COD_PRODUTO,
          des_produto: item.DES_PRODUTO || `Produto ${item.COD_PRODUTO}`,
          des_unidade: item.DES_UNIDADE || null,
          qtd_pedido: parseFloat(item.QTD_PEDIDO) || 0,
          qtd_embalagem: parseInt(item.QTD_EMBALAGEM) || 0,
          val_tabela: valTabela,
          cod_barra: item.COD_BARRA || null,
          curva: item.CURVA || 'X',
          custo_ideal: (custoIdeal > 0 && custoIdeal < valTabela) ? custoIdeal : undefined,
        });
      });
      await itemRepo.save(itensParaSalvar);

      res.json({ token, status: 'pendente', qtdItens: itensParaSalvar.length });
    } catch (error: any) {
      console.error('Erro ao criar cotação:', error);
      res.status(500).json({ error: 'Erro ao criar cotação', details: error.message });
    }
  }

  /**
   * Verifica se já existe cotação para um pedido
   * GET /api/cotacao/pedido/:numPedido
   */
  static async buscarPorPedido(req: AuthRequest, res: Response) {
    try {
      const { numPedido } = req.params;
      const cotacaoRepo = AppDataSource.getRepository(CotacaoPedido);
      const cotacao = await cotacaoRepo.findOne({
        where: { num_pedido: parseInt(numPedido, 10) },
        relations: ['itens'],
      });

      if (!cotacao) {
        return res.json({ existe: false });
      }

      res.json({
        existe: true,
        token: cotacao.token,
        status: cotacao.status,
        created_at: cotacao.created_at,
        responded_at: cotacao.responded_at,
        itens: cotacao.itens,
      });
    } catch (error: any) {
      console.error('Erro ao buscar cotação por pedido:', error);
      res.status(500).json({ error: 'Erro ao buscar cotação', details: error.message });
    }
  }

  /**
   * Retorna dados da cotação para o fornecedor (PÚBLICO, sem auth)
   * GET /api/public/cotacao/:token
   */
  static async buscarPorToken(req: Request, res: Response) {
    try {
      const { token } = req.params;
      const cotacaoRepo = AppDataSource.getRepository(CotacaoPedido);
      const cotacao = await cotacaoRepo.findOne({
        where: { token },
        relations: ['itens'],
      });

      if (!cotacao) {
        return res.status(404).json({ error: 'Cotação não encontrada' });
      }

      res.json({
        num_pedido: cotacao.num_pedido,
        nome_fornecedor: cotacao.nome_fornecedor,
        cod_fornecedor: cotacao.cod_fornecedor,
        status: cotacao.status,
        created_at: cotacao.created_at,
        responded_at: cotacao.responded_at,
        itens: cotacao.itens.map(item => ({
          id: item.id,
          cod_produto: item.cod_produto,
          des_produto: item.des_produto,
          des_unidade: item.des_unidade,
          qtd_pedido: item.qtd_pedido,
          qtd_embalagem: item.qtd_embalagem,
          val_tabela: item.val_tabela,
          preco_fornecedor: item.preco_fornecedor,
          cod_barra: item.cod_barra,
          curva: item.curva,
          custo_ideal: item.custo_ideal,
          observacao: item.observacao,
        })),
      });
    } catch (error: any) {
      console.error('Erro ao buscar cotação por token:', error);
      res.status(500).json({ error: 'Erro ao buscar cotação', details: error.message });
    }
  }

  /**
   * Fornecedor responde a cotação com preços (PÚBLICO, sem auth)
   * POST /api/public/cotacao/:token/responder
   * Body: { precos: [{ id: string, preco_fornecedor: number, observacao?: string }] }
   */
  static async responder(req: Request, res: Response) {
    try {
      const { token } = req.params;
      const { precos } = req.body;

      if (!precos || !Array.isArray(precos)) {
        return res.status(400).json({ error: 'precos deve ser um array' });
      }

      const cotacaoRepo = AppDataSource.getRepository(CotacaoPedido);
      const cotacao = await cotacaoRepo.findOne({ where: { token } });

      if (!cotacao) {
        return res.status(404).json({ error: 'Cotação não encontrada' });
      }

      if (cotacao.status === 'respondida') {
        return res.status(400).json({ error: 'Esta cotação já foi respondida' });
      }

      // Atualizar preços dos itens
      const itemRepo = AppDataSource.getRepository(CotacaoPedidoItem);
      for (const p of precos) {
        if (p.id && p.preco_fornecedor !== undefined && p.preco_fornecedor !== null) {
          const updateData: any = { preco_fornecedor: parseFloat(p.preco_fornecedor) };
          if (p.observacao !== undefined) {
            updateData.observacao = p.observacao || null;
          }
          await itemRepo.update(p.id, updateData);
        }
      }

      // Atualizar status da cotação
      cotacao.status = 'respondida';
      cotacao.responded_at = new Date();
      await cotacaoRepo.save(cotacao);

      res.json({ success: true, message: 'Cotação respondida com sucesso!' });
    } catch (error: any) {
      console.error('Erro ao responder cotação:', error);
      res.status(500).json({ error: 'Erro ao responder cotação', details: error.message });
    }
  }

  /**
   * Exclui uma cotação e seus itens
   * DELETE /api/cotacao/:numPedido
   */
  static async excluir(req: AuthRequest, res: Response) {
    try {
      const numPedido = parseInt(req.params.numPedido, 10);
      const cotacaoRepo = AppDataSource.getRepository(CotacaoPedido);
      const itemRepo = AppDataSource.getRepository(CotacaoPedidoItem);

      const cotacao = await cotacaoRepo.findOne({ where: { num_pedido: numPedido } });
      if (!cotacao) {
        return res.status(404).json({ error: 'Cotação não encontrada' });
      }

      await itemRepo.delete({ cotacao_id: cotacao.id });
      await cotacaoRepo.remove(cotacao);

      res.json({ success: true, message: 'Cotação excluída com sucesso' });
    } catch (error: any) {
      console.error('Erro ao excluir cotação:', error);
      res.status(500).json({ error: 'Erro ao excluir cotação', details: error.message });
    }
  }
}
