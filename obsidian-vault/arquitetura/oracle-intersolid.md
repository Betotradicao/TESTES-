# Oracle Intersolid

ERP usado pela maioria dos clientes (Tradição, SuperVital, MaxValle). **Nunes é exceção** ([[../clientes/nunes|Nunes usa Postgres]]).

## 🔐 Credenciais de Acesso

| Campo | Valor |
|-------|-------|
| Host (rede local) | `10.6.1.100` |
| Host (VPS via túnel) | `host.docker.internal` |
| Porta | `1521` |
| Service Name | `orcl.intersoul` |
| Usuário | `POWERBI` |
| Senha | `OdRz6J4LY6Y6` |
| Schema | `INTERSOLID` |

## ⚠️ REGRA DE OURO: APENAS SELECT!

O usuário **POWERBI tem APENAS permissão de SELECT**. Qualquer INSERT/UPDATE/DELETE é rejeitado.

**PROIBIDO:** `INSERT, UPDATE, DELETE, DROP, TRUNCATE, ALTER, CREATE, GRANT, REVOKE`

## 📦 Principais Tabelas
- `TAB_PRODUTO` — catálogo de produtos
- `TAB_PRODUTO_PDV` — movimento de vendas do PDV
- `TAB_PRODUTO_LOJA` — estoque por loja
- `TAB_OPERADORES` — operadores
- `TAB_SECAO` — seções/setores
- `TAB_FORNECEDOR` — fornecedores

## 🛠️ Como consultar (backend)
**NUNCA hardcode!** Usar [[mapeamento-tabelas|MappingService]]:

```typescript
const schema = await MappingService.getSchema();
const tabela = `${schema}.${await MappingService.getRealTableName('TAB_PRODUTO')}`;
const colCampo = await MappingService.getColumnFromTable('TAB_PRODUTO', 'cod_produto');
```

## 🐳 Dockerfile Backend
Deve usar `node:18-slim` (NÃO Alpine) + Oracle Instant Client 23.4 para **Thick mode**. Servidores Oracle antigos como o Intersolid falham com Thin mode (erro `NJS-138`).

## 🏷️ Tags
#arquitetura #oracle #erp #intersolid
