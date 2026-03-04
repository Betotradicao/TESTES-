import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateMetasTable1783200000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "metas" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "nome" varchar(255) NOT NULL,
        "tipo" varchar(50) NOT NULL DEFAULT 'loja',
        "indicador" varchar(50) NOT NULL DEFAULT 'lucro',
        "mes" integer NOT NULL,
        "ano" integer NOT NULL,
        "cod_loja" integer,
        "inflacao" decimal(10,2) NOT NULL DEFAULT 0,
        "crescimento" decimal(10,2) NOT NULL DEFAULT 0,
        "total_crescimento" decimal(10,2) NOT NULL DEFAULT 0,
        "ativo" boolean NOT NULL DEFAULT true,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_metas" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "meta_responsaveis" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "meta_id" uuid NOT NULL,
        "employee_id" uuid NOT NULL,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_meta_responsaveis" PRIMARY KEY ("id"),
        CONSTRAINT "FK_meta_responsaveis_meta" FOREIGN KEY ("meta_id") REFERENCES "metas"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_meta_responsaveis_employee" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE CASCADE,
        CONSTRAINT "UQ_meta_responsaveis" UNIQUE ("meta_id", "employee_id")
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "meta_responsaveis"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "metas"`);
  }
}
