# 🤖 APRENDIZADO CLAUDE - Guia Completo de Deploy

> **Propósito:** Este documento ensina como fazer alterações, build e deploy no projeto "Prevenção no Radar" sem quebrar o que já está funcionando.

---

## 📋 ÍNDICE

1. [Informações do Ambiente](#-informações-do-ambiente)
2. [Estrutura do Projeto](#-estrutura-do-projeto)
3. [Workflow de Desenvolvimento](#-workflow-de-desenvolvimento)
4. [Como Fazer Alterações no Frontend](#-como-fazer-alterações-no-frontend)
5. [Como Fazer Alterações no Backend](#-como-fazer-alterações-no-backend)
6. [Deploy para Produção via SSH](#-deploy-para-produção-via-ssh)
7. [Comandos Git Essenciais](#-comandos-git-essenciais)
8. [Troubleshooting Comum](#-troubleshooting-comum)
9. [Regras de Ouro](#-regras-de-ouro)

---

## 🌍 INFORMAÇÕES DO AMBIENTE

### Produção (VPS)
- **URL:** http://31.97.82.235:3000
- **IP:** 31.97.82.235
- **Usuário SSH:** root
- **Chave SSH:** ~/.ssh/vps_prevencao
- **Senha Root:** beto3107@
- **Container Backend:** prevencao-backend
- **Container Frontend:** prevencao-frontend
- **Porta Frontend:** 3000
- **Porta Backend:** 3001

### Desenvolvimento Local
- **Sistema Operacional:** Windows (win32)
- **Diretório:** c:\Users\Administrator\Desktop\roberto-prevencao-no-radar-main
- **Node Version:** 18
- **Package Manager:** npm

### Git
- **Branch Principal:** main
- **Remote:** origin
- **Workflow:** Sempre commit e push antes de deploy

---

## 📁 ESTRUTURA DO PROJETO

```
roberto-prevencao-no-radar-main/
├── packages/
│   ├── frontend/              # React + Vite + Tailwind
│   │   ├── src/
│   │   │   ├── pages/        # Páginas principais
│   │   │   ├── components/   # Componentes reutilizáveis
│   │   │   ├── services/     # API client (axios)
│   │   │   └── App.jsx       # Rotas principais
│   │   ├── package.json
│   │   └── vite.config.js
│   │
│   └── backend/               # Node.js + TypeScript + Express
│       ├── src/
│       │   ├── controllers/  # Lógica de endpoints
│       │   ├── entities/     # TypeORM entities
│       │   ├── services/     # Serviços (arquivos .js e .ts)
│       │   ├── routes/       # Definição de rotas
│       │   └── config/       # Configurações (DB, etc)
│       ├── package.json
│       └── tsconfig.json
│
├── InstaladorVPS/             # Arquivos Docker
│   ├── Dockerfile.frontend
│   ├── Dockerfile.backend
│   ├── docker-compose.yml
│   └── entrypoint.sh
│
└── APRENDIZADO_CLAUDE.md     # 👈 Este arquivo
```

---

## 🔄 WORKFLOW DE DESENVOLVIMENTO

### Fluxo Completo (do início ao fim)

```mermaid
graph TD
    A[1. Ler código existente] --> B[2. Fazer alterações]
    B --> C[3. Testar localmente se possível]
    C --> D[4. Git add + commit]
    D --> E[5. Git push]
    E --> F[6. SSH na VPS]
    F --> G[7. Git pull]
    G --> H[8. Build frontend]
    H --> I[9. Build backend]
    I --> J[10. Restart containers]
    J --> K[11. Verificar logs]
```

---

## 🎨 COMO FAZER ALTERAÇÕES NO FRONTEND

### 1️⃣ SEMPRE Ler o Arquivo Antes de Editar

```bash
# ERRADO ❌
Editar arquivo sem ler

# CERTO ✅
Usar Read tool primeiro, entender o código, depois editar
```

### 2️⃣ Seguir Padrões Existentes

**Antes de criar algo novo, SEMPRE olhar como foi feito em arquivos similares:**

| Tipo de Alteração | Arquivo de Referência |
|-------------------|----------------------|
| Nova página | `ConfiguracoesRede.jsx`, `MonitorarEmailDVR.jsx` |
| Nova tab em config | `EmailMonitorTab.jsx` |
| Layout com sidebar | Qualquer página principal |
| Formulário | `EmailMonitorTab.jsx` (Gmail tab) |
| Chamada API | `services/api.js` |

### 3️⃣ Estrutura de Layout Padrão

**Todas as páginas principais seguem este padrão:**

```jsx
import Sidebar from '../components/Sidebar';
import { useAuth } from '../contexts/AuthContext';

function MinhaPage() {
  const { user, logout } = useAuth();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar
        user={user}
        onLogout={logout}
        isMobileMenuOpen={isMobileMenuOpen}
        setIsMobileMenuOpen={setIsMobileMenuOpen}
      />

      <div className="flex-1 overflow-auto lg:ml-0">
        <div className="p-6 max-w-7xl mx-auto">
          {/* Conteúdo aqui */}
        </div>
      </div>
    </div>
  );
}
```

### 4️⃣ Como Adicionar Nova Rota

**Editar:** `packages/frontend/src/App.jsx`

```jsx
import MinhaNovaPage from './pages/MinhaNovaPage';

// Dentro de <Routes>
<Route
  path="/minha-nova-page"
  element={<ProtectedRoute><MinhaNovaPage /></ProtectedRoute>}
/>
```

### 5️⃣ Como Adicionar Item no Sidebar

**Editar:** `packages/frontend/src/components/Sidebar.jsx`

```jsx
const menuSections = [
  {
    title: 'Minha Seção',
    path: '/minha-page',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="..."/>
      </svg>
    ),
    items: [] // ou subitems se houver
  }
];
```

### 6️⃣ Chamadas API

**Sempre usar o client configurado:**

```jsx
import api from '../services/api';

// GET
const response = await api.get('/endpoint');
const data = response.data;

// POST
await api.post('/endpoint', { campo: 'valor' });

// Tratamento de erro
try {
  await api.post('/endpoint', data);
  showMessage('success', 'Sucesso!');
} catch (error) {
  showMessage('error', error.response?.data?.error || 'Erro desconhecido');
}
```

---

## ⚙️ COMO FAZER ALTERAÇÕES NO BACKEND

### 1️⃣ Estrutura de Controller

**Padrão para criar endpoints:**

```typescript
import { Request, Response } from 'express';
import { AppDataSource } from '../config/database';
import { MinhaEntity } from '../entities/MinhaEntity';

export async function meuEndpoint(req: Request, res: Response) {
  try {
    const { campo1, campo2 } = req.body;

    // Validação
    if (!campo1 || !campo2) {
      return res.status(400).json({
        error: 'Campo1 e Campo2 são obrigatórios'
      });
    }

    // Lógica
    const repository = AppDataSource.getRepository(MinhaEntity);
    // ... fazer algo ...

    res.json({
      success: true,
      message: 'Operação bem-sucedida'
    });

  } catch (error: any) {
    res.status(500).json({
      error: 'Erro ao processar',
      details: error.message
    });
  }
}
```

### 2️⃣ Adicionar Nova Rota

**Editar:** `packages/backend/src/routes/index.ts`

```typescript
import { meuEndpoint } from '../controllers/meu.controller';

router.post('/meu-endpoint', meuEndpoint);
```

### 3️⃣ IMPORTANTE: Arquivos .js no Backend

**⚠️ ATENÇÃO:** O arquivo `dvr-email-monitor.js` é JavaScript puro, não TypeScript.

**Ele NÃO é compilado** pelo `npm run build`.

**Solução:** O Dockerfile copia manualmente:

```dockerfile
# No Dockerfile.backend (ESTÁGIO 1)
RUN cp src/services/dvr-email-monitor.js dist/services/ || true
```

**Regra:** Se criar novos arquivos `.js` que precisam estar em produção, adicionar no Dockerfile.

### 4️⃣ Salvando Configurações no Banco

```typescript
async function salvarConfig(key: string, value: string) {
  const configRepository = AppDataSource.getRepository(Configuration);

  let config = await configRepository.findOne({ where: { key } });

  if (config) {
    config.value = value;
    config.updated_at = new Date();
  } else {
    config = configRepository.create({
      key,
      value,
      encrypted: false
    });
  }

  await configRepository.save(config);
}
```

---

## 🚀 DEPLOY PARA PRODUÇÃO VIA SSH

### Método 1: SSH Automático (Sem Pedir Senha)

**Configurar uma única vez:**

```bash
# Verificar se chave SSH existe
ls ~/.ssh/vps_prevencao

# Se não existir, criar:
ssh-keygen -t rsa -b 4096 -f ~/.ssh/vps_prevencao -N ""

# Copiar chave pública para VPS
ssh-copy-id -i ~/.ssh/vps_prevencao.pub root@31.97.82.235
# Digitar senha: beto3107@

# Testar conexão sem senha
ssh -i ~/.ssh/vps_prevencao root@31.97.82.235 "echo 'Conexão OK!'"
```

### Método 2: Deploy Completo com Bash Tool

**Usar este comando após fazer commit:**

```bash
ssh -i ~/.ssh/vps_prevencao root@31.97.82.235 "
  cd /root/prevencao-no-radar &&
  git pull &&
  docker-compose -f InstaladorVPS/docker-compose.yml build frontend &&
  docker-compose -f InstaladorVPS/docker-compose.yml build backend &&
  docker-compose -f InstaladorVPS/docker-compose.yml up -d &&
  docker ps | grep prevencao
"
```

**Explicação linha por linha:**

1. `ssh -i ~/.ssh/vps_prevencao root@31.97.82.235` - Conecta via SSH com chave
2. `cd /root/prevencao-no-radar` - Vai para diretório do projeto
3. `git pull` - Puxa últimas alterações
4. `docker-compose ... build frontend` - Faz build do frontend
5. `docker-compose ... build backend` - Faz build do backend
6. `docker-compose ... up -d` - Sobe containers em background
7. `docker ps | grep prevencao` - Mostra containers rodando

### Método 3: Deploy Passo a Passo (Manual)

**Caso precise fazer algo específico:**

```bash
# 1. Conectar na VPS
ssh -i ~/.ssh/vps_prevencao root@31.97.82.235

# 2. Ir para diretório
cd /root/prevencao-no-radar

# 3. Verificar status git
git status
git log -1

# 4. Puxar alterações
git pull

# 5. Build apenas frontend (se só alterou frontend)
docker-compose -f InstaladorVPS/docker-compose.yml build frontend
docker-compose -f InstaladorVPS/docker-compose.yml up -d frontend

# 6. Build apenas backend (se só alterou backend)
docker-compose -f InstaladorVPS/docker-compose.yml build backend
docker-compose -f InstaladorVPS/docker-compose.yml up -d backend

# 7. Verificar containers
docker ps

# 8. Ver logs se necessário
docker logs prevencao-frontend --tail 50
docker logs prevencao-backend --tail 50

# 9. Sair
exit
```

### Verificar Deploy

**Após deploy, SEMPRE verificar:**

```bash
# Ver containers rodando
ssh -i ~/.ssh/vps_prevencao root@31.97.82.235 "docker ps | grep prevencao"

# Ver logs do frontend
ssh -i ~/.ssh/vps_prevencao root@31.97.82.235 "docker logs prevencao-frontend --tail 20"

# Ver logs do backend
ssh -i ~/.ssh/vps_prevencao root@31.97.82.235 "docker logs prevencao-backend --tail 20"

# Testar URL
curl -I http://31.97.82.235:3000
```

---

## 📝 COMANDOS GIT ESSENCIAIS

### Workflow Padrão

```bash
# 1. Ver status atual
git status

# 2. Ver últimos commits
git log -3 --oneline

# 3. Adicionar arquivos modificados
git add packages/frontend/src/pages/MinhaPage.jsx
git add packages/backend/src/controllers/meu.controller.ts

# Ou adicionar tudo (cuidado!)
git add .

# 4. Fazer commit
git commit -m "$(cat <<'EOF'
feat: Adiciona nova funcionalidade X

Descrição detalhada do que foi feito:
- Item 1
- Item 2

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>
EOF
)"

# 5. Push para repositório
git push
```

### Verificar Antes de Commitar

```bash
# Ver diff do que vai ser commitado
git diff

# Ver diff apenas de um arquivo
git diff packages/frontend/src/pages/MinhaPage.jsx

# Ver arquivos modificados
git status --short
```

### Desfazer Alterações (Se Necessário)

```bash
# Desfazer alterações em arquivo específico (CUIDADO!)
git checkout -- packages/frontend/src/pages/MinhaPage.jsx

# Ver último commit
git log -1

# Desfazer último commit (mantém alterações)
git reset --soft HEAD~1

# Desfazer último commit (PERDE alterações - CUIDADO!)
git reset --hard HEAD~1
```

---

## 🔧 TROUBLESHOOTING COMUM

### ❌ Problema: "Tab/botão/página não aparece"

**Possível causa:** Linter removeu código ao formatar

**Solução:**
1. Ler arquivo novamente com Read tool
2. Verificar se código está presente
3. Se não estiver, adicionar novamente
4. Commit e deploy

---

### ❌ Problema: "Erro de validação no backend (IP, usuário, senha obrigatórios)"

**Possível causa:** Frontend enviando estrutura de dados diferente do esperado

**Como verificar:**

```typescript
// Backend espera (req.body):
{
  ip: "10.6.1.123",
  usuario: "admin",
  senha: "senha123",
  intervaloMinutos: 30
}

// Frontend estava enviando:
{
  configDVR: {
    ip: "10.6.1.123",
    usuario: "admin",
    senha: "senha123"
  },
  intervaloMinutos: 30
}
```

**Solução:** Ajustar frontend para enviar estrutura plana.

---

### ❌ Problema: "Layout quebrado / conteúdo muito abaixo"

**Possível causa:** Estrutura de layout diferente das outras páginas

**Solução:** Copiar estrutura de `ConfiguracoesRede.jsx`:

```jsx
// ERRADO ❌
<div className="min-h-screen lg:ml-64 pt-4 px-4">

// CERTO ✅
<div className="flex h-screen bg-gray-50">
  <Sidebar ... />
  <div className="flex-1 overflow-auto lg:ml-0">
    <div className="p-6 max-w-7xl mx-auto">
```

---

### ❌ Problema: "Arquivo .js não encontrado em produção"

**Possível causa:** Arquivo `.js` não foi copiado no build

**Solução:** Adicionar no `Dockerfile.backend`:

```dockerfile
# Copiar arquivo .js que não é compilado pelo TypeScript
RUN cp src/services/meu-arquivo.js dist/services/ || true
```

---

### ❌ Problema: "Container não sobe após deploy"

**Como verificar:**

```bash
# Ver logs do container
ssh -i ~/.ssh/vps_prevencao root@31.97.82.235 "docker logs prevencao-backend"

# Ver todos os containers (até os parados)
ssh -i ~/.ssh/vps_prevencao root@31.97.82.235 "docker ps -a"

# Tentar subir manualmente
ssh -i ~/.ssh/vps_prevencao root@31.97.82.235 "
  cd /root/prevencao-no-radar &&
  docker-compose -f InstaladorVPS/docker-compose.yml up -d
"
```

---

### ❌ Problema: "Mudanças não aparecem após deploy"

**Possíveis causas:**

1. **Não fez git push:** Verificar com `git status`
2. **Não fez git pull na VPS:** Conectar e fazer `git pull`
3. **Não fez rebuild:** Fazer `docker-compose build`
4. **Cache do navegador:** Dar Ctrl+Shift+R no navegador

**Solução completa:**

```bash
# Local
git status  # Verificar se commitou
git log -1  # Ver último commit
git push    # Enviar para repositório

# VPS
ssh -i ~/.ssh/vps_prevencao root@31.97.82.235 "
  cd /root/prevencao-no-radar &&
  git pull &&
  docker-compose -f InstaladorVPS/docker-compose.yml build &&
  docker-compose -f InstaladorVPS/docker-compose.yml up -d
"
```

---

## ⚠️ REGRAS DE OURO

### 1. SEMPRE Ler Antes de Editar

```
❌ NUNCA editar arquivo sem ler primeiro
✅ SEMPRE usar Read tool antes de Edit/Write
```

### 2. SEMPRE Seguir Padrões Existentes

```
❌ NUNCA criar estrutura nova sem verificar arquivos similares
✅ SEMPRE copiar padrão de arquivo que já funciona
```

### 3. SEMPRE Commitar Antes de Deploy

```
❌ NUNCA fazer deploy sem commit
✅ SEMPRE: git add → git commit → git push → deploy
```

### 4. SEMPRE Verificar Após Deploy

```
❌ NUNCA assumir que deploy funcionou
✅ SEMPRE verificar logs e acessar URL
```

### 5. NÃO Quebrar o Que Funciona

```
❌ NUNCA fazer "melhorias" não solicitadas
✅ SEMPRE fazer apenas o que foi pedido
```

### 6. Mínimas Alterações Necessárias

```
❌ NUNCA refatorar código que não está relacionado
✅ SEMPRE fazer a menor alteração possível
```

### 7. Testar Estrutura de Dados

```
❌ NUNCA assumir estrutura de dados
✅ SEMPRE verificar o que backend espera vs o que frontend envia
```

### 8. Consistência de Layout

```
❌ NUNCA usar `min-h-screen lg:ml-64` (padrão antigo)
✅ SEMPRE usar `flex h-screen` + `flex-1 overflow-auto lg:ml-0`
```

### 9. Não Confiar no Linter

```
❌ Linter pode remover código importante
✅ SEMPRE verificar arquivo após salvar
```

### 10. Documentar Decisões Importantes

```
❌ NUNCA deixar código sem comentário quando é algo específico
✅ SEMPRE adicionar comentário explicando "por quê"
```

---

## 📚 EXEMPLOS PRÁTICOS

### Exemplo 1: Adicionar Nova Página de Configuração

**Passo a passo completo:**

```bash
# 1. Ler página de referência
Read: packages/frontend/src/pages/ConfiguracoesRede.jsx

# 2. Criar nova página copiando estrutura
Write: packages/frontend/src/pages/MinhaConfiguracao.jsx

# 3. Adicionar rota
Edit: packages/frontend/src/App.jsx
# Adicionar: <Route path="/minha-config" element={<ProtectedRoute><MinhaConfiguracao /></ProtectedRoute>} />

# 4. Adicionar no sidebar
Edit: packages/frontend/src/components/Sidebar.jsx
# Adicionar item no menuSections

# 5. Testar localmente (se possível)
cd packages/frontend
npm run dev

# 6. Commit
git add packages/frontend/src/pages/MinhaConfiguracao.jsx
git add packages/frontend/src/App.jsx
git add packages/frontend/src/components/Sidebar.jsx
git commit -m "feat: Adiciona página Minha Configuração"
git push

# 7. Deploy
ssh -i ~/.ssh/vps_prevencao root@31.97.82.235 "
  cd /root/prevencao-no-radar &&
  git pull &&
  docker-compose -f InstaladorVPS/docker-compose.yml build frontend &&
  docker-compose -f InstaladorVPS/docker-compose.yml up -d frontend
"

# 8. Verificar
# Abrir http://31.97.82.235:3000/minha-config
```

---

### Exemplo 2: Adicionar Novo Endpoint no Backend

**Passo a passo completo:**

```bash
# 1. Ler controller de referência
Read: packages/backend/src/controllers/dvr-monitor.controller.ts

# 2. Criar novo controller ou adicionar função
Edit: packages/backend/src/controllers/meu.controller.ts

# 3. Adicionar rota
Edit: packages/backend/src/routes/index.ts

# 4. Commit
git add packages/backend/src/controllers/meu.controller.ts
git add packages/backend/src/routes/index.ts
git commit -m "feat: Adiciona endpoint /meu-endpoint"
git push

# 5. Deploy
ssh -i ~/.ssh/vps_prevencao root@31.97.82.235 "
  cd /root/prevencao-no-radar &&
  git pull &&
  docker-compose -f InstaladorVPS/docker-compose.yml build backend &&
  docker-compose -f InstaladorVPS/docker-compose.yml up -d backend
"

# 6. Verificar logs
ssh -i ~/.ssh/vps_prevencao root@31.97.82.235 "docker logs prevencao-backend --tail 30"

# 7. Testar endpoint
curl -X POST http://31.97.82.235:3001/meu-endpoint -H "Content-Type: application/json" -d '{"teste":"ok"}'
```

---

### Exemplo 3: Corrigir Bug de Validação

**Cenário:** Backend retorna "Campo X obrigatório" mas campo está preenchido

```bash
# 1. Ler controller do backend
Read: packages/backend/src/controllers/problema.controller.ts

# 2. Identificar estrutura esperada
# Exemplo: Backend espera { ip, usuario, senha }

# 3. Ler componente frontend
Read: packages/frontend/src/pages/PaginaProblema.jsx

# 4. Verificar estrutura enviada
# Exemplo: Frontend envia { config: { ip, usuario, senha } }

# 5. Corrigir frontend para enviar estrutura correta
Edit: packages/frontend/src/pages/PaginaProblema.jsx
# Mudar de:
#   api.post('/endpoint', { config: configData })
# Para:
#   api.post('/endpoint', { ip: configData.ip, usuario: configData.usuario, senha: configData.senha })

# 6. Commit
git add packages/frontend/src/pages/PaginaProblema.jsx
git commit -m "fix: Corrige estrutura de dados enviada para backend"
git push

# 7. Deploy frontend
ssh -i ~/.ssh/vps_prevencao root@31.97.82.235 "
  cd /root/prevencao-no-radar &&
  git pull &&
  docker-compose -f InstaladorVPS/docker-compose.yml build frontend &&
  docker-compose -f InstaladorVPS/docker-compose.yml up -d frontend
"

# 8. Testar
# Acessar página e tentar salvar
```

---

## 🎯 CHECKLIST ANTES DE DEPLOY

```
[ ] Li os arquivos que vou modificar
[ ] Entendi a estrutura existente
[ ] Fiz apenas as alterações necessárias
[ ] Testei estrutura de dados (frontend ↔ backend)
[ ] Verifiquei que não quebrei outras funcionalidades
[ ] Fiz git add dos arquivos alterados
[ ] Fiz git commit com mensagem clara
[ ] Fiz git push
[ ] Rodei git pull na VPS
[ ] Fiz build dos containers alterados
[ ] Subi os containers com up -d
[ ] Verifiquei logs dos containers
[ ] Testei a funcionalidade no navegador
```

---

## 🆘 COMANDOS DE EMERGÊNCIA

### Reverter Último Commit (Local)

```bash
# Ver último commit
git log -1

# Reverter (mantém alterações no working directory)
git reset --soft HEAD~1

# Reverter (DESCARTA alterações - CUIDADO!)
git reset --hard HEAD~1
```

### Reverter Deploy (VPS)

```bash
# Ver últimos commits
ssh -i ~/.ssh/vps_prevencao root@31.97.82.235 "cd /root/prevencao-no-radar && git log -3 --oneline"

# Voltar para commit anterior
ssh -i ~/.ssh/vps_prevencao root@31.97.82.235 "
  cd /root/prevencao-no-radar &&
  git reset --hard HEAD~1 &&
  docker-compose -f InstaladorVPS/docker-compose.yml build &&
  docker-compose -f InstaladorVPS/docker-compose.yml up -d
"
```

### Reiniciar Tudo do Zero (VPS)

```bash
ssh -i ~/.ssh/vps_prevencao root@31.97.82.235 "
  cd /root/prevencao-no-radar &&
  docker-compose -f InstaladorVPS/docker-compose.yml down &&
  docker-compose -f InstaladorVPS/docker-compose.yml build --no-cache &&
  docker-compose -f InstaladorVPS/docker-compose.yml up -d &&
  docker ps
"
```

### Ver Logs Completos

```bash
# Backend
ssh -i ~/.ssh/vps_prevencao root@31.97.82.235 "docker logs prevencao-backend"

# Frontend
ssh -i ~/.ssh/vps_prevencao root@31.97.82.235 "docker logs prevencao-frontend"

# Seguir logs em tempo real
ssh -i ~/.ssh/vps_prevencao root@31.97.82.235 "docker logs -f prevencao-backend"
```

---

## 📖 GLOSSÁRIO

| Termo | Significado |
|-------|-------------|
| **VPS** | Virtual Private Server - Servidor na nuvem (31.97.82.235) |
| **SSH** | Secure Shell - Protocolo para acesso remoto seguro |
| **Docker** | Plataforma de containers |
| **Container** | Ambiente isolado rodando aplicação |
| **Build** | Processo de compilação do código |
| **Deploy** | Publicar alterações em produção |
| **Commit** | Salvar alterações no Git |
| **Push** | Enviar commits para repositório remoto |
| **Pull** | Baixar commits do repositório remoto |
| **Frontend** | Interface visual (React) - Porta 3000 |
| **Backend** | API/servidor (Node.js) - Porta 3001 |
| **Linter** | Ferramenta que formata código automaticamente |

---

## 📞 INFORMAÇÕES FINAIS

### Acessos Rápidos

```bash
# SSH na VPS
ssh -i ~/.ssh/vps_prevencao root@31.97.82.235

# Ver containers rodando
ssh -i ~/.ssh/vps_prevencao root@31.97.82.235 "docker ps"

# Acessar aplicação
http://31.97.82.235:3000
```

### Senhas e Credenciais

- **SSH Root:** beto3107@
- **DVR IP:** 10.6.1.123
- **DVR Usuário:** admin
- **DVR Senha:** beto3107@

---

**🤖 Documento criado para Claude Code**
**📅 Última atualização:** 2025-12-22
**✍️ Autor:** Claude Sonnet 4.5

---

## ⚡ COMANDOS MAIS USADOS (RESUMO)

```bash
# Deploy completo após alterações
git add .
git commit -m "feat: Descrição"
git push
ssh -i ~/.ssh/vps_prevencao root@31.97.82.235 "cd /root/prevencao-no-radar && git pull && docker-compose -f InstaladorVPS/docker-compose.yml build && docker-compose -f InstaladorVPS/docker-compose.yml up -d && docker ps"

# Ver logs backend
ssh -i ~/.ssh/vps_prevencao root@31.97.82.235 "docker logs prevencao-backend --tail 50"

# Ver logs frontend
ssh -i ~/.ssh/vps_prevencao root@31.97.82.235 "docker logs prevencao-frontend --tail 50"

# Restart containers
ssh -i ~/.ssh/vps_prevencao root@31.97.82.235 "cd /root/prevencao-no-radar && docker-compose -f InstaladorVPS/docker-compose.yml restart"
```

---

**✨ Lembre-se: Leia antes de editar, siga padrões existentes, commit antes de deploy!**
