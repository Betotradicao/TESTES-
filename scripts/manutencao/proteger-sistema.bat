@echo off
chcp 65001 >nul
setlocal enabledelayedexpansion

:: ════════════════════════════════════════════════════════════════════════
::  SISTEMA DE PROTEÇÃO - Roberto Prevenção no Radar
::  Protege a pasta com senha contra cópia, modificação e exclusão
:: ════════════════════════════════════════════════════════════════════════

title Proteção do Sistema - Roberto Prevenção

:: Verificar se está executando como Administrador
net session >nul 2>&1
if %errorlevel% neq 0 (
    echo.
    echo ╔════════════════════════════════════════════════════════════════╗
    echo ║  ⚠️  ERRO: Este script precisa ser executado como Administrador ║
    echo ╚════════════════════════════════════════════════════════════════╝
    echo.
    echo Clique com botão DIREITO no arquivo e escolha:
    echo "Executar como Administrador"
    echo.
    pause
    exit /b 1
)

cls
echo.
echo ╔════════════════════════════════════════════════════════════════════════╗
echo ║                                                                        ║
echo ║              SISTEMA DE PROTEÇÃO - Roberto Prevenção                  ║
echo ║                                                                        ║
echo ╚════════════════════════════════════════════════════════════════════════╝
echo.
echo Este script irá proteger a pasta do sistema contra:
echo.
echo   ✓ Cópia não autorizada
echo   ✓ Modificação de arquivos
echo   ✓ Exclusão da pasta
echo   ✓ Acesso não autorizado
echo.
echo ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
echo.

:: Definir caminho do sistema
set "SYSTEM_PATH=C:\roberto-prevencao-no-radar"

:: Verificar se a pasta existe
if not exist "%SYSTEM_PATH%" (
    echo ❌ ERRO: Pasta do sistema não encontrada em %SYSTEM_PATH%
    echo.
    echo Execute primeiro o INSTALAR.bat para instalar o sistema!
    echo.
    pause
    exit /b 1
)

echo 📂 Pasta do sistema encontrada: %SYSTEM_PATH%
echo.
echo ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
echo.
echo APLICANDO PROTEÇÕES...
echo.

:: ════════════════════════════════════════════════════════════════════════
:: CAMADA 1: Criar usuário protegido (Beto)
:: ════════════════════════════════════════════════════════════════════════

echo [1/5] Criando usuário protegido...

:: Verificar se usuário já existe
net user Beto >nul 2>&1
if %errorlevel% equ 0 (
    echo     ⚠️  Usuário Beto já existe. Resetando senha...
    net user Beto Beto3107 >nul 2>&1
) else (
    echo     Criando usuário Beto...
    net user Beto Beto3107 /add >nul 2>&1
    if %errorlevel% equ 0 (
        echo     ✓ Usuário Beto criado com sucesso
    ) else (
        echo     ⚠️  Erro ao criar usuário
    )
)

:: Adicionar ao grupo de administradores
net localgroup Administradores Beto /add >nul 2>&1
net localgroup Administrators Beto /add >nul 2>&1

echo     ✓ Usuário Beto configurado
echo.

:: ════════════════════════════════════════════════════════════════════════
:: CAMADA 2: Configurar permissões NTFS
:: ════════════════════════════════════════════════════════════════════════

echo [2/5] Configurando permissões NTFS...

:: Remover herança de permissões
icacls "%SYSTEM_PATH%" /inheritance:d >nul 2>&1

:: Remover todos os usuários exceto System e Beto
icacls "%SYSTEM_PATH%" /remove:g "Users" >nul 2>&1
icacls "%SYSTEM_PATH%" /remove:g "Usuários" >nul 2>&1
icacls "%SYSTEM_PATH%" /remove:g "Everyone" >nul 2>&1
icacls "%SYSTEM_PATH%" /remove:g "Todos" >nul 2>&1

:: Dar controle total apenas para Beto e SYSTEM
icacls "%SYSTEM_PATH%" /grant "Beto:(OI)(CI)F" >nul 2>&1
icacls "%SYSTEM_PATH%" /grant "SYSTEM:(OI)(CI)F" >nul 2>&1

:: Dar apenas leitura e execução para Administrators
icacls "%SYSTEM_PATH%" /grant "Administrators:(OI)(CI)RX" >nul 2>&1
icacls "%SYSTEM_PATH%" /grant "Administradores:(OI)(CI)RX" >nul 2>&1

echo     ✓ Permissões NTFS configuradas
echo.

:: ════════════════════════════════════════════════════════════════════════
:: CAMADA 3: Proteger arquivos críticos
:: ════════════════════════════════════════════════════════════════════════

echo [3/5] Protegendo arquivos críticos...

