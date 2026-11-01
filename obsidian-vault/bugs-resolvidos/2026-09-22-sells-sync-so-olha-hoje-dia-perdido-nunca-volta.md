# 🕳️ O Sells Sync só olha HOJE — dia que a frente de caixa atrasa fica vazio PARA SEMPRE

**Data:** 2026-09-22 · **Cliente:** [[../clientes/supervital|SuperVital]] (vale para todos) · **Módulos:** [[../modulos/bipagens|Bipagens]], Sells Sync · **Status:** 🟡 diagnosticado · ⛔ **Roberto decidiu em 22/09: deixar como está**

## 🔥 A lição principal

O cron de vendas roda **de minuto em minuto**, mas sempre com a **data de hoje**:

```ts
// index.ts:1534 — cron('* * * * *')
await SellsSyncService.syncToday();

// sells-sync.service.ts:89 — a data é SEMPRE o "agora" do Brasil
const brDate = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }));
const date = `${year}-${month}-${day}`;
await this.syncForDate(date);
```

`syncForDate(data)` aceita **qualquer** data — mas **ninguém nunca o chama com data passada**.
Os dois únicos chamadores (`index.ts:1536` e `system-status.controller.ts:135`) chamam
`syncToday()`.

> 🔑 **Consequência:** todo dia em que o Oracle não tinha a venda **na hora em que o cron
> passou** fica vazio na tabela `sells` **para sempre**. Não existe recuperação, nem manual
> pela tela. O sync não está travado — ele está **olhando para o lugar errado**.

## 🕵️ O cenário real (Roberto, 22/09)

A **frente de caixa do SuperVital é de outro sistema** e às vezes para de enviar venda para
o Intersolid. Quando volta, despeja o atrasado **com a data original**.

```
dia 21  → frente de caixa parada. Oracle vazio. Cron roda 1440x, acha nada.  ✅ correto
dia 22  → frente de caixa volta e grava as vendas do dia 21 no Intersolid.
          Cron está sincronizando o dia 22. O dia 21 nunca mais é lido.      ❌ buraco
```

Por isso a sensação de *"o sistema voltou mas continua sem receber"*: **hoje** volta sozinho;
**o dia que faltou, não**.

## 🎭 O que cura sozinho e o que não cura

| Módulo | Lê de onde | Recupera dia passado? |
|---|---|---|
| [[../modulos/gestao-inteligente|Gestão Inteligente]] | **Oracle direto** (a cada consulta) | ✅ **sim** — aparece assim que o ERP grava |
| Prevenção / cruzamento bipagem × venda | tabela **`sells`** (só o cron popula) | ❌ **não** — buraco permanente |

⚠️ É por isso que o sintoma engana: a Gestão Inteligente "conserta sozinha" no dia seguinte
e dá a impressão de que **tudo** voltou. A Prevenção fica com o dia furado em silêncio.

## ✅ O que já está certo (não mexer)

Reescrever a trava **não** é a correção — ela já foi endurecida em 25/07 e 25/08:

- `MAX_RUN_MS = 8min` → trava expira ([[2026-08-25-trava-de-cron-sem-prazo-parou-10h|booleano sem prazo trava pra sempre]])
- `runToken` → o `finally` só libera a trava se ainda for dele
- `MAX_EM_VOO = 2` → teto de syncs em voo, protege o pool do Postgres

**O problema não é concorrência. É janela de data.**

## ⛔ Decisão: 22/09/2026 — deixar como está

Roberto decidiu **não corrigir por enquanto**. O bug fica documentado, o código não muda.

> 🔇 **Não re-oferecer a cada chat.** Retomar só se ele pedir, ou se um dia furado voltar a
> doer de verdade (ex.: auditoria de bipagem não fechar por causa de buraco na `sells`).

**Como conviver enquanto isso:**
- A Gestão Inteligente **não sofre** — lê o Oracle direto e mostra o dia passado sozinho
- Quem fica furado é a **Prevenção** (cruzamento bipagem × venda) no dia que a frente de
  caixa atrasou. Se alguém estranhar um dia vazio lá, **é isto aqui**, não é bug novo
- Para saber se há furo: `scripts/ultima-venda-oracle.js` mostra o que o Oracle tem por dia;
  comparar com o que a tela da Prevenção mostra no mesmo dia

## 🛠️ Correção proposta (⏸️ parada — só para quando for retomada)

`syncForDate` é **idempotente** — o insert é
`ON CONFLICT (product_id, product_weight, num_cupom_fiscal) DO UPDATE`
(`sells-sync.service.ts:331`). **Re-rodar um dia passado é seguro**, não duplica.

Formato que respeita a regra de automação do Roberto (**lista branca + disjuntor**):

1. **Janela fixa e curta** — só os últimos N dias (3), nunca "desde sempre"
2. **Detecção barata** — `COUNT(*)` no Oracle × `COUNT(*)` em `sells` por dia; só re-sincroniza
   o dia que **divergir**
3. **Cadência própria** — a cada ~15 min, **não** de minuto em minuto
4. **Teto de 1 dia por rodada** — nunca reprocessa a janela inteira de uma vez
5. **Disjuntor** — depois de N tentativas no mesmo dia sem casar, **desiste e grita 🚨** no log
   em vez de tentar para sempre
6. **Nunca em paralelo** com o sync do dia (mesma trava / mesmo `emVoo`)

> ⚠️ Sem os itens 4 e 5 isso vira exatamente a auto-cura que já queimou a VPS uma vez.
> Recuperação tem que ter teto e prazo.

## 🔗 Relacionados
- [[2026-09-22-tela-zerada-era-o-erp-da-loja-parado|Tela zerada: perguntar ao Oracle a última venda]]
- [[2026-09-21-teste-falho-desliga-a-integracao-inteira|Teste falho desliga a integração]]
- [[2026-08-25-trava-de-cron-sem-prazo-parou-10h|Trava de cron precisa expirar]]
- [[2026-07-10-sells-sync-deadlock|Sells Sync deadlock]]

## 🏷️ Tags
#bug #sells-sync #cron #bipagens #supervital #pendente
