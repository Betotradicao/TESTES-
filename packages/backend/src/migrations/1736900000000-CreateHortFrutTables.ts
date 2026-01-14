import { MigrationInterface, QueryRunner, Table, TableForeignKey, TableIndex } from 'typeorm';

export class CreateHortFrutTables1736900000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Criar tabela de tipos de caixa
    await queryRunner.createTable(
      new Table({
        name: 'hortfrut_boxes',
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
            name: 'name',
            type: 'varchar',
            length: '100',
          },
          {
            name: 'description',
            type: 'varchar',
            length: '255',
            isNullable: true,
          },
          {
            name: 'weight',
            type: 'decimal',
            precision: 10,
            scale: 3,
          },
          {
            name: 'active',
            type: 'boolean',
            default: true,
          },
          {
            name: 'photo_url',
            type: 'varchar',
            length: '500',
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

    // Criar tabela de conferências
    await queryRunner.createTable(
      new Table({
        name: 'hortfrut_conferences',
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
            name: 'user_id',
            type: 'uuid',
            isNullable: true,
          },
          {
            name: 'conference_date',
            type: 'date',
          },
          {
            name: 'supplier_name',
            type: 'varchar',
            length: '255',
            isNullable: true,
          },
          {
            name: 'invoice_number',
            type: 'varchar',
            length: '100',
            isNullable: true,
          },
          {
            name: 'total_expected_weight',
            type: 'decimal',
            precision: 10,
            scale: 3,
            isNullable: true,
          },
          {
            name: 'total_actual_weight',
            type: 'decimal',
            precision: 10,
            scale: 3,
            isNullable: true,
          },
          {
            name: 'total_cost',
            type: 'decimal',
            precision: 10,
            scale: 2,
            isNullable: true,
          },
          {
            name: 'status',
            type: 'varchar',
            length: '50',
            default: "'pending'",
          },
          {
            name: 'observations',
            type: 'text',
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

    // Criar tabela de itens da conferência
    await queryRunner.createTable(
      new Table({
        name: 'hortfrut_conference_items',
        columns: [
          {
            name: 'id',
            type: 'int',
            isPrimary: true,
            isGenerated: true,
            generationStrategy: 'increment',
          },
          {
            name: 'conference_id',
            type: 'int',
          },
          {
            name: 'barcode',
            type: 'varchar',
            length: '50',
            isNullable: true,
          },
          {
            name: 'product_name',
            type: 'varchar',
            length: '255',
          },
          {
            name: 'curve',
            type: 'varchar',
            length: '10',
            isNullable: true,
          },
          {
            name: 'section',
            type: 'varchar',
            length: '100',
            isNullable: true,
          },
          {
            name: 'product_group',
            type: 'varchar',
            length: '100',
            isNullable: true,
          },
          {
            name: 'sub_group',
            type: 'varchar',
            length: '100',
            isNullable: true,
          },
          {
            name: 'current_cost',
            type: 'decimal',
            precision: 10,
            scale: 2,
            isNullable: true,
          },
          {
            name: 'current_sale_price',
            type: 'decimal',
            precision: 10,
            scale: 2,
            isNullable: true,
          },
          {
            name: 'reference_margin',
            type: 'decimal',
            precision: 5,
            scale: 2,
            isNullable: true,
          },
          {
            name: 'current_margin',
            type: 'decimal',
            precision: 5,
            scale: 2,
            isNullable: true,
          },
          {
            name: 'new_cost',
            type: 'decimal',
            precision: 10,
            scale: 2,
            isNullable: true,
          },
          {
            name: 'box_id',
            type: 'int',
            isNullable: true,
          },
          {
            name: 'box_quantity',
            type: 'int',
            isNullable: true,
          },
          {
            name: 'gross_weight',
            type: 'decimal',
            precision: 10,
            scale: 3,
            isNullable: true,
          },
          {
            name: 'net_weight',
            type: 'decimal',
            precision: 10,
            scale: 3,
            isNullable: true,
          },
          {
            name: 'expected_weight',
            type: 'decimal',
            precision: 10,
            scale: 3,
            isNullable: true,
          },
          {
            name: 'weight_difference',
            type: 'decimal',
            precision: 10,
            scale: 3,
            isNullable: true,
          },
          {
            name: 'suggested_price',
            type: 'decimal',
            precision: 10,
            scale: 2,
            isNullable: true,
          },
          {
            name: 'margin_if_keep_price',
            type: 'decimal',
            precision: 5,
            scale: 2,
            isNullable: true,
          },
          {
            name: 'quality',
            type: 'varchar',
            length: '20',
            isNullable: true,
          },
          {
            name: 'photo_url',
            type: 'varchar',
            length: '500',
            isNullable: true,
          },
          {
            name: 'observations',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'checked',
            type: 'boolean',
            default: false,
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

    // Foreign Keys
    await queryRunner.createForeignKey(
      'hortfrut_boxes',
      new TableForeignKey({
        columnNames: ['company_id'],
        referencedColumnNames: ['id'],
        referencedTableName: 'companies',
        onDelete: 'CASCADE',
      })
    );

    await queryRunner.createForeignKey(
      'hortfrut_conferences',
      new TableForeignKey({
        columnNames: ['company_id'],
        referencedColumnNames: ['id'],
        referencedTableName: 'companies',
        onDelete: 'CASCADE',
      })
    );

    await queryRunner.createForeignKey(
      'hortfrut_conferences',
      new TableForeignKey({
        columnNames: ['user_id'],
        referencedColumnNames: ['id'],
        referencedTableName: 'users',
        onDelete: 'SET NULL',
      })
    );

    await queryRunner.createForeignKey(
      'hortfrut_conference_items',
      new TableForeignKey({
        columnNames: ['conference_id'],
        referencedColumnNames: ['id'],
        referencedTableName: 'hortfrut_conferences',
        onDelete: 'CASCADE',
      })
    );

    await queryRunner.createForeignKey(
      'hortfrut_conference_items',
      new TableForeignKey({
        columnNames: ['box_id'],
        referencedColumnNames: ['id'],
        referencedTableName: 'hortfrut_boxes',
        onDelete: 'SET NULL',
      })
    );

    // Índices para performance
    await queryRunner.createIndex(
      'hortfrut_boxes',
      new TableIndex({
        name: 'IDX_hortfrut_boxes_company_id',
        columnNames: ['company_id'],
      })
    );

    await queryRunner.createIndex(
      'hortfrut_conferences',
      new TableIndex({
        name: 'IDX_hortfrut_conferences_company_id',
        columnNames: ['company_id'],
      })
    );

    await queryRunner.createIndex(
      'hortfrut_conferences',
      new TableIndex({
        name: 'IDX_hortfrut_conferences_date',
        columnNames: ['conference_date'],
      })
    );

    await queryRunner.createIndex(
      'hortfrut_conference_items',
      new TableIndex({
        name: 'IDX_hortfrut_conference_items_conference_id',
        columnNames: ['conference_id'],
      })
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('hortfrut_conference_items');
    await queryRunner.dropTable('hortfrut_conferences');
    await queryRunner.dropTable('hortfrut_boxes');
  }
}
