# Renovação de certificado Santander — diagnóstico e formato pro portal

**Data:** 2026-07-10 · Cliente: [[../clientes/tradicao|Tradição]] (2 contas Santander: ADM COMERCIAL 45424842000109 e LTDA 47692182000172).

Contexto: certificados A1 renovados (válidos 09/06/2026→2027). Ao subir no sistema, "Testar
Conexão" falhava. Passou por 3 erros distintos até resolver — cada um com uma lição.

## 🎭 Os 3 erros (em ordem) e o que cada um significava

### 1) `PFX incompatível e conversão falhou: ... Mac verify error: invalid password?`
**NÃO era formato/conversão.** Era **senha errada do PFX**. A mensagem engana (fala "incompatível"),
mas `Mac verify error: invalid password?` do `openssl pkcs12` = a senha não bate com o MAC do arquivo.

**Como diagnosticar senha de PFX sem chutar no sistema** — testa direto no arquivo, no container:
```bash
# manda a senha via base64 pra nenhum shell estragar caracteres especiais (#, @, %, $)
echo <BASE64_DA_SENHA> | base64 -d > /tmp/pw
openssl pkcs12 -in <cert.pfx> -info -noout -passin file:/tmp/pw -legacy
# "Mac verify error" = senha errada | lista "Certificate bag / Keybag" = senha CERTA
```
No caso: a senha tinha um typo (`...alfAEU` errado vs `...alfA` certo). Cada PFX tem senha própria
(as duas contas tinham senhas diferentes).

### 2) `Request failed with status code 403` (no token OAuth do Santander)
Senha certa → certificado carrega → mTLS conecta → **Santander recusa o token com 403**.
**403 (Forbidden), não 401** = "te identifiquei mas não tem permissão" → **o certificado novo não
estava registrado/vinculado à aplicação (Client ID) no portal do Santander.** Certificado renovado
SEMPRE precisa ser re-registrado no portal deles.

### 3) Portal do Santander exige formato `.PEM/.CER/.CRT` (não aceita `.pfx`)
O portal pede a **cadeia pública completa** (root+intermediário+folha), sem a chave privada.

## ✅ Conversão .pfx → .cer (cadeia completa, só pública) pro portal
```bash
openssl pkcs12 -in "CERT.pfx" -nokeys -legacy -passin pass:'SENHA_DO_PFX' \
  | sed -n '/-----BEGIN/,/-----END/p' > "CERT.cer"
grep -c "BEGIN CERTIFICATE" CERT.cer   # deve dar 4 (folha + 2 intermediarios + root)
```
- `-nokeys` = tira a chave privada, deixa só os certificados.
- `sed` = limpa os "Bag Attributes" (deixa PEM puro).
- ⚠️ **senha inline SEMPRE entre aspas simples** (`pass:'...'`) — as senhas têm `#`, `@`, `%`.
- ⚠️ Se o openssl for binário Windows (Git Bash), `-passin file:/tmp/x` NÃO funciona (não entende
  path mingw). Use `pass:'...'` inline.

Requisitos do Santander que o A1 ICP-Brasil já cumpre: EKU **TLS Web Client Authentication
(1.3.6.1.5.5.7.3.2)**, Key Usage Digital Signature, 2048 bits, cadeia completa. Conferir com:
`openssl x509 -in leaf -noout -ext extendedKeyUsage,keyUsage`

## 🐛 BUG LATENTE encontrado (ainda NÃO corrigido)
O código monta o comando openssl com a senha **sem aspas**:
`openssl pkcs12 ... -passin pass:${escapedPass}` (só escapa aspas duplas) em:
[santander.service.ts:155](../../packages/backend/src/services/santander.service.ts) · dda.service.ts:35 ·
bank-accounts.controller.ts:295 · banco24horas.service.ts:123.
Senha com `#` (comentário no shell), espaço, `$`, backtick → comando quebra. **Não mordeu desta vez**
porque o cert é AES-256 moderno (o path `tls.createSecureContext` do Node abre direto, sem shell).
Mas morde se vier um PFX legacy (RC2/3DES) com senha especial. **TODO:** trocar `execSync` string por
`execFileSync` (args em array, sem shell) ou `-passin` via env/file.

