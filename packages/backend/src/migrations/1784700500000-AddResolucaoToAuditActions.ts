import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddResolucaoToAuditActions1784700500000 implements MigrationInterface {
  name = 'AddResolucaoToAuditActions1784700500000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "audit_actions"
      ADD COLUMN IF NOT EXISTS "resolucao_token" VARCHAR(64) NULL UNIQUE,
      ADD COLUMN IF NOT EXISTS "resolucao_historico" JSONB NOT NULL DEFAULT '[]'::jsonb,
      ADD COLUMN IF NOT EXISTS "origem" VARCHAR(30) NOT NULL DEFAULT 'manual',
      ADD COLUMN IF NOT EXISTS "whatsapp_group_id" VARCHAR(255) NULL,
      ADD COLUMN IF NOT EXISTS "whatsapp_group_name" VARCHAR(255) NULL,
      ADD COLUMN IF NOT EXISTS "whatsapp_sent_at" TIMESTAMP NULL,
      ADD COLUMN IF NOT EXISTS "question_id" INTEGER NULL
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_audit_actions_token" ON "audit_actions" ("resolucao_token")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_audit_actions_token"`);
    await queryRunner.query(`
      ALTER TABLE "audit_actions"
      DROP COLUMN IF EXISTS "resolucao_token",
      DROP COLUMN IF EXISTS "resolucao_historico",
      DROP COLUMN IF EXISTS "origem",
      DROP COLUMN IF EXISTS "whatsapp_group_id",
      DROP COLUMN IF EXISTS "whatsapp_group_name",
      DROP COLUMN IF EXISTS "whatsapp_sent_at",
      DROP COLUMN IF EXISTS "question_id"
    `);
  }
}
