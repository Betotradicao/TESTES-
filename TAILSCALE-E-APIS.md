# TAILSCALE E APIS - Manual Completo

## O que é Tailscale?

Tailscale é uma **VPN mesh privada** que cria uma rede segura entre dispositivos, independente de onde estejam. Diferente de VPNs tradicionais que exigem um servidor central, o Tailscale conecta seus dispositivos diretamente uns aos outros.

**Exemplo prático:**
- Você tem um **computador Windows no mercado** (IP local: 192.168.1.10)
- Você tem um **servidor VPS na nuvem** (IP público: 46.202.150.64)
- Com Tailscale, eles conversam como se estivessem na mesma rede local, mesmo estando em locais diferentes

---

## Como Funciona no Sistema Prevenção no Radar

### Arquitetura

```
┌─────────────────────────────────────────────────────────────────┐
│                      REDE TAILSCALE                             │
│                    (100.0.0.0/10 - IPs virtuais)                │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌──────────────────────┐         ┌──────────────────────┐    │
│  │   VPS (Servidor)     │         │   Windows (Cliente)  │    │
│  │                      │◄───────►│                      │    │
│  │ IP Tailscale:        │         │ IP Tailscale:        │    │
│  │ 100.99.57.69         │         │ 100.69.131.40        │    │
│  │                      │         │                      │    │
│  │ Backend Node.js      │         │ Sistema ERP Local    │    │
│  │ Frontend React       │         │ - Intersolid API     │    │
│  │ PostgreSQL           │         │ - Zanthus API        │    │
│  │ MinIO                │         │                      │    │
│  └──────────────────────┘         └──────────────────────┘    │
│                                             │                   │
│                                             ▼                   │
│                                    ┌─────────────────┐         │
│                                    │  Rede Local     │         │
│                                    │  10.6.1.0/24    │         │
│                                    │                 │         │
│                                    │ Intersolid API  │         │
│                                    │ 10.6.1.102:3003 │         │
│                                    │                 │         │
│                                    │ Zanthus API     │         │
│                                    │ 10.6.1.101      │         │
│                                    └─────────────────┘         │
└─────────────────────────────────────────────────────────────────┘
```

---

## Passo a Passo: Como Conectar VPS ao Cliente

### 1. Instalação do Tailscale na VPS (Automático)

O script de instalação (`install.sh`) já faz isso automaticamente:

```bash
# Download e execução do instalador
curl -fsSL https://raw.githubusercontent.com/Betotradicao/NOVO-PREVEN-O/main/InstaladorVPS/INSTALAR-DIRETO.sh | bash
```

**O que acontece nos bastidores:**

1. **Instala o Tailscale**
   ```bash
   curl -fsSL https://tailscale.com/install.sh | sh
   ```

2. **Faz logout de conexões antigas** (limpa autenticações anteriores)
   ```bash
   tailscale logout
   ```

3. **Conecta ao Tailscale com opções especiais**
   ```bash
   tailscale up --accept-routes --shields-up=false
   ```

   - `--accept-routes`: **CRÍTICO!** Permite que a VPS acesse redes locais anunciadas por outros dispositivos
   - `--shields-up=false`: Permite que outros dispositivos Tailscale acessem serviços na VPS

4. **Exibe link de autenticação**
   ```
   To authenticate, visit:

   https://login.tailscale.com/a/xxxxxxxxx
   ```

   **Você deve:**
   - Abrir esse link no navegador
   - Fazer login com sua conta Tailscale
   - Aprovar o dispositivo

5. **Obtém IP Tailscale da VPS**
   ```bash
   tailscale ip -4
   # Retorna algo como: 100.99.57.69
   ```

6. **Pergunta o IP Tailscale do Windows**
   ```
   Digite o IP Tailscale do cliente Windows (ex: 100.69.131.40):
   ```

---

### 2. Instalação do Tailscale no Windows (Cliente)

No computador Windows onde o ERP está instalado:

1. **Download do Tailscale**
   - Acesse: https://tailscale.com/download/windows
   - Instale o executável

2. **Login no Tailscale**
   - Abra o Tailscale (ícone na bandeja do sistema)
   - Clique em "Log in"
   - Use a **mesma conta** usada na VPS

