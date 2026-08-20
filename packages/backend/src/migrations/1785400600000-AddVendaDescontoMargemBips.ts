import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Guarda, na bipagem verificada, os dados da venda que casou com ela:
 * valor liquido, desconto dado no caixa e margem do item.
 *
 * Motivo 1 — DESCONTO: a bipagem registra o valor da ETIQUETA (peso x preco cheio).
 * Se o operador deu desconto, VAL_TOTAL_PRODUTO vem menor e a bipagem ficava
 * "Pendente" pra sempre, parecendo produto que saiu sem passar no caixa.
 * Caso real (Tradicao 20/08/2026): PEITO DE FRANGO SEM OSSO 5,650kg — bipagem
 * R$ 112,94, venda R$ 101,64 + R$ 11,30 de desconto = exatamente R$ 112,94.
 *
 * Motivo 2 — MARGEM: pedido do Roberto pra ver na lista quanto o item deu de
 * margem de verdade, ja descontado o que foi dado no caixa.
 *
 * Valores em centavos (inteiro) pelo mesmo motivo de `bip_price_cents`: evita
 * erro de arredondamento de ponto flutuante em dinheiro.
 */
export class AddVendaDescontoMargemBips1785400600000 implements MigrationInterface {
  name = 'AddVendaDescontoMargemBips1785400600000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    if (!(await queryRunner.hasTable('bips'))) return;

    const add = async (coluna: string, tipo: string) => {
      const existe = await queryRunner.hasColumn('bips', coluna);
      if (!existe) {
        await queryRunner.query(`ALTER TABLE bips ADD COLUMN ${coluna} ${tipo}`);
      }
    };

    await add('venda_valor_cents', 'INTEGER');       // valor liquido cobrado no caixa
    await add('venda_desconto_cents', 'INTEGER');    // desconto dado no caixa
    await add('venda_custo_cents', 'INTEGER');       // custo de reposicao x quantidade
    await add('venda_margem_pct', 'NUMERIC(6,2)');   // margem sobre o valor liquido

    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_bips_venda_desconto
         ON bips (venda_desconto_cents) WHERE venda_desconto_cents > 0`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    if (!(await queryRunner.hasTable('bips'))) return;
    await queryRunner.query(`DROP INDEX IF EXISTS idx_bips_venda_desconto`);
    for (const c of ['venda_valor_cents', 'venda_desconto_cents', 'venda_custo_cents', 'venda_margem_pct']) {
      if (await queryRunner.hasColumn('bips', c)) {
        await queryRunner.query(`ALTER TABLE bips DROP COLUMN ${c}`);
      }
    }
  }
}
