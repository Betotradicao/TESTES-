# Disparo: Entregue/Lida sempre vazias — payload do `messages.update` é ACHATADO na v2

**Data:** 2026-07-21 · **Cliente:** Tradição · **Commit:** `87536cf`

## 🐛 Sintoma
Disparo enviado e **visualizado** pelo destinatário, mas no Histórico as colunas
**Entregue**, **Lida** e **Erro** ficavam com `-`. Nenhum erro no log.

## 🔍 Diagnóstico (o caminho curto)
```bash
docker logs --since 90m prevencao-tradicao-backend | grep 'WEBHOOK DISPARO' \
  | sed 's/.*event=//' | cut -d, -f1 | sort | uniq -c
#  13 messages.update      <- chegaram!
#   3 messages.upsert
```
Evento **chegando** + coluna vazia = o problema está no **handler**, não no registro do
webhook. (Se desse zero, seria registro — ver
[[2026-07-20-chatbot-mudo-webhook-evolution]].)

Confirmar que o envio gravou o id:
```sql
SELECT id, status, evolution_msg_id FROM disparo_mensagens ORDER BY id DESC LIMIT 5;
-- evolution_msg_id preenchido => envio ok, o buraco é no recibo
```

## 🎯 Causa-raiz: o payload MUDA de formato por evento
| Evento | Formato |
|---|---|
| `messages.upsert` | `{ data: { key: { id } } }` — **aninhado** |
| `messages.update` | `{ data: { keyId, status } }` — **ACHATADO** |

O handler fazia `if (!msgData?.key?.id) return;` na primeira linha. No `update` isso é
sempre `undefined` → **todo recibo morria ali, calado**.

> 🔑 **Lição:** a Evolution v2 **não segue o formato da v1** e nem é consistente entre
> eventos. Mesma família da armadilha do `setup-webhook` (PUT vs POST). Ao integrar
> evento novo, **logue o payload cru antes de confiar no formato**.

> ⚠️ **`return` calado é o que fez isso durar tanto.** Não havia erro, log, nada.
> Todo `return` de guarda em webhook merece um log.

## ✅ Correção
- Aceita `key.id` **ou** `keyId` **ou** `messageId`
- Sem id → `warn`; mensagem que não é do disparo → `log` (não some mais calado)
- Loga o `status` recebido — era o dado que faltava pra diagnosticar
- `PLAYED` (ouviu o áudio) passa a contar como leitura

## 🪤 Bug latente que ia aparecer junto
Como **nenhum** recibo passava, dois contadores nunca foram exercitados:
- `entregues` só checava `status !== 'read'` → **cada `DELIVERY_ACK` repetido somava +1**
- `lidos` **não tinha guarda nenhuma**

O WhatsApp reenvia o mesmo recibo várias vezes. Com o fix acima, a campanha terminaria
com **mais entregas e leituras do que mensagens enviadas**. Ambos passaram a checar o
status atual antes de incrementar.

> 💡 Padrão: ao consertar um caminho morto, revise o código *depois* dele — nunca rodou,
> então nunca foi testado.

## 🏷️ Tags
#bug #disparo #whatsapp #evolution #webhook #recibo #tradicao
