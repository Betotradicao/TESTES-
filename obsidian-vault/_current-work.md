# 🚧 Trabalho em Andamento

## ✅ Bipagens: coluna OFERTA (21/08) — DEPLOYADO NO TRADIÇÃO + backfill feito

Badge amarelo **SIM** pra item vendido em oferta; fora de oferta fica em branco.
Commit `12e76ec`. Migration `1785400700000` (só ADICIONA coluna nullable).

**Backfill rodado** nas 91 bipagens que já estavam verificadas: 6 em oferta,
85 fora, **0 sem venda correspondente** no Oracle. Sem isso a coluna ficaria
vazia pra sempre nas antigas — o SellsSync só processa bipagem `pending`,
verificada nunca mais é revisitada.

Detalhes + tabela do caso real: [[modulos/bipagens]]

---

## ✅ Bipagens: filtro Tipo Venda + faixa de Margem (21/08) — DEPLOYADO NO TRADIÇÃO

- **Tipo Venda:** `Todas` (padrão) / `Com desconto`
- **Margem abaixo de (%)** / **acima de (%)** + botões **Filtrar** e **Limpar filtros**

Commit `7e49488`. Margem só é gravada desde 20/08 — filtro em data anterior vem
vazio, é esperado.

⏭️ **Roberto:** `Ctrl+Shift+R` e testar as duas coisas.

---

## 🐛 Achado colateral — margem/desconto zerados no ERP Postgres (Nunes)

Em `sales.service.ts`, o bloco do PostgreSQL ERP lê `row.VAL_DESCONTO` e
`row.VAL_CUSTO_REP` em MAIÚSCULO, mas os alias da query são minúsculos
(`val_custo_rep`) — e desconto nem é selecionado. Resultado: no
[[clientes/nunes|Nunes]] o custo sempre vem 0 e a margem sairia 100%.

**Não mexi** — Nunes não estava no escopo e não dá pra validar daqui.
Decidir com o Roberto se corrige.

---

## ✅ Bipagens: filtro Tipo Venda + faixa de Margem (21/08) — DEPLOYADO NO TRADIÇÃO

Roberto pediu dois filtros novos na tela de Bipagens:
- **Tipo Venda:** `Todas` (padrão) / `Com desconto`
- **Margem abaixo de (%)** e **Margem acima de (%)** + botões **Filtrar** e **Limpar filtros**

Commit `7e49488`, push TESTE, build `--no-cache` + `up -d --no-deps`.
Backend e frontend `healthy`, watchdog `active`. Código novo confirmado dentro
da imagem (`com_desconto` e `margem_abaixo` no `dist`).

Detalhes técnicos: [[modulos/bipagens]]

⚠️ **Aviso pro Roberto:** margem só é gravada desde 20/08. No Tradição, das 778
bipagens dos últimos 7 dias só **83 têm margem** (todas de 20-21/08). Filtro de
margem em data anterior a 20/08 vem vazio — é esperado, não é bug.

⏭️ **Roberto:** `Ctrl+Shift+R` e testar. Sugestão de teste com dados reais de hoje:
margem **acima de 30%** → deve trazer ~62 itens; **abaixo de 10%** → 1 item;
**Com desconto** → 1 item (o PEITO DE FRANGO, cupom 647185).

---

## ✅ Bipagem com desconto no caixa (20/08) — RESOLVIDO E NO AR

**Todo desconto virava falso alarme de furto.** A bipagem grava o valor da ETIQUETA; com
desconto, `VAL_TOTAL_PRODUTO` vem menor e o matcher (tolerância R$ 0,03) nunca casava —
o item ficava "Pendente" parecendo que saiu sem passar no caixa.

**Deployado no Tradição** (commit `fa71408`). Validado em produção: a bipagem do
PEITO DE FRANGO (id 56416) virou `verified` sozinha no 1º ciclo do SellsSync —
cupom 647185, R$ 101,64 + R$ 11,30 de desconto, margem 31,63%.

Novas colunas **Desconto** e **Margem** na tela e na impressão.
Causa-raiz: [[bugs-resolvidos/2026-08-20-bipagem-com-desconto-nunca-casava]]

> 🔙 **Ponto de retorno seguro:** commit `0a91232` (estado anterior, açougue ao vivo).
> A migration só ADICIONA colunas — voltar o código não quebra nada.

---

## 🥩 Açougue/Desmembramento agora lê AO VIVO do ERP (19/08) — código local, **falta deploy**

**Roberto alterou rendimentos no Intersolid e a tela não mudou.** Causa: os templates
nunca vieram do ERP — eram cópia local congelada desde 04/2026. O preço de venda idem.

**Feito:** `listarTemplates` / `getTemplate` / `calcularDesmembramento` agora consultam o
Oracle a cada chamada (`TAB_PRODUTO_DECOMPOSICAO` p/ % e `TAB_PRODUTO_LOJA` p/ preço).
Filtro com 2 travas (prefixo `AC MATRIZ` configurável + soma 99–101%) — validado: 8
matrizes, zero combos. Migration `1785400500000` (template_id → VARCHAR, sem FK).
`tsc` e JSX limpos; queries testadas contra o ERP real.

⚠️ **Os números da tela VÃO MUDAR** (250kg × R$22,50): margem 31,34% → **28,52%**,
lucro R$ 2.567,81 → **R$ 2.244,59**. O novo é o correto — o antigo prometia R$ 323 a
mais por carcaça.

📌 `AcougueCadastroRendimento.jsx` + tabelas `acougue_rendimento_*` ficaram **órfãs**.
Decidir com o Roberto se remove ou reaproveita.

Detalhes: [[modulos/acougue-desmembramento]]

---

## 🔧 Auditorias travadas (Etiquetas + Rupturas) — corrigido LOCAL, **falta deploy**

Auditoria com 24/24 verificados não fechava: o botão ENVIAR olhava a lista da **sessão do
navegador**, não o status do **banco**. Um F5 já bastava pra travar de vez.
Confirmado no banco: auditorias **83** (24 itens) e **82** (94 itens) estão `em_andamento`
com **zero pendentes**.

**Feito** (`EtiquetaVerificacao.jsx` + `RupturaVerificacao.jsx`): pendente passa a sair do
status do banco; botão aparece quando não há pendente; aviso amarelo virou **lista clicável
dos itens que faltam** (clicar leva direto ao item); removido bloco de DEBUG que expunha IDs
em produção. Ambos compilam.

Causa-raiz: [[bugs-resolvidos/2026-08-13-auditoria-presa-contador-so-da-sessao]]

✅ **DEPLOYADO NO TRADIÇÃO (14/08)** — commits `1664ce6`, `7a3c6a9` + vault. Backend e
frontend `healthy`, API 200, Oracle OK (1149 vendas). Verificado dentro das imagens:
lista de pendentes no card ✅ e teto de 100% no backend ✅. Watchdog religado (3 backends).

> ⚠️ **Lição de operação:** o deploy de 13/08 ficou pela metade (build rodou, `up -d` nunca
> executou) e **o watchdog ficou PAUSADO por ~1 dia** sem ninguém notar. Conferir sempre
> `systemctl is-active radar-watchdog.timer` no fim de um deploy — e desconfiar quando o
> `docker ps` mostrar o backend com uptime velho demais pro deploy que se acabou de fazer.

