# Backend para de abrir conexões NOVAS — e o watchdog não enxerga

**Data:** 22/08/2026 · **Cliente:** [[../clientes/tradicao|Tradição]] · **Downtime:** ~11h sem ninguém perceber

## 🔴 Sintoma
Roberto: "pesquisa de itens em ruptura fica carregando e no final dá erro no celular".

Na real era muito maior: **2.428 falhas de cron** desde 13:00 UTC (10:00 BRT).
Nenhum relatório saiu o dia inteiro — quebras, cortes, abastecimento, vendas
mensais, atrasos, top quedas. O monitor de e-mail também morreu.

```
Error: Connection terminated due to connection timeout
  [cause]: Error: Connection terminated unexpectedly
```

## 🎯 Causa
O processo Node entra num estado onde **não consegue mais abrir conexão nova**
(Postgres E IMAP), mas as **conexões que já estavam no pool continuam servindo**.

Por isso a tela "meio funciona": carrega o que dá com as conexões quentes e
estoura quando precisa de mais uma — 30s depois (`connectionTimeoutMillis`).

## 🧪 O que DESCARTAR primeiro (tudo isso estava normal)
| Suspeito | Como medir | Estava |
|---|---|---|
| Postgres lotado | `select count(*) from pg_stat_activity` vs `max_connections` | 8 de 100 ✅ |
| Rede / Docker | abrir 15 conexões simultâneas de um processo **novo** no container | 15 OK em 212ms ✅ |
| DNS | `dns.lookup` num processo novo | 8ms ✅ |
| CPU travada | `docker stats` | 0,01% ✅ |
| Pool vazado | conexões do backend no PG | só **2**, com pool `max: 20` ⚠️ |

> 🔑 **A pegadinha:** processo NOVO dentro do MESMO container conecta numa boa.
> Só o processo antigo do backend é que não conecta. Se testar de fora e der
> tudo verde, não conclua que está tudo bem — o defeito é interno ao processo.

## ⚠️ O WATCHDOG NÃO PEGA ESSE CASO
O container ficou **`healthy` o tempo todo**, 11 horas. O healthcheck bate num
endpoint que é servido pelas conexões já abertas — ou seja, **passa mesmo com o
backend meio morto**. O [[../arquitetura/radar-watchdog|watchdog]] só reinicia
container congelado; esse aqui não estava congelado, estava *manco*.

**Conclusão:** `healthy` no `docker ps` **não** é prova de que o backend está
funcionando. Pra ter certeza, contar falha de cron:

```bash
docker logs prevencao-<cliente>-backend --since 1h 2>&1 | grep -c 'connection timeout'
```

Zero = saudável. Centenas = manco há horas.

## 🔧 Solução aplicada
`docker compose restart backend`. Em 2 min: 0 falhas de conexão, 0 erro IMAP,
crons de volta.

## 🕳️ O que ficou EM ABERTO
**Não achei por que o processo degrada.** Rodou 23h saudável (deploy 21/08
13:39) e quebrou às 13:00 UTC do dia 22. Hipótese não confirmada: threadpool do
libuv esgotado (4 threads) por operação pendurada — o IMAP falhando junto aponta
pra isso, porque conexão nova precisa de `dns.lookup`, que usa esse threadpool.

Se repetir: **antes de reiniciar**, pegar o estado das threads de dentro do
container (`ps -T`, `/proc/<pid-interno>/task/*/wchan`) — de fora só se enxerga
o `docker-init`, por causa do namespace de PID.

## 🏷️ Tags
#bug #resolvido #tradicao #infra #watchdog #postgres
