import { MigrationInterface, QueryRunner } from 'typeorm';

export class FixRuptureItemsDecimalColumns1766200000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Alterar cobertura_dias de int para decimal
    await queryRunner.query(`
      ALTER TABLE rupture_survey_items
      ALTER COLUMN cobertura_dias TYPE DECIMAL(10,2)
    `);

    // Alterar qtd_embalagem de int para decimal
    await queryRunner.query(`
      ALTER TABLE rupture_survey_items
      ALTER COLUMN qtd_embalagem TYPE DECIMAL(10,2)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE rupture_survey_items
      ALTER COLUMN cobertura_dias TYPE INT
    `);

    await queryRunner.query(`
      ALTER TABLE rupture_survey_items
      ALTER COLUMN qtd_embalagem TYPE INT
    `);
  }
}
