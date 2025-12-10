# 🚀 COMO INICIAR O CRON NO PORTAINER

## Método 1: Via Interface do Portainer (RECOMENDADO)

### Passo 1: Acesse o Portainer
```
http://localhost:9443
```

### Passo 2: Entre no Stack
1. Clique em **Stacks** no menu lateral
2. Clique no stack do sistema (provavelmente `market-security` ou similar)

### Passo 3: Edite o docker-compose.yml
1. Clique em **Editor**
2. Role até o final do arquivo
3. O serviço `cron` já está lá (eu acabei de adicionar)
4. Se não estiver, copie e cole este trecho ANTES de `volumes:`:

```yaml
  cron:
    build:
      context: ./packages/backend
      dockerfile: Dockerfile.cron
    container_name: market-security-cron
    restart: unless-stopped
    environment:
      NODE_ENV: production
      DATABASE_URL: postgresql://admin:admin123@postgres:5432/market_security
      MINIO_ENDPOINT: minio
      MINIO_PUBLIC_ENDPOINT: localhost
      MINIO_PORT: 9000
      MINIO_ACCESS_KEY: minioadmin
      MINIO_SECRET_KEY: minioadmin123
      MINIO_USE_SSL: false
      MINIO_BUCKET_NAME: employee-avatars
    depends_on:
      postgres:
        condition: service_started
      minio:
        condition: service_healthy
    networks:
      - market-security-network
```

### Passo 4: Atualize o Stack
1. Role até o final da página
2. Clique em **Update the stack**
3. ✅ Marque: **Re-pull image and redeploy**
4. Clique em **Update**

### Passo 5: Aguarde o Build
- O Portainer vai:
  1. Fazer build da imagem do cron (2-5 minutos)
  2. Iniciar o container
  3. Mostrar status "running"

### Passo 6: Verifique se Funcionou
1. Vá em **Containers** no menu lateral
2. Procure por `market-security-cron`
3. Status deve ser: 🟢 **running**

### Passo 7: Ver os Logs
1. Clique no container `market-security-cron`
2. Clique em **Logs**
3. Você deve ver:
```
Starting cron service...
[Timestamp] Cron daemon started
```

---

## Método 2: Via Docker Compose CLI (se tiver Docker no PATH)

Se você tiver Docker Compose instalado e no PATH:

```bash
cd C:\Users\Administrator\Desktop\roberto-prevencao-no-radar-main

# Build da imagem
docker compose build cron

# Iniciar o serviço
docker compose up -d cron

# Ver logs
docker compose logs -f cron

# Ver status
docker compose ps cron
```

---

## Método 3: Via Script BAT

Execute o arquivo que criei:
```
scripts\INICIAR-CRON.bat
```

**IMPORTANTE:** Este script precisa que `docker` esteja no PATH do Windows.

Se não funcionar, use o **Método 1** (Portainer).

---

## ✅ Como Saber se Funcionou?

### No Portainer:
1. Containers → `market-security-cron` → Status: 🟢 **running**
2. Logs devem mostrar: `Cron daemon started`

### No Sistema:
1. Faça uma bipagem de teste
2. Aguarde 2-3 minutos
3. Verifique se a bipagem mudou de "Pendente" para "Verificado"

### Checklist Rápido:
- [ ] Container `market-security-cron` está rodando
- [ ] Logs não mostram erros
- [ ] Bipagens mudam de status após 2-3 minutos

---

## ⚠️ Problemas Comuns

### 1. "Build failed" no Portainer

**Causa:** Falta compilar o código TypeScript

**Solução:**
1. Entre no container do backend
2. Execute: `npm run build`
3. Tente o build do cron novamente

### 2. Container reinicia constantemente

**Causa:** Erro no código ou falta de dependências

**Solução:**
1. Veja os logs do container
2. Procure por erros de `MODULE_NOT_FOUND`
3. Entre no container e execute: `npm install`

### 3. "Cannot connect to database"

**Causa:** Container do PostgreSQL não está rodando

**Solução:**
1. Verifique se `market-security-db` está running
2. Reinicie o stack inteiro se necessário

### 4. "Zanthus API not configured"

**Causa:** Falta configurar a API no sistema

**Solução:**
1. Acesse o sistema → Configurações
2. Configure a URL da API Zanthus
3. O cron vai funcionar na próxima execução

---

## 🎯 O Que Acontece Depois?

Com o CRON rodando:

**A cada 2 minutos:**
```
🔄 Busca vendas do Zanthus
🔄 Cruza com bipagens pendentes
🔄 Atualiza status para "verified"
```

**Às 8h da manhã:**
```
📊 Verificação completa do dia anterior
📧 Envia notificações (se configurado)
```

**A cada 1 hora:**
```
⚠️ Verifica última bipagem
⚠️ Alerta se não receber bipagens (sistema parado)
```

---

## 📋 Comandos Úteis (se tiver Docker CLI)

```bash
# Ver todos os containers
docker ps -a | findstr market-security

# Ver logs do cron
docker logs -f market-security-cron

# Entrar no container do cron
docker exec -it market-security-cron sh

# Reiniciar apenas o cron
docker restart market-security-cron

# Parar o cron
docker stop market-security-cron

# Iniciar o cron
docker start market-security-cron

# Ver estatísticas
docker stats market-security-cron
```

---

## 🆘 Precisa de Ajuda?

Se o CRON não iniciar:
1. Tire um print do erro no Portainer
2. Copie os logs do container
3. Veja o arquivo de logs: `/var/log/cron.log` (dentro do container)

Para debug avançado:
```bash
# Entre no container
docker exec -it market-security-cron sh

# Veja o arquivo de cron
cat /etc/crontabs/root

# Veja os logs
cat /var/log/cron.log

# Execute manualmente
cd /app && node dist/commands/daily-verification.command.js
```
