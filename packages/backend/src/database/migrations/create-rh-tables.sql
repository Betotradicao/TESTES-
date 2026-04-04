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
