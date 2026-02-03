import { MigrationInterface, QueryRunner } from "typeorm";

export class AddCodLojaToAllEntities1780400000000 implements MigrationInterface {
    name = 'AddCodLojaToAllEntities1780400000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Adicionar cod_loja em losses
        await queryRunner.query(`ALTER TABLE "losses" ADD "cod_loja" integer`);

        // Adicionar cod_loja em rupture_surveys
        await queryRunner.query(`ALTER TABLE "rupture_surveys" ADD "cod_loja" integer`);

        // Adicionar cod_loja em label_audits
        await queryRunner.query(`ALTER TABLE "label_audits" ADD "cod_loja" integer`);

        // Adicionar cod_loja em hortfrut_conferences
        await queryRunner.query(`ALTER TABLE "hortfrut_conferences" ADD "cod_loja" integer`);

        // Adicionar cod_loja em production_audits
        await queryRunner.query(`ALTER TABLE "production_audits" ADD "cod_loja" integer`);

        // Adicionar cod_loja em bips
        await queryRunner.query(`ALTER TABLE "bips" ADD "cod_loja" integer`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "bips" DROP COLUMN "cod_loja"`);
        await queryRunner.query(`ALTER TABLE "production_audits" DROP COLUMN "cod_loja"`);
        await queryRunner.query(`ALTER TABLE "hortfrut_conferences" DROP COLUMN "cod_loja"`);
        await queryRunner.query(`ALTER TABLE "label_audits" DROP COLUMN "cod_loja"`);
        await queryRunner.query(`ALTER TABLE "rupture_surveys" DROP COLUMN "cod_loja"`);
        await queryRunner.query(`ALTER TABLE "losses" DROP COLUMN "cod_loja"`);
    }
}
