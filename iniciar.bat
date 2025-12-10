@echo off
echo ========================================
echo  Roberto Prevencao no Radar - INICIAR
echo ========================================
echo.

REM Limpar processos duplicados primeiro
echo [1/4] Limpando processos antigos...
wmic process where "name='node.exe'" delete >nul 2>&1
wmic process where "name='python.exe'" delete >nul 2>&1
wmic process where "name='pythonw.exe'" delete >nul 2>&1
echo Processos antigos limpos!
echo.

REM Aguardar processos serem eliminados
timeout /t 2 /nobreak >nul

echo [2/4] Iniciando Backend...
cd /d "%~dp0\packages\backend"
start "Backend API" cmd /c "npm run dev"
echo Backend iniciando...
echo.

echo [3/4] Iniciando Frontend...
cd /d "%~dp0\packages\frontend"
start "Frontend Web" cmd /c "npm run dev"
echo Frontend iniciando...
echo.

echo [4/4] Iniciando Scanner Service...
cd /d "C:\Users\Administrator\Desktop\barcode-service-main\INSTALADOR"
start "Scanner Service" pythonw scanner_service.py
echo Scanner Service iniciado!
echo.

echo ========================================
echo  Sistema iniciado com sucesso!
echo ========================================
echo.
echo  Frontend: http://localhost:3004
echo  Backend:  http://localhost:3001
echo  Scanner Service: Rodando em background
echo.
echo Para ver os logs: logs.bat
echo Para parar: parar.bat
echo.
pause
