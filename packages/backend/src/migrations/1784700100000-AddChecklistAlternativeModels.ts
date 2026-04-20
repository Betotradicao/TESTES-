import { MigrationInterface, QueryRunner } from "typeorm";

export class AddChecklistAlternativeModels1784700100000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Modelos de alternativas reutilizaveis (ex: Icones, Sim/Nao, Escala 1-5)
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "audit_alternative_models" (
        "id" SERIAL PRIMARY KEY,
        "nome" VARCHAR(255) NOT NULL,
        "tipo" VARCHAR(30) NOT NULL DEFAULT 'icones',
        "alternativas" JSONB NOT NULL DEFAULT '[]'::jsonb,
        "ativo" BOOLEAN DEFAULT true,
        "created_at" TIMESTAMP DEFAULT now(),
        "updated_at" TIMESTAMP DEFAULT now()
      )
    `);

    // Expande audit_templates com minimo esperado, observacao e grupos de acesso
    const hasMinimo = await queryRunner.hasColumn('audit_templates', 'minimo_esperado');
    if (!hasMinimo) {
      await queryRunner.query(`ALTER TABLE "audit_templates" ADD COLUMN "minimo_esperado" NUMERIC(5,2) DEFAULT 95`);
    }
    const hasObs = await queryRunner.hasColumn('audit_templates', 'observacao');
    if (hasObs) {
      // ja tem descricao, mas usamos como observacao; nada a fazer
    } else {
      await queryRunner.query(`ALTER TABLE "audit_templates" ADD COLUMN IF NOT EXISTS "observacao" TEXT`);
    }
    const hasGrupos = await queryRunner.hasColumn('audit_templates', 'grupos_acesso');
    if (!hasGrupos) {
      await queryRunner.query(`ALTER TABLE "audit_templates" ADD COLUMN "grupos_acesso" JSONB DEFAULT '[]'::jsonb`);
    }

    // Expande audit_template_questions com modelo de alternativa e config por alternativa
    const hasModeloId = await queryRunner.hasColumn('audit_template_questions', 'modelo_alternativa_id');
    if (!hasModeloId) {
      await queryRunner.query(`ALTER TABLE "audit_template_questions" ADD COLUMN "modelo_alternativa_id" INT`);
      await queryRunner.query(`
        ALTER TABLE "audit_template_questions"
        ADD CONSTRAINT "FK_audit_questions_modelo" FOREIGN KEY ("modelo_alternativa_id")
        REFERENCES "audit_alternative_models"("id") ON DELETE SET NULL
      `);
    }
    const hasAltConfig = await queryRunner.hasColumn('audit_template_questions', 'alternativas_config');
    if (!hasAltConfig) {
      await queryRunner.query(`ALTER TABLE "audit_template_questions" ADD COLUMN "alternativas_config" JSONB DEFAULT '[]'::jsonb`);
    }
    const hasImgsRef = await queryRunner.hasColumn('audit_template_questions', 'imagens_referencia');
    if (!hasImgsRef) {
      await queryRunner.query(`ALTER TABLE "audit_template_questions" ADD COLUMN "imagens_referencia" JSONB DEFAULT '[]'::jsonb`);
    }

    // Seed do modelo padrao "Icones" (positivo/negativo/NA/alerta)
    const hasModels = await queryRunner.query(`SELECT COUNT(*)::int AS c FROM "audit_alternative_models"`);
    if (hasModels?.[0]?.c === 0) {
      const alternativas = JSON.stringify([
        { ordem: 1, icone: 'smile_green', label: 'Conforme', valor: 1, cor: '#10b981' },
        { ordem: 2, icone: 'frown_red', label: 'Nao conforme', valor: -1, cor: '#ef4444' },
        { ordem: 3, icone: 'na_blue', label: 'N/A', valor: 0, cor: '#3b82f6' },
        { ordem: 4, icone: 'warning_yellow', label: 'Alerta', valor: 0, cor: '#f59e0b' },
      ]);
      await queryRunner.query(
        `INSERT INTO "audit_alternative_models" (nome, tipo, alternativas, ativo) VALUES ($1, $2, $3::jsonb, true)`,
        ['Icones Padrao', 'icones', alternativas]
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "audit_template_questions" DROP CONSTRAINT IF EXISTS "FK_audit_questions_modelo"`);
    await queryRunner.query(`ALTER TABLE "audit_template_questions" DROP COLUMN IF EXISTS "modelo_alternativa_id"`);
    await queryRunner.query(`ALTER TABLE "audit_template_questions" DROP COLUMN IF EXISTS "alternativas_config"`);
    await queryRunner.query(`ALTER TABLE "audit_template_questions" DROP COLUMN IF EXISTS "imagens_referencia"`);
    await queryRunner.query(`ALTER TABLE "audit_templates" DROP COLUMN IF EXISTS "minimo_esperado"`);
    await queryRunner.query(`ALTER TABLE "audit_templates" DROP COLUMN IF EXISTS "observacao"`);
    await queryRunner.query(`ALTER TABLE "audit_templates" DROP COLUMN IF EXISTS "grupos_acesso"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "audit_alternative_models"`);
  }
}
