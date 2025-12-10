@echo off
echo ========================================
echo  INICIANDO SISTEMA PREVENCAO NO RADAR
echo ========================================
echo.

cd /d "%~dp0"

echo [1/4] Iniciando MINIO (porta 9000)...
set MINIO_ROOT_USER=f0a02f9d4320abc34679f4742eecbad1
set MINIO_ROOT_PASSWORD=3e928e13c609385d81df326d680074f2d69434d752c44fa3161ddf89dcdaca55
start "MinIO - Prevencao no Radar" cmd /c "minio.exe server minio-data --console-address :9001"
timeout /t 3 /nobreak >nul

echo [2/4] Iniciando BACKEND (porta 3001)...
start "Backend - Prevencao no Radar" cmd /c "cd packages\backend && npm run dev"
timeout /t 5 /nobreak >nul

echo [3/4] Iniciando FRONTEND (porta 3004)...
start "Frontend - Prevencao no Radar" cmd /c "cd packages\frontend && npm run dev"
timeout /t 5 /nobreak >nul

echo [4/4] Iniciando NGROK...
start "Ngrok - Prevencao no Radar" ngrok.exe http 3004
timeout /t 3 /nobreak >nul

echo.
echo ========================================
echo  SISTEMA INICIADO COM SUCESSO!
echo ========================================
echo.
echo  MinIO:    http://localhost:9001 (console)
echo  Backend:  http://localhost:3001
echo  Frontend: http://localhost:3004
echo  Ngrok:    Aguarde 10s e acesse http://localhost:4040
echo.
echo Pressione qualquer tecla para fechar esta janela...
pause >nul
