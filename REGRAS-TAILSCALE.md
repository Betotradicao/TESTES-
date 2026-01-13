# 🌐 REGRAS TAILSCALE - Como Deve Funcionar

**Data:** 13/01/2026
**Versão:** 1.0
**Status:** ✅ PRODUÇÃO

---

## 🎯 O QUE É E PARA QUE SERVE

O **Tailscale** é uma VPN que conecta a VPS (servidor na nuvem) com a rede local do cliente, permitindo que o sistema de prevenção acesse:

- **API Intersolid** (10.6.1.102:3003) - Dados de produtos e estoque
- **API Zanthus** (10.6.1.101) - Dados de vendas do PDV

Sem o Tailscale, a VPS não conseguiria acessar essas APIs que estão na rede local do cliente.

---

## 🏗️ ARQUITETURA - COMO FUNCIONA

```
┌─────────────────────────────────────────────────────────────┐
│                VPS (145.223.92.152)                         │
│                                                             │
│  Backend precisa acessar:                                  │
│  - http://10.6.1.102:3003/v1/produtos (Intersolid)         │
│  - http://10.6.1.101/manager/... (Zanthus)                 │
│                                                             │
│  Tailscale IP: 100.87.248.78                               │
│  Accept Routes: ✅ OBRIGATÓRIO                             │
└─────────────────────┬───────────────────────────────────────┘
                      │
                      │  Túnel Tailscale
                      │  (criptografado via DERP relay)
                      │
┌─────────────────────▼───────────────────────────────────────┐
│          Windows Cliente (tradicao-windows)                 │
│                                                             │
│  Tailscale IP: 100.69.131.40                               │
│  Advertise Routes: 10.6.1.0/24 ✅ OBRIGATÓRIO              │
│  IP Forwarding: Habilitado                                 │
│                                                             │
│  ┌───────────────────────────────────────────────────────┐ │
│  │  Rede Local (10.6.1.0/24)                             │ │
│  │  - Intersolid API: 10.6.1.102:3003                    │ │
│  │  - Zanthus API: 10.6.1.101                            │ │
│  │  - Windows: 10.6.1.171                                │ │
│  └───────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

---

## ⚙️ CONFIGURAÇÃO OBRIGATÓRIA

### 1️⃣ VPS (145.223.92.152)

#### Script de Inicialização
**Arquivo:** `/usr/local/bin/start-tailscale.sh`

```bash
#!/bin/bash
export TS_NO_TPM=1
tailscaled --cleanup 2>/dev/null || true
nohup tailscaled --state=/var/lib/tailscale/tailscaled.state --socket=/run/tailscale/tailscaled.sock --port=41641 > /var/log/tailscaled.log 2>&1 &
sleep 3
tailscale up --accept-routes  # ⚠️ CRÍTICO - Sem isso não funciona!
tailscale status
```

#### Serviço Systemd
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

**Comandos:**
```bash
systemctl enable tailscale-custom
systemctl disable tailscaled  # Desabilitar serviço padrão
```

#### iptables (NAT para Docker)

⚠️ **OBRIGATÓRIO** para que os containers Docker consigam acessar a rede Tailscale:

```bash
# Permitir containers Docker (172.18.0.0/16) acessarem rede local (10.6.1.0/24)
iptables -t nat -A POSTROUTING -s 172.18.0.0/16 -d 10.6.1.0/24 -j MASQUERADE
iptables -A FORWARD -s 172.18.0.0/16 -d 10.6.1.0/24 -j ACCEPT
iptables -A FORWARD -d 172.18.0.0/16 -s 10.6.1.0/24 -j ACCEPT

