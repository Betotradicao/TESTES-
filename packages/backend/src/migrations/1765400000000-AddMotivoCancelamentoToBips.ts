import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class AddMotivoCancelamentoToBips1765400000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Adicionar coluna motivo_cancelamento
    await queryRunner.addColumn(
      'bips',
      new TableColumn({
        name: 'motivo_cancelamento',
        type: 'varchar',
        length: '50',
        isNullable: true,
        comment: 'Motivo do cancelamento da bipagem'
      })
    );

    console.log('✅ Coluna motivo_cancelamento adicionada à tabela bips');
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropColumn('bips', 'motivo_cancelamento');
    console.log('✅ Coluna motivo_cancelamento removida da tabela bips');
  }
}
