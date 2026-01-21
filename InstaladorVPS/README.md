# Instalador Automatico VPS - Prevencao no Radar

Instalador automatizado para servidores Linux (VPS). Detecta automaticamente o IP publico, gera senhas seguras e configura todo o ambiente Docker.

## ESCOLHA SEU TIPO DE INSTALACAO

| Tipo | Descricao | Quando Usar |
|------|-----------|-------------|
| **Single-Tenant** | 1 cliente por VPS | Clientes unicos, VPS exclusiva |
| **Multi-Tenant** | Varios clientes por VPS | Multiplos clientes com subdominios |

---

# OPCAO 1: SINGLE-TENANT (1 CLIENTE POR VPS)

## INSTALACAO EM 1 COMANDO (RECOMENDADO)

Cole este comando no terminal da sua VPS para instalar tudo automaticamente:

```bash
curl -sSL https://raw.githubusercontent.com/Betotradicao/TESTES-/TESTE/InstaladorVPS/install.sh | bash
```

**O que este comando faz:**
1. Clona o repositorio da branch TESTE
2. Detecta automaticamente o IP publico da VPS
3. Pergunta nome do banco de dados (padrao: prevencao_db)
4. Pergunta nome do bucket MinIO (padrao: market-security)
5. Gera senhas aleatorias seguras
6. Cria arquivo .env com todas as configuracoes
7. Inicia todos os containers Docker
8. Cria as tabelas do banco de dados (migrations automaticas)
9. Popula configuracoes iniciais (seed automatico)
10. Cria usuario master padrao
11. Salva credenciais em CREDENCIAIS.txt

**Tempo de instalacao:** 5-10 minutos

---

## O QUE O INSTALADOR PERGUNTA

Durante a instalacao, serao solicitados:

1. **Nome do Banco de Dados PostgreSQL**
   - Padrao: `prevencao_db`
   - Pressione ENTER para usar o padrao

2. **Nome do Bucket MinIO**
   - Padrao: `market-security`
   - Pressione ENTER para usar o padrao

---

## APOS A INSTALACAO

### URLs de Acesso

- **Frontend (Interface Web):** `http://IP_DA_VPS:3000`
- **Primeiro acesso:** `http://IP_DA_VPS:3000/first-setup`
- **Backend (API):** `http://IP_DA_VPS:3001`
- **MinIO Console:** `http://IP_DA_VPS:9011`

### Credenciais Padrao

- **Usuario Master:** Roberto
- **Senha Master:** Beto3107@@##

### Primeiro Acesso

1. Acesse: `http://IP_DA_VPS:3000/first-setup`
2. Preencha os dados da empresa (CNPJ, Razao Social, etc.)
3. As credenciais MinIO/PostgreSQL ja estao pre-configuradas
4. Apos o cadastro, faca login com o usuario Master

---

## ARQUIVOS GERADOS

Apos a instalacao, serao criados:

- `.env` - Arquivo de configuracao (usado pelo Docker)
- `CREDENCIAIS.txt` - Todas as senhas geradas

**IMPORTANTE:** Guarde o arquivo CREDENCIAIS.txt em local seguro!

---

## COMANDOS UTEIS

### Ver logs dos containers

```bash
cd /root/prevencao-radar-install/InstaladorVPS

# Todos os containers
docker compose -f docker-compose-producao.yml logs -f

# Apenas backend
docker compose -f docker-compose-producao.yml logs -f backend

# Apenas frontend
docker compose -f docker-compose-producao.yml logs -f frontend
```

### Ver status dos containers

```bash
docker compose -f docker-compose-producao.yml ps
```

### Reiniciar aplicacao

```bash
docker compose -f docker-compose-producao.yml restart
```

### Reiniciar apenas um servico

```bash
docker compose -f docker-compose-producao.yml restart backend
```

---

## ATUALIZAR APLICACAO (APOS MELHORIAS)

**IMPORTANTE:** Nunca use `docker compose up -d --build` - isso recria o banco e PERDE DADOS!

### Atualizar BACKEND:

```bash
cd /root/prevencao-radar-install && git pull && cd InstaladorVPS && docker compose -f docker-compose-producao.yml build --no-cache backend && docker compose -f docker-compose-producao.yml up -d --no-deps backend
```

### Atualizar FRONTEND:

```bash
cd /root/prevencao-radar-install && git pull && cd InstaladorVPS && docker compose -f docker-compose-producao.yml build --no-cache frontend && docker compose -f docker-compose-producao.yml up -d --no-deps frontend
```

### Atualizar AMBOS:

```bash
cd /root/prevencao-radar-install && git pull && cd InstaladorVPS && docker compose -f docker-compose-producao.yml build --no-cache frontend backend && docker compose -f docker-compose-producao.yml up -d --no-deps frontend backend
```

### Explicacao das flags:

- `--no-cache` = Baixa codigo novo do Git (nao usa cache)
- `--no-deps` = NAO reinicia PostgreSQL/MinIO (preserva dados)

---

## PRE-REQUISITOS

Certifique-se de que sua VPS possui:

- Sistema operacional: Ubuntu 20.04+ / Debian 11+ / CentOS 8+
- Docker instalado (versao 20.10+)
- Docker Compose instalado (versao 2.0+)
- Portas liberadas: 3000, 3001, 5434, 9010, 9011
- Minimo 2GB RAM, 2 CPU cores, 20GB disco

### Instalar Docker (se necessario)

```bash
# Ubuntu/Debian
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo usermod -aG docker $USER

# Instalar Docker Compose
sudo apt-get update
sudo apt-get install docker-compose-plugin
```

---

## RESOLUCAO DE PROBLEMAS

### Container nao inicia

```bash
# Ver logs de erro
docker compose -f docker-compose-producao.yml logs backend

# Verificar status
docker compose -f docker-compose-producao.yml ps
```

### Verificar se portas estao abertas no firewall

```bash
# Ubuntu/Debian (UFW)
sudo ufw allow 3000
sudo ufw allow 3001
sudo ufw allow 5434
sudo ufw allow 9010
sudo ufw allow 9011
```

### Reinstalar do zero (CUIDADO - APAGA DADOS)

```bash
# Parar e remover tudo
cd /root/prevencao-radar-install/InstaladorVPS
docker compose -f docker-compose-producao.yml down -v

# Remover pasta
cd /root
rm -rf prevencao-radar-install

# Instalar novamente
curl -sSL https://raw.githubusercontent.com/Betotradicao/TESTES-/TESTE/InstaladorVPS/install.sh | bash
```

---

## ESTRUTURA DE ARQUIVOS

```
InstaladorVPS/
├── install.sh                     # Script de instalacao automatica
├── docker-compose-producao.yml    # Configuracao dos containers
├── Dockerfile.backend             # Build do backend
├── Dockerfile.frontend            # Build do frontend
├── README.md                      # Este arquivo
├── .env                           # Gerado automaticamente
└── CREDENCIAIS.txt                # Gerado automaticamente
```

---

## NUNCA FAZER

- `docker compose up -d --build` (recria banco = perde dados)
- `docker compose down -v` (remove volumes = perde dados)
- Editar manualmente o banco de dados
- Alterar senhas do PostgreSQL/MinIO sem atualizar .env

---

## SEGURANCA

- As senhas sao geradas aleatoriamente a cada instalacao
- Mantenha o arquivo CREDENCIAIS.txt em local seguro
- Considere usar HTTPS em producao (configure um proxy reverso como Nginx)
- Configure firewall adequadamente
- Faca backups regulares dos volumes Docker

---

# OPCAO 2: MULTI-TENANT (VARIOS CLIENTES POR VPS)

Sistema com subdominios por cliente. Ideal para hospedar multiplos clientes em uma unica VPS.

## COMO FUNCIONA

Cada cliente recebe:
- Subdominio proprio: `cliente.prevencaonoradar.com.br`
- Banco de dados isolado
- Bucket MinIO isolado
- Containers Docker separados
- Certificado SSL (HTTPS) automatico