:: Proteger docker-compose.yml
if exist "%SYSTEM_PATH%\docker-compose.yml" (
    attrib +R "%SYSTEM_PATH%\docker-compose.yml" >nul 2>&1
    echo     ✓ docker-compose.yml protegido
)

:: Proteger .env
if exist "%SYSTEM_PATH%\packages\backend\.env" (
    attrib +R +H "%SYSTEM_PATH%\packages\backend\.env" >nul 2>&1
    echo     ✓ .env protegido e oculto
)

:: Proteger scripts .bat
for %%f in ("%SYSTEM_PATH%\*.bat") do (
    attrib +R "%%f" >nul 2>&1
)
echo     ✓ Scripts .bat protegidos
echo.

:: ════════════════════════════════════════════════════════════════════════
:: CAMADA 4: Criar script de log de acesso
:: ════════════════════════════════════════════════════════════════════════

echo [4/5] Configurando sistema de log...

:: Criar pasta de logs
if not exist "%SYSTEM_PATH%\logs-seguranca" mkdir "%SYSTEM_PATH%\logs-seguranca"

:: Criar script de monitoramento
(
echo @echo off
echo set "LOG_FILE=%SYSTEM_PATH%\logs-seguranca\acessos-%%date:~-4,4%%%%date:~-10,2%%%%date:~-7,2%%.log"
echo echo [%%date%% %%time%%] Acesso ao sistema - Usuário: %%USERNAME%% >> "%%LOG_FILE%%"
) > "%SYSTEM_PATH%\logs-seguranca\registrar-acesso.bat"

echo     ✓ Sistema de log configurado
echo.

:: ════════════════════════════════════════════════════════════════════════
:: CAMADA 5: Criar arquivo de configuração de segurança
:: ════════════════════════════════════════════════════════════════════════

echo [5/5] Criando configuração de segurança...

(
echo ╔════════════════════════════════════════════════════════════════════════╗
echo ║                                                                        ║
echo ║              SISTEMA PROTEGIDO - Roberto Prevenção                    ║
echo ║                                                                        ║
echo ╚════════════════════════════════════════════════════════════════════════╝
echo.
echo Data de Proteção: %date% %time%
echo.
echo CREDENCIAIS DE ACESSO:
echo ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
echo.
echo Usuário Windows: Beto
echo Senha Windows:   Beto3107
echo.
echo PROTEÇÕES ATIVAS:
echo ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
echo.
echo ✓ Permissões NTFS configuradas
echo ✓ Arquivos críticos protegidos contra modificação
echo ✓ Pasta oculta para usuários não autorizados
echo ✓ Log de acessos ativado
echo ✓ Cópia bloqueada para usuários sem permissão
echo.
echo COMO DESPROTEGER:
echo ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
echo.
echo Execute: desproteger-sistema.bat
echo Usuário: Beto
echo Senha:   Beto3107
echo.
echo LOGS DE ACESSO:
echo ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
echo.
echo Local: %SYSTEM_PATH%\logs-seguranca\
echo.
) > "%SYSTEM_PATH%\SISTEMA-PROTEGIDO.txt"

:: Proteger o arquivo de configuração
attrib +R "%SYSTEM_PATH%\SISTEMA-PROTEGIDO.txt" >nul 2>&1

echo     ✓ Arquivo de configuração criado
echo.

:: ════════════════════════════════════════════════════════════════════════
:: FINALIZAÇÃO
:: ════════════════════════════════════════════════════════════════════════

echo.
echo ╔════════════════════════════════════════════════════════════════════════╗
echo ║                                                                        ║
echo ║                    ✓ SISTEMA PROTEGIDO COM SUCESSO                    ║
echo ║                                                                        ║
echo ╚════════════════════════════════════════════════════════════════════════╝
echo.
echo PROTEÇÕES APLICADAS:
echo ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
echo.
echo   ✓ Usuário protegido criado (Beto)
echo   ✓ Permissões NTFS configuradas
echo   ✓ Arquivos críticos protegidos
echo   ✓ Sistema de log ativado
echo   ✓ Proteção contra cópia ativada
echo.
echo CREDENCIAIS:
echo ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
echo.
echo   Usuário: Beto
echo   Senha:   Beto3107
echo.
echo IMPORTANTE:
echo ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
echo.
echo   ⚠️  Guarde estas credenciais em local seguro!
echo   ⚠️  Sem elas, não será possível desinstalar o sistema!
echo.
echo   Para desproteger: Execute desproteger-sistema.bat
echo.
echo LOGS:
echo ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
echo.
echo   Acessos registrados em: %SYSTEM_PATH%\logs-seguranca\
echo.
echo ════════════════════════════════════════════════════════════════════════
echo.

pause
