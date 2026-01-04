import { MigrationInterface, QueryRunner } from 'typeorm';

export class MakeCompanyIdNullableInLosses1767300000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Remover foreign key existente
    await queryRunner.query(`
      ALTER TABLE "losses"
      DROP CONSTRAINT IF EXISTS "FK_losses_company_id"
    `);

    // Tornar company_id nullable
    await queryRunner.query(`
      ALTER TABLE "losses"
      ALTER COLUMN "company_id" DROP NOT NULL
    `);

    // Recriar foreign key como nullable
    await queryRunner.query(`
      ALTER TABLE "losses"
      ADD CONSTRAINT "FK_losses_company_id"
      FOREIGN KEY ("company_id")
      REFERENCES "companies"("id")
      ON DELETE CASCADE
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Remover foreign key
    await queryRunner.query(`
      ALTER TABLE "losses"
      DROP CONSTRAINT IF EXISTS "FK_losses_company_id"
    `);

    // Voltar company_id para NOT NULL
    await queryRunner.query(`
      ALTER TABLE "losses"
      ALTER COLUMN "company_id" SET NOT NULL
    `);

    // Recriar foreign key
    await queryRunner.query(`
      ALTER TABLE "losses"
      ADD CONSTRAINT "FK_losses_company_id"
      FOREIGN KEY ("company_id")
      REFERENCES "companies"("id")
      ON DELETE CASCADE
    `);
  }
}
