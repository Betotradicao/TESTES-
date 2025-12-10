@echo off
echo ========================================
echo  INSTALADOR DOCKER DESKTOP
echo  Prevencao no Radar
echo ========================================
echo.

REM Verificar se esta executando como administrador
net session >nul 2>&1
if %errorLevel% NEQ 0 (
    echo [ERRO] Este script precisa ser executado como Administrador!
    echo.
    echo Clique com botao direito no arquivo e selecione "Executar como administrador"
    echo.
    pause
    exit /b 1
)

echo [1/5] Verificando arquitetura do sistema...
wmic os get osarchitecture | findstr /i "64"
if %errorLevel% NEQ 0 (
    echo [ERRO] Este sistema nao e 64-bit. Docker Desktop requer Windows 64-bit.
    pause
    exit /b 1
)
echo [OK] Sistema 64-bit detectado!
echo.

echo [2/5] Verificando se Docker Desktop ja esta instalado...
where docker >nul 2>&1
if %errorLevel% EQU 0 (
    echo [OK] Docker ja esta instalado!
    echo.
    echo Verificando versao...
    docker --version
    echo.
    goto :configure
)

echo [INFO] Docker nao encontrado. Iniciando download...
echo.

echo [3/5] Baixando Docker Desktop...
echo.
echo IMPORTANTE: O download vai comecar agora (aproximadamente 500MB)
echo Isso pode levar alguns minutos dependendo da sua internet.
echo.

set DOCKER_URL=https://desktop.docker.com/win/main/amd64/Docker%%20Desktop%%20Installer.exe
set DOCKER_INSTALLER=%TEMP%\DockerDesktopInstaller.exe

powershell -Command "& {Write-Host 'Baixando Docker Desktop...'; Invoke-WebRequest -Uri '%DOCKER_URL%' -OutFile '%DOCKER_INSTALLER%' -UseBasicParsing}"

if not exist "%DOCKER_INSTALLER%" (
    echo [ERRO] Falha ao baixar Docker Desktop!
    echo.
    echo Por favor, baixe manualmente em:
    echo https://www.docker.com/products/docker-desktop/
    echo.
    pause
    exit /b 1
)

echo [OK] Download concluido!
echo.

echo [4/5] Instalando Docker Desktop...
echo.
echo ATENCAO: A instalacao pode levar varios minutos.
echo Uma janela de instalacao vai abrir. Siga as instrucoes.
echo.
pause

start /wait "" "%DOCKER_INSTALLER%" install --quiet --accept-license

echo.
echo [OK] Instalacao concluida!
echo.

:configure
echo [5/5] Configurando Docker para iniciar automaticamente...
echo.

echo Aguardando Docker Desktop iniciar pela primeira vez...
echo Isso pode levar 1-2 minutos...
timeout /t 30 /nobreak >nul

echo.
echo ========================================
echo  CONFIGURACAO IMPORTANTE
echo ========================================
echo.
echo AGORA VOCE PRECISA:
echo.
echo 1. Abrir o Docker Desktop (ja deve ter aberto automaticamente)
echo 2. Aceitar os termos de servico se solicitado
echo 3. Ir em Settings (engrenagem) -^> General
echo 4. MARCAR a opcao "Start Docker Desktop when you log in"
echo 5. Ir em Resources -^> Advanced
echo 6. Configurar:
echo    - CPU: Minimo 2 cores
echo    - Memory: Minimo 4GB
echo 7. Clicar em "Apply and Restart"
echo.
echo Apos isso, execute: INICIAR-DOCKER-COMPOSE.bat
echo.
pause
