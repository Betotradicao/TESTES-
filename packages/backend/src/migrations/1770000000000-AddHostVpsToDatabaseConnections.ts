import { MigrationInterface, QueryRunner } from "typeorm";

export class AddHostVpsToDatabaseConnections1770000000000 implements MigrationInterface {
    name = 'AddHostVpsToDatabaseConnections1770000000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Adiciona coluna host_vps com valor padrão 172.20.0.1 (gateway Docker)
        await queryRunner.query(`
            ALTER TABLE "database_connections"
            ADD COLUMN IF NOT EXISTS "host_vps" varchar(255) DEFAULT '172.20.0.1'
        `);

        // Atualiza registros existentes para ter o valor padrão
        await queryRunner.query(`
            UPDATE "database_connections"
            SET "host_vps" = '172.20.0.1'
            WHERE "host_vps" IS NULL
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            ALTER TABLE "database_connections"
            DROP COLUMN IF EXISTS "host_vps"
        `);
    }
}
