---
tags: [radar360, seguranca, usuarios, multi-loja]
data: 2026-08-28
---

# Cadastro por link, várias lojas por pessoa e master de fábrica

RADAR 360 (`D:\radar360`, branch `RADAR360`), commit `40e6649`. Três mudanças
que só fazem sentido juntas.

---

## 1️⃣ Ninguém mais é criado pela tela de Usuários

A tela define só o **acesso** — papel, lojas e telas — e devolve um **link**.
Nome, login, e-mail e senha são preenchidos por quem vai usar.

### Por que trocar

No jeito antigo o sistema **gerava a senha e mostrava a quem cadastrava**, que
repassava por WhatsApp. A senha nascia conhecida por duas pessoas, ficava
registrada numa conversa, e nada obrigava a trocar depois.

### ⚠️ O acesso fica no CONVITE, não no formulário

A tela pública **nem recebe** papel/lojas/telas para enviar de volta. Se
viessem do formulário — mesmo em campo escondido — bastaria trocar
`papel: "operador"` por `"master"` no navegador para se promover, e **nada no
banco diria que foi assim que aconteceu**.

**Testado em produção:** POST mandando `papel: "master", cod_lojas: null` criou
o usuário como `operador`, loja `[1]`, telas `["/bipagens"]` — o que o convite
dizia. Os campos do corpo simplesmente não são lidos.

### ⚠️ O token não fica guardado — só o SHA-256

Link de cadastro **é uma credencial**. Com o banco em mãos (backup, dump de
suporte, print de consulta) qualquer convite ainda aberto viraria um usuário. O
token existe uma vez, na resposta que gera o link, e nunca mais.

32 bytes · 7 dias de prazo · um uso só. Prazo é obrigatório, não conveniência:
link sem validade fica numa conversa de WhatsApp para sempre e vira porta de
entrada meses depois.

### ⚠️ Marca o convite DEPOIS de salvar o usuário

Na ordem inversa, um erro na criação (login repetido, banco fora) queimaria o
link sem criar ninguém — a pessoa ficaria sem cadastro **e** sem link.

### Regras de senha vêm do servidor

`backend/src/services/senha.ts` exporta `REGRAS_SENHA` com `id`, `texto` e a
**fonte da regex**. A tela pede a lista em `GET /api/convites/:token` e monta o
"vai ficando verdinho" a partir dela.

⚠️ A tela **não tem cópia própria** das regras. Duas listas iguais em dois
lugares começam iguais e terminam diferentes — e o sintoma seria a tela dizer
"tudo certo" e o cadastro ser recusado sem explicar o quê.

---

## 2️⃣ `cod_loja` (um código) → `cod_lojas` (lista)

Supervisor de rede cobre mais de uma loja. Com campo único, a única saída era
dar "todas" a ele — e "todas" inclui loja que ele não deveria ver, hoje e
**qualquer uma que entre depois**.

### ⚠️ A parte perigosa: o filtro estava repetido em 15 rotas

```ts
const loja = req.usuario!.cod_loja ?? (req.query.cod_loja ? parseInt(...) : null);
```

Com lista, essa conta muda em **todas ao mesmo tempo**. E a rota que alguém
esquecesse de mudar **não quebraria**: passaria a mostrar loja alheia, calada.

**A correção foi tirar a decisão das rotas.** `resolverLojas` roda dentro do
`autenticar` (`backend/src/middleware/auth.ts`), decide uma vez e preenche
`req.lojas` (`null` = todas; lista nunca vazia). Cada rota agora só lê
`req.lojas`. Para rota que escreve ou dispara ação, `umaLoja(req)`.

⚠️ Pedir loja proibida dá **403 explícito**, não resultado vazio: vazio se
confunde com "não tem dado" e esconderia a tentativa.

### Duas armadilhas de transição, ambas resolvidas

| Armadilha | O que aconteceria | Correção |
|---|---|---|
| **Token JWT antigo** ainda tem `cod_loja` | Quem estivesse logado na hora do deploy enxergaria **todas** as lojas até o token vencer | `autenticar` converte `cod_loja` → `[cod_loja]` na leitura |
| **Loja guardada no `sessionStorage`** que a pessoa não pode mais ver | Ela entra no `?cod_loja=` de toda chamada → **403 em tudo**, sem nada apontando o seletor como causa | O `SeletorLoja` esquece a escolha e recarrega |

### ⚠️ A migration converte antes de apagar, na mesma transação

Criando a coluna nova vazia e apagando a antiga em passos separados, qualquer
falha no meio deixaria **todo usuário preso a uma loja com `cod_lojas = null`**
— que neste sistema significa "enxerga todas". Erro de migration viraria
vazamento entre lojas, sem nada no log.

O `down` volta só a **primeira** loja: a coluna antiga não tem onde guardar as
outras. É saída de emergência, não caminho de ida e volta.

---

## 3️⃣ Master de fábrica

Cliente novo já sobe com o acesso do fornecedor gravado, sem ninguém preencher
tela de instalação. `backend/src/services/master-de-fabrica.ts`, chamado na
partida antes das tarefas.

### ⚠️ Vem do `.env`, NUNCA do código

O repositório está no GitHub. Senha escrita no fonte seria **a mesma senha em
todo cliente, para sempre**, e trocar exigiria publicar versão nova para todos
ao mesmo tempo. No `.env` — que o `.gitignore` já barra — cada instalação tem a
sua.

Variáveis: `MASTER_USUARIO`, `MASTER_SENHA`, `MASTER_NOME`, `MASTER_EMAIL`
(documentadas em `backend/.env.example`). Vazias = o sistema volta a pedir a
instalação na tela, que é o certo para instalação que não é nossa.

### ⚠️ Só semeia em banco VAZIO

Com qualquer usuário existindo, a função não faz nada. Rodar de novo depois
**ressuscitaria um acesso que o cliente pode ter desativado de propósito** — e
ninguém veria, porque o sistema sobe igual.

Senha com menos de 12 caracteres é recusada com log de erro, em vez de criar o
acesso do fornecedor com senha de teste em produção.

---

## 📋 Onde ficam as coisas

| O quê | Onde |
|---|---|
| Entidade do convite | `backend/src/entities/ConviteUsuario.ts` |
| Rotas do master | `POST/GET /api/usuarios/convites`, `DELETE /api/usuarios/convites/:id` |
| Rotas públicas | `GET/POST /api/convites/:token` |
| Regras de senha | `backend/src/services/senha.ts` |
| Filtro de lojas | `resolverLojas` / `umaLoja` em `backend/src/middleware/auth.ts` |
| Tela do master | `frontend/src/pages/Usuarios.jsx` |
| Tela pública | `frontend/src/pages/Cadastro.jsx` → `/cadastro/:token` |

---

## 🔗 Relacionado

- [[bugs-resolvidos/2026-08-feature-email-e-recuperacao-de-senha]]
- [[_current-work]]
