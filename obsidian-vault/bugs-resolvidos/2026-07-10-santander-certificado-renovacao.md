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

## 🔑 Resumo pro futuro (renovação anual)
1. Nova senha do PFX (typo é comum) → testar com `openssl pkcs12 -info`.
2. Converter `.pfx` → `.cer` cadeia completa (comando acima).
3. **Registrar o `.cer` novo no portal do Santander** (senão 403).
4. Testar Conexão → `[Santander] Token obtido` no log = sucesso.

## 🏷️ Tags
#bug-resolvido #santander #certificado #pfx #openssl #financeiro #renovacao-anual
