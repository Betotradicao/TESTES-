import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Adiciona campos extras em rh_cargos:
 *  - salario_base                NUMERIC(10,2) — salario referencia do cargo
 *  - descritivo_atividades       TEXT          — atividades obrigatorias do cargo
 *  - epis_epcs_obrigatorios_ids  JSONB         — array com IDs do catalogo rh_epis_epcs
 *
 * Cria a tabela rh_epis_epcs (catalogo de EPIs e EPCs cadastrados na aba propria):
 *  - tipo: 'epi' (Equipamento de Protecao Individual) | 'epc' (Equipamento de Protecao Coletiva)
 *  - ca: numero do Certificado de Aprovacao do MTE (ex: 12345)
 *  - validade_meses: vida util sugerida pra controle de troca
 *
 * Fluxo: usuario cadastra EPIs/EPCs na aba "EPIs e EPCs" e depois marca os
 * obrigatorios pra cada cargo na tela de Cargos (checkbox multi).
 */
export class AddCamposCargosRh1784713000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE rh_cargos
      ADD COLUMN IF NOT EXISTS salario_base NUMERIC(10,2) NULL,
      ADD COLUMN IF NOT EXISTS descritivo_atividades TEXT NULL,
      ADD COLUMN IF NOT EXISTS epis_epcs_obrigatorios_ids JSONB DEFAULT '[]'::jsonb
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS rh_epis_epcs (
        id SERIAL PRIMARY KEY,
        nome VARCHAR(255) NOT NULL,
        tipo VARCHAR(10) NOT NULL DEFAULT 'epi',
        descricao TEXT NULL,
        ca VARCHAR(50) NULL,
        validade_meses INT NULL,
        ativo BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);

    // Seed inicial de EPIs/EPCs comuns em supermercado pra dar partida
    await queryRunner.query(`
      INSERT INTO rh_epis_epcs (nome, tipo, descricao, validade_meses) VALUES
        ('Luva de açougueiro (cota de malha)', 'epi', 'Luva de aço inox para corte de carnes', 24),
        ('Luva nitrílica descartável', 'epi', 'Para manuseio de alimentos e produtos químicos leves', 1),
        ('Luva impermeável longa', 'epi', 'Para limpeza com produtos químicos', 6),
        ('Touca descartável', 'epi', 'Padaria, açougue, hortifruti, produção', 1),
        ('Avental de açougueiro', 'epi', 'Avental de PVC ou couro para açougue', 12),
        ('Avental impermeável', 'epi', 'Padaria, frente de caixa', 12),
        ('Bota de PVC antiderrapante', 'epi', 'Açougue, hortifruti, limpeza', 12),
        ('Sapato de segurança com biqueira', 'epi', 'Recebimento, estoque, açougue', 18),
        ('Cinta abdominal lombar', 'epi', 'Repositores, conferentes, recebimento', 12),
        ('Óculos de proteção', 'epi', 'Limpeza com produtos químicos, padaria', 12),
        ('Máscara descartável', 'epi', 'Padaria, açougue, hortifruti', 1),
        ('Protetor auricular', 'epi', 'Setores de produção e câmaras frias', 6),
        ('Capacete de segurança', 'epi', 'Recebimento e estoque', 36),
        ('Jaqueta térmica para câmara fria', 'epi', 'Conferentes e açougueiros em câmara fria', 24),
        ('Cinto de segurança tipo paraquedista', 'epi', 'Trabalho em altura (estoque alto)', 12),
        ('Faixa antiderrapante no piso', 'epc', 'Acesso a câmaras frias e áreas molhadas', null),
        ('Placa de piso molhado', 'epc', 'Sinalização de risco em manutenção/limpeza', null),
        ('Extintor de incêndio CO2/PQS', 'epc', 'Recarga conforme NBR — verificar validade', 12),
        ('Saída de emergência sinalizada', 'epc', 'Iluminação de emergência funcionando', null),
        ('Chuveiro/lava-olhos de emergência', 'epc', 'Próximo a setores que usam químicos', null),
        ('Guarda-corpo em escadas', 'epc', 'Conformidade com NR-8', null),
        ('Proteção de polia em equipamentos', 'epc', 'Padaria (masseira, divisora) e açougue (moedor)', null),
        ('Trava de segurança em câmara fria', 'epc', 'Botão pânico interno na câmara fria', null)
      ON CONFLICT DO NOTHING
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS rh_epis_epcs`);
    await queryRunner.query(`
      ALTER TABLE rh_cargos
      DROP COLUMN IF EXISTS salario_base,
      DROP COLUMN IF EXISTS descritivo_atividades,
      DROP COLUMN IF EXISTS epis_epcs_obrigatorios_ids
    `);
  }
}
