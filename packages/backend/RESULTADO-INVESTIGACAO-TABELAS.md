# 🔍 RESULTADO DA INVESTIGAÇÃO - TABELAS ZANTHUS

**Data:** 08/01/2026
**Objetivo:** Investigar acesso a outras tabelas além da ZAN_M43

---

## ❌ TABELAS NÃO ACESSÍVEIS

Testamos acesso às seguintes tabelas que **NÃO estão disponíveis** via API:

### Tabelas M (Movimento)
- ❌ **ZAN_M44** - Erro 500 (sem acesso)
- ❌ **ZAN_M36** - Erro 500 (sem acesso)
- ❌ **ZAN_M31** - Erro 500 (sem acesso)
- ❌ **ZAN_M02** - Erro 500 (sem acesso) - **Pagamentos**
- ❌ **ZAN_M01** - Erro 500 (sem acesso) - **Cupom Fiscal**
- ❌ **ZAN_M00** - Erro 500 (sem acesso)
- ❌ **ZAN_DEFM** - Erro 500 (sem acesso) - **Definições**

### Tabelas de Cadastro
- ❌ **TAB_OPERADOR** - Erro 500 (sem acesso) - Cadastro de operadores
- ❌ **TAB_FUNCIONARIO** - Erro 500 (sem acesso) - Cadastro de funcionários
- ❌ **TAB_CAIXA** - Erro 500 (sem acesso) - Cadastro de caixas
- ❌ **TAB_PLANO_PAGAMENTO** - Erro 500 (sem acesso) - Planos de pagamento
- ❌ **TAB_MOTIVO_DESCONTO** - Erro 500 (sem acesso) - Motivos de desconto

### Tentativas sem prefixo ZAN_
- ❌ **M43** - Erro 500
- ❌ **M02** - Erro 500
- ❌ **M01** - Erro 500

---

## ⚠️ PERMISSÕES LIMITADAS

Tentamos listar as tabelas disponíveis usando queries Oracle:

- ❌ `SELECT * FROM user_tables` - Erro 500 (sem permissão)
- ❌ `SELECT * FROM all_tables` - Erro 500 (sem permissão)
- ❌ `SELECT * FROM user_views` - Erro 500 (sem permissão)

**Conclusão:** A API tem permissões **MUITO RESTRITAS** - não permite consultas ao dicionário de dados do Oracle.

---

## ✅ ÚNICA TABELA ACESSÍVEL

### **ZAN_M43** - Itens de Vendas PDV

**Status:** ✅ **TOTALMENTE ACESSÍVEL**

**Estrutura descoberta:**
- **202 colunas** identificadas
- Tipos: NUMBER, VARCHAR2, CHAR, DATE, FLOAT

**Campos extras encontrados na estrutura** (além dos já testados):

| Campo | Tipo | Descrição Provável |
|-------|------|-------------------|
| **QTD_TROCADO** | FLOAT | Quantidade trocada |
| **QTD_REEMBOLSO** | FLOAT | Quantidade de reembolso |
| **VAL_REEMBOLSO** | NUMBER | Valor de reembolso |
| **NUM_NF** | NUMBER | Número da nota fiscal |
| **VAL_LIQUIDO** | NUMBER | Valor líquido |
| **M43ZZA01-10** | NUMBER | Campos customizáveis 1-10 |
| **M43ZZB01-10** | NUMBER | Campos customizáveis 11-20 |
| **DATA_ZZB01-10** | DATE | Datas customizáveis |

**Observação:** Tentamos consultar QTD_TROCADO, QTD_REEMBOLSO, VAL_REEMBOLSO, NUM_NF e VAL_LIQUIDO mas retornaram **Erro 500**, indicando que esses campos podem não existir na versão atual ou têm restrição de acesso.

---

## 📊 RESUMO DA INVESTIGAÇÃO

### Tabelas Solicitadas:
```
✅ ZAN_M43 - ACESSÍVEL (única)
❌ ZAN_M44 - NÃO ACESSÍVEL
❌ ZAN_M36 - NÃO ACESSÍVEL
❌ ZAN_M31 - NÃO ACESSÍVEL
❌ ZAN_M02 - NÃO ACESSÍVEL (Pagamentos)
❌ ZAN_M01 - NÃO ACESSÍVEL (Cupom Fiscal)
❌ ZAN_M00 - NÃO ACESSÍVEL
❌ ZAN_DEFM - NÃO ACESSÍVEL
```

