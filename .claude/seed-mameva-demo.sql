-- ============================================================================
-- SEED DEMO MAMEVA — 100 colaboradores, 50 candidatos, 8 vagas
-- Dados ficticios baseados em Sao Jose dos Campos / SP
-- Roda no banco postgres_mameva
-- ============================================================================
-- Uso (na VPS):
--   docker cp seed-mameva-demo.sql prevencao-mameva-postgres:/tmp/
--   docker exec prevencao-mameva-postgres psql -U postgres -d postgres_mameva -f /tmp/seed-mameva-demo.sql
-- ============================================================================

BEGIN;

-- Limpar dados anteriores (mantem cargos, jornadas, sectors, etc)
TRUNCATE rh_colaboradores RESTART IDENTITY CASCADE;
TRUNCATE curriculos RESTART IDENTITY CASCADE;
TRUNCATE rh_vagas RESTART IDENTITY CASCADE;

-- =========================================================================
-- 1) COLABORADORES - 100 com distribuicao realista de supermercado
-- =========================================================================

WITH params AS (
  SELECT
    ARRAY['MARIA','ANA','JULIANA','PATRICIA','AMANDA','CAROLINE','GABRIELA','BEATRIZ','FERNANDA','CAMILA',
          'JESSICA','VANESSA','LARISSA','BRUNA','ALINE','PRISCILA','TATIANE','CLAUDIA','SANDRA','REGINA',
          'ANDREIA','ROSANA','MARCIA','LUCIA','SILVIA','KARINA','DENISE','CRISTIANE','BIANCA','LETICIA',
          'JANAINA','NATALIA','SIMONE','ELAINE','ROSANGELA','VIVIANE','DANIELA','RENATA','CARLA','MONICA',
          'DEBORA','ROBERTA','HELENA','VALERIA','ADRIANA','LUCIANE','SOLANGE','TATIANA','SUELI','ELIANE']::text[] AS nomes_fem,
    ARRAY['JOAO','JOSE','CARLOS','PEDRO','PAULO','LUCAS','MARCOS','RAFAEL','ANTONIO','FRANCISCO',
          'LUIS','RICARDO','GABRIEL','BRUNO','THIAGO','EDUARDO','LEONARDO','GUSTAVO','RODRIGO','FELIPE',
          'MATEUS','VINICIUS','DIEGO','FABIO','MARCELO','ALEXANDRE','ANDRE','ROBERTO','MURILO','JEFERSON',
          'CLAUDIO','DOUGLAS','SERGIO','ROGERIO','FERNANDO','DANIEL','ADRIANO','ALEX','EDSON','MAURO',
          'CESAR','HENRIQUE','VICTOR','RENAN','SAMUEL','ALAN','TIAGO','JONATHAN','ERICK','EVERTON']::text[] AS nomes_masc,
    ARRAY['SANTOS','SILVA','OLIVEIRA','PEREIRA','COSTA','SOUZA','FERREIRA','RODRIGUES','ALMEIDA','BARBOSA',
          'GOMES','LIMA','RIBEIRO','MARTINS','CARVALHO','ARAUJO','LOPES','MORAIS','ALVES','MENDES',
          'NUNES','MOREIRA','ROCHA','CARDOSO','AZEVEDO','REIS','CAMPOS','TEIXEIRA','MONTEIRO','MOURA',
          'CASTRO','MELO','MACHADO','VIEIRA','DIAS','CORREA','RAMOS','BORGES','PINTO','MARQUES']::text[] AS sobrenomes,
    ARRAY['JARDIM AQUARIUS','CENTRO','VILA INDUSTRIAL','PARQUE INDUSTRIAL','VILA ADYANA','JARDIM ESPLANADA',
          'JARDIM SATELITE','VILA EMA','BOSQUE DOS EUCALIPTOS','URBANOVA','JARDIM LIMOEIRO','EUGENIO DE MELO',
          'JARDIM TELESPARK','JARDIM MORUMBI','VILA SAO BENTO','PUTIM','CAJURU','GALO BRANCO','VISTA VERDE',
          'JARDIM DAS INDUSTRIAS','RESIDENCIAL DOM PEDRO','PARQUE DOS IPES','JARDIM AMERICA','VILA TATETUBA',
          'JARDIM PAULISTA','VILA MARIANA','SANTANA','JARDIM PARAIBA','CIDADE VISTA VERDE']::text[] AS bairros,
    ARRAY['RUA SEBASTIAO HUMEL','RUA RUBIAO JUNIOR','AV. SAO JOAO','AV. TIVOLI','AV. CASSIANO RICARDO',
          'RUA EUCLIDES MIRAGAIA','RUA TEOPOMPO DE VASCONCELOS','RUA FRANCISCA RICARDINO','AV. JOAO BATISTA DE SOUZA SOARES',
          'RUA ANTONIO SARAIVA','AV. NELSON D''AVILA','RUA FRANCISCO PALACIOS','RUA JOSE DE ALENCAR',
          'AV. ENGENHEIRO FRANCISCO JOSE LONGO','RUA TIRADENTES','RUA DR. RUBIAO JUNIOR','RUA CAMPOS SALES',
          'AV. ANCHIETA','RUA INGLATERRA','RUA NOVA ZELANDIA','AV. ADHEMAR DE BARROS']::text[] AS ruas,
    -- Distribuicao de cargos pra 100 colaboradores (pesos baseados em supermercado real)
    -- Posicoes 1-100, cada cargo aparece N vezes
    ARRAY[
      -- Operador(a) de Caixa: 25
      'OPERADOR(A) DE CAIXA','OPERADOR(A) DE CAIXA','OPERADOR(A) DE CAIXA','OPERADOR(A) DE CAIXA','OPERADOR(A) DE CAIXA',
      'OPERADOR(A) DE CAIXA','OPERADOR(A) DE CAIXA','OPERADOR(A) DE CAIXA','OPERADOR(A) DE CAIXA','OPERADOR(A) DE CAIXA',
      'OPERADOR(A) DE CAIXA','OPERADOR(A) DE CAIXA','OPERADOR(A) DE CAIXA','OPERADOR(A) DE CAIXA','OPERADOR(A) DE CAIXA',
      'OPERADOR(A) DE CAIXA','OPERADOR(A) DE CAIXA','OPERADOR(A) DE CAIXA','OPERADOR(A) DE CAIXA','OPERADOR(A) DE CAIXA',
      'OPERADOR(A) DE CAIXA','OPERADOR(A) DE CAIXA','OPERADOR(A) DE CAIXA','OPERADOR(A) DE CAIXA','OPERADOR(A) DE CAIXA',
      -- Repositor(a): 15
      'REPOSITOR(A)','REPOSITOR(A)','REPOSITOR(A)','REPOSITOR(A)','REPOSITOR(A)',
      'REPOSITOR(A)','REPOSITOR(A)','REPOSITOR(A)','REPOSITOR(A)','REPOSITOR(A)',
      'REPOSITOR(A)','REPOSITOR(A)','REPOSITOR(A)','REPOSITOR(A)','REPOSITOR(A)',
      -- Auxiliar de Acougue: 8
      'AUXILIAR DE ACOUGUE','AUXILIAR DE ACOUGUE','AUXILIAR DE ACOUGUE','AUXILIAR DE ACOUGUE',
      'AUXILIAR DE ACOUGUE','AUXILIAR DE ACOUGUE','AUXILIAR DE ACOUGUE','AUXILIAR DE ACOUGUE',
      -- Auxiliar de Padaria: 6
      'AUXILIAR DE PADARIA','AUXILIAR DE PADARIA','AUXILIAR DE PADARIA',
      'AUXILIAR DE PADARIA','AUXILIAR DE PADARIA','AUXILIAR DE PADARIA',
      -- Confeiteiro: 4
      'CONFEITEIRO','CONFEITEIRO','CONFEITEIRO','CONFEITEIRO',
      -- Acougueiro: 5
      'ACOUGUEIRO','ACOUGUEIRO','ACOUGUEIRO','ACOUGUEIRO','ACOUGUEIRO',
      -- Balconista: 5
      'BALCONISTA DE PADARIA','BALCONISTA DE PADARIA','BALCONISTA DE PADARIA',
      'BALCONISTA DE PADARIA','BALCONISTA DE PADARIA',
      -- Auxiliar de Limpeza: 5
      'AUXILIAR DE LIMPEZA','AUXILIAR DE LIMPEZA','AUXILIAR DE LIMPEZA',
      'AUXILIAR DE LIMPEZA','AUXILIAR DE LIMPEZA',
      -- Conferente: 3
      'CONFERENTE','CONFERENTE','CONFERENTE',
      -- Repositor FLV: 3
      'REPOSITOR(A) DE FLV','REPOSITOR(A) DE FLV','REPOSITOR(A) DE FLV',
      -- Menor Aprendiz: 5
      'MENOR APRENDIZ (CAIXA)','MENOR APRENDIZ (CAIXA)','MENOR APRENDIZ (CAIXA)',
      'MENOR APRENDIZ (REPOSICAO)','MENOR APRENDIZ (REPOSICAO)',
      -- Lideres: 4
      'LIDER DE CAIXA','LIDER DE ACOUGUE','LIDER DE PADARIA','LIDER DE MERCEARIA',
      -- Gestao: 3
      'GERENTE','SUB GERENTE','RECURSOS HUMANOS',
      -- Outros: 9
      'FISCAL DE CAIXA','FISCAL DE CAIXA','MOTORISTA','MOTORISTA',
      'COMPRADOR','MARKETING','FINANCEIRO','CPD','CONFEITEIRO'
    ]::text[] AS cargos_dist
)
INSERT INTO rh_colaboradores (
  matricula, nome, cpf, rg, data_nascimento, sexo, estado_civil, nacionalidade,
  cep, endereco, numero, bairro, cidade, estado,
  celular, telefone, email,
  escolaridade_id, cargo_id, jornada_id, escala_id, regime_trabalho_id, sector_id,
  data_admissao, salario, status,
  data_desligamento, tipo_desligamento_id, motivo_desligamento_id,
  vale_transporte, vale_refeicao, plano_saude,
  foto_url
)
SELECT
  LPAD(i::text, 4, '0') AS matricula,
  -- Nome (50% F / 50% M)
  CASE (i % 2)
    WHEN 0 THEN p.nomes_fem[1 + ((i * 7) % 50)] || ' ' || p.sobrenomes[1 + ((i * 13) % 40)] || ' ' || p.sobrenomes[1 + ((i * 17) % 40)]
    ELSE p.nomes_masc[1 + ((i * 11) % 50)] || ' ' || p.sobrenomes[1 + ((i * 19) % 40)] || ' ' || p.sobrenomes[1 + ((i * 23) % 40)]
  END AS nome,
  -- CPF ficticio (formato OK, valor nao validado)
  LPAD(((i * 7919 + 100000000)::bigint % 100000000000)::text, 11, '0') AS cpf,
  -- RG ficticio
  LPAD(((i * 1009 + 1000000)::bigint % 100000000)::text, 8, '0') || '-' || ((i % 10))::text AS rg,
  -- Data de nascimento (16 a 60 anos)
  (CURRENT_DATE - INTERVAL '17 years' - (((i * 31) % 16000) || ' days')::INTERVAL)::date AS data_nascimento,
  -- Sexo
  CASE (i % 2) WHEN 0 THEN 'F' ELSE 'M' END AS sexo,
  CASE (i % 4) WHEN 0 THEN 'SOLTEIRO(A)' WHEN 1 THEN 'CASADO(A)' WHEN 2 THEN 'UNIAO ESTAVEL' ELSE 'DIVORCIADO(A)' END AS estado_civil,
  'BRASILEIRO(A)' AS nacionalidade,
  -- Endereco
  '12' || LPAD(((i * 31) % 1000)::text, 3, '0') || '-' || LPAD(((i * 7) % 1000)::text, 3, '0') AS cep,
  p.ruas[1 + ((i * 3) % array_length(p.ruas, 1))] AS endereco,
  ((i * 13) % 2000 + 100)::text AS numero,
  p.bairros[1 + ((i * 7) % array_length(p.bairros, 1))] AS bairro,
  'SAO JOSE DOS CAMPOS' AS cidade,
  'SP' AS estado,
  -- Contato
  '(12) 9' || LPAD(((i * 1009) % 100000000)::text, 8, '0') AS celular,
  '(12) 3' || LPAD(((i * 503) % 10000000)::text, 7, '0') AS telefone,
  LOWER(REPLACE(
    CASE (i % 2)
      WHEN 0 THEN p.nomes_fem[1 + ((i * 7) % 50)] || '.' || p.sobrenomes[1 + ((i * 13) % 40)]
      ELSE p.nomes_masc[1 + ((i * 11) % 50)] || '.' || p.sobrenomes[1 + ((i * 19) % 40)]
    END,
    ' ', ''
  )) || i::text || '@email.com' AS email,
  -- Escolaridade aleatoria (1-7)
  ((i % 7) + 1) AS escolaridade_id,
  -- Cargo (lookup por nome)
  (SELECT id FROM rh_cargos WHERE nome = p.cargos_dist[i]) AS cargo_id,
  -- Jornada (1=CLT 7:20, 2=CLT 6:00, 3=APRENDIZ)
  CASE
    WHEN p.cargos_dist[i] LIKE '%APRENDIZ%' THEN 3
    WHEN i % 3 = 0 THEN 2
    ELSE 1
  END AS jornada_id,
  -- Escala (1=6x1 padrao)
  CASE WHEN i % 5 = 0 THEN 2 ELSE 1 END AS escala_id,
  -- Regime (1=CLT, 2=APRENDIZ)
  CASE WHEN p.cargos_dist[i] LIKE '%APRENDIZ%' THEN 2 ELSE 1 END AS regime_trabalho_id,
  -- Setor baseado no cargo
  CASE
    WHEN p.cargos_dist[i] LIKE '%ACOUGU%' THEN (SELECT id FROM sectors WHERE name = 'AÇOUGUE' LIMIT 1)
    WHEN p.cargos_dist[i] LIKE '%PADARIA%' OR p.cargos_dist[i] LIKE '%CONFEIT%' THEN (SELECT id FROM sectors WHERE name = 'PADARIA' LIMIT 1)
    WHEN p.cargos_dist[i] LIKE '%CAIXA%' OR p.cargos_dist[i] = 'FISCAL DE CAIXA' THEN (SELECT id FROM sectors WHERE name = 'PREVENÇÃO DE PERDAS' LIMIT 1)
    WHEN p.cargos_dist[i] = 'CONFERENTE' THEN (SELECT id FROM sectors WHERE name = 'CONFERENCIA' LIMIT 1)
    WHEN p.cargos_dist[i] = 'GERENTE' OR p.cargos_dist[i] = 'SUB GERENTE' OR p.cargos_dist[i] = 'COMPRADOR' OR p.cargos_dist[i] = 'MARKETING' OR p.cargos_dist[i] = 'FINANCEIRO' THEN (SELECT id FROM sectors WHERE name = 'ADMINISTRATIVO' LIMIT 1)
    WHEN p.cargos_dist[i] = 'RECURSOS HUMANOS' THEN (SELECT id FROM sectors WHERE name = 'RECURSOS HUMANOS' LIMIT 1)
    WHEN p.cargos_dist[i] = 'CPD' THEN (SELECT id FROM sectors WHERE name = 'CPD' LIMIT 1)
    ELSE (SELECT id FROM sectors WHERE name = 'ADMINISTRATIVO' LIMIT 1)
  END AS sector_id,
  -- Data admissao (entre 1 mes e 5 anos atras)
  (CURRENT_DATE - (((i * 53) % 1825) || ' days')::INTERVAL)::date AS data_admissao,
  -- Salario (do cargo, com pequena variacao)
  COALESCE(
    (SELECT salario_base FROM rh_cargos WHERE nome = p.cargos_dist[i]),
    (SELECT ROUND(AVG(salario)::numeric, 2)
     FROM (SELECT 1500 + ((i * 17) % 800) AS salario) s),
    1518.00
  )::numeric(10,2) AS salario,
  -- Status: 80% ativo, 20% desligado (a cada 5 colaboradores, 1 desligado)
  CASE WHEN i % 5 = 0 THEN 'desligado' ELSE 'ativo' END AS status,
  -- Data desligamento (apenas quando status='desligado')
  CASE WHEN i % 5 = 0
    THEN (CURRENT_DATE - (((i * 13) % 365) || ' days')::INTERVAL)::date
    ELSE NULL
  END AS data_desligamento,
  -- Tipo desligamento round-robin pros 8 tipos
  CASE WHEN i % 5 = 0 THEN ((i / 5) % 8 + 1) ELSE NULL END AS tipo_desligamento_id,
  -- Motivo desligamento round-robin
  CASE WHEN i % 5 = 0 THEN ((i / 5) % 8 + 1) ELSE NULL END AS motivo_desligamento_id,
  -- Beneficios
  (i % 3 = 0) AS vale_transporte,
  (i % 4 = 0) AS vale_refeicao,
  (i % 7 = 0) AS plano_saude,
  -- Foto: randomuser.me (50% mulher, 50% homem)
  CASE (i % 2)
    WHEN 0 THEN 'https://randomuser.me/api/portraits/women/' || (i % 99)::text || '.jpg'
    ELSE 'https://randomuser.me/api/portraits/men/' || (i % 99)::text || '.jpg'
  END AS foto_url
