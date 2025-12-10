@echo off
echo ========================================
echo  INSTALACAO SERVICO AUTOMATICO 24/7
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

echo [1/3] Criando tarefa agendada no Windows...
echo.

REM Criar tarefa agendada para iniciar com o Windows
schtasks /Create /SC ONLOGON /TN "Prevencao no Radar" /TR "wscript.exe ""C:\Users\Administrator\Desktop\roberto-prevencao-no-radar-main\iniciar-silencioso.vbs""" /RL HIGHEST /F

if %errorLevel% EQU 0 (
    echo [OK] Tarefa agendada criada com sucesso!
) else (
    echo [ERRO] Falha ao criar tarefa agendada!
    pause
    exit /b 1
)

echo.
echo [2/3] Configurando atalho na Startup...
echo.

REM Criar atalho na pasta Startup
set STARTUP_FOLDER=%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup
echo Set oWS = WScript.CreateObject("WScript.Shell") > CreateShortcut.vbs
echo sLinkFile = "%STARTUP_FOLDER%\Prevencao no Radar.lnk" >> CreateShortcut.vbs
echo Set oLink = oWS.CreateShortcut(sLinkFile) >> CreateShortcut.vbs
echo oLink.TargetPath = "wscript.exe" >> CreateShortcut.vbs
echo oLink.Arguments = """C:\Users\Administrator\Desktop\roberto-prevencao-no-radar-main\iniciar-silencioso.vbs""" >> CreateShortcut.vbs
echo oLink.WorkingDirectory = "C:\Users\Administrator\Desktop\roberto-prevencao-no-radar-main" >> CreateShortcut.vbs
echo oLink.Description = "Prevencao no Radar - Inicializacao Automatica" >> CreateShortcut.vbs
echo oLink.Save >> CreateShortcut.vbs
cscript CreateShortcut.vbs >nul
del CreateShortcut.vbs

echo [OK] Atalho criado na Startup!

echo.
echo [3/3] Testando inicializacao...
echo.

REM Executar o script de inicializacao
wscript.exe "C:\Users\Administrator\Desktop\roberto-prevencao-no-radar-main\iniciar-silencioso.vbs"

echo [OK] Script executado!
echo.
echo Aguardando 10 segundos para os servicos iniciarem...
timeout /t 10 /nobreak >nul

echo.
echo ========================================
echo  INSTALACAO CONCLUIDA COM SUCESSO!
echo ========================================
echo.
echo A aplicacao agora vai:
echo  - Iniciar automaticamente quando o Windows iniciar
echo  - Rodar em background (sem janelas)
echo  - Reiniciar automaticamente se cair
echo.
echo URLs da aplicacao:
echo  Frontend: http://localhost:3004
echo  Backend:  http://localhost:3001
echo.
echo Para DESINSTALAR o servico automatico, execute:
echo  DESINSTALAR-SERVICO-AUTOMATICO.bat
echo.
echo Para PARAR a aplicacao manualmente:
echo  parar.bat
echo.
pause
