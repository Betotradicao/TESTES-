# Cliente RP INFO — Como Configurar/Diagnosticar o Túnel SSH

> Guia específico para clientes que usam **ERP RP INFO** (PostgreSQL).
> Cobre: descobrir as configurações reais do banco no PC do cliente, gerar o túnel correto e diagnosticar quando para de funcionar.

---

## 📋 Visão geral

Clientes RP INFO rodam **PostgreSQL local** na rede interna deles. Diferente do Tradição (Oracle), aqui o banco está em uma máquina da rede do cliente (geralmente `192.168.X.10` ou similar) e usa a **porta padrão `5432`** do PostgreSQL.

**Cliente conhecido**: Nunes (`192.168.102.10:5432`).

---

## 🔍 Como descobrir as configurações reais do banco

**Não confie em config antiga** — os clientes podem mudar IPs/portas sem avisar. Antes de criar/atualizar o túnel, valide.

### Passo 1 — Identificar o IP do servidor do banco

No PC do cliente (que vai hospedar o túnel), com o sistema RP INFO **aberto e funcionando**, abre PowerShell e roda:

```powershell
# Lista todas conexões TCP que parecem ser de banco
Get-NetTCPConnection -State Established | Where-Object {
    $_.RemotePort -in @(1433, 1521, 3306, 5432, 5433, 10835)
} | Select-Object LocalAddress, LocalPort, RemoteAddress, RemotePort, State, @{n='Process';e={(Get-Process -Id $_.OwningProcess -ErrorAction SilentlyContinue).ProcessName}} | Format-Table -AutoSize
```

Vai aparecer algo como:
```
LocalAddress  LocalPort RemoteAddress   RemotePort  Process
192.168.103.8     60365 192.168.102.10        5432  ERP
192.168.103.8     49805 192.168.102.10        5432  NFCe
192.168.103.8     49758 192.168.102.10        5432  CredRP
```

**Os processos típicos do RP INFO:**
- `ERP` (programa principal)
- `NFCe`, `CredRP`, `IntegradorRP`, `IntegradorScanntech_RP`
- `ServerUN`, `TransmissoresSefaz`
- `flexmobile`, `ZServerMatriz`

A coluna `RemoteAddress` é o **IP do servidor do banco**, e `RemotePort` é a **porta real** do PostgreSQL (geralmente 5432).

### Passo 2 — Confirmar a porta principal

```powershell
Get-NetTCPConnection -State Established | Where-Object { $_.RemoteAddress -eq '192.168.102.10' } | Group-Object RemotePort | Select-Object Name, Count | Sort-Object Count -Descending
```

Espera ver algo como:
```
Name Count
---- -----
5432    25
```

A porta com mais conexões é a do banco. **No Nunes é `5432`**, mas em outros clientes pode ser diferente (sempre verificar).

### Passo 3 — Identificar o IP local do PC

```powershell
ipconfig | Select-String -Pattern "IPv4"
```

Anota o IP — vai precisar caso o `pg_hba.conf` do banco RP INFO tenha que ser liberado pra esse IP.

---

## 🚀 Como criar/recriar o túnel SSH

### 1. Acessar o auto-instalador

Acessa a interface web do cliente (ex: `https://nunes.prevencaonoradar.com.br`) → **Configurações de Rede → Instalador Scanner**.

### 2. Preencher os dados

**Nome do Cliente:** nome do cliente (ex: `Nunes`)
**IP da VPS:** `46.202.150.64`

**Túnel Banco RP INFO:**

| Campo | Valor |
|---|---|
| Serviço | `Banco RP INFO` |
| IP na Rede do Cliente | IP descoberto no Passo 1 (ex: `192.168.102.10`) |
| **Porta Local** | **`5432`** (porta REAL descoberta no Passo 2) |
| Porta na VPS | `10835` (porta livre na VPS — pode ser qualquer valor alto livre) |

> ⚠️ **Atenção comum**: a porta na VPS pode ser DIFERENTE da porta local. Não copia uma na outra. A porta local é onde o banco escuta no cliente. A porta na VPS é só uma porta livre que vamos abrir pro nosso backend conectar via Docker.

**Túneis adicionais** (se o cliente tem DVR):
- DVR HTTP: IP DVR / porta `80` / porta na VPS livre (ex: `38100`)
- DVR RTSP: IP DVR / porta `554` / porta na VPS livre (ex: `38101`)

### 3. Baixar o .bat e rodar como Administrador

Roda o `.bat` no PC do cliente como Administrador. O instalador vai:

