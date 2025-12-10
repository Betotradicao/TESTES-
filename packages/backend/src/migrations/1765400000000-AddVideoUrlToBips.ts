import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class AddVideoUrlToBips1765400000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.addColumn(
      'bips',
      new TableColumn({
        name: 'video_url',
        type: 'varchar',
        length: '500',
        isNullable: true,
      })
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropColumn('bips', 'video_url');
  }
}
