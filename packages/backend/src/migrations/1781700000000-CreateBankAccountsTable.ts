import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateBankAccountsTable1781700000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "bank_accounts" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "nome" varchar(255) NOT NULL,
        "tipo_banco" varchar(50) NOT NULL DEFAULT 'santander',
        "cnpj" varchar(20),
        "agencia" varchar(20),
        "conta" varchar(30),
        "client_id" text,
        "client_secret" text,
        "pfx_password" text,
        "certificate_path" varchar(500),
        "environment" varchar(20) NOT NULL DEFAULT 'production',
        "ativo" boolean NOT NULL DEFAULT true,
        "created_at" TIMESTAMP DEFAULT now(),
        "updated_at" TIMESTAMP DEFAULT now()
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "bank_accounts"`);
  }
}
