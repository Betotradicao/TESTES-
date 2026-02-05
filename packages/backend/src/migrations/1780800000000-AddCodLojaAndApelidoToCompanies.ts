import { MigrationInterface, QueryRunner } from "typeorm";

export class AddCodLojaAndApelidoToCompanies1780800000000 implements MigrationInterface {
    name = 'AddCodLojaAndApelidoToCompanies1780800000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Adicionar cod_loja em companies (número da loja: 1, 2, 3... até 20)
        console.log('📦 Adicionando coluna cod_loja na tabela companies...');
        await queryRunner.query(`ALTER TABLE "companies" ADD COLUMN IF NOT EXISTS "cod_loja" integer`);

        // Adicionar apelido em companies (ex: "Porteirão", "Silveiras")
        console.log('📦 Adicionando coluna apelido na tabela companies...');
        await queryRunner.query(`ALTER TABLE "companies" ADD COLUMN IF NOT EXISTS "apelido" varchar(255)`);

        // Atualizar a primeira empresa como Loja 1 se não tiver cod_loja
        console.log('📦 Definindo cod_loja = 1 para a primeira empresa...');
        await queryRunner.query(`
            UPDATE "companies"
            SET "cod_loja" = 1
            WHERE "cod_loja" IS NULL
            AND "id" = (SELECT "id" FROM "companies" ORDER BY "created_at" ASC LIMIT 1)
        `);

        console.log('✅ Colunas cod_loja e apelido adicionadas com sucesso');
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "companies" DROP COLUMN IF EXISTS "cod_loja"`);
        await queryRunner.query(`ALTER TABLE "companies" DROP COLUMN IF EXISTS "apelido"`);
    }
}
