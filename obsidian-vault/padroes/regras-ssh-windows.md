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

## 🔗 Relacionados
- [[../arquitetura/deploy|Deploy]]
- [[../arquitetura/estrutura-vps|Estrutura VPS]]

## 🏷️ Tags
#padrao #ssh #windows #devops
