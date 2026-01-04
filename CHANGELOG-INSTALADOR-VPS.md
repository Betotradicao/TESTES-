# Changelog - Instalador VPS Limpo

## Resumo das Alterações

Este documento descreve todas as alterações feitas no instalador automático VPS para corrigir problemas de cache, configurações antigas e garantir instalações limpas com código atualizado.

---

## 🎯 Objetivo

Criar um instalador que:
- Remove completamente instalações anteriores (containers, volumes, imagens)
- Baixa sempre a versão mais recente do GitHub
- Faz build sem cache Docker
- Atualiza configurações de infraestrutura a cada boot
- Cria automaticamente usuário master Roberto
- Permite configuração da empresa no /first-setup

---

## 📝 Alterações Realizadas

### 1. Backend - Seed do Usuário Master (HABILITADO)

**Arquivo**: `packages/backend/src/index.ts`
**Linhas**: 112-114

**Antes**:
```typescript
// Seed do usuário master (DESABILITADO - usar first-setup)
// await seedMasterUser(AppDataSource);
```

**Depois**:
```typescript
// Seed do usuário master Roberto (Beto3107@@##)
// Cria automaticamente para permitir acesso ao /first-setup
await seedMasterUser(AppDataSource);
```

**Motivo**: O usuário master deve ser criado automaticamente para permitir login inicial e acesso ao /first-setup.

---

### 2. Backend - Configurações com Auto-Update

**Arquivo**: `packages/backend/src/scripts/seed-configurations.ts`
**Linhas**: 29-296

**Alteração**: Adicionado flag `alwaysUpdate: true` para configs de infraestrutura:

```typescript
const configs = [
  // MinIO - SEMPRE atualizar com .env
  {
    key: 'minio_endpoint',
    value: process.env.MINIO_PUBLIC_ENDPOINT || process.env.HOST_IP || 'localhost',
    description: 'Endpoint público do MinIO (IP ou domínio)',
    alwaysUpdate: true // ← SEMPRE atualizar
  },
  // PostgreSQL - SEMPRE atualizar com .env
  {
    key: 'postgres_host',
    value: process.env.HOST_IP || 'localhost',
    description: 'Host do PostgreSQL',
    alwaysUpdate: true // ← SEMPRE atualizar
  },
  // Tailscale - SEMPRE atualizar com .env
  {
    key: 'tailscale_vps_ip',
    value: process.env.TAILSCALE_VPS_IP || process.env.TAILSCALE_IP || '',
    description: 'IP da VPS na rede Tailscale',
    alwaysUpdate: true // ← SEMPRE atualizar
  },
  // Evolution API - NÃO sobrescrever (editado pelo usuário no painel)
  {
    key: 'evolution_api_url',
    value: '',
    description: 'URL da Evolution API (WhatsApp)'
    // Sem alwaysUpdate - mantém valor editado pelo usuário
  }
];
```

**Lógica de atualização** (linhas 300-324):
```typescript
for (const config of configs) {
  let configuration = await configRepository.findOne({ where: { key: config.key } });

  if (configuration) {
    // JÁ EXISTE
    if (config.alwaysUpdate) {
      // SEMPRE ATUALIZAR (configs do .env como MinIO, PostgreSQL, Tailscale)
      configuration.value = config.value;
      await configRepository.save(configuration);
      console.log(`   🔄 ${config.key}: atualizado com valor do .env`);
    } else {
      // NÃO SOBRESCREVER (configs editadas pelo usuário como Evolution, Zanthus)
      console.log(`   ⏭️  ${config.key}: já existe, mantido`);
    }
  } else {
    // NÃO EXISTE - criar nova
    configuration = configRepository.create({
      key: config.key,
      value: config.value
    });
    await configRepository.save(configuration);
    console.log(`   ✅ ${config.key}: criado`);
  }
}
```

**Configs com `alwaysUpdate: true`**:
- MinIO: endpoint, port, access_key, secret_key, use_ssl, bucket_name, public_endpoint, public_port
- PostgreSQL: host, port, user, password, database
- Sistema: host_ip, api_token
- Tailscale: vps_ip, client_ip

