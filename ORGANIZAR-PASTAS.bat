@echo off
echo ========================================
echo  ORGANIZANDO ARQUIVOS EM PASTAS
echo ========================================
echo.

cd /d "%~dp0"

REM Criar estrutura de pastas
echo [1/5] Criando estrutura de pastas...
if not exist "scripts\docker" mkdir "scripts\docker"
if not exist "scripts\inicializacao" mkdir "scripts\inicializacao"
if not exist "scripts\manutencao" mkdir "scripts\manutencao"
if not exist "scripts\testes" mkdir "scripts\testes"
if not exist "scripts\obsoletos" mkdir "scripts\obsoletos"
if not exist "docs" mkdir "docs"

echo [2/5] Organizando scripts de DOCKER...
if exist "iniciar-docker.bat" move "iniciar-docker.bat" "scripts\docker\" >nul 2>&1
if exist "parar-docker.bat" move "parar-docker.bat" "scripts\docker\" >nul 2>&1
if exist "logs-docker.bat" move "logs-docker.bat" "scripts\docker\" >nul 2>&1
if exist "status-docker.bat" move "status-docker.bat" "scripts\docker\" >nul 2>&1
if exist "backup-docker.bat" move "backup-docker.bat" "scripts\docker\" >nul 2>&1
if exist "limpar-docker.bat" move "limpar-docker.bat" "scripts\docker\" >nul 2>&1
if exist "VERIFICAR-DOCKER.bat" move "VERIFICAR-DOCKER.bat" "scripts\docker\" >nul 2>&1
if exist "INSTALAR-DOCKER.bat" move "INSTALAR-DOCKER.bat" "scripts\docker\" >nul 2>&1
if exist "INSTALAR-DOCKER-COMPLETO.bat" move "INSTALAR-DOCKER-COMPLETO.bat" "scripts\docker\" >nul 2>&1
if exist "INICIAR-DOCKER-COMPOSE.bat" move "INICIAR-DOCKER-COMPOSE.bat" "scripts\docker\" >nul 2>&1
if exist "docker-compose.yml" move "docker-compose.yml" "scripts\docker\" >nul 2>&1
if exist "docker-compose.portainer.yml" move "docker-compose.portainer.yml" "scripts\docker\" >nul 2>&1

echo [3/5] Organizando scripts OBSOLETOS de inicialização...
if exist "start.bat" move "start.bat" "scripts\obsoletos\" >nul 2>&1
if exist "stop.bat" move "stop.bat" "scripts\obsoletos\" >nul 2>&1
if exist "restart.bat" move "restart.bat" "scripts\obsoletos\" >nul 2>&1
if exist "logs.bat" move "logs.bat" "scripts\obsoletos\" >nul 2>&1
if exist "iniciar.bat" move "iniciar.bat" "scripts\obsoletos\" >nul 2>&1
if exist "parar.bat" move "parar.bat" "scripts\obsoletos\" >nul 2>&1
if exist "INSTALAR.bat" move "INSTALAR.bat" "scripts\obsoletos\" >nul 2>&1
if exist "INICIAR-SISTEMA.bat" move "INICIAR-SISTEMA.bat" "scripts\obsoletos\" >nul 2>&1
if exist "INICIAR-SISTEMA.ps1" move "INICIAR-SISTEMA.ps1" "scripts\obsoletos\" >nul 2>&1
if exist "INICIAR-SISTEMA-LIMPO.bat" move "INICIAR-SISTEMA-LIMPO.bat" "scripts\obsoletos\" >nul 2>&1
if exist "start-backend.bat" move "start-backend.bat" "scripts\obsoletos\" >nul 2>&1
if exist "start-frontend.bat" move "start-frontend.bat" "scripts\obsoletos\" >nul 2>&1
if exist "start-ngrok.bat" move "start-ngrok.bat" "scripts\obsoletos\" >nul 2>&1
if exist "start-minio.bat" move "start-minio.bat" "scripts\obsoletos\" >nul 2>&1
if exist "iniciar-minio.bat" move "iniciar-minio.bat" "scripts\obsoletos\" >nul 2>&1

echo [4/5] Organizando scripts de MANUTENÇÃO...
if exist "backup-database.bat" move "backup-database.bat" "scripts\manutencao\" >nul 2>&1
if exist "configurar-firewall.bat" move "configurar-firewall.bat" "scripts\manutencao\" >nul 2>&1
if exist "proteger-sistema.bat" move "proteger-sistema.bat" "scripts\manutencao\" >nul 2>&1
if exist "desproteger-sistema.bat" move "desproteger-sistema.bat" "scripts\manutencao\" >nul 2>&1
if exist "limpar-duplicados.bat" move "limpar-duplicados.bat" "scripts\manutencao\" >nul 2>&1
if exist "INSTALAR-SERVICO-AUTOMATICO.bat" move "INSTALAR-SERVICO-AUTOMATICO.bat" "scripts\manutencao\" >nul 2>&1
if exist "DESINSTALAR-SERVICO-AUTOMATICO.bat" move "DESINSTALAR-SERVICO-AUTOMATICO.bat" "scripts\manutencao\" >nul 2>&1
if exist "limpar-banco.sql" move "limpar-banco.sql" "scripts\manutencao\" >nul 2>&1

echo [5/5] Organizando scripts de TESTES...
if exist "check-users.js" move "check-users.js" "scripts\testes\" >nul 2>&1
if exist "create-admin.js" move "create-admin.js" "scripts\testes\" >nul 2>&1
if exist "create-beto-master.js" move "create-beto-master.js" "scripts\testes\" >nul 2>&1
if exist "reset-beto-password.js" move "reset-beto-password.js" "scripts\testes\" >nul 2>&1
if exist "reset-password.js" move "reset-password.js" "scripts\testes\" >nul 2>&1
if exist "test-login.js" move "test-login.js" "scripts\testes\" >nul 2>&1
if exist "criar-db.sql" move "criar-db.sql" "scripts\testes\" >nul 2>&1

echo.
echo Organizando arquivos de DOCUMENTAÇÃO...
if exist "*.md" (
    for %%f in (*.md) do (
        if not "%%f"=="README.md" move "%%f" "docs\" >nul 2>&1
    )
)
if exist "*.txt" move "*.txt" "docs\" >nul 2>&1

echo.
echo ========================================
echo  ORGANIZAÇÃO CONCLUÍDA!
echo ========================================
echo.
echo ESTRUTURA DE PASTAS CRIADA:
echo.
echo  📁 scripts\
echo     ├─ docker\              (Scripts relacionados ao Docker)
echo     ├─ inicializacao\       (Scripts de inicialização - VAZIO, usar INICIAR-TUDO.bat)
echo     ├─ manutencao\          (Scripts de manutenção e backup)
echo     ├─ testes\              (Scripts de teste e desenvolvimento)
echo     └─ obsoletos\           (Scripts antigos substituídos)
echo.
echo  📁 docs\                   (Documentação e arquivos .txt/.md)
echo.
echo ARQUIVOS NA RAIZ (ESSENCIAIS):
echo  ✅ INICIAR-TUDO.bat       (Principal - Inicia todo o sistema)
echo  ✅ minio-config.bat        (Configuração MinIO)
echo  ✅ criar-tarefa-windows.ps1 (Tarefa agendada)
echo  ✅ package.json, .env, etc (Configurações)
echo.
pause
