@echo off
echo ========================================
echo  STATUS DOCKER - Market Security
echo ========================================
echo.

echo Status dos containers:
docker-compose ps

echo.
echo Uso de recursos:
docker stats --no-stream --format "table {{.Name}}\t{{.CPUPerc}}\t{{.MemUsage}}"

echo.
pause
