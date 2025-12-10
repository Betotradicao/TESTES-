@echo off
echo ========================================
echo  INICIAR COM DOCKER COMPOSE
echo  Prevencao no Radar
echo ========================================
echo.

echo [1/4] Verificando se Docker esta instalado...
where docker >nul 2>&1
if %errorLevel% NEQ 0 (
    echo [ERRO] Docker nao encontrado!
    echo.
    echo Execute primeiro: INSTALAR-DOCKER-COMPLETO.bat
    echo.
    pause
    exit /b 1
)
echo [OK] Docker encontrado!
echo.

echo [2/4] Verificando se Docker esta rodando...
docker ps >nul 2>&1
if %errorLevel% NEQ 0 (
    echo [AVISO] Docker nao esta rodando!
    echo.
    echo Iniciando Docker Desktop...
    start "" "C:\Program Files\Docker\Docker\Docker Desktop.exe"
    echo.
    echo Aguardando Docker iniciar (isso pode levar 30-60 segundos)...
    timeout /t 10 /nobreak >nul

    REM Tentar por ate 60 segundos
    set /a counter=0
    :waitloop
    docker ps >nul 2>&1
    if %errorLevel% EQU 0 goto dockerready
    set /a counter+=1
    if %counter% GEQ 12 (
        echo [ERRO] Docker nao iniciou a tempo!
        echo Por favor, abra Docker Desktop manualmente e tente novamente.
        pause
        exit /b 1
    )
    timeout /t 5 /nobreak >nul
    goto waitloop
)

:dockerready
echo [OK] Docker esta rodando!
echo.

echo [3/4] Parando containers antigos (se existirem)...
docker-compose down >nul 2>&1
echo [OK] Containers antigos parados!
echo.

echo [4/4] Iniciando aplicacao com Docker Compose...
echo.
docker-compose up -d

if %errorLevel% NEQ 0 (
    echo.
    echo [ERRO] Falha ao iniciar containers!
    echo.
    echo Verificando logs...
    docker-compose logs --tail=50
    pause
    exit /b 1
)

echo.
echo Aguardando servicos iniciarem...
timeout /t 10 /nobreak >nul

echo.
echo ========================================
echo  STATUS DOS SERVICOS
echo ========================================
docker-compose ps

echo.
echo ========================================
echo  APLICACAO INICIADA COM SUCESSO!
echo ========================================
echo.
echo URLs disponiveis:
echo  Frontend:  http://localhost:3002
echo  Backend:   http://localhost:3001
echo  MinIO:     http://localhost:9001 (usuario: minioadmin / senha: minioadmin123)
echo  Swagger:   http://localhost:8080
echo  Postgres:  localhost:5433 (usuario: admin / senha: admin123)
echo.
echo Comandos uteis:
echo  Ver logs:        docker-compose logs -f
echo  Parar:           docker-compose down
echo  Reiniciar:       docker-compose restart
echo  Ver status:      docker-compose ps
echo.
pause
