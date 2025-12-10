@echo off
echo ========================================
echo  Roberto Prevencao no Radar - STOP
echo ========================================
echo.
echo Parando todos os servicos...
echo.

cd /d "%~dp0"

docker-compose down

echo.
echo ========================================
echo  Sistema parado com sucesso!
echo ========================================
echo.
pause
