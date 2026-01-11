# CONFIGURAÇÃO CORRETA - API INTERSOLID

## ⚠️ IMPORTANTE - LEIA ANTES DE ALTERAR CONFIGURAÇÕES

Este documento registra a configuração CORRETA da API Intersolid após resolução de problemas em 10/01/2026.

---

## 📍 Topologia da Rede

```
┌─────────────────────────────────────────────────────────────────┐
│                      REDE TAILSCALE                             │
│                    (100.0.0.0/10 - IPs virtuais)                │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌──────────────────────┐         ┌──────────────────────┐    │
│  │   VPS 145 (Teste)    │         │   Windows Cliente    │    │
│  │                      │◄───────►│  tradicao-windows    │    │
│  │ IP Tailscale:        │         │                      │    │
│  │ 100.87.248.78        │         │ IP Tailscale:        │    │
│  │                      │         │ 100.69.131.40        │    │
│  │ Backend Node.js      │         │                      │    │
│  │ PostgreSQL           │         │ IP Rede Local:       │    │
│  └──────────────────────┘         │ 10.6.1.171           │    │
│                                    │                      │    │
│                                    └──────────────────────┘    │
│                                             │                   │
│                                             │ Roteamento        │
│                                             ▼                   │
│                                    ┌─────────────────┐         │
│                                    │  Rede Local     │         │
│                                    │  10.6.1.0/24    │         │
│                                    │                 │         │
│                                    │ 🔴 INTERSOLID   │         │
│                                    │ 10.6.1.102:3003 │         │
│                                    │                 │         │
│                                    │ Zanthus         │         │
│                                    │ 10.6.1.101      │         │
│                                    └─────────────────┘         │
└─────────────────────────────────────────────────────────────────┘
```

---

## 🎯 Configuração Correta da API Intersolid

### IPs IMPORTANTES

| Descrição | IP | Função |
|-----------|----|----|
| **Windows Cliente (Tailscale)** | `100.69.131.40` | Gateway Tailscale - roteia tráfego para rede local |
| **Windows Cliente (Rede Local)** | `10.6.1.171` | IP na rede física do mercado |
| **🔴 API INTERSOLID** | `10.6.1.102` | **MÁQUINA SEPARADA** na rede local onde a API roda |
| **Zanthus ERP** | `10.6.1.101` | Sistema ERP na rede local |

### ⚠️ ATENÇÃO - NÃO CONFUNDIR!

```
❌ ERRADO: intersolid_api_url = http://10.6.1.171
   (Esse é o IP do Windows cliente, NÃO da Intersolid!)

❌ ERRADO: intersolid_api_url = http://100.69.131.40
   (Esse é o IP Tailscale do gateway, NÃO da Intersolid!)

✅ CORRETO: intersolid_api_url = http://10.6.1.102
   (Esse é o IP da MÁQUINA onde a API Intersolid roda!)
```

### Configuração no Banco de Dados

```sql
-- Configuração CORRETA
UPDATE configurations SET value = 'http://10.6.1.102' WHERE key = 'intersolid_api_url';
UPDATE configurations SET value = '3003' WHERE key = 'intersolid_port';
UPDATE configurations SET value = '/v1/produtos' WHERE key = 'intersolid_products_endpoint';
UPDATE configurations SET value = '/v1/vendas' WHERE key = 'intersolid_sales_endpoint';
UPDATE configurations SET value = 'ROBERTO' WHERE key = 'intersolid_username';
UPDATE configurations SET value = '312013@#' WHERE key = 'intersolid_password';
```

### Fluxo de Requisição

Quando o backend busca produtos da Intersolid:

```
1. Backend (VPS 145) faz requisição para http://10.6.1.102:3003/v1/produtos
   │
   ▼
2. Roteamento Linux consulta tabela de rotas
   │
   └─► "10.6.1.0/24 via Tailscale para 100.69.131.40"
   │
   ▼
3. Pacote enviado via Tailscale para Windows Cliente (100.69.131.40)
   │
   ▼
4. Windows Cliente roteia para rede local 10.6.1.0/24
   │
   ▼
5. Pacote chega em 10.6.1.102:3003 (máquina da Intersolid)
   │
   ▼
6. API Intersolid responde com JSON de produtos
   │
   ▼
7. Resposta volta pelo mesmo caminho até o Backend
```

