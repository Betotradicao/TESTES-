import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class AddGrupoSimilarToProducts1780200000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Add grupo_similar column to products table
    // Products with the same grupo_similar number are considered similar/substitutes
    await queryRunner.addColumn(
      'products',
      new TableColumn({
        name: 'grupo_similar',
        type: 'integer',
        isNullable: true,
        default: null,
      })
    );

    // Create index for faster lookups by grupo_similar
    await queryRunner.query(`
      CREATE INDEX "IDX_products_grupo_similar" ON "products" ("grupo_similar") WHERE "grupo_similar" IS NOT NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_products_grupo_similar"`);
    await queryRunner.dropColumn('products', 'grupo_similar');
  }
}