**Configs SEM `alwaysUpdate`** (mantém edição do usuário):
- Zanthus: api_url, port, products_endpoint, sales_endpoint
- Intersolid: api_url, port, username, password, products_endpoint, sales_endpoint
- Evolution API: api_url, api_token, instance, whatsapp_group_id
- Email: user, pass (para recuperação de senha)
- DVR Monitor: ip, usuario, senha, email_senha, intervalo, auto_start
- Email Monitor: email, app_password, subject_filter, check_interval, whatsapp_group, enabled

**Motivo**: Configurações de infraestrutura (IP, portas, credenciais geradas) devem sempre refletir o .env atual. Configurações editadas pelo usuário no painel devem ser preservadas.

---

### 3. Backend - Database Config (Migrations Auto)

**Arquivo**: `packages/backend/src/config/database.ts`
**Linha**: 29

**Antes**:
```typescript
migrationsRun: false,
```

**Depois**:
```typescript
migrationsRun: true,
```

**Motivo**: Garantir que migrations executem automaticamente ao iniciar o backend, criando todas as tabelas necessárias.

---

### 4. Backend - Setup Controller (Email Opcional)

**Arquivo**: `packages/backend/src/controllers/setup.controller.ts`
**Linhas**: 80-232

**Antes**: Email era obrigatório no /first-setup

**Depois**: Email é opcional (será configurado depois no painel)

**Validações removidas** (linhas 89-95 deletadas):
```typescript
// REMOVIDO:
// if (!emailUser || !emailPass) {
//   return res.status(400).json({ error: 'Email e senha de envio são obrigatórios' });
// }
```

**Salvamento opcional adicionado** (linhas 163-195):
```typescript
// Salvar email no .env (OPCIONAL)
if (emailUser && emailPass) {
  try {
    const envPath = path.resolve(__dirname, '../../.env');
    let envContent = fs.readFileSync(envPath, 'utf8');

    if (envContent.includes('EMAIL_USER=')) {
      envContent = envContent.replace(/EMAIL_USER=.*/, `EMAIL_USER=${emailUser}`);
    } else {
      envContent += `\nEMAIL_USER=${emailUser}`;
    }

    if (envContent.includes('EMAIL_PASS=')) {
      envContent = envContent.replace(/EMAIL_PASS=.*/, `EMAIL_PASS=${emailPass}`);
    } else {
      envContent += `\nEMAIL_PASS=${emailPass}`;
    }

    fs.writeFileSync(envPath, envContent, 'utf8');
    console.log('✅ Email salvo no .env');
  } catch (error) {
    console.error('⚠️ Erro ao salvar email:', error);
  }
}
```

**Motivo**: Instaladores antigos (INSTALAR-AUTO.sh) não pediam email no /first-setup, isso era configurado depois no painel. Manter compatibilidade.

---

### 5. Instalador VPS - Limpeza Completa

**Arquivo**: `INSTALAR-VPS-LIMPO.sh`
**Linhas**: 19-36

**Adicionado**:
```bash
echo "🧹 LIMPANDO INSTALAÇÃO ANTERIOR..."

# Parar e remover containers
cd /root/TESTES/InstaladorVPS 2>/dev/null && docker compose -f docker-compose-producao.yml down -v 2>/dev/null
cd /root 2>/dev/null

# Remover código antigo
rm -rf /root/TESTES
rm -rf /root/prevencao-instalacao

# Remover imagens antigas
docker rmi instaladorvps-backend instaladorvps-frontend instaladorvps-cron 2>/dev/null || true

echo "✅ Limpeza completa"
```

**Motivo**: Garantir que nenhum resíduo de instalação anterior (volumes, imagens, código) permaneça.

---

### 6. Instalador VPS - Autenticação Tailscale

**Arquivo**: `INSTALAR-VPS-LIMPO.sh`
**Linhas**: 72-156

**Fluxo completo**:
1. Fazer logout do Tailscale (limpar autenticações antigas)
2. Iniciar Tailscale com `--reset`
3. Capturar link de autenticação do log
4. Exibir link para o usuário
5. Aguardar até 5 minutos pela autenticação
6. Obter IP Tailscale da VPS
7. Pedir IP Tailscale do cliente (Windows/ERP)

