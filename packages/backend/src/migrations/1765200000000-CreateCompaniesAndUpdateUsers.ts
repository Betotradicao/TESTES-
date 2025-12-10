import { MigrationInterface, QueryRunner, Table, TableColumn, TableForeignKey } from "typeorm";

export class CreateCompaniesAndUpdateUsers1765200000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Criar tabela companies
    await queryRunner.createTable(
      new Table({
        name: "companies",
        columns: [
          {
            name: "id",
            type: "uuid",
            isPrimary: true,
            generationStrategy: "uuid",
            default: "uuid_generate_v4()",
          },
          {
            name: "nome_fantasia",
            type: "varchar",
            isNullable: false,
          },
          {
            name: "razao_social",
            type: "varchar",
            isNullable: false,
          },
          {
            name: "cnpj",
            type: "varchar",
            isUnique: true,
            isNullable: false,
          },
          {
            name: "active",
            type: "boolean",
            default: true,
          },
          {
            name: "created_at",
            type: "timestamp",
            default: "now()",
          },
          {
            name: "updated_at",
            type: "timestamp",
            default: "now()",
          },
        ],
      }),
      true
    );

    // Adicionar colunas na tabela users
    await queryRunner.addColumn(
      "users",
      new TableColumn({
        name: "role",
        type: "varchar",
        default: "'user'",
      })
    );

    await queryRunner.addColumn(
      "users",
      new TableColumn({
        name: "is_master",
        type: "boolean",
        default: false,
      })
    );

    await queryRunner.addColumn(
      "users",
      new TableColumn({
        name: "company_id",
        type: "uuid",
        isNullable: true,
      })
    );

    // Criar foreign key
    await queryRunner.createForeignKey(
      "users",
      new TableForeignKey({
        columnNames: ["company_id"],
        referencedColumnNames: ["id"],
        referencedTableName: "companies",
        onDelete: "SET NULL",
      })
    );

    // Criar usuário master Beto se não existir
    const userExists = await queryRunner.query(
      `SELECT id FROM users WHERE email = 'beto@master.com'`
    );

    if (userExists.length === 0) {
      // Hash da senha Beto3107
      const bcrypt = require('bcrypt');
      const hashedPassword = await bcrypt.hash('Beto3107', 10);

      await queryRunner.query(
        `INSERT INTO users (id, email, password, role, is_master, created_at, updated_at)
         VALUES (uuid_generate_v4(), 'beto@master.com', '${hashedPassword}', 'master', true, now(), now())`
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Remover foreign key
    const table = await queryRunner.getTable("users");
    const foreignKey = table?.foreignKeys.find(
      fk => fk.columnNames.indexOf("company_id") !== -1
    );
    if (foreignKey) {
      await queryRunner.dropForeignKey("users", foreignKey);
    }

    // Remover colunas da tabela users
    await queryRunner.dropColumn("users", "company_id");
    await queryRunner.dropColumn("users", "is_master");
    await queryRunner.dropColumn("users", "role");

    // Remover tabela companies
    await queryRunner.dropTable("companies");
  }
}
