import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateGarimpadorProdutosCacheTable1783100000000 implements MigrationInterface {

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Habilitar extensoes
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS vector`);
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS pg_trgm`);

    // Tabela de cache de produtos com embeddings para busca vetorial
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "garimpador_produtos_cache" (
        "id" SERIAL PRIMARY KEY,
        "cod_produto" VARCHAR(50) NOT NULL,
        "codigo_barras" VARCHAR(50),
        "descricao" TEXT NOT NULL,
        "descricao_normalizada" TEXT NOT NULL,
        "embedding" vector(1536),
        "preco_custo" DECIMAL(12,2),
        "preco_venda" DECIMAL(12,2),
        "estoque_atual" DECIMAL(12,2),
        "cobertura" DECIMAL(12,2),
        "curva" VARCHAR(10),
        "venda_media_dia" DECIMAL(12,2),
        "venda_30d" DECIMAL(12,2),
        "margem_referencia" DECIMAL(12,2),
        "secao" VARCHAR(100),
        "grupo" VARCHAR(100),
        "subgrupo" VARCHAR(100),
        "fornecedor" VARCHAR(200),
        "updated_at" TIMESTAMP DEFAULT now(),
        CONSTRAINT "UQ_garimpador_cache_cod_produto" UNIQUE ("cod_produto")
      )
    `);

    // Indice IVFFlat para busca vetorial por similaridade coseno
    // O lists=100 e bom para ate ~100k produtos
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_garimpador_cache_embedding"
      ON "garimpador_produtos_cache"
      USING ivfflat ("embedding" vector_cosine_ops)
      WITH (lists = 100)
    `);

    // Indice para busca por descricao (full text search)
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_garimpador_cache_descricao"
      ON "garimpador_produtos_cache"
      USING gin (to_tsvector('portuguese', "descricao_normalizada"))
    `);

    // Indice trigram para busca por similaridade de texto (pg_trgm)
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_garimpador_cache_trgm"
      ON "garimpador_produtos_cache"
      USING gin ("descricao_normalizada" gin_trgm_ops)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "garimpador_produtos_cache"`);
  }
}
