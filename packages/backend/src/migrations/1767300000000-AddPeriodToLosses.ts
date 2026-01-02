import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class AddPeriodToLosses1767300000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.addColumn(
      'losses',
      new TableColumn({
        name: 'data_inicio_periodo',
        type: 'date',
        isNullable: true,
      })
    );

    await queryRunner.addColumn(
      'losses',
      new TableColumn({
        name: 'data_fim_periodo',
        type: 'date',
        isNullable: true,
      })
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropColumn('losses', 'data_fim_periodo');
    await queryRunner.dropColumn('losses', 'data_inicio_periodo');
  }
}
