import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateAIConsultantTables1781300000000 implements MigrationInterface {
    name = 'CreateAIConsultantTables1781300000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Tabela de conversas
        await queryRunner.query(`
            CREATE TABLE IF NOT EXISTS "ai_conversations" (
                "id" SERIAL PRIMARY KEY,
                "user_id" int NOT NULL,
                "title" varchar(255) DEFAULT 'Nova conversa',
                "created_at" TIMESTAMP DEFAULT now(),
                "updated_at" TIMESTAMP DEFAULT now()
            )
        `);

        await queryRunner.query(`
            CREATE INDEX IF NOT EXISTS "idx_ai_conversations_user" ON "ai_conversations" ("user_id")
        `);

        // Tabela de mensagens
        await queryRunner.query(`
            CREATE TABLE IF NOT EXISTS "ai_messages" (
                "id" SERIAL PRIMARY KEY,
                "conversation_id" int NOT NULL REFERENCES "ai_conversations"("id") ON DELETE CASCADE,
                "role" varchar(20) NOT NULL DEFAULT 'user',
                "content" text NOT NULL,
                "function_call" jsonb,
                "created_at" TIMESTAMP DEFAULT now()
            )
        `);

        await queryRunner.query(`
            CREATE INDEX IF NOT EXISTS "idx_ai_messages_conversation" ON "ai_messages" ("conversation_id")
        `);

        // Tabela de insights aprendidos
        await queryRunner.query(`
            CREATE TABLE IF NOT EXISTS "ai_insights" (
                "id" SERIAL PRIMARY KEY,
                "category" varchar(100) NOT NULL,
                "content" text NOT NULL,
                "source" varchar(255),
                "relevance_score" decimal(3,2) DEFAULT 1.00,
                "created_at" TIMESTAMP DEFAULT now()
            )
        `);

        await queryRunner.query(`
            CREATE INDEX IF NOT EXISTS "idx_ai_insights_category" ON "ai_insights" ("category")
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TABLE IF EXISTS "ai_messages"`);
        await queryRunner.query(`DROP TABLE IF EXISTS "ai_conversations"`);
        await queryRunner.query(`DROP TABLE IF EXISTS "ai_insights"`);
    }
}