FROM generate_series(1, 100) AS i, params p;

-- =========================================================================
-- 2) CURRICULOS - 50 candidatos com mix de status
-- =========================================================================

WITH params AS (
  SELECT
    ARRAY['MARIA','ANA','JULIANA','PATRICIA','AMANDA','CAROLINE','GABRIELA','BEATRIZ','FERNANDA','CAMILA',
          'JESSICA','VANESSA','LARISSA','BRUNA','ALINE','PRISCILA','TATIANE','CLAUDIA','SANDRA','REGINA',
          'ANDREIA','ROSANA','MARCIA','LUCIA','SILVIA','KARINA','DENISE','CRISTIANE','BIANCA','LETICIA']::text[] AS nomes_fem,
    ARRAY['JOAO','JOSE','CARLOS','PEDRO','PAULO','LUCAS','MARCOS','RAFAEL','ANTONIO','FRANCISCO',
          'LUIS','RICARDO','GABRIEL','BRUNO','THIAGO','EDUARDO','LEONARDO','GUSTAVO','RODRIGO','FELIPE',
          'MATEUS','VINICIUS','DIEGO','FABIO','MARCELO','ALEXANDRE','ANDRE','ROBERTO','MURILO','JEFERSON']::text[] AS nomes_masc,
    ARRAY['SANTOS','SILVA','OLIVEIRA','PEREIRA','COSTA','SOUZA','FERREIRA','RODRIGUES','ALMEIDA','BARBOSA',
          'GOMES','LIMA','RIBEIRO','MARTINS','CARVALHO','ARAUJO','LOPES','MORAIS','ALVES','MENDES']::text[] AS sobrenomes,
    ARRAY['JARDIM AQUARIUS','CENTRO','VILA INDUSTRIAL','PARQUE INDUSTRIAL','VILA ADYANA','JARDIM ESPLANADA',
          'JARDIM SATELITE','VILA EMA','BOSQUE DOS EUCALIPTOS','URBANOVA','JARDIM LIMOEIRO','EUGENIO DE MELO',
          'JARDIM TELESPARK','JARDIM MORUMBI','VILA SAO BENTO','PUTIM','CAJURU','GALO BRANCO','VISTA VERDE',
          'JARDIM DAS INDUSTRIAS']::text[] AS bairros,
    ARRAY['novo','novo','novo','novo','novo','novo','em_analise','em_analise','em_analise','em_analise',
          'em_analise','aprovado','aprovado','aprovado','reprovado','reprovado','contratado',
          'novo','novo','novo','em_analise','em_analise','aprovado','aprovado','novo','novo',
          'em_analise','aprovado','reprovado','novo','novo','novo','em_analise','aprovado',
          'novo','novo','em_analise','novo','aprovado','reprovado','novo','em_analise',
          'novo','novo','aprovado','contratado','novo','em_analise','novo','aprovado']::text[] AS status_dist
)
INSERT INTO curriculos (
  nome, data_nascimento,
  whatsapp, email, instagram,
  cep, rua, numero, bairro, cidade, estado,
  cargos, interesse_vaga, status,
  experiencia_texto, observacao_rh, foto_url,
  cod_loja, created_at
)
SELECT
  -- Nome
  CASE (i % 2)
    WHEN 0 THEN p.nomes_fem[1 + ((i * 13) % 30)] || ' ' || p.sobrenomes[1 + ((i * 7) % 20)] || ' ' || p.sobrenomes[1 + ((i * 11) % 20)]
    ELSE p.nomes_masc[1 + ((i * 17) % 30)] || ' ' || p.sobrenomes[1 + ((i * 23) % 20)] || ' ' || p.sobrenomes[1 + ((i * 29) % 20)]
  END,
  -- Nascimento (18-50 anos)
  (CURRENT_DATE - INTERVAL '18 years' - (((i * 41) % 12000) || ' days')::INTERVAL)::date,
  '(12) 9' || LPAD(((i * 4007) % 100000000)::text, 8, '0'),
  LOWER(REPLACE(
    CASE (i % 2)
      WHEN 0 THEN p.nomes_fem[1 + ((i * 13) % 30)] || '.' || p.sobrenomes[1 + ((i * 7) % 20)]
      ELSE p.nomes_masc[1 + ((i * 17) % 30)] || '.' || p.sobrenomes[1 + ((i * 23) % 20)]
    END, ' ', ''
  )) || i::text || '@gmail.com',
  '@candidato' || i::text,
  '12' || LPAD(((i * 53) % 1000)::text, 3, '0') || '-' || LPAD(((i * 11) % 1000)::text, 3, '0'),
  'RUA ' || (ARRAY['DAS FLORES','DAS PALMEIRAS','DOS IPES','DAS ACACIAS','DOS LIRIOS','PRINCIPAL','SAO JOSE','DOS PINHEIROS'])[1 + (i % 8)],
  ((i * 17) % 1500 + 50)::text,
  p.bairros[1 + ((i * 5) % array_length(p.bairros, 1))],
  'SAO JOSE DOS CAMPOS',
  'SP',
  -- Cargos de interesse (jsonb array com 1-3 cargos)
  CASE (i % 5)
    WHEN 0 THEN '["OPERADOR(A) DE CAIXA"]'::jsonb
    WHEN 1 THEN '["REPOSITOR(A)", "AUXILIAR DE LIMPEZA"]'::jsonb
    WHEN 2 THEN '["AUXILIAR DE PADARIA", "BALCONISTA DE PADARIA"]'::jsonb
    WHEN 3 THEN '["AUXILIAR DE ACOUGUE"]'::jsonb
    ELSE '["MENOR APRENDIZ (CAIXA)", "OPERADOR(A) DE CAIXA"]'::jsonb
  END,
  -- Interesse (clt ou aprendiz)
  CASE WHEN i % 7 = 0 THEN 'aprendiz' ELSE 'clt' END,
  p.status_dist[i],
  -- Experiencias texto
  CASE (i % 4)
    WHEN 0 THEN 'EXPERIENCIA ANTERIOR EM SUPERMERCADO POR 2 ANOS. ATUEI COMO OPERADORA DE CAIXA NO ATACADAO.'
    WHEN 1 THEN 'PRIMEIRO EMPREGO. CURSANDO ENSINO MEDIO. DISPONIBILIDADE DE HORARIO COMPLETA.'
    WHEN 2 THEN 'TRABALHEI 3 ANOS NO MERCADO MIX. EXPERIENCIA EM REPOSICAO E ATENDIMENTO.'
    ELSE 'CURSO TECNICO EM ALIMENTOS. EXPERIENCIA EM PADARIA E CONFEITARIA POR 5 ANOS.'
  END,
  CASE (i % 3)
    WHEN 0 THEN 'POSSUO CNH B. RESIDO PROXIMO AO LOCAL DE TRABALHO.'
    WHEN 1 THEN 'DISPONIBILIDADE PARA TURNOS NOTURNOS E FINAIS DE SEMANA.'
    ELSE 'TENHO INTERESSE EM CRESCER DENTRO DA EMPRESA.'
  END,
  -- Foto
  CASE (i % 2)
    WHEN 0 THEN 'https://randomuser.me/api/portraits/women/' || ((i + 30) % 99)::text || '.jpg'
    ELSE 'https://randomuser.me/api/portraits/men/' || ((i + 30) % 99)::text || '.jpg'
  END,
  -- Cod_loja
  1,
  -- Created_at distribuido nos ultimos 90 dias
  (NOW() - ((i * 2) || ' days')::INTERVAL - ((i * 7) || ' hours')::INTERVAL)
