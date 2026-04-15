# Nunes

Cliente com **ERP diferente dos demais** — usa **RP INFO com PostgreSQL** (não Oracle Intersolid).

## ⚠️ ATENÇÃO ESPECIAL
**Nunes NÃO é Oracle.** Tem código bifurcado em várias partes do backend pra suportar Postgres. Antes de alterar query, verificar se existe versão `*PostgresErp` do método.

## 🔌 ERP
- **Banco:** PostgreSQL (não Oracle)
- **Sistema ERP:** RP INFO
- Tabelas mapeadas:
  - `vdonlineprod` — vendas online/produtos
  - `movprodd` — movimento produtos detalhado
  - `movfpdvc` — movimento financeiro PDV cupom

## 🏗️ Bifurcação no código
Backend tem padrão:
```typescript
const dbType = await this.detectActiveDbType();
if (dbType === 'postgresql') {
  return this.buscarXPostgresErp(...);
}
// ... código Oracle padrão
```

Métodos já bifurcados (exemplos):
- `buscarVendasPorSetorPeriodoPostgresErp`
- `buscarIndicadoresPeriodoPostgresErp`

## ⚠️ Cuidados ao implementar
- Ao adicionar query nova que lê dados do ERP, criar **as duas versões** (Oracle + Postgres)
- Média linear (histórico do ano anterior) pode não existir no Nunes — variável `skipML`
- Filtros de TIPO_SAIDA podem ter códigos diferentes em cada ERP

## 🏷️ Tags
#cliente #postgres #rp-info #bifurcacao-especial
