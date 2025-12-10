# 🤖 Instruções para Claude Code - Instalação Automatizada

## 📋 Prompt para Copiar e Colar

```
Claude, você é um assistente de instalação do sistema "Roberto Prevenção no Radar".

Por favor, execute a instalação completa seguindo estes passos:

1. VERIFICAÇÃO INICIAL:
   - Verificar se Docker Desktop está instalado
   - Se não estiver, instruir como instalar usando winget ou instalador manual
   - Verificar se Docker está rodando

2. COLETAR INFORMAÇÕES:
   - Nome da Empresa
   - CNPJ da Empresa
   - IP do servidor Zanthus (ERP)
   - Porta do Zanthus (padrão: 8080)
   - Token da API do Zanthus

3. CONFIGURAR AMBIENTE:
   - Criar arquivo packages/backend/.env com as configurações
   - Usar as informações coletadas para preencher as variáveis de ambiente

4. INICIAR SISTEMA:
   - Executar: docker-compose up -d --build
   - Aguardar containers iniciarem
   - Verificar se todos os serviços estão rodando

5. VERIFICAR INSTALAÇÃO:
   - Testar acesso ao backend: http://localhost:3001/api/health
   - Testar acesso ao frontend: http://localhost:3002
   - Confirmar que sistema está funcionando

6. CONFIGURAR FIREWALL (se instalação em rede):
   - Executar configurar-firewall.bat
   - Mostrar IP da máquina

7. RELATÓRIO FINAL:
   - Informar URLs de acesso
   - Mostrar credenciais de login padrão
   - Lembrar de trocar a senha

A pasta do projeto está em: C:\roberto-prevencao-no-radar

Execute a instalação completa e me informe cada passo realizado.
```

---

## 🚀 Processo Completo: Claude + Visual Studio Code

### Passo 1: Preparar Máquina do Cliente

No cliente, instalar:

1. **Visual Studio Code**
   - Baixar: https://code.visualstudio.com/
   - Instalação padrão (Next, Next, Finish)

2. **Claude Code Extension** (ou Claude Dev)
   - Abrir VS Code
   - Extensions (Ctrl+Shift+X)
   - Procurar: "Claude Code" ou "Claude Dev"
   - Instalar
   - Configurar API key da Anthropic

### Passo 2: Copiar Projeto

```bash
# Copiar do pen drive para C:\
xcopy /E /I /Y E:\roberto-prevencao-no-radar-main C:\roberto-prevencao-no-radar
```

### Passo 3: Abrir no VS Code

```bash
# Abrir projeto no VS Code
cd C:\roberto-prevencao-no-radar
code .
```

### Passo 4: Executar com Claude

1. Abrir Claude Code (ícone no VS Code)

2. Copiar e colar o prompt acima

3. Claude vai:
   - ✅ Verificar pré-requisitos
   - ✅ Perguntar dados do cliente
   - ✅ Configurar ambiente
   - ✅ Executar instalação
   - ✅ Verificar funcionamento
   - ✅ Gerar relatório

---

## 📝 Template de Conversa com Claude

### Prompt Completo (Versão Detalhada)

```markdown
# Instalação do Sistema Roberto Prevenção no Radar

Claude, você é um especialista em DevOps e vai me ajudar a instalar o sistema "Roberto Prevenção no Radar" nesta máquina.

## Contexto
- Sistema: Prevenção de fraudes em supermercados
- Stack: Docker, Node.js, PostgreSQL, React
- Localização: C:\roberto-prevencao-no-radar

## Dados do Cliente
Colete as seguintes informações:

1. Nome da Empresa: [perguntar]
2. CNPJ: [perguntar]
3. IP do servidor Zanthus (ERP): [perguntar]
4. Porta do Zanthus: [perguntar, padrão 8080]
5. Token da API Zanthus: [perguntar]

## Instalação Multi-Máquina?
Perguntar se será:
- [ ] Instalação em máquina única
- [ ] Servidor + clientes (perguntar IP desejado para servidor)

## Tarefas

### 1. Verificar Docker
- Executar: `docker --version`
- Se não instalado:
  - Verificar se existe: INSTALADORAUTOMATICO\Docker Desktop Installer.exe
  - Se sim, executar instalação
  - Se não, instruir uso de winget: `winget install Docker.DockerDesktop`
- Verificar se está rodando: `docker ps`

### 2. Configurar Ambiente
Criar arquivo `packages/backend/.env` com:

```env
# Banco de Dados
DATABASE_HOST=postgres
DATABASE_PORT=5432
DATABASE_NAME=market_security
DATABASE_USER=admin
DATABASE_PASSWORD=admin123

# Servidor
PORT=3001
NODE_ENV=production

# Segurança (gerar valores aleatórios)
JWT_SECRET=[gerar string aleatória de 64 caracteres]
API_TOKEN=[gerar string aleatória de 64 caracteres]

# Zanthus ERP (usar dados coletados)
ZANTHUS_BASE_URL=http://[IP_COLETADO]:[PORTA_COLETADA]
ZANTHUS_API_TOKEN=[TOKEN_COLETADO]

# MinIO
MINIO_ENDPOINT=minio
MINIO_PORT=9000
MINIO_USE_SSL=false
MINIO_ACCESS_KEY=f0a02f9d4320abc34679f4742eecbad1
MINIO_SECRET_KEY=3e928e13c609385d81df326d680074f2d69434d752c44fa3161ddf89dcdaca55
MINIO_BUCKET=market-security

