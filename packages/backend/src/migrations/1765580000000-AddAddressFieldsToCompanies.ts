import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class AddAddressFieldsToCompanies1765580000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    const table = await queryRunner.getTable('companies');

    if (!table) {
      throw new Error('Tabela companies não encontrada');
    }

    // Adicionar campos de endereço individuais
    if (!table.findColumnByName('cep')) {
      await queryRunner.addColumn('companies', new TableColumn({
        name: 'cep',
        type: 'varchar',
        length: '9',
        isNullable: true
      }));
    }

    if (!table.findColumnByName('rua')) {
      await queryRunner.addColumn('companies', new TableColumn({
        name: 'rua',
        type: 'varchar',
        length: '255',
        isNullable: true
      }));
    }

    if (!table.findColumnByName('numero')) {
      await queryRunner.addColumn('companies', new TableColumn({
        name: 'numero',
        type: 'varchar',
        length: '20',
        isNullable: true
      }));
    }

    if (!table.findColumnByName('complemento')) {
      await queryRunner.addColumn('companies', new TableColumn({
        name: 'complemento',
        type: 'varchar',
        length: '100',
        isNullable: true
      }));
    }

    if (!table.findColumnByName('bairro')) {
      await queryRunner.addColumn('companies', new TableColumn({
        name: 'bairro',
        type: 'varchar',
        length: '100',
        isNullable: true
      }));
    }

    if (!table.findColumnByName('cidade')) {
      await queryRunner.addColumn('companies', new TableColumn({
        name: 'cidade',
        type: 'varchar',
        length: '100',
        isNullable: true
      }));
    }

    if (!table.findColumnByName('estado')) {
      await queryRunner.addColumn('companies', new TableColumn({
        name: 'estado',
        type: 'varchar',
        length: '2',
        isNullable: true
      }));
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropColumn('companies', 'cep');
    await queryRunner.dropColumn('companies', 'rua');
    await queryRunner.dropColumn('companies', 'numero');
    await queryRunner.dropColumn('companies', 'complemento');
    await queryRunner.dropColumn('companies', 'bairro');
    await queryRunner.dropColumn('companies', 'cidade');
    await queryRunner.dropColumn('companies', 'estado');
  }
}
