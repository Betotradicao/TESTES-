import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddCVDetalhadoFields1784700900000 implements MigrationInterface {
  name = 'AddCVDetalhadoFields1784700900000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "curriculos"
      ADD COLUMN IF NOT EXISTS "foto_url" TEXT NULL,
      ADD COLUMN IF NOT EXISTS "resumo" TEXT NULL,
      ADD COLUMN IF NOT EXISTS "experiencias_detalhadas" JSONB NOT NULL DEFAULT '[]'::jsonb,
      ADD COLUMN IF NOT EXISTS "formacoes" JSONB NOT NULL DEFAULT '[]'::jsonb
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "curriculos"
      DROP COLUMN IF EXISTS "foto_url",
      DROP COLUMN IF EXISTS "resumo",
      DROP COLUMN IF EXISTS "experiencias_detalhadas",
      DROP COLUMN IF EXISTS "formacoes"
    `);
  }
}
