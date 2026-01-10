import { MigrationInterface, QueryRunner, TableColumn } from "typeorm";

export class AddWhatsappGroupToProductionAudits1768002000000 implements MigrationInterface {

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Verificar se a coluna já existe antes de adicionar
        const table = await queryRunner.getTable('production_audits');
        const hasColumn = table?.columns.find(column => column.name === 'whatsapp_group_name');

        if (!hasColumn) {
            await queryRunner.addColumn('production_audits', new TableColumn({
                name: 'whatsapp_group_name',
                type: 'varchar',
                length: '255',
                isNullable: true,
            }));
        }
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Verificar se a coluna existe antes de remover
        const table = await queryRunner.getTable('production_audits');
        const hasColumn = table?.columns.find(column => column.name === 'whatsapp_group_name');

        if (hasColumn) {
            await queryRunner.dropColumn('production_audits', 'whatsapp_group_name');
        }
    }

}
