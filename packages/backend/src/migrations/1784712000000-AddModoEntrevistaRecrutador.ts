import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Adiciona modo de entrevista (texto/voz/video) na tabela de entrevistas.
 * Modo padrao: 'texto' (compatibilidade com entrevistas existentes).
 */
export class AddModoEntrevistaRecrutador1784712000000 implements MigrationInterface {
  name = 'AddModoEntrevistaRecrutador1784712000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE rh_recrutador_entrevistas
      ADD COLUMN IF NOT EXISTS modo_entrevista VARCHAR(20) DEFAULT 'texto'
    `);
    await queryRunner.query(`
      ALTER TABLE rh_recrutador_entrevistas
      ADD COLUMN IF NOT EXISTS video_url TEXT NULL
    `);
    await queryRunner.query(`
      ALTER TABLE rh_recrutador_entrevistas
      ADD COLUMN IF NOT EXISTS audio_url TEXT NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE rh_recrutador_entrevistas DROP COLUMN IF EXISTS modo_entrevista`);
    await queryRunner.query(`ALTER TABLE rh_recrutador_entrevistas DROP COLUMN IF EXISTS video_url`);
    await queryRunner.query(`ALTER TABLE rh_recrutador_entrevistas DROP COLUMN IF EXISTS audio_url`);
  }
}
