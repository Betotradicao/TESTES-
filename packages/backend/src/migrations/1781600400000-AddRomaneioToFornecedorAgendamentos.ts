import { MigrationInterface, QueryRunner } from "typeorm";

export class AddRomaneioToFornecedorAgendamentos1781600400000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "fornecedor_agendamentos"
      ADD COLUMN IF NOT EXISTS "romaneio" boolean DEFAULT false
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "fornecedor_agendamentos"
      DROP COLUMN IF EXISTS "romaneio"
    `);
  }
}
