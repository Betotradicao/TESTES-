import { MigrationInterface, QueryRunner, Table } from 'typeorm';

export class CreatePDVMappingTables1767800000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Tabela de Operadores
    await queryRunner.createTable(
      new Table({
        name: 'operadores',
        columns: [
          {
            name: 'id',
            type: 'int',
            isPrimary: true,
            isGenerated: true,
            generationStrategy: 'increment',
          },
          {
            name: 'codigo',
            type: 'int',
            isNullable: false,
            isUnique: true,
            comment: 'Código do operador vindo da API Zanthus (M43CZ)',
          },
          {
            name: 'nome',
            type: 'varchar',
            length: '100',
            isNullable: false,
            comment: 'Nome completo do operador',
          },
          {
            name: 'ativo',
            type: 'boolean',
            default: true,
            comment: 'Indica se o operador está ativo',
          },
          {
            name: 'created_at',
            type: 'timestamp',
            default: 'now()',
          },
          {
            name: 'updated_at',
            type: 'timestamp',
            default: 'now()',
          },
        ],
      }),
      true
    );

    // Índices para operadores
    await queryRunner.query(`
      CREATE INDEX idx_operadores_codigo ON operadores(codigo);
      CREATE INDEX idx_operadores_ativo ON operadores(ativo);
    `);

    // Tabela de Motivos de Desconto
    await queryRunner.createTable(
      new Table({
        name: 'motivos_desconto',
        columns: [
          {
            name: 'id',
            type: 'int',
            isPrimary: true,
            isGenerated: true,
            generationStrategy: 'increment',
          },
          {
            name: 'codigo',
            type: 'int',
            isNullable: false,
            isUnique: true,
            comment: 'Código do motivo vindo da API Zanthus (M43DF)',
          },
          {
            name: 'descricao',
            type: 'varchar',
            length: '200',
            isNullable: false,
            comment: 'Descrição do motivo de desconto',
          },
          {
            name: 'ativo',
            type: 'boolean',
            default: true,
            comment: 'Indica se o motivo está ativo',
          },
          {
            name: 'created_at',
            type: 'timestamp',
            default: 'now()',
          },
          {
            name: 'updated_at',
            type: 'timestamp',
            default: 'now()',
          },
        ],
      }),
      true
    );

    // Índices para motivos_desconto
    await queryRunner.query(`
      CREATE INDEX idx_motivos_desconto_codigo ON motivos_desconto(codigo);
    `);

    // Tabela de Autorizadores
    await queryRunner.createTable(
      new Table({
        name: 'autorizadores',
        columns: [
          {
            name: 'id',
            type: 'int',
            isPrimary: true,
            isGenerated: true,
            generationStrategy: 'increment',
          },
          {
            name: 'codigo',
            type: 'int',
            isNullable: false,
            isUnique: true,
            comment: 'Código do autorizador vindo da API Zanthus (M43DG)',
          },
          {
            name: 'nome',
            type: 'varchar',
            length: '100',
            isNullable: false,
            comment: 'Nome do autorizador',
          },
          {
            name: 'cargo',
            type: 'varchar',
            length: '50',
            isNullable: true,
            comment: 'Cargo do autorizador (ex: Gerente, Supervisor)',
          },
          {
            name: 'ativo',
            type: 'boolean',
            default: true,
            comment: 'Indica se o autorizador está ativo',
          },
          {
            name: 'created_at',
            type: 'timestamp',
            default: 'now()',
          },
          {
            name: 'updated_at',
            type: 'timestamp',
            default: 'now()',
          },
        ],
      }),
      true
    );

    // Índices para autorizadores
    await queryRunner.query(`
      CREATE INDEX idx_autorizadores_codigo ON autorizadores(codigo);
    `);

    // Inserir dados iniciais baseados nos códigos encontrados na investigação
    await queryRunner.query(`
      INSERT INTO operadores (codigo, nome, ativo, created_at, updated_at) VALUES
      (185, 'Operador 185', true, now(), now()),
      (207, 'Operador 207', true, now(), now()),
      (275, 'Operador 275', true, now(), now()),
      (459, 'Operador 459', true, now(), now()),
      (3557, 'Operador 3557', true, now(), now()),
      (3649, 'Operador 3649', true, now(), now()),
      (5948, 'Operador 5948', true, now(), now());

      INSERT INTO motivos_desconto (codigo, descricao, ativo, created_at, updated_at) VALUES
      (10, 'Motivo 10', true, now(), now()),
      (20, 'Motivo 20', true, now(), now());

      INSERT INTO autorizadores (codigo, nome, cargo, ativo, created_at, updated_at) VALUES
      (3, 'Autorizador 3', 'Gerente', true, now(), now()),
      (28, 'Autorizador 28', 'Supervisor', true, now(), now());
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('autorizadores');
    await queryRunner.dropTable('motivos_desconto');
    await queryRunner.dropTable('operadores');
  }
}
