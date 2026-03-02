import { AppDataSource } from '../config/database';
import { GarimpadorMensagem } from '../entities/GarimpadorMensagem';
import { GarimpadorContato } from '../entities/GarimpadorContato';
import { ConfigurationService } from './configuration.service';
import { MappingService } from './mapping.service';
import { OracleService } from './oracle.service';
import { WhatsAppService } from './whatsapp.service';
import axios from 'axios';

interface ProdutoExtraido {
  produto: string;
  preco: number;
  condicao?: string;
}

interface ProdutoOracle {
  codigo_barras: string;
  descricao: string;
  preco_custo: number;
  preco_venda: number;
  preco_venda_concorrente: number;
  estoque_atual: number;
  cobertura: number;
  pedido_compra: number;
  curva: string;
  venda_media_dia: number;
  venda_30d: number;
  margem_referencia: number;
  secao: string;
  grupo: string;
  subgrupo: string;
  fornecedor: string;
}

interface ResultadoComparacao {
  produtoOfertado: string;
  precoOferta: number;
  condicao?: string;
  produtoLoja: ProdutoOracle | null;
  diferenca: number;
  boaOferta: boolean;
  margemAtual: number;
  margemFutura: number;
  margemMeta: number;
  diferencaMargem: number;
  classificacao: 'ouro' | 'prata' | 'bronze' | 'ruim';
}

/**
 * Service responsavel por comparar produtos extraidos com o banco Oracle,
 * classificar oportunidades e enviar para grupos WhatsApp.
 */
export class GarimpadorComparadorService {

  /**
   * Processa uma mensagem: busca produtos no Oracle, compara e envia para WhatsApp
   */
  static async compararEEnviar(mensagemId: number): Promise<{ total: number; enviadas: number; resultados: ResultadoComparacao[] }> {
    const msgRepo = AppDataSource.getRepository(GarimpadorMensagem);
    const mensagem = await msgRepo.findOne({ where: { id: mensagemId }, relations: ['contato'] });

    if (!mensagem) throw new Error('Mensagem nao encontrada');
    if (!mensagem.conteudo_extraido) throw new Error('Mensagem nao possui conteudo extraido');

    let produtos: ProdutoExtraido[];
    try {
      produtos = JSON.parse(mensagem.conteudo_extraido);
      if (!Array.isArray(produtos) || produtos.length === 0) {
        throw new Error('Nenhum produto extraido');
      }
    } catch (e: any) {
      throw new Error(`Erro ao parsear conteudo_extraido: ${e.message}`);
    }

    // Buscar tipo do contato (fornecedor ou concorrente)
    const contato = mensagem.contato;
    const tipoContato = contato?.tipo || 'nao_classificado';

    const resultados: ResultadoComparacao[] = [];
    let enviadas = 0;

    for (const prod of produtos) {
      try {
        // 1. Buscar produto no Oracle
        const produtoOracle = await this.buscarProdutoOracle(prod.produto);

        if (!produtoOracle) {
          console.log(`[Garimpador Comparador] Produto nao encontrado: ${prod.produto}`);
          continue;
        }

        // 2. Comparar precos e calcular margens
        const resultado = this.calcularComparacao(prod, produtoOracle);

        // 3. Classificar (Ouro/Prata/Bronze)
        resultado.classificacao = await this.classificar(resultado.diferencaMargem);

        resultados.push(resultado);

        // 4. Se for boa oferta (preco oferta < custo), enviar para WhatsApp
        if (resultado.boaOferta) {
          const msgFormatada = this.formatarMensagem(resultado, tipoContato, contato);
          const enviou = await this.enviarParaGrupo(msgFormatada, resultado.classificacao, tipoContato);
          if (enviou) enviadas++;
        }
      } catch (err: any) {
        console.error(`[Garimpador Comparador] Erro ao processar "${prod.produto}":`, err.message);
      }
    }

    // Salvar resultados na mensagem
    await msgRepo.update(mensagemId, {
      conteudo_extraido: JSON.stringify({
        produtos_originais: produtos,
        resultados_comparacao: resultados,
        total_enviadas: enviadas,
        data_comparacao: new Date().toISOString(),
      }),
    });

    console.log(`[Garimpador Comparador] Mensagem ${mensagemId}: ${resultados.length} comparados, ${enviadas} enviadas`);
    return { total: produtos.length, enviadas, resultados };
  }

