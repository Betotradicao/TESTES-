# Plano de Migração: Bipagens Zanthus → Oracle Intersolid

## Contexto

### Situação Atual
- Sistema de bipagens usa **API Zanthus** para buscar vendas
- Zanthus = frente de caixa (PDV)
- Intersolid = retaguarda
- API Intersolid agrupa itens iguais (não serve para bipagens)
- Polling atual: 2 minutos

### Descoberta
- Banco Oracle Intersolid tem tabela **TAB_PRODUTO_PDV** com:
  - Itens **separados** (campo `NUM_SEQ_ITEM` diferencia cada item)
  - Horário correto (`HRA_VENDA`)
  - Todos os dados necessários para matching

### Objetivo
- Eliminar dependência do Zanthus
- Usar **somente Oracle Intersolid** para tudo
- Polling mais rápido: 1 minuto

---

## Campos Disponíveis no Oracle (TAB_PRODUTO_PDV)

| Campo | Descrição | Uso no Matching |
|-------|-----------|-----------------|
| `COD_PRODUTO` | Código do produto | Match com bipagem |
| `VAL_TOTAL_PRODUTO` | Valor total do item | Match com bipagem (tolerância R$0.03) |
| `NUM_SEQ_ITEM` | Sequência do item no cupom | Diferencia itens iguais |
| `NUM_CUPOM_FISCAL` | Número do cupom | Identificador único |
| `DTA_SAIDA` | Data da venda | Filtro de período |
| `HRA_VENDA` | Hora da venda | Ordenação cronológica |
| `QTD_TOTAL_PRODUTO` | Quantidade | Info adicional |
| `COD_LOJA` | Código da loja | Filtro por loja |

---

## Etapas de Implementação

### Fase 1: Criar Serviço Oracle para Vendas PDV
**Arquivo:** `packages/backend/src/services/oracle-vendas.service.ts`

1. Criar função `getVendasRecentes(minutos: number, codLoja?: number)`
   - Busca vendas dos últimos X minutos
   - Query na TAB_PRODUTO_PDV
   - Retorna itens separados com NUM_SEQ_ITEM

2. Criar função `getVendasPorPeriodo(dataInicio, dataFim, codLoja?)`
   - Busca vendas de um período específico
   - Para reconciliação e relatórios

### Fase 2: Adaptar Serviço de Bipagens
**Arquivo:** `packages/backend/src/services/bipagens.service.ts` (ou similar)

1. Trocar fonte de dados de Zanthus para Oracle
2. Ajustar lógica de matching para usar campos Oracle
3. Implementar matching 1:1 usando NUM_SEQ_ITEM
4. Reduzir intervalo de polling para 1 minuto

### Fase 3: Atualizar Entidades/Models
**Verificar se precisa ajustar:**
- Entity SELLS para incluir novos campos
- Mapeamento de campos Oracle → Entity

### Fase 4: Testes e Validação
1. Testar matching em paralelo (Zanthus + Oracle)
2. Comparar resultados
3. Validar precisão do match 1:1
4. Monitorar performance

### Fase 5: Cutover
1. Desativar integração Zanthus
2. Ativar Oracle como fonte única
3. Monitorar por 24-48h
4. Remover código Zanthus (cleanup)

---

## Query Base para Buscar Vendas

```sql
SELECT
  pv.NUM_CUPOM_FISCAL,
  pv.NUM_SEQ_ITEM,
  pv.COD_PRODUTO,
  pv.DES_PRODUTO,
  pv.VAL_TOTAL_PRODUTO,
  pv.QTD_TOTAL_PRODUTO,
  pv.DTA_SAIDA,
  pv.HRA_VENDA,
  pv.COD_LOJA
FROM INTERSOLID.TAB_PRODUTO_PDV pv
WHERE pv.DTA_SAIDA >= TRUNC(SYSDATE)  -- Vendas de hoje
  AND pv.HRA_VENDA >= TO_CHAR(SYSDATE - INTERVAL '2' MINUTE, 'HH24:MI:SS')
ORDER BY pv.DTA_SAIDA DESC, pv.HRA_VENDA DESC
```

---

## Lógica de Matching (Atualizada)

### Critérios de Match
1. `product_id` (COD_PRODUTO) = código do produto da bipagem
2. `price` (VAL_TOTAL_PRODUTO) ≈ valor da bipagem (tolerância R$0.03)
3. Venda não pode já estar matched com outra bipagem

### Fluxo
```
1. Recebe webhook de bipagem (balança)
2. Salva bipagem com status 'pending'
3. A cada 1 minuto:
   a. Busca vendas recentes no Oracle (últimos 2 min)
   b. Para cada venda não verificada:
      - Procura bipagem pendente com mesmo produto e valor
      - Se encontrar: marca bipagem como 'verified', venda como 'verified'
      - Se não encontrar: cria registro de venda 'not_verified'
```

### Vantagem do NUM_SEQ_ITEM
- Cliente pesa 2x o mesmo produto (R$15,98 cada)
- Bipagem 1 → Match com NUM_SEQ_ITEM=1
- Bipagem 2 → Match com NUM_SEQ_ITEM=2
- Match 1:1 preciso, sem confusão

---

## Riscos e Mitigações

| Risco | Mitigação |
|-------|-----------|
| Delay no Oracle | Monitorar tempo entre venda e disponibilidade no banco |
| Diferença de horário | Validar timezone do servidor vs Oracle |
| Performance | Usar índices nas colunas DTA_SAIDA e HRA_VENDA |
| Rollback necessário | Manter código Zanthus comentado por 1 semana |

---

## Checklist de Validação

- [ ] Vendas aparecem no Oracle em menos de 1 minuto após finalização
- [ ] NUM_SEQ_ITEM diferencia corretamente itens iguais
- [ ] Horário (HRA_VENDA) está correto (sem diferença de timezone)
- [ ] Query de vendas recentes executa em menos de 500ms
- [ ] Matching 1:1 funciona corretamente
- [ ] Nenhuma bipagem fica órfã indevidamente

---

## Próximos Passos

1. **Validar timing**: Verificar quanto tempo leva para venda aparecer no Oracle após passar no PDV
2. **Implementar Fase 1**: Criar serviço Oracle para vendas
3. **Testar em paralelo**: Rodar ambos os sistemas e comparar resultados