3. **Anotar o IP Tailscale**
   - Após login, clique no ícone do Tailscale
   - Veja algo como: `tradicao-windows - 100.69.131.40`
   - **Anote esse IP!** Você vai precisar dele

4. **Configurar Roteamento de Subnet** (IMPORTANTE!)

   Esta é a parte mais importante para que as APIs locais funcionem!

   a. **Abrir PowerShell como Administrador**

   b. **Anunciar a rede local do mercado**
      ```powershell
      tailscale up --advertise-routes=10.6.1.0/24
      ```

      - `10.6.1.0/24`: Rede local onde estão as APIs (Intersolid, Zanthus, etc.)
      - Isso diz ao Tailscale: "Qualquer dispositivo que quiser acessar 10.6.1.x, eu consigo rotear!"

   c. **Aprovar a rota no Painel Tailscale**
      - Acesse: https://login.tailscale.com/admin/machines
      - Encontre o dispositivo Windows
      - Clique nos 3 pontinhos (⋯) → "Edit route settings"
      - **Marque a checkbox** da rota `10.6.1.0/24`
      - Clique em "Save"

---

### 3. Verificar Conectividade

Na VPS, você pode testar:

```bash
# Testar ping para o Windows
ping 100.69.131.40

# Testar acesso à API Intersolid
curl http://10.6.1.102:3003

# Testar acesso à API Zanthus
curl http://10.6.1.101
```

Se tudo estiver correto, você deve receber respostas (mesmo que sejam erros HTTP, o importante é que conectou).

---

## Como o Backend Acessa as APIs

### Configuração Docker

O backend roda em um container Docker com `network_mode: host`, o que significa que ele **compartilha a rede do host** (da VPS):

```yaml
backend:
  container_name: prevencao-backend-prod
  network_mode: host  # <-- CRÍTICO para acessar Tailscale
  environment:
    DB_HOST: 127.0.0.1      # PostgreSQL via porta exposta
    DB_PORT: 5434
    MINIO_ENDPOINT: 127.0.0.1  # MinIO via porta exposta
    MINIO_PORT: 9010
```

**Por que `network_mode: host`?**

- O Tailscale cria uma interface de rede chamada `tailscale0` **no host** (VPS)
- Containers em rede bridge (padrão) não conseguem acessar `tailscale0`
- Com `network_mode: host`, o container vê a mesma rede que a VPS, incluindo `tailscale0`

### Fluxo de uma Requisição à API

Quando o sistema busca produtos da Intersolid:

```
1. Frontend React (navegador do usuário)
   │
   └──► GET /api/sync/intersolid/products
         │
         ▼
2. Backend Node.js (VPS)
   │
   └──► axios.get('http://10.6.1.102:3003/v1/produtos')
         │
         ▼
3. Roteamento no Backend
   │
   ├─► Consulta tabela de rotas do Linux
   │   └─► "10.6.1.0/24 vai para 100.69.131.40 via Tailscale"
   │
   └──► Pacote enviado pela interface tailscale0
         │
         ▼
4. Tailscale VPS → Tailscale Windows
   │
   └──► Conexão criptografada ponto-a-ponto
         │
         ▼
5. Windows recebe pacote
   │
   ├─► Verifica: "destino é 10.6.1.102? OK, é da minha rede local!"
   │
   └──► Encaminha para 10.6.1.102:3003
         │
         ▼
6. API Intersolid responde
   │
   └──► JSON com produtos
         │
         ▼
7. Resposta volta pelo mesmo caminho
   │
   └──► Windows → Tailscale → VPS → Backend → Frontend
```

---

## Configurações Importantes

### 1. Docker Compose - Acesso ao Tailscale

O backend Docker acessa o Tailscale da VPS via `host.docker.internal`:

```yaml
backend:
  ports:
    - "3001:3001"
  networks:
    - prevencao-network
  extra_hosts:
    - "host.docker.internal:host-gateway"  # Permite acessar Tailscale do host
```

**Como funciona:**
- `extra_hosts` adiciona um alias `host.docker.internal` que aponta para o IP do host
- O backend pode acessar IPs Tailscale (`10.6.1.x`) através da interface Tailscale do host
- NÃO usa `network_mode: host` (que quebra comunicação com frontend)

