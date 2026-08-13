---
tags:
  - bug-resolvido
  - etiquetas
  - rupturas
  - frontend
  - tradicao
data: 2026-08-13
cliente: Tradição
---

# 🌟 Auditoria não fechava: o contador olhava a SESSÃO, não o banco

Mesmo bug em **Etiquetas** e **Rupturas** — as duas telas de verificação são gêmeas.

## 🔴 Sintoma
Roberto verificou os 24 itens, o topo mostrava **24/24**, mas a tela insistia que **faltava 1**
e o botão **ENVIAR AUDITORIA não aparecia**. Auditoria travada em `em_andamento` pra sempre.

## 🎯 Causa-raiz
```jsx
{produtosSelecionados.length === items.length && ... && ( <botão ENVIAR/> )}
```
- `items` = **todos** os itens vindos do banco (`GET /label-audits/:id`)
- `produtosSelecionados` = só o que foi marcado **nesta sessão do navegador**
  (state + `localStorage`)

> 🔑 **O banco tinha tudo verificado; a tela contava outra coisa.** Bastava um F5, trocar de
> aparelho, ou fazer a auditoria em duas etapas pra que `produtosSelecionados` nunca
> alcançasse `items.length` — e o botão não aparecia mais. **A auditoria ficava presa.**

**Prova no banco (auditoria 83, Tradição):**
```
preco_correto ..... 18
preco_divergente ... 6      => 24 de 24, ZERO pendentes
status ............. em_andamento   <- presa
```
A de 12/08 (id 82, 94 itens) estava presa do mesmo jeito.

```sql
-- diagnóstico rápido: auditoria "presa" = em_andamento sem nenhum pendente
SELECT a.id, a.titulo, a.status, i.status_verificacao, count(*)
  FROM label_audits a JOIN label_audit_items i ON i.audit_id = a.id
 GROUP BY 1,2,3,4 ORDER BY a.id DESC;
```

## ✅ Correção (`EtiquetaVerificacao.jsx` + `RupturaVerificacao.jsx`)
O **banco é a fonte de verdade**; a sessão só complementa (item recém-marcado que ainda não
recarregou):
```js
const idsDaSessao = new Set(produtosSelecionados.map(p => p.id));
const itensPendentes = items.filter(
  it => it.status_verificacao === 'pendente' && !idsDaSessao.has(it.id)
);
const verificados = items.length - itensPendentes.length;
```
- Botão aparece quando `itensPendentes.length === 0` (não mais por igualdade de contagem).
- `handleFinalizeSurvey` também barrava com `produtosSelecionados.length === 0` — agora
  conta o verificado real. **Os itens já são salvos em tempo real; o botão só dispara o
  PDF/WhatsApp**, então destravar aqui é seguro.
- Contador e barra de progresso passam a usar `verificados`.

## 🆕 Pendentes viraram lista clicável (pedido do Roberto)
O aviso amarelo virou botão: abre a lista dos itens que faltam (descrição, código, seção) e
**clicar num item leva direto pra ele** (`setCurrentIndex` + scroll pro topo). Antes só dizia
"faltam N" sem dizer quais — não dava pra achar o item perdido no meio de centenas.

## 🧹 De quebra
`RupturaVerificacao.jsx` tinha um **bloco de DEBUG visível em produção**
(`🔍 DEBUG - Produtos Selecionados: N` + IDs internos). Removido, virou a lista de pendentes.

## 🔎 Padrão pra procurar no resto do projeto
Contador de progresso alimentado por state de sessão em vez do status persistido.
Sintoma típico: **funciona numa tacada só, quebra depois de F5**.

## 🔗 Relacionados
- [[../modulos/etiquetas|Etiquetas]] · [[../modulos/rupturas|Rupturas]]
- [[2026-08-05-conciliacao-rate-limit-engoliu-classificacoes|Conciliação: a tela mentia sobre o que foi gravado]]
