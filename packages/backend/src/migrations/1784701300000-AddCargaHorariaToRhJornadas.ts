import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddCargaHorariaToRhJornadas1784701300000 implements MigrationInterface {
  name = 'AddCargaHorariaToRhJornadas1784701300000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "rh_jornadas"
      ADD COLUMN IF NOT EXISTS "carga_horaria" VARCHAR(10) NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "rh_jornadas" DROP COLUMN IF EXISTS "carga_horaria"`);
  }
}
