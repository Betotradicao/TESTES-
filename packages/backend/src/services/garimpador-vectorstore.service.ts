import { AppDataSource } from '../config/database';
import { ConfigurationService } from './configuration.service';
import { MappingService } from './mapping.service';
import { OracleService } from './oracle.service';
import axios from 'axios';

interface ProdutoCache {
  cod_produto: string;
  codigo_barras: string;
  descricao: string;
  descricao_normalizada: string;
  preco_custo: number;
  preco_venda: number;
  estoque_atual: number;
  cobertura: number;
  curva: string;
  venda_media_dia: number;
  venda_30d: number;
  margem_referencia: number;
  secao: string;
  grupo: string;
  subgrupo: string;
  fornecedor: string;
}

interface CandidatoVetorial {
  cod_produto: string;
  codigo_barras: string;
  descricao: string;
  preco_custo: number;
  preco_venda: number;
  estoque_atual: number;
  cobertura: number;
  curva: string;
  venda_media_dia: number;
  venda_30d: number;
  margem_referencia: number;
  secao: string;
  grupo: string;
  subgrupo: string;
  fornecedor: string;
  similarity: number;
}

/**
 * Service responsavel por manter cache de produtos com embeddings vetoriais
 * para busca semantica de alta precisao (inspirado no Garimpador 2.0 n8n).
 *
 * Fluxo: Oracle -> Normaliza -> Embedding OpenAI -> PGVector
 * Busca: Texto -> Embedding -> Similaridade Coseno -> Top N candidatos
 */
export class GarimpadorVectorStoreService {

  private static BATCH_SIZE = 100; // Limite API embeddings
  private static EMBEDDING_MODEL = 'text-embedding-3-small';
  private static EMBEDDING_DIMS = 1536;

