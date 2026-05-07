import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddTurnosToRhVagas1784760000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE rh_vagas ADD COLUMN IF NOT EXISTS turnos JSONB NOT NULL DEFAULT '[]'::jsonb`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE rh_vagas DROP COLUMN IF EXISTS turnos`);
  }
}