⏭️ **Roberto:** `Ctrl+Shift+R` e testar. Auditorias 82 e 83 devem poder ser finalizadas.

---

## 💬 Chatbot: manter a conversa como "não lida" (14/08) — PROPOSTO, aguardando OK

Roberto: o robô responde e a conversa perde a bolinha verde, então ninguém percebe que
teve atendimento.

**Não é config nossa:** a instância TRADICAO está com `readMessages:false` e
`readStatus:false` — o robô **não** manda recibo de leitura. O que zera o contador é o
próprio WhatsApp: **enviar mensagem pela conta marca aquela conversa como atendida em
todos os aparelhos**.

✅ **Solução confirmada na instância:** Evolution **v2.3.7** tem `POST /chat/markChatUnread/
{instance}` (sondado: devolve `400 requires property "lastMessage"` = rota existe).
Precisa de `lastMessage.key` — e o `handleWebhook` do chatbot já tem `data.key`
(`remoteJid`/`id`), então é só chamar **depois** de responder.

⚠️ Ordem importa (marcar antes, o envio apaga) · abrir a conversa limpa a marcação (normal).
⏭️ Sugerido implementar com **liga/desliga na tela**, pra testar sem depender de deploy.

## 🔧 Conciliação: 2 bugs corrigidos (05/08) — código LOCAL, **falta deploy**

**Não era bug de tela: o backend recusava as gravações e ninguém avisava.** O front mandava
1 POST por linha; com ~470 selecionadas o rate limit (200/min) cortava o excedente com 429,
mas a tela já tinha pintado tudo verde (otimista). Medido: 232 chegaram, 218 gravaram,
**288 ficaram sem classificação** — e o Demonstrativo estava certo o tempo todo.

Também corrigida a **tela branca**: `ManualConciliacao` chamava `useState` **depois** de
`return` condicional (quebra as Regras dos Hooks).

**Feito:** novos endpoints de lote (`/amarracoes/lote` e `/movimento/unica/lote`), front
manda 1 requisição só, desfaz o verde no erro e mostra quantas salvaram de verdade.
`tsc --noEmit` limpo, JSX compila.

Causa-raiz + queries de conferência:
[[bugs-resolvidos/2026-08-05-conciliacao-rate-limit-engoliu-classificacoes]]

✅ **DEPLOYADO NO TRADIÇÃO (05/08)** — commits `6160708` + `d14aae1`, push TESTE `d14aae1`.
Build `--no-cache` + `up -d --no-deps`. Backend e frontend `healthy`, ERP OK, health 200 em
0,03s. Rotas novas confirmadas no ar (`/amarracoes/lote` e `/movimento/unica/lote` → 401,
ou seja existem). Watchdog religado (3 backends).

⏭️ **Roberto:** `Ctrl+Shift+R` na página e **reclassificar as 288 linhas** — agora numa
tacada só. Depois conferir se o Demonstrativo bate com a Conciliação.

## ✅ SuperVital "CONEXÃO = OFF" (03/08) — RESOLVIDO + blindado

**Backend congelado desde 31/07 00:00 (BRT) — 3 dias fora, ninguém percebeu.**
Mesma assinatura do Tradição (`futex_wait_queue`, 236 healthchecks empilhados). O container
dizia `Up 3 weeks` o tempo todo. Oracle dele estava OK — o problema era o processo Node.

**Causa de fundo:** a correção anti-travamento de 25/07 tinha sido deployada **só no Tradição**.

**Feito:** restart → deploy da correção (verificada dentro da imagem) → **SuperVital entrou
na lista do watchdog**. Backend e frontend `healthy`, Oracle com 1415 vendas.

## ✅ MaxValle também corrigido (03/08) — preventivo

Ele **não estava travado** (rodando normal desde 07/07), mas com o código antigo. Deploy
feito: correção verificada na imagem, backend e frontend `healthy`, Oracle com 511 vendas,
API 200. **Entrou na lista do watchdog.**

> ✅ **Checklist do MinIO conferido antes** (`prevencao-maxvale-minio:9000` — correto).
> Era o risco de travar o boot e derrubar o cliente. Fecha pendência antiga do vault.

> 🔴 **Nunes ficou de fora** (decisão do Roberto, 03/08): código antigo **e** sem vigia.

Detalhes + método forense: [[bugs-resolvidos/2026-07-25-backend-tradicao-congelou-queda-oracle]]

## ✅ RESOLVIDO (04/08) — Santander LTDA voltou: token `HTTP 200`

**O que destravou: criar uma APLICAÇÃO NOVA no portal.** O botão "Renovar" da aplicação
existente atualizou a validade na tela mas **nunca** trocou o certificado no gateway da API
(ficou `403 Unauthorized hash` por +24h). Credenciais novas gravadas (id 32ch, secret 16ch);
certificado do nosso lado não mudou. Backup: `bank_accounts_bkp_20260804`.
Lição completa em [[bugs-resolvidos/2026-07-10-santander-certificado-renovacao]].

✅ **VALIDADO PELO ROBERTO (04/08): o extrato voltou a aparecer na tela.** Assunto encerrado.

---

## 🔴 Histórico: Conciliação Manual vazia (25/07) — certificado Santander LTDA VENCEU

**Não é bug da tela.** A API do Santander devolve **403** → extrato com 0 lançamentos →
o modo Manual (que só usa o banco) fica vazio. O modo Sistema disfarça porque ainda
mostra o Oracle.

**Medido:** cert da conta **SANTANDER LTDA** (`47692182000172`, conta `000130075973`)
**venceu em 23/07/2026**. A ADM COMERCIAL está válida até 09/06/2027.
A renovação de 10/07 pegou só uma das duas contas.

**Feito em 25/07 (ainda NÃO resolvido):**
- ✅ Cert novo instalado e **convertido de legacy→moderno** (cópia manual não basta:
  Node dá `Unsupported PKCS12 PFX data`). Válido até 09/06/2027.
- ✅ `.cer` da cadeia pública gerado pro portal:
  `Desktop\CERTIFICADOs 2026 2027\SANTANDER-LTDA-47692182000172.cer` (4 certs, 0 chave privada).
- ✅ Credenciais novas do Roberto gravadas cifradas.
- ❌ **Token ainda falha: `401 Invalid client credentials`.**

> 🔑 **Mas ANDOU:** era `403` (certificado recusado), virou `401` (credencial recusada) —
> ou seja, **o certificado já passou no mTLS**. Controle na conta ADM COMERCIAL deu
> `200 + token`, provando que o método de teste está certo.

> 🔀 **27/07 — o `401` era erro MEU, não do portal.** Gravei `client_id`/`client_secret`
> **invertidos**: no Santander o **id tem 32 chars e o secret 16** (o inverso do usual).
> Corrigido. E ficou provado que **as credenciais NUNCA mudaram** — as que o Roberto passou
> são idênticas às antigas (a renovação não emite credencial nova, é a mesma aplicação
> RADAR 360). **Só falta mesmo registrar o certificado no portal.**

