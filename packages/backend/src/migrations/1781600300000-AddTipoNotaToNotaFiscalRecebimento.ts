import { MigrationInterface, QueryRunner } from "typeorm";

export class AddTipoNotaToNotaFiscalRecebimento1781600300000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "nota_fiscal_recebimento"
      ADD COLUMN IF NOT EXISTS "tipo_nota" varchar(20) DEFAULT 'fiscal'
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "nota_fiscal_recebimento"
      DROP COLUMN IF EXISTS "tipo_nota"
    `);
  }
}
