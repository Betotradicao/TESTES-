# ============================================================================
# Tunnel Manager Setup
# Instala um gerenciador silencioso de tuneis SSH na maquina do cliente.
# Uma tarefa unica roda como SYSTEM, em loop infinito de 30s, garantindo
# que todos os tuneis listados em tunnels.json estejam vivos. Reconecta
# automaticamente se algum cair.
# ============================================================================

$ErrorActionPreference = 'Stop'
$mgrDir = "C:\ProgramData\SSHTunnels"
New-Item -ItemType Directory -Force -Path $mgrDir | Out-Null

Write-Host "==> Tunnel Manager Setup" -ForegroundColor Cyan
Write-Host "    Diretorio: $mgrDir`n" -ForegroundColor Gray

# ---------------------------------------------------------------------------
# 1) Auto-descoberta: detecta tuneis das tarefas SSH-Tunnel-* atuais
# ---------------------------------------------------------------------------
$tarefas = Get-ScheduledTask -TaskName 'SSH-Tunnel-*' -ErrorAction SilentlyContinue |
           Where-Object { $_.TaskName -notin @('SSH-Tunnel-Watchdog','SSH-Tunnel-Manager') }

$tunnels = @()
foreach ($t in $tarefas) {
    $argsStr = $t.Actions[0].Arguments
    if ($argsStr -match '-KeyPath\s+"([^"]+)"\s+-Forwards\s+"([^"]+)"') {
        $tunnels += [PSCustomObject]@{
            name = $t.TaskName -replace '^SSH-Tunnel-',''
            key = $matches[1]
            forwards = $matches[2]
        }
    }
}

# Tambem detecta pastas SSHTunnels-* sem tarefa correspondente
$pastas = Get-ChildItem "C:\ProgramData" -Directory -Filter "SSHTunnels*" -ErrorAction SilentlyContinue
foreach ($p in $pastas) {
    $keyPath = Join-Path $p.FullName "tunnel_key"
    if (-not (Test-Path $keyPath)) { continue }
    if ($tunnels | Where-Object { $_.key -eq $keyPath }) { continue }
    Write-Host "  [INFO] Pasta '$($p.Name)' tem chave mas nao esta no inventario" -ForegroundColor Yellow
    Write-Host "         Adicione manualmente em $mgrDir\tunnels.json depois" -ForegroundColor Yellow
}

# Se ja existir tunnels.json e tiver entradas, preserva
$invFile = "$mgrDir\tunnels.json"
if ((Test-Path $invFile) -and ((Get-Item $invFile).Length -gt 5)) {
    try {
        $existing = @(Get-Content $invFile -Raw | ConvertFrom-Json)
        if ($existing.Count -gt 0) {
            Write-Host "  [INFO] tunnels.json existente preservado ($($existing.Count) tunel(eis))" -ForegroundColor Green
            $tunnels = $existing
        }
    } catch {}
}

if ($tunnels.Count -eq 0) {
    Write-Host "  [AVISO] Nenhum tunel detectado. Crie tunnels.json manualmente depois." -ForegroundColor Yellow
} else {
    ConvertTo-Json @($tunnels) -Depth 5 | Out-File $invFile -Encoding UTF8 -Force
    Write-Host "  [OK] Inventario salvo: $invFile ($($tunnels.Count) tunel(eis))" -ForegroundColor Green
}

# ---------------------------------------------------------------------------
# 2) Permissao das chaves: SOMENTE SYSTEM:Read (exigencia OpenSSH Windows)
# ---------------------------------------------------------------------------
function FixarChaveStrict($path) {
    if (-not (Test-Path $path)) { return }
    try {
        $systemSid = New-Object System.Security.Principal.SecurityIdentifier "S-1-5-18"
        $acl = Get-Acl $path
        $acl.SetOwner($systemSid)
        Set-Acl -Path $path -AclObject $acl
        $newAcl = New-Object System.Security.AccessControl.FileSecurity
        $newAcl.SetOwner($systemSid)
        $newAcl.SetAccessRuleProtection($true, $false)
        $rule = New-Object System.Security.AccessControl.FileSystemAccessRule($systemSid, "Read", "Allow")
        $newAcl.AddAccessRule($rule)
        Set-Acl -Path $path -AclObject $newAcl
        Write-Host "  [OK] Chave protegida: $path" -ForegroundColor Green
    } catch {
        Write-Host "  [ERRO] $path : $($_.Exception.Message)" -ForegroundColor Red
    }
}
foreach ($t in $tunnels) { FixarChaveStrict $t.key }

