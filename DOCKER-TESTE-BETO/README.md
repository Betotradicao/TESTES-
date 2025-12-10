# 🐳 Prevenção no Radar - Versão Docker para Produção

## 📋 O que é esta pasta?

Esta é a **versão Docker** do sistema Prevenção no Radar, criada para facilitar a instalação em múltiplas máquinas (lojas, filiais, etc).

### ✅ Vantagens desta versão:

- **Instalação rápida**: Um único comando instala tudo
- **Isolada**: Não conflita com outras instalações
- **Portável**: Funciona em qualquer máquina com Docker
- **Backup fácil**: Todos os dados em um só lugar
- **Atualizações simples**: Pull e restart

---

## 🚀 INSTALAÇÃO RÁPIDA

### Pré-requisitos:

1. **Windows 10/11 Pro** ou **Windows Server**
2. **Docker Desktop** instalado ([Download aqui](https://www.docker.com/products/docker-desktop/))
3. **Mínimo 4GB de RAM** disponível

### Passo a Passo:

1. **Copie esta pasta inteira** para a máquina de destino
2. **Clique duas vezes** em `INSTALAR.bat`
3. Aguarde a instalação (5-10 minutos)
4. Pronto! Acesse: `http://IP-DA-MAQUINA:8080`

---

## 📊 PORTAS UTILIZADAS

Esta versão usa portas **DIFERENTES** do Docker de desenvolvimento para **não conflitar**:

| Serviço | Porta Externa | Porta Interna | Acesso |
|---------|---------------|---------------|--------|
| Frontend | **8080** | 80 | http://IP:8080 |
| Backend API | **3011** | 3001 | http://IP:3011 |
| MinIO Storage | **9010** | 9000 | http://IP:9010 |
| MinIO Console | **9011** | 9001 | http://IP:9011 |
| PostgreSQL | **5434** | 5432 | localhost:5434 |
| **CRON** (automático) | - | - | Verificação automática |

---

## 🛠️ COMANDOS ÚTEIS

### Ver logs dos containers:
```bash
docker compose logs -f
```

### Ver logs de um serviço específico:
```bash
docker compose logs -f backend
docker compose logs -f frontend
docker compose logs -f postgres
docker compose logs -f minio
docker compose logs -f cron       # ⭐ IMPORTANTE: Ver logs da verificação automática
```

### Parar o sistema:
```bash
docker compose stop
```

### Iniciar o sistema:
```bash
docker compose start
```

### Reiniciar o sistema:
```bash
docker compose restart
```

### Ver status dos containers:
```bash
docker compose ps
```

### Atualizar o sistema:
```bash
# 1. Parar containers
docker compose down

# 2. Copiar nova versão dos arquivos

# 3. Rebuild e restart
docker compose build
docker compose up -d
```

### Desinstalar completamente:
```bash
# Remove containers, networks, mas MANTÉM os dados (volumes)
docker compose down

# Remove TUDO incluindo dados (use com cuidado!)
docker compose down -v
```

---

## 💾 BACKUP DOS DADOS

### Onde ficam os dados?

Todos os dados ficam em **volumes Docker**:

- `postgres-data`: Banco de dados
- `minio-data`: Imagens e vídeos
- `backend-uploads`: Uploads antigos (compatibilidade)

### Como fazer backup:

```bash
# 1. Parar containers
docker compose stop

# 2. Criar backup
docker run --rm -v prevencao-postgres-prod:/data -v C:\Backup:/backup alpine tar czf /backup/postgres-backup.tar.gz /data
docker run --rm -v prevencao-minio-prod:/data -v C:\Backup:/backup alpine tar czf /backup/minio-backup.tar.gz /data

# 3. Reiniciar containers
docker compose start
```

### Como restaurar backup:

```bash
# 1. Parar e remover containers
docker compose down

# 2. Restaurar volumes
docker run --rm -v prevencao-postgres-prod:/data -v C:\Backup:/backup alpine sh -c "cd /data && tar xzf /backup/postgres-backup.tar.gz --strip 1"
docker run --rm -v prevencao-minio-prod:/data -v C:\Backup:/backup alpine sh -c "cd /data && tar xzf /backup/minio-backup.tar.gz --strip 1"

# 3. Reiniciar
docker compose up -d
```

---

## ⚡ VERIFICAÇÃO AUTOMÁTICA (CRON) - **MUITO IMPORTANTE!**

### O que é e para que serve?

O sistema inclui um **serviço de CRON** que roda automaticamente em background e faz:

**A cada 2 minutos:**
- 🔄 Busca vendas do PDV (Zanthus API)
- 🔄 Cruza com bipagens pendentes
- 🔄 Muda status de "Pendente" → "Verificado" quando encontra match

**Às 8h da manhã:**
- 📊 Verificação completa do dia anterior
- 📧 Envia notificações (se configurado)

**A cada 1 hora:**
- ⚠️ Verifica se está recebendo bipagens
- ⚠️ Alerta se sistema parou de receber (mais de 1h sem bipagens)

### Como funciona?

O CRON **inicia automaticamente** quando você executa `INSTALAR.bat`. Não precisa fazer nada manual!

### Como verificar se está rodando?

```bash
# Ver containers rodando
docker compose ps

# Deve mostrar o container "prevencao-cron-prod" com status "Up"
```

### Como ver os logs do CRON?

```bash
# Ver logs em tempo real
docker compose logs -f cron

# Ver últimas 100 linhas
docker compose logs --tail=100 cron
```

### O que esperar nos logs?

**Logs normais (tudo OK):**
```
🚀 Iniciando verificação diária unificada...
Processed 2110 sales from Zanthus response
✅ 15 vendas inseridas/atualizadas
✅ 3 bipagens verificadas com sucesso
```

**Logs com erro (precisa corrigir):**
```
❌ Zanthus API not configured
❌ Cannot connect to database
❌ Connection timeout
```

### Resolução de Problemas:

**1. CRON não está rodando**
```bash
docker compose up -d cron
```

**2. CRON reinicia constantemente**
```bash
# Ver o erro nos logs
docker compose logs cron

# Geralmente é erro de configuração da API Zanthus
# Configure no sistema: Configurações → API Zanthus
```

**3. Bipagens não mudam de status**

Possíveis causas:
- API Zanthus não configurada
- EAN da bipagem está incorreto
- Diferença de preço maior que R$ 0,03
- Venda ainda não foi registrada no PDV

**Debug:**
```bash
docker compose logs cron | findstr "bipagens verificadas"
```

### Configuração da API Zanthus:

O CRON precisa que a API Zanthus esteja configurada no sistema:

1. Acesse o sistema: `http://IP:8080`
2. Vá em **Configurações**
3. Configure:
   - **URL da API Zanthus**: `http://IP-DO-SERVIDOR/manager/restful/...`
   - **Porta**: (se necessário)
   - **Endpoint**: (se necessário)

Sem essa configuração, o CRON **não consegue buscar vendas** e as bipagens ficam pendentes para sempre!

---

## 🔧 CONFIGURAÇÕES

### Alterar IP da máquina:

Edite o arquivo `.env`:

```env
HOST_IP=192.168.1.100
```

Depois, reinicie:

```bash
docker compose down
docker compose up -d
```

### Alterar senhas do banco:

Edite `docker-compose.yml` na seção `postgres` > `environment`

⚠️ **ATENÇÃO**: Se alterar após já ter criado o banco, você precisará recriar o volume!

---

## ❓ RESOLUÇÃO DE PROBLEMAS

### Container não inicia

```bash
# Ver logs do container
docker compose logs backend

# Verificar status
docker compose ps
```

### Porta já em uso

Edite `docker-compose.yml` e altere a porta externa:

```yaml
ports:
  - "8081:80"  # Era 8080:80
```

### Sem espaço em disco

```bash
# Limpar imagens não utilizadas
docker system prune -a

# Ver uso de espaço
docker system df
```

### Resetar banco de dados

```bash
# ⚠️ ISSO APAGA TODOS OS DADOS!
docker compose down -v
docker compose up -d
```

---

## 🆚 DIFERENÇA: DOCKER vs STANDALONE

| Aspecto | Versão Docker | Versão Standalone (atual) |
|---------|---------------|---------------------------|
| **Instalação** | 1 comando | 30-60 minutos manual |
| **Portabilidade** | Alta | Baixa |
| **Isolamento** | Total | Compartilhado |
| **Recursos** | Mais RAM | Menos RAM |
| **Backup** | Simples | Complexo |
| **Atualizações** | Automáticas | Manuais |
| **Desenvolvimento** | ❌ Lento | ✅ Rápido |
| **Produção** | ✅ Ideal | ⚠️ Funciona |

---

## 📞 SUPORTE

Em caso de problemas:

1. Verifique os logs: `docker compose logs -f`
2. Verifique o status: `docker compose ps`
3. Reinicie: `docker compose restart`
4. Entre em contato com o desenvolvedor

---

## 📝 NOTAS IMPORTANTES

### ✅ Esta versão:

- Usa **portas diferentes** (não conflita com Docker de dev)
- Usa **nomes diferentes** de containers
- Usa **volumes separados**
- É **100% isolada**

### ⚠️ NÃO use para desenvolvimento:

- Hot reload não funciona
- Rebuild lento para cada mudança
- Use a versão standalone ou Docker de dev

### 🎯 Use para produção:

- Instalação em lojas/filiais
- Ambiente 24/7
- Múltiplas máquinas
- Fácil atualização

---

**Versão**: 1.0.0
**Última atualização**: 2025-12-10
