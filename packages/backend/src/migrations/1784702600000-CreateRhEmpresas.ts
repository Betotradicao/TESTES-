import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateRhEmpresas1784702600000 implements MigrationInterface {
  name = 'CreateRhEmpresas1784702600000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 0) Se existe rh_empresas legado com schema antigo (nome/cnpj/endereco do stub antigo), dropa
    //    - os stubs antigos nunca foram funcionais, entao a tabela deve estar vazia ou com dados irrelevantes
    const legado = await queryRunner.query(`
      SELECT 1 FROM information_schema.columns
      WHERE table_name = 'rh_empresas' AND column_name = 'nome_fantasia' LIMIT 1
    `);
    if (!legado || legado.length === 0) {
      await queryRunner.query(`DROP TABLE IF EXISTS rh_empresas CASCADE`);
    }
    // 1) Cria a tabela rh_empresas (independente da tabela companies global)
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS rh_empresas (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        nome_fantasia VARCHAR(255) NULL,
        razao_social VARCHAR(255) NULL,
        cnpj VARCHAR(255) NULL,
        cod_loja INT NULL,
        apelido VARCHAR(255) NULL,
        is_principal BOOLEAN DEFAULT false,
        responsavel_nome VARCHAR(255) NULL,
        responsavel_email VARCHAR(255) NULL,
        responsavel_telefone VARCHAR(255) NULL,
        cep VARCHAR(255) NULL,
        rua VARCHAR(255) NULL,
        numero VARCHAR(255) NULL,
        complemento VARCHAR(255) NULL,
        bairro VARCHAR(255) NULL,
        cidade VARCHAR(255) NULL,
        estado VARCHAR(255) NULL,
        telefone VARCHAR(255) NULL,
        email VARCHAR(255) NULL,
        active BOOLEAN DEFAULT true,
        foto_fachada_url TEXT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // 2) Seed inicial: copia empresas atuais de companies pra rh_empresas preservando UUIDs
    //    - so acontece no primeiro deploy (INSERT..SELECT com ON CONFLICT DO NOTHING)
    //    - preserva o vinculo rh_colaboradores.company_id -> rh_empresas.id
    //    - apos o deploy, usuario edita/deleta pela aba Empresas do RH conforme quiser
    await queryRunner.query(`
      INSERT INTO rh_empresas (
        id, nome_fantasia, razao_social, cnpj, cod_loja, apelido, is_principal,
        responsavel_nome, responsavel_email, responsavel_telefone,
        cep, rua, numero, complemento, bairro, cidade, estado,
        telefone, email, active, foto_fachada_url, created_at, updated_at
      )
      SELECT
        c.id, c.nome_fantasia, c.razao_social, c.cnpj, c.cod_loja, c.apelido,
        (c.cod_loja IS NULL), c.responsavel_nome, c.responsavel_email, c.responsavel_telefone,
        c.cep, c.rua, c.numero, c.complemento, c.bairro, c.cidade, c.estado,
        c.telefone, c.email, COALESCE(c.active, true), c.foto_fachada_url,
        c.created_at, c.updated_at
      FROM companies c
      ON CONFLICT (id) DO NOTHING
    `);

    // 3) Re-aponta o FK de rh_colaboradores.company_id para rh_empresas
    //    (drop do FK antigo e cria novo)
    await queryRunner.query(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1 FROM information_schema.table_constraints
          WHERE table_name = 'rh_colaboradores'
            AND constraint_type = 'FOREIGN KEY'
            AND constraint_name LIKE '%company_id%'
        ) THEN
          EXECUTE (
            SELECT 'ALTER TABLE rh_colaboradores DROP CONSTRAINT ' || constraint_name
            FROM information_schema.table_constraints
            WHERE table_name = 'rh_colaboradores'
              AND constraint_type = 'FOREIGN KEY'
              AND constraint_name LIKE '%company_id%'
            LIMIT 1
          );
        END IF;
      END $$;
    `);
    await queryRunner.query(`
      ALTER TABLE rh_colaboradores
      ADD CONSTRAINT rh_colaboradores_company_id_fkey
      FOREIGN KEY (company_id) REFERENCES rh_empresas(id) ON DELETE SET NULL
    `);

    // 4) Indices
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_rh_empresas_cod_loja ON rh_empresas(cod_loja)`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_rh_empresas_active ON rh_empresas(active)`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE rh_colaboradores
      DROP CONSTRAINT IF EXISTS rh_colaboradores_company_id_fkey
    `);
    await queryRunner.query(`
      ALTER TABLE rh_colaboradores
      ADD CONSTRAINT rh_colaboradores_company_id_fkey
      FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE SET NULL
    `);
    await queryRunner.query(`DROP TABLE IF EXISTS rh_empresas`);
  }
}