## 📅 25/07/2026 — a renovação de julho pegou SÓ UMA das duas contas

**Sintoma:** Conciliação no modo **Direto Manual** vinha vazia. Não era bug da tela: o
extrato do banco voltava com **0 lançamentos** porque a API do Santander devolvia **403**.

> 🔑 **Por que só o modo Manual "quebrou":** o **Direto Sistema** também levava o mesmo 403,
> mas ainda mostrava o lado do Oracle (`TAB_FLUXO: 637 registros`), então parecia funcionar.
> O **Manual depende 100% do extrato do banco** — 403 ⇒ tela vazia.
> **Tela vazia no Manual + Sistema "ok" = suspeitar do extrato, não da tela.**

**Causa medida:** o certificado da conta **SANTANDER LTDA** (`47692182000172`,
conta `000130075973`) **venceu em 23/07/2026** — 2 dias antes.

| Conta | `notAfter` | `updated_at` no banco |
|---|---|---|
| Santander ADM COMERCIAL (`45424842000109`) | **09/06/2027** ✅ | 10/07/2026 |
| **SANTANDER LTDA** (`47692182000172`) | **23/07/2026** ❌ vencido | **23/02/2026** |

A renovação documentada acima (09/06/2026→2027) **só foi aplicada na ADM COMERCIAL**.
A LTDA seguiu com o certificado anual antigo (23/07/2025→23/07/2026) até expirar sozinho.
O `updated_at` de fevereiro é a pista mais rápida: **conta que não foi atualizada junto.**

### 🔎 Como ler a validade do certificado (a senha no banco é CRIPTOGRAFADA)
`openssl` direto **não abre** — `pfx_password` está em AES-256-CBC (formato `iv:hex`,
97 chars). Chave: `process.env.CONFIG_ENCRYPTION_KEY` (`.padEnd(32,'0').slice(0,32)`),
mesmo esquema de `bank-accounts.controller.ts`. Decripta com um script Node, grava em
`/tmp/pw` e só então:
```bash
openssl pkcs12 -in /app/certificates/bank_<ID>.pfx -nokeys -legacy -passin file:/tmp/pw \
  | openssl x509 -noout -subject -dates
```
> 📌 O caminho real no container é **`/app/certificates/`** (o `certificate_path` do banco
> guarda `certificates/bank_<id>.pfx`, relativo — NÃO é `/app/uploads/certificates/`).

### ⏭️ Para voltar a funcionar
1. Pegar o A1 novo de **SUPERMERCADO TRADICAO LTDA** (pode já existir — a nota de 10/07 diz
   que **as duas** foram renovadas; só não subiram esta no sistema).
2. **Upload Certificado** no card SANTANDER LTDA (Cadastro Bancário) + senha do PFX.
3. Converter `.pfx` → `.cer` (comando acima) e **registrar no portal do Santander**,
   senão continua 403 mesmo com certificado válido.
4. **Testar Conexão** → sucesso = `[Santander] Token obtido` no log.

## 🔀 ARMADILHA: no Santander o `client_id` é o MAIOR (32), o `secret` é o MENOR (16)

É **o inverso da intuição** (quase todo provedor usa id curto + secret longo). Errei isso
em 25/07 e queimei tempo perseguindo problema no portal que não existia.

| Campo | Tamanho |
|---|---|
| `client_id` | **32 caracteres** |
| `client_secret` | **16 caracteres** |

> 🔑 **Como conferir sem depender de quem passou:** decripte as credenciais **antigas**
> (as que já funcionavam) e olhe o tamanho. O padrão da conta que funciona é a fonte de
> verdade — não a ordem em que vieram na mensagem.

> 🧪 **E o erro HTTP entrega a inversão de graça:** invertido dá `401 Invalid client
> credentials` ("não conheço esse id"); na ordem certa dá `403 Unauthorized hash`
> ("conheço o id, o certificado é que não bate"). **Se trocar a ordem muda o código de
> erro, a ordem importava.**

## 🧭 O CÓDIGO HTTP DIZ ONDE ESTÁ O ERRO (tabela de leitura rápida)

Medido nos testes de 25/07 — cada resposta aponta pra uma camada diferente:

| Resposta do Santander | O que significa | Onde mexer |
|---|---|---|
| `403 Forbidden` (sem corpo) | certificado **não registrado** na aplicação | portal → upload do `.cer` |
| `403 "Unauthorized hash"` | client_id existe, mas está casado com **OUTRO certificado** | portal → registrar o cert novo nessa aplicação |
| `401 "Invalid client credentials"` | **o client_id/secret não é reconhecido** (cert já passou!) | conferir as credenciais / aplicação |
| `200` + `access_token` | tudo certo | — |

> 🔑 **Sair de 403 para 401 é PROGRESSO**: significa que o mTLS passou e o certificado
> foi aceito. O erro andou de camada — do certificado para a credencial.

## ⚠️ ARMADILHA: copiar o `.pfx` na mão NÃO funciona (formato legacy)

Instalei o PFX novo copiando pro bind mount e o Node recusou:
**`Unsupported PKCS12 PFX data`**. O A1 da SOLUTI vem em **PKCS12 legacy (RC2/3DES)**,
que o OpenSSL 3 do Node não abre.

**O upload pela tela faz uma conversão que a cópia manual pula** —
`ensurePfxCompatible()` em [bank-accounts.controller.ts:276](../../packages/backend/src/controllers/bank-accounts.controller.ts).
Se instalar na mão, tem que converter igual:
```bash
openssl pkcs12 -in cert.pfx -out /tmp/x.pem -nodes -passin file:/tmp/pw -legacy
openssl pkcs12 -export -in /tmp/x.pem -out /tmp/x.pfx -passout file:/tmp/pw
# validar ANTES de substituir:
node -e "const f=require('fs'),t=require('tls');t.createSecureContext({pfx:f.readFileSync('/tmp/x.pfx'),passphrase:f.readFileSync('/tmp/pw','utf8')})"
```
> 💡 Use `file:/tmp/pw` e **não** `pass:` inline — é o bug latente já documentado
> (senha com `#`/`$`/espaço quebra o shell).

## 🧪 Como testar o token SEM depender da tela (script de 40 linhas)

Vale ouro pra separar "problema nosso" de "problema do banco". Roda dentro do container,
lê cert + credenciais do próprio banco, decripta e bate direto no Santander:
`https.request({ host:'trust-open.api.santander.com.br', path:'/auth/oauth/v2/token',
pfx, passphrase, ... })` com `grant_type=client_credentials`.
⚠️ O script precisa ficar **dentro de `/app`** (senão não acha `node_modules`) e as envs
são **`DB_USER`/`DB_NAME`** (não `DB_USERNAME`/`DB_DATABASE`).

> 🔬 **SEMPRE rodar o controle na outra conta.** Testar a ADM COMERCIAL (que funciona) deu
> `200 + token` e provou que o método estava certo — sem isso, um erro no script pareceria
> problema do banco.

## 📌 Estado em 25/07/2026 (LTDA ainda NÃO resolvida)

| Item | Estado |
|---|---|
| Certificado novo instalado + convertido | ✅ válido até 09/06/2027, aceito no handshake |
| Credenciais novas gravadas (cifradas) | ✅ `client_id` 16 ch, `secret` 32 ch |
| Token OAuth | ❌ **401 Invalid client credentials** |
| Conta ADM COMERCIAL (controle) | ✅ 200 + token |

Backup do que foi trocado: arquivo `*.bak-20260725-vencido` e tabela
`bank_accounts_bkp_20260725` (credenciais antigas).

⏭️ **A conferir no portal do Santander:** (a) o upload do `.cer` foi **concluído**?
(b) o Client ID/Secret saiu da **mesma aplicação** onde o cert foi registrado?
(c) a aplicação tem as **APIs Associadas / Produtos** adicionados?

## 🧪 TESTE CRUZADO: a técnica que descarta "problema nosso" de vez

Com 2 contas Santander dá pra testar as 4 combinações credencial × certificado.
Medido em 27/07/2026:

| Credencial | Certificado apresentado | Resposta |
|---|---|---|
| LTDA | LTDA (novo) | `403 Unauthorized hash` |
| LTDA | ADM | `403 Unauthorized hash` |
| **ADM** | **ADM** | ✅ **`200` + token** |
| ADM | LTDA (novo) | `403 Unauthorized hash` |
| LTDA | LTDA **vencido** | `403` **em HTML** (não JSON) |

