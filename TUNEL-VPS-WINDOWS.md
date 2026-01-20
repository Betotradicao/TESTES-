# TÚNEL SSH - VPS + WINDOWS

Documentação completa de como criar túneis SSH reversos entre uma máquina Windows e uma VPS Linux.

---

## Visão Geral

O túnel SSH reverso permite que a VPS acesse serviços da rede local do cliente (como ERP Intersolid e PDV Zanthus) através de uma conexão SSH segura.

```
[Rede Local Cliente]                    [VPS Linux]

Intersolid (10.6.1.102:3003) <---+
                                 |
Zanthus (10.6.1.101:80)    <-----+----> SSH Tunnel <----> localhost:3003
                                 |                        localhost:8080
Windows Server (túnel)     ------+
```

---

## Pré-requisitos

### Na máquina Windows:
- OpenSSH Client instalado (vem por padrão no Windows 10/Server 2019+)
- Chave SSH configurada (`C:\Users\Administrator\.ssh\id_rsa`)
- Acesso à rede local dos servidores (Intersolid, Zanthus, etc.)

### Na VPS Linux:
- SSH Server rodando
- Chave pública do Windows adicionada em `/root/.ssh/authorized_keys`
- Portas liberadas no firewall (se necessário)

---

## Estrutura de Arquivos

```
C:\ProgramData\SSHTunnels\
├── tunnel-service.ps1          # Script principal com reconexão automática
├── start-tunnel-service.vbs    # Iniciador invisível do serviço
├── tunnel-service.log          # Log do serviço (gerado automaticamente)
├── start-tunnels.ps1           # Script simples (alternativo, sem reconexão)
├── start-tunnels-hidden.vbs    # Iniciador simples (alternativo)
└── TUNEL VPS + WINDOWS.md      # Esta documentação
```

---

## Script Principal - Com Reconexão Automática (RECOMENDADO)

### 1. Script de Serviço - `tunnel-service.ps1`

Este script roda em loop infinito, monitora os túneis e reconecta automaticamente se caírem.

```powershell
# Servico de Tunel SSH com Reconexao Automatica
# VPS 46 - Tradicao (46.202.150.64)

$VPS_IP = "46.202.150.64"
$INTERSOLID_IP = "10.6.1.102"
$INTERSOLID_PORT = "3003"
$ZANTHUS_IP = "10.6.1.101"
$ZANTHUS_PORT = "80"
$LOG_FILE = "C:\ProgramData\SSHTunnels\tunnel-service.log"

function Write-Log {
    param($Message)
    $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    "$timestamp - $Message" | Out-File -FilePath $LOG_FILE -Append -Encoding UTF8
}

function Test-TunnelConnection {
    param($ProcessId)
    if ($ProcessId -eq $null) { return $false }
    $proc = Get-Process -Id $ProcessId -ErrorAction SilentlyContinue
    return ($proc -ne $null -and -not $proc.HasExited)
}

function Start-Tunnel {
    param($LocalIP, $LocalPort, $RemotePort, $Name)

    $args = "-R ${RemotePort}:${LocalIP}:${LocalPort} root@${VPS_IP} -N -o ServerAliveInterval=30 -o ServerAliveCountMax=3 -o StrictHostKeyChecking=no -o BatchMode=yes -o ExitOnForwardFailure=yes"

    $psi = New-Object System.Diagnostics.ProcessStartInfo
    $psi.FileName = "ssh"
    $psi.Arguments = $args
    $psi.UseShellExecute = $false
    $psi.CreateNoWindow = $true
    $psi.WindowStyle = [System.Diagnostics.ProcessWindowStyle]::Hidden

    $process = [System.Diagnostics.Process]::Start($psi)
    Write-Log "Tunnel $Name iniciado (PID: $($process.Id))"
    return $process
}

# Limpar log antigo se maior que 1MB
if (Test-Path $LOG_FILE) {
    $logSize = (Get-Item $LOG_FILE).Length
    if ($logSize -gt 1MB) {
        Remove-Item $LOG_FILE -Force
        Write-Log "Log limpo (tamanho anterior: $([math]::Round($logSize/1MB, 2)) MB)"
    }
}

Write-Log "=========================================="
Write-Log "SERVICO DE TUNEL INICIADO"
Write-Log "VPS: $VPS_IP"
Write-Log "Intersolid: ${INTERSOLID_IP}:${INTERSOLID_PORT} -> VPS:3003"
Write-Log "Zanthus: ${ZANTHUS_IP}:${ZANTHUS_PORT} -> VPS:8080"
Write-Log "=========================================="

$tunnel1 = $null
$tunnel2 = $null
$checkInterval = 30  # Verificar a cada 30 segundos

while ($true) {
    try {
        # Verificar e iniciar Tunnel 1 (Intersolid)
        if (-not (Test-TunnelConnection $tunnel1?.Id)) {
            if ($tunnel1 -ne $null) {
                Write-Log "Tunnel Intersolid caiu! Reconectando..."
            }
            $tunnel1 = Start-Tunnel -LocalIP $INTERSOLID_IP -LocalPort $INTERSOLID_PORT -RemotePort "3003" -Name "Intersolid"
            Start-Sleep -Seconds 2
        }

        # Verificar e iniciar Tunnel 2 (Zanthus)
        if (-not (Test-TunnelConnection $tunnel2?.Id)) {
            if ($tunnel2 -ne $null) {
                Write-Log "Tunnel Zanthus caiu! Reconectando..."
            }
            $tunnel2 = Start-Tunnel -LocalIP $ZANTHUS_IP -LocalPort $ZANTHUS_PORT -RemotePort "8080" -Name "Zanthus"
            Start-Sleep -Seconds 2
        }

        # Aguardar antes da proxima verificacao
        Start-Sleep -Seconds $checkInterval

    } catch {
        Write-Log "ERRO: $_"
        Start-Sleep -Seconds 5
    }
}
```

