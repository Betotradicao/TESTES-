---
tags: [radar360, login, autenticacao, frontend, react]
data: 2026-09-07
---

# 🔐 A senha aparecia na tela e o login ia VAZIO — autofill do Chrome x input controlado

> ⚠️ **STATUS: defeito LATENTE, achado por leitura de código — não foi o que
> derrubou o Tradição em 07/09.** A queda daquele dia era o backend sem conseguir
> abrir conexão nova
> ([[2026-08-22-backend-nao-abre-conexao-nova-watchdog-nao-ve]]). Achei isto aqui
> enquanto investigava e a correção está escrita, mas **nunca foi observada em
> produção nem testada com a senha salva do Chrome**. Vale como armadilha
> conhecida, não como bug confirmado.

O defeito é do código, não do cliente: valeria **em qualquer cliente onde o
navegador tem a senha salva**.

## O sintoma que engana

A tela abre com usuário e senha **já preenchidos** (fundo azulado do Chrome), a
pessoa clica em **Entrar** e o sistema recusa. Quem olha jura que a senha está
errada ou que "o sistema não carregou a senha" — e vai mexer no cadastro do
usuário, no banco, na senha. **Nada disso tem defeito.**

## A causa

Em `frontend/src/pages/Login.jsx` os campos são **controlados pelo React**
(`value={password}`) e traziam `autoComplete="off"` + `data-form-type="other"`.

O Chrome **ignora** esse `off` e preenche assim mesmo — mas preenchendo por conta
própria, no carregamento da página, ele **não avisa o React**. Então:

- o valor existe no **DOM** (é o que a pessoa vê),
- o `useState` continua **vazio**,
- `Entrar` manda `password: ''` e o backend responde
  `Email/username and password are required`.

### O agravante — o campo ainda podia esvaziar sozinho

`checkSetupStatus()` chama a API no mount e faz `setSetupCompleted(...)` quando a
resposta chega. Num input **controlado**, todo re-render reescreve o campo com o
valor do estado — que estava vazio. Ou seja, a resposta dessa chamada podia
**apagar a senha que o Chrome tinha acabado de preencher**, num piscar que
ninguém liga a um `GET /api/setup/status`.

## A correção escrita (3 partes, todas necessárias) — **não commitada, não deployada**

1. **`autoComplete="username"` / `autoComplete="current-password"`** no lugar do
   `off`. Brigar com o autofill não desliga o autofill — só faz ele preencher
   pelo caminho que o React não enxerga.
2. **No envio, ler o campo de verdade** (`ref.current.value`), não só o estado.
   É o que garante que **o que está na tela é o que vai pro backend**, aconteça o
   que acontecer com o estado.
3. **`sincronizarAutofill()` antes de cada `setState`** do `checkSetupStatus` —
   copia DOM → estado para que o re-render não apague o campo.

## 🎯 A lição que se repete

> Num input **controlado** do React, o que está na tela e o que vai no `submit`
> são **duas coisas diferentes** quando quem preencheu foi o navegador.

Sempre que o relato for *"aparece preenchido mas não aceita"*, o primeiro lugar a
olhar é o **payload da requisição** (aba Network), não o cadastro do usuário. Se
o campo vai vazio, é isto aqui.

⚠️ Corrigido só no `Login.jsx`. As outras telas com senha (`FirstSetup`,
`AdminSetup`, `ResetPassword`) **não** usam `autoComplete="off"` — foram
conferidas e estão livres do problema.

## 🔗 Relacionado

- [[2026-08-feature-email-e-recuperacao-de-senha]]
- [[../clientes/tradicao]]
