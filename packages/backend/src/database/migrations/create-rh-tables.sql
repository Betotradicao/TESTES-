-- ============================================
-- RH NO RADAR - TABELAS BASE
-- Prefixo rh_ para evitar conflitos
-- ============================================

-- Tabela de Cargos
CREATE TABLE IF NOT EXISTS rh_cargos (
  id SERIAL PRIMARY KEY,
  nome VARCHAR(255) NOT NULL,
  tipo VARCHAR(100),
  salario_base DECIMAL(10,2),
  descricao TEXT,
  ativo BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabela de Departamentos
CREATE TABLE IF NOT EXISTS rh_departamentos (
  id SERIAL PRIMARY KEY,
  nome VARCHAR(255) NOT NULL,
  descricao TEXT,
  ativo BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabela de Empresas
CREATE TABLE IF NOT EXISTS rh_empresas (
  id SERIAL PRIMARY KEY,
  nome VARCHAR(255) NOT NULL,
  cnpj VARCHAR(20),
  razao_social VARCHAR(255),
  endereco VARCHAR(255),
  numero VARCHAR(20),
  complemento VARCHAR(100),
  bairro VARCHAR(100),
  cidade VARCHAR(100),
  estado VARCHAR(2),
  cep VARCHAR(9),
  telefone VARCHAR(20),
  email VARCHAR(255),
  descricao TEXT,
  ativo BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabela de Jornadas de Trabalho
CREATE TABLE IF NOT EXISTS rh_jornadas (
  id SERIAL PRIMARY KEY,
  nome VARCHAR(255) NOT NULL,
  horas_diarias DECIMAL(4,2),
  horas_mensais DECIMAL(6,2),
  horas_trabalhadas DECIMAL(6,2),
  tempo_pausa DECIMAL(4,2),
  descricao TEXT,
  ativo BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabela de Escolaridades
CREATE TABLE IF NOT EXISTS rh_escolaridades (
  id SERIAL PRIMARY KEY,
  nome VARCHAR(255) NOT NULL,
  ordem INT,
  ativo BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabela de Regimes de Trabalho
CREATE TABLE IF NOT EXISTS rh_regimes_trabalho (
  id SERIAL PRIMARY KEY,
  nome VARCHAR(255) NOT NULL,
  descricao TEXT,
  ativo BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabela de Tipos de Desligamento
CREATE TABLE IF NOT EXISTS rh_tipos_desligamento (
  id SERIAL PRIMARY KEY,
  nome VARCHAR(255) NOT NULL,
  categoria VARCHAR(100),
  ativo BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabela de Motivos de Desligamento
CREATE TABLE IF NOT EXISTS rh_motivos_desligamento (
  id SERIAL PRIMARY KEY,
  tipo_id INT REFERENCES rh_tipos_desligamento(id),
  nome VARCHAR(255) NOT NULL,
  ativo BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabela de Escalas
CREATE TABLE IF NOT EXISTS rh_escalas (
  id SERIAL PRIMARY KEY,
  nome VARCHAR(255) NOT NULL,
  descricao TEXT,
  ativo BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabela de Formas de Pagamento
CREATE TABLE IF NOT EXISTS rh_formas_pagamento (
  id SERIAL PRIMARY KEY,
  nome VARCHAR(255) NOT NULL,
  descricao TEXT,
  ativo BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabela de Prazos de Experiencia
CREATE TABLE IF NOT EXISTS rh_prazos_experiencia (
  id SERIAL PRIMARY KEY,
  nome VARCHAR(255) NOT NULL,
  dias INT NOT NULL,
  descricao TEXT,
  ativo BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- TABELA PRINCIPAL: COLABORADORES
-- ============================================
CREATE TABLE IF NOT EXISTS rh_colaboradores (
  id SERIAL PRIMARY KEY,
  nome VARCHAR(255) NOT NULL,
  cpf VARCHAR(14) UNIQUE,
  rg VARCHAR(20),
  data_nascimento DATE,
  sexo VARCHAR(1),
  estado_civil VARCHAR(50),
  nacionalidade VARCHAR(100),
  naturalidade VARCHAR(100),
  telefone VARCHAR(20),
  celular VARCHAR(20),
  email VARCHAR(255),
  email_pessoal VARCHAR(255),
  cep VARCHAR(9),
  endereco VARCHAR(255),
  numero VARCHAR(20),
  complemento VARCHAR(100),
  bairro VARCHAR(100),
  cidade VARCHAR(100),
  estado VARCHAR(2),
  matricula VARCHAR(50) UNIQUE NOT NULL,
  cargo_id INT REFERENCES rh_cargos(id),
  empresa_id INT REFERENCES rh_empresas(id),
  jornada_id INT REFERENCES rh_jornadas(id),
  escolaridade_id INT REFERENCES rh_escolaridades(id),
  regime_trabalho_id INT REFERENCES rh_regimes_trabalho(id),
  data_admissao DATE,
  data_desligamento DATE,
  tipo_desligamento_id INT REFERENCES rh_tipos_desligamento(id),
  motivo_desligamento_id INT REFERENCES rh_motivos_desligamento(id),
  observacoes_desligamento TEXT,
  salario DECIMAL(10,2),
  vale_transporte BOOLEAN DEFAULT false,
  vale_refeicao BOOLEAN DEFAULT false,
  valor_vale_refeicao DECIMAL(10,2),
  plano_saude BOOLEAN DEFAULT false,
  banco VARCHAR(100),
  agencia VARCHAR(20),
  conta VARCHAR(30),
  tipo_conta VARCHAR(20),
  pix VARCHAR(255),
  ctps VARCHAR(50),
  serie_ctps VARCHAR(20),
  pis_pasep VARCHAR(20),
  titulo_eleitor VARCHAR(20),
  reservista VARCHAR(50),
  nome_mae VARCHAR(255),
  nome_pai VARCHAR(255),
  status VARCHAR(20) DEFAULT 'ativo',
  observacoes TEXT,
  filtro1 VARCHAR(100),
  filtro2 VARCHAR(100),
  filtro3 VARCHAR(100),
  foto_url VARCHAR(500),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indices
CREATE INDEX IF NOT EXISTS idx_rh_colaboradores_matricula ON rh_colaboradores(matricula);
CREATE INDEX IF NOT EXISTS idx_rh_colaboradores_cpf ON rh_colaboradores(cpf);
CREATE INDEX IF NOT EXISTS idx_rh_colaboradores_status ON rh_colaboradores(status);
CREATE INDEX IF NOT EXISTS idx_rh_colaboradores_cargo ON rh_colaboradores(cargo_id);
CREATE INDEX IF NOT EXISTS idx_rh_colaboradores_empresa ON rh_colaboradores(empresa_id);

-- ASO - Atestado de Saude Ocupacional
CREATE TABLE IF NOT EXISTS rh_aso (
  id SERIAL PRIMARY KEY,
  colaborador_id INT REFERENCES rh_colaboradores(id) ON DELETE CASCADE,
  data_emissao DATE NOT NULL,
  data_vencimento DATE NOT NULL,
  validade_dias INT DEFAULT 365,
  tipo VARCHAR(50),
  medico_responsavel VARCHAR(255),
  crm VARCHAR(50),
  clinica VARCHAR(255),
  apto BOOLEAN DEFAULT true,
  observacoes TEXT,
  arquivo_url VARCHAR(500),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_rh_aso_colaborador ON rh_aso(colaborador_id);
CREATE INDEX IF NOT EXISTS idx_rh_aso_vencimento ON rh_aso(data_vencimento);

-- Tipos de Ausencia
CREATE TABLE IF NOT EXISTS rh_tipos_ausencia (
  id SERIAL PRIMARY KEY,
  nome VARCHAR(255) NOT NULL,
  cor VARCHAR(20),
  ativo BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Motivos de Ausencia
CREATE TABLE IF NOT EXISTS rh_motivos_ausencia (
  id SERIAL PRIMARY KEY,
  tipo_id INT REFERENCES rh_tipos_ausencia(id),
  nome VARCHAR(255) NOT NULL,
  descontar_salario BOOLEAN DEFAULT false,
  ativo BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Ausencias
CREATE TABLE IF NOT EXISTS rh_ausencias (
  id SERIAL PRIMARY KEY,
  colaborador_id INT REFERENCES rh_colaboradores(id) ON DELETE CASCADE,
  data_ausencia DATE NOT NULL,
  data_inicio DATE,
  data_fim DATE,
  tipo_ausencia_id INT REFERENCES rh_tipos_ausencia(id),
  motivo_ausencia_id INT REFERENCES rh_motivos_ausencia(id),
  justificativa TEXT,
  arquivo_comprovante VARCHAR(500),
  horas_ausentes DECIMAL(5,2),
  descontar_salario BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_rh_ausencias_colaborador ON rh_ausencias(colaborador_id);
CREATE INDEX IF NOT EXISTS idx_rh_ausencias_data ON rh_ausencias(data_ausencia);

-- Treinamentos
CREATE TABLE IF NOT EXISTS rh_tipos_treinamento (
  id SERIAL PRIMARY KEY,
  nome VARCHAR(255) NOT NULL,
  categoria VARCHAR(100),
  ativo BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS rh_status_treinamento (
  id SERIAL PRIMARY KEY,
  nome VARCHAR(100) NOT NULL,
  cor VARCHAR(20),
  ativo BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS rh_treinamentos (
  id SERIAL PRIMARY KEY,
  colaborador_id INT REFERENCES rh_colaboradores(id) ON DELETE CASCADE,
  tipo_treinamento_id INT REFERENCES rh_tipos_treinamento(id),
  nome_treinamento VARCHAR(255) NOT NULL,
  instrutor VARCHAR(255),
  instituicao VARCHAR(255),
  local VARCHAR(255),
  carga_horaria DECIMAL(6,2),
  data_inicio DATE,
  data_fim DATE,
  custo DECIMAL(10,2),
  status_id INT REFERENCES rh_status_treinamento(id),
  certificado_url VARCHAR(500),
  observacoes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_rh_treinamentos_colaborador ON rh_treinamentos(colaborador_id);

-- Vagas (Recrutamento)
CREATE TABLE IF NOT EXISTS rh_vagas (
  id SERIAL PRIMARY KEY,
  cargo_id INT REFERENCES rh_cargos(id),
  departamento_id INT REFERENCES rh_departamentos(id),
  titulo VARCHAR(255) NOT NULL,
  descricao TEXT,
  quantidade_vagas INT DEFAULT 1,
  salario_min DECIMAL(10,2),
  salario_max DECIMAL(10,2),
  data_abertura DATE,
  data_fechamento DATE,
  status VARCHAR(50) DEFAULT 'Aberta',
  motivo_fechamento VARCHAR(255),
  requisitos TEXT,
  beneficios TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Candidatos
CREATE TABLE IF NOT EXISTS rh_candidatos (
  id SERIAL PRIMARY KEY,
  vaga_id INT REFERENCES rh_vagas(id) ON DELETE CASCADE,
  nome VARCHAR(255) NOT NULL,
  cpf VARCHAR(14),
  email VARCHAR(255),
  telefone VARCHAR(20),
  data_nascimento DATE,
  escolaridade_id INT REFERENCES rh_escolaridades(id),
  curriculo_url VARCHAR(500),
  status VARCHAR(50) DEFAULT 'Triagem',
  data_status TIMESTAMP,
  pontuacao DECIMAL(5,2),
  observacoes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Lancamentos Financeiros (Folha)
CREATE TABLE IF NOT EXISTS rh_lancamentos_financeiros (
  id SERIAL PRIMARY KEY,
  mes INT NOT NULL,
  ano INT NOT NULL,
  receita_bruta DECIMAL(12,2),
  folha_salario DECIMAL(12,2),
  folha_estagiarios DECIMAL(12,2),
  folha_familia DECIMAL(12,2),
  beneficios_vt DECIMAL(12,2),
  beneficios_vr DECIMAL(12,2),
  beneficios_saude DECIMAL(12,2),
  outros_custos DECIMAL(12,2),
  observacoes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(mes, ano)
);

-- Dependentes
CREATE TABLE IF NOT EXISTS rh_dependentes (
  id SERIAL PRIMARY KEY,
  colaborador_id INT REFERENCES rh_colaboradores(id) ON DELETE CASCADE,
  nome VARCHAR(255) NOT NULL,
  sexo VARCHAR(1),
  parentesco_id INT,
  data_nascimento DATE,
  cpf VARCHAR(14),
  dependente_ir BOOLEAN DEFAULT false,
  dependente_sf BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Historico de Alteracoes
CREATE TABLE IF NOT EXISTS rh_historico_alteracoes (
  id SERIAL PRIMARY KEY,
  colaborador_id INT REFERENCES rh_colaboradores(id) ON DELETE CASCADE,
  data_inicio DATE NOT NULL,
  data_fim DATE,
  cargo_id INT REFERENCES rh_cargos(id),
  jornada_id INT REFERENCES rh_jornadas(id),
  salario DECIMAL(10,2),
  motivo VARCHAR(255),
  observacoes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Resultados DISC
CREATE TABLE IF NOT EXISTS rh_disc_resultados (
  id SERIAL PRIMARY KEY,
  nome VARCHAR(255) NOT NULL,
  colaborador_id INT REFERENCES rh_colaboradores(id) ON DELETE SET NULL,
  score_d INT DEFAULT 0,
  score_i INT DEFAULT 0,
  score_s INT DEFAULT 0,
  score_c INT DEFAULT 0,
  perfil_primario VARCHAR(1) NOT NULL,
  perfil_secundario VARCHAR(1),
  respostas JSONB,
  avaliador_id UUID,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_rh_disc_nome ON rh_disc_resultados(nome);

-- ============================================
-- PREVENCAO ACOUGUE - DESMEMBRAMENTO
-- ============================================

-- Templates de Rendimento (ex: BOI CASADA, BOI TRASEIRO, etc)
CREATE TABLE IF NOT EXISTS acougue_rendimento_templates (
  id SERIAL PRIMARY KEY,
  nome VARCHAR(255) NOT NULL,
  descricao TEXT,
  ativo BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Itens do Template (cada corte com seu percentual e preco de venda)
CREATE TABLE IF NOT EXISTS acougue_rendimento_itens (
  id SERIAL PRIMARY KEY,
  template_id INT REFERENCES acougue_rendimento_templates(id) ON DELETE CASCADE,
  nome_corte VARCHAR(255) NOT NULL,
  codigo_produto VARCHAR(20),
  percentual DECIMAL(6,4) NOT NULL,
  preco_venda DECIMAL(10,2),
  vende BOOLEAN DEFAULT true,
  ordem INT DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_acougue_itens_template ON acougue_rendimento_itens(template_id);

-- Historico de Desmembramentos realizados
CREATE TABLE IF NOT EXISTS acougue_desmembramentos (
  id SERIAL PRIMARY KEY,
  template_id INT REFERENCES acougue_rendimento_templates(id),
  template_nome VARCHAR(255),
  peso_total DECIMAL(10,3) NOT NULL,
  custo_kg DECIMAL(10,2) NOT NULL,
  custo_total DECIMAL(12,2) NOT NULL,
  receita_total DECIMAL(12,2) NOT NULL,
  lucro_total DECIMAL(12,2) NOT NULL,
  margem_pct DECIMAL(6,2) NOT NULL,
  itens JSONB NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- DADOS INICIAIS
-- ============================================

-- Escolaridades
INSERT INTO rh_escolaridades (nome, ordem) VALUES
  ('ANALFABETO', 1),
  ('ENSINO FUNDAMENTAL INCOMPLETO', 2),
  ('ENSINO FUNDAMENTAL COMPLETO', 3),
  ('ENSINO MÉDIO INCOMPLETO', 4),
  ('ENSINO MÉDIO COMPLETO', 5),
  ('SUPERIOR INCOMPLETO', 6),
  ('SUPERIOR COMPLETO', 7),
  ('PÓS-GRADUAÇÃO', 8),
  ('MESTRADO', 9),
  ('DOUTORADO', 10)
ON CONFLICT DO NOTHING;

-- Regimes de Trabalho
INSERT INTO rh_regimes_trabalho (nome, descricao) VALUES
  ('CLT', 'Consolidação das Leis do Trabalho'),
  ('APRENDIZ', 'Menor Aprendiz'),
  ('ESTAGIÁRIO', 'Estágio'),
  ('DIARISTA', 'Trabalho por diária'),
  ('CONTRATO PJ', 'Pessoa Jurídica')
ON CONFLICT DO NOTHING;

-- Formas de Pagamento
INSERT INTO rh_formas_pagamento (nome) VALUES
  ('DEPÓSITO BANCÁRIO'),
  ('PIX'),
  ('DINHEIRO'),
  ('CHEQUE')
ON CONFLICT DO NOTHING;

-- Prazos de Experiencia
INSERT INTO rh_prazos_experiencia (nome, dias) VALUES
  ('30 dias', 30),
  ('45 dias', 45),
  ('60 dias', 60),
  ('90 dias', 90)
ON CONFLICT DO NOTHING;

-- Tipos de Ausencia
INSERT INTO rh_tipos_ausencia (nome, cor) VALUES
  ('Planejada', '#3B82F6'),
  ('Não Planejada', '#EF4444')
ON CONFLICT DO NOTHING;

-- Status de Treinamento
INSERT INTO rh_status_treinamento (nome, cor) VALUES
  ('CONCLUÍDO', '#22C55E'),
  ('EM ANDAMENTO', '#3B82F6'),
  ('CANCELADO', '#EF4444'),
  ('PENDENTE', '#F59E0B')
ON CONFLICT DO NOTHING;

-- ============================================
-- TEMPLATES ACOUGUE - DADOS INICIAIS
-- ============================================

-- Template 1: BOI CASADO CAPOTE (Inteiro)
INSERT INTO acougue_rendimento_templates (nome, descricao) VALUES
  ('BOI CASADO CAPOTE (INTEIRO)', 'Boi inteiro com todos os cortes dianteiro + traseiro')
ON CONFLICT DO NOTHING;

DO $$
DECLARE tid INT;
BEGIN
  SELECT id INTO tid FROM acougue_rendimento_templates WHERE nome = 'BOI CASADO CAPOTE (INTEIRO)' LIMIT 1;
  IF tid IS NOT NULL AND NOT EXISTS (SELECT 1 FROM acougue_rendimento_itens WHERE template_id = tid) THEN
    INSERT INTO acougue_rendimento_itens (template_id, nome_corte, codigo_produto, percentual, preco_venda, vende, ordem) VALUES
      (tid, 'ALCATRA COM MAMINHA', '00003759', 3.9240, 56.99, true, 1),
      (tid, 'CONTRA FILE', '00003674', 7.4390, 58.99, true, 2),
      (tid, 'COXAO DURO', '00003698', 4.4520, 44.99, true, 3),
      (tid, 'COXAO MOLE', '00003704', 6.3840, 46.99, true, 4),
      (tid, 'FILE MIGNON', '00003711', 1.4640, 65.99, true, 5),
      (tid, 'LAGARTO', '00003728', 2.4010, 40.99, true, 6),
      (tid, 'PATINHO', '00003735', 3.6310, 46.99, true, 7),
      (tid, 'PICANHA', '00003742', 0.9370, 65.99, true, 8),
      (tid, 'ACEM', '00003773', 17.4690, 35.99, true, 9),
      (tid, 'CARNE MOIDA BDJ', '00003780', 2.5160, 32.99, true, 10),
      (tid, 'COSTELA RIPA BOVINA', '00003803', 14.4550, 29.99, true, 11),
      (tid, 'FRALDINHA', '00003810', 2.0830, 45.99, true, 12),
      (tid, 'MUSCULO', '00003827', 4.2730, 33.99, true, 13),
      (tid, 'PALETA', '00003841', 8.1280, 36.99, true, 14),
      (tid, 'OSSO/SEBO BOVINO', '00006910', 20.4440, 0, false, 15);
  END IF;
END $$;

-- Template 2: TRASEIRO (BOI CASADO CAPOTE)
INSERT INTO acougue_rendimento_templates (nome, descricao) VALUES
  ('TRASEIRO (BOI CASADO CAPOTE)', 'Traseiro do boi casado capote')
ON CONFLICT DO NOTHING;

DO $$
DECLARE tid INT;
BEGIN
  SELECT id INTO tid FROM acougue_rendimento_templates WHERE nome = 'TRASEIRO (BOI CASADO CAPOTE)' LIMIT 1;
  IF tid IS NOT NULL AND NOT EXISTS (SELECT 1 FROM acougue_rendimento_itens WHERE template_id = tid) THEN
    INSERT INTO acougue_rendimento_itens (template_id, nome_corte, codigo_produto, percentual, preco_venda, vende, ordem) VALUES
      (tid, 'ALCATRA COM MAMINHA', '00003759', 5.5500, 56.99, true, 1),
      (tid, 'CONTRA FILE', '00003674', 11.4000, 58.99, true, 2),
      (tid, 'COXAO DURO', '00003698', 5.7000, 44.99, true, 3),
      (tid, 'COXAO MOLE', '00003704', 9.6700, 46.99, true, 4),
      (tid, 'FILE MIGNON', '00003711', 2.2900, 65.99, true, 5),
      (tid, 'LAGARTO', '00003728', 3.0500, 40.99, true, 6),
      (tid, 'PATINHO', '00003735', 5.9000, 46.99, true, 7),
      (tid, 'PICANHA', '00003742', 1.2400, 65.99, true, 8),
      (tid, 'ACEM', '00003773', 1.3900, 35.99, true, 9),
      (tid, 'CARNE MOIDA BDJ', '00003780', 3.2600, 32.99, true, 10),
      (tid, 'COSTELA RIPA BOVINA', '00003803', 18.8400, 29.99, true, 11),
      (tid, 'FRALDINHA', '00003810', 4.0600, 45.99, true, 12),
      (tid, 'MUSCULO', '00003827', 4.8000, 33.99, true, 13),
      (tid, 'OSSO/SEBO BOVINO', '00006910', 22.8500, 0, false, 14);
  END IF;
END $$;

-- Template 3: DIANTEIRO (BOI CASADO CAPOTE)
INSERT INTO acougue_rendimento_templates (nome, descricao) VALUES
  ('DIANTEIRO (BOI CASADO CAPOTE)', 'Dianteiro do boi casado capote')
ON CONFLICT DO NOTHING;

DO $$
DECLARE tid INT;
BEGIN
  SELECT id INTO tid FROM acougue_rendimento_templates WHERE nome = 'DIANTEIRO (BOI CASADO CAPOTE)' LIMIT 1;
  IF tid IS NOT NULL AND NOT EXISTS (SELECT 1 FROM acougue_rendimento_itens WHERE template_id = tid) THEN
    INSERT INTO acougue_rendimento_itens (template_id, nome_corte, codigo_produto, percentual, preco_venda, vende, ordem) VALUES
      (tid, 'ACEM', '00003773', 32.4200, 35.99, true, 1),
      (tid, 'CARNE MOIDA BDJ', '00003780', 3.2000, 32.99, true, 2),
      (tid, 'COSTELA CHULETA GAUCHA', '00003797', 8.6900, 29.99, true, 3),
      (tid, 'MUSCULO', '00003827', 7.1800, 33.99, true, 4),
      (tid, 'PALETA', '00003841', 19.2000, 36.99, true, 5),
      (tid, 'OSSO/SEBO BOVINO', '00006910', 29.3100, 0, false, 6);
  END IF;
END $$;
