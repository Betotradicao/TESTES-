import { MigrationInterface, QueryRunner, Table, TableForeignKey } from 'typeorm';

export class CreateLossesTable1766000000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'losses',
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
            name: 'codigo_barras',
            type: 'varchar',
            length: '50',
            isNullable: false,
          },
          {
            name: 'descricao_reduzida',
            type: 'text',
            isNullable: false,
          },
          {
            name: 'quantidade_ajuste',
            type: 'decimal',
            precision: 10,
            scale: 3,
            isNullable: false,
          },
          {
            name: 'custo_reposicao',
            type: 'decimal',
            precision: 10,
            scale: 2,
            isNullable: false,
          },
          {
            name: 'descricao_ajuste_completa',
            type: 'text',
            isNullable: false,
          },
          {
            name: 'secao',
            type: 'varchar',
            length: '10',
            isNullable: false,
          },
          {
            name: 'secao_nome',
            type: 'varchar',
            length: '100',
            isNullable: true,
          },
          {
            name: 'data_importacao',
            type: 'date',
            isNullable: false,
          },
          {
            name: 'nome_lote',
            type: 'varchar',
            length: '255',
            isNullable: false,
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

    // Foreign key para company
    await queryRunner.createForeignKey(
      'losses',
      new TableForeignKey({
        columnNames: ['company_id'],
        referencedColumnNames: ['id'],
        referencedTableName: 'companies',
        onDelete: 'CASCADE',
      })
    );

    // Índices para melhorar performance
    await queryRunner.query(
      `CREATE INDEX "IDX_losses_company_id" ON "losses" ("company_id")`
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_losses_data_importacao" ON "losses" ("data_importacao")`
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_losses_secao" ON "losses" ("secao")`
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_losses_nome_lote" ON "losses" ("nome_lote")`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('losses');
  }
}
