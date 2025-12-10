# 🐳 Market Security - Instalação Docker

## 📦 O que foi criado?

Esta configuração Docker permite instalar **TODO o sistema com 1 clique**!

### ✅ Arquivos Criados:

```
📁 roberto-prevencao-no-radar-main/
├── 🐳 docker-compose.yml          # Orquestração de todos os serviços
├── 📄 .dockerignore                # Arquivos ignorados pelo Docker
│
├── 📁 packages/backend/
│   ├── 🐳 Dockerfile               # Imagem do Backend
│   └── 📄 .dockerignore
│
├── 📁 packages/frontend/
│   ├── 🐳 Dockerfile               # Imagem do Frontend
│   ├── ⚙️  nginx.conf              # Configuração do servidor web
│   └── 📄 .dockerignore
│
├── 🚀 INSTALAR-DOCKER.bat         # Instalador automático
├── ▶️  iniciar-docker.bat          # Iniciar sistema
├── ⏹️  parar-docker.bat            # Parar sistema
├── 📊 logs-docker.bat              # Ver logs
├── 📈 status-docker.bat            # Ver status
├── 💾 backup-docker.bat            # Fazer backup
├── 🗑️  limpar-docker.bat           # Limpar tudo
│
└── 📚 GUIA-INSTALACAO-DOCKER.md   # Guia completo
```

## 🎯 Serviços Incluídos

| Serviço | Descrição | Porta |
|---------|-----------|-------|
| **PostgreSQL** | Banco de dados | 5432 |
| **MinIO** | Armazenamento de arquivos | 9000, 9001 |
| **Backend** | API REST | 3001 |
| **Frontend** | Interface Web | 3004 |

> ⚠️ **NOTA:** O Scanner Service **NÃO** está no Docker porque precisa acessar scanners USB diretamente. Ele deve rodar FORA do Docker na máquina do cliente.

## 🚀 Como Usar

### 1️⃣ PRIMEIRA INSTALAÇÃO (Cliente Novo)

```cmd
# 1. Instale o Docker Desktop primeiro
https://www.docker.com/products/docker-desktop

# 2. Copie a pasta inteira do projeto

# 3. Execute (como Administrador)
INSTALAR-DOCKER.bat
```

**Tempo:** 5-10 minutos na primeira vez

### 2️⃣ USO DIÁRIO

```cmd
# Iniciar
iniciar-docker.bat

# Parar
parar-docker.bat

# Ver logs
logs-docker.bat

# Ver status
status-docker.bat
```

### 3️⃣ BACKUP

```cmd
# Fazer backup completo
backup-docker.bat

# Resultado: pasta backup_YYYYMMDD_HHMMSS/
```

## 💻 Instalação Completa em Cliente

### Passo a Passo Detalhado:

#### 1. **Preparar Pen Drive**

Copie para o pen drive:
```
📁 PEN DRIVE/
├── 📁 Market-Security/          # Projeto completo
├── 📁 Scanner-Service/          # INSTALADOR/ do barcode-service
└── 📄 DockerDesktopInstaller.exe
```

#### 2. **No Cliente - Instalar Docker**

```cmd
# Execute o instalador do Docker Desktop
DockerDesktopInstaller.exe

# Reinicie o computador quando solicitado
# Abra o Docker Desktop e aguarde ficar verde
```

#### 3. **No Cliente - Instalar Sistema**

```cmd
# 1. Copie Market-Security para C:\
C:\Market-Security\

# 2. Execute como Administrador
C:\Market-Security\INSTALAR-DOCKER.bat

# 3. Aguarde... (5-10 min)

# 4. Quando terminar, acesse:
http://localhost:3004
```

#### 4. **No Cliente - Instalar Scanner Service**

```cmd
# 1. Copie Scanner-Service para C:\
C:\Scanner-Service\

# 2. Execute como Administrador
C:\Scanner-Service\INSTALAR.bat

# 3. Configure scanners
```

## 🔧 Manutenção

### Atualizar Sistema

```cmd
# 1. Fazer backup
backup-docker.bat

# 2. Copiar nova versão do projeto

# 3. Reconstruir
parar-docker.bat
INSTALAR-DOCKER.bat
```

### Resolver Problemas

