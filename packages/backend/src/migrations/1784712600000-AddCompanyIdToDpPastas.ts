import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Adiciona company_id em dp_pastas (Departamento Pessoal multi-empresa).
 * Bug: o controller rh-dp.controller.ts espera essa coluna desde que o modulo
 * virou multi-empresa (multi-loja), mas a migration original criou a tabela
 * sem ela. Resultado: botao "Criar pasta" nao salvava (constraint quebrava).
 *
 * Esta migration:
 *  1. Adiciona company_id INT (nullable pra nao quebrar dados existentes)
 *  2. Troca o UNIQUE de (nome) pra (company_id, nome) — mesma pasta pode existir
 *     em empresas diferentes
 *  3. Cria index em company_id pra performance da listagem
 */
export class AddCompanyIdToDpPastas1784712600000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1) Adiciona coluna company_id se nao existir
    await queryRunner.query(`
      ALTER TABLE dp_pastas
      ADD COLUMN IF NOT EXISTS company_id INT NULL
    `);

    // 2) Remove o UNIQUE antigo em (nome) — pode ter nomes diferentes em diferentes constraints
    //    DROP CONSTRAINT pelo nome real (postgres gera dp_pastas_nome_key por padrao)
    await queryRunner.query(`
      DO $$
      DECLARE
        c_name text;
      BEGIN
        SELECT conname INTO c_name
        FROM pg_constraint
        WHERE conrelid = 'dp_pastas'::regclass
          AND contype = 'u'
          AND pg_get_constraintdef(oid) ILIKE '%(nome)%'
          AND pg_get_constraintdef(oid) NOT ILIKE '%company_id%'
        LIMIT 1;
        IF c_name IS NOT NULL THEN
          EXECUTE 'ALTER TABLE dp_pastas DROP CONSTRAINT ' || quote_ident(c_name);
        END IF;
      END $$;
    `);

    // 3) Cria UNIQUE composto (company_id, nome) — permite mesma pasta em empresas diferentes
    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint
          WHERE conrelid = 'dp_pastas'::regclass
            AND contype = 'u'
            AND pg_get_constraintdef(oid) ILIKE '%(company_id, nome)%'
        ) THEN
          ALTER TABLE dp_pastas ADD CONSTRAINT dp_pastas_company_nome_uk UNIQUE (company_id, nome);
        END IF;
      END $$;
    `);

    // 4) Index em company_id pra listagem
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_dp_pastas_company_id ON dp_pastas(company_id)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS idx_dp_pastas_company_id`);
    await queryRunner.query(`
      ALTER TABLE dp_pastas DROP CONSTRAINT IF EXISTS dp_pastas_company_nome_uk
    `);
    // Nao recriamos o UNIQUE em (nome) pra evitar conflito se ja existirem
    // duplicatas em empresas diferentes
    await queryRunner.query(`
      ALTER TABLE dp_pastas DROP COLUMN IF EXISTS company_id
    `);
  }
}
