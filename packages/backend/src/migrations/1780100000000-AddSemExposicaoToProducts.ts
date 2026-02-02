import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class AddSemExposicaoToProducts1780100000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Add sem_exposicao column to products table
    // Products marked as sem_exposicao are not displayed on shelves (internal products)
    await queryRunner.addColumn(
      'products',
      new TableColumn({
        name: 'sem_exposicao',
        type: 'boolean',
        isNullable: false,
        default: false,
      })
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropColumn('products', 'sem_exposicao');
  }
}
