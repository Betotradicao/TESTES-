# Plano: Reestruturação do Mapeamento de Tabelas por Módulos de Negócio

## Objetivo
Reorganizar a interface de Mapeamento de Tabelas de **categorias de dados** (Produtos, Vendas, Estoque, etc.) para **módulos de negócio** (Prevenção no Radar, Gestão no Radar, etc.) com compartilhamento automático de tabelas comuns.

---

## Arquitetura Atual vs Nova

### ATUAL (por tipo de dados):
```
📋 Mapeamento
├── 📦 Produtos (16 campos)
├── 💰 Vendas/PDV (7 campos)
├── 📊 Estoque (5 campos)
├── 🏭 Fornecedores (5 campos)
└── 📑 Notas Fiscais (6 campos)
```

### NOVA (por módulo de negócio):
```
📋 Mapeamento
├── 🛡️ Prevenção no Radar
│   ├── TAB_PRODUTO (código, descrição, ean, preço, pesável, embalagem)
│   ├── TAB_OPERADORES (cod_operador, nome_operador)
│   └── TAB_PRODUTO_PDV (num_cupom, data_venda, valor, cod_caixa)
│
├── 📊 Gestão no Radar
│   ├── TAB_PRODUTO (código, descrição, curva, margem, seção, grupo, subgrupo)
│   ├── TAB_ESTOQUE (quantidade, tipo_movimento, data)
│   └── TAB_FORNECEDOR (codigo, razao_social, cnpj)
│
├── 🛒 Compra & Venda
│   ├── TAB_PRODUTO (código, descrição, preço_custo, preço_venda)
│   ├── TAB_PEDIDO_COMPRA (...)
│   └── TAB_NOTA_FISCAL (numero, serie, data, valor)
│
└── 💳 Frente de Caixa
    ├── TAB_PRODUTO_PDV (cupom, operador, pdv, valor)
    └── TAB_OPERADORES (cod_operador, nome_operador)
```

---

## Estrutura de Dados Nova

### Formato JSON para `database_connections.mappings`