FROM generate_series(1, 50) AS i, params p;

-- =========================================================================
-- 3) VAGAS - 8 vagas (3 abertas, 5 em selecao com selecionados)
-- =========================================================================

INSERT INTO rh_vagas (
  cargo_id, departamento_id, titulo, descricao, quantidade_vagas,
  salario_min, data_abertura, status, requisitos, beneficios, selecionados
)
SELECT
  c.id AS cargo_id,
  NULL AS departamento_id,
  c.nome AS titulo,
  'Buscamos profissional ' || LOWER(c.nome) || ' para integrar nossa equipe.' AS descricao,
  1 AS quantidade_vagas,
  c.salario_base AS salario_min,
  (CURRENT_DATE - ((row_num * 7) || ' days')::INTERVAL)::date AS data_abertura,
  CASE WHEN row_num <= 3 THEN 'Aberta' ELSE 'Em Selecao' END AS status,
  CASE c.nome
    WHEN 'OPERADOR(A) DE CAIXA' THEN 'Ensino medio completo. Disponibilidade de horario.'
    WHEN 'AUXILIAR DE PADARIA' THEN 'Ensino fundamental completo. Experiencia em padaria desejavel.'
    WHEN 'REPOSITOR(A)' THEN 'Ensino fundamental completo. Disposicao para esforco fisico.'
    WHEN 'ACOUGUEIRO' THEN 'Experiencia comprovada em corte de carnes. Curso tecnico desejavel.'
    WHEN 'CONFEITEIRO' THEN 'Experiencia em confeitaria. Curso tecnico em alimentos sera diferencial.'
    WHEN 'AUXILIAR DE LIMPEZA' THEN 'Ensino fundamental. Disposicao e atencao.'
    WHEN 'BALCONISTA DE PADARIA' THEN 'Ensino medio. Atendimento ao cliente.'
    WHEN 'CONFERENTE' THEN 'Ensino medio completo. Atencao a detalhes.'
  END AS requisitos,
  'VALE TRANSPORTE, VALE REFEICAO' AS beneficios,
  -- Selecionados pra vagas Em Selecao (com candidatos do banco)
  CASE WHEN row_num > 3 THEN
    (SELECT jsonb_agg(jsonb_build_object(
      'curriculo_id', cv.id,
      'nome', cv.nome,
      'adicionado_em', NOW() - INTERVAL '5 days',
      'entrevista', CASE (cv.id % 3) WHEN 0 THEN 'agendada' ELSE 'realizada' END,
      'data_entrevista', CASE (cv.id % 3) WHEN 0 THEN (NOW() + INTERVAL '2 days')::text ELSE NULL END,
      'entrevistador', CASE (cv.id % 3) WHEN 0 THEN 'MARIA - RH' ELSE NULL END,
      'resultado_entrevista', CASE (cv.id % 5)
        WHEN 0 THEN 'passou'
        WHEN 1 THEN 'aguarda_decisao'
        WHEN 2 THEN 'nao_compareceu'
        WHEN 3 THEN 'reprovado'
        ELSE 'passou'
      END,
      'pos_entrevista', CASE (cv.id % 5)
        WHEN 0 THEN 'aguarda_agendar_exames'
        WHEN 4 THEN 'aguarda_resultado_exames'
        ELSE NULL
      END,
      'data_agendar_exames', CASE WHEN cv.id % 5 = 0 THEN (CURRENT_DATE + INTERVAL '7 days')::text ELSE NULL END,
      'data_resultado_exames', CASE WHEN cv.id % 5 = 4 THEN (CURRENT_DATE + INTERVAL '14 days')::text ELSE NULL END,
      'contratado', false,
      'colaborador_id', NULL
    ))
    FROM (SELECT id, nome FROM curriculos ORDER BY id LIMIT 3 OFFSET (row_num - 4) * 3) cv
    )
  ELSE '[]'::jsonb END AS selecionados
FROM (
  SELECT c.*, ROW_NUMBER() OVER (ORDER BY c.id) AS row_num
  FROM rh_cargos c
  WHERE c.nome IN (
    'OPERADOR(A) DE CAIXA','AUXILIAR DE PADARIA','REPOSITOR(A)',
    'ACOUGUEIRO','CONFEITEIRO','AUXILIAR DE LIMPEZA','BALCONISTA DE PADARIA','CONFERENTE'
  )
) c;

COMMIT;

-- Verificar resultados
SELECT 'colaboradores' tipo, count(*), count(*) FILTER (WHERE status='ativo') ativos, count(*) FILTER (WHERE status='desligado') desligados FROM rh_colaboradores
UNION ALL
SELECT 'curriculos', count(*), 0, count(*) FILTER (WHERE status='aprovado') aprovados FROM curriculos
UNION ALL
SELECT 'vagas', count(*), count(*) FILTER (WHERE status='Aberta') abertas, count(*) FILTER (WHERE status='Em Selecao') em_selecao FROM rh_vagas;
