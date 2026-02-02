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

---

# TÚNEL SSH - VPS + ORACLE

Documentação de como configurar o túnel SSH reverso para conectar a VPS ao banco Oracle 11g da rede local.

---

## Visão Geral - Oracle

O sistema Prevenção no Radar precisa acessar o banco Oracle 11g (Intersolid) que está na rede local do cliente. Como a VPS está na nuvem, usamos um túnel SSH reverso para permitir que os containers Docker na VPS acessem o Oracle através da máquina Windows.

```
[Rede Local]                         [VPS Linux - Docker]

Oracle 11g (10.6.1.100:1521) <--+
                                |
Windows Server (túnel) ---------+--> SSH Tunnel --> 172.20.0.1:1521 --> Container Backend
                                                          |
                                                    (Docker Gateway)
```

---

## Componentes do Oracle

### 1. Servidor Oracle (Rede Local)
- **IP**: 10.6.1.100
- **Porta**: 1521
- **Service Name**: orcl.intersoul
- **Usuário**: POWERBI
- **Versão**: Oracle 11g

### 2. Container Docker (Backend)
- **Nome**: prevencao-tradicao-backend
- **Oracle Client**: Instant Client 23.4 (em /opt/oracle/instantclient_23_4)
- **Conexão Oracle**: 172.20.0.1:1521/orcl.intersoul

---

## Configuração do Túnel Oracle

### Adicionar ao Script `tunnel-service.ps1`

Adicionar as variáveis:
```powershell
$ORACLE_IP = "10.6.1.100"
$ORACLE_PORT = "1521"
```

Adicionar o terceiro túnel no loop:
```powershell
$tunnel3 = $null

# No loop while, adicionar:
if (-not (Test-TunnelConnection $tunnel3?.Id)) {
    if ($tunnel3 -ne $null) {
        Write-Log "Tunnel Oracle caiu! Reconectando..."
    }
    $tunnel3 = Start-Tunnel -LocalIP $ORACLE_IP -LocalPort $ORACLE_PORT -RemotePort "1521" -Name "Oracle"
    Start-Sleep -Seconds 2
}
```

O comando SSH executado é:
```bash
ssh -R 1521:10.6.1.100:1521 root@46.202.150.64 -N -o ServerAliveInterval=30 -o ServerAliveCountMax=3 -o StrictHostKeyChecking=no -o BatchMode=yes -o ExitOnForwardFailure=yes
```

---

## Configuração da VPS para Oracle

### 1. GatewayPorts no SSH

Para que o túnel escute em todas as interfaces (não só 127.0.0.1), o arquivo `/etc/ssh/sshd_config` deve ter:

```
GatewayPorts yes
```

Isso permite que o Docker (172.20.0.0/16) acesse o túnel.

### 2. Regras de Firewall (UFW - OBRIGATÓRIO)

**IMPORTANTE**: O firewall da VPS (UFW) bloqueia conexões por padrão. É necessário adicionar regras para permitir que os containers Docker acessem TODAS as portas dos túneis:

```bash
# Adicionar regras UFW para TODOS os túneis (OBRIGATÓRIO!)
ufw allow from 172.20.0.0/16 to any port 1521 proto tcp comment 'Oracle Tunnel - Docker'
ufw allow from 172.20.0.0/16 to any port 8080 proto tcp comment 'Zanthus Tunnel - Docker'
ufw allow from 172.20.0.0/16 to any port 3003 proto tcp comment 'Intersolid Tunnel - Docker'

# Verificar se as regras foram adicionadas
ufw status | grep -E '1521|8080|3003'
```

**Tabela de regras necessárias:**

| Porta | Serviço | Comando UFW |
|-------|---------|-------------|
| 1521 | Oracle | `ufw allow from 172.20.0.0/16 to any port 1521 proto tcp` |
| 8080 | Zanthus | `ufw allow from 172.20.0.0/16 to any port 8080 proto tcp` |
| 3003 | Intersolid | `ufw allow from 172.20.0.0/16 to any port 3003 proto tcp` |

