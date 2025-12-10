@echo off
echo ====================================
echo   INICIANDO SISTEMA PREVENCAO NO RADAR
====================================
echo.

cd /d "C:\Users\Administrator\Desktop\roberto-prevencao-no-radar-main"

REM Inicia MinIO
echo [1/3] Iniciando MinIO...
start /B cmd /c "set MINIO_ROOT_USER=f0a02f9d4320abc34679f4742eecbad1 && set MINIO_ROOT_PASSWORD=3e928e13c609385d81df326d680074f2d69434d752c44fa3161ddf89dcdaca55 && minio.exe server minio-data --console-address :9001 --address :9000"
ping -n 3 127.0.0.1 >nul

REM Inicia Backend
echo [2/3] Iniciando Backend...
cd packages\backend
start /B cmd /c "npm run dev"
cd ..\..
ping -n 5 127.0.0.1 >nul

REM Inicia Frontend
echo [3/3] Iniciando Frontend...
cd packages\web
start /B cmd /c "npm run dev"
cd ..\..

echo.
echo ====================================
echo   SISTEMA INICIADO COM SUCESSO!
====================================
echo.
echo Frontend: http://localhost:3004
echo Backend: http://localhost:3001
echo MinIO Console: http://localhost:9001
echo Cloudflare Tunnel: Automatico (servico Windows)
echo.
