import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateCotacaoPedidoTables1781500000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS cotacao_pedido (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        token VARCHAR(50) UNIQUE NOT NULL,
        num_pedido INT NOT NULL,
        cod_fornecedor INT NOT NULL,
        nome_fornecedor VARCHAR(255) NOT NULL,
        status VARCHAR(20) DEFAULT 'pendente',
        created_at TIMESTAMP DEFAULT NOW(),
        responded_at TIMESTAMP NULL
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS cotacao_pedido_item (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        cotacao_id UUID NOT NULL REFERENCES cotacao_pedido(id) ON DELETE CASCADE,
        cod_produto INT NOT NULL,
        des_produto VARCHAR(500) NOT NULL,
        des_unidade VARCHAR(20),
        qtd_pedido DECIMAL(12,3) DEFAULT 0,
        qtd_embalagem INT DEFAULT 0,
        val_tabela DECIMAL(12,4) DEFAULT 0,
        preco_fornecedor DECIMAL(12,4) NULL
      )
    `);

    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_cotacao_pedido_token ON cotacao_pedido(token)`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_cotacao_pedido_num ON cotacao_pedido(num_pedido)`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_cotacao_item_cotacao ON cotacao_pedido_item(cotacao_id)`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS cotacao_pedido_item`);
    await queryRunner.query(`DROP TABLE IF EXISTS cotacao_pedido`);
  }
}
