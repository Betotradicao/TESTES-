import { MigrationInterface, QueryRunner, TableColumn, TableForeignKey } from 'typeorm';

export class AddEmployeeIdToBips1759700000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Add employee_id column
    await queryRunner.addColumn(
      'bips',
      new TableColumn({
        name: 'employee_id',
        type: 'uuid',
        isNullable: true,
      })
    );

    // Add foreign key to employees table
    await queryRunner.createForeignKey(
      'bips',
      new TableForeignKey({
        columnNames: ['employee_id'],
        referencedColumnNames: ['id'],
        referencedTableName: 'employees',
        onDelete: 'SET NULL', // Se colaborador for deletado, manter bipagem mas sem referência
      })
    );

    // Add index for performance when querying by employee
    await queryRunner.query(
      `CREATE INDEX idx_bips_employee_id ON bips (employee_id)`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop index
    await queryRunner.query(`DROP INDEX IF EXISTS idx_bips_employee_id`);

    // Drop foreign key
    const table = await queryRunner.getTable('bips');
    const foreignKey = table?.foreignKeys.find(
      fk => fk.columnNames.indexOf('employee_id') !== -1
    );
    if (foreignKey) {
      await queryRunner.dropForeignKey('bips', foreignKey);
    }

    // Drop column
    await queryRunner.dropColumn('bips', 'employee_id');
  }
}
