import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Permite NULL em razao_social e cnpj de companies.
 * Cliente pediu pra que apenas Nome Fantasia seja obrigatorio
 * no first-setup (resto preenche depois em Configuracoes).
 */
export class AllowNullRazaoSocialCnpjCompanies1784714000000 implements MigrationInterface {
  name = 'AllowNullRazaoSocialCnpjCompanies1784714000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE companies ALTER COLUMN razao_social DROP NOT NULL`);
    await queryRunner.query(`ALTER TABLE companies ALTER COLUMN cnpj DROP NOT NULL`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Down nao restaura NOT NULL (risco de quebrar dados existentes)
  }
}
