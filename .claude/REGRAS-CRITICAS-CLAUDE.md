# REGRAS CRITICAS - INSTALADOR VPS MULTI-TENANT

## REGRA #1: Arquitetura Multi-Tenant

**VPS Atual:** `46.202.150.64` (alias SSH: `vps2-hostinger`)
**Branch:** `TESTE`
**Repo compartilhado:** `/root/prevencao-radar-repo`

**Estrutura de diretórios na VPS:**
```
/root/
├── prevencao-radar-repo/          # Repositório Git compartilhado (fonte do código)
├── clientes/
│   ├── clientes.json              # Registro de todos os clientes instalados
│   ├── tradicao/
│   │   ├── docker-compose.yml     # Docker-compose específico do cliente
│   │   ├── .env                   # Variáveis de ambiente do cliente
│   │   └── ssh_keys/              # Chaves SSH ISOLADAS deste cliente
│   │       └── authorized_keys    # Só contém túneis DESTE cliente
│   └── piratininga/
│       ├── docker-compose.yml
│       ├── .env
│       └── ssh_keys/
│           └── authorized_keys
└── .ssh/
    └── authorized_keys            # Authorized_keys do HOST (sshd lê daqui)
```

**Padrão de nomes:**
- Containers: `prevencao-<cliente>-<servico>` (ex: `prevencao-tradicao-backend`)
- Banco: `postgres_<cliente>` (ex: `postgres_tradicao`)
- Network: `<cliente>_network`

---

## REGRA #2: SSH - Acesso à VPS

**SEMPRE usar o alias configurado:**
```bash
ssh vps2-hostinger "comando"
```

**NUNCA usar IP direto sem chave.**

---

## REGRA #3: Deploy de atualizações em cliente existente

**ORDEM CORRETA:**
```bash
# 1. Pull no repo compartilhado
ssh vps2-hostinger "cd /root/prevencao-radar-repo && git pull origin TESTE"

# 2. Rebuild APENAS backend e/ou frontend do cliente (NUNCA postgres/minio)
ssh vps2-hostinger "cd /root/clientes/<CLIENTE> && docker compose up -d --build backend"
ssh vps2-hostinger "cd /root/clientes/<CLIENTE> && docker compose up -d --build frontend"
```

**NUNCA FACA:**
```bash
docker compose down -v        # DESTROI DADOS (volumes)
docker compose up -d --build  # SEM especificar serviço = RECRIA TUDO
```

**FLAGS IMPORTANTES:**
- `--build`: Reconstroi a imagem com código novo
- `--no-deps`: Opcional, evita reiniciar dependências
- NUNCA `down -v` em produção (apaga banco)

---

## REGRA #4: Volumes do Backend (Docker-Compose)

Cada backend de cliente DEVE ter estes volumes:

```yaml
volumes:
  - backend_uploads:/app/uploads
  # SSH isolado por cliente (cada cliente tem suas próprias chaves de túnel)
  - ${CLIENT_DIR}/ssh_keys:/root/.ssh
  # SSH do HOST para registrar chaves no sshd (túneis funcionarem)
  - /root/.ssh:/root/host_ssh
```

**Por que 2 volumes SSH?**
- `ssh_keys:/root/.ssh` = Cópia ISOLADA do cliente (frontend só vê seus túneis)
- `/root/.ssh:/root/host_ssh` = Acesso ao authorized_keys do HOST (sshd precisa)

**Quando o backend cria/exclui um túnel via frontend, ele escreve em AMBOS:**
1. `/root/.ssh/authorized_keys` (container isolado - para listar no frontend)
2. `/root/host_ssh/authorized_keys` (host real - para o sshd autenticar)

---

## REGRA #5: Túneis SSH - Como Funcionam

**Fluxo de criação de túnel:**
1. Usuário configura túnel no frontend (nome, IP local, porta local, porta remota)
2. Backend gera par de chaves RSA 4096-bit
3. Chave pública é adicionada ao `authorized_keys` do container E do host
4. Chave privada é embutida no instalador .BAT baixado
5. Cliente executa .BAT no Windows da rede local
6. Serviço PowerShell conecta via SSH reverso à VPS
7. Porta remota na VPS encaminha tráfego para a rede local do cliente

**Isolamento por cliente:**
- Cada cliente SÓ vê seus próprios túneis no frontend
- O host tem TODOS os túneis de TODOS os clientes no seu authorized_keys
- Chaves usam restrição `restrict,port-forwarding,permitopen="localhost:PORTA"`

**Arquivo responsável:** `packages/backend/src/controllers/tunnel-installer.controller.ts`

---

## REGRA #6: Auto Instalador

