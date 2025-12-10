@echo off
echo ========================================
echo  Roberto Prevencao no Radar - START
echo ========================================
echo.
echo Iniciando todos os servicos com Docker Compose...
echo.

cd /d "%~dp0"

docker-compose up -d

echo.
echo ========================================
echo  Sistema iniciado com sucesso!
echo ========================================
echo.
echo  Frontend: http://localhost:3002
echo  Backend:  http://localhost:3001
echo  Swagger:  http://localhost:8080
echo  MinIO:    http://localhost:9001
echo.
echo Para ver os logs: docker-compose logs -f
echo Para parar: docker-compose down
echo.
pause
