import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Tabela para armazenar pedidos sugeridos enviados por fornecedores
 * via link publico (FornecedorPedidoPublico).
 *
 * O fornecedor acessa pelo celular, digita seu codigo do ERP (TAB_FORNECEDOR)
 * ou CNPJ, ve seus produtos no Tradicao com 7 campos (codigo barras, descricao,
 * data ult compra, estoque atual, troca, cobertura, curva), informa quantidades
 * em estoque dele + qtd sugerida, e envia. Backoffice ve em Gestao de Compras
 * -> Pedidos Sugeridos.
 *
 * itens (jsonb): array de { ean, codigo, descricao, dtaUltCompra, estoqueAtual,
 *   estoqueTroca, cobertura, curva, qtdEstoqueInformada, qtdSugerida }
 */
export class CreateFornecedorPedidosSugeridos1784820000000 implements MigrationInterface {
  name = 'CreateFornecedorPedidosSugeridos1784820000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "fornecedor_pedidos_sugeridos" (
        "id" SERIAL PRIMARY KEY,
        "cod_fornecedor" INTEGER NOT NULL,
        "nome_fornecedor" VARCHAR(255),
        "cnpj_fornecedor" VARCHAR(20),
        "cod_loja" INTEGER,
        "status" VARCHAR(20) NOT NULL DEFAULT 'pendente',
        "itens" JSONB NOT NULL DEFAULT '[]'::jsonb,
        "observacoes" TEXT,
        "ip_origem" VARCHAR(45),
        "enviado_em" TIMESTAMP NOT NULL DEFAULT now(),
        "atualizado_em" TIMESTAMP,
        "atualizado_por" VARCHAR(255),
        "created_at" TIMESTAMP NOT NULL DEFAULT now()
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_fornecedor_pedidos_status"
        ON "fornecedor_pedidos_sugeridos"("status", "enviado_em" DESC)
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_fornecedor_pedidos_loja"
        ON "fornecedor_pedidos_sugeridos"("cod_loja", "enviado_em" DESC)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_fornecedor_pedidos_loja"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_fornecedor_pedidos_status"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "fornecedor_pedidos_sugeridos"`);
  }
}
