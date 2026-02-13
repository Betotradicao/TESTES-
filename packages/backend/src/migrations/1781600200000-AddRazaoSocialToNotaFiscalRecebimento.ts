import { MigrationInterface, QueryRunner } from "typeorm";

export class AddRazaoSocialToNotaFiscalRecebimento1781600200000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "nota_fiscal_recebimento"
      ADD COLUMN IF NOT EXISTS "razao_social" varchar(255)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "nota_fiscal_recebimento"
      DROP COLUMN IF EXISTS "razao_social"
    `);
  }
}
