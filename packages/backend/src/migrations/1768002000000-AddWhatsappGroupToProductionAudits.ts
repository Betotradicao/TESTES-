import { MigrationInterface, QueryRunner, TableColumn } from "typeorm";

export class AddWhatsappGroupToProductionAudits1768002000000 implements MigrationInterface {

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.addColumn('production_audits', new TableColumn({
            name: 'whatsapp_group_name',
            type: 'varchar',
            length: '255',
            isNullable: true,
        }));
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.dropColumn('production_audits', 'whatsapp_group_name');
    }

}
