# Vision Palavra-Chave (Nunes) — Filtros CANC.* e DESCONTO corrigidos

**Data:** 2026-04-16
**Cliente afetado:** [[../clientes/nunes|Nunes]] (RP INFO PostgreSQL) — **SOMENTE**
**Módulo:** [[../modulos/vision-palavra-chave|Vision Palavra-Chave]]
**Status:** Parcialmente correto — ainda restam ajustes finais

## 🐛 Sintoma
No Vision Palavra-Chave do Nunes:
- Filtro **Canc. Item** → vinha vazio
- Filtro **Canc. Cupom** → vinha vazio
- Filtro **Canc. Venda** → vinha vazio
- **Desconto** funcionava, mas mostrava **centenas de linhas** para o mesmo cupom (1 linha por item com desconto)

## 🔍 Causa Raiz

A bifurcação PG (`searchPostgresAllPdvs` em `dvr-cftv.service.ts`) herdou os filtros copiando a lógica Oracle, mas no RP INFO as **colunas de cancelamento nunca são preenchidas**:

- `vopr_cancmotivo` / `vopc_cancmotivo` → **sempre NULL/vazia** no RP INFO
- Não existe `vopr_tiporeg` diferente de `'IT'` para marcar cancelamento
- Não existe procedure ou view pré-calculada

### Como o RP INFO marca cancelamento (descoberto olhando os dados):

| Conceito | Como está no RP INFO |
|---|---|
| **Item cancelado** (Canc. Item / Canc. Venda) | Linha em `vdonlineprod` com `vopr_valor < 0` (valor negativo) |
| **Cupom cancelado** (Canc. Cupom) | `vdonlinec.vopc_cupomref IS NOT NULL AND != ''` (cupom nova referenciando o original) |
| **Total do turno cancelado** (só agregado) | `movfpdvc.mpdc_cancelamentos` — não usado aqui (é por turno) |

## ✅ Fix Aplicado

### Backend — `packages/backend/src/services/dvr-cftv.service.ts`

**CANC. ITEM / CANC. VENDA:**
```sql
SELECT vopr_cupom, vopr_pdvs_codigo, vopr_hora, vopr_prod_codigo, vopr_valor, vopr_operador
FROM public.vdonlineprod
WHERE vopr_datamvto BETWEEN $1 AND $2
  AND vopr_tiporeg = 'IT'
  AND vopr_valor < 0
  [+ codLoja / pdvFilter]
ORDER BY vopr_hora
```
Label: `CANC. ITEM` ou `CANC. VENDA` (só muda o nome, mesma query).

**CANC. CUPOM:**
```sql
SELECT c.vopc_cupom, c.vopc_pdvs_codigo, c.vopc_datamvto, c.vopc_cupomref,
  (SELECT SUM(p.vopr_valor) FROM vdonlineprod p WHERE p.vopr_cupom=c.vopc_cupom AND ...) as valor
FROM public.vdonlinec c
WHERE c.vopc_datamvto BETWEEN $1 AND $2
  AND c.vopc_cupomref IS NOT NULL AND c.vopc_cupomref != ''
  [+ codLoja / pdvFilter]
ORDER BY c.vopc_cupom
```

**DESCONTO (agrupado por cupom):**
```sql
SELECT v.vopr_cupom, v.vopr_pdvs_codigo,
  MIN(v.vopr_hora) as hora,
  SUM(v.vopr_desconto) as valor,
  COUNT(*) as qtd_itens,
  MAX(f.func_nome) as operador
FROM public.vdonlineprod v
LEFT JOIN public.funcionarios f ON f.func_codigo::int = v.vopr_operador::int
WHERE v.vopr_datamvto BETWEEN $1 AND $2 AND v.vopr_tiporeg = 'IT'
  AND v.vopr_desconto > 0
  [+ codLoja / pdvFilter]
GROUP BY v.vopr_cupom, v.vopr_pdvs_codigo, v.vopr_datamvto
ORDER BY MIN(v.vopr_hora)
```
→ 1 linha por cupom com SOMA dos descontos + contagem de itens.

### Frontend — `packages/frontend/src/pages/VisionPalavraChave2.jsx`

Na **notinha (Cupom Fiscal)**, itens com `total < 0` ou `qtd < 0` renderizam em vermelho:
- Texto em `#C62828`
- Valor em negrito
- Linha de quantidade também em vermelho

A **tabela principal** de resultados continua com o estilo original (sem pintar nada de vermelho).

## ✅ Validação numérica (dia 14/04/2026 loja 1)
- Tela real do Nunes: **"Cancelamentos: R$ 344,18"**
- Nossa query `SUM(vopr_valor) WHERE vopr_valor < 0`: **R$ -344,18** ✅
- 27 itens cancelados no dia
- 4 cupons cancelados (vopc_cupomref preenchido)

## ⚠️ Isolamento — IMPORTANTE

**NÃO AFETA** [[../clientes/tradicao|Tradição]], [[../clientes/supervital|SuperVital]], [[../clientes/maxvalle|MaxValle]]:
- Mudanças estão dentro de `searchPostgresAllPdvs` (só roda quando ERP é PostgreSQL)
- Oracle usa `searchOracleAllPdvs` → caminho independente, não tocado

## 🚧 Ajustes ainda pendentes
- Conferir se `CANC. CUPOM` exibindo info do cupom referência (hoje mostra `ref: <cupom>` em vez de descrição)
- Ao mexer nos filtros Oracle no [[../clientes/tradicao|Tradição]], **NÃO mexer em `searchPostgresAllPdvs`** (só alterar `searchOracleAllPdvs`)

## 🧠 Lição ao trabalhar multi-ERP
- Mesmo conceito de negócio ("item cancelado") pode ter mapeamentos **radicalmente diferentes** entre ERPs
- No Intersolid: existe tabela dedicada / motivo explícito
- No RP INFO: marcação implícita via **sinal** (valor negativo) ou **referência cruzada** (cupomref)
- Sempre validar com os dados reais antes de assumir que uma query "equivalente" da versão Oracle vai funcionar no PG

## 🏷️ Tags
#bug-resolvido #vision #nunes #multi-erp #rp-info #postgres #2026-04
