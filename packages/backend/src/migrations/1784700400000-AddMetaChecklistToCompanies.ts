import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddMetaChecklistToCompanies1784700400000 implements MigrationInterface {
  name = 'AddMetaChecklistToCompanies1784700400000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "companies"
      ADD COLUMN IF NOT EXISTS "meta_checklist" NUMERIC(5,2) NOT NULL DEFAULT 95.00
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "companies" DROP COLUMN IF EXISTS "meta_checklist"
    `);
  }
}
