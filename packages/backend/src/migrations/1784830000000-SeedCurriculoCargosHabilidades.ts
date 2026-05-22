import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Seed inicial de cargos e habilidades padrão para o Modelo de Currículo.
 * Idempotente: só insere se a tabela estiver vazia (clientes existentes com
 * dados próprios não são afetados; clientes novos sobem com a lista padrão).
 */
export class SeedCurriculoCargosHabilidades1784830000000 implements MigrationInterface {
  name = 'SeedCurriculoCargosHabilidades1784830000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const cargosCount: any[] = await queryRunner.query(`SELECT COUNT(*)::int AS c FROM curriculo_cargos`);
    if (Number(cargosCount[0]?.c) === 0) {
      await queryRunner.query(`
        INSERT INTO curriculo_cargos (nome, ativo, ordem) VALUES
          ('AÇOUGUEIRO', true, 0), ('AUX DE AÇOUGUE', true, 0), ('AUXILIAR ADMINISTRATIVO', true, 0),
          ('AUXILIAR DE RH', true, 0), ('BALCONISTA DE PADARIA', true, 0), ('CONFEITEIRO', true, 0),
          ('CONFERENTE', true, 0), ('FISCAL DE CAIXA', true, 0), ('GERENTE', true, 0),
          ('MOTORISTA', true, 0), ('OP DE CAIXA', true, 0), ('PADEIRO', true, 0),
          ('REPOSITOR', true, 0), ('REPOSITOR DE FLV', true, 0), ('SUB GERENTE', true, 0)
      `);
    }

    const habilidadesCount: any[] = await queryRunner.query(`SELECT COUNT(*)::int AS c FROM curriculo_habilidades`);
    if (Number(habilidadesCount[0]?.c) === 0) {
      await queryRunner.query(`
        INSERT INTO curriculo_habilidades (nome, ativo, ordem) VALUES
          ('ATENDIMENTO AO CLIENTE', true, 0), ('CRIATIVIDADE', true, 0), ('FLEXIBILIDADE', true, 0),
          ('INTELIGÊNCIA EMOCIONAL', true, 0), ('LIDERANÇA', true, 0), ('ORGANIZAÇÃO', true, 0),
          ('PROATIVIDADE', true, 0), ('TRABALHO EM EQUIPE', true, 0)
      `);
    }
  }

  public async down(_queryRunner: QueryRunner): Promise<void> {
    // No rollback — dados de seed permanecem mesmo no down.
  }
}
