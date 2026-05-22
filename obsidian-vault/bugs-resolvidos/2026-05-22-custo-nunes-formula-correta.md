# Custo Real Nunes (RP INFO) — Fórmula correta validada

**Data:** 2026-05-22
**Cliente afetado:** [[../clientes/nunes|Nunes]] (RP INFO PostgreSQL) — **SOMENTE**
**Módulo:** [[../modulos/gestao-inteligente|Gestão Inteligente]] (Compra x Venda, Margem)
**Status:** ✅ Validado em 99,85% (diff residual 0,15%)

## 🎯 Objetivo
Bater **exato** o custo do dia que o app oficial do RP INFO mostra. App é a "fonte da verdade" pro Roberto (Nunes) — se o número do nosso dashboard não bate, o sistema "perde credibilidade comercial".

## 📸 Caso real validado — Loja 1, 21/05/2026
App do RP INFO mostra:
- **Venda:** R$ 19.900,26
- **Custo:** R$ 12.829,48
- **Margem:** 35,5%

### Fórmula ANTIGA (errada — ~1,5% off)
```sql
custo = vopr_custoentrada * qtde + vopr_icmsvalor
-- em vdonlineprod
```
Resultado: ~R$ 12.637 → diff ~R$ 192 (1,5%) ❌

### Fórmula NOVA (correta — 0,15% off)
```sql
SELECT SUM(mprd_ctmedio + mprd_ctvenda)
FROM movprodd0526                              -- tabela particionada por mês
WHERE mprd_datamvto::date = '2026-05-21'
  AND mprd_unid_codigo::int = 1                -- código da loja
  AND mprd_dcto_tipo = 'EVP';                  -- ⚠️ ESSENCIAL
```
Resultado: R$ 12.849,34 → diff +R$ 19,86 (0,15%) ✅

## 🔑 Descobertas principais

### 1. Tabela certa = `movprodd{MMYY}` (não `vdonlineprod`)
- `vdonlineprod` tem **só venda** + custo de entrada cru (sem impostos completos)
- `movprodd{MMYY}` tem **movimento contábil completo** (ctmedio + ctvenda já com impostos apurados)
- Particionada por mês (`movprodd0526` = maio/2026)

### 2. Filtro `mprd_dcto_tipo = 'EVP'` é OBRIGATÓRIO
A tabela `movprodd0526` contém **todos** os tipos de movimento. Sem o filtro inflaria o custo absurdamente.

| Código | Significado |
|---|---|
| **EVP** | Estoque Venda PDV (o que queremos) |
| EAQ | Entrada de Aquisição (compra de fornecedor) |
| ESE | Estoque de Saída/Entrega |
| EDC | Estoque Devolução de Cliente |
| ENP | Entrada Não-PDV |
| EFE | Estoque Final/Encerramento |
| EBR | Estoque Bonificação Recebida |
| EOE | Outros Estoque |

### 3. `mprd_ctvenda` = ICMS + PIS + Cofins
Validado no sample do Bisc Nestle (cupom 135702, PDV 101):
- `mprd_ctmedio` = 3,154 (custo médio puro do produto)
- `mprd_ctvenda` = 1,984
- ICMS + PIS + Cofins = 1,42 + 0,10 + 0,46 = **1,98** ✅

Ou seja, `ctvenda` já consolida os tributos diretos do item — não precisa somar valorpis/valorcofins/icmsvalor.

### 4. Venda já estava certa, custo não
- Venda `SUM(vopr_valor)` em `vdonlineprod` bate **exato** R$ 19.900,26
- O ajuste é só no custo — não mexer na fórmula da venda

## 🧪 Validação por departamento (Loja 1, 21/05)

| Dpto | App | Fórmula nova | Diff |
|---|---|---|---|
| 7 Bebidas | 2.580,98 | 2.581,82 | +0,84 |
| 100 (s/dpto) | 1.503,55 | 1.508,36 | +4,81 |
| 43 Mercearia Doce | 1.911,74 | 1.914,85 | +3,11 |
| 104 Hortifruti | 1.028,73 | 1.031,16 | +2,43 |
| 105 Frios | 913,02 | 914,66 | +1,64 |
| 8 Laticínios | 531,62 | 532,73 | +1,11 |
| ... outros | ... | ... | ... |
| **TOTAL** | **12.829,48** | **12.849,34** | **+19,86 (0,15%)** |

A diff é **proporcionalmente espalhada** por todos os departamentos — sinal claro de arredondamento/apuração mensal, não de filtro faltando.

## ⚠️ Diff residual de R$ 19,86 (0,15%)

Provável origem (NÃO comprovado, hipóteses testadas):
- **Apuração mensal de crédito PIS/Cofins** que o app reflete no custo (não tem na linha individual)
- **Arredondamento contábil agregado** (TRUNC por linha tentou e não casou exato)
- Tabelas `apurressarcpiscofins`, `contapurpiscofins`, `contcredestoque` podem conter o ajuste — não exploradas

**Para o dashboard gerencial, 0,15% é aceitável.** Não vale gastar mais tempo nisso a menos que o cliente reclame.

## 🛠️ Onde aplicar no código

Arquivo: `packages/backend/src/services/gestao-inteligente.service.ts`
Método: caminho Postgres (Nunes) — procurar fórmula atual `vopr_custoentrada * qtde + vopr_icmsvalor`

Substituir por query em `movprodd{MMYY}` com filtro `dcto_tipo='EVP'`.

⚠️ **Particionamento**: nome da tabela varia por mês — precisa formatar `movprodd${MM}${YY}` dinamicamente, ou fazer UNION quando o período abrange mais de um mês.

## 🔗 Referências
- [[../clientes/nunes|Nunes]] — seção Fórmula de Custo (atualizada)
- [[../modulos/gestao-inteligente|Gestão Inteligente]]
- [[../arquitetura/oracle-intersolid|Comparação Oracle vs Postgres]] — Intersolid usa formula diferente

## 🏷️ Tags
#bug-resolvido #nunes #postgres #rp-info #custo #margem #imposto #gestao-inteligente