  /**
   * Busca produto no Oracle usando GPT para matching inteligente
   * Primeiro tenta busca direta por LIKE, depois usa GPT se necessario
   */
  static async buscarProdutoOracle(descricaoBusca: string): Promise<ProdutoOracle | null> {
    try {
      const schema = await MappingService.getSchema();

      // Tabelas
      const tabProduto = await MappingService.getRealTableName('TAB_PRODUTO', 'TAB_PRODUTO');
      const tabProdutoLoja = await MappingService.getRealTableName('TAB_PRODUTO_LOJA', 'TAB_PRODUTO_LOJA');
      const tabProdutoPdv = await MappingService.getRealTableName('TAB_PRODUTO_PDV', 'TAB_PRODUTO_PDV');
      const tabFornecedor = await MappingService.getRealTableName('TAB_FORNECEDOR', 'TAB_FORNECEDOR');
      const tabSecao = await MappingService.getRealTableName('TAB_SECAO', 'TAB_SECAO');
      const tabGrupo = await MappingService.getRealTableName('TAB_GRUPO', 'TAB_GRUPO');
      const tabSubgrupo = await MappingService.getRealTableName('TAB_SUBGRUPO', 'TAB_SUBGRUPO');

      // Colunas TAB_PRODUTO
      const colCodProduto = await MappingService.getColumnFromTable('TAB_PRODUTO', 'codigo_produto', 'COD_PRODUTO');
      const colDescricao = await MappingService.getColumnFromTable('TAB_PRODUTO', 'descricao', 'DES_PRODUTO');
      const colCodBarras = await MappingService.getColumnFromTable('TAB_PRODUTO', 'codigo_barras', 'COD_BARRA');
      const colCodSecao = await MappingService.getColumnFromTable('TAB_PRODUTO', 'codigo_secao', 'COD_SECAO');
      const colCodGrupo = await MappingService.getColumnFromTable('TAB_PRODUTO', 'codigo_grupo', 'COD_GRUPO');
      const colCodSubgrupo = await MappingService.getColumnFromTable('TAB_PRODUTO', 'codigo_subgrupo', 'COD_SUBGRUPO');
      const colCodFornecedor = await MappingService.getColumnFromTable('TAB_PRODUTO', 'codigo_fornecedor', 'COD_FORNECEDOR');

      // Colunas TAB_PRODUTO_LOJA
      const colPrecoCusto = await MappingService.getColumnFromTable('TAB_PRODUTO_LOJA', 'preco_custo', 'VAL_CUSTO_REP');
      const colPrecoVenda = await MappingService.getColumnFromTable('TAB_PRODUTO_LOJA', 'preco_venda', 'VAL_VENDA');
      const colEstoque = await MappingService.getColumnFromTable('TAB_PRODUTO_LOJA', 'estoque_atual', 'QTD_EST_ATUAL');
      const colCobertura = await MappingService.getColumnFromTable('TAB_PRODUTO_LOJA', 'cobertura', 'QTD_COBERTURA');
      const colPedidoCompra = await MappingService.getColumnFromTable('TAB_PRODUTO_LOJA', 'pedido_compra', 'QTD_PEDIDO_COMPRA');
      const colCurva = await MappingService.getColumnFromTable('TAB_PRODUTO_LOJA', 'curva', 'DES_RANK_PRODLOJA');
      const colVendaMedia = await MappingService.getColumnFromTable('TAB_PRODUTO_LOJA', 'venda_media', 'VAL_VENDA_MEDIA');
      const colMargemFixa = await MappingService.getColumnFromTable('TAB_PRODUTO_LOJA', 'margem_fixa', 'VAL_MARGEM_FIXA');
      // pesquisa_media = preco medio da pesquisa de concorrente (pode nao existir em todos os clientes)
      const colPesquisaMedia = await MappingService.getColumnFromTable('TAB_PRODUTO_LOJA', 'pesquisa_media', 'VAL_PESQUISA_MEDIA');

      // Colunas de descricao das categorias
      const colDesSecao = await MappingService.getColumnFromTable('TAB_SECAO', 'descricao_secao', 'DES_SECAO');
      const colDesGrupo = await MappingService.getColumnFromTable('TAB_GRUPO', 'descricao_grupo', 'DES_GRUPO');
      const colDesSubgrupo = await MappingService.getColumnFromTable('TAB_SUBGRUPO', 'descricao_subgrupo', 'DES_SUB_GRUPO');

      // Coluna fornecedor
      const colCodForn = await MappingService.getColumnFromTable('TAB_FORNECEDOR', 'codigo_fornecedor', 'COD_FORNECEDOR');
      const colRazaoSocial = await MappingService.getColumnFromTable('TAB_FORNECEDOR', 'razao_social', 'DES_FORNECEDOR');

      // Colunas TAB_PRODUTO_PDV para vendas 30 dias
      const colCodProdutoPdv = await MappingService.getColumnFromTable('TAB_PRODUTO_PDV', 'codigo_produto', 'COD_PRODUTO');
      const colQtdVendaPdv = await MappingService.getColumnFromTable('TAB_PRODUTO_PDV', 'quantidade', 'QTD_TOTAL_PRODUTO');
      const colDataVendaPdv = await MappingService.getColumnFromTable('TAB_PRODUTO_PDV', 'data_venda', 'DTA_SAIDA');

      // Colunas de join TAB_PRODUTO_LOJA e TAB_SECAO/GRUPO/SUBGRUPO
      const colCodProdutoLoja = await MappingService.getColumnFromTable('TAB_PRODUTO_LOJA', 'codigo_produto', 'COD_PRODUTO');
      const colCodSecaoSecao = await MappingService.getColumnFromTable('TAB_SECAO', 'codigo_secao', 'COD_SECAO');
      const colCodGrupoGrupo = await MappingService.getColumnFromTable('TAB_GRUPO', 'codigo_grupo', 'COD_GRUPO');
      const colCodSubgrupoSub = await MappingService.getColumnFromTable('TAB_SUBGRUPO', 'codigo_subgrupo', 'COD_SUB_GRUPO');

      // Preparar termos de busca: remove acentos, divide em palavras
      const termos = descricaoBusca
        .toUpperCase()
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        .replace(/[^A-Z0-9\s]/g, ' ')
        .split(/\s+/)
        .filter(t => t.length >= 2);

      if (termos.length === 0) return null;

      // Monta condições LIKE para cada termo
      const likeConds = termos.map((_, i) => `UPPER(p.${colDescricao}) LIKE :termo${i}`).join(' AND ');
      const params: any = {};
      termos.forEach((t, i) => { params[`termo${i}`] = `%${t}%`; });

      const sql = `
        SELECT
          p.${colCodBarras} AS CODIGO_BARRAS,
          p.${colDescricao} AS DESCRICAO,
          NVL(pl.${colPrecoCusto}, 0) AS PRECO_CUSTO,
          NVL(pl.${colPrecoVenda}, 0) AS PRECO_VENDA,
          NVL(pl.${colPesquisaMedia}, 0) AS PRECO_VENDA_CONCORRENTE,
          NVL(pl.${colEstoque}, 0) AS ESTOQUE_ATUAL,
          NVL(pl.${colCobertura}, 0) AS COBERTURA,
          NVL(pl.${colPedidoCompra}, 0) AS PEDIDO_COMPRA,
          NVL(pl.${colCurva}, '-') AS CURVA,
          NVL(pl.${colVendaMedia}, 0) AS VENDA_MEDIA_DIA,
          NVL(pl.${colMargemFixa}, 0) AS MARGEM_REFERENCIA,
          NVL(s.${colDesSecao}, '-') AS SECAO,
          NVL(g.${colDesGrupo}, '-') AS GRUPO,
          NVL(sg.${colDesSubgrupo}, '-') AS SUBGRUPO,
          NVL(f.${colRazaoSocial}, '-') AS FORNECEDOR,
          (
            SELECT NVL(SUM(pdv.${colQtdVendaPdv}), 0)
            FROM ${schema}.${tabProdutoPdv} pdv
            WHERE pdv.${colCodProdutoPdv} = p.${colCodProduto}
              AND pdv.${colDataVendaPdv} >= SYSDATE - 30
          ) AS VENDA_30D
        FROM ${schema}.${tabProduto} p
        LEFT JOIN ${schema}.${tabProdutoLoja} pl ON pl.${colCodProdutoLoja} = p.${colCodProduto}
        LEFT JOIN ${schema}.${tabSecao} s ON s.${colCodSecaoSecao} = p.${colCodSecao}
        LEFT JOIN ${schema}.${tabGrupo} g ON g.${colCodGrupoGrupo} = p.${colCodGrupo}
        LEFT JOIN ${schema}.${tabSubgrupo} sg ON sg.${colCodSubgrupoSub} = p.${colCodSubgrupo}
        LEFT JOIN ${schema}.${tabFornecedor} f ON f.${colCodForn} = p.${colCodFornecedor}
        WHERE ${likeConds}
          AND ROWNUM <= 5
        ORDER BY NVL(pl.${colPrecoVenda}, 0) DESC
      `;

      console.log(`[Garimpador Comparador] Buscando "${descricaoBusca}" - termos: ${termos.join(', ')}`);
      console.log(`[Garimpador Comparador] SQL WHERE: ${likeConds}`);

      let rows: any[];
      try {
        rows = await OracleService.query<any>(sql, params);
      } catch (queryErr: any) {
        console.error(`[Garimpador Comparador] Erro na query Oracle:`, queryErr.message);
        // Tenta busca alternativa com GPT
        return await this.buscarProdutoComGPT(descricaoBusca);
      }

      console.log(`[Garimpador Comparador] Encontrados: ${rows.length} resultados`);

      if (rows.length === 0) {
        // Tenta busca com GPT se nao encontrou no LIKE direto
        return await this.buscarProdutoComGPT(descricaoBusca);
      }

      // Se encontrou multiplos, usa GPT para escolher o melhor match
      if (rows.length > 1) {
        const melhor = await this.escolherMelhorMatch(descricaoBusca, rows);
        return this.mapearProdutoOracle(melhor || rows[0]);
      }

      return this.mapearProdutoOracle(rows[0]);
    } catch (error: any) {
      console.error('[Garimpador Comparador] Erro ao buscar produto no Oracle:', error.message);
      console.error('[Garimpador Comparador] Stack:', error.stack?.substring(0, 500));
      return null;
    }
  }

