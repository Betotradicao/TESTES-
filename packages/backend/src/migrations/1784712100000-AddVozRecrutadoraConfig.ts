import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Adiciona campo `voz_recrutadora` na config — guarda o NOME da voz (Web Speech API)
 * que a recrutadora usa nas entrevistas modo voz.
 */
export class AddVozRecrutadoraConfig1784712100000 implements MigrationInterface {
  name = 'AddVozRecrutadoraConfig1784712100000';
  public async up(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE rh_recrutador_config ADD COLUMN IF NOT EXISTS voz_recrutadora VARCHAR(150) NULL`);
    await q.query(`ALTER TABLE rh_recrutador_config ADD COLUMN IF NOT EXISTS voz_genero VARCHAR(20) NULL`);
  }
  public async down(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE rh_recrutador_config DROP COLUMN IF EXISTS voz_recrutadora`);
    await q.query(`ALTER TABLE rh_recrutador_config DROP COLUMN IF EXISTS voz_genero`);
  }
}
