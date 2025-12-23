# 🚀 Instalador Automático VPS - Prevenção no Radar

Instalador automatizado para servidores Linux (VPS). Detecta automaticamente o IP público, gera senhas seguras e configura todo o ambiente Docker.

---

## 🎯 INSTALAÇÃO EM 1 COMANDO (RECOMENDADO)

Cole este comando único no terminal da sua VPS para instalar tudo automaticamente:

```bash
cd /root && rm -rf prevencao-no-radar && git clone https://github.com/Betotradicao/NOVO-PREVEN-O.git prevencao-no-radar && cd prevencao-no-radar/InstaladorVPS && chmod +x INSTALAR-AUTO.sh && ./INSTALAR-AUTO.sh
```

**O que este comando faz:**
1. ✅ Vai para /root
2. 🧹 Remove instalação anterior (se existir)
3. 📥 Clona repositório atualizado do GitHub
4. 📂 Entra na pasta do instalador
5. 🔓 Dá permissão de execução
6. 🚀 Executa instalador automático

**Durante a instalação:**
- 📋 Instala Docker (se necessário)
- 🔗 Instala e configura Tailscale
- 🔐 Mostra link de autenticação do Tailscale (abra no navegador)
- ⏳ Após autenticar, continua automaticamente
- 💾 Salva todas credenciais no banco de dados
- ✅ Sistema pronto em 5-10 minutos!

**Após a instalação, acesse:**
- Frontend: `http://IP_DA_VPS:3000`
- Primeiro acesso: `http://IP_DA_VPS:3000/first-setup`

---

## ⚡ VPS DO ZERO ABSOLUTO (Ubuntu/Debian novo)

Se você acabou de criar uma VPS limpa, execute estes comandos na ordem:

```bash
# 1. Atualizar sistema
sudo apt-get update && sudo apt-get upgrade -y

# 2. Instalar Git
sudo apt-get install git -y

# 3. Instalar Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo usermod -aG docker $USER

# 4. Instalar Docker Compose
sudo apt-get install docker-compose-plugin -y

# 5. Reiniciar shell (para aplicar permissões Docker)
newgrp docker

# 6. Clonar repositório
git clone https://github.com/Betotradicao/NOVO-PREVEN-O.git
cd NOVO-PREVEN-O/InstaladorVPS

# 7. Dar permissão de execução ao instalador
chmod +x INSTALAR-AUTO.sh

# 8. Executar instalador
sudo ./INSTALAR-AUTO.sh
```

**Pronto!** Em 5-10 minutos sua aplicação estará rodando.

Acesse: `http://SEU_IP:3000/first-setup` (o IP será exibido ao final da instalação)

---

## ✨ Características

- ✅ **100% Automático** - Zero configuração manual
- 🔍 **Detecção de IP** - Identifica automaticamente o IP público da VPS
- 🔐 **Senhas Seguras** - Gera senhas aleatórias de 24 caracteres
- 📝 **Configuração Automática** - Cria arquivo .env com todos os parâmetros
- 💾 **Backup de Credenciais** - Salva todas as senhas em arquivo CREDENCIAIS.txt
- 🐳 **Docker Compose** - Orquestra todos os serviços automaticamente

## 📋 Pré-requisitos

Certifique-se de que sua VPS possui:

- ✅ Sistema operacional: Ubuntu 20.04+ / Debian 11+ / CentOS 8+
- ✅ Docker instalado (versão 20.10+)
- ✅ Docker Compose instalado (versão 2.0+)
- ✅ Portas liberadas: 3000, 3001, 5434, 9010, 9011
- ✅ Mínimo 2GB RAM, 2 CPU cores, 20GB disco

### Instalar Docker (se necessário)

```bash
# Ubuntu/Debian
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo usermod -aG docker $USER

# Instalar Docker Compose
sudo apt-get update
sudo apt-get install docker-compose-plugin
```

## 🚀 Instalação Rápida (3 comandos)

```bash
# 1. Clonar repositório
git clone https://github.com/Betotradicao/NOVO-PREVEN-O.git
cd NOVO-PREVEN-O/InstaladorVPS

# 2. Dar permissão de execução
chmod +x INSTALAR-AUTO.sh

# 3. Executar instalador
sudo ./INSTALAR-AUTO.sh
```

**Pronto!** Em 2-5 minutos sua aplicação estará rodando.

## 📖 O que o instalador faz?

1. ✅ Verifica se Docker e Docker Compose estão instalados
2. 🔍 Detecta automaticamente o IP público da VPS
3. 🔐 Gera senhas aleatórias seguras para:
   - MinIO (usuário: admin)
   - PostgreSQL (usuário: postgres)
   - JWT Secret
   - API Token
4. 📝 Cria arquivo `.env` com todas as configurações
5. 🧹 Remove containers antigos (se existirem)
6. 🐳 Inicia todos os serviços via Docker Compose:
   - PostgreSQL (banco de dados)
   - MinIO (armazenamento de arquivos)
   - Backend (API Node.js)
   - Frontend (React)
   - Cron (verificações automáticas)