```json
{
  "version": 2,
  "tabelas": {
    "TAB_PRODUTO": {
      "nome_real": "TAB_PRODUTO",
      "colunas": {
        "codigo_produto": "COD_PRODUTO",
        "descricao": "DES_PRODUTO",
        "ean": "COD_BARRAS",
        "preco_venda": "VAL_VENDA",
        "preco_custo": "VAL_CUSTO",
        "preco_oferta": "VAL_OFERTA",
        "estoque": "QTD_ESTOQUE",
        "margem": "PER_MARGEM",
        "curva": "TIP_CURVA",
        "secao": "COD_SECAO",
        "grupo": "COD_GRUPO",
        "subgrupo": "COD_SUBGRUPO",
        "fornecedor": "COD_FORNECEDOR",
        "pesavel": "FLG_PESAVEL",
        "embalagem": "QTD_EMBALAGEM",
        "descricao_reduzida": "DES_REDUZIDA"
      }
    },
    "TAB_PRODUTO_PDV": {
      "nome_real": "TAB_PRODUTO_PDV",
      "colunas": {
        "numero_cupom": "NUM_CUPOM_FISCAL",
        "data_venda": "DTA_VENDA",
        "valor_total": "VAL_TOTAL",
        "cod_operador": "COD_OPERADOR",
        "nome_operador": "DES_OPERADOR",
        "cod_pdv": "COD_CAIXA",
        "status_cupom": "FLG_CANCELADO"
      }
    },
    "TAB_OPERADORES": {
      "nome_real": "TAB_OPERADORES",
      "colunas": {
        "cod_operador": "COD_OPERADOR",
        "nome_operador": "NOM_OPERADOR"
      }
    },
    "TAB_ESTOQUE": {
      "nome_real": "TAB_ESTOQUE_MOV",
      "colunas": {
        "cod_produto": "COD_PRODUTO",
        "quantidade": "QTD_MOVIMENTO",
        "tipo_movimento": "TIP_MOVIMENTO",
        "data_movimento": "DTA_MOVIMENTO",
        "motivo": "DES_MOTIVO"
      }
    },
    "TAB_FORNECEDOR": {
      "nome_real": "TAB_FORNECEDOR",
      "colunas": {
        "codigo": "COD_FORNECEDOR",
        "razao_social": "NOM_FORNECEDOR",
        "fantasia": "NOM_FANTASIA",
        "cnpj": "NUM_CNPJ",
        "telefone": "NUM_TELEFONE"
      }
    },
    "TAB_NOTA_FISCAL": {
      "nome_real": "TAB_NOTA_ENT",
      "colunas": {
        "numero_nf": "NUM_NOTA",
        "serie": "NUM_SERIE",
        "data_entrada": "DTA_ENTRADA",
        "cod_fornecedor": "COD_FORNECEDOR",
        "valor_total": "VAL_TOTAL",
        "chave_acesso": "COD_CHAVE_NFE"
      }
    }
  },
  "modulos": {
    "prevencao": {
      "nome": "Prevenção no Radar",
      "icone": "🛡️",
      "tabelas_usadas": ["TAB_PRODUTO", "TAB_PRODUTO_PDV", "TAB_OPERADORES"],
      "campos_por_tabela": {
        "TAB_PRODUTO": ["codigo_produto", "descricao", "ean", "preco_venda", "preco_oferta", "pesavel", "embalagem"],
        "TAB_PRODUTO_PDV": ["numero_cupom", "data_venda", "valor_total", "cod_operador", "nome_operador", "cod_pdv"],
        "TAB_OPERADORES": ["cod_operador", "nome_operador"]
      }
    },
    "gestao": {
      "nome": "Gestão no Radar",
      "icone": "📊",
      "tabelas_usadas": ["TAB_PRODUTO", "TAB_ESTOQUE", "TAB_FORNECEDOR"],
      "campos_por_tabela": {
        "TAB_PRODUTO": ["codigo_produto", "descricao", "curva", "margem", "secao", "grupo", "subgrupo", "fornecedor", "preco_custo", "preco_venda", "estoque"],
        "TAB_ESTOQUE": ["cod_produto", "quantidade", "tipo_movimento", "data_movimento", "motivo"],
        "TAB_FORNECEDOR": ["codigo", "razao_social", "fantasia", "cnpj"]
      }
    },
    "compra_venda": {
      "nome": "Compra & Venda",
      "icone": "🛒",
      "tabelas_usadas": ["TAB_PRODUTO", "TAB_FORNECEDOR", "TAB_NOTA_FISCAL"],
      "campos_por_tabela": {
        "TAB_PRODUTO": ["codigo_produto", "descricao", "preco_custo", "preco_venda", "fornecedor"],
        "TAB_FORNECEDOR": ["codigo", "razao_social", "fantasia", "cnpj", "telefone"],
        "TAB_NOTA_FISCAL": ["numero_nf", "serie", "data_entrada", "cod_fornecedor", "valor_total", "chave_acesso"]
      }
    },
    "frente_caixa": {
      "nome": "Frente de Caixa",
      "icone": "💳",
      "tabelas_usadas": ["TAB_PRODUTO_PDV", "TAB_OPERADORES"],
      "campos_por_tabela": {
        "TAB_PRODUTO_PDV": ["numero_cupom", "data_venda", "valor_total", "cod_operador", "nome_operador", "cod_pdv", "status_cupom"],
        "TAB_OPERADORES": ["cod_operador", "nome_operador"]
      }
    }
  }
}
```

---

## Implementação

### FASE 1: Backend - Atualização do MappingService

**Arquivo:** `packages/backend/src/services/mapping.service.ts`

**Alterações:**
1. Manter compatibilidade com formato v1 (atual)
2. Adicionar suporte ao formato v2 (novo)
3. Novos métodos:
   - `getTableMapping(tableName: string)` - retorna mapeamento de uma tabela
   - `getColumnFromTable(tableName: string, fieldName: string, fallback?: string)` - busca coluna específica
   - `getModuleConfig(moduleId: string)` - retorna configuração do módulo
   - `isModuleConfigured(moduleId: string)` - verifica se módulo está completo

