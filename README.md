# Market Security System - Sistema de Prevenção e Inteligência Contra Furtos

Sistema completo de monitoramento e prevenção de furtos desenvolvido para mercados, com funcionalidades de rastreamento de produtos, análise de bipagens e detecção de fraudes.

---

## 🚀 Instalação Rápida

Escolha o método de instalação de acordo com sua necessidade:

### 📁 Opção 1: Instalação via Docker (Recomendado para Produção)

**Ideal para**: Instalações rápidas, ambientes isolados, produção

```bash
cd InstaladorDOCKER
# Clique com botão direito em INSTALAR-AUTO.bat
# Selecione "Executar como Administrador"
```

📖 **Documentação completa**: [InstaladorDOCKER/README.md](InstaladorDOCKER/README.md)

---

### 🏠 Opção 2: Instalação Interna (Desenvolvimento/Rede Local)

**Ideal para**: Desenvolvimento, rede interna, máquinas 24/7

```bash
cd InstaladorINTERNO
# Clique com botão direito em INSTALAR-AUTO.bat
# Selecione "Executar como Administrador"
```

**Inclui**:
- ✅ Auto-start invisível (inicia com Windows)
- ✅ Monitor automático (reinicia se cair)
- ✅ PM2 (gerenciamento de processos)
- ✅ Ngrok (acesso externo - opcional)

📖 **Documentação completa**: [InstaladorINTERNO/README.md](InstaladorINTERNO/README.md)

---

## 📥 Pré-requisitos e Downloads

Antes de instalar, você precisará baixar alguns programas dependendo do método escolhido:

### 🐳 Para instalação via **Docker** (InstaladorDOCKER):

#### 1️⃣ Docker Desktop (Obrigatório)
- 📦 **O que é:** Motor que roda os containers Docker
- 💾 **Tamanho:** ~500 MB
- 🖥️ **Compatível:** Windows 10/11 (com interface gráfica)
- 🔗 **Download:** https://www.docker.com/products/docker-desktop/
- 📖 **Instruções:**
  1. Baixar Docker Desktop
  2. Executar instalador
  3. Reiniciar o computador
  4. Abrir Docker Desktop (precisa estar rodando para usar)

⚠️ **Nota:** Docker Desktop NÃO funciona em Windows Server sem interface gráfica!

---

### 🏠 Para instalação **Manual/Interno** (InstaladorINTERNO):

Os instaladores automáticos (`INSTALAR-AUTO.bat`) já baixam tudo, mas você pode baixar manualmente:

#### 1️⃣ Node.js 20 LTS (Obrigatório)
- 📦 **O que é:** Ambiente de execução JavaScript (roda Backend + Frontend)
- 💾 **Tamanho:** ~50 MB
- 🔗 **Download:** https://nodejs.org/
- 📖 **Instruções:**
  1. Baixar versão **LTS** (20.x)
  2. Executar instalador
  3. Marcar **"Add to PATH"** durante instalação
  4. Verificar: abrir CMD e digitar `node --version`

#### 2️⃣ PostgreSQL 16 (Obrigatório)
- 📦 **O que é:** Banco de dados relacional
- 💾 **Tamanho:** ~350 MB
- 🔗 **Download:** https://www.postgresql.org/download/windows/
- 📖 **Instruções:**
  1. Baixar PostgreSQL 16
  2. Executar instalador
  3. **ANOTAR A SENHA** que você criar para o usuário `postgres`
  4. Porta padrão: `5432` (deixar como está)
  5. Instalar todos os componentes oferecidos

#### 3️⃣ Git (Opcional, mas recomendado)
- 📦 **O que é:** Controle de versão (para atualizar o sistema)
- 💾 **Tamanho:** ~50 MB
- 🔗 **Download:** https://git-scm.com/download/win
- 📖 **Instruções:**
  1. Baixar Git for Windows
  2. Executar instalador (pode deixar opções padrão)
  3. Verificar: abrir CMD e digitar `git --version`

#### 4️⃣ Python 3.11+ (Opcional - apenas se usar Scanner Service)
- 📦 **O que é:** Necessário para o serviço de scanner de código de barras
- 💾 **Tamanho:** ~30 MB
- 🔗 **Download:** https://www.python.org/downloads/
- 📖 **Instruções:**
  1. Baixar Python 3.11 ou superior
  2. **IMPORTANTE:** Marcar **"Add Python to PATH"** durante instalação
  3. Verificar: abrir CMD e digitar `python --version`

