# PREVENÇÃO DE BIPAGENS - DOCUMENTAÇÃO COMPLETA (PONTO DE PARTIDA)

**Data da Documentação:** 30/01/2026
**Sistema:** Prevenção no Radar
**Versão Atual:** Integração com Zanthus (2 em 2 minutos)

---

## 1. VISÃO GERAL

A funcionalidade de **Prevenção de Bipagens** é o coração do sistema de prevenção de perdas. Ela cruza dados de **bipagens** (pesagens feitas nas balanças do açougue/padaria) com **vendas** registradas no PDV para identificar possíveis furtos ou erros operacionais.

### 1.1 Objetivo Principal
Garantir que **todo produto pesado na balança seja efetivamente vendido** no caixa. Se um produto foi bipado (pesado e etiquetado) mas não aparece nas vendas, isso pode indicar:
- Furto
- Produto abandonado
- Erro do operador
- Erro do balconista

---

## 2. ARQUITETURA ATUAL

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│    BALANÇA      │     │    BACKEND      │     │    ZANTHUS      │
│  (Barcode       │────▶│   (Node.js)     │◀────│   (API PDV)     │
│   Scanner)      │     │                 │     │                 │
└─────────────────┘     └─────────────────┘     └─────────────────┘
        │                       │                       │
        │ Webhook               │ Cron 2min             │ API POST
        │ (bipagem)             │ (verificação)         │ (vendas)
        ▼                       ▼                       │
