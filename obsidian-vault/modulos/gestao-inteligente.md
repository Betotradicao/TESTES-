# Gestão Inteligente

Tela principal de análise de indicadores do negócio.

## 📂 Arquivos
- **Frontend:** `packages/frontend/src/pages/GestaoInteligente.jsx`
- **Backend Controller:** `packages/backend/src/controllers/gestao-inteligente.controller.ts`
- **Backend Service:** `packages/backend/src/services/gestao-inteligente.service.ts`

## 🎯 O que faz
Dashboard com cards de:
- Vendas, Lucro, Custo, Markdown, Margem Limpa
- Comparativos: Atual vs Mês Passado vs Ano Passado vs Média Linear
- Análises drill-down por seção/grupo/subgrupo
- Modo ATAQUE (vendas) e DEFESA (perdas, furtos, rupturas)

## 🎛️ Filtros
- Período (dataInicio/dataFim)
- Loja (se multi-loja)
- **Tipos de Venda:** PDV, Combustível, Vda Balcão, e-Commerce, NF Cliente, **NF Transferência**

## ⚠️ Cuidados Conhecidos
- Ao mexer em filtros, garantir que **TODOS** os fetches respeitem os mesmos params (ver bug [[../bugs-resolvidos/2026-04-15-tiposSaida-gestao|NF Transferência contaminando valor]])
- Tem `useEffect` que recalcula indicadores excluindo seções inativas — cuidado ao alterar a lógica

## 🔗 Tabelas Oracle usadas
- TAB_PRODUTO_PDV (vendas)
- TAB_PRODUTO, TAB_SECAO (produtos/seções)
- TAB_CUPOM_FINALIZADORA (contagem de cupons)

## 🏷️ Tags
#modulo #gestao #indicadores
