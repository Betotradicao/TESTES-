import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateDisparoWhatsappTables1784000000000 implements MigrationInterface {

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Tabela de contatos para disparo
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "disparo_contatos" (
        "id" SERIAL PRIMARY KEY,
        "telefone" VARCHAR(30) NOT NULL,
        "nome" VARCHAR(255),
        "tags" VARCHAR(255),
        "score" INT DEFAULT 50,
        "status" VARCHAR(20) DEFAULT 'active',
        "total_enviados" INT DEFAULT 0,
        "total_entregues" INT DEFAULT 0,
        "total_lidos" INT DEFAULT 0,
        "total_falhas" INT DEFAULT 0,
        "last_interaction_at" TIMESTAMP,
        "inactivated_at" TIMESTAMP,
        "created_at" TIMESTAMP DEFAULT now(),
        "updated_at" TIMESTAMP DEFAULT now(),
        CONSTRAINT "UQ_disparo_contatos_telefone" UNIQUE ("telefone")
      )
    `);

    // Tabela de campanhas
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "disparo_campanhas" (
        "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "nome" VARCHAR(255) NOT NULL,
        "mensagem_texto" TEXT,
        "imagem_url" TEXT,
        "imagem_base64" TEXT,
        "status" VARCHAR(20) DEFAULT 'draft',
        "total_contatos" INT DEFAULT 0,
        "enviados" INT DEFAULT 0,
        "entregues" INT DEFAULT 0,
        "lidos" INT DEFAULT 0,
        "falharam" INT DEFAULT 0,
        "delay_min_ms" INT DEFAULT 4000,
        "delay_max_ms" INT DEFAULT 6000,
        "daily_limit" INT DEFAULT 3500,
        "started_at" TIMESTAMP,
        "completed_at" TIMESTAMP,
        "created_at" TIMESTAMP DEFAULT now(),
        "updated_at" TIMESTAMP DEFAULT now()
      )
    `);

    // Tabela de log de mensagens por contato/campanha
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "disparo_mensagens" (
        "id" SERIAL PRIMARY KEY,
        "campanha_id" UUID NOT NULL,
        "contato_id" INT NOT NULL,
        "telefone" VARCHAR(30),
        "nome_contato" VARCHAR(255),
        "evolution_msg_id" VARCHAR(100),
        "status" VARCHAR(20) DEFAULT 'pending',
        "error_message" TEXT,
        "sent_at" TIMESTAMP,
        "delivered_at" TIMESTAMP,
        "read_at" TIMESTAMP,
        "created_at" TIMESTAMP DEFAULT now(),
        CONSTRAINT "FK_disparo_mensagens_campanha" FOREIGN KEY ("campanha_id")
          REFERENCES "disparo_campanhas" ("id") ON DELETE CASCADE,
        CONSTRAINT "FK_disparo_mensagens_contato" FOREIGN KEY ("contato_id")
          REFERENCES "disparo_contatos" ("id") ON DELETE CASCADE
      )
    `);

    // Indices
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_disparo_contatos_status" ON "disparo_contatos" ("status")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_disparo_contatos_score" ON "disparo_contatos" ("score")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_disparo_campanhas_status" ON "disparo_campanhas" ("status")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_disparo_mensagens_campanha" ON "disparo_mensagens" ("campanha_id")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_disparo_mensagens_contato" ON "disparo_mensagens" ("contato_id")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_disparo_mensagens_status" ON "disparo_mensagens" ("status")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_disparo_mensagens_evolution" ON "disparo_mensagens" ("evolution_msg_id")`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "disparo_mensagens"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "disparo_campanhas"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "disparo_contatos"`);
  }
}
