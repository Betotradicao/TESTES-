import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class AddOperatorToSells1780600000000 implements MigrationInterface {
  name = 'AddOperatorToSells1780600000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Adicionar coluna operator_code
    await queryRunner.addColumn(
      'sells',
      new TableColumn({
        name: 'operator_code',
        type: 'integer',
        isNullable: true,
      })
    );

    // Adicionar coluna operator_name
    await queryRunner.addColumn(
      'sells',
      new TableColumn({
        name: 'operator_name',
        type: 'varchar',
        length: '100',
        isNullable: true,
      })
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropColumn('sells', 'operator_name');
    await queryRunner.dropColumn('sells', 'operator_code');
  }
}
