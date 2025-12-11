# Script PowerShell para iniciar sistema sem janelas visíveis
$appDir = "C:\Users\Administrator\Desktop\roberto-prevencao-no-radar-main"

# 1. Iniciar PostgreSQL se não estiver rodando
$pgService = Get-Service -Name "postgresql-x64-15" -ErrorAction SilentlyContinue
if ($pgService -and $pgService.Status -ne "Running") {
    Start-Service -Name "postgresql-x64-15" -ErrorAction SilentlyContinue
    Start-Sleep -Seconds 3
}

# 2. Carregar credenciais do .env
$envFile = Join-Path $appDir ".env"
$minioUser = "f0a02f9d4320abc34679f4742eecbad1"
$minioPassword = "3e928e13c609385d81df326d680074f2d69434d752c44fa3161ddf89dcdaca55"

if (Test-Path $envFile) {
    Get-Content $envFile | ForEach-Object {
        if ($_ -match "^MINIO_ROOT_USER=(.+)$") {
            $minioUser = $matches[1]
        }
        elseif ($_ -match "^MINIO_ROOT_PASSWORD=(.+)$") {
            $minioPassword = $matches[1]
        }
    }
}

# 3. Verificar e matar processos antigos MinIO
$minioProcess = Get-Process -Name "minio" -ErrorAction SilentlyContinue
if ($minioProcess) {
    Stop-Process -Name "minio" -Force -ErrorAction SilentlyContinue
    Start-Sleep -Seconds 2
}

# 4. Iniciar MinIO de forma invisível
$env:MINIO_ROOT_USER = $minioUser
$env:MINIO_ROOT_PASSWORD = $minioPassword

$minioPath = Join-Path $appDir "minio.exe"
$minioData = Join-Path $appDir "minio-data"

$psi = New-Object System.Diagnostics.ProcessStartInfo
$psi.FileName = $minioPath
$psi.Arguments = "server `"$minioData`" --console-address :9011 --address :9010"
$psi.WorkingDirectory = $appDir
$psi.WindowStyle = [System.Diagnostics.ProcessWindowStyle]::Hidden
$psi.CreateNoWindow = $true
$psi.UseShellExecute = $false
$psi.EnvironmentVariables["MINIO_ROOT_USER"] = $minioUser
$psi.EnvironmentVariables["MINIO_ROOT_PASSWORD"] = $minioPassword

[System.Diagnostics.Process]::Start($psi) | Out-Null

Start-Sleep -Seconds 5

# 5. Iniciar PM2 processos (se não estiverem rodando)
Set-Location $appDir
$pm2List = & pm2 jlist 2>$null | ConvertFrom-Json

$backendRunning = $pm2List | Where-Object { $_.name -eq "@market-security/backend" -and $_.pm2_env.status -eq "online" }
$frontendRunning = $pm2List | Where-Object { $_.name -eq "@market-security/frontend" -and $_.pm2_env.status -eq "online" }

if (-not $backendRunning -or -not $frontendRunning) {
    & pm2 delete @market-security/backend 2>$null
    & pm2 delete @market-security/frontend 2>$null
    Start-Sleep -Seconds 2

    & pm2 start ecosystem.config.js 2>$null
    Start-Sleep -Seconds 8

    & pm2 save --force 2>$null
}

# 6. Iniciar Ngrok (túneis para frontend e backend)
$ngrokPath = Join-Path $appDir "ngrok.exe"
$ngrokConfig = Join-Path $appDir "ngrok.yml"

if (Test-Path $ngrokPath) {
    # Verificar se ngrok já está rodando
    $ngrokRunning = Get-Process -Name "ngrok" -ErrorAction SilentlyContinue

    if (-not $ngrokRunning) {
        $psi = New-Object System.Diagnostics.ProcessStartInfo
        $psi.FileName = $ngrokPath
        $psi.Arguments = "start --all --config `"$ngrokConfig`""
        $psi.WorkingDirectory = $appDir
        $psi.WindowStyle = [System.Diagnostics.ProcessWindowStyle]::Hidden
        $psi.CreateNoWindow = $true
        $psi.UseShellExecute = $false

        [System.Diagnostics.Process]::Start($psi) | Out-Null
        Start-Sleep -Seconds 3
    }
}

# 7. Iniciar Scanner Service se existir
$scannerDir = "C:\Users\Administrator\Desktop\barcode-service-main\INSTALADOR"
if (Test-Path $scannerDir) {
    $scannerScript = Join-Path $scannerDir "scanner_service.py"

    # Verificar se já está rodando
    $scannerRunning = Get-Process | Where-Object { $_.CommandLine -like "*scanner_service.py*" }

    if (-not $scannerRunning) {
        $psi = New-Object System.Diagnostics.ProcessStartInfo
        $psi.FileName = "pythonw.exe"
        $psi.Arguments = "`"$scannerScript`""
        $psi.WorkingDirectory = $scannerDir
        $psi.WindowStyle = [System.Diagnostics.ProcessWindowStyle]::Hidden
        $psi.CreateNoWindow = $true
        $psi.UseShellExecute = $false

        [System.Diagnostics.Process]::Start($psi) | Out-Null
    }
}
