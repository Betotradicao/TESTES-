# Documentacao Completa do Banco de Dados
## Sistema Prevencao no Radar

**Versao:** 1.0
**Data:** Janeiro/2026
**Tecnologia:** PostgreSQL + TypeORM
**Total de Tabelas:** 27

---

# INDICE

1. [Usuarios e Permissoes](#1-usuarios-e-permissoes)
2. [Estrutura Organizacional](#2-estrutura-organizacional)
3. [Equipamentos e Sessoes](#3-equipamentos-e-sessoes)
4. [Produtos e Vendas](#4-produtos-e-vendas)
5. [Bipagens (Prevencao)](#5-bipagens-prevencao)
6. [Auditorias de Etiquetas](#6-auditorias-de-etiquetas)
7. [Pesquisa de Ruptura](#7-pesquisa-de-ruptura)
8. [Auditoria de Producao](#8-auditoria-de-producao)
9. [Conferencia HortiFruti](#9-conferencia-hortifruti)
10. [Controle de Perdas](#10-controle-de-perdas)
11. [Cadastros PDV](#11-cadastros-pdv)
12. [Logs do Sistema](#12-logs-do-sistema)

---

# 1. USUARIOS E PERMISSOES

## 1.1 Tabela: `users` (Usuarios Administrativos)

Armazena usuarios administradores e masters do sistema.

| Campo | Tipo | Descricao | Exemplo |
|-------|------|-----------|---------|
| id | UUID | ID unico | `a1b2c3d4-...` |
| name | VARCHAR | Nome completo | `Roberto Silva` |
| username | VARCHAR (unique) | Usuario de login | `roberto.admin` |
| email | VARCHAR (unique) | Email | `roberto@empresa.com` |
| password | VARCHAR | Senha criptografada (bcrypt) | `$2b$10$...` |
| role | VARCHAR | Papel (master/admin/user) | `admin` |
| is_master | BOOLEAN | E usuario master? | `true` |
| company_id | UUID (FK) | ID da empresa | `x1y2z3...` |
| reset_password_token | VARCHAR | Token recuperacao senha | `abc123...` |
| reset_password_expires | TIMESTAMP | Expiracao do token | `2026-01-20 15:00:00` |
| created_at | TIMESTAMP | Data criacao | `2026-01-15 10:30:00` |
| updated_at | TIMESTAMP | Ultima atualizacao | `2026-01-15 10:30:00` |

**Exemplo de Registro:**
```
ID: 550e8400-e29b-41d4-a716-446655440000
Nome: Roberto Silva
Email: roberto@tradicao.com.br
Role: master
isMaster: true
```

---

## 1.2 Tabela: `employees` (Colaboradores)

Armazena os funcionarios que usam o sistema operacional (nao admin).

| Campo | Tipo | Descricao | Exemplo |
|-------|------|-----------|---------|
| id | UUID | ID unico | `b2c3d4e5-...` |
| name | VARCHAR(255) | Nome completo | `Joao Carlos Santos` |
| avatar | VARCHAR(500) | URL da foto | `http://minio.../avatar.jpg` |
| sector_id | INT (FK) | ID do setor | `3` |
| function_description | VARCHAR(255) | Cargo/funcao | `Operador de Caixa` |
| username | VARCHAR(100) (unique) | Usuario login | `joao.santos` |
| password | VARCHAR(255) | Senha criptografada | `$2b$10$...` |
| first_access | BOOLEAN | Primeiro acesso? | `false` |
| barcode | VARCHAR(50) (unique) | Cracha/codigo barras | `7891234567890` |
| active | BOOLEAN | Esta ativo? | `true` |
| created_at | TIMESTAMP | Data criacao | `2026-01-10 08:00:00` |
| updated_at | TIMESTAMP | Ultima atualizacao | `2026-01-15 14:30:00` |

**Exemplo de Registro:**
```
ID: 123e4567-e89b-12d3-a456-426614174000
Nome: Maria Aparecida
Setor: Acougue (ID: 2)
Funcao: Balconista
Username: maria.acougue
Barcode: 2891234567001
Ativo: Sim
```

---

## 1.3 Tabela: `employee_permissions` (Permissoes de Colaboradores)

Controla quais modulos/submenus cada colaborador pode acessar.

| Campo | Tipo | Descricao | Exemplo |
|-------|------|-----------|---------|
| id | UUID | ID unico | `c3d4e5f6-...` |
| employee_id | UUID (FK) | ID do colaborador | `123e4567-...` |
| module_id | VARCHAR(50) | ID do modulo | `bipagens` |
| submenu_id | VARCHAR(50) | ID do submenu (null = todos) | `bipagens-ao-vivo` |
| created_at | TIMESTAMP | Data criacao | `2026-01-15 09:00:00` |
| updated_at | TIMESTAMP | Ultima atualizacao | `2026-01-15 09:00:00` |

**Constraint:** UNIQUE(employee_id, module_id, submenu_id)

**Exemplo de Registro:**
```
Employee: Maria Aparecida
Module: bipagens
Submenu: bipagens-ao-vivo
(Maria so pode ver Bipagens Ao Vivo, nao os outros submenus)
```

---

# 2. ESTRUTURA ORGANIZACIONAL

## 2.1 Tabela: `companies` (Empresas)

Dados cadastrais da empresa cliente.

| Campo | Tipo | Descricao | Exemplo |
|-------|------|-----------|---------|
| id | UUID | ID unico | `d4e5f6g7-...` |
| nome_fantasia | VARCHAR | Nome fantasia | `Supermercado Tradicao` |
| razao_social | VARCHAR | Razao social | `Tradicao Supermercado LTDA` |
| cnpj | VARCHAR (unique) | CNPJ | `12.345.678/0001-90` |
| responsavel_nome | VARCHAR | Nome responsavel | `Roberto Almeida` |
| responsavel_email | VARCHAR | Email responsavel | `roberto@tradicao.com` |
| responsavel_telefone | VARCHAR | Telefone | `(11) 99999-8888` |
| cep | VARCHAR | CEP | `01310-100` |
| rua | VARCHAR | Logradouro | `Av. Paulista` |
| numero | VARCHAR | Numero | `1000` |
| complemento | VARCHAR | Complemento | `Sala 501` |
| bairro | VARCHAR | Bairro | `Bela Vista` |
| cidade | VARCHAR | Cidade | `Sao Paulo` |
| estado | VARCHAR | UF | `SP` |
| telefone | VARCHAR | Telefone fixo | `(11) 3333-4444` |
| email | VARCHAR | Email geral | `contato@tradicao.com` |
| active | BOOLEAN | Ativa? | `true` |
| created_at | TIMESTAMP | Data criacao | `2026-01-01 00:00:00` |
| updated_at | TIMESTAMP | Ultima atualizacao | `2026-01-15 10:00:00` |

---

## 2.2 Tabela: `sectors` (Setores)

Setores/departamentos da loja.

| Campo | Tipo | Descricao | Exemplo |
|-------|------|-----------|---------|
| id | INT | ID unico | `1` |
| name | VARCHAR(255) (unique) | Nome do setor | `Acougue` |
| color_hash | VARCHAR(7) | Cor em hexadecimal | `#FF5733` |
| active | BOOLEAN | Ativo? | `true` |
| created_at | TIMESTAMP | Data criacao | `2026-01-05 08:00:00` |
| updated_at | TIMESTAMP | Ultima atualizacao | `2026-01-05 08:00:00` |

**Exemplos de Setores:**
```
ID: 1 - Acougue - Cor: #FF5733 (Vermelho)
ID: 2 - Padaria - Cor: #F5A623 (Laranja)
ID: 3 - Hortifruti - Cor: #7ED321 (Verde)
ID: 4 - Mercearia - Cor: #4A90D9 (Azul)
ID: 5 - Frios - Cor: #50E3C2 (Ciano)
```

---

## 2.3 Tabela: `configurations` (Configuracoes do Sistema)

Armazena todas as configuracoes do sistema em formato chave-valor.

| Campo | Tipo | Descricao | Exemplo |
|-------|------|-----------|---------|
| id | UUID | ID unico | `e5f6g7h8-...` |
| key | VARCHAR (unique) | Chave da config | `intersolid_api_url` |
| value | TEXT | Valor | `http://10.6.1.102` |
| encrypted | BOOLEAN | Valor criptografado? | `false` |
| created_at | TIMESTAMP | Data criacao | `2026-01-01 00:00:00` |
| updated_at | TIMESTAMP | Ultima atualizacao | `2026-01-15 10:00:00` |

**Exemplos de Configuracoes:**
```
intersolid_api_url = http://10.6.1.102
intersolid_port = 3003
intersolid_username = ROBERTO
intersolid_password = *** (encrypted)
zanthus_api_url = http://10.6.1.101
evolution_api_url = http://31.97.82.235:8090
minio_endpoint = localhost
minio_bucket_name = market-security
```

---

# 3. EQUIPAMENTOS E SESSOES

## 3.1 Tabela: `equipments` (Leitores/Scanners)

Cadastro dos equipamentos de leitura de codigo de barras.

| Campo | Tipo | Descricao | Exemplo |
|-------|------|-----------|---------|
| id | INT | ID unico | `1` |
| color_hash | VARCHAR(7) | Cor identificacao | `#E74C3C` |
| scanner_machine_id | VARCHAR(255) (unique) | ID unico do scanner | `SCANNER-001-ACOUGUE` |
| machine_id | VARCHAR(255) | ID da maquina | `PC-ACOUGUE-01` |
| port_number | VARCHAR(50) | Porta COM | `COM3` |
| description | TEXT | Descricao | `Scanner do balcao acougue` |
| sector_id | INT (FK) | Setor vinculado | `1` |
| active | BOOLEAN | Ativo? | `true` |
| created_at | TIMESTAMP | Data criacao | `2026-01-05 10:00:00` |
| updated_at | TIMESTAMP | Ultima atualizacao | `2026-01-10 14:00:00` |

**Exemplo de Registro:**
```
ID: 1
Scanner ID: LEITOR-ACOUGUE-BALCAO1
Machine ID: PC-ACOUGUE-01
Descricao: Leitor de codigo de barras do balcao 1 do acougue
Setor: Acougue (ID: 1)
Cor: #E74C3C (Vermelho)
```

---

## 3.2 Tabela: `equipment_sessions` (Sessoes de Equipamento)

Registra login/logout de colaboradores nos equipamentos.

| Campo | Tipo | Descricao | Exemplo |
|-------|------|-----------|---------|
| id | UUID | ID unico | `f6g7h8i9-...` |
| equipment_id | INT (FK) | ID do equipamento | `1` |
| employee_id | UUID (FK) | ID do colaborador | `123e4567-...` |
| logged_in_at | TIMESTAMP | Data/hora login | `2026-01-15 08:00:00` |
| logged_out_at | TIMESTAMP | Data/hora logout | `2026-01-15 17:00:00` |
| active | BOOLEAN | Sessao ativa? | `false` |
| created_at | TIMESTAMP | Data criacao | `2026-01-15 08:00:00` |
| updated_at | TIMESTAMP | Ultima atualizacao | `2026-01-15 17:00:00` |

**Exemplo:**
```
Colaborador: Maria Aparecida
Equipamento: LEITOR-ACOUGUE-BALCAO1
Login: 15/01/2026 08:00
Logout: 15/01/2026 17:00
Duracao: 9 horas
```

---

# 4. PRODUTOS E VENDAS

## 4.1 Tabela: `products` (Produtos Monitorados)

Produtos que estao sendo monitorados pelo sistema de prevencao.

| Campo | Tipo | Descricao | Exemplo |
|-------|------|-----------|---------|
| id | INT | ID unico | `1` |
| erp_product_id | VARCHAR(20) (unique) | Codigo ERP | `000123` |
| description | VARCHAR(255) | Descricao completa | `PICANHA BOVINA KG` |
| short_description | VARCHAR(100) | Descricao curta | `PICANHA KG` |
| ean | VARCHAR(20) | Codigo de barras | `7891234567890` |
| weighable | BOOLEAN | Produto pesavel? | `true` |
| section_code | INT | Codigo secao | `1` |
| section_name | VARCHAR(100) | Nome secao | `ACOUGUE` |
| group_code | INT | Codigo grupo | `10` |
| group_name | VARCHAR(100) | Nome grupo | `BOVINOS` |
| subgroup_code | INT | Codigo subgrupo | `101` |
| subgroup_name | VARCHAR(100) | Nome subgrupo | `CORTES NOBRES` |
| supplier_code | INT | Codigo fornecedor | `555` |
| supplier_name | VARCHAR(255) | Nome fornecedor | `Frigorifico XYZ` |
| active | BOOLEAN | Monitoramento ativo? | `true` |
| foto_referencia | TEXT | URL foto referencia | `http://minio.../picanha.jpg` |
| coloracao | VARCHAR(50) | Cor esperada (IA) | `Vermelho vivo` |
| formato | VARCHAR(50) | Formato esperado | `Triangular` |
| gordura_visivel | VARCHAR(50) | Gordura esperada | `Capa de gordura` |
| presenca_osso | BOOLEAN | Tem osso? | `false` |
| peso_min_kg | DECIMAL(10,3) | Peso minimo | `0.800` |
| peso_max_kg | DECIMAL(10,3) | Peso maximo | `2.500` |
| peso_medio_kg | DECIMAL(10,3) | Peso medio | `1.200` |
| production_days | INT | Dias producao | `1` |
| posicao_balcao | JSONB | Posicao no balcao | `{"setor":"acougue","balcao":1}` |
| created_at | TIMESTAMP | Data criacao | `2026-01-01 00:00:00` |
| updated_at | TIMESTAMP | Ultima atualizacao | `2026-01-15 10:00:00` |

**Exemplo Completo:**
```
Codigo ERP: 000123
Descricao: PICANHA BOVINA NACIONAL KG
EAN: 2000123000000
Pesavel: Sim
Secao: ACOUGUE
Grupo: BOVINOS
Subgrupo: CORTES NOBRES
Fornecedor: Frigorifico Minerva
Peso Medio: 1.200 kg
Preco/kg: R$ 89,90
Monitoramento: ATIVO
```

---

## 4.2 Tabela: `sells` (Vendas)

Registra vendas do PDV para cruzamento com bipagens.

| Campo | Tipo | Descricao | Exemplo |
|-------|------|-----------|---------|
| id | INT | ID unico | `1` |
| activated_product_id | INT (FK) | Produto monitorado | `1` |
| product_id | VARCHAR(20) | Codigo produto | `000123` |
| product_description | TEXT | Descricao | `PICANHA BOVINA KG` |
| sell_date | TIMESTAMP | Data/hora venda | `2026-01-15 14:30:00` |
| sell_value_cents | INT | Valor em centavos | `10788` (R$ 107,88) |
| product_weight | DECIMAL(12,3) | Peso vendido | `1.200` |
| bip_id | INT (FK) | Bipagem relacionada | `5432` |
| num_cupom_fiscal | INT | Numero cupom | `123456` |
| point_of_sale_code | INT | Codigo do caixa | `3` |
| discount_cents | INT | Desconto em centavos | `0` |
| status | VARCHAR(20) | Status da venda | `verified` |
| created_at | TIMESTAMP | Data criacao | `2026-01-15 14:30:00` |
| updated_at | TIMESTAMP | Ultima atualizacao | `2026-01-15 14:35:00` |

**Status Possiveis:**
- `verified` = Venda verificada (bipagem encontrada)
- `not_verified` = Venda sem bipagem (possivel furto)
- `cancelled` = Venda cancelada

**Exemplo:**
```
Cupom: 123456
Caixa: 03
Produto: PICANHA BOVINA KG
Peso: 1.200 kg
Valor: R$ 107,88
Data: 15/01/2026 14:30
Status: VERIFICADO (Bip #5432)
```

---

## 4.3 Tabela: `product_activation_history` (Historico de Ativacao)

Registra quando produtos sao ativados/desativados para monitoramento.

| Campo | Tipo | Descricao | Exemplo |
|-------|------|-----------|---------|
| id | INT | ID unico | `1` |
| user_id | UUID (FK) | Usuario que alterou | `a1b2c3d4-...` |
| product_id | INT (FK) | Produto alterado | `1` |
| active | BOOLEAN | Ativado ou desativado | `true` |
| created_at | TIMESTAMP | Data da alteracao | `2026-01-15 10:00:00` |

**Exemplo:**
```
Usuario: Roberto Silva
Produto: PICANHA BOVINA KG
Acao: ATIVOU monitoramento
Data: 15/01/2026 10:00
```

---

# 5. BIPAGENS (PREVENCAO)

## 5.1 Tabela: `bips` (Bipagens Detectadas)

**TABELA PRINCIPAL DO SISTEMA** - Registra todas as bipagens nos leitores.

| Campo | Tipo | Descricao | Exemplo |
|-------|------|-----------|---------|
| id | INT | ID unico | `5432` |
| ean | VARCHAR(20) | Codigo de barras | `2000123001200` |
| event_date | TIMESTAMP | Data/hora bipagem | `2026-01-15 14:25:00` |
| bip_price_cents | INT | Valor em centavos | `10788` |
| product_id | VARCHAR(20) | Codigo produto | `000123` |
| product_description | TEXT | Descricao | `PICANHA BOVINA KG` |
| product_full_price_cents_kg | INT | Preco cheio/kg | `8990` |
| product_discount_price_cents_kg | INT | Preco promocao/kg | `7990` |
| bip_weight | DECIMAL(12,3) | Peso bipado | `1.200` |
| tax_cupon | VARCHAR(50) | Cupom fiscal | `123456` |
| status | VARCHAR(20) | Status | `verified` |
| notified_at | TIMESTAMP | Data notificacao | `2026-01-15 14:26:00` |
| equipment_id | INT (FK) | Equipamento | `1` |
| employee_id | UUID (FK) | Colaborador | `123e4567-...` |
| motivo_cancelamento | VARCHAR(50) | Motivo cancel. | `null` |
| employee_responsavel_id | UUID (FK) | Responsavel cancel. | `null` |
| video_url | VARCHAR(500) | URL do video | `http://minio.../video.mp4` |
| image_url | VARCHAR(500) | URL da imagem | `http://minio.../img.jpg` |

**Status Possiveis:**
- `pending` = Aguardando verificacao
- `verified` = Verificado (venda encontrada)
- `cancelled` = Cancelado (com motivo)

**Motivos de Cancelamento:**
- `produto_abandonado` = Cliente abandonou produto
- `falta_cancelamento` = Faltou cancelar no PDV
- `devolucao_mercadoria` = Devolucao
- `erro_operador` = Erro do operador de caixa
- `erro_balconista` = Erro do balconista
- `furto` = Furto confirmado

**Exemplo Completo:**
```
BIP #5432
Data: 15/01/2026 14:25:00
Produto: PICANHA BOVINA KG (000123)
Peso: 1.200 kg
Valor: R$ 107,88
Equipamento: LEITOR-ACOUGUE-BALCAO1
Colaborador: Maria Aparecida
Status: VERIFICADO
Cupom: 123456
```

---

# 6. AUDITORIAS DE ETIQUETAS

## 6.1 Tabela: `label_audits` (Auditorias de Etiquetas)

Cabecalho das auditorias de preco nas gondolas.

| Campo | Tipo | Descricao | Exemplo |
|-------|------|-----------|---------|
| id | INT | ID unico | `1` |
| titulo | VARCHAR(255) | Titulo | `Auditoria Semanal 15/01` |
| data_referencia | DATE | Data referencia | `2026-01-15` |
| observacoes | TEXT | Observacoes | `Foco em promocoes` |
| status | ENUM | Status | `em_andamento` |
| created_at | TIMESTAMP | Data criacao | `2026-01-15 08:00:00` |
| updated_at | TIMESTAMP | Ultima atualizacao | `2026-01-15 16:00:00` |

**Status:** `em_andamento`, `concluida`, `cancelada`

---

## 6.2 Tabela: `label_audit_items` (Itens da Auditoria)

Produtos verificados em cada auditoria.

| Campo | Tipo | Descricao | Exemplo |
|-------|------|-----------|---------|
| id | INT | ID unico | `1` |
| audit_id | INT (FK) | Auditoria | `1` |
| codigo_barras | VARCHAR(50) | EAN | `7891234567890` |
| descricao | VARCHAR(255) | Produto | `ARROZ TIAO 5KG` |
| etiqueta | VARCHAR(10) | Tipo etiqueta | `NORMAL` |
| secao | VARCHAR(100) | Secao | `MERCEARIA` |
| valor_venda | DECIMAL(10,2) | Preco sistema | `25.90` |
| valor_oferta | DECIMAL(10,2) | Preco oferta | `22.90` |
| margem_pratica | VARCHAR(20) | Margem | `15.5%` |
| status_verificacao | ENUM | Resultado | `preco_correto` |
| data_verificacao | TIMESTAMP | Quando verificou | `2026-01-15 10:30:00` |
| verificado_por | VARCHAR(255) | Quem verificou | `Joao Carlos` |
| observacao_item | TEXT | Observacao | `Etiqueta ok` |
| created_at | TIMESTAMP | Data criacao | `2026-01-15 08:00:00` |

**Status:** `pendente`, `preco_correto`, `preco_divergente`

---

# 7. PESQUISA DE RUPTURA

## 7.1 Tabela: `rupture_surveys` (Pesquisas de Ruptura)

Cabecalho das pesquisas de ruptura de estoque.

| Campo | Tipo | Descricao | Exemplo |
|-------|------|-----------|---------|
| id | INT | ID unico | `1` |
| nome_pesquisa | VARCHAR(255) | Nome | `Ruptura Semanal 15/01` |
| data_criacao | TIMESTAMP | Criacao | `2026-01-15 06:00:00` |
| data_inicio_coleta | TIMESTAMP | Inicio coleta | `2026-01-15 07:00:00` |
| data_fim_coleta | TIMESTAMP | Fim coleta | `2026-01-15 12:00:00` |
| status | ENUM | Status | `concluida` |
| total_itens | INT | Total itens | `150` |
| itens_verificados | INT | Verificados | `150` |
| itens_encontrados | INT | Encontrados | `142` |
| itens_nao_encontrados | INT | Nao encontrados | `8` |
| user_id | UUID (FK) | Usuario | `a1b2c3d4-...` |
| observacoes | TEXT | Observacoes | `Ruptura alta em laticinios` |
| updated_at | TIMESTAMP | Atualizacao | `2026-01-15 12:00:00` |

**Status:** `rascunho`, `em_andamento`, `concluida`, `cancelada`

**Calculo Taxa de Ruptura:**
```
Taxa = (itens_nao_encontrados / itens_verificados) * 100
Exemplo: (8 / 150) * 100 = 5.33%
```

---

## 7.2 Tabela: `rupture_survey_items` (Itens da Pesquisa)

Produtos verificados na pesquisa de ruptura.

| Campo | Tipo | Descricao | Exemplo |
|-------|------|-----------|---------|
| id | INT | ID unico | `1` |
| survey_id | INT (FK) | Pesquisa | `1` |
| codigo_barras | VARCHAR(50) | EAN | `7891234567890` |
| erp_product_id | VARCHAR(50) | Codigo ERP | `000456` |
| descricao | VARCHAR(255) | Produto | `LEITE INTEGRAL 1L` |
| curva | VARCHAR(10) | Curva ABC | `A` |
| estoque_atual | DECIMAL(10,3) | Estoque sistema | `0.000` |
| cobertura_dias | DECIMAL(10,2) | Cobertura | `0.00` |
| grupo | VARCHAR(100) | Grupo | `LATICINIOS` |
| secao | VARCHAR(100) | Secao | `FRIOS` |
| subgrupo | VARCHAR(100) | Subgrupo | `LEITES` |
| fornecedor | VARCHAR(255) | Fornecedor | `Nestle` |
| margem_lucro | DECIMAL(5,2) | Margem % | `18.50` |
| valor_venda | DECIMAL(10,2) | Preco | `6.99` |
| venda_media_dia | DECIMAL(10,4) | Venda media | `45.5000` |
| tem_pedido | VARCHAR(3) | Pedido aberto? | `SIM` |
| status_verificacao | ENUM | Resultado | `nao_encontrado` |
| data_verificacao | TIMESTAMP | Quando | `2026-01-15 09:30:00` |
| verificado_por | VARCHAR(255) | Quem | `Maria Santos` |
| observacao_item | TEXT | Obs | `Gondola vazia` |
| created_at | TIMESTAMP | Criacao | `2026-01-15 06:00:00` |

**Status:** `pendente`, `encontrado`, `nao_encontrado`, `ruptura_estoque`

---

# 8. AUDITORIA DE PRODUCAO

## 8.1 Tabela: `production_audits` (Auditorias de Producao)

Controle de producao diaria (padaria, acougue, etc).

| Campo | Tipo | Descricao | Exemplo |
|-------|------|-----------|---------|
| id | INT | ID unico | `1` |
| audit_date | DATE (unique) | Data | `2026-01-15` |
| user_id | UUID (FK) | Usuario | `a1b2c3d4-...` |
| employee_id | UUID (FK) | Colaborador | `123e4567-...` |
| status | VARCHAR(20) | Status | `completed` |
| pdf_url | TEXT | URL do PDF | `http://minio.../prod.pdf` |
| sent_whatsapp | BOOLEAN | Enviou WhatsApp? | `true` |
| sent_at | TIMESTAMP | Quando enviou | `2026-01-15 06:00:00` |
| whatsapp_group_name | VARCHAR(255) | Grupo | `Producao Padaria` |
| created_at | TIMESTAMP | Criacao | `2026-01-15 05:00:00` |
| updated_at | TIMESTAMP | Atualizacao | `2026-01-15 06:00:00` |

---

## 8.2 Tabela: `production_audit_items` (Itens da Producao)

Produtos a serem produzidos no dia.

| Campo | Tipo | Descricao | Exemplo |
|-------|------|-----------|---------|
| id | INT | ID unico | `1` |
| audit_id | INT (FK) | Auditoria | `1` |
| product_code | VARCHAR(20) | Codigo ERP | `000789` |
| product_name | VARCHAR(255) | Produto | `PAO FRANCES 50G` |
| quantity_units | INT | Qtd unidades | `500` |
| unit_weight_kg | DECIMAL(10,3) | Peso unitario | `0.050` |
| quantity_kg | DECIMAL(10,3) | Total kg | `25.000` |
| production_days | INT | Dias producao | `1` |
| avg_sales_kg | DECIMAL(10,3) | Venda media/dia | `23.500` |
| suggested_production_kg | DECIMAL(10,3) | Sugestao kg | `25.000` |
| suggested_production_units | INT | Sugestao unid | `500` |
| unit_cost | DECIMAL(10,2) | Custo unitario | `0.35` |
| unit_price | DECIMAL(10,2) | Preco unitario | `0.80` |
| profit_margin | DECIMAL(5,2) | Margem % | `56.25` |
| created_at | TIMESTAMP | Criacao | `2026-01-15 05:00:00` |

**Exemplo Sugestao Producao:**
```
Produto: PAO FRANCES 50G
Venda Media: 23.5 kg/dia (470 unidades)
Sugestao: 25 kg (500 unidades)
Margem de Seguranca: +6.4%
```

---

# 9. CONFERENCIA HORTIFRUTI

## 9.1 Tabela: `hortfrut_conferences` (Conferencias HortiFruti)

Cabecalho das conferencias de recebimento.

| Campo | Tipo | Descricao | Exemplo |
|-------|------|-----------|---------|
| id | INT | ID unico | `1` |
| company_id | UUID (FK) | Empresa | `d4e5f6g7-...` |
| user_id | UUID (FK) | Usuario | `a1b2c3d4-...` |
| conference_date | DATE | Data | `2026-01-15` |
| supplier_name | VARCHAR(255) | Fornecedor | `Ceasa SP` |
| invoice_number | VARCHAR(100) | Nota fiscal | `NF-123456` |
| total_expected_weight | DECIMAL(10,3) | Peso esperado | `500.000` |
| total_actual_weight | DECIMAL(10,3) | Peso real | `485.500` |
| total_cost | DECIMAL(10,2) | Custo total | `2500.00` |
| status | VARCHAR(50) | Status | `completed` |
| observations | TEXT | Observacoes | `Falta 14.5kg` |
| created_at | TIMESTAMP | Criacao | `2026-01-15 06:00:00` |
| updated_at | TIMESTAMP | Atualizacao | `2026-01-15 08:00:00` |

---

## 9.2 Tabela: `hortfrut_conference_items` (Itens da Conferencia)

Produtos conferidos no recebimento.

| Campo | Tipo | Descricao | Exemplo |
|-------|------|-----------|---------|
| id | INT | ID unico | `1` |
| conference_id | INT (FK) | Conferencia | `1` |
| barcode | VARCHAR(50) | EAN | `2000456000000` |
| product_name | VARCHAR(255) | Produto | `TOMATE ITALIANO KG` |
| curve | VARCHAR(10) | Curva | `A` |
| section | VARCHAR(100) | Secao | `HORTIFRUTI` |
| product_group | VARCHAR(100) | Grupo | `LEGUMES` |
| sub_group | VARCHAR(100) | Subgrupo | `TOMATES` |
| current_cost | DECIMAL(10,2) | Custo atual | `8.50` |
| current_sale_price | DECIMAL(10,2) | Preco venda | `12.99` |
| reference_margin | DECIMAL(5,2) | Margem ref | `35.00` |
| current_margin | DECIMAL(5,2) | Margem atual | `34.64` |
| new_cost | DECIMAL(10,2) | Novo custo | `9.20` |
| box_id | INT (FK) | Caixa usada | `1` |
| box_quantity | INT | Qtd caixas | `10` |
| gross_weight | DECIMAL(10,3) | Peso bruto | `102.500` |
| net_weight | DECIMAL(10,3) | Peso liquido | `100.000` |
| expected_weight | DECIMAL(10,3) | Esperado | `100.000` |
| weight_difference | DECIMAL(10,3) | Diferenca | `0.000` |
| suggested_price | DECIMAL(10,2) | Preco sugerido | `14.15` |
| margin_if_keep_price | DECIMAL(5,2) | Margem se manter | `29.18` |
| quality | VARCHAR(20) | Qualidade | `good` |
| photo_url | VARCHAR(500) | Foto | `http://minio.../tomate.jpg` |
| observations | TEXT | Obs | `Qualidade ok` |
| checked | BOOLEAN | Conferido? | `true` |
| created_at | TIMESTAMP | Criacao | `2026-01-15 06:30:00` |
| updated_at | TIMESTAMP | Atualizacao | `2026-01-15 06:45:00` |

**Qualidade:** `good` (Boa), `regular` (Regular), `bad` (Ruim)

---

## 9.3 Tabela: `hortfrut_boxes` (Caixas HortiFruti)

Cadastro de caixas/embalagens para desconto de tara.

| Campo | Tipo | Descricao | Exemplo |
|-------|------|-----------|---------|
| id | INT | ID unico | `1` |
| company_id | UUID (FK) | Empresa | `d4e5f6g7-...` |
| name | VARCHAR(100) | Nome | `Caixa Tomate Grande` |
| description | VARCHAR(255) | Descricao | `Caixa plastica verde` |
| weight | DECIMAL(10,3) | Peso (tara) | `2.500` |
| active | BOOLEAN | Ativa? | `true` |
| photo_url | VARCHAR(500) | Foto | `http://minio.../caixa.jpg` |
| created_at | TIMESTAMP | Criacao | `2026-01-01 00:00:00` |
| updated_at | TIMESTAMP | Atualizacao | `2026-01-01 00:00:00` |

**Exemplo Calculo Peso Liquido:**
```
Peso Bruto: 102.500 kg
Qtd Caixas: 10
Tara/Caixa: 2.500 kg
Total Tara: 25.000 kg
Peso Liquido: 102.500 - (10 * 2.500) = 77.500 kg
```

---

# 10. CONTROLE DE PERDAS

## 10.1 Tabela: `losses` (Perdas/Quebras)

Registro de perdas importadas do sistema.

| Campo | Tipo | Descricao | Exemplo |
|-------|------|-----------|---------|
| id | INT | ID unico | `1` |
| company_id | UUID (FK) | Empresa | `d4e5f6g7-...` |
| codigo_barras | VARCHAR(50) | EAN | `7891234567890` |
| descricao_reduzida | TEXT | Produto | `PICANHA BOV KG` |
| quantidade_ajuste | DECIMAL(10,3) | Quantidade | `-2.500` |
| custo_reposicao | DECIMAL(10,2) | Custo | `224.75` |
| descricao_ajuste_completa | TEXT | Motivo | `QUEBRA - PRODUTO VENCIDO` |
| secao | VARCHAR(10) | Codigo secao | `01` |
| secao_nome | VARCHAR(100) | Nome secao | `ACOUGUE` |
| data_importacao | DATE | Data importacao | `2026-01-15` |
| data_inicio_periodo | DATE | Inicio periodo | `2026-01-01` |
| data_fim_periodo | DATE | Fim periodo | `2026-01-15` |
| nome_lote | VARCHAR(255) | Lote importacao | `PERDAS_JAN_2026_Q1` |
| created_at | TIMESTAMP | Criacao | `2026-01-15 10:00:00` |
| updated_at | TIMESTAMP | Atualizacao | `2026-01-15 10:00:00` |

---

## 10.2 Tabela: `loss_reason_configs` (Config. Motivos de Perda)

Configuracao de quais motivos ignorar nos calculos.

| Campo | Tipo | Descricao | Exemplo |
|-------|------|-----------|---------|
| id | INT | ID unico | `1` |
| company_id | UUID (FK) | Empresa | `d4e5f6g7-...` |
| motivo | TEXT | Motivo | `TRANSFERENCIA ENTRE LOJAS` |
| ignorar_calculo | BOOLEAN | Ignorar? | `true` |
| created_at | TIMESTAMP | Criacao | `2026-01-01 00:00:00` |
| updated_at | TIMESTAMP | Atualizacao | `2026-01-01 00:00:00` |

**Exemplo:**
```
Motivo: TRANSFERENCIA ENTRE LOJAS
Ignorar: SIM (nao conta como perda real)
```

---

# 11. CADASTROS PDV

## 11.1 Tabela: `operadores` (Operadores de Caixa)

| Campo | Tipo | Descricao | Exemplo |
|-------|------|-----------|---------|
| id | INT | ID unico | `1` |
| codigo | INT (unique) | Codigo no PDV | `101` |
| nome | VARCHAR(100) | Nome | `Ana Paula Silva` |
| ativo | BOOLEAN | Ativo? | `true` |
| created_at | TIMESTAMP | Criacao | `2026-01-01 00:00:00` |
| updated_at | TIMESTAMP | Atualizacao | `2026-01-01 00:00:00` |

---

## 11.2 Tabela: `autorizadores` (Autorizadores)

| Campo | Tipo | Descricao | Exemplo |
|-------|------|-----------|---------|
| id | INT | ID unico | `1` |
| codigo | INT (unique) | Codigo | `501` |
| nome | VARCHAR(100) | Nome | `Carlos Supervisor` |
| cargo | VARCHAR(50) | Cargo | `Supervisor` |
| ativo | BOOLEAN | Ativo? | `true` |
| created_at | TIMESTAMP | Criacao | `2026-01-01 00:00:00` |
| updated_at | TIMESTAMP | Atualizacao | `2026-01-01 00:00:00` |

---

## 11.3 Tabela: `motivos_desconto` (Motivos de Desconto)

| Campo | Tipo | Descricao | Exemplo |
|-------|------|-----------|---------|
| id | INT | ID unico | `1` |
| codigo | INT (unique) | Codigo | `1` |
| descricao | VARCHAR(200) | Descricao | `PRODUTO AVARIADO` |
| ativo | BOOLEAN | Ativo? | `true` |
| created_at | TIMESTAMP | Criacao | `2026-01-01 00:00:00` |
| updated_at | TIMESTAMP | Atualizacao | `2026-01-01 00:00:00` |

---

# 12. LOGS DO SISTEMA

## 12.1 Tabela: `email_monitor_logs` (Logs do Monitor de Email)

Registra emails processados pelo monitor.

| Campo | Tipo | Descricao | Exemplo |
|-------|------|-----------|---------|
| id | UUID | ID unico | `g7h8i9j0-...` |
| email_subject | VARCHAR(255) | Assunto | `Alerta Facial - Suspeito` |
| sender | VARCHAR(255) | Remetente | `facial@empresa.com` |
| email_body | TEXT | Corpo | `Suspeito detectado...` |
| status | VARCHAR(100) | Status | `success` |
| error_message | TEXT | Erro (se houver) | `null` |
| has_attachment | BOOLEAN | Tem anexo? | `true` |
| whatsapp_group_id | VARCHAR(255) | Grupo destino | `120363...@g.us` |
| image_path | VARCHAR(500) | Caminho imagem | `/tmp/facial_123.jpg` |
| processed_at | TIMESTAMP | Processado em | `2026-01-15 14:30:00` |

**Status:** `success`, `error`, `skipped`

---

# RESUMO GERAL

## Quantidade de Tabelas por Categoria

| Categoria | Quantidade | Tabelas |
|-----------|------------|---------|
| Usuarios/Permissoes | 3 | users, employees, employee_permissions |
| Organizacional | 3 | companies, sectors, configurations |
| Equipamentos | 2 | equipments, equipment_sessions |
| Produtos/Vendas | 3 | products, sells, product_activation_history |
| Bipagens | 1 | bips |
| Etiquetas | 2 | label_audits, label_audit_items |
| Ruptura | 2 | rupture_surveys, rupture_survey_items |
| Producao | 2 | production_audits, production_audit_items |
| HortiFruti | 3 | hortfrut_conferences, hortfrut_conference_items, hortfrut_boxes |
| Perdas | 2 | losses, loss_reason_configs |
| PDV | 3 | operadores, autorizadores, motivos_desconto |
| Logs | 1 | email_monitor_logs |
| **TOTAL** | **27** | |

---

## Relacionamentos Principais

```
companies
    |-- users (company_id)
    |-- losses (company_id)
    |-- hortfrut_conferences (company_id)
    |-- hortfrut_boxes (company_id)
    |-- loss_reason_configs (company_id)

sectors
    |-- employees (sector_id)
    |-- equipments (sector_id)

employees
    |-- employee_permissions (employee_id)
    |-- equipment_sessions (employee_id)
    |-- bips (employee_id, employee_responsavel_id)

equipments
    |-- equipment_sessions (equipment_id)
    |-- bips (equipment_id)

products
    |-- sells (activated_product_id)
    |-- product_activation_history (product_id)

bips
    |-- sells (bip_id)

rupture_surveys
    |-- rupture_survey_items (survey_id)

label_audits
    |-- label_audit_items (audit_id)

production_audits
    |-- production_audit_items (audit_id)

hortfrut_conferences
    |-- hortfrut_conference_items (conference_id)

hortfrut_boxes
    |-- hortfrut_conference_items (box_id)
```

---

**Documento gerado em:** Janeiro/2026
**Sistema:** Prevencao no Radar
**Versao do Banco:** PostgreSQL 15
**ORM:** TypeORM
