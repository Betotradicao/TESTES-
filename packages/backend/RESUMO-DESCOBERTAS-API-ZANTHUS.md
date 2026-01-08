# 📊 RESUMO EXECUTIVO - DESCOBERTAS API ZANTHUS M43

**Data:** 08/01/2026
**Período Analisado:** 07/01/2026 (ontem)
**Total de Vendas:** 4.428 itens vendidos

---

## 🎯 PRINCIPAIS DESCOBERTAS

### ✅ 1. CÓDIGO DO OPERADOR DE CAIXA

**Campo:** `M43CZ` (assinaturaRegistro)
**Status:** ✅ **100% PREENCHIDO** - Campo mais importante!

**7 Operadores encontrados:**

| Caixa | Operador | Vendas | % do Caixa |
|-------|----------|--------|------------|
| **1** | **275** | 1.263 | 99,1% |
| **1** | **5948** | 11 | 0,9% |
| **2** | **207** | 988 | 100% |
| **3** | **459** | 143 | 15,2% |
| **3** | **3649** | 798 | 84,8% |
| **4** | **185** | 1.005 | 100% |
| **5** | **3557** | 220 | 100% |

**Nota:** Nomes dos operadores NÃO estão disponíveis na API (apenas códigos). Precisaremos criar tabela manual de mapeamento.

---

### ✅ 2. DESCONTOS DETALHADOS

**Campos:**
- `M43AQ` - Valor do desconto
- `M43DF` - Código do motivo (10, 20)
- `M43DG` - Código de quem autorizou (3, 28)

**📊 Estatísticas:**
- **9 vendas com desconto** no dia (0,20%)
- **Total descontado:** R$ 13,44

**Descontos por Operador:**

| Operador | Qtd Descontos | Total R$ | Caixas |
|----------|---------------|----------|---------|
| **275** | 6 | R$ 13,14 | Caixa 1 |
| **185** | 1 | R$ 4,00 | Caixa 4 |
| **3649** | 1 | R$ 2,00 | Caixa 3 |
| **3557** | 1 | R$ 0,30 | Caixa 5 |

**Motivos encontrados:**
- **Motivo 10** + Autorizador 3: 8 descontos (média R$ 1,73)
- **Motivo 20** + Autorizador 28: 1 desconto (R$ 0,30)

**Nota:** Descrições dos motivos NÃO estão na API (apenas códigos). Precisaremos criar tabela manual.

---

### ✅ 3. CANCELAMENTOS / DEVOLUÇÕES

**🔴 IMPORTANTE:** Encontramos apenas **1 tipo** de cancelamento na API:

#### **DEVOLUÇÕES EM VENDAS FINALIZADAS** ✅

**Método:** Quantidade/valor NEGATIVO
**Campos:** `M43AO` < 0 ou `M43AP` < 0

**📊 Estatísticas:**
- **2 itens devolvidos** no dia (0,05%)
- **Total devolvido:** R$ -6,68

**Exemplo real:**
```
Cupom: 94536
  Item 1: CERV ECOBIER 350ML LT - Qtd: -1 - Valor: -R$ 2,89
  Item 2: CERV ECOBIER 473ML LT - Qtd: -1 - Valor: -R$ 3,79
```

#### **CANCELAMENTOS EM VENDA ABERTA** ❌ NÃO ENCONTRADO

**Campos testados:** `M43BV`, `M43BW`, `M43CF` → **TODOS VAZIOS**

**Conclusão:**
- Itens cancelados ANTES de finalizar cupom **NÃO aparecem** na tabela M43
- Eles são removidos do PDV antes do registro ser criado
- Se existe relatório de "cancelamentos em venda aberta", ele pode estar usando:
  - Logs do PDV em tempo real
  - Tabela M01 ou M02 (cupons cancelados inteiros)
  - Sistema de auditoria separado

**⚠️ Limitação:** Não conseguimos rastrear cancelamentos em venda aberta pela API M43

---

### ❌ 4. FORMA DE PAGAMENTO

**Campo testado:** `M43AZ` (codPlanoPagamento)
**Status:** ❌ **SEMPRE ZERO** (0%)