## PRE-REQUISITOS MULTI-TENANT

### 1. Configurar DNS no Registro.br

**IMPORTANTE:** O Registro.br NAO suporta wildcard DNS (`*`). Voce precisa criar uma entrada para CADA cliente:

1. Acesse: https://registro.br
2. Va em: Dominios > prevencaonoradar.com.br > DNS > Adicionar Record
3. Para cada cliente, crie:
   - **Tipo:** A
   - **Nome:** nome-do-cliente (ex: `central`, `nunes`, `mercado01`)
   - **Dados:** IP da VPS (ex: `46.202.150.64`)

### 2. VPS com portas 80 e 443 livres

Necessario para Nginx e certificados SSL.

---

## INSTALACAO MULTI-TENANT

### Passo 1: Baixar o instalador (primeira vez apenas)

```bash
cd /root
git clone -b TESTE https://github.com/Betotradicao/TESTES-.git prevencao-radar-repo
```

### Passo 2: Instalar um cliente

```bash
cd /root/prevencao-radar-repo/InstaladorVPS
bash install-multitenant.sh nome-do-cliente
```

Exemplo:
```bash
bash install-multitenant.sh central
```

### Passo 3: Gerar certificado SSL

Apos o DNS propagar (5 min a 2 horas), gere o certificado:

```bash
certbot --nginx -d nome-do-cliente.prevencaonoradar.com.br
```

Exemplo:
```bash
certbot --nginx -d central.prevencaonoradar.com.br
```

---

## FLUXO COMPLETO PARA NOVO CLIENTE

