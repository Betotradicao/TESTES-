# REGRAS DE DEPLOY - VPS Multi-Tenant

## VPS Atual

| VPS | IP | Alias | Branch |
|-----|-----|-------|--------|
| VPS 46 | `46.202.150.64` | `vps2-hostinger` | `TESTE` |

> VPS 145 e VPS 31 descontinuadas.

## Estrutura na VPS

```
/root/
├── prevencao-radar-repo/      # Codigo fonte (git clone)
└── clientes/
    ├── clientes.json          # Registro de clientes
    ├── tradicao/
    │   ├── docker-compose.yml
    │   ├── .env
    │   └── ssh_keys/          # SSH isolado
    └── piratininga/
        ├── docker-compose.yml
        ├── .env
        └── ssh_keys/
```

## Deploy Correto

```bash
# 1. Pull no repo compartilhado
ssh vps2-hostinger "cd /root/prevencao-radar-repo && git pull origin TESTE"

# 2. Rebuild do servico especifico (NUNCA postgres/minio)
ssh vps2-hostinger "cd /root/clientes/<CLIENTE> && docker compose up -d --build backend"
ssh vps2-hostinger "cd /root/clientes/<CLIENTE> && docker compose up -d --build frontend"

# 3. Limpar cache do Docker (liberar espaco)
ssh vps2-hostinger "docker builder prune -f && docker image prune -f"

# 4. Verificar logs
ssh vps2-hostinger "docker logs prevencao-<CLIENTE>-backend --tail 30"
```

### Comando unico (Frontend + Backend)

```bash
ssh vps2-hostinger "cd /root/prevencao-radar-repo && git pull origin TESTE && cd /root/clientes/tradicao && docker compose build --no-cache frontend backend && docker compose up -d --no-deps frontend backend && docker builder prune -f && docker image prune -f"
```

## NUNCA FACA

```bash
docker compose down -v        # DESTROI DADOS (volumes)
docker compose up -d --build  # SEM servico = RECRIA TUDO incluindo postgres
```

## FLAGS

| Flag | Funcao |
|------|--------|
| `--build` | Reconstroi imagem com codigo novo |
| `--no-cache` | Forca rebuild sem cache |
| `--no-deps` | NAO reinicia postgres/minio |

## Erro: "password authentication failed"

```bash
# 1. Ver senha do backend
docker exec prevencao-<CLIENTE>-backend env | grep DB_PASSWORD

# 2. Resetar hash no postgres
SENHA=$(docker exec prevencao-<CLIENTE>-postgres env | grep POSTGRES_PASSWORD | cut -d'=' -f2)
docker exec prevencao-<CLIENTE>-postgres psql -U postgres -c "ALTER USER postgres WITH PASSWORD '$SENHA';"

# 3. Reiniciar backend
docker restart prevencao-<CLIENTE>-backend
```

## Checklist Pre-Deploy

- [ ] Identificou o que mudou? (frontend, backend, ambos?)
- [ ] Usando `--no-deps` ou especificando servico?
- [ ] NAO vai recriar postgres/minio?
- [ ] Fez `git pull` ANTES do build?

## Limpeza de Cache (OBRIGATORIA)

Docker acumula cache a cada build. Limpar sempre apos deploy:

```bash
docker builder prune -f     # Cache de build
docker image prune -f       # Imagens antigas
df -h                       # Verificar espaco
```

Se espaco < 10GB, limpar ANTES do deploy.

## Padrao de Nomes

| Componente | Padrao |
|------------|--------|
| Container | `prevencao-<cliente>-<servico>` |
| Banco | `postgres_<cliente>` |
| Network | `<cliente>_network` |

---

**Atualizado em:** 09/02/2026
