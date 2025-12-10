import { MigrationInterface, QueryRunner } from "typeorm";

export class AddNumCupomFiscalToSells1758161394993 implements MigrationInterface {

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            ALTER TABLE "sells"
            ADD COLUMN "num_cupom_fiscal" INTEGER NULL
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            ALTER TABLE "sells"
            DROP COLUMN "num_cupom_fiscal"
        `);
    }

}
