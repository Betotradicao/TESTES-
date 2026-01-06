import { MigrationInterface, QueryRunner, Table, TableForeignKey } from 'typeorm';

export class CreateLabelAuditTables1767733000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Criar tabela label_audits
    await queryRunner.createTable(
      new Table({
        name: 'label_audits',
        columns: [
          {
            name: 'id',
            type: 'int',
            isPrimary: true,
            isGenerated: true,
            generationStrategy: 'increment'
          },
          {
            name: 'titulo',
            type: 'varchar',
            length: '255'
          },
          {
            name: 'data_referencia',
            type: 'date'
          },
          {
            name: 'observacoes',
            type: 'text',
            isNullable: true
          },
          {
            name: 'status',
            type: 'enum',
            enum: ['em_andamento', 'concluida', 'cancelada'],
            default: "'em_andamento'"
          },
          {
            name: 'created_at',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP'
          },
          {
            name: 'updated_at',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
            onUpdate: 'CURRENT_TIMESTAMP'
          }
        ]
      }),
      true
    );

    // Criar tabela label_audit_items
    await queryRunner.createTable(
      new Table({
        name: 'label_audit_items',
        columns: [
          {
            name: 'id',
            type: 'int',
            isPrimary: true,
            isGenerated: true,
            generationStrategy: 'increment'
          },
          {
            name: 'audit_id',
            type: 'int'
          },
          {
            name: 'codigo_barras',
            type: 'varchar',
            length: '50',
            isNullable: true
          },
          {
            name: 'descricao',
            type: 'varchar',
            length: '255'
          },
          {
            name: 'etiqueta',
            type: 'varchar',
            length: '10',
            isNullable: true
          },
          {
            name: 'secao',
            type: 'varchar',
            length: '100',
            isNullable: true
          },
          {
            name: 'valor_venda',
            type: 'decimal',
            precision: 10,
            scale: 2,
            isNullable: true
          },
          {
            name: 'valor_oferta',
            type: 'decimal',
            precision: 10,
            scale: 2,
            isNullable: true
          },
          {
            name: 'margem_pratica',
            type: 'varchar',
            length: '20',
            isNullable: true
          },
          {
            name: 'status_verificacao',
            type: 'enum',
            enum: ['pendente', 'preco_correto', 'preco_divergente'],
            default: "'pendente'"
          },
          {
            name: 'data_verificacao',
            type: 'timestamp',
            isNullable: true
          },
          {
            name: 'verificado_por',
            type: 'varchar',
            length: '255',
            isNullable: true
          },
          {
            name: 'observacao_item',
            type: 'text',
            isNullable: true
          },
          {
            name: 'created_at',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP'
          }
        ]
      }),
      true
    );

    // Criar foreign key
    await queryRunner.createForeignKey(
      'label_audit_items',
      new TableForeignKey({
        columnNames: ['audit_id'],
        referencedColumnNames: ['id'],
        referencedTableName: 'label_audits',
        onDelete: 'CASCADE'
      })
    );

    // Criar índices para melhor performance
    await queryRunner.query(`
      CREATE INDEX idx_label_audit_items_audit_id ON label_audit_items(audit_id);
      CREATE INDEX idx_label_audit_items_status ON label_audit_items(status_verificacao);
      CREATE INDEX idx_label_audit_items_secao ON label_audit_items(secao);
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('label_audit_items');
    await queryRunner.dropTable('label_audits');
  }
}
