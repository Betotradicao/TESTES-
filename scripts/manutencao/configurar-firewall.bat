@echo off
chcp 65001 >nul

:: ============================================================================
:: CONFIGURAR FIREWALL - Roberto Prevenção no Radar
:: ============================================================================
:: Este script configura o firewall do Windows para permitir acesso em rede
:: ============================================================================

echo.
echo ╔════════════════════════════════════════════════════════════════════════╗
echo ║                                                                        ║
echo ║         CONFIGURAR FIREWALL - Roberto Prevenção no Radar              ║
echo ║                                                                        ║
echo ╚════════════════════════════════════════════════════════════════════════╝
echo.

:: Verificar se está rodando como administrador
net session >nul 2>&1
if %errorLevel% neq 0 (
    echo [ERRO] Este script precisa ser executado como ADMINISTRADOR!
    echo.
    echo Clique com botão direito no arquivo e selecione "Executar como Administrador"
    echo.
    pause
    exit /b 1
)

echo [OK] Executando como Administrador
echo.

echo ════════════════════════════════════════════════════════════════════════
echo  Configurando Firewall do Windows
echo ════════════════════════════════════════════════════════════════════════
echo.

echo [*] Removendo regras antigas (se existirem)...
netsh advfirewall firewall delete rule name="Roberto - Frontend" >nul 2>&1
netsh advfirewall firewall delete rule name="Roberto - Backend" >nul 2>&1
netsh advfirewall firewall delete rule name="Roberto - MinIO Console" >nul 2>&1
netsh advfirewall firewall delete rule name="Roberto - MinIO API" >nul 2>&1
netsh advfirewall firewall delete rule name="Roberto - Swagger" >nul 2>&1

echo.
echo [*] Criando novas regras de firewall...
echo.

:: Frontend (porta 3002)
echo     [1/5] Porta 3002 - Frontend (Interface Web)
netsh advfirewall firewall add rule name="Roberto - Frontend" dir=in action=allow protocol=TCP localport=3002
if %errorLevel% neq 0 (
    echo [ERRO] Falha ao criar regra para Frontend!
) else (
    echo [OK] Regra criada para Frontend
)

:: Backend (porta 3001)
echo     [2/5] Porta 3001 - Backend (API)
netsh advfirewall firewall add rule name="Roberto - Backend" dir=in action=allow protocol=TCP localport=3001
if %errorLevel% neq 0 (
    echo [ERRO] Falha ao criar regra para Backend!
) else (
    echo [OK] Regra criada para Backend
)

:: MinIO Console (porta 9001)
echo     [3/5] Porta 9001 - MinIO Console
netsh advfirewall firewall add rule name="Roberto - MinIO Console" dir=in action=allow protocol=TCP localport=9001
if %errorLevel% neq 0 (
    echo [ERRO] Falha ao criar regra para MinIO Console!
) else (
    echo [OK] Regra criada para MinIO Console
)

:: MinIO API (porta 9000)
echo     [4/5] Porta 9000 - MinIO API
netsh advfirewall firewall add rule name="Roberto - MinIO API" dir=in action=allow protocol=TCP localport=9000
if %errorLevel% neq 0 (
    echo [ERRO] Falha ao criar regra para MinIO API!
) else (
    echo [OK] Regra criada para MinIO API
)

:: Swagger (porta 8080)
echo     [5/5] Porta 8080 - Swagger (Documentação API)
netsh advfirewall firewall add rule name="Roberto - Swagger" dir=in action=allow protocol=TCP localport=8080
if %errorLevel% neq 0 (
    echo [ERRO] Falha ao criar regra para Swagger!
) else (
    echo [OK] Regra criada para Swagger
)

echo.
echo ════════════════════════════════════════════════════════════════════════
echo  Configuração Concluída!
echo ════════════════════════════════════════════════════════════════════════
echo.

:: Obter IP da máquina
echo [*] Informações de Rede desta Máquina:
echo.
for /f "tokens=2 delims=:" %%a in ('ipconfig ^| findstr /C:"IPv4"') do (
    echo     IP Local: %%a
)
echo.

echo ──────────────────────────────────────────────────────────────────────
echo  Portas Liberadas no Firewall:
echo ──────────────────────────────────────────────────────────────────────
echo.
echo     3002 - Frontend (Interface Web)
echo     3001 - Backend (API)
echo     9001 - MinIO Console
echo     9000 - MinIO API
echo     8080 - Swagger (Documentação)
echo.

echo ──────────────────────────────────────────────────────────────────────
echo  Como Acessar de Outras Máquinas na Rede:
echo ──────────────────────────────────────────────────────────────────────
echo.
echo     1. Anote o IP desta máquina (mostrado acima)
echo        Exemplo: 192.168.1.100
echo.
echo     2. Em outra máquina da rede, abra o navegador
echo.
echo     3. Digite na barra de endereços:
echo        http://192.168.1.100:3002
echo        (substituindo pelo IP real desta máquina)
echo.
echo     4. Faça login normalmente!
echo.

echo ──────────────────────────────────────────────────────────────────────
echo  Próximos Passos:
echo ──────────────────────────────────────────────────────────────────────
echo.
echo     1. Configure um IP FIXO para esta máquina (recomendado)
echo        Ver: INSTALACAO-MULTIPLAS-MAQUINAS.md
echo.
echo     2. Teste o acesso em outra máquina
echo.
echo     3. Crie atalhos na área de trabalho das outras máquinas
echo.

echo ════════════════════════════════════════════════════════════════════════
echo.
pause
