# Trava de cron sem prazo parou o pré-download por 10h (e o filtro de operador)

**Data:** 25/08/2026 · **Cliente:** [[../clientes/tradicao|Tradição]]

## 🔴 Sintoma
Roberto: *"o Play do Funcionário funcionou no dia, no dia seguinte parou."*

## 🎯 Causa: trava anti-empilhamento **sem prazo de validade**

```ts
if (preClipePdvRodando) { console.log('...pulando'); return; }
preClipePdvRodando = true;
```

Em 25/08 às 16:30 uma rodada nunca terminou. O flag ficou preso em `true` e os
**20 ciclos seguintes** só imprimiram *"Rodada anterior ainda em andamento"*.
**10 horas sem gerar um clipe**, container `healthy` o tempo todo.

A trava é **necessária** (ffmpeg empilhado já derrubou a VPS — 4 núcleos para 12
clientes). O erro não é travar, é travar **para sempre**.

### ✅ Correção: a trava expira
- Cron de bipagens (5 min) → teto de **20 min** (4 ciclos)
- Cron do PDV (30 min) → teto de **60 min** (2 ciclos)

Ao estourar, libera e grita `🚨` no log em vez de seguir pulando calada.
Vira auto-recuperação, não aviso.

> 🔑 **Regra pra qualquer trava de concorrência neste projeto:** guardar o
> `Date.now()` de início junto do booleano. Booleano sozinho é ponto único de
> falha silencioso — quem trava, trava para sempre.

## 🐛 Bônus: filtro de operador só funcionava sem palavra-chave

```ts
if (!text && (temOperador || temValor))   // ← o !text
```

"canc. item" + operador caía fora desse ramo, e **nenhum** dos 6 ramos de
palavra-chave (cancelado_item/cupom/venda, desconto, finalizadora, produto)
olhava `codOperador`. Resultado: filtro ignorado em silêncio, lista inteira.

Como são 6 ramos com pontos de saída próprios, `searchOracleAllPdvs` virou um
invólucro que aplica o filtro **uma vez, por cima do resultado**, comparando o
NOME que a tela mostra na coluna Operador(a). O que se vê é o que se filtra.

## 📐 Como conferir se o pré-download está vivo
```bash
docker logs prevencao-<cliente>-backend --since 2h 2>&1 | grep -c "Rodada anterior"
```
0 ou poucos = saudável · dezenas = travado.

```sql
SELECT tipo, clip_status, count(*), max(clip_generated_at)
  FROM dvr_pos_event_clips WHERE clip_generated_at IS NOT NULL GROUP BY 1,2;
```

## ✅ Validado (26/08 02:34 UTC, após o deploy)
2 clipes `ready` do tipo FINALIZADORA (o filtro Funcionário), evento de 24/08,
**0 ciclos pulados**.

## 🏷️ Tags
#bug #resolvido #tradicao #dvr #cron #resiliencia
