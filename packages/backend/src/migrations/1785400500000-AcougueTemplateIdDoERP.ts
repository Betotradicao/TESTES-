import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * O Desmembramento do Acougue passou a ler os rendimentos DIRETO do ERP
 * (INTERSOLID.TAB_PRODUTO_DECOMPOSICAO) em vez da copia local, que estava
 * congelada desde 04/2026 e nao acompanhava as alteracoes do Intersolid.
 *
 * Com isso o `template_id` deixa de ser o id da tabela local e passa a ser o
 * COD_PRODUTO da matriz no ERP (ex.: '00003902'). Duas mudancas necessarias
 * em `acougue_desmembramentos`:
 *   1) remover a FK pra acougue_rendimento_templates (o id nao vive mais la);
 *   2) virar VARCHAR — o codigo do ERP tem zeros a esquerda que importam.
 *
 * O historico ja salvo e preservado: os ids antigos viram texto ('1', '2'...).
 * `template_nome` sempre foi gravado junto, entao os registros antigos continuam
 * legiveis mesmo apontando pra um id que nao existe mais.
 */
export class AcougueTemplateIdDoERP1785400500000 implements MigrationInterface {
  name = 'AcougueTemplateIdDoERP1785400500000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const tabela = await queryRunner.hasTable('acougue_desmembramentos');
    if (!tabela) return;

    // 1) derruba a FK (o nome pode variar entre instalacoes — descobre pelo catalogo)
    const fks = await queryRunner.query(`
      SELECT conname FROM pg_constraint
       WHERE conrelid = 'acougue_desmembramentos'::regclass AND contype = 'f'
    `);
    for (const fk of fks) {
      await queryRunner.query(`ALTER TABLE acougue_desmembramentos DROP CONSTRAINT "${fk.conname}"`);
    }

    // 2) integer -> varchar preservando o que ja existe
    await queryRunner.query(`
      ALTER TABLE acougue_desmembramentos
        ALTER COLUMN template_id TYPE VARCHAR(30) USING template_id::VARCHAR
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const tabela = await queryRunner.hasTable('acougue_desmembramentos');
    if (!tabela) return;

    // Volta pra integer descartando o que nao for numerico (codigos do ERP com
    // zeros a esquerda viram numero; qualquer outra coisa vira NULL).
    await queryRunner.query(`
      ALTER TABLE acougue_desmembramentos
        ALTER COLUMN template_id TYPE INTEGER
        USING NULLIF(regexp_replace(template_id, '\D', '', 'g'), '')::INTEGER
    `);
  }
}
