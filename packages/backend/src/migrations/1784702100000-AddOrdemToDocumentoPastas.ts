import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddOrdemToDocumentoPastas1784702100000 implements MigrationInterface {
  name = 'AddOrdemToDocumentoPastas1784702100000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "rh_documento_pastas" ADD COLUMN IF NOT EXISTS "ordem" INT DEFAULT 0`);
    await queryRunner.query(`UPDATE "rh_documento_pastas" SET "ordem" = "id" WHERE "ordem" = 0`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "rh_documento_pastas" DROP COLUMN IF EXISTS "ordem"`);
  }
}
