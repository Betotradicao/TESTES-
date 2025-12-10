@echo off
echo ========================================
echo  Roberto Prevencao no Radar - PARAR
echo ========================================
echo.

echo [1/3] Parando Scanner Service...
wmic process where "name='python.exe'" delete >nul 2>&1
wmic process where "name='pythonw.exe'" delete >nul 2>&1
echo Scanner Service parado!
echo.

echo [2/3] Parando Backend e Frontend...
wmic process where "name='node.exe'" delete >nul 2>&1
echo Backend e Frontend parados!
echo.

echo [3/3] Limpando processos residuais...
wmic process where "name='node.exe'" delete >nul 2>&1
echo Processos limpos!
echo.

echo ========================================
echo  Sistema parado com sucesso!
echo ========================================
echo.
pause
