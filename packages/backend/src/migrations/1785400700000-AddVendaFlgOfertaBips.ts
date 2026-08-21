import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Marca, na bipagem verificada, se a venda que casou com ela saiu EM OFERTA
 * (TAB_PRODUTO_PDV.FLG_OFERTA = 'S' no Intersolid).
 *
 * Motivo: margem baixa nem sempre e problema. Caso real (Tradicao, 21/08/2026):
 *   AC BOV C1 ALCATRA COM MAMINHA — margem 9,16%  -> FLG_OFERTA = 'S' (oferta, ok)
 *   AC BOV C2 (PRD) OSSOBUCO      — margem 8,26%  -> FLG_OFERTA = 'N' (isso sim investiga)
 * Sem essa coluna as duas linhas ficam iguais na tela e o Roberto perde tempo
 * conferindo oferta que ele mesmo montou.
 *
 * O flag e por LINHA DE VENDA, nao por produto: no mesmo dia a LINGUICA TOSCANA
 * (cod 6668) apareceu com 'S' em 3 cupons e 'N' em outros 4. Por isso fica no
 * `bips`, junto do resto dos dados da venda, e nao numa tabela de produto.
 *
 * NULL = bipagem ainda nao casada com venda (ou verificada antes desta versao).
 */
export class AddVendaFlgOfertaBips1785400700000 implements MigrationInterface {
  name = 'AddVendaFlgOfertaBips1785400700000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    if (!(await queryRunner.hasTable('bips'))) return;
    if (await queryRunner.hasColumn('bips', 'venda_flg_oferta')) return;

    await queryRunner.query(`ALTER TABLE bips ADD COLUMN venda_flg_oferta BOOLEAN`);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_bips_venda_oferta
         ON bips (venda_flg_oferta) WHERE venda_flg_oferta IS TRUE`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    if (!(await queryRunner.hasTable('bips'))) return;
    await queryRunner.query(`DROP INDEX IF EXISTS idx_bips_venda_oferta`);
    if (await queryRunner.hasColumn('bips', 'venda_flg_oferta')) {
      await queryRunner.query(`ALTER TABLE bips DROP COLUMN venda_flg_oferta`);
    }
  }
}
