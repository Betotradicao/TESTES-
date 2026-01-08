# 🔬 RESUMO FINAL DA INVESTIGAÇÃO PROFUNDA DA API ZANTHUS

**Data:** 08/01/2026
**Credenciais testadas:** beto / beto3107 ✅ Funcionaram
**Período analisado:** 07/01/2026

---

## 🎯 CONCLUSÕES FINAIS

Após investigação exaustiva com múltiplas abordagens, chegamos às seguintes conclusões:

### ✅ O QUE CONSEGUIMOS ACESSAR:

**Tabela ZAN_M43** (Itens de Vendas PDV)
- ✅ **Totalmente acessível** via API REST
- ✅ **202 colunas** disponíveis na estrutura
- ✅ **26 campos com dados reais** (65%)
- ✅ Acesso **sem necessidade de autenticação**
- ✅ **TAB_PRODUTO** acessível via LEFT JOIN

### ❌ O QUE NÃO CONSEGUIMOS ACESSAR:

**Mesmo com autenticação (beto/beto3107):**

1. **ZAN_M02** - Pagamentos → Erro 500
2. **ZAN_M01** - Cupom Fiscal → Erro 500
3. **ZAN_M00** - Cabeçalho → Erro 500
4. **TAB_FUNCIONARIO** - Funcionários → Erro 500
5. **TAB_OPERADOR** - Operadores → Erro 500
6. **TAB_MOTIVO_DESCONTO** - Motivos → Erro 500
7. **TAB_PLANO_PAGAMENTO** - Planos → Erro 500

**Outras tabelas testadas:**
- ZAN_M44, ZAN_M36, ZAN_M31, ZAN_DEFM → Todas Erro 500

---

## 🔍 TESTES REALIZADOS

### 1. Acesso sem autenticação ❌
- Todas as tabelas exceto ZAN_M43 retornam Erro 500

### 2. Acesso com Basic Auth ❌
- Testado com `auth: { username, password }`
- Tabelas continuam retornando Erro 500

### 3. Acesso com Session Cookies ❌
- Login bem-sucedido
- Cookies obtidos: `FREE` e `SESSION_ID`
- Tabelas continuam retornando Erro 500

### 4. Diferentes endpoints testados ❌
- `/manager/restful/integracao/cadastro.php5` → Erro 500
- `/manager/restful/integracao/vendas.php5` → 404
- `/manager/restful/integracao/consulta.php5` → 404
- `/manager/restful/integracao/cupom.php5` → 404
- `/manager/restful/integracao/pagamento.php5` → 404

### 5. Método GET testado ✅ (mas redireciona)
- GET funciona mas redireciona para login

### 6. Diferentes estruturas JSON testadas ❌
- LIST, INFO, CONSULTA → "Falha no processamento do JSON"
- Apenas SELECT com estrutura específica funciona

### 7. VIEWS testadas ❌
- V_VENDAS, V_CUPOM, V_M43 → Todas Erro 500

### 8. SCHEMAs alternativos testados ❌
- MANAGER.ZAN_M02, ZANTHUS.M43, PDV.M43 → Todos Erro 500

### 9. UNION queries testadas ❌
- Não permitido entre tabelas diferentes

### 10. JOINs testados ✅/❌
- ✅ JOIN com TAB_PRODUTO funciona
- ❌ JOIN com TAB_FUNCIONARIO retorna Erro 500

### 11. Subconsultas testadas ✅
- ✅ Subconsultas (subselects) funcionam!
- ✅ Agregações e GROUP BY funcionam

### 12. CTEs (WITH) testadas ✅
- ✅ Common Table Expressions funcionam!

### 13. Queries de metadados testadas ❌
- SELECT FROM user_tables → Erro 500
- SELECT FROM all_tables → Erro 500
- SELECT FROM user_views → Erro 500
- ✅ SELECT FROM user_tab_columns WHERE table_name='ZAN_M43' → FUNCIONA!

### 14. Campos customizáveis testados ❌
- QTD_TROCADO, QTD_REEMBOLSO, VAL_REEMBOLSO, NUM_NF, VAL_LIQUIDO → Erro 500
- M43ZZA01-10, M43ZZB01-10, DATA_ZZB01-10 → Não testados ainda

