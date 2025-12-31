@echo off
echo ========================================
echo   Instalando YOLO v8 Service
echo ========================================
echo.

echo [1/3] Verificando Python...
python --version
if %errorlevel% neq 0 (
    echo ERRO: Python nao encontrado!
    echo Instale Python 3.8+ de https://python.org
    pause
    exit /b 1
)

echo.
echo [2/3] Criando ambiente virtual...
python -m venv venv

echo.
echo [3/3] Instalando dependencias...
call venv\Scripts\activate.bat
pip install --upgrade pip
pip install -r requirements.txt

echo.
echo ========================================
echo   Instalacao concluida!
echo ========================================
echo.
echo Para iniciar o servico:
echo   1. call venv\Scripts\activate.bat
echo   2. python yolo_analyzer.py
echo.
pause
