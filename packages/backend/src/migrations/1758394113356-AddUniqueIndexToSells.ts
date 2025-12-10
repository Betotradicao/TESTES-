import { MigrationInterface, QueryRunner } from "typeorm";

export class AddUniqueIndexToSells1758394113356 implements MigrationInterface {

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Criar índice único para prevenir duplicações
        await queryRunner.query(`
            CREATE UNIQUE INDEX "IDX_sells_unique_sale"
            ON "sells" ("product_id", "product_weight", "num_cupom_fiscal")
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Remover índice único
        await queryRunner.query(`DROP INDEX "IDX_sells_unique_sale"`);
    }

}
