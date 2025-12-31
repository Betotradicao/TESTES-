import { MigrationInterface, QueryRunner } from "typeorm";

export class AddIACharacteristicsToProducts1735566000000 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            ALTER TABLE "products"
            ADD COLUMN IF NOT EXISTS "foto_referencia" TEXT,
            ADD COLUMN IF NOT EXISTS "coloracao" VARCHAR(50),
            ADD COLUMN IF NOT EXISTS "formato" VARCHAR(50),
            ADD COLUMN IF NOT EXISTS "gordura_visivel" VARCHAR(50),
            ADD COLUMN IF NOT EXISTS "presenca_osso" BOOLEAN,
            ADD COLUMN IF NOT EXISTS "peso_min_kg" DECIMAL(10,3),
            ADD COLUMN IF NOT EXISTS "peso_max_kg" DECIMAL(10,3),
            ADD COLUMN IF NOT EXISTS "posicao_balcao" JSONB
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            ALTER TABLE "products"
            DROP COLUMN IF EXISTS "foto_referencia",
            DROP COLUMN IF EXISTS "coloracao",
            DROP COLUMN IF EXISTS "formato",
            DROP COLUMN IF EXISTS "gordura_visivel",
            DROP COLUMN IF EXISTS "presenca_osso",
            DROP COLUMN IF EXISTS "peso_min_kg",
            DROP COLUMN IF EXISTS "peso_max_kg",
            DROP COLUMN IF EXISTS "posicao_balcao"
        `);
    }
}
