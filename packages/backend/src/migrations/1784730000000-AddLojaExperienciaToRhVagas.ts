import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddLojaExperienciaToRhVagas1784730000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE rh_vagas
        ADD COLUMN IF NOT EXISTS cod_loja INTEGER NULL,
        ADD COLUMN IF NOT EXISTS experiencia_obrigatoria BOOLEAN NOT NULL DEFAULT FALSE,
        ADD COLUMN IF NOT EXISTS experiencia_meses_minimo INTEGER NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE rh_vagas
        DROP COLUMN IF EXISTS cod_loja,
        DROP COLUMN IF EXISTS experiencia_obrigatoria,
        DROP COLUMN IF EXISTS experiencia_meses_minimo
    `);
  }
}
