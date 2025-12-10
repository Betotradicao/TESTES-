@echo off
echo ========================================
echo  DESINSTALAR SERVICO AUTOMATICO
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

echo [1/2] Removendo tarefa agendada...
schtasks /Delete /TN "Prevencao no Radar" /F >nul 2>&1
if %errorLevel% EQU 0 (
    echo [OK] Tarefa agendada removida!
) else (
    echo [AVISO] Tarefa agendada nao encontrada (talvez ja foi removida)
)

echo.
echo [2/2] Removendo atalho da Startup...
set STARTUP_FOLDER=%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup
if exist "%STARTUP_FOLDER%\Prevencao no Radar.lnk" (
    del "%STARTUP_FOLDER%\Prevencao no Radar.lnk"
    echo [OK] Atalho removido da Startup!
) else (
    echo [AVISO] Atalho nao encontrado (talvez ja foi removido)
)

echo.
echo ========================================
echo  DESINSTALACAO CONCLUIDA!
echo ========================================
echo.
echo A aplicacao NAO vai mais iniciar automaticamente.
echo.
echo Para iniciar manualmente, use: iniciar.bat
echo.
pause
