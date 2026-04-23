import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddCursosAdicionaisToCurriculos1784701100000 implements MigrationInterface {
  name = 'AddCursosAdicionaisToCurriculos1784701100000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "curriculos"
      ADD COLUMN IF NOT EXISTS "cursos_adicionais" JSONB NOT NULL DEFAULT '[]'::jsonb
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "curriculos" DROP COLUMN IF EXISTS "cursos_adicionais"`);
  }
}
