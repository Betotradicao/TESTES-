# 🚨 Clicar em "Testar" com o link do cliente fora DESLIGA a integração — e ela não volta sozinha

**Data:** 2026-09-21 · **Cliente:** [[../clientes/supervital|SuperVital]] (vale para **todos**) · **Módulos:** [[../arquitetura/oracle-intersolid|Oracle]], Configurações de Tabelas

## 🔥 A lição principal

A coluna `status` da tabela `database_connections` é usada para **duas coisas ao mesmo tempo**:

1. **Saúde do último teste** — quem escreve é o botão *Testar* da tela
2. **"é esta a conexão que o sistema deve usar"** — quem lê são **~20 pontos do backend**,
   todos com `where: { status: ConnectionStatus.ACTIVE }`

Consequência: **um teste que falha desativa a integração inteira.** E como *nada* no sistema
repõe `status` para `active` automaticamente, ela **fica desligada mesmo depois que o link do
cliente volta** — até alguém clicar em *Testar* de novo pela tela.

> 💡 Falha de conexão é **transitória**. Configuração é **decisão**. Misturar as duas numa
> coluna só faz um soluço de rede virar desligamento permanente.

## 🕵️ O sintoma que confunde (e faz perder tempo)

Depois do teste falho, o log do backend **troca de personalidade**:

```
ANTES (status=active, link fora):
📦 Oracle config loaded from database_connections: Oracle INTERSOLID
   Ambiente: VPS/Docker → Host: smvital.o3utm.com.br:1521/orcl.intersoul
❌ ORA-12170 ... for host 177.112.204.68 port 1521

DEPOIS (status=error):
⚠️ No active Oracle connection found in database_connections table
📦 Oracle config using default values (local network)      ← 10.6.1.100 CHUMBADO
[MappingService] Nenhuma conexão de banco configurada
```

⚠️ **O `DEFAULT_ORACLE_CONFIG` é `10.6.1.100:1521/orcl.intersoul`, chumbado em
`oracle.service.ts:21`** — é a rede **interna da loja**. Rodando na VPS isso **nunca** vai
funcionar. Ou seja: o fallback não salva nada, só **troca a mensagem de erro** e esconde a
causa real.

> 🚩 **Regra de leitura de log:** se aparecer `default values (local network)`, o problema
> **não é mais** a rede do cliente — é o `status` da conexão no Postgres. São dois bugs
> diferentes e o segundo mascara o primeiro.

## 🧭 Como diagnosticar (ordem que funcionou)

| # | Teste | O que prova |
|---|---|---|
| 1 | `docker ps \| grep <cliente>` | containers de pé (elimina "caiu o sistema") |
| 2 | `docker logs -t <backend>` → `ORA-12170` | **quando** começou, e **qual IP** ele tentou |
| 3 | `SELECT status, last_error, last_test_at FROM database_connections` | se o `status` foi latcheado |
| 4 | ping + `/dev/tcp/<ip>/<porta>` da VPS em **várias portas** | link do cliente todo fora × só a 1521 bloqueada |
| 5 | grep `default values` no log | confirma que o fallback chumbado entrou em cena |

> ⏱️ **Armadilha de relógio no passo 2 vs 3:** `last_test_at` é gravado em **BRT** e o
> `docker logs -t` sai em **UTC**. Um teste às `12:33:20` na tabela é `15:33 UTC` no log.
> Sem isso a linha do tempo fica 3h fora do lugar e a conclusão inverte.

**Passo 4 é o que separa culpa:** testar **só** a 1521 não distingue "firewall fechou a porta"
de "a loja está sem internet". Testar 1521/443/80/22 responde de primeira — se **todas**
dão timeout e o ping também, o problema é do cliente, ponto.

## 🟢🔴 A armadilha: **a luz volta a ficar VERDE sozinha — os dados não voltam**

Esta é a parte que engana. São **dois caminhos independentes**, e só um se recupera sozinho:

| | Semáforo da sidebar | Os módulos (Gestão, Bipagens...) |
|---|---|---|
| **Quem responde** | `GET /health` (`health.routes.ts`) | `OracleService` / `MappingService` |
| **Como decide** | `repo.find()` — **todas** as conexões, **sem filtrar status** → só um **teste TCP na porta** | `where: { status: ACTIVE }` |
| **Escreve no banco?** | **NÃO** — só lê e testa a porta | — |
| **Volta sozinho?** | ✅ **SIM**, em até 30s (o polling é de 30 em 30s) | ❌ **NÃO** |

> 🚨 **Resultado:** voltando o link da loja, a sidebar mostra **"CONEXÃO = OK" em verde**
> enquanto o backend **continua usando o `10.6.1.100` chumbado** e todo módulo que depende
> do ERP segue quebrado. **Verde na tela ≠ sistema funcionando.**
>
> É o mesmo padrão de
> [[2026-08-22-backend-nao-abre-conexao-nova-watchdog-nao-ve|`healthy` não prova que o backend está vivo]]:
> **a sonda mede outra coisa que não o que dói.**

**Como conferir de verdade** (não confiar no semáforo):

```bash
docker logs prevencao-<cliente>-backend --tail 20 | grep -E "config loaded|default values"
```

- `📦 Oracle config loaded from database_connections` → **de fato certo**
- `📦 Oracle config using default values (local network)` → **ainda desligado**, mesmo com luz verde

