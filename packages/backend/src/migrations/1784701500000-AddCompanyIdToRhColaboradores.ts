import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddCompanyIdToRhColaboradores1784701500000 implements MigrationInterface {
  name = 'AddCompanyIdToRhColaboradores1784701500000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "rh_colaboradores"
      ADD COLUMN IF NOT EXISTS "company_id" UUID NULL REFERENCES "companies"(id) ON DELETE SET NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "rh_colaboradores" DROP COLUMN IF EXISTS "company_id"`);
  }
}