# Salvar regras (persistir após reboot)
netfilter-persistent save
```

---

### 2️⃣ Windows Cliente (tradicao-windows)

#### Configuração Tailscale

```powershell
# Anunciar a subnet local 10.6.1.0/24
tailscale set --advertise-routes=10.6.1.0/24
```

**⚠️ DEPOIS disso, você DEVE:**
1. Acessar: https://login.tailscale.com/admin/machines
2. Clicar em **tradicao-windows**
3. Clicar em **Edit route settings**
4. **Marcar** a checkbox `10.6.1.0/24`
5. Clicar em **Save**

#### IP Forwarding (Windows)

```powershell
# Habilitar IP Forwarding no Registro
Set-ItemProperty -Path 'HKLM:\SYSTEM\CurrentControlSet\Services\Tcpip\Parameters' -Name IPEnableRouter -Value 1
```

#### Firewall

```powershell
# Criar regra para permitir tráfego da interface Tailscale
New-NetFirewallRule -DisplayName 'Tailscale Subnet Router' -Direction Inbound -Action Allow -InterfaceAlias 'Tailscale'
```

---

## ✅ COMO VERIFICAR SE ESTÁ FUNCIONANDO

### Teste 1: Tailscale Status na VPS

```bash
ssh -i ~/.ssh/vps_prevencao root@145.223.92.152 "tailscale status"
```

**Deve mostrar:**
```
100.87.248.78   vps-tradicao-78-srv1228079  Betotradicao@  linux    -
100.81.126.110  tradicao-vps                Betotradicao@  linux    -
100.69.131.40   tradicao-windows            Betotradicao@  windows  -
```

### Teste 2: Rota 10.6.1.0/24 na VPS

```bash
ssh -i ~/.ssh/vps_prevencao root@145.223.92.152 "ip route show | grep 10.6"
```

**Deve mostrar:**
```
10.6.1.0/24 dev tailscale0 scope link
```

⚠️ **Se NÃO aparecer** = `--accept-routes` não está ativo!

### Teste 3: Ping Tailscale

```bash
ssh -i ~/.ssh/vps_prevencao root@145.223.92.152 "tailscale ping 100.69.131.40 -c 3"
```

**Deve mostrar:**
```
pong from tradicao-windows (100.69.131.40) via DERP(sao) in 18ms
pong from tradicao-windows (100.69.131.40) via DERP(sao) in 20ms
pong from tradicao-windows (100.69.131.40) via DERP(sao) in 19ms
```

### Teste 4: Acesso à API Intersolid

```bash
ssh -i ~/.ssh/vps_prevencao root@145.223.92.152 "curl -s -m 10 'http://10.6.1.102:3003/v1/produtos?limit=1' | python3 -c 'import sys,json; print(len(json.load(sys.stdin)), \"produtos retornados\")' 2>&1"
```

**Deve mostrar:**
```
1 produtos retornados
```

⚠️ **Se mostrar timeout ou erro** = Problema de roteamento!

### Teste 5: Backend Acessando API

```bash
ssh -i ~/.ssh/vps_prevencao root@145.223.92.152 "docker exec prevencao-backend-prod node -e \"const http=require('http'); http.get('http://10.6.1.102:3003/v1/produtos?limit=1', {timeout:30000}, (res) => {console.log('Status:', res.statusCode);}).on('error', e=>console.error('Erro:', e.message))\""
```

**Deve mostrar:**
```
Status: 200
```

### Teste 6: Frontend (Página Estoque)

Acesse: **https://prevencaonoradar.com.br/estoque-saude**

✅ **Deve:**
- Carregar lista de produtos
- Mostrar números nos cards (Estoque Zerado, etc.)
- Filtros funcionando
- Exportação PDF funcionando

---

## 🚨 TROUBLESHOOTING - SE NÃO FUNCIONAR

### ❌ Problema 1: Rota 10.6.1.0/24 não aparece na VPS

**Causa:** `--accept-routes` não está ativo

**Solução:**
```bash
ssh -i ~/.ssh/vps_prevencao root@145.223.92.152

# Ativar accept-routes
tailscale up --accept-routes

# Verificar
ip route show | grep 10.6
```

---

### ❌ Problema 2: Timeout ao acessar 10.6.1.102

**Causa 1:** Windows não está anunciando a subnet

**Solução:**
1. No Windows: `tailscale status`
2. Verificar se tem `PrimaryRoutes: [10.6.1.0/24]`
3. Se não tiver, rodar: `tailscale set --advertise-routes=10.6.1.0/24`
4. Aprovar no painel: https://login.tailscale.com/admin/machines

**Causa 2:** IP Forwarding desabilitado no Windows

**Solução:**
```powershell
Set-ItemProperty -Path 'HKLM:\SYSTEM\CurrentControlSet\Services\Tcpip\Parameters' -Name IPEnableRouter -Value 1
```

**Causa 3:** Firewall bloqueando

**Solução:**
```powershell
New-NetFirewallRule -DisplayName 'Tailscale Subnet Router' -Direction Inbound -Action Allow -InterfaceAlias 'Tailscale'
```

---

### ❌ Problema 3: Backend não consegue acessar (ETIMEDOUT)

**Causa:** Docker não tem NAT configurado para Tailscale

**Solução:**
```bash
ssh -i ~/.ssh/vps_prevencao root@145.223.92.152