  /**
   * Mapeia resultado Oracle para interface ProdutoOracle
   */
  private static mapearProdutoOracle(row: any): ProdutoOracle {
    return {
      codigo_barras: String(row.CODIGO_BARRAS || ''),
      descricao: String(row.DESCRICAO || ''),
      preco_custo: parseFloat(row.PRECO_CUSTO) || 0,
      preco_venda: parseFloat(row.PRECO_VENDA) || 0,
      preco_venda_concorrente: parseFloat(row.PRECO_VENDA_CONCORRENTE) || 0,
      estoque_atual: parseFloat(row.ESTOQUE_ATUAL) || 0,
      cobertura: parseFloat(row.COBERTURA) || 0,
      pedido_compra: parseFloat(row.PEDIDO_COMPRA) || 0,
      curva: String(row.CURVA || '-'),
      venda_media_dia: parseFloat(row.VENDA_MEDIA_DIA) || 0,
      venda_30d: parseFloat(row.VENDA_30D) || 0,
      margem_referencia: parseFloat(row.MARGEM_REFERENCIA) || 0,
      secao: String(row.SECAO || '-'),
      grupo: String(row.GRUPO || '-'),
      subgrupo: String(row.SUBGRUPO || '-'),
      fornecedor: String(row.FORNECEDOR || '-'),
    };
  }

