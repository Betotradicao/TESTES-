@echo off
echo ========================================
echo  PARAR DOCKER - Market Security
echo ========================================
echo.

echo Parando containers...
docker-compose down

echo.
echo ========================================
echo  Containers parados com sucesso!
echo ========================================
echo.
pause
