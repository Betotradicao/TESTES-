---
tags: [bug, radar360, dependencias, leitor]
data: 2026-08-26
projeto: RADAR 360
---

# archiver 8 é ESM puro — instalador do leitor dava HTTP 500

## Sintoma

Tela **Instalador do Leitor** do RADAR 360: clicar em "Baixar instalador (.zip)"
devolvia `Falha ao gerar o pacote (HTTP 500)`. Nada no corpo dizia o motivo.

## Causa-raiz

`package.json` trazia `archiver: ^8.0.0`. **O 8.0 é ESM puro.** Sob CommonJS,
tanto `require('archiver')` quanto o import com interop devolvem o **namespace do
módulo** — um objeto — em vez da função.

```js
const archiver = require('archiver');
typeof archiver           // 'object'  ← não 'function'
archiver('zip', { ... })  // TypeError: archiver is not a function
```

O erro estourava **dentro do `try/catch`** do controller, que respondia
`res.status(500)`. Por isso o sintoma chegou como 500 genérico e não como crash.

Pior: havia um comentário no código afirmando o contrário — que o `require` era
usado justamente para evitar o problema. A tentativa de correção estava invertida.

## Correção

Fixar no **7.x**, que é a versão que o sistema do Tradição roda em produção há
meses, e voltar ao `import archiver from 'archiver'`.

```json
"archiver": "^7.0.1",
"@types/archiver": "^7.0.0"
```

## Lição

**Subir para uma major ESM-only num backend CommonJS não é "atualizar versão"** —
exige converter o projeto inteiro para ESM. E o sintoma não denuncia a causa: a
falha vira `is not a function` dentro de um `catch`, e o usuário vê só um 500.

Quando um pacote novo falha de forma estranha, comparar a versão com a do sistema
que já funciona resolve mais rápido que ler o stack.

Relacionado: [[modulos/leitor-codigo-barras]]