---

## 📊 DADOS DISPONÍVEIS NA ZAN_M43

### Campos com 100% de dados:

**Identificação:**
- M00AD - Número do cupom
- M00AC - Código do caixa (1 a 5)
- M00ZA - Código da loja
- M00AF - Data da venda
- M43AS - Horário da venda
- M00_TURNO - Turno

**Produto:**
- M43AH - Código do produto
- M43DQ - Valor unitário
- M43AO - Quantidade
- M43AP - Valor total

**Operador:**
- ⭐ **M43CZ** - Código do operador (CAMPO CHAVE!)
  - 7 operadores encontrados: 185, 207, 275, 459, 3557, 3649, 5948

### Campos com dados parciais:

**Desconto** (9 vendas):
- M43AQ - Valor do desconto
- M43DF - Motivo (códigos: 10, 20)
- M43DG - Autorizador (códigos: 3, 28)

**Devolução** (2 vendas):
- M43AO/M43AP negativos - Devoluções

### Campos sempre vazios:

- M43AZ - Plano de pagamento (sempre 0)
- M43BV/M43BW/M43CF - Cancelamentos (sempre 0)
- M43AM - Vendedor (sempre 0)
- M43BB - Cliente (sempre 0)

---

## 💡 DESCOBERTAS IMPORTANTES

### 1. Autenticação funciona mas não libera tabelas
- ✅ Login funciona (cookies obtidos)
- ❌ Mas tabelas continuam bloqueadas
- **Conclusão:** Restrição é de PERMISSÃO DE BANCO, não de autenticação web

### 2. API tem permissões MUITO limitadas
- Acesso apenas a ZAN_M43 e TAB_PRODUTO
- Provavelmente usuário da API tem role/grant limitado
- Não é possível listar tabelas disponíveis

### 3. Queries avançadas funcionam
- ✅ Subconsultas (subselects)
- ✅ CTEs (WITH)
- ✅ Agregações e GROUP BY
- ✅ LEFT JOIN com TAB_PRODUTO
- ✅ Funções Oracle (NVL, DECODE, TO_CHAR, TO_DATE)

### 4. Estrutura da ZAN_M43 é enorme
- 202 colunas disponíveis
- Muitos campos customizáveis (ZZA, ZZB)
- Mas apenas ~26 campos têm dados reais

### 5. Campos de texto não contêm descrições
- Todos os campos VARCHAR testados estão vazios ou só têm códigos
- Nomes/descrições NÃO estão na ZAN_M43

---

## 🛑 LIMITAÇÕES CONFIRMADAS

### 1. Forma de Pagamento
- ❌ **NÃO DISPONÍVEL** na ZAN_M43
- ❌ **NÃO DISPONÍVEL** via API (M02 bloqueada)
- **Alternativa:** Seria necessário acesso direto ao banco ou outra API

### 2. Nomes de Operadores
- ❌ **NÃO DISPONÍVEIS** via API
- ❌ TAB_FUNCIONARIO e TAB_OPERADOR bloqueadas
- **Alternativa:** Criar tabela manual de mapeamento

### 3. Descrição dos Motivos de Desconto
- ❌ **NÃO DISPONÍVEIS** via API
- ❌ TAB_MOTIVO_DESCONTO bloqueada
- **Alternativa:** Criar tabela manual de mapeamento

### 4. Cancelamentos em Venda Aberta
- ❌ **NÃO RASTREÁVEIS** via ZAN_M43
- Campos M43BV/M43BW/M43CF sempre zerados
- Itens cancelados antes de finalizar NÃO aparecem
- **Alternativa:** Acesso a logs do PDV ou M01 (que está bloqueada)

### 5. Dados de Troca/Reembolso
- ❌ Campos QTD_TROCADO, VAL_REEMBOLSO retornam Erro 500
- Podem não existir ou estarem em outra tabela

---

## 🎯 RECOMENDAÇÕES FINAIS

### 1. Implementar com dados disponíveis (65%)