**Características:**
- Loop infinito - roda como serviço permanente
- Verifica túneis a cada 30 segundos
- Reconecta automaticamente se um túnel cair
- Log detalhado em `tunnel-service.log`
- Limpa log automaticamente quando passa de 1MB

### 2. Iniciador Invisível - `start-tunnel-service.vbs`

Executa o script PowerShell sem abrir nenhuma janela:

```vbs
Set WshShell = CreateObject("WScript.Shell")
WshShell.Run "powershell.exe -WindowStyle Hidden -ExecutionPolicy Bypass -File ""C:\ProgramData\SSHTunnels\tunnel-service.ps1""", 0, False
```

---

## Configuração da Tarefa Agendada

### Criar tarefa (com serviço de reconexão):

```cmd
schtasks /create /tn "SSH-Tunnel-VPS46" /tr "wscript.exe \"C:\ProgramData\SSHTunnels\start-tunnel-service.vbs\"" /sc onstart /delay 0001:00 /rl highest /f
```

**Parâmetros:**
- `/tn "SSH-Tunnel-VPS46"` - Nome da tarefa
- `/tr "wscript.exe ..."` - Comando a executar (script VBS)
- `/sc onstart` - Executar na inicialização do sistema
- `/delay 0001:00` - Aguardar 1 minuto após boot (para rede inicializar)
- `/rl highest` - Executar com privilégios elevados
- `/f` - Forçar criação (sobrescreve se existir)

### Comandos úteis:

```cmd
# Listar tarefa
schtasks /query /tn "SSH-Tunnel-VPS46"

# Executar manualmente
schtasks /run /tn "SSH-Tunnel-VPS46"

# Excluir tarefa
schtasks /delete /tn "SSH-Tunnel-VPS46" /f
```

---

## Configuração da Chave SSH

### 1. Gerar chave (se não existir):

```powershell
ssh-keygen -t rsa -b 4096 -f "$env:USERPROFILE\.ssh\id_rsa" -N '""'
```

### 2. Copiar chave pública para a VPS:

```powershell
# Exibir chave pública
Get-Content "$env:USERPROFILE\.ssh\id_rsa.pub"

# Copiar manualmente para a VPS em /root/.ssh/authorized_keys
```

Ou via SSH (se já tiver acesso):
```powershell
type $env:USERPROFILE\.ssh\id_rsa.pub | ssh root@IP_DA_VPS "cat >> ~/.ssh/authorized_keys"
```

### 3. Testar conexão:

```powershell
ssh -o BatchMode=yes root@46.202.150.64 "echo OK"
```

