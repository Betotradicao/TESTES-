import { MigrationInterface, QueryRunner, TableColumn } from "typeorm";

export class AddImagePathToEmailMonitorLogs1765700000000 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.addColumn("email_monitor_logs", new TableColumn({
            name: "image_path",
            type: "varchar",
            length: "500",
            isNullable: true
        }));
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.dropColumn("email_monitor_logs", "image_path");
    }
}
