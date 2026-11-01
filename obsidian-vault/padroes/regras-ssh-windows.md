# SSH no Windows (PowerShell Wrapper)

## ⚠️ Problema
No Git Bash do Windows, o `ssh` executa os comandos na VPS, mas a **saída (stdout) não é capturada**. O comando funciona, mas o resultado não aparece.

## ✅ Solução
Usar PowerShell como wrapper:

```bash
# ❌ ERRADO (saída não aparece)
ssh vps2-hostinger "docker logs prevencao-tradicao-backend --tail 30"

# ✅ CORRETO
powershell -Command "& { ssh vps2-hostinger 'docker logs prevencao-tradicao-backend --tail 30 2>&1' | Out-String }"
```

## 📐 Padrão Universal
```bash
powershell -Command "& { ssh vps2-hostinger 'COMANDO_AQUI 2>&1' | Out-String }"
```

- `2>&1` → redireciona stderr para stdout (captura tudo)
- `| Out-String` → converte saída pra texto no PowerShell
- `& { ... }` → executa como bloco de script

## 🔎 Consulta avulsa no Oracle: **mande um ARQUIVO, nao uma string**

Query de uma linha ate passa, mas SQL de verdade morre no caminho
PowerShell → ssh → bash → `node -e`: cada camada come um nivel de aspas, e
`count(*)`/`SELECT ... 'x'` viram `syntax error near unexpected token '('`.
Perde-se mais tempo escapando aspas do que escrevendo a consulta.

**O caminho que funciona de primeira** — arquivo, nunca string:

```bash
scp consulta.js vps2-hostinger:/tmp/consulta.js
ssh vps2-hostinger "docker cp /tmp/consulta.js prevencao-<cliente>-backend:/tmp/consulta.js"
ssh vps2-hostinger "docker exec prevencao-<cliente>-backend node /tmp/consulta.js > /tmp/saida.txt 2>&1; grep '### ' /tmp/saida.txt"
```

O script roda **dentro do container**, entao reaproveita o que ja esta compilado:

```js
const { AppDataSource } = require('/app/dist/config/database');   // MappingService precisa dele
const { MappingService } = require('/app/dist/services/mapping.service');
const { OracleService }  = require('/app/dist/services/oracle.service');
```

⚠️ **`AppDataSource.initialize()` antes de tudo** — o `MappingService` le os
mapeamentos do Postgres; sem isso ele devolve o literal da chave e o Oracle
responde `ORA-00904`.

⚠️ **Backtick e escape do PowerShell.** `` `wc -c` `` dentro de aspas duplas
quebra o parser com *"a cadeia de caracteres nao tem o terminador"*. Usar
`grep -c .` ou rodar no lado remoto sem substituicao de comando.

⚠️ **Saida grande:** gravar em arquivo no container e puxar so a linha de
interesse (`grep -A1 'JSON###' | tail -1`). Despejar 100 KB no stdout do ssh
trunca e ainda polui o terminal.

> 🔐 Encadear com `base64 -d | bash` **nao** e alternativa — o classificador
> do Claude Code bloqueia por parecer ofuscacao. Arquivo resolve e fica auditavel.

## 🔗 Relacionados
- [[../arquitetura/deploy|Deploy]]
- [[../arquitetura/estrutura-vps|Estrutura VPS]]

## 🏷️ Tags
#padrao #ssh #windows #devops
