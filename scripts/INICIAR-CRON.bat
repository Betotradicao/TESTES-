@echo off
chcp 65001 >nul
echo ========================================
echo  INICIAR SERVIÇO DE CRON
echo  Verificação Automática de Vendas
echo ========================================
echo.

cd /d "%~dp0\.."

echo 📋 O que este serviço faz:
echo.
echo ✅ Verifica vendas da Zanthus a cada 2 minutos
echo ✅ Cruza bipagens com vendas automaticamente
echo ✅ Muda status de "Pendente" para "Verificado"
echo ✅ Envia alertas se não receber bipagens
echo.
echo ========================================
echo.

REM Verificar se já está rodando
docker ps | findstr /i "market-security-cron" >nul 2>&1
if %errorlevel%==0 (
    echo ⚠️  O serviço de CRON já está rodando!
    echo.
    docker ps | findstr "market-security-cron"
    echo.
    echo Deseja REINICIAR o serviço? [S/N]
    set /p RESTART="> "
    if /i "%RESTART%"=="S" (
        echo.
        echo 🔄 Reiniciando serviço...
        docker compose restart cron
        timeout /t 3 /nobreak >nul
    ) else (
        echo.
        echo ❌ Operação cancelada
        pause
        exit /b 0
    )
) else (
    echo 🚀 Iniciando serviço de CRON...
    echo.
    docker compose up -d cron
    timeout /t 5 /nobreak >nul
)

echo.
echo ========================================
echo  VERIFICANDO STATUS
echo ========================================
echo.

docker ps | findstr "market-security-cron"

if %errorlevel%==0 (
    echo.
    echo ========================================
    echo  ✅ CRON INICIADO COM SUCESSO!
    echo ========================================
    echo.
    echo 📊 O que está rodando agora:
    echo.
    echo ⏰ A cada 2 minutos: Verifica vendas e cruza com bipagens
    echo ⏰ Às 8h da manhã: Verificação completa do dia anterior
    echo ⏰ A cada 1 hora: Alerta se não houver bipagens
    echo.
    echo Para ver os logs em tempo real:
    echo docker compose logs -f cron
    echo.
) else (
    echo.
    echo ========================================
    echo  ❌ ERRO AO INICIAR CRON
    echo ========================================
    echo.
    echo Possíveis causas:
    echo.
    echo 1. Docker não está rodando
    echo 2. Imagem precisa ser compilada
    echo.
    echo Tentando compilar a imagem...
    docker compose build cron
    echo.
    echo Agora execute este script novamente
)

echo.
pause
