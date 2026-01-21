import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class AddLastSaleDateToProductionAuditItems1768300000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Adicionar coluna last_sale_date (data da última venda, formato YYYYMMDD)
    await queryRunner.addColumn(
      'production_audit_items',
      new TableColumn({
        name: 'last_sale_date',
        type: 'varchar',
        length: '20',
        isNullable: true,
      })
    );

    // Adicionar coluna days_without_sale (dias sem venda)
    await queryRunner.addColumn(
      'production_audit_items',
      new TableColumn({
        name: 'days_without_sale',
        type: 'integer',
        isNullable: true,
      })
    );

    console.log('✅ Colunas last_sale_date e days_without_sale adicionadas à tabela production_audit_items');
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropColumn('production_audit_items', 'days_without_sale');
    await queryRunner.dropColumn('production_audit_items', 'last_sale_date');
  }
}
