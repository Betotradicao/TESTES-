import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Conserta a FK de `dp_pastas.company_id`:
 * - Antes: apontava pra `companies(id)` (tabela global, integer ou uuid)
 * - Depois: aponta pra `rh_empresas(id)` (tabela do RH, sempre uuid)
 *
 * Em alguns clientes antigos, `dp_pastas.company_id` foi criado como INTEGER.
 * `rh_empresas.id` e UUID. Pra criar a FK, a coluna precisa ser UUID.
 *
 * Estrategia:
 *   1. Drop FK antiga (se existir)
 *   2. Detectar tipo da coluna company_id
 *   3. Se for integer (legacy), DROP a coluna e recriar como UUID
 *      (dados existentes sao perdidos — o frontend repopula com
 *      seleciao de loja na proxima criacao de pasta)
 *   4. Limpar orfaos (com cast seguro)
 *   5. Criar FK nova pra rh_empresas
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
            AND conname IN (
              SELECT conname FROM pg_constraint
              WHERE conrelid = 'dp_pastas'::regclass
                AND contype = 'f'
            )
        LOOP
          BEGIN
            EXECUTE 'ALTER TABLE dp_pastas DROP CONSTRAINT IF EXISTS ' || quote_ident(c_name);
          EXCEPTION WHEN others THEN NULL;
          END;
        END LOOP;
      END $$;
    `);

    // 2) Detecta o tipo atual de dp_pastas.company_id
    const colInfo = await queryRunner.query(`
      SELECT data_type
      FROM information_schema.columns
      WHERE table_name = 'dp_pastas' AND column_name = 'company_id'
    `);

    const tipoAtual = colInfo[0]?.data_type;

    if (!tipoAtual) {
      // Coluna nao existe — adiciona como UUID nullable
      await queryRunner.query(`ALTER TABLE dp_pastas ADD COLUMN company_id UUID NULL`);
    } else if (tipoAtual !== 'uuid') {
      // Coluna existe mas e int ou outro tipo — drop e recria como UUID
      await queryRunner.query(`ALTER TABLE dp_pastas DROP COLUMN company_id`);
      await queryRunner.query(`ALTER TABLE dp_pastas ADD COLUMN company_id UUID NULL`);
    } else {
      // Ja e UUID — so limpa orfaos
      await queryRunner.query(`
        UPDATE dp_pastas
        SET company_id = NULL
        WHERE company_id IS NOT NULL
          AND company_id NOT IN (SELECT id FROM rh_empresas)
      `);
    }

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
