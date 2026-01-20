import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateSuppliersTable1768500000000 implements MigrationInterface {
    name = 'CreateSuppliersTable1768500000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Criar tabela de fornecedores
        await queryRunner.query(`
            CREATE TABLE IF NOT EXISTS "suppliers" (
                "id" SERIAL PRIMARY KEY,
                "company_id" uuid NOT NULL,
                "fantasy_name" varchar(255) NOT NULL,
                "legal_name" varchar(255),
                "cnpj" varchar(18),
                "phone" varchar(20),
                "email" varchar(255),
                "address" text,
                "observations" text,
                "active" boolean DEFAULT true,
                "created_at" TIMESTAMP DEFAULT now(),
                "updated_at" TIMESTAMP DEFAULT now()
            )
        `);

        // Criar indices
        await queryRunner.query(`
            CREATE INDEX IF NOT EXISTS "idx_suppliers_company" ON "suppliers" ("company_id")
        `);

        await queryRunner.query(`
            CREATE INDEX IF NOT EXISTS "idx_suppliers_fantasy_name" ON "suppliers" ("fantasy_name")
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX IF EXISTS "idx_suppliers_fantasy_name"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "idx_suppliers_company"`);
        await queryRunner.query(`DROP TABLE IF EXISTS "suppliers"`);
    }
}
