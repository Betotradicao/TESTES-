import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class AddProductionDaysToProducts1768100000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Add production_days column to products table
    await queryRunner.addColumn(
      'products',
      new TableColumn({
        name: 'production_days',
        type: 'integer',
        isNullable: true,
        default: 1,
      })
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Remove production_days column from products table
    await queryRunner.dropColumn('products', 'production_days');
  }
}
