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

REM ETAPA 3: Detectar IP e Gerar Senhas Seguras
echo [3/5] Detectando IP e gerando senhas seguras...

REM Detectar IP
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

echo Gerando senhas aleatorias seguras...

REM Gerar senha aleatoria para PostgreSQL (16 caracteres alfanumericos)
for /f %%i in ('powershell -Command "[guid]::NewGuid().ToString('N').Substring(0,16)"') do set POSTGRES_PASSWORD=%%i

REM Gerar access key para MinIO (32 caracteres hex)
for /f %%i in ('powershell -Command "[guid]::NewGuid().ToString('N')"') do set MINIO_USER=%%i

REM Gerar secret key para MinIO (64 caracteres hex)
for /f %%i in ('powershell -Command "[guid]::NewGuid().ToString('N') + [guid]::NewGuid().ToString('N')"') do set MINIO_PASSWORD=%%i

REM Criar arquivo .env com todas as configurações
echo HOST_IP=%HOST_IP% > .env
echo POSTGRES_PASSWORD=%POSTGRES_PASSWORD% >> .env
echo MINIO_ROOT_USER=%MINIO_USER% >> .env
echo MINIO_ROOT_PASSWORD=%MINIO_PASSWORD% >> .env

echo.
echo ========================================
echo  SENHAS GERADAS COM SUCESSO!
echo ========================================
echo.
echo IP configurado: %HOST_IP%
echo.
echo PostgreSQL:
echo   Usuario: postgres
echo   Senha: %POSTGRES_PASSWORD%
echo   Porta: 5434
echo.
echo MinIO:
echo   Access Key: %MINIO_USER%
echo   Secret Key: %MINIO_PASSWORD%
echo   Console: http://%HOST_IP%:9011
echo.
echo IMPORTANTE: Anote estas senhas em local seguro!
echo Elas estao salvas no arquivo .env
echo.
pause

REM ETAPA 4: Parar e limpar containers antigos (SEMPRE LIMPA TUDO)
echo.
echo [4/7] Removendo instalacao anterior (se existir)...
docker compose -f docker-compose-producao.yml down -v >nul 2>&1
echo Instalacao anterior removida!
echo.
echo ========================================
echo  INSTALACAO LIMPA
echo ========================================
echo.
echo Este instalador sempre cria uma instalacao limpa.
echo No primeiro acesso voce vai configurar:
echo.
echo  1. Dados da Empresa
echo  2. Usuario Master (administrador)
echo  3. Senhas de acesso
echo.
set BANCO_LIMPO=SIM
pause

REM ETAPA 5: Build
echo.
echo [5/7] Construindo imagens Docker...
echo Isso pode levar alguns minutos...
docker compose -f docker-compose-producao.yml build
if errorlevel 1 (
    echo ERRO ao construir imagens
    pause
    exit /b 1
)
echo Build concluido!

REM ETAPA 6: Iniciar
echo.
echo [6/7] Iniciando containers...
docker compose -f docker-compose-producao.yml up -d
if errorlevel 1 (
    echo ERRO ao iniciar containers
    pause
    exit /b 1
)

echo.
echo [7/7] Aguardando inicializacao...
timeout /t 15 /nobreak >nul

echo.
echo ========================================
echo  INSTALACAO CONCLUIDA!
echo ========================================
echo.
echo  Acesse: http://%HOST_IP%:8080
echo.

if /i "%BANCO_LIMPO%"=="SIM" (
    echo ========================================
    echo  PRIMEIRO ACESSO
    echo ========================================
    echo.
    echo Como o banco foi limpo, no primeiro acesso
    echo voce vai configurar:
    echo.
    echo  1. Dados da Empresa
    echo  2. Usuario Master (administrador)
    echo  3. Configuracoes iniciais
    echo.
    echo Acesse agora: http://%HOST_IP%:8080
    echo.
) else (
    echo.
    echo Dados existentes foram mantidos.
    echo Use suas credenciais anteriores para login.
    echo.
)

pause