**Código**:
```bash
echo "🚀 Iniciando Tailscale..."
echo "🔄 Limpando autenticações antigas..."

# Fazer logout forçado
tailscale logout 2>/dev/null || true

# Limpar log antigo
rm -f /tmp/tailscale-auth.log

# Iniciar Tailscale
tailscale up --reset --accept-routes --shields-up=false 2>&1 | tee /tmp/tailscale-auth.log &
TAILSCALE_PID=$!

# Aguardar link de autenticação
sleep 5

# Extrair link
TAILSCALE_AUTH_URL=$(grep -o 'https://login.tailscale.com/a/[a-z0-9]*' /tmp/tailscale-auth.log 2>/dev/null | head -n 1)

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🔐 AUTENTICAÇÃO TAILSCALE NECESSÁRIA (VPS)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

if [ -n "$TAILSCALE_AUTH_URL" ]; then
    echo "   Abra este link no navegador para autenticar:"
    echo ""
    echo "   $TAILSCALE_AUTH_URL"
    echo ""
    echo "   ⏳ Aguardando autenticação..."
else
    echo "   ⚠️  Link não foi gerado no log."
    echo "   Execute manualmente:"
    echo ""
    echo "   tailscale up --reset --accept-routes --shields-up=false"
fi

# Aguardar autenticação (máximo 5 minutos)
TIMEOUT=300
ELAPSED=0
while [ $ELAPSED -lt $TIMEOUT ]; do
    TAILSCALE_IP=$(tailscale ip -4 2>/dev/null || echo "")
    if [ -n "$TAILSCALE_IP" ]; then
        echo "✅ Tailscale autenticado com sucesso!"
        echo "✅ IP Tailscale VPS: $TAILSCALE_IP"
        break
    fi
    sleep 5
    ELAPSED=$((ELAPSED + 5))
    echo -ne "   ⏳ Aguardando autenticação... ${ELAPSED}s\\r"
done

# Pedir IP do cliente
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🖥️  IP TAILSCALE DO CLIENTE (WINDOWS/ERP)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "   Agora você precisa instalar o Tailscale no computador"
echo "   onde está o ERP/Windows e pegar o IP Tailscale dele."
echo ""
echo "   Download: https://tailscale.com/download"
echo ""
echo "   Exemplo de IP Tailscale: 100.69.131.40"
echo ""
read -p "   Digite o IP Tailscale do cliente (ou deixe vazio): " TAILSCALE_CLIENT_IP < /dev/tty
```

**Motivo**: Garantir configuração correta da VPN Tailscale para comunicação com ERP local.

---

### 7. Instalador VPS - Variáveis de Ambiente Completas

**Arquivo**: `INSTALAR-VPS-LIMPO.sh`
**Linhas**: 186-234

**Adicionado todas as variáveis necessárias**:

```bash
cat > /root/prevencao-instalacao/.env << EOF
# ==========================================
# CONFIGURAÇÃO VPS - GERADO AUTOMATICAMENTE
# ==========================================

# Backend
NODE_ENV=production
PORT=3001
FRONTEND_URL=http://$HOST_IP:3000
JWT_SECRET=$(openssl rand -hex 32)

# IP Público da VPS
HOST_IP=$HOST_IP

# PostgreSQL
DB_HOST=postgres
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=$POSTGRES_PASSWORD
DB_NAME=prevencao_db
POSTGRES_USER=postgres
POSTGRES_DB=prevencao_db
POSTGRES_PASSWORD=$POSTGRES_PASSWORD

# MinIO (Armazenamento)
MINIO_ROOT_USER=$MINIO_ACCESS_KEY
MINIO_ROOT_PASSWORD=$MINIO_SECRET_KEY
MINIO_ACCESS_KEY=$MINIO_ACCESS_KEY
MINIO_SECRET_KEY=$MINIO_SECRET_KEY
MINIO_BUCKET_NAME=market-security
MINIO_PUBLIC_ENDPOINT=$HOST_IP
MINIO_PUBLIC_PORT=9010
MINIO_PUBLIC_USE_SSL=false

# Frontend
VITE_API_URL=http://$HOST_IP:3001/api

# API Token (Scanners)
API_TOKEN=$API_TOKEN

# Tailscale
TAILSCALE_CLIENT_IP=$TAILSCALE_CLIENT_IP
TAILSCALE_VPS_IP=$TAILSCALE_IP
TAILSCALE_IP=$TAILSCALE_IP

# Email (Configurar depois no painel)
EMAIL_USER=
EMAIL_PASS=
EOF
```

