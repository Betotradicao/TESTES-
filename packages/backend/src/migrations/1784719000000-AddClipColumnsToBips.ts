import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Adiciona colunas para pre-geracao automatica de clipes DVR.
 * Bipagens pendentes >3h tem clipe gerado em background e armazenado.
 * Retencao de 2 dias com limpeza diaria. Apos isso, fallback live-stream.
 *
 * - clip_files: JSONB com lista [{channel, filename}] (multi-camera por bipagem)
 * - clip_status: 'ready' | 'pending_retry' | 'failed' | NULL
 * - clip_retry_count: contagem para abortar apos N tentativas
 * - clip_generated_at: timestamp para apagar arquivos > 2 dias
 */
export class AddClipColumnsToBips1784719000000 implements MigrationInterface {
  name = 'AddClipColumnsToBips1784719000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE bips
        ADD COLUMN IF NOT EXISTS clip_files JSONB,
        ADD COLUMN IF NOT EXISTS clip_status VARCHAR(30),
        ADD COLUMN IF NOT EXISTS clip_retry_count INT DEFAULT 0 NOT NULL,
        ADD COLUMN IF NOT EXISTS clip_generated_at TIMESTAMP
    `);
    // Indice parcial para o cron achar rapido as bipagens elegiveis
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_bips_clip_pending
        ON bips (event_date)
        WHERE status = 'pending' AND clip_status IS NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS idx_bips_clip_pending`);
    await queryRunner.query(`
      ALTER TABLE bips
        DROP COLUMN IF EXISTS clip_files,
        DROP COLUMN IF EXISTS clip_status,
        DROP COLUMN IF EXISTS clip_retry_count,
        DROP COLUMN IF EXISTS clip_generated_at
    `);
  }
}