```typescript
// Novo método para buscar por tabela/campo
static async getColumnFromTable(
  tableName: string,
  fieldName: string,
  fallback?: string
): Promise<string> {
  const mappings = await this.getMappings();

  // Formato v2
  if (mappings.version === 2 && mappings.tabelas?.[tableName]?.colunas?.[fieldName]) {
    return mappings.tabelas[tableName].colunas[fieldName];
  }

  // Fallback para formato v1 ou hardcode
  return fallback || fieldName.toUpperCase();
}
```

---

### FASE 2: Backend - Novo Endpoint para Salvar por Tabela

**Arquivo:** `packages/backend/src/controllers/database-connections.controller.ts`

**Novo Endpoint:** `POST /database-connections/save-table-mapping`

```typescript
interface SaveTableMappingRequest {
  connectionId: number;
  tableName: string;           // Ex: "TAB_PRODUTO"
  realTableName: string;       // Nome real no banco: "TAB_PRODUTO"
  columns: {
    [fieldName: string]: string; // Ex: { "codigo_produto": "COD_PRODUTO" }
  };
}
```

**Lógica:**
1. Carrega mappings existentes da conexão
2. Atualiza/cria entrada na seção `tabelas`
3. Se outras tabelas já existiam, mantém elas
4. Salva JSON atualizado

---

### FASE 3: Frontend - Nova Estrutura de Constantes

**Arquivo:** `packages/frontend/src/pages/ConfiguracoesTabelas.jsx`

**Substituir `SYSTEM_MODULES` por `BUSINESS_MODULES`:**

