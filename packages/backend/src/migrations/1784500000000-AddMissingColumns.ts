import { MigrationInterface, QueryRunner } from "typeorm";

export class AddMissingColumns1784500000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // fornecedor_agendamentos - colunas faltantes
    const agendTable = await queryRunner.hasTable('fornecedor_agendamentos');
    if (agendTable) {
      const hasComprador = await queryRunner.hasColumn('fornecedor_agendamentos', 'comprador');
      if (!hasComprador) {
        await queryRunner.query(`ALTER TABLE "fornecedor_agendamentos" ADD COLUMN "comprador" VARCHAR(255)`);
      }
      const hasTipoAtendimento = await queryRunner.hasColumn('fornecedor_agendamentos', 'tipo_atendimento');
      if (!hasTipoAtendimento) {
        await queryRunner.query(`ALTER TABLE "fornecedor_agendamentos" ADD COLUMN "tipo_atendimento" VARCHAR(50) DEFAULT 'presencial'`);
      }
      const hasHoraInicio = await queryRunner.hasColumn('fornecedor_agendamentos', 'hora_inicio');
      if (!hasHoraInicio) {
        await queryRunner.query(`ALTER TABLE "fornecedor_agendamentos" ADD COLUMN "hora_inicio" VARCHAR(10)`);
      }
      const hasHoraTermino = await queryRunner.hasColumn('fornecedor_agendamentos', 'hora_termino');
      if (!hasHoraTermino) {
        await queryRunner.query(`ALTER TABLE "fornecedor_agendamentos" ADD COLUMN "hora_termino" VARCHAR(10)`);
      }
    }

    // equipments - coluna ean_digits
    const equipTable = await queryRunner.hasTable('equipments');
    if (equipTable) {
      const hasEanDigits = await queryRunner.hasColumn('equipments', 'ean_digits');
      if (!hasEanDigits) {
        await queryRunner.query(`ALTER TABLE "equipments" ADD COLUMN "ean_digits" INT DEFAULT 6`);
      }
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "fornecedor_agendamentos" DROP COLUMN IF EXISTS "comprador"`);
    await queryRunner.query(`ALTER TABLE "fornecedor_agendamentos" DROP COLUMN IF EXISTS "tipo_atendimento"`);
    await queryRunner.query(`ALTER TABLE "fornecedor_agendamentos" DROP COLUMN IF EXISTS "hora_inicio"`);
    await queryRunner.query(`ALTER TABLE "fornecedor_agendamentos" DROP COLUMN IF EXISTS "hora_termino"`);
    await queryRunner.query(`ALTER TABLE "equipments" DROP COLUMN IF EXISTS "ean_digits"`);
  }
}
