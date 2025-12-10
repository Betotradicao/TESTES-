import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class AddPortNumberToEquipments1765300000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.addColumn(
      'equipments',
      new TableColumn({
        name: 'port_number',
        type: 'varchar',
        length: '50',
        isNullable: true,
      })
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropColumn('equipments', 'port_number');
  }
}
