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
            isNullable: true,
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

    // Foreign key opcional (apenas quando company_id não for null)
    await queryRunner.query(`
      ALTER TABLE loss_reason_configs
      ADD CONSTRAINT fk_loss_reason_configs_company
      FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE;
    `);

    // Criar índice único para company_id + motivo (permite múltiplos NULL em company_id)
    await queryRunner.query(`
      CREATE UNIQUE INDEX idx_loss_reason_configs_company_motivo
      ON loss_reason_configs (COALESCE(company_id, '00000000-0000-0000-0000-000000000000'), motivo);
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('loss_reason_configs');
  }
}
