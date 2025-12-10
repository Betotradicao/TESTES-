import { MigrationInterface, QueryRunner, Table } from "typeorm";

export class CreateConfigurationsTable1765080280169 implements MigrationInterface {

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.createTable(
            new Table({
                name: "configurations",
                columns: [
                    {
                        name: "id",
                        type: "uuid",
                        isPrimary: true,
                        generationStrategy: "uuid",
                        default: "uuid_generate_v4()"
                    },
                    {
                        name: "key",
                        type: "varchar",
                        isUnique: true
                    },
                    {
                        name: "value",
                        type: "text",
                        isNullable: true
                    },
                    {
                        name: "encrypted",
                        type: "boolean",
                        default: false
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
        await queryRunner.dropTable("configurations");
    }

}