---

### ☁️ Para VPS (Servidor Linux):

Se você vai instalar em uma VPS Linux (Ubuntu/Debian):

#### Docker + Docker Compose (Recomendado)
```bash
# Instalar Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# Instalar Docker Compose
sudo apt-get update
sudo apt-get install docker-compose-plugin

# Verificar instalação
docker --version
docker compose version
```

#### Alternativa Manual (não recomendado)
```bash
# Instalar Node.js 20
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# Instalar PostgreSQL 16
sudo apt-get install postgresql-16

# Instalar PM2
sudo npm install -g pm2
```

---

### 🎯 Resumo por Método:

| Método | Programas Necessários | Download Total | Tempo Instalação |
|--------|----------------------|----------------|------------------|
| **🐳 Docker** | Docker Desktop | ~500 MB | ~10 min |
| **🏠 Manual** | Node.js + PostgreSQL + Git | ~450 MB | ~30-45 min |
| **☁️ VPS Linux + Docker** | Via terminal (apt/curl) | ~600 MB | ~15 min |

---

### ✅ Checklist Antes de Instalar:

#### Para Docker:
- [ ] Windows 10/11 com interface gráfica
- [ ] Mínimo 4 GB RAM (recomendado 8 GB)
- [ ] Docker Desktop instalado e **rodando**
- [ ] Hyper-V ou WSL2 ativado (Docker Desktop ativa automaticamente)

#### Para Manual/Interno:
- [ ] Windows 10/11 ou Windows Server
- [ ] Node.js 20 LTS instalado
- [ ] PostgreSQL 16 instalado (senha anotada!)
- [ ] Git instalado (opcional)
- [ ] Executar instalador como **Administrador**

---

## ⚖️ Como Escolher: ONDE hospedar + COMO instalar

### 🤔 Entendendo as 2 Decisões:

Esta é uma escolha **bi-dimensional**:

1. **ONDE hospedar?** → Local (rede do cliente) vs VPS (nuvem)
2. **COMO instalar?** → Docker (containers) vs Manual/Interno (Windows)

---

## 🌍 DECISÃO 1: ONDE hospedar?

### 📊 Comparação: Local vs VPS

| Critério | 🏠 Rede Local (Cliente) | ☁️ VPS (Nuvem) | Vencedor |
|----------|------------------------|----------------|----------|
| **Custo mensal** | ⭐⭐⭐⭐⭐ R$ 0 (usa PC do cliente) | ⭐⭐⭐ ~R$ 60-100/mês | 🏠 Local |
| **Acesso externo** | ⭐⭐ Ngrok (cai a cada 2h, URLs aleatórias) | ⭐⭐⭐⭐⭐ IP fixo, domínio próprio | ☁️ VPS |
| **Disponibilidade** | ⭐⭐⭐ Depende do PC do cliente | ⭐⭐⭐⭐⭐ 99.9% uptime garantido | ☁️ VPS |
| **Performance** | ⭐⭐⭐⭐ Acesso local (<1ms) | ⭐⭐⭐⭐ Internet (10-50ms) | 🏠 Local |
| **Manutenção** | ⭐⭐ Cliente pode desligar, problemas de energia | ⭐⭐⭐⭐⭐ Gerenciado, backups automáticos | ☁️ VPS |
| **Configuração inicial** | ⭐⭐⭐⭐ Mais simples | ⭐⭐⭐ Requer DNS, SSL | 🏠 Local |
| **APIs locais (Zanthus)** | ⭐⭐⭐⭐⭐ Acesso direto (10.6.1.101) | ⭐⭐ Precisa VPN ou expor API | 🏠 Local |
| **Múltiplas lojas** | ⭐⭐ Cada loja tem sua instalação | ⭐⭐⭐⭐⭐ Centralizador, multi-tenant | ☁️ VPS |

---

### ✅ Quando usar **REDE LOCAL**:

**Cenários ideais:**
- ✅ Cliente tem 1 loja apenas
- ✅ APIs do ERP (Zanthus, Intersolid) rodam **na rede local** (10.6.1.x)
- ✅ Cliente tem PC 24/7 disponível
- ✅ Não precisa acesso externo (ou Ngrok é suficiente)
- ✅ Budget limitado (R$ 0/mês)