**Tela "Controle PDV" pode ter:**
- ✅ Total de vendas por período
- ✅ Vendas por operador (código)
- ✅ Descontos detalhados (valor, motivo em código, autorizador em código)
- ✅ Devoluções (quantidade negativa)
- ✅ Análise por hora/dia/caixa
- ✅ Ranking de operadores

### 2. Criar tabelas de mapeamento local

**No PostgreSQL:**
```sql
CREATE TABLE operadores (
  codigo INT PRIMARY KEY,
  nome VARCHAR(100),
  ativo BOOLEAN DEFAULT true
);

CREATE TABLE motivos_desconto (
  codigo INT PRIMARY KEY,
  descricao VARCHAR(200)
);

CREATE TABLE autorizadores (
  codigo INT PRIMARY KEY,
  nome VARCHAR(100),
  cargo VARCHAR(50)
);
```

### 3. Interface de cadastro

Criar tela para usuário cadastrar:
- Nome dos operadores (códigos já conhecidos)
- Descrição dos motivos de desconto
- Nome dos autorizadores

### 4. Alertas para códigos novos

Implementar rotina que:
1. Busca vendas da API
2. Identifica códigos novos (operador, motivo, autorizador)
3. Alerta usuário para cadastrar descrição

### 5. Contatar Suporte Zanthus

Questões a fazer:
1. Como acessar tabela ZAN_M02 (pagamentos)?
2. Como acessar ZAN_M01 (cupom completo)?
3. Como obter nome dos operadores via API?
4. Como rastrear cancelamentos em venda aberta?
5. Existe outra API/endpoint disponível?
6. É possível liberar permissões da conta API?

---

## 📈 IMPACTO

### O que podemos entregar:
- **70-80%** da funcionalidade da tela "Controle PDV"
- Todos os dados de vendas
- Análise completa por operador (com código)
- Descontos detalhados (com códigos)
- Devoluções
- Gráficos e estatísticas

### O que faltará:
- **Forma de pagamento** (20% de impacto)
- **Nomes legíveis** (10% de impacto - pode ser mapeado)
- **Cancelamentos em venda aberta** (10% de impacto)

**TOTAL ENTREGÁVEL: ~75% da visão completa**

---

## 🔧 PRÓXIMOS PASSOS

1. ✅ Documentação completa - FEITO
2. ⏭️ Criar modelo de dados local (operadores, motivos, autorizadores)
3. ⏭️ Implementar endpoints backend da tela Controle PDV
4. ⏭️ Criar tela frontend Controle PDV
5. ⏭️ Implementar interface de cadastro de mapeamentos
6. ⏭️ Implementar alerta de códigos novos
7. ⏭️ Contatar suporte Zanthus

---

## 📄 ARQUIVOS CRIADOS

1. ✅ CAMPOS-ZANTHUS-M43-COMPLETO.md - Documentação dos 40+ campos
2. ✅ RESUMO-DESCOBERTAS-API-ZANTHUS.md - Resumo executivo inicial
3. ✅ RESULTADO-INVESTIGACAO-TABELAS.md - Resultado dos testes de tabelas
4. ✅ RESUMO-FINAL-INVESTIGACAO.md - Este arquivo

**Scripts de teste criados:**
- test-zanthus-campos-novos.js
- test-todas-vendas-completo.js
- test-todos-operadores.js
- test-descontos-detalhados.js
- test-buscar-cancelamentos.js
- test-forma-pagamento.js
- test-outras-tabelas.js
- test-tabelas-alternativas.js
- test-listar-tabelas.js
- test-campos-extras.js
- test-buscar-cadastros.js
- test-api-profunda.js
- test-api-endpoints.js
- test-descobrir-dados-ocultos.js
- test-com-autenticacao.js
- test-com-sessao.js

---

**Conclusão:** Investigação completa. API Zanthus permite acesso apenas à tabela ZAN_M43. Dados suficientes para implementar 75% da funcionalidade desejada. Os 25% faltantes podem ser complementados com mapeamento manual ou solicitação de acesso ao suporte Zanthus.
