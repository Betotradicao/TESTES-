@echo off
chcp 65001 >nul
setlocal enabledelayedexpansion

:: ════════════════════════════════════════════════════════════════════════
::  SISTEMA DE DESPROTEC̣ÃO - Roberto Prevenção no Radar
::  Remove proteções da pasta (requer senha)
:: ════════════════════════════════════════════════════════════════════════

title Desproteger Sistema - Roberto Prevenção

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
echo ║            DESPROTEC̣ÃO DO SISTEMA - Roberto Prevenção                 ║
echo ║                                                                        ║
echo ╚════════════════════════════════════════════════════════════════════════╝
echo.
echo ⚠️  ATENÇÃO: Este processo remove todas as proteções do sistema!
echo.
echo ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
echo.

:: Definir caminho do sistema
set "SYSTEM_PATH=C:\roberto-prevencao-no-radar"

:: Verificar se a pasta existe
if not exist "%SYSTEM_PATH%" (
    echo ❌ ERRO: Pasta do sistema não encontrada em %SYSTEM_PATH%
    echo.
    pause
    exit /b 1
)

:: ════════════════════════════════════════════════════════════════════════
:: AUTENTICAÇÃO
:: ════════════════════════════════════════════════════════════════════════

echo AUTENTICAÇÃO NECESSÁRIA
echo ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
echo.

