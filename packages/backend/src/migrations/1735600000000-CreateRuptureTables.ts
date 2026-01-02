import { MigrationInterface, QueryRunner, Table, TableForeignKey } from 'typeorm';

export class CreateRuptureTables1735600000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Criar tabela rupture_surveys
    await queryRunner.createTable(
      new Table({
        name: 'rupture_surveys',
        columns: [
          {
            name: 'id',
            type: 'int',
            isPrimary: true,
            isGenerated: true,
            generationStrategy: 'increment',
          },
          {
            name: 'nome_pesquisa',
            type: 'varchar',
            length: '255',
          },
          {
            name: 'data_criacao',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
          },
          {
            name: 'data_inicio_coleta',
            type: 'timestamp',
            isNullable: true,
          },
          {
            name: 'data_fim_coleta',
            type: 'timestamp',
            isNullable: true,
          },
          {
            name: 'status',
            type: 'enum',
            enum: ['rascunho', 'em_andamento', 'concluida', 'cancelada'],
            default: "'rascunho'",
          },
          {
            name: 'total_itens',
            type: 'int',
            default: 0,
          },
          {
            name: 'itens_verificados',
            type: 'int',
            default: 0,
          },
          {
            name: 'itens_encontrados',
            type: 'int',
            default: 0,
          },
          {
            name: 'itens_nao_encontrados',
            type: 'int',
            default: 0,
          },
          {
            name: 'user_id',
            type: 'uuid',
            isNullable: true,
          },
          {
            name: 'observacoes',
            type: 'text',
            isNullable: true,
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

    // Criar tabela rupture_survey_items
    await queryRunner.createTable(
      new Table({
        name: 'rupture_survey_items',
        columns: [
          {
            name: 'id',
            type: 'int',
            isPrimary: true,
            isGenerated: true,
            generationStrategy: 'increment',
          },
          {
            name: 'survey_id',
            type: 'int',
          },
          {
            name: 'codigo_barras',
            type: 'varchar',
            length: '50',
            isNullable: true,
          },
          {
            name: 'erp_product_id',
            type: 'varchar',
            length: '50',
            isNullable: true,
          },
          {
            name: 'descricao',
            type: 'varchar',
            length: '255',
          },
          {
            name: 'curva',
            type: 'varchar',
            length: '10',
            isNullable: true,
          },
          {
            name: 'estoque_atual',
            type: 'decimal',
            precision: 10,
            scale: 3,
            isNullable: true,
          },
          {
            name: 'cobertura_dias',
            type: 'int',
            isNullable: true,
          },
          {
            name: 'grupo',
            type: 'varchar',
            length: '100',
            isNullable: true,
          },
          {
            name: 'secao',
            type: 'varchar',
            length: '100',
            isNullable: true,
          },
          {
            name: 'subgrupo',
            type: 'varchar',
            length: '100',
            isNullable: true,
          },
          {
            name: 'fornecedor',
            type: 'varchar',
            length: '255',
            isNullable: true,
          },
          {
            name: 'margem_lucro',
            type: 'decimal',
            precision: 5,
            scale: 2,
            isNullable: true,
          },
          {
            name: 'qtd_embalagem',
            type: 'int',
            isNullable: true,
          },
          {
            name: 'valor_venda',
            type: 'decimal',
            precision: 10,
            scale: 2,
            isNullable: true,
          },
          {
            name: 'custo_com_imposto',
            type: 'decimal',
            precision: 10,
            scale: 2,
            isNullable: true,
          },
          {
            name: 'venda_media_dia',
            type: 'decimal',
            precision: 10,
            scale: 4,
            isNullable: true,
          },
          {
            name: 'status_verificacao',
            type: 'enum',
            enum: ['pendente', 'encontrado', 'nao_encontrado', 'parcial'],
            default: "'pendente'",
          },
          {
            name: 'data_verificacao',
            type: 'timestamp',
            isNullable: true,
          },
          {
            name: 'verificado_por',
            type: 'varchar',
            length: '255',
            isNullable: true,
          },
          {
            name: 'observacao_item',
            type: 'text',
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

    // Adicionar foreign key para user_id (apenas se tabela users existir)
    const hasUsersTable = await queryRunner.hasTable('users');
    if (hasUsersTable) {
      await queryRunner.createForeignKey(
        'rupture_surveys',
        new TableForeignKey({
          columnNames: ['user_id'],
          referencedColumnNames: ['id'],
          referencedTableName: 'users',
          onDelete: 'SET NULL',
        })
      );
    }

    // Adicionar foreign key para survey_id
    await queryRunner.createForeignKey(
      'rupture_survey_items',
      new TableForeignKey({
        columnNames: ['survey_id'],
        referencedColumnNames: ['id'],
        referencedTableName: 'rupture_surveys',
        onDelete: 'CASCADE',
      })
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const itemsTable = await queryRunner.getTable('rupture_survey_items');
    const surveysTable = await queryRunner.getTable('rupture_surveys');

    // Remover foreign keys
    if (itemsTable) {
      const itemsForeignKey = itemsTable.foreignKeys.find(
        fk => fk.columnNames.indexOf('survey_id') !== -1
      );
      if (itemsForeignKey) {
        await queryRunner.dropForeignKey('rupture_survey_items', itemsForeignKey);
      }
    }

    if (surveysTable) {
      const surveysForeignKey = surveysTable.foreignKeys.find(
        fk => fk.columnNames.indexOf('user_id') !== -1
      );
      if (surveysForeignKey) {
        await queryRunner.dropForeignKey('rupture_surveys', surveysForeignKey);
      }
    }

    // Remover tabelas
    await queryRunner.dropTable('rupture_survey_items');
    await queryRunner.dropTable('rupture_surveys');
  }
}
