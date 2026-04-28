import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Conserta a FK de `dp_pastas.company_id`:
 * - Antes: apontava pra `companies(id)` (tabela global)
 * - Depois: aponta pra `rh_empresas(id)` (tabela do RH, que e quem o
 *   frontend de Departamento Pessoal usa em /rh/empresas/stores/list).
 *
 * Os tipos ja sao UUID em ambos os lados, so precisa trocar a FK.
 *
 * Tambem limpa registros orfaos (cujo company_id nao existe em rh_empresas)
 * pra que a FK nova consiga ser criada.
 */
export class FixDpPastasCompanyIdToRhEmpresas1784713100000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1) Drop FK antiga que aponta pra companies
    await queryRunner.query(`
      DO $$
      DECLARE
        c_name text;
      BEGIN
        FOR c_name IN
          SELECT conname FROM pg_constraint
          WHERE conrelid = 'dp_pastas'::regclass
            AND contype = 'f'
            AND pg_get_constraintdef(oid) ILIKE '%companies%'
        LOOP
          EXECUTE 'ALTER TABLE dp_pastas DROP CONSTRAINT IF EXISTS ' || quote_ident(c_name);
        END LOOP;
      END $$;
    `);

    // 2) Limpa orfaos: company_id que nao existe em rh_empresas (incluindo seed antigo)
    await queryRunner.query(`
      UPDATE dp_pastas
      SET company_id = NULL
      WHERE company_id IS NOT NULL
        AND company_id NOT IN (SELECT id FROM rh_empresas)
    `);

    // 3) Cria FK nova apontando pra rh_empresas
    await queryRunner.query(`
      ALTER TABLE dp_pastas
      ADD CONSTRAINT dp_pastas_rh_empresa_fk FOREIGN KEY (company_id)
      REFERENCES rh_empresas(id) ON DELETE SET NULL
    `);

    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_dp_pastas_company_id ON dp_pastas(company_id)`);
  }

  public async down(_queryRunner: QueryRunner): Promise<void> {
    // Down nao restaura a FK pra companies (manter a correta)
  }
}
