# Roberto Prevenção no Radar - Modo 24/7 com Docker

## 🚀 Como usar o sistema 24/7

Agora você pode rodar o sistema completo (Frontend + Backend + Banco + MinIO) em modo 24/7 usando Docker Compose.

### ✅ Pré-requisitos

1. **Docker Desktop** instalado e rodando no Windows
2. Ter certeza que o Docker está configurado para iniciar automaticamente com o Windows

### 📂 Scripts Disponíveis

Na raiz do projeto, você encontrará os seguintes scripts:

#### 1. `start.bat` - Iniciar o sistema
```bash
# Duplo clique ou execute no terminal:
start.bat
```
**O que faz:**
- Inicia todos os serviços em background
- Frontend, Backend, PostgreSQL, MinIO e Swagger
- Mostra os URLs de acesso

#### 2. `stop.bat` - Parar o sistema
```bash
stop.bat
```
**O que faz:**
- Para todos os containers
- Mantém os dados salvos (banco de dados, uploads, etc)

#### 3. `restart.bat` - Reiniciar o sistema
```bash
restart.bat
```
**O que faz:**
- Para e inicia novamente todos os serviços
- Útil quando você faz alterações no código

#### 4. `logs.bat` - Ver logs em tempo real
```bash
logs.bat
```
**O que faz:**
- Mostra os logs de todos os serviços
- Pressione `Ctrl+C` para sair

### 🌐 URLs de Acesso

Após iniciar com `start.bat`, você pode acessar:

- **Frontend (Interface)**: http://localhost:3002
- **Backend (API)**: http://localhost:3001
- **Swagger (Documentação API)**: http://localhost:8080
- **MinIO (Console)**: http://localhost:9001
  - Usuário: `minioadmin`
  - Senha: `minioadmin123`

### 🔄 Política de Restart Automático

Todos os serviços estão configurados com `restart: unless-stopped`, o que significa:

- ✅ Se o container travar, ele reinicia automaticamente
- ✅ Se você reiniciar o Windows, os containers voltam a rodar sozinhos
- ✅ Só param se você executar `stop.bat` ou `docker-compose down`

### 💾 Persistência de Dados

Os dados são salvos em volumes Docker e **NÃO são perdidos** quando você para o sistema:

- `postgres_data` - Todos os dados do banco de dados
- `minio_data` - Todos os uploads de imagens/avatares

### 📋 Comandos Manuais (via terminal)

Se preferir usar comandos diretos:

```bash
# Iniciar
docker-compose up -d

# Parar
docker-compose down

# Ver logs
docker-compose logs -f

# Ver status
docker-compose ps

# Rebuild (após mudanças no Dockerfile)
docker-compose up -d --build

# Parar e remover tudo (CUIDADO: apaga os volumes!)
docker-compose down -v
```

### 🔧 Troubleshooting

#### Problema: "Port already in use"
**Solução:** Algum serviço já está usando a porta. Pare os processos manuais:
```bash
# Para frontend manual
# Encontre e mate o processo na porta 3002/3003

# Para backend manual
# Encontre e mate o processo na porta 3001
```

#### Problema: Containers não iniciam
**Solução:**
1. Verifique se o Docker Desktop está rodando
2. Execute: `docker-compose logs` para ver os erros
3. Execute: `docker-compose down && docker-compose up -d --build`

#### Problema: Mudanças no código não aparecem
**Solução:**
- O Docker está com hot-reload configurado
- Se não funcionar, execute: `restart.bat`

### ⚠️ IMPORTANTE

**Esta configuração é para desenvolvimento LOCAL apenas!**

- ❌ **NÃO** modifique as configurações do Portainer (servidor de produção)
- ❌ **NÃO** use esta configuração em produção
- ✅ Esta é sua cópia de desenvolvimento para melhorias

### 🎯 Workflow Recomendado

**Para desenvolvimento diário:**
1. Ligue o Windows
2. O Docker já sobe automaticamente
3. Acesse http://localhost:3002
4. Trabalhe normalmente

**Quando terminar:**
- Não precisa parar! O sistema fica rodando 24/7
- Se quiser economizar recursos: execute `stop.bat`

**Após fazer mudanças no código:**
- O hot-reload já atualiza automaticamente
- Se não funcionar: execute `restart.bat`

### 🔐 Credenciais

**Banco de Dados (PostgreSQL):**
- Host: `localhost`
- Porta: `5433` (externa) / `5432` (interna)
- Database: `market_security`
- Usuário: `admin`
- Senha: `admin123`

**MinIO:**
- Console: http://localhost:9001
- Usuário: `minioadmin`
- Senha: `minioadmin123`

### 📊 Monitoramento

Para ver o uso de recursos:
```bash
docker stats
```

Para ver quais containers estão rodando:
```bash
docker ps
```

---

**Criado em:** 2025-12-07
**Propósito:** Desenvolvimento local 24/7 sem precisar iniciar manualmente
