import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddRequisitosToRhCargos1784750000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE rh_cargos ADD COLUMN IF NOT EXISTS requisitos TEXT NULL`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE rh_cargos DROP COLUMN IF EXISTS requisitos`);
  }
}