```javascript
const BUSINESS_MODULES = [
  {
    id: 'prevencao',
    name: 'Prevenção no Radar',
    icon: '🛡️',
    description: 'Monitoramento de bipagens, verificação de vendas e alertas de prevenção',
    color: 'from-red-500 to-orange-500',
    tables: [
      {
        id: 'TAB_PRODUTO',
        name: 'Produtos',
        description: 'Dados dos produtos monitorados',
        fields: [
          { id: 'codigo_produto', name: 'Código do Produto', required: true },
          { id: 'descricao', name: 'Descrição', required: true },
          { id: 'ean', name: 'Código de Barras (EAN)', required: true },
          { id: 'preco_venda', name: 'Preço de Venda', required: true },
          { id: 'preco_oferta', name: 'Preço de Oferta', required: false },
          { id: 'pesavel', name: 'Flag Pesável', required: false },
          { id: 'embalagem', name: 'Qtd Embalagem', required: false },
        ]
      },
      {
        id: 'TAB_PRODUTO_PDV',
        name: 'Vendas PDV',
        description: 'Dados de vendas do frente de caixa',
        fields: [
          { id: 'numero_cupom', name: 'Número do Cupom', required: true },
          { id: 'data_venda', name: 'Data da Venda', required: true },
          { id: 'valor_total', name: 'Valor Total', required: true },
          { id: 'cod_operador', name: 'Código Operador', required: true },
          { id: 'nome_operador', name: 'Nome Operador', required: false },
          { id: 'cod_pdv', name: 'Código PDV/Caixa', required: true },
        ]
      },
      {
        id: 'TAB_OPERADORES',
        name: 'Operadores',
        description: 'Cadastro de operadores de caixa',
        fields: [
          { id: 'cod_operador', name: 'Código Operador', required: true },
          { id: 'nome_operador', name: 'Nome Operador', required: true },
        ]
      }
    ]
  },
  {
    id: 'gestao',
    name: 'Gestão no Radar',
    icon: '📊',
    description: 'Análise de vendas, curvas ABC, margens e indicadores de gestão',
    color: 'from-blue-500 to-indigo-500',
    tables: [
      {
        id: 'TAB_PRODUTO',
        name: 'Produtos',
        description: 'Dados completos dos produtos para análise',
        fields: [
          { id: 'codigo_produto', name: 'Código do Produto', required: true },
          { id: 'descricao', name: 'Descrição', required: true },
          { id: 'curva', name: 'Curva ABC', required: false },
          { id: 'margem', name: 'Margem %', required: false },
          { id: 'secao', name: 'Código Seção', required: false },
          { id: 'grupo', name: 'Código Grupo', required: false },
          { id: 'subgrupo', name: 'Código Subgrupo', required: false },
          { id: 'fornecedor', name: 'Código Fornecedor', required: false },
          { id: 'preco_custo', name: 'Preço de Custo', required: true },
          { id: 'preco_venda', name: 'Preço de Venda', required: true },
          { id: 'estoque', name: 'Qtd Estoque', required: false },
        ]
      },
      {
        id: 'TAB_ESTOQUE',
        name: 'Movimentação de Estoque',
        description: 'Histórico de movimentações de estoque',
        fields: [
          { id: 'cod_produto', name: 'Código do Produto', required: true },
          { id: 'quantidade', name: 'Quantidade', required: true },
          { id: 'tipo_movimento', name: 'Tipo Movimento', required: true },
          { id: 'data_movimento', name: 'Data Movimento', required: true },
          { id: 'motivo', name: 'Motivo', required: false },
        ]
      },
      {
        id: 'TAB_FORNECEDOR',
        name: 'Fornecedores',
        description: 'Cadastro de fornecedores',
        fields: [
          { id: 'codigo', name: 'Código Fornecedor', required: true },
          { id: 'razao_social', name: 'Razão Social', required: true },
          { id: 'fantasia', name: 'Nome Fantasia', required: false },
          { id: 'cnpj', name: 'CNPJ', required: false },
        ]
      }
    ]
  },
  {
    id: 'compra_venda',
    name: 'Compra & Venda',
    icon: '🛒',
    description: 'Gestão de pedidos, notas fiscais e relacionamento com fornecedores',
    color: 'from-green-500 to-teal-500',
    tables: [
      {
        id: 'TAB_PRODUTO',
        name: 'Produtos',
        description: 'Dados de produtos para compras',
        fields: [
          { id: 'codigo_produto', name: 'Código do Produto', required: true },
          { id: 'descricao', name: 'Descrição', required: true },
          { id: 'preco_custo', name: 'Preço de Custo', required: true },
          { id: 'preco_venda', name: 'Preço de Venda', required: true },
          { id: 'fornecedor', name: 'Código Fornecedor', required: false },
        ]
      },
      {
        id: 'TAB_FORNECEDOR',
        name: 'Fornecedores',
        description: 'Cadastro completo de fornecedores',
        fields: [
          { id: 'codigo', name: 'Código Fornecedor', required: true },
          { id: 'razao_social', name: 'Razão Social', required: true },
          { id: 'fantasia', name: 'Nome Fantasia', required: false },
          { id: 'cnpj', name: 'CNPJ', required: false },
          { id: 'telefone', name: 'Telefone', required: false },
        ]
      },
      {
        id: 'TAB_NOTA_FISCAL',
        name: 'Notas Fiscais',
        description: 'Notas fiscais de entrada',
        fields: [
          { id: 'numero_nf', name: 'Número NF', required: true },
          { id: 'serie', name: 'Série', required: false },
          { id: 'data_entrada', name: 'Data Entrada', required: true },
          { id: 'cod_fornecedor', name: 'Código Fornecedor', required: true },
          { id: 'valor_total', name: 'Valor Total', required: true },
          { id: 'chave_acesso', name: 'Chave de Acesso NFe', required: false },
        ]
      }
    ]
  },
  {
    id: 'frente_caixa',
    name: 'Frente de Caixa',
    icon: '💳',
    description: 'Monitoramento de cupons fiscais, operadores e PDVs',
    color: 'from-purple-500 to-pink-500',
    tables: [
      {
        id: 'TAB_PRODUTO_PDV',
        name: 'Vendas PDV',
        description: 'Dados completos de vendas',
        fields: [
          { id: 'numero_cupom', name: 'Número do Cupom', required: true },
          { id: 'data_venda', name: 'Data da Venda', required: true },
          { id: 'valor_total', name: 'Valor Total', required: true },
          { id: 'cod_operador', name: 'Código Operador', required: true },
          { id: 'nome_operador', name: 'Nome Operador', required: false },
          { id: 'cod_pdv', name: 'Código PDV/Caixa', required: true },
          { id: 'status_cupom', name: 'Status (Cancelado)', required: false },
        ]
      },
      {
        id: 'TAB_OPERADORES',
        name: 'Operadores',
        description: 'Cadastro de operadores de caixa',
        fields: [
          { id: 'cod_operador', name: 'Código Operador', required: true },
          { id: 'nome_operador', name: 'Nome Operador', required: true },
        ]
      }
    ]
  }
];

// Mapa de compartilhamento: quais módulos usam cada tabela
const TABLE_SHARING = {
  'TAB_PRODUTO': ['prevencao', 'gestao', 'compra_venda'],
  'TAB_PRODUTO_PDV': ['prevencao', 'frente_caixa'],
  'TAB_OPERADORES': ['prevencao', 'frente_caixa'],
  'TAB_ESTOQUE': ['gestao'],
  'TAB_FORNECEDOR': ['gestao', 'compra_venda'],
  'TAB_NOTA_FISCAL': ['compra_venda'],
};
```