**Nosso lado está 100% verificado — o bloqueio é o PORTAL do Santander:**
- Senha do PFX conferida contra a que o Roberto passou: **idêntica**, e abre o certificado.
- `client_id`/`client_secret` gravados decriptam **exatos** aos que ele passou.
- Roberto relatou (25/07) que **o upload do `.cer` no portal NÃO deu certo**.

Arquivos prontos em `Desktop\CERTIFICADOs 2026 2027\` pra tentar formatos diferentes:
| Arquivo | Conteúdo |
|---|---|
| `SANTANDER-LTDA-47692182000172.cer` | cadeia completa (4 certs) — mesmo formato que funcionou na ADM COMERCIAL |
| `LTDA-somente-folha.cer` / `.crt` / `.pem` | só o certificado da empresa (1 cert) |

**27/07 — Roberto renovou no portal (mostra "Dentro do prazo", Ativo, Produção). Ainda `403`.**
Testado 5x ao longo de ~10min: sempre `Unauthorized hash`. Não é propagação de curto prazo.

Verificações que **descartam problema do nosso lado**:
- Digital SHA-256 do cert instalado == a do arquivo do Roberto (`9A:BD:B7:32...`).
- PFX instalado tem **4 certificados** — cadeia idêntica à da ADM COMERCIAL que funciona.
- Os 2 uploads dele pela tela **funcionaram** (log: "PFX convertido... Certificado salvo").
- ✅ **ADM COMERCIAL segue `200 + token`** — nada foi quebrado de colateral.

> 🔑 **As 2 contas são APLICAÇÕES DIFERENTES no portal** (client_ids distintos:
> ADM `YLhGx...Ipfz`, LTDA `6uRPp...3mlb`). Mas o portal lista **só a RADAR 360** —
> provável que cada CNPJ tenha seu próprio login/aplicação. **Confirmar em qual CNPJ
> ele está logado ao renovar.**

⏭️ **A hipótese que sobrou (só o Roberto consegue checar):** renovar pode ter **rotacionado
o Client Secret**. Abrir RADAR 360 → **Acessar** → aba **Credenciais** e comparar com
`h0Nf...N6aw` (16ch). Lembrar: **id=32ch, secret=16ch**.

⏭️ **Decisão pendente do Roberto:**
- **(A)** Insistir na aplicação NOVA → precisa registrar o cert nela e ativar APIs/Produtos.
- **(B)** Voltar pra aplicação **RADAR 360 antiga** (client_id conhecido, dava
  `403 Unauthorized hash` = só faltava o cert novo). Credenciais antigas estão em
  `bank_accounts_bkp_20260725`; reverter é um UPDATE.
> 💡 **(B) tende a ser mais curto:** o `403 Unauthorized hash` prova que aquele client_id
> É reconhecido — só falta casar o certificado. Já o novo dá `401`, que é "não conheço
> esse client_id".

## 🚨 Tradição ficou 10h fora (25/07) — ✅ NO AR, mas SEM correção definitiva

**Gatilho:** o Oracle da loja caiu às 05:32 UTC e voltou depois. **A queda foi passageira —
o estrago não.** O backend congelou às 06:10 e ficou assim até o `docker restart` às 16:07.

Resolvido com `docker restart prevencao-tradicao-backend` (health 200 em 0,24s, Oracle e
IMAP reconectados). **Nada de código/config foi alterado.**

Causa-raiz completa + método forense: [[bugs-resolvidos/2026-07-25-backend-tradicao-congelou-queda-oracle]]

> 🔴 **VAI REPETIR.** Nada foi corrigido — na próxima oscilação do Oracle o backend congela
> de novo e fica fora até alguém perceber.

### ✅ Item 1 FEITO — Radar Watchdog no ar (25/07)
Roberto aprovou **exigindo que não repita o incidente de "recriar tudo sozinho e esquentar
a VPS"**. Feito script próprio com **lista branca + disjuntor** em vez de `autoheal` pronto
(que reiniciaria os **13 frontends falso-positivo** em loop — o medo dele estava certo).
Testado em container descartável, 111ms de CPU/execução. Detalhes:
[[arquitetura/radar-watchdog]]

### ✅✅ DEPLOYADO NO TRADIÇÃO (25/07, commits `a4b13b9` + vault, push TESTE `3f24ba2`)
Build `--no-cache` + `up -d --no-deps frontend backend`. Backend e frontend recriados
16:45, ambos **`healthy`**, Oracle reconectou (2479 vendas), SellsSync em 2s.

> 🎉 **O frontend do Tradição ficou `healthy` pela 1ª vez em 8+ dias.** Prova dentro do
> container: `localhost:3004` agora responde OK (antes: `Connection refused`).
> Os outros 12 frontends só corrigem quando levarem deploy.

> 🔬 **Flagrante do bug ANTES do deploy:** havia **3 ffmpeg simultâneos do MESMO clipe**
> (canal 16, mesmo starttime), iniciados com 3min/1min/45s de diferença — carga da VPS em
> **9.55**. Era o cron de 5min disparando por cima da rodada anterior, exatamente o que a
> trava corrige. Encerrados manualmente; carga voltou pra ~3.

> ⚠️ **As travas ainda NÃO foram exercitadas em produção** — elas só logam quando barram
> algo, e desde o deploy não houve sobreposição nem queda de Oracle. Sinais a procurar:
> `🎬 [Pre-clipe] Rodada anterior ainda em andamento, pulando...` e
> `[SellsSync] 🛑 N syncs ainda em voo`.

### ✅ Itens 2, 4 e 5 (o que foi corrigido)
- **#2 zumbis esterilizados** (`sells-sync.service.ts`): token de posse + teto de 2 em voo.
  O `finally` do sync abandonado não zera mais a trava do sync atual.
- **#4 anti-empilhamento** (`index.ts`): `preClipeRodando` e `preClipePdvRodando` nos 2 crons.
- **#5 healthcheck do frontend** (`nginx.conf`): `listen [::]:3004;`. Provado no container:
  `127.0.0.1:3004` OK / `localhost:3004` recusado.

⏭️ **Roberto testar → depois commit + push TESTE + deploy.** O #5 exige rebuild da imagem
do frontend pra valer.

⏭️ **#3 Oracle pelo túnel SSH — NÃO feito, precisa da sua decisão.** Muda como a produção
fala com o ERP; trocar às cegas pode derrubar tudo. Ver a contradição do CGNAT na nota.

## ✅ DVR Tradição "RPC2 timeout" (24/07) — RESOLVIDO: o DVR mudou de IP sozinho

`10.6.1.148` → **`10.6.1.110`** (DHCP). Aparelho estava saudável o tempo todo.
Corrigido `tunnels.json` (backup `.bak-20260724`) + `dvr_devices.ip` no banco.
Validado: HTTP 200 (68ms), RPC2 `login challenge`, container→gateway 21ms, ffprobe
`hevc 2880x1616` ao vivo.

> 🔑 A máquina de desenvolvimento (D:, `10.6.1.171`) **É a máquina da loja** — está na
> mesma LAN do DVR. Dá pra varrer a rede e falar com o DVR direto daqui, sem ir na loja.

Causa-raiz + receita de "como achar o DVR quando ele some":
[[bugs-resolvidos/2026-07-24-dvr-tradicao-mudou-de-ip-sozinho]]

⏭️ **Roberto:** clicar em **Testar Conexão** na tela (deve ficar verde) e validar o vídeo.

> ⚠️ **Prevenção NÃO feita — Roberto decidiu "deixar como está" (24/07).** O DVR segue com
> `DhcpEnable=true`, então **vai trocar de IP de novo** e o Vision cai junto. Quando isso
> acontecer: aplicar a receita da nota (varredura 80/554 + `getDeviceType`) — leva ~5min.
> O MikroTik **não é acessível** desta máquina (tudo fechado por firewall, já medido).

## 🧾 Importar PDF de fatura de cartão na Conciliação (22/07) — ✅ NO AR, testar UI

Dentro do botão **Fatura** (modo Manual) agora tem **"📄 Importar PDF da fatura"**. Lê os
lançamentos, sugere a conta de cada um (aprendida das amarrações por prefixo do
estabelecimento) e você só ajusta. Reusa a trava "soma bate com o banco".

**Validado em produção:** fatura Santander do Roberto → 38 itens, soma R$ 14.992,91,
**bate exato** com o "Total Desta Fatura". Testado dentro do container.

**Arquivos:** `fatura-pdf.service.ts` (parser), rota `POST /conciliacao/fatura/importar-pdf`
(multer memory), `FaturaModal` no `ConciliacaoBancaria.jsx`.

> 🔑 **LIÇÃO CARA — pdf-parse 1.x vs 2.x + Node:**
> - **2.x** (classe `PDFParse`, `.getText()`) separa colunas com ESPAÇO → parseável.
> - **1.x** (`pdf(buffer)`) COLA tudo (`SCP...11,400,005,387`) → ambíguo, inútil pra isso.
> - 2.x exige **Node 20+** (`process.getBuiltinModule`/`DOMMatrix`). O backend rodava
>   **Node 18** → `DOMMatrix is not defined`. **Subi o Dockerfile pra `node:20-slim`**
>   (mesmo Debian bookworm; oracledb/sharp recompilam no npm install). Backend healthy,
>   Oracle conectou (3037 vendas), Node v20.20.2.

> ⚠️ **DÍVIDA:** `email-monitor.service.ts` e `garimpador-processador.service.ts` chamam
> `require('pdf-parse')` como FUNÇÃO (API 1.x), mas está instalado o 2.x → **o PDF deles
> está quebrado** (não é regressão desta sessão, já estava). Corrigir = migrar os dois pra
> `new PDFParse({data}).getText()`. Fora do escopo de hoje.

> 📌 Fatura com VÁRIOS cartões num débito só: o parser lê UM PDF por vez. O modal avisa
> quando a soma do PDF < valor da linha do banco ("pode faltar outra fatura"). Cada linha
> do extrato terá seu próprio PDF (confirmado pelo Roberto).

---

## ❓ "PIX fica sem classificar no Demonstrativo Manual" — NÃO é bug (21/07)

Roberto: no Direto Sistema mostra 100% classificado, mas no Demonstrativo Manual os
`PIX RECEBIDO` ficam sempre "sem classificar". **Explicado, sem correção (ele pediu só
entender por ora).**

**Causa:** são dois sistemas de classificação distintos.
- **Direto Sistema** → vem do ERP/Oracle (TAB_FLUXO). Sabe que PIX = RECEITA A VISTA → 100%.
- **Direto Manual** → vem das `conciliacao_amarracoes` por **texto EXATO**.
  `PIX RECEBIDO - <CPF>` tem texto único por linha → amarrar um não pega os outros.
  (As 1762 amarrações existentes são `PIX ENVIADO - <nome>`, nomes que se repetem.)

**Soluções na mesa (Roberto vai decidir depois):**
1. **Amarração por PREFIXO** — amarrar "PIX RECEBIDO" uma vez pega todos + futuros.
   Exigiria coluna tipo_match ('exato'|'prefixo') em conciliacao_amarracoes e ajuste no
   match do `getDadosManual`. É o mais definitivo pra texto que muda por linha.
2. **Fallback pro Sistema** no Demonstrativo Manual (usa ERP quando não há amarração manual).
3. Deixar como está.

---

## 📵 Disparo WhatsApp caiu no meio (21/07) — PARAR AQUI, retomar amanhã

**O que aconteceu:** campanha "TV GRUPO 1" (lista de 2000) disparou 68 e travou. Erro nas
linhas = `Connection Closed` (HTTP 500/400). **NÃO é ban** — a instância **MARKETING**
(número próprio `5512988996258`) foi pra estado **`close`/Disconnected**. As outras 3
instâncias (NUNES/KONTRATAI/TRADICAO, todas o mesmo `...8474416`) seguiram Connected.
68 entregues + 6 lidas antes de cair = número saudável, só derrubado por volume.

**Causa:** ritmo 4–6s pra 2 mil números novos → WhatsApp encerra a sessão (autoproteção
anti-spam). A cada queda sobe o risco de virar ban de verdade.

**Como diagnosticar de novo** (a instância dá o veredito):
```
GET {evolution_url}/instance/connectionState/MARKETING  → {"state":"close"}
```
Evolution manager: **https://evolution.kontrataai.com.br/manager** → card MARKETING →
engrenagem → Connect/QR com o WhatsApp do 5512988996258.

**⏭️ AMANHÃ (Roberto aprovou):** deixar **intervalo entre msgs** e **tamanho do lote/dia**
ajustáveis na TELA (hoje fixos: `delay_min_ms=4000/delay_max_ms=6000/daily_limit=3500`).
Recomendação: 15–30s e lotes de 300–500/dia. Campos em `disparo_campanhas`; front em
`DisparoWhatsapp.jsx` (aba Campanhas).

> ✅ **Já feito hoje, commit LOCAL não pushado** (`fix(disparo): trava autofill do Chrome`):
> a tela de config da instância (`DisparoWhatsTab.jsx`) deixava o Chrome preencher URL da
> API com "Roberto" e Token com senha. **Salvar assim gravava `Roberto` como URL e
> quebrava o disparo.** Config real NUNCA mudou (banco = URL kontrataai + instância
> MARKETING). Blindado com autoComplete=off + readonly-até-focar + guard que recusa URL
> sem http. **Falta push + deploy** (subir junto com o ajuste de intervalo amanhã).

> 🐛 **Bug de contadores JÁ corrigido hoje** (commitado/deployado, `87536cf`): recibo de
> entrega/leitura era descartado (payload `messages.update` achatado na v2). Por isso a
> campanha antiga mostrava tudo "-" em Entregue/Lida. Agora preenche.

---

## ✅ DVR Tradição — IP trocado 10.6.1.123 → 10.6.1.148 (21/07)

DVR começou a dar problema, trocaram o aparelho/IP. Agora é **Intelbras MHDX 5116** no
`10.6.1.148`. Túnel arrumado e respondendo (HTTP 200 + RPC2 `login challenge`).
Mexido: `dvr_devices.ip` (banco Tradição) + `tunnels.json` (forwards 28100/28101 → .148).
Backups `.bak-20260721`. **Detalhe da armadilha "editar o .ps1 não adianta" em
[[modulos/dvr-cameras]].** Falta Roberto clicar em Testar Conexão e validar o vídeo.

> 🔴 **PENDÊNCIA (Roberto pediu pra focar só no DVR):** o `tunnels.json` da máquina da
> loja tem, na entrada do **Oracle**, um forward morto pro DVR velho:
> `-R 18080:10.6.1.123:80` (junto do `-R 1521:...:1521` do banco). É o padrão que já
> derrubou o Oracle antes ([[bugs-resolvidos/2026-07-15-tunel-dvr-chave-nao-autorizada-matava-oracle]]).
> Corrigir = trocar .123→.148 ou remover o forward, MAS reinicia o túnel do Oracle
> (banco fica alguns segundos fora). Fazer em horário de baixo movimento.

---

## 🎲 Sorteador (menu Marketing no Radar) — 20/07 — ⏳ AGUARDANDO TESTE

Roberto quer sortear **entre os membros da comunidade** (recusou sortear na base dos 6.789).
Funciona hoje na Super Tradição (4 membros, 4 números visíveis).

⚠️ **Limite que NÃO é do nosso código:** WhatsApp oculta o telefone de membro de comunidade.
Medido: Roldão 1713 membros → 2 números. Por isso a tela mostra sempre
`Sorteáveis / Total / Sem número` — se a comunidade crescer e o WhatsApp esconder, aparece.
Causa-raiz: [[bugs-resolvidos/2026-07-20-comunidade-whatsapp-numeros-ocultos-lid]]

**Backend:** `whatsapp.service.ts` — `getNumeroInstancia()`, `listarGruposSorteaveis()`
(comunidades **+ grupos comuns** onde é admin; casa o nó da comunidade com o grupo de Avisos
pelo `subject`), `sortearNaComunidade()` (Fisher-Yates com `crypto.randomInt`).
Rotas: `GET /api/whatsapp/comunidades`, `POST /api/whatsapp/sorteio`.
`fetch-groups` aceita `?participants=true` (`a11a797`).

**Frontend:** `pages/Sorteador.jsx` + rota `/sorteador` em `App.jsx` + `Sidebar.jsx`
(3 pontos: lista de módulos L15, mapa path→seção L260, `subItems`) + `menuConstants.js`.

**Retornos do Roberto já aplicados (v2/v3):**
- Tela abria **sem menu lateral** — não existe Layout global no projeto; **cada página
  renderiza o próprio `<Sidebar/>`**. Faltava fazer isso.
- Cards de grupo viraram **`<select>`**; palco só aparece depois de escolher.
- **Roleta:** dígitos giram e travam da esquerda pra direita; o **último vira `*`** até
  clicar no olhinho. Fogos + confete em canvas puro.
- **Som via Web Audio API, sem arquivo** (mp3 de plateia = ~200kb no bundle + risco de CSP):
  rufar de tambores (ruído grave + tremolo 34Hz, crescendo) enquanto gira; palmas + "EEEEE"
  (bandpass varrendo 700→1500Hz) no final. Botão de mudo no localStorage.
- 🐛 **O resumo entregava o dígito que a roleta escondia** — o `*` vira enfeite se o número
  inteiro aparece logo abaixo. Hoje o mesmo olhinho controla roleta, pódio, resumo E o link
  `wa.me` (que carrega o número completo na URL).
- **Nome do ganhador:** a Evolution **não manda nome** na lista de participantes. Cruza
  `disparo_contatos.nome` (vence) + `mkt_chatbot_contatos.nome_whatsapp`, casando pelos
  **últimos 8 dígitos** (o 9 na frente do celular entra e sai, string inteira perde match).
  🐛 A base importada tem muito **nome-lixo numérico** ("111111", "914") — filtro exige
  ≥2 letras, senão cai no pushName. Nome só aparece **depois** de revelar o dígito.

⏭️ Decisões ainda em aberto:
- Avisar o ganhador automático no WhatsApp? (hoje só mostra na tela + link "abrir conversa")
- Guardar histórico dos sorteios em tabela? (hoje não persiste nada)

## 🤐 Chatbot — silêncio pra texto que não é opção (20/07) — ⏳ AGUARDANDO TESTE DO ROBERTO

**Reclamação:** qualquer frase solta ("Oferta", "Olá") levava "❓ Não entendi" + o bloco da
**última opção escolhida** repetido.

**FEITO no local (D:), NÃO commitado** — `mkt-chatbot.service.ts`, `tsc --noEmit` limpo:
1. Não casou com opção → `return` calado (removido o "Não entendi" + repetição do bloco).
2. Novo `reancorarNoMenu()` no fim do laço — sessão presa em bloco-folha volta a apontar
   pro menu **sem reenviá-lo**, senão o silêncio deixaria o bot mudo pra sempre.
3. Sessão nova em cooldown tenta casar o número antes de calar (bloco `atendente` fecha a
   sessão; sem isso o próximo número era descartado).

⏭️ Roberto testar no **5512988996258**: "oi" → menu · "4" → resposta · "Oferta" → nada ·
"2" → resposta da 2. Se OK: commit + push TESTE + deploy Tradição.
Causa-raiz em [[bugs-resolvidos/2026-07-20-chatbot-mudo-webhook-evolution]] (PARTE C).

---

## 🆕 Vision Palavra-Chave — filtros por Operador e por Faixa de Valor (18/07) — ⏳ TESTAR NO LOCAL

Roberto pediu 2 filtros novos no Vision Palavra-Chave (sem precisar de palavra-chave):
1. **Escolher a operadora + data → todas as vendas do dia dela** (baseado nos cupons).
2. **Faixa de valor** (ex.: R$0,01 a R$0,30) → todos os cupons com total nessa faixa.

**FEITO (local D:, NÃO commitado):**
- Backend `dvr-cftv.service.ts`: novo branch em `searchOracleAllPdvs` quando `!text && (operador||valor)`
  → agrupa `TAB_PRODUTO_PDV` por cupom, `SUM(valor)`=total, `EXISTS` na finalizadora p/ operador,
  `HAVING` p/ faixa. Novo método `getOperadores()` (lista `TAB_OPERADORES`).
- Controller/rota: `searchOracle` aceita `operador`/`valorMin`/`valorMax` e relaxa o "text obrigatório";
  nova rota `GET /dvr-cftv/pos/operadores`.
- Frontend `VisionPalavraChave2.jsx`: dropdown de operador vindo do ERP (value=cod), 2 inputs de valor,
  `handleSearch` manda os params e permite buscar só por critério. Removido filtro client-side antigo.
- **Dropdown de operador lista só quem vendeu no período** (getOperadores com start/end; refetch ao
  mudar período) — antes vinha o cadastro inteiro c/ nomes fantasma.
- **Colunas da tabela ordenáveis A→Z / Z→A** (componente `SortableTh` + estado sortCol/sortDir).
  Corrigido contador "0 de 93" do cabeçalho (resquício do filtro antigo por nome).
- `tsc --noEmit` limpo. Detalhes em [[modulos/vision-palavra-chave]].

✅ **DEPLOYADO NO TRADIÇÃO (18/07)** — `git pull` subiu `75d6788..35420fe`. Foi tudo junto:
Vision (filtros/ordenação/consulta-DVR) **+ Conciliação Manual** (que estava só na TESTE, nunca
em prod). Backend `healthy`, frontend servindo o bundle novo. Migrations da Conciliação = no-op
(tabelas já existiam no banco de prod). Roberto autorizou subir tudo.

> ⚠️ **Frontend fica `unhealthy` no `docker ps` mas ESTÁ SERVINDO.** Healthcheck sonda
> `wget localhost:3004`; nesse container (nginx/1.31.3 Alpine) `localhost` resolve `::1` e o
> `listen 3004;` do default.conf é só IPv4 → healthcheck recusa, mas o tráfego público (via eth0)
> é atendido 200 normalmente. Cosmético. Fix real = adicionar `listen [::]:3004;` no default.conf
> do frontend (não feito, fora do escopo do deploy).

## 🚨 Investigação "consulta de preço" (18/07) — PROVADO: não existe no Oracle

Roberto pediu pra achar onde a Intersolid grava a consulta de preço (a que o DVR acha com
`consulta` no POS Info). **Cruzei os 4 horários exatos do DVR (13/07) contra TODAS as colunas
de hora do schema INTERSOLID → 0 matches.** Conclusão dura: **Oracle não grava consulta de preço.**
- `Canal 2` do DVR = **PDV 3** (canal ≠ pdv). Cupom=0 do TAB_PRODUTO_PDV = **baixa de associado**.
- A consulta só vive no **DVR** (campo `.Text`/`.Data` do item POS). Nosso código hardcodava
  `Text:''` no `POS.startFind` e mandava pro Oracle → errava.
- **✅ FIX IMPLEMENTADO:** `searchConsultaPrecoDVR` puxa do índice POS do DVR filtrando pelo texto;
  `busca_preco` delega pra ele; botão "🔎 Consulta Preco". Detalhes em [[modulos/vision-palavra-chave]].
- ⚠️ **DVR rodando SEM HD** (liga/pinga mas não serve porta; índice POS mora no HD). Não deu pra
  testar ao vivo. Histórico 11-15 está no HD removido — precisa recolocar pra validar.

---

## 🆕 Conciliação "Direto Manual" + Plano de Contas manual — ✅ COMMIT `56a103c` (push TESTE 18/07)

**Commits na TESTE:** `56a103c` (Fases 1-3 + Bloco A) + `db64f02` (Bloco B extrato por dia,
Bloco C topo/calendários/KPIs/mês, Fatura de cartão com itens JSONB, seletor de conta com busca,
toggle "Agrupar por dia"). Migrations: plano_contas, conciliacao_amarracoes, conciliacao_movimento
(+ coluna itens). **VALIDADO pelo Roberto no local.**

**⚠️ Ainda NÃO deployado em produção.** Rodou/validado só no ambiente local (D:, `10.6.1.171:3004`).
As tabelas novas (plano_contas, conciliacao_amarracoes, conciliacao_movimento) já existem no
banco de PROD (o backend local roda migration no prod DB) — mas o CÓDIGO só entra em prod no deploy.
**Falta:** validar Blocos B/C + composição de fatura → depois `git pull TESTE` + build + deploy no Tradição.

**Ferramentas prontas na Conciliação Manual:** 3 ações/linha (Única/Transf./Auto) · seleção em
lote (checkbox + selecionar todos) · ordenação por coluna (▲▼) · busca por palavra-chave.

---

## 🆕 Conciliação "Direto Manual" + Plano de Contas manual (histórico da construção)

**Objetivo do Roberto:** criar um caminho paralelo ao ERP. Ele cadastra o próprio plano
de contas, amarra o **texto EXATO do Favorecido** do extrato Santander a uma conta, e o
Demonstrativo pode ser montado a partir DISSO (não do Oracle, que tem 2.911 mov. sem par).

**Decisões travadas:**
- Amarração pelo **texto exato** do Favorecido (boletos agrupam; PIX com nome não).
- Plano de contas **hierárquico** (Grupo → Conta), espelha o atual, **pré-importável** do Oracle.
- Guardado no **Postgres** (nada no Oracle). Escopo **por loja** (cod_loja).
- 2 botões **Direto Sistema | Direto Manual** na Conciliação E no Demonstrativo.
- Modo Manual: linha sem amarração cai em grupo **"⚠️ Não Classificado"** (nunca esconde $).

**✅ FASE 1 FEITA (Cadastro de Contas)** — commit ainda NÃO feito, rodando só no LOCAL (D:):
- Migration `1785400000000-CreatePlanoContas` (tabela `plano_contas` auto-referenciada).
- Entity `PlanoConta`, service `plano-contas.service.ts` (árvore, CRUD, `importarDoOracle`).
- Controller + `routes/plano-contas.routes.ts` → registrado em `index.ts` (`/api/plano-contas`).
- Tela `CadastroContas.jsx` + submenu em Finanças→Bancos + rota `/cadastro-contas`.
- Testado: rotas 401 (ok), tela 200, migration rodou. **Roberto testando importar+criar.**

**✅ FASE 2 FEITA (Conciliação Direto Manual)** — local (D:), não commitado:
- Migration `1785400100000-CreateConciliacaoAmarracoes` (tabela `conciliacao_amarracoes`,
  UNIQUE cod_loja+texto_exato).
- Entity `ConciliacaoAmarracao`; métodos no `conciliacao.service.ts`: getAmarracoes,
  salvarAmarracao, removerAmarracao, **getDadosManual** (extrato Santander + amarração por texto).
- Controller + rotas: `GET /conciliacao/dados-manual`, `GET/POST/DELETE /conciliacao/amarracoes`.
- `ConciliacaoBancaria.jsx`: botões **Direto Sistema | Direto Manual** (state `modo`), tabela
  manual isolada (`<ManualConciliacao>`) com seletor de conta por linha, verde quando amarrado,
  auto-aplica a todas as linhas com o mesmo texto (otimista). Cards resumo Total/Classificados/
  Não Classificado. Modo Sistema intacto (gated por `modo==='sistema'`).
- Testado: migration rodou, rotas 401, vite compilou. **Roberto testando.**

**✅ FASE 3 FEITA (Demonstrativo Direto Manual)** — local (D:), não commitado:
- `getDemonstrativoManual` no conciliacao.service (agrupa extrato pelas amarrações grupo→conta)
  + rota `GET /conciliacao/demonstrativo-manual` + controller.
- `DemonstrativoCaixa.jsx`: toggle **Direto Sistema | Direto Manual**, componente `DemonstrativoManual`
  (cards Receitas/Despesas/Saldo/Não Classificado + tabela agrupada). Modo Sistema intacto (gated).
- fetchManual resolve bankId Santander padrão (conta 130075973). Testado: rota 401, vite ok.

**⏭️ REDESIGN da Conciliação (pedido novo do Roberto, 18/07)** — replicar UI estilo app financeiro
(ref: prints). Ainda NÃO iniciado. Aguardando ele escolher ordem dos blocos:
- **Bloco A — 3 ações por linha:** ✓ Única (manual pontual, não propaga) · ⇄ Transferência
  (entre contas, fora do DRE, concilia nos 2 bancos — JÁ EXISTE no modo Sistema/BankTransfer) ·
  ⚡ Automática (por texto exato, aplica em tudo — é a amarração da Fase 2).
- **Bloco B — extrato agrupado por DIA** (saldo do dia, seções Entradas/Saídas).
- **Bloco C — topo visual:** chips de banco c/ saldo, navegador de mês, KPIs (Entradas/Saídas/
  Saldo/Transações), 3 calendários (Dias com extrato / Entradas conciliadas / Saídas conciliadas).
> Recomendei ordem A→B→C. Roberto: "faça do jeito que achar melhor" → seguindo A→B→C.

**✅ BLOCO A FEITO (3 ações por linha)** — local (D:), não commitado:
- Migration `1785400200000-CreateConciliacaoMovimento` (tabela `conciliacao_movimento`:
  tipo 'unica'/'transferencia', plano_conta_id, transfer_id; UNIQUE cod_loja+mov_key).
- Entity `ConciliacaoMovimento`. Service: getMovimentos, salvarMovimentoUnica,
  salvarMovimentoTransferencia (cria BankTransfer), removerMovimento. `mov_key` =
  `data|valor|texto|tipoOperacao` (movKeyOf). getDadosManual agora resolve `classificacao`
  (movimento vence amarração por texto). getDemonstrativoManual pula transferência (fora do DRE).
- Rotas: POST /movimento/unica, POST /movimento/transferencia, DELETE /movimento.
- `ConciliacaoBancaria.jsx`: componente `ManualRow` com 3 botões (✓ Única / ⇄ Transf. / ⚡ Auto),
  chip por origem, ✕ limpar. Transferência reusa o `TransferModal` existente. Contas do seletor
  filtradas por linha (saída→despesa, entrada→receita). Testado: migration + rotas 401 + vite ok.

⏭️ **Falta:** Roberto testar Bloco A. Depois Bloco B (extrato por dia) e C (topo visual).
Ainda falta também a **composição da fatura de cartão** (vários lançamentos num movimento) que
o Roberto pediu antes — não incluída no Bloco A (que faz 1 movimento → 1 conta). Reavaliar.

> 🐛 **Achado importante:** o menu do Sidebar é **hardcoded dentro de `Sidebar.jsx`**
> (~L678, array `subItems`), NÃO vem do `menuConstants.js`. Pra adicionar item de menu,
> editar o Sidebar.jsx + os 2 mapas de path→seção (~L179 e ~L268).

> ⚠️ **Ambiente local (D:) usa o BANCO DE PRODUÇÃO** (DB_HOST=46.202.150.64). A tabela e o
> plano importado JÁ ficam gravados em prod. Ao subir o código, migration é no-op (IF NOT EXISTS).
> Backend local roda via **ts-node direto** (não nodemon — que entrava em loop). Front: vite 3004.
> Nada commitado ainda — quando Roberto validar as 3 fases, commit + push TESTE + deploy.

---


## Sessão 2026-07-15

### 1. Chatbot WhatsApp — ✅ ENTREGUE E DEPLOYADO (falta teste real)
3 commits na TESTE (`8418a2d`, `1c43c02`, `3588069`), **deployados no Tradição**, backend healthy.

- **Editor de Menu em tela cheia** (aba ✏️ Menu): cada opção é uma sequência de passos
  (responder / esperar palavra / atendente / encerrar), com prévia do WhatsApp. Grava no
  mesmo grafo do canvas, sem arrastar caixinha.
- **Schema consertado**: a `CreateMktChatbotTables1784723000000` tinha sido **editada depois
  de rodar** → banco com árvore (`nos`), código esperando grafo (`blocos`+`conexoes`) → crash.
  Migration nova converteu preservando os dados. Ver [[bugs-resolvidos/2026-07-15-tunel-dvr-chave-nao-autorizada-matava-oracle|nota do dia]] e o commit.
- **Webhook**: a Evolution já mandava as mensagens; o `handleWebhook` do disparo as
  descartava. Agora despacha por evento (`messages.update`→disparo, `messages.upsert`→chatbot).
  **Não precisou de instância nova.**
- **Cooldown do menu** (`intervalo_menu_horas`): antes o bot reenviava o menu a cada mensagem
  que não casasse com opção. Default 0 (comportamento antigo).
- **Matching tolerante**: "um"→1, "ja salvei"→salvei, "salvie"→salvei (Damerau). **Número
  nunca aproxima** (1 e 2 têm distância 1).

⏭️ **PRÓXIMO:** Roberto configurar as 4h de cooldown e mandar msg pro **5512988996258**.
⚠️ Com `intervalo_menu_horas = 0`, os 6 mil contatos que responderem "oi" levam menu em looping.
❓ **Não verificado:** se o webhook está registrado na Evolution pro Tradição. Se o bot ficar
mudo, é `setup-webhook`, não código.

### 2. DVR Tradição — ✅ RESOLVIDO E VALIDADO (15/07)
**Vídeo voltou.** ffprobe: `hevc 2880x1616`; ffmpeg gravou 3s → MP4 de 4.5MB pelo túnel.

**Duas causas empilhadas:**
1. **CGNAT da Vivo** — a config estava no IP público `187.90.96.96` + 8123/5554 (porta
   direta no roteador). Esse IP é `user.vivozap.com.br`, NAT **compartilhado** da Vivo:
   de fora não responde **nada** (nem ping, nem Winbox 8291). Porta direta é **impossível**
   nesse link, por mais certo que esteja o Mikrotik.
2. **INPUT DROP** barrava o container de alcançar o túnel (que estava vivo o tempo todo,
   DVR respondendo HTTP 200 em 25ms do host).

**Aplicado (SEM tocar em código — só infra + banco do Tradição):**
- 2 regras iptables estreitas: `-i br-019ae38a96f7 -s 172.20.0.2/32 --dport 28100/28101`,
  persistidas com `netfilter-persistent save`. **Mais estreitas que a regra do Oracle**
  (que usa `172.20.0.0/16` inteiro) → risco a outros clientes = zero.
- `UPDATE dvr_devices SET ip='10.6.1.123', porta_http=28100, porta_rtsp=28101 WHERE id=1`

> 🔎 **Preocupação do Roberto resolvida com dado:** cada cliente tem **/16 exclusivo**
> (tradicao 172.20, maxvale 172.18, supervital 172.23, nunes 172.24). Nada compartilhado.

📌 **Falta Roberto confirmar** (10s, opcional): Winbox → IP → Addresses → WAN.
Se `100.64.x.x`–`100.127.x.x`, CGNAT confirmado e a porta direta fica descartada de vez.

🌟 **Ganho colateral grande:** o manager matava **TODOS** os túneis (inclusive o do **Oracle**)
a cada 60s há 2 meses, tentando ressuscitar o túnel do DVR com chave inválida. **Parou.**
Túnel do Oracle passou de "morre a cada 60s" pra 8+ min contínuos.
> 🔍 **Observar:** se o `NJS-064` some. Forte suspeita de ser a causa-raiz dele.

### 2c. Vision — 4 clipes prontos + botão Busca Preço ✅ COMMIT `75d6788` (deploy 16/07)

**4 dos 5 eventos FINALIZADORA do dia 15/07 gerados e `ready`** (Play verde):
`1|1|624257|...09:36` · `1|1|624484|...16:02` · `1|4|275239|...16:02` · `1|4|275424|...19:48`.
O de 13:52 falhou (0 bytes). **3 dos 4 saíram com ~5MB em ~35s pedindo 130s de vídeo** →
forte indício de **buracos na gravação do DVR** (checar HD cheio / gravação por movimento).

**Botão "🔎 Busca Preço"** no Vision — **backend já suportava** (`['BUSCA','BUSCA PRECO',
'CONSULTA','CONSULTA PRECO']` → `keyword='busca_preco'`), só faltava o atalho na tela.

> 📌 **Busca Preço mostra o ITEM CONSULTADO, nunca a venda.** A query filtra
> `AND NUM_CUPOM_FISCAL = 0` — consulta de preço não gera cupom. Logo a "notinha" vem
> **vazia** nesses eventos (não é bug). **⚠️ `operador: ''` está hardcoded** no branch
> `busca_preco` (dvr-cftv.service.ts ~L1026) — a coluna Operador vem vazia, mesmo a
> `TAB_PRODUTO_PDV` tendo `COD_VENDEDOR`. Some quem consultou o preço → atrapalha o uso
> de prevenção ("consulta preço e depois furta"). Corrigir = 1 JOIN. **Roberto ciente.**

### 2b. DVR Vision — clipe morria a 7s do fim ✅ CORRIGIDO NO CÓDIGO (`75d6788`)

**Causa medida (não é lentidão aleatória — é corrida perdida por 7s):**
| | |
|---|---|
| Velocidade real do transcode | **0.675x** (4 CPUs, H.265 `2880x1616` @ 12.7Mbit/s) |
| Clipe de 126s leva | **187s** |
| Timeout backend + frontend | **180s** nos dois |

ffmpeg levava `SIGKILL` a 7s de terminar → spinner infinito. **Bipagens funcionava** porque
usa clipe mais curto — mesma lógica, duração menor. `scale=704:480` **já existia**; o gargalo
é *decodificar* 5MP H.265, não encodar. Substream do DVR (`subtype=1`) → **404, não existe**.

**⚠️ Estado atual: patch aplicado DIRETO NOS CONTAINERS (a pedido do Roberto, sem push).**
Some se o container for recriado / no próximo deploy:
```bash
# backend  — /app/dist/services/dvr-cftv.service.js   (backup: .bak)
sed -i 's/}, 180000);/}, 600000);/'
# frontend — /usr/share/nginx/html/assets/index-OzMpr_iY-*.js   (backup: .bak)
sed -i 's/timeout:18e4/timeout:6e5/'
docker restart prevencao-tradicao-backend
```
> 🔴 **Bundle mantém o mesmo nome → navegador serve cache. Exige `Ctrl+Shift+R`.**

**Correção de verdade: PRONTA no working tree, NÃO commitada** (3 arquivos, 13 linhas,
`tsc --noEmit` limpo). Troca timeout fixo por `Math.max(300000, duracao*3000)` nos 3 pontos
+ aviso da tela ("alguns segundos" → "2 a 3 minutos"):
- `backend/src/services/dvr-cftv.service.ts` (~L1900)
- `frontend/src/pages/VisionPalavraChave2.jsx` (~L177 e ~L459)
- `frontend/src/services/dvr-cftv.service.js` (~L23)

⏭️ **PRÓXIMO:** Roberto validar → commit + push TESTE → deploy normal (o deploy **apaga** o patch,
então tem que ir junto).

> 💡 **Alavanca sem código:** reduzir "Tempo DEPOIS" de 120s → ~40s deixa o clipe em ~50s
> (~74s de espera). Bem melhor de UX, se 2min de vídeo pós-evento não for necessário.

### 3. ⏭️ PRÓXIMA SESSÃO — DVR: o que ficou na mesa (prioridade)

1. **Vídeo em 9s em vez de 134s** — trocar `generate-clip` por `live-stream` no Vision.
   **Backend 100% pronto**, é mudança de front. 🔴 **BLOQUEADO até ter teto de ffmpeg
   simultâneos** — sem isso repete o incidente de VPS travada (ver [[modulos/dvr-cameras]]).
2. **Botão "Busca Preço" está MENTINDO** (no ar desde `75d6788`). Traz baixa de associado,
   não consulta de preço. **Decidir: remover ou renomear.** Ver
   [[modulos/vision-palavra-chave]].
3. **Onde mora a consulta de preço?** Oracle **não tem** (provado). API RPC2 do DVR **não
   entrega** (filtro de texto ignorado — provado com texto impossível). Restam:
   (a) **perguntar pra Intersolid** ← mais barato; (b) `TAB_CUPOM_PDV` (1,4M linhas, não
   aberta); (c) **porta 37777** SDK nativo Dahua (é por onde o software deles pega o texto).
   > 🔍 Roberto viu **52** transações no DVR (14/07) — a API traz 4902. **Falta saber o que
   > ele digitou/selecionou pra chegar nos 52.** Cruzei 12 desses horários: a maioria cai em
   > cima de **venda real**, então não são "eventos sem venda".
4. **235 eventos "bala" (11–15/07) em verde** — precisa `PRODUTO` no `TIPOS_PRE` (1 linha +
   deploy) + **~8h de ffmpeg**. Rodar **de madrugada com `nice`, 1 por vez** (VPS = 4 núcleos,
   12 clientes). ⏳ **Dia 11 antes das 18:00 já não tem vídeo** e some mais 1 dia por dia.
5. **1788 clipes `failed`** travados pra sempre (`if (clip_status === 'failed') continue`).
   Reset só faz sentido nas últimas 48h.

> ⚠️ **Limite de 1024 no `POS.doFind`** (o DVR ignora `offset`) — qualquer análise que
> compare "está na API?" precisa fatiar em janelas menores, senão dá falso negativo.

### 🚩 Descobertas não resolvidas
1. **`CreateUserPreferencesTable1785000000000` está aplicada no banco do Tradição mas NÃO
   existe em nenhuma branch deste repo.** A produção rodou código que não está aqui.
2. **Bug latente no `tunnel-manager.ps1`:** "um túnel caiu → mata todos". Qualquer cliente com
   túnel morto no `tunnels.json` tem os outros reiniciando de minuto em minuto.
3. **`vite build` quebrado localmente** (`react-color` → `@icons/material/...`). Já falhava
   antes desta sessão; na VPS builda normal.
4. **Autofill do Chrome** preenche "URL da API" com `Roberto` na tela de Disparo WhatsApp.
   Salvar assim quebra o disparo. Falta `autoComplete="off"`.
5. **`listarFluxos`** ainda sem try/catch (mesmo padrão que derrubava o backend).
6. **Dica desatualizada** na tela de DVR: *"Sem tunel SSH"* — o código trata túnel sim
   (IP privado + porta >10000 → `172.20.0.1`).

## 📋 Pendências de sessões anteriores
1. **Deploy Oracle NJS-064** (`e1a609a`) — só Tradição levou. SuperVital/MaxValle pendentes
2. **MaxValle** — não levou deploy do sells-sync; conferir `minio_endpoint` antes
3. **Custo real Nunes** — fórmula documentada, falta aplicar em `gestao-inteligente.service.ts`
4. **49 bipagens Tradicao "ready"** sem arquivo — aguardando OK pro UPDATE
5. **Cliente Fratelli** — esperando portas abrirem
6. **Fornecedor Pedido Público** — pronto, falta validar fluxo e deploy
