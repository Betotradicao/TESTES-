import { MigrationInterface, QueryRunner } from "typeorm";

export class AddEquipmentIdToBips1759496345428 implements MigrationInterface {

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            ALTER TABLE "bips"
            ADD COLUMN "equipment_id" integer
        `);

        await queryRunner.query(`
            ALTER TABLE "bips"
            ADD CONSTRAINT "FK_bips_equipment_id"
            FOREIGN KEY ("equipment_id")
            REFERENCES "equipments"("id")
            ON DELETE SET NULL
        `);

        await queryRunner.query(`
            CREATE INDEX "IDX_bips_equipment_id" ON "bips" ("equipment_id")
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX IF EXISTS "IDX_bips_equipment_id"`);
        await queryRunner.query(`ALTER TABLE "bips" DROP CONSTRAINT IF EXISTS "FK_bips_equipment_id"`);
        await queryRunner.query(`ALTER TABLE "bips" DROP COLUMN IF EXISTS "equipment_id"`);
    }

}
