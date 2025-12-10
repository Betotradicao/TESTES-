import { MigrationInterface, QueryRunner } from "typeorm";

export class AddPointOfSaleCodeToSells1759496400000 implements MigrationInterface {

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            ALTER TABLE "sells"
            ADD COLUMN "point_of_sale_code" INTEGER NULL
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            ALTER TABLE "sells"
            DROP COLUMN "point_of_sale_code"
        `);
    }

}
