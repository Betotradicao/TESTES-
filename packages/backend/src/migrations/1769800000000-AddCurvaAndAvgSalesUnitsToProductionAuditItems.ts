import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddCurvaAndAvgSalesUnitsToProductionAuditItems1769800000000 implements MigrationInterface {
  name = 'AddCurvaAndAvgSalesUnitsToProductionAuditItems1769800000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Adicionar coluna curva
    await queryRunner.query(`
      ALTER TABLE "production_audit_items"
      ADD COLUMN IF NOT EXISTS "curva" VARCHAR(5) DEFAULT NULL
    `);

    // Adicionar coluna avg_sales_units (média de vendas em unidades)
    await queryRunner.query(`
      ALTER TABLE "production_audit_items"
      ADD COLUMN IF NOT EXISTS "avg_sales_units" DECIMAL(10, 3) DEFAULT NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "production_audit_items" DROP COLUMN IF EXISTS "curva"`);
    await queryRunner.query(`ALTER TABLE "production_audit_items" DROP COLUMN IF EXISTS "avg_sales_units"`);
  }
}
