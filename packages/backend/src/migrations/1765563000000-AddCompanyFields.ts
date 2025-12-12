import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class AddCompanyFields1765563000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Adicionar novos campos à tabela companies
    await queryRunner.addColumn('companies', new TableColumn({
      name: 'responsavel_nome',
      type: 'varchar',
      length: '255',
      isNullable: true
    }));

    await queryRunner.addColumn('companies', new TableColumn({
      name: 'responsavel_email',
      type: 'varchar',
      length: '255',
      isNullable: true
    }));

    await queryRunner.addColumn('companies', new TableColumn({
      name: 'responsavel_telefone',
      type: 'varchar',
      length: '20',
      isNullable: true
    }));

    await queryRunner.addColumn('companies', new TableColumn({
      name: 'endereco',
      type: 'text',
      isNullable: true
    }));

    await queryRunner.addColumn('companies', new TableColumn({
      name: 'telefone',
      type: 'varchar',
      length: '20',
      isNullable: true
    }));

    await queryRunner.addColumn('companies', new TableColumn({
      name: 'email',
      type: 'varchar',
      length: '255',
      isNullable: true
    }));
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropColumn('companies', 'responsavel_nome');
    await queryRunner.dropColumn('companies', 'responsavel_email');
    await queryRunner.dropColumn('companies', 'responsavel_telefone');
    await queryRunner.dropColumn('companies', 'endereco');
    await queryRunner.dropColumn('companies', 'telefone');
    await queryRunner.dropColumn('companies', 'email');
  }
}