┌─────────────────┐     ┌─────────────────┐            │
│   Tabela BIPS   │     │  Tabela SELLS   │◀───────────┘
│  (PostgreSQL)   │     │  (PostgreSQL)   │
└─────────────────┘     └─────────────────┘
```

---

## 3. FLUXO COMPLETO

### 3.1 FASE 1: Recebimento da Bipagem (Webhook)

**Arquivo:** `packages/backend/src/services/bip-webhook.service.ts`

1. O **Barcode Scanner** (balança) envia um webhook quando um produto é pesado
2. O sistema recebe os dados:
   - EAN (código de barras gerado)
   - Preço em centavos (calculado pelo peso × preço/kg)
   - ID do produto
   - Data/hora do evento
   - ID do equipamento (balança)
   - ID do funcionário (opcional)

3. O sistema busca informações do produto no ERP:
```typescript
// Busca dados do produto
const erpProduct = await BipWebhookService.getProductFromERP(plu);
```

4. Calcula o peso a partir do preço:
```typescript
// CÁLCULO DO BIP_WEIGHT (fórmula exata)
const weight = bipPriceCents / productPriceCentsKg;
```

5. Salva a bipagem com status **PENDING**:
```typescript
const bip = bipRepository.create({
  ean: bipData.ean,
  bip_price_cents: bipData.bip_price_cents,
  product_id: bipData.product_id,
  status: BipStatus.PENDING,  // Sempre começa pendente
  // ... outros campos
});
```

### 3.2 FASE 2: Cron de Verificação (2 em 2 minutos)

**Arquivo:** `packages/backend/Dockerfile.cron`
**Comando:** `packages/backend/src/commands/daily-verification.command.ts`

```cron
# Monitoramento contínuo a cada 2 minutos (dia atual, sem notificações)
*/2 * * * * cd /app && node dist/commands/daily-verification.command.js
```

O cron executa a cada 2 minutos e faz:

1. **Busca vendas do Zanthus** (API do PDV):
```typescript
const sales = await BipDataService.fetchSalesForDate(date);
```

2. **Busca todas as bipagens do dia**:
```typescript
const bipages = await BipDataService.fetchAllBipagesForDate(date);
```

3. **Faz o matching** entre vendas e bipagens

### 3.3 FASE 3: Lógica de Matching

**Arquivo:** `packages/backend/src/services/bip-verification.service.ts`

O matching é feito comparando:
- **product_id** (código do produto)
- **preço** (com tolerância de R$ 0,03)

```typescript
static processVerificationAndNotification(bips: Bip[], vendas: SaleData[]): VerificationResult {
  for (const bip of bips) {
    const precoBip = bip.bip_price_cents / 100;
    const productIdInt = parseInt(bip.product_id, 10);

    const match = vendas.find(venda => {
      const codProdutoInt = parseInt(venda.codProduto, 10);
      const valProduto = Number(venda.valTotalProduto);

      // Tolerância de R$ 0.03
      const precoOk = Math.abs(valProduto - precoBip) <= 0.03;

      return productIdInt === codProdutoInt && precoOk;
    });

    if (match) {
      to_verify.push({ bip, venda: match });
    } else {
      to_notify.push(bip);
    }
  }
}
```

### 3.4 FASE 4: Atualização de Status

Após o matching:

**Se encontrou venda correspondente:**
```typescript
// Bipagem: pending → verified
await bipRepository.update(bip.id, {
  status: 'verified',
  tax_cupon: venda.numCupomFiscal?.toString()  // Guarda número do cupom
});
```

**Se NÃO encontrou venda:**
- A bipagem permanece como **pending**
- É candidata a notificação (se o cron rodar com --notify)

### 3.5 FASE 5: Registro das Vendas (Tabela SELLS)

**Arquivo:** `packages/backend/src/commands/daily-verification.command.ts`

Cada venda é registrada na tabela `sells` com status:
- `verified`: Venda encontrou bipagem correspondente
- `not_verified`: Venda SEM bipagem (possível furto)
- `cancelled`: Venda cancelada

```typescript
const sellRecord = {
  product_id: sale.codProduto,
  product_description: sale.desProduto,
  sell_date: sellDate,
  sell_value_cents: saleValueCents,
  bip_id: matchedBip ? matchedBip.id : null,  // FK para a bipagem
  num_cupom_fiscal: sale.numCupomFiscal,
  point_of_sale_code: sale.codCaixa,          // NÚMERO DO CAIXA (PDV)
  status: status
};
```

---

## 4. ENTIDADES DO BANCO DE DADOS

### 4.1 Tabela BIPS

**Arquivo:** `packages/backend/src/entities/Bip.ts`

| Coluna | Tipo | Descrição |
|--------|------|-----------|
| id | integer | PK |
| ean | varchar(20) | Código de barras gerado |
| event_date | timestamp | Data/hora da bipagem |
| bip_price_cents | integer | Preço em centavos |
| product_id | varchar(20) | Código do produto |
| product_description | text | Descrição do produto |
| bip_weight | numeric(12,3) | Peso calculado |
| status | enum | `pending`, `verified`, `cancelled` |
| tax_cupon | varchar(50) | Número do cupom fiscal (após verificação) |
| notified_at | timestamp | Quando foi notificado |
| equipment_id | integer | FK para equipamento (balança) |
| employee_id | uuid | FK para funcionário |
| motivo_cancelamento | enum | Motivo se cancelado |
| video_url | varchar(500) | URL do vídeo anexado |
| image_url | varchar(500) | URL da imagem anexada |

**Status possíveis:**
- `pending`: Aguardando verificação com venda
- `verified`: Encontrou venda correspondente
- `cancelled`: Cancelada manualmente

**Motivos de cancelamento:**
- `produto_abandonado`
- `falta_cancelamento`
- `devolucao_mercadoria`
- `erro_operador`
- `erro_balconista`
- `furto`

### 4.2 Tabela SELLS

**Arquivo:** `packages/backend/src/entities/Sell.ts`

| Coluna | Tipo | Descrição |
|--------|------|-----------|
| id | integer | PK |
| product_id | varchar(20) | Código do produto |
| product_description | text | Descrição do produto |
| sell_date | timestamp | Data/hora da venda |
| sell_value_cents | integer | Valor em centavos |
| product_weight | numeric(12,3) | Peso vendido |
| bip_id | integer | FK para bipagem (se verificada) |
| num_cupom_fiscal | integer | Número do cupom fiscal |
| **point_of_sale_code** | integer | **CÓDIGO DO CAIXA (PDV)** |
| status | enum | `verified`, `not_verified`, `cancelled` |
| discount_cents | integer | Desconto aplicado |

---

## 5. ORIGEM DOS DADOS: API ZANTHUS

### 5.1 Endpoint

**URL:** `http://10.6.1.101/manager/restful/integracao/cadastro_sincrono.php5`

### 5.2 Query SQL Executada

```sql
SELECT
  z.M00AC as codCaixa,           -- CÓDIGO DO CAIXA/PDV
  z.M00ZA as codLoja,
  z.M43AH as codProduto,
  LPAD(z.M43AH, 13, '0') as codBarraPrincipal,
  z.M00AF as dtaSaida,
  z.M00AD as numCupomFiscal,     -- NÚMERO DO CUPOM
  z.M43DQ as valVenda,
  z.M43AO as qtdTotalProduto,    -- PESO/QUANTIDADE
  z.M43AP as valTotalProduto,    -- VALOR TOTAL
  z.M43AQ as descontoAplicado,
  TO_CHAR(...) AS dataHoraVenda, -- DATA/HORA DA VENDA
  p.DESCRICAO_PRODUTO as desProduto
FROM ZAN_M43 z
LEFT JOIN TAB_PRODUTO p ON p.COD_PRODUTO LIKE '%' || z.M43AH
WHERE TRUNC(z.M00AF) BETWEEN TO_DATE('...') AND TO_DATE('...')
```

