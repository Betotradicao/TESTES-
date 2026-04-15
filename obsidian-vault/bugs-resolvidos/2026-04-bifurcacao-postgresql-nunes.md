# Feature: Bifurcação PostgreSQL para cliente Nunes

**Data:** 2026-04 (vários commits)
**Cliente afetado:** [[../clientes/nunes|Nunes]]
**Tipo:** Feature grande / Migração

## 🎯 Objetivo
Suportar cliente [[../clientes/nunes|Nunes]] que usa ERP **RP INFO com PostgreSQL**, em um sistema originalmente feito para Oracle Intersolid.

## 🏗️ Abordagem
Bifurcação nos métodos do backend via `detectActiveDbType()`:

```typescript
const dbType = await this.detectActiveDbType();
if (dbType === 'postgresql') {
  return this.buscarXPostgresErp(...);
}
// código Oracle padrão
```

## 📝 Módulos bifurcados (commits)
- **Vision Palavra Chave** (`5396752`) — feat: bifurcar para PostgreSQL
- **Frente de Caixa** (`f73cafa`) — feat: bifurcar para PostgreSQL
- **Filtro loja** (`cd0f44d`) — cast int no filtro loja
- **Dedup vdadet** (`a780e19`) — UNION PG precisa deduplicar por loja
- **Custo PG** (`da466e9`) — usar `custoentrada + ICMS` (sem PIS/COFINS)
- **Venda Flex EVD** (`9bffee7`) — somar EVD do `movprodd` nas vendas
- **Troco + finalizadoras** (`281108e`) — subtrair troco do dinheiro
- **Convênio separado** (`1b65660`) — campo Convênio Clientes separado
- **Operadores + produto descontos** (`8d07124`)
- **Cupom zero à esquerda** (`ec38164`) — `::int` cast no PG
- **Params finalizadora** (`1b31354`) — sem `codLoja` fantasma em `$3`

## 🗄️ Tabelas PostgreSQL mapeadas (Nunes)
- `vdonlineprod`
- `movprodd`
- `movfpdvc`
- `vdadet`

## 📝 Lições
- Sempre ao mexer em query Oracle, perguntar: "existe versão `*PostgresErp`?"
- Nomes de campo diferem muito entre Oracle e PG do RP INFO — mapear caso a caso
- Custo no PG = `custoentrada + ICMS` (sem PIS/COFINS — compliance diferente)

## 🏷️ Tags
#feature #multi-erp #postgresql #nunes #2026-04
