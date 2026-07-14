import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Cooldown do menu.
 *
 * Sem isso, QUALQUER mensagem que nao case com uma opcao faz o bot reenviar o
 * menu inteiro ("nao entendi" + as opcoes). Cliente manda "oi", "bom dia",
 * "tem pao?" e leva tres menus na cara. Agora o menu so vai de novo depois de
 * `intervalo_menu_horas` desde a ultima vez que ESTE contato o recebeu.
 *
 * 0 = sem cooldown (comportamento antigo), que e o default pra nao mudar
 * silenciosamente o fluxo de quem ja esta rodando.
 */
export class AddIntervaloMenuChatbot1785120000000 implements MigrationInterface {
  name = 'AddIntervaloMenuChatbot1785120000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const temFluxos = await queryRunner.query(`SELECT to_regclass('public.mkt_chatbot_fluxos') IS NOT NULL AS existe`);
    if (!temFluxos?.[0]?.existe) return;

    await queryRunner.query(`
      ALTER TABLE mkt_chatbot_fluxos
      ADD COLUMN IF NOT EXISTS intervalo_menu_horas INT NOT NULL DEFAULT 0
    `);
    await queryRunner.query(`
      ALTER TABLE mkt_chatbot_contatos
      ADD COLUMN IF NOT EXISTS ultimo_menu_at TIMESTAMP
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE mkt_chatbot_contatos DROP COLUMN IF EXISTS ultimo_menu_at`);
    await queryRunner.query(`ALTER TABLE mkt_chatbot_fluxos DROP COLUMN IF EXISTS intervalo_menu_horas`);
  }
}
