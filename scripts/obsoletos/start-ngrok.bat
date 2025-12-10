@echo off
cd /d %~dp0
start "Ngrok Tunnel" ngrok.exe http 3004
