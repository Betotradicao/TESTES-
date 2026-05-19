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

## ⚠️ ARMADILHA — Deletar conexão apaga mapeamento

O JSON `mappings` fica **dentro** da própria linha de `database_connections`. Se deletar a conexão (ex: pra recriar do zero), **TODO o mapeamento vai junto**. Não é tabela separada com FK — é coluna text na mesma tabela.

**Sintoma:** "0/10 submódulos pendentes" depois de mexer na conexão. Mapeamento da Gestão Inteligente/Bipagens em branco.

**Como recuperar (se existe backup):**
```bash
# Extrai mappings do dump SQL
awk '/COPY public.database_connections/,/^\\.$/' backup.sql | sed -n '2p' | awk -F'\t' '{print $18}' > mappings.json

# Aplica no banco com dollar-quote pra evitar escape hell
{ printf 'UPDATE database_connections SET mappings = $X$'; cat mappings.json; printf '$X$, erp_type = '\''rpinfo'\'' WHERE id = N;\n'; } > restore.sql
docker cp restore.sql container:/tmp/ && docker exec container psql -U postgres -d DB -f /tmp/restore.sql

# Reiniciar backend pra recarregar pool
docker restart prevencao-CLIENTE-backend
```

**Como evitar:** **NUNCA delete** a conexão pra mudar IP/porta. Use o botão **Editar** e altere campo a campo. Salvar mantém o `mappings` intacto.

**Armadilha extra ao recriar conexão PostgreSQL:**
- Campo **Schema** parece opcional no form (não tem asterisco), mas `MappingService.getSchema()` joga erro `[MappingService] Schema não configurado` se ficar vazio. Pra Postgres usa `'public'`.
- Campo **is_default** não aparece no form e fica `false`. O MappingService busca conexão por `is_default = true` primeiro. Setar manualmente após criar:
  ```sql
  UPDATE database_connections SET schema = 'public', is_default = true WHERE id = N;
  ```

**Caso real:** 2026-05-11 — usuário deletou conexão do Nunes pra recriar com IP fixo (`200.152.5.187:10835`). Mapeamento RP INFO completo (~6.8KB JSON) sumiu. Recuperado de `/root/backup-nunes-pre-deploy-2026-05-06.sql` na VPS.

## ✅ Checklist ao mexer em query Oracle
- [ ] Campos usam `getColumnFromTable`?
- [ ] Tabelas usam `getRealTableName`?
- [ ] Schema usa `getSchema`?
- [ ] NÃO tem `getColumnFromTable` com 3º parâmetro (fallback — proibido)?
- [ ] Campos existem no `TABLE_CATALOG` (ConfiguracoesTabelas.jsx)?
- [ ] Template INTERSOLID atualizado no banco?

## 🏷️ Tags
#arquitetura #mapeamento #oracle
