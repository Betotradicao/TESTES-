@echo off
echo ========================================
echo   DEPLOY BACKEND - Correcao Race Condition
echo ========================================
echo.
echo Este script vai:
echo 1. Conectar na VPS (145.223.92.152)
echo 2. Baixar o codigo novo do GitHub
echo 3. Rebuild do backend
echo 4. Reiniciar backend e cron
echo.
echo Pressione qualquer tecla para continuar...
pause > nul

echo.
echo [1/4] Conectando na VPS e baixando codigo...
ssh root@145.223.92.152 "cd /root/TESTES && git pull"

if %ERRORLEVEL% NEQ 0 (
    echo ERRO ao baixar codigo!
    pause
    exit /b 1
)

echo.
echo [2/4] Fazendo rebuild do backend (pode demorar 1-2 minutos)...
ssh root@145.223.92.152 "cd /root/TESTES/InstaladorVPS && docker compose -f docker-compose-producao.yml build --no-cache backend"

if %ERRORLEVEL% NEQ 0 (
    echo ERRO ao fazer build!
    pause
    exit /b 1
)

echo.
echo [3/4] Reiniciando backend e cron...
ssh root@145.223.92.152 "cd /root/TESTES/InstaladorVPS && docker compose -f docker-compose-producao.yml up -d --no-deps backend cron"

if %ERRORLEVEL% NEQ 0 (
    echo ERRO ao reiniciar containers!
    pause
    exit /b 1
)

echo.
echo [4/4] Verificando logs do backend...
ssh root@145.223.92.152 "docker logs prevencao-backend-prod --tail 30"

echo.
echo ========================================
echo   DEPLOY CONCLUIDO COM SUCESSO!
echo ========================================
echo.
echo Agora voce pode testar:
echo 1. Acesse: http://145.223.92.152:3000
echo 2. Va em: Prevencao de Bipagens ^> Ativar Produtos
echo 3. Selecione 205 produtos
echo 4. Clique em "Ativar Selecionados"
echo 5. Recarregue a pagina
echo 6. Os 205 produtos devem permanecer ativos!
echo.
pause