# Adicionar regras iptables
iptables -t nat -A POSTROUTING -s 172.18.0.0/16 -d 10.6.1.0/24 -j MASQUERADE
iptables -A FORWARD -s 172.18.0.0/16 -d 10.6.1.0/24 -j ACCEPT
iptables -A FORWARD -d 172.18.0.0/16 -s 10.6.1.0/24 -j ACCEPT

# Salvar permanentemente
netfilter-persistent save
```

---

### ❌ Problema 4: Tailscale não inicia após reboot da VPS

**Causa:** Serviço `tailscale-custom` não está habilitado

**Solução:**
```bash
ssh -i ~/.ssh/vps_prevencao root@145.223.92.152

# Verificar status
systemctl status tailscale-custom

# Habilitar
systemctl enable tailscale-custom
systemctl start tailscale-custom

# Desabilitar serviço padrão (causa conflito)
systemctl disable tailscaled
```

---

## 📋 CHECKLIST DIÁRIO DE SAÚDE

Execute estes comandos para verificar se tudo está OK:

```bash
# Status completo
ssh -i ~/.ssh/vps_prevencao root@145.223.92.152 "
echo '=== 1. Tailscale Status ==='
tailscale status

echo
echo '=== 2. Rotas ==='
ip route show | grep 10.6

echo
echo '=== 3. Teste Ping ==='
timeout 5 tailscale ping 100.69.131.40 || echo 'Ping falhou!'

echo
echo '=== 4. Teste API ==='
curl -s -m 5 http://10.6.1.102:3003/v1/produtos?limit=1 | python3 -c 'import sys,json; print(len(json.load(sys.stdin)), \"produtos OK\")' 2>&1 || echo 'API falhou!'
"
```

**Resultado esperado:**
```
=== 1. Tailscale Status ===
100.87.248.78   vps-tradicao-78-srv1228079  ...
100.69.131.40   tradicao-windows            ...

=== 2. Rotas ===
10.6.1.0/24 dev tailscale0 scope link

=== 3. Teste Ping ===
pong from tradicao-windows (100.69.131.40) via DERP(sao) in 19ms

=== 4. Teste API ===
1 produtos OK
```

---

## 🔒 REGRAS CRÍTICAS - NUNCA FAZER

❌ **NUNCA** desabilitar o serviço `tailscale-custom`
❌ **NUNCA** remover a subnet route `10.6.1.0/24` do painel Tailscale
❌ **NUNCA** executar `tailscale up` sem `--accept-routes` na VPS
❌ **NUNCA** remover as regras de iptables (NAT para Docker)
❌ **NUNCA** desabilitar IP Forwarding no Windows

---

## 📞 CONTATOS E LINKS ÚTEIS

- **Painel Admin Tailscale:** https://login.tailscale.com/admin/machines
- **Documentação Tailscale:** https://tailscale.com/kb/
- **Subnet Routers:** https://tailscale.com/kb/1019/subnets

---

## 📝 RESUMO - FLUXO DE FUNCIONAMENTO

1. **Windows anuncia** a rede local `10.6.1.0/24` via Tailscale
2. **VPS aceita** essa rota com `--accept-routes`
3. **Linux adiciona** rota `10.6.1.0/24 dev tailscale0` automaticamente
4. **iptables faz NAT** para containers Docker acessarem Tailscale
5. **Backend acessa** APIs locais (10.6.1.101, 10.6.1.102) normalmente
6. **Frontend carrega** dados sem perceber que vem de outra rede

**Simples assim! Se qualquer passo falhar, nada funciona.** ⚠️

---

**Criado por:** Claude Code
**Data:** 13/01/2026
**Versão:** 1.0
**Status:** ✅ PRODUÇÃO - OBRIGATÓRIO SEGUIR
