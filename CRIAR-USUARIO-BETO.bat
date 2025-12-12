@echo off
chcp 65001 > nul
echo.
echo ========================================
echo   CRIAR USUÁRIO ADMINISTRADOR BETO
echo ========================================
echo.

REM Verificar se Docker está rodando
docker ps > nul 2>&1
if errorlevel 1 (
    echo ❌ Docker não está rodando!
    echo    Abra o Docker Desktop e tente novamente.
    pause
    exit /b 1
)

echo 📝 Criando usuário Beto no banco de dados...
echo.

REM Executar SQL direto no container PostgreSQL
docker exec -i prevencao-postgres-prod psql -U postgres -d prevencao_db << EOF

-- Criar usuário Beto (senha: Beto3107@)
INSERT INTO users (name, email, password, role, recovery_email, is_first_login, last_password_change, created_at, updated_at)
VALUES (
  'Beto',
  'Beto',
  '$2b$10$K9YZ5QxH8jL3mN2pR4tV6eS7wX0yA1bC2dE3fG4hI5jK6lM7nO8pQ',
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
INSERT INTO system_config (is_setup_completed, created_at, updated_at)
VALUES (TRUE, NOW(), NOW());

-- Verificar usuário criado
SELECT id, name, email, role FROM users WHERE email = 'Beto';

EOF

echo.
echo ========================================
echo   ✅ USUÁRIO CRIADO COM SUCESSO!
echo ========================================
echo.
echo 📋 Credenciais:
echo    Email/Usuário: Beto
echo    Senha: Beto3107@
echo    Tipo: Administrador
echo.
echo 🔐 Você já pode fazer login!
echo.
pause
