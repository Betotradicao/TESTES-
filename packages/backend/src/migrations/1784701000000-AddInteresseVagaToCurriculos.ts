import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddInteresseVagaToCurriculos1784701000000 implements MigrationInterface {
  name = 'AddInteresseVagaToCurriculos1784701000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "curriculos"
      ADD COLUMN IF NOT EXISTS "interesse_vaga" VARCHAR(20) NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "curriculos" DROP COLUMN IF EXISTS "interesse_vaga"
    `);
  }
}
