# Feature: Venda Dia a Dia — drill-down completo

**Data:** 2026-03
**Módulo:** [[../modulos/gestao-inteligente|Gestão Inteligente]]

## 🎯 O que foi entregue
Tela "Venda Dia a Dia" evoluiu de simples listagem pra ferramenta analítica completa:
- **Drill-down:** setor → grupo → subgrupo → item
- **Checkbox inativar seções** (afeta totalizadores)
- **Fragment do React** para permitir aninhamento
- **Cores por dia da semana**
- **Radio:** Dia Corrente / Semana
- **Métricas adicionais**

## 📝 Commits chave
- `334b8b6` — cores por dia da semana + radio Dia Corrente/Semana
- `727a615` — drill-down (setor→grupo→subgrupo→item) + cores
- `4af4453` — refactor drill-down com Fragment + checkbox inativar seções
- `8526a37` — métricas, Receita Bancos expandível, fixes

## ⚠️ Lições
- `React.Fragment` necessário quando precisa de múltiplas `<tr>` na mesma posição do DOM
- Para drill-down hierárquico, cada nível deve ter `Promise.all` com versão "anual" para comparativo (ver bug [[2026-04-15-dif-anual-itens]])

## 🏷️ Tags
#feature #gestao-inteligente #drill-down #venda-dia-dia #2026-03
