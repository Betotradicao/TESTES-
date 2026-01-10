# API RHID - Integração Relógio de Ponto ControlID

Documentação e scripts para integração com o sistema de ponto eletrônico RHID da ControlID.

## 📋 Informações da Conta

**Portal Web**: https://www.rhid.com.br/v2
**Email**: tradicaosupermercado@yahoo.com
**Senha**: Beto3107@
**Empresa**: SUPERMERCADO TRADIÇÃO LTDA

## 🔌 API REST

**Base URL**: `https://rhid.com.br/v2/api.svc`
**Autenticação**: Bearer Token (JWT)
**Documentação Swagger**: https://rhid.com.br/v2/swagger.svc/

### Endpoints Disponíveis

#### Autenticação
```bash
POST /login
Content-Type: application/json

{
  "email": "tradicaosupermercado@yahoo.com",
  "password": "Beto3107@"
}

# Resposta:
{
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

#### Listar Dispositivos (Relógios)
```bash
GET /device?start=0&length=100
Authorization: Bearer {token}
```

**Relógios Cadastrados:**
- **ID 7** - Relogio Apoio ADM (Status: ERRO)
- **ID 1** - Relogio Creusa (Status: ERRO)
- **ID 8** - Relogio SUPERMERCADO LTDA (Status: OK) ✓

#### Baixar Relatório AFD (Arquivo Fonte de Dados)

**Formato 1510:**
```bash
GET /report/afd/download?idEquipamento=8&dataIni=2026-01-01&dataFinal=2026-01-10
Authorization: Bearer {token}
```

**Formato 671 (Portaria 671 - RECOMENDADO):**
```bash
GET /report/afd/download671?idEquipamento=8&dataIni=2026-01-01&dataFinal=2026-01-10
Authorization: Bearer {token}
```

## 📊 Dados Extraídos

### Período Analisado
**01/01/2026 a 10/01/2026**

### Estatísticas
- **Total de PIS únicos**: 468
- **Funcionários com >= 5 batidas** (ativos): 32
- **Funcionários com < 5 batidas** (inativos): 436
- **Média de batidas**: 1.6 por pessoa
- **Total de marcações**: 747

### Top 20 Funcionários Mais Ativos

| # | PIS | Batidas | Período |
|---|-----|---------|---------|
| 1 | 033601478803 | 12 | 02/01 a 10/01 |
| 2 | 057275451883 | 11 | 02/01 a 10/01 |
| 3 | 032211981836 | 10 | 02/01 a 10/01 |
| 4 | 022397303825 | 10 | 02/01 a 10/01 |
| 5 | 044333812844 | 10 | 02/01 a 10/01 |
| 6 | 007347951305 | 10 | 02/01 a 10/01 |
| 7 | 055798312852 | 10 | 02/01 a 09/01 |
| 8 | 003825873323 | 10 | 05/01 a 10/01 |
| 9 | 012975247240 | 9 | 02/01 a 10/01 |
| 10 | 052120905800 | 9 | 02/01 a 10/01 |
| 11 | 047765643860 | 9 | 02/01 a 09/01 |
| 12 | 014019770413 | 9 | 05/01 a 10/01 |
| 13 | 057710768806 | 9 | 05/01 a 09/01 |
| 14 | 049891247821 | 9 | 06/01 a 09/01 |
| 15 | 022646666845 | 8 | 02/01 a 07/01 |
| 16 | 041107959829 | 8 | 02/01 a 09/01 |
| 17 | 003996378505 | 8 | 02/01 a 09/01 |
| 18 | 021550066838 | 8 | 02/01 a 09/01 |
| 19 | 014128743607 | 7 | 02/01 a 09/01 |
| 20 | 048150097830 | 7 | 02/01 a 09/01 |

## 📁 Arquivos

### Scripts de Análise
- **`analise-funcionarios.js`** - Análise básica do arquivo AFD
- **`analise-afd-671.js`** - Parser do formato AFD 671 (Portaria 671)
- **`analise-completa-afd.js`** - Análise detalhada com estatísticas
- **`analise-ativos-671.js`** - Identifica funcionários ativos vs inativos
- **`parse-afd.js`** - Converte AFD para formato cartão de ponto
- **`cruzar-funcionarios.js`** - Cruza dados do banco local com RHID

### Dados Processados (JSON)
- **`funcionarios-ativos-671.json`** - Lista completa de funcionários ativos (468)
- **`funcionarios-db.json`** - Funcionários do banco de dados local (6)
- **`cartao-ponto.json`** - Cartão de ponto formatado
- **`pis-lista-671.txt`** - Lista de todos os PIS únicos

## 🔧 Como Usar

### 1. Fazer Login na API
```bash
curl -X POST https://rhid.com.br/v2/api.svc/login \
  -H "Content-Type: application/json" \
  -d '{"email":"tradicaosupermercado@yahoo.com","password":"Beto3107@"}' \
  --insecure -s | grep -o '"accessToken":"[^"]*"' | cut -d'"' -f4 > token.txt
```

### 2. Baixar Dados de Ponto
```bash
TOKEN=$(cat token.txt)

curl "https://rhid.com.br/v2/api.svc/report/afd/download671?idEquipamento=8&dataIni=2026-01-01&dataFinal=2026-01-31" \
  -H "Authorization: Bearer $TOKEN" \
  --insecure -s > afd_janeiro.txt
```

### 3. Processar Dados
```bash
# Analisar funcionários ativos
node analise-ativos-671.js

# Gerar cartão de ponto
node parse-afd.js
```

## ⚠️ Problemas Conhecidos

### API Endpoints com Erro
Os seguintes endpoints retornam erro 500:
- `GET /person` - Listar funcionários
- `GET /company` - Listar empresas
- `GET /department` - Listar departamentos

**Motivo**: A API de integração pode estar bloqueada ou a conta não tem permissão.

**Solução**: Usar o portal web RHID para exportar dados de funcionários manualmente.

### Formato AFD
- **Tipo 5 (Cadastro)**: Apenas 1 funcionário tem nome cadastrado (GABRIEL EPIFANIO DO AMARAL)
- **Motivo**: A API não exporta dados pessoais (LGPD) nos relatórios AFD
- **Solução**: Buscar nomes no portal web RHID

### Relógios com Status ERRO
- **ID 7 (Apoio ADM)** e **ID 1 (Creusa)** retornam arquivos vazios
- **Última comunicação**: 11/02/2025 10:24 (offline)
- **Solução**: Apenas o relógio ID 8 (SUPERMERCADO) está funcional

## 📝 Próximos Passos

1. ✅ Login na API - FUNCIONANDO
2. ✅ Download de relatórios AFD - FUNCIONANDO
3. ✅ Parser de dados de ponto - FUNCIONANDO
4. ❌ Buscar nomes de funcionários via API - BLOQUEADO
5. ⏳ **PENDENTE**: Exportar lista de funcionários do portal web
6. ⏳ **PENDENTE**: Mapear PIS → Nome → Setor
7. ⏳ **PENDENTE**: Integrar com banco de dados local

## 📞 Suporte

**ControlID Integração**
Email: integracao@controlid.com.br
Documentação: https://www.controlid.com.br/docs/access-api-pt/

## 🔗 Links Úteis

- Portal RHID: https://www.rhid.com.br/v2
- Swagger API: https://rhid.com.br/v2/swagger.svc/
- Manual RHID: https://rhid.com.br/v2/manual/
- GitHub ControlID: https://github.com/controlid
