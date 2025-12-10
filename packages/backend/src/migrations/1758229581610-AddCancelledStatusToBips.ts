import { MigrationInterface, QueryRunner } from "typeorm";

export class AddCancelledStatusToBips1758229581610 implements MigrationInterface {

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Remover qualquer constraint existente de status
        await queryRunner.query(`ALTER TABLE "bips" DROP CONSTRAINT IF EXISTS "CHK_a5b0a0d72e92b4b0c1c6b8e8c1f0d0e1"`);
        await queryRunner.query(`ALTER TABLE "bips" DROP CONSTRAINT IF EXISTS "bips_status_check"`);

        // Adicionar nova constraint com 'cancelled'
        await queryRunner.query(`ALTER TABLE "bips" ADD CONSTRAINT "CHK_bips_status" CHECK (status IN ('verified', 'notified', 'pending', 'cancelled'))`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Reverter constraint
        await queryRunner.query(`ALTER TABLE "bips" DROP CONSTRAINT "CHK_bips_status"`);
        await queryRunner.query(`ALTER TABLE "bips" ADD CONSTRAINT "CHK_a5b0a0d72e92b4b0c1c6b8e8c1f0d0e1" CHECK (status IN ('verified', 'notified', 'pending'))`);
    }

}
