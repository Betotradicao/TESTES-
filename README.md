# Prevenção no Radar - Sistema de Segurança para Mercados

Sistema completo de monitoramento e prevenção de furtos em tempo real desenvolvido para supermercados, com rastreamento de produtos via código de barras, análise inteligente de bipagens e detecção automática de fraudes.

---

## 📋 Índice

- [Instalação VPS](#-instalação-em-vps-servidor-linux)
- [Como Funciona o Sistema](#-como-funciona-o-sistema)
- [Arquitetura e Tecnologias](#-arquitetura-e-tecnologias)
- [Sistema de Código de Barras](#-sistema-de-código-de-barras-scanners)
- [Configuração Pós-Instalação](#-configuração-pós-instalação)
- [Integrações](#-integrações)
- [Manutenção e Atualizações](#-manutenção-e-atualizações)

---

## 📚 Documentação

Este projeto possui 2 READMEs principais:

- **[README.md](README.md)** (este arquivo) - Visão geral do sistema, como funciona, instalação e uso
- **[README-INSTALADOR-VPS.md](README-INSTALADOR-VPS.md)** - Documentação técnica detalhada do auto-instalador VPS

---

## 🚀 Instalação em VPS (Servidor Linux)

### Pré-requisitos

- **VPS/Servidor**: Ubuntu 20.04+ ou Debian 11+
- **Recursos mínimos**: 2 GB RAM, 20 GB disco, 1 vCPU
- **Acesso**: SSH com permissões root
- **Conectividade**: Portas 3000, 3001, 5434, 9010, 9011 abertas

### Instalação Automática (Recomendado)

Execute este comando como root na VPS:

```bash
cd /root
git clone https://github.com/Betotradicao/TESTES-.git prevencao-radar-install
cd prevencao-radar-install/InstaladorVPS
sudo bash INSTALAR-AUTO.sh
```

**O que o instalador faz automaticamente:**

1. ✅ **Detecta IP público** da VPS (via curl ifconfig.me)
2. ✅ **Instala Tailscale** (VPN segura para acessar rede local do cliente)
3. ✅ **Cria arquivo .env** com todas as configurações:
   - IP da VPS detectado automaticamente
   - Credenciais de email pré-configuradas
   - URLs de frontend e backend
   - Timezone configurado para América/São Paulo
4. ✅ **Inicia containers Docker**:
   - PostgreSQL 16 (banco de dados)
   - Backend Node.js + TypeScript (API REST)
   - Frontend React + TypeScript (interface web)
   - MinIO (armazenamento de fotos/vídeos)
   - Cron Service (tarefas agendadas)
5. ✅ **Aguarda backend inicializar** (60 segundos)
6. ✅ **Executa migrations** automaticamente
7. ✅ **Cria usuário MASTER** (Roberto / senha: Beto3107@@##)
8. ✅ **Popula configurações** pré-definidas (Evolution API, Email, etc)

### Após a Instalação

Acesse `http://[IP_VPS]:3000` e você verá a tela de **First Setup** para criar:
- Dados da empresa do cliente
- Usuário ADMIN do cliente

**URLs de Acesso:**
- Frontend: `http://[IP]:3000`
- Backend API: `http://[IP]:3001/api`
- Swagger Docs: `http://[IP]:3001/api-docs`
- MinIO Console: `http://[IP]:9011`

**Credenciais MASTER (desenvolvedor):**
- Email: `beto@prevencaonoradar.com.br`
- Senha: `Beto3107@@##`

---

## 🎯 Como Funciona o Sistema

### Fluxo Principal

```
1. SCANNER (Loja)
   ↓
   └─> Leitor de código de barras USB conectado ao PC da loja
       ↓
       └─> Lê código EAN-13 do produto
           ↓
           └─> Envia para backend via Webhook HTTP

2. BACKEND (VPS)
   ↓
   └─> Recebe código de barras + timestamp
       ↓
       ├─> Busca produto no banco de dados (sincronizado do ERP)
       ├─> Registra evento de "bipagem" com foto/vídeo
       ├─> Verifica se produto está ATIVO (configurado pelo usuário)
       └─> Se ATIVO: Salva registro + envia notificação WhatsApp

3. ANÁLISE INTELIGENTE (Cron - 5h da manhã)
   ↓
   └─> Busca vendas do dia anterior via API do ERP (Zanthus/Intersolid)
       ↓
       └─> Compara VENDAS vs BIPAGENS
           ↓
           ├─> Se VENDEU mas NÃO BIPOU = 🚨 POSSÍVEL FURTO
           ├─> Se BIPOU mas NÃO VENDEU = ✅ Produto devolvido/trocado
           └─> Gera relatório com foto + vídeo do momento da bipagem

4. NOTIFICAÇÕES (WhatsApp)
   ↓
   └─> Via Evolution API (WhatsApp Business)
       ↓
       └─> Envia mensagens para grupo do gerente com:
           - Produto suspeito
           - Foto do momento
           - Horário exato
           - Funcionário responsável (se identificado)
```

### Componentes do Sistema

#### 1. Backend (API REST)
- **Tecnologia**: Node.js 18 + Express + TypeScript
- **Banco de Dados**: PostgreSQL 16 com TypeORM
- **Autenticação**: JWT + bcrypt
- **Funcionalidades**:
  - CRUD completo de produtos, vendas, bipagens
  - Sincronização com ERP (Zanthus, Intersolid)
  - Webhook para receber bipagens de scanners
  - Cron jobs para análise diária (5h AM)
  - Sistema de recuperação de senha por email
  - API de notificações WhatsApp (Evolution API)
  - Monitor de email DVR (alertas de câmeras)

#### 2. Frontend (Interface Web)
- **Tecnologia**: React 19 + TypeScript + Vite + Tailwind CSS
- **Páginas Principais**:
  - **Dashboard**: Visão geral com métricas do dia
  - **Bipagens Ao Vivo (VAR)**: Monitoramento em tempo real com fotos
  - **Ativar Produtos**: Gerenciar quais produtos monitorar
  - **Resultados do Dia**: Análise de furtos detectados
  - **Rankings**: Produtos mais furtados, funcionários com mais alertas
  - **Reconhecimento Facial**: Imagens do DVR via email
  - **Configurações**: APIs, Email, WhatsApp, Rede, Segurança

#### 3. PostgreSQL (Banco de Dados)
- **Entidades Principais**:
  - `users`: Usuários do sistema (MASTER, ADMIN, USER)
  - `companies`: Empresas cadastradas (multi-tenant)
  - `products`: Produtos do ERP sincronizados
  - `bips`: Registros de bipagens (código + foto + timestamp)
  - `sells`: Vendas do ERP
  - `employees`: Funcionários da loja
  - `configurations`: Configurações do sistema (chave-valor)

#### 4. MinIO (Armazenamento S3)
- **Armazena**: Fotos e vídeos das bipagens
- **Bucket**: `market-security`
- **Acesso**: Público para leitura (links diretos nas páginas)
- **Volume**: Pode crescer até 100+ GB em produção

#### 5. Cron Service
- **Execução**: Diariamente às 5h da manhã
- **Tarefas**:
  - Buscar vendas do dia anterior via API do ERP
  - Comparar vendas vs bipagens
  - Gerar relatório de possíveis furtos
  - Enviar notificações WhatsApp

---

## 🏗 Arquitetura e Tecnologias

### Stack Completo

```
┌─────────────────────────────────────────────────────────┐
│                        FRONTEND                         │
│   React 19 + TypeScript + Vite + Tailwind CSS          │
│   Porta 3000 (Nginx)                                    │
└─────────────────────────────────────────────────────────┘
                          ↓ HTTP
┌─────────────────────────────────────────────────────────┐
│                        BACKEND                          │
│   Node.js 18 + Express + TypeScript + TypeORM          │
│   Porta 3001                                            │
└─────────────────────────────────────────────────────────┘
          ↓                    ↓                   ↓
    ┌─────────┐          ┌─────────┐        ┌───────────┐
    │PostgreSQL│         │  MinIO  │        │  Cron     │
    │Porta 5434│         │Porta 9010│       │ (interno) │
    └──────────┘         └─────────┘        └───────────┘
```

### Containers Docker

```yaml
services:
  postgres:           # Banco de dados
    image: postgres:16-alpine
    port: 5434:5432
    volume: postgres-data (persistente)

  backend:            # API Node.js
    build: Dockerfile.backend
    port: 3001:3001
    depends_on: postgres, minio

  frontend:           # React App
    build: Dockerfile.frontend
    port: 3000:80
    nginx: serve arquivos estáticos

  minio:              # S3-compatible storage
    image: minio/minio:latest
    port: 9010:9000, 9011:9001
    volume: minio-data (persistente)

  cron:               # Tarefas agendadas
    build: Dockerfile.backend
    command: node-cron daily-verification
```

### Fluxo de Deploy Automático

```bash
# 1. Desenvolvedor faz commit
git add .
git commit -m "feat: nova funcionalidade"
git push origin main

# 2. Na VPS, atualizar código
ssh root@[IP_VPS]
cd /root/prevencao-radar-install
git pull

# 3. Rebuild e restart do serviço
cd InstaladorVPS
docker compose -f docker-compose-producao.yml build --no-cache backend
docker compose -f docker-compose-producao.yml up -d backend

# Frontend (se necessário)
docker compose -f docker-compose-producao.yml build --no-cache frontend
docker compose -f docker-compose-producao.yml up -d frontend
```

---

## 📱 Sistema de Código de Barras (Scanners)

### Como Funciona a Leitura de Código de Barras

#### 1. Hardware Necessário

**Scanner USB (Recomendado: Leitor Fixo ou Pistola)**
- Tipo: Leitor de código de barras USB (plug-and-play)
- Protocolo: Emula teclado (Keyboard Wedge)
- Formato suportado: EAN-13, EAN-8, UPC-A, Code 128
- Conexão: USB 2.0+
- Exemplos de modelos:
  - Honeywell Voyager 1200g
  - Zebra DS2208
  - Datalogic QuickScan QD2430

#### 2. Configuração do Scanner

**Passo a passo:**

1. **Conectar o Scanner**
   - Plugar o scanner na porta USB do PC da loja
   - Windows reconhece automaticamente como "HID Keyboard Device"
   - Não precisa instalar drivers (plug-and-play)

2. **Configurar Modo de Saída**
   - Abrir Notepad para testar
   - Bipar um produto
   - Deve aparecer o código (ex: `7891234567890`) + ENTER
   - Se não der ENTER automático, configurar o scanner:
     - Scanear código de configuração "Add Suffix CR+LF" (manual do scanner)

3. **Configurar Prefixo (Opcional)**
   - Para diferenciar scanner de digitação manual
   - Adicionar prefixo como `SCAN:` antes do código
   - Scanear código de configuração "Add Prefix" (manual do scanner)

#### 3. Integração com o Sistema

**Método 1: Aplicação Desktop (Atual)**

```javascript
// Frontend roda em página web local
// Scanner "digita" o código na página ativa

const [barcodeBuffer, setBarcodeBuffer] = useState('');

useEffect(() => {
  const handleKeyPress = (e) => {
    if (e.key === 'Enter') {
      // Código completo recebido
      if (barcodeBuffer.length > 0) {
        enviarBipagem(barcodeBuffer);
        setBarcodeBuffer('');
      }
    } else {
      // Acumular dígitos
      setBarcodeBuffer(prev => prev + e.key);
    }
  };

  window.addEventListener('keypress', handleKeyPress);
  return () => window.removeEventListener('keypress', handleKeyPress);
}, [barcodeBuffer]);

const enviarBipagem = async (codigo) => {
  try {
    await api.post('/api/bips/webhook', {
      barcode: codigo,
      timestamp: new Date().toISOString(),
      employee_id: funcionarioAtual.id
    });
  } catch (error) {
    console.error('Erro ao enviar bipagem:', error);
  }
};
```

**Método 2: Service Python (Futuro)**

```python
# scanner-service.py
# Roda em background no PC da loja

import evdev
import requests
import time

# Detectar scanner USB
devices = [evdev.InputDevice(path) for path in evdev.list_devices()]
scanner = [d for d in devices if 'barcode' in d.name.lower()][0]

barcode_buffer = ""

for event in scanner.read_loop():
    if event.type == evdev.ecodes.EV_KEY:
        data = evdev.categorize(event)

        if data.keystate == 1:  # Key down
            if data.scancode == 28:  # ENTER
                # Enviar para backend
                requests.post('http://[VPS_IP]:3001/api/bips/webhook', json={
                    'barcode': barcode_buffer,
                    'timestamp': time.time(),
                    'source': 'scanner_usb'
                })
                barcode_buffer = ""
            else:
                # Acumular código
                barcode_buffer += data.keycode
```

#### 4. Fluxo Completo de uma Bipagem

```
1. Cliente passa produto no caixa
   ↓
2. Atendente bipa código de barras
   ↓
3. Scanner lê código EAN-13: 7891234567890
   ↓
4. Scanner envia para sistema (via keyboard ou Python service)
   ↓
5. Frontend/Service faz POST para /api/bips/webhook
   {
     "barcode": "7891234567890",
     "timestamp": "2025-01-06T12:34:56.789Z",
     "employee_id": "uuid-do-funcionario",
     "camera_id": "caixa-01" (opcional)
   }
   ↓
6. Backend processa:
   a) Busca produto no banco via código de barras
   b) Verifica se produto está ATIVO
   c) Se ATIVO:
      - Salva registro na tabela `bips`
      - Tira screenshot/foto da câmera (se conectada)
      - Salva foto no MinIO
      - Envia notificação WhatsApp (opcional)
   ↓
7. Registro salvo com:
   - ID único
   - Código de barras
   - Produto (nome, categoria, preço)
   - Funcionário responsável
   - Timestamp
   - Foto/vídeo URL (MinIO)
   - Status: PENDENTE (aguarda análise das 5h)
```

#### 5. Configuração na Tela do Sistema

**Menu: Configurações > Rede > Scanners**

```
┌─────────────────────────────────────────────┐
│  Scanners Cadastrados                       │
├─────────────────────────────────────────────┤
│  [+] Adicionar Scanner                      │
│                                             │
│  🔵 Scanner Caixa 01 (ATIVO)                │
│     IP: 192.168.1.101                       │
│     Porta: 5000                             │
│     Último ping: há 2 minutos               │
│     [Editar] [Desativar] [Remover]          │
│                                             │
│  🔴 Scanner Caixa 02 (OFFLINE)              │
│     IP: 192.168.1.102                       │
│     Porta: 5000                             │
│     Último ping: há 15 minutos              │
│     [Editar] [Ativar] [Remover]             │
└─────────────────────────────────────────────┘
```

---

## ⚙ Configuração Pós-Instalação

### 1. First Setup (Obrigatório)

Ao acessar `http://[IP_VPS]:3000` pela primeira vez:

```
TELA DE FIRST SETUP
┌──────────────────────────────────────────┐
│  Bem-vindo! Configure seu sistema       │
├──────────────────────────────────────────┤
│  📊 DADOS DA EMPRESA                     │
│  Nome Fantasia: [...................]    │
│  Razão Social:  [...................]    │
│  CNPJ:          [...................]    │
│  Endereço:      [...................]    │
│                                          │
│  👤 USUÁRIO ADMINISTRADOR                │
│  Nome:     [...................]         │
│  Username: [...................]         │
│  Email:    [...................]         │
│  Senha:    [...................]         │
│                                          │
│  [Cancelar]  [Finalizar Configuração]   │
└──────────────────────────────────────────┘
```

**O que acontece ao finalizar:**
- ✅ Cria empresa no banco (tabela `companies`)
- ✅ Cria usuário ADMIN vinculado à empresa (NOT MASTER)
- ✅ Redireciona para tela de login
- ✅ Sistema pronto para uso

### 2. Configurar APIs (Menu: Configurações > APIs)

#### A. Zanthus ERP (Buscar Vendas)
```
URL: http://10.6.1.101:3003
Endpoint de Vendas: /v1/vendas
Username: ROBERTO
Senha: [senha do ERP]
```

#### B. Intersolid (Buscar Produtos)
```
URL: http://10.6.1.102:3004
Endpoint de Produtos: /api/produtos
```

#### C. Evolution API (WhatsApp)
```
URL: http://31.97.82.235:8090
Token: F0A82E6394D6-4D5A-845A-FC0413873588
Instância: DVR FACIAL
Grupo WhatsApp ID: 120363421239599536@g.us
```

### 3. Configurar Email (Recuperação de Senha)

**Já vem pré-configurado** no instalador:
```env
EMAIL_USER=betotradicao76@gmail.com
EMAIL_PASS=fqojjjhztvganfya
```

Se quiser mudar para email do cliente, configure senha de app do Gmail:
1. https://myaccount.google.com/apppasswords
2. Criar senha de app para "Prevenção no Radar"
3. Atualizar no banco: `UPDATE configurations SET value = 'nova-senha' WHERE key = 'email_pass'`

### 4. Ativar Produtos para Monitoramento

**Menu: Prevenção de Bipagens > Ativar Produtos**

```
LISTA DE PRODUTOS (sincronizados do ERP)
┌────────────────────────────────────────────────┐
│  🔍 Buscar: [..................]  [Buscar]     │
│                                                │
│  ✅ Cerveja Heineken 350ml - R$ 4,50          │
│     EAN: 7891234567890                         │
│     [Desativar]                                │
│                                                │
│  ❌ Refrigerante Coca 2L - R$ 8,99            │
│     EAN: 7899876543210                         │
│     [Ativar]                                   │
│                                                │
│  [Ativar Todos] [Desativar Todos]             │
└────────────────────────────────────────────────┘
```

**Produtos ATIVOS** = sistema vai monitorar bipagens e comparar com vendas

---

## 🔗 Integrações

### 1. Tailscale (VPN para Acessar Rede Local)

**O instalador já configura Tailscale automaticamente!**

**Para que serve:**
- VPS precisa acessar APIs do ERP que estão na rede local do cliente (10.6.1.x)
- Tailscale cria uma VPN segura entre VPS e rede do cliente

**Como funciona:**
```
VPS (31.97.82.235) ─────┐
                         │ Tailscale VPN
PC Cliente (10.6.1.50) ─┴─────────────┐
                                      │
API Zanthus (10.6.1.101) ─────────────┤
API Intersolid (10.6.1.102) ──────────┘
```

**Configurar no cliente:**
1. Instalar Tailscale: https://tailscale.com/download
2. Fazer login com mesma conta da VPS
3. IP Tailscale do cliente aparece (ex: 100.64.0.5)
4. Atualizar no sistema: Configurações > Rede > IP Tailscale Cliente

### 2. WhatsApp (Evolution API)

**Já vem pré-configurado!**

**Servidor Evolution API:** http://31.97.82.235:8090
**Instância:** DVR FACIAL

**Testar envio:**
Menu: Configurações > APIs > Evolution API > [Testar Conexão]

**Notificações enviadas:**
- 🚨 Possível furto detectado (análise das 5h)
- 📸 Alerta DVR com imagem (monitor de email)
- ⚠️ Scanner offline

### 3. DVR (Monitor de Email)

**Monitoramento automático de alertas do DVR via Gmail**

**Como funciona:**
1. DVR envia email para `betotradicao76@gmail.com` com assunto "ALERTA DVR"
2. Email contém PDF anexo com imagem da câmera
3. Sistema verifica email a cada 30 segundos
4. Extrai imagem do PDF
5. Salva no MinIO
6. Envia para WhatsApp com a imagem

**Configuração:**
Menu: Configurações > Monitor Email

```
Email: betotradicao76@gmail.com
Senha App: ygrowrdaloqfgtcc
Assunto Filtro: ALERTA DVR
Intervalo: 30 segundos
WhatsApp: 120363421239599536@g.us
Status: ✅ ATIVO
```

---

## 🛠 Manutenção e Atualizações

### Atualizar Sistema

```bash
# 1. Acessar VPS via SSH
ssh root@[IP_VPS]

# 2. Ir para diretório do projeto
cd /root/prevencao-radar-install

# 3. Baixar atualizações do GitHub
git pull

# 4. Rebuild backend (se houve mudanças no código)
cd InstaladorVPS
docker compose -f docker-compose-producao.yml build --no-cache backend
docker compose -f docker-compose-producao.yml up -d backend

# 5. Rebuild frontend (se houve mudanças no código)
docker compose -f docker-compose-producao.yml build --no-cache frontend
docker compose -f docker-compose-producao.yml up -d frontend
```

### Ver Logs

```bash
# Logs do backend (API)
docker logs prevencao-backend-prod --tail 100 -f

# Logs do frontend
docker logs prevencao-frontend-prod --tail 50

# Logs do PostgreSQL
docker logs prevencao-postgres-prod --tail 50

# Todos os logs
cd /root/prevencao-radar-install/InstaladorVPS
docker compose -f docker-compose-producao.yml logs -f
```

### Backup do Banco de Dados

```bash
# Criar backup
docker exec prevencao-postgres-prod pg_dump -U postgres prevencao_db > backup_$(date +%Y%m%d).sql

# Restaurar backup
docker exec -i prevencao-postgres-prod psql -U postgres prevencao_db < backup_20250106.sql
```

### Reiniciar Serviços

```bash
cd /root/prevencao-radar-install/InstaladorVPS

# Reiniciar backend apenas
docker compose -f docker-compose-producao.yml restart backend

# Reiniciar todos
docker compose -f docker-compose-producao.yml restart
```

---

## 📞 Suporte

**Desenvolvedor:** Roberto (Beto)
**Email:** betotradicao76@gmail.com
**GitHub:** https://github.com/Betotradicao/TESTES-

---

## 📝 Licença

Sistema proprietário desenvolvido para Tradicão SJC e clientes.