### 2. Configurações do Sistema (Banco de Dados)

As configurações são salvas no PostgreSQL:

| Chave | Valor Exemplo | Descrição |
|-------|---------------|-----------|
| `tailscale_vps_ip` | `100.99.57.69` | IP Tailscale da VPS |
| `tailscale_client_ip` | `100.69.131.40` | IP Tailscale do Windows |
| `intersolid_api_url` | `http://10.6.1.102` | URL da API Intersolid |
| `intersolid_port` | `3003` | Porta da API Intersolid |
| `zanthus_api_url` | `http://10.6.1.101` | URL da API Zanthus |

Essas configurações são usadas pelo backend para construir as URLs das APIs.

### 2. Seed de Configurações

O arquivo `packages/backend/src/scripts/seed-configurations.ts` popula automaticamente essas configurações na primeira inicialização:

```typescript
// APIs PRÉ-CONFIGURADAS
{
  key: 'intersolid_api_url',
  value: 'http://10.6.1.102',
  description: 'URL da API Intersolid'
},
{
  key: 'intersolid_port',
  value: '3003',
  description: 'Porta da API Intersolid'
}
```

**Importante:** O seed usa lógica INSERT-only (não sobrescreve valores existentes):

```typescript
// Buscar configuração existente
let configuration = await configRepository.findOne({ where: { key: config.key } });

if (configuration) {
  // JÁ EXISTE - não sobrescrever
  console.log(`   ⏭️  ${config.key}: já existe, mantido`);
} else {
  // NÃO EXISTE - criar nova
  configuration = configRepository.create({
    key: config.key,
    value: config.value
  });
  await configRepository.save(configuration);
}
```

---

## Testando Conectividade no Sistema

### Painel de Configurações → Aba Tailscale

O sistema tem uma interface para testar a conectividade Tailscale:

1. **Acesse:** Menu → Configurações → Tailscale

2. **Configure os IPs:**
   - IP Tailscale da VPS: `100.99.57.69`
   - IP Tailscale do Cliente: `100.69.131.40`

3. **Clique em "Testar Conectividade Agora"**

**O que o teste verifica:**

```typescript
// Test 1: VPS → Cliente (ping ICMP)
ping -c 1 -W 2 100.69.131.40

// Test 2: VPS → Sistema Local via Cliente
ping -c 1 -W 2 10.6.1.102
```

**Resultado esperado:**

```
✅ VPS → Cliente
   Conectado (8ms)

✅ VPS → Sistema Local (via Cliente)
   Conectado (138ms)

✅ Status Geral
   Todos os sistemas online
```

---

## Troubleshooting (Resolução de Problemas)

### Problema 1: "Timeout ao acessar APIs"

**Sintoma:** Backend não consegue acessar `http://10.6.1.102:3003`

**Causas Possíveis:**

1. **Tailscale não está com `--accept-routes`**

   **Solução na VPS:**
   ```bash
   tailscale down
   tailscale up --accept-routes --shields-up=false
   ```

2. **Windows não anunciou a subnet route**

   **Solução no Windows (PowerShell como Admin):**
   ```powershell
   tailscale up --advertise-routes=10.6.1.0/24
   ```

   **E aprovar no painel:** https://login.tailscale.com/admin/machines

3. **Rotas não foram instaladas na tabela de roteamento**

   **Verificar na VPS:**
   ```bash
   # Ver todas as rotas
   ip route show

   # Deveria aparecer algo como:
   # 10.6.1.0/24 via 100.69.131.40 dev tailscale0
   ```

   **Se não aparecer, reconectar:**
   ```bash
   tailscale down && tailscale up --accept-routes --shields-up=false
   ```

4. **Backend não está em network_mode: host**

   **Verificar:**
   ```bash
   docker inspect prevencao-backend-prod | grep NetworkMode
   # Deve retornar: "NetworkMode": "host"
   ```

### Problema 2: "Connection refused"

**Sintoma:** Erro ao acessar APIs mesmo com Tailscale funcionando

**Causas:**

