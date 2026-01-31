import { MigrationInterface, QueryRunner, Table } from "typeorm";

export class CreateDatabaseConnectionsTable1769900000000 implements MigrationInterface {

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.createTable(
            new Table({
                name: "database_connections",
                columns: [
                    {
                        name: "id",
                        type: "int",
                        isPrimary: true,
                        isGenerated: true,
                        generationStrategy: "increment"
                    },
                    {
                        name: "name",
                        type: "varchar",
                        length: "255"
                    },
                    {
                        name: "type",
                        type: "varchar",
                        length: "20"
                    },
                    {
                        name: "host",
                        type: "varchar",
                        length: "255"
                    },
                    {
                        name: "port",
                        type: "int"
                    },
                    {
                        name: "service",
                        type: "varchar",
                        length: "255",
                        isNullable: true
                    },
                    {
                        name: "database",
                        type: "varchar",
                        length: "255",
                        isNullable: true
                    },
                    {
                        name: "username",
                        type: "varchar",
                        length: "255"
                    },
                    {
                        name: "password",
                        type: "varchar",
                        length: "255"
                    },
                    {
                        name: "schema",
                        type: "varchar",
                        length: "255",
                        isNullable: true
                    },
                    {
                        name: "is_default",
                        type: "boolean",
                        default: false
                    },
                    {
                        name: "status",
                        type: "varchar",
                        length: "20",
                        default: "'inactive'"
                    },
                    {
                        name: "last_test_at",
                        type: "timestamp",
                        isNullable: true
                    },
                    {
                        name: "last_error",
                        type: "text",
                        isNullable: true
                    },
                    {
                        name: "created_at",
                        type: "timestamp",
                        default: "now()"
                    },
                    {
                        name: "updated_at",
                        type: "timestamp",
                        default: "now()"
                    }
                ]
            }),
            true
        );
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.dropTable("database_connections");
    }

}
