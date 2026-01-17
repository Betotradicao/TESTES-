# RHID - Documentacao de Acesso ao Relogio de Ponto Control iD

## Informacoes do Equipamento

| Campo | Valor |
|-------|-------|
| **Modelo** | Control iD REP iDClass |
| **IP** | 10.6.1.209 |
| **Porta** | 443 (HTTPS) |
| **Empresa** | TRADICAO SUPERMERCADO LTDA |
| **Numero de Serie** | 00014003750276694 |
| **Total de Funcionarios** | 40 |

### Outros Relogios na Rede

| IP | Nome | Observacao |
|----|------|------------|
| 10.6.1.209 | TRADICAO SUPERMERCADO LTDA | Principal - 40 usuarios |
| 10.6.1.208 | TRADICAO ADM | Administrativo |
| 192.168.0.20 | Creusa | Rede diferente - nao acessivel |

---

## Autenticacao

### Endpoint de Login

```
POST https://10.6.1.209:443/login.fcgi
Content-Type: application/json
```

**Body:**
```json
{
  "login": "admin",
  "password": "admin"
}
```

**Resposta de Sucesso:**
```json
{
  "session": "TOKEN_DE_SESSAO_AQUI"
}
```

**Exemplo com cURL:**
```bash
curl -sk -X POST "https://10.6.1.209:443/login.fcgi" \
  -H "Content-Type: application/json" \
  -d '{"login":"admin","password":"admin"}'
```

**IMPORTANTE:** O token de sessao expira apos alguns minutos de inatividade. Sempre faca login antes de cada operacao.

---

## Endpoints Disponiveis

### 1. Lista de Funcionarios (load_users.fcgi)

Retorna todos os funcionarios cadastrados no relogio.

```
POST https://10.6.1.209:443/load_users.fcgi?session=TOKEN
Content-Type: application/json
```

**Body:**
```json
{
  "limit": 100,
  "offset": 0
}
```

**Resposta:**
```json
{
  "users": [
    {
      "id": 1,
      "name": "NOME DO FUNCIONARIO",
      "registration": "MATRICULA",
      "pis": "12345678901"
    }
  ]
}
```

**Exemplo com cURL:**
```bash
# Primeiro, fazer login
SESSION=$(curl -sk -X POST "https://10.6.1.209:443/login.fcgi" \
  -H "Content-Type: application/json" \
  -d '{"login":"admin","password":"admin"}' | grep -o '"session":"[^"]*"' | cut -d'"' -f4)

# Depois, buscar usuarios
curl -sk -X POST "https://10.6.1.209:443/load_users.fcgi?session=$SESSION" \
  -H "Content-Type: application/json" \
  -d '{"limit":100,"offset":0}'
```

**Campos Retornados:**

| Campo | Tipo | Descricao |
|-------|------|-----------|
| id | int | ID interno do usuario no relogio |
| name | string | Nome completo do funcionario |
| registration | string | Numero de matricula |
| pis | string | Numero do PIS (11 digitos) |

---

### 2. Marcacoes Brutas - AFD (get_afd.fcgi)

Retorna as marcacoes de ponto no formato AFD (Arquivo Fonte de Dados) padrao MTE.

```
POST https://10.6.1.209:443/get_afd.fcgi?session=TOKEN
Content-Type: application/json
```

**Body:**
```json
{
  "initial_date": {
    "day": 1,
    "month": 1,
    "year": 2026
  },
  "final_date": {
    "day": 15,
    "month": 1,
    "year": 2026
  }
}
```

**Resposta:**
Texto no formato AFD (nao e JSON). Cada linha representa uma marcacao.

**Exemplo com cURL:**
```bash
# Primeiro, fazer login
SESSION=$(curl -sk -X POST "https://10.6.1.209:443/login.fcgi" \
  -H "Content-Type: application/json" \
  -d '{"login":"admin","password":"admin"}' | grep -o '"session":"[^"]*"' | cut -d'"' -f4)

# Buscar marcacoes do mes
curl -sk -X POST "https://10.6.1.209:443/get_afd.fcgi?session=$SESSION" \
  -H "Content-Type: application/json" \
  -d '{"initial_date":{"day":1,"month":1,"year":2026},"final_date":{"day":15,"month":1,"year":2026}}'
```

