@echo off
REM Script para iniciar MinIO automaticamente
cd /d "C:\Users\Administrator\Desktop\roberto-prevencao-no-radar-main"

REM Define variaveis de ambiente do MinIO
set MINIO_ROOT_USER=f0a02f9d4320abc34679f4742eecbad1
set MINIO_ROOT_PASSWORD=3e928e13c609385d81df326d680074f2d69434d752c44fa3161ddf89dcdaca55

REM Inicia o MinIO
start /B cmd /c "set MINIO_ROOT_USER=f0a02f9d4320abc34679f4742eecbad1 && set MINIO_ROOT_PASSWORD=3e928e13c609385d81df326d680074f2d69434d752c44fa3161ddf89dcdaca55 && minio.exe server minio-data --console-address :9001 --address :9000"
