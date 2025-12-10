@echo off
chcp 65001 >nul
setlocal EnableDelayedExpansion

:: ============================================================================
:: INSTALADOR AUTOMÁTICO - Roberto Prevenção no Radar
:: ============================================================================
:: Este script instala todo o sistema automaticamente na máquina do cliente
:: ============================================================================

echo.
echo ╔════════════════════════════════════════════════════════════════════════╗
echo ║                                                                        ║
echo ║     INSTALADOR AUTOMÁTICO - Roberto Prevenção no Radar                ║
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

:: ============================================================================
:: ETAPA 1: COLETA DE INFORMAÇÕES DO CLIENTE
:: ============================================================================

echo ════════════════════════════════════════════════════════════════════════
echo  ETAPA 1/6: Informações do Cliente
echo ════════════════════════════════════════════════════════════════════════
echo.

set /p EMPRESA_NOME="Nome da Empresa: "
set /p EMPRESA_CNPJ="CNPJ da Empresa: "
echo.

echo ════════════════════════════════════════════════════════════════════════
echo  Configurações do ERP Zanthus
echo ════════════════════════════════════════════════════════════════════════
echo.

set /p ZANTHUS_HOST="IP do servidor Zanthus (ex: 192.168.1.100): "
set /p ZANTHUS_PORT="Porta do Zanthus (padrão 8080): "
if "!ZANTHUS_PORT!"=="" set ZANTHUS_PORT=8080

set /p ZANTHUS_TOKEN="Token de API do Zanthus: "
echo.

:: ============================================================================
:: ETAPA 2: VERIFICAR DOCKER
:: ============================================================================

echo ════════════════════════════════════════════════════════════════════════
echo  ETAPA 2/6: Verificando Docker Desktop
echo ════════════════════════════════════════════════════════════════════════
echo.

where docker >nul 2>&1
if %errorLevel% neq 0 (
    echo [!] Docker Desktop não encontrado!
    echo.
    echo Deseja instalar o Docker Desktop agora? [S/N]
    set /p INSTALL_DOCKER=

    if /i "!INSTALL_DOCKER!"=="S" (
        echo.
        echo [*] Instalando Docker Desktop...
        echo.

        :: Procurar instalador em vários locais
        set DOCKER_INSTALLER=

        if exist "INSTALADORAUTOMATICO\Docker Desktop Installer.exe" (
            set DOCKER_INSTALLER=INSTALADORAUTOMATICO\Docker Desktop Installer.exe
        ) else if exist "instaladores\Docker Desktop Installer.exe" (
            set DOCKER_INSTALLER=instaladores\Docker Desktop Installer.exe
        ) else if exist "Docker Desktop Installer.exe" (
            set DOCKER_INSTALLER=Docker Desktop Installer.exe
        )

        if defined DOCKER_INSTALLER (
            echo [*] Instalador encontrado: !DOCKER_INSTALLER!
            echo.
            echo [*] Iniciando instalação do Docker Desktop...
            echo     Isso pode levar alguns minutos...
            echo.

            start /wait "!DOCKER_INSTALLER!" install --quiet

            echo.
            echo [OK] Docker Desktop instalado!
            echo.
            echo ╔════════════════════════════════════════════════════════════╗
            echo ║  ATENÇÃO: É necessário REINICIAR o computador!             ║
            echo ║                                                            ║
            echo ║  Após reiniciar, execute este instalador novamente para   ║
            echo ║  concluir a instalação do sistema.                        ║
            echo ╚════════════════════════════════════════════════════════════╝
            echo.
            pause
            shutdown /r /t 60 /c "Reiniciando para concluir instalação do Docker Desktop. Cancele com: shutdown /a"
            exit /b 0
        ) else (
            echo [ERRO] Instalador do Docker não encontrado!
            echo.
            echo Procurado em:
            echo   - INSTALADORAUTOMATICO\Docker Desktop Installer.exe
            echo   - instaladores\Docker Desktop Installer.exe
            echo   - Docker Desktop Installer.exe
            echo.
            echo ════════════════════════════════════════════════════════════
            echo  Como baixar o Docker Desktop:
            echo ════════════════════════════════════════════════════════════
            echo.
            echo  1. Acesse: https://www.docker.com/products/docker-desktop/
            echo  2. Clique em "Download for Windows"
            echo  3. Salve em: INSTALADORAUTOMATICO\
            echo  4. Execute este instalador novamente
            echo.
            echo  OU use o comando (Windows 11):
            echo  winget install Docker.DockerDesktop
            echo.
            pause
            exit /b 1
        )
    ) else (
        echo [!] Instalação cancelada. Docker é necessário para continuar.
        pause
        exit /b 1
    )
) else (
    echo [OK] Docker Desktop encontrado!

    :: Verificar se Docker está rodando
    docker ps >nul 2>&1
    if %errorLevel% neq 0 (
        echo [!] Docker Desktop não está rodando. Iniciando...
        start "" "C:\Program Files\Docker\Docker\Docker Desktop.exe"

        echo [*] Aguardando Docker iniciar (isso pode levar 1-2 minutos)...
        timeout /t 60 /nobreak >nul

        docker ps >nul 2>&1
        if %errorLevel% neq 0 (
            echo [ERRO] Docker não iniciou corretamente.
            echo Por favor, inicie o Docker Desktop manualmente e execute este instalador novamente.
            pause
            exit /b 1
        )
    )

    echo [OK] Docker está rodando!
)

