import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateEquipmentsTable1759493626143 implements MigrationInterface {

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            CREATE TABLE IF NOT EXISTS "equipments" (
                "id" SERIAL PRIMARY KEY,
                "color_hash" varchar(7) NOT NULL DEFAULT '#000000',
                "scanner_machine_id" varchar(255) NOT NULL,
                "machine_id" varchar(255) NOT NULL,
                "description" text,
                "sector_id" integer,
                "active" boolean NOT NULL DEFAULT true,
                "created_at" TIMESTAMP NOT NULL DEFAULT now(),
                "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
                CONSTRAINT "UQ_equipments_scanner_machine_id" UNIQUE ("scanner_machine_id"),
                CONSTRAINT "FK_equipments_sector_id" FOREIGN KEY ("sector_id") REFERENCES "sectors"("id") ON DELETE SET NULL
            )
        `);

        await queryRunner.query(`
            CREATE INDEX "IDX_equipments_scanner_machine_id" ON "equipments" ("scanner_machine_id")
        `);

        await queryRunner.query(`
            CREATE INDEX "IDX_equipments_machine_id" ON "equipments" ("machine_id")
        `);

        await queryRunner.query(`
            CREATE INDEX "IDX_equipments_sector_id" ON "equipments" ("sector_id")
        `);

        await queryRunner.query(`
            CREATE INDEX "IDX_equipments_active" ON "equipments" ("active")
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX IF EXISTS "IDX_equipments_active"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "IDX_equipments_sector_id"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "IDX_equipments_machine_id"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "IDX_equipments_scanner_machine_id"`);
        await queryRunner.query(`DROP TABLE IF EXISTS "equipments"`);
    }

}
