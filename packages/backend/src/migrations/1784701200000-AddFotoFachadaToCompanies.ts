import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddFotoFachadaToCompanies1784701200000 implements MigrationInterface {
  name = 'AddFotoFachadaToCompanies1784701200000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "companies"
      ADD COLUMN IF NOT EXISTS "foto_fachada_url" TEXT NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "companies" DROP COLUMN IF EXISTS "foto_fachada_url"`);
  }
}