### 5.3 Tabela de Origem: ZAN_M43

Esta é a tabela do Zanthus que contém os **itens vendidos no PDV**.

---

## 6. CRONS DO SISTEMA

**Arquivo:** `packages/backend/Dockerfile.cron`

| Cron | Intervalo | Comando | Descrição |
|------|-----------|---------|-----------|
| Verificação Contínua | **2 em 2 min** | `daily-verification.command.js` | Cruza vendas × bipagens do dia atual |
| Verificação Diária | 8h da manhã | `daily-verification.command.js --runYesterday` | Processa dia anterior + envia notificações |
| Monitor Última Bipagem | A cada 1h | `check-last-bip.command.js` | Alerta se não receber bipagens |
| Monitor Email DVR | A cada 1 min | `email-monitor.command.js` | Monitora emails do DVR |

---

## 7. TELA DE MONITORAMENTO

**Arquivo:** `packages/frontend/src/components/configuracoes/CronMonitorTab.jsx`

A tela de **Configurações > CRON Monitor** mostra:

- **Última Execução:** Quando o cron rodou pela última vez
- **Vendas Processadas:** Quantas vendas foram cruzadas
- **Bipagens Verificadas:** Quantas bipagens encontraram venda

O status é obtido via API:
```
GET /cron/status
```

---

## 8. TELA DE PREVENÇÃO BIPAGENS

**Endpoint Backend:** `packages/backend/src/controllers/bips.controller.ts`

A tela principal mostra:
- Lista de bipagens com filtros (data, status, setor, funcionário)
- Para cada bipagem verificada:
  - `sell_date`: Data/hora da venda
  - `sell_num_cupom_fiscal`: Número do cupom fiscal
  - `sell_point_of_sale_code`: **Número do PDV/Caixa**

---

## 9. PONTOS IMPORTANTES PARA MIGRAÇÃO

### 9.1 O que precisa mudar para usar Intersolid (1 em 1 min):

1. **Fonte de Dados:**
   - Atual: API Zanthus (tabela ZAN_M43)
   - Novo: Oracle Intersolid (tabela TAB_PRODUTO_PDV ou similar)

2. **Frequência:**
   - Atual: 2 em 2 minutos
   - Novo: 1 em 1 minuto

3. **Campos a mapear:**
   - `codProduto` → COD_PRODUTO
   - `valTotalProduto` → VAL_TOTAL
   - `qtdTotalProduto` → QTD_ITEM
   - `numCupomFiscal` → NUM_CUPOM_FISCAL ou NUM_COO
   - `codCaixa` → COD_CAIXA
   - `dataHoraVenda` → DTA_SAIDA + HRA_SAIDA

4. **Arquivo principal a modificar:**
   - `packages/backend/src/services/sales.service.ts`
   - Método `fetchSalesFromERP()` - atualmente sempre usa Zanthus

5. **Possível adição:**
   - Campo de **operador** (se disponível no Oracle)

### 9.2 Lógica que NÃO muda:
- Matching por product_id + preço (tolerância R$ 0,03)
- Status das bipagens (pending → verified/cancelled)
- Tabelas bips e sells
- Frontend de visualização

---

## 10. RESUMO DO FLUXO

```
1. BIPAGEM (Webhook)
   └─▶ Balança pesa produto
   └─▶ Sistema recebe dados via webhook
   └─▶ Salva na tabela BIPS com status=PENDING

2. CRON (2 em 2 min)
   └─▶ Busca vendas da API Zanthus
   └─▶ Busca bipagens pendentes
   └─▶ Faz matching (product_id + preço)
   └─▶ Se match: bipagem → VERIFIED
   └─▶ Se não match: bipagem permanece PENDING

3. VISUALIZAÇÃO
   └─▶ Tela mostra bipagens com status
   └─▶ Mostra PDV, cupom fiscal, data/hora
   └─▶ Permite cancelar com motivo
   └─▶ Permite upload de vídeo/imagem
```

---

**Última atualização:** 30/01/2026
**Autor:** Claude (Opus 4.5)
**Próximo passo:** Migrar para buscar vendas da Intersolid (Oracle) a cada 1 minuto
