import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddCodLojaToSectorsAndHortFrutBoxes1780900000000 implements MigrationInterface {
  name = 'AddCodLojaToSectorsAndHortFrutBoxes1780900000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Adicionar cod_loja à tabela sectors
    await queryRunner.query(`
      ALTER TABLE "sectors" ADD COLUMN IF NOT EXISTS "cod_loja" integer
    `);

    // Adicionar cod_loja à tabela hortfrut_boxes
    await queryRunner.query(`
      ALTER TABLE "hortfrut_boxes" ADD COLUMN IF NOT EXISTS "cod_loja" integer
    `);

    // Adicionar cod_loja à tabela suppliers
    await queryRunner.query(`
      ALTER TABLE "suppliers" ADD COLUMN IF NOT EXISTS "cod_loja" integer
    `);

    // Remover constraint unique do name em sectors (se existir)
    // Permitir mesmo nome de setor em lojas diferentes
    await queryRunner.query(`
      DO $$
      BEGIN
        -- Tentar remover constraint unique do name
        ALTER TABLE "sectors" DROP CONSTRAINT IF EXISTS "UQ_sectors_name";
        ALTER TABLE "sectors" DROP CONSTRAINT IF EXISTS "sectors_name_key";
      EXCEPTION WHEN OTHERS THEN
        -- Ignorar se não existir
        NULL;
      END $$;
    `);

    // Remover índice único se existir
    await queryRunner.query(`
      DROP INDEX IF EXISTS "UQ_sectors_name";
      DROP INDEX IF EXISTS "sectors_name_key";
    `);

    // Criar índice único composto (name + cod_loja)
    // Isso permite mesmo nome em lojas diferentes
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "UQ_sectors_name_cod_loja"
      ON "sectors" ("name", COALESCE("cod_loja", 0))
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Remover índice composto
    await queryRunner.query(`DROP INDEX IF EXISTS "UQ_sectors_name_cod_loja"`);

    // Remover colunas
    await queryRunner.query(`ALTER TABLE "suppliers" DROP COLUMN IF EXISTS "cod_loja"`);
    await queryRunner.query(`ALTER TABLE "hortfrut_boxes" DROP COLUMN IF EXISTS "cod_loja"`);
    await queryRunner.query(`ALTER TABLE "sectors" DROP COLUMN IF EXISTS "cod_loja"`);
  }
}
