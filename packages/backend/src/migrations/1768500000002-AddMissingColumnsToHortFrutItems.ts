import { MigrationInterface, QueryRunner } from "typeorm";

export class AddMissingColumnsToHortFrutItems1768500000002 implements MigrationInterface {
    name = 'AddMissingColumnsToHortFrutItems1768500000002'

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Adicionar colunas que estavam faltando
        await queryRunner.query(`
            ALTER TABLE "hortfrut_conference_items"
            ADD COLUMN IF NOT EXISTS "product_type" varchar(10)
        `);

        await queryRunner.query(`
            ALTER TABLE "hortfrut_conference_items"
            ADD COLUMN IF NOT EXISTS "total_paid_value" decimal(10,2)
        `);

        await queryRunner.query(`
            ALTER TABLE "hortfrut_conference_items"
            ADD COLUMN IF NOT EXISTS "invoice_box_quantity" integer
        `);

        await queryRunner.query(`
            ALTER TABLE "hortfrut_conference_items"
            ADD COLUMN IF NOT EXISTS "invoice_status" varchar(20)
        `);

        await queryRunner.query(`
            ALTER TABLE "hortfrut_conference_items"
            ADD COLUMN IF NOT EXISTS "units_per_box" integer
        `);

        await queryRunner.query(`
            ALTER TABLE "hortfrut_conference_items"
            ADD COLUMN IF NOT EXISTS "total_units" integer
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "hortfrut_conference_items" DROP COLUMN IF EXISTS "total_units"`);
        await queryRunner.query(`ALTER TABLE "hortfrut_conference_items" DROP COLUMN IF EXISTS "units_per_box"`);
        await queryRunner.query(`ALTER TABLE "hortfrut_conference_items" DROP COLUMN IF EXISTS "invoice_status"`);
        await queryRunner.query(`ALTER TABLE "hortfrut_conference_items" DROP COLUMN IF EXISTS "invoice_box_quantity"`);
        await queryRunner.query(`ALTER TABLE "hortfrut_conference_items" DROP COLUMN IF EXISTS "total_paid_value"`);
        await queryRunner.query(`ALTER TABLE "hortfrut_conference_items" DROP COLUMN IF EXISTS "product_type"`);
    }
}
