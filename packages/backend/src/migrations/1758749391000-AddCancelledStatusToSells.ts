import { MigrationInterface, QueryRunner } from "typeorm";

export class AddCancelledStatusToSells1758749391000 implements MigrationInterface {

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Drop the old constraint
        await queryRunner.query(`
            ALTER TABLE "sells"
            DROP CONSTRAINT IF EXISTS "sells_status_check"
        `);

        // Add new constraint with 'cancelled' status
        await queryRunner.query(`
            ALTER TABLE "sells"
            ADD CONSTRAINT "sells_status_check"
            CHECK (status IN ('verified', 'notified', 'cancelled'))
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Drop the new constraint
        await queryRunner.query(`
            ALTER TABLE "sells"
            DROP CONSTRAINT IF EXISTS "sells_status_check"
        `);

        // Restore old constraint without 'cancelled' status
        await queryRunner.query(`
            ALTER TABLE "sells"
            ADD CONSTRAINT "sells_status_check"
            CHECK (status IN ('verified', 'notified'))
        `);

        // Update any 'cancelled' records to 'notified' before applying the constraint
        await queryRunner.query(`
            UPDATE "sells"
            SET status = 'notified'
            WHERE status = 'cancelled'
        `);
    }

}