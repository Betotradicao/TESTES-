import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Adiciona suporte a 3 provedores de TTS na recrutadora:
 * - 'web_speech' (gratis, navegador) — default
 * - 'openai' (TTS-1-HD, ~R$0,40/entrevista, ultra realista)
 * - 'elevenlabs' (gold standard, custo variavel)
 *
 * voz_recrutadora ja existe em ambas tabelas; aqui adicionamos provedor_tts
 * pra saber QUAL servico usar.
 */
export class AddProvedorTtsRecrutador1784712300000 implements MigrationInterface {
  name = 'AddProvedorTtsRecrutador1784712300000';
  public async up(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE rh_recrutador_config ADD COLUMN IF NOT EXISTS provedor_tts VARCHAR(30) DEFAULT 'web_speech'`);
    await q.query(`ALTER TABLE rh_recrutador_entrevistas ADD COLUMN IF NOT EXISTS provedor_tts VARCHAR(30) NULL`);
  }
  public async down(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE rh_recrutador_config DROP COLUMN IF EXISTS provedor_tts`);
    await q.query(`ALTER TABLE rh_recrutador_entrevistas DROP COLUMN IF EXISTS provedor_tts`);
  }
}
