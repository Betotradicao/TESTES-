import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateOfertasSalvasTable1781800000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "ofertas_salvas" (
        "id" SERIAL PRIMARY KEY,
        "cod_loja" INT NOT NULL,
        "cod_produto" VARCHAR(20) NOT NULL,
        "descricao" VARCHAR(255) NOT NULL,
        "cod_barras" VARCHAR(20),
        "secao" VARCHAR(100),
        "curva" VARCHAR(5),
        "preco_normal" DECIMAL(10,2) DEFAULT 0,
        "custo" DECIMAL(10,2) DEFAULT 0,
        "preco_rebaixo" DECIMAL(10,2),
        "preco_club" DECIMAL(10,2),
        "preco_leve_mais" DECIMAL(10,2),
        "tipo_oferta_escolhido" VARCHAR(50),
        "status" VARCHAR(50) DEFAULT 'rascunho',
        "origem" VARCHAR(50),
        "created_by" INT,
        "created_at" TIMESTAMP DEFAULT now(),
        "updated_at" TIMESTAMP DEFAULT now()
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_ofertas_salvas_loja"
      ON "ofertas_salvas" ("cod_loja")
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_ofertas_salvas_status"
      ON "ofertas_salvas" ("status")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "ofertas_salvas"`);
  }
}
