@echo off
REM Script para limpar arquivos temporários do Claude Code
echo Limpando arquivos temporários...

del /S /Q tmpclaude-*.cwd 2>nul
del /Q = 2>nul
del /Q nul 2>nul

echo Limpeza concluída!
