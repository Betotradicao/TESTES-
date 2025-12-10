@echo off
echo ========================================
echo  INSTALADOR DOCKER - Market Security
echo ========================================
echo.
echo Este script vai instalar e configurar
echo todo o sistema usando Docker.
echo.
pause

REM Verificar se Docker está instalado
echo [1/5] Verificando Docker...
docker --version >nul 2>&1
if errorlevel 1 (
    echo.
    echo [ERRO] Docker nao encontrado!
    echo.
    echo Por favor, instale o Docker Desktop primeiro:
    echo https://www.docker.com/products/docker-desktop
    echo.
    pause
    exit /b 1
)
echo Docker encontrado!
echo.

REM Verificar se Docker está rodando
echo [2/5] Verificando se Docker esta rodando...
docker ps >nul 2>&1
if errorlevel 1 (
    echo.
    echo [ERRO] Docker nao esta rodando!
    echo.
    echo Por favor, inicie o Docker Desktop e tente novamente.
    echo.
    pause
    exit /b 1
)
echo Docker esta rodando!
echo.

REM Parar containers antigos se existirem
echo [3/5] Parando containers antigos (se existirem)...
docker-compose down >nul 2>&1
echo Containers antigos parados.
echo.

REM Build das imagens
echo [4/5] Construindo imagens Docker...
echo Isso pode demorar alguns minutos na primeira vez...
docker-compose build
if errorlevel 1 (
    echo.
    echo [ERRO] Falha ao construir imagens!
    echo.
    pause
    exit /b 1
)
echo Imagens construidas com sucesso!
echo.

REM Iniciar containers
echo [5/5] Iniciando containers...
docker-compose up -d
if errorlevel 1 (
    echo.
    echo [ERRO] Falha ao iniciar containers!
    echo.
    pause
    exit /b 1
)
echo.

REM Aguardar serviços iniciarem
echo Aguardando servicos iniciarem...
timeout /t 10 /nobreak >nul

REM Verificar status
echo.
echo ========================================
echo  STATUS DOS SERVICOS
echo ========================================
docker-compose ps
echo.

echo ========================================
echo  INSTALACAO CONCLUIDA!
echo ========================================
echo.
echo  Frontend: http://localhost:3004
echo  Backend:  http://localhost:3001
echo  MinIO:    http://localhost:9001
echo.
echo Login Master:
echo  Email: beto@master.com
echo  Senha: Beto2025
echo.
echo Para ver os logs: logs-docker.bat
echo Para parar: parar-docker.bat
echo.
pause