set /p "INPUT_USER=Digite o usuário: "
set "INPUT_PASS="
set "psCommand=powershell -Command "$pword = read-host 'Digite a senha' -AsSecureString ; ^
    $BSTR=[System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($pword); ^
    [System.Runtime.InteropServices.Marshal]::PtrToStringAuto($BSTR)""
for /f "usebackq delims=" %%p in (`%psCommand%`) do set "INPUT_PASS=%%p"

echo.
echo Verificando credenciais...

:: Verificar usuário e senha
if /i not "%INPUT_USER%"=="Beto" (
    echo.
    echo ╔════════════════════════════════════════════════════════════════╗
    echo ║                   ❌ ACESSO NEGADO                              ║
    echo ║             Usuário ou senha incorretos!                       ║
    echo ╚════════════════════════════════════════════════════════════════╝
    echo.
    echo Tentativa de acesso registrada no log de segurança.

    :: Registrar tentativa falhada
    set "LOG_FILE=%SYSTEM_PATH%\logs-seguranca\tentativas-falhas.log"
    echo [%date% %time%] FALHA - Usuário: %INPUT_USER% - Por: %USERNAME% >> "!LOG_FILE!"

    timeout /t 5
    exit /b 1
)

if not "%INPUT_PASS%"=="Beto3107" (
    echo.
    echo ╔════════════════════════════════════════════════════════════════╗
    echo ║                   ❌ ACESSO NEGADO                              ║
    echo ║             Usuário ou senha incorretos!                       ║
    echo ╚════════════════════════════════════════════════════════════════╝
    echo.
    echo Tentativa de acesso registrada no log de segurança.

    :: Registrar tentativa falhada
    set "LOG_FILE=%SYSTEM_PATH%\logs-seguranca\tentativas-falhas.log"
    echo [%date% %time%] FALHA - Usuário: %INPUT_USER% - Por: %USERNAME% >> "!LOG_FILE!"

    timeout /t 5
    exit /b 1
)

echo ✓ Credenciais válidas!
echo.

:: Registrar acesso autorizado
set "LOG_FILE=%SYSTEM_PATH%\logs-seguranca\desprotecoes.log"
echo [%date% %time%] DESPROTEC̣ÃO AUTORIZADA - Por: %USERNAME% >> "%LOG_FILE%"

echo ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
echo.
echo REMOVENDO PROTEÇÕES...
echo.

:: ════════════════════════════════════════════════════════════════════════
:: REMOVER PROTEÇÕES
:: ════════════════════════════════════════════════════════════════════════

echo [1/4] Removendo atributos de proteção...

:: Remover atributo somente leitura dos arquivos
attrib -R "%SYSTEM_PATH%\docker-compose.yml" >nul 2>&1
attrib -R -H "%SYSTEM_PATH%\packages\backend\.env" >nul 2>&1
attrib -R "%SYSTEM_PATH%\SISTEMA-PROTEGIDO.txt" >nul 2>&1

for %%f in ("%SYSTEM_PATH%\*.bat") do (
    attrib -R "%%f" >nul 2>&1
)

echo     ✓ Atributos removidos
echo.

echo [2/4] Restaurando permissões NTFS...

:: Restaurar herança de permissões
icacls "%SYSTEM_PATH%" /inheritance:e >nul 2>&1

:: Restaurar permissões padrão
icacls "%SYSTEM_PATH%" /grant "Users:(OI)(CI)M" >nul 2>&1
icacls "%SYSTEM_PATH%" /grant "Usuários:(OI)(CI)M" >nul 2>&1
icacls "%SYSTEM_PATH%" /grant "Administrators:(OI)(CI)F" >nul 2>&1
icacls "%SYSTEM_PATH%" /grant "Administradores:(OI)(CI)F" >nul 2>&1

echo     ✓ Permissões NTFS restauradas
echo.

echo [3/4] Removendo usuário protegido...

:: Perguntar se deseja remover o usuário Beto
echo.
echo Deseja remover o usuário Windows "Beto"? (S/N)
set /p "REMOVE_USER=Escolha: "

if /i "%REMOVE_USER%"=="S" (
    net user Beto /delete >nul 2>&1
    if %errorlevel% equ 0 (
        echo     ✓ Usuário Beto removido
    ) else (
        echo     ⚠️  Erro ao remover usuário (pode não existir)
    )
) else (
    echo     ⚠️  Usuário Beto mantido no sistema
)
echo.

echo [4/4] Finalizando...

:: Atualizar arquivo de status
(
echo ╔════════════════════════════════════════════════════════════════════════╗
echo ║                                                                        ║
echo ║            SISTEMA DESPROTEGIDO - Roberto Prevenção                   ║
echo ║                                                                        ║
echo ╚════════════════════════════════════════════════════════════════════════╝
echo.
echo Data de Desprotec̣ão: %date% %time%
echo Desprotegido por: %USERNAME%
echo.
echo PROTEÇÕES REMOVIDAS:
echo ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
echo.
echo ✓ Permissões NTFS restauradas
echo ✓ Atributos de proteção removidos
echo ✓ Arquivos podem ser modificados
echo ✓ Pasta pode ser copiada
echo.
echo Para proteger novamente: Execute proteger-sistema.bat
echo.
) > "%SYSTEM_PATH%\SISTEMA-DESPROTEGIDO.txt"

echo     ✓ Concluído
echo.

:: ════════════════════════════════════════════════════════════════════════
:: FINALIZAÇÃO
:: ════════════════════════════════════════════════════════════════════════

echo.
echo ╔════════════════════════════════════════════════════════════════════════╗
echo ║                                                                        ║
echo ║                 ✓ SISTEMA DESPROTEGIDO COM SUCESSO                    ║
echo ║                                                                        ║
echo ╚════════════════════════════════════════════════════════════════════════╝
echo.
echo PROTEÇÕES REMOVIDAS:
echo ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
echo.
echo   ✓ Atributos de proteção removidos
echo   ✓ Permissões NTFS restauradas
echo   ✓ Arquivos podem ser modificados
echo   ✓ Pasta pode ser copiada/excluída
echo.
echo IMPORTANTE:
echo ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
echo.
echo   ⚠️  Sistema agora está desprotegido!
echo   ⚠️  Qualquer usuário pode modificar/copiar os arquivos!
echo.
echo   Para proteger novamente: Execute proteger-sistema.bat
echo.
echo ════════════════════════════════════════════════════════════════════════
echo.

pause
