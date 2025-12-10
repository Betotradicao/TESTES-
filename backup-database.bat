@echo off
chcp 65001 >nul
setlocal EnableDelayedExpansion

echo ════════════════════════════════════════════════════════════════════════
echo  BACKUP DO BANCO DE DADOS
echo ════════════════════════════════════════════════════════════════════════
echo.

cd /d "%~dp0"

:: Criar pasta de backups se não existir
if not exist "backups" mkdir backups

:: Nome do arquivo de backup com data e hora
set BACKUP_FILE=backups\backup_%DATE:~-4%%DATE:~3,2%%DATE:~0,2%_%TIME:~0,2%%TIME:~3,2%%TIME:~6,2%.sql
set BACKUP_FILE=%BACKUP_FILE: =0%

echo [*] Criando backup do banco de dados...
echo.
echo     Arquivo: %BACKUP_FILE%
echo.

:: Fazer backup usando docker exec
docker exec roberto-prevencao-no-radar-postgres-1 pg_dump -U admin market_security > "%BACKUP_FILE%"

if %errorLevel% neq 0 (
    echo.
    echo [ERRO] Falha ao criar backup!
    pause
    exit /b 1
)

echo.
echo [OK] Backup criado com sucesso!
echo.
echo     Tamanho:
dir "%BACKUP_FILE%" | find "backup_"
echo.
pause