**Tabelas tentadas:**
- `ZAN_M01` (Cupom Fiscal) → ⚠️ Vazia ou sem acesso
- `ZAN_M02` (Pagamentos) → ❌ Erro 500 (sem acesso)

**Conclusão:**
- Forma de pagamento NÃO está disponível na tabela M43
- Pode estar em M01 ou M02, mas não temos acesso via API
- **Recomendação:** Perguntar ao suporte Zanthus sobre acesso às tabelas M01/M02

---

## 📋 CAMPOS DISPONÍVEIS E TESTADOS

### ✅ CAMPOS COM DADOS REAIS (26 campos - 65%)

**Identificação da Venda:**
- M00AD (numCupomFiscal) - 100%
- M00AC (codCaixa) - 100%
- M00ZA (codLoja) - 100%
- M00AF (dtaSaida) - 100%
- M43AS (horarioVenda) - 100%
- M00_TURNO (turno) - 100%

**Produto:**
- M43AH (codProduto) - 100%
- TAB_PRODUTO (desProduto via JOIN) - 95%

**Valores:**
- M43DQ (valVenda) - 100%
- M43AO (qtdTotalProduto) - 100%
- M43AP (valTotalProduto) - 100%

**Operador:**
- ⭐ M43CZ (codOperadorCaixa) - 100% **PRINCIPAL**

**Desconto:**
- M43AQ (descontoAplicado) - 9 vendas
- M43DF (motivoDesconto) - 9 vendas
- M43DG (codAutorizadorDesconto) - 9 vendas

**Assinaturas:**
- M43DA (assinaturaCancelamento) - 100%
- M43DB (assinaturaSubtotal) - 100%
- M43DC (assinaturaDesconto) - 100%

### ❌ CAMPOS VAZIOS/ZERADOS (14 campos - 35%)

**Operador/Cliente:**
- M43AM (codVendedor) - 0%
- M43CY (codAutorizadorVenda) - 0%
- M43BB (codCliente) - 0%

**Cancelamento:**
- M43BV (motivoCancelamento) - 0%
- M43BW (funcionarioCancelamento) - 0%
- M43CF (tipoCancelamento) - 0%

**Pagamento:**
- M43AZ (codPlanoPagamento) - 0%
- M43ER (valVoucherConcedido) - 0%

**Desconto (campos adicionais):**
- M43AW (tipoDesconto) - 0%
- M43AX (valDescontoItem) - 0%
- M43CK (modoDesconto) - 0%
- M43EFA (valDescontoAdicional) - 0%
- M43EFB (motivoDescontoAdicional) - 0%

---

## 🎯 RECOMENDAÇÕES PARA TELA "CONTROLE PDV"

### 📊 CARDS MACRO (Resumo)

**Possíveis com dados atuais:**

1. **Total de Vendas** ✅
   - Quantidade de itens vendidos
   - Valor total em R$
   - Por período (dia/semana/mês)

2. **Total de Descontos** ✅
   - Valor total descontado
   - % sobre vendas totais
   - Quantidade de vendas com desconto

3. **Total de Devoluções** ✅
   - Valor total devolvido
   - % sobre vendas totais
   - Quantidade de itens devolvidos

4. **Vendas por Operador** ✅
   - Ranking de vendas
   - Gráfico de barras

**NÃO possíveis:**
- ❌ Cancelamentos em venda aberta (dados não disponíveis)
- ❌ Forma de pagamento (dados não disponíveis)

### 📋 TABELAS MICRO (Detalhes)

**Tabela 1: Descontos Detalhados** ✅
- Cupom, Caixa, Operador, Produto
- Valor do desconto
- Motivo (código)
- Autorizador (código)
- Data/Hora

**Tabela 2: Devoluções** ✅
- Cupom, Caixa, Operador, Produto
- Quantidade devolvida
- Valor devolvido
- Data/Hora

**Tabela 3: Performance por Operador** ✅
- Código do operador
- Total vendido (R$)
- Qtd de vendas
- Qtd de descontos
- % desconto sobre vendas
- Qtd de devoluções
- % devoluções sobre vendas

