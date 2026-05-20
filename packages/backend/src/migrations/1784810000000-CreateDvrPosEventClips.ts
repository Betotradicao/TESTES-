import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Tabela para pre-geracao de clipes DVR dos eventos do PDV
 * (Canc. Item, Canc. Cupom, Canc. Venda, Desconto) visiveis no Vision Palavra-Chave.
 *
 * Esses eventos vem do Oracle/PG do cliente (sem tabela local nossa). O cron a cada 2h
 * busca os eventos das ultimas 48h e gera o clipe MP4 em background. Quando o usuario
 * clica Play, o backend serve o arquivo pre-gerado em vez de chamar ffmpeg na hora.
 *
 * Retencao: 2 dias. Cron diario apaga arquivos antigos + zera registros.
 *
 * event_key garante idempotencia: cod_loja|pdv|cupom|tipo|time.
 */
export class CreateDvrPosEventClips1784810000000 implements MigrationInterface {
    name = 'CreateDvrPosEventClips1784810000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            CREATE TABLE IF NOT EXISTS "dvr_pos_event_clips" (
                "id" SERIAL PRIMARY KEY,
                "event_key" VARCHAR(160) NOT NULL UNIQUE,
                "cod_loja" INTEGER NOT NULL,
                "pdv" INTEGER NOT NULL,
                "cupom_num" INTEGER NOT NULL,
                "event_time" TIMESTAMP NOT NULL,
                "tipo" VARCHAR(20) NOT NULL,
                "channel" INTEGER NOT NULL,
                "filename" VARCHAR(255),
                "clip_status" VARCHAR(30),
                "clip_retry_count" INTEGER NOT NULL DEFAULT 0,
                "clip_generated_at" TIMESTAMP,
                "created_at" TIMESTAMP NOT NULL DEFAULT now()
            )
        `);

        await queryRunner.query(`
            CREATE INDEX IF NOT EXISTS "idx_dvr_pos_event_clips_lookup"
                ON "dvr_pos_event_clips"("cod_loja", "event_time")
        `);

        await queryRunner.query(`
            CREATE INDEX IF NOT EXISTS "idx_dvr_pos_event_clips_cleanup"
                ON "dvr_pos_event_clips"("clip_status", "clip_generated_at")
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX IF EXISTS "idx_dvr_pos_event_clips_cleanup"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "idx_dvr_pos_event_clips_lookup"`);
        await queryRunner.query(`DROP TABLE IF EXISTS "dvr_pos_event_clips"`);
    }
}
