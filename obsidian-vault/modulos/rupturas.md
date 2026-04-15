# Rupturas

Controla produtos em ruptura (falta de estoque), verificações de gôndola e auditorias.

## 📂 Arquivos
- `RupturaResultados.jsx` — listagem de rupturas identificadas
- `RupturaLancadorItens.jsx` — lançar itens em ruptura manualmente
- `RupturaVerificacao.jsx` — verificação no dia
- `RupturaResultadosAuditorias.jsx` — resultados por auditoria
- `RupturaIndustria.jsx` — ruptura na indústria/fornecedor

## 🔗 Tabelas ERP
- TAB_PRODUTO, TAB_RUPTURA, TAB_FORNECEDOR

## 🎯 Fluxo
1. Operador faz "verificação" passando pelas gôndolas
2. Sistema registra itens em ruptura
3. Gera auditoria e aponta responsáveis
4. Módulo **Ruptura Indústria** rastreia culpa do fornecedor

## 🏷️ Tags
#modulo #prevencao #rupturas