  /**
   * Busca produto usando GPT para matching inteligente
   * Quando LIKE nao encontra, monta uma busca mais ampla e usa GPT para escolher
   */
  private static async buscarProdutoComGPT(descricaoBusca: string): Promise<ProdutoOracle | null> {
    try {
      const schema = await MappingService.getSchema();
      const tabProduto = await MappingService.getRealTableName('TAB_PRODUTO', 'TAB_PRODUTO');
      const tabProdutoLoja = await MappingService.getRealTableName('TAB_PRODUTO_LOJA', 'TAB_PRODUTO_LOJA');
      const colDescricao = await MappingService.getColumnFromTable('TAB_PRODUTO', 'descricao', 'DES_PRODUTO');
      const colCodProduto = await MappingService.getColumnFromTable('TAB_PRODUTO', 'codigo_produto', 'COD_PRODUTO');
      const colCodProdutoLoja = await MappingService.getColumnFromTable('TAB_PRODUTO_LOJA', 'codigo_produto', 'COD_PRODUTO');
      const colPrecoVenda = await MappingService.getColumnFromTable('TAB_PRODUTO_LOJA', 'preco_venda', 'VAL_VENDA');

      // Pega os 2 termos mais relevantes (mais longos)
      const termos = descricaoBusca
        .toUpperCase()
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        .replace(/[^A-Z0-9\s]/g, ' ')
        .split(/\s+/)
        .filter(t => t.length >= 3)
        .sort((a, b) => b.length - a.length)
        .slice(0, 2);

      if (termos.length === 0) return null;

      // Busca com OR para ser mais abrangente
      const likeConds = termos.map((_, i) => `UPPER(p.${colDescricao}) LIKE :t${i}`).join(' OR ');
      const params: any = {};
      termos.forEach((t, i) => { params[`t${i}`] = `%${t}%`; });

      const sql = `
        SELECT p.${colCodProduto} AS COD, p.${colDescricao} AS DESC_PROD,
               NVL(pl.${colPrecoVenda}, 0) AS PRC_VENDA
        FROM ${schema}.${tabProduto} p
        LEFT JOIN ${schema}.${tabProdutoLoja} pl ON pl.${colCodProdutoLoja} = p.${colCodProduto}
        WHERE (${likeConds})
          AND ROWNUM <= 20
        ORDER BY NVL(pl.${colPrecoVenda}, 0) DESC
      `;

      const candidatos = await OracleService.query<any>(sql, params);
      if (candidatos.length === 0) return null;

      // Usa GPT para escolher o melhor match
      const apiKey = await ConfigurationService.get('openai_api_key');
      const model = await ConfigurationService.get('openai_garimpador_model', 'gpt-4o-mini');

      if (!apiKey) {
        // Sem GPT, retorna o primeiro resultado
        return this.buscarProdutoCompleto(candidatos[0].COD);
      }

      const listaDescricoes = candidatos.map((c: any, i: number) => `${i + 1}. ${c.DESC_PROD}`).join('\n');

      const response = await axios.post(
        'https://api.openai.com/v1/chat/completions',
        {
          model: model || 'gpt-4o-mini',
          messages: [
            {
              role: 'system',
              content: 'Voce e um comparador de produtos de supermercado. Dado um produto buscado e uma lista de candidatos, retorne APENAS o numero do melhor match. Se nenhum for compativel, retorne 0.'
            },
            {
              role: 'user',
              content: `Produto buscado: "${descricaoBusca}"\n\nCandidatos:\n${listaDescricoes}\n\nRetorne apenas o numero (1, 2, 3...):`,
            },
          ],
          temperature: 0,
          max_tokens: 10,
        },
        {
          headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
          timeout: 15000,
        }
      );

      const resposta = response.data.choices?.[0]?.message?.content?.trim();
      const idx = parseInt(resposta) - 1;

      if (isNaN(idx) || idx < 0 || idx >= candidatos.length) return null;

      // Buscar dados completos do produto escolhido
      return this.buscarProdutoCompleto(candidatos[idx].COD);
    } catch (error: any) {
      console.error('[Garimpador Comparador] Erro busca GPT:', error.message);
      return null;
    }
  }

