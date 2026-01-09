import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class AddPesoMedioKgToProducts1767900000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Add peso_medio_kg column to products table
    await queryRunner.addColumn(
      'products',
      new TableColumn({
        name: 'peso_medio_kg',
        type: 'decimal',
        precision: 10,
        scale: 3,
        isNullable: true,
      })
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Remove peso_medio_kg column from products table
    await queryRunner.dropColumn('products', 'peso_medio_kg');
  }
}