echo.

:: ============================================================================
:: ETAPA 3: COPIAR ARQUIVOS PARA DESTINO
:: ============================================================================

echo ════════════════════════════════════════════════════════════════════════
echo  ETAPA 3/6: Copiando arquivos do sistema
echo ════════════════════════════════════════════════════════════════════════
echo.

set DESTINO=C:\roberto-prevencao-no-radar

if exist "%DESTINO%" (
    echo [!] Pasta de destino já existe: %DESTINO%
    echo.
    echo Deseja sobrescrever? [S/N]
    set /p SOBRESCREVER=

    if /i not "!SOBRESCREVER!"=="S" (
        echo [!] Instalação cancelada.
        pause
        exit /b 1
    )

    echo [*] Fazendo backup da instalação anterior...
    if exist "%DESTINO%-backup" rd /s /q "%DESTINO%-backup"
    move "%DESTINO%" "%DESTINO%-backup" >nul 2>&1
)

echo [*] Copiando arquivos...
xcopy /E /I /Y "%~dp0" "%DESTINO%" >nul

if %errorLevel% neq 0 (
    echo [ERRO] Falha ao copiar arquivos!
    pause
    exit /b 1
)

echo [OK] Arquivos copiados para: %DESTINO%
echo.

:: ============================================================================
:: ETAPA 4: CRIAR ARQUIVO DE CONFIGURAÇÃO
:: ============================================================================

echo ════════════════════════════════════════════════════════════════════════
echo  ETAPA 4/6: Configurando sistema
echo ════════════════════════════════════════════════════════════════════════
echo.

cd /d "%DESTINO%"

:: Criar arquivo .env para o backend
echo [*] Criando arquivo de configuração do backend...

(
echo # Configurações do Banco de Dados
echo DATABASE_HOST=postgres
echo DATABASE_PORT=5432
echo DATABASE_NAME=market_security
echo DATABASE_USER=admin
echo DATABASE_PASSWORD=admin123
echo.
echo # Configurações do Servidor
echo PORT=3001
echo NODE_ENV=production
echo.
echo # Segurança
echo JWT_SECRET=%RANDOM%%RANDOM%%RANDOM%%RANDOM%
echo API_TOKEN=%RANDOM%%RANDOM%%RANDOM%%RANDOM%
echo.
echo # Zanthus ERP
echo ZANTHUS_BASE_URL=http://%ZANTHUS_HOST%:%ZANTHUS_PORT%
echo ZANTHUS_API_TOKEN=%ZANTHUS_TOKEN%
echo.
echo # MinIO
echo MINIO_ENDPOINT=minio
echo MINIO_PORT=9000
echo MINIO_USE_SSL=false
echo MINIO_ACCESS_KEY=f0a02f9d4320abc34679f4742eecbad1
echo MINIO_SECRET_KEY=3e928e13c609385d81df326d680074f2d69434d752c44fa3161ddf89dcdaca55
echo MINIO_BUCKET=market-security
echo.
echo # Intersolid
echo INTERSOLID_ENABLED=false
echo.
echo # Evolution API
echo EVOLUTION_ENABLED=false
) > packages\backend\.env

echo [OK] Configuração criada!
echo.

:: Criar arquivo de informações do cliente
echo [*] Salvando informações do cliente...

(
echo # Informações da Instalação
echo EMPRESA_NOME=%EMPRESA_NOME%
echo EMPRESA_CNPJ=%EMPRESA_CNPJ%
echo ZANTHUS_HOST=%ZANTHUS_HOST%
echo ZANTHUS_PORT=%ZANTHUS_PORT%
echo DATA_INSTALACAO=%DATE% %TIME%
echo INSTALADO_POR=%USERNAME%
) > config-cliente.txt

echo [OK] Informações salvas!
echo.

:: ============================================================================
:: ETAPA 5: INICIAR SISTEMA COM DOCKER
:: ============================================================================

echo ════════════════════════════════════════════════════════════════════════
echo  ETAPA 5/6: Iniciando sistema com Docker
echo ════════════════════════════════════════════════════════════════════════
echo.