  /**
   * Busca dados completos de um produto pelo codigo
   */
  private static async buscarProdutoCompleto(codProduto: string | number): Promise<ProdutoOracle | null> {
    try {
      const schema = await MappingService.getSchema();
      const tabProduto = await MappingService.getRealTableName('TAB_PRODUTO', 'TAB_PRODUTO');
      const tabProdutoLoja = await MappingService.getRealTableName('TAB_PRODUTO_LOJA', 'TAB_PRODUTO_LOJA');
      const tabProdutoPdv = await MappingService.getRealTableName('TAB_PRODUTO_PDV', 'TAB_PRODUTO_PDV');
      const tabFornecedor = await MappingService.getRealTableName('TAB_FORNECEDOR', 'TAB_FORNECEDOR');
      const tabSecao = await MappingService.getRealTableName('TAB_SECAO', 'TAB_SECAO');
      const tabGrupo = await MappingService.getRealTableName('TAB_GRUPO', 'TAB_GRUPO');
      const tabSubgrupo = await MappingService.getRealTableName('TAB_SUBGRUPO', 'TAB_SUBGRUPO');

      const colCodProduto = await MappingService.getColumnFromTable('TAB_PRODUTO', 'codigo_produto', 'COD_PRODUTO');
      const colDescricao = await MappingService.getColumnFromTable('TAB_PRODUTO', 'descricao', 'DES_PRODUTO');
      const colCodBarras = await MappingService.getColumnFromTable('TAB_PRODUTO', 'codigo_barras', 'COD_BARRA');
      const colCodSecao = await MappingService.getColumnFromTable('TAB_PRODUTO', 'codigo_secao', 'COD_SECAO');
      const colCodGrupo = await MappingService.getColumnFromTable('TAB_PRODUTO', 'codigo_grupo', 'COD_GRUPO');
      const colCodSubgrupo = await MappingService.getColumnFromTable('TAB_PRODUTO', 'codigo_subgrupo', 'COD_SUBGRUPO');
      const colCodFornecedor = await MappingService.getColumnFromTable('TAB_PRODUTO', 'codigo_fornecedor', 'COD_FORNECEDOR');

      const colCodProdutoLoja = await MappingService.getColumnFromTable('TAB_PRODUTO_LOJA', 'codigo_produto', 'COD_PRODUTO');
      const colPrecoCusto = await MappingService.getColumnFromTable('TAB_PRODUTO_LOJA', 'preco_custo', 'VAL_CUSTO_REP');
      const colPrecoVenda = await MappingService.getColumnFromTable('TAB_PRODUTO_LOJA', 'preco_venda', 'VAL_VENDA');
      const colPesquisaMedia = await MappingService.getColumnFromTable('TAB_PRODUTO_LOJA', 'pesquisa_media', 'VAL_PESQUISA_MEDIA');
      const colEstoque = await MappingService.getColumnFromTable('TAB_PRODUTO_LOJA', 'estoque_atual', 'QTD_EST_ATUAL');
      const colCobertura = await MappingService.getColumnFromTable('TAB_PRODUTO_LOJA', 'cobertura', 'QTD_COBERTURA');
      const colPedidoCompra = await MappingService.getColumnFromTable('TAB_PRODUTO_LOJA', 'pedido_compra', 'QTD_PEDIDO_COMPRA');
      const colCurva = await MappingService.getColumnFromTable('TAB_PRODUTO_LOJA', 'curva', 'DES_RANK_PRODLOJA');
      const colVendaMedia = await MappingService.getColumnFromTable('TAB_PRODUTO_LOJA', 'venda_media', 'VAL_VENDA_MEDIA');
      const colMargemFixa = await MappingService.getColumnFromTable('TAB_PRODUTO_LOJA', 'margem_fixa', 'VAL_MARGEM_FIXA');

      const colDesSecao = await MappingService.getColumnFromTable('TAB_SECAO', 'descricao_secao', 'DES_SECAO');
      const colDesGrupo = await MappingService.getColumnFromTable('TAB_GRUPO', 'descricao_grupo', 'DES_GRUPO');
      const colDesSubgrupo = await MappingService.getColumnFromTable('TAB_SUBGRUPO', 'descricao_subgrupo', 'DES_SUB_GRUPO');
      const colCodForn = await MappingService.getColumnFromTable('TAB_FORNECEDOR', 'codigo_fornecedor', 'COD_FORNECEDOR');
      const colRazaoSocial = await MappingService.getColumnFromTable('TAB_FORNECEDOR', 'razao_social', 'DES_FORNECEDOR');

      const colCodProdutoPdv = await MappingService.getColumnFromTable('TAB_PRODUTO_PDV', 'codigo_produto', 'COD_PRODUTO');
      const colQtdVendaPdv = await MappingService.getColumnFromTable('TAB_PRODUTO_PDV', 'quantidade', 'QTD_TOTAL_PRODUTO');
      const colDataVendaPdv = await MappingService.getColumnFromTable('TAB_PRODUTO_PDV', 'data_venda', 'DTA_SAIDA');
      const colCodSecaoSecao = await MappingService.getColumnFromTable('TAB_SECAO', 'codigo_secao', 'COD_SECAO');
      const colCodGrupoGrupo = await MappingService.getColumnFromTable('TAB_GRUPO', 'codigo_grupo', 'COD_GRUPO');
      const colCodSubgrupoSub = await MappingService.getColumnFromTable('TAB_SUBGRUPO', 'codigo_subgrupo', 'COD_SUB_GRUPO');

      const sql = `
        SELECT
          p.${colCodBarras} AS CODIGO_BARRAS,
          p.${colDescricao} AS DESCRICAO,
          NVL(pl.${colPrecoCusto}, 0) AS PRECO_CUSTO,
          NVL(pl.${colPrecoVenda}, 0) AS PRECO_VENDA,
          NVL(pl.${colPesquisaMedia}, 0) AS PRECO_VENDA_CONCORRENTE,
          NVL(pl.${colEstoque}, 0) AS ESTOQUE_ATUAL,
          NVL(pl.${colCobertura}, 0) AS COBERTURA,
          NVL(pl.${colPedidoCompra}, 0) AS PEDIDO_COMPRA,
          NVL(pl.${colCurva}, '-') AS CURVA,
          NVL(pl.${colVendaMedia}, 0) AS VENDA_MEDIA_DIA,
          NVL(pl.${colMargemFixa}, 0) AS MARGEM_REFERENCIA,
          NVL(s.${colDesSecao}, '-') AS SECAO,
          NVL(g.${colDesGrupo}, '-') AS GRUPO,
          NVL(sg.${colDesSubgrupo}, '-') AS SUBGRUPO,
          NVL(f.${colRazaoSocial}, '-') AS FORNECEDOR,
          (
            SELECT NVL(SUM(pdv.${colQtdVendaPdv}), 0)
            FROM ${schema}.${tabProdutoPdv} pdv
            WHERE pdv.${colCodProdutoPdv} = p.${colCodProduto}
              AND pdv.${colDataVendaPdv} >= SYSDATE - 30
          ) AS VENDA_30D
        FROM ${schema}.${tabProduto} p
        LEFT JOIN ${schema}.${tabProdutoLoja} pl ON pl.${colCodProdutoLoja} = p.${colCodProduto}
        LEFT JOIN ${schema}.${tabSecao} s ON s.${colCodSecaoSecao} = p.${colCodSecao}
        LEFT JOIN ${schema}.${tabGrupo} g ON g.${colCodGrupoGrupo} = p.${colCodGrupo}
        LEFT JOIN ${schema}.${tabSubgrupo} sg ON sg.${colCodSubgrupoSub} = p.${colCodSubgrupo}
        LEFT JOIN ${schema}.${tabFornecedor} f ON f.${colCodForn} = p.${colCodFornecedor}
        WHERE p.${colCodProduto} = :codProduto
      `;

      const rows = await OracleService.query<any>(sql, { codProduto });
      if (rows.length === 0) return null;

      return this.mapearProdutoOracle(rows[0]);
    } catch (error: any) {
      console.error('[Garimpador Comparador] Erro buscarProdutoCompleto:', error.message);
      return null;
    }
  }

