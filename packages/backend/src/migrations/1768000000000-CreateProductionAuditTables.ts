import { MigrationInterface, QueryRunner, Table, TableForeignKey } from 'typeorm';

export class CreateProductionAuditTables1768000000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create production_audits table
    await queryRunner.createTable(
      new Table({
        name: 'production_audits',
        columns: [
          {
            name: 'id',
            type: 'integer',
            isPrimary: true,
            isGenerated: true,
            generationStrategy: 'increment',
          },
          {
            name: 'audit_date',
            type: 'date',
            isUnique: true,
          },
          {
            name: 'user_id',
            type: 'integer',
          },
          {
            name: 'status',
            type: 'varchar',
            length: '20',
            default: "'in_progress'",
          },
          {
            name: 'pdf_url',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'sent_whatsapp',
            type: 'boolean',
            default: false,
          },
          {
            name: 'sent_at',
            type: 'timestamp',
            isNullable: true,
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
          },
        ],
      }),
      true
    );

    // Create production_audit_items table
    await queryRunner.createTable(
      new Table({
        name: 'production_audit_items',
        columns: [
          {
            name: 'id',
            type: 'integer',
            isPrimary: true,
            isGenerated: true,
            generationStrategy: 'increment',
          },
          {
            name: 'audit_id',
            type: 'integer',
          },
          {
            name: 'product_code',
            type: 'varchar',
            length: '20',
          },
          {
            name: 'product_name',
            type: 'varchar',
            length: '255',
          },
          {
            name: 'quantity_units',
            type: 'integer',
          },
          {
            name: 'unit_weight_kg',
            type: 'decimal',
            precision: 10,
            scale: 3,
            isNullable: true,
          },
          {
            name: 'quantity_kg',
            type: 'decimal',
            precision: 10,
            scale: 3,
          },
          {
            name: 'production_days',
            type: 'integer',
          },
          {
            name: 'avg_sales_kg',
            type: 'decimal',
            precision: 10,
            scale: 3,
            isNullable: true,
          },
          {
            name: 'suggested_production_kg',
            type: 'decimal',
            precision: 10,
            scale: 3,
            isNullable: true,
          },
          {
            name: 'suggested_production_units',
            type: 'integer',
            isNullable: true,
          },
          {
            name: 'created_at',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
          },
        ],
      }),
      true
    );

    // Add foreign key for production_audits.user_id -> users.id
    await queryRunner.createForeignKey(
      'production_audits',
      new TableForeignKey({
        columnNames: ['user_id'],
        referencedTableName: 'users',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
      })
    );

    // Add foreign key for production_audit_items.audit_id -> production_audits.id
    await queryRunner.createForeignKey(
      'production_audit_items',
      new TableForeignKey({
        columnNames: ['audit_id'],
        referencedTableName: 'production_audits',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
      })
    );

    // Create index on audit_date for faster lookups
    await queryRunner.query(
      `CREATE INDEX idx_production_audits_audit_date ON production_audits(audit_date)`
    );

    // Create index on audit_id for faster joins
    await queryRunner.query(
      `CREATE INDEX idx_production_audit_items_audit_id ON production_audit_items(audit_id)`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop foreign keys first
    const productionAuditsTable = await queryRunner.getTable('production_audits');
    const productionAuditItemsTable = await queryRunner.getTable('production_audit_items');

    if (productionAuditItemsTable) {
      const auditIdForeignKey = productionAuditItemsTable.foreignKeys.find(
        fk => fk.columnNames.indexOf('audit_id') !== -1
      );
      if (auditIdForeignKey) {
        await queryRunner.dropForeignKey('production_audit_items', auditIdForeignKey);
      }
    }

    if (productionAuditsTable) {
      const userIdForeignKey = productionAuditsTable.foreignKeys.find(
        fk => fk.columnNames.indexOf('user_id') !== -1
      );
      if (userIdForeignKey) {
        await queryRunner.dropForeignKey('production_audits', userIdForeignKey);
      }
    }

    // Drop indexes
    await queryRunner.query(`DROP INDEX IF EXISTS idx_production_audit_items_audit_id`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_production_audits_audit_date`);

    // Drop tables
    await queryRunner.dropTable('production_audit_items', true);
    await queryRunner.dropTable('production_audits', true);
  }
}
