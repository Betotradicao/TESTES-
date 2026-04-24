import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateRhEscalasDomingo1784702900000 implements MigrationInterface {
  name = 'CreateRhEscalasDomingo1784702900000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS rh_escalas_domingo (
        id SERIAL PRIMARY KEY,
        nome VARCHAR(50) NOT NULL UNIQUE,
        descricao TEXT NULL,
        ativo BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    // Seeds mais comuns
    await queryRunner.query(`
      INSERT INTO rh_escalas_domingo (nome, descricao) VALUES
        ('1x1', 'Trabalha 1 domingo, folga o proximo (alterna)'),
        ('2x1', 'Trabalha 2 domingos, folga o 3o'),
        ('3x1', 'Trabalha 3 domingos, folga o 4o'),
        ('Todo', 'Trabalha todos os domingos'),
        ('Nunca', 'Nao trabalha aos domingos')
      ON CONFLICT (nome) DO NOTHING
    `);

    // Coluna na tabela de colaboradores
    await queryRunner.query(`
      ALTER TABLE rh_colaboradores
      ADD COLUMN IF NOT EXISTS escala_domingo_id INT NULL REFERENCES rh_escalas_domingo(id) ON DELETE SET NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE rh_colaboradores DROP COLUMN IF EXISTS escala_domingo_id`);
    await queryRunner.query(`DROP TABLE IF EXISTS rh_escalas_domingo`);
  }
}