# ---------------------------------------------------------------------------
# 3) empty.config (pra OpenSSH ignorar configs do sistema)
#    Se existir com ACL restrita de instalacao anterior, recupera ownership
# ---------------------------------------------------------------------------
$emptyConf = "$mgrDir\empty.config"
if (Test-Path $emptyConf) {
    takeown /F $emptyConf /A 2>&1 | Out-Null
    icacls $emptyConf /grant "Administrators:(F)" 2>&1 | Out-Null
    Remove-Item $emptyConf -Force -ErrorAction SilentlyContinue
}
"# vazio" | Out-File $emptyConf -Encoding ASCII -Force

# ---------------------------------------------------------------------------
# 4) Cria o gerenciador (loop infinito 30s)
# ---------------------------------------------------------------------------
$mgrPath = "$mgrDir\tunnel-manager.ps1"
@'
$mgrDir = "C:\ProgramData\SSHTunnels"
$invFile = "$mgrDir\tunnels.json"
$logFile = "$mgrDir\tunnel-manager.log"
$sshExe = "C:\Windows\System32\OpenSSH\ssh.exe"
$emptyConfig = "$mgrDir\empty.config"
$knownHosts = "$mgrDir\known_hosts"

function LogMgr($msg) {
    "$([DateTime]::Now.ToString('s')) $msg" | Out-File -Append $logFile -Encoding UTF8
    # Rotaciona log se passar de 1MB
    if ((Test-Path $logFile) -and ((Get-Item $logFile).Length -gt 1MB)) {
        $bak = "$logFile.old"
        if (Test-Path $bak) { Remove-Item $bak -Force }
        Move-Item $logFile $bak -Force
    }
}

function IsTunnelAlive($t) {
    $procs = Get-CimInstance Win32_Process -Filter "Name='ssh.exe'" -ErrorAction SilentlyContinue
    foreach ($p in $procs) {
        if ($p.CommandLine -like "*$($t.key)*") { return $true }
    }
    return $false
}

function StartTunnel($t) {
    $sshArgs = @('-F', $emptyConfig, '-i', $t.key, '-p', '22') + ($t.forwards -split ' ') + @(
        'root@46.202.150.64', '-N',
        '-o', 'StrictHostKeyChecking=no',
        '-o', 'IdentitiesOnly=yes',
        '-o', "UserKnownHostsFile=$knownHosts",
        '-o', "GlobalKnownHostsFile=$knownHosts",
        '-o', 'ServerAliveInterval=15',
        '-o', 'ServerAliveCountMax=4',
        '-o', 'TCPKeepAlive=yes',
        '-o', 'ExitOnForwardFailure=no'
    )
    Start-Process -FilePath $sshExe -ArgumentList $sshArgs -WindowStyle Hidden | Out-Null
    LogMgr "Iniciado tunel '$($t.name)' (forwards: $($t.forwards))"
}

LogMgr "=== Tunnel Manager iniciou ==="

while ($true) {
    try {
        if (Test-Path $invFile) {
            $tunnels = @(Get-Content $invFile -Raw | ConvertFrom-Json)
            foreach ($t in $tunnels) {
                if (-not (IsTunnelAlive $t)) {
                    LogMgr "TUNEL CAIDO: '$($t.name)' - reconectando..."
                    StartTunnel $t
                }
            }
        }
    } catch {
        LogMgr "ERRO no loop: $($_.Exception.Message)"
    }
    Start-Sleep -Seconds 30
}
'@ | Out-File -FilePath $mgrPath -Encoding UTF8 -Force
Write-Host "  [OK] Gerenciador criado: $mgrPath" -ForegroundColor Green

