import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class AddIdentificadorToCompanies1768400000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Verificar se a coluna já existe
    const table = await queryRunner.getTable('companies');
    const hasColumn = table?.columns.find(c => c.name === 'identificador');

    if (!hasColumn) {
      await queryRunner.addColumn(
        'companies',
        new TableColumn({
          name: 'identificador',
          type: 'varchar',
          isNullable: true,
        })
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropColumn('companies', 'identificador');
  }
}
