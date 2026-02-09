# Instalador Multi-Tenant VPS - Prevencao no Radar

**Versao:** 4.1 (Fevereiro 2026)
**Branch:** TESTE
**Repositorio:** https://github.com/Betotradicao/TESTES-

Instalador automatizado para servidores Linux (VPS). Cria ambientes isolados por cliente com subdominios, banco de dados dedicado, storage S3 e tuneis SSH seguros.

### Novidades v4.1
- Oracle auto-reload: conexao Oracle recarrega automaticamente ao salvar/testar pelo frontend (sem reiniciar backend)
- Botao "Salvar Tudo": preenche e salva TODOS os mapeamentos de todos os modulos com um clique
- Chave SSH publica exposta no frontend (aba Tunel) com botao "Copiar"
- Keepalive agressivo nos tuneis SSH (ServerAliveInterval=15, TCPKeepAlive=yes)
- Aba Feriados em Configuracoes (feriados nacionais pre-preenchidos por loja)
- Auto-instalador remoto via curl|bash (sem precisar acessar a VPS manualmente)

---

## ARQUITETURA DO SISTEMA

Cada cliente recebe um ambiente completamente isolado:

```
Cliente "nunes"
├── https://nunes.prevencaonoradar.com.br  (Frontend React)
├── API Backend (Node.js + TypeORM)
├── PostgreSQL 15 (banco isolado: postgres_nunes)
├── MinIO S3 (bucket isolado: minio-nunes)
├── Cron Container (4 jobs agendados)
└── Tuneis SSH isolados (Oracle, MSSQL, API ERP)
```

### Containers Docker por Cliente (5 servicos)

| Container | Imagem | Funcao |
|-----------|--------|--------|
| `prevencao-[nome]-postgres` | `postgres:15-alpine` | Banco de dados PostgreSQL |
| `prevencao-[nome]-minio` | `minio/minio:latest` | Storage S3 (imagens, fotos) |
| `prevencao-[nome]-backend` | Build customizado Node.js | API REST + Socket.io |
| `prevencao-[nome]-frontend` | Build customizado Nginx+Vite | Interface React SPA |
| `prevencao-[nome]-cron` | Build customizado Node.js+dcron | Tarefas agendadas |

### Portas Dinamicas

Cada cliente recebe portas unicas calculadas automaticamente via hash MD5 do nome:

| Servico | Faixa de Portas |
|---------|----------------|
| Frontend | 3000-3999 |
| Backend | 4000-4999 |
| PostgreSQL | 5400-5999 |
| MinIO API | 9000-9999 |
| MinIO Console | 9100-9999 |
| Tunel Oracle | 10000-10999 |
| Tunel MSSQL | 11000-11999 |
| Tunel API ERP | 12000-12999 |

O Nginx roteia tudo pela porta 80/443 usando subdominios (o usuario final nao precisa saber as portas).

---

## PRE-REQUISITOS

- **Sistema Operacional:** Ubuntu 20.04+ / Debian 11+
- **RAM Minima:** 2GB (recomendado 4GB para multiplos clientes)
- **Disco:** 20GB minimo
- **Portas necessarias:** 22 (SSH), 80 (HTTP), 443 (HTTPS)
- O instalador instala automaticamente: Docker, Docker Compose, Nginx, Certbot, Git

---

## INSTALACAO - PASSO A PASSO

### 1. Instalar via auto-instalador remoto (RECOMENDADO)

Rode este comando em qualquer VPS Linux. Ele instala tudo automaticamente (Docker, Nginx, Certbot, clona repo, cria cliente):

```bash
curl -sSL https://raw.githubusercontent.com/Betotradicao/TESTES-/TESTE/InstaladorVPS/install-multitenant.sh | bash
```

O instalador vai perguntar interativamente:
1. **Nome do cliente** - apenas letras minusculas e numeros (ex: `nunes`, `mercado01`, `piratininga`)
2. **Confirmacao** das configuracoes geradas (s/n)

### 2. Instalar manualmente (alternativa)

Se preferir clonar o repositorio primeiro:

```bash
ssh root@IP_DA_VPS
cd /root
git clone -b TESTE https://github.com/Betotradicao/TESTES-.git prevencao-radar-repo
cd prevencao-radar-repo/InstaladorVPS
bash install-multitenant.sh
```

**Alternativa:** Passar o nome direto como parametro (pula a confirmacao):

```bash
bash install-multitenant.sh piratininga
```

### 4. Configurar DNS no Registro.br

