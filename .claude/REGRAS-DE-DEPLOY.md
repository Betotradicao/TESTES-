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

> **IMPORTANTE (Windows):** No Git Bash do Windows, a saida dos comandos SSH nao e capturada.
> Usar PowerShell como wrapper: `powershell -Command "& { ssh vps2-hostinger 'COMANDO 2>&1' | Out-String }"`
> Consulte `.claude/REGRAS-ACESSO-SSH.md` para detalhes.

```bash
# 1. Pull no repo compartilhado
powershell -Command "& { ssh vps2-hostinger 'cd /root/prevencao-radar-repo && git pull origin TESTE 2>&1' | Out-String }"

# 2. Build sem cache (NUNCA postgres/minio)
powershell -Command "& { ssh vps2-hostinger 'cd /root/clientes/<CLIENTE> && docker compose build --no-cache frontend backend 2>&1' | Out-String }"

# 3. Subir containers sem reiniciar dependencias
powershell -Command "& { ssh vps2-hostinger 'cd /root/clientes/<CLIENTE> && docker compose up -d --no-deps frontend backend 2>&1' | Out-String }"

# 4. Limpar cache do Docker (liberar espaco)
powershell -Command "& { ssh vps2-hostinger 'docker builder prune -f && docker image prune -f 2>&1' | Out-String }"

# 5. Verificar logs
powershell -Command "& { ssh vps2-hostinger 'docker logs prevencao-<CLIENTE>-backend --tail 30 2>&1' | Out-String }"
```

### Comando unico (Frontend + Backend)

```bash
powershell -Command "& { ssh vps2-hostinger 'cd /root/prevencao-radar-repo && git pull origin TESTE && cd /root/clientes/tradicao && docker compose build --no-cache frontend backend && docker compose up -d --no-deps frontend backend && docker builder prune -f && docker image prune -f 2>&1' | Out-String }"
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

### Checklist de Mapeamento de Tabelas (OBRIGATORIO se mexeu em Oracle)

Se a funcionalidade consulta Oracle, verificar ANTES do deploy:

- [ ] Todos os campos Oracle usam `MappingService.getColumnFromTable()`?
- [ ] Todas as tabelas Oracle usam `MappingService.getRealTableName()`?
- [ ] O schema usa `MappingService.getSchema()`?
- [ ] NAO tem nenhum `getColumnFromTable` com 3o parametro (fallback)?
- [ ] NAO tem coluna Oracle hardcoded na query? (ex: `p.COD_PRODUTO` direto)
- [ ] NAO tem schema Oracle hardcoded? (ex: `INTERSOLID.TAB_PRODUTO`)
- [ ] Os campos novos existem no `TABLE_CATALOG` em `ConfiguracoesTabelas.jsx`?
- [ ] O modulo/submodulo esta no `BUSINESS_MODULES` com as tabelas corretas?
- [ ] Template INTERSOLID foi atualizado no banco? (`erp_templates`)
- [ ] Conexao ativa foi atualizada no banco? (`database_connections`)
- [ ] Na tela de Configuracoes de Tabelas, os novos campos aparecem em verde (preenchidos)?

> Consulte `.claude/REGRAS-MAPEAMENTO-TABELAS.md` para detalhes completos.

## Conexao Oracle: Mikrotik / Rede Direta (NAO usa mais SSH tunnel)

A arquitetura mudou. Os clientes agora expoem o Oracle direto via
**Mikrotik** ou roteador similar com port-forward. A VPS conecta no
IP publico do cliente:porta diretamente — sem tunel SSH intermediario.

**Vantagem:** deploy nao derruba conexao mais. Backend reinicia, abre
nova conexao TCP no IP do cliente, e segue.

**Quando da erro `ORA-12170: TCP connect timeout`:**
- Internet do cliente caiu / instavel
- Mikrotik com problema temporario
- Port-forward foi removido
- IP publico do cliente mudou (raro - geralmente IP fixo)

**Diagnostico rapido:**
```bash
# Testar TCP ate o Oracle do cliente direto da VPS
timeout 8 bash -c '</dev/tcp/<IP_CLIENTE>/<PORTA> && echo OK || echo TIMEOUT'

# Ver se o backend conseguiu abrir o pool
docker logs prevencao-<cliente>-backend --since 30m 2>&1 | grep -E 'Oracle|ORA-' | tail -5
```

Se TCP responde mas backend nao consegue, verificar credenciais/SID
em `database_connections` no banco do cliente.

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

**Atualizado em:** 01/06/2026 (removida secao de tunel SSH - usa Mikrotik direto agora)