  /**
   * Normaliza descricao do produto para gerar embedding melhor
   */
  static normalizar(texto: string): string {
    return texto
      .toUpperCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[^A-Z0-9\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * Gera embeddings para uma lista de textos via OpenAI
   */
  static async gerarEmbeddings(textos: string[], apiKey: string): Promise<number[][]> {
    const response = await axios.post(
      'https://api.openai.com/v1/embeddings',
      {
        model: this.EMBEDDING_MODEL,
        input: textos,
        dimensions: this.EMBEDDING_DIMS,
      },
      {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        timeout: 60000,
      }
    );

    // Retorna embeddings na ordem dos textos de entrada
    const data = response.data.data as Array<{ embedding: number[]; index: number }>;
    data.sort((a, b) => a.index - b.index);
    return data.map(d => d.embedding);
  }

  /**
   * Gera embedding para um unico texto
   */
  static async gerarEmbedding(texto: string, apiKey: string): Promise<number[]> {
    const [embedding] = await this.gerarEmbeddings([texto], apiKey);
    return embedding;
  }

  /**
   * Busca todos os produtos ativos no Oracle com dados completos
   */
  static async buscarProdutosOracle(): Promise<ProdutoCache[]> {
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

    const colPrecoCusto = await MappingService.getColumnFromTable('TAB_PRODUTO_LOJA', 'preco_custo', 'VAL_CUSTO_REP');
    const colPrecoVenda = await MappingService.getColumnFromTable('TAB_PRODUTO_LOJA', 'preco_venda', 'VAL_VENDA');
    const colEstoque = await MappingService.getColumnFromTable('TAB_PRODUTO_LOJA', 'estoque_atual', 'QTD_EST_ATUAL');
    const colCobertura = await MappingService.getColumnFromTable('TAB_PRODUTO_LOJA', 'cobertura', 'QTD_COBERTURA');
    const colCurva = await MappingService.getColumnFromTable('TAB_PRODUTO_LOJA', 'curva', 'DES_RANK_PRODLOJA');
    const colVendaMedia = await MappingService.getColumnFromTable('TAB_PRODUTO_LOJA', 'venda_media', 'VAL_VENDA_MEDIA');
    const colMargem = await MappingService.getColumnFromTable('TAB_PRODUTO_LOJA', 'margem', 'VAL_MARGEM');
    const colCodFornUltCompra = await MappingService.getColumnFromTable('TAB_PRODUTO_LOJA', 'cod_forn_ult_compra', 'COD_FORN_ULT_COMPRA');
    const colCodLojaLoja = await MappingService.getColumnFromTable('TAB_PRODUTO_LOJA', 'codigo_loja', 'COD_LOJA');
    const colCodProdutoLoja = await MappingService.getColumnFromTable('TAB_PRODUTO_LOJA', 'codigo_produto', 'COD_PRODUTO');

    let colInativo = 'INATIVO';
    try {
      const mapped = await MappingService.getColumnFromTable('TAB_PRODUTO_LOJA', 'inativo');
      if (mapped) colInativo = mapped;
    } catch (e) { /* usa default */ }

    const colDesSecao = await MappingService.getColumnFromTable('TAB_SECAO', 'descricao_secao', 'DES_SECAO');
    const colDesGrupo = await MappingService.getColumnFromTable('TAB_GRUPO', 'descricao_grupo', 'DES_GRUPO');
    const colDesSubgrupo = await MappingService.getColumnFromTable('TAB_SUBGRUPO', 'descricao_subgrupo', 'DES_SUB_GRUPO');
    const colCodForn = await MappingService.getColumnFromTable('TAB_FORNECEDOR', 'codigo_fornecedor', 'COD_FORNECEDOR');
    const colRazaoSocial = await MappingService.getColumnFromTable('TAB_FORNECEDOR', 'razao_social', 'DES_FORNECEDOR');
    const colCodSecaoSecao = await MappingService.getColumnFromTable('TAB_SECAO', 'codigo_secao', 'COD_SECAO');
    const colCodGrupoGrupo = await MappingService.getColumnFromTable('TAB_GRUPO', 'codigo_grupo', 'COD_GRUPO');
    const colCodSecaoGrupo = await MappingService.getColumnFromTable('TAB_GRUPO', 'codigo_secao', 'COD_SECAO');
    const colCodSubgrupoSub = await MappingService.getColumnFromTable('TAB_SUBGRUPO', 'codigo_subgrupo', 'COD_SUB_GRUPO');
    const colCodSecaoSub = await MappingService.getColumnFromTable('TAB_SUBGRUPO', 'codigo_secao', 'COD_SECAO');
    const colCodGrupoSub = await MappingService.getColumnFromTable('TAB_SUBGRUPO', 'codigo_grupo', 'COD_GRUPO');

    const colCodProdutoPdv = await MappingService.getColumnFromTable('TAB_PRODUTO_PDV', 'codigo_produto', 'COD_PRODUTO');
    const colQtdVendaPdv = await MappingService.getColumnFromTable('TAB_PRODUTO_PDV', 'quantidade', 'QTD_TOTAL_PRODUTO');
    const colDataVendaPdv = await MappingService.getColumnFromTable('TAB_PRODUTO_PDV', 'data_venda', 'DTA_SAIDA');

    const codLoja = parseInt((await ConfigurationService.get('garimpador_cod_loja', '1')) || '1');

    const sql = `
      SELECT
        p.${colCodProduto} AS COD_PRODUTO,
        p.${colCodBarras} AS CODIGO_BARRAS,
        p.${colDescricao} AS DESCRICAO,
        NVL(pl.${colPrecoCusto}, 0) AS PRECO_CUSTO,
        NVL(pl.${colPrecoVenda}, 0) AS PRECO_VENDA,
        NVL(pl.${colEstoque}, 0) AS ESTOQUE_ATUAL,
        NVL(pl.${colCobertura}, 0) AS COBERTURA,
        NVL(pl.${colCurva}, '-') AS CURVA,
        NVL(pl.${colVendaMedia}, 0) AS VENDA_MEDIA_DIA,
        NVL(pl.${colMargem}, 0) AS MARGEM_REFERENCIA,
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
      LEFT JOIN ${schema}.${tabProdutoLoja} pl ON pl.${colCodProdutoLoja} = p.${colCodProduto} AND pl.${colCodLojaLoja} = :codLoja
      LEFT JOIN ${schema}.${tabSecao} s ON s.${colCodSecaoSecao} = p.${colCodSecao}
      LEFT JOIN ${schema}.${tabGrupo} g ON g.${colCodGrupoGrupo} = p.${colCodGrupo} AND g.${colCodSecaoGrupo} = p.${colCodSecao}
      LEFT JOIN ${schema}.${tabSubgrupo} sg ON sg.${colCodSubgrupoSub} = p.${colCodSubgrupo} AND sg.${colCodSecaoSub} = p.${colCodSecao} AND sg.${colCodGrupoSub} = p.${colCodGrupo}
      LEFT JOIN ${schema}.${tabFornecedor} f ON f.${colCodForn} = pl.${colCodFornUltCompra}
      WHERE NVL(pl.${colInativo}, 'N') != 'S'
        AND pl.${colCodProdutoLoja} IS NOT NULL
    `;

    const rows = await OracleService.query<any>(sql, { codLoja });

    return rows.map((r: any) => ({
      cod_produto: String(r.COD_PRODUTO || ''),
      codigo_barras: String(r.CODIGO_BARRAS || ''),
      descricao: String(r.DESCRICAO || ''),
      descricao_normalizada: this.normalizar(String(r.DESCRICAO || '')),
      preco_custo: parseFloat(r.PRECO_CUSTO) || 0,
      preco_venda: parseFloat(r.PRECO_VENDA) || 0,
      estoque_atual: parseFloat(r.ESTOQUE_ATUAL) || 0,
      cobertura: parseFloat(r.COBERTURA) || 0,
      curva: String(r.CURVA || '-'),
      venda_media_dia: parseFloat(r.VENDA_MEDIA_DIA) || 0,
      venda_30d: parseFloat(r.VENDA_30D) || 0,
      margem_referencia: parseFloat(r.MARGEM_REFERENCIA) || 0,
      secao: String(r.SECAO || '-'),
      grupo: String(r.GRUPO || '-'),
      subgrupo: String(r.SUBGRUPO || '-'),
      fornecedor: String(r.FORNECEDOR || '-'),
    }));
  }

  /**
   * Sincroniza produtos Oracle -> PGVector cache
   * Busca todos os produtos ativos, gera embeddings e salva no PostgreSQL
   */
  static async sincronizar(): Promise<{ total: number; atualizados: number; erros: number }> {
    console.log('[VectorStore] Iniciando sincronizacao Oracle -> PGVector...');

    const apiKey = await ConfigurationService.get('openai_api_key');
    if (!apiKey) {
      throw new Error('API key OpenAI nao configurada');
    }

    // 1. Buscar produtos do Oracle
    const produtos = await this.buscarProdutosOracle();
    console.log(`[VectorStore] ${produtos.length} produtos encontrados no Oracle`);

    if (produtos.length === 0) return { total: 0, atualizados: 0, erros: 0 };

    // 2. Buscar produtos ja cacheados para saber quais precisa atualizar embedding
    const pgRepo = AppDataSource;
    const existentes = await pgRepo.query(
      'SELECT cod_produto, descricao_normalizada FROM garimpador_produtos_cache'
    );
    const cacheMap = new Map<string, string>();
    for (const e of existentes) {
      cacheMap.set(e.cod_produto, e.descricao_normalizada);
    }

    // 3. Separar: novos/mudaram descricao (precisam embedding) vs so atualizar dados
    const precisaEmbedding: ProdutoCache[] = [];
    const soAtualizaDados: ProdutoCache[] = [];

    for (const p of produtos) {
      const descCacheada = cacheMap.get(p.cod_produto);
      if (!descCacheada || descCacheada !== p.descricao_normalizada) {
        precisaEmbedding.push(p);
      } else {
        soAtualizaDados.push(p);
      }
    }

    console.log(`[VectorStore] ${precisaEmbedding.length} produtos precisam novo embedding, ${soAtualizaDados.length} so atualizam dados`);

    let atualizados = 0;
    let erros = 0;

    // 4. Gerar embeddings em lotes e salvar
    for (let i = 0; i < precisaEmbedding.length; i += this.BATCH_SIZE) {
      const batch = precisaEmbedding.slice(i, i + this.BATCH_SIZE);
      try {
        const textos = batch.map(p => p.descricao_normalizada);
        const embeddings = await this.gerarEmbeddings(textos, apiKey);

        for (let j = 0; j < batch.length; j++) {
          try {
            const p = batch[j];
            const embStr = `[${embeddings[j].join(',')}]`;
            await pgRepo.query(`
              INSERT INTO garimpador_produtos_cache
                (cod_produto, codigo_barras, descricao, descricao_normalizada, embedding,
                 preco_custo, preco_venda, estoque_atual, cobertura, curva,
                 venda_media_dia, venda_30d, margem_referencia, secao, grupo, subgrupo, fornecedor, updated_at)
              VALUES ($1,$2,$3,$4,$5::vector,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,NOW())
              ON CONFLICT (cod_produto) DO UPDATE SET
                codigo_barras = $2, descricao = $3, descricao_normalizada = $4, embedding = $5::vector,
                preco_custo = $6, preco_venda = $7, estoque_atual = $8, cobertura = $9, curva = $10,
                venda_media_dia = $11, venda_30d = $12, margem_referencia = $13,
                secao = $14, grupo = $15, subgrupo = $16, fornecedor = $17, updated_at = NOW()
            `, [
              p.cod_produto, p.codigo_barras, p.descricao, p.descricao_normalizada, embStr,
              p.preco_custo, p.preco_venda, p.estoque_atual, p.cobertura, p.curva,
              p.venda_media_dia, p.venda_30d, p.margem_referencia,
              p.secao, p.grupo, p.subgrupo, p.fornecedor,
            ]);
            atualizados++;
          } catch (e: any) {
            console.error(`[VectorStore] Erro ao salvar produto ${batch[j].cod_produto}:`, e.message);
            erros++;
          }
        }

        console.log(`[VectorStore] Batch ${Math.floor(i / this.BATCH_SIZE) + 1}: ${batch.length} embeddings gerados`);
      } catch (e: any) {
        console.error(`[VectorStore] Erro ao gerar embeddings batch ${i}:`, e.message);
        erros += batch.length;
      }
    }

    // 5. Atualizar dados (sem novo embedding) dos produtos que nao mudaram descricao
    for (const p of soAtualizaDados) {
      try {
        await pgRepo.query(`
          UPDATE garimpador_produtos_cache SET
            codigo_barras = $2, preco_custo = $3, preco_venda = $4, estoque_atual = $5,
            cobertura = $6, curva = $7, venda_media_dia = $8, venda_30d = $9,
            margem_referencia = $10, secao = $11, grupo = $12, subgrupo = $13,
            fornecedor = $14, updated_at = NOW()
          WHERE cod_produto = $1
        `, [
          p.cod_produto, p.codigo_barras, p.preco_custo, p.preco_venda, p.estoque_atual,
          p.cobertura, p.curva, p.venda_media_dia, p.venda_30d,
          p.margem_referencia, p.secao, p.grupo, p.subgrupo, p.fornecedor,
        ]);
        atualizados++;
      } catch (e: any) {
        erros++;
      }
    }

    console.log(`[VectorStore] Sincronizacao concluida: ${atualizados} atualizados, ${erros} erros`);
    return { total: produtos.length, atualizados, erros };
  }

  /**
   * Busca produtos similares via embedding vetorial
   * Retorna top N candidatos ordenados por similaridade coseno
   */
  static async buscarSimilares(texto: string, limite: number = 15): Promise<CandidatoVetorial[]> {
    const apiKey = await ConfigurationService.get('openai_api_key');
    if (!apiKey) {
      throw new Error('API key OpenAI nao configurada');
    }

    // Verificar se tem produtos no cache
    const countResult = await AppDataSource.query(
      'SELECT COUNT(*) as total FROM garimpador_produtos_cache WHERE embedding IS NOT NULL'
    );
    const total = parseInt(countResult[0]?.total || '0');
    if (total === 0) {
      console.log('[VectorStore] Cache vazio - execute sincronizacao primeiro');
      return [];
    }

    // Gerar embedding do texto de busca
    const textoNorm = this.normalizar(texto);
    const embedding = await this.gerarEmbedding(textoNorm, apiKey);
    const embStr = `[${embedding.join(',')}]`;

    // Busca vetorial por similaridade coseno (1 - distancia = similaridade)
    const rows = await AppDataSource.query(`
      SELECT
        cod_produto, codigo_barras, descricao, preco_custo, preco_venda,
        estoque_atual, cobertura, curva, venda_media_dia, venda_30d,
        margem_referencia, secao, grupo, subgrupo, fornecedor,
        1 - (embedding <=> $1::vector) AS similarity
      FROM garimpador_produtos_cache
      WHERE embedding IS NOT NULL
      ORDER BY embedding <=> $1::vector
      LIMIT $2
    `, [embStr, limite]);

    return rows.map((r: any) => ({
      cod_produto: r.cod_produto,
      codigo_barras: r.codigo_barras,
      descricao: r.descricao,
      preco_custo: parseFloat(r.preco_custo) || 0,
      preco_venda: parseFloat(r.preco_venda) || 0,
      estoque_atual: parseFloat(r.estoque_atual) || 0,
      cobertura: parseFloat(r.cobertura) || 0,
      curva: r.curva || '-',
      venda_media_dia: parseFloat(r.venda_media_dia) || 0,
      venda_30d: parseFloat(r.venda_30d) || 0,
      margem_referencia: parseFloat(r.margem_referencia) || 0,
      secao: r.secao || '-',
      grupo: r.grupo || '-',
      subgrupo: r.subgrupo || '-',
      fornecedor: r.fornecedor || '-',
      similarity: parseFloat(r.similarity) || 0,
    }));
  }

  /**
   * Retorna estatisticas do cache
   */
  static async stats(): Promise<{ total: number; comEmbedding: number; ultimaSync: string | null }> {
    const rows = await AppDataSource.query(`
      SELECT
        COUNT(*) AS total,
        COUNT(embedding) AS com_embedding,
        MAX(updated_at) AS ultima_sync
      FROM garimpador_produtos_cache
    `);
    const r = rows[0];
    return {
      total: parseInt(r.total) || 0,
      comEmbedding: parseInt(r.com_embedding) || 0,
      ultimaSync: r.ultima_sync ? new Date(r.ultima_sync).toISOString() : null,
    };
  }
}