**ANTES ou DEPOIS** de rodar o instalador:

1. Acesse: https://registro.br
2. Dominios > prevencaonoradar.com.br > DNS > Adicionar Record
3. Crie entrada:
   - **Tipo:** A
   - **Nome:** nome-do-cliente (ex: `nunes`)
   - **Dados:** IP da VPS (ex: `46.202.150.64`)

### 5. Gerar certificado SSL

Apos o DNS propagar (5 min a 2 horas), o instalador tenta automaticamente. Se falhar, rode manualmente:

```bash
certbot --nginx -d nunes.prevencaonoradar.com.br
```

### 6. Acessar o sistema

- **URL:** `https://nunes.prevencaonoradar.com.br`
- **Primeiro Setup:** `https://nunes.prevencaonoradar.com.br/first-setup`

---

## O QUE O INSTALADOR FAZ AUTOMATICAMENTE

O instalador executa tudo automaticamente em sequencia:

### Infraestrutura
1. Verifica/instala Docker, Docker Compose, Nginx, Certbot, Git
2. Configura firewall UFW (portas 22, 80, 443 + rede Docker)
3. Clona/atualiza repositorio do GitHub (branch TESTE)

### Configuracao do Cliente
4. Valida nome do cliente (apenas letras minusculas e numeros)
5. Gera portas dinamicas unicas baseadas no nome
6. Gera senhas seguras de 32 caracteres (OpenSSL)
7. Cria arquivo `.env` com 50+ variaveis de ambiente
8. Gera `docker-compose.yml` com 5 servicos

### Deploy
9. Builda e inicia os 5 containers Docker
10. Aguarda PostgreSQL ficar healthy (max 30s)
11. Executa migrations do TypeORM automaticamente
12. Aguarda backend responder no `/api/health` (max 120s)
13. Cria tabelas adicionais no banco

### Configuracao Inicial
14. Cria bucket MinIO e configura acesso publico
15. Cria usuario master padrao
16. Cria empresa padrao vinculada ao usuario master
17. Configura MinIO para HTTPS via proxy Nginx

### Tuneis SSH
18. Gera par de chaves RSA 4096-bit por cliente
19. Configura `authorized_keys` com restricoes de porta
20. Salva instrucoes no `TUNNEL_CONFIG.txt`

### ERP Templates
21. Insere template Intersolid (Oracle) com mapeamentos completos
22. 8 tabelas pre-mapeadas (produto, cupom, itens, finalizadora, secao, grupo, subgrupo)

### Registro
23. Registra cliente no `clientes.json` (registro central)
24. Configura Nginx com proxy reverso (5 location blocks)
25. Tenta gerar certificado SSL automaticamente

### Credenciais
26. Salva tudo em `CREDENCIAIS.txt` no diretorio do cliente

---

## CREDENCIAIS PADRAO

| Credencial | Valor |
|------------|-------|
| **Usuario Master** | Roberto |
| **Senha Master** | Beto3107@@## |

As senhas de PostgreSQL, MinIO e JWT sao geradas **aleatoriamente** para cada cliente e salvas em:
`/root/clientes/[nome]/CREDENCIAIS.txt`

---

## ESTRUTURA DE PASTAS NA VPS

```
/root/
├── prevencao-radar-repo/              # Codigo fonte (compartilhado)
│   ├── InstaladorVPS/
│   │   ├── install-multitenant.sh     # Instalador multi-tenant v4.0
│   │   ├── install.sh                 # Instalador single-tenant (legado)
│   │   ├── listar-clientes.sh         # Script para listar clientes
│   │   ├── Dockerfile.backend         # Build do backend
│   │   ├── Dockerfile.frontend        # Build do frontend
│   │   ├── Dockerfile.cron            # Build do cron
│   │   └── README.md                  # Este arquivo
│   ├── packages/
│   │   ├── backend/                   # Codigo do backend
│   │   └── frontend/                  # Codigo do frontend
│   └── scripts/
│       └── clientes.json              # Copia do registro de clientes
│
├── clientes/                          # Dados por cliente
│   ├── clientes.json                  # Registro central de todos os clientes
│   ├── tradicao/
│   │   ├── docker-compose.yml
│   │   ├── .env
│   │   ├── CREDENCIAIS.txt
│   │   ├── TUNNEL_CONFIG.txt
│   │   └── ssh_keys/
│   │       ├── tunnel_key             # Chave privada SSH do cliente
│   │       └── tunnel_key.pub         # Chave publica SSH do cliente
│   ├── vital/
│   │   └── ...
│   └── nunes/
│       └── ...
│
└── prevencao-multi-tenant/
    └── porta_atual.txt                # Controle de portas (legado)
```

