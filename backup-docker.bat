@echo off
echo ========================================
echo  BACKUP DOCKER - Market Security
echo ========================================
echo.

REM Criar diretório de backup com data
set BACKUP_DIR=backup_%date:~-4,4%%date:~-7,2%%date:~-10,2%_%time:~0,2%%time:~3,2%%time:~6,2%
set BACKUP_DIR=%BACKUP_DIR: =0%

echo Criando backup em: %BACKUP_DIR%
mkdir "%BACKUP_DIR%"

REM Exportar volumes do banco de dados
echo [1/3] Fazendo backup do banco de dados...
docker-compose exec -T postgres pg_dump -U postgres market_security > "%BACKUP_DIR%\database.sql"

REM Copiar dados do MinIO
echo [2/3] Fazendo backup dos arquivos MinIO...
docker run --rm -v roberto-prevencao-no-radar-main_minio_data:/data -v "%cd%\%BACKUP_DIR%":/backup alpine tar czf /backup/minio-data.tar.gz -C /data .

REM Copiar arquivos de configuração
echo [3/3] Copiando arquivos de configuracao...
copy docker-compose.yml "%BACKUP_DIR%\" >nul
copy .env "%BACKUP_DIR%\" 2>nul

echo.
echo ========================================
echo  Backup concluido!
echo ========================================
echo.
echo Backup salvo em: %BACKUP_DIR%
echo.
pause