```cmd
# Ver logs de erro
logs-docker.bat

# Reiniciar tudo
parar-docker.bat
iniciar-docker.bat

# Se nada funcionar - RESET COMPLETO
limpar-docker.bat
INSTALAR-DOCKER.bat
```

## 📊 Comparação: Manual vs Docker

| Aspecto | Manual (Atual) | Docker |
|---------|----------------|--------|
| **Tempo instalação** | 2-3 horas | 5-10 min |
| **Complexidade** | Alta | Baixa |
| **Requisitos** | Node, PostgreSQL, Python, MinIO | Apenas Docker |
| **Backup** | Complexo | 1 comando |
| **Portabilidade** | Baixa | Alta |
| **Scanner Service** | ✅ Funciona | ❌ Roda fora |
| **Recomendado para** | Desenvolvimento | Produção/Clientes |

## 🎓 Comandos Docker Úteis

```cmd
# Ver todos os containers
docker ps -a

# Ver uso de recursos
docker stats

# Entrar no container do backend
docker-compose exec backend sh

# Entrar no banco de dados
docker-compose exec postgres psql -U postgres market_security

# Ver logs de um serviço específico
docker-compose logs -f backend

# Reconstruir uma imagem
docker-compose build backend
docker-compose up -d backend
```

## 🌐 URLs Após Instalação

- **Frontend:** http://localhost:3004
- **Backend:** http://localhost:3001
- **API Docs:** http://localhost:3001/api-docs
- **MinIO Console:** http://localhost:9001

## 🔑 Credenciais

### Sistema
- **Email:** beto@master.com
- **Senha:** Beto2025

### MinIO Console
- **User:** f0a02f9d4320abc34679f4742eecbad1
- **Password:** (ver docker-compose.yml)

## ⚡ Dicas Pro

### 1. Verificar Saúde dos Serviços

```cmd
# Backend
curl http://localhost:3001/api/health

# Frontend
curl http://localhost:3004

# PostgreSQL
docker-compose exec postgres pg_isready
```

### 2. Backup Automático (Agendado)

Crie uma Tarefa Agendada no Windows:
```cmd
schtasks /create /tn "Backup Market Security" /tr "C:\Market-Security\backup-docker.bat" /sc daily /st 23:00
```

### 3. Limpar Espaço em Disco

```cmd
# Remove imagens não usadas
docker image prune -a

# Remove tudo não usado
docker system prune -af
```

## 🆘 Troubleshooting

### Problema: Porta já em uso

```cmd
# Windows - Ver o que usa a porta 3001
netstat -ano | findstr :3001

# Matar processo (substitua PID)
taskkill /PID XXXX /F
```

### Problema: Container não inicia

```cmd
# Ver logs
docker-compose logs backend

# Recriar container
docker-compose stop backend
docker-compose rm -f backend
docker-compose up -d backend
```

### Problema: Banco de dados corrompido

```cmd
# Backup primeiro!
backup-docker.bat

# Recriar banco
docker-compose stop postgres
docker-compose rm -f postgres
docker volume rm roberto-prevencao-no-radar-main_postgres_data
docker-compose up -d postgres
```

## 📝 Notas Importantes

### ✅ O que Docker FAZ:
- ✅ Instala e configura PostgreSQL
- ✅ Instala e configura MinIO
- ✅ Roda Backend (Node.js)
- ✅ Roda Frontend (Nginx)
- ✅ Isola tudo em containers
- ✅ Gerencia redes e volumes

### ❌ O que Docker NÃO FAZ:
- ❌ Não roda Scanner Service (precisa USB)
- ❌ Não conecta com hardware USB
- ❌ Não substitui instalação do Docker Desktop

### 🔌 Scanner Service

O Scanner Service **DEVE** rodar FORA do Docker:

```cmd
# Instalar normalmente
C:\Scanner-Service\INSTALAR.bat

# Configurar para apontar para Docker
API_URL=http://localhost:3001/api
```

## 📚 Leitura Adicional

- [Guia Completo](GUIA-INSTALACAO-DOCKER.md)
- [Docker Desktop Docs](https://docs.docker.com/desktop/)
- [Docker Compose Docs](https://docs.docker.com/compose/)

## 🎉 Pronto!

Agora você tem 2 formas de instalar:

1. **Manual** → Para desenvolvimento
2. **Docker** → Para clientes/produção

Recomendo **Docker para clientes** = instalação em 5 minutos! 🚀
