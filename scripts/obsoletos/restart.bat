@echo off
echo ========================================
echo  Roberto Prevencao no Radar - RESTART
echo ========================================
echo.
echo Reiniciando todos os servicos...
echo.

cd /d "%~dp0"

docker-compose down
timeout /t 3 /nobreak > nul
docker-compose up -d

echo.
echo ========================================
echo  Sistema reiniciado com sucesso!
echo ========================================
echo.
echo  Frontend: http://localhost:3002
echo  Backend:  http://localhost:3001
echo  Swagger:  http://localhost:8080
echo  MinIO:    http://localhost:9001
echo.
pause