# Integrações (padrão desabilitado)
INTERSOLID_ENABLED=false
EVOLUTION_ENABLED=false
```

### 3. Salvar Informações do Cliente
Criar arquivo `config-cliente.txt` com:

```
EMPRESA_NOME=[nome coletado]
EMPRESA_CNPJ=[cnpj coletado]
ZANTHUS_HOST=[ip coletado]
ZANTHUS_PORT=[porta coletada]
DATA_INSTALACAO=[data/hora atual]
INSTALADO_POR=[seu nome/Claude]
```

### 4. Iniciar Sistema
```bash
cd C:\roberto-prevencao-no-radar
docker-compose up -d --build
```

Aguardar ~2 minutos e monitorar logs:
```bash
docker-compose logs -f
```

### 5. Verificar Instalação
- Testar backend: `curl http://localhost:3001/api/health`
- Testar frontend: abrir `http://localhost:3002` no navegador
- Verificar containers: `docker ps`

### 6. Configurar Firewall (se instalação em rede)
Se for servidor para múltiplas máquinas:
```bash
# Executar como Administrador
.\configurar-firewall.bat
```

### 7. Teste Final
- [ ] Sistema abre no navegador
- [ ] Login funciona (admin@tradicaosjc.com.br / admin123)
- [ ] Navegação funciona
- [ ] Simulador de bipagens funciona

### 8. Relatório de Instalação

Gerar relatório final com:
- ✅ URLs de acesso (local e rede se aplicável)
- ✅ Credenciais padrão
- ✅ IP da máquina (se servidor)
- ✅ Comandos úteis (iniciar, parar, backup)
- ✅ Localização dos arquivos
- ✅ Próximos passos (trocar senha, criar usuários)

## Importante
- Executar comandos como Administrador quando necessário
- Verificar cada passo antes de prosseguir
- Relatar qualquer erro encontrado
- Salvar logs importantes
- Criar backup das configurações

Está pronto? Vamos começar!
```

---

## 🎯 Versão Simplificada (Prompt Rápido)

Para instalação rápida, use este prompt curto:

```
Claude, instale o sistema Roberto Prevenção no Radar:

1. Verificar Docker instalado e rodando
2. Coletar: Nome empresa, CNPJ, IP Zanthus, Porta Zanthus, Token Zanthus
3. Configurar packages/backend/.env com os dados
4. Executar: docker-compose up -d --build
5. Verificar: http://localhost:3002
6. Gerar relatório de instalação

Pasta: C:\roberto-prevencao-no-radar

Execute!
```

---

## 📊 Exemplo de Conversa

**Você:**
```
Claude, leia as instruções em INSTRUCOES-PARA-CLAUDE.md e execute a instalação completa do sistema.
```

**Claude vai:**
```
Entendido! Vou instalar o sistema Roberto Prevenção no Radar.
Vamos começar:

[1/8] Verificando Docker...
- Executando: docker --version
- ✅ Docker Desktop 4.26.1 encontrado
- ✅ Docker está rodando

[2/8] Coletando informações do cliente...
Por favor, forneça:
1. Nome da Empresa: _____
2. CNPJ: _____
...
```

---

## ⚡ Vantagens desta Abordagem

✅ **Sem necessidade de scripts bat complexos**
✅ **Claude adapta a instalação em tempo real**
✅ **Detecta e resolve problemas automaticamente**
✅ **Gera relatórios detalhados**
✅ **Pode fazer configurações personalizadas**
✅ **Aprende com cada instalação**

---

## 🔧 Requisitos na Máquina do Cliente

### Mínimo Necessário:
1. **Windows 10/11** (64-bit)
2. **Visual Studio Code** (gratuito)
3. **Claude Code Extension** (gratuito, precisa API key)
4. **Internet** (para Claude funcionar)
5. **Privilégios de Administrador**

### Opcional:
- Docker Desktop (Claude pode instalar)
- Git (útil mas não obrigatório)

---

## 💡 Alternativa: Claude em Modo Chat (Sem VS Code)

Se não quiser instalar VS Code, pode usar Claude direto no navegador:

1. Acessar: https://claude.ai/
2. Fazer upload de arquivos do projeto (zip)
3. Copiar o prompt de instalação
4. Claude dará instruções passo a passo
5. Você executa manualmente cada comando

---

## 🎓 Tutorial Completo

### Para o Técnico no Cliente:

1. **Instalar VS Code** (2 minutos)
   - https://code.visualstudio.com/
   - Download → Install → Next → Finish

2. **Instalar Claude Code** (1 minuto)
   - Abrir VS Code
   - Ctrl+Shift+X (Extensions)
   - Buscar "Claude Code"
   - Install
   - Inserir API Key (você fornece)

3. **Copiar Projeto** (1 minuto)
   ```
   xcopy /E /I E:\roberto-prevencao-no-radar-main C:\roberto-prevencao-no-radar
   ```

4. **Abrir Projeto** (10 segundos)
   ```
   cd C:\roberto-prevencao-no-radar
   code .
   ```

5. **Executar Claude** (10-15 minutos)
   - Abrir Claude Code
   - Colar prompt de instalação
   - Responder perguntas
   - Aguardar conclusão

6. **Pronto!** ✅

---

## 📞 Suporte

Se algo der errado:
1. Claude vai reportar o erro
2. Claude vai sugerir soluções
3. Claude pode pesquisar no projeto para resolver
4. Você pode pedir ajuda ao Claude em tempo real

---

**Criado em**: 2025-12-07
**Versão**: 1.0
**Atualizado em**: 2025-12-07