7. 💾 Salva credenciais em `CREDENCIAIS.txt`
8. 📊 Exibe status e instruções de acesso

## 🌐 Acessando o Sistema

Após a instalação, você poderá acessar:

- **Frontend (Interface Web)**: `http://SEU_IP:3000`
- **Backend (API)**: `http://SEU_IP:3001`
- **MinIO Console**: `http://SEU_IP:9011`
- **PostgreSQL**: `SEU_IP:5434`

> ⚠️ Substitua `SEU_IP` pelo IP público da sua VPS (será exibido ao final da instalação)

### 🎯 Primeiro Acesso

1. **Acesse**: `http://SEU_IP:3000/first-setup`
2. **Preencha** os dados da sua empresa (CNPJ, Razão Social, etc.)
3. **Crie** o primeiro usuário administrador
4. **Faça login** com as credenciais criadas
5. **Pronto!** Sistema configurado e pronto para uso

### ✅ Verificando a Instalação

Após o login, vá em **Configurações → APIs** para verificar:

- ✅ **PostgreSQL** - Clique em "Testar Conexão" (deve ficar verde)
- ✅ **MinIO** - Clique em "Testar Conexão" (deve ficar verde)
- ✅ **Token de API** - Vá em "Segurança" para ver o token gerado

Todas as credenciais são carregadas automaticamente do banco de dados!

## 🔐 Credenciais

Todas as credenciais geradas são exibidas ao final da instalação e salvas em:

- `CREDENCIAIS.txt` - Arquivo com todas as senhas
- `.env` - Arquivo de configuração (usado pelo Docker)

**Exemplo de credenciais geradas:**

```
MinIO:
  Console: http://185.123.45.67:9011
  Usuário: admin
  Senha: Xy9mK2@pL5vN8qR3tW6#

PostgreSQL:
  Host: 185.123.45.67
  Porta: 5434
  Usuário: postgres
  Senha: Qw7eR2@tY4uI9oP1aS5#
  Database: prevencao_db

API Token:
  Zx3cV6@bN8mM2kL4jH9$
```

## 🛠️ Comandos Úteis

### Ver logs dos containers

```bash
cd NOVO-PREVEN-O/InstaladorVPS

# Todos os containers
docker compose -f docker-compose-producao.yml logs -f

# Apenas backend
docker compose -f docker-compose-producao.yml logs -f backend

# Apenas frontend
docker compose -f docker-compose-producao.yml logs -f frontend
```

### Parar aplicação

```bash
docker compose -f docker-compose-producao.yml down
```

### Reiniciar aplicação

```bash
docker compose -f docker-compose-producao.yml restart
```

### Reiniciar apenas um serviço

```bash
docker compose -f docker-compose-producao.yml restart backend
```

### Ver status dos containers

```bash
docker compose -f docker-compose-producao.yml ps
```

### Atualizar aplicação (após git pull)

```bash
docker compose -f docker-compose-producao.yml down
docker compose -f docker-compose-producao.yml up -d --build
```

### Remover TUDO (dados + containers)

```bash
docker compose -f docker-compose-producao.yml down -v
```

> ⚠️ **CUIDADO**: O comando acima apaga todos os dados (banco + arquivos)!

## 🔧 Configuração Manual (Avançado)

Se preferir configurar manualmente, edite o arquivo `.env`:

```bash
nano .env
```

Depois, recrie os containers:

```bash
docker compose -f docker-compose-producao.yml down
docker compose -f docker-compose-producao.yml up -d --build
```

## 🐛 Resolução de Problemas

### Container não inicia

```bash
# Ver logs de erro
docker compose -f docker-compose-producao.yml logs backend

# Verificar status
docker compose -f docker-compose-producao.yml ps
```

### Porta já em uso

Edite o arquivo `docker-compose-producao.yml` e altere a porta externa:

```yaml
ports:
  - "8080:80"  # Mudou de 3000 para 8080
```

### Limpar e reinstalar

```bash
# Parar e remover tudo
docker compose -f docker-compose-producao.yml down -v

# Executar instalador novamente
sudo ./INSTALAR-AUTO.sh
```

### Verificar se portas estão abertas no firewall

```bash
# Ubuntu/Debian (UFW)
sudo ufw allow 3000
sudo ufw allow 3001
sudo ufw allow 5434
sudo ufw allow 9010
sudo ufw allow 9011

# CentOS/RHEL (Firewalld)
sudo firewall-cmd --permanent --add-port=3000/tcp
sudo firewall-cmd --permanent --add-port=3001/tcp
sudo firewall-cmd --permanent --add-port=5434/tcp
sudo firewall-cmd --permanent --add-port=9010/tcp
sudo firewall-cmd --permanent --add-port=9011/tcp
sudo firewall-cmd --reload
```

## 📁 Estrutura de Arquivos

```
InstaladorVPS/
├── INSTALAR-AUTO.sh              # Script de instalação automática
├── docker-compose-producao.yml    # Configuração dos containers
├── Dockerfile.backend             # Build do backend
├── Dockerfile.frontend            # Build do frontend
├── README.md                      # Este arquivo
├── .env                          # Gerado automaticamente
└── CREDENCIAIS.txt               # Gerado automaticamente
```

