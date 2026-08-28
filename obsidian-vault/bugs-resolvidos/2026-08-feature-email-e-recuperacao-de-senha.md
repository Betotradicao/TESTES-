---
tags: [radar360, email, seguranca, autenticacao]
data: 2026-08-28
---

# E-mail do RADAR 360 e recuperação de senha

Feature nova no **RADAR 360** (`D:\radar360`, branch `RADAR360`). Duas partes que
só fazem sentido juntas: a tela que configura a conta de envio e o "Esqueci minha
senha" que usa essa conta.

---

## 🔑 Gmail: senha de APP, nunca a senha da conta

**A causa nº 1 de "configurei e não manda e-mail".** O Gmail recusa a senha
normal desde 2022, e a mensagem de erro que ele devolve é:

```
Username and Password not accepted
```

…que manda conferir **justamente o que está certo**. Quem configura vai procurar
o defeito no usuário e na senha, e o problema é o **tipo** de senha.

- Criar em **myaccount.google.com/apppasswords**
- Exige **verificação em duas etapas ligada** na conta
- 16 caracteres; revogar não mexe no resto da conta

⚠️ **O Google entrega a senha com espaços** (`abcd efgh ijkl mnop`). Colada com
espaço, o Gmail recusa **com o mesmo erro enganoso**. Por isso `EmailService`
faz `senha.replace(/\s+/g, '')` antes de autenticar — sem isso, o suporte
perderia horas num problema de formatação.

Por esse conjunto de armadilhas o aviso ocupa espaço na **tela**, não na
documentação: quem erra isso não vai ler doc, vai olhar a tela.

---

## ✅ "Testar conexão" envia e-mail de verdade

Tentação natural: usar `transporter.verify()`, que só autentica. **Não serve.**
O Gmail aceita o login e mesmo assim **bloqueia o envio** em conta nova ou com
verificação pendente — o teste diria "OK" e nenhum e-mail sairia.

Quem clicou em testar precisa **ver a mensagem chegando na caixa dele**. É a
única prova que vale.

---

## 🛡️ Recuperação de senha — as três decisões que não são óbvias

Rota `POST /api/auth/recuperar-senha`, em `backend/src/routes/auth.routes.ts`.

### 1. Pede usuário **E** e-mail, os dois conferindo

Só o usuário bastaria para a pessoa recuperar o acesso — e bastaria também para
**qualquer um trancar um colega fora do sistema no meio do expediente**, sem
invadir nada: pede a recuperação do login dele, a senha antiga morre na hora e a
nova vai para uma caixa que quem pediu não abre.

Quem de fato esqueceu a senha sabe os dois dados. Quem quer sabotar, geralmente
não sabe o e-mail cadastrado.

### 2. A resposta é SEMPRE a mesma — inclusive quando falha

> "Se o usuário e o e-mail conferem, a senha nova já foi enviada."

"Usuário não encontrado" ou "esse não é o e-mail cadastrado" entrega **de graça**
quem tem conta no sistema e qual o e-mail de cada um. Vale também para o erro de
envio: "e-mail não configurado" contaria a quem tenta que o usuário existe.

O motivo real vai para o **log do servidor** (`[RECUPERAR] ...`).

### 3. Envia primeiro, grava depois

⚠️ **A ordem importa.** Gravando a senha nova antes de enviar, um erro no SMTP
deixaria a pessoa com a **senha velha já morta e a nova em lugar nenhum** — sem
acesso e sem poder tentar de novo, porque o limite de 5/hora já teria contado a
tentativa.

### Bônus: o limite conta as tentativas que DÃO CERTO

Ao contrário do login. No login só as erradas contam (`skipSuccessfulRequests`),
senão quem acerta a senha se auto-bloqueia. Na recuperação é o **oposto**: a
chamada bem-sucedida é justamente a que troca a senha de alguém. Sem contar as
certas, um robô trocaria a senha do sistema inteiro.

---

## 📋 Onde ficam as coisas

| O quê | Onde |
|---|---|
| Serviço | `backend/src/services/email.service.ts` |
| Rotas de config | `GET /api/configuracoes/email`, `POST /api/configuracoes/email/testar` |
| Rota de recuperação | `POST /api/auth/recuperar-senha` |
| Tela | `frontend/src/pages/ConfigEmail.jsx` → Implantação › EMAIL RADAR 360 |
| Login | `frontend/src/pages/Entrar.jsx` — "Esqueci minha senha" |

**Chaves de configuração:** `email_remetente`, `email_senha_app`,
`email_assunto_recuperacao`, `email_texto_recuperacao`,
`email_assunto_boasvindas`, `email_texto_boasvindas`.

`email_senha_app` casa com `/senha/i` em `ConfiguracaoService` e entra **cifrada
automaticamente** — não precisou de lista nova.

⚠️ A senha **nunca volta para a tela**, nem mascarada. Devolvendo `••••••••` a
tela reenviaria os pontinhos como se fossem a senha e **apagaria a de verdade no
primeiro "Salvar"**. A tela recebe só `tem_senha: true`.

---

## ✏️ Textos editáveis, padrão no código

Assunto e mensagem dos dois e-mails são editáveis na tela, com marcações
`{nome}` `{usuario}` `{senha}` `{endereco}`.

Os **padrões ficam no código**, não no banco: cliente novo precisa de e-mail que
já funcione no primeiro dia, sem ninguém escrever nada. O que estiver salvo
sempre ganha do padrão, e há um botão "Voltar ao texto padrão".

---

## ⚠️ Pendências

- O **e-mail de boas-vindas** existe (template + envio), mas **ainda não dispara
  em lugar nenhum**. Roberto: *"depois vemos em que momento que ele ira
  disparar"*. Provável gancho: criação de usuário em `usuarios.routes.ts`.
- Usuário **sem e-mail cadastrado não recupera senha** — só o master redefine. O
  campo no cadastro ganhou aviso explicando isso.

---

## 🔗 Relacionado

- [[padroes/estilo-criacao]]
- [[_current-work]]
