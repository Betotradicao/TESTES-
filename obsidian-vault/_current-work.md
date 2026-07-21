# 🚧 Trabalho em Andamento

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

⏭️ Roberto testar a tela. Decisões ainda em aberto:
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