1. Limpar instalação anterior
2. Criar pasta `C:\ProgramData\SSHTunnels-<NOME>\`
3. Gerar chave SSH + script PS1 + iniciador VBS
4. **Testar portas SSH na VPS: 22 → 2222 → 443** (usa a primeira que funcionar)
5. Criar tarefa agendada que sobe junto com Windows
6. Iniciar o serviço

### 4. Confirmar do nosso lado

Após instalar, confirma da VPS que as portas chegaram:

```bash
ssh vps2-hostinger "ss -ltn | grep -E ':10835|:38100|:38101'"
```

Esperado: ver as 3 portas listening em `0.0.0.0:XXXX`.

---

## 🚨 Diagnóstico — quando o túnel para de funcionar

### Sintoma: Tunel ativo (ssh.exe rodando) mas banco "Connection terminated unexpectedly"

**Provável causa**: a porta cadastrada na config está errada (usando `10835` quando o banco real está na `5432` ou outra). Aconteceu com Nunes em 06/05/2026.

**Solução**: rodar Passo 1 e 2 acima pra descobrir a porta real, depois recriar o túnel via auto-instalador.

### Sintoma: ssh.exe rodando mas porta não escuta na VPS

**Provável causa**: porta SSH 22 bloqueada na rede do cliente (firewall do provedor). Tunnel SSH cai silenciosamente.

**Solução**: usar porta 2222 (já habilitada na nossa VPS desde 06/05/2026). O auto-instalador testa e usa automaticamente.

Confirmação manual:
```powershell
Test-NetConnection -ComputerName 46.202.150.64 -Port 22 -InformationLevel Quiet
Test-NetConnection -ComputerName 46.202.150.64 -Port 2222 -InformationLevel Quiet
```

Se 22=False e 2222=True → ISP bloqueia 22. Já fica suportado pelo instalador.

### Sintoma: PC do cliente não conecta direto no banco (Test-NetConnection False)

Mesmo o cliente usando o RP INFO normalmente, se rodar `Test-NetConnection -ComputerName <IP_BANCO> -Port 5432` der False:

**Provável**: a porta cadastrada está errada na nossa config (caso Nunes 06/05/2026).

**Resolver**: rodar Get-NetTCPConnection pra descobrir a porta REAL (Passo 2).

### Sintoma: PC mudou de IP e banco rejeita

`pg_hba.conf` do servidor RP INFO tem regra restritiva por IP. Quando o PC pega IP diferente (DHCP), o banco rejeita.

**Resolver**:
1. Pedir TI do cliente liberar a sub-rede inteira no `pg_hba.conf`:
   ```
   host  erp  bi  192.168.103.0/24  md5
   ```
2. Ou pedir DHCP reservation (IP fixo pro PC)

> ⚠️ **Não mexer na rede do cliente sem autorização**. Sempre passar pelo TI deles.

---

## 📌 Configurações usadas — Cliente Nunes (referência)

| Item | Valor |
|---|---|
| IP do banco RP INFO | `192.168.102.10` |
| Porta REAL do banco | `5432` (PostgreSQL padrão) |
| Porta na VPS (tunel) | `10835` |
| Database | `erp` |
| Usuário | `bi` |
| Senha | `Nunes@2026` |
| IP do DVR | `192.168.102.169` |
| Porta HTTP DVR (VPS) | `38100` |
| Porta RTSP DVR (VPS) | `38101` |
| **Porta SSH usada** | **`2222`** (porta 22 bloqueada pelo provedor) |
| Pasta do tunel | `C:\ProgramData\SSHTunnels-NUNES\` |
| IP local do PC do tunel | `192.168.103.8` (rede 103, banco está na 102) |

---

## 🛠️ Comandos úteis pra debug

### Na VPS — confirmar portas que estão escutando

```bash
ssh vps2-hostinger "ss -ltn | grep -E ':10835|:38100|:38101'"
```

### Na VPS — testar TCP direto pelo Docker gateway (simula backend)

```bash
ssh vps2-hostinger 'docker run --rm --network host -e PGPASSWORD=<senha> postgres:15 psql "host=127.0.0.1 port=10835 user=bi dbname=erp" -c "SELECT 1;"'
```

### Na VPS — ver conexões SSH ativas dos clientes

```bash
ssh vps2-hostinger 'ss -tn state established sport = :22 sport = :2222 | head -20'
```

### No PC do cliente — verificar tunnel ativo

```powershell
Get-Process ssh -ErrorAction SilentlyContinue | Measure-Object | Select-Object Count
Get-Content "C:\ProgramData\SSHTunnels-<NOME>\tunnel-service.log" -Tail 20
```

### No PC do cliente — descobrir IP/porta real do banco

```powershell
Get-NetTCPConnection -State Established | Where-Object { $_.RemotePort -in @(5432,1521,3306,1433) } | Group-Object RemoteAddress, RemotePort | Select-Object Name, Count
```

---

## 🎯 Resumo executivo (cheat sheet)

1. **Descobrir** IP/porta real do banco no PC do cliente: `Get-NetTCPConnection`
2. **Gerar** túnel via auto-instalador com a porta REAL (não a do nosso config se estiver desatualizada)
3. **Confirmar** porta escuta na VPS: `ss -ltn`
4. **Confirmar** TCP passa pelo tunel: `psql via docker`
5. **Atualizar** `database_connections` do nosso lado se a porta na VPS mudou

Se "Connection terminated unexpectedly" → a porta está errada. Refaz o passo 1.
Se ssh.exe não levanta → porta 22 bloqueada, usa 2222.
Se psql funciona local mas não pelo tunnel → pg_hba do servidor RP INFO restringindo IPs (TI do cliente).

---

## 📅 Histórico de incidentes

### 2026-05-06 — Nunes: tunnel quebrou após mudança de IP do PC

**Sintoma**: tunnel não conectava na VPS. Após resolver porta SSH (22 bloqueada → usar 2222), conexão SSH OK mas banco fechava com `Connection terminated unexpectedly`.

**Causas**:
1. Porta SSH 22 bloqueada na rede do cliente (provedor) — resolvido habilitando 2222 na VPS
2. **Porta do banco cadastrada errada** (`10835` em vez de `5432`) — config antiga incorreta

**Solução**:
1. Habilitada porta 2222 na VPS via systemd `ssh.socket.d/override.conf` (com bind IPv4 e IPv6)
2. Auto-instalador atualizado pra testar `22 → 2222 → 443`
3. Túnel recriado com porta local correta (`5432`)

**Lição**: não confiar na config antiga — **sempre validar a porta real** com `Get-NetTCPConnection` antes de gerar túnel novo.
