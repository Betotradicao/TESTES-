import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddEscalaToRhColaboradores1784701400000 implements MigrationInterface {
  name = 'AddEscalaToRhColaboradores1784701400000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "rh_colaboradores"
      ADD COLUMN IF NOT EXISTS "escala_id" INT NULL REFERENCES "rh_escalas"(id)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "rh_colaboradores" DROP COLUMN IF EXISTS "escala_id"`);
  }
}