---

## TUNEL SSH - CONEXAO COM ORACLE/ERP DO CLIENTE

Cada cliente recebe tuneis SSH isolados para conectar o backend na VPS ao banco Oracle/ERP na rede local do cliente.

### Como funciona

```
[Rede Local do Cliente]          [VPS na Nuvem]
Oracle DB (192.168.x.x:1521) <--SSH Tunnel--> Backend Container
MSSQL (192.168.x.x:1433)    <--SSH Tunnel--> Backend Container
API ERP (192.168.x.x:3003)  <--SSH Tunnel--> Backend Container
```

### Configurar tunel pelo frontend (RECOMENDADO)

1. Acesse `Configuracoes > Instalador de Tunel`
2. Preencha os campos (IP local do Oracle, portas, etc)
3. Clique em **"Gerar Scripts"**
4. Baixe o `.bat` gerado e execute no PC do cliente
5. O .bat instala um servico Windows que reconecta automaticamente

O frontend exibe:
- **Status dos tuneis** (online/offline) em tempo real
- **Chave SSH publica** com botao "Copiar" para cada tunel instalado

### Configurar tunel manualmente (alternativa)

1. Copiar a chave privada `tunnel_key` para o PC do cliente
2. Criar um arquivo `.bat` com o comando:

```bat
ssh -R PORTA_ORACLE:IP_ORACLE_LOCAL:1521 root@IP_VPS -N -i tunnel_key
```

As portas e instrucoes completas estao no arquivo `TUNNEL_CONFIG.txt` do cliente.

### Keepalive e reconexao automatica

Os tuneis sao configurados com keepalive agressivo para manter a conexao estavel:

| Parametro | Valor | Funcao |
|-----------|-------|--------|
| `ServerAliveInterval` | 15s | Envia ping a cada 15 segundos |
| `ServerAliveCountMax` | 2 | Desconecta apos 2 falhas (30s sem resposta) |
| `TCPKeepAlive` | yes | Keepalive TCP nativo |
| `ConnectTimeout` | 10s | Timeout de conexao |
| `ExitOnForwardFailure` | yes | Encerra se tunel falhar (permite reconexao pelo servico) |

O servico Windows (`PrevencaoTunel-[nome]`) verifica a cada 15 segundos e reconecta automaticamente.

### Seguranca dos tuneis

- Cada cliente tem **chave SSH propria** (RSA 4096-bit)
- `authorized_keys` restringe cada chave a **apenas 3 portas** do cliente
- Um cliente **nao consegue** acessar as portas de outro cliente
- A chave so permite port-forwarding (sem shell, sem comandos)
- Flag `-N` impede execucao de comandos remotos

---

## MAPEAMENTO DE TABELAS E TEMPLATE ERP

### Estrutura hierarquica

O mapeamento de tabelas e organizado em modulos e submodulos:

```
Prevencao no Radar (8 submodulos)
├── Prevencao de Bipagens (TAB_PRODUTO, TAB_PRODUTO_LOJA, TAB_PRODUTO_PDV, TAB_OPERADORES, TAB_CUPOM_FINALIZADORA)
├── Prevencao PDV (TAB_PRODUTO, TAB_PRODUTO_PDV, TAB_OPERADORES, TAB_CUPOM_FINALIZADORA, TAB_TESOURARIA, TAB_ESTORNO)
├── Prevencao Facial (TAB_OPERADORES)
├── Prevencao Rupturas (10 tabelas)
├── Prevencao Etiquetas (TAB_PRODUTO, TAB_PRODUTO_LOJA, TAB_SECAO)
├── Prevencao Quebras (7 tabelas com ajuste estoque)
├── Producao (9 tabelas com decomposicao/receitas)
└── Hort Fruti (TAB_PRODUTO, TAB_PRODUTO_LOJA)

Gestao no Radar (5 submodulos)
├── Gestao Inteligente (6 tabelas)
├── Estoque e Margem (7 tabelas)
├── Compra e Venda (13 tabelas)
├── Pedidos (6 tabelas)
└── Ruptura Industria (7 tabelas)
```

### Botao "Salvar Tudo"

Em `Configuracoes > Tabelas`, o botao **"Salvar Tudo"** (icone de raio verde) salva TODOS os mapeamentos de TODOS os modulos/submodulos de uma vez com os valores padrao ERP (Intersolid). Isso evita ter que salvar submódulo por submódulo manualmente.

