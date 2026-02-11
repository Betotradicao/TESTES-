import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateFornecedorAgendamentosTable1781400000000 implements MigrationInterface {
    name = 'CreateFornecedorAgendamentosTable1781400000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            CREATE TABLE IF NOT EXISTS "fornecedor_agendamentos" (
                "id" SERIAL PRIMARY KEY,
                "cod_fornecedor" int NOT NULL UNIQUE,
                "freq_visita" varchar(30),
                "dia_semana_1" varchar(20),
                "dia_semana_2" varchar(20),
                "dia_semana_3" varchar(20),
                "dia_mes" int,
                "inicio_agendamento" date,
                "created_at" TIMESTAMP DEFAULT now(),
                "updated_at" TIMESTAMP DEFAULT now()
            )
        `);

        await queryRunner.query(`
            CREATE UNIQUE INDEX IF NOT EXISTS "idx_fornecedor_agendamentos_cod"
            ON "fornecedor_agendamentos" ("cod_fornecedor")
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TABLE IF EXISTS "fornecedor_agendamentos"`);
    }
}
