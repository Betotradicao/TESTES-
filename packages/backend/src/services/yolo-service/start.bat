@echo off
echo ========================================
echo   Iniciando YOLO v8 Service
echo ========================================
echo.

cd /d "%~dp0"

if not exist "venv\Scripts\activate.bat" (
    echo ERRO: Ambiente virtual nao encontrado!
    echo Execute install.bat primeiro.
    pause
    exit /b 1
)

call venv\Scripts\activate.bat
python yolo_analyzer.py
