import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateDvrDevices1784800000000 implements MigrationInterface {
    name = 'CreateDvrDevices1784800000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            CREATE TABLE IF NOT EXISTS "dvr_devices" (
                "id" SERIAL PRIMARY KEY,
                "name" VARCHAR(100) NOT NULL,
                "codigo_loja" INTEGER NOT NULL,
                "ip" VARCHAR(255) NOT NULL,
                "porta_http" INTEGER NOT NULL DEFAULT 80,
                "porta_rtsp" INTEGER NOT NULL DEFAULT 554,
                "usuario" VARCHAR(100),
                "senha" TEXT,
                "codec_mode" VARCHAR(20) NOT NULL DEFAULT 'transcode',
                "canais" JSONB NOT NULL DEFAULT '[]'::jsonb,
                "cameras_pdv" JSONB NOT NULL DEFAULT '[]'::jsonb,
                "cameras_bipagens" JSONB NOT NULL DEFAULT '[]'::jsonb,
                "cameras_risco" JSONB NOT NULL DEFAULT '[]'::jsonb,
                "antecedencia_segundos" INTEGER NOT NULL DEFAULT 15,
                "tempo_depois_segundos" INTEGER NOT NULL DEFAULT 120,
                "canal_padrao" INTEGER,
                "is_default" BOOLEAN NOT NULL DEFAULT false,
                "status" VARCHAR(20) NOT NULL DEFAULT 'active',
                "created_at" TIMESTAMP NOT NULL DEFAULT now(),
                "updated_at" TIMESTAMP NOT NULL DEFAULT now()
            )
        `);

        await queryRunner.query(`
            CREATE INDEX IF NOT EXISTS "idx_dvr_devices_codigo_loja" ON "dvr_devices"("codigo_loja")
        `);

        // Migração: cria 1 registro a partir da config atual em configurations (se existir dvr_ip)
        await queryRunner.query(`
            INSERT INTO "dvr_devices" (
                name, codigo_loja, ip, porta_http, porta_rtsp,
                usuario, senha, codec_mode,
                canais, cameras_pdv, cameras_bipagens, cameras_risco,
                antecedencia_segundos, tempo_depois_segundos, canal_padrao,
                is_default, status
            )
            SELECT
                'DVR Principal',
                COALESCE((SELECT cod_loja FROM companies WHERE active = true ORDER BY cod_loja ASC LIMIT 1), 1),
                (SELECT value FROM configurations WHERE key = 'dvr_ip'),
                COALESCE(NULLIF((SELECT value FROM configurations WHERE key = 'dvr_porta_http'), '')::int, 80),
                COALESCE(NULLIF((SELECT value FROM configurations WHERE key = 'dvr_porta_rtsp'), '')::int, 554),
                (SELECT value FROM configurations WHERE key = 'dvr_usuario'),
                (SELECT value FROM configurations WHERE key = 'dvr_senha'),
                COALESCE(NULLIF((SELECT value FROM configurations WHERE key = 'dvr_codec_mode'), ''), 'transcode'),
                COALESCE(NULLIF((SELECT value FROM configurations WHERE key = 'dvr_canais'), '')::jsonb, '[]'::jsonb),
                COALESCE(NULLIF((SELECT value FROM configurations WHERE key = 'dvr_cameras_pdv'), '')::jsonb, '[]'::jsonb),
                COALESCE(NULLIF((SELECT value FROM configurations WHERE key = 'dvr_cameras_bipagens'), '')::jsonb, '[]'::jsonb),
                COALESCE(NULLIF((SELECT value FROM configurations WHERE key = 'dvr_cameras_risco'), '')::jsonb, '[]'::jsonb),
                COALESCE(NULLIF((SELECT value FROM configurations WHERE key = 'dvr_antecedencia_segundos'), '')::int, 15),
                COALESCE(NULLIF((SELECT value FROM configurations WHERE key = 'dvr_tempo_depois_segundos'), '')::int, 120),
                NULLIF((SELECT value FROM configurations WHERE key = 'dvr_canal_padrao'), '')::int,
                true,
                'active'
            WHERE EXISTS (
                SELECT 1 FROM configurations WHERE key = 'dvr_ip' AND value IS NOT NULL AND value <> ''
            )
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX IF EXISTS "idx_dvr_devices_codigo_loja"`);
        await queryRunner.query(`DROP TABLE IF EXISTS "dvr_devices"`);
    }
}
