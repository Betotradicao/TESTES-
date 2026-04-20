import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateChecklistAuditTables1784700000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Flags novos em employees (auditor / auditado / permissoes)
    const empTable = await queryRunner.hasTable('employees');
    if (empTable) {
      const cols = [
        ['is_auditor', 'boolean DEFAULT false'],
        ['is_auditado', 'boolean DEFAULT false'],
        ['can_create_audit_templates', 'boolean DEFAULT false'],
        ['can_approve_audit_actions', 'boolean DEFAULT false'],
      ];
      for (const [col, def] of cols) {
        const has = await queryRunner.hasColumn('employees', col);
        if (!has) {
          await queryRunner.query(`ALTER TABLE "employees" ADD COLUMN "${col}" ${def}`);
        }
      }
    }

    // Templates de checklist (roteiros de auditoria)
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "audit_templates" (
        "id" SERIAL PRIMARY KEY,
        "nome" VARCHAR(255) NOT NULL,
        "descricao" TEXT,
        "cod_loja" INTEGER,
        "ativo" BOOLEAN DEFAULT true,
        "prazo_alta_horas" INTEGER DEFAULT 24,
        "prazo_media_dias" INTEGER DEFAULT 7,
        "prazo_baixa_dias" INTEGER DEFAULT 30,
        "created_by" VARCHAR(100),
        "created_at" TIMESTAMP DEFAULT now(),
        "updated_at" TIMESTAMP DEFAULT now()
      )
    `);

    // Secoes dentro do template (ex: Acougue, Padaria, FLV)
    // Usa sector_id opcional pra reuso de setores ja cadastrados
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "audit_template_sections" (
        "id" SERIAL PRIMARY KEY,
        "template_id" INT NOT NULL,
        "sector_id" INT,
        "nome" VARCHAR(255) NOT NULL,
        "ordem" INT DEFAULT 0,
        "created_at" TIMESTAMP DEFAULT now(),
        CONSTRAINT "FK_audit_sections_template" FOREIGN KEY ("template_id")
          REFERENCES "audit_templates"("id") ON DELETE CASCADE
      )
    `);

    // Perguntas do checklist
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "audit_template_questions" (
        "id" SERIAL PRIMARY KEY,
        "section_id" INT NOT NULL,
        "texto" TEXT NOT NULL,
        "tipo" VARCHAR(30) NOT NULL DEFAULT 'conforme',
        "criticidade" VARCHAR(10) DEFAULT 'media',
        "peso" NUMERIC(6,2) DEFAULT 1,
        "foto_obrigatoria" BOOLEAN DEFAULT false,
        "opcoes" JSONB,
        "ordem" INT DEFAULT 0,
        "created_at" TIMESTAMP DEFAULT now(),
        CONSTRAINT "FK_audit_questions_section" FOREIGN KEY ("section_id")
          REFERENCES "audit_template_sections"("id") ON DELETE CASCADE
      )
    `);

    // Execucoes de auditoria
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "audit_inspections" (
        "id" SERIAL PRIMARY KEY,
        "template_id" INT NOT NULL,
        "auditor_id" UUID NOT NULL,
        "auditado_id" UUID,
        "cod_loja" INTEGER,
        "status" VARCHAR(20) DEFAULT 'rascunho',
        "started_at" TIMESTAMP,
        "finished_at" TIMESTAMP,
        "gps_inicio_lat" NUMERIC(10,7),
        "gps_inicio_lng" NUMERIC(10,7),
        "score_final" NUMERIC(6,2),
        "score_max" NUMERIC(6,2),
        "percentual_conformidade" NUMERIC(5,2),
        "observacao_geral" TEXT,
        "assinatura_auditor_url" TEXT,
        "assinatura_auditado_url" TEXT,
        "created_at" TIMESTAMP DEFAULT now(),
        "updated_at" TIMESTAMP DEFAULT now(),
        CONSTRAINT "FK_audit_inspections_template" FOREIGN KEY ("template_id")
          REFERENCES "audit_templates"("id"),
        CONSTRAINT "FK_audit_inspections_auditor" FOREIGN KEY ("auditor_id")
          REFERENCES "employees"("id"),
        CONSTRAINT "FK_audit_inspections_auditado" FOREIGN KEY ("auditado_id")
          REFERENCES "employees"("id")
      )
    `);

    // Respostas por pergunta
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "audit_responses" (
        "id" SERIAL PRIMARY KEY,
        "inspection_id" INT NOT NULL,
        "question_id" INT NOT NULL,
        "conforme" VARCHAR(3),
        "valor_texto" TEXT,
        "valor_numero" NUMERIC(12,4),
        "valor_opcao" VARCHAR(255),
        "observacao" TEXT,
        "fotos" JSONB DEFAULT '[]'::jsonb,
        "gps_lat" NUMERIC(10,7),
        "gps_lng" NUMERIC(10,7),
        "score_obtido" NUMERIC(6,2),
        "created_at" TIMESTAMP DEFAULT now(),
        "updated_at" TIMESTAMP DEFAULT now(),
        CONSTRAINT "FK_audit_responses_inspection" FOREIGN KEY ("inspection_id")
          REFERENCES "audit_inspections"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_audit_responses_question" FOREIGN KEY ("question_id")
          REFERENCES "audit_template_questions"("id"),
        CONSTRAINT "UQ_audit_response_per_question" UNIQUE ("inspection_id","question_id")
      )
    `);

    // Planos de acao 5W2H
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "audit_actions" (
        "id" SERIAL PRIMARY KEY,
        "inspection_id" INT NOT NULL,
        "response_id" INT,
        "what" TEXT NOT NULL,
        "why" TEXT,
        "who_employee_id" UUID,
        "when_prazo" TIMESTAMP,
        "where_setor" VARCHAR(255),
        "how" TEXT,
        "how_much" NUMERIC(12,2),
        "criticidade" VARCHAR(10) DEFAULT 'media',
        "status" VARCHAR(20) DEFAULT 'aberta',
        "cod_loja" INTEGER,
        "concluido_em" TIMESTAMP,
        "concluido_por" UUID,
        "created_at" TIMESTAMP DEFAULT now(),
        "updated_at" TIMESTAMP DEFAULT now(),
        CONSTRAINT "FK_audit_actions_inspection" FOREIGN KEY ("inspection_id")
          REFERENCES "audit_inspections"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_audit_actions_response" FOREIGN KEY ("response_id")
          REFERENCES "audit_responses"("id") ON DELETE SET NULL,
        CONSTRAINT "FK_audit_actions_who" FOREIGN KEY ("who_employee_id")
          REFERENCES "employees"("id")
      )
    `);

    // Historico de mudancas de status das acoes
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "audit_action_history" (
        "id" SERIAL PRIMARY KEY,
        "action_id" INT NOT NULL,
        "status_anterior" VARCHAR(20),
        "status_novo" VARCHAR(20),
        "alterado_por" UUID,
        "comentario" TEXT,
        "created_at" TIMESTAMP DEFAULT now(),
        CONSTRAINT "FK_audit_action_history_action" FOREIGN KEY ("action_id")
          REFERENCES "audit_actions"("id") ON DELETE CASCADE
      )
    `);

    // Indices pra performance
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_audit_sections_template" ON "audit_template_sections"("template_id")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_audit_questions_section" ON "audit_template_questions"("section_id")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_audit_inspections_loja" ON "audit_inspections"("cod_loja")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_audit_inspections_status" ON "audit_inspections"("status")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_audit_inspections_template" ON "audit_inspections"("template_id")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_audit_responses_inspection" ON "audit_responses"("inspection_id")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_audit_actions_status" ON "audit_actions"("status")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_audit_actions_loja" ON "audit_actions"("cod_loja")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_audit_actions_prazo" ON "audit_actions"("when_prazo")`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "audit_action_history"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "audit_actions"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "audit_responses"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "audit_inspections"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "audit_template_questions"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "audit_template_sections"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "audit_templates"`);
    await queryRunner.query(`ALTER TABLE "employees" DROP COLUMN IF EXISTS "is_auditor"`);
    await queryRunner.query(`ALTER TABLE "employees" DROP COLUMN IF EXISTS "is_auditado"`);
    await queryRunner.query(`ALTER TABLE "employees" DROP COLUMN IF EXISTS "can_create_audit_templates"`);
    await queryRunner.query(`ALTER TABLE "employees" DROP COLUMN IF EXISTS "can_approve_audit_actions"`);
  }
}
