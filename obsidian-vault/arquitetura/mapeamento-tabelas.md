# Mapeamento de Tabelas (v1 / v2)

**Regra principal:** NUNCA usar nomes de colunas/tabelas Oracle hardcoded no código. O sistema é multi-cliente e cada ERP pode ter nomes diferentes.

## 🎯 Por que existe
Sistema atende clientes com ERPs diferentes ([[oracle-intersolid|Intersolid]], Zanthus, SAP, [[../clientes/nunes|RP INFO]]...). Cada um com nomes de coluna diferentes. O mapeamento resolve na hora da query.

## 🏗️ Arquitetura (3 camadas)

```
1. TABLE_CATALOG (Frontend)           → Define campos na UI
2. erp_templates (PostgreSQL)         → Templates por ERP
3. database_connections (PostgreSQL)  → Mapeamento ativo em runtime
```

## 📐 Versões

### v1 (Clássico)
Organizado por **tipo de dados**:
```json
{
  "produtos": { "codigo_table": "TAB_PRODUTO" },
  "vendas": { ... }
}
```

### v2 (Por Módulos de Negócio - Hierárquico)
Organizado por **módulo/submódulo**:
```json
{
  "version": 2,
  "tabelas": { ... },
  "modulos": {
    "prevencao": {
      "submodulos": {
        "bipagens": ["TAB_PRODUTO", "TAB_PRODUTO_PDV"],
        ...
      }
    }
  }
}
```

## 🧩 Módulos v2

**Prevenção no Radar:**
- Bipagens, PDV, Facial, Rupturas, Etiquetas, Quebras

**Gestão no Radar:**
- [[../modulos/gestao-inteligente|Gestão Inteligente]], Estoque e Margem, [[../modulos/compra-venda|Compra e Venda]], Pedidos, Ruptura Indústria

## 🛠️ Como usar no código

```typescript
// ✅ CORRETO
const schema = await MappingService.getSchema();
const tabela = `${schema}.${await MappingService.getRealTableName('TAB_PRODUTO')}`;
const colCampo = await MappingService.getColumnFromTable('TAB_PRODUTO', 'cod_produto');

// ❌ ERRADO
const query = `SELECT p.COD_PRODUTO FROM INTERSOLID.TAB_PRODUTO p`;
```

## ✅ Checklist ao mexer em query Oracle
- [ ] Campos usam `getColumnFromTable`?
- [ ] Tabelas usam `getRealTableName`?
- [ ] Schema usa `getSchema`?
- [ ] NÃO tem `getColumnFromTable` com 3º parâmetro (fallback — proibido)?
- [ ] Campos existem no `TABLE_CATALOG` (ConfiguracoesTabelas.jsx)?
- [ ] Template INTERSOLID atualizado no banco?

## 🏷️ Tags
#arquitetura #mapeamento #oracle
