import { MigrationInterface, QueryRunner, TableColumn, TableForeignKey } from 'typeorm';

export class AddEmployeeIdToProductionAudits1736786400000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Tornar user_id nullable
    await queryRunner.changeColumn(
      'production_audits',
      'user_id',
      new TableColumn({
        name: 'user_id',
        type: 'uuid',
        isNullable: true,
      })
    );

    // Adicionar coluna employee_id
    await queryRunner.addColumn(
      'production_audits',
      new TableColumn({
        name: 'employee_id',
        type: 'uuid',
        isNullable: true,
      })
    );

    // Adicionar foreign key para employee_id
    await queryRunner.createForeignKey(
      'production_audits',
      new TableForeignKey({
        columnNames: ['employee_id'],
        referencedColumnNames: ['id'],
        referencedTableName: 'employees',
        onDelete: 'CASCADE',
      })
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Remover foreign key
    const table = await queryRunner.getTable('production_audits');
    const foreignKey = table?.foreignKeys.find(
      (fk) => fk.columnNames.indexOf('employee_id') !== -1
    );
    if (foreignKey) {
      await queryRunner.dropForeignKey('production_audits', foreignKey);
    }

    // Remover coluna employee_id
    await queryRunner.dropColumn('production_audits', 'employee_id');

    // Tornar user_id NOT NULL novamente
    await queryRunner.changeColumn(
      'production_audits',
      'user_id',
      new TableColumn({
        name: 'user_id',
        type: 'uuid',
        isNullable: false,
      })
    );
  }
}
