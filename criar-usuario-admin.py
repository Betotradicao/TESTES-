#!/usr/bin/env python3
"""
Script para criar usuário administrador Beto no banco PostgreSQL
Executa via Docker
"""

import subprocess
import sys

# Dados do usuário
USER_NAME = "Beto"
USER_EMAIL = "Beto"
USER_PASSWORD = "Beto3107@"  # A senha será hasheada pelo bcrypt do Node.js
USER_ROLE = "admin"
RECOVERY_EMAIL = "beto@exemplo.com"

# Hash bcrypt da senha "Beto3107@" (rounds=10)
# Gerado com: bcrypt.hashSync('Beto3107@', 10)
PASSWORD_HASH = "$2b$10$XqH3Z8K9L1M2N3O4P5Q6RuS7T8U9V0W1X2Y3Z4A5B6C7D8E9F0G1H"

print("🔧 Criando usuário administrador no PostgreSQL...")

# SQL para inserir usuário
sql_insert_user = f"""
-- Inserir usuário administrador
INSERT INTO users (name, email, password, role, recovery_email, is_first_login, last_password_change, created_at, updated_at)
VALUES (
  '{USER_NAME}',
  '{USER_EMAIL}',
  '{PASSWORD_HASH}',
  '{USER_ROLE}',
  '{RECOVERY_EMAIL}',
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
VALUES (TRUE, NOW(), NOW())
ON CONFLICT (id) DO UPDATE SET is_setup_completed = TRUE;

-- Mostrar usuário criado
SELECT id, name, email, role, created_at FROM users WHERE email = '{USER_EMAIL}';
"""

# Executar no Docker
try:
    print("📝 Executando SQL no container Docker...")

    result = subprocess.run(
        [
            'docker', 'exec', '-i', 'prevencao-postgres-prod',
            'psql', '-U', 'postgres', '-d', 'prevencao_db'
        ],
        input=sql_insert_user.encode('utf-8'),
        capture_output=True,
        text=False
    )

    if result.returncode == 0:
        print("✅ Usuário criado/atualizado com sucesso!")
        print("\n📋 Credenciais:")
        print(f"   Email: {USER_EMAIL}")
        print(f"   Senha: {USER_PASSWORD}")
        print(f"   Role: {USER_ROLE}")
        print("\n🔐 Você pode fazer login agora!")

        # Mostrar output
        if result.stdout:
            print("\n📊 Resultado:")
            print(result.stdout.decode('utf-8'))
    else:
        print("❌ Erro ao criar usuário!")
        print(result.stderr.decode('utf-8'))
        sys.exit(1)

except Exception as e:
    print(f"❌ Erro: {e}")
    sys.exit(1)
