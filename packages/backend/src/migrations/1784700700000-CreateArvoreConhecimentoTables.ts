import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateArvoreConhecimentoTables1784700700000 implements MigrationInterface {
  name = 'CreateArvoreConhecimentoTables1784700700000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "arvore_abas" (
        "id" SERIAL PRIMARY KEY,
        "setor_id" INTEGER NOT NULL,
        "nome" VARCHAR(255) NOT NULL,
        "descricao" TEXT,
        "ordem" INTEGER NOT NULL DEFAULT 0,
        "cod_loja" INTEGER,
        "created_at" TIMESTAMP NOT NULL DEFAULT NOW(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT NOW(),
        CONSTRAINT "fk_arvore_aba_setor" FOREIGN KEY ("setor_id") REFERENCES "sectors"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_arvore_aba_setor" ON "arvore_abas" ("setor_id")`);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "arvore_notas" (
        "id" SERIAL PRIMARY KEY,
        "aba_id" INTEGER NOT NULL,
        "titulo" VARCHAR(500) NOT NULL,
        "conteudo" TEXT,
        "ordem" INTEGER NOT NULL DEFAULT 0,
        "created_at" TIMESTAMP NOT NULL DEFAULT NOW(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT NOW(),
        CONSTRAINT "fk_arvore_nota_aba" FOREIGN KEY ("aba_id") REFERENCES "arvore_abas"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_arvore_nota_aba" ON "arvore_notas" ("aba_id")`);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "arvore_anexos" (
        "id" SERIAL PRIMARY KEY,
        "nota_id" INTEGER NOT NULL,
        "tipo" VARCHAR(50) NOT NULL,
        "url" TEXT NOT NULL,
        "nome_original" VARCHAR(500),
        "tamanho_bytes" BIGINT,
        "created_at" TIMESTAMP NOT NULL DEFAULT NOW(),
        CONSTRAINT "fk_arvore_anexo_nota" FOREIGN KEY ("nota_id") REFERENCES "arvore_notas"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_arvore_anexo_nota" ON "arvore_anexos" ("nota_id")`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "arvore_anexos"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "arvore_notas"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "arvore_abas"`);
  }
}
