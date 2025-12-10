# Script PowerShell para iniciar todo o sistema

Write-Host "====================================" -ForegroundColor Cyan
Write-Host "  INICIANDO SISTEMA PREVENCAO NO RADAR" -ForegroundColor Cyan
Write-Host "====================================" -ForegroundColor Cyan
Write-Host ""

Set-Location "C:\Users\Administrator\Desktop\roberto-prevencao-no-radar-main"

# Inicia MinIO
Write-Host "[1/3] Iniciando MinIO..." -ForegroundColor Yellow
$env:MINIO_ROOT_USER = "f0a02f9d4320abc34679f4742eecbad1"
$env:MINIO_ROOT_PASSWORD = "3e928e13c609385d81df326d680074f2d69434d752c44fa3161ddf89dcdaca55"
Start-Process -FilePath "minio.exe" -ArgumentList "server","minio-data","--console-address",":9001","--address",":9000" -WindowStyle Hidden
Start-Sleep -Seconds 3

# Inicia Backend
Write-Host "[2/3] Iniciando Backend..." -ForegroundColor Yellow
Set-Location "packages\backend"
Start-Process -FilePath "npm" -ArgumentList "run","dev" -WindowStyle Hidden
Set-Location "..\..\"
Start-Sleep -Seconds 5

# Inicia Frontend
Write-Host "[3/3] Iniciando Frontend..." -ForegroundColor Yellow
Set-Location "packages\web"
Start-Process -FilePath "npm" -ArgumentList "run","dev" -WindowStyle Hidden
Set-Location "..\..\"

Write-Host ""
Write-Host "====================================" -ForegroundColor Green
Write-Host "  SISTEMA INICIADO COM SUCESSO!" -ForegroundColor Green
Write-Host "====================================" -ForegroundColor Green
Write-Host ""
Write-Host "Frontend: http://localhost:3004" -ForegroundColor White
Write-Host "Backend: http://localhost:3001" -ForegroundColor White
Write-Host "MinIO Console: http://localhost:9001" -ForegroundColor White
Write-Host "Cloudflare Tunnel: Automatico (servico Windows)" -ForegroundColor White
Write-Host ""