**Comando para instalar novo cliente:**
```bash
bash <(curl -s https://raw.githubusercontent.com/Betotradicao/TESTES-/TESTE/InstaladorVPS/install-multitenant.sh)
```

**O instalador faz:**
1. Pede nome do cliente e domínio
2. Calcula portas automaticamente baseado em clientes existentes
3. Clona/atualiza repo compartilhado
4. Cria diretório do cliente com docker-compose.yml e .env
5. Cria diretório ssh_keys isolado com chmod 700
6. Build e start dos containers (postgres, minio, backend, frontend, cron)
7. Aguarda PostgreSQL ficar saudável
8. Cria tabelas adicionais (configurations, database_connections + coluna mappings)
9. Configura Nginx reverse proxy com SSL (Certbot)
10. Registra cliente no clientes.json
11. Mostra URLs de acesso e credenciais

**Arquivo:** `InstaladorVPS/install-multitenant.sh`
**Compatibilidade:** Envolto em `main()` para funcionar com `curl | bash`

---

## REGRA #7: Dockerfile do Backend

O Dockerfile do backend DEVE usar `node:18-slim` (NAO Alpine) com Oracle Instant Client:

```dockerfile
FROM node:18-slim
# Instalar Oracle Instant Client 23.4 (necessário para Thick mode)
RUN apt-get update && apt-get install -y libaio1 curl unzip ca-certificates openssh-client \
    && curl -o instantclient.zip https://download.oracle.com/otn_software/linux/instantclient/2340000/instantclient-basiclite-linux.x64-23.4.0.24.05.zip \
    && unzip instantclient.zip && rm instantclient.zip \
    && ldconfig
```

**Por que Thick mode?** Servidores Oracle mais antigos (ex: Intersolid) precisam do Oracle Instant Client nativo. Thin mode (JavaScript puro) falha com `NJS-138`.

**O instalador gera o Dockerfile automaticamente** - se mudar no repo, mudar também no instalador.

---

## REGRA #8: Seeds e Configurações Iniciais

O backend executa `seed-configurations.ts` no primeiro startup, populando a tabela `configurations`:

**Configurações pré-carregadas:**
- Evolution API: `evolution_server_url`, `evolution_api_key`
- Gmail Monitor DVR: `email_monitor_*` (email, password, host, etc.)
- App password Gmail atual: `hhyvmqlzzsidwrum`

**Arquivo:** `packages/backend/src/scripts/seed-configurations.ts`
**Comportamento:** Só insere se a chave NAO existir (não sobrescreve configurações existentes)

---

## REGRA #9: Banco de Dados Oracle dos Clientes (Intersolid)

**Dados de conexão (rede Tradicao/Piratininga):**
- Host: `10.6.1.100` (rede interna, via túnel)
- Porta: `1521`
- Service: `orcl.intersoul`
- Usuário: `POWERBI`
- Senha: `OdRz6J4LY6Y6`
- Schema: `INTERSOLID` (igual para todos os clientes Intersolid)

**Senha é sempre visível no frontend** (sem mascaramento com ***).

---

## REGRA #10: Excluir um cliente

```bash
# 1. Parar e remover containers + volumes
cd /root/clientes/<CLIENTE> && docker compose down -v

# 2. Remover diretório do cliente
rm -rf /root/clientes/<CLIENTE>

# 3. Limpar authorized_keys do host
sed -i '/<CLIENTE>/Id' /root/.ssh/authorized_keys

# 4. Remover do clientes.json
python3 -c '
import json
with open("/root/clientes/clientes.json") as f:
    data = json.load(f)
if "<CLIENTE>" in data.get("vps",{}).get("46",{}).get("clientes",{}):
    del data["vps"]["46"]["clientes"]["<CLIENTE>"]
with open("/root/clientes/clientes.json","w") as f:
    json.dump(data, f, indent=2)
'
```

---

## REGRA #11: Comandos úteis de verificação

```bash
# Ver todos os containers de um cliente
docker ps --filter name=prevencao-<CLIENTE>

# Logs do backend
docker logs prevencao-<CLIENTE>-backend --tail 50

# Verificar se banco conectou
docker logs prevencao-<CLIENTE>-backend | grep "Database connected"

# Ver authorized_keys do host (todos os túneis)
cat /root/.ssh/authorized_keys | grep @tunnel

# Ver authorized_keys isolado de um cliente
cat /root/clientes/<CLIENTE>/ssh_keys/authorized_keys

# Verificar se túnel está ativo (testar porta)
ss -tlnp | grep <PORTA_TUNEL>

# Ver todos os clientes instalados
cat /root/clientes/clientes.json | python3 -m json.tool
```

---

**Atualizado em:** 09/02/2026
**Status:** REGRAS ATIVAS - ARQUITETURA MULTI-TENANT