---

### FASE 4: Frontend - Nova UI com Tabs por Módulo

**Alterações no `renderMappingTab()`:**

1. **Sub-tabs horizontais** para cada módulo de negócio:
```
[🛡️ Prevenção] [📊 Gestão] [🛒 Compra & Venda] [💳 Frente de Caixa]
```

2. **Dentro de cada módulo**, accordion com tabelas:
```
▼ TAB_PRODUTO (5 de 7 campos configurados)
   Campo             | Tabela        | Coluna
   Código do Produto | TAB_PRODUTO   | COD_PRODUTO
   Descrição         | TAB_PRODUTO   | DES_PRODUTO
   ...

▼ TAB_PRODUTO_PDV (3 de 6 campos configurados)
   ...
```

3. **Indicador visual de compartilhamento:**
   - Quando uma tabela é usada por múltiplos módulos, mostrar badge:
   - "🔗 Compartilhada com: Gestão, Compra & Venda"

4. **Auto-preenchimento:**
   - Ao salvar TAB_PRODUTO no módulo Prevenção
   - Automaticamente preenche TAB_PRODUTO nos módulos Gestão e Compra & Venda
   - Campos que não existem no outro módulo são ignorados

---

### FASE 5: Frontend - Lógica de Compartilhamento

**Nova função `handleSaveTableMapping()`:**

```javascript
const handleSaveTableMapping = async (tableId, tableName, columns) => {
  // 1. Salvar no backend
  await api.post('/database-connections/save-table-mapping', {
    connectionId: selectedConnection.id,
    tableName: tableId,
    realTableName: tableName,
    columns
  });

  // 2. Atualizar estado local para todos os módulos que usam essa tabela
  const sharingModules = TABLE_SHARING[tableId] || [];

  setMappings(prev => {
    const newMappings = { ...prev };

    // Para cada módulo que compartilha essa tabela
    sharingModules.forEach(moduleId => {
      const module = BUSINESS_MODULES.find(m => m.id === moduleId);
      const tableConfig = module.tables.find(t => t.id === tableId);

      if (tableConfig) {
        // Preencher apenas os campos que esse módulo usa
        tableConfig.fields.forEach(field => {
          if (columns[field.id]) {
            newMappings[`${tableId}_${field.id}_table`] = tableName;
            newMappings[`${tableId}_${field.id}_column`] = columns[field.id];
          }
        });
      }
    });

    return newMappings;
  });

  // 3. Mostrar toast de sucesso com lista de módulos atualizados
  toast.success(`Tabela ${tableId} salva! Atualizada em: ${sharingModules.join(', ')}`);
};
```

---

### FASE 6: Migração de Dados

**Script de migração** para converter formato v1 → v2:

```typescript
// packages/backend/src/scripts/migrate-mappings-v2.ts

async function migrateMappingsToV2() {
  const connections = await AppDataSource.getRepository(DatabaseConnection).find();

  for (const conn of connections) {
    if (!conn.mappings) continue;

    const oldMappings = JSON.parse(conn.mappings);

    // Se já é v2, pular
    if (oldMappings.version === 2) continue;

    // Converter v1 para v2
    const newMappings = {
      version: 2,
      tabelas: {},
      modulos: {
        prevencao: { tabelas_usadas: [], campos_por_tabela: {} },
        gestao: { tabelas_usadas: [], campos_por_tabela: {} },
        compra_venda: { tabelas_usadas: [], campos_por_tabela: {} },
        frente_caixa: { tabelas_usadas: [], campos_por_tabela: {} },
      }
    };

    // Mapeamento de campos antigos para tabelas
    const fieldToTable = {
      'codigo': 'TAB_PRODUTO',
      'descricao': 'TAB_PRODUTO',
      'ean': 'TAB_PRODUTO',
      // ... etc
    };

    // Processar cada módulo antigo
    for (const [moduleKey, moduleData] of Object.entries(oldMappings)) {
      if (moduleKey === 'version') continue;

      for (const [fieldKey, value] of Object.entries(moduleData)) {
        // Extrair campo e tipo (table/column)
        const match = fieldKey.match(/^(.+)_(table|column)$/);
        if (!match) continue;

        const [, fieldName, type] = match;
        const tableId = fieldToTable[fieldName] || 'TAB_PRODUTO';

        // Criar estrutura da tabela se não existir
        if (!newMappings.tabelas[tableId]) {
          newMappings.tabelas[tableId] = { nome_real: '', colunas: {} };
        }

        if (type === 'table') {
          newMappings.tabelas[tableId].nome_real = value;
        } else {
          newMappings.tabelas[tableId].colunas[fieldName] = value;
        }
      }
    }

    // Salvar
    conn.mappings = JSON.stringify(newMappings);
    await AppDataSource.getRepository(DatabaseConnection).save(conn);
  }
}
```

---

## Cronograma de Execução

### Etapa 1: Backend (2-3 horas)
1. ✅ Atualizar `MappingService` com suporte a v2
2. ✅ Criar endpoint `save-table-mapping`
3. ✅ Criar script de migração v1 → v2
4. ✅ Testar compatibilidade backward

### Etapa 2: Frontend - Estrutura (2-3 horas)
1. ✅ Criar constante `BUSINESS_MODULES`
2. ✅ Criar constante `TABLE_SHARING`
3. ✅ Refatorar `renderMappingTab()` para usar tabs por módulo
4. ✅ Implementar accordion por tabela

### Etapa 3: Frontend - Lógica (2-3 horas)
1. ✅ Implementar `handleSaveTableMapping()`
2. ✅ Implementar auto-preenchimento entre módulos
3. ✅ Atualizar indicadores visuais de status
4. ✅ Adicionar badges de compartilhamento

### Etapa 4: Testes e Deploy (1-2 horas)
1. ✅ Testar migração de dados existentes
2. ✅ Testar UI em todos os módulos
3. ✅ Testar compartilhamento de tabelas
4. ✅ Deploy em produção

---

## Benefícios da Nova Arquitetura

1. **Organização por contexto de uso**: Usuário sabe exatamente o que configurar para cada módulo
2. **Compartilhamento automático**: Configurar TAB_PRODUTO uma vez serve para todos os módulos
3. **Redução de trabalho**: Menos campos para preencher manualmente
4. **Visibilidade clara**: Badge indica quais módulos serão afetados
5. **Migração gradual**: Pode migrar módulo por módulo
6. **Compatibilidade**: Formato v1 continua funcionando

---

## Arquivos a Modificar

| Arquivo | Tipo | Descrição |
|---------|------|-----------|
| `mapping.service.ts` | Backend | Suporte a formato v2 |
| `database-connections.controller.ts` | Backend | Novo endpoint save-table-mapping |
| `ConfiguracoesTabelas.jsx` | Frontend | Nova UI com tabs por módulo |
| `migrate-mappings-v2.ts` | Script | Migração de dados existentes |

---

**Última atualização:** Fevereiro 2026
