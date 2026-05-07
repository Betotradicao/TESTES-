import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddVagasInteresseToCurriculos1784770000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE curriculos ADD COLUMN IF NOT EXISTS vagas_interesse_ids JSONB NOT NULL DEFAULT '[]'::jsonb`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE curriculos DROP COLUMN IF EXISTS vagas_interesse_ids`);
  }
}