**Explicação da regra:**
- `from 172.20.0.0/16` - Origem: rede Docker
- `to any port XXXX` - Destino: porta do túnel
- `proto tcp` - Protocolo TCP
- `comment` - Comentário para identificação

### 2.1 Alternativa: iptables (não recomendado)

Se preferir usar iptables diretamente (não persiste após reboot sem configuração adicional):

```bash
# Adicionar regra iptables
iptables -I INPUT -p tcp --dport 1521 -s 172.20.0.0/16 -j ACCEPT

# Salvar regras (persistir após reboot)
iptables-save > /etc/iptables/rules.v4
```

### 2.2 Diagnóstico: Túneis não conectam após deploy

**Problema (02/02/2026):** Após deploy, Oracle parou de conectar com erro `ORA-12170: TNS:Connect timeout` e o cron de verificação de vendas parou de funcionar com erro `ECONNREFUSED` na porta 8080.

**Causa:** As regras UFW para as portas dos túneis não existiam. Os túneis SSH estavam funcionando (portas escutando via sshd), mas o firewall bloqueava conexões dos containers Docker.

**Diagnóstico:**
```bash
# 1. Verificar se túneis estão ativos (deve mostrar sshd escutando nas portas)
ss -tlnp | grep -E '1521|8080|3003'

# 2. Verificar regras UFW (deve mostrar regras para todas as portas)
ufw status | grep -E '1521|8080|3003'

# 3. Testar TCP do container backend (deve retornar "TCP OK")
docker exec prevencao-tradicao-backend node -e "
const net = require('net');
const client = new net.Socket();
client.setTimeout(5000);
client.connect(1521, '172.20.0.1', () => { console.log('TCP 1521 OK'); client.destroy(); });
client.on('error', (e) => console.log('ERRO:', e.message));
client.on('timeout', () => { console.log('TIMEOUT'); client.destroy(); });
"

# 4. Testar TCP do container cron (deve retornar "TCP OK")
docker exec prevencao-tradicao-cron node -e "
const net = require('net');
const client = new net.Socket();
client.setTimeout(5000);
client.connect(8080, '172.20.0.1', () => { console.log('TCP 8080 OK'); client.destroy(); });
client.on('error', (e) => console.log('ERRO:', e.message));
client.on('timeout', () => { console.log('TIMEOUT'); client.destroy(); });
"
```

**Solução:**
```bash
# Adicionar TODAS as regras UFW necessárias
ufw allow from 172.20.0.0/16 to any port 1521 proto tcp comment 'Oracle Tunnel - Docker'
ufw allow from 172.20.0.0/16 to any port 8080 proto tcp comment 'Zanthus Tunnel - Docker'
ufw allow from 172.20.0.0/16 to any port 3003 proto tcp comment 'Intersolid Tunnel - Docker'
```

**Containers que acessam os túneis:**
- **prevencao-tradicao-backend** - acessa Oracle (1521), Zanthus (8080), Intersolid (3003)
- **prevencao-tradicao-cron** - acessa Zanthus (8080) para buscar vendas a cada 2 minutos

---

## Configuração do Container Docker

### Oracle Instant Client 23.4

O Dockerfile do backend instala o Oracle Instant Client para conectar ao Oracle 11g em modo Thick:

```dockerfile
FROM node:18-slim

# Instalar dependências do sistema para Oracle Instant Client
RUN apt-get update && apt-get install -y --no-install-recommends \
    libaio1 \
    curl \
    unzip \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/* \
    && mkdir -p /opt/oracle \
    && cd /opt/oracle \
    && curl -o instantclient.zip https://download.oracle.com/otn_software/linux/instantclient/2340000/instantclient-basiclite-linux.x64-23.4.0.24.05.zip \
    && unzip instantclient.zip \
    && rm instantclient.zip \
    && echo /opt/oracle/instantclient_23_4 > /etc/ld.so.conf.d/oracle-instantclient.conf \
    && ldconfig

ENV LD_LIBRARY_PATH=/opt/oracle/instantclient_23_4:$LD_LIBRARY_PATH
ENV ORACLE_HOME=/opt/oracle/instantclient_23_4
```

