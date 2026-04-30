import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Cria tabelas base do modulo RH com IF NOT EXISTS.
 *
 * Em clientes ANTIGOS (Tradicao, Nunes, etc) as tabelas ja foram criadas
 * via TypeORM synchronize antigamente — IF NOT EXISTS vira no-op.
 *
 * Em clientes NOVOS (mameva e futuros) essas tabelas nao existem, o que
 * fazia as migrations posteriores (AddCargaHorariaToRhJornadas etc)
 * falharem com "relation does not exist".
 *
 * Schema MINIMO suficiente pras migrations posteriores conseguirem
 * fazer ADD COLUMN. Colunas adicionais sao adicionadas pelas migrations
 * que ja existem no historico.
 */
export class CreateRhBaseTables1784700500000 implements MigrationInterface {
  name = 'CreateRhBaseTables1784700500000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS rh_jornadas (
        id SERIAL PRIMARY KEY,
        nome VARCHAR(255) NOT NULL,
        descricao TEXT NULL,
        ativo BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS rh_cargos (
        id SERIAL PRIMARY KEY,
        nome VARCHAR(255) NOT NULL,
        descricao TEXT NULL,
        ativo BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS rh_escolaridades (
        id SERIAL PRIMARY KEY,
        nome VARCHAR(255) NOT NULL,
        ativo BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS rh_escalas (
        id SERIAL PRIMARY KEY,
        nome VARCHAR(255) NOT NULL,
        descricao TEXT NULL,
        ativo BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS rh_regimes_trabalho (
        id SERIAL PRIMARY KEY,
        nome VARCHAR(255) NOT NULL,
        descricao TEXT NULL,
        ativo BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS rh_departamentos (
        id SERIAL PRIMARY KEY,
        nome VARCHAR(255) NOT NULL,
        descricao TEXT NULL,
        ativo BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);

    // Tabela base de colaboradores. Migrations posteriores adicionam:
    // escala_id, company_id, sector_id, beneficios_ids, departamento_id,
    // tipo_desligamento_id, motivo_desligamento_id, escala_domingo_id, foto_url etc
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS rh_colaboradores (
        id SERIAL PRIMARY KEY,
        nome VARCHAR(255) NOT NULL,
        cpf VARCHAR(14) UNIQUE,
        rg VARCHAR(20) NULL,
        data_nascimento DATE NULL,
        sexo VARCHAR(20) NULL,
        estado_civil VARCHAR(30) NULL,
        nacionalidade VARCHAR(50) NULL,
        naturalidade VARCHAR(100) NULL,
        telefone VARCHAR(20) NULL,
        celular VARCHAR(20) NULL,
        email VARCHAR(255) NULL,
        email_pessoal VARCHAR(255) NULL,
        cep VARCHAR(10) NULL,
        endereco VARCHAR(255) NULL,
        numero VARCHAR(20) NULL,
        complemento VARCHAR(100) NULL,
        bairro VARCHAR(100) NULL,
        cidade VARCHAR(100) NULL,
        estado VARCHAR(2) NULL,
        matricula VARCHAR(50) NULL,
        cargo_id INT NULL,
        empresa_id INT NULL,
        jornada_id INT NULL,
        escolaridade_id INT NULL,
        data_admissao DATE NULL,
        data_desligamento DATE NULL,
        salario NUMERIC(10,2) NULL,
        status VARCHAR(20) DEFAULT 'ativo',
        vale_transporte BOOLEAN DEFAULT FALSE,
        vale_refeicao BOOLEAN DEFAULT FALSE,
        valor_vale_refeicao NUMERIC(10,2) NULL,
        plano_saude BOOLEAN DEFAULT FALSE,
        banco VARCHAR(100) NULL,
        agencia VARCHAR(20) NULL,
        conta VARCHAR(50) NULL,
        tipo_conta VARCHAR(20) NULL,
        pix VARCHAR(255) NULL,
        ctps VARCHAR(50) NULL,
        serie_ctps VARCHAR(20) NULL,
        pis_pasep VARCHAR(20) NULL,
        titulo_eleitor VARCHAR(20) NULL,
        reservista VARCHAR(20) NULL,
        nome_pai VARCHAR(255) NULL,
        nome_mae VARCHAR(255) NULL,
        observacoes TEXT NULL,
        filtro1 VARCHAR(100) NULL,
        filtro2 VARCHAR(100) NULL,
        filtro3 VARCHAR(100) NULL,
        observacoes_desligamento TEXT NULL,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);

    // Tabela de pastas de documentos por colaborador. Migration 1784702100000
    // adiciona coluna ordem.
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS rh_documento_pastas (
        id SERIAL PRIMARY KEY,
        colaborador_id INT NULL,
        nome VARCHAR(255) NOT NULL,
        obrigatoria BOOLEAN DEFAULT FALSE,
        ativo BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);

    // rh_candidatos referenciada por CreateRhRecrutadorTables (FK)
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS rh_candidatos (
        id SERIAL PRIMARY KEY,
        nome VARCHAR(255) NOT NULL,
        email VARCHAR(255) NULL,
        telefone VARCHAR(20) NULL,
        cpf VARCHAR(14) NULL,
        data_nascimento DATE NULL,
        endereco TEXT NULL,
        cidade VARCHAR(100) NULL,
        estado VARCHAR(2) NULL,
        cargo_pretendido VARCHAR(255) NULL,
        status VARCHAR(30) DEFAULT 'novo',
        observacoes TEXT NULL,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);

    // Index util pra filtros por colaborador
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_rh_documento_pastas_colab ON rh_documento_pastas(colaborador_id)`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_rh_colaboradores_status ON rh_colaboradores(status)`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_rh_colaboradores_cargo ON rh_colaboradores(cargo_id)`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_rh_candidatos_status ON rh_candidatos(status)`);
  }

  public async down(_queryRunner: QueryRunner): Promise<void> {
    // Down nao remove tabelas (perigoso em producao)
  }
}
