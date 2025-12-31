import { MigrationInterface, QueryRunner } from "typeorm";

export class AddIACharacteristicsToProducts1765900000000 implements MigrationInterface {

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Adicionar colunas de características para IA na tabela products
        await queryRunner.query(`
            ALTER TABLE "products"
            ADD COLUMN IF NOT EXISTS "foto_referencia" TEXT,
            ADD COLUMN IF NOT EXISTS "coloracao" VARCHAR(50),
            ADD COLUMN IF NOT EXISTS "formato" VARCHAR(50),
            ADD COLUMN IF NOT EXISTS "gordura_visivel" VARCHAR(50),
            ADD COLUMN IF NOT EXISTS "presenca_osso" BOOLEAN,
            ADD COLUMN IF NOT EXISTS "peso_min_kg" DECIMAL(10,3),
            ADD COLUMN IF NOT EXISTS "peso_max_kg" DECIMAL(10,3),
            ADD COLUMN IF NOT EXISTS "posicao_balcao" JSONB
        `);

        // Comentários para documentar cada coluna
        await queryRunner.query(`
            COMMENT ON COLUMN "products"."foto_referencia" IS 'URL da foto de referência do produto para IA';
            COMMENT ON COLUMN "products"."coloracao" IS 'Cor esperada: Vermelho, Rosa, Branco, Amarelo, Marrom';
            COMMENT ON COLUMN "products"."formato" IS 'Formato: Retangular, Irregular, Cilíndrico, Achatado, Triangular';
            COMMENT ON COLUMN "products"."gordura_visivel" IS 'Quantidade de gordura: Nenhuma, Pouca, Média, Muita';
            COMMENT ON COLUMN "products"."presenca_osso" IS 'Indica se produto tem osso visível';
            COMMENT ON COLUMN "products"."peso_min_kg" IS 'Peso mínimo esperado em kg';
            COMMENT ON COLUMN "products"."peso_max_kg" IS 'Peso máximo esperado em kg';
            COMMENT ON COLUMN "products"."posicao_balcao" IS 'Coordenadas da posição no balcão {x1, y1, x2, y2, zona_nome}';
        `);

        // Criar índice para produtos com características configuradas
        await queryRunner.query(`
            CREATE INDEX IF NOT EXISTS "idx_products_ia_configured"
            ON "products" ("coloracao")
            WHERE "coloracao" IS NOT NULL
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Remover índice
        await queryRunner.query(`DROP INDEX IF EXISTS "idx_products_ia_configured"`);

        // Remover colunas
        await queryRunner.query(`
            ALTER TABLE "products"
            DROP COLUMN IF EXISTS "foto_referencia",
            DROP COLUMN IF EXISTS "coloracao",
            DROP COLUMN IF EXISTS "formato",
            DROP COLUMN IF EXISTS "gordura_visivel",
            DROP COLUMN IF EXISTS "presenca_osso",
            DROP COLUMN IF EXISTS "peso_min_kg",
            DROP COLUMN IF EXISTS "peso_max_kg",
            DROP COLUMN IF EXISTS "posicao_balcao"
        `);
    }

}