**Por que node:18-slim e não Alpine?**
- Alpine usa musl libc, incompatível com Oracle Instant Client
- Debian-slim usa glibc, compatível com Oracle

### Configuração no Banco de Dados (PostgreSQL)

As credenciais do Oracle são armazenadas na tabela `configurations`:

| Chave | Valor |
|-------|-------|
| oracle_host | 172.20.0.1 |
| oracle_port | 1521 |
| oracle_service | orcl.intersoul |
| oracle_user | POWERBI |
| oracle_password | (senha) |

O `OracleService` carrega essas configurações automaticamente na inicialização.

---

## Fluxo de Conexão Oracle

1. **Windows** cria túnel SSH reverso para VPS
2. **VPS** escuta na porta 1521 (0.0.0.0:1521)
3. **Container Docker** conecta em 172.20.0.1:1521 (gateway do Docker)
4. **VPS** recebe conexão e encaminha pelo túnel SSH
5. **Windows** recebe e encaminha para 10.6.1.100:1521
6. **Oracle** processa a requisição e retorna

```
Container (172.20.x.x)
    ↓
Docker Gateway (172.20.0.1:1521)
    ↓
VPS Host (0.0.0.0:1521) [SSH Tunnel]
    ↓ (através da internet via SSH)
Windows (10.6.1.171)
    ↓
Oracle (10.6.1.100:1521)
```

---

## Verificação do Túnel Oracle

### 1. Verificar porta na VPS

```bash
ss -tlnp | grep 1521

# Deve mostrar:
# LISTEN 0 128 0.0.0.0:1521 0.0.0.0:* users:(("sshd",pid=XXXX,fd=5))
```

### 2. Testar conexão TCP do container

```bash
docker exec prevencao-tradicao-backend node -e "
const net = require('net');
const client = new net.Socket();
client.setTimeout(5000);
client.connect(1521, '172.20.0.1', () => {
  console.log('TCP OK');
  client.destroy();
});
client.on('error', (e) => console.log('ERRO:', e.message));
"
```

### 3. Testar conexão Oracle completa

```bash
docker exec prevencao-tradicao-backend node -e "
const oracledb = require('oracledb');
oracledb.initOracleClient({ libDir: '/opt/oracle/instantclient_23_4' });
oracledb.getConnection({
  user: 'POWERBI',
  password: 'SUA_SENHA',
  connectString: '172.20.0.1:1521/orcl.intersoul'
}).then(conn => {
  conn.execute('SELECT 1 FROM DUAL').then(r => {
    console.log('ORACLE OK:', r.rows);
    conn.close();
  });
}).catch(e => console.log('ERRO:', e.message));
"
```

### 4. Ver logs do backend

```bash
docker logs prevencao-tradicao-backend 2>&1 | grep -i oracle
```

**Logs esperados (sucesso):**
```
📦 Oracle config loaded from database: 172.20.0.1:1521/orcl.intersoul
✅ Oracle Thick Mode initialized with client: /opt/oracle/instantclient_23_4
✅ Oracle connection pool initialized
```

---

## Erros Comuns Oracle e Soluções

### ORA-12170: TNS:Connect timeout

**Causa**: Túnel não está funcionando ou firewall bloqueando.

**Solução**:
1. Verificar se túnel está ativo no Windows: `Get-Process ssh`
2. Verificar regra do iptables na VPS
3. Reiniciar serviço de túnel

### DPI-1047: Cannot locate Oracle Client library

**Causa**: Oracle Instant Client não instalado ou PATH incorreto.

**Solução**:
- No container: verificar se `/opt/oracle/instantclient_23_4` existe
- No Windows: adicionar `C:\oracle\instantclient_64\instantclient_23_4` ao PATH

### ORA-01017: invalid username/password

**Causa**: Credenciais incorretas.

**Solução**: Verificar configurações na tabela `configurations` do PostgreSQL.

### Connection refused

**Causa**: Porta 1521 não está escutando na VPS.