---

## 🔧 Configuração Tailscale

### No Windows Cliente (100.69.131.40)

**PowerShell como Administrador:**

```powershell
# Configurar roteamento de subnet
tailscale up --advertise-routes=10.6.1.0/24 --accept-routes
```

### Aprovação no Painel Web

1. Acessar: https://login.tailscale.com/admin/machines
2. Encontrar máquina **"tradicao-windows"** (100.69.131.40)
3. Clicar nos **3 pontinhos** (⋮) → "Edit route settings"
4. **MARCAR** checkbox `10.6.1.0/24` ✅
5. Salvar

### ⚠️ ATENÇÃO - Subnet Duplicada

**PROBLEMA IDENTIFICADO:** Duas máquinas Windows anunciando a mesma subnet `10.6.1.0/24` causa conflito de roteamento!

**Máquinas que anunciavam a subnet:**
- `tradicao-windows` (100.69.131.40) ✅ **CORRETO - MANTER ATIVO**
- `estacao6-pc` (100.102.9.98) ❌ **DESABILITAR**

**SOLUÇÃO APLICADA:**
1. Desabilitamos a subnet em `estacao6-pc`
2. Mantivemos APENAS em `tradicao-windows`
3. Isso resolveu o conflito e as rotas começaram a funcionar

**Se subnet parar de funcionar novamente, verificar:**

```bash
# Na VPS, ver se rota está instalada
ssh root@145.223.92.152
ip route show | grep '10.6.1'

# Deve aparecer:
# 10.6.1.0/24 dev tailscale0 scope link

# Se NÃO aparecer, reconectar Tailscale:
tailscale down
tailscale up --accept-routes --shields-up=false
```

---

## 🧪 Como Testar

### 1. Testar Ping

```bash
# Na VPS 145
ssh -i ~/.ssh/vps_prevencao root@145.223.92.152
ping -c 3 10.6.1.102

# Deve retornar:
# 64 bytes from 10.6.1.102: icmp_seq=1 ttl=64 time=XXms
```

### 2. Testar Porta TCP

```bash
timeout 5 bash -c 'cat < /dev/null > /dev/tcp/10.6.1.102/3003' && echo "✅ Porta ABERTA" || echo "❌ Porta FECHADA"
```

### 3. Testar API Completa

```bash
curl -s 'http://10.6.1.102:3003/v1/produtos?limit=2' \
  -u 'ROBERTO:312013@#' \
  --connect-timeout 10
```

**Resposta esperada:**
```json
[
  {
    "codigo": "00012874",
    "descricao": "PET RACAO AGN FIUCAO ADULTO",
    "ean": "0000000012874",
    "valvendaloja": 6.99,
    "estoque": 135.47,
    ...
  }
]
```

---

## 🐛 Problemas Conhecidos e Soluções

### Problema 1: "Connection refused" na porta 3003

**Sintomas:**
- Backend não consegue acessar API Intersolid
- Timeout ou "Connection refused"

**Causas possíveis:**

1. **Firewall do Windows bloqueando porta 3003**

   **Solução:**
   ```powershell
   # No Windows (10.6.1.102)
   New-NetFirewallRule -DisplayName "Intersolid API 3003" -Direction Inbound -LocalPort 3003 -Protocol TCP -Action Allow
   ```

2. **Serviço Intersolid parado**

   **Solução:**
   ```powershell
   # Verificar se está rodando
   netstat -ano | findstr :3003

   # Se não retornar nada, iniciar o serviço Intersolid
   ```

3. **Rota Tailscale não instalada**

   **Solução:**
   ```bash
   # Reconectar Tailscale na VPS
   tailscale down
   tailscale up --accept-routes --shields-up=false
   ```

