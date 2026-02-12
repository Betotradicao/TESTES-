import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateNotaFiscalRecebimentoTable1781600100000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "nota_fiscal_recebimento" (
        "id" SERIAL PRIMARY KEY,
        "num_nota" varchar(100) NOT NULL,
        "fornecedor" varchar(255) NOT NULL,
        "cod_fornecedor" int,
        "data_recebimento" date NOT NULL,
        "hora_recebimento" varchar(10) NOT NULL,
        "valor_nota" decimal(14,2) NOT NULL DEFAULT 0,
        "conferente_id" uuid,
        "conferente_nome" varchar(255),
        "conferente_assinado_em" timestamp,
        "cpd_id" uuid,
        "cpd_nome" varchar(255),
        "cpd_assinado_em" timestamp,
        "financeiro_id" uuid,
        "financeiro_nome" varchar(255),
        "financeiro_assinado_em" timestamp,
        "created_by" uuid,
        "cod_loja" int,
        "created_at" TIMESTAMP DEFAULT now(),
        "updated_at" TIMESTAMP DEFAULT now()
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_nf_recebimento_data"
      ON "nota_fiscal_recebimento" ("data_recebimento")
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_nf_recebimento_loja"
      ON "nota_fiscal_recebimento" ("cod_loja")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "nota_fiscal_recebimento"`);
  }
}
