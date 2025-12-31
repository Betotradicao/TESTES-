import { MigrationInterface, QueryRunner, Table, TableForeignKey } from 'typeorm';

export class CreateLossReasonConfigsTable1767200000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'loss_reason_configs',
        columns: [
          {
            name: 'id',
            type: 'int',
            isPrimary: true,
            isGenerated: true,
            generationStrategy: 'increment',
          },
          {
            name: 'company_id',
            type: 'uuid',
            isNullable: false,
          },
          {
            name: 'motivo',
            type: 'text',
            isNullable: false,
          },
          {
            name: 'ignorar_calculo',
            type: 'boolean',
            default: false,
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

    await queryRunner.createForeignKey(
      'loss_reason_configs',
      new TableForeignKey({
        columnNames: ['company_id'],
        referencedColumnNames: ['id'],
        referencedTableName: 'companies',
        onDelete: 'CASCADE',
      })
    );

    // Criar índice único para company_id + motivo
    await queryRunner.query(`
      CREATE UNIQUE INDEX idx_loss_reason_configs_company_motivo 
      ON loss_reason_configs (company_id, motivo);
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('loss_reason_configs');
  }
}