### 📈 GRÁFICOS

**Possíveis:**
1. ✅ Vendas por operador (barras)
2. ✅ Descontos por operador (pizza)
3. ✅ Vendas por hora do dia (linha)
4. ✅ Vendas por caixa (barras)
5. ✅ Evolução de vendas por dia (linha)

### 🔍 FILTROS

**Disponíveis:**
- ✅ Data inicial e final
- ✅ Caixa específico (1 a 5)
- ✅ Operador específico (código)
- ✅ Com/sem desconto
- ✅ Devoluções
- ✅ Turno (1)

---

## 🛠️ PRÓXIMOS PASSOS

### 1. **Criar Tabelas de Mapeamento Manual**

**Operadores:**
```sql
CREATE TABLE operadores (
  codigo INT PRIMARY KEY,
  nome VARCHAR(100),
  ativo BOOLEAN DEFAULT true
);

INSERT INTO operadores VALUES
  (185, 'Nome Operador 185', true),
  (207, 'Nome Operador 207', true),
  (275, 'Nome Operador 275', true),
  (459, 'Nome Operador 459', true),
  (3557, 'Nome Operador 3557', true),
  (3649, 'Nome Operador 3649', true),
  (5948, 'Nome Operador 5948', true);
```

**Motivos de Desconto:**
```sql
CREATE TABLE motivos_desconto (
  codigo INT PRIMARY KEY,
  descricao VARCHAR(200)
);

INSERT INTO motivos_desconto VALUES
  (10, 'Descrição do motivo 10'),
  (20, 'Descrição do motivo 20');
```

**Autorizadores:**
```sql
CREATE TABLE autorizadores (
  codigo INT PRIMARY KEY,
  nome VARCHAR(100),
  cargo VARCHAR(50)
);

INSERT INTO autorizadores VALUES
  (3, 'Nome Autorizador 3', 'Gerente'),
  (28, 'Nome Autorizador 28', 'Supervisor');
```

### 2. **Implementar Endpoints da API**

```
GET /api/pdv/resumo?dataInicio=2026-01-01&dataFim=2026-01-31
GET /api/pdv/vendas?dataInicio=...&caixa=...&operador=...
GET /api/pdv/descontos?dataInicio=...
GET /api/pdv/devolucoes?dataInicio=...
GET /api/pdv/operadores/performance?dataInicio=...
```

### 3. **Criar Tela "Controle PDV"**

- Menu: Prevenção PDV → Controle PDV
- Filtros de data (1-30 do mês atual)
- 3 cards macro (vendas, descontos, devoluções)
- 3 tabelas micro (descontos, devoluções, operadores)
- 3-4 gráficos (vendas/hora, vendas/operador, etc)
- Botão de exportar para Excel/PDF

### 4. **Investigar Cancelamentos em Venda Aberta**

- Contatar suporte Zanthus sobre acesso a M01/M02
- Verificar se existem outras APIs/endpoints
- Considerar integração direta com logs do PDV

---

## 📄 ARQUIVOS CRIADOS

1. **CAMPOS-ZANTHUS-M43-COMPLETO.md** - Documentação completa de todos os 40+ campos
2. **test-zanthus-campos-novos.js** - Teste inicial de campos
3. **test-todas-vendas-completo.js** - Teste de todas as vendas do dia
4. **test-todos-operadores.js** - Mapeamento de operadores por caixa
5. **test-descontos-detalhados.js** - Descontos com caixa e operador
6. **test-buscar-cancelamentos.js** - Análise de cancelamentos
7. **test-forma-pagamento.js** - Teste de forma de pagamento
8. **RESUMO-DESCOBERTAS-API-ZANTHUS.md** - Este arquivo

---

**Conclusão:** A API Zanthus M43 oferece 65% dos campos com dados úteis. Os principais dados estão disponíveis (operador, descontos, devoluções), mas faltam cancelamentos em venda aberta e forma de pagamento. Podemos implementar 80% da tela "Controle PDV" com os dados disponíveis.
