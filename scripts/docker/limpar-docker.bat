@echo off
echo ========================================
echo  LIMPAR DOCKER - Market Security
echo ========================================
echo.
echo ATENCAO: Isso vai remover TODOS os dados!
echo (containers, volumes, imagens)
echo.
echo Tem certeza? (S/N)
set /p confirmacao=
if /i not "%confirmacao%"=="S" (
    echo Operacao cancelada.
    pause
    exit /b 0
)

echo.
echo Parando containers...
docker-compose down -v

echo.
echo Removendo imagens...
docker-compose down --rmi all

echo.
echo Limpando sistema Docker...
docker system prune -af --volumes

echo.
echo ========================================
echo  Sistema Docker limpo!
echo ========================================
echo.
pause