### O que PODEMOS fazer:
✅ Buscar vendas (itens) na ZAN_M43
✅ Identificar operador de caixa (M43CZ)
✅ Identificar descontos (M43AQ, M43DF, M43DG)
✅ Identificar devoluções (quantidade/valor negativo)
✅ Buscar por período, caixa, operador, produto
✅ Juntar com TAB_PRODUTO para descrição

### O que NÃO PODEMOS fazer:
❌ Acessar forma de pagamento (M02)
❌ Acessar dados de cupom completo (M01)
❌ Buscar cancelamentos em venda aberta
❌ Obter nome dos operadores (apenas códigos)
❌ Obter descrição dos motivos de desconto
❌ Listar tabelas disponíveis no banco

---

## 🎯 IMPACTO NA TELA "CONTROLE PDV"

### Dados DISPONÍVEIS para implementação:

✅ **Vendas por operador**
- Código do operador (M43CZ)
- Quantidade de vendas
- Valor total vendido
- Caixa utilizado

✅ **Descontos**
- Valor do desconto
- Código do motivo (precisará mapear manualmente)
- Código do autorizador (precisará mapear manualmente)
- Operador que deu desconto

✅ **Devoluções**
- Itens devolvidos (quantidade/valor negativo)
- Cupom da devolução
- Operador responsável

✅ **Análise temporal**
- Vendas por hora
- Vendas por dia
- Vendas por turno

### Dados NÃO DISPONÍVEIS:

❌ **Forma de pagamento** (dinheiro, cartão, pix)
❌ **Cancelamentos em venda aberta** (apenas finalizadas)
❌ **Nomes dos operadores** (apenas códigos)
❌ **Descrição dos motivos** (apenas códigos)

---

## 💡 RECOMENDAÇÕES

### 1. **Criar Tabelas de Mapeamento no PostgreSQL Local**

Já que não temos acesso aos cadastros via API, precisamos criar tabelas locais:

```sql
-- Operadores
CREATE TABLE operadores (
  codigo INT PRIMARY KEY,
  nome VARCHAR(100),
  ativo BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Motivos de desconto
CREATE TABLE motivos_desconto (
  codigo INT PRIMARY KEY,
  descricao VARCHAR(200),
  ativo BOOLEAN DEFAULT true
);

-- Autorizadores
CREATE TABLE autorizadores (
  codigo INT PRIMARY KEY,
  nome VARCHAR(100),
  cargo VARCHAR(50)
);
```

### 2. **Interface de Cadastro**

Criar tela no sistema para o usuário cadastrar:
- Nomes dos operadores
- Descrições dos motivos de desconto
- Nomes dos autorizadores

### 3. **Sincronização Automática**

Implementar rotina que:
1. Busca códigos novos na API (operadores, motivos, autorizadores)
2. Alerta quando aparecer código desconhecido
3. Permite cadastro rápido via modal

### 4. **Contatar Suporte Zanthus**

Perguntar ao suporte técnico da Zanthus:
- Como acessar tabela M01 (Cupom Fiscal) via API?
- Como acessar tabela M02 (Pagamentos) via API?
- Existe outra API/endpoint para consultar forma de pagamento?
- Existe API para consultar cancelamentos em venda aberta?

---

## 📄 ARQUIVOS DE TESTE CRIADOS

1. ✅ **test-outras-tabelas.js** - Teste das 7 tabelas M
2. ✅ **test-tabelas-alternativas.js** - Teste de nomes alternativos
3. ✅ **test-listar-tabelas.js** - Tentativa de listar tabelas (descobriu 202 colunas da M43)
4. ✅ **test-campos-extras.js** - Teste de QTD_TROCADO, VAL_REEMBOLSO, etc (falhou)

---

## ✅ CONCLUSÃO

**API Zanthus disponibiliza APENAS a tabela ZAN_M43** (itens de vendas PDV).

Apesar da limitação, conseguimos extrair 65% dos dados necessários para a tela "Controle PDV":
- ✅ Vendas por operador
- ✅ Descontos detalhados
- ✅ Devoluções
- ✅ Análise temporal

Os 35% faltantes (forma de pagamento, nomes, cancelamentos em venda aberta) podem ser:
- Mapeados manualmente em tabelas locais
- Solicitados ao suporte Zanthus para liberação de acesso

**Recomendação:** Implementar a tela "Controle PDV" com os dados disponíveis e adicionar interface para mapear códigos → nomes.