**Solução**:
1. Verificar se GatewayPorts está habilitado no sshd_config
2. Reiniciar sshd: `systemctl restart sshd`
3. Reiniciar túnel no Windows

---

## Tabela Completa de Túneis - VPS 46 (Tradição)

| Serviço | IP Local | Porta Local | Porta VPS | Firewall |
|---------|----------|-------------|-----------|----------|
| Intersolid ERP | 10.6.1.102 | 3003 | 3003 | Não necessário |
| Zanthus PDV | 10.6.1.101 | 80 | 8080 | Não necessário |
| **Oracle 11g** | **10.6.1.100** | **1521** | **1521** | **Regra iptables** |

---

## Diagrama de Rede Completo

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           REDE LOCAL (10.6.1.0/24)                       │
│                                                                          │
│   ┌─────────────────┐        ┌─────────────────┐                        │
│   │   Oracle 11g    │        │  Windows Server │                        │
│   │  10.6.1.100     │◄──────►│   10.6.1.171    │                        │
│   │     :1521       │        │  (SSH Tunnel)   │                        │
│   └─────────────────┘        └────────┬────────┘                        │
│                                       │                                  │
│   ┌─────────────────┐                 │                                  │
│   │  Intersolid     │◄────────────────┤                                  │
│   │  10.6.1.102     │                 │                                  │
│   │     :3003       │                 │                                  │
│   └─────────────────┘                 │                                  │
│                                       │                                  │
│   ┌─────────────────┐                 │                                  │
│   │   Zanthus       │◄────────────────┤                                  │
│   │  10.6.1.101     │                 │                                  │
│   │     :80         │                 │                                  │
│   └─────────────────┘                 │                                  │
│                                       │                                  │
└───────────────────────────────────────┼──────────────────────────────────┘
                                        │
                                        │ SSH Tunnels (porta 22)
                                        │ -R 3003:10.6.1.102:3003
                                        │ -R 8080:10.6.1.101:80
                                        │ -R 1521:10.6.1.100:1521
                                        ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                           VPS (46.202.150.64)                            │
│                                                                          │
│   ┌─────────────────────────────────────────────────────────────────┐   │
│   │                     Docker Network (172.20.0.0/16)               │   │
│   │                                                                  │   │
│   │   ┌─────────────────┐      ┌─────────────────┐                  │   │
│   │   │    Backend      │      │    Frontend     │                  │   │
│   │   │  172.20.0.x     │      │   172.20.0.x    │                  │   │
│   │   │                 │      │                 │                  │   │
│   │   │ Oracle Client   │      │                 │                  │   │
│   │   │ 23.4 (Thick)    │      │                 │                  │   │
│   │   └────────┬────────┘      └─────────────────┘                  │   │
│   │            │                                                     │   │
│   │            │ Conecta em 172.20.0.1:1521                         │   │
│   │            ▼                                                     │   │
│   │   ┌─────────────────┐                                           │   │
│   │   │  Docker Gateway │                                           │   │
│   │   │   172.20.0.1    │                                           │   │
│   │   └────────┬────────┘                                           │   │
│   │            │                                                     │   │
│   └────────────┼─────────────────────────────────────────────────────┘   │
│                │                                                          │
│                ▼                                                          │
│   ┌─────────────────┐                                                    │
│   │   SSH Tunnels   │ ◄── Escuta em 0.0.0.0:3003, 8080, 1521            │
│   │   (sshd)        │     GatewayPorts yes                               │
│   └─────────────────┘     iptables: ACCEPT Docker -> 1521               │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

---

---

# CONFIGURAÇÃO ORACLE - REDE LOCAL (Desenvolvimento)

Quando você roda o backend **localmente** (na rede do cliente), a conexão Oracle deve ir **diretamente** para o servidor Oracle, sem passar pelo túnel SSH.

---

## O Problema

O backend local conecta ao PostgreSQL da VPS (46.202.150.64:6303) para carregar configurações. No banco PostgreSQL, a configuração do Oracle aponta para:

```
oracle_host = 172.20.0.1  (Gateway Docker da VPS)
```