**Variáveis adicionadas**:
- `NODE_ENV=production`
- `PORT=3001`
- `FRONTEND_URL`
- `JWT_SECRET` (gerado aleatoriamente)
- `POSTGRES_USER`
- `POSTGRES_DB`
- `VITE_API_URL`

**Motivo**: Docker Compose exigia essas variáveis e mostrava warnings quando não existiam.

---

### 8. Instalador VPS - Build Sem Cache

**Arquivo**: `INSTALAR-VPS-LIMPO.sh`
**Linhas**: 244-252

**Antes**:
```bash
docker compose -f docker-compose-producao.yml build
docker compose -f docker-compose-producao.yml up -d
```

**Depois**:
```bash
echo "🐳 Fazendo build dos containers (sem cache)..."
docker compose -f docker-compose-producao.yml build --no-cache --pull backend frontend cron

echo "🚀 Subindo containers..."
docker compose -f docker-compose-producao.yml up -d
```

**Flags adicionadas**:
- `--no-cache`: Ignora cache de layers do Docker
- `--pull`: Baixa imagens base mais recentes (node, postgres, minio)
- `backend frontend cron`: Especifica quais serviços fazer build

**Motivo**: Garantir que o build use sempre código atualizado do Git, sem cache de builds anteriores.

---

## 🔄 Fluxo de Instalação

### 1. Preparação
1. Detectar IP público da VPS
2. Limpar instalação anterior (containers, volumes, imagens, código)
3. Instalar dependências (Docker, Git, Tailscale)

### 2. Configuração Tailscale
1. Fazer logout de autenticações antigas
2. Iniciar Tailscale com `--reset`
3. Gerar link de autenticação
4. Aguardar aprovação do usuário (até 5 minutos)
5. Obter IP Tailscale da VPS
6. Pedir IP Tailscale do cliente (Windows/ERP)

### 3. Download do Código
1. Clonar repositório GitHub (sempre versão mais recente)
2. Exibir commit hash e mensagem

### 4. Geração do .env
1. Gerar senhas aleatórias (PostgreSQL, MinIO, JWT, API Token)
2. Criar .env com todas as variáveis necessárias
3. Copiar .env para diretórios do projeto

### 5. Build e Deploy
1. Build dos containers SEM cache (`--no-cache --pull`)
2. Subir containers
3. Aguardar PostgreSQL inicializar
4. Aguardar backend criar tabelas (migrations)

### 6. Resultado
- Sistema disponível em `http://IP_VPS:3000`
- Usuário master criado: **Roberto** / **Beto3107@@##**
- Pronto para /first-setup (criar empresa e admin)

---

## 👥 Fluxo de Usuários

### 1. Usuário Master (Roberto)
- **Criado automaticamente** no seed do backend
- **Credenciais**: Roberto / Beto3107@@##
- **Empresa**: Nenhuma (não vinculado)
- **Acesso**:
  - ✅ Login
  - ✅ /first-setup (criar empresa e admin)
  - ✅ Configurações de Rede (único usuário com acesso)
  - ❌ Outras funcionalidades (requer empresa)

### 2. Usuário Admin (Criado no First Setup)
- **Criado pelo master** no /first-setup
- **Credenciais**: Definidas pelo master
- **Empresa**: Vinculado à empresa criada
- **Acesso**:
  - ✅ Todas as funcionalidades do sistema
  - ❌ Configurações de Rede (exclusivo do master)

---

## 🎨 Configurações - Comportamento

### Configs com `alwaysUpdate: true`
**Atualizadas a cada boot** com valores do .env:
- MinIO (endpoint, port, access_key, secret_key)
- PostgreSQL (host, port, user, password)
- Tailscale (vps_ip, client_ip)
- Sistema (host_ip, api_token)

**Motivo**: São configs de infraestrutura que dependem do ambiente (IP, portas, credenciais geradas).

### Configs SEM `alwaysUpdate`
**Preservadas** (não sobrescreve):
- Evolution API (api_url, api_token, instance, whatsapp_group_id)
- Zanthus ERP (api_url, port, products_endpoint, sales_endpoint)
- Intersolid ERP (api_url, port, username, password, products_endpoint, sales_endpoint)
- Email (user, pass - recuperação de senha)
- DVR Monitor (ip, usuario, senha, email_senha, intervalo, auto_start)
- Email Monitor (email, app_password, subject_filter, check_interval, whatsapp_group, enabled)