**Exemplo prático:**
```
📍 Mercado Tradição SJC
├── PC do escritório (sempre ligado)
├── Zanthus ERP (10.6.1.101 - VMware local)
├── Intersolid (10.6.1.102 - VMware local)
└── Market Security instalado no mesmo PC
    ⚡ Acesso local: <1ms
    🌐 Ngrok (opcional): acesso externo
```

**Vantagens:**
- 💰 **Custo zero** de hospedagem
- ⚡ **Super rápido** (acesso local)
- 🔗 **Acesso direto** às APIs locais (Zanthus)
- 🛠️ **Controle total** do cliente

**Desvantagens:**
- ⚠️ Depende do PC estar ligado 24/7
- ⚠️ Ngrok instável (cai a cada 2h, URLs mudam)
- ⚠️ Problemas de energia/hardware param tudo
- ⚠️ Difícil centralizar dados de múltiplas lojas

---

### ✅ Quando usar **VPS (Nuvem)**:

**Cenários ideais:**
- ✅ Cliente tem **múltiplas lojas**
- ✅ Precisa de **domínio próprio** (tradicaosjc.com.br)
- ✅ Precisa acesso externo **estável** (sem Ngrok)
- ✅ APIs do ERP estão **na nuvem** ou acessíveis via internet
- ✅ Quer **centralizar dados** de todas as lojas

**Exemplo prático:**
```
☁️ VPS Contabo (187.90.96.96)
├── tradicaosjc.com.br → Frontend
├── api.tradicaosjc.com.br → Backend
├── PostgreSQL (centralizado)
├── MinIO (fotos de todas as lojas)
└── Acesso de qualquer lugar
    📱 Smartphone: OK
    💻 Escritório: OK
    🏪 Loja 1, 2, 3...: OK
```

