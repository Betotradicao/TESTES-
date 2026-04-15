# Prevenção Tributária

Tela de análise de classificação tributária (ICMS/PIS/COFINS) por produto.

## 📂 Arquivos
- **Frontend:** `packages/frontend/src/pages/PrevcaoTributaria.jsx`

## 🎯 O que faz
- Lista produtos com classificação fiscal
- Colunas: **Benefício Fiscal**, **Trib. Saída**, NCM completo, Fornecedor
- Filtros: UF, NCM, CodTrib

## 🔗 Tabelas Oracle
- TAB_PRODUTO (NCM, CodTrib)
- TAB_PRODUTO_LOJA (cod_forn_ult_compra → fornecedor)
- TAB_FORNECEDOR

## ⚠️ Cuidados
- Fornecedor via **TAB_PRODUTO_LOJA.cod_forn_ult_compra** (não TAB_PRODUTO)
- Usa MappingService em **TODAS** as colunas (commit `a2625bb`)

## 🏷️ Tags
#modulo #tributaria #fiscal #prevencao
