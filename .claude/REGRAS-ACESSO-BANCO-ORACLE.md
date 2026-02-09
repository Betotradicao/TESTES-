# REGRAS DE ACESSO AO BANCO ORACLE - SOMENTE LEITURA

## REGRA DE OURO: APENAS SELECT!

O usuario POWERBI tem APENAS permissao de SELECT. Qualquer INSERT/UPDATE/DELETE sera rejeitado pelo banco.

### PROIBIDO:
```sql
INSERT, UPDATE, DELETE, DROP, TRUNCATE, ALTER, CREATE, GRANT, REVOKE
```

### PERMITIDO:
```sql
SELECT ... FROM ...  -- APENAS CONSULTAS
```

## Credenciais de Acesso

| Campo | Valor |
|-------|-------|
| Host (rede local) | `10.6.1.100` |
| Host (VPS via tunel) | `host.docker.internal` |
| Porta | `1521` |
| Service Name | `orcl.intersoul` |
| Usuario | `POWERBI` |
| Senha | `OdRz6J4LY6Y6` |
| Schema | `INTERSOLID` |
| Tipo | Oracle |

**Schema INTERSOLID:** Igual para todos os clientes que usam Intersolid. E o namespace das tabelas no Oracle.

**Senha sempre visivel no frontend** (sem mascaramento com ***).

## Ambientes de Conexao

| Ambiente | Host Oracle | Como conecta |
|----------|-------------|--------------|
| Local (dev) | `10.6.1.100` | Direto na rede local |
| VPS (Docker) | `host.docker.internal` | Via tunel SSH reverso |

Na VPS, o backend usa `host.docker.internal` que aponta para o host da VPS, onde o tunel SSH escuta na porta configurada.

## Consultas Uteis (Seguras)

```sql
-- Ver tabelas
SELECT TABLE_NAME FROM ALL_TABLES WHERE OWNER = 'INTERSOLID' AND ROWNUM <= 50;

-- Ver colunas
SELECT COLUMN_NAME, DATA_TYPE FROM ALL_TAB_COLUMNS
WHERE TABLE_NAME = 'NOME_TABELA' AND OWNER = 'INTERSOLID';

-- Contar registros
SELECT COUNT(*) FROM INTERSOLID.tabela;

-- Buscar com limite
SELECT * FROM INTERSOLID.tabela WHERE ROWNUM <= 10;
```

## Checklist Antes de Qualquer Consulta

- O comando comeca com SELECT?
- NAO contem INSERT, UPDATE, DELETE, DROP?
- Tem ROWNUM ou FETCH FIRST para limitar resultados?

Se alguma resposta for NAO, nao execute!

---

**Atualizado em:** 09/02/2026
