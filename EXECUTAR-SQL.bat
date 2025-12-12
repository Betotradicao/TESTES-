@echo off
cd /d "%~dp0"

echo Executando SQL para criar usuario...

type INSERIR-USUARIO-BETO.sql | docker exec -i prevencao-postgres-prod psql -U postgres -d prevencao_db

if %ERRORLEVEL% EQU 0 (
    echo.
    echo ========================================
    echo   USUARIO CRIADO COM SUCESSO!
    echo ========================================
    echo   Usuario: Beto
    echo   Senha: Beto3107@
    echo ========================================
) else (
    echo.
    echo ERRO ao criar usuario!
)
