@echo off
echo Iniciando MinIO...

set MINIO_ROOT_USER=f0a02f9d4320abc34679f4742eecbad1
set MINIO_ROOT_PASSWORD=3e928e13c609385d81df326d680074f2d69434d752c44fa3161ddf89dcdaca55

cd /d "%~dp0"
start "MinIO Server" minio.exe server minio-data --console-address :9001 --address :9000

echo MinIO iniciado!
echo Console: http://localhost:9001
echo API: http://localhost:9000
pause
