-- ==================================================
-- CRIAR USUÁRIO ADMINISTRADOR BETO
-- ==================================================
-- Execute este SQL no pgAdmin, DBeaver ou qualquer cliente PostgreSQL
--
-- Conectar em:
--   Host: localhost
--   Porta: 5434
--   Database: prevencao_db
--   Usuário: postgres
--   Senha: (a senha que você definiu na instalação)
-- ==================================================

-- Inserir usuário Beto
-- Senha: Beto3107@ (já com hash bcrypt)
INSERT INTO users (
  name,
  email,
  password,
  role,
  recovery_email,
  is_first_login,
  last_password_change,
  created_at,
  updated_at
)
VALUES (
  'Beto',
  'Beto',
  '$2b$10$./x5wUpRU1TpDNdcjUD3VOrvWWT8pJ5b3/GaKN1y0Rae.5e7qr4ci',
  'admin',
  'beto@exemplo.com',
  FALSE,
  NOW(),
  NOW(),
  NOW()
)
ON CONFLICT (email) DO UPDATE SET
  password = EXCLUDED.password,
  role = EXCLUDED.role,
  updated_at = NOW();

-- Marcar setup como completo
INSERT INTO system_config (
  is_setup_completed,
  created_at,
  updated_at
)
VALUES (
  TRUE,
  NOW(),
  NOW()
)
ON CONFLICT (id) DO UPDATE SET
  is_setup_completed = TRUE;

-- Verificar se foi criado
SELECT id, name, email, role, created_at
FROM users
WHERE email = 'Beto';

-- ==================================================
-- PRONTO! Credenciais:
--   Usuário: Beto
--   Senha: Beto3107@
-- ==================================================
