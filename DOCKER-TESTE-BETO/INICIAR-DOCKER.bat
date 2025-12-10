@echo off
cd /d "%~dp0"

echo ========================================
echo  INICIAR SISTEMA
echo ========================================
echo.

echo Iniciando containers...
docker compose start

if errorlevel 1 (
    echo.
    echo ERRO ao iniciar containers
    echo.
    echo Tentando iniciar do zero...
    docker compose up -d

    if errorlevel 1 (
        echo.
        echo ERRO: Nao foi possivel iniciar o sistema
        echo Execute INSTALAR-DOCKER.bat primeiro
        pause
        exit /b 1
    )
)

echo.
echo Aguardando containers iniciarem...
timeout /t 5 /nobreak >nul

echo.
echo ========================================
echo  SISTEMA INICIADO!
echo ========================================
echo.

REM Ler IP do arquivo .env
for /f "tokens=2 delims==" %%a in ('findstr HOST_IP .env 2^>nul') do set HOST_IP=%%a

if "%HOST_IP%"=="" set HOST_IP=localhost

echo  Acesse: http://%HOST_IP%:8080
echo.
pause