**Motivo**: São configs editadas pelo usuário no painel de Configurações de Rede. Sobrescrever perderia customizações.

---

## 🐛 Problemas Corrigidos

### ❌ Problema 1: Migrations não executavam
**Sintoma**: Tabelas não criadas, timeout de 60s

**Causa**: `migrationsRun: false` em database.ts

**Solução**: Alterado para `migrationsRun: true`

---

### ❌ Problema 2: Autenticação PostgreSQL falhava
**Sintoma**: "password authentication failed for user postgres"

**Causa**: Volume do PostgreSQL tinha senha antiga, .env tinha senha nova

**Solução**: `docker compose down -v` remove volumes antes de reinstalar

---

### ❌ Problema 3: Email obrigatório no /first-setup
**Sintoma**: "Email e senha de envio são obrigatórios"

**Causa**: Validação obrigatória no setup.controller.ts

**Solução**: Tornar email opcional, salvar no .env se fornecido

---

### ❌ Problema 4: Variáveis de ambiente faltando
**Sintoma**: Docker warnings "The 'NODE_ENV' variable is not set"

**Causa**: .env gerado pelo instalador estava incompleto

**Solução**: Adicionar NODE_ENV, PORT, JWT_SECRET, POSTGRES_USER, POSTGRES_DB, VITE_API_URL

---

### ❌ Problema 5: Configurações antigas persistiam
**Sintoma**: MinIO mostrando IP antigo (31.97.82.235 em vez de 145.223.92.152)

**Causa**: seed-configurations.ts só criava configs, nunca atualizava

**Solução**: Flag `alwaysUpdate: true` força atualização de configs de infraestrutura

---

### ❌ Problema 6: Cache do Docker persistia
**Sintoma**: Build usava código antigo mesmo com Git clone novo

**Causa**: Docker layer cache reutilizava layers antigas

**Solução**: `docker compose build --no-cache --pull`

---

### ❌ Problema 7: Usuário master não existia
**Sintoma**: Sistema ia direto para /first-setup sem usuário para login

**Causa**: Seed do master estava comentado em index.ts

**Solução**: Descomentar `await seedMasterUser(AppDataSource)`

---

## 📋 Checklist de Instalação

Após rodar o instalador, verificar:

- [ ] Sistema acessível em `http://IP_VPS:3000`
- [ ] Login com **Roberto** / **Beto3107@@##** funciona
- [ ] MinIO mostra IP correto da VPS (não IP antigo)
- [ ] PostgreSQL conecta corretamente
- [ ] Tailscale mostra IP correto
- [ ] /first-setup disponível após login do master
- [ ] Criação de empresa e admin funciona
- [ ] Após first-setup, admin consegue acessar todas as funcionalidades
- [ ] Master consegue acessar Configurações de Rede
- [ ] Admin NÃO vê Configurações de Rede

---

## 🚀 Comando de Instalação

```bash
curl -fsSL https://raw.githubusercontent.com/Betotradicao/TESTES-/main/INSTALAR-VPS-LIMPO.sh | bash
```

---

## 📦 Commits Relacionados

- **a6954c4**: Habilitar migrationsRun
- **863add1**: Tornar email opcional no /first-setup
- **a060e1c**: Adicionar variáveis de ambiente faltantes
- **dd81b8f**: Adicionar flag alwaysUpdate para forçar atualização de configs
- **d2074b4**: Adicionar configuração completa do Tailscale
- **Este commit**: Habilitar seed do usuário master Roberto

---

## 📞 Suporte

Em caso de problemas:

1. Verificar logs do backend: `docker logs prevencao-backend-prod`
2. Verificar logs do PostgreSQL: `docker logs prevencao-postgres-prod`
3. Verificar status dos containers: `docker compose -f docker-compose-producao.yml ps`
4. Verificar configurações no banco:
```sql
docker exec prevencao-postgres-prod psql -U postgres -d prevencao_db -c "SELECT key, value FROM configurations WHERE key LIKE 'minio%' OR key LIKE 'postgres%' OR key LIKE 'tailscale%';"
```
