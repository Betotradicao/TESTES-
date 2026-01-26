/**
 * Compra x Venda Controller
 * Controller para análise de Compras x Vendas por Classificação Mercadológica
 */

import { Request, Response } from 'express';
import { CompraVendaService, CompraVendaFilters } from '../services/compra-venda.service';
import { OracleService } from '../services/oracle.service';

export class CompraVendaController {
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
   * Debug: Verifica estrutura de tabelas Oracle e busca produto específico
   */
  static async debugTableStructure(req: Request, res: Response) {
    try {
      const tableName = req.query.table as string || 'TAB_PRODUTO_LOJA';
      const codProduto = req.query.codProduto as string;
      const busca = req.query.busca as string;

      // Se passou busca por nome de produto
      if (busca) {
        const produtos = await OracleService.query(`
          SELECT COD_PRODUTO, DES_PRODUTO, COD_SECAO, COD_GRUPO
          FROM INTERSOLID.TAB_PRODUTO
          WHERE UPPER(DES_PRODUTO) LIKE UPPER(:busca)
          AND ROWNUM <= 20
        `, { busca: `%${busca}%` });

        return res.json({ produtos });
      }

      // Se passou busca por nome de tabela
      const buscaTabela = req.query.buscaTabela as string;
      if (buscaTabela) {
        const tabelas = await OracleService.query(`
          SELECT TABLE_NAME, NUM_ROWS
          FROM ALL_TABLES
          WHERE OWNER = 'INTERSOLID'
          AND UPPER(TABLE_NAME) LIKE UPPER(:buscaTabela)
          ORDER BY TABLE_NAME
        `, { buscaTabela: `%${buscaTabela}%` });

        return res.json({
          buscaTabela,
          quantidadeEncontrada: tabelas.length,
          tabelas
        });
      }

      // Se passou código do produto, busca todas as relações
      if (codProduto) {
        const produto = await OracleService.query(`
          SELECT p.*, s.DES_SECAO, g.DES_GRUPO, sg.DES_SUB_GRUPO
          FROM INTERSOLID.TAB_PRODUTO p
          LEFT JOIN INTERSOLID.TAB_SECAO s ON p.COD_SECAO = s.COD_SECAO
          LEFT JOIN INTERSOLID.TAB_GRUPO g ON p.COD_SECAO = g.COD_SECAO AND p.COD_GRUPO = g.COD_GRUPO
          LEFT JOIN INTERSOLID.TAB_SUBGRUPO sg ON p.COD_SECAO = sg.COD_SECAO AND p.COD_GRUPO = sg.COD_GRUPO AND p.COD_SUB_GRUPO = sg.COD_SUB_GRUPO
          WHERE p.COD_PRODUTO = :codProduto
        `, { codProduto });

        // Compras no período (01/01/2025 a 25/01/2025)
        const compras = await OracleService.query(`
          SELECT nf.NUM_NF, nf.DTA_ENTRADA, ni.QTD_TOTAL, ni.VAL_TOTAL, ni.CFOP, nf.COD_LOJA
          FROM INTERSOLID.TAB_NF nf
          JOIN INTERSOLID.TAB_NF_ITEM ni ON nf.NUM_NF = ni.NUM_NF
            AND nf.NUM_SERIE_NF = ni.NUM_SERIE_NF
            AND nf.COD_PARCEIRO = ni.COD_PARCEIRO
          WHERE ni.COD_ITEM = :codProduto
          AND nf.DTA_ENTRADA BETWEEN TO_DATE('01/01/2025', 'DD/MM/YYYY') AND TO_DATE('25/01/2025', 'DD/MM/YYYY')
          AND nf.TIPO_OPERACAO = 0
          ORDER BY nf.DTA_ENTRADA
        `, { codProduto });

        const totalCompras = compras.reduce((sum: number, c: any) => sum + (c.VAL_TOTAL || 0), 0);

        // Vendas no período
        const vendas = await OracleService.query(`
          SELECT COUNT(*) as QTD_CUPONS, SUM(QTD_TOTAL_PRODUTO) as QTD_TOTAL, SUM(VAL_TOTAL_PRODUTO) as VALOR_TOTAL
          FROM INTERSOLID.TAB_PRODUTO_PDV
          WHERE COD_PRODUTO = :codProduto
          AND DTA_SAIDA BETWEEN TO_DATE('01/01/2025', 'DD/MM/YYYY') AND TO_DATE('25/01/2025', 'DD/MM/YYYY')
        `, { codProduto });

        // É filho de decomposição?
        const ehFilhoDecomp = await OracleService.query(`
          SELECT d.COD_PRODUTO as COD_MATRIZ, p.DES_PRODUTO as MATRIZ, d.QTD_DECOMP as PERCENTUAL
          FROM INTERSOLID.TAB_PRODUTO_DECOMPOSICAO d
          JOIN INTERSOLID.TAB_PRODUTO p ON d.COD_PRODUTO = p.COD_PRODUTO
          WHERE d.COD_PRODUTO_DECOM = :codProduto
        `, { codProduto });

        // É matriz de decomposição?
        const ehMatrizDecomp = await OracleService.query(`
          SELECT d.COD_PRODUTO_DECOM as COD_FILHO, p.DES_PRODUTO as FILHO, d.QTD_DECOMP as PERCENTUAL
          FROM INTERSOLID.TAB_PRODUTO_DECOMPOSICAO d
          JOIN INTERSOLID.TAB_PRODUTO p ON d.COD_PRODUTO_DECOM = p.COD_PRODUTO
          WHERE d.COD_PRODUTO = :codProduto
        `, { codProduto });

        // Resumo
        const venda = vendas[0] || {};
        const motivo = [];
        if (totalCompras === 0) motivo.push('SEM COMPRAS no período');
        if ((venda.VALOR_TOTAL || 0) === 0) motivo.push('SEM VENDAS no período');
        if (ehFilhoDecomp.length === 0) motivo.push('NÃO é filho de decomposição');
        if (ehMatrizDecomp.length === 0) motivo.push('NÃO é matriz de decomposição');

        return res.json({
          codProduto,
          produto: produto[0],
          resumo: {
            totalCompras,
            totalVendas: venda.VALOR_TOTAL || 0,
            qtdCupons: venda.QTD_CUPONS || 0,
            ehFilhoDecomposicao: ehFilhoDecomp.length > 0,
            ehMatrizDecomposicao: ehMatrizDecomp.length > 0,
            motivoNaoAparece: motivo.length === 4 ? motivo.join(', ') : null
          },
          compras,
          vendas: venda,
          decomposicao: {
            ehFilho: ehFilhoDecomp,
            ehMatriz: ehMatrizDecomp
          }
        });
      }

      // Estrutura da tabela genérica
      const estrutura = await OracleService.query(`
        SELECT COLUMN_NAME, DATA_TYPE, DATA_LENGTH
        FROM ALL_TAB_COLUMNS
        WHERE TABLE_NAME = :tableName AND OWNER = 'INTERSOLID'
        ORDER BY COLUMN_ID
      `, { tableName });

      const exemplos = await OracleService.query(`
        SELECT * FROM INTERSOLID.${tableName} WHERE ROWNUM <= 5
      `);

      const count = await OracleService.query(`
        SELECT COUNT(*) as TOTAL FROM INTERSOLID.${tableName}
      `);

      return res.json({
        tabela: tableName,
        estrutura,
        exemplos,
        total: count[0]?.TOTAL || 0
      });
    } catch (error: any) {
      console.error('Erro ao verificar estrutura:', error);
      return res.status(500).json({
        error: 'Erro ao verificar estrutura',
        message: error.message
      });
    }
  }

