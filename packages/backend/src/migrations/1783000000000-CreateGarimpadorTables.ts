import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateGarimpadorTables1783000000000 implements MigrationInterface {

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Tabela de contatos
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "garimpador_contatos" (
        "id" SERIAL PRIMARY KEY,
        "telefone" VARCHAR(30) NOT NULL,
        "nome" VARCHAR(255),
        "tipo" VARCHAR(20) DEFAULT 'nao_classificado',
        "ativo" BOOLEAN DEFAULT true,
        "created_at" TIMESTAMP DEFAULT now(),
        "updated_at" TIMESTAMP DEFAULT now(),
        CONSTRAINT "UQ_garimpador_contatos_telefone" UNIQUE ("telefone")
      )
    `);

    // Tabela de mensagens
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "garimpador_mensagens" (
        "id" SERIAL PRIMARY KEY,
        "contato_id" INT NOT NULL,
        "remote_jid" VARCHAR(100),
        "sender_name" VARCHAR(255),
        "tipo_midia" VARCHAR(20) DEFAULT 'texto',
        "conteudo_original" TEXT,
        "conteudo_extraido" TEXT,
        "media_url" TEXT,
        "media_mimetype" VARCHAR(100),
        "processado" BOOLEAN DEFAULT false,
        "message_id" VARCHAR(100),
        "received_at" TIMESTAMP,
        "created_at" TIMESTAMP DEFAULT now(),
        CONSTRAINT "UQ_garimpador_mensagens_message_id" UNIQUE ("message_id"),
        CONSTRAINT "FK_garimpador_mensagens_contato" FOREIGN KEY ("contato_id")
          REFERENCES "garimpador_contatos" ("id") ON DELETE CASCADE
      )
    `);

    // Índices
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_garimpador_contatos_tipo"
      ON "garimpador_contatos" ("tipo")
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_garimpador_mensagens_contato"
      ON "garimpador_mensagens" ("contato_id")
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_garimpador_mensagens_processado"
      ON "garimpador_mensagens" ("processado")
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_garimpador_mensagens_received"
      ON "garimpador_mensagens" ("received_at")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "garimpador_mensagens"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "garimpador_contatos"`);
  }
}
