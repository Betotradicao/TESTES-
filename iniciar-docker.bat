@echo off
echo ========================================
echo  INICIAR DOCKER - Market Security
echo ========================================
echo.

echo Iniciando containers...
docker-compose up -d

echo.
echo Aguardando servicos iniciarem...
timeout /t 5 /nobreak >nul

echo.
echo ========================================
echo  STATUS DOS SERVICOS
echo ========================================
docker-compose ps

echo.
echo ========================================
echo  Sistema iniciado!
echo ========================================
echo.
echo  Frontend: http://localhost:3004
echo  Backend:  http://localhost:3001
echo  MinIO:    http://localhost:9001
echo.
pause