  /**
   * Lista seções disponíveis
   */
  static async getSecoes(req: Request, res: Response) {
    try {
      const secoes = await CompraVendaService.getSecoes();
      return res.json(secoes);
    } catch (error: any) {
      console.error('Erro ao buscar seções:', error);
      return res.status(500).json({
        error: 'Erro ao buscar seções',
        message: error.message
      });
    }
  }

  /**
   * Lista grupos disponíveis
   */
  static async getGrupos(req: Request, res: Response) {
    try {
      const codSecao = req.query.codSecao ? Number(req.query.codSecao) : undefined;
      const grupos = await CompraVendaService.getGrupos(codSecao);
      return res.json(grupos);
    } catch (error: any) {
      console.error('Erro ao buscar grupos:', error);
      return res.status(500).json({
        error: 'Erro ao buscar grupos',
        message: error.message
      });
    }
  }

  /**
   * Lista subgrupos disponíveis
   */
  static async getSubGrupos(req: Request, res: Response) {
    try {
      console.log('🔍 getSubGrupos - query recebida:', req.query);
      const codSecao = req.query.codSecao ? Number(req.query.codSecao) : undefined;
      const codGrupo = req.query.codGrupo ? Number(req.query.codGrupo) : undefined;
      console.log('🔍 getSubGrupos - codSecao:', codSecao, 'codGrupo:', codGrupo);
      const subgrupos = await CompraVendaService.getSubGrupos(codSecao, codGrupo);
      console.log('🔍 getSubGrupos - retornando', subgrupos.length, 'subgrupos');
      return res.json(subgrupos);
    } catch (error: any) {
      console.error('Erro ao buscar subgrupos:', error);
      return res.status(500).json({
        error: 'Erro ao buscar subgrupos',
        message: error.message
      });
    }
  }

