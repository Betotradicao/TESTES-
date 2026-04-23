import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateBancoCurriculosTables1784700800000 implements MigrationInterface {
  name = 'CreateBancoCurriculosTables1784700800000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Cargos (ex: REPOSITOR, BALCONISTA, AÇOUGUEIRO)
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "curriculo_cargos" (
        "id" SERIAL PRIMARY KEY,
        "nome" VARCHAR(255) NOT NULL,
        "ativo" BOOLEAN NOT NULL DEFAULT TRUE,
        "ordem" INTEGER NOT NULL DEFAULT 0,
        "created_at" TIMESTAMP NOT NULL DEFAULT NOW(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `);

    // Habilidades (ex: ATENDIMENTO AO CLIENTE, PRODUÇÃO)
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "curriculo_habilidades" (
        "id" SERIAL PRIMARY KEY,
        "nome" VARCHAR(255) NOT NULL,
        "ativo" BOOLEAN NOT NULL DEFAULT TRUE,
        "ordem" INTEGER NOT NULL DEFAULT 0,
        "created_at" TIMESTAMP NOT NULL DEFAULT NOW(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `);

    // Curriculos recebidos via link publico
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "curriculos" (
        "id" SERIAL PRIMARY KEY,
        "nome" VARCHAR(255) NOT NULL,
        "data_nascimento" DATE NULL,
        "whatsapp" VARCHAR(30) NULL,
        "email" VARCHAR(255) NULL,
        "instagram" VARCHAR(255) NULL,
        "linkedin" VARCHAR(255) NULL,
        "cep" VARCHAR(9) NULL,
        "rua" VARCHAR(255) NULL,
        "numero" VARCHAR(30) NULL,
        "complemento" VARCHAR(255) NULL,
        "bairro" VARCHAR(255) NULL,
        "cidade" VARCHAR(255) NULL,
        "estado" VARCHAR(2) NULL,
        "cargos" JSONB NOT NULL DEFAULT '[]'::jsonb,
        "habilidades" JSONB NOT NULL DEFAULT '[]'::jsonb,
        "experiencia_texto" TEXT NULL,
        "observacao_rh" TEXT NULL,
        "status" VARCHAR(30) NOT NULL DEFAULT 'novo',
        "avaliacao_rh" INTEGER NULL,
        "cod_loja" INTEGER NULL,
        "created_at" TIMESTAMP NOT NULL DEFAULT NOW(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_curriculos_status" ON "curriculos" ("status")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_curriculos_cidade" ON "curriculos" ("cidade")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_curriculos_created_at" ON "curriculos" ("created_at")`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "curriculos"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "curriculo_habilidades"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "curriculo_cargos"`);
  }
}