1. **API está offline**
   - Verificar se o serviço está rodando no Windows

2. **Firewall bloqueando**
   - Desabilitar temporariamente o Firewall do Windows para teste
   - Se funcionar, criar regra permitindo porta 3003

3. **IP ou porta incorretos**
   - Confirmar IP correto da API (`ipconfig` no Windows)
   - Confirmar porta correta (pode variar conforme instalação)

### Problema 3: "Rotas não persistem após reinicialização"

**Sintoma:** Após reiniciar a VPS, as APIs param de funcionar

**Solução:** O instalador já configura o Tailscale para iniciar automaticamente, mas você pode garantir:

```bash
# Habilitar autostart
systemctl enable tailscaled

# Configuração persistente
tailscale up --accept-routes --shields-up=false
```

---

## Comandos Úteis

### Na VPS (Linux)

```bash
# Ver status do Tailscale
tailscale status

# Ver IP próprio
tailscale ip -4

# Ver rotas instaladas
ip route | grep tailscale

# Testar ping via Tailscale
ping 100.69.131.40

# Testar acesso HTTP
curl http://10.6.1.102:3003

# Logs do Tailscale
journalctl -u tailscaled -f

# Reconectar Tailscale
tailscale down && tailscale up --accept-routes --shields-up=false
```

### No Windows (PowerShell Admin)

```powershell
# Ver status
tailscale status

# Anunciar subnet
tailscale up --advertise-routes=10.6.1.0/24

# Testar ping
ping 100.99.57.69

# Ver rotas
route print
```

---

## Segurança

### O que o Tailscale protege:

1. **Criptografia ponto-a-ponto**
   - Todo tráfego é criptografado
   - Mesmo que interceptado, não pode ser lido

2. **Autenticação**
   - Só dispositivos aprovados podem entrar na rede
   - Login obrigatório com conta Tailscale

3. **Rede privada**
   - IPs 100.x.x.x não são roteáveis na internet
   - Só acessíveis dentro da rede Tailscale

### O que você deve proteger:

1. **Conta Tailscale**
   - Use senha forte
   - Ative 2FA (autenticação de dois fatores)

2. **Dispositivos**
   - Revogue dispositivos não utilizados
   - Monitore dispositivos ativos em: https://login.tailscale.com/admin/machines

3. **APIs**
   - Mesmo dentro do Tailscale, use autenticação nas APIs
   - Configure firewall para permitir apenas IPs Tailscale

---

## Resumo da Configuração Atual

| Item | Valor | Localização |
|------|-------|-------------|
| VPS Tailscale IP | `100.99.57.69` | srv1196003 |
| Windows Tailscale IP | `100.69.131.40` | tradicao-windows |
| Rede Local ERP | `10.6.1.0/24` | Anunciada pelo Windows |
| API Intersolid | `http://10.6.1.102:3003` | Rede local |
| API Zanthus | `http://10.6.1.101` | Rede local |
| Backend Docker | `network_mode: host` | VPS |

---

## Fluxograma de Diagnóstico

```
Backend não acessa API?
│
├─ Backend consegue pingar 100.69.131.40?
│  │
│  ├─ NÃO → Tailscale offline
│  │        └─ Verificar: tailscale status
│  │
│  └─ SIM → Backend consegue pingar 10.6.1.102?
│           │
│           ├─ NÃO → Rotas não instaladas
│           │        └─ tailscale down && tailscale up --accept-routes
│           │
│           └─ SIM → Backend consegue fazer HTTP?
│                    │
│                    ├─ NÃO → Firewall bloqueando
│                    │        └─ Verificar firewall Windows
│                    │
│                    └─ SIM → ✅ Está funcionando!
```

---

## Referências

- **Documentação Oficial Tailscale:** https://tailscale.com/kb/
- **Subnet Routing:** https://tailscale.com/kb/1019/subnets/
- **Troubleshooting:** https://tailscale.com/kb/1023/troubleshooting/

---

## Suporte

Em caso de dúvidas:

1. Verificar logs do backend: `docker logs prevencao-backend-prod`
2. Verificar conectividade Tailscale no painel do sistema
3. Consultar este manual
4. Contato: suporte do sistema Prevenção no Radar