**Vantagens:**
- 🌐 **IP fixo** + domínio próprio
- ⏰ **99.9% uptime** garantido
- 📊 **Centralizado**: dados de todas as lojas em 1 lugar
- 🔐 **SSL grátis** (Let's Encrypt)
- 📈 **Escalável**: cresce conforme necessário
- 🔄 **Backups automáticos**

**Desvantagens:**
- 💰 **Custo**: ~R$ 60-100/mês (VPS + domínio)
- ⚙️ **Configuração inicial** mais complexa (DNS, SSL)
- 🔗 APIs locais (Zanthus) precisam **VPN ou exposição**
- 🌍 Latência de internet (10-50ms vs <1ms local)

---

## 🔧 DECISÃO 2: COMO instalar?

**IMPORTANTE:** Esta decisão **independe de ONDE** hospedar!
- Pode instalar Docker **na rede local** do cliente
- Pode instalar Manual **na VPS**

### 📊 Comparação: Docker vs Manual/Interno

| Critério | 🐳 Docker | 📁 Manual/Interno | Vencedor |
|----------|-----------|-------------------|----------|
| **Instalação** | ⭐⭐⭐⭐⭐ 1 clique (5 min) | ⭐⭐⭐ Manual (30-45 min) | 🐳 Docker |
| **Isolamento** | ⭐⭐⭐⭐⭐ Containers isolados | ⭐⭐ Processos no Windows | 🐳 Docker |
| **Portabilidade** | ⭐⭐⭐⭐⭐ Windows/Linux/Mac | ⭐⭐⭐ Só Windows | 🐳 Docker |
| **Atualizações** | ⭐⭐⭐⭐⭐ Rebuild (2 min) | ⭐⭐⭐ Manual (git + npm) | 🐳 Docker |
| **Uso de RAM** | ⭐⭐⭐ ~2 GB | ⭐⭐⭐⭐⭐ ~500 MB | 📁 Manual |
| **Velocidade** | ⭐⭐⭐ ~30s inicializar | ⭐⭐⭐⭐⭐ ~5s inicializar | 📁 Manual |
| **Auto-start invisível** | ⭐⭐⭐ Possível | ⭐⭐⭐⭐⭐ Nativo (PowerShell) | 📁 Manual |
| **Ngrok incluído** | ⭐⭐ Config extra | ⭐⭐⭐⭐⭐ Já configurado | 📁 Manual |
| **Hot reload (dev)** | ⭐⭐⭐ Mais lento | ⭐⭐⭐⭐⭐ Instantâneo | 📁 Manual |

---

### ✅ Quando usar **DOCKER**:

**Ideal para:**
- ✅ **VPS (Linux)** - Docker é padrão na nuvem
- ✅ Instalação em **múltiplos clientes** (padronização)
- ✅ **Produção/Cliente** - isolamento e segurança
- ✅ Facilitar **atualizações futuras**
- ✅ Equipe **sem experiência** em Node.js

**Vantagens:**
- 🚀 **Instalação 1 clique** (5-10 minutos)
- 🎯 **Tudo isolado** (não bagunça o sistema)
- 🔄 **Atualizar = rebuild** (super fácil)
- 📦 **Portável** (funciona em qualquer OS)
- 🛠️ **Padronizado** (todos os clientes iguais)

**Desvantagens:**
- 💾 **Mais pesado** (~2 GB RAM)
- ⏱️ **Inicialização lenta** (~30 segundos)
- 🔧 **Hot reload lento** (desenvolvimento)

---

### ✅ Quando usar **MANUAL/INTERNO**:

**Ideal para:**
- ✅ **Desenvolvimento** local
- ✅ Rede local **Windows** com Ngrok
- ✅ Máquinas com **poucos recursos** (<4 GB RAM)
- ✅ Precisa **auto-start invisível** no Windows
- ✅ **Hot reload rápido** (programação)

**Vantagens:**
- ⚡ **Super leve** (~500 MB RAM)
- 🚀 **Inicialização instantânea** (~5 segundos)
- 🔧 **Hot reload rápido** (desenvolvimento)
- 👻 **Auto-start invisível** (PowerShell)
- 🌐 **Ngrok já configurado**

**Desvantagens:**
- ⏰ **Instalação demorada** (30-45 min)
- 🪟 **Só Windows** (não portável)
- 🔄 **Atualizar = manual** (git pull + npm install)
- 🔨 Requer **conhecimento técnico**

---

## 🎯 Matriz de Decisão: 4 Combinações Possíveis

```
┌──────────────────────────────────────────────────────────────┐
│                    ONDE + COMO INSTALAR                      │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  1️⃣ LOCAL + DOCKER                                          │
│     ✅ Instalação rápida no PC do cliente                    │
│     ✅ Isolado do Windows                                    │
│     ⚠️ Consome mais RAM (~2 GB)                             │
│     🎯 Ideal: Cliente quer fácil, tem PC potente             │
│                                                              │
│  2️⃣ LOCAL + MANUAL (InstaladorINTERNO)                      │
│     ✅ Super leve (~500 MB RAM)                             │
│     ✅ Auto-start invisível + Ngrok                          │
│     ✅ Acesso direto APIs locais                            │
│     ⚠️ Instalação demorada                                   │
│     🎯 Ideal: Desenvolvimento ou PC 24/7 simples             │
│                                                              │
│  3️⃣ VPS + DOCKER ⭐ RECOMENDADO PRODUÇÃO                     │
│     ✅ 99.9% uptime + IP fixo                               │
│     ✅ Domínio próprio + SSL grátis                          │
│     ✅ Fácil atualizar e escalar                            │
│     💰 ~R$ 60-100/mês                                        │
│     🎯 Ideal: Múltiplas lojas, profissional                  │
│                                                              │
│  4️⃣ VPS + MANUAL                                            │
│     ✅ Mais leve que Docker                                 │
│     ⚠️ Instalação manual na VPS                              │
│     ⚠️ Difícil manter (sem isolamento)                       │
│     ❌ NÃO recomendado (use Docker na VPS)                   │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

---

## 🏆 Recomendação por Cenário:

### 🎓 **Desenvolvimento / Testes**
→ **LOCAL + MANUAL** (InstaladorINTERNO)
- Hot reload rápido
- Ngrok para testes externos
- Leve e responsivo

### 🏪 **Cliente 1 loja (budget baixo)**
→ **LOCAL + DOCKER**
- Instalação rápida (5 min)
- Isolado e seguro
- R$ 0/mês

### 🏢 **Cliente múltiplas lojas**
→ **VPS + DOCKER** ⭐
- Centralizado
- Domínio próprio
- Escalável
- ~R$ 60-100/mês

### 🔬 **Cliente 1 loja (profissional)**
→ **VPS + DOCKER**
- 99.9% uptime
- Acesso de qualquer lugar
- Fácil manutenção

---

## 📂 Estrutura do Projeto

```
roberto-prevencao-no-radar-main/
│
├── 📁 InstaladorDOCKER/           # Instalação via Docker
│   ├── INSTALAR-AUTO.bat          # ← Instalador automático (1 botão)
│   ├── docker-compose-producao.yml              # Produção (padrão)
│   ├── docker-compose-producao-portainer.yml    # Produção + Portainer Web UI
│   ├── Dockerfile.backend
│   ├── Dockerfile.frontend
│   └── README.md
│
├── 📁 InstaladorINTERNO/          # Instalação local/rede interna
│   ├── INSTALAR-AUTO.bat          # ← Instalador automático (1 botão)
│   ├── startup-invisible.ps1      # Auto-start invisível
│   ├── monitor-e-reiniciar.vbs    # Monitor de processos
│   ├── ngrok.yml                  # Configuração Ngrok
│   ├── ngrok.exe                  # Executável Ngrok
│   ├── minio.exe                  # Executável MinIO
│   ├── task-prevencao-radar.xml   # Tarefa Windows
│   └── README.md
│
├── 📁 CREDENCIAIS/                 # ⚠️ Senhas e acessos importantes
│   ├── portainer.md               # Credenciais Portainer
│   ├── seguranca-sistema.md       # Sistema de proteção (Beto/Beto3107)
│   └── ngrok.md                   # Token Ngrok
│
├── 📁 BACKUPS-E-APRENDIZADOS/     # Backups e documentação antiga
│   ├── docs/                      # Guias e tutoriais antigos
│   └── *.sql                      # Backups do banco de dados
│
├── 📁 scripts/                     # Scripts de manutenção e testes
│   ├── manutencao/                # Backup, firewall, proteção
│   ├── testes/                    # Scripts de teste do banco
│   ├── INICIAR-CRON.bat
│   └── VER-LOGS-CRON.bat
│
├── 📁 packages/                    # Código-fonte
│   ├── backend/                   # API Express + TypeScript
│   └── frontend/                  # React + TypeScript
│
├── 📁 logs/                        # Logs do PM2 (gerados automaticamente)
├── 📁 minio-data/                  # Armazenamento de fotos/vídeos (27 MB+)
│
├── 📄 ecosystem.config.js          # Configuração PM2
├── 📄 docker-compose-desenvolvimento.yml  # Docker local (desenvolvimento)
├── 📄 package.json                 # Dependências do monorepo
└── 📄 README.md                    # Este arquivo
```

### 📋 Explicação das Pastas:

| Pasta | Descrição | Commit no Git? |
|-------|-----------|----------------|
| **InstaladorDOCKER/** | Instalação via Docker (1 botão) | ✅ Sim |
| **InstaladorINTERNO/** | Instalação local com auto-start | ✅ Sim (exceto .exe) |
| **CREDENCIAIS/** | Senhas importantes (Portainer, Beto, Ngrok) | ✅ Sim |
| **BACKUPS-E-APRENDIZADOS/** | Backups SQL + docs antigos | ❌ Não (.gitignore) |
| **scripts/** | Manutenção e testes | ✅ Sim |
| **packages/** | Código-fonte (backend + frontend) | ✅ Sim |
| **logs/** | Logs do PM2 (gerados automaticamente) | ❌ Não (.gitignore) |
| **minio-data/** | Fotos e vídeos das bipagens | ❌ Não (.gitignore) |

---

## 🗂️ Arquivos de Configuração Importantes

### 🐳 **Arquivos Docker Compose - Qual Usar?**

O projeto possui **3 arquivos Docker Compose** com nomenclatura clara:

| Arquivo | Onde fica | Para que serve | Quando usar |
|---------|-----------|----------------|-------------|
| **`docker-compose-desenvolvimento.yml`** | Raiz do projeto | Hot reload, logs verbosos, portas debug | Desenvolvimento local (você programando) |
| **`docker-compose-producao.yml`** | InstaladorDOCKER/ | Build otimizado, senhas seguras, produção | Instalação em cliente/produção |
| **`docker-compose-producao-portainer.yml`** | InstaladorDOCKER/ | Produção + Portainer (painel web) | VPS com gerenciamento via navegador |

#### 📝 Exemplos de uso:

```bash
# Desenvolvimento (raiz do projeto)
docker compose -f docker-compose-desenvolvimento.yml up

# Produção (InstaladorDOCKER/)
cd InstaladorDOCKER
docker compose -f docker-compose-producao.yml up -d

# Produção + Portainer (VPS)
cd InstaladorDOCKER
docker compose -f docker-compose-producao-portainer.yml up -d
```

**Nota:** O `INSTALAR-AUTO.bat` já usa automaticamente o `docker-compose-producao.yml`!

---

### **`.dockerignore`** vs **`docker-compose-*.yml`**

| Arquivo | O que é | Para que serve |
|---------|---------|----------------|
| **`.dockerignore`** | Lista de exclusão | Define o que **NÃO vai** para dentro da imagem Docker |
| **`docker-compose-*.yml`** | Orquestração | Define **como rodar** múltiplos containers Docker |

#### 📝 `.dockerignore` - O que NÃO vai pro Docker:
```
node_modules/     ← ~500 MB (Docker roda npm install internamente)
minio-data/       ← Fotos/vídeos (dados locais)
logs/             ← Logs temporários
.env              ← Senhas (usa variáveis de ambiente)
*.exe             ← Executáveis grandes
```

**Por quê?** Deixar a imagem Docker **menor** (de 2 GB para 500 MB) e **mais rápida** para buildar.

#### 🐳 `docker-compose-*.yml` - Como rodar os containers:

Todos os arquivos docker-compose definem estes serviços:
```yaml
services:
  postgres:        ← Banco de dados
  backend:         ← API Express
  frontend:        ← React App
  minio:           ← Armazenamento de arquivos
  # + portainer (apenas docker-compose-producao-portainer.yml)
```

**Diferença entre eles:**
- `desenvolvimento`: Hot reload, portas debug, logs detalhados
- `producao`: Build otimizado, senhas via .env, modo produção
- `producao-portainer`: Produção + interface web Portainer (porta 9000)

**Por quê?** Orquestrar múltiplos serviços que precisam conversar entre si.

---

## 🗄️ MinIO e minio-data/

### O que é MinIO?
**MinIO** = Servidor de armazenamento de objetos (como Amazon S3, mas local)

### Para que serve?
```
Scanner bipa produto → 📸 Tira foto → 💾 Salva no MinIO (minio-data/)
                     → 🎥 Grava vídeo → 📋 Backend guarda link no banco
```

### Tamanho atual:
- **minio-data/**: ~27 MB (dados de teste)
- **Produção**: Pode crescer para 100+ GB (fazer backup regular!)

### Por que não vai pro Git?
- ✅ Já está no `.gitignore`
- ✅ Protege privacidade dos clientes (fotos/vídeos)
- ✅ Muito grande para GitHub (limite de 100 MB por arquivo)

---

## 🔒 Credenciais e Segurança

Todas as credenciais importantes estão organizadas na pasta **`CREDENCIAIS/`**:

- **Portainer**: Admin do painel Docker
- **Segurança do Sistema**: Usuário: `Beto` / Senha: `Beto3107`
- **Ngrok**: Token de autenticação para túneis externos

⚠️ **IMPORTANTE**: Mantenha esta pasta segura e não compartilhe publicamente!

---

## 🌐 Acessos após Instalação

| Serviço | URL | Descrição |
|---------|-----|-----------|
| **Frontend** | http://localhost:3004 | Interface web do sistema |
| **Backend** | http://localhost:3001 | API REST |
| **MinIO API** | http://localhost:9010 | Servidor de arquivos (fotos/vídeos) |
| **MinIO Console** | http://localhost:9011 | Gerenciamento de arquivos (interface) |
| **Swagger** | http://localhost:3001/api-docs | Documentação da API |

### 📸 MinIO - Configuração de Acesso

O MinIO usa **duas portas diferentes**:
- **Porta 9010**: API de arquivos (usado pelo backend e navegadores para acessar imagens/vídeos)
- **Porta 9011**: Console de gerenciamento (interface web administrativa)

**URLs públicas** (para acesso externo):
- Configure no painel de Configurações do sistema
- Endpoint público: IP da rede local (ex: `10.6.1.171`)
- Porta pública: `9010`

**Login padrão do sistema**:
- Email: `admin@tradicaosjc.com.br`
- Senha: `admin123`

⚠️ **Altere a senha após o primeiro login!**

---

## 🏗️ Arquitetura do Sistema

### Backend
- **Express.js** - Framework web
- **TypeScript** - Tipagem estática
- **TypeORM** - ORM para PostgreSQL
- **JWT** - Autenticação
- **Swagger** - Documentação da API
- **node-cron** - Agendamento de tarefas

### Frontend
- **React 19** - Interface de usuário
- **TypeScript** - Tipagem estática
- **Tailwind CSS** - Framework CSS
- **React Router** - Roteamento
- **Axios** - Cliente HTTP
- **Vite** - Build tool

### Infraestrutura
- **PostgreSQL** - Banco de dados
- **MinIO** - Armazenamento de objetos (S3-compatible)
- **PM2** - Gerenciador de processos Node.js
- **Docker** - Containerização
- **Ngrok** - Túneis externos (opcional)

---

## 🎯 Funcionalidades Principais

### Dashboard
- Visão geral do sistema
- Métricas em tempo real
- Navegação principal

### Bipagens Ao Vivo
- Monitoramento em tempo real
- Filtros avançados
- Fotos e vídeos das bipagens
- Lazy loading para performance

### Ativar Produtos
- Gestão de produtos do ERP
- Ativação/desativação individual e em massa
- Interface otimizada para mobile
- Sincronização com Zanthus ERP

### Resultados do Dia
- Análise de vendas vs bipagens
- Identificação de possíveis furtos
- Relatórios detalhados
- Alertas automáticos

### Autenticação e Recuperação de Senha
- **Login Seguro**: Autenticação JWT com hash bcrypt
- **Recuperação de Senha por Email**: Sistema completo de reset de senha
  - Envio de email com link de recuperação (válido por 1 hora)
  - Token seguro com hash SHA-256
  - Email profissional estilizado com template HTML
  - Integração com Gmail via SMTP (nodemailer)
  - Fallback para console caso email falhe
- **Primeiro Acesso**: Wizard de configuração inicial
- **Gerenciamento de Usuários**: CRUD completo de usuários com roles (master, admin, user)

### Configurações
- **APIs**: Integração com Zanthus, Intersolid, Evolution API
- **WhatsApp**: Notificações automáticas via Evolution API
- **Rede**: Gerenciamento de equipamentos e scanners
- **Segurança**: Controle de acesso e permissões
- **Email**: Configuração de SMTP para recuperação de senha
- **Simulador**: Teste de bipagens para desenvolvimento

---

## 🔄 Processo de Cron Jobs

O sistema possui cron jobs automáticos que rodam às **5h da manhã**:

1. Busca vendas do dia anterior via API do ERP
2. Filtra produtos ativos no sistema
3. Valida contra bipagens registradas
4. Salva resultados na tabela `sells`
5. Envia alertas via WhatsApp (se configurado)

---

## 🛠️ Comandos Úteis

### Docker (InstaladorDOCKER):
```bash
# Ver status dos containers
docker-compose ps

# Ver logs
docker-compose logs -f

# Parar tudo
docker-compose down

# Reiniciar
docker-compose restart
```

### PM2 (InstaladorINTERNO):
```bash
# Ver processos rodando
pm2 list

# Ver logs em tempo real
pm2 logs

# Parar tudo
pm2 stop all

# Reiniciar
pm2 restart all
```

---

## 📱 Responsividade

O sistema foi desenvolvido com **mobile-first approach**:
- Interface adaptativa para todos os tamanhos de tela
- Touch-friendly para tablets e smartphones
- Componentes otimizados para performance mobile

---

## 📧 Configuração de Email (Recuperação de Senha)

O sistema possui recuperação de senha via email. Para configurar:

### 1. Configurar Gmail com Senha de App

1. Acesse sua conta Google: https://myaccount.google.com
2. Vá em **Segurança** → **Verificação em duas etapas** (ative se não estiver)
3. Acesse **Senhas de app**: https://myaccount.google.com/apppasswords
4. Crie uma nova senha de app:
   - Nome do app: "Prevenção no Radar"
   - Copie a senha gerada (16 caracteres)

### 2. Configurar no .env

Edite o arquivo `packages/backend/.env`:

```env
# Email (Recuperação de Senha)
EMAIL_USER=seuemail@gmail.com
EMAIL_PASS=senha_app_16_caracteres
FRONTEND_URL=http://localhost:3004
```

### 3. Testar

Execute o script de teste:
```bash
cd packages/backend
node test-email.js
```

### Troubleshooting

**Erro "Username and Password not accepted"**:
- Verifique se a Verificação em 2 etapas está ATIVADA
- Confirme que copiou a senha de app corretamente (sem espaços)
- Verifique se o email está correto
- Crie uma NOVA senha de app

**Email não chega**:
- Verifique a pasta de SPAM
- Confirme que o email está cadastrado no sistema
- Veja os logs do backend para confirmar envio

---

## 🔒 Segurança

- Autenticação JWT
- Middleware de autenticação em todas as rotas protegidas
- Hash de senhas com bcrypt (10 rounds)
- Validação de entrada com express-validator
- CORS configurado
- Sistema de proteção de arquivos (ver `CREDENCIAIS/seguranca-sistema.md`)
- Recuperação de senha com token SHA-256 (válido por 1 hora)
- Senhas de app para email (não expõe senha principal)

---

## 📞 Suporte e Documentação

### Documentação Específica:
- **Instalação Docker**: [InstaladorDOCKER/README.md](InstaladorDOCKER/README.md)
- **Instalação Interna**: [InstaladorINTERNO/README.md](InstaladorINTERNO/README.md)
- **Credenciais**: Pasta `CREDENCIAIS/`

### Solução de Problemas:

**Sistema não inicia**:
1. Verifique se todas as portas estão livres (3001, 3004, 5432, 9010, 9011)
2. Confirme que executou o instalador como Administrador
3. Verifique os logs: `pm2 logs` ou `docker-compose logs`

**Erro de conexão com banco**:
1. Verifique se PostgreSQL está rodando
2. Confirme as credenciais no arquivo `.env`
3. Teste a conexão: `psql -h localhost -U admin -d market_security`

**Problemas com auto-start (InstaladorINTERNO)**:
1. Verifique o registro do Windows: `Win+R` → `regedit` → `HKEY_CURRENT_USER\Software\Microsoft\Windows\CurrentVersion\Run`
2. Confirme que o script `startup-invisible.ps1` existe
3. Execute manualmente para testar: `powershell -File InstaladorINTERNO\startup-invisible.ps1`

---

## 🚀 Deploy em Produção

Para deploy em produção via Docker + Portainer:

1. Acesse a pasta `InstaladorDOCKER/`
2. Configure o arquivo `.env` com credenciais de produção
3. Use o `docker-compose.portainer.yml` para deploy via Portainer
4. Configure certificados SSL/TLS
5. Configure backup automático do banco de dados

**Credenciais do Portainer**: Ver `CREDENCIAIS/portainer.md`

---

## 📝 Licença e Versão

- **Versão**: 1.0
- **Data**: 2025-12-11
- **Desenvolvido para**: Tradicão SJC e clientes
- **Stack**: Node.js + React + PostgreSQL + MinIO

---

## 🎓 Para Desenvolvedores

### Estrutura de Código:
```
packages/
├── backend/
│   ├── src/
│   │   ├── controllers/    # Controladores da API
│   │   ├── entities/       # Entidades TypeORM
│   │   ├── middleware/     # Middlewares Express
│   │   ├── migrations/     # Migrations do banco
│   │   ├── routes/         # Rotas da API
│   │   ├── services/       # Serviços e lógica de negócio
│   │   └── config/         # Configurações
│   └── package.json
└── frontend/
    ├── src/
    │   ├── components/     # Componentes React
    │   ├── pages/          # Páginas da aplicação
    │   ├── services/       # Serviços HTTP (Axios)
    │   └── utils/          # Utilitários
    └── package.json
```

### Desenvolvimento Local:
```bash
# Instalar dependências
npm install
cd packages/backend && npm install
cd ../frontend && npm install

# Executar migrações
cd packages/backend
npm run migration:run

# Iniciar backend (modo dev)
npm run dev

# Iniciar frontend (modo dev)
cd packages/frontend
npm run dev
```

---

**🔥 Pronto para começar? Escolha um instalador acima e execute!**
