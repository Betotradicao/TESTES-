import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Permite escolher voz POR ENTREVISTA (alem da voz global da config).
 * Se a entrevista tiver voz_recrutadora setada, usa ela. Senao, usa da config.
 */
export class AddVozNaEntrevista1784712200000 implements MigrationInterface {
  name = 'AddVozNaEntrevista1784712200000';
  public async up(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE rh_recrutador_entrevistas ADD COLUMN IF NOT EXISTS voz_recrutadora VARCHAR(150) NULL`);
  }
  public async down(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE rh_recrutador_entrevistas DROP COLUMN IF EXISTS voz_recrutadora`);
  }
}
