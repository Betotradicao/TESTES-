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