### Template ERP pre-configurado

O instalador insere automaticamente o template **Intersolid (Oracle)** com mapeamentos de 25+ tabelas pre-preenchidas com valores padrao.

O template pode ser clonado e customizado por cliente em: `Configuracoes > Tabelas`

Apos salvar todos os submodulos, o botao **"Salvar Padrao ERP"** permite criar um template reutilizavel para futuros clientes.

### Oracle auto-reload

Quando uma conexao Oracle e salva, atualizada ou testada com sucesso pelo frontend, o backend **recarrega automaticamente** a configuracao Oracle sem necessidade de reiniciar o container. Isso inclui:

- Fechar o pool de conexoes antigo
- Recarregar configuracao da tabela `database_connections`
- Recriar o pool com a nova configuracao
- Limpar cache do `MappingService`

---

## CRON JOBS (Container Dedicado)

O container `cron` executa 4 tarefas agendadas:

| Job | Frequencia | Funcao |
|-----|-----------|--------|
| Verificacao Diaria Completa | 08:00 (diario) | Vendas + bipagens + notificacoes do dia anterior |
| Monitoramento Continuo | A cada 2 min | Monitoramento em tempo real (dia atual, sem notificacoes) |
| Check Ultima Bipagem | A cada hora | Alerta se nenhuma bipagem recebida ha 1+ hora |
| Monitor Email DVR | A cada 1 min | Busca novas imagens de reconhecimento facial por email |

---

## NGINX - PROXY REVERSO

O Nginx roteia todas as requisicoes HTTPS para os containers corretos:

| Rota | Destino | Funcao |
|------|---------|--------|
| `/` | Frontend (porta dinamica) | Interface React SPA |
| `/api` | Backend (porta dinamica) | REST API (timeout 300s, upload 100MB) |
| `/socket.io` | Backend (porta dinamica) | WebSocket tempo real (bipagens ao vivo) |
| `/storage/` | MinIO (porta dinamica) | Imagens e fotos (cache 7 dias) |
| `/uploads/` | Backend (porta dinamica) | Imagens DVR/facial (cache 1 dia) |

---

## COMANDOS UTEIS

### Listar todos os clientes

```bash
bash /root/prevencao-radar-repo/InstaladorVPS/listar-clientes.sh
```

### Ver status de todos os containers

```bash
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}" | grep prevencao
```

### Ver logs de um cliente

```bash
cd /root/clientes/[nome] && docker compose logs -f
# Apenas backend:
cd /root/clientes/[nome] && docker compose logs -f backend
```

### Reiniciar um cliente

```bash
cd /root/clientes/[nome] && docker compose restart
```

### Reiniciar apenas o backend

```bash
cd /root/clientes/[nome] && docker compose restart backend
```

---

## ATUALIZAR CODIGO

### Atualizar codigo fonte

```bash
cd /root/prevencao-radar-repo && git pull
```

### Rebuild de um cliente especifico

**Backend:**
```bash
cd /root/clientes/[nome]
docker compose build --no-cache backend
docker compose up -d --no-deps backend
```

**Frontend:**
```bash
cd /root/clientes/[nome]
docker compose build --no-cache frontend
docker compose up -d --no-deps frontend
```

**Ambos:**
```bash
cd /root/clientes/[nome]
docker compose build --no-cache backend frontend
docker compose up -d --no-deps backend frontend
```

### Rebuild de TODOS os clientes

```bash
cd /root/prevencao-radar-repo && git pull

for dir in /root/clientes/*/; do
    if [ -f "$dir/docker-compose.yml" ]; then
        echo "Atualizando $(basename $dir)..."
        cd "$dir"
        docker compose build --no-cache backend frontend
        docker compose up -d --no-deps backend frontend
    fi
done
```

### Explicacao das flags

| Flag | Funcao |
|------|--------|
| `--no-cache` | Nao usa cache, baixa codigo novo do Git |
| `--no-deps` | NAO reinicia PostgreSQL/MinIO (preserva dados) |

---

## REMOVER UM CLIENTE (CUIDADO - APAGA DADOS)

```bash
# 1. Parar e remover containers + volumes
cd /root/clientes/[nome]
docker compose down -v

# 2. Remover pasta do cliente
rm -rf /root/clientes/[nome]

# 3. Remover configuracao Nginx
rm -f /etc/nginx/sites-enabled/[nome]
rm -f /etc/nginx/sites-available/[nome]
nginx -s reload

# 4. Remover entrada do clientes.json (editar manualmente)
nano /root/clientes/clientes.json
```