  /**
   * Lista compradores disponíveis
   */
  static async getCompradores(req: Request, res: Response) {
    try {
      const compradores = await CompraVendaService.getCompradores();
      return res.json(compradores);
    } catch (error: any) {
      console.error('Erro ao buscar compradores:', error);
      return res.status(500).json({
        error: 'Erro ao buscar compradores',
        message: error.message
      });
    }
  }

  /**
   * Lista lojas disponíveis
   */
  static async getLojas(req: Request, res: Response) {
    try {
      const lojas = await CompraVendaService.getLojas();
      return res.json(lojas);
    } catch (error: any) {
      console.error('Erro ao buscar lojas:', error);
      return res.status(500).json({
        error: 'Erro ao buscar lojas',
        message: error.message
      });
    }
  }

  /**
   * Busca dados de Compra x Venda
   */
  static async getCompraVenda(req: Request, res: Response) {
    try {
      const {
        dataInicio, dataFim, codSecao, codGrupo, codSubGrupo, codLoja, codComprador,
        tipoCompras, tipoOutras, tipoBonificacao, produtosBonificados, decomposicao,
        tipoEmprestimoProducao, tipoEmprestimoAssociacao, tipoEmprestimoDecomposicao
      } = req.query;

      // Validação de datas obrigatórias
      if (!dataInicio || !dataFim) {
        return res.status(400).json({
          error: 'Parâmetros obrigatórios',
          message: 'dataInicio e dataFim são obrigatórios'
        });
      }

      const filters: CompraVendaFilters = {
        dataInicio: dataInicio as string,
        dataFim: dataFim as string,
        codSecao: codSecao ? Number(codSecao) : undefined,
        codGrupo: codGrupo ? Number(codGrupo) : undefined,
        codSubGrupo: codSubGrupo ? Number(codSubGrupo) : undefined,
        codLoja: codLoja ? Number(codLoja) : undefined,
        codComprador: codComprador ? Number(codComprador) : undefined,
        tipoNotaFiscal: {
          compras: tipoCompras === 'true',
          outras: tipoOutras === 'true',
          bonificacao: tipoBonificacao === 'true'
        },
        produtosBonificados: (produtosBonificados as 'com' | 'sem' | 'somente') || 'com',
        decomposicao: (decomposicao as 'ambos' | 'pai' | 'filhos') || 'pai',
        // Tipos de empréstimo - default true se não especificado
        tipoEmprestimoProducao: tipoEmprestimoProducao === undefined ? true : tipoEmprestimoProducao === 'true',
        tipoEmprestimoAssociacao: tipoEmprestimoAssociacao === undefined ? true : tipoEmprestimoAssociacao === 'true',
        tipoEmprestimoDecomposicao: tipoEmprestimoDecomposicao === undefined ? true : tipoEmprestimoDecomposicao === 'true'
      };

      console.log('📊 Buscando Compra x Venda:', {
        ...filters,
        tiposEmprestimo: {
          producao: filters.tipoEmprestimoProducao,
          associacao: filters.tipoEmprestimoAssociacao,
          decomposicao: filters.tipoEmprestimoDecomposicao
        }
      });

      const data = await CompraVendaService.getCompraVendaPorSecao(filters);

      console.log(`✅ Encontrados ${data.length} registros`);

      return res.json({
        success: true,
        data,
        filters,
        count: data.length
      });
    } catch (error: any) {
      console.error('Erro ao buscar Compra x Venda:', error);
      return res.status(500).json({
        success: false,
        error: 'Erro ao buscar dados',
        message: error.message
      });
    }
  }

