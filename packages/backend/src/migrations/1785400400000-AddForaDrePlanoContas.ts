import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * `fora_dre`: a conta APARECE no demonstrativo mas NAO entra nos totais
 * (Receitas / Despesas / Saldo).
 *
 * Caso real: transferencia entre contas proprias. O dinheiro sai de um banco e
 * entra em outro — nao e despesa nem receita, mas somava R$ 132.846,22 nas
 * despesas do Tradicao e distorcia o resultado.
 *
 * Marcado por conta (e nao adivinhado pelo nome) porque so o usuario sabe o que
 * e movimentacao interna: aplicacao, resgate, emprestimo entre empresas etc.
 */
export class AddForaDrePlanoContas1785400400000 implements MigrationInterface {
  name = 'AddForaDrePlanoContas1785400400000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE plano_contas
      ADD COLUMN IF NOT EXISTS fora_dre BOOLEAN NOT NULL DEFAULT false
    `);

    // Ja marca o que e transferencia declarada, pra tela nascer certa.
    // O usuario pode desmarcar/marcar outras no Cadastro de Contas.
    await queryRunner.query(`
      UPDATE plano_contas p
      SET fora_dre = true
      WHERE upper(p.nome) LIKE '%TRANSFERENCIA%'
         OR EXISTS (
           SELECT 1 FROM plano_contas g
           WHERE g.id = p.parent_id AND upper(g.nome) LIKE '%TRANSFERENCIA%'
         )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE plano_contas DROP COLUMN IF EXISTS fora_dre`);
  }
}
