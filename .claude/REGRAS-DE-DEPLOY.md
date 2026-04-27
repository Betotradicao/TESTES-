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

## Tuneis SSH Caem Apos Deploy (Conhecido)

Apos cada deploy de backend, os tuneis SSH dos clientes podem cair (em
~30s a 2min). NAO e o deploy que derruba — e o `tunnel-service.ps1`
instalado nos PCs cliente que tem bug:

1. Backend reinicia (rapido, segundos)
2. Cliente detecta "perda" e o servico PS mata o ssh.exe
3. Servico tenta reabrir o ssh via `[System.Diagnostics.Process]::Start`
   com stdin fechado — bug que mata ssh em ~2s
4. Loop infinito. Tunel offline ate intervencao manual.

**Workaround imediato (apos cada deploy):**
- Cliente abre tela "Configuracoes de Tabelas > Instalador de Tunel"
- Clica em **Baixar Reconectar.bat** (ou o botao "Reconectar" no card
  individual do tunel offline)
- Roda o .bat na maquina do cliente como admin
- Tuneis voltam (modo hidden, sem janela visivel)

**Solucao definitiva (futura):**
- Reinstalar tunel em cada cliente com versao corrigida do servico
  (que nao usa `Process::Start` com stdin fechado).
- Ate la, o `Reconectar.bat` resolve.

**Diagnostico na VPS:**
```bash
# Ver se portas de tunel estao listening
ss -tlnp | grep sshd

# Conexoes SSH estabelecidas (clientes ativos)
ss -tn state established '( sport = :22 )'
```

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

**Atualizado em:** 18/02/2026