> 🔑 **Duas leituras que só o cruzamento entrega:**
> 1. **ADM+ADM = 200 prova que o mecanismo inteiro funciona** (código, mTLS, endpoint,
>    formato do PFX). Some qualquer hipótese de bug nosso.
> 2. **Vencido dá 403 em HTML; novo dá 403 em JSON.** São camadas diferentes — o HTML é o
>    gateway barrando o TLS, o JSON é a aplicação respondendo. **Ou seja: o certificado novo
>    PASSA na validação TLS** e é recusado só na conferência de cadastro.

## 🏁 04/08/2026 — RESOLVIDO: **"Renovar" não destrava. Crie uma APLICAÇÃO NOVA.**

Depois de dias em `403 Unauthorized hash` com **tudo conferindo** (ver impasse abaixo),
Roberto **criou uma aplicação nova** no portal e registrou o certificado nela.
**Primeiro teste: `HTTP 200`, token obtido.**

> 🔑 **A LIÇÃO QUE VALE O DIA TODO:** a função **"Renovar"** da aplicação existente
> **atualiza a validade exibida no portal mas NÃO troca o certificado que o gateway da API
> valida.** A RADAR 360 passou a mostrar `Validade 09/06/2027` e mesmo assim a API continuou
> recusando com `Unauthorized hash` por **mais de 24h**. Não é propagação — **não destrava.**
>
> ✅ **Receita na renovação anual: criar aplicação NOVA, registrar o `.cer` nela e trocar
> client_id/secret no sistema.** Não perder tempo com "Renovar".

Credenciais da aplicação nova (mesmo padrão de tamanho): `client_id` **32ch**,
`client_secret` **16ch**. Backup do que havia antes: `bank_accounts_bkp_20260804`.

> ⚠️ Aplicação nova = **credenciais novas**. O certificado do nosso lado **não muda**
> (já estava correto) — só o par id/secret.

## 🚩 27/07/2026 — impasse: tudo confere e mesmo assim `403`

Estado verificado item a item (nada pendente do nosso lado):

| Item | Conferido contra | Resultado |
|---|---|---|
| Empresa no portal | CNPJ da conta | ✅ `SUPERMERCADO TRADICAO LTDA 47.692.182/0001-72` |
| Aplicação | — | ✅ RADAR 360, Produção, Ativo |
| **Validade no portal** | cert instalado | ✅ **09/06/2027** (era 23/07/2026 → renovação PEGOU) |
| Client ID no portal | banco | ✅ idêntico (`6uRPpt...3mlb`) |
| Client Secret no portal | banco | ✅ idêntico (`h0Nf...N6aw`) — **NÃO rotacionou** |
| Digital SHA-256 do cert | arquivo do Roberto | ✅ `9A:BD:B7:32...` |
| Cadeia no PFX | ADM (que funciona) | ✅ 4 certificados nos dois |

**Monitor: 8 tentativas em 22 min, 100% `403 Unauthorized hash`.**

> ⚠️ **Hipótese descartada:** achei que a renovação rotacionaria o Client Secret. **Não
> rotaciona** — Roberto copiou do portal e é o mesmo. Não perder tempo com isso de novo.

⏭️ **Sobrou: processamento assíncrono do lado do Santander.** O portal já mostra a validade
nova, mas o gateway da API continua com o hash antigo. Se não resolver sozinho em ~24h,
abrir chamado com os `trackingId` (cada tentativa gera um; ex.
`695a1bb3-9d71-49d2-a721-b4050b9bdf96`) — com ele o suporte vê qual certificado o gateway
esperava. Pergunta pro suporte: *"a aplicação mostra validade 09/06/2027 no portal, mas a
API devolve Unauthorized hash — o certificado novo foi propagado pro gateway?"*

## 🔑 Resumo pro futuro (renovação anual)
1. Nova senha do PFX (typo é comum) → testar com `openssl pkcs12 -info`.
2. Converter `.pfx` → `.cer` cadeia completa (comando acima).
3. **Registrar o `.cer` novo no portal do Santander** (senão 403).
4. Testar Conexão → `[Santander] Token obtido` no log = sucesso.

## 🏷️ Tags
#bug-resolvido #santander #certificado #pfx #openssl #financeiro #renovacao-anual