  /**
   * Usa GPT para escolher o melhor match entre candidatos
   */
  private static async escolherMelhorMatch(descricaoBusca: string, candidatos: any[]): Promise<any | null> {
    try {
      const apiKey = await ConfigurationService.get('openai_api_key');
      if (!apiKey) return null;

      const model = await ConfigurationService.get('openai_garimpador_model', 'gpt-4o-mini');
      const lista = candidatos.map((c: any, i: number) => `${i + 1}. ${c.DESCRICAO}`).join('\n');

      const response = await axios.post(
        'https://api.openai.com/v1/chat/completions',
        {
          model: model || 'gpt-4o-mini',
          messages: [
            {
              role: 'system',
              content: 'Voce e um comparador de produtos de supermercado. Dado um produto buscado e uma lista de candidatos, retorne APENAS o numero do melhor match. Se nenhum for compativel, retorne 1.'
            },
            {
              role: 'user',
              content: `Produto buscado: "${descricaoBusca}"\n\nCandidatos:\n${lista}\n\nRetorne apenas o numero:`,
            },
          ],
          temperature: 0,
          max_tokens: 10,
        },
        {
          headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
          timeout: 15000,
        }
      );

      const resposta = response.data.choices?.[0]?.message?.content?.trim();
      const idx = parseInt(resposta) - 1;
      if (isNaN(idx) || idx < 0 || idx >= candidatos.length) return null;
      return candidatos[idx];
    } catch {
      return null;
    }
  }

