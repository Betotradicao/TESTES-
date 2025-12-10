# 🐳 Guia de Instalação com Docker

## 📋 Pré-requisitos

### 1. Instalar Docker Desktop

**Download:** https://www.docker.com/products/docker-desktop

**Requisitos mínimos:**
- Windows 10/11 Pro, Enterprise ou Education (64-bit)
- 4 GB de RAM (recomendado: 8 GB)
- Virtualização habilitada na BIOS
- WSL 2 (Windows Subsystem for Linux)

**Passos de instalação:**
1. Baixe o instalador do Docker Desktop
2. Execute o instalador
3. Marque a opção "Use WSL 2 instead of Hyper-V"
4. Reinicie o computador quando solicitado
5. Abra o Docker Desktop e aguarde inicializar

### 2. Verificar Instalação

Abra o **Prompt de Comando** ou **PowerShell** e execute:

```cmd
docker --version
docker-compose --version
```

Deve aparecer algo como:
```
Docker version 24.0.x
Docker Compose version v2.x.x
```

## 🚀 Instalação do Sistema

### Opção 1: Instalação Automática (RECOMENDADO)

1. **Copie toda a pasta do projeto** para o computador do cliente
2. **Execute como Administrador:** `INSTALAR-DOCKER.bat`
3. **Aguarde** a instalação (5-10 minutos na primeira vez)
4. **Acesse:** http://localhost:3004

### Opção 2: Instalação Manual

```cmd
# 1. Construir as imagens
docker-compose build

# 2. Iniciar os containers
docker-compose up -d

# 3. Verificar status
docker-compose ps
```

## 🎯 Uso Diário

### Iniciar Sistema
```cmd
iniciar-docker.bat
```
ou
```cmd
docker-compose up -d
```

### Parar Sistema
```cmd
parar-docker.bat
```
ou
```cmd
docker-compose down
```

### Ver Logs
```cmd
logs-docker.bat
```
ou
```cmd
docker-compose logs -f
```

### Ver Status
```cmd
status-docker.bat
```
ou
```cmd
docker-compose ps
```

## 💾 Backup e Restauração

### Fazer Backup

```cmd
backup-docker.bat
```

Isso cria uma pasta `backup_YYYYMMDD_HHMMSS` com:
- ✅ Dump do banco de dados
- ✅ Arquivos do MinIO
- ✅ Arquivos de configuração

### Restaurar Backup

```cmd
# 1. Parar o sistema
parar-docker.bat

# 2. Restaurar banco de dados
docker-compose up -d postgres
docker exec -i market-security-db psql -U postgres market_security < backup_XXXXXX\database.sql

# 3. Restaurar MinIO
docker run --rm -v roberto-prevencao-no-radar-main_minio_data:/data -v %cd%\backup_XXXXXX:/backup alpine tar xzf /backup/minio-data.tar.gz -C /data

# 4. Iniciar sistema completo
iniciar-docker.bat
```

## 🔧 Resolução de Problemas

### Erro: "Docker daemon is not running"

**Solução:**
1. Abra o Docker Desktop
2. Aguarde aparecer "Docker Desktop is running"
3. Tente novamente

### Erro: "Port already in use"

**Solução:**
```cmd
# Verificar o que está usando a porta
netstat -ano | findstr :3001
netstat -ano | findstr :3004
netstat -ano | findstr :5432

# Matar o processo (substitua XXXX pelo PID)
taskkill /PID XXXX /F
```

### Containers não iniciam

**Solução:**
```cmd
# Ver logs detalhados
docker-compose logs

# Reiniciar do zero
docker-compose down -v
docker-compose up -d
```

### Banco de dados com erro

**Solução:**
```cmd
# Recriar apenas o banco
docker-compose stop postgres
docker-compose rm -f postgres
docker volume rm roberto-prevencao-no-radar-main_postgres_data
docker-compose up -d postgres
```

### Limpar tudo e recomeçar

**Solução:**
```cmd
limpar-docker.bat
```
⚠️ **ATENÇÃO:** Isso apaga TODOS os dados!

## 📊 Monitoramento

### Ver uso de recursos

```cmd
docker stats
```

### Ver logs de um serviço específico

```cmd
# Backend
docker-compose logs -f backend

# Frontend
docker-compose logs -f frontend

# Banco de dados
docker-compose logs -f postgres

# MinIO
docker-compose logs -f minio
```

### Acessar terminal de um container

```cmd
# Backend
docker-compose exec backend sh

# Banco de dados
docker-compose exec postgres psql -U postgres market_security
```

## 🔄 Atualização

```cmd
# 1. Fazer backup
backup-docker.bat

# 2. Baixar nova versão
git pull

# 3. Reconstruir e reiniciar
docker-compose down
docker-compose build
docker-compose up -d
```

## 🌐 URLs de Acesso

- **Frontend:** http://localhost:3004
- **Backend API:** http://localhost:3001
- **MinIO Console:** http://localhost:9001
- **Swagger (API Docs):** http://localhost:3001/api-docs

## 🔑 Credenciais Padrão

### Sistema
- **Email:** beto@master.com
- **Senha:** Beto2025

### MinIO
- **User:** f0a02f9d4320abc34679f4742eecbad1
- **Password:** 3e928e13c609385d81df326d680074f2d69434d752c44fa3161ddf89dcdaca55

### PostgreSQL
- **User:** postgres
- **Password:** admin123
- **Database:** market_security

## 📁 Estrutura de Volumes

Os dados persistentes ficam salvos em:
- `roberto-prevencao-no-radar-main_postgres_data` - Banco de dados
- `roberto-prevencao-no-radar-main_minio_data` - Arquivos/Imagens

Para ver onde estão fisicamente:
```cmd
docker volume inspect roberto-prevencao-no-radar-main_postgres_data
```

## 🆘 Suporte

Se tiver problemas:
1. Verifique os logs: `logs-docker.bat`
2. Verifique o status: `status-docker.bat`
3. Tente reiniciar: `parar-docker.bat` + `iniciar-docker.bat`
4. Se nada funcionar: `limpar-docker.bat` + `INSTALAR-DOCKER.bat`
