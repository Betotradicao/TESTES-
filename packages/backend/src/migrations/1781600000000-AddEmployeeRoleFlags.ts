import { MigrationInterface, QueryRunner } from "typeorm";

export class AddEmployeeRoleFlags1781600000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE employees ADD COLUMN IF NOT EXISTS is_conferente BOOLEAN DEFAULT false`);
    await queryRunner.query(`ALTER TABLE employees ADD COLUMN IF NOT EXISTS is_cpd BOOLEAN DEFAULT false`);
    await queryRunner.query(`ALTER TABLE employees ADD COLUMN IF NOT EXISTS is_financeiro BOOLEAN DEFAULT false`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE employees DROP COLUMN IF EXISTS is_conferente`);
    await queryRunner.query(`ALTER TABLE employees DROP COLUMN IF EXISTS is_cpd`);
    await queryRunner.query(`ALTER TABLE employees DROP COLUMN IF EXISTS is_financeiro`);
  }
}
