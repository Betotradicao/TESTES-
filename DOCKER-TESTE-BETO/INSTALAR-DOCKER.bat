@echo off
cd /d "%~dp0"

echo ========================================
echo  INSTALACAO PREVENCAO NO RADAR
echo  Versao Docker para Producao
echo ========================================
echo.

REM ETAPA 1: Verificar se Docker esta instalado
echo [1/5] Verificando Docker...
docker --version >nul 2>&1
if errorlevel 1 (
    echo.
    echo ERRO: Docker nao esta instalado!
    echo.
    echo Por favor, instale o Docker Desktop:
    echo https://www.docker.com/products/docker-desktop/
    echo.
    echo Depois de instalar, execute este script novamente.
    echo.
    pause
    exit /b 1
)
echo Docker instalado OK

REM ETAPA 2: Verificar docker-compose
echo [2/5] Verificando Docker Compose...
docker compose version >nul 2>&1
if errorlevel 1 (
    echo.
    echo ERRO: Docker Compose nao disponivel!
    echo.
    pause
    exit /b 1
)
echo Docker Compose OK

REM ETAPA 3: Detectar IP
echo [3/5] Detectando IP da maquina...
for /f "tokens=2 delims=:" %%a in ('ipconfig ^| findstr /C:"IPv4" ^| findstr /V "127.0.0.1"') do (
    set DETECTED_IP=%%a
    goto :ip_found
)

:ip_found
set DETECTED_IP=%DETECTED_IP: =%

if "%DETECTED_IP%"=="" (
    set /p HOST_IP="Digite o IP (ex: 192.168.1.100): "
) else (
    echo IP detectado: %DETECTED_IP%
    set /p CONFIRM="Usar este IP? (S/n): "
    if /i "%CONFIRM%"=="n" (
        set /p HOST_IP="Digite o IP correto: "
    ) else (
        set HOST_IP=%DETECTED_IP%
    )
)

echo HOST_IP=%HOST_IP% > .env
echo IP configurado: %HOST_IP%

REM ETAPA 4: Build
echo.
echo [4/5] Construindo imagens Docker...
echo Isso pode levar alguns minutos...
docker compose build
if errorlevel 1 (
    echo ERRO ao construir imagens
    pause
    exit /b 1
)
echo Build concluido!

REM ETAPA 5: Iniciar
echo.
echo [5/5] Iniciando containers...
docker compose up -d
if errorlevel 1 (
    echo ERRO ao iniciar containers
    pause
    exit /b 1
)

echo.
echo Aguardando...
timeout /t 10 /nobreak >nul

echo.
echo ========================================
echo  INSTALACAO CONCLUIDA!
echo ========================================
echo.
echo  Acesse: http://%HOST_IP%:8080
echo.
pause
