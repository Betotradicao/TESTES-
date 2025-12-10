import { MigrationInterface, QueryRunner, Table, TableForeignKey } from 'typeorm';

export class CreateEquipmentSessionsTable1759600000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'equipment_sessions',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: 'uuid_generate_v4()',
          },
          {
            name: 'equipment_id',
            type: 'integer',
            isNullable: false,
          },
          {
            name: 'employee_id',
            type: 'uuid',
            isNullable: false,
          },
          {
            name: 'logged_in_at',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
          },
          {
            name: 'logged_out_at',
            type: 'timestamp',
            isNullable: true,
          },
          {
            name: 'active',
            type: 'boolean',
            default: true,
          },
          {
            name: 'created_at',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
          },
          {
            name: 'updated_at',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
            onUpdate: 'CURRENT_TIMESTAMP',
          },
        ],
      }),
      true
    );

    // Foreign key para equipments
    await queryRunner.createForeignKey(
      'equipment_sessions',
      new TableForeignKey({
        columnNames: ['equipment_id'],
        referencedColumnNames: ['id'],
        referencedTableName: 'equipments',
        onDelete: 'CASCADE',
      })
    );

    // Foreign key para employees
    await queryRunner.createForeignKey(
      'equipment_sessions',
      new TableForeignKey({
        columnNames: ['employee_id'],
        referencedColumnNames: ['id'],
        referencedTableName: 'employees',
        onDelete: 'CASCADE',
      })
    );

    // Índice para buscar sessões ativas por equipamento
    await queryRunner.query(
      `CREATE INDEX idx_equipment_sessions_equipment_active
       ON equipment_sessions (equipment_id, active)`
    );

    // Índice para buscar sessões por colaborador
    await queryRunner.query(
      `CREATE INDEX idx_equipment_sessions_employee
       ON equipment_sessions (employee_id)`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS idx_equipment_sessions_employee`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_equipment_sessions_equipment_active`);
    await queryRunner.dropTable('equipment_sessions');
  }
}