---

## NUNCA FAZER

- `docker compose up -d --build` sem `--no-deps` (recria banco = PERDE DADOS)
- `docker compose down -v` (remove volumes = PERDE DADOS)
- Alterar senhas do PostgreSQL/MinIO sem atualizar o `.env`
- Deletar a pasta `/root/clientes/[nome]` sem parar os containers antes
- Force-push na branch TESTE sem verificar

---

## RESOLUCAO DE PROBLEMAS

### Container nao inicia

```bash
cd /root/clientes/[nome]
docker compose logs backend   # Ver erro do backend
docker compose logs postgres  # Ver erro do banco
docker compose ps             # Ver status
```

### Backend nao conecta no Oracle (tunel)

1. Verificar se o tunel SSH esta rodando no PC do cliente
2. Verificar porta no `.env`: `TUNNEL_ORACLE_PORT`
3. Testar conexao: `docker exec prevencao-[nome]-backend curl -s localhost:PORTA`

### DNS nao propaga

1. Verificar no https://dnschecker.org
2. Limpar cache DNS local: `ipconfig /flushdns` (Windows)
3. Adicionar no hosts: `C:\Windows\System32\drivers\etc\hosts`

### Erro de senha do PostgreSQL

```bash
# Verificar senha do backend
docker exec prevencao-[nome]-backend env | grep DB_PASSWORD

# Verificar senha do postgres
docker exec prevencao-[nome]-postgres env | grep POSTGRES_PASSWORD

# Resetar se diferentes
SENHA=$(docker exec prevencao-[nome]-postgres env | grep POSTGRES_PASSWORD | cut -d'=' -f2)
docker exec prevencao-[nome]-postgres psql -U postgres -c "ALTER USER postgres WITH PASSWORD '$SENHA';"
docker restart prevencao-[nome]-backend
```

### Frontend unhealthy mas funcionando

Isso e normal - o healthcheck verifica porta interna. O sistema funciona normalmente via Nginx.

---

## FLUXO COMPLETO PARA NOVO CLIENTE (RESUMO)

```
1. [Registro.br] Criar DNS: nunes -> 46.202.150.64
2. [VPS]         cd /root/prevencao-radar-repo/InstaladorVPS
3. [VPS]         bash install-multitenant.sh
4. [VPS]         Digitar: nunes (quando perguntado)
5. [Aguardar]    DNS propagar (verificar em dnschecker.org)
6. [VPS]         certbot --nginx -d nunes.prevencaonoradar.com.br (se nao fez automatico)
7. [Navegador]   Acessar https://nunes.prevencaonoradar.com.br/first-setup
8. [Sistema]     Login: Roberto / Beto3107@@##
9. [Sistema]     Configurar tunel SSH em Configuracoes > Tunel SSH
10.[Windows]     Rodar .bat do tunel SSH no PC do cliente
11.[Sistema]     Configurar mapeamento Oracle em Configuracoes > Tabelas
```

---

## VERIFICAR DNS

### Windows (CMD)
```cmd
nslookup nunes.prevencaonoradar.com.br
nslookup nunes.prevencaonoradar.com.br 8.8.8.8
```

### Online
- https://dnschecker.org
- https://www.whatsmydns.net

---

## REGISTRO DE CLIENTES (clientes.json)

O arquivo `/root/clientes/clientes.json` registra todos os clientes com seus dados:

```json
{
  "vps": {
    "46": {
      "ip": "46.202.150.64",
      "descricao": "VPS Multi-Clientes",
      "clientes": {
        "nunes": {
          "nome": "nunes",
          "subdomain": "nunes.prevencaonoradar.com.br",
          "path": "/root/clientes/nunes",
          "containers": { "frontend": "...", "backend": "...", "postgres": "...", "minio": "...", "cron": "..." },
          "ports": { "frontend": 3XXX, "backend": 4XXX, "postgres": 5XXX },
          "tunnel_ports": { "oracle": 10XXX, "mssql": 11XXX, "api_erp": 12XXX }
        }
      }
    }
  }
}
```

---

## FIREWALL UFW

O instalador configura automaticamente:

```bash
ufw allow 22/tcp    # SSH
ufw allow 80/tcp    # HTTP (Nginx)
ufw allow 443/tcp   # HTTPS (Nginx + SSL)
ufw allow from 172.16.0.0/12   # Docker network
```

---

**Ultima atualizacao:** 08/02/2026
