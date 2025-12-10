@echo off
echo ========================================
echo  LIMPANDO ARQUIVOS DUPLICADOS/ANTIGOS
echo ========================================
echo.

cd /d "%~dp0"

REM Criar pasta de backup
if not exist "_BACKUP_ARQUIVOS_ANTIGOS" mkdir "_BACKUP_ARQUIVOS_ANTIGOS"

echo [1/4] Movendo scripts DUPLICADOS de Docker...
if exist "iniciar-docker.bat" move "iniciar-docker.bat" "_BACKUP_ARQUIVOS_ANTIGOS\" >nul 2>&1
if exist "parar-docker.bat" move "parar-docker.bat" "_BACKUP_ARQUIVOS_ANTIGOS\" >nul 2>&1
if exist "logs-docker.bat" move "logs-docker.bat" "_BACKUP_ARQUIVOS_ANTIGOS\" >nul 2>&1
if exist "status-docker.bat" move "status-docker.bat" "_BACKUP_ARQUIVOS_ANTIGOS\" >nul 2>&1
if exist "backup-docker.bat" move "backup-docker.bat" "_BACKUP_ARQUIVOS_ANTIGOS\" >nul 2>&1
if exist "limpar-docker.bat" move "limpar-docker.bat" "_BACKUP_ARQUIVOS_ANTIGOS\" >nul 2>&1
if exist "VERIFICAR-DOCKER.bat" move "VERIFICAR-DOCKER.bat" "_BACKUP_ARQUIVOS_ANTIGOS\" >nul 2>&1
if exist "INSTALAR-DOCKER.bat" move "INSTALAR-DOCKER.bat" "_BACKUP_ARQUIVOS_ANTIGOS\" >nul 2>&1
if exist "INSTALAR-DOCKER-COMPLETO.bat" move "INSTALAR-DOCKER-COMPLETO.bat" "_BACKUP_ARQUIVOS_ANTIGOS\" >nul 2>&1
if exist "INICIAR-DOCKER-COMPOSE.bat" move "INICIAR-DOCKER-COMPOSE.bat" "_BACKUP_ARQUIVOS_ANTIGOS\" >nul 2>&1

echo [2/4] Movendo scripts DUPLICADOS de inicialização...
if exist "start.bat" move "start.bat" "_BACKUP_ARQUIVOS_ANTIGOS\" >nul 2>&1
if exist "stop.bat" move "stop.bat" "_BACKUP_ARQUIVOS_ANTIGOS\" >nul 2>&1
if exist "restart.bat" move "restart.bat" "_BACKUP_ARQUIVOS_ANTIGOS\" >nul 2>&1
if exist "logs.bat" move "logs.bat" "_BACKUP_ARQUIVOS_ANTIGOS\" >nul 2>&1
if exist "iniciar.bat" move "iniciar.bat" "_BACKUP_ARQUIVOS_ANTIGOS\" >nul 2>&1
if exist "parar.bat" move "parar.bat" "_BACKUP_ARQUIVOS_ANTIGOS\" >nul 2>&1
if exist "INSTALAR.bat" move "INSTALAR.bat" "_BACKUP_ARQUIVOS_ANTIGOS\" >nul 2>&1
if exist "INICIAR-SISTEMA.bat" move "INICIAR-SISTEMA.bat" "_BACKUP_ARQUIVOS_ANTIGOS\" >nul 2>&1
if exist "INICIAR-SISTEMA.ps1" move "INICIAR-SISTEMA.ps1" "_BACKUP_ARQUIVOS_ANTIGOS\" >nul 2>&1
if exist "INICIAR-SISTEMA-LIMPO.bat" move "INICIAR-SISTEMA-LIMPO.bat" "_BACKUP_ARQUIVOS_ANTIGOS\" >nul 2>&1
if exist "start-backend.bat" move "start-backend.bat" "_BACKUP_ARQUIVOS_ANTIGOS\" >nul 2>&1
if exist "start-frontend.bat" move "start-frontend.bat" "_BACKUP_ARQUIVOS_ANTIGOS\" >nul 2>&1

echo [3/4] Movendo scripts ANTIGOS diversos...
if exist "backup-database.bat" move "backup-database.bat" "_BACKUP_ARQUIVOS_ANTIGOS\" >nul 2>&1
if exist "configurar-firewall.bat" move "configurar-firewall.bat" "_BACKUP_ARQUIVOS_ANTIGOS\" >nul 2>&1
if exist "proteger-sistema.bat" move "proteger-sistema.bat" "_BACKUP_ARQUIVOS_ANTIGOS\" >nul 2>&1
if exist "desproteger-sistema.bat" move "desproteger-sistema.bat" "_BACKUP_ARQUIVOS_ANTIGOS\" >nul 2>&1
if exist "limpar-duplicados.bat" move "limpar-duplicados.bat" "_BACKUP_ARQUIVOS_ANTIGOS\" >nul 2>&1
if exist "INSTALAR-SERVICO-AUTOMATICO.bat" move "INSTALAR-SERVICO-AUTOMATICO.bat" "_BACKUP_ARQUIVOS_ANTIGOS\" >nul 2>&1
if exist "DESINSTALAR-SERVICO-AUTOMATICO.bat" move "DESINSTALAR-SERVICO-AUTOMATICO.bat" "_BACKUP_ARQUIVOS_ANTIGOS\" >nul 2>&1
if exist "iniciar-minio.bat" move "iniciar-minio.bat" "_BACKUP_ARQUIVOS_ANTIGOS\" >nul 2>&1
if exist "start-ngrok.bat" move "start-ngrok.bat" "_BACKUP_ARQUIVOS_ANTIGOS\" >nul 2>&1
if exist "start-minio.bat" move "start-minio.bat" "_BACKUP_ARQUIVOS_ANTIGOS\" >nul 2>&1

echo [4/4] Movendo scripts de teste/desenvolvimento...
if exist "check-users.js" move "check-users.js" "_BACKUP_ARQUIVOS_ANTIGOS\" >nul 2>&1
if exist "create-admin.js" move "create-admin.js" "_BACKUP_ARQUIVOS_ANTIGOS\" >nul 2>&1
if exist "create-beto-master.js" move "create-beto-master.js" "_BACKUP_ARQUIVOS_ANTIGOS\" >nul 2>&1
if exist "reset-beto-password.js" move "reset-beto-password.js" "_BACKUP_ARQUIVOS_ANTIGOS\" >nul 2>&1
if exist "reset-password.js" move "reset-password.js" "_BACKUP_ARQUIVOS_ANTIGOS\" >nul 2>&1
if exist "test-login.js" move "test-login.js" "_BACKUP_ARQUIVOS_ANTIGOS\" >nul 2>&1

echo.
echo ========================================
echo  LIMPEZA CONCLUÍDA!
echo ========================================
echo.
echo Arquivos movidos para: _BACKUP_ARQUIVOS_ANTIGOS
echo.
echo ARQUIVOS QUE PERMANECERAM (ESSENCIAIS):
echo  - INICIAR-TUDO.bat          (Inicia o sistema completo)
echo  - minio-config.bat           (Configuração do MinIO)
echo  - criar-tarefa-windows.ps1   (Tarefa agendada)
echo  - .env, package.json, etc    (Arquivos de configuração)
echo.
echo Se precisar de algum arquivo, ele está em _BACKUP_ARQUIVOS_ANTIGOS
echo Para excluir permanentemente: del /q _BACKUP_ARQUIVOS_ANTIGOS\*
echo.
pause
