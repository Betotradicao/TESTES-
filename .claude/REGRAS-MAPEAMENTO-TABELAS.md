# REGRAS DE MAPEAMENTO DE TABELAS - OBRIGATORIO

## Regra Principal

**NUNCA usar nomes de colunas Oracle hardcoded no codigo.**

Este e um sistema MULTI-CLIENTE. Cada cliente pode usar um ERP diferente (Intersolid, Zanthus, SAP, etc.) com nomes de colunas diferentes. Toda coluna Oracle DEVE ser resolvida via `MappingService` + `Configuracoes de Tabelas`.

---

## Como Funciona o Sistema de Mapeamento

### Arquitetura (3 camadas)

```
1. TABLE_CATALOG (Frontend)          -> Define campos disponiveis na UI
2. erp_templates (PostgreSQL)        -> Templates pre-configurados por ERP
3. database_connections (PostgreSQL)  -> Mapeamento ativo usado em runtime
```

### Fluxo

```
TABLE_CATALOG (define campos)
       |
       v
Usuario configura na UI (Configuracoes de Tabelas)
       |
       v
Salva em database_connections.mappings (JSON)
       |
       v
MappingService.getColumnFromTable() le do banco
       |
       v
Query Oracle usa coluna dinamica
```

---

## Ao Criar/Modificar Funcionalidade que Consulta Oracle

### Passo 1: Verificar TABLE_CATALOG

**Arquivo:** `packages/frontend/src/pages/ConfiguracoesTabelas.jsx`

Verificar se a tabela e os campos necessarios existem no `TABLE_CATALOG`. Se nao existir:

```javascript
// Adicionar no TABLE_CATALOG
TAB_NOVA_TABELA: {
  name: 'Nome Amigavel',
  description: 'Descricao da tabela',
  fields: [
    { id: 'campo_id', name: 'Nome do Campo', defaultTable: 'TAB_NOVA_TABELA', defaultColumn: 'COLUNA_ORACLE' },
  ]
},
```

### Passo 2: Verificar BUSINESS_MODULES

No mesmo arquivo, verificar se o modulo/submodulo referencia a tabela no array `tables`:

```javascript
{ id: 'meu_modulo', name: 'Meu Modulo', icon: '...', tables: ['TAB_NOVA_TABELA', ...] },
```

Se o modulo nao existir, adicionar no grupo correto (prevencao, gestao, oferta, ia).

### Passo 3: No Controller/Service (Backend)

**CORRETO - Usar MappingService:**
```typescript
const schema = await MappingService.getSchema();
const tabela = `${schema}.${await MappingService.getRealTableName('TAB_NOVA_TABELA')}`;
const colCampo = await MappingService.getColumnFromTable('TAB_NOVA_TABELA', 'campo_id');

const query = `SELECT t.${colCampo} FROM ${tabela} t WHERE ...`;
```

**ERRADO - Hardcode:**
```typescript
// NUNCA FACA ISSO:
const query = `SELECT t.COD_PRODUTO FROM INTERSOLID.TAB_PRODUTO t WHERE ...`;
```

### Passo 4: Atualizar Template e Conexao no Banco

Ao adicionar tabelas/campos novos, criar script para atualizar:
- `erp_templates` (template INTERSOLID)
- `database_connections` (conexao ativa)

Formato do mapeamento v2:
```json
{
  "version": 2,
  "tabelas": {
    "TAB_NOVA_TABELA": {
      "nome_real": "NOME_REAL_ORACLE",
      "colunas": {
        "campo_id": "COLUNA_ORACLE"
      },
      "tabelas_campo": {
        "campo_id": "TAB_NOVA_TABELA"
      }
    }
  }
}
```

---

## Regras Especificas

### PROIBIDO

1. **Hardcode de coluna:** `p.COD_PRODUTO` direto na query
2. **Hardcode de tabela:** `INTERSOLID.TAB_PRODUTO` direto na query
3. **Fallback no getColumnFromTable:** `getColumnFromTable('TAB', 'campo', 'FALLBACK')` - o 3o parametro NAO deve ser usado
4. **Schema hardcoded:** usar `INTERSOLID.` fixo - sempre usar `MappingService.getSchema()`

### PERMITIDO

1. **Alias de resultado:** `SELECT t.${col} as COD_PRODUTO` - o alias (as COD_PRODUTO) pode ser fixo pois e nome interno do resultado, nao coluna Oracle
2. **Tabelas internas PostgreSQL:** Tabelas do proprio sistema (employees, configurations, etc.) NAO precisam de mapeamento
3. **Leitura de resultado:** `row.COD_PRODUTO` quando COD_PRODUTO e alias definido na query - isso e leitura do resultado, nao coluna Oracle

---

## Checklist para Novas Funcionalidades

Antes de fazer commit de qualquer funcionalidade que consulta Oracle:

- [ ] Todos os campos Oracle usam `MappingService.getColumnFromTable()`?
- [ ] Todas as tabelas Oracle usam `MappingService.getRealTableName()`?
- [ ] O schema usa `MappingService.getSchema()`?
- [ ] Os campos existem no `TABLE_CATALOG` em ConfiguracoesTabelas.jsx?
- [ ] O modulo esta no `BUSINESS_MODULES` com as tabelas corretas?
- [ ] Nao tem nenhum `getColumnFromTable` com 3o parametro (fallback)?
- [ ] Template INTERSOLID e conexao foram atualizados no banco?

---

## Grupos de Modulos (BUSINESS_MODULES)

| Grupo | ID | Submodulos |
|-------|-----|------------|
| Prevencao no Radar | `prevencao` | bipagens, pdv, facial, rupturas, etiquetas, quebras, producao, hortfruti |
| Gestao no Radar | `gestao` | gestao_inteligente, estoque_margem, compra_venda, pedidos, ruptura_industria, calendario_atendimento, controle_recebimento |
| Oferta no Radar | `oferta` | garimpa_fornecedores |
| IA no Radar | `ia` | rota_crescimento |

---

## Arquivos Importantes

| Arquivo | Funcao |
|---------|--------|
| `packages/frontend/src/pages/ConfiguracoesTabelas.jsx` | TABLE_CATALOG + BUSINESS_MODULES (frontend) |
| `packages/backend/src/services/mapping.service.ts` | MappingService (backend) |
| `erp_templates` (PostgreSQL) | Templates de mapeamento por ERP |
| `database_connections` (PostgreSQL) | Mapeamento ativo em runtime |

---

**Atualizado em:** 12/02/2026
