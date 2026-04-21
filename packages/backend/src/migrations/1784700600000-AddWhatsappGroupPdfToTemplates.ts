import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddWhatsappGroupPdfToTemplates1784700600000 implements MigrationInterface {
  name = 'AddWhatsappGroupPdfToTemplates1784700600000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "audit_templates"
      ADD COLUMN IF NOT EXISTS "whatsapp_group_pdf_id" VARCHAR(255) NULL,
      ADD COLUMN IF NOT EXISTS "whatsapp_group_pdf_name" VARCHAR(255) NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "audit_templates"
      DROP COLUMN IF EXISTS "whatsapp_group_pdf_id",
      DROP COLUMN IF EXISTS "whatsapp_group_pdf_name"
    `);
  }
}
