import { MigrationInterface, QueryRunner, Table } from "typeorm";

export class CreateEmailMonitorLogsTable1765600000000 implements MigrationInterface {

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.createTable(
            new Table({
                name: "email_monitor_logs",
                columns: [
                    {
                        name: "id",
                        type: "uuid",
                        isPrimary: true,
                        generationStrategy: "uuid",
                        default: "uuid_generate_v4()"
                    },
                    {
                        name: "email_subject",
                        type: "varchar",
                        length: "255"
                    },
                    {
                        name: "sender",
                        type: "varchar",
                        length: "255"
                    },
                    {
                        name: "email_body",
                        type: "text",
                        isNullable: true
                    },
                    {
                        name: "status",
                        type: "varchar",
                        length: "100"
                    },
                    {
                        name: "error_message",
                        type: "text",
                        isNullable: true
                    },
                    {
                        name: "has_attachment",
                        type: "boolean",
                        default: false
                    },
                    {
                        name: "whatsapp_group_id",
                        type: "varchar",
                        length: "255",
                        isNullable: true
                    },
                    {
                        name: "processed_at",
                        type: "timestamp",
                        default: "now()"
                    }
                ]
            }),
            true
        );
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.dropTable("email_monitor_logs");
    }

}
