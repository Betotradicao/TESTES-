import { MigrationInterface, QueryRunner } from 'typeorm';

export class RemoveCnpjUniqueConstraint1738800000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Verificar se a tabela companies existe antes de tentar alterar
    const tableExists = await queryRunner.query(`
      SELECT EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_name = 'companies'
      )
    `);

    if (!tableExists[0]?.exists) {
      console.log('Tabela companies não existe ainda, pulando migration RemoveCnpjUniqueConstraint');
      return;
    }

    // Remove a constraint UNIQUE do campo CNPJ para permitir filiais com mesmo CNPJ
    // Primeiro, precisamos descobrir o nome da constraint
    const constraints = await queryRunner.query(`
      SELECT conname
      FROM pg_constraint
      WHERE conrelid = 'companies'::regclass
        AND contype = 'u'
        AND conkey @> ARRAY[(
          SELECT attnum FROM pg_attribute
          WHERE attrelid = 'companies'::regclass AND attname = 'cnpj'
        )]
    `);

    // Remove cada constraint encontrada para o campo cnpj
    for (const constraint of constraints) {
      await queryRunner.query(`ALTER TABLE "companies" DROP CONSTRAINT "${constraint.conname}"`);
      console.log(`Removed constraint: ${constraint.conname}`);
    }

    // Também tenta remover possíveis índices únicos
    const indexes = await queryRunner.query(`
      SELECT indexname
      FROM pg_indexes
      WHERE tablename = 'companies'
        AND indexdef LIKE '%UNIQUE%'
        AND indexdef LIKE '%cnpj%'
    `);

    for (const index of indexes) {
      await queryRunner.query(`DROP INDEX IF EXISTS "${index.indexname}"`);
      console.log(`Removed index: ${index.indexname}`);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Restaura a constraint UNIQUE (se necessário reverter)
    await queryRunner.query(`ALTER TABLE "companies" ADD CONSTRAINT "UQ_companies_cnpj" UNIQUE ("cnpj")`);
  }
}
