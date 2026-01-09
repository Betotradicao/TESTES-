import { MigrationInterface, QueryRunner, TableColumn } from "typeorm";

export class AddCostPriceMarginToProductionAuditItems1768001000000 implements MigrationInterface {

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.addColumn('production_audit_items', new TableColumn({
            name: 'unit_cost',
            type: 'decimal',
            precision: 10,
            scale: 2,
            isNullable: true,
            comment: 'Custo unitário do produto'
        }));

        await queryRunner.addColumn('production_audit_items', new TableColumn({
            name: 'unit_price',
            type: 'decimal',
            precision: 10,
            scale: 2,
            isNullable: true,
            comment: 'Preço de venda unitário do produto'
        }));

        await queryRunner.addColumn('production_audit_items', new TableColumn({
            name: 'profit_margin',
            type: 'decimal',
            precision: 5,
            scale: 2,
            isNullable: true,
            comment: 'Margem de lucro em porcentagem'
        }));
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.dropColumn('production_audit_items', 'profit_margin');
        await queryRunner.dropColumn('production_audit_items', 'unit_price');
        await queryRunner.dropColumn('production_audit_items', 'unit_cost');
    }

}
