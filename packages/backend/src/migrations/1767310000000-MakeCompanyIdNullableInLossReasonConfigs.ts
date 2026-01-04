import { MigrationInterface, QueryRunner } from 'typeorm';

export class MakeCompanyIdNullableInLossReasonConfigs1767310000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Remover índice único existente
    await queryRunner.query(`
      DROP INDEX IF EXISTS idx_loss_reason_configs_company_motivo
    `);

    // Remover foreign key existente
    await queryRunner.query(`
      ALTER TABLE "loss_reason_configs"
      DROP CONSTRAINT IF EXISTS "FK_loss_reason_configs_company_id"
    `);

    // Tornar company_id nullable
    await queryRunner.query(`
      ALTER TABLE "loss_reason_configs"
      ALTER COLUMN "company_id" DROP NOT NULL
    `);

    // Recriar foreign key como nullable
    await queryRunner.query(`
      ALTER TABLE "loss_reason_configs"
      ADD CONSTRAINT "FK_loss_reason_configs_company_id"
      FOREIGN KEY ("company_id")
      REFERENCES "companies"("id")
      ON DELETE CASCADE
    `);

    // Recriar índice único (agora company_id pode ser null)
    await queryRunner.query(`
      CREATE UNIQUE INDEX idx_loss_reason_configs_company_motivo
      ON loss_reason_configs (COALESCE(company_id, '00000000-0000-0000-0000-000000000000'::uuid), motivo)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Remover índice único
    await queryRunner.query(`
      DROP INDEX IF EXISTS idx_loss_reason_configs_company_motivo
    `);

    // Remover foreign key
    await queryRunner.query(`
      ALTER TABLE "loss_reason_configs"
      DROP CONSTRAINT IF EXISTS "FK_loss_reason_configs_company_id"
    `);

    // Voltar company_id para NOT NULL
    await queryRunner.query(`
      ALTER TABLE "loss_reason_configs"
      ALTER COLUMN "company_id" SET NOT NULL
    `);

    // Recriar foreign key
    await queryRunner.query(`
      ALTER TABLE "loss_reason_configs"
      ADD CONSTRAINT "FK_loss_reason_configs_company_id"
      FOREIGN KEY ("company_id")
      REFERENCES "companies"("id")
      ON DELETE CASCADE
    `);

    // Recriar índice único original
    await queryRunner.query(`
      CREATE UNIQUE INDEX idx_loss_reason_configs_company_motivo
      ON loss_reason_configs (company_id, motivo)
    `);
  }
}
