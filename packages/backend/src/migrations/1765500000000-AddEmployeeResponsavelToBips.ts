import { MigrationInterface, QueryRunner, TableColumn, TableForeignKey } from 'typeorm';

export class AddEmployeeResponsavelToBips1765500000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Adicionar coluna employee_responsavel_id
    await queryRunner.addColumn(
      'bips',
      new TableColumn({
        name: 'employee_responsavel_id',
        type: 'uuid',
        isNullable: true,
        comment: 'ID do funcionário responsável pelo erro (quando motivo é ERRO_OPERADOR ou ERRO_BALCONISTA)'
      })
    );

    // Criar foreign key para employees
    await queryRunner.createForeignKey(
      'bips',
      new TableForeignKey({
        columnNames: ['employee_responsavel_id'],
        referencedTableName: 'employees',
        referencedColumnNames: ['id'],
        onDelete: 'SET NULL',
        name: 'FK_bip_employee_responsavel'
      })
    );

    console.log('✅ Coluna employee_responsavel_id adicionada à tabela bips');
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Remover foreign key
    await queryRunner.dropForeignKey('bips', 'FK_bip_employee_responsavel');

    // Remover coluna
    await queryRunner.dropColumn('bips', 'employee_responsavel_id');
  }
}