echo [*] Parando containers antigos (se existirem)...
docker-compose down >nul 2>&1

echo [*] Construindo e iniciando containers...
echo.
echo    Isso pode levar alguns minutos na primeira vez...
echo.

docker-compose up -d --build

if %errorLevel% neq 0 (
    echo.
    echo [ERRO] Falha ao iniciar containers!
    echo.
    echo Verifique os logs com: docker-compose logs
    echo.
    pause
    exit /b 1
)

echo.
echo [*] Aguardando serviços iniciarem...
timeout /t 30 /nobreak >nul

echo [OK] Sistema iniciado!
echo.

:: ============================================================================
:: ETAPA 6: VERIFICAR INSTALAÇÃO
:: ============================================================================

echo ════════════════════════════════════════════════════════════════════════
echo  ETAPA 6/6: Verificando instalação
echo ════════════════════════════════════════════════════════════════════════
echo.

echo [*] Verificando containers...
docker-compose ps

echo.
echo [*] Testando conexão com o backend...
curl -s http://localhost:3001/api/health >nul 2>&1
if %errorLevel% equ 0 (
    echo [OK] Backend respondendo!
) else (
    echo [!] Backend ainda não está pronto. Pode levar mais alguns segundos...
)

echo.

:: ============================================================================
:: CONCLUSÃO
:: ============================================================================

echo.
echo ════════════════════════════════════════════════════════════════════════
echo  INSTALAÇÃO CONCLUÍDA COM SUCESSO!
echo ════════════════════════════════════════════════════════════════════════
echo.
echo  Cliente: %EMPRESA_NOME%
echo  CNPJ: %EMPRESA_CNPJ%
echo.
echo  ──────────────────────────────────────────────────────────────────────
echo  URLs de Acesso:
echo  ──────────────────────────────────────────────────────────────────────
echo.
echo    Frontend:  http://localhost:3002
echo    Backend:   http://localhost:3001
echo    Swagger:   http://localhost:8080
echo    MinIO:     http://localhost:9001
echo.
echo  ──────────────────────────────────────────────────────────────────────
echo  Login Padrão:
echo  ──────────────────────────────────────────────────────────────────────
echo.
echo    Usuário: admin@tradicaosjc.com.br
echo    Senha:   admin123
echo.
echo    [!] IMPORTANTE: Trocar a senha após primeiro acesso!
echo.
echo  ──────────────────────────────────────────────────────────────────────
echo  Comandos Úteis:
echo  ──────────────────────────────────────────────────────────────────────
echo.
echo    Parar sistema:     parar.bat
echo    Iniciar sistema:   iniciar.bat
echo    Ver logs:          logs.bat
echo    Reiniciar:         restart.bat
echo.
echo  ──────────────────────────────────────────────────────────────────────
echo  Localização da Instalação:
echo  ──────────────────────────────────────────────────────────────────────
echo.
echo    %DESTINO%
echo.
echo ════════════════════════════════════════════════════════════════════════
echo.

:: Abrir navegador automaticamente
echo [*] Abrindo sistema no navegador...
timeout /t 3 /nobreak >nul
start http://localhost:3002

:: ============================================================================
:: PROTEÇÃO DO SISTEMA (OPCIONAL)
:: ============================================================================

echo ════════════════════════════════════════════════════════════════════════
echo  PROTEÇÃO DO SISTEMA (Opcional)
echo ════════════════════════════════════════════════════════════════════════
echo.
echo Deseja proteger a pasta do sistema contra cópia/modificação? [S/N]
echo.
echo Isso irá:
echo   - Criar usuário protegido (Beto/Beto3107)
echo   - Bloquear modificação de arquivos
echo   - Impedir cópia não autorizada
echo   - Exigir senha para desinstalar
echo.
set /p PROTEGER_SISTEMA="Ativar proteção? [S/N]: "

if /i "!PROTEGER_SISTEMA!"=="S" (
    echo.
    echo [*] Ativando proteção do sistema...
    echo.

    call "%DESTINO%\proteger-sistema.bat"

    echo.
    echo [OK] Sistema protegido!
    echo.
    echo ╔════════════════════════════════════════════════════════════════╗
    echo ║  IMPORTANTE - ANOTE ESTAS CREDENCIAIS:                        ║
    echo ║                                                                ║
    echo ║  Usuário: Beto                                                ║
    echo ║  Senha:   Beto3107                                            ║
    echo ║                                                                ║
    echo ║  Necessárias para desinstalar o sistema!                      ║
    echo ╚════════════════════════════════════════════════════════════════╝
    echo.
) else (
    echo.
    echo [!] Sistema instalado SEM proteção.
    echo     Você pode ativar a proteção depois executando: proteger-sistema.bat
    echo.
)

echo.
echo Instalação finalizada!
echo.
pause