  /**
   * Calcula comparacao de precos e margens
   */
  static calcularComparacao(prodExtraido: ProdutoExtraido, prodOracle: ProdutoOracle): ResultadoComparacao {
    const precoOferta = prodExtraido.preco;
    const custoLoja = prodOracle.preco_custo;
    const precoVenda = prodOracle.preco_venda;

    // Diferenca: Custo c/Imp - Preco Oferta (positivo = boa oferta)
    const diferenca = custoLoja - precoOferta;
    const boaOferta = precoOferta < custoLoja;

    // Margem Atual: ((Preco Venda - Custo) / Preco Venda) * 100
    const margemAtual = precoVenda > 0 ? ((precoVenda - custoLoja) / precoVenda) * 100 : 0;

    // Margem Futura: ((Preco Venda - Preco Oferta) / Preco Venda) * 100
    const margemFutura = precoVenda > 0 ? ((precoVenda - precoOferta) / precoVenda) * 100 : 0;

    // Diferenca de Margem (para classificacao Ouro/Prata/Bronze)
    const diferencaMargem = margemFutura - margemAtual;

    return {
      produtoOfertado: prodExtraido.produto,
      precoOferta,
      condicao: prodExtraido.condicao,
      produtoLoja: prodOracle,
      diferenca: parseFloat(diferenca.toFixed(2)),
      boaOferta,
      margemAtual: parseFloat(margemAtual.toFixed(2)),
      margemFutura: parseFloat(margemFutura.toFixed(2)),
      margemMeta: prodOracle.margem_referencia,
      diferencaMargem: parseFloat(diferencaMargem.toFixed(2)),
      classificacao: 'bronze', // sera reclassificado
    };
  }

  /**
   * Classifica a oportunidade baseado na diferenca de margem e % configurados
   */
  static async classificar(diferencaMargem: number): Promise<'ouro' | 'prata' | 'bronze' | 'ruim'> {
    const pctOuro = parseFloat((await ConfigurationService.get('garimpador_pct_ouro', '10')) || '10');
    const pctPrata = parseFloat((await ConfigurationService.get('garimpador_pct_prata', '5')) || '5');

    if (diferencaMargem >= pctOuro) return 'ouro';
    if (diferencaMargem >= pctPrata) return 'prata';
    if (diferencaMargem >= 0) return 'bronze';
    return 'ruim';
  }

