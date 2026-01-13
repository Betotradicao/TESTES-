# 🔒 CONFIGURAÇÃO PERSISTENTE DO TAILSCALE

**Data:** 13/01/2026
**Objetivo:** Garantir que o Tailscale não caia após reinicialização

---

## 🎯 PROBLEMA RESOLVIDO HOJE

O Tailscale estava caindo e perdendo configurações após reinicialização do servidor VPS.

**Sintomas:**
- ❌ Tailscale não iniciava automaticamente
- ❌ Subnet routes `10.6.1.0/24` não eram aceitas
- ❌ Backend não conseguia acessar API Intersolid
- ❌ Página "Estoque e Margem" não carregava produtos

---

## ✅ SOLUÇÃO IMPLEMENTADA

### 1. Script de Inicialização Customizado

**Arquivo:** `/usr/local/bin/start-tailscale.sh`

```bash
#!/bin/bash
export TS_NO_TPM=1
tailscaled --cleanup 2>/dev/null || true
nohup tailscaled --state=/var/lib/tailscale/tailscaled.state --socket=/run/tailscale/tailscaled.sock --port=41641 > /var/log/tailscaled.log 2>&1 &
sleep 3
tailscale up --accept-routes
tailscale status
```

**Importante:** O comando `tailscale up --accept-routes` é CRÍTICO para aceitar as subnet routes anunciadas pelo Windows.

### 2. Serviço Systemd Customizado

**Arquivo:** `/etc/systemd/system/tailscale-custom.service`

```ini
[Unit]
Description=Tailscale Custom Service
After=network.target

[Service]
Type=forking
ExecStart=/usr/local/bin/start-tailscale.sh
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

**Status:**
- ✅ Habilitado: `systemctl enable tailscale-custom`
- ✅ Serviço padrão desabilitado: `systemctl disable tailscaled`

### 3. Configuração de Rede (iptables)

**NAT para permitir Docker acessar Tailscale:**

```bash
# Permitir containers Docker acessarem rede Tailscale
iptables -t nat -A POSTROUTING -s 172.18.0.0/16 -d 10.6.1.0/24 -j MASQUERADE
iptables -A FORWARD -s 172.18.0.0/16 -d 10.6.1.0/24 -j ACCEPT
iptables -A FORWARD -d 172.18.0.0/16 -s 10.6.1.0/24 -j ACCEPT
```

**Persistência:** Instalado `iptables-persistent` para salvar regras automaticamente.

### 4. Configuração do Windows (tradicao-windows)

**IP Forwarding habilitado:**
- Registro: `HKLM:\SYSTEM\CurrentControlSet\Services\Tcpip\Parameters\IPEnableRouter = 1`

**Firewall:**
- Regra criada: "Tailscale Subnet Router" (Inbound Allow para interface Tailscale)

**Subnet Route anunciada:**
```bash
tailscale set --advertise-routes=10.6.1.0/24
```

**Aprovada no painel:** https://login.tailscale.com/admin/machines

---

## 🔍 COMO VERIFICAR SE ESTÁ FUNCIONANDO

### 1. VPS - Verificar Tailscale

```bash
ssh -i ~/.ssh/vps_prevencao root@145.223.92.152

# Status do Tailscale
tailscale status

# Deve mostrar:
# 100.87.248.78   vps-tradicao-78-srv1228079  Betotradicao@  linux    -
# 100.81.126.110  tradicao-vps                Betotradicao@  linux    -
# 100.69.131.40   tradicao-windows            Betotradicao@  windows  -

# Verificar rotas
ip route show | grep 10.6

# Deve mostrar:
# 10.6.1.0/24 dev tailscale0 scope link
```

### 2. VPS - Testar Ping Tailscale

```bash
tailscale ping 100.69.131.40

# Deve responder:
# pong from tradicao-windows (100.69.131.40) via DERP(sao) in ~20ms
```

### 3. VPS - Testar Acesso à API Intersolid

```bash
curl -s -m 10 "http://10.6.1.102:3003/v1/produtos?limit=1" | python3 -c "import sys,json; print(json.dumps(json.load(sys.stdin)[0], indent=2))" 2>&1 | head -50

# Deve retornar dados do produto
```

### 4. Backend - Testar do Container

```bash
docker exec prevencao-backend-prod node -e "const http=require('http'); http.get('http://10.6.1.102:3003/v1/produtos?limit=1', {timeout:30000}, (res) => {console.log('Status:', res.statusCode);}).on('error', e=>console.error('Error:', e.message))"

# Deve mostrar:
# Status: 200
```

### 5. Frontend - Testar na Aplicação

Acesse: https://prevencaonoradar.com.br/estoque-saude

- ✅ Deve carregar lista de produtos
- ✅ Cards devem mostrar números corretos
- ✅ Filtros devem funcionar

---

## 🚨 SE O TAILSCALE CAIR NOVAMENTE

### Passo 1: Reiniciar Serviço na VPS

```bash
ssh -i ~/.ssh/vps_prevencao root@145.223.92.152

# Verificar status
systemctl status tailscale-custom

# Se estiver parado, reiniciar
systemctl restart tailscale-custom

