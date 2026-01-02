import { MigrationInterface, QueryRunner } from 'typeorm';

export class RenameParciallToRupturaEstoque1735710000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // PASSO 1: Renomear enum antigo
    await queryRunner.query(`
      ALTER TYPE rupture_survey_items_status_verificacao_enum
      RENAME TO rupture_survey_items_status_verificacao_enum_old
    `);

    // PASSO 2: Criar novo enum com ambos os valores (parcial E ruptura_estoque)
    await queryRunner.query(`
      CREATE TYPE rupture_survey_items_status_verificacao_enum AS ENUM(
        'pendente',
        'encontrado',
        'nao_encontrado',
        'parcial',
        'ruptura_estoque'
      )
    `);

    // PASSO 3: Alterar coluna para usar novo enum
    await queryRunner.query(`
      ALTER TABLE rupture_survey_items
      ALTER COLUMN status_verificacao TYPE rupture_survey_items_status_verificacao_enum
      USING status_verificacao::text::rupture_survey_items_status_verificacao_enum
    `);

    // PASSO 4: Dropar enum antigo
    await queryRunner.query(`
      DROP TYPE rupture_survey_items_status_verificacao_enum_old
    `);

    // PASSO 5: Atualizar registros existentes de 'parcial' para 'ruptura_estoque'
    await queryRunner.query(`
      UPDATE rupture_survey_items
      SET status_verificacao = 'ruptura_estoque'
      WHERE status_verificacao = 'parcial'
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Reverter: ruptura_estoque -> parcial
    await queryRunner.query(`
      UPDATE rupture_survey_items
      SET status_verificacao = 'parcial'
      WHERE status_verificacao = 'ruptura_estoque'
    `);

    await queryRunner.query(`
      ALTER TYPE rupture_survey_items_status_verificacao_enum
      RENAME TO rupture_survey_items_status_verificacao_enum_old
    `);

    await queryRunner.query(`
      CREATE TYPE rupture_survey_items_status_verificacao_enum AS ENUM(
        'pendente',
        'encontrado',
        'nao_encontrado',
        'parcial'
      )
    `);

    await queryRunner.query(`
      ALTER TABLE rupture_survey_items
      ALTER COLUMN status_verificacao TYPE rupture_survey_items_status_verificacao_enum
      USING status_verificacao::text::rupture_survey_items_status_verificacao_enum
    `);

    await queryRunner.query(`
      DROP TYPE rupture_survey_items_status_verificacao_enum_old
    `);
  }
}