  /**
   * Formata mensagem IDENTICA ao n8n para enviar no WhatsApp
   * Com emojis, tabelada, formatacao do n8n
   */
  static formatarMensagem(
    resultado: ResultadoComparacao,
    tipoContato: string,
    contato?: GarimpadorContato | null,
  ): string {
    const p = resultado.produtoLoja!;
    const fmtBRL = (v: number) => v.toFixed(2).replace('.', ',');

    // Header baseado no tipo de contato
    let header: string;
    if (tipoContato === 'concorrente') {
      header = `🟠 CONCORRENTE GARIMPADO ⛏️`;
    } else {
      header = `🟠 Oportunidade encontrada!`;
    }

    // Monta a mensagem identica ao n8n
    let msg = `${header}\n\n`;
    msg += `🏷️ Produto *OFERTADO*: ${resultado.produtoOfertado}\n`;
    msg += `🏷️ Produto *LOJA*: ${p.descricao}\n\n`;

    msg += `💲 Preço Venda Loja: R$ ${fmtBRL(p.preco_venda)}\n`;
    if (p.preco_venda_concorrente > 0) {
      msg += `💲 Preço Venda Concorrente: R$ ${fmtBRL(p.preco_venda_concorrente)}\n`;
    }
    msg += `💲 Custo Loja: R$ ${fmtBRL(p.preco_custo)}\n`;

    if (tipoContato === 'concorrente') {
      msg += `💲 OFERTA Concorrente: R$ ${fmtBRL(resultado.precoOferta)}\n`;
    } else {
      msg += `💲 Custo Fornecedor: R$ ${fmtBRL(resultado.precoOferta)}\n`;
    }
    msg += `📉 Diferença: R$ ${fmtBRL(resultado.diferenca)}\n\n`;

    // Condicao (so se existir, igual no n8n)
    if (resultado.condicao) {
      msg += `🔖 Condição: ${resultado.condicao}\n`;
    }

    msg += `📊 Curva: ${p.curva}\n`;
    msg += `📈 Média Venda Dia: ${fmtBRL(p.venda_media_dia)}\n`;
    msg += `📈 Média Venda Mês: ${fmtBRL(p.venda_30d)}\n`;
    msg += `📦 Estoque Atual: ${fmtBRL(p.estoque_atual)}\n`;
    msg += `📦 Pedido de Compra: ${fmtBRL(p.pedido_compra)}\n`;
    msg += `⏳ Dias de Cobertura: ${fmtBRL(p.cobertura)}\n`;
    msg += `👨‍🌾 Fornecedor Atual: ${p.fornecedor}\n\n`;

    msg += `📊 Margem Meta: ${fmtBRL(resultado.margemMeta)}%\n`;
    msg += `📊 Margem Atual: ${fmtBRL(resultado.margemAtual)}%\n`;

    if (tipoContato === 'concorrente') {
      // Margem Cobrindo Oferta: ((Preco Oferta - Custo) / Preco Oferta) * 100
      const margemCobrindo = resultado.precoOferta > 0
        ? ((resultado.precoOferta - p.preco_custo) / resultado.precoOferta) * 100
        : 0;
      msg += `📊 Margem Cobrindo Oferta: ${fmtBRL(margemCobrindo)}%\n`;
    } else {
      msg += `📊 Margem Futura: ${fmtBRL(resultado.margemFutura)}%\n`;
    }

    // Rodape com info do fornecedor/concorrente
    msg += `\n👨‍🌾 Fornecedor: ${contato?.nome || 'Desconhecido'}`;
    msg += `\n📲 Contato: https://wa.me/${contato?.telefone || ''}`;

    return msg;
  }

  /**
   * Envia mensagem para o grupo WhatsApp correto baseado na classificacao
   */
  static async enviarParaGrupo(
    mensagem: string,
    classificacao: 'ouro' | 'prata' | 'bronze' | 'ruim',
    tipoContato: string,
  ): Promise<boolean> {
    try {
      let groupId: string | null = null;

      if (tipoContato === 'concorrente') {
        groupId = await ConfigurationService.get('whatsapp_group_garimpador_concorrente', '');
      } else {
        switch (classificacao) {
          case 'ouro':
            groupId = await ConfigurationService.get('whatsapp_group_garimpador_ouro', '');
            break;
          case 'prata':
            groupId = await ConfigurationService.get('whatsapp_group_garimpador_prata', '');
            break;
          case 'bronze':
            groupId = await ConfigurationService.get('whatsapp_group_garimpador_bronze', '');
            break;
          default:
            console.log(`[Garimpador Comparador] Classificacao "${classificacao}" - nao envia`);
            return false;
        }
      }

      if (!groupId || groupId.trim() === '') {
        console.log(`[Garimpador Comparador] Grupo WhatsApp nao configurado para ${tipoContato}/${classificacao}`);
        return false;
      }

      const enviou = await WhatsAppService.sendMessage(groupId, mensagem);
      if (enviou) {
        console.log(`[Garimpador Comparador] ✅ Mensagem enviada para grupo ${classificacao.toUpperCase()}`);
      }
      return enviou;
    } catch (error: any) {
      console.error('[Garimpador Comparador] Erro ao enviar:', error.message);
      return false;
    }
  }

  /**
   * Processa todas as mensagens com conteudo extraido mas nao comparadas
   */
  static async processarPendentes(): Promise<{ total: number; processadas: number; enviadas: number }> {
    const repo = AppDataSource.getRepository(GarimpadorMensagem);

    // Busca mensagens que foram processadas (tem conteudo_extraido) mas nao comparadas
    // Identifica se ja foi comparado verificando se conteudo_extraido contem "resultados_comparacao"
    const mensagens = await repo
      .createQueryBuilder('m')
      .leftJoinAndSelect('m.contato', 'c')
      .where('m.processado = true')
      .andWhere('m.conteudo_extraido IS NOT NULL')
      .andWhere("m.conteudo_extraido NOT LIKE '%resultados_comparacao%'")
      .andWhere("c.tipo != 'nao_classificado'")
      .orderBy('m.received_at', 'ASC')
      .take(20)
      .getMany();

    let processadas = 0;
    let enviadas = 0;

    for (const msg of mensagens) {
      try {
        const result = await this.compararEEnviar(msg.id);
        processadas++;
        enviadas += result.enviadas;
      } catch (err: any) {
        console.error(`[Garimpador Comparador] Erro msg ${msg.id}:`, err.message);
        processadas++;
      }
    }

    return { total: mensagens.length, processadas, enviadas };
  }
}
