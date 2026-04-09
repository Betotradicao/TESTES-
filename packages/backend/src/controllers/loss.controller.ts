import { Response } from 'express';
import { LossService } from '../services/loss.service';
import { AuthRequest } from '../middleware/auth';
import { AppDataSource } from '../config/database';
import { User } from '../entities/User';
import { OracleService } from '../services/oracle.service';
import { MappingService } from '../services/mapping.service';
import { DatabaseConnection, DatabaseType, ConnectionStatus } from '../entities/DatabaseConnection';
import * as fs from 'fs';

export class LossController {
  /**
   * Detecta tipo do banco ativo (oracle/postgresql) - usado pra bifurcacao multi-ERP
   */
  private static async detectActiveDbType(): Promise<'oracle' | 'postgresql' | 'other'> {
    try {
      if (!AppDataSource.isInitialized) return 'oracle';
      const repo = AppDataSource.getRepository(DatabaseConnection);
      let conn = await repo.findOne({ where: { is_default: true, status: ConnectionStatus.ACTIVE } });
      if (!conn) conn = await repo.findOne({ where: { status: ConnectionStatus.ACTIVE } });
      if (!conn) conn = await repo.findOne({ where: {}, order: { id: 'ASC' } });
      if (!conn) return 'oracle';
      if (conn.type === DatabaseType.POSTGRESQL) return 'postgresql';
      if (conn.type === DatabaseType.ORACLE) return 'oracle';
      return 'other';
    } catch {
      return 'oracle';
    }
  }

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
   * Helper para resolver mapeamentos de colunas Oracle usados nos métodos de perda/troca.
   * Centraliza todas as chamadas ao MappingService para evitar duplicação.
   */
  private static async getLossMappings() {
    // --- TAB_AJUSTE_ESTOQUE (100% dinâmico, sem fallback) ---
    const estCodAjusteEstoqueCol = await MappingService.getColumnFromTable('TAB_AJUSTE_ESTOQUE', 'codigo_ajuste_estoque');
    const estCodProdutoCol = await MappingService.getColumnFromTable('TAB_AJUSTE_ESTOQUE', 'codigo_produto');
    const estQuantidadeCol = await MappingService.getColumnFromTable('TAB_AJUSTE_ESTOQUE', 'quantidade');
    const estTipoMovCol = await MappingService.getColumnFromTable('TAB_AJUSTE_ESTOQUE', 'tipo_ajuste');
    const estDataMovCol = await MappingService.getColumnFromTable('TAB_AJUSTE_ESTOQUE', 'data_ajuste');
    const estMotivoCol = await MappingService.getColumnFromTable('TAB_AJUSTE_ESTOQUE', 'motivo');
    const estCodLojaCol = await MappingService.getColumnFromTable('TAB_AJUSTE_ESTOQUE', 'codigo_loja');
    const estValCustoRepCol = await MappingService.getColumnFromTable('TAB_AJUSTE_ESTOQUE', 'valor_custo_reposicao');
    const estFlgCanceladoCol = await MappingService.getColumnFromTable('TAB_AJUSTE_ESTOQUE', 'flag_cancelado');
    const estValVendaCol = await MappingService.getColumnFromTable('TAB_AJUSTE_ESTOQUE', 'valor_venda');
    const estCodFornecedorCol = await MappingService.getColumnFromTable('TAB_AJUSTE_ESTOQUE', 'codigo_fornecedor');
    const estUsuarioCol = await MappingService.getColumnFromTable('TAB_AJUSTE_ESTOQUE', 'usuario');
    // Colunas de saldo de troca (para calcular trocas pendentes)
    const estQtdEstPostTrocaCol = await MappingService.getColumnFromTable('TAB_AJUSTE_ESTOQUE', 'qtd_est_post_troca').catch(() => 'QTD_EST_POST_TROCA');

    // --- TAB_PRODUTO ---
    const prodCodigoCol = await MappingService.getColumnFromTable('TAB_PRODUTO', 'codigo_produto');
    const prodDescricaoCol = await MappingService.getColumnFromTable('TAB_PRODUTO', 'descricao');
    const prodEanCol = await MappingService.getColumnFromTable('TAB_PRODUTO', 'codigo_barras');
    const prodCodSecaoCol = await MappingService.getColumnFromTable('TAB_PRODUTO', 'codigo_secao');

    // --- TAB_SECAO ---
    const secCodSecaoCol = await MappingService.getColumnFromTable('TAB_SECAO', 'codigo_secao');
    const secDesSecaoCol = await MappingService.getColumnFromTable('TAB_SECAO', 'descricao_secao');

    // --- TAB_FORNECEDOR ---
    const fornCodigoCol = await MappingService.getColumnFromTable('TAB_FORNECEDOR', 'codigo_fornecedor');
    const fornRazaoSocialCol = await MappingService.getColumnFromTable('TAB_FORNECEDOR', 'razao_social');
    const fornFantasiaCol = await MappingService.getColumnFromTable('TAB_FORNECEDOR', 'nome_fantasia');

    // --- TAB_TIPO_AJUSTE ---
    const taCodAjusteCol = await MappingService.getColumnFromTable('TAB_TIPO_AJUSTE', 'codigo_ajuste');
    const taDesAjusteCol = await MappingService.getColumnFromTable('TAB_TIPO_AJUSTE', 'descricao_ajuste');

    return {
      // TAB_AJUSTE_ESTOQUE
      estCodAjusteEstoqueCol, estCodProdutoCol, estQuantidadeCol, estTipoMovCol, estDataMovCol,
      estMotivoCol, estCodLojaCol, estValCustoRepCol,
      estFlgCanceladoCol, estValVendaCol, estCodFornecedorCol, estUsuarioCol, estQtdEstPostTrocaCol,
      // TAB_PRODUTO
      prodCodigoCol, prodDescricaoCol, prodEanCol, prodCodSecaoCol,
      // TAB_SECAO
      secCodSecaoCol, secDesSecaoCol,
      // TAB_FORNECEDOR
      fornCodigoCol, fornRazaoSocialCol, fornFantasiaCol,
      // TAB_TIPO_AJUSTE
      taCodAjusteCol, taDesAjusteCol,
    };
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

      // Busca mapeamentos dinâmicos via helper centralizado
      const m = await LossController.getLossMappings();

      console.log(`📋 [MAPEAMENTO ESTOQUE] Usando colunas: ${m.estCodProdutoCol}, ${m.estQuantidadeCol}, ${m.estTipoMovCol}, ${m.estDataMovCol}, ${m.estMotivoCol}`);

      // Buscar schema e nomes de tabelas dinâmicos
      const schema = await MappingService.getSchema();
      const tabAjusteEstoque = `${schema}.${await MappingService.getRealTableName('TAB_AJUSTE_ESTOQUE')}`;
      const tabProduto = `${schema}.${await MappingService.getRealTableName('TAB_PRODUTO')}`;
      const tabTipoAjuste = `${schema}.${await MappingService.getRealTableName('TAB_TIPO_AJUSTE')}`;
      const tabSecao = `${schema}.${await MappingService.getRealTableName('TAB_SECAO')}`;

      // Query para buscar itens de ajuste com detalhes
      let whereClause = `
        WHERE ae.${m.estCodLojaCol} = :loja
        AND ae.${m.estDataMovCol} >= TO_DATE(:data_inicio, 'YYYY-MM-DD')
        AND ae.${m.estDataMovCol} < TO_DATE(:data_fim, 'YYYY-MM-DD') + 1
        AND (ae.${m.estFlgCanceladoCol} IS NULL OR ae.${m.estFlgCanceladoCol} != 'S')
      `;

      // Filtro por motivo específico
      // ta.${m.taDesAjusteCol}: coluna de TAB_TIPO_AJUSTE - sem mapeamento no TABLE_CATALOG
      if (motivo && motivo !== 'todos') {
        whereClause += ` AND ta.${m.taDesAjusteCol} = :motivo`;
      }

      // Filtro por tipo (perdas = quantidade negativa, entradas = quantidade positiva)
      if (tipoFiltro === 'perdas') {
        whereClause += ` AND ae.${m.estQuantidadeCol} < 0`;
      } else if (tipoFiltro === 'entradas') {
        whereClause += ` AND ae.${m.estQuantidadeCol} > 0`;
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
          ae.${m.estCodAjusteEstoqueCol},
          ae.${m.estCodLojaCol} as COD_LOJA,
          ae.${m.estTipoMovCol} as COD_AJUSTE,
          ta.${m.taDesAjusteCol} as MOTIVO,
          ae.${m.estCodProdutoCol} as COD_PRODUTO,
          p.${m.prodDescricaoCol} as DESCRICAO,
          p.${m.prodEanCol} as CODIGO_BARRAS,
          NVL(ae.${m.estQuantidadeCol}, 0) as QUANTIDADE,
          NVL(ae.${m.estValCustoRepCol}, 0) as CUSTO_REPOSICAO,
          NVL(ae.${m.estQuantidadeCol}, 0) * NVL(ae.${m.estValCustoRepCol}, 0) as VALOR_TOTAL,
          TO_CHAR(ae.${m.estDataMovCol}, 'YYYY-MM-DD') as DATA_AJUSTE,
          ae.${m.estUsuarioCol},
          ae.${m.estMotivoCol} as OBSERVACAO,
          s.${m.secCodSecaoCol},
          s.${m.secDesSecaoCol} as SECAO
        FROM ${tabAjusteEstoque} ae
        JOIN ${tabProduto} p ON ae.${m.estCodProdutoCol} = p.${m.prodCodigoCol}
        LEFT JOIN ${tabTipoAjuste} ta ON ae.${m.estTipoMovCol} = ta.${m.taCodAjusteCol}
        LEFT JOIN ${tabSecao} s ON p.${m.prodCodSecaoCol} = s.${m.secCodSecaoCol}
        ${whereClause}
        ORDER BY ae.${m.estDataMovCol} DESC, ABS(NVL(ae.${m.estQuantidadeCol}, 0) * NVL(ae.${m.estValCustoRepCol}, 0)) DESC
      `;

      const itens = await OracleService.query(itensQuery, params);

      // Query para resumo por motivo (perdas) - usando NVL para tratar NULLs
      const motivosQuery = `
        SELECT
          ta.${m.taDesAjusteCol} as MOTIVO,
          COUNT(*) as TOTAL_ITENS,
          SUM(NVL(ae.${m.estQuantidadeCol}, 0) * NVL(ae.${m.estValCustoRepCol}, 0)) as VALOR_TOTAL
        FROM ${tabAjusteEstoque} ae
        LEFT JOIN ${tabTipoAjuste} ta ON ae.${m.estTipoMovCol} = ta.${m.taCodAjusteCol}
        WHERE ae.${m.estCodLojaCol} = :loja
        AND ae.${m.estDataMovCol} >= TO_DATE(:data_inicio, 'YYYY-MM-DD')
        AND ae.${m.estDataMovCol} < TO_DATE(:data_fim, 'YYYY-MM-DD') + 1
        AND (ae.${m.estFlgCanceladoCol} IS NULL OR ae.${m.estFlgCanceladoCol} != 'S')
        AND ae.${m.estQuantidadeCol} < 0
        GROUP BY ta.${m.taDesAjusteCol}
        ORDER BY SUM(NVL(ae.${m.estQuantidadeCol}, 0) * NVL(ae.${m.estValCustoRepCol}, 0)) ASC
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
          ta.${m.taDesAjusteCol} as MOTIVO,
          COUNT(*) as TOTAL_ITENS,
          SUM(NVL(ae.${m.estQuantidadeCol}, 0) * NVL(ae.${m.estValCustoRepCol}, 0)) as VALOR_TOTAL
        FROM ${tabAjusteEstoque} ae
        LEFT JOIN ${tabTipoAjuste} ta ON ae.${m.estTipoMovCol} = ta.${m.taCodAjusteCol}
        WHERE ae.${m.estCodLojaCol} = :loja
        AND ae.${m.estDataMovCol} >= TO_DATE(:data_inicio, 'YYYY-MM-DD')
        AND ae.${m.estDataMovCol} < TO_DATE(:data_fim, 'YYYY-MM-DD') + 1
        AND (ae.${m.estFlgCanceladoCol} IS NULL OR ae.${m.estFlgCanceladoCol} != 'S')
        AND ae.${m.estQuantidadeCol} > 0
        GROUP BY ta.${m.taDesAjusteCol}
        ORDER BY SUM(NVL(ae.${m.estQuantidadeCol}, 0) * NVL(ae.${m.estValCustoRepCol}, 0)) DESC
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
      const m = await LossController.getLossMappings();
      const schema = await MappingService.getSchema();
      const tabTipoAjuste = `${schema}.${await MappingService.getRealTableName('TAB_TIPO_AJUSTE')}`;

      const query = `
        SELECT ${m.taCodAjusteCol} as COD_AJUSTE, ${m.taDesAjusteCol} as DES_AJUSTE
        FROM ${tabTipoAjuste}
        ORDER BY ${m.taDesAjusteCol}
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
   * tipo: 'saldo' (pendente via POST_TROCA), 'saidas', 'retornos', 'zerados'
   * Saldo: QTD_EST_POST_TROCA do último registro de SAÍDA + filtro ACEITA_DEVOL_MERC='S' (igual legado)
   */
  static async getTrocasFornecedor(req: AuthRequest, res: Response) {
    try {
      // PostgreSQL ERP (Nunes/RP INFO) nao tem TAB_AJUSTE_ESTOQUE/TAB_TIPO_AJUSTE - retorna vazio
      const dbType = await LossController.detectActiveDbType();
      if (dbType === 'postgresql') {
        return res.json({ fornecedores: [], total: 0 });
      }

      const { loja, tipo } = req.query;

      const codigoLoja = loja ? parseInt(loja as string) : 1;
      const tipoTroca = (tipo as string) || 'saldo';

      console.log('📦 Buscando trocas por fornecedor:', { codigoLoja, tipoTroca });

      const m = await LossController.getLossMappings();

      const schema = await MappingService.getSchema();
      const tabAjusteEstoque = `${schema}.${await MappingService.getRealTableName('TAB_AJUSTE_ESTOQUE')}`;
      const tabFornecedor = `${schema}.${await MappingService.getRealTableName('TAB_FORNECEDOR')}`;
      const tabTipoAjuste = `${schema}.${await MappingService.getRealTableName('TAB_TIPO_AJUSTE')}`;
      const tabProdutoLoja = `${schema}.${await MappingService.getRealTableName('TAB_PRODUTO_LOJA')}`;

      // Colunas de TAB_PRODUTO_LOJA para custo/venda ATUAL do produto
      const plCodProdutoCol = await MappingService.getColumnFromTable('TAB_PRODUTO_LOJA', 'codigo_produto').catch(() => 'COD_PRODUTO');
      const plCodLojaCol = await MappingService.getColumnFromTable('TAB_PRODUTO_LOJA', 'codigo_loja').catch(() => 'COD_LOJA');
      const plPrecoCustoCol = await MappingService.getColumnFromTable('TAB_PRODUTO_LOJA', 'preco_custo').catch(() => 'PRE_CUSTO');
      const plPrecoVendaCol = await MappingService.getColumnFromTable('TAB_PRODUTO_LOJA', 'preco_venda').catch(() => 'PRE_VENDA');

      let fornecedoresQuery: string;
      const params: any = { loja: codigoLoja };

      // Expressão CASE para cálculo NET
      const netCase = `
        CASE
          WHEN ta.${m.taDesAjusteCol} = 'SAIR ESTOQUE LOJA ENTRAR TROCA FORNECEDOR' THEN ABS(ae.${m.estQuantidadeCol})
          WHEN ta.${m.taDesAjusteCol} = 'SAIR TROCA FORNECEDOR ENTRAR ESTOQUE LOJA' THEN -ABS(ae.${m.estQuantidadeCol})
          WHEN ta.${m.taDesAjusteCol} LIKE '%SAIR TROCA FORNECEDOR E N%O VOLTAR%' THEN -ABS(ae.${m.estQuantidadeCol})
          ELSE 0
        END`;

      const baseWhere = `
        ae.${m.estCodLojaCol} = :loja
        AND (ae.${m.estFlgCanceladoCol} IS NULL OR ae.${m.estFlgCanceladoCol} = 'N')`;

      const trocaTypes = `(
        ta.${m.taDesAjusteCol} = 'SAIR ESTOQUE LOJA ENTRAR TROCA FORNECEDOR'
        OR ta.${m.taDesAjusteCol} = 'SAIR TROCA FORNECEDOR ENTRAR ESTOQUE LOJA'
        OR ta.${m.taDesAjusteCol} LIKE '%SAIR TROCA FORNECEDOR E N%O VOLTAR%'
      )`;

      if (tipoTroca === 'saldo') {
        // SALDO PENDENTE via QTD_EST_POST_TROCA do último registro de SAÍDA,
        // filtrado por ACEITA_DEVOL_MERC = 'S' (igual legado "Efetivar Trocas")
        // O último registro é determinado pelo MAX(COD_AJUSTE_ESTOQUE) entre TODOS os tipos de troca (saída/retorno/zerado)
        // Custo/Venda do TAB_PRODUTO_LOJA (preço ATUAL do produto, igual legado)
        fornecedoresQuery = `
          SELECT
            NVL(f.${m.fornCodigoCol}, 0) as COD_FORNECEDOR,
            NVL(f.${m.fornRazaoSocialCol}, 'SEM FORNECEDOR') as FORNECEDOR,
            NVL(f.${m.fornFantasiaCol}, f.${m.fornRazaoSocialCol}) as FANTASIA,
            f.NUM_CGC as CNPJ, f.DES_CONTATO as CONTATO, f.NUM_CELULAR as CELULAR, f.NUM_FONE as FONE, f.DES_EMAIL as EMAIL,
            COUNT(DISTINCT ae.${m.estCodProdutoCol}) as QTD_PRODUTOS,
            SUM(ae.${m.estQtdEstPostTrocaCol}) as QTD_ITENS,
            SUM(ae.${m.estQtdEstPostTrocaCol}) as QTD_TOTAL,
            SUM(ae.${m.estQtdEstPostTrocaCol} * NVL(pl.${plPrecoCustoCol}, 0)) as TOTAL_CUSTO,
            SUM(ae.${m.estQtdEstPostTrocaCol} * NVL(pl.${plPrecoVendaCol}, 0)) as TOTAL_VENDA
          FROM ${tabAjusteEstoque} ae
          LEFT JOIN ${tabFornecedor} f ON ae.${m.estCodFornecedorCol} = f.${m.fornCodigoCol}
          LEFT JOIN ${tabTipoAjuste} ta ON ae.${m.estTipoMovCol} = ta.${m.taCodAjusteCol}
          LEFT JOIN ${tabProdutoLoja} pl ON ae.${m.estCodProdutoCol} = pl.${plCodProdutoCol} AND pl.${plCodLojaCol} = :loja
          WHERE ${baseWhere}
          AND ta.${m.taDesAjusteCol} = 'SAIR ESTOQUE LOJA ENTRAR TROCA FORNECEDOR'
          AND f.ACEITA_DEVOL_MERC = 'S'
          AND ae.${m.estQtdEstPostTrocaCol} > 0
          AND ae.${m.estCodAjusteEstoqueCol} = (
            SELECT MAX(ae2.${m.estCodAjusteEstoqueCol})
            FROM ${tabAjusteEstoque} ae2
            LEFT JOIN ${tabTipoAjuste} ta2 ON ae2.${m.estTipoMovCol} = ta2.${m.taCodAjusteCol}
            WHERE ae2.${m.estCodProdutoCol} = ae.${m.estCodProdutoCol}
            AND ae2.${m.estCodFornecedorCol} = ae.${m.estCodFornecedorCol}
            AND ae2.${m.estCodLojaCol} = :loja
            AND (ae2.${m.estFlgCanceladoCol} IS NULL OR ae2.${m.estFlgCanceladoCol} = 'N')
            AND (
              ta2.${m.taDesAjusteCol} = 'SAIR ESTOQUE LOJA ENTRAR TROCA FORNECEDOR'
              OR ta2.${m.taDesAjusteCol} = 'SAIR TROCA FORNECEDOR ENTRAR ESTOQUE LOJA'
              OR ta2.${m.taDesAjusteCol} LIKE '%SAIR TROCA FORNECEDOR E N%O VOLTAR%'
            )
          )
          GROUP BY f.${m.fornCodigoCol}, f.${m.fornRazaoSocialCol}, f.${m.fornFantasiaCol}, f.NUM_CGC, f.DES_CONTATO, f.NUM_CELULAR, f.NUM_FONE, f.DES_EMAIL
          ORDER BY SUM(ae.${m.estQtdEstPostTrocaCol} * NVL(pl.${plPrecoCustoCol}, 0)) DESC
        `;
      } else {
        // Filtro por tipo específico de movimentação
        let tipoAjusteFiltro: string;
        if (tipoTroca === 'retornos') {
          tipoAjusteFiltro = `ta.${m.taDesAjusteCol} = 'SAIR TROCA FORNECEDOR ENTRAR ESTOQUE LOJA'`;
        } else if (tipoTroca === 'zerados') {
          tipoAjusteFiltro = `ta.${m.taDesAjusteCol} LIKE '%SAIR TROCA FORNECEDOR E N%O VOLTAR%'`;
        } else {
          // saidas
          tipoAjusteFiltro = `ta.${m.taDesAjusteCol} = 'SAIR ESTOQUE LOJA ENTRAR TROCA FORNECEDOR'`;
        }

        fornecedoresQuery = `
          SELECT
            NVL(f.${m.fornCodigoCol}, 0) as COD_FORNECEDOR,
            NVL(f.${m.fornRazaoSocialCol}, 'SEM FORNECEDOR') as FORNECEDOR,
            NVL(f.${m.fornFantasiaCol}, f.${m.fornRazaoSocialCol}) as FANTASIA,
            f.NUM_CGC as CNPJ, f.DES_CONTATO as CONTATO, f.NUM_CELULAR as CELULAR, f.NUM_FONE as FONE, f.DES_EMAIL as EMAIL,
            COUNT(DISTINCT ae.${m.estCodProdutoCol}) as QTD_PRODUTOS,
            SUM(ABS(NVL(ae.${m.estQuantidadeCol}, 0))) as QTD_ITENS,
            SUM(ABS(NVL(ae.${m.estQuantidadeCol}, 0))) as QTD_TOTAL,
            SUM(ABS(NVL(ae.${m.estQuantidadeCol}, 0)) * NVL(ae.${m.estValCustoRepCol}, 0)) as TOTAL_CUSTO,
            SUM(ABS(NVL(ae.${m.estQuantidadeCol}, 0)) * NVL(ae.${m.estValVendaCol}, 0)) as TOTAL_VENDA
          FROM ${tabAjusteEstoque} ae
          LEFT JOIN ${tabFornecedor} f ON ae.${m.estCodFornecedorCol} = f.${m.fornCodigoCol}
          LEFT JOIN ${tabTipoAjuste} ta ON ae.${m.estTipoMovCol} = ta.${m.taCodAjusteCol}
          WHERE ${baseWhere}
          AND ${tipoAjusteFiltro}
          GROUP BY f.${m.fornCodigoCol}, f.${m.fornRazaoSocialCol}, f.${m.fornFantasiaCol}, f.NUM_CGC, f.DES_CONTATO, f.NUM_CELULAR, f.NUM_FONE, f.DES_EMAIL
          ORDER BY SUM(ABS(NVL(ae.${m.estQuantidadeCol}, 0)) * NVL(ae.${m.estValCustoRepCol}, 0)) DESC
        `;
      }

      const fornecedores = await OracleService.query(fornecedoresQuery, params);

      const totalCusto = fornecedores.reduce((acc: number, f: any) => acc + (parseFloat(f.TOTAL_CUSTO) || 0), 0);
      const totalVenda = fornecedores.reduce((acc: number, f: any) => acc + (parseFloat(f.TOTAL_VENDA) || 0), 0);
      const totalItens = Math.round(fornecedores.reduce((acc: number, f: any) => acc + (parseFloat(f.QTD_ITENS) || 0), 0) * 100) / 100;
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
          cnpj: f.CNPJ || '',
          contato: f.CONTATO || '',
          celular: f.CELULAR || '',
          fone: f.FONE || '',
          email: f.EMAIL || '',
          qtdProdutos: parseInt(f.QTD_PRODUTOS) || 0,
          qtdItens: Math.round((parseFloat(f.QTD_ITENS) || 0) * 1000) / 1000,
          qtdTotal: Math.round((parseFloat(f.QTD_TOTAL) || 0) * 1000) / 1000,
          totalCusto: Math.round((parseFloat(f.TOTAL_CUSTO) || 0) * 100) / 100,
          totalVenda: Math.round((parseFloat(f.TOTAL_VENDA) || 0) * 100) / 100,
          valorTotal: Math.round((parseFloat(f.TOTAL_CUSTO) || 0) * 100) / 100,
        })),
      };

      console.log(`✅ Encontrados ${fornecedores.length} fornecedores (tipo: ${tipoTroca})`);
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

      // Busca mapeamentos dinâmicos via helper centralizado
      const m = await LossController.getLossMappings();

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
        filtroCodigosSQL = ` AND p.${m.prodEanCol} IN (${listaCodigos.map((_, i) => `:cod${i}`).join(',')})`;
        listaCodigos.forEach((cod, i) => {
          paramsMesAnterior[`cod${i}`] = cod;
          paramsMesAtual[`cod${i}`] = cod;
        });
      }

      // Buscar schema e nomes de tabelas dinâmicos
      const schema = await MappingService.getSchema();
      const tabAjusteEstoque = `${schema}.${await MappingService.getRealTableName('TAB_AJUSTE_ESTOQUE')}`;
      const tabProduto = `${schema}.${await MappingService.getRealTableName('TAB_PRODUTO')}`;

      // Query para perdas do mês anterior (quantidade negativa = perda)
      // Retorna tanto COD_PRODUTO quanto COD_BARRA_PRINCIPAL para poder fazer match
      // Inclui tanto VALOR_PERDA (R$) quanto QTD_PERDA (kg)
      const queryMesAnterior = `
        SELECT
          TO_CHAR(p.${m.prodCodigoCol}) as COD_PRODUTO,
          p.${m.prodEanCol} as CODIGO_BARRAS,
          SUM(ABS(NVL(ae.${m.estQuantidadeCol}, 0) * NVL(ae.${m.estValCustoRepCol}, 0))) as VALOR_PERDA,
          SUM(ABS(NVL(ae.${m.estQuantidadeCol}, 0))) as QTD_PERDA
        FROM ${tabAjusteEstoque} ae
        JOIN ${tabProduto} p ON ae.${m.estCodProdutoCol} = p.${m.prodCodigoCol}
        WHERE ae.${m.estCodLojaCol} = :loja
        AND ae.${m.estDataMovCol} >= TO_DATE(:dtAntIni, 'YYYY-MM-DD')
        AND ae.${m.estDataMovCol} <= TO_DATE(:dtAntFim, 'YYYY-MM-DD')
        AND (ae.${m.estFlgCanceladoCol} IS NULL OR ae.${m.estFlgCanceladoCol} != 'S')
        AND ae.${m.estQuantidadeCol} < 0
        ${filtroCodigosSQL}
        GROUP BY p.${m.prodCodigoCol}, p.${m.prodEanCol}
      `;

      // Query para perdas do mês atual
      const queryMesAtual = `
        SELECT
          TO_CHAR(p.${m.prodCodigoCol}) as COD_PRODUTO,
          p.${m.prodEanCol} as CODIGO_BARRAS,
          SUM(ABS(NVL(ae.${m.estQuantidadeCol}, 0) * NVL(ae.${m.estValCustoRepCol}, 0))) as VALOR_PERDA,
          SUM(ABS(NVL(ae.${m.estQuantidadeCol}, 0))) as QTD_PERDA
        FROM ${tabAjusteEstoque} ae
        JOIN ${tabProduto} p ON ae.${m.estCodProdutoCol} = p.${m.prodCodigoCol}
        WHERE ae.${m.estCodLojaCol} = :loja
        AND ae.${m.estDataMovCol} >= TO_DATE(:dtAtualIni, 'YYYY-MM-DD')
        AND ae.${m.estDataMovCol} <= TO_DATE(:dtAtualFim, 'YYYY-MM-DD')
        AND (ae.${m.estFlgCanceladoCol} IS NULL OR ae.${m.estFlgCanceladoCol} != 'S')
        AND ae.${m.estQuantidadeCol} < 0
        ${filtroCodigosSQL}
        GROUP BY p.${m.prodCodigoCol}, p.${m.prodEanCol}
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
   * tipo: 'saldo' (pendente via POST_TROCA), 'saidas', 'retornos', 'zerados'
   */
  static async getTrocasItensFornecedor(req: AuthRequest, res: Response) {
    try {
      // PostgreSQL ERP (Nunes) nao tem TAB_AJUSTE_ESTOQUE - retorna vazio
      const dbType = await LossController.detectActiveDbType();
      if (dbType === 'postgresql') {
        return res.json({ itens: [] });
      }

      const { loja, cod_fornecedor, tipo } = req.query;

      const codigoLoja = loja ? parseInt(loja as string) : 1;
      const codForn = cod_fornecedor ? parseInt(cod_fornecedor as string) : 0;
      const tipoTroca = (tipo as string) || 'saldo';

      console.log('📦 Buscando itens de troca do fornecedor:', { codigoLoja, codForn, tipoTroca });

      const m = await LossController.getLossMappings();

      const schema = await MappingService.getSchema();
      const tabAjusteEstoque = `${schema}.${await MappingService.getRealTableName('TAB_AJUSTE_ESTOQUE')}`;
      const tabProduto = `${schema}.${await MappingService.getRealTableName('TAB_PRODUTO')}`;
      const tabTipoAjuste = `${schema}.${await MappingService.getRealTableName('TAB_TIPO_AJUSTE')}`;
      const tabSecao = `${schema}.${await MappingService.getRealTableName('TAB_SECAO')}`;
      const tabProdutoLoja = `${schema}.${await MappingService.getRealTableName('TAB_PRODUTO_LOJA')}`;

      // Colunas de TAB_PRODUTO_LOJA para venda média e curva
      const plCodProdutoCol = await MappingService.getColumnFromTable('TAB_PRODUTO_LOJA', 'codigo_produto').catch(() => 'COD_PRODUTO');
      const plCodLojaCol = await MappingService.getColumnFromTable('TAB_PRODUTO_LOJA', 'codigo_loja').catch(() => 'COD_LOJA');
      const plVendaMediaCol = await MappingService.getColumnFromTable('TAB_PRODUTO_LOJA', 'venda_media').catch(() => 'VD_MEDIA');
      const plCurvaCol = await MappingService.getColumnFromTable('TAB_PRODUTO_LOJA', 'curva').catch(() => 'CURVA');

      let itensQuery: string;
      const params: any = { loja: codigoLoja, cod_fornecedor: codForn };

      const baseWhere = `
        ae.${m.estCodLojaCol} = :loja
        AND (ae.${m.estFlgCanceladoCol} IS NULL OR ae.${m.estFlgCanceladoCol} = 'N')
        AND NVL(ae.${m.estCodFornecedorCol}, 0) = :cod_fornecedor`;

      const netCase = `
        CASE
          WHEN ta.${m.taDesAjusteCol} = 'SAIR ESTOQUE LOJA ENTRAR TROCA FORNECEDOR' THEN ABS(ae.${m.estQuantidadeCol})
          WHEN ta.${m.taDesAjusteCol} = 'SAIR TROCA FORNECEDOR ENTRAR ESTOQUE LOJA' THEN -ABS(ae.${m.estQuantidadeCol})
          WHEN ta.${m.taDesAjusteCol} LIKE '%SAIR TROCA FORNECEDOR E N%O VOLTAR%' THEN -ABS(ae.${m.estQuantidadeCol})
          ELSE 0
        END`;

      // Colunas de TAB_PRODUTO_LOJA para custo/venda ATUAL (igual legado)
      const plPrecoCustoCol = await MappingService.getColumnFromTable('TAB_PRODUTO_LOJA', 'preco_custo').catch(() => 'PRE_CUSTO');
      const plPrecoVendaCol = await MappingService.getColumnFromTable('TAB_PRODUTO_LOJA', 'preco_venda').catch(() => 'PRE_VENDA');

      if (tipoTroca === 'saldo') {
        // SALDO via QTD_EST_POST_TROCA do último registro de SAÍDA (igual legado)
        // Custo/Venda de TAB_PRODUTO_LOJA (preço ATUAL, igual legado)
        itensQuery = `
          SELECT
            ae.${m.estCodProdutoCol} as COD_PRODUTO,
            p.${m.prodDescricaoCol} as DESCRICAO,
            p.${m.prodEanCol} as CODIGO_BARRAS,
            s.${m.secDesSecaoCol} as SECAO,
            ae.${m.estQtdEstPostTrocaCol} as QUANTIDADE,
            NVL(pl.${plPrecoCustoCol}, 0) as CUSTO_REPOSICAO,
            NVL(pl.${plPrecoVendaCol}, 0) as PRECO_VENDA,
            ae.${m.estQtdEstPostTrocaCol} * NVL(pl.${plPrecoCustoCol}, 0) as VALOR_TOTAL,
            NVL(pl.${plVendaMediaCol}, 0) as VD_MEDIA,
            NVL(TRIM(pl.${plCurvaCol}), 'X') as CURVA
          FROM ${tabAjusteEstoque} ae
          JOIN ${tabProduto} p ON ae.${m.estCodProdutoCol} = p.${m.prodCodigoCol}
          LEFT JOIN ${tabTipoAjuste} ta ON ae.${m.estTipoMovCol} = ta.${m.taCodAjusteCol}
          LEFT JOIN ${tabSecao} s ON p.${m.prodCodSecaoCol} = s.${m.secCodSecaoCol}
          LEFT JOIN ${tabProdutoLoja} pl ON ae.${m.estCodProdutoCol} = pl.${plCodProdutoCol} AND pl.${plCodLojaCol} = :loja
          WHERE ${baseWhere}
          AND ta.${m.taDesAjusteCol} = 'SAIR ESTOQUE LOJA ENTRAR TROCA FORNECEDOR'
          AND ae.${m.estQtdEstPostTrocaCol} > 0
          AND ae.${m.estCodAjusteEstoqueCol} = (
            SELECT MAX(ae2.${m.estCodAjusteEstoqueCol})
            FROM ${tabAjusteEstoque} ae2
            LEFT JOIN ${tabTipoAjuste} ta2 ON ae2.${m.estTipoMovCol} = ta2.${m.taCodAjusteCol}
            WHERE ae2.${m.estCodProdutoCol} = ae.${m.estCodProdutoCol}
            AND ae2.${m.estCodFornecedorCol} = ae.${m.estCodFornecedorCol}
            AND ae2.${m.estCodLojaCol} = :loja
            AND (ae2.${m.estFlgCanceladoCol} IS NULL OR ae2.${m.estFlgCanceladoCol} = 'N')
            AND (
              ta2.${m.taDesAjusteCol} = 'SAIR ESTOQUE LOJA ENTRAR TROCA FORNECEDOR'
              OR ta2.${m.taDesAjusteCol} = 'SAIR TROCA FORNECEDOR ENTRAR ESTOQUE LOJA'
              OR ta2.${m.taDesAjusteCol} LIKE '%SAIR TROCA FORNECEDOR E N%O VOLTAR%'
            )
          )
          ORDER BY ae.${m.estQtdEstPostTrocaCol} * NVL(pl.${plPrecoCustoCol}, 0) DESC
        `;
      } else {
        // Filtro por tipo específico
        let tipoAjusteFiltro: string;
        if (tipoTroca === 'retornos') {
          tipoAjusteFiltro = `ta.${m.taDesAjusteCol} = 'SAIR TROCA FORNECEDOR ENTRAR ESTOQUE LOJA'`;
        } else if (tipoTroca === 'zerados') {
          tipoAjusteFiltro = `ta.${m.taDesAjusteCol} LIKE '%SAIR TROCA FORNECEDOR E N%O VOLTAR%'`;
        } else {
          tipoAjusteFiltro = `ta.${m.taDesAjusteCol} = 'SAIR ESTOQUE LOJA ENTRAR TROCA FORNECEDOR'`;
        }

        itensQuery = `
          SELECT
            ae.${m.estCodProdutoCol} as COD_PRODUTO,
            p.${m.prodDescricaoCol} as DESCRICAO,
            p.${m.prodEanCol} as CODIGO_BARRAS,
            ta.${m.taDesAjusteCol} as TIPO_AJUSTE,
            s.${m.secDesSecaoCol} as SECAO,
            ABS(NVL(ae.${m.estQuantidadeCol}, 0)) as QUANTIDADE,
            NVL(ae.${m.estValCustoRepCol}, 0) as CUSTO_REPOSICAO,
            NVL(ae.${m.estValVendaCol}, 0) as PRECO_VENDA,
            ABS(NVL(ae.${m.estQuantidadeCol}, 0)) * NVL(ae.${m.estValCustoRepCol}, 0) as VALOR_TOTAL,
            NVL(pl.${plVendaMediaCol}, 0) as VD_MEDIA,
            NVL(TRIM(pl.${plCurvaCol}), 'X') as CURVA,
            TO_CHAR(ae.${m.estDataMovCol}, 'YYYY-MM-DD') as DATA_AJUSTE,
            ae.${m.estUsuarioCol}
          FROM ${tabAjusteEstoque} ae
          JOIN ${tabProduto} p ON ae.${m.estCodProdutoCol} = p.${m.prodCodigoCol}
          LEFT JOIN ${tabTipoAjuste} ta ON ae.${m.estTipoMovCol} = ta.${m.taCodAjusteCol}
          LEFT JOIN ${tabSecao} s ON p.${m.prodCodSecaoCol} = s.${m.secCodSecaoCol}
          LEFT JOIN ${tabProdutoLoja} pl ON ae.${m.estCodProdutoCol} = pl.${plCodProdutoCol} AND pl.${plCodLojaCol} = :loja
          WHERE ${baseWhere}
          AND ${tipoAjusteFiltro}
          ORDER BY ae.${m.estDataMovCol} DESC
        `;
      }

      const itens = await OracleService.query(itensQuery, params);

      const response = {
        itens: itens.map((i: any) => ({
          codProduto: i.COD_PRODUTO,
          descricao: i.DESCRICAO,
          codigoBarras: i.CODIGO_BARRAS,
          tipoAjuste: i.TIPO_AJUSTE || '',
          secao: i.SECAO || 'SEM SEÇÃO',
          quantidade: Math.round((parseFloat(i.QUANTIDADE) || 0) * 1000) / 1000,
          custoReposicao: Math.round((parseFloat(i.CUSTO_REPOSICAO) || 0) * 100) / 100,
          precoVenda: Math.round((parseFloat(i.PRECO_VENDA) || 0) * 100) / 100,
          valorTotal: Math.round((parseFloat(i.VALOR_TOTAL) || 0) * 100) / 100,
          vdMedia: Math.round((parseFloat(i.VD_MEDIA) || 0) * 1000) / 1000,
          curva: i.CURVA || 'X',
          margem: (parseFloat(i.PRECO_VENDA) || 0) > 0
            ? Math.round(((parseFloat(i.PRECO_VENDA) - parseFloat(i.CUSTO_REPOSICAO)) / parseFloat(i.PRECO_VENDA)) * 10000) / 100
            : 0,
          dataAjuste: i.DATA_AJUSTE,
          usuario: i.USUARIO,
        })),
      };

      console.log(`✅ Encontrados ${itens.length} itens de troca do fornecedor ${codForn} (tipo: ${tipoTroca})`);
      res.json(response);
    } catch (error: any) {
      console.error('❌ Erro ao buscar itens de troca:', error);
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * Retorna lista de COD_PRODUTO com trocas pendentes (saldo > 0)
   * Endpoint leve usado pelo EstoqueSaude para o card TROCAS
   */
  static async getTrocasProdutos(req: AuthRequest, res: Response) {
    try {
      // PostgreSQL ERP (Nunes/RP INFO) nao tem o conceito de "trocas com fornecedor"
      // implementado nas mesmas tabelas que Intersolid. Retorna vazio pra nao bloquear a tela.
      const dbType = await LossController.detectActiveDbType();
      if (dbType === 'postgresql') {
        return res.json({ produtos: [] });
      }

      const { loja } = req.query;
      const codigoLoja = loja ? parseInt(loja as string) : 1;

      const m = await LossController.getLossMappings();
      const schema = await MappingService.getSchema();
      const tabAjusteEstoque = `${schema}.${await MappingService.getRealTableName('TAB_AJUSTE_ESTOQUE')}`;
      const tabFornecedor = `${schema}.${await MappingService.getRealTableName('TAB_FORNECEDOR')}`;
      const tabTipoAjuste = `${schema}.${await MappingService.getRealTableName('TAB_TIPO_AJUSTE')}`;

      const query = `
        SELECT DISTINCT ae.${m.estCodProdutoCol} as COD_PRODUTO
        FROM ${tabAjusteEstoque} ae
        LEFT JOIN ${tabFornecedor} f ON ae.${m.estCodFornecedorCol} = f.${m.fornCodigoCol}
        LEFT JOIN ${tabTipoAjuste} ta ON ae.${m.estTipoMovCol} = ta.${m.taCodAjusteCol}
        WHERE ae.${m.estCodLojaCol} = :loja
        AND (ae.${m.estFlgCanceladoCol} IS NULL OR ae.${m.estFlgCanceladoCol} = 'N')
        AND ta.${m.taDesAjusteCol} = 'SAIR ESTOQUE LOJA ENTRAR TROCA FORNECEDOR'
        AND f.ACEITA_DEVOL_MERC = 'S'
        AND ae.${m.estQtdEstPostTrocaCol} > 0
        AND ae.${m.estCodAjusteEstoqueCol} = (
          SELECT MAX(ae2.${m.estCodAjusteEstoqueCol})
          FROM ${tabAjusteEstoque} ae2
          LEFT JOIN ${tabTipoAjuste} ta2 ON ae2.${m.estTipoMovCol} = ta2.${m.taCodAjusteCol}
          WHERE ae2.${m.estCodProdutoCol} = ae.${m.estCodProdutoCol}
          AND ae2.${m.estCodFornecedorCol} = ae.${m.estCodFornecedorCol}
          AND ae2.${m.estCodLojaCol} = :loja
          AND (ae2.${m.estFlgCanceladoCol} IS NULL OR ae2.${m.estFlgCanceladoCol} = 'N')
          AND (
            ta2.${m.taDesAjusteCol} = 'SAIR ESTOQUE LOJA ENTRAR TROCA FORNECEDOR'
            OR ta2.${m.taDesAjusteCol} = 'SAIR TROCA FORNECEDOR ENTRAR ESTOQUE LOJA'
            OR ta2.${m.taDesAjusteCol} LIKE '%SAIR TROCA FORNECEDOR E N%O VOLTAR%'
          )
        )
      `;

      const result = await OracleService.query(query, { loja: codigoLoja });
      const produtos = result.map((r: any) => parseInt(r.COD_PRODUTO) || 0);

      console.log(`✅ Produtos com trocas pendentes: ${produtos.length}`);
      res.json({ produtos });
    } catch (error: any) {
      console.error('❌ Erro ao buscar produtos com trocas:', error);
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * Notas bonificadas por fornecedor (agrupado por perfil)
   * Período: 01/01 do ano até hoje
   */
  static async getNotasBonificadas(req: AuthRequest, res: Response) {
    try {
      const { loja, dataInicio, dataFim } = req.query;
      const codigoLoja = loja ? parseInt(loja as string) : undefined;
      const schema = await MappingService.getSchema();
      const tabFornecedorNota = `${schema}.${await MappingService.getRealTableName('TAB_FORNECEDOR_NOTA')}`;
      const tabFornecedor = `${schema}.${await MappingService.getRealTableName('TAB_FORNECEDOR')}`;
      const fnCodFornecedor = await MappingService.getColumnFromTable('TAB_NOTA_FISCAL', 'codigo_fornecedor');
      const fnValorTotal = await MappingService.getColumnFromTable('TAB_NOTA_FISCAL', 'valor_total');
      const fnDtaEntrada = await MappingService.getColumnFromTable('TAB_NOTA_FISCAL', 'data_entrada');
      const fnFlgCancelado = await MappingService.getColumnFromTable('TAB_NOTA_FISCAL', 'flag_cancelado');
      const fnCodLoja = await MappingService.getColumnFromTable('TAB_NOTA_FISCAL', 'codigo_loja');
      const fCodFornecedor = await MappingService.getColumnFromTable('TAB_FORNECEDOR', 'codigo_fornecedor');
      const fRazaoSocial = await MappingService.getColumnFromTable('TAB_FORNECEDOR', 'razao_social');
      const fFantasia = await MappingService.getColumnFromTable('TAB_FORNECEDOR', 'nome_fantasia');

      const perfis = [5, 10, 41, 43, 88, 27];
      let lojaFilter = '';
      const anoAtual = new Date().getFullYear();
      const params: any = {
        dataIni: (dataInicio as string) || `${anoAtual}-01-01`,
        dataFi: (dataFim as string) || new Date().toISOString().split('T')[0]
      };
      if (codigoLoja) {
        lojaFilter = `AND fn.${fnCodLoja} = :loja`;
        params.loja = codigoLoja;
      }

      const sql = `
        SELECT
          fn.${fnCodFornecedor} as COD_FORNECEDOR,
          f.${fFantasia} as FANTASIA,
          f.${fRazaoSocial} as RAZAO_SOCIAL,
          fn.COD_PERFIL,
          p.DES_PERFIL,
          COUNT(*) as QTD_NOTAS,
          SUM(fn.${fnValorTotal}) as VALOR_TOTAL
        FROM ${tabFornecedorNota} fn
        JOIN ${tabFornecedor} f ON f.${fCodFornecedor} = fn.${fnCodFornecedor}
        JOIN ${schema}.TAB_PERFIL p ON p.COD_PERFIL = fn.COD_PERFIL
        WHERE fn.${fnDtaEntrada} >= TO_DATE(:dataIni, 'YYYY-MM-DD')
        AND fn.${fnDtaEntrada} <= TO_DATE(:dataFi, 'YYYY-MM-DD')
        AND fn.COD_PERFIL IN (${perfis.join(',')})
        AND NVL(fn.${fnFlgCancelado}, 'N') != 'S'
        ${lojaFilter}
        GROUP BY fn.${fnCodFornecedor}, f.${fFantasia}, f.${fRazaoSocial}, fn.COD_PERFIL, p.DES_PERFIL
        ORDER BY fn.${fnCodFornecedor}, fn.COD_PERFIL
      `;

      const rows = await OracleService.query<any>(sql, params);

      // Agrupar por fornecedor
      const fornecedoresMap: any = {};
      for (const r of rows) {
        const cod = r.COD_FORNECEDOR;
        if (!fornecedoresMap[cod]) {
          fornecedoresMap[cod] = {
            codFornecedor: cod,
            fantasia: r.FANTASIA || r.RAZAO_SOCIAL,
            razaoSocial: r.RAZAO_SOCIAL,
            perfis: {},
            totalGeral: 0
          };
        }
        fornecedoresMap[cod].perfis[r.COD_PERFIL] = {
          codPerfil: r.COD_PERFIL,
          descricao: r.DES_PERFIL,
          qtdNotas: r.QTD_NOTAS,
          valor: r.VALOR_TOTAL || 0
        };
        fornecedoresMap[cod].totalGeral += r.VALOR_TOTAL || 0;
      }

      const fornecedores = Object.values(fornecedoresMap).sort((a: any, b: any) => b.totalGeral - a.totalGeral);

      res.json({ success: true, perfisDisponiveis: perfis, data: fornecedores });
    } catch (error: any) {
      console.error('❌ Erro notas bonificadas:', error.message);
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * Notas de um fornecedor por perfil (drill-down nível 2)
   */
  static async getNotasBonificadasDetalhe(req: AuthRequest, res: Response) {
    try {
      const { codFornecedor, codPerfil } = req.params;
      const { loja } = req.query;
      const schema = await MappingService.getSchema();
      const tabFornecedorNota = `${schema}.${await MappingService.getRealTableName('TAB_FORNECEDOR_NOTA')}`;
      const fnNumNf = await MappingService.getColumnFromTable('TAB_NOTA_FISCAL', 'numero_nf');
      const fnSerie = await MappingService.getColumnFromTable('TAB_NOTA_FISCAL', 'serie');
      const fnCodFornecedor = await MappingService.getColumnFromTable('TAB_NOTA_FISCAL', 'codigo_fornecedor');
      const fnValorTotal = await MappingService.getColumnFromTable('TAB_NOTA_FISCAL', 'valor_total');
      const fnDtaEntrada = await MappingService.getColumnFromTable('TAB_NOTA_FISCAL', 'data_entrada');
      const fnFlgCancelado = await MappingService.getColumnFromTable('TAB_NOTA_FISCAL', 'flag_cancelado');
      const fnCodLoja = await MappingService.getColumnFromTable('TAB_NOTA_FISCAL', 'codigo_loja');

      let lojaFilter = '';
      const params: any = {
        codFornecedor: parseInt(codFornecedor, 10),
        codPerfil: parseInt(codPerfil, 10)
      };
      if (loja) {
        lojaFilter = `AND fn.${fnCodLoja} = :loja`;
        params.loja = parseInt(loja as string, 10);
      }

      const sql = `
        SELECT
          fn.${fnNumNf} as NUM_NF,
          fn.${fnSerie} as SERIE,
          fn.${fnDtaEntrada} as DTA_ENTRADA,
          fn.${fnValorTotal} as VALOR_TOTAL,
          fn.${fnCodLoja} as COD_LOJA
        FROM ${tabFornecedorNota} fn
        WHERE fn.${fnCodFornecedor} = :codFornecedor
        AND fn.COD_PERFIL = :codPerfil
        AND fn.${fnDtaEntrada} >= TRUNC(SYSDATE, 'YEAR')
        AND NVL(fn.${fnFlgCancelado}, 'N') != 'S'
        ${lojaFilter}
        ORDER BY fn.${fnDtaEntrada} DESC
      `;

      const rows = await OracleService.query<any>(sql, params);

      res.json({
        success: true,
        data: rows.map(r => ({
          numNf: r.NUM_NF,
          serie: r.SERIE,
          dtaEntrada: r.DTA_ENTRADA,
          valorTotal: r.VALOR_TOTAL || 0,
          codLoja: r.COD_LOJA
        }))
      });
    } catch (error: any) {
      console.error('❌ Erro detalhe notas bonificadas:', error.message);
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * Itens de uma nota de bonificação (drill-down nível 3)
   */
  static async getNotaBonificadaItens(req: AuthRequest, res: Response) {
    try {
      const { numNf, codFornecedor } = req.params;
      const { loja } = req.query;
      const schema = await MappingService.getSchema();
      const tabFornecedorProduto = `${schema}.${await MappingService.getRealTableName('TAB_FORNECEDOR_PRODUTO')}`;
      const tabProduto = `${schema}.${await MappingService.getRealTableName('TAB_PRODUTO')}`;
      const fpNumNf = await MappingService.getColumnFromTable('TAB_FORNECEDOR_PRODUTO', 'numero_nf');
      const fpCodFornecedor = await MappingService.getColumnFromTable('TAB_FORNECEDOR_PRODUTO', 'codigo_fornecedor');
      const fpCodProduto = await MappingService.getColumnFromTable('TAB_FORNECEDOR_PRODUTO', 'codigo_produto');
      const fpQtdEntrada = await MappingService.getColumnFromTable('TAB_FORNECEDOR_PRODUTO', 'quantidade_entrada');
      const fpValTabela = await MappingService.getColumnFromTable('TAB_FORNECEDOR_PRODUTO', 'valor_tabela');
      const pCodProduto = await MappingService.getColumnFromTable('TAB_PRODUTO', 'codigo_produto');
      const pDescricao = await MappingService.getColumnFromTable('TAB_PRODUTO', 'descricao');

      const sql = `
        SELECT
          fp.${fpCodProduto} as COD_PRODUTO,
          p.${pDescricao} as DESCRICAO,
          fp.${fpQtdEntrada} as QTD_ENTRADA,
          fp.${fpValTabela} as VALOR_TABELA
        FROM ${tabFornecedorProduto} fp
        LEFT JOIN ${tabProduto} p ON p.${pCodProduto} = fp.${fpCodProduto}
        WHERE fp.${fpNumNf} = :numNf
        AND fp.${fpCodFornecedor} = :codFornecedor
        ORDER BY p.${pDescricao}
      `;

      const rows = await OracleService.query<any>(sql, {
        numNf: parseInt(numNf, 10),
        codFornecedor: parseInt(codFornecedor, 10)
      });

      res.json({
        success: true,
        data: rows.map(r => ({
          codProduto: r.COD_PRODUTO,
          descricao: r.DESCRICAO,
          qtdEntrada: r.QTD_ENTRADA || 0,
          valorTabela: r.VALOR_TABELA || 0
        }))
      });
    } catch (error: any) {
      console.error('❌ Erro itens nota bonificada:', error.message);
      res.status(500).json({ error: error.message });
    }
  }
}
