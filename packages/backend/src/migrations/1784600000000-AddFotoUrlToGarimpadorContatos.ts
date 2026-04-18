import { MigrationInterface, QueryRunner } from "typeorm";

export class AddFotoUrlToGarimpadorContatos1784600000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    const table = await queryRunner.hasTable('garimpador_contatos');
    if (!table) return;
    const hasFotoUrl = await queryRunner.hasColumn('garimpador_contatos', 'foto_url');
    if (!hasFotoUrl) {
      await queryRunner.query(`ALTER TABLE "garimpador_contatos" ADD COLUMN "foto_url" TEXT`);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "garimpador_contatos" DROP COLUMN IF EXISTS "foto_url"`);
  }
}