## 🔄 Diferenças vs InstaladorDOCKER (Windows)

| Característica | InstaladorDOCKER | InstaladorVPS |
|----------------|------------------|---------------|
| Sistema | Windows | Linux (VPS) |
| Script | INSTALAR-AUTO.bat | INSTALAR-AUTO.sh |
| Detecção de IP | Manual | Automática |
| Geração de senhas | PowerShell | /dev/urandom |
| Docker Compose | docker-compose | docker compose |
| Portas padrão | Dev (3004, 5433) | Prod (3000, 5434) |

## 📞 Suporte

Se encontrar problemas:

1. Verifique os logs: `docker compose -f docker-compose-producao.yml logs`
2. Consulte a documentação do projeto
3. Abra uma issue no GitHub

## 🔗 Tailscale - Acesso à Rede Local do Cliente

O Tailscale é instalado automaticamente na VPS e permite acesso seguro às APIs locais dos clientes (Zanthus, Intersolid, etc) sem precisar abrir portas no roteador ou configurar VPN complexa.

### Como Funciona

```
┌─────────────────────┐         ┌─────────────────────┐
│   VPS (Nuvem)       │         │  Cliente (Loja)     │
│   Tailscale ✓       │◄────────►│  Tailscale ✓        │
│                     │ Internet│                     │
│  Backend acessando  │         │  APIs Locais:       │
│  APIs do cliente    │         │  - Zanthus :8010    │
│                     │         │  - Intersolid :3003 │
└─────────────────────┘         └─────────────────────┘
```

### 📋 Configuração no Cliente (Windows)

**1. Instalar Tailscale no Windows do Cliente:**

Baixe e instale: https://tailscale.com/download/windows

**2. Configurar Compartilhamento de Rede:**

Abra **PowerShell como Administrador** (Windows + X → PowerShell Admin) e execute:

```powershell
tailscale up --advertise-routes=10.6.1.0/24 --accept-routes
```

> ⚠️ **IMPORTANTE**: Substitua `10.6.1.0/24` pela rede local do cliente!
>
> Para descobrir a rede:
> - Abra CMD e execute: `ipconfig`
> - Procure por "Endereço IPv4" (ex: 192.168.1.100)
> - Se for `192.168.1.X`, use: `192.168.1.0/24`
> - Se for `10.6.1.X`, use: `10.6.1.0/24`

**3. Aprovar Rota no Painel Web:**

1. Acesse: https://login.tailscale.com/admin/machines
2. Encontre a máquina do cliente
3. Clique nos **3 pontinhos** (⋮) → **"Edit route settings"**
4. Marque a checkbox da rede (ex: `10.6.1.0/24`)
5. Clique em **"Approve"**

**Pronto!** A VPS agora consegue acessar as APIs locais do cliente!

### 🧪 Testar Conexão

Na VPS, teste o acesso:

```bash
# Exemplo: acessar Intersolid
curl http://10.6.1.102:3003

# Exemplo: acessar Zanthus
curl http://10.6.1.10:8010
```

Se retornar dados (mesmo que erro 401), significa que está funcionando! ✅

### 📝 Configurar APIs no Sistema

Após conectar o Tailscale:

1. Acesse: `http://SEU_IP:3000`
2. Vá em **Configurações → APIs**
3. Configure os endpoints usando os **IPs da rede local**:
   - **Intersolid**: `http://10.6.1.102:3003`
   - **Zanthus**: `http://IP_LOCAL:PORTA`

### 🔍 Comandos Úteis Tailscale

```bash
# Ver IP na rede Tailscale
tailscale ip -4

# Ver status da conexão
tailscale status

# Listar dispositivos conectados
tailscale status --peers

# Desconectar
tailscale down

# Reconectar
tailscale up --accept-routes
```

### ❓ Troubleshooting

**Erro: "Connection refused" ao acessar API do cliente**
- Verifique se o Tailscale está rodando no cliente: `tailscale status`
- Confirme se a rota foi aprovada no painel web
- Verifique se o IP e porta da API estão corretos

**Erro: "No route to host"**
- A rede compartilhada pode estar incorreta
- No cliente Windows, execute novamente com a rede correta:
  ```powershell
  tailscale up --advertise-routes=REDE_CORRETA/24 --accept-routes
  ```

**Cliente não aparece no painel**
- Verifique se fez login com a mesma conta em ambos dispositivos
- Restart o serviço: `tailscale down && tailscale up`

---

## ⚠️ Segurança

- 🔐 As senhas são geradas aleatoriamente a cada instalação
- 💾 Mantenha o arquivo `CREDENCIAIS.txt` em local seguro
- 🔒 Considere usar HTTPS em produção (configure um proxy reverso como Nginx)
- 🛡️ Configure firewall adequadamente
- 🔄 Faça backups regulares dos volumes Docker
- 🔗 Tailscale usa criptografia WireGuard ponta-a-ponta

## 📝 Licença

Este projeto está sob a licença especificada no repositório principal.
