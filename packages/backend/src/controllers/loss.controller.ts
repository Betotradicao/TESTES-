import { Response } from 'express';
import { LossService } from '../services/loss.service';
import { AuthRequest } from '../middleware/auth';
import { AppDataSource } from '../config/database';
import { User } from '../entities/User';
import { OracleService } from '../services/oracle.service';
import { MappingService } from '../services/mapping.service';
import * as fs from 'fs';

export class LossController {
  /**
   * Helper para obter company_id do usuário logado
   * Busca no banco se não estiver no token JWT
   */
  private static async getCompanyId(req: AuthRequest): Promise<string | null> {
    // Se o token já tem companyId, usar
    if (req.user?.companyId !== undefined) {
      console.log(`📋 Company ID do token: ${req.user.companyId || 'null (MASTER)'}`);
      return req.user.companyId;
    }

    // Token antigo sem companyId - buscar no banco
    if (req.user?.id) {
      console.log(`🔍 Token sem companyId, buscando no banco para user: ${req.user.id}`);
      const userRepository = AppDataSource.getRepository(User);
      const user = await userRepository.findOne({
        where: { id: req.user.id }
      });

      if (user) {
        console.log(`📋 Company ID do banco: ${user.companyId || 'null (MASTER)'}`);
        return user.companyId;
      }
    }

    console.log(`⚠️  Company ID não encontrado, usando null`);
    return null;
  }

  /**
   * Upload e importação de arquivo de perdas
   */
  static async upload(req: AuthRequest, res: Response) {
    try {
      if (!req.file) {
        return res.status(400).json({ error: 'Nenhum arquivo enviado' });
      }

      const { nomeLote, dataInicio, dataFim, codLoja } = req.body;
      if (!nomeLote) {
        return res.status(400).json({ error: 'Nome do lote é obrigatório' });
      }

      // Pegar company_id do usuário logado (do token ou do banco)
      const companyId = await LossController.getCompanyId(req);
      const codLojaNum = codLoja ? parseInt(codLoja) : undefined;

      console.log(`📤 Upload de arquivo de perdas: ${req.file.originalname}`);
      console.log(`📦 Lote: ${nomeLote}`);
      console.log(`📅 Período: ${dataInicio || 'hoje'} até ${dataFim || 'hoje'}`);
      console.log(`🏪 Loja: ${codLojaNum || 'não especificada'}`);

      const result = await LossService.importFromFile(
        req.file.path,
        nomeLote,
        companyId,
        dataInicio,
        dataFim,
        codLojaNum
      );

      // Deletar arquivo temporário
      fs.unlinkSync(req.file.path);

      res.status(201).json({
        message: 'Arquivo importado com sucesso',
        ...result,
      });
    } catch (error: any) {
      console.error('❌ Erro ao fazer upload de perdas:', error);

      // Deletar arquivo temporário em caso de erro
      if (req.file) {
        try {
          fs.unlinkSync(req.file.path);
        } catch (e) {
          console.error('Erro ao deletar arquivo temporário:', e);
        }
      }

      res.status(500).json({ error: error.message });
    }
  }

