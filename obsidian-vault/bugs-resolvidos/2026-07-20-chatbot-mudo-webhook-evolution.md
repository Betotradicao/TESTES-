# Chatbot WhatsApp mudo — webhook nunca era registrado na Evolution

**Data:** 2026-07-20 · **Cliente:** Tradição · **Commits:** `afb144b` + `05a67ae`

## 🐛 Sintoma
Fluxo do chatbot marcado como **ativo**, instância `MARKETING` preenchida, mas **nenhum menu
subia** no WhatsApp. Cliente mandava mensagem e não acontecia nada.

## 🔍 Diagnóstico (o atalho que economiza 1h)
```bash
docker logs --since 6h prevencao-tradicao-backend | grep -ciE 'disparo-whatsapp/webhook'
# => 0
```
**Zero chamadas** chegando no webhook = a Evolution não está nos chamando. Se dá zero, o
problema **não é o código do chatbot nem o fluxo** — é registro de webhook. Não perca tempo
lendo o `processarMensagemRecebida`.

> ✅ Antes de suspeitar do código, confirme que o fluxo está `ativo=t` no banco:
> `SELECT id, nome, ativo, instance_name FROM mkt_chatbot_fluxos;`
> (o card da UI pode mostrar INATIVO por estar desatualizado — o banco é a verdade)

## 🎯 Causa-raiz: DOIS bugs empilhados no `setup-webhook` (index.ts)

**1. Método/rota errados** — tentava:
- `PUT /webhook/set/{inst}` → `404 Cannot PUT /webhook/set/...` (a rota existe, mas é **POST**)
- `POST /webhook/instance/{inst}` → 404, caminho inexistente

O correto na **Evolution v2** é `POST /webhook/set/{instancia}` com o objeto **aninhado**:
```json
{ "webhook": { "enabled": true, "url": "...", "webhookByEvents": false,
               "webhookBase64": false, "events": [...] } }
```
> 💡 O próprio erro do formato achatado confirma: `instance requires property "webhook"`.

**2. Evento inexistente derrubava a chamada inteira** — o array tinha
**`MESSAGE_RECEIPT_UPDATE`**, que **não existe** no enum da Evolution → `400 Bad Request` em
tudo. Só valem (entre outros): `MESSAGES_UPSERT`, `MESSAGES_UPDATE`, `SEND_MESSAGE`,
`CONNECTION_UPDATE`, `CALL`...

Ficaram só os 2 que importam:
| Evento | Pra quê |
|---|---|
| `MESSAGES_UPSERT` | mensagem nova do cliente → **chatbot** |
| `MESSAGES_UPDATE` | status de entrega → **disparo** |

## ✅ Como aplicar (depois de qualquer instância nova / troca de número)
```bash
curl -s -X POST -H 'Content-Type: application/json' -d '{}' \
  http://localhost:4903/api/disparo-whatsapp/setup-webhook
# success:true + enabled:true = registrado
```
Confirmar: rodar de novo e ver o **mesmo `id`** retornando.

## ⚠️ Armadilhas descobertas no caminho
- **Token no banco é criptografado** (`iv:cipher`). Usar o valor cru do Postgres em `curl`
  dá **401**. Só a app descriptografa (`ConfigurationService.get`) — por isso sempre chame o
  endpoint `setup-webhook`, não monte o curl na mão.
- **A Evolution só aceita UM webhook por instância.** Disparo e chatbot dividem a `MARKETING`,
  por isso os dois entram pelo mesmo `/api/disparo-whatsapp/webhook`, que despacha por evento
  (`messages.upsert` → chatbot, `messages.update` → disparo). Ver `mkt-chatbot.service.ts`.
- 🔴 **Ainda hardcoded:** a `webhook_url` default no `setup-webhook` aponta pra
  `tradicao.prevencaonoradar.com.br`. Pra outro cliente, **passar `webhook_url` no body**,
  senão registra o webhook apontando pro Tradição.

## 🏷️ Tags
#bug #chatbot #whatsapp #evolution #webhook #tradicao
