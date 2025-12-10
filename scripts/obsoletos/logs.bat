@echo off
echo ========================================
echo  Roberto Prevencao no Radar - LOGS
echo ========================================
echo.
echo Mostrando logs em tempo real...
echo Pressione Ctrl+C para sair
echo.

cd /d "%~dp0"

docker-compose logs -f