⚠️ E o `configLoaded = true` é marcado **também no caminho do fallback**
(`oracle.service.ts:123`) — ou seja, a config ruim fica **grudada** até alguém chamar
`reloadConfig()`, o que só acontece pelos endpoints de *Testar* / *Salvar*.

## 🎭 Segunda cara do mesmo bug: **ORA-00904 "invalid identifier"**

Com o link do cliente **de volta** mas o `status` ainda fora de `active`, o sintoma **muda de
roupa** e parece um bug de SQL:

```
[MappingService] Nenhuma conexão de banco configurada        (x18, a cada consulta)
Oracle query error: ORA-00904: "PV"."CODIGO_PRODUTO": invalid identifier
❌ [ORACLE] Erro ao buscar vendas ... ORA-00904
[SellsSync] Erro no sync ... ORA-00904
```

Na tela, a Gestão Inteligente mostra `ORA-00904: "PV"."DATA_VENDA": invalid identifier`.

**A cadeia:** `status != ACTIVE` → `MappingService` não acha conexão → devolve o **literal da
chave** (`PV.CODIGO_PRODUTO`) no lugar do nome real da coluna → o Oracle, que **conectou
normalmente**, responde *invalid identifier*.

> 🚩 **ORA-00904 aqui NÃO é coluna errada nem mapeamento quebrado.** É o mesmo
> `status` travado. Não saia caçando o `MappingService` nem a tabela de mapeamentos.
> Mesma cadeia já documentada em [[../padroes/regras-ssh-windows]] (seção de consulta avulsa).

**ORA-12170 x ORA-00904 — o par diz exatamente onde você está:**

| Erro no log | Significa |
|---|---|
| `ORA-12170` (connect timeout) | **link do cliente fora** — Oracle inalcançável |
| `ORA-00904` (invalid identifier) | **link voltou**, mas o `status` continua travado |

## ⚠️ "Salvar" NÃO religa — só "Testar" religa

Descoberto em 22/09, custou uma manhã. Na tela *Editar Conexão*, os dois botões escrevem
`status`, mas **de formas opostas** (`database-connections.controller.ts`):

| Botão | O que grava | Religa? |
|---|---|---|
| **Salvar** (`:161-168`) | o que o front mandar — **sem status = fica `inactive`** | ❌ **não** |
| **Testar** (`:254-259`) | testa de verdade → `ACTIVE` se passar | ✅ **sim** |

O *Testar*, passando, ainda faz sozinho `OracleService.reloadConfig()` **e**
`MappingService.clearCache()` — exatamente os dois passos que faltam.

> ⚠️ O *Salvar* chama `clearCache()` no fim, o que **dá a impressão** de resolver. Não resolve:
> o cache limpo tenta recarregar, não acha conexão `active` e volta ao literal.

⛔ Portanto: **`UPDATE ... SET status='active'` direto no banco é pior que o botão** — não
recarrega a config em memória nem limpa o cache. **Usar o *Testar* da tela.**

## ✅ Como destravar (quando o link do cliente voltar)

Pela tela, **Configurações de Tabelas → Editar Conexão → Testar**. Passando, o controller
(`database-connections.controller.ts:256`) faz sozinho:

- `status = ACTIVE` + limpa `last_error`
- `OracleService.reloadConfig()`
- `MappingService.clearCache()`

⛔ **Não adianta clicar em *Testar* com o link ainda fora** — só re-grava o `error`.
⛔ **Não adianta o botão "Reconectar Túnel"** (ver abaixo).

## 🔌 O botão "Reconectar Túnel" não serve para todo cliente

`Sidebar.jsx:1730` — ele **baixa um `.bat`** que precisa rodar **numa máquina dentro da loja**.
Só faz sentido para cliente que usa **túnel SSH reverso**. Cliente que vai **direto no IP
público** (caso do SuperVital) não tem túnel nenhum para reconectar — e, se a loja está sem
link, o `.bat` também não teria como alcançar a VPS.

**Como saber se o cliente usa túnel:** `docker exec <backend> printenv | grep TUNNEL_ORACLE_PORT`
— **vazio = sem túnel** (usa `host_vps` direto).

## 🛠️ Correção de fundo (⏸️ NÃO feita — decisão do Roberto)

Separar os dois papéis. O mais barato, sem migração:

- **Ler** por `is_default` (ou um `enabled` novo), **não** por `status`
- Deixar `status`/`last_error` como **telemetria pura** (o que a tela mostra)

Assim um teste falho vira **luz vermelha na tela**, não **chave geral desligada**, e a volta é
automática quando o link do cliente retorna.

> ⚠️ Mexer nisso toca ~20 arquivos (`grep -rn "status: ConnectionStatus.ACTIVE" packages/backend/src`).
> Não é conserto de plantão.

## 🔗 Relacionados
- [[../clientes/supervital|SuperVital]]
- [[2026-07-15-tunel-dvr-chave-nao-autorizada-matava-oracle|Túnel morto derrubava o Oracle]]
- [[2026-08-22-backend-nao-abre-conexao-nova-watchdog-nao-ve|`healthy` não prova que o backend está vivo]]

## 🏷️ Tags
#bug #oracle #conexao #supervital #causa-raiz #latch