---

## Formato AFD (Arquivo Fonte de Dados)

O AFD e um formato padronizado pelo MTE (Ministerio do Trabalho) para registros de ponto.

### Estrutura de Cada Linha

```
000089299 3 13012026 0640 021067086589 332e
|_______| | |______| |__| |__________| |__|
   NSR   Tp   Data  Hora     PIS      Check
```

| Posicao | Tamanho | Campo | Descricao |
|---------|---------|-------|-----------|
| 1-9 | 9 | NSR | Numero Sequencial do Registro |
| 10 | 1 | Tipo | 3 = Marcacao de ponto |
| 11-18 | 8 | Data | DDMMAAAA |
| 19-22 | 4 | Hora | HHMM |
| 23-34 | 12 | PIS | Numero do PIS do funcionario |
| 35-38 | 4 | Checksum | Verificacao de integridade |

### Exemplo de Parsing

**Linha AFD:**
```
0000893153130120261027E000000545046ANDRE RENAN DOS SANTOS DA SILVA
```

**Decodificado:**
- NSR: 000089315
- Tipo: 5 (inclusao de funcionario)
- Data: 13/01/2026
- Hora: 10:27
- PIS: 000000545046
- Nome: ANDRE RENAN DOS SANTOS DA SILVA

**Linha de Marcacao:**
```
000089299313012026064002106708658933
```

**Decodificado:**
- NSR: 000089299
- Tipo: 3 (marcacao de ponto)
- Data: 13/01/2026
- Hora: 06:40
- PIS: 021067086589

---

## Script Completo para Extrair Marcacoes

### PowerShell (Windows)

```powershell
# Configuracoes
$IP = "10.6.1.209"
$USER = "admin"
$PASS = "admin"

# Ignorar certificado SSL
[System.Net.ServicePointManager]::ServerCertificateValidationCallback = {$true}

# Login
$loginBody = @{login=$USER; password=$PASS} | ConvertTo-Json
$session = (Invoke-RestMethod -Uri "https://${IP}:443/login.fcgi" -Method POST -Body $loginBody -ContentType "application/json").session

Write-Host "Session: $session"

# Buscar usuarios
$usersBody = @{limit=100; offset=0} | ConvertTo-Json
$users = Invoke-RestMethod -Uri "https://${IP}:443/load_users.fcgi?session=$session" -Method POST -Body $usersBody -ContentType "application/json"

Write-Host "Total de usuarios: $($users.users.Count)"

# Buscar AFD (marcacoes)
$hoje = Get-Date
$afdBody = @{
    initial_date = @{day=1; month=$hoje.Month; year=$hoje.Year}
    final_date = @{day=$hoje.Day; month=$hoje.Month; year=$hoje.Year}
} | ConvertTo-Json

$afd = Invoke-RestMethod -Uri "https://${IP}:443/get_afd.fcgi?session=$session" -Method POST -Body $afdBody -ContentType "application/json"

# Salvar AFD em arquivo
$afd | Out-File -FilePath "marcacoes_$(Get-Date -Format 'yyyy-MM-dd').txt"

Write-Host "Marcacoes salvas!"
```

### Bash (Linux/Mac)

