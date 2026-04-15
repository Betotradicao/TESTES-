# Compra x Venda

Análise comparativa entre compras e vendas, com drill-down por seção → grupo → subgrupo → item.

## 📂 Arquivos
- **Frontend:** `packages/frontend/src/pages/CompraVendaAnalise.jsx`
- **Backend:** endpoints `/api/compra-venda/*`

## 🎯 O que faz
- Mostra para cada seção: Compras, Vendas, Markdown, Margem, Qtd Compras
- Colunas de diferença: DIF (%), DIFERENÇA (R$)
- **Colunas anuais:** DIF ANUAL (%), DIF ANUAL (R$) — comparação com mesmo período ano anterior
- Drill-down hierárquico até o item individual

## 🎛️ Drill-Down (4 níveis)
1. **Seção** (inicial)
2. **Grupo** (expand seção)
3. **Subgrupo** (expand grupo)
4. **Item** (expand subgrupo)

**Padrão:** cada nível faz 2 fetches (período + anual) e mescla pelo código.

## ⚠️ Cuidados Conhecidos
- **Padrão de drill precisa ser SIMÉTRICO** (ver bug [[../bugs-resolvidos/2026-04-15-dif-anual-itens|Dif Anual em branco nos itens]])
- Seções inativas afetam totais dos cards — tem filtro salvo em `/compra-venda/secoes-inativas`

## 🔗 Endpoints principais
- `GET /api/compra-venda` — nível seção
- `GET /api/compra-venda/drill-down/grupos`
- `GET /api/compra-venda/drill-down/subgrupos`
- `GET /api/compra-venda/drill-down/itens`
- `GET /api/compra-venda/secoes-inativas`

## 🏷️ Tags
#modulo #compra-venda #drill-down
