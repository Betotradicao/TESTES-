# Sistema de Prevenção e Inteligência Contra Furtos em Mercado

Sistema completo de monitoramento e prevenção de furtos desenvolvido para mercados, com funcionalidades de rastreamento de produtos, análise de bipagens e detecção de fraudes.

## 🏗️ Arquitetura do Projeto

Este é um monorepo que contém:

- **Backend**: API REST com Express.js + TypeScript + PostgreSQL
- **Frontend**: Interface React + TypeScript + Tailwind CSS
- **Database**: PostgreSQL com TypeORM
- **Documentation**: Swagger UI para documentação da API
- **Containerization**: Docker Compose para desenvolvimento

## 📋 Pré-requisitos

- **Node.js** >= 18.0.0
- **npm** >= 9.0.0
- **Docker** e **Docker Compose**
- **PostgreSQL** (se rodar localmente sem Docker)

## 🚀 Setup e Execução em Desenvolvimento

### 1. Clone o Repositório

```bash
git clone <repository-url>
cd roberto-prevencao-no-radar
```

### 2. Configuração das Variáveis de Ambiente

#### Backend (.env)

Copie o arquivo de exemplo e configure as variáveis:

```bash
cp packages/backend/.env.example packages/backend/.env
```

Configure as seguintes variáveis no arquivo `packages/backend/.env`:

```env
NODE_ENV=development
PORT=3001
DATABASE_URL=postgresql://admin:admin123@localhost:5432/market_security
JWT_SECRET=your-secret-key-here-change-in-production
ERP_PRODUCTS_API_URL=http://localhost:3005
ERP_SALES_API_URL=http://localhost:3005/sales
```

#### Frontend (.env)

Configure as variáveis do frontend em `packages/frontend/.env`:

```env
VITE_API_URL=http://localhost:3001
```

### 3. Instalação das Dependências

```bash
# Instalar dependências do monorepo
npm install

# Instalar dependências do backend
cd packages/backend && npm install

# Instalar dependências do frontend
cd packages/frontend && npm install
```

### 4. Execução com Docker (Recomendado)

O método mais fácil é usar o Docker Compose que orquestra todos os serviços:

```bash
# Executar todos os serviços
npm run dev

# Ou diretamente
docker-compose up
```

Isso irá executar:
- **PostgreSQL** na porta `5432`
- **Backend** na porta `3001`
- **Frontend** na porta `3000`
- **Swagger UI** na porta `8080`

### 5. Execução Manual (Sem Docker)

Se preferir executar sem Docker:

#### 5.1. Banco de Dados

Execute um PostgreSQL local ou use Docker apenas para o banco:

```bash
docker run --name postgres-market \
  -e POSTGRES_DB=market_security \
  -e POSTGRES_USER=admin \
  -e POSTGRES_PASSWORD=admin123 \
  -p 5432:5432 \
  -d postgres:15-alpine
```

#### 5.2. Backend

```bash
cd packages/backend

# Executar migrações
npm run migration:run

# Iniciar em modo desenvolvimento
npm run dev
```

#### 5.3. Frontend

```bash
cd packages/frontend

# Iniciar em modo desenvolvimento
npm run dev
```

### 6. Comandos Úteis do Backend

#### Migrations

```bash
# Executar migrações pendentes
npm run migration:run

# Reverter última migração
npm run migration:revert

# Criar nova migração
npm run migration:create -- src/migrations/MigrationName
```

#### Scripts Administrativos

```bash
# Criar usuário
npm run create-user

# Validar vendas (cron job manual)
npm run sells:validate -- --date 2025-09-16
```

#### Build e Linting

```bash
# Build do projeto
npm run build

# Verificação de tipos
npm run typecheck

# Linting
npm run lint
```

### 7. Comandos Úteis do Frontend

```bash
# Build para produção
npm run build

# Preview do build
npm run preview

# Linting
npm run lint
```

## 🗂️ Estrutura do Projeto

```
roberto-prevencao-no-radar/
├── packages/
│   ├── backend/                 # API Express + TypeScript
│   │   ├── src/
│   │   │   ├── controllers/     # Controladores da API
│   │   │   ├── entities/        # Entidades TypeORM
│   │   │   ├── middleware/      # Middlewares Express
│   │   │   ├── migrations/      # Migrations do banco
│   │   │   ├── routes/          # Rotas da API
│   │   │   ├── scripts/         # Scripts administrativos
│   │   │   ├── services/        # Serviços e lógica de negócio
│   │   │   └── config/          # Configurações
│   │   ├── .env                 # Variáveis de ambiente
│   │   └── package.json
│   └── frontend/                # Interface React
│       ├── src/
│       │   ├── components/      # Componentes React
│       │   ├── pages/           # Páginas da aplicação
│       │   ├── services/        # Serviços HTTP (Axios)
│       │   └── utils/           # Utilitários
│       ├── .env                 # Variáveis de ambiente
│       └── package.json
├── docker-compose.yml           # Orquestração dos serviços
├── projeto.md                   # Documentação técnica do projeto
└── README.md                    # Este arquivo
```

