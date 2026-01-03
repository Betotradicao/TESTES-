import { MigrationInterface, QueryRunner } from "typeorm";

export class AssociateUsersToCompany1767400000000 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        // Associar todos os usuários sem empresa à primeira empresa disponível
        await queryRunner.query(`
            UPDATE users
            SET company_id = (SELECT id FROM companies ORDER BY created_at ASC LIMIT 1)
            WHERE company_id IS NULL
            AND EXISTS (SELECT 1 FROM companies LIMIT 1)
        `);

        console.log('✅ Usuários associados automaticamente à empresa');
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Não precisa reverter - mantém os usuários associados
        console.log('⏭️  Rollback não necessário - mantendo associações');
    }
}
