@echo off
echo ========================================
echo  VERIFICAR INSTALACAO DO DOCKER
echo ========================================
echo.

echo [1/4] Verificando se Docker esta instalado...
docker --version >nul 2>&1
if errorlevel 1 (
    echo [X] Docker NAO encontrado!
    echo.
    echo O Docker nao esta instalado ou nao esta no PATH.
    echo.
    echo Por favor:
    echo 1. Instale o Docker Desktop
    echo 2. Reinicie o computador
    echo 3. Execute este script novamente
    echo.
    echo Link para download:
    echo https://www.docker.com/products/docker-desktop
    echo.
    pause
    exit /b 1
) else (
    docker --version
    echo [OK] Docker encontrado!
)
echo.

echo [2/4] Verificando Docker Compose...
docker-compose --version >nul 2>&1
if errorlevel 1 (
    echo [X] Docker Compose NAO encontrado!
    echo.
    pause
    exit /b 1
) else (
    docker-compose --version
    echo [OK] Docker Compose encontrado!
)
echo.

echo [3/4] Verificando se Docker esta rodando...
docker ps >nul 2>&1
if errorlevel 1 (
    echo [X] Docker NAO esta rodando!
    echo.
    echo Por favor:
    echo 1. Abra o Docker Desktop
    echo 2. Aguarde aparecer "Docker Desktop is running"
    echo 3. Execute este script novamente
    echo.
    pause
    exit /b 1
) else (
    echo [OK] Docker esta rodando!
)
echo.

echo [4/4] Testando Docker com container de teste...
docker run --rm hello-world >nul 2>&1
if errorlevel 1 (
    echo [X] Erro ao rodar container de teste
    echo.
    pause
    exit /b 1
) else (
    echo [OK] Docker funcionando perfeitamente!
)
echo.

echo ========================================
echo  DOCKER INSTALADO E FUNCIONANDO!
echo ========================================
echo.
echo Versoes instaladas:
docker --version
docker-compose --version
echo.
echo Proximo passo:
echo Execute: INSTALAR-DOCKER.bat
echo.
pause
