import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Cria tabela curriculo_tipos_vaga (catalogo editavel de tipos de vaga
 * exibidos no formulario publico). Seed inicial: CLT e Aprendiz.
 */
export class CreateCurriculoTiposVaga1784721000000 implements MigrationInterface {
  name = 'CreateCurriculoTiposVaga1784721000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS curriculo_tipos_vaga (
        id SERIAL PRIMARY KEY,
        slug VARCHAR(50) NOT NULL UNIQUE,
        nome VARCHAR(100) NOT NULL,
        ativo BOOLEAN NOT NULL DEFAULT true,
        ordem INT NOT NULL DEFAULT 0,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Seed inicial — apenas se a tabela estiver vazia
    const existentes = await queryRunner.query(`SELECT COUNT(*)::int AS qtd FROM curriculo_tipos_vaga`);
    if (existentes[0]?.qtd === 0) {
      await queryRunner.query(`
        INSERT INTO curriculo_tipos_vaga (slug, nome, ativo, ordem) VALUES
        ('clt', 'CLT', true, 1),
        ('aprendiz', 'Menor Aprendiz', true, 2)
      `);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS curriculo_tipos_vaga`);
  }
}
