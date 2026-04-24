import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddDepartamentoToRhColaboradores1784701900000 implements MigrationInterface {
  name = 'AddDepartamentoToRhColaboradores1784701900000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "rh_colaboradores"
      ADD COLUMN IF NOT EXISTS "departamento_id" INT NULL REFERENCES "rh_departamentos"(id) ON DELETE SET NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "rh_colaboradores" DROP COLUMN IF EXISTS "departamento_id"`);
  }
}
