@echo off
chcp 65001 >nul
echo ========================================
echo  LOGS DO SERVIÇO DE CRON
echo  Verificação Automática de Vendas
echo ========================================
echo.

cd /d "%~dp0\.."

echo Verificando se o CRON está rodando...
docker ps | findstr /i "market-security-cron" >nul 2>&1

if %errorlevel% neq 0 (
    echo.
    echo ❌ CRON NÃO ESTÁ RODANDO!
    echo.
    echo Para iniciar o CRON, execute:
    echo scripts\INICIAR-CRON.bat
    echo.
    pause
    exit /b 1
)

echo.
echo ✅ CRON está rodando
echo.
echo 📋 Mostrando logs em tempo real...
echo    Pressione Ctrl+C para sair
echo.
echo ========================================
echo.

docker compose logs -f cron
