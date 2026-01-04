import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class AddPedidoToRuptureSurveyItems1766400000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.addColumn(
      'rupture_survey_items',
      new TableColumn({
        name: 'tem_pedido',
        type: 'varchar',
        length: '3',
        isNullable: true,
        comment: 'Indica se existe pedido em aberto para o produto (Sim/Não)',
      })
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropColumn('rupture_survey_items', 'tem_pedido');
  }
}
