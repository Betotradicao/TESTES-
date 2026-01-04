# 🗄️ Dados do Banco - Ambiente TESTES

## 📊 Informações do Banco de Dados

**Banco**: prevencao_db
**Host**: localhost (dentro do container)
**Porta**: 5432 (interna) / 5432 (externa)
**Usuário**: postgres
**Senha**: postgres123

## 📋 Tabelas Criadas

1. **bips** - Registros de bipagens
2. **companies** - Empresas cadastradas
3. **configurations** - Configurações do sistema
4. **email_monitor_logs** - Logs de monitoramento de email
5. **employees** - Funcionários
6. **equipment_sessions** - Sessões de equipamentos
7. **equipments** - Equipamentos
8. **migrations** - Controle de migrations
9. **product_activation_history** - Histórico de ativação de produtos
10. **products** - Produtos (COM COLUNAS DE IA!)
11. **sectors** - Setores
12. **sells** - Vendas
13. **users** - Usuários

## 👤 Usuário Admin Padrão

**Email**: admin@test.com
**Senha**: admin123
**Role**: admin
**Master**: Sim

## 🏢 Company Padrão

**ID**: b188b479-ee16-4562-a95e-4cea24742cc3
**Nome Fantasia**: Empresa Teste
**Razão Social**: EMPRESA TESTE LTDA
**CNPJ**: 12345678901234
**Email**: teste@teste.com
**Telefone**: 1234567890

## 🔧 Como Acessar o Banco

### Via Docker (dentro do container):
```bash
docker exec -it prevencao-postgres psql -U postgres -d prevencao_db
```

### Via SSH da VPS:
```bash
ssh root@46.202.150.64
docker exec -it prevencao-postgres psql -U postgres -d prevencao_db
```

## 📝 Queries Úteis

### Ver todas as tabelas:
```sql
\dt
```

### Ver estrutura de uma tabela:
```sql
\d nome_da_tabela
```

### Ver dados da company:
```sql
SELECT * FROM companies;
```

### Ver usuários:
```sql
SELECT id, email, name, role, is_master FROM users;
```

### Ver produtos com características de IA:
```sql
SELECT id, description, coloracao, formato, gordura_visivel, presenca_osso, peso_min_kg, peso_max_kg
FROM products
WHERE coloracao IS NOT NULL;
```

## ✅ Novidades Adicionadas

### Colunas de IA na tabela Products:
- `foto_referencia` (TEXT) - URL da foto de referência
- `coloracao` (VARCHAR 50) - Vermelho, Rosa, Branco, Amarelo, Marrom
- `formato` (VARCHAR 50) - Retangular, Irregular, Cilíndrico, Achatado, Triangular
- `gordura_visivel` (VARCHAR 50) - Nenhuma, Pouca, Média, Muita
- `presenca_osso` (BOOLEAN) - Tem osso visível ou não
- `peso_min_kg` (DECIMAL 10,3) - Peso mínimo esperado
- `peso_max_kg` (DECIMAL 10,3) - Peso máximo esperado
- `posicao_balcao` (JSONB) - Coordenadas {x1, y1, x2, y2, zona_nome}

### Migration:
`1765900000000-AddIACharacteristicsToProducts.ts`

## 🔄 Backup e Restore

### Fazer backup:
```bash
docker exec prevencao-postgres pg_dump -U postgres prevencao_db > backup_teste.sql
```

### Restaurar backup:
```bash
docker exec -i prevencao-postgres psql -U postgres -d prevencao_db < backup_teste.sql
```