## 🔌 APIs e Endpoints

### Autenticação

- `POST /api/auth/login` - Login do usuário

### Produtos

- `GET /api/products` - Listar produtos do ERP com status de ativação
- `PUT /api/products/:id/activate` - Ativar/desativar produto individual
- `PUT /api/products/bulk-activate` - Ativação/desativação em massa

### Bipagens

- `GET /api/bips` - Listar bipagens com filtros

### Vendas

- `GET /api/sales` - Proxy para API do ERP
- `GET /api/sells` - Vendas processadas e validadas

### Documentação

- **Swagger UI**: http://localhost:8080 (via Docker)
- **API Docs**: http://localhost:3001/api-docs

## 🔄 Processo de Cron Jobs

O sistema possui um cron job automático que roda às **5h da manhã** todos os dias:

1. **Busca vendas do dia anterior** via API do ERP
2. **Filtra produtos ativos** no sistema
3. **Valida contra bipagens** registradas
4. **Salva resultados** na tabela `sells`
5. **Classifica status**:
   - `verified`: Produto vendido e bipado corretamente
   - `notified`: Produto vendido mas não bipado (possível furto)

### Execução Manual do Cron

```bash
cd packages/backend
npm run sells:validate -- --date 2025-09-16
```

## 🎨 Funcionalidades Principais

### Dashboard
- Visão geral do sistema
- Navegação principal

### Bipagens Ao Vivo
- Monitoramento em tempo real das bipagens
- Filtros por data, status e produto
- Lazy loading para performance

### Ativar Produtos
- **Gestão de produtos** do ERP
- **Ativação/desativação individual**
- **Seleção e ação em massa**
- **Interface otimizada para mobile**
- **Confirmações de segurança**

### Resultados do Dia
- Análise de vendas validadas vs bipagens
- Identificação de possíveis furtos
- Relatórios detalhados

## 🔧 Tecnologias Utilizadas

### Backend
- **Express.js** - Framework web
- **TypeScript** - Tipagem estática
- **TypeORM** - ORM para PostgreSQL
- **JWT** - Autenticação
- **Swagger** - Documentação da API
- **Axios** - Cliente HTTP
- **node-cron** - Agendamento de tarefas
- **bcrypt** - Hash de senhas

### Frontend
- **React 19** - Interface de usuário
- **TypeScript** - Tipagem estática
- **Tailwind CSS** - Framework CSS
- **React Router** - Roteamento
- **Axios** - Cliente HTTP
- **Vite** - Build tool

### DevOps
- **Docker** - Containerização
- **Docker Compose** - Orquestração
- **PostgreSQL** - Banco de dados
- **ESLint** - Linting
- **Nodemon** - Hot reload

## 🎯 Performance e Otimizações

### Backend
- **Cache Service** para requisições ERP
- **Processamento em lotes** para ativação em massa
- **Promise.allSettled** para paralelização
- **Batch size configurável** (100 produtos por lote)

### Frontend
- **Lazy loading** para listas grandes
- **Debouncing** em filtros
- **Estado local otimizado** com Sets para seleções
- **Componentes memoizados**

## 🔒 Segurança

- **Autenticação JWT**
- **Middleware de autenticação** em todas as rotas protegidas
- **Validação de entrada** com express-validator
- **Hash de senhas** com bcrypt
- **Sanitização de dados**
- **CORS configurado**

## 📱 Responsividade

O sistema foi desenvolvido com **mobile-first approach**:
- **Tailwind CSS** para responsividade
- **Flexbox** e **Grid** layouts
- **Componentes adaptativos**
- **Touch-friendly** interfaces
- **Otimização para telas pequenas**

## 🚀 Deploy e Produção

Para produção, certifique-se de:

1. **Alterar variáveis de ambiente**:
   - `NODE_ENV=production`
   - JWT_SECRET forte e único
   - URLs de produção para APIs

2. **Build dos projetos**:
   ```bash
   npm run build
   ```

3. **Executar migrações**:
   ```bash
   npm run migration:run
   ```

4. **Configurar proxy reverso** (Nginx)
5. **SSL/TLS** para HTTPS
6. **Monitoramento** e logs

## 🐛 Troubleshooting

### Erro de Conexão com Banco
- Verificar se PostgreSQL está rodando
- Conferir variáveis de ambiente
- Validar string de conexão

### Erro de CORS
- Verificar URLs do frontend nas configurações
- Confirmar configuração do CORS no backend

### Problemas de Build TypeScript
- Executar `npm run typecheck`
- Verificar dependências e versões

### Performance Lenta
- Verificar queries do banco
- Analisar logs de cache
- Monitorar uso de memória

## 📞 Suporte

Para suporte técnico ou dúvidas sobre o projeto, consulte:
- **Documentação técnica**: `projeto.md`
- **API Documentation**: Swagger UI
- **Logs da aplicação**: Console do Docker