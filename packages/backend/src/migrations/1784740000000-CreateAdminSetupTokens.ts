import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateAdminSetupTokens1784740000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS admin_setup_tokens (
        token UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        created_by_user_id UUID NULL REFERENCES users(id) ON DELETE SET NULL,
        expires_at TIMESTAMP NOT NULL,
        used_at TIMESTAMP NULL,
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_admin_setup_tokens_user_id ON admin_setup_tokens(user_id)`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_admin_setup_tokens_expires_at ON admin_setup_tokens(expires_at)`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS admin_setup_tokens`);
  }
}
