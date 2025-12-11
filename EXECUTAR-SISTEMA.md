# 🚀 Como Executar o Market Security System

> ⚠️ **IMPORTANTE**: Se você baixou do GitHub, primeiro execute os passos de [Instalação Inicial](#instalação-inicial-após-baixar-do-github)

---

## 📥 Instalação Inicial (após baixar do GitHub)

Quando você baixa o projeto do GitHub, várias pastas importantes não vêm incluídas (node_modules, dist, etc) porque estão no `.gitignore`. Siga estes passos:

### 1. Instalar Dependências
```bash
# Na raiz do projeto
npm install

# No backend
cd packages/backend
npm install

# No frontend
cd ../frontend
npm install
```

### 2. Configurar Variáveis de Ambiente
Copie os arquivos `.env.example` para `.env` e configure as credenciais:

```bash
# Backend
copy packages\backend\.env.example packages\backend\.env

# Edite o arquivo .env e configure:
# - DATABASE_URL (PostgreSQL)
# - MINIO_ACCESS_KEY e MINIO_SECRET_KEY
# - API_TOKEN
```

### 3. Executar Migrations do Banco
```bash
cd packages/backend
npm run migration:run
```

### 4. Pronto! Agora pode usar os scripts de inicialização abaixo

---

# 🚀 Como Executar o Market Security System

## 📋 Modos de Inicialização

### 1️⃣ Modo Silencioso (Recomendado) - SEM janelas visíveis

Execute o arquivo `iniciar-silencioso.vbs` clicando duas vezes nele.

**O que acontece:**
- ✅ Todos os processos iniciam de forma **invisível** (sem janelas CMD)
- ✅ MinIO inicia em modo oculto
- ✅ Backend e Frontend iniciam via PM2 (gerenciador de processos)
- ✅ Scanner Service inicia com `pythonw` (sem janela Python)
- ✅ Credenciais são carregadas automaticamente do arquivo `.env`

**Vantagens:**
- Nenhuma janela de terminal visível
- Processos gerenciados automaticamente pelo PM2
- Reinício automático em caso de falha
- Logs salvos em arquivos

---

### 2️⃣ Modo Monitor - Auto-restart invisível

Execute o arquivo `monitor-e-reiniciar.vbs` clicando duas vezes nele.

**O que faz:**
- 🔄 Monitora constantemente todos os processos (Backend, Frontend, MinIO, Scanner)
- 🔄 Reinicia automaticamente qualquer processo que parar
- ✅ Tudo funciona de forma **invisível** (sem janelas)
- ⏱️ Verifica a cada 30 segundos

**Quando usar:**
- Para garantir que o sistema nunca pare
- Em ambientes de produção 24/7
- Quando precisa de alta disponibilidade

---

## 🔧 Gerenciar Processos PM2

### Ver processos rodando:
```bash
pm2 list
```

### Ver logs em tempo real:
```bash
# Backend
pm2 logs @market-security/backend

# Frontend
pm2 logs @market-security/frontend

# Todos
pm2 logs
```

### Parar processos:
```bash
# Parar um específico
pm2 stop @market-security/backend

# Parar todos
pm2 stop all
```

### Reiniciar processos:
```bash
# Reiniciar um específico
pm2 restart @market-security/backend

# Reiniciar todos
pm2 restart all
```

### Remover processos:
```bash
# Remover um específico
pm2 delete @market-security/backend

# Remover todos
pm2 delete all
```

---

## 📁 Localização dos Logs

Os logs ficam salvos em:
```
roberto-prevencao-no-radar-main/logs/
├── backend-error.log   (erros do backend)
├── backend-out.log     (saída do backend)
├── frontend-error.log  (erros do frontend)
└── frontend-out.log    (saída do frontend)
```

---

## 🆘 Solução de Problemas

### Processos não iniciam:
1. Verifique se PM2 está instalado: `pm2 --version`
2. Se não estiver: `npm install -g pm2`
3. Execute novamente `iniciar-silencioso.vbs`

### Janelas CMD ainda aparecem:
- Certifique-se de usar `iniciar-silencioso.vbs` e não outros scripts `.bat`
- Verifique se não há outras tarefas agendadas rodando scripts antigos

### MinIO não inicia:
- Verifique se a porta 9010 está livre
- Verifique os logs em `logs/`
- Execute manualmente: `pm2 logs`

---

## ⚙️ Configuração de Auto-Start (Windows)

Para iniciar automaticamente com o Windows:

1. Pressione `Win + R`
2. Digite: `shell:startup`
3. Copie o atalho de `iniciar-silencioso.vbs` para a pasta que abrir
4. Reinicie o computador para testar

**Nota:** O PM2 já está configurado para auto-start via registro do Windows.

---

## 📌 Importante

- **NUNCA** execute scripts `.bat` diretamente - eles abrem janelas visíveis
- Use sempre os scripts `.vbs` para execução invisível
- Os scripts `.vbs` usam PM2 internamente para gerenciar os processos
- Credenciais do MinIO são carregadas automaticamente do arquivo `.env`