### Problema 2: Ping funciona mas porta 3003 fechada

**Sintomas:**
- `ping 10.6.1.102` funciona
- Porta 3003 recusa conexão

**Causa:** Firewall do Windows bloqueando porta específica (ICMP passa mas TCP não)

**Solução:** Abrir porta no firewall (ver Problema 1)

### Problema 3: Rotas desaparecem após reconexão

**Sintomas:**
- Após reiniciar VPS ou Tailscale, rota `10.6.1.0/24` some

**Causa:** Subnet duplicada ou não aprovada no painel

**Solução:**
1. Verificar no painel se subnet está aprovada
2. Verificar se APENAS `tradicao-windows` está anunciando
3. Reconectar com `--accept-routes`

---

## 📊 Histórico de Problemas (10/01/2026)

### O que aconteceu

1. **13:58-14:02** - Sistema funcionando normalmente, bipagens sendo recebidas
2. **~14:00** - Alteração INCORRETA na configuração da API:
   - Mudamos `intersolid_api_url` de `http://10.6.1.102` para `http://100.69.131.40`
   - Backend recarregou configuração e PAROU de acessar Intersolid
3. **14:02** - Última bipagem recebida (ID 1303)
4. **14:00-23:00** - 9 HORAS sem receber bipagens! 🔴
5. **~22:00** - Descoberta do erro de configuração
6. **~23:00** - Configuração corrigida de volta para `http://10.6.1.102`
7. **23:30** - Descoberta de subnet duplicada (2 máquinas anunciando `10.6.1.0/24`)
8. **23:45** - Desabilitada subnet em `estacao6-pc`, mantida apenas em `tradicao-windows`
9. **00:00** - Sistema voltou a funcionar! Ping e API respondendo ✅

### Lições Aprendidas

1. ✅ **NUNCA mudar `intersolid_api_url` para IP Tailscale** - sempre usar o IP da rede local (`10.6.1.102`)
2. ✅ **Subnet routing** - apenas UMA máquina deve anunciar cada subnet
3. ✅ **Testar antes de assumir** - sempre fazer `ping` e `curl` para confirmar conectividade
4. ✅ **Firewall Windows** - porta precisa estar aberta mesmo com serviço rodando
5. ✅ **Documentar configurações corretas** - este arquivo serve para evitar repetir o mesmo erro

---

## ✅ Checklist de Configuração

Ao configurar uma nova VPS ou resolver problemas de conectividade:

- [ ] Tailscale instalado na VPS
- [ ] Tailscale configurado com `--accept-routes --shields-up=false`
- [ ] Windows cliente com Tailscale instalado
- [ ] Windows cliente anunciando subnet: `tailscale up --advertise-routes=10.6.1.0/24 --accept-routes`
- [ ] Subnet aprovada no painel Tailscale (https://login.tailscale.com/admin/machines)
- [ ] **APENAS UMA máquina** anunciando a subnet `10.6.1.0/24`
- [ ] Porta 3003 aberta no firewall do Windows (10.6.1.102)
- [ ] Serviço Intersolid rodando na porta 3003
- [ ] Configuração no banco: `intersolid_api_url = http://10.6.1.102`
- [ ] Configuração no banco: `intersolid_port = 3003`
- [ ] Teste de ping: `ping 10.6.1.102` funciona
- [ ] Teste de porta: porta 3003 aberta
- [ ] Teste de API: `curl http://10.6.1.102:3003/v1/produtos` retorna JSON

---

## 📞 Contatos e Referências

- **Documentação Tailscale Completa:** `BACKUPS-E-APRENDIZADOS/TAILSCALE-E-APIS.md`
- **Painel Admin Tailscale:** https://login.tailscale.com/admin/machines
- **Documentação Oficial Tailscale Subnet:** https://tailscale.com/kb/1019/subnets/

---

**Data de criação:** 10/01/2026 23:50
**Última atualização:** 10/01/2026 23:50
**Responsável:** Claude Sonnet 4.5 + Roberto (Tradicao SJC)
