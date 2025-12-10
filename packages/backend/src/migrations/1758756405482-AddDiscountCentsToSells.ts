import { MigrationInterface, QueryRunner } from "typeorm";

export class AddDiscountCentsToSells1758756405482 implements MigrationInterface {

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            ALTER TABLE "sells"
            ADD COLUMN "discount_cents" INTEGER DEFAULT 0
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            ALTER TABLE "sells"
            DROP COLUMN "discount_cents"
        `);
    }

}