# ---------------------------------------------------------------------------
# 5) Cria UMA tarefa SSH-Tunnel-Manager que sobe no boot e fica viva
# ---------------------------------------------------------------------------
$action = New-ScheduledTaskAction -Execute "powershell.exe" `
    -Argument "-NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File `"$mgrPath`""
$trig = New-ScheduledTaskTrigger -AtStartup
$trig.Delay = 'PT2M'
$princ = New-ScheduledTaskPrincipal -UserId 'SYSTEM' -LogonType ServiceAccount -RunLevel Highest
$sett = New-ScheduledTaskSettingsSet `
    -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries `
    -ExecutionTimeLimit ([TimeSpan]::Zero) `
    -RestartCount 999 -RestartInterval (New-TimeSpan -Minutes 1) `
    -StartWhenAvailable -MultipleInstances IgnoreNew
Register-ScheduledTask -TaskName 'SSH-Tunnel-Manager' `
    -Action $action -Trigger $trig -Principal $princ -Settings $sett -Force | Out-Null
Write-Host "  [OK] Tarefa SSH-Tunnel-Manager criada" -ForegroundColor Green

# ---------------------------------------------------------------------------
# 6) Inicia o Manager AGORA (antes de remover as antigas, pra ter sobreposicao)
# ---------------------------------------------------------------------------
Start-ScheduledTask -TaskName 'SSH-Tunnel-Manager' -ErrorAction SilentlyContinue
Start-Sleep 5
Write-Host "  [OK] SSH-Tunnel-Manager iniciado" -ForegroundColor Green

# ---------------------------------------------------------------------------
# 7) Remove tarefas antigas (substituidas pelo manager)
#    Mata os ssh.exe das tarefas antigas pro manager subir os novos no JSON
# ---------------------------------------------------------------------------
$antigas = Get-ScheduledTask -TaskName 'SSH-Tunnel-*' -ErrorAction SilentlyContinue |
           Where-Object { $_.TaskName -ne 'SSH-Tunnel-Manager' }
foreach ($a in $antigas) {
    Stop-ScheduledTask -TaskName $a.TaskName -ErrorAction SilentlyContinue
    Unregister-ScheduledTask -TaskName $a.TaskName -Confirm:$false -ErrorAction SilentlyContinue
    Write-Host "  [INFO] Removida tarefa antiga: $($a.TaskName)" -ForegroundColor Yellow
}

# Mata ssh.exe orfaos das tarefas antigas e deixa o manager reconectar
Get-Process ssh -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
Start-Sleep 8

Write-Host "`n========================================" -ForegroundColor Green
Write-Host "INSTALACAO CONCLUIDA" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host "Status:" -ForegroundColor Cyan
Get-ScheduledTask -TaskName 'SSH-Tunnel-Manager' | Format-Table TaskName, State -AutoSize
Write-Host "Tuneis ativos:" -ForegroundColor Cyan
Get-CimInstance Win32_Process -Filter "Name='ssh.exe'" -ErrorAction SilentlyContinue |
    Select-Object @{N='Tunel';E={
        if ($_.CommandLine -match '-i\s+([^\s]+)') {
            (Split-Path (Split-Path $matches[1] -Parent) -Leaf)
        } else { 'desconhecido' }
    }}, ProcessId | Format-Table -AutoSize

Write-Host "`nO gerenciador agora roda invisivel a cada 30s." -ForegroundColor Yellow
Write-Host "Logs: C:\ProgramData\SSHTunnels\tunnel-manager.log" -ForegroundColor Yellow
Write-Host "Inventario: $invFile" -ForegroundColor Yellow
Write-Host "Pra adicionar/remover tunel: edite o JSON acima." -ForegroundColor Yellow
