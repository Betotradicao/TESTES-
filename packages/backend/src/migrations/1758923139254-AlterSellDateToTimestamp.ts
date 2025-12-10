import { MigrationInterface, QueryRunner } from "typeorm";

export class AlterSellDateToTimestamp1758923139254 implements MigrationInterface {

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Alterar o tipo da coluna sell_date de DATE para TIMESTAMP
        await queryRunner.query(`
            ALTER TABLE "sells"
            ALTER COLUMN "sell_date" TYPE TIMESTAMP
            USING "sell_date"::timestamp
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Reverter para DATE
        await queryRunner.query(`
            ALTER TABLE "sells"
            ALTER COLUMN "sell_date" TYPE DATE
            USING "sell_date"::date
        `);
    }

}