  /**
   * Explora tabelas do Oracle (para desenvolvimento)
   */
  static async explorarTabelas(req: Request, res: Response) {
    try {
      const { tabela, busca } = req.query;

      // Se passar tabela, mostra colunas dela
      if (tabela) {
        const colunas = await OracleService.query(`
          SELECT COLUMN_NAME, DATA_TYPE, DATA_LENGTH
          FROM ALL_TAB_COLUMNS
          WHERE TABLE_NAME = :tabela
          AND OWNER = 'INTERSOLID'
          ORDER BY COLUMN_ID
        `, { tabela: (tabela as string).toUpperCase() });

        return res.json({ tabela, colunas });
      }

      // Se passar busca, procura tabelas com esse nome
      if (busca) {
        const tabelas = await OracleService.query(`
          SELECT TABLE_NAME
          FROM ALL_TABLES
          WHERE OWNER = 'INTERSOLID'
          AND UPPER(TABLE_NAME) LIKE '%' || UPPER(:busca) || '%'
          ORDER BY TABLE_NAME
        `, { busca });

        return res.json({ busca, tabelas });
      }

      // Lista todas as tabelas
      const tabelas = await OracleService.query(`
        SELECT TABLE_NAME
        FROM ALL_TABLES
        WHERE OWNER = 'INTERSOLID'
        ORDER BY TABLE_NAME
      `);

      return res.json({ tabelas: tabelas.slice(0, 100) });
    } catch (error: any) {
      console.error('Erro ao explorar tabelas:', error);
      return res.status(500).json({
        error: 'Erro ao explorar tabelas',
        message: error.message
      });
    }
  }

