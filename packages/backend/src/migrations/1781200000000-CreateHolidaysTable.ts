import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateHolidaysTable1781200000000 implements MigrationInterface {
    name = 'CreateHolidaysTable1781200000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            CREATE TABLE IF NOT EXISTS "holidays" (
                "id" SERIAL PRIMARY KEY,
                "name" varchar(255) NOT NULL,
                "date" varchar(5) NOT NULL,
                "year" int,
                "type" varchar(20) NOT NULL DEFAULT 'national',
                "cod_loja" int,
                "active" boolean DEFAULT true,
                "created_at" TIMESTAMP DEFAULT now(),
                "updated_at" TIMESTAMP DEFAULT now()
            )
        `);

        await queryRunner.query(`
            CREATE INDEX IF NOT EXISTS "idx_holidays_cod_loja" ON "holidays" ("cod_loja")
        `);

        await queryRunner.query(`
            CREATE UNIQUE INDEX IF NOT EXISTS "idx_holidays_unique" ON "holidays" ("name", "cod_loja", "type")
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX IF EXISTS "idx_holidays_unique"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "idx_holidays_cod_loja"`);
        await queryRunner.query(`DROP TABLE IF EXISTS "holidays"`);
    }
}