Isso funciona na VPS (porque o túnel SSH expõe o Oracle em 172.20.0.1:1521), mas **NÃO funciona localmente** porque 172.20.0.1 não existe na rede local.

---

## A Solução

Adicionar variáveis de ambiente no arquivo `.env` do backend local. O `OracleService` prioriza variáveis de ambiente sobre a configuração do banco de dados.

### Editar `packages/backend/.env`

Adicionar estas linhas:

```env
# ===================================
# ORACLE (Conexão direta na rede local)
# ===================================
ORACLE_USER=POWERBI
ORACLE_PASSWORD=OdRz6J4LY6Y6
ORACLE_CONNECT_STRING=10.6.1.100:1521/orcl.intersoul
```

**IMPORTANTE**: A variável `ORACLE_CONNECT_STRING` é a chave. Se ela existir, o OracleService usa as variáveis de ambiente em vez de carregar do banco de dados.

---

## Prioridade de Configuração do OracleService

O arquivo `oracle.service.ts` carrega configurações nesta ordem:

1. **Variáveis de ambiente** (se `ORACLE_CONNECT_STRING` existir)
   - Usado para desenvolvimento local
   - Conecta direto: `10.6.1.100:1521/orcl.intersoul`

2. **Banco de dados PostgreSQL** (tabela `configurations`)
   - Usado na VPS (produção)
   - Conecta via túnel: `172.20.0.1:1521/orcl.intersoul`

3. **Valores padrão** (fallback)
   - Mesmo que opção 1

---

## Requisitos para Rede Local

### 1. Oracle Instant Client no PATH

O Oracle Instant Client 23.4 (64-bit) deve estar no PATH do Windows:

```
C:\oracle\instantclient_64\instantclient_23_4
```

Para adicionar ao PATH via PowerShell (como administrador):
```powershell
[Environment]::SetEnvironmentVariable("PATH", "C:\oracle\instantclient_64\instantclient_23_4;" + [Environment]::GetEnvironmentVariable("PATH", "Machine"), "Machine")
```

**IMPORTANTE**: Após alterar o PATH, é necessário **reiniciar o terminal/CMD** para o backend herdar a nova variável.

### 2. Arquivo .env Configurado

O arquivo `packages/backend/.env` deve ter as variáveis ORACLE_* conforme descrito acima.

### 3. Reiniciar o Backend

Após alterar o `.env`, reiniciar o backend para carregar as novas variáveis:

```bash
# Parar o backend (Ctrl+C ou)
taskkill /F /IM node.exe

# Iniciar novamente
cd packages/backend
npm run dev
```

---

## Teste de Conexão Oracle Local

Usar o script de teste para verificar se o Oracle está funcionando:

```bash
cd packages/backend
node test-oracle.js
```

**Saída esperada:**
```
1. Inicializando Oracle Instant Client 23.4...
   Cliente inicializado!
2. Conectando ao Oracle 10.6.1.100:1521...
   Conexao estabelecida!
3. Executando query SELECT 1 FROM DUAL...
   Resultado: [ [ 1 ] ]
4. Conexao fechada com sucesso!

=== ORACLE FUNCIONANDO ===
```

---

## Logs do Backend

Quando o backend inicia, ele mostra qual configuração Oracle está usando:

**Usando variáveis de ambiente (local):**
```
📦 Oracle config loaded from environment variables
```

**Usando banco de dados (VPS):**
```
📦 Oracle config loaded from database: 172.20.0.1:1521/orcl.intersoul
```

---

## Resumo: Local vs VPS

| Ambiente | Configuração | Oracle Host | Caminho |
|----------|--------------|-------------|---------|
| **Local** | Variáveis `.env` | 10.6.1.100:1521 | Direto na rede |
| **VPS** | Banco PostgreSQL | 172.20.0.1:1521 | Via túnel SSH |

---

*Documentação criada em: 20/01/2026*
*Última atualização: 02/02/2026 - Adicionado regras UFW para todas as portas dos túneis (1521, 8080, 3003)*
*Autor: Claude Code*