  /**
   * Executa query de teste (só SELECT)
   */
  static async queryTeste(req: Request, res: Response) {
    try {
      const { sql } = req.body;

      if (!sql) {
        return res.status(400).json({ error: 'SQL é obrigatório' });
      }

      console.log('🔍 Query de teste:', sql);
      const resultado = await OracleService.query(sql);

      return res.json({
        success: true,
        count: resultado.length,
        data: resultado.slice(0, 50) // Limita a 50 registros
      });
    } catch (error: any) {
      console.error('Erro na query de teste:', error);
      return res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * Busca totais resumidos
   */
  static async getTotais(req: Request, res: Response) {
    try {
      const { dataInicio, dataFim, codSecao, codLoja } = req.query;

      if (!dataInicio || !dataFim) {
        return res.status(400).json({
          error: 'Parâmetros obrigatórios',
          message: 'dataInicio e dataFim são obrigatórios'
        });
      }

      const filters: CompraVendaFilters = {
        dataInicio: dataInicio as string,
        dataFim: dataFim as string,
        codSecao: codSecao ? Number(codSecao) : undefined,
        codLoja: codLoja ? Number(codLoja) : undefined
      };

      const totais = await CompraVendaService.getTotais(filters);

      return res.json({
        success: true,
        totais
      });
    } catch (error: any) {
      console.error('Erro ao buscar totais:', error);
      return res.status(500).json({
        success: false,
        error: 'Erro ao buscar totais',
        message: error.message
      });
    }
  }

  /**
   * Drill-down: Busca GRUPOS de uma Seção
   */
  static async getDrillDownGrupos(req: Request, res: Response) {
    try {
      const {
        dataInicio, dataFim, codSecao, codLoja, tipoCompras, tipoOutras, tipoBonificacao,
        produtosBonificados, decomposicao,
        tipoEmprestimoProducao, tipoEmprestimoAssociacao, tipoEmprestimoDecomposicao
      } = req.query;

      if (!dataInicio || !dataFim || !codSecao) {
        return res.status(400).json({
          error: 'Parâmetros obrigatórios',
          message: 'dataInicio, dataFim e codSecao são obrigatórios'
        });
      }

      const filters: any = {
        dataInicio: dataInicio as string,
        dataFim: dataFim as string,
        codSecao: Number(codSecao),
        codLoja: codLoja ? Number(codLoja) : undefined,
        tipoNotaFiscal: {
          compras: tipoCompras === 'true',
          outras: tipoOutras === 'true',
          bonificacao: tipoBonificacao === 'true'
        },
        produtosBonificados: (produtosBonificados as 'com' | 'sem' | 'somente') || 'com',
        decomposicao: (decomposicao as 'ambos' | 'pai' | 'filhos') || 'pai',
        tipoEmprestimoProducao: tipoEmprestimoProducao === undefined ? true : tipoEmprestimoProducao === 'true',
        tipoEmprestimoAssociacao: tipoEmprestimoAssociacao === undefined ? true : tipoEmprestimoAssociacao === 'true',
        tipoEmprestimoDecomposicao: tipoEmprestimoDecomposicao === undefined ? true : tipoEmprestimoDecomposicao === 'true'
      };

      console.log('📊 Drill-down GRUPOS da seção:', codSecao, 'decomposicao:', decomposicao);

      const data = await CompraVendaService.getCompraVendaPorGrupo(filters);

      return res.json({
        success: true,
        data,
        count: data.length
      });
    } catch (error: any) {
      console.error('Erro ao buscar grupos (drill-down):', error);
      return res.status(500).json({
        success: false,
        error: 'Erro ao buscar grupos',
        message: error.message
      });
    }
  }

  /**
   * Drill-down: Busca SUBGRUPOS de um Grupo
   */
  static async getDrillDownSubGrupos(req: Request, res: Response) {
    try {
      const {
        dataInicio, dataFim, codSecao, codGrupo, codLoja, tipoCompras, tipoOutras, tipoBonificacao,
        produtosBonificados, decomposicao,
        tipoEmprestimoProducao, tipoEmprestimoAssociacao, tipoEmprestimoDecomposicao
      } = req.query;

      if (!dataInicio || !dataFim || !codSecao || !codGrupo) {
        return res.status(400).json({
          error: 'Parâmetros obrigatórios',
          message: 'dataInicio, dataFim, codSecao e codGrupo são obrigatórios'
        });
      }

      const filters: any = {
        dataInicio: dataInicio as string,
        dataFim: dataFim as string,
        codSecao: Number(codSecao),
        codGrupo: Number(codGrupo),
        codLoja: codLoja ? Number(codLoja) : undefined,
        tipoNotaFiscal: {
          compras: tipoCompras === 'true',
          outras: tipoOutras === 'true',
          bonificacao: tipoBonificacao === 'true'
        },
        produtosBonificados: (produtosBonificados as 'com' | 'sem' | 'somente') || 'com',
        decomposicao: (decomposicao as 'ambos' | 'pai' | 'filhos') || 'pai',
        tipoEmprestimoProducao: tipoEmprestimoProducao === undefined ? true : tipoEmprestimoProducao === 'true',
        tipoEmprestimoAssociacao: tipoEmprestimoAssociacao === undefined ? true : tipoEmprestimoAssociacao === 'true',
        tipoEmprestimoDecomposicao: tipoEmprestimoDecomposicao === undefined ? true : tipoEmprestimoDecomposicao === 'true'
      };

      console.log('📊 Drill-down SUBGRUPOS do grupo:', codGrupo, 'decomposicao:', decomposicao);

      const data = await CompraVendaService.getCompraVendaPorSubGrupo(filters);

      return res.json({
        success: true,
        data,
        count: data.length
      });
    } catch (error: any) {
      console.error('Erro ao buscar subgrupos (drill-down):', error);
      return res.status(500).json({
        success: false,
        error: 'Erro ao buscar subgrupos',
        message: error.message
      });
    }
  }

  /**
   * Drill-down: Busca ITENS/PRODUTOS de um SubGrupo
   */
  static async getDrillDownItens(req: Request, res: Response) {
    try {
      const {
        dataInicio, dataFim, codSecao, codGrupo, codSubGrupo, codLoja, tipoCompras, tipoOutras, tipoBonificacao,
        produtosBonificados, decomposicao,
        tipoEmprestimoProducao, tipoEmprestimoAssociacao, tipoEmprestimoDecomposicao
      } = req.query;

      if (!dataInicio || !dataFim || !codSecao || !codGrupo || !codSubGrupo) {
        return res.status(400).json({
          error: 'Parâmetros obrigatórios',
          message: 'dataInicio, dataFim, codSecao, codGrupo e codSubGrupo são obrigatórios'
        });
      }

      const filters: any = {
        dataInicio: dataInicio as string,
        dataFim: dataFim as string,
        codSecao: Number(codSecao),
        codGrupo: Number(codGrupo),
        codSubGrupo: Number(codSubGrupo),
        codLoja: codLoja ? Number(codLoja) : undefined,
        tipoNotaFiscal: {
          compras: tipoCompras === 'true',
          outras: tipoOutras === 'true',
          bonificacao: tipoBonificacao === 'true'
        },
        produtosBonificados: (produtosBonificados as 'com' | 'sem' | 'somente') || 'com',
        decomposicao: (decomposicao as 'ambos' | 'pai' | 'filhos') || 'pai',
        tipoEmprestimoProducao: tipoEmprestimoProducao === undefined ? true : tipoEmprestimoProducao === 'true',
        tipoEmprestimoAssociacao: tipoEmprestimoAssociacao === undefined ? true : tipoEmprestimoAssociacao === 'true',
        tipoEmprestimoDecomposicao: tipoEmprestimoDecomposicao === undefined ? true : tipoEmprestimoDecomposicao === 'true'
      };

      console.log('📊 Drill-down ITENS do subgrupo:', codSubGrupo, 'decomposicao:', decomposicao);

      const data = await CompraVendaService.getCompraVendaPorItem(filters);

      return res.json({
        success: true,
        data,
        count: data.length
      });
    } catch (error: any) {
      console.error('Erro ao buscar itens (drill-down):', error);
      return res.status(500).json({
        success: false,
        error: 'Erro ao buscar itens',
        message: error.message
      });
    }
  }

  /**
   * Busca detalhamento dos valores de Emprestei/Emprestado
   * Retorna a lista de itens que compõem o valor de empréstimo
   */
  static async getDetalheEmprestimo(req: Request, res: Response) {
    try {
      const {
        dataInicio, dataFim, codLoja,
        tipoCompras, tipoOutras, tipoBonificacao,
        nivel, tipo,
        codSecao, codGrupo, codSubGrupo, codProduto
      } = req.query;

      if (!dataInicio || !dataFim || !nivel || !tipo) {
        return res.status(400).json({
          success: false,
          error: 'Parâmetros obrigatórios: dataInicio, dataFim, nivel, tipo'
        });
      }

      const filters: any = {
        dataInicio: dataInicio as string,
        dataFim: dataFim as string,
        codLoja: codLoja ? Number(codLoja) : undefined,
        tipoNotaFiscal: {
          compras: tipoCompras === 'true',
          outras: tipoOutras === 'true',
          bonificacao: tipoBonificacao === 'true'
        },
        nivel: nivel as 'secao' | 'grupo' | 'subgrupo' | 'item',
        tipo: tipo as 'emprestei' | 'emprestado',
        codSecao: codSecao ? Number(codSecao) : undefined,
        codGrupo: codGrupo ? Number(codGrupo) : undefined,
        codSubGrupo: codSubGrupo ? Number(codSubGrupo) : undefined,
        codProduto: codProduto ? Number(codProduto) : undefined
      };

      console.log('📊 Buscando detalhe empréstimo:', { nivel, tipo, codSecao, codGrupo, codSubGrupo, codProduto });

      const data = await CompraVendaService.getDetalheEmprestimo(filters);

      return res.json({
        success: true,
        data
      });
    } catch (error: any) {
      console.error('Erro ao buscar detalhe de empréstimo:', error);
      return res.status(500).json({
        success: false,
        error: 'Erro ao buscar detalhe de empréstimo',
        message: error.message
      });
    }
  }
}
