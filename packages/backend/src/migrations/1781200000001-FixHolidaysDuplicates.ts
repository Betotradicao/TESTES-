import { MigrationInterface, QueryRunner } from "typeorm";

export class FixHolidaysDuplicates1781200000001 implements MigrationInterface {
    name = 'FixHolidaysDuplicates1781200000001'

    public async up(queryRunner: QueryRunner): Promise<void> {
        // 1. Remover Carnaval (é facultativo)
        await queryRunner.query(`DELETE FROM "holidays" WHERE "name" = 'Carnaval'`);

        // 2. Remover duplicatas - manter apenas o registro com menor ID por (name, cod_loja, type)
        await queryRunner.query(`
            DELETE FROM "holidays"
            WHERE "id" NOT IN (
                SELECT MIN("id") FROM "holidays" GROUP BY "name", "cod_loja", "type"
            )
        `);

        // 3. Setar year = NULL em todos (feriados são recorrentes)
        await queryRunner.query(`UPDATE "holidays" SET "year" = NULL`);

        // 4. Tornar year nullable
        await queryRunner.query(`ALTER TABLE "holidays" ALTER COLUMN "year" DROP NOT NULL`);

        // 5. Dropar índice único antigo (que inclui year)
        await queryRunner.query(`DROP INDEX IF EXISTS "idx_holidays_unique"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "idx_holidays_year"`);

        // 6. Criar novo índice único SEM year
        await queryRunner.query(`
            CREATE UNIQUE INDEX IF NOT EXISTS "idx_holidays_unique" ON "holidays" ("name", "cod_loja", "type")
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX IF EXISTS "idx_holidays_unique"`);
        await queryRunner.query(`
            CREATE UNIQUE INDEX IF NOT EXISTS "idx_holidays_unique" ON "holidays" ("date", "year", "cod_loja", "type", "name")
        `);
        await queryRunner.query(`
            CREATE INDEX IF NOT EXISTS "idx_holidays_year" ON "holidays" ("year")
        `);
    }
}
