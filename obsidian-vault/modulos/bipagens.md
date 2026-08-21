# Bipagens

Módulo principal de **Prevenção no Radar**. Monitora o que é bipado no PDV e identifica produtos que passaram sem bipagem ("não bipados").

## 📂 Arquivos
- **Frontend:** `packages/frontend/src/pages/Bipagens.jsx`
- **Relacionados:** `ResultadosDoDia.jsx`, `VisionPDV.jsx`

## 🔗 Tabelas ERP
- TAB_PRODUTO
- TAB_PRODUTO_PDV
- TAB_OPERADORES

## 🎯 O que faz
- Lista itens bipados em um período
- Detecta "não bipados" (produtos que saíram sem passar no leitor)
- Filtros por operador, PDV, data, loja

## 🔎 Filtros da tela (21/08)

Backend: `packages/backend/src/controllers/bips.controller.ts` → `getBips`.

| Param | Efeito |
|---|---|
| `tipo_venda=com_desconto` | só bipagens com `venda_desconto_cents > 0` |
| `margem_abaixo=X` | `venda_margem_pct < X` **e** `IS NOT NULL` |
| `margem_acima=X` | `venda_margem_pct > X` **e** `IS NOT NULL` |

⚠️ **Por que o `IS NOT NULL` é obrigatório:** bipagem pendente (ainda não
casada com venda) tem `venda_margem_pct` nulo. Sem a trava, "margem abaixo
de 10%" traria toda pendente do dia como se fosse margem zero — exatamente
o falso alarme que a correção de 20/08 acabou de matar.

⚠️ **`margem_abaixo` e `margem_acima` combinam (AND).** Preenchendo os dois
vira faixa "entre". Preencher `abaixo=5` + `acima=30` dá zero resultado —
é faixa vazia, não bug.

### 🕐 Margem só existe a partir de 20/08/2026
`venda_margem_pct` começou a ser gravada no deploy de
[[../bugs-resolvidos/2026-08-20-bipagem-com-desconto-nunca-casava]].
Bipagem anterior a essa data tem margem nula e **nunca** aparece no filtro
de margem — não adianta procurar histórico. (Conferido no Tradição: das
778 bipagens dos últimos 7 dias, só 83 têm margem, todas de 20-21/08.)

### ⏱️ Os campos de margem só buscam no clique
A tela tem **auto-refresh de 3s** amarrado ao objeto `filters`. Se o input
de margem escrevesse direto em `filters`, cada tecla digitada dispararia
uma busca e a tela recarregaria no meio da digitação. Por isso existe o
estado `margemDraft` — o valor só entra em `filters` no botão **Filtrar**
(ou Enter). O select **Tipo Venda** não precisa disso: muda de uma vez só.

## 🏷️ Tags
#modulo #prevencao #bipagens
