import { MigrationInterface, QueryRunner } from "typeorm";

export class AddHoraPermitidaToQuestions1784700200000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    const has1 = await queryRunner.hasColumn('audit_template_questions', 'hora_inicio');
    if (!has1) {
      await queryRunner.query(`ALTER TABLE "audit_template_questions" ADD COLUMN "hora_inicio" VARCHAR(5)`);
    }
    const has2 = await queryRunner.hasColumn('audit_template_questions', 'hora_fim');
    if (!has2) {
      await queryRunner.query(`ALTER TABLE "audit_template_questions" ADD COLUMN "hora_fim" VARCHAR(5)`);
    }
  }
  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "audit_template_questions" DROP COLUMN IF EXISTS "hora_inicio"`);
    await queryRunner.query(`ALTER TABLE "audit_template_questions" DROP COLUMN IF EXISTS "hora_fim"`);
  }
}
