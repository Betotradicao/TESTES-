@echo off
REM Executa verificacao de vendas sem janela visivel
cd /d "%~dp0"
cd packages\backend
start /B node dist/commands/daily-verification.command.js
