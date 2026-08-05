# Backend trava no boot quando `minio_endpoint` aponta pro IP/domínio público

**Data:** 2026-07-10 · Descoberto ao deployar o fix do sells-sync no [[../clientes/nunes|Nunes]] e [[../clientes/supervital|SuperVital]].

## 🐛 Sintoma
Ao **recriar o container backend** (deploy normal `--no-deps backend`), o boot **trava
pra sempre** e o container fica `unhealthy`, sem nunca escutar a porta. Última linha do log:
`✅ MinIO client updated from database: <ip-publico>` — e **nunca** aparece
`✅ MinIO initialized successfully`. Os crons não chegam a registrar.

## 🔍 Causa-raiz
No boot, `startServer()` chama `await minioService.ensureBucketExists()` **antes** do
`app.listen` (ver [index.ts](../../packages/backend/src/index.ts) ~603). Se o
`minio_endpoint` na tabela `configurations` aponta pro **IP/domínio público do host**
em vez do nome interno do container, o backend tenta conectar no IP público **de dentro
do container** → precisa de **hairpin NAT**. Quando o hairpin não funciona (ex: caiu num
reboot do servidor), o SDK MinIO fica pendurado no TCP connect (SYN sem resposta, **sem
timeout**) e o boot nunca avança.

O container **antigo** sobrevivia porque tinha bootado quando o hairpin ainda funcionava.
Um boot **limpo** (deploy) expõe o problema.

## ✅ Correção
`minio_endpoint`/`minio_port` do backend devem apontar pro **container interno**, igual à
[[../clientes/tradicao|Tradição]] (que sempre funcionou):

| Config | ✅ Correto (interno) | ❌ Errado (trava boot) |
|---|---|---|
| `minio_endpoint` | `prevencao-<cliente>-minio` | `46.202.150.64` ou `<cliente>.prevencaonoradar.com.br` |
| `minio_port` | `9000` | `9835` / `443` |

```sql
UPDATE configurations SET value='prevencao-<cliente>-minio' WHERE key='minio_endpoint';
UPDATE configurations SET value='9000' WHERE key='minio_port';
```
Depois: `docker restart prevencao-<cliente>-backend`.

⚠️ **NÃO** mexer no `minio_public_endpoint`/`minio_public_*` — esses são pro **navegador**
buscar as imagens (domínio público:443), e estão corretos assim. Só o `minio_endpoint`
interno (backend↔MinIO container-a-container) é que estava errado.

## 🔑 Lição / checklist ANTES de deployar um cliente
Conferir a config antes de recriar o container (evita downtime):
```bash
docker exec prevencao-<cliente>-postgres psql -U postgres -d postgres_<cliente> -t \
  -c 'SELECT key,value FROM configurations' | grep -iE 'minio_endpoint|minio_port '
```
Se `minio_endpoint` não for `prevencao-<cliente>-minio`, **corrigir primeiro**, depois deployar.

**Status 2026-07-10:** Nunes e SuperVital corrigidos. Tradição já estava correto.
MaxValle: **verificar** (provável mesmo problema — ainda não deployado).

**✅ Status 2026-08-03 — MaxValle VERIFICADO e OK.** Conferido antes de deployar:
`minio_endpoint = prevencao-maxvale-minio`, `minio_port = 9000` — já estava no padrão certo.
Deploy feito e o boot passou pelo ponto de risco: `✅ MinIO client initialized:
prevencao-maxvale-minio:9000`. **Pendência encerrada — os 4 clientes estão corretos.**

> 🔑 **O checklist funcionou:** 30 segundos de conferência antes do deploy evitaram o risco
> de derrubar o cliente num boot travado. Vale manter o hábito.

## 🏷️ Tags
#bug-resolvido #minio #deploy #boot #hairpin-nat #config
