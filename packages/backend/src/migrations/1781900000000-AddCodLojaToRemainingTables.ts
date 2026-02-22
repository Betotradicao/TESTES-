import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddCodLojaToRemainingTables1781900000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    const tables = [
      'autorizadores',
      'bank_accounts',
      'operadores',
      'motivos_desconto',
      'cotacao_pedido',
      'email_monitor_logs',
      'fornecedor_agendamentos',
      'loss_reason_configs',
      'opcoes_dropdown',
      'product_activation_history',
    ];

    for (const table of tables) {
      const hasColumn = await queryRunner.query(
        `SELECT column_name FROM information_schema.columns WHERE table_name = '${table}' AND column_name = 'cod_loja'`
      );
      if (hasColumn.length === 0) {
        await queryRunner.query(`ALTER TABLE "${table}" ADD COLUMN "cod_loja" integer`);
        await queryRunner.query(`UPDATE "${table}" SET "cod_loja" = 1 WHERE "cod_loja" IS NULL`);
      }
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const tables = [
      'autorizadores',
      'bank_accounts',
      'operadores',
      'motivos_desconto',
      'cotacao_pedido',
      'email_monitor_logs',
      'fornecedor_agendamentos',
      'loss_reason_configs',
      'opcoes_dropdown',
      'product_activation_history',
    ];

    for (const table of tables) {
      const hasColumn = await queryRunner.query(
        `SELECT column_name FROM information_schema.columns WHERE table_name = '${table}' AND column_name = 'cod_loja'`
      );
      if (hasColumn.length > 0) {
        await queryRunner.query(`ALTER TABLE "${table}" DROP COLUMN "cod_loja"`);
      }
    }
  }
}