1. **Registro.br:** Criar entrada DNS (ex: `nunes` -> `46.202.150.64`)
2. **Aguardar:** DNS propagar (verificar em https://dnschecker.org)
3. **VPS:** Instalar cliente:
   ```bash
   cd /root/prevencao-radar-repo/InstaladorVPS
   bash install-multitenant.sh nunes
   ```
4. **SSL:** Gerar certificado:
   ```bash
   certbot --nginx -d nunes.prevencaonoradar.com.br
   ```
5. **Acessar:** https://nunes.prevencaonoradar.com.br

---

## PORTAS MULTI-TENANT

Cada cliente recebe portas automaticas:

| Cliente | Frontend | Backend | PostgreSQL | MinIO API | MinIO Console |
|---------|----------|---------|------------|-----------|---------------|
| 1o      | 3002     | 4000    | 5500       | 9100      | 9200          |
| 2o      | 3003     | 4001    | 5501       | 9101      | 9201          |
| 3o      | 3004     | 4002    | 5502       | 9102      | 9202          |
| ...     | ...      | ...     | ...        | ...       | ...           |

O Nginx roteia tudo pela porta 80/443 usando subdominios.

---

## ESTRUTURA DE PASTAS MULTI-TENANT

```
/root/
├── prevencao-radar-repo/              # Codigo fonte (compartilhado)
│   └── InstaladorVPS/
│       ├── install.sh                 # Single-tenant
│       ├── install-multitenant.sh     # Multi-tenant
│       └── listar-clientes.sh         # Listar clientes
│
├── prevencao-multi-tenant/            # Controle de portas
│   └── porta_atual.txt                # Proxima porta disponivel
│
└── clientes/                          # Dados por cliente
    ├── central/
    │   ├── docker-compose.yml
    │   ├── .env
    │   └── CREDENCIAIS.txt
    ├── nunes/
    │   └── ...
    └── mercado01/
        └── ...
```

---

## COMANDOS UTEIS MULTI-TENANT

### Listar clientes instalados

```bash
bash /root/prevencao-radar-repo/InstaladorVPS/listar-clientes.sh
```

### Ver logs de um cliente

```bash
cd /root/clientes/[nome] && docker compose logs -f
```

### Reiniciar cliente

```bash
cd /root/clientes/[nome] && docker compose restart
```

### Parar cliente

```bash
cd /root/clientes/[nome] && docker compose down
```

### Ver status de todos os containers

```bash
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}" | grep prevencao
```

---

## ATUALIZAR CODIGO MULTI-TENANT

### Atualizar codigo fonte

```bash
cd /root/prevencao-radar-repo && git pull
```

### Rebuild de um cliente especifico

```bash
cd /root/clientes/[nome]
docker compose build --no-cache backend frontend
docker compose up -d --no-deps backend frontend
```

### Rebuild de TODOS os clientes

```bash
cd /root/prevencao-radar-repo && git pull

for dir in /root/clientes/*/; do
    echo "Atualizando $(basename $dir)..."
    cd "$dir" && docker compose build --no-cache backend frontend && docker compose up -d --no-deps backend frontend
done
```

---

## REMOVER CLIENTE (CUIDADO - APAGA DADOS)

```bash
# Parar e remover containers
cd /root/clientes/[nome]
docker compose down -v

# Remover pasta do cliente
rm -rf /root/clientes/[nome]

# Remover configuracao Nginx
rm /etc/nginx/sites-enabled/[nome]
rm /etc/nginx/sites-available/[nome]

# Recarregar Nginx
nginx -s reload
```

---

## VERIFICAR DNS

### No Windows (CMD)

```cmd
nslookup cliente.prevencaonoradar.com.br
```

### Usando Google DNS

```cmd
nslookup cliente.prevencaonoradar.com.br 8.8.8.8
```

### Online

- https://dnschecker.org
- https://www.whatsmydns.net

---

## RESOLUCAO DE PROBLEMAS MULTI-TENANT

### DNS nao propaga na rede local

O DNS da sua rede local pode demorar mais. Solucoes:

1. **Limpar cache DNS:**
   ```cmd
   ipconfig /flushdns
   ```

2. **Adicionar no arquivo hosts:**
   - Abra `C:\Windows\System32\drivers\etc\hosts` como Administrador
   - Adicione: `IP_DA_VPS cliente.prevencaonoradar.com.br`

3. **Mudar DNS do computador** para Google (8.8.8.8)

### Frontend unhealthy mas funcionando

Isso e normal - o healthcheck verifica porta interna. O sistema funciona normalmente.

### Erro de senha do PostgreSQL

```bash
# Verificar senha atual do backend
docker exec prevencao-[nome]-backend env | grep DB_PASSWORD

# Verificar senha do postgres
docker exec prevencao-[nome]-postgres env | grep POSTGRES_PASSWORD

# Se diferentes, resetar hash:
SENHA=$(docker exec prevencao-[nome]-postgres env | grep POSTGRES_PASSWORD | cut -d'=' -f2)
docker exec prevencao-[nome]-postgres psql -U postgres -c "ALTER USER postgres WITH PASSWORD '$SENHA';"
docker restart prevencao-[nome]-backend
```

---

## COMPATIBILIDADE

Os dois instaladores podem coexistir na mesma VPS:
- **Single-tenant**: `/root/prevencao-radar-install/` (portas 3000, 3001, etc)
- **Multi-tenant**: `/root/clientes/[nome]/` (portas dinamicas a partir de 3002)

---

## CREDENCIAIS PADRAO (TODOS OS CLIENTES)

- **Usuario Master:** Roberto
- **Senha Master:** Beto3107@@##

As senhas de PostgreSQL e MinIO sao geradas automaticamente para cada cliente e salvas em:
`/root/clientes/[nome]/CREDENCIAIS.txt`

---

## FIREWALL UFW

O instalador multi-tenant libera automaticamente as portas necessarias no UFW. Se precisar liberar manualmente:

```bash
# Portas base multi-tenant
ufw allow 80      # HTTP (Nginx)
ufw allow 443     # HTTPS (Nginx)
ufw allow 3002:3100/tcp   # Frontends
ufw allow 4000:4100/tcp   # Backends
ufw allow 5500:5600/tcp   # PostgreSQL
ufw allow 9100:9300/tcp   # MinIO
```

---

## SUPORTE

- **Repositorio:** https://github.com/Betotradicao/TESTES-
- **Branch de producao:** TESTE

---

**Ultima atualizacao:** 18/01/2026
