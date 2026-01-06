# 🚀 AUTO-INSTALADOR VPS - Documentação Técnica Detalhada

Este documento explica **detalhadamente** a estrutura, funcionamento e componentes do auto-instalador para VPS Linux do sistema "Prevenção no Radar".

---

## 📋 Índice

1. [O que é o Auto-Instalador](#-o-que-é-o-auto-instalador)
2. [Estrutura do Auto-Instalador](#-estrutura-do-auto-instalador)
3. [Componentes Essenciais](#-componentes-essenciais)
4. [Fluxo de Execução Passo a Passo](#-fluxo-de-execução-passo-a-passo)
5. [Tailscale: VPS vs Cliente](#-tailscale-vps-vs-cliente)
6. [Configurações Pré-preenchidas](#-configurações-pré-preenchidas)
7. [O que Precisa ser Configurado Depois](#-o-que-precisa-ser-configurado-depois)
8. [Como Montar um Auto-Instalador](#-como-montar-um-auto-instalador)
9. [Comandos Úteis Pós-Instalação](#-comandos-úteis-pós-instalação)
10. [Link do Auto-Instalador](#-link-do-auto-instalador)

---

## 🎯 O que é o Auto-Instalador

O **Auto-Instalador** (`INSTALAR-AUTO.sh`) é um script Bash que automatiza 100% da instalação do sistema "Prevenção no Radar" em um servidor VPS Linux limpo.

### Por que ele existe?

- ✅ **Evita erros humanos** durante instalação manual
- ✅ **Reduz tempo de instalação** de 2+ horas para 5-10 minutos
- ✅ **Gera senhas seguras** automaticamente
- ✅ **Configura ambiente completo** (Docker, Tailscale, banco de dados, etc)
- ✅ **Detecta IPs automaticamente** (público e Tailscale)
- ✅ **Cria arquivo .env completo** com todas as variáveis necessárias

### O que ele faz automaticamente?

1. Verifica pré-requisitos (Docker, Docker Compose)
2. Atualiza código do GitHub (git pull)
3. Detecta IP público da VPS
4. Instala e configura Tailscale (VPN)
5. Gera senhas aleatórias seguras
6. Cria arquivo `.env` com todas as configurações
7. Inicia containers Docker (PostgreSQL, MinIO, Backend, Frontend)
8. Aguarda backend inicializar e criar banco de dados
9. Exibe credenciais de acesso e salva em arquivo

---

## 📂 Estrutura do Auto-Instalador

O auto-instalador está localizado em:

```
InstaladorVPS/
├── INSTALAR-AUTO.sh              # Script principal (515 linhas)
├── docker-compose-producao.yml   # Orquestração de containers
├── Dockerfile.backend            # Build do backend Node.js
├── Dockerfile.frontend           # Build do frontend React
├── .env                          # Gerado automaticamente pelo script
└── CREDENCIAIS.txt               # Gerado automaticamente com senhas
```

### Detalhamento dos Arquivos:

#### 1. **INSTALAR-AUTO.sh** (Script Principal)
- **515 linhas** de código Bash
- Execução linear com 9 etapas principais
- Usa `set -e` para parar em caso de erro
- Gera output visual com emojis e bordas

#### 2. **docker-compose-producao.yml** (Orquestração)
- Define 5 services:
  - `postgres`: Banco de dados (porta 5434)
  - `minio`: Armazenamento S3-compatible (portas 9010/9011)
  - `backend`: API Node.js/TypeScript (porta 3001)
  - `frontend`: Interface React/Vite (porta 3000)
  - `cron`: Verificação automática de perdas

#### 3. **Dockerfile.backend** (Build do Backend)
```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
RUN npm run build
CMD ["npm", "start"]
```

#### 4. **Dockerfile.frontend** (Build do Frontend)
```dockerfile
FROM node:18-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
ARG VITE_API_URL
ENV VITE_API_URL=$VITE_API_URL
RUN npm run build

FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
```

---

## ⚙️ Componentes Essenciais

### O que **NÃO PODE FALTAR** no Auto-Instalador:

#### 1. **Verificação de Dependências**
```bash
# Docker
if ! command -v docker &> /dev/null; then
    echo "❌ Docker não encontrado!"
    exit 1
fi

# Docker Compose
if ! command -v docker compose &> /dev/null; then
    echo "❌ Docker Compose não encontrado!"
    exit 1
fi
```

#### 2. **Detecção de IP Público**
```bash
HOST_IP=$(curl -4 -s ifconfig.me || curl -4 -s icanhazip.com || curl -4 -s ipinfo.io/ip || echo "")
```
- Usa 3 serviços diferentes (fallback)
- Força IPv4 com flag `-4`
- Se falhar, pede entrada manual

#### 3. **Instalação e Configuração do Tailscale**
```bash
# Instalar
curl -fsSL https://tailscale.com/install.sh | sh

# Limpar autenticação antiga
tailscale logout 2>/dev/null || true

# Iniciar com nova autenticação
tailscale up --reset --accept-routes --shields-up=false

# Aguardar até ter IP (timeout 2 minutos)
while [ $ELAPSED -lt 120 ]; do
    TAILSCALE_IP=$(tailscale ip -4 2>/dev/null || echo "")
    if [ -n "$TAILSCALE_IP" ]; then
        break
    fi
    sleep 2
done
```

#### 4. **Geração de Senhas Seguras**
```bash
generate_password() {
    tr -dc 'A-Za-z0-9' < /dev/urandom | head -c 32
}

MINIO_ROOT_PASSWORD=$(generate_password)
POSTGRES_PASSWORD=$(generate_password)
JWT_SECRET=$(generate_password)
API_TOKEN=$(generate_password)
```
- Senhas de 32 caracteres
- Apenas letras e números (evita problemas de escape)

#### 5. **Criação do .env Completo**
```bash
cat > .env << EOF
HOST_IP=$HOST_IP
TAILSCALE_VPS_IP=$TAILSCALE_IP
POSTGRES_PASSWORD=$POSTGRES_PASSWORD
JWT_SECRET=$JWT_SECRET
EMAIL_USER=betotradicao76@gmail.com
EMAIL_PASS=fqojjjhztvganfya
FRONTEND_URL=http://$HOST_IP:3000
VITE_API_URL=http://$HOST_IP:3001/api
# ... (60 linhas de configurações)
EOF
```

#### 6. **Atualização do Código (Git Pull)**
```bash
# Salvar diretório do script ANTES de mudar
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

# Voltar para raiz do repositório
cd "$SCRIPT_DIR/.."

# Atualizar código
git fetch origin
git reset --hard origin/main
git pull origin main
```

#### 7. **Aguardar Backend Inicializar**
```bash
MAX_TRIES=60
while [ $TRY -lt $MAX_TRIES ]; do
    if curl -s http://localhost:3001/api/health > /dev/null 2>&1; then
        echo "✅ Backend inicializado!"
        break
    fi
    sleep 2
    TRY=$((TRY + 2))
done
```

#### 8. **Salvar Credenciais em Arquivo**
```bash
cat > CREDENCIAIS.txt << EOF
MinIO Usuário: $MINIO_ROOT_USER
MinIO Senha: $MINIO_ROOT_PASSWORD
PostgreSQL Senha: $POSTGRES_PASSWORD
API Token: $API_TOKEN
EOF
```

---

## 🔄 Fluxo de Execução Passo a Passo

### **ETAPA 1: Verificações Iniciais** (linhas 16-38)

```bash
# 1.1 Verificar se está rodando como root
if [ "$EUID" -ne 0 ]; then
    echo "⚠️ Recomenda-se executar como root"
fi

# 1.2 Verificar Docker
if ! command -v docker &> /dev/null; then
    exit 1
fi

# 1.3 Verificar Docker Compose
if ! command -v docker compose &> /dev/null; then
    exit 1
fi
```

**Resultado:** Sistema confirma que tem as ferramentas necessárias.

---

### **ETAPA 2: Atualizar Código do GitHub** (linhas 40-76)

```bash
# 2.1 Salvar diretório do script
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

# 2.2 Voltar para raiz
cd "$SCRIPT_DIR/.."

# 2.3 Git pull
if [ -d ".git" ]; then
    git fetch origin
    git reset --hard origin/main
    git pull origin main
fi

# 2.4 Voltar para InstaladorVPS
cd "$SCRIPT_DIR"

# 2.5 Verificar se docker-compose existe
if [ ! -f "docker-compose-producao.yml" ]; then
    exit 1
fi
```

**Resultado:** Código sempre atualizado com última versão do GitHub.

---

### **ETAPA 3: Detectar IP Público** (linhas 78-93)

```bash
# 3.1 Tentar múltiplos serviços
HOST_IP=$(curl -4 -s ifconfig.me || \
          curl -4 -s icanhazip.com || \
          curl -4 -s ipinfo.io/ip || \
          echo "")

# 3.2 Se falhar, pedir manual
if [ -z "$HOST_IP" ]; then
    read -p "Digite o IP público desta VPS: " HOST_IP
fi
```

**Resultado:** `HOST_IP=46.202.150.64` (exemplo)

---

### **ETAPA 4: Instalar e Configurar Tailscale** (linhas 95-165)

#### 4.1 Instalar Tailscale (se necessário)
```bash
if ! command -v tailscale &> /dev/null; then
    curl -fsSL https://tailscale.com/install.sh | sh
fi
```

#### 4.2 Limpar autenticação antiga
```bash
tailscale logout 2>/dev/null || true
rm -f /tmp/tailscale-auth.log
```

#### 4.3 Iniciar com nova autenticação
```bash
tailscale up --reset --accept-routes --shields-up=false 2>&1 | tee /tmp/tailscale-auth.log &
```

#### 4.4 Extrair link de autenticação
```bash
sleep 5
TAILSCALE_AUTH_URL=$(grep -o 'https://login.tailscale.com/a/[a-z0-9]*' /tmp/tailscale-auth.log | head -n 1)
```

#### 4.5 Aguardar autenticação (timeout 2 minutos)
```bash
MAX_WAIT=120
while [ $ELAPSED -lt $MAX_WAIT ]; do
    TAILSCALE_IP=$(tailscale ip -4 2>/dev/null || echo "")
    if [ -n "$TAILSCALE_IP" ]; then
        break
    fi
    sleep 2
    ELAPSED=$((ELAPSED + 2))
done
```

#### 4.6 Se timeout, pedir manual
```bash
if [ -z "$TAILSCALE_IP" ]; then
    read -p "Digite o IP Tailscale da VPS manualmente: " TAILSCALE_IP
fi
```

**Resultado:** `TAILSCALE_IP=100.99.57.69` (exemplo)

---

### **ETAPA 5: IP Tailscale do Cliente** (linhas 167-187)

```bash
# 5.1 Pedir IP do cliente (com timeout de 30s)
read -t 30 -p "IP Tailscale da máquina do cliente (deixe vazio ou aguarde 30s): " TAILSCALE_CLIENT_IP || TAILSCALE_CLIENT_IP=""

# 5.2 Se vazio, avisar
if [ -z "$TAILSCALE_CLIENT_IP" ]; then
    echo "⚠️ Sem IP Tailscale do cliente. Conexão com ERP será local/manual."
fi
```

**Resultado:** `TAILSCALE_CLIENT_IP=100.69.131.40` (exemplo, ou vazio)

---

### **ETAPA 6: Gerar Senhas Aleatórias** (linhas 189-212)

```bash
# 6.1 Função geradora
generate_password() {
    tr -dc 'A-Za-z0-9' < /dev/urandom | head -c 32
}

# 6.2 Gerar senhas
MINIO_ROOT_USER="admin"
MINIO_ROOT_PASSWORD=$(generate_password)
POSTGRES_PASSWORD=$(generate_password)
JWT_SECRET=$(generate_password)
API_TOKEN=$(generate_password)
```

**Resultado:**
- `MINIO_ROOT_PASSWORD=oqT2cWEmaFca7hOTnl6nP6tjdRL1JFkW`
- `POSTGRES_PASSWORD=Vx5t0pShK9vvVJ9yOPpiroutIzHfy2wq`
- `JWT_SECRET=Q2wcGEWtpddF33R5mFy4zvkGSAaVmFuL`
- `API_TOKEN=opsDY5ec2mSGURnJG19s0n07D3NQmMrR`

---

### **ETAPA 7: Criar Arquivo .env** (linhas 214-284)

```bash
cat > .env << EOF
# IP da VPS
HOST_IP=$HOST_IP

# TAILSCALE
TAILSCALE_VPS_IP=$TAILSCALE_IP
TAILSCALE_CLIENT_IP=$TAILSCALE_CLIENT_IP

# MINIO
MINIO_ROOT_USER=$MINIO_ROOT_USER
MINIO_ROOT_PASSWORD=$MINIO_ROOT_PASSWORD

# POSTGRESQL
POSTGRES_USER=$POSTGRES_USER
POSTGRES_PASSWORD=$POSTGRES_PASSWORD

# BACKEND
JWT_SECRET=$JWT_SECRET
API_TOKEN=$API_TOKEN

# EMAIL (PRÉ-CONFIGURADO)
EMAIL_USER=betotradicao76@gmail.com
EMAIL_PASS=fqojjjhztvganfya
FRONTEND_URL=http://$HOST_IP:3000

# FRONTEND
VITE_API_URL=http://$HOST_IP:3001/api
EOF
```

**Resultado:** Arquivo `.env` criado com 60 linhas de configurações.

---

### **ETAPA 8: Iniciar Containers Docker** (linhas 286-310)

```bash
# 8.1 Limpar containers antigos
docker compose -f docker-compose-producao.yml down -v 2>/dev/null || true

# 8.2 Iniciar com build
docker compose -f docker-compose-producao.yml up -d --build

# 8.3 Aguardar containers iniciarem
sleep 10
```

**Resultado:**
- PostgreSQL rodando na porta 5434
- MinIO rodando nas portas 9010/9011
- Backend rodando na porta 3001
- Frontend rodando na porta 3000
- Cron rodando em background

---

### **ETAPA 9: Aguardar Backend e Exibir Credenciais** (linhas 312-515)

#### 9.1 Aguardar backend responder (timeout 2 minutos)
```bash
MAX_TRIES=60
while [ $TRY -lt $MAX_TRIES ]; do
    if curl -s http://localhost:3001/api/health > /dev/null 2>&1; then
        echo "✅ Backend inicializado!"
        break
    fi
    sleep 2
    TRY=$((TRY + 2))
done
```

#### 9.2 Exibir status dos containers
```bash
docker compose -f docker-compose-producao.yml ps
```

#### 9.3 Exibir informações de acesso
```bash
echo "🌐 ACESSO AO SISTEMA:"
echo "   Interface Web: http://$HOST_IP:3000"
echo "   Primeiro acesso: http://$HOST_IP:3000/first-setup"
echo "   Backend API: http://$HOST_IP:3001"
```

#### 9.4 Salvar credenciais em arquivo
```bash
cat > CREDENCIAIS.txt << EOF
MinIO Console: http://$HOST_IP:9011
MinIO Usuário: $MINIO_ROOT_USER
MinIO Senha: $MINIO_ROOT_PASSWORD

PostgreSQL Host: $HOST_IP
PostgreSQL Porta: 5434
PostgreSQL Senha: $POSTGRES_PASSWORD

API Token: $API_TOKEN
EOF
```

**Resultado:** Sistema instalado e rodando, credenciais exibidas e salvas.

---

## 🔗 Tailscale: VPS vs Cliente

### O que é Tailscale?

Tailscale cria uma **rede privada virtual (VPN)** segura entre a VPS e a máquina do cliente (Windows), permitindo comunicação direta mesmo que estejam em redes diferentes.

### Tailscale na VPS (Servidor)

#### O que o instalador faz automaticamente:

1. **Instala o Tailscale**
   ```bash
   curl -fsSL https://tailscale.com/install.sh | sh
   ```

2. **Limpa autenticação antiga**
   ```bash
   tailscale logout
   ```

3. **Inicia com autenticação nova**
   ```bash
   tailscale up --reset --accept-routes --shields-up=false
   ```
   - `--reset`: Força nova autenticação
   - `--accept-routes`: Aceita rotas da rede cliente
   - `--shields-up=false`: Permite receber conexões

4. **Detecta IP Tailscale automaticamente**
   ```bash
   tailscale ip -4
   ```
   - Exemplo: `100.99.57.69`

5. **Salva no .env**
   ```bash
   TAILSCALE_VPS_IP=100.99.57.69
   ```

6. **Backend usa automaticamente**
   - Ao iniciar, o backend lê `TAILSCALE_VPS_IP` do .env
   - Salva no banco de dados (tabela `configurations`)
   - Sistema pode usar para comunicação segura

### Tailscale no Cliente (Windows/Loja)

#### O que o CLIENTE precisa fazer manualmente:

1. **Baixar e Instalar Tailscale**
   - Acessar: https://tailscale.com/download/windows
   - Instalar o Tailscale for Windows

2. **Autenticar com a mesma conta**
   - Abrir Tailscale
   - Fazer login com a **mesma conta Google/Microsoft** da VPS
   - Isso adiciona a máquina Windows à mesma rede

3. **Verificar IP Tailscale**
   - Abrir Tailscale → Ver IP
   - Exemplo: `100.69.131.40`

4. **Informar IP durante instalação**
   - Quando o instalador da VPS perguntar:
     ```
     IP Tailscale da máquina do cliente: 100.69.131.40
     ```
   - OU configurar depois em: Sistema → Configurações → Tailscale

5. **Testar conectividade**
   ```cmd
   ping 100.99.57.69
   ```
   - Deve responder com tempo < 100ms

### Por que Tailscale é importante?

| Sem Tailscale | Com Tailscale |
|---------------|---------------|
| Cliente precisa abrir portas no roteador | Conexão direta sem configurar firewall |
| IP pode mudar (DHCP) | IP Tailscale é fixo |
| Conexão não criptografada | Tráfego 100% criptografado |
| Vulnerável a ataques | Rede privada segura |
| Difícil acessar ERP remotamente | VPS acessa ERP como se estivesse na rede local |

### Fluxo de Comunicação com Tailscale:

```
LOJA (Cliente)                          VPS (Servidor)
├─ Windows 10/11                        ├─ Ubuntu 22.04
├─ Sistema ERP (local)                  ├─ Docker Containers
│  └─ Porta: 3050                       │  ├─ Frontend :3000
├─ Tailscale Client                     │  ├─ Backend :3001
│  └─ IP: 100.69.131.40                 │  ├─ PostgreSQL :5434
│                                       │  └─ MinIO :9010
│                                       ├─ Tailscale Daemon
│                                       │  └─ IP: 100.99.57.69
│                                       │
└──── CONEXÃO SEGURA (VPN) ─────────────┘
```

### Como o Sistema Usa Tailscale:

1. **Scanner envia produto perdido para VPS**
   ```
   Scanner → Backend (100.99.57.69:3001)
   ```

2. **VPS busca informações do produto no ERP do cliente**
   ```
   Backend → ERP Cliente (100.69.131.40:3050)
   ```

3. **VPS retorna resposta ao scanner**
   ```
   Backend → Scanner (resposta com dados do produto)
   ```

---

## 📝 Configurações Pré-preenchidas

O auto-instalador já vem com estas configurações **pré-definidas**:

### 1. **Email de Recuperação de Senha**
```bash
EMAIL_USER=betotradicao76@gmail.com
EMAIL_PASS=fqojjjhztvganfya
```
- Conta Gmail do desenvolvedor (Roberto)
- App Password gerado especificamente para o sistema
- Usado para enviar emails de "Esqueci minha senha"

### 2. **MinIO Bucket**
```bash
MINIO_BUCKET_NAME=market-security
```
- Nome do bucket padrão para armazenar imagens/vídeos
- Criado automaticamente pelo backend no primeiro boot

### 3. **Configurações do Backend**
```bash
NODE_ENV=production
PORT=3001
```
- Ambiente de produção
- Backend escuta na porta 3001

### 4. **PostgreSQL Database**
```bash
POSTGRES_DB=prevencao_db
DB_NAME=prevencao_db
```
- Nome fixo do banco de dados

### 5. **Conexão Interna Docker**
```bash
DB_HOST=postgres
MINIO_ENDPOINT=minio
```
- Containers se comunicam via rede interna Docker
- Não usam IP externo

---

## 🎯 O que Precisa ser Configurado Depois

Após executar o auto-instalador, o **cliente** precisa fazer:

### 1. **First Setup (Obrigatório)**

Acessar: `http://IP_DA_VPS:3000/first-setup`

**Informações necessárias:**

#### Dados do Administrador:
- Username (ex: `admin`)
- Nome completo
- Email
- Senha

#### Dados da Empresa:
- Nome Fantasia
- Razão Social
- CNPJ
- Responsável (nome, email, telefone)
- Endereço completo (CEP, rua, número, bairro, cidade, estado)
- Telefone da empresa
- Email da empresa

**O que acontece automaticamente:**
- ✅ Empresa criada no banco
- ✅ Usuário ADMIN vinculado à empresa (isMaster=false)
- ✅ Usuário pode fazer login

---

### 2. **Integração WhatsApp - Evolution API (Opcional)**

Acessar: `Sistema → Configurações → WhatsApp`

**O que configurar:**

| Campo | Valor | Onde conseguir |
|-------|-------|----------------|
| URL Evolution API | `https://seu-servidor-evolution.com` | Servidor Evolution API do cliente |
| Nome da Instância | `DVR FACIAL` | Nome criado no Evolution API |
| Token de API | `F0A82E6394D6-4D5A-845A-FC0413873588` | Token gerado no Evolution API |

**Como testar:**
- Botão "Testar Conexão"
- Status deve mostrar: ✅ Conectado

---

### 3. **Integração DVR - Facial (Opcional)**

Acessar: `Sistema → Configurações → DVR`

**O que configurar:**

| Campo | Valor | Descrição |
|-------|-------|-----------|
| IP do DVR | `192.168.1.100` | IP local do DVR Intelbras |
| Porta | `80` | Porta padrão (HTTP) ou 443 (HTTPS) |
| Usuário | `admin` | Usuário do DVR |
| Senha | `********` | Senha do DVR |
| Tipo | `Intelbras` | Marca/modelo do DVR |

**Como testar:**
- Botão "Testar Conexão"
- Sistema tenta acessar API do DVR

---

### 4. **Configurar Scanners de Código de Barras (Obrigatório)**

Acessar: `Sistema → Configurações → Scanners`

**Para cada scanner:**

| Campo | Valor | Como conseguir |
|-------|-------|----------------|
| Nome | `ENTRADA PRINCIPAL` | Identificação do local |
| Setor | `ENTRADA` | Setor onde está instalado |
| IP do Scanner | `192.168.1.50` | IP fixo na rede local |
| API Token | `(copiar do CREDENCIAIS.txt)` | Token gerado na instalação |
| Status | `Ativo` | Marcar como ativo |

**Configuração no Scanner (Windows):**

1. **Instalar leitor de código de barras** (USB)
   - Conectar scanner via USB
   - Windows detecta como "teclado HID"

2. **Criar script de captura** (exemplo):
   ```batch
   @echo off
   :loop
   set /p barcode="Aguardando leitura: "
   curl -X POST http://46.202.150.64:3001/api/scan ^
        -H "Authorization: Bearer opsDY5ec2mSGURnJG19s0n07D3NQmMrR" ^
        -H "Content-Type: application/json" ^
        -d "{\"barcode\":\"%barcode%\"}"
   goto loop
   ```

3. **Configurar para iniciar automaticamente**
   - Criar atalho no `shell:startup`

---

### 5. **Configurar IP Tailscale do Cliente (Se Aplicável)**

Acessar: `Sistema → Configurações → Tailscale`

**Se não configurou durante instalação:**

| Campo | Valor | Como conseguir |
|-------|-------|----------------|
| IP Tailscale VPS | `100.99.57.69` | Já preenchido automaticamente |
| IP Tailscale Cliente | `100.69.131.40` | Abrir Tailscale no Windows → Ver IP |

**Testar conectividade:**
```bash
ping 100.69.131.40
```

---

## 🛠️ Como Montar um Auto-Instalador

### Pré-requisitos para Criar um Auto-Instalador:

1. **Aplicação Dockerizada**
   - `Dockerfile` para cada serviço
   - `docker-compose.yml` para orquestração

2. **Variáveis de Ambiente Bem Definidas**
   - Listar TODAS as variáveis necessárias
   - Separar: geradas automaticamente vs. configuradas manualmente

3. **Repositório Git**
   - Código versionado no GitHub/GitLab
   - Branch principal (main/master)

4. **Script de Seed/Migrations**
   - Criar banco de dados automaticamente
   - Popular configurações iniciais

---

### Estrutura Mínima de um Auto-Instalador:

```bash
#!/bin/bash
set -e

# ===================================
# 1. VERIFICAÇÕES INICIAIS
# ===================================
# - Docker instalado?
# - Docker Compose instalado?
# - Root/sudo?

# ===================================
# 2. ATUALIZAR CÓDIGO
# ===================================
# - git pull origin main

# ===================================
# 3. DETECTAR INFORMAÇÕES
# ===================================
# - IP público da VPS
# - Hostname
# - Outros IPs necessários

# ===================================
# 4. GERAR SENHAS ALEATÓRIAS
# ===================================
# - Banco de dados
# - Serviços (MinIO, Redis, etc)
# - JWT Secret
# - API Tokens

# ===================================
# 5. CRIAR ARQUIVO .env
# ===================================
# - Todas as variáveis de ambiente
# - IPs detectados
# - Senhas geradas

# ===================================
# 6. LIMPAR E INICIAR CONTAINERS
# ===================================
# - docker compose down -v
# - docker compose up -d --build

# ===================================
# 7. AGUARDAR SERVIÇOS
# ===================================
# - Health checks
# - Curl/ping até responder

# ===================================
# 8. EXIBIR INFORMAÇÕES
# ===================================
# - URLs de acesso
# - Credenciais geradas
# - Próximos passos

# ===================================
# 9. SALVAR CREDENCIAIS
# ===================================
# - Arquivo CREDENCIAIS.txt
# - Backup do .env
```

---

### Checklist de Componentes:

- [ ] **Verificação de Docker/Docker Compose**
- [ ] **Atualização de código (git pull)**
- [ ] **Detecção de IP público**
- [ ] **Instalação de VPN (Tailscale/WireGuard) - se aplicável**
- [ ] **Geração de senhas seguras**
- [ ] **Criação de .env completo**
- [ ] **Limpeza de containers antigos**
- [ ] **Build e start dos containers**
- [ ] **Health checks / aguardar serviços**
- [ ] **Exibição de credenciais**
- [ ] **Salvamento de credenciais em arquivo**
- [ ] **Instruções de próximos passos**

---

### Exemplo de Função Útil: Aguardar Serviço

```bash
wait_for_service() {
    local url=$1
    local max_tries=$2
    local try=0

    echo "⏳ Aguardando $url..."

    while [ $try -lt $max_tries ]; do
        if curl -s "$url" > /dev/null 2>&1; then
            echo "✅ Serviço respondeu!"
            return 0
        fi

        if [ $((try % 5)) -eq 0 ]; then
            echo "   Tentativa $try/$max_tries..."
        fi

        sleep 2
        try=$((try + 2))
    done

    echo "❌ Timeout esperando $url"
    return 1
}

# Uso:
wait_for_service "http://localhost:3001/api/health" 60
```

---

### Exemplo de Função: Detectar IP com Fallback

```bash
detect_public_ip() {
    local ip=""

    # Tentar múltiplos serviços
    ip=$(curl -4 -s --max-time 5 ifconfig.me 2>/dev/null || echo "")

    if [ -z "$ip" ]; then
        ip=$(curl -4 -s --max-time 5 icanhazip.com 2>/dev/null || echo "")
    fi

    if [ -z "$ip" ]; then
        ip=$(curl -4 -s --max-time 5 ipinfo.io/ip 2>/dev/null || echo "")
    fi

    # Se falhou, pedir manual
    if [ -z "$ip" ]; then
        echo "⚠️ Não foi possível detectar IP automaticamente"
        read -p "Digite o IP público desta VPS: " ip
    fi

    echo "$ip"
}

# Uso:
HOST_IP=$(detect_public_ip)
```

---

## 📦 Comandos Úteis Pós-Instalação

### Ver Logs em Tempo Real

```bash
# Backend
docker logs prevencao-backend-prod -f

# Frontend
docker logs prevencao-frontend-prod -f

# PostgreSQL
docker logs prevencao-postgres-prod -f

# Todos os containers
docker compose -f docker-compose-producao.yml logs -f
```

---

### Parar/Reiniciar/Atualizar

```bash
# Parar todos os containers
docker compose -f docker-compose-producao.yml down

# Reiniciar todos os containers
docker compose -f docker-compose-producao.yml restart

# Atualizar e reconstruir (git pull + rebuild)
cd /root/prevencao-radar-install
git pull
cd InstaladorVPS
docker compose -f docker-compose-producao.yml up -d --build

# Reconstruir SEM cache (se mudanças não aparecem)
docker compose -f docker-compose-producao.yml build --no-cache backend
docker compose -f docker-compose-producao.yml up -d backend
```

---

### Acessar Console do Container

```bash
# Backend (Node.js)
docker exec -it prevencao-backend-prod sh

# PostgreSQL
docker exec -it prevencao-postgres-prod psql -U postgres -d prevencao_db

# Frontend (Nginx)
docker exec -it prevencao-frontend-prod sh
```

---

### Backup do Banco de Dados

```bash
# Fazer backup
docker exec prevencao-postgres-prod pg_dump -U postgres prevencao_db > backup_$(date +%Y%m%d).sql

# Restaurar backup
cat backup_20250106.sql | docker exec -i prevencao-postgres-prod psql -U postgres -d prevencao_db
```

---

### Ver Status dos Containers

```bash
docker compose -f docker-compose-producao.yml ps
```

---

### Verificar Uso de Recursos

```bash
docker stats
```

---

### Limpar Containers/Imagens Antigas

```bash
# Remover containers parados
docker container prune

# Remover imagens não usadas
docker image prune -a

# Remover volumes não usados
docker volume prune

# Limpar TUDO (cuidado!)
docker system prune -a --volumes
```

---

## 🔗 Link do Auto-Instalador

### Para executar o auto-instalador em uma VPS Linux limpa:

```bash
curl -fsSL https://raw.githubusercontent.com/rsrsantos/prevencao-no-radar/main/InstaladorVPS/INSTALAR-AUTO.sh | sudo bash
```

### OU baixar e executar:

```bash
# 1. Clonar repositório
git clone https://github.com/rsrsantos/prevencao-no-radar.git
cd prevencao-no-radar/InstaladorVPS

# 2. Dar permissão de execução
chmod +x INSTALAR-AUTO.sh

# 3. Executar
sudo ./INSTALAR-AUTO.sh
```

---

## ⚡ Requisitos da VPS

### Especificações Mínimas:

- **Sistema Operacional:** Ubuntu 20.04+ ou Debian 11+
- **RAM:** 4 GB (recomendado: 8 GB)
- **CPU:** 2 cores (recomendado: 4 cores)
- **Disco:** 20 GB (recomendado: 50 GB)
- **Conexão:** IP público fixo

### Softwares Instalados Automaticamente:

- Docker Engine
- Docker Compose
- Tailscale VPN
- PostgreSQL 15 (via Docker)
- MinIO (via Docker)
- Node.js 18 (via Docker)
- Nginx (via Docker)

---

## 📞 Suporte

Em caso de dúvidas ou problemas durante a instalação:

1. **Verificar logs:**
   ```bash
   docker compose -f docker-compose-producao.yml logs -f
   ```

2. **Verificar status dos containers:**
   ```bash
   docker compose -f docker-compose-producao.yml ps
   ```

3. **Contato:** Roberto (desenvolvedor)
   - Email: betotradicao76@gmail.com

---

**Desenvolvido por:** Roberto Santos
**Última atualização:** Janeiro 2026
