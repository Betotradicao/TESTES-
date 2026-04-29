@echo off
setlocal

REM ============================================================
REM Instalador do Tunnel Manager - Radar 360
REM Baixa e instala um gerenciador silencioso de tuneis SSH.
REM Apos instalado, roda invisivel a cada 30s reconectando tudo.
REM ============================================================

title Instalador Tunnel Manager - Radar 360

REM --- Auto-eleva pra Administrator ---
net session >nul 2>&1
if errorlevel 1 (
    echo Solicitando privilegios de administrador...
    powershell -NoProfile -Command "Start-Process -FilePath '%~f0' -Verb RunAs"
    exit /b
)

echo.
echo ============================================================
echo   Tunnel Manager - Radar 360
echo ============================================================
echo.
echo Este instalador vai:
echo  - Detectar todos os tuneis SSH ja configurados na maquina
echo  - Criar um gerenciador silencioso que verifica a cada 30s
echo  - Reconectar automaticamente qualquer tunel que cair
echo  - Iniciar sozinho no boot do Windows
echo.

REM --- Baixa e executa o setup PowerShell direto do GitHub ---
powershell -NoProfile -ExecutionPolicy Bypass -Command ^
    "[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12; ^
    iex ((New-Object Net.WebClient).DownloadString('https://raw.githubusercontent.com/Betotradicao/TESTES-/TESTE/InstaladorVPS/tunnel-manager-setup.ps1'))"

if errorlevel 1 (
    echo.
    echo [ERRO] Falha na instalacao. Verifique a conexao com a internet.
    pause
    exit /b 1
)

echo.
echo ============================================================
echo   Instalacao finalizada com sucesso!
echo ============================================================
echo.
echo Pra ver o status:    schtasks /query /tn SSH-Tunnel-Manager
echo Pra ver os logs:     type C:\ProgramData\SSHTunnels\tunnel-manager.log
echo Pra editar tuneis:   notepad C:\ProgramData\SSHTunnels\tunnels.json
echo.
pause
