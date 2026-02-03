import { MigrationInterface, QueryRunner } from "typeorm";

export class AddCodLojaToEmployees1780300000000 implements MigrationInterface {
    name = 'AddCodLojaToEmployees1780300000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "employees" ADD "cod_loja" integer`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "employees" DROP COLUMN "cod_loja"`);
    }
}
