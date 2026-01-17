# Instalador Automatico VPS - Prevencao no Radar

Instalador automatizado para servidores Linux (VPS). Detecta automaticamente o IP publico, gera senhas seguras e configura todo o ambiente Docker.

---

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
8. Cria as tabelas do banco de dados
9. Registra todas as migrations
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