# Verificar logs
journalctl -u tailscale-custom -n 50
tail -50 /var/log/tailscaled.log
```

### Passo 2: Verificar se accept-routes está ativo

```bash
tailscale status --json | python3 -c 'import sys,json; d=json.load(sys.stdin); print("AllowedIPs:", d.get("Self", {}).get("AllowedIPs"))'

# Deve incluir a subnet 10.6.1.0/24 nos AllowedIPs dos peers
```

Se não estiver aceitando rotas:

```bash
tailscale up --accept-routes
```

### Passo 3: Verificar rotas de rede

```bash
# Verificar se a rota existe
ip route show | grep 10.6

# Se não existir, adicionar
ip route add 10.6.1.0/24 dev tailscale0
```

### Passo 4: Verificar iptables

```bash
# Listar regras
iptables -t nat -L POSTROUTING -n -v | grep 10.6
iptables -L FORWARD -n -v | grep 10.6

# Se não existirem, adicionar novamente
iptables -t nat -A POSTROUTING -s 172.18.0.0/16 -d 10.6.1.0/24 -j MASQUERADE
iptables -A FORWARD -s 172.18.0.0/16 -d 10.6.1.0/24 -j ACCEPT
iptables -A FORWARD -d 172.18.0.0/16 -s 10.6.1.0/24 -j ACCEPT

# Salvar regras
netfilter-persistent save
```

### Passo 5: Verificar no Windows

```powershell
# Verificar se Tailscale está rodando
tailscale status

# Se não estiver logado, fazer login e configurar
tailscale set --advertise-routes=10.6.1.0/24

# Aprovar no painel: https://login.tailscale.com/admin/machines
# Clicar em tradicao-windows > Edit route settings > Marcar 10.6.1.0/24 > Save
```

---

## 📊 ARQUITETURA DA REDE

```
┌─────────────────────────────────────────────────────────────┐
│                    VPS 145.223.92.152                       │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  Tailscale Interface (100.87.248.78)                 │   │
│  │  - Accept Routes: ✅                                 │   │
│  │  - Routes: 10.6.1.0/24 via tradicao-windows          │   │
│  └──────────────────┬───────────────────────────────────┘   │
│                     │                                        │
│  ┌──────────────────▼───────────────────────────────────┐   │
│  │  Docker Network (172.18.0.0/16)                      │   │
│  │  ┌────────────────────────────────────────────────┐  │   │
│  │  │  Backend Container (172.18.0.4)                │  │   │
│  │  │  - NAT via iptables para 10.6.1.0/24          │  │   │
│  │  └────────────────────────────────────────────────┘  │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
                          │
                    Tailscale DERP
                       (relay sao)
                          │
┌─────────────────────────▼───────────────────────────────────┐
│            Windows (tradicao-windows)                       │
│                 100.69.131.40                               │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  Tailscale Interface                                 │   │
│  │  - Advertise Routes: 10.6.1.0/24                     │   │
│  │  - IP Forwarding: ✅                                 │   │
│  │  - Firewall: Allow Tailscale                         │   │
│  └──────────────────┬───────────────────────────────────┘   │
│                     │                                        │
│  ┌──────────────────▼───────────────────────────────────┐   │
│  │  Rede Local (10.6.1.0/24)                            │   │
│  │  - Windows: 10.6.1.171                               │   │
│  │  - Zanthus: 10.6.1.101                               │   │
│  │  - Intersolid: 10.6.1.102 ⭐                         │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

---

## 📝 COMMITS RELACIONADOS

1. `5f0fa9c` - docs: Remove todas as referências ao MaxValle
2. `a9ddff4` - fix: Corrige exibição de colunas e adiciona card de Valor Total do Estoque
3. `5302f8b` - feat: Adiciona cards de Custo Zerado e Preço Venda Zerado
4. `04d92f8` - feat: Adiciona exportação PDF e filtros dependentes em Estoque

---

## ⚠️ NOTAS IMPORTANTES

1. **NUNCA desabilitar o serviço `tailscale-custom`** - É o responsável por manter tudo funcionando
2. **Sempre verificar `--accept-routes`** após reinicialização da VPS
3. **Manter iptables-persistent instalado** para persistir regras de firewall
4. **No Windows, manter Tailscale iniciando automaticamente** com o sistema
5. **Subnet route deve estar aprovada** no painel admin do Tailscale

---

## 🔧 COMANDOS RÁPIDOS DE DIAGNÓSTICO

```bash
# VPS - Status completo
ssh -i ~/.ssh/vps_prevencao root@145.223.92.152 "echo '=== Tailscale Status ===' && tailscale status && echo && echo '=== Routes ===' && ip route show | grep 10.6 && echo && echo '=== iptables NAT ===' && iptables -t nat -L POSTROUTING -n | grep 10.6"

# VPS - Teste de conectividade
ssh -i ~/.ssh/vps_prevencao root@145.223.92.152 "tailscale ping 100.69.131.40 -c 3"

# VPS - Teste da API
ssh -i ~/.ssh/vps_prevencao root@145.223.92.152 "curl -s -m 5 http://10.6.1.102:3003/v1/produtos?limit=1 | python3 -c 'import sys,json; print(len(json.load(sys.stdin)), \"produtos\")' 2>&1"
```

---

**Criado por:** Claude Code
**Data:** 13/01/2026
**Versão:** 1.0
**Status:** ✅ Produção - Funcionando
