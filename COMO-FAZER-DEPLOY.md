# 🚀 Como Fazer Deploy do Módulo Controle PDV

## 📋 Resumo do que foi implementado

✅ **Backend:**
- 3 novas tabelas no banco (operadores, motivos_desconto, autorizadores)
- 8 novos endpoints REST (/api/pdv/*)
- Serviço de consulta à API Zanthus com campos de operador, desconto e devolução

✅ **Frontend:**
- Nova página "Controle PDV" com gráficos e análises
- Menu adicionado em "Prevenção PDV > Controle PDV"

---

## 🎯 Opção 1: Deploy Automático (RECOMENDADO)

### Passo 1: Conectar na VPS
```bash
ssh root@145.223.92.152
```

### Passo 2: Baixar e executar o script de deploy
```bash
cd /root/TESTES
git pull
bash DEPLOY-CONTROLE-PDV.sh
```

O script fará tudo automaticamente:
- ✅ Baixa código novo
- ✅ Reconstrói backend e frontend
- ✅ Reinicia containers (SEM afetar banco de dados)
- ✅ Roda migrations automaticamente
- ✅ Mostra logs para confirmar

**Tempo estimado:** 2-3 minutos

---

## ⚙️ Opção 2: Deploy Manual (Passo a Passo)

### Passo 1: Conectar na VPS
```bash
ssh root@145.223.92.152
```

### Passo 2: Baixar código novo do GitHub
```bash
cd /root/TESTES
git pull origin main
```

**O que acontece:** Baixa as mudanças que você fez (commit + push)

---

### Passo 3: Ir para pasta do Docker
```bash
cd /root/TESTES/InstaladorVPS
```

---

### Passo 4: Reconstruir Backend
```bash
docker compose -f docker-compose-producao.yml build --no-cache backend
```

**O que acontece:**
- Compila o código TypeScript novo
- Inclui a migration nova (tabelas PDV)
- Prepara o backend para rodar

**Tempo:** ~1 minuto

---

### Passo 5: Reconstruir Frontend
```bash
docker compose -f docker-compose-producao.yml build --no-cache frontend
```

**O que acontece:**
- Compila o React/Vite
- Inclui a página ControlePDV.jsx
- Atualiza o menu do Sidebar

**Tempo:** ~1-2 minutos

---

### Passo 6: Reiniciar Containers
```bash
docker compose -f docker-compose-producao.yml up -d --no-deps frontend backend cron
```

**O que acontece:**
- Reinicia APENAS frontend, backend e cron
- NÃO mexe no PostgreSQL (banco de dados seguro!)
- NÃO mexe no MinIO (arquivos seguros!)

**Flags importantes:**
- `--no-deps` = NÃO reinicia dependências (banco)
- `-d` = Roda em background (detached)

**Tempo:** ~10 segundos

---

### Passo 7: Verificar se Migrations Rodaram
```bash
docker logs prevencao-backend-prod --tail 50
```

**O que procurar:**
```
[info] Running migrations...
[info] CreatePDVMappingTables1767800000000 is being executed
[info] Migration CreatePDVMappingTables1767800000000 has been executed successfully
```

Se ver isso, as tabelas foram criadas! ✅

---

## 🧪 Testando se Funcionou

### 1. Acessar o Sistema
```
http://145.223.92.152:3000
```

### 2. Fazer Login
Use suas credenciais normais

### 3. Acessar Controle PDV
1. Clique no menu lateral "**Prevenção PDV**"
2. Clique em "**Controle PDV**"

### 4. O que você deve ver:
- ✅ Filtros de data (dia 1 do mês até hoje)
- ✅ 3 cards: Total Vendas, Descontos, Devoluções
- ✅ 2 gráficos (barras e pizza)
- ✅ Tabela de performance por operador
- ✅ Tabelas detalhadas

### 5. Se der erro:
```bash
# Ver logs do backend
docker logs prevencao-backend-prod --tail 100 -f

# Ver logs do frontend
docker logs prevencao-frontend-prod --tail 50
```

---

## ❓ Perguntas Frequentes

### Q: "Vai perder dados do banco?"
**R:** NÃO! Usamos `--no-deps` que NÃO recria o container do PostgreSQL.

---

### Q: "Precisa configurar algo depois?"
**R:** SIM! Você precisa cadastrar os nomes reais dos operadores, motivos e autorizadores. Por enquanto, eles aparecem como "Operador 185", "Motivo 10", etc.

**Como fazer:**
1. Acesse os endpoints CRUD:
   - `GET /api/pdv/operadores` (lista todos)
   - `PUT /api/pdv/operadores/:id` (edita um)

2. Ou aguarde a interface de cadastro que será implementada depois

---

### Q: "Como sei quais códigos usar?"
**R:** Na investigação anterior, encontramos:

**Operadores:**
- 185, 207, 275, 459, 3557, 3649, 5948

**Motivos de Desconto:**
- 10, 20

**Autorizadores:**
- 3, 28

Você precisa descobrir o nome real de cada um olhando no sistema Zanthus ou perguntando ao gerente.

---

## 🔧 Comandos Úteis Pós-Deploy

### Ver status dos containers
```bash
docker ps
```

### Ver logs em tempo real
```bash
docker logs prevencao-backend-prod -f
```

### Reiniciar só o backend (se precisar)
```bash
docker compose -f docker-compose-producao.yml restart backend
```

### Verificar se tabelas foram criadas no banco
```bash
docker exec -it prevencao-postgres-prod psql -U admin -d prevencao_db -c "\dt"
```

Deve mostrar:
- `operadores`
- `motivos_desconto`
- `autorizadores`

---

## 📊 Campos da API Zanthus Que Usamos

| Campo | Descrição | Uso |
|-------|-----------|-----|
| M43CZ | Código do operador | Identifica quem fez a venda |
| M43AQ | Valor do desconto | Quanto foi descontado |
| M43DF | Código motivo desconto | Por que deu desconto |
| M43DG | Código autorizador | Quem autorizou o desconto |
| M43AO | Quantidade (negativa = devolução) | Detecta devoluções |
| M00AD | Número do cupom fiscal | Identificação da venda |
| M00AC | Número do caixa | Qual PDV foi usado |

---

## 🎯 Próximos Passos (Opcional)

1. ✅ Deploy feito e funcionando
2. ⏳ Cadastrar nomes reais dos operadores/motivos
3. ⏳ Criar tela de cadastro de mapeamentos
4. ⏳ Adicionar filtros por operador específico
5. ⏳ Adicionar exportação para Excel/PDF

---

## ⚠️ Se Algo Der Errado

### Erro: "Cannot GET /api/pdv/resumo"
**Causa:** Backend não reiniciou corretamente
**Solução:**
```bash
docker compose -f docker-compose-producao.yml restart backend
docker logs prevencao-backend-prod --tail 100
```

---

### Erro: "Menu não aparece"
**Causa:** Frontend não atualizou
**Solução:**
```bash
docker compose -f docker-compose-producao.yml restart frontend
# Limpar cache do navegador (Ctrl+Shift+Del)
```

---

### Erro: Migration falhou
**Causa:** Tabelas já existem ou erro de sintaxe
**Solução:**
```bash
# Ver exatamente qual o erro
docker logs prevencao-backend-prod | grep -i error

# Se tabelas já existem, a migration será pulada automaticamente
```

---

## 📞 Suporte

Se tiver problemas durante o deploy, salve os logs:

```bash
docker logs prevencao-backend-prod > backend-error.log
docker logs prevencao-frontend-prod > frontend-error.log
```

E me envie os arquivos para análise.
