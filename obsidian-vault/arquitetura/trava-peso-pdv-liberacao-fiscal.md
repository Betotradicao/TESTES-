# Trava de peso no PDV e a liberação da fiscal

**Pesquisado em:** 22/08/2026 · Oracle Intersolid do [[../clientes/tradicao|Tradição]]

## ❓ A pergunta
Roberto: *"dá pra identificar todas as vezes que a fiscal liberou com senha uma
repesagem?"*

Regra do caixa: etiqueta do açougue com trava de peso → ao bipar, o caixa exige que
a balança confirme aquele peso. Se divergir, trava e pede senha da fiscal.

## ✅ O que EXISTE no Oracle
**`TAB_PRODUTO_LOJA.FLG_CONFERE_PESO_PDV`** — é a trava, por produto e por loja.
No Tradição loja 1: **190 produtos com `'S'`** contra 12.539 com `'N'`.

| Seção | Produtos com trava |
|---|---|
| AÇOUGUE | 186 |
| CONGELADOS | 3 |
| PADARIA | 1 |

Mesma coluna aparece em `TAB_PRODUTO_CARGA_SYNC` (carga pro PDV) e `TAB_SGS_LOJA`.

## ❌ O que NÃO existe: o registro da liberação
A retaguarda **não guarda** o evento. Verificado:

| Onde procurei | Resultado |
|---|---|
| `TAB_PRODUTO_PDV` (item vendido) | 128 colunas, **nenhuma** de supervisor/autorização |
| Tabelas `PDV_*` (lado da frente) | todas com **0 linhas** nesta instalação |
| `COD_SUPERVISOR` em `TAB_CUPOM_FINALIZADORA` | 36.917 linhas em 30 dias, **1 valor distinto** → constante, não registra nada |
| `TAB_OCORRENCIA_ONLINE` (225 mil linhas) | log técnico de integração (NFCe, leitura duplicada). Zero sobre peso |
| Colunas `%PESAGEM% %REPES% %LIBERA% %AUTORIZ% %SUPERV%` | nada ligado ao evento do caixa |

**Conclusão:** a liberação acontece dentro do software de frente de caixa e o log
fica na máquina do PDV — não sobe pra retaguarda.

## 💡 Caminho para detectar por conta própria (NÃO implementado)
O Radar tem o que o ERP não tem: **o peso da ETIQUETA**, em `bips.bip_weight`,
e desde 20/08 a bipagem casada com a venda.

Repesagem = peso vendido diferente do peso da etiqueta, num dos 190 produtos com
trava. Cruzar `bip_weight` × `QTD_TOTAL_PRODUTO` acha o evento sem depender da
Intersolid.

> ⚠️ **Hipótese a testar antes de construir:** se o peso muda, o VALOR muda, e a
> bipagem não casa dentro da tolerância de R$ 0,03 — ou seja, essas liberações
> podem já estar aparecendo hoje como **"Pendente"**, parecendo item que saiu sem
> passar no caixa. Ver [[../bugs-resolvidos/2026-08-20-bipagem-com-desconto-nunca-casava]]
> (mesmo padrão: divergência de valor virando falso alarme).
> Só cobre item que passou pelos scanners do Radar.

Alternativa: perguntar à Intersolid se a frente grava esse log e se dá pra subir.

## 🏷️ Tags
#arquitetura #oracle #intersolid #acougue #prevencao
