import { MigrationInterface, QueryRunner } from "typeorm";

export class AddScheduleRulesToQuestions1784700300000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Templates: grupos de acesso para AUDITADOS (colaboradores liberados pra serem auditados)
    const hasAuditados = await queryRunner.hasColumn('audit_templates', 'grupos_acesso_auditados');
    if (!hasAuditados) {
      await queryRunner.query(`ALTER TABLE "audit_templates" ADD COLUMN "grupos_acesso_auditados" JSONB DEFAULT '[]'::jsonb`);
    }

    // Questions: regras de agendamento
    // dias_semana: array de 0-6 (0=Dom, 1=Seg, ..., 6=Sab). Vazio = todo dia.
    const hasDs = await queryRunner.hasColumn('audit_template_questions', 'dias_semana');
    if (!hasDs) {
      await queryRunner.query(`ALTER TABLE "audit_template_questions" ADD COLUMN "dias_semana" JSONB DEFAULT '[]'::jsonb`);
    }
    // dias_mes_especificos: array de 1-31
    const hasDm = await queryRunner.hasColumn('audit_template_questions', 'dias_mes_especificos');
    if (!hasDm) {
      await queryRunner.query(`ALTER TABLE "audit_template_questions" ADD COLUMN "dias_mes_especificos" JSONB DEFAULT '[]'::jsonb`);
    }
    const hasPd = await queryRunner.hasColumn('audit_template_questions', 'primeiro_dia_mes');
    if (!hasPd) {
      await queryRunner.query(`ALTER TABLE "audit_template_questions" ADD COLUMN "primeiro_dia_mes" BOOLEAN DEFAULT false`);
    }
    const hasUd = await queryRunner.hasColumn('audit_template_questions', 'ultimo_dia_mes');
    if (!hasUd) {
      await queryRunner.query(`ALTER TABLE "audit_template_questions" ADD COLUMN "ultimo_dia_mes" BOOLEAN DEFAULT false`);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "audit_template_questions" DROP COLUMN IF EXISTS "dias_semana"`);
    await queryRunner.query(`ALTER TABLE "audit_template_questions" DROP COLUMN IF EXISTS "dias_mes_especificos"`);
    await queryRunner.query(`ALTER TABLE "audit_template_questions" DROP COLUMN IF EXISTS "primeiro_dia_mes"`);
    await queryRunner.query(`ALTER TABLE "audit_template_questions" DROP COLUMN IF EXISTS "ultimo_dia_mes"`);
    await queryRunner.query(`ALTER TABLE "audit_templates" DROP COLUMN IF EXISTS "grupos_acesso_auditados"`);
  }
}
