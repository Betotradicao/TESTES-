import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Seed dos catalogos padrao de Configuracoes RH (cargos, jornadas, escalas,
 * setores, EPIs/EPCs, feriados, turnos de escala, etc).
 *
 * Idempotente por tabela: so insere se a tabela estiver vazia. Cliente novo
 * (Mameva-like) ja sobe com configuracao padrao do Tradicao. Cliente velho
 * que ja tem dados nao e tocado.
 */
export class SeedRhConfiguracoesPadrao1784715000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    const seedSeIfEmpty = async (
      tabela: string,
      inserts: string[],
      sequenceCol: string | null = 'id'
    ) => {
      // checa se tabela existe
      const exists = await queryRunner.query(
        `SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name=$1`,
        [tabela]
      );
      if (exists.length === 0) return;

      const [{ count }] = await queryRunner.query(`SELECT count(*)::int AS count FROM ${tabela}`);
      if (count > 0) return; // tabela ja populada

      for (const sql of inserts) {
        await queryRunner.query(sql);
      }

      // resync sequence (so pra ids inteiros)
      if (sequenceCol === 'id') {
        await queryRunner.query(
          `SELECT setval(pg_get_serial_sequence('${tabela}', 'id'),
                        COALESCE((SELECT MAX(id) FROM ${tabela}), 1))`
        );
      }
    };

    // ============ rh_cargos ============
    await seedSeIfEmpty('rh_cargos', [
      `INSERT INTO public.rh_cargos (id, nome, descricao, ativo, salario_base, descritivo_atividades, epis_epcs_obrigatorios_ids) VALUES
        (1, 'ACOUGUEIRO', NULL, true, 2150.67, NULL, '[]'),
        (2, 'AUXILIAR DE ACOUGUE', NULL, true, NULL, NULL, '[]'),
        (3, 'AUXILIAR DE LIMPEZA', NULL, true, NULL, NULL, '[]'),
        (4, 'AUXILIAR DE PADARIA', NULL, true, NULL, NULL, '[]'),
        (5, 'BALCONISTA DE PADARIA', NULL, true, NULL, NULL, '[]'),
        (6, 'CONFEITEIRO', NULL, true, NULL, NULL, '[]'),
        (7, 'MOTORISTA', NULL, true, NULL, NULL, '[]'),
        (8, 'OPERADOR(A) DE CAIXA', NULL, true, NULL, NULL, '[]'),
        (9, 'REPOSITOR(A)', NULL, true, NULL, NULL, '[]'),
        (10, 'REPOSITOR(A) DE FLV', NULL, true, NULL, NULL, '[]'),
        (11, 'MENOR APRENDIZ (CAIXA)', NULL, true, NULL, NULL, '[]'),
        (12, 'MARKETING', NULL, true, NULL, NULL, '[]'),
        (13, 'MENOR APRENDIZ (REPOSICAO)', NULL, true, NULL, NULL, '[]'),
        (14, 'MENOR APRENDIZ (ADM)', NULL, true, NULL, NULL, '[]'),
        (15, 'COMPRADOR', NULL, true, NULL, NULL, '[]'),
        (16, 'CONFERENTE', NULL, true, NULL, NULL, '[]'),
        (17, 'CPD', NULL, true, NULL, NULL, '[]'),
        (18, 'FINANCEIRO', NULL, true, NULL, NULL, '[]'),
        (19, 'FISCAL DE CAIXA', NULL, true, NULL, NULL, '[]'),
        (20, 'GERENTE', NULL, true, NULL, NULL, '[]'),
        (21, 'LIDER DE ACOUGUE', NULL, true, NULL, NULL, '[]'),
        (22, 'LIDER DE CAIXA', NULL, true, NULL, NULL, '[]'),
        (23, 'LIDER DE FLV', NULL, true, NULL, NULL, '[]'),
        (24, 'LIDER DE MERCEARIA', NULL, true, NULL, NULL, '[]'),
        (25, 'LIDER DE PADARIA', NULL, true, NULL, NULL, '[]'),
        (26, 'RECURSOS HUMANOS', NULL, true, NULL, NULL, '[]'),
        (27, 'SUB GERENTE', NULL, true, NULL, NULL, '[]')`
    ]);

    // ============ rh_jornadas ============
    await seedSeIfEmpty('rh_jornadas', [
      `INSERT INTO public.rh_jornadas (id, nome, descricao, ativo, carga_horaria) VALUES
        (1, 'CLT (7:20)', '', true, '7:20'),
        (2, 'CLT (6:00)', '', true, '6:00'),
        (3, 'APRENDIZ', '', true, '5:00')`
    ]);

    // ============ rh_escolaridades ============
    await seedSeIfEmpty('rh_escolaridades', [
      `INSERT INTO public.rh_escolaridades (id, nome, ativo) VALUES
        (1, 'ENSINO FUNDAMENTAL COMPLETO', true),
        (2, 'ENSINO FUNDAMENTAL INCOMPLETO', true),
        (3, 'ENSINO MEDIO COMPLETO', true),
        (4, 'ENSINO MEDIO INCOMPLETO', true),
        (5, 'ENSINO SUPERIOR COMPLETO', true),
        (6, 'ENSINO SUPERIOR INCOMPLETO', true),
        (7, 'POS GRADUADO', true)`
    ]);

    // ============ rh_escalas ============
    await seedSeIfEmpty('rh_escalas', [
      `INSERT INTO public.rh_escalas (id, nome, descricao, ativo) VALUES
        (1, '6x1', 'Trabalha 6 dias, folga 1', true),
        (2, '5x2', 'Trabalha 5 dias, folga 2 (sabado e domingo)', true),
        (3, '5x1', 'Trabalha 5 dias, folga 1', true),
        (4, '4x2', 'Trabalha 4 dias, folga 2', true),
        (5, '12x36', 'Trabalha 12 horas, folga 36 horas', true)`
    ]);

    // ============ rh_escalas_domingo ============
    await seedSeIfEmpty('rh_escalas_domingo', [
      `INSERT INTO public.rh_escalas_domingo (id, nome, descricao, ativo) VALUES
        (1, '1x1', 'Trabalha 1 domingo, folga o proximo (alterna)', true),
        (2, '2x1', 'Trabalha 2 domingos, folga o 3o', true),
        (3, '3x1', 'Trabalha 3 domingos, folga o 4o', true),
        (4, 'Todo', 'Trabalha todos os domingos', true),
        (5, 'Nunca', 'Nao trabalha aos domingos', true)`
    ]);

    // ============ rh_regimes_trabalho ============
    await seedSeIfEmpty('rh_regimes_trabalho', [
      `INSERT INTO public.rh_regimes_trabalho (id, nome, descricao, ativo) VALUES
        (1, 'CLT', 'Consolidacao das Leis do Trabalho', true),
        (2, 'APRENDIZ', 'Menor Aprendiz', true),
        (3, 'ESTAGIARIO', 'Estagio', true),
        (4, 'DIARISTA', 'Trabalho por diaria', true),
        (5, 'CONTRATO PJ', 'Pessoa Juridica', true)`
    ]);

    // ============ rh_formas_pagamento ============
    await seedSeIfEmpty('rh_formas_pagamento', [
      `INSERT INTO public.rh_formas_pagamento (id, nome, descricao, ativo) VALUES
        (1, 'DEPOSITO BANCARIO', NULL, true),
        (2, 'PIX', NULL, true),
        (3, 'DINHEIRO', NULL, true),
        (4, 'CHEQUE', NULL, false)`
    ]);

    // ============ rh_prazos_experiencia ============
    await seedSeIfEmpty('rh_prazos_experiencia', [
      `INSERT INTO public.rh_prazos_experiencia (id, nome, descricao, ativo) VALUES
        (1, '30 dias', NULL, true),
        (2, '45 dias', NULL, true),
        (3, '60 dias', NULL, true),
        (4, '90 dias', NULL, true)`
    ]);

    // ============ rh_tipos_desligamento ============
    await seedSeIfEmpty('rh_tipos_desligamento', [
      `INSERT INTO public.rh_tipos_desligamento (id, nome, descricao, ativo) VALUES
        (1, 'DEMISSAO POR JUSTA CAUSA', NULL, true),
        (2, 'DEMISSAO SEM JUSTA CAUSA (EMPRESA)', NULL, true),
        (3, 'DEMISSAO SEM JUSTA CAUSA (ACORDO)', NULL, true),
        (4, 'DEMISSAO POR PARTE DO COLABORADOR', NULL, true),
        (5, 'DEMISSAO TERMINO CONTRATO (EMPRESA)', NULL, true),
        (6, 'DEMISSAO TERMINO CONTRATO (COLABORADOR)', NULL, true),
        (7, 'DEMISSAO APRENDIZ (COLABORADOR)', NULL, true),
        (8, 'DEMISSAO APRENDIZ (EMPRESA)', NULL, true)`
    ]);

    // ============ rh_motivos_desligamento ============
    await seedSeIfEmpty('rh_motivos_desligamento', [
      `INSERT INTO public.rh_motivos_desligamento (id, nome, descricao, ativo) VALUES
        (1, 'BAIXA PRODUTIVIDADE', NULL, true),
        (2, 'SALARIO', NULL, true),
        (3, 'LIDERANCA DO SETOR', NULL, true),
        (4, 'GERENTE DE LOJA', NULL, true),
        (5, 'SUB GERENTE DE LOJA', NULL, true),
        (6, 'GESTOR DA LOJA', NULL, true),
        (7, 'MOTIVOS PESSOAIS (MUDANCA, FILHOS)', NULL, true),
        (8, 'MODELO DE GESTAO', NULL, true)`
    ]);

    // ============ sectors (Setores) ============
    await seedSeIfEmpty('sectors', [
      `INSERT INTO public.sectors (id, name, color_hash, active, cod_loja) VALUES
        (1, 'ACOUGUE', '#E91E23', true, 1),
        (2, 'PREVENCAO DE PERDAS', '#5D0BF5', true, 1),
        (3, 'RECURSOS HUMANOS', '#DA44EF', true, 1),
        (4, 'COMPRAS', '#EF8A46', true, 1),
        (5, 'PADARIA PRODUCAO', '#39DC52', true, 1),
        (6, 'PADARIA', '#A1B73A', true, 1),
        (7, 'CONFERENCIA', '#CDDC39', true, 1),
        (8, 'ADMINISTRATIVO', '#EC9748', true, 1),
        (9, 'CPD', '#16F94E', true, 1)`
    ]);

    // ============ rh_tipos_ausencia ============
    await seedSeIfEmpty('rh_tipos_ausencia', [
      `INSERT INTO public.rh_tipos_ausencia (id, nome, descricao, ativo) VALUES
        (1, 'Planejada', NULL, true),
        (2, 'Nao Planejada', NULL, true),
        (3, 'FERIAS', NULL, true),
        (4, 'FOLGA', NULL, true),
        (5, 'FERIADO', NULL, true),
        (6, 'CURSOS EXTERNOS', NULL, true),
        (7, 'BANCO DE HORAS (POSITIVO)', NULL, true),
        (8, 'AFASTAMENTO INSS (MATERNIDADE)', NULL, true),
        (9, 'AFASTAMENTO INSS (SAUDE)', NULL, true),
        (10, 'ATESTADO MEDICO', NULL, true),
        (11, 'FALTA NAO JUSTIFICADA', NULL, true),
        (12, 'ATRASO', NULL, true)`
    ]);

    // ============ rh_tipos_treinamento ============
    await seedSeIfEmpty('rh_tipos_treinamento', [
      `INSERT INTO public.rh_tipos_treinamento (id, nome, descricao, ativo) VALUES
        (1, 'DESENVOLVIMENTO TECNICO', NULL, true),
        (2, 'DESENVOLVIMENTO PESSOAL', NULL, true)`
    ]);

    // ============ rh_status_treinamento ============
    await seedSeIfEmpty('rh_status_treinamento', [
      `INSERT INTO public.rh_status_treinamento (id, nome, descricao, ativo) VALUES
        (1, 'CONCLUIDO', NULL, true),
        (2, 'AGENDADO', NULL, true),
        (3, 'NAO CONCLUIDO', NULL, true),
        (4, 'CANCELADO', NULL, true)`
    ]);

    // ============ rh_beneficios ============
    await seedSeIfEmpty('rh_beneficios', [
      `INSERT INTO public.rh_beneficios (id, nome, descricao, valor, ativo) VALUES
        (1, 'VALE TRANSPORTE', 'Conceder vale transporte ao colaborador', NULL, true),
        (2, 'VALE REFEICAO', 'Conceder vale refeicao ao colaborador', NULL, true),
        (3, 'PLANO DE SAUDE', 'Incluir colaborador no plano de saude', NULL, true)`
    ]);

    // ============ holidays (Feriados nacionais) ============
    await seedSeIfEmpty('holidays', [
      `INSERT INTO public.holidays (id, name, date, year, type, cod_loja, active) VALUES
        (1, 'Confraternizacao Universal', '01-01', NULL, 'national', 1, true),
        (2, 'Sexta-feira Santa', '04-03', NULL, 'national', 1, true),
        (3, 'Tiradentes', '04-21', NULL, 'national', 1, true),
        (4, 'Dia do Trabalho', '05-01', NULL, 'national', 1, true),
        (5, 'Independencia do Brasil', '09-07', NULL, 'national', 1, true),
        (6, 'Nossa Senhora Aparecida', '10-12', NULL, 'national', 1, true),
        (7, 'Finados', '11-02', NULL, 'national', 1, true),
        (8, 'Proclamacao da Republica', '11-15', NULL, 'national', 1, true),
        (9, 'Consciencia Negra', '11-20', NULL, 'national', 1, true),
        (10, 'Natal', '12-25', NULL, 'national', 1, true)`
    ]);

    // ============ rh_epis_epcs ============
    await seedSeIfEmpty('rh_epis_epcs', [
      `INSERT INTO public.rh_epis_epcs (id, nome, tipo, descricao, ca, validade_meses, ativo) VALUES
        (1, 'Avental de acougueiro', 'epi', 'Avental de PVC ou couro para acougue', NULL, 12, true),
        (2, 'Avental impermeavel', 'epi', 'Padaria, frente de caixa', NULL, 12, true),
        (3, 'Bota de PVC antiderrapante', 'epi', 'Acougue, hortifruti, limpeza', NULL, 12, true),
        (4, 'Capacete de seguranca', 'epi', 'Recebimento e estoque', NULL, 36, true),
        (5, 'Chuveiro/lava-olhos de emergencia', 'epc', 'Proximo a setores que usam quimicos', NULL, NULL, true),
        (6, 'Cinta abdominal lombar', 'epi', 'Repositores, conferentes, recebimento', NULL, 12, true),
        (7, 'Cinto de seguranca tipo paraquedista', 'epi', 'Trabalho em altura (estoque alto)', NULL, 12, true),
        (8, 'Extintor de incendio CO2/PQS', 'epc', 'Recarga conforme NBR - verificar validade', NULL, 12, true),
        (9, 'Faixa antiderrapante no piso', 'epc', 'Acesso a camaras frias e areas molhadas', NULL, NULL, true),
        (10, 'Guarda-corpo em escadas', 'epc', 'Conformidade com NR-8', NULL, NULL, true),
        (11, 'Jaqueta termica para camara fria', 'epi', 'Conferentes e acougueiros em camara fria', NULL, 24, true),
        (12, 'Luva de acougueiro (cota de malha)', 'epi', 'Luva de aco inox para corte de carnes', NULL, 24, true),
        (13, 'Luva impermeavel longa', 'epi', 'Para limpeza com produtos quimicos', NULL, 6, true),
        (14, 'Luva nitrilica descartavel', 'epi', 'Para manuseio de alimentos e produtos quimicos leves', NULL, 1, true),
        (15, 'Mascara descartavel', 'epi', 'Padaria, acougue, hortifruti', NULL, 1, true),
        (16, 'Oculos de protecao', 'epi', 'Limpeza com produtos quimicos, padaria', NULL, 12, true),
        (17, 'Placa de piso molhado', 'epc', 'Sinalizacao de risco em manutencao/limpeza', NULL, NULL, true),
        (18, 'Protecao de polia em equipamentos', 'epc', 'Padaria (masseira, divisora) e acougue (moedor)', NULL, NULL, true),
        (19, 'Protetor auricular', 'epi', 'Setores de producao e camaras frias', NULL, 6, true),
        (20, 'Saida de emergencia sinalizada', 'epc', 'Iluminacao de emergencia funcionando', NULL, NULL, true),
        (21, 'Sapato de seguranca com biqueira', 'epi', 'Recebimento, estoque, acougue', NULL, 18, true),
        (22, 'Touca descartavel', 'epi', 'Padaria, acougue, hortifruti, producao', NULL, 1, true),
        (23, 'Trava de seguranca em camara fria', 'epc', 'Botao panico interno na camara fria', NULL, NULL, true),
        (24, 'Avental de Pano', 'epi', 'Avental de pano', NULL, 12, true),
        (25, 'Luva borracha', 'epi', 'Luva para setor de limpeza de ambientes', NULL, 12, true)`
    ]);

    // ============ rh_escala_turnos (UUID, sem sequence) ============
    await seedSeIfEmpty('rh_escala_turnos', [
      `INSERT INTO public.rh_escala_turnos (id, company_id, codigo, nome, hora_inicio, hora_fim, total_horas, tipo, cor, ativo, pausa_minutos) VALUES
        (gen_random_uuid(), NULL, 'FG', 'Folga', NULL, NULL, 0.00, 'folga', '#D1FAE5', true, 0),
        (gen_random_uuid(), NULL, 'FE', 'Ferias', NULL, NULL, 0.00, 'ferias', '#E9D5FF', true, 0),
        (gen_random_uuid(), NULL, 'FRDO', 'Feriado', NULL, NULL, 0.00, 'feriado', '#FECACA', true, 0),
        (gen_random_uuid(), NULL, 'ATS', 'Licenca/Atestado', NULL, NULL, 0.00, 'licenca', '#E5E7EB', true, 0),
        (gen_random_uuid(), NULL, 'TM 7:15', 'Turno Manha 07:15', '07:15:00', '15:50:00', 7.58, 'turno', '#FEF3C7', true, 60),
        (gen_random_uuid(), NULL, 'TM 7:30', 'Turno Manha 07:30', '07:30:00', '15:00:00', 6.50, 'turno', '#FEF3C7', true, 60),
        (gen_random_uuid(), NULL, 'TM 8:00', 'Turno Manha 08:00', '08:00:00', '16:00:00', 7.00, 'turno', '#FEF3C7', true, 60),
        (gen_random_uuid(), NULL, 'TM 9:00', 'Turno Manha 09:00', '09:00:00', '17:00:00', 7.00, 'turno', '#FEF3C7', true, 60),
        (gen_random_uuid(), NULL, 'TT 13:00', 'Turno Tarde 13:00', '13:00:00', '21:20:00', 7.33, 'turno', '#DBEAFE', true, 60),
        (gen_random_uuid(), NULL, 'TT 15:05', 'Turno Tarde 15:05', '15:05:00', '23:25:00', 7.33, 'turno', '#DBEAFE', true, 60),
        (gen_random_uuid(), NULL, 'TT 15:20', 'Turno Tarde 15:20', '15:20:00', '23:40:00', 7.33, 'turno', '#DBEAFE', true, 60),
        (gen_random_uuid(), NULL, 'TMD 10:00', 'Turno Misto 10:00', '10:00:00', '18:20:00', 7.33, 'turno', '#FCE7F3', true, 60),
        (gen_random_uuid(), NULL, 'TMD 11:00', 'Turno Misto 11:00', '11:00:00', '19:20:00', 7.33, 'turno', '#FCE7F3', true, 60),
        (gen_random_uuid(), NULL, 'TTD 13:05', 'Tarde Reduzido 13:05', '13:05:00', '19:20:00', 5.25, 'turno', '#FED7AA', true, 60),
        (gen_random_uuid(), NULL, 'TTD 13:20', 'Tarde Reduzido 13:20', '13:20:00', '19:20:00', 5.75, 'turno', '#FED7AA', true, 15)`
    ], null);
  }

  public async down(_q: QueryRunner): Promise<void> {
    // Down nao remove (poderia apagar dados que cliente customizou em cima do seed)
  }
}
