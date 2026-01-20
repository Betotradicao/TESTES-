import { MigrationInterface, QueryRunner } from "typeorm";

export class AddSupplierToHortFrutItems1768500000001 implements MigrationInterface {
    name = 'AddSupplierToHortFrutItems1768500000001'

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Adicionar coluna supplier_id na tabela hortfrut_conference_items
        await queryRunner.query(`
            ALTER TABLE "hortfrut_conference_items"
            ADD COLUMN IF NOT EXISTS "supplier_id" integer
        `);

        // Criar índice para supplier_id
        await queryRunner.query(`
            CREATE INDEX IF NOT EXISTS "idx_hortfrut_items_supplier"
            ON "hortfrut_conference_items" ("supplier_id")
        `);

        // Adicionar foreign key para suppliers (opcional, não obrigatório)
        await queryRunner.query(`
            ALTER TABLE "hortfrut_conference_items"
            ADD CONSTRAINT "fk_hortfrut_items_supplier"
            FOREIGN KEY ("supplier_id") REFERENCES "suppliers"("id")
            ON DELETE SET NULL
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            ALTER TABLE "hortfrut_conference_items"
            DROP CONSTRAINT IF EXISTS "fk_hortfrut_items_supplier"
        `);
        await queryRunner.query(`DROP INDEX IF EXISTS "idx_hortfrut_items_supplier"`);
        await queryRunner.query(`
            ALTER TABLE "hortfrut_conference_items"
            DROP COLUMN IF EXISTS "supplier_id"
        `);
    }
}
