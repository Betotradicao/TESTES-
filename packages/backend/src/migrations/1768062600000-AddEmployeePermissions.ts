import { MigrationInterface, QueryRunner, Table, TableIndex, TableForeignKey } from 'typeorm';

export class AddEmployeePermissions1768062600000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Criar tabela employee_permissions
    await queryRunner.createTable(
      new Table({
        name: 'employee_permissions',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: 'uuid_generate_v4()',
          },
          {
            name: 'employee_id',
            type: 'uuid',
          },
          {
            name: 'module_id',
            type: 'varchar',
            length: '50',
          },
          {
            name: 'submenu_id',
            type: 'varchar',
            length: '50',
            isNullable: true,
          },
          {
            name: 'created_at',
            type: 'timestamp',
            default: 'now()',
          },
          {
            name: 'updated_at',
            type: 'timestamp',
            default: 'now()',
          },
        ],
      }),
      true
    );

    // Criar índice em employee_id para performance
    await queryRunner.createIndex(
      'employee_permissions',
      new TableIndex({
        name: 'idx_employee_permissions_employee',
        columnNames: ['employee_id'],
      })
    );

    // Criar constraint UNIQUE em (employee_id, module_id, submenu_id)
    await queryRunner.createIndex(
      'employee_permissions',
      new TableIndex({
        name: 'idx_employee_permissions_unique',
        columnNames: ['employee_id', 'module_id', 'submenu_id'],
        isUnique: true,
      })
    );

    // Criar Foreign Key para employees
    await queryRunner.createForeignKey(
      'employee_permissions',
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
    const table = await queryRunner.getTable('employee_permissions');
    const foreignKey = table?.foreignKeys.find(
      (fk) => fk.columnNames.indexOf('employee_id') !== -1
    );
    if (foreignKey) {
      await queryRunner.dropForeignKey('employee_permissions', foreignKey);
    }

    // Remover tabela (os índices serão removidos automaticamente)
    await queryRunner.dropTable('employee_permissions');
  }
}
