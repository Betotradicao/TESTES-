import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateBankTransfersTable1782000000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "bank_transfers" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "source_account_id" uuid NOT NULL REFERENCES "bank_accounts"("id"),
        "target_account_id" uuid NOT NULL REFERENCES "bank_accounts"("id"),
        "amount" decimal(15,2) NOT NULL,
        "date" date NOT NULL,
        "description" varchar(500),
        "created_at" TIMESTAMP DEFAULT now()
      )
    `);

    await queryRunner.query(`
      CREATE INDEX "idx_bank_transfers_source" ON "bank_transfers" ("source_account_id", "date")
    `);
    await queryRunner.query(`
      CREATE INDEX "idx_bank_transfers_target" ON "bank_transfers" ("target_account_id", "date")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "bank_transfers"`);
  }
}
