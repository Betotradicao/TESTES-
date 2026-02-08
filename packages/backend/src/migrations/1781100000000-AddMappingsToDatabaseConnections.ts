import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddMappingsToDatabaseConnections1781100000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    const hasColumn = await queryRunner.query(`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = 'database_connections' AND column_name = 'mappings'
    `);

    if (hasColumn.length === 0) {
      await queryRunner.query(`ALTER TABLE "database_connections" ADD COLUMN "mappings" text`);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "database_connections" DROP COLUMN IF EXISTS "mappings"`);
  }
}
