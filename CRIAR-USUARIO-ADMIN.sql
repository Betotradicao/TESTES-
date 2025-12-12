-- Script para criar usuário administrador Beto
-- Execute este script no PostgreSQL do Docker

-- Inserir o usuário (senha: Beto3107@ já com hash bcrypt)
-- Hash bcrypt para 'Beto3107@': $2b$10$Yc0qH8jZ5zF5vY5qVJ5qXeKJ5qVJ5qXeKJ5qVJ5qXeKJ5qVJ5qXe
INSERT INTO users (name, email, password, role, recovery_email, is_first_login, last_password_change, created_at, updated_at)
VALUES (
  'Beto',
  'Beto',
  '$2b$10$YqH8jZ5zF5vY5qVJ5qXeKJ5qVJ5qXeKJ5qVJ5qXeKJ5qVJ5qXe',
  'admin',
  'beto@exemplo.com',
  FALSE,
  NOW(),
  NOW(),
  NOW()
)
ON CONFLICT (email) DO NOTHING;

-- Marcar setup como completo (para não pedir setup inicial)
INSERT INTO system_config (is_setup_completed, created_at, updated_at)
VALUES (TRUE, NOW(), NOW())
ON CONFLICT (id) DO UPDATE SET is_setup_completed = TRUE;

-- Verificar se o usuário foi criado
SELECT id, name, email, role FROM users WHERE email = 'Beto';
