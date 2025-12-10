import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateSectorsTable1759200000000 implements MigrationInterface {

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            CREATE TABLE IF NOT EXISTS "sectors" (
                "id" SERIAL PRIMARY KEY,
                "name" varchar(255) NOT NULL,
                "color_hash" varchar(7) NOT NULL DEFAULT '#000000',
                "active" boolean NOT NULL DEFAULT true,
                "created_at" TIMESTAMP NOT NULL DEFAULT now(),
                "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
                CONSTRAINT "UQ_sectors_name" UNIQUE ("name")
            )
        `);

        await queryRunner.query(`
            CREATE INDEX "IDX_sectors_active" ON "sectors" ("active")
        `);

        await queryRunner.query(`
            CREATE INDEX "IDX_sectors_name" ON "sectors" ("name")
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX IF EXISTS "IDX_sectors_name"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "IDX_sectors_active"`);
        await queryRunner.query(`DROP TABLE IF EXISTS "sectors"`);
    }

}