  /**
   * Listar todos os lotes
   */
  static async getAllLotes(req: AuthRequest, res: Response) {
    try {
      const companyId = await LossController.getCompanyId(req);
      const codLoja = req.query.codLoja ? parseInt(req.query.codLoja as string) : undefined;

      const lotes = await LossService.getAllLotes(companyId || undefined, codLoja);

      res.json(lotes);
    } catch (error: any) {
      console.error('❌ Erro ao buscar lotes:', error);
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * Buscar perdas de um lote específico
   */
  static async getByLote(req: AuthRequest, res: Response) {
    try {
      const { nomeLote } = req.params;
      const companyId = await LossController.getCompanyId(req);

      const losses = await LossService.getByLote(nomeLote, companyId || undefined);

      res.json(losses);
    } catch (error: any) {
      console.error('❌ Erro ao buscar perdas por lote:', error);
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * Buscar dados agregados por seção
   */
  static async getAggregatedBySection(req: AuthRequest, res: Response) {
    try {
      const { nomeLote } = req.params;
      const companyId = await LossController.getCompanyId(req);

      const aggregated = await LossService.getAggregatedBySection(
        nomeLote,
        companyId || undefined
      );

      res.json(aggregated);
    } catch (error: any) {
      console.error('❌ Erro ao buscar dados agregados:', error);
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * Deletar lote
   */
  static async deleteLote(req: AuthRequest, res: Response) {
    try {
      const { nomeLote } = req.params;
      const companyId = await LossController.getCompanyId(req);

      await LossService.deleteLote(nomeLote, companyId || undefined);

      res.json({ message: 'Lote deletado com sucesso' });
    } catch (error: any) {
      console.error('❌ Erro ao deletar lote:', error);
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * Buscar resultados agregados com filtros
   */
  static async getAgregated(req: AuthRequest, res: Response) {
    try {
      const { data_inicio, data_fim, motivo, produto, page, limit, tipo, codLoja } = req.query;
      const companyId = await LossController.getCompanyId(req);
      const codLojaNum = codLoja ? parseInt(codLoja as string) : undefined;

      console.log('📊 Filtros recebidos:', { data_inicio, data_fim, motivo, produto, page, limit, tipo, companyId, codLoja });

      if (!data_inicio || !data_fim) {
        return res.status(400).json({
          error: 'data_inicio e data_fim são obrigatórios',
        });
      }

      const results = await LossService.getAgregatedResults({
        data_inicio: data_inicio as string,
        data_fim: data_fim as string,
        motivo: motivo as string | undefined,
        produto: produto as string | undefined,
        tipo: tipo as string | undefined,
        page: page ? parseInt(page as string) : undefined,
        limit: limit ? parseInt(limit as string) : undefined,
        companyId: companyId || undefined,
        codLoja: codLojaNum,
      });

      console.log('✅ Resultados agregados calculados com sucesso');
      res.json(results);
    } catch (error: any) {
      console.error('❌ Erro ao buscar resultados agregados:', error);
      console.error('Stack trace:', error.stack);
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * Alternar motivo ignorado
   */
  static async toggleMotivoIgnorado(req: AuthRequest, res: Response) {
    try {
      const { motivo } = req.body;
      const companyId = await LossController.getCompanyId(req);

      if (!motivo) {
        return res.status(400).json({ error: 'Motivo é obrigatório' });
      }

      const result = await LossService.toggleMotivoIgnorado(motivo, companyId || undefined);
      res.json(result);
    } catch (error: any) {
      console.error('❌ Erro ao alternar motivo ignorado:', error);
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * Listar motivos ignorados
   */
  static async getMotivosIgnorados(req: AuthRequest, res: Response) {
    try {
      const companyId = await LossController.getCompanyId(req);

      const motivos = await LossService.getMotivosIgnorados(companyId || undefined);
      res.json(motivos);
    } catch (error: any) {
      console.error('❌ Erro ao buscar motivos ignorados:', error);
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * Buscar seções únicas para filtro
   */
  static async getSecoes(req: AuthRequest, res: Response) {
    try {
      const companyId = await LossController.getCompanyId(req);

      const secoes = await LossService.getUniqueSecoes(companyId || undefined);
      res.json(secoes);
    } catch (error: any) {
      console.error('❌ Erro ao buscar seções:', error);
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * Buscar produtos únicos para filtro
   */
  static async getProdutos(req: AuthRequest, res: Response) {
    try {
      const companyId = await LossController.getCompanyId(req);

      const produtos = await LossService.getUniqueProdutos(companyId || undefined);
      res.json(produtos);
    } catch (error: any) {
      console.error('❌ Erro ao buscar produtos:', error);
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * Buscar ajustes/perdas diretamente do Oracle
   * Endpoint para a tela de Prevenção de Quebras
   */
  static async getFromOracle(req: AuthRequest, res: Response) {
    try {
      const { data_inicio, data_fim, loja, motivo, tipo } = req.query;

      if (!data_inicio || !data_fim) {
        return res.status(400).json({
          error: 'data_inicio e data_fim são obrigatórios',
        });
      }

      const codigoLoja = loja ? parseInt(loja as string) : 1;
      const tipoFiltro = (tipo as string) || 'perdas'; // 'perdas', 'entradas', 'ambos'

      console.log('📊 Buscando ajustes do Oracle:', { data_inicio, data_fim, codigoLoja, motivo, tipoFiltro });

      // Busca mapeamentos dinâmicos para campos de estoque
      const estCodProdutoCol = await MappingService.getColumn('estoque', 'cod_produto', 'COD_PRODUTO');
      const estQuantidadeCol = await MappingService.getColumn('estoque', 'quantidade', 'QTD_AJUSTE');
      const estTipoMovCol = await MappingService.getColumn('estoque', 'tipo_movimento', 'COD_AJUSTE');
      const estDataMovCol = await MappingService.getColumn('estoque', 'data_movimento', 'DTA_AJUSTE');
      const estMotivoCol = await MappingService.getColumn('estoque', 'motivo', 'MOTIVO');

      // Busca mapeamentos dinâmicos para campos de produtos
      const prodCodigoCol = await MappingService.getColumn('produtos', 'codigo', 'COD_PRODUTO');
      const prodDescricaoCol = await MappingService.getColumn('produtos', 'descricao', 'DES_PRODUTO');
      const prodEanCol = await MappingService.getColumn('produtos', 'ean', 'COD_BARRA_PRINCIPAL');

      console.log(`📋 [MAPEAMENTO ESTOQUE] Usando colunas: ${estCodProdutoCol}, ${estQuantidadeCol}, ${estTipoMovCol}, ${estDataMovCol}, ${estMotivoCol}`);

      // Buscar schema e nomes de tabelas dinâmicos
      const schema = await MappingService.getSchema();
      const tabAjusteEstoque = `${schema}.${await MappingService.getRealTableName('TAB_AJUSTE_ESTOQUE', 'TAB_AJUSTE_ESTOQUE')}`;
      const tabProduto = `${schema}.${await MappingService.getRealTableName('TAB_PRODUTO', 'TAB_PRODUTO')}`;
      const tabTipoAjuste = `${schema}.${await MappingService.getRealTableName('TAB_TIPO_AJUSTE', 'TAB_TIPO_AJUSTE')}`;
      const tabSecao = `${schema}.${await MappingService.getRealTableName('TAB_SECAO', 'TAB_SECAO')}`;

      // Query para buscar itens de ajuste com detalhes
      let whereClause = `
        WHERE ae.COD_LOJA = :loja
        AND ae.${estDataMovCol} >= TO_DATE(:data_inicio, 'YYYY-MM-DD')
        AND ae.${estDataMovCol} < TO_DATE(:data_fim, 'YYYY-MM-DD') + 1
        AND (ae.FLG_CANCELADO IS NULL OR ae.FLG_CANCELADO != 'S')
      `;

      // Filtro por motivo específico
      if (motivo && motivo !== 'todos') {
        whereClause += ` AND ta.DES_AJUSTE = :motivo`;
      }

      // Filtro por tipo (perdas = quantidade negativa, entradas = quantidade positiva)
      if (tipoFiltro === 'perdas') {
        whereClause += ` AND ae.${estQuantidadeCol} < 0`;
      } else if (tipoFiltro === 'entradas') {
        whereClause += ` AND ae.${estQuantidadeCol} > 0`;
      }

      const params: any = {
        loja: codigoLoja,
        data_inicio: data_inicio as string,
        data_fim: data_fim as string,
      };

      if (motivo && motivo !== 'todos') {
        params.motivo = motivo;
      }

      // Query principal - itens de ajuste (usando NVL para tratar NULLs)
      const itensQuery = `
        SELECT
          ae.COD_AJUSTE_ESTOQUE,
          ae.COD_LOJA,
          ae.${estTipoMovCol} as COD_AJUSTE,
          ta.DES_AJUSTE as MOTIVO,
          ae.${estCodProdutoCol} as COD_PRODUTO,
          p.${prodDescricaoCol} as DESCRICAO,
          p.${prodEanCol} as CODIGO_BARRAS,
          NVL(ae.${estQuantidadeCol}, 0) as QUANTIDADE,
          NVL(ae.VAL_CUSTO_REP, 0) as CUSTO_REPOSICAO,
          NVL(ae.${estQuantidadeCol}, 0) * NVL(ae.VAL_CUSTO_REP, 0) as VALOR_TOTAL,
          TO_CHAR(ae.${estDataMovCol}, 'YYYY-MM-DD') as DATA_AJUSTE,
          ae.USUARIO,
          ae.${estMotivoCol} as OBSERVACAO,
          s.COD_SECAO,
          s.DES_SECAO as SECAO
        FROM ${tabAjusteEstoque} ae
        JOIN ${tabProduto} p ON ae.${estCodProdutoCol} = p.${prodCodigoCol}
        LEFT JOIN ${tabTipoAjuste} ta ON ae.${estTipoMovCol} = ta.COD_AJUSTE
        LEFT JOIN ${tabSecao} s ON p.COD_SECAO = s.COD_SECAO
        ${whereClause}
        ORDER BY ae.${estDataMovCol} DESC, ABS(NVL(ae.${estQuantidadeCol}, 0) * NVL(ae.VAL_CUSTO_REP, 0)) DESC
      `;

      const itens = await OracleService.query(itensQuery, params);

      // Query para resumo por motivo (perdas) - usando NVL para tratar NULLs
      const motivosQuery = `
        SELECT
          ta.DES_AJUSTE as MOTIVO,
          COUNT(*) as TOTAL_ITENS,
          SUM(NVL(ae.${estQuantidadeCol}, 0) * NVL(ae.VAL_CUSTO_REP, 0)) as VALOR_TOTAL
        FROM ${tabAjusteEstoque} ae
        LEFT JOIN ${tabTipoAjuste} ta ON ae.${estTipoMovCol} = ta.COD_AJUSTE
        WHERE ae.COD_LOJA = :loja
        AND ae.${estDataMovCol} >= TO_DATE(:data_inicio, 'YYYY-MM-DD')
        AND ae.${estDataMovCol} < TO_DATE(:data_fim, 'YYYY-MM-DD') + 1
        AND (ae.FLG_CANCELADO IS NULL OR ae.FLG_CANCELADO != 'S')
        AND ae.${estQuantidadeCol} < 0
        GROUP BY ta.DES_AJUSTE
        ORDER BY SUM(NVL(ae.${estQuantidadeCol}, 0) * NVL(ae.VAL_CUSTO_REP, 0)) ASC
      `;

      const motivosParams = {
        loja: codigoLoja,
        data_inicio: data_inicio as string,
        data_fim: data_fim as string,
      };

      const motivosResult = await OracleService.query(motivosQuery, motivosParams);

      // Query para resumo por motivo (entradas) - usando NVL para tratar NULLs
      const entradasQuery = `
        SELECT
          ta.DES_AJUSTE as MOTIVO,
          COUNT(*) as TOTAL_ITENS,
          SUM(NVL(ae.${estQuantidadeCol}, 0) * NVL(ae.VAL_CUSTO_REP, 0)) as VALOR_TOTAL
        FROM ${tabAjusteEstoque} ae
        LEFT JOIN ${tabTipoAjuste} ta ON ae.${estTipoMovCol} = ta.COD_AJUSTE
        WHERE ae.COD_LOJA = :loja
        AND ae.${estDataMovCol} >= TO_DATE(:data_inicio, 'YYYY-MM-DD')
        AND ae.${estDataMovCol} < TO_DATE(:data_fim, 'YYYY-MM-DD') + 1
        AND (ae.FLG_CANCELADO IS NULL OR ae.FLG_CANCELADO != 'S')
        AND ae.${estQuantidadeCol} > 0
        GROUP BY ta.DES_AJUSTE
        ORDER BY SUM(NVL(ae.${estQuantidadeCol}, 0) * NVL(ae.VAL_CUSTO_REP, 0)) DESC
      `;

      const entradasResult = await OracleService.query(entradasQuery, motivosParams);

      // Calcular estatísticas com precisão (usa o alias QUANTIDADE da query)
      const totalPerdas = itens.filter((i: any) => Number(i.QUANTIDADE) < 0).length;
      const totalEntradas = itens.filter((i: any) => Number(i.QUANTIDADE) > 0).length;

      // Soma com precisão (arredondando para 2 casas decimais no final)
      const valorTotalPerdas = Math.round(
        itens
          .filter((i: any) => Number(i.QUANTIDADE) < 0)
          .reduce((acc: number, i: any) => {
            const valor = parseFloat(i.VALOR_TOTAL) || 0;
            return acc + Math.abs(valor);
          }, 0) * 100
      ) / 100;

      const valorTotalEntradas = Math.round(
        itens
          .filter((i: any) => Number(i.QUANTIDADE) > 0)
          .reduce((acc: number, i: any) => {
            const valor = parseFloat(i.VALOR_TOTAL) || 0;
            return acc + valor;
          }, 0) * 100
      ) / 100;

      console.log(`📊 Estatísticas calculadas: ${totalPerdas} perdas (R$ ${valorTotalPerdas}), ${totalEntradas} entradas (R$ ${valorTotalEntradas})`);

      // Formatar resposta no mesmo formato que o endpoint existente
      const response = {
        estatisticas: {
          total_itens: itens.length,
          total_perdas: totalPerdas,
          total_entradas: totalEntradas,
          valor_total_perdas: valorTotalPerdas,
          valor_total_entradas: valorTotalEntradas,
        },
        motivos_ranking: motivosResult.map((m: any) => ({
          motivo: m.MOTIVO || 'SEM MOTIVO',
          totalPerdas: parseInt(m.TOTAL_ITENS) || 0,
          valorPerdas: Math.round(Math.abs(parseFloat(m.VALOR_TOTAL) || 0) * 100) / 100,
        })),
        entradas_ranking: entradasResult.map((e: any) => ({
          motivo: e.MOTIVO || 'SEM MOTIVO',
          totalEntradas: parseInt(e.TOTAL_ITENS) || 0,
          valorEntradas: Math.round((parseFloat(e.VALOR_TOTAL) || 0) * 100) / 100,
        })),
        produtos_ranking: itens.map((i: any) => ({
          codigoBarras: i.CODIGO_BARRAS,
          descricao: i.DESCRICAO,
          secao: i.SECAO || 'SEM SEÇÃO',
          quantidade: Math.round((parseFloat(i.QUANTIDADE) || 0) * 1000) / 1000,
          custoReposicao: Math.round((parseFloat(i.CUSTO_REPOSICAO) || 0) * 100) / 100,
          valorPerda: Math.round((parseFloat(i.VALOR_TOTAL) || 0) * 100) / 100,
          motivo: i.MOTIVO || 'SEM MOTIVO',
          dataAjuste: i.DATA_AJUSTE,
          usuario: i.USUARIO,
        })),
        paginacao: {
          page: 1,
          limit: itens.length,
          total: itens.length,
          totalPages: 1,
        },
        fonte: 'oracle', // Indicador de que veio do Oracle
      };

      console.log(`✅ Encontrados ${itens.length} ajustes do Oracle`);
      res.json(response);
    } catch (error: any) {
      console.error('❌ Erro ao buscar ajustes do Oracle:', error);
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * Buscar tipos de ajuste do Oracle para filtro
   */
  static async getTiposAjusteOracle(req: AuthRequest, res: Response) {
    try {
      // Buscar schema e nome da tabela dinâmicos
      const schema = await MappingService.getSchema();
      const tabTipoAjuste = `${schema}.${await MappingService.getRealTableName('TAB_TIPO_AJUSTE', 'TAB_TIPO_AJUSTE')}`;

      const query = `
        SELECT COD_AJUSTE, DES_AJUSTE
        FROM ${tabTipoAjuste}
        ORDER BY DES_AJUSTE
      `;

      const tipos = await OracleService.query(query);

      res.json(tipos.map((t: any) => ({
        codigo: t.COD_AJUSTE,
        descricao: t.DES_AJUSTE,
      })));
    } catch (error: any) {
      console.error('❌ Erro ao buscar tipos de ajuste:', error);
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * Buscar trocas agrupadas por fornecedor
   * Endpoint para a tela de Gestão das Trocas
   * tipo: 'saidas' (SAIR ESTOQUE LOJA ENTRAR TROCA FORNECEDOR) ou 'entradas' (SAIR TROCA FORNECEDOR ENTRAR ESTOQUE LOJA)
   * Usando mesma lógica do sistema legado:
   * - Apenas tipo principal (sem "NÃO VOLTAR")
   * - SOMA(VAL_CUSTO_REP) e SOMA(VAL_VENDA) direto (não multiplicado por quantidade)
   */
  static async getTrocasFornecedor(req: AuthRequest, res: Response) {
    try {
      const { loja, tipo, dias } = req.query;

      const codigoLoja = loja ? parseInt(loja as string) : 1;
      const tipoTroca = (tipo as string) || 'saidas'; // 'saidas' ou 'entradas'
      const diasFiltro = dias ? parseInt(dias as string) : 0;

      console.log('📦 Buscando trocas por fornecedor:', { codigoLoja, tipoTroca, diasFiltro });

      // Busca mapeamentos dinâmicos para campos de estoque
      const estQuantidadeCol = await MappingService.getColumn('estoque', 'quantidade', 'QTD_AJUSTE');
      const estTipoMovCol = await MappingService.getColumn('estoque', 'tipo_movimento', 'COD_AJUSTE');
      const estDataMovCol = await MappingService.getColumn('estoque', 'data_movimento', 'DTA_AJUSTE');

      // Busca mapeamentos dinâmicos para campos de fornecedores
      const fornCodigoCol = await MappingService.getColumn('fornecedores', 'codigo', 'COD_FORNECEDOR');
      const fornRazaoSocialCol = await MappingService.getColumn('fornecedores', 'razao_social', 'DES_FORNECEDOR');
      const fornFantasiaCol = await MappingService.getColumn('fornecedores', 'fantasia', 'DES_FANTASIA');

      // Filtro por tipo de ajuste baseado na descrição
      // Saídas: produto sai da loja para troca com fornecedor (tipo principal apenas)
      // Entradas: produto volta do fornecedor para a loja
      const tipoAjusteFiltro = tipoTroca === 'entradas'
        ? "ta.DES_AJUSTE = 'SAIR TROCA FORNECEDOR ENTRAR ESTOQUE LOJA'"
        : "ta.DES_AJUSTE = 'SAIR ESTOQUE LOJA ENTRAR TROCA FORNECEDOR'";

      // Filtro de período (dias)
      const filtroPeriodo = diasFiltro > 0 ? `AND ae.${estDataMovCol} >= SYSDATE - :dias` : '';

      // Buscar schema e nomes de tabelas dinâmicos
      const schema = await MappingService.getSchema();
      const tabAjusteEstoque = `${schema}.${await MappingService.getRealTableName('TAB_AJUSTE_ESTOQUE', 'TAB_AJUSTE_ESTOQUE')}`;
      const tabFornecedor = `${schema}.${await MappingService.getRealTableName('TAB_FORNECEDOR', 'TAB_FORNECEDOR')}`;
      const tabTipoAjuste = `${schema}.${await MappingService.getRealTableName('TAB_TIPO_AJUSTE', 'TAB_TIPO_AJUSTE')}`;

      // Query para buscar trocas agrupadas por fornecedor
      // Usando mesma lógica do sistema legado: SOMA dos valores direto, não multiplicado por quantidade
      const fornecedoresQuery = `
        SELECT
          NVL(f.${fornCodigoCol}, 0) as COD_FORNECEDOR,
          NVL(f.${fornRazaoSocialCol}, 'SEM FORNECEDOR') as FORNECEDOR,
          NVL(f.${fornFantasiaCol}, f.${fornRazaoSocialCol}) as FANTASIA,
          COUNT(DISTINCT ae.COD_PRODUTO) as QTD_PRODUTOS,
          COUNT(*) as QTD_ITENS,
          SUM(ABS(NVL(ae.${estQuantidadeCol}, 0))) as QTD_TOTAL,
          SUM(NVL(ae.VAL_CUSTO_REP, 0)) as TOTAL_CUSTO,
          SUM(NVL(ae.VAL_VENDA, 0)) as TOTAL_VENDA
        FROM ${tabAjusteEstoque} ae
        LEFT JOIN ${tabFornecedor} f ON ae.COD_FORNECEDOR = f.${fornCodigoCol}
        LEFT JOIN ${tabTipoAjuste} ta ON ae.${estTipoMovCol} = ta.COD_AJUSTE
        WHERE ae.COD_LOJA = :loja
        AND (ae.FLG_CANCELADO IS NULL OR ae.FLG_CANCELADO = 'N')
        AND ${tipoAjusteFiltro}
        ${filtroPeriodo}
        GROUP BY f.${fornCodigoCol}, f.${fornRazaoSocialCol}, f.${fornFantasiaCol}
        ORDER BY SUM(NVL(ae.VAL_CUSTO_REP, 0)) DESC
      `;

      const params: any = {
        loja: codigoLoja,
      };
      if (diasFiltro > 0) {
        params.dias = diasFiltro;
      }

      const fornecedores = await OracleService.query(fornecedoresQuery, params);

      // Calcular totais
      const totalCusto = fornecedores.reduce((acc: number, f: any) => acc + (parseFloat(f.TOTAL_CUSTO) || 0), 0);
      const totalVenda = fornecedores.reduce((acc: number, f: any) => acc + (parseFloat(f.TOTAL_VENDA) || 0), 0);
      const totalItens = fornecedores.reduce((acc: number, f: any) => acc + (parseInt(f.QTD_ITENS) || 0), 0);
      const totalProdutos = fornecedores.reduce((acc: number, f: any) => acc + (parseInt(f.QTD_PRODUTOS) || 0), 0);

      const response = {
        estatisticas: {
          total_fornecedores: fornecedores.length,
          total_produtos: totalProdutos,
          total_itens: totalItens,
          valor_total: Math.round(totalCusto * 100) / 100,
          total_custo: Math.round(totalCusto * 100) / 100,
          total_venda: Math.round(totalVenda * 100) / 100,
        },
        fornecedores: fornecedores.map((f: any) => ({
          codFornecedor: parseInt(f.COD_FORNECEDOR) || 0,
          fornecedor: f.FORNECEDOR || 'SEM FORNECEDOR',
          fantasia: f.FANTASIA || f.FORNECEDOR || 'SEM FORNECEDOR',
          qtdProdutos: parseInt(f.QTD_PRODUTOS) || 0,
          qtdItens: parseInt(f.QTD_ITENS) || 0,
          qtdTotal: Math.round((parseFloat(f.QTD_TOTAL) || 0) * 1000) / 1000,
          totalCusto: Math.round((parseFloat(f.TOTAL_CUSTO) || 0) * 100) / 100,
          totalVenda: Math.round((parseFloat(f.TOTAL_VENDA) || 0) * 100) / 100,
          valorTotal: Math.round((parseFloat(f.TOTAL_CUSTO) || 0) * 100) / 100, // mantém para compatibilidade
        })),
      };

      console.log(`✅ Encontrados ${fornecedores.length} fornecedores com trocas (${tipoTroca})`);
      res.json(response);
    } catch (error: any) {
      console.error('❌ Erro ao buscar trocas por fornecedor:', error);
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * Buscar perdas mensais por produto (mês anterior e mês atual)
   * Usado na tela de Prevenção de Quebras para mostrar histórico
   */
  static async getPerdasMensaisPorProduto(req: AuthRequest, res: Response) {
    try {
      const { loja, codigos } = req.query;

      const codigoLoja = loja ? parseInt(loja as string) : 1;

      // Calcular datas do mês anterior e mês atual
      const hoje = new Date();
      const primeiroDiaMesAtual = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
      const primeiroDiaMesAnterior = new Date(hoje.getFullYear(), hoje.getMonth() - 1, 1);
      const ultimoDiaMesAnterior = new Date(hoje.getFullYear(), hoje.getMonth(), 0);

      // Formatar datas para Oracle
      const formatDate = (d: Date) => d.toISOString().split('T')[0];
      const dataMesAnteriorInicio = formatDate(primeiroDiaMesAnterior);
      const dataMesAnteriorFim = formatDate(ultimoDiaMesAnterior);
      const dataMesAtualInicio = formatDate(primeiroDiaMesAtual);
      const dataMesAtualFim = formatDate(hoje);

      console.log('📊 Buscando perdas mensais por produto:', {
        codigoLoja,
        mesAnterior: `${dataMesAnteriorInicio} até ${dataMesAnteriorFim}`,
        mesAtual: `${dataMesAtualInicio} até ${dataMesAtualFim}`,
      });

      // Busca mapeamentos dinâmicos para campos de estoque
      const estCodProdutoCol = await MappingService.getColumn('estoque', 'cod_produto', 'COD_PRODUTO');
      const estQuantidadeCol = await MappingService.getColumn('estoque', 'quantidade', 'QTD_AJUSTE');
      const estDataMovCol = await MappingService.getColumn('estoque', 'data_movimento', 'DTA_AJUSTE');

      // Busca mapeamentos dinâmicos para campos de produtos
      const prodCodigoCol = await MappingService.getColumn('produtos', 'codigo', 'COD_PRODUTO');
      const prodEanCol = await MappingService.getColumn('produtos', 'ean', 'COD_BARRA_PRINCIPAL');

      // Filtro de códigos específicos (opcional)
      let filtroCodigosSQL = '';

      // Params separados para cada query (Oracle não aceita bind variables não usadas na query)
      const paramsMesAnterior: any = {
        loja: codigoLoja,
        dtAntIni: dataMesAnteriorInicio,
        dtAntFim: dataMesAnteriorFim,
      };

      const paramsMesAtual: any = {
        loja: codigoLoja,
        dtAtualIni: dataMesAtualInicio,
        dtAtualFim: dataMesAtualFim,
      };

      if (codigos) {
        const listaCodigos = (codigos as string).split(',').map(c => c.trim());
        filtroCodigosSQL = ` AND p.${prodEanCol} IN (${listaCodigos.map((_, i) => `:cod${i}`).join(',')})`;
        listaCodigos.forEach((cod, i) => {
          paramsMesAnterior[`cod${i}`] = cod;
          paramsMesAtual[`cod${i}`] = cod;
        });
      }

      // Buscar schema e nomes de tabelas dinâmicos
      const schema = await MappingService.getSchema();
      const tabAjusteEstoque = `${schema}.${await MappingService.getRealTableName('TAB_AJUSTE_ESTOQUE', 'TAB_AJUSTE_ESTOQUE')}`;
      const tabProduto = `${schema}.${await MappingService.getRealTableName('TAB_PRODUTO', 'TAB_PRODUTO')}`;

      // Query para perdas do mês anterior (quantidade negativa = perda)
      // Retorna tanto COD_PRODUTO quanto COD_BARRA_PRINCIPAL para poder fazer match
      // Inclui tanto VALOR_PERDA (R$) quanto QTD_PERDA (kg)
      const queryMesAnterior = `
        SELECT
          TO_CHAR(p.${prodCodigoCol}) as COD_PRODUTO,
          p.${prodEanCol} as CODIGO_BARRAS,
          SUM(ABS(NVL(ae.${estQuantidadeCol}, 0) * NVL(ae.VAL_CUSTO_REP, 0))) as VALOR_PERDA,
          SUM(ABS(NVL(ae.${estQuantidadeCol}, 0))) as QTD_PERDA
        FROM ${tabAjusteEstoque} ae
        JOIN ${tabProduto} p ON ae.${estCodProdutoCol} = p.${prodCodigoCol}
        WHERE ae.COD_LOJA = :loja
        AND ae.${estDataMovCol} >= TO_DATE(:dtAntIni, 'YYYY-MM-DD')
        AND ae.${estDataMovCol} <= TO_DATE(:dtAntFim, 'YYYY-MM-DD')
        AND (ae.FLG_CANCELADO IS NULL OR ae.FLG_CANCELADO != 'S')
        AND ae.${estQuantidadeCol} < 0
        ${filtroCodigosSQL}
        GROUP BY p.${prodCodigoCol}, p.${prodEanCol}
      `;

      // Query para perdas do mês atual
      const queryMesAtual = `
        SELECT
          TO_CHAR(p.${prodCodigoCol}) as COD_PRODUTO,
          p.${prodEanCol} as CODIGO_BARRAS,
          SUM(ABS(NVL(ae.${estQuantidadeCol}, 0) * NVL(ae.VAL_CUSTO_REP, 0))) as VALOR_PERDA,
          SUM(ABS(NVL(ae.${estQuantidadeCol}, 0))) as QTD_PERDA
        FROM ${tabAjusteEstoque} ae
        JOIN ${tabProduto} p ON ae.${estCodProdutoCol} = p.${prodCodigoCol}
        WHERE ae.COD_LOJA = :loja
        AND ae.${estDataMovCol} >= TO_DATE(:dtAtualIni, 'YYYY-MM-DD')
        AND ae.${estDataMovCol} <= TO_DATE(:dtAtualFim, 'YYYY-MM-DD')
        AND (ae.FLG_CANCELADO IS NULL OR ae.FLG_CANCELADO != 'S')
        AND ae.${estQuantidadeCol} < 0
        ${filtroCodigosSQL}
        GROUP BY p.${prodCodigoCol}, p.${prodEanCol}
      `;

      // Executar queries em paralelo (com params separados para cada query)
      const [perdasMesAnterior, perdasMesAtual] = await Promise.all([
        OracleService.query(queryMesAnterior, paramsMesAnterior),
        OracleService.query(queryMesAtual, paramsMesAtual),
      ]);

      // Montar objeto de resultado indexado por código do produto E código de barras
      // Inclui valor (R$) e quantidade (kg) para mês anterior e atual
      const resultado: Record<string, {
        mesAnterior: number;
        mesAtual: number;
        qtdMesAnterior: number;
        qtdMesAtual: number;
      }> = {};

      // Função helper para indexar perda por múltiplas chaves
      const indexarPerda = (
        codProduto: string | null,
        codigoBarras: string | null,
        valorPerda: number,
        qtdPerda: number,
        campo: 'mesAnterior' | 'mesAtual'
      ) => {
        const chaves: string[] = [];

        if (codProduto) {
          // Adicionar código original exatamente como veio
          const codStr = String(codProduto);
          if (!chaves.includes(codStr)) chaves.push(codStr);

          // Adicionar código sem zeros à esquerda (como número convertido para string)
          const codSemZeros = String(codProduto).replace(/^0+/, '') || codProduto;
          if (!chaves.includes(codSemZeros)) chaves.push(codSemZeros);

          // Adicionar o código como número puro (caso o frontend use número)
          const codNumero = parseInt(codSemZeros, 10);
          if (!isNaN(codNumero)) {
            const codNumStr = String(codNumero);
            if (!chaves.includes(codNumStr)) chaves.push(codNumStr);
          }

          // Adicionar código com vários tamanhos de padding (8, 13, etc)
          // 8 dígitos: usado na Auditoria de Produção (00017886)
          // 13 dígitos: usado na Prevenção de Quebras (0000000017886)
          const tamanhos = [5, 6, 7, 8, 10, 12, 13, 14];
          tamanhos.forEach(tam => {
            const codN = codSemZeros.padStart(tam, '0');
            if (!chaves.includes(codN)) chaves.push(codN);
          });
        }

        // Adicionar código de barras/EAN
        if (codigoBarras) {
          const eanStr = String(codigoBarras);
          if (!chaves.includes(eanStr)) chaves.push(eanStr);

          // Também adicionar EAN sem zeros à esquerda
          const eanSemZeros = eanStr.replace(/^0+/, '') || eanStr;
          if (!chaves.includes(eanSemZeros)) chaves.push(eanSemZeros);
        }

        // Indexar por todas as chaves
        chaves.forEach(chave => {
          if (!resultado[chave]) {
            resultado[chave] = { mesAnterior: 0, mesAtual: 0, qtdMesAnterior: 0, qtdMesAtual: 0 };
          }
          resultado[chave][campo] += valorPerda;
          resultado[chave][campo === 'mesAnterior' ? 'qtdMesAnterior' : 'qtdMesAtual'] += qtdPerda;
        });
      };

      // Processar perdas do mês anterior
      console.log(`📊 Processando ${perdasMesAnterior.length} registros de perdas do mês anterior`);
      if (perdasMesAnterior.length > 0) {
        console.log('📊 Amostra de dados (mês anterior):', JSON.stringify(perdasMesAnterior.slice(0, 3)));
      }
      perdasMesAnterior.forEach((p: any) => {
        const valorPerda = Math.round((parseFloat(p.VALOR_PERDA) || 0) * 100) / 100;
        const qtdPerda = Math.round((parseFloat(p.QTD_PERDA) || 0) * 1000) / 1000;
        indexarPerda(p.COD_PRODUTO, p.CODIGO_BARRAS, valorPerda, qtdPerda, 'mesAnterior');
      });

      // Processar perdas do mês atual
      console.log(`📊 Processando ${perdasMesAtual.length} registros de perdas do mês atual`);
      if (perdasMesAtual.length > 0) {
        console.log('📊 Amostra de dados (mês atual):', JSON.stringify(perdasMesAtual.slice(0, 3)));
      }
      perdasMesAtual.forEach((p: any) => {
        const valorPerda = Math.round((parseFloat(p.VALOR_PERDA) || 0) * 100) / 100;
        const qtdPerda = Math.round((parseFloat(p.QTD_PERDA) || 0) * 1000) / 1000;
        indexarPerda(p.COD_PRODUTO, p.CODIGO_BARRAS, valorPerda, qtdPerda, 'mesAtual');
      });

      // Log de amostra das chaves geradas
      const chaves = Object.keys(resultado).slice(0, 20);
      console.log(`📊 Amostra de chaves indexadas (${Object.keys(resultado).length} total):`, chaves);

      console.log(`✅ Encontradas perdas para ${Object.keys(resultado).length} produtos`);

      res.json({
        periodo: {
          mesAnterior: {
            inicio: dataMesAnteriorInicio,
            fim: dataMesAnteriorFim,
            nome: primeiroDiaMesAnterior.toLocaleString('pt-BR', { month: 'long', year: 'numeric' }),
          },
          mesAtual: {
            inicio: dataMesAtualInicio,
            fim: dataMesAtualFim,
            nome: primeiroDiaMesAtual.toLocaleString('pt-BR', { month: 'long', year: 'numeric' }),
          },
        },
        perdasPorProduto: resultado,
      });
    } catch (error: any) {
      console.error('❌ Erro ao buscar perdas mensais por produto:', error);
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * Buscar itens de troca de um fornecedor específico
   */
  static async getTrocasItensFornecedor(req: AuthRequest, res: Response) {
    try {
      const { loja, cod_fornecedor, tipo, dias } = req.query;

      const codigoLoja = loja ? parseInt(loja as string) : 1;
      const codForn = cod_fornecedor ? parseInt(cod_fornecedor as string) : 0;
      const tipoTroca = (tipo as string) || 'saidas';
      const diasFiltro = dias ? parseInt(dias as string) : 0;

      console.log('📦 Buscando itens de troca do fornecedor:', { codigoLoja, codForn, tipoTroca, diasFiltro });

      // Busca mapeamentos dinâmicos para campos de estoque
      const estCodProdutoCol = await MappingService.getColumn('estoque', 'cod_produto', 'COD_PRODUTO');
      const estQuantidadeCol = await MappingService.getColumn('estoque', 'quantidade', 'QTD_AJUSTE');
      const estTipoMovCol = await MappingService.getColumn('estoque', 'tipo_movimento', 'COD_AJUSTE');
      const estDataMovCol = await MappingService.getColumn('estoque', 'data_movimento', 'DTA_AJUSTE');

      // Busca mapeamentos dinâmicos para campos de produtos
      const prodCodigoCol = await MappingService.getColumn('produtos', 'codigo', 'COD_PRODUTO');
      const prodDescricaoCol = await MappingService.getColumn('produtos', 'descricao', 'DES_PRODUTO');
      const prodEanCol = await MappingService.getColumn('produtos', 'ean', 'COD_BARRA_PRINCIPAL');

      // Filtro por tipo de ajuste baseado na descrição (tipo principal apenas)
      // Saídas: produto sai da loja para troca com fornecedor
      // Entradas: produto volta do fornecedor para a loja
      const tipoAjusteFiltro = tipoTroca === 'entradas'
        ? "ta.DES_AJUSTE = 'SAIR TROCA FORNECEDOR ENTRAR ESTOQUE LOJA'"
        : "ta.DES_AJUSTE = 'SAIR ESTOQUE LOJA ENTRAR TROCA FORNECEDOR'";

      // Filtro de período (dias)
      const filtroPeriodo = diasFiltro > 0 ? `AND ae.${estDataMovCol} >= SYSDATE - :dias` : '';

      // Buscar schema e nomes de tabelas dinâmicos
      const schema = await MappingService.getSchema();
      const tabAjusteEstoque = `${schema}.${await MappingService.getRealTableName('TAB_AJUSTE_ESTOQUE', 'TAB_AJUSTE_ESTOQUE')}`;
      const tabProduto = `${schema}.${await MappingService.getRealTableName('TAB_PRODUTO', 'TAB_PRODUTO')}`;
      const tabTipoAjuste = `${schema}.${await MappingService.getRealTableName('TAB_TIPO_AJUSTE', 'TAB_TIPO_AJUSTE')}`;
      const tabSecao = `${schema}.${await MappingService.getRealTableName('TAB_SECAO', 'TAB_SECAO')}`;

      // Query para buscar itens do fornecedor
      const itensQuery = `
        SELECT
          ae.${estCodProdutoCol} as COD_PRODUTO,
          p.${prodDescricaoCol} as DESCRICAO,
          p.${prodEanCol} as CODIGO_BARRAS,
          ta.DES_AJUSTE as TIPO_AJUSTE,
          s.DES_SECAO as SECAO,
          NVL(ae.${estQuantidadeCol}, 0) as QUANTIDADE,
          NVL(ae.VAL_CUSTO_REP, 0) as CUSTO_REPOSICAO,
          NVL(ae.${estQuantidadeCol}, 0) * NVL(ae.VAL_CUSTO_REP, 0) as VALOR_TOTAL,
          TO_CHAR(ae.${estDataMovCol}, 'YYYY-MM-DD') as DATA_AJUSTE,
          ae.USUARIO
        FROM ${tabAjusteEstoque} ae
        JOIN ${tabProduto} p ON ae.${estCodProdutoCol} = p.${prodCodigoCol}
        LEFT JOIN ${tabTipoAjuste} ta ON ae.${estTipoMovCol} = ta.COD_AJUSTE
        LEFT JOIN ${tabSecao} s ON p.COD_SECAO = s.COD_SECAO
        WHERE ae.COD_LOJA = :loja
        AND (ae.FLG_CANCELADO IS NULL OR ae.FLG_CANCELADO = 'N')
        AND ${tipoAjusteFiltro}
        ${filtroPeriodo}
        AND NVL(ae.COD_FORNECEDOR, 0) = :cod_fornecedor
        ORDER BY ae.${estDataMovCol} DESC, ABS(NVL(ae.VAL_CUSTO_REP, 0)) DESC
      `;

      const params: any = {
        loja: codigoLoja,
        cod_fornecedor: codForn,
      };
      if (diasFiltro > 0) {
        params.dias = diasFiltro;
      }

      const itens = await OracleService.query(itensQuery, params);

      const response = {
        itens: itens.map((i: any) => ({
          codProduto: i.COD_PRODUTO,
          descricao: i.DESCRICAO,
          codigoBarras: i.CODIGO_BARRAS,
          tipoAjuste: i.TIPO_AJUSTE,
          secao: i.SECAO || 'SEM SEÇÃO',
          quantidade: Math.round((parseFloat(i.QUANTIDADE) || 0) * 1000) / 1000,
          custoReposicao: Math.round((parseFloat(i.CUSTO_REPOSICAO) || 0) * 100) / 100,
          valorTotal: Math.round((parseFloat(i.VALOR_TOTAL) || 0) * 100) / 100,
          dataAjuste: i.DATA_AJUSTE,
          usuario: i.USUARIO,
        })),
      };

      console.log(`✅ Encontrados ${itens.length} itens de troca do fornecedor ${codForn}`);
      res.json(response);
    } catch (error: any) {
      console.error('❌ Erro ao buscar itens de troca:', error);
      res.status(500).json({ error: error.message });
    }
  }
}