```bash
#!/bin/bash

IP="10.6.1.209"
USER="admin"
PASS="admin"

# Login
SESSION=$(curl -sk -X POST "https://$IP:443/login.fcgi" \
  -H "Content-Type: application/json" \
  -d "{\"login\":\"$USER\",\"password\":\"$PASS\"}" | \
  grep -o '"session":"[^"]*"' | cut -d'"' -f4)

echo "Session: $SESSION"

# Buscar usuarios
echo "=== FUNCIONARIOS ==="
curl -sk -X POST "https://$IP:443/load_users.fcgi?session=$SESSION" \
  -H "Content-Type: application/json" \
  -d '{"limit":100,"offset":0}'

echo ""
echo ""

# Buscar AFD do mes atual
MES=$(date +%m)
ANO=$(date +%Y)
DIA=$(date +%d)

echo "=== MARCACOES (01/$MES/$ANO ate $DIA/$MES/$ANO) ==="
curl -sk -X POST "https://$IP:443/get_afd.fcgi?session=$SESSION" \
  -H "Content-Type: application/json" \
  -d "{\"initial_date\":{\"day\":1,\"month\":$MES,\"year\":$ANO},\"final_date\":{\"day\":$DIA,\"month\":$MES,\"year\":$ANO}}"
```

---

## Outros Endpoints Uteis

### Informacoes do Equipamento (get_info.fcgi)

```bash
curl -sk -X POST "https://10.6.1.209:443/get_info.fcgi?session=$SESSION" \
  -H "Content-Type: application/json" -d '{}'
```

**Resposta:**
```json
{
  "num_serie": "00014003750276694",
  "user_count": 40,
  "administrator_count": 0,
  "template_count": 84,
  "password_count": 7,
  "bars_count": 6,
  "rfid_count": 0,
  "uptime": 26675,
  "low_on_paper": true,
  "total_printed": 54139,
  "cuts": 89709
}
```

### Informacoes do Sistema (get_system_information.fcgi)

```bash
curl -sk -X POST "https://10.6.1.209:443/get_system_information.fcgi?session=$SESSION" \
  -H "Content-Type: application/json" -d '{}'
```

**Resposta:**
```json
{
  "user_count": 40,
  "template_count": 84,
  "uptime": 26675,
  "ticks": 310,
  "cuts": 89709,
  "coil_paper": 0,
  "total_paper": 54138,
  "paper_ok": true,
  "low_paper": null,
  "memory": 16,
  "used_mrp": 1,
  "last_nsr": 89630
}
```

---

## Lista de Todos os Endpoints que Funcionam

| Endpoint | Funcao | Requer Session |
|----------|--------|----------------|
| login.fcgi | Autenticacao | Nao |
| logout.fcgi | Encerrar sessao | Sim |
| session_is_valid.fcgi | Verificar se sessao e valida | Sim |
| get_info.fcgi | Info do equipamento | Sim |
| get_system_information.fcgi | Estatisticas do sistema | Sim |
| load_users.fcgi | Lista de funcionarios | Sim |
| get_afd.fcgi | Marcacoes brutas (AFD) | Sim |
| get_configuration.fcgi | Configuracoes do equipamento | Sim |
| set_configuration.fcgi | Alterar configuracoes | Sim |

---

## Limitacoes Importantes

### O que o relogio NAO fornece:

1. **Banco de Horas** - Nao calcula horas extras ou saldo
2. **Total de Horas Trabalhadas** - Nao soma as horas
3. **Faltas e Atrasos** - Nao compara com jornada
4. **Abonos** - Nao gerencia justificativas
5. **Relatorios** - Nao gera relatorios formatados

### Por que?

O relogio Control iD REP e apenas um **coletor de marcacoes**. Ele registra quando o funcionario bate o ponto, mas nao faz calculos.

Os calculos de banco de horas, extras, faltas, etc. sao feitos pelo **software RHID** (sistema de gestao de ponto), que e um software separado instalado em um computador/servidor.

---

## Referencia

- **Documentacao Oficial Control iD:** https://www.controlid.com.br/suporte/api_idclass_latest.html
- **Manual RHID:** https://rhid.com.br/v2/manual/
- **Postman Collection:** https://documenter.getpostman.com/view/10800185/SztHW4xo

---

## Historico

| Data | Descricao |
|------|-----------|
| 15/01/2026 | Documentacao inicial criada |
| 15/01/2026 | Testado acesso aos 3 relogios |
| 15/01/2026 | Mapeados todos os endpoints funcionais |

---

**Criado por:** Claude Code
**Ultima atualizacao:** 15/01/2026