---

## Verificação e Troubleshooting

### Verificar processos SSH rodando:

```powershell
Get-Process ssh
```

### Ver log do serviço:

```powershell
Get-Content "C:\ProgramData\SSHTunnels\tunnel-service.log" -Tail 20
```

### Testar túneis na VPS:

```bash
# Na VPS, testar porta 3003 (Intersolid)
curl -s http://127.0.0.1:3003/

# Testar porta 8080 (Zanthus)
curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:8080/
```

### Matar processos SSH (se necessário):

```powershell
Get-Process ssh | Stop-Process -Force
```

### Reiniciar o serviço manualmente:

```powershell
# Parar processos existentes
Get-Process ssh -ErrorAction SilentlyContinue | Stop-Process -Force

# Iniciar serviço novamente
wscript.exe "C:\ProgramData\SSHTunnels\start-tunnel-service.vbs"
```

### Ver logs de erro do SSH:

```powershell
# Executar SSH manualmente para ver erros
ssh -v -R 3003:10.6.1.102:3003 root@46.202.150.64 -N
```

---

## Configuração por Cliente

### VPS 46 - Tradição (46.202.150.64)

| Serviço | IP Local | Porta Local | Porta VPS |
|---------|----------|-------------|-----------|
| Intersolid ERP | 10.6.1.102 | 3003 | 3003 |
| Zanthus PDV | 10.6.1.101 | 80 | 8080 |

### VPS 145 - Outros clientes (145.223.92.152)

Configurar conforme necessidade do cliente.

---

## Resumo dos Comandos - Instalação Rápida

```cmd
# 1. Criar pasta
mkdir C:\ProgramData\SSHTunnels

# 2. Criar os arquivos (tunnel-service.ps1 e start-tunnel-service.vbs)
# (copiar conteúdo dos scripts acima)

# 3. Criar tarefa agendada
schtasks /create /tn "SSH-Tunnel-VPS46" /tr "wscript.exe \"C:\ProgramData\SSHTunnels\start-tunnel-service.vbs\"" /sc onstart /delay 0001:00 /rl highest /f

# 4. Iniciar o serviço
wscript.exe "C:\ProgramData\SSHTunnels\start-tunnel-service.vbs"

# 5. Verificar se está funcionando
powershell Get-Process ssh
powershell Get-Content "C:\ProgramData\SSHTunnels\tunnel-service.log" -Tail 10
```

---

## Notas Importantes

1. **Delay de 1 minuto**: Necessário para garantir que a rede esteja disponível após o boot.

2. **Script VBS**: Usado para executar PowerShell de forma 100% invisível (sem janelas).

3. **Reconexão automática**: O script `tunnel-service.ps1` monitora os túneis a cada 30 segundos e reconecta automaticamente se caírem.

4. **ServerAliveInterval=30**: Envia ping a cada 30 segundos para manter conexão ativa.

5. **ExitOnForwardFailure=yes**: SSH encerra se não conseguir criar o túnel (permite que o script detecte e reconecte).

6. **Log automático**: O serviço grava log em `tunnel-service.log` e limpa automaticamente quando passa de 1MB.

7. **Múltiplos túneis**: Cada túnel é um processo SSH separado, monitorado independentemente.

---

## Scripts Alternativos (Sem Reconexão)

Se preferir uma versão mais simples sem reconexão automática:

### start-tunnels.ps1
```powershell
Start-Process ssh -ArgumentList '-R 3003:10.6.1.102:3003 root@46.202.150.64 -N -o ServerAliveInterval=60' -WindowStyle Hidden
Start-Process ssh -ArgumentList '-R 8080:10.6.1.101:80 root@46.202.150.64 -N -o ServerAliveInterval=60' -WindowStyle Hidden
```

### start-tunnels-hidden.vbs
```vbs
Set WshShell = CreateObject("WScript.Shell")
WshShell.Run "powershell.exe -WindowStyle Hidden -ExecutionPolicy Bypass -File ""C:\ProgramData\SSHTunnels\start-tunnels.ps1""", 0, False
```

**Nota**: Estes scripts NÃO reconectam automaticamente se a conexão cair.

---

*Documentação criada em: 20/01/2026*
*Última atualização: 20/01/2026*
*Autor: Claude Code*
