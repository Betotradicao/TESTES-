# Chatbot WhatsApp — 3 bugs: mudo (webhook) + menu repetindo

**Data:** 2026-07-20 · **Cliente:** Tradição · **Commits:** `afb144b` + `05a67ae` + `907a901`

> Dois problemas distintos na mesma sessão: **(A)** o bot não respondia nada (webhook nunca
> registrado — 2 bugs empilhados) e, depois de resolvido, **(B)** o menu reaparecia a cada
> resposta. Vá direto na parte B se o bot já responde.

---

# PARTE A — Bot mudo: webhook nunca era registrado

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

---

# PARTE B — Menu reaparecia a cada resposta (cooldown ignorado)

**Commit:** `907a901`

## 🐛 Sintoma
Cliente digitava `1` → recebia a resposta da opção 1 **e o menu inteiro junto**. A cada
resposta o menu voltava, mesmo com `intervalo_menu_horas = 4` configurado e salvo.

## ⚠️ Cuidado: a config estava CERTA
```sql
SELECT id, ativo, intervalo_menu_horas FROM mkt_chatbot_fluxos;  -- => 4
```
Não perca tempo procurando erro de salvamento na tela. O valor gravava certo — **o código
é que não consultava esse valor no caminho crítico**.

## 🎯 Causa-raiz
Depois de responder uma opção, o fluxo **volta pro bloco inicial (menu) automaticamente**
(`resolverProximoBloco(bloco, '')` no laço de renderização). Mas o cooldown só era testado
em **dois** pontos:
1. conversa nova (sem sessão)
2. resposta que não casou com nenhuma opção

O **retorno automático ao menu não passava por nenhum dos dois** → menu reenviado sempre.

## ✅ Correção
No laço de renderização, se o próximo bloco é o menu **e** ele já foi há menos de
`intervalo_menu_horas`, não renderiza: só aponta `sessao.bloco_atual_id` pro menu e sai.

> 💡 **A sacada:** apontar a sessão pro menu **sem enviá-lo** mantém as opções válidas.
> O cliente digita `2` logo depois e cai na opção certa — *"botões ficam livres, menu não
> reaparece"*. Mesmo princípio já usado ao criar a sessão (`bloco_atual_id = inicial`
> mesmo calado).

⚠️ **Reavaliar o cooldown a cada volta do laço** (chamar a função, não usar a const do
início): `contato.ultimo_menu_at` muda dentro do próprio laço quando o menu é enviado.
Sem isso, o menu poderia sair duas vezes na mesma execução.

`intervalo_menu_horas = 0` mantém o comportamento antigo (menu sempre).

---

# PARTE C — Bot respondia a QUALQUER frase, repetindo a última opção

## 🐛 Sintoma
Cliente escolhia a opção 4 (ATENDENTE), lia a resposta e depois escrevia qualquer coisa
solta ("Oferta", "Olá") → levava **"❓ Não entendi sua resposta"** + o **bloco 4 inteiro
de novo**, toda vez. Parecia que o cooldown do menu não funcionava — mas não era o menu
que voltava, era a **última opção escolhida**.

## 🎯 Causa-raiz (dois defeitos empilhados)
1. **Não casou = repetia o bloco + "Não entendi".** Comportamento herdado. Cliente real
   escreve solto o tempo todo → cada frase virava 2 mensagens nossas.
2. **A sessão ficava presa no bloco-folha da opção escolhida.** `renderizarBloco` sai do
   laço em `aguardaResposta`/`encerrar`, então `bloco_atual_id` parava na opção 4 — que
   não tem conexão de saída nenhuma. Daí em diante **nada** casava.

> 🔑 Corrigir só o (1) deixaria o bot **mudo pra sempre**: parado na folha, nem "2"
> casaria. Os dois têm que andar juntos.

## ✅ Regra do Roberto (20/07) — a que vale hoje
> Menu vai **uma vez** (respeitando `intervalo_menu_horas`). Depois disso o bot **só
> responde a número de opção válido**. Qualquer outro texto = **silêncio total**.

## ✅ Correção
- Não casou → `return` calado. Sem "Não entendi", sem repetir bloco.
- Novo `reancorarNoMenu(sessao, fluxo)` no fim do laço: se a sessão parou num bloco
  **sem conexão de saída**, reaponta `bloco_atual_id` pro inicial **sem reenviar o menu**.
  Bloco com saída própria (submenu de verdade) fica onde está.
- Sessão nova com menu em cooldown: tenta casar o texto contra o menu **antes** de calar
  (o bloco `atendente` finaliza a sessão, e sem isso o próximo número era descartado e o
  cliente tinha que digitar duas vezes).

## 🏷️ Tags
#bug #chatbot #whatsapp #evolution #webhook #menu #tradicao
