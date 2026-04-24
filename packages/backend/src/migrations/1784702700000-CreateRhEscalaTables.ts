import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateRhEscalaTables1784702700000 implements MigrationInterface {
  name = 'CreateRhEscalaTables1784702700000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // ============ Catalogo de turnos ============
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS rh_escala_turnos (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        company_id UUID NULL REFERENCES rh_empresas(id) ON DELETE CASCADE,
        codigo VARCHAR(20) NOT NULL,
        nome VARCHAR(100) NOT NULL,
        hora_inicio TIME NULL,
        hora_fim TIME NULL,
        total_horas NUMERIC(5,2) NULL,
        tipo VARCHAR(20) NOT NULL DEFAULT 'turno',  -- turno|folga|ferias|feriado|licenca
        cor VARCHAR(7) NULL,                         -- #FEF3C7
        ativo BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(company_id, codigo)
      )
    `);

    // Seeds default: turnos basicos + status
    await queryRunner.query(`
      INSERT INTO rh_escala_turnos (codigo, nome, hora_inicio, hora_fim, total_horas, tipo, cor) VALUES
        ('TM 7:15', 'Turno Manha 07:15', '07:15', '15:50', 7.58, 'turno', '#FEF3C7'),
        ('TM 7:30', 'Turno Manha 07:30', '07:30', '15:00', 7.00, 'turno', '#FEF3C7'),
        ('TM 8:00', 'Turno Manha 08:00', '08:00', '16:00', 7.33, 'turno', '#FEF3C7'),
        ('TM 9:00', 'Turno Manha 09:00', '09:00', '17:00', 7.33, 'turno', '#FEF3C7'),
        ('TT 13:00', 'Turno Tarde 13:00', '13:00', '21:20', 7.33, 'turno', '#DBEAFE'),
        ('TT 15:05', 'Turno Tarde 15:05', '15:05', '23:25', 7.33, 'turno', '#DBEAFE'),
        ('TT 15:20', 'Turno Tarde 15:20', '15:20', '23:40', 7.33, 'turno', '#DBEAFE'),
        ('TMD 10:00', 'Turno Misto 10:00', '10:00', '18:20', 7.33, 'turno', '#FCE7F3'),
        ('TMD 11:00', 'Turno Misto 11:00', '11:00', '19:20', 7.33, 'turno', '#FCE7F3'),
        ('TTD 13:05', 'Tarde Reduzido 13:05', '13:05', '19:20', 6.00, 'turno', '#FED7AA'),
        ('TTD 13:20', 'Tarde Reduzido 13:20', '13:20', '19:20', 5.00, 'turno', '#FED7AA'),
        ('FG', 'Folga', NULL, NULL, 0, 'folga', '#D1FAE5'),
        ('FE', 'Ferias', NULL, NULL, 0, 'ferias', '#E9D5FF'),
        ('FR', 'Feriado', NULL, NULL, 0, 'feriado', '#FECACA'),
        ('LI', 'Licenca/Atestado', NULL, NULL, 0, 'licenca', '#E5E7EB')
      ON CONFLICT DO NOTHING
    `);

    // ============ Cobertura minima por setor x turno x dia-da-semana ============
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS rh_escala_cobertura (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        company_id UUID REFERENCES rh_empresas(id) ON DELETE CASCADE,
        departamento_id INT REFERENCES rh_departamentos(id) ON DELETE CASCADE,
        turno_id UUID REFERENCES rh_escala_turnos(id) ON DELETE CASCADE,
        dia_semana SMALLINT NOT NULL,  -- 0=dom ... 6=sab
        minimo INT NOT NULL DEFAULT 0,
        UNIQUE(company_id, departamento_id, turno_id, dia_semana)
      )
    `);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_rh_cobertura_setor ON rh_escala_cobertura(departamento_id)`);

    // ============ Template semanal por colaborador ============
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS rh_escala_templates (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        colaborador_id INT NOT NULL REFERENCES rh_colaboradores(id) ON DELETE CASCADE,
        tipo_rotacao VARCHAR(30) NOT NULL DEFAULT '6x1',  -- 6x1|5x2|1x1_dom|2x1_dom|folguista|livre
        folga_preferida VARCHAR(30) NULL,                  -- 1o_dom|2o_dom|sempre|nunca|qualquer
        trabalha_feriado BOOLEAN DEFAULT true,
        padrao_semanal JSONB NOT NULL DEFAULT '[]',        -- [[semana1 7 turnos], [semana2 7 turnos]]
        vigencia_inicio DATE NULL,
        vigencia_fim DATE NULL,
        observacao TEXT NULL,
        ativo BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_rh_template_colab ON rh_escala_templates(colaborador_id)`);

    // ============ Lancamentos (grid real: colaborador x dia) ============
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS rh_escala_lancamentos (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        colaborador_id INT NOT NULL REFERENCES rh_colaboradores(id) ON DELETE CASCADE,
        data DATE NOT NULL,
        turno_id UUID NULL REFERENCES rh_escala_turnos(id) ON DELETE SET NULL,
        origem VARCHAR(20) NOT NULL DEFAULT 'template',  -- template|excessao|ferias|licenca|feriado|manual
        observacao TEXT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(colaborador_id, data)
      )
    `);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_rh_lanc_data ON rh_escala_lancamentos(data)`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_rh_lanc_colab_data ON rh_escala_lancamentos(colaborador_id, data)`);

    // ============ Ferias ============
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS rh_escala_ferias (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        colaborador_id INT NOT NULL REFERENCES rh_colaboradores(id) ON DELETE CASCADE,
        data_inicio DATE NOT NULL,
        data_fim DATE NOT NULL,
        observacao TEXT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_rh_ferias_colab ON rh_escala_ferias(colaborador_id)`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_rh_ferias_periodo ON rh_escala_ferias(data_inicio, data_fim)`);

    // ============ Licencas (atestados, afastamento, etc) ============
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS rh_escala_licencas (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        colaborador_id INT NOT NULL REFERENCES rh_colaboradores(id) ON DELETE CASCADE,
        data_inicio DATE NOT NULL,
        data_fim DATE NOT NULL,
        motivo VARCHAR(255) NULL,
        arquivo_url TEXT NULL,  -- atestado em PDF/imagem
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_rh_licencas_colab ON rh_escala_licencas(colaborador_id)`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_rh_licencas_periodo ON rh_escala_licencas(data_inicio, data_fim)`);

    // ============ Excessoes (troca pontual de turno num dia especifico) ============
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS rh_escala_excessoes (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        colaborador_id INT NOT NULL REFERENCES rh_colaboradores(id) ON DELETE CASCADE,
        data DATE NOT NULL,
        turno_id UUID NULL REFERENCES rh_escala_turnos(id) ON DELETE SET NULL,
        motivo VARCHAR(255) NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(colaborador_id, data)
      )
    `);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_rh_exces_data ON rh_escala_excessoes(data)`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS rh_escala_excessoes`);
    await queryRunner.query(`DROP TABLE IF EXISTS rh_escala_licencas`);
    await queryRunner.query(`DROP TABLE IF EXISTS rh_escala_ferias`);
    await queryRunner.query(`DROP TABLE IF EXISTS rh_escala_lancamentos`);
    await queryRunner.query(`DROP TABLE IF EXISTS rh_escala_templates`);
    await queryRunner.query(`DROP TABLE IF EXISTS rh_escala_cobertura`);
    await queryRunner.query(`DROP TABLE IF EXISTS rh_escala_turnos`);
  }
}
