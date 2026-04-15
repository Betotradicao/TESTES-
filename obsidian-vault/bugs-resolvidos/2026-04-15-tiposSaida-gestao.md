# Bug: NF Transferência contaminando Gestão Inteligente

**Data:** 2026-04-15
**Cliente afetado:** [[../clientes/supervital|SuperVital]] (também aplicado em [[../clientes/tradicao|Tradição]])
**Módulo:** [[../modulos/gestao-inteligente|Gestão Inteligente]]

## 🐛 Sintoma
Usuário desmarcava "NF Transferência" e clicava Buscar. O card "Vendas" mostrava o valor **correto** por um instante, depois **pulava** para um valor maior (incluindo transferências).

## 🔍 Causa Raiz
- `fetchIndicadores` **respeitava** o filtro `tiposSaida` (OK)
- `fetchVendasAnaliticas` **NÃO passava** `tiposSaida` (backend retornava tudo)
- Um `useEffect` recalculava `indicadores` a partir de `vendasAnaliticas` quando havia seções inativas → **sobrescrevia** o valor correto

## ✅ Fix Aplicado

### Frontend (`packages/frontend/src/pages/GestaoInteligente.jsx`)
Adicionado `tiposSaida: buildTiposSaida()` nos params do fetchVendasAnaliticas.

### Backend Controller (`packages/backend/src/controllers/gestao-inteligente.controller.ts`)
Aceitar `tiposSaida` no query do endpoint `/vendas-analiticas-setor`.

### Backend Service (`packages/backend/src/services/gestao-inteligente.service.ts`)
- `buscarVendasPorSetorPeriodo` passou a aceitar `tiposSaida`
- Query Oracle ganhou cláusula `AND pv.${colTipoSaida} IN (...)`
- `getVendasAnaliticasPorSetor` repassa `filters.tiposSaida` para os 4 períodos

## 📝 Lições
- Sempre que múltiplas chamadas vierem do mesmo botão "Buscar", **todas** devem respeitar os mesmos filtros
- useEffect que recalcula dados derivados precisa respeitar os filtros originais

## 🏷️ Tags
#bug-resolvido #gestao-inteligente #tipos-saida #2026-04
