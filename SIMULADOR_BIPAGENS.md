# Simulador de Bipagens - Roberto Prevenção no Radar

## O que foi implementado

Foi criado um **Simulador de Bipagens** completo para testar o sistema sem precisar de um leitor físico.

### Localização
- **Frontend**: Aba "Configurações" → Sub-aba "APIs" → Nova aba "SIMULADOR BIPAGENS"
- **Arquivo**: `packages/frontend/src/components/configuracoes/APIsTab.jsx`

## Como usar o Simulador

### 1. Acesse o Simulador
1. Faça login no sistema
2. Navegue até: **Configurações** → **APIs**
3. Clique na aba **"SIMULADOR BIPAGENS"**

### 2. Simular uma Bipagem

O simulador possui os seguintes campos:

#### Código EAN / Barcode (Obrigatório)
- Campo principal onde você insere o código de barras
- Exemplos pré-configurados:
  - `2037040050854` - EAN Peso (Coxão Mole)
  - `2012345678905` - EAN Peso Genérico
  - `7891234567890` - EAN Preço (Produto comum)
  - `3122000000018` - Código de Colaborador

#### Scanner ID (Opcional)
- Identificador do scanner/leitor
- Exemplo: `SCANNER_01`
- Se preenchido, registra/busca o equipamento no sistema

#### Machine ID (Opcional)
- Identificador da máquina/PDV
- Exemplo: `MACHINE_01`
- Usado junto com Scanner ID para identificar equipamentos

#### Data/Hora do Evento
- Data e hora da bipagem
- Por padrão, usa o momento atual
- Pode ser alterada para simular bipagens passadas ou futuras

### 3. Executar a Simulação

1. Preencha o **Código EAN** (obrigatório)
2. Opcionalmente, preencha Scanner ID e Machine ID
3. Ajuste a data/hora se necessário
4. Clique em **"Simular Bipagem"**

### 4. Visualizar o Resultado

Após a simulação:

#### Em caso de SUCESSO ✅
- Mensagem de sucesso é exibida
- Detalhes da bipagem criada são mostrados:
  - ID da bipagem
  - EAN registrado
  - Produto identificado
  - Status (geralmente "pending")
- Um link para visualizar na aba "Bipagens Ao Vivo"

#### Em caso de ERRO ❌
- Mensagem de erro é exibida
- Possíveis erros:
  - EAN inválido
  - Produto não encontrado no ERP
  - Equipamento desabilitado
  - Erro de conexão

## Fluxo Completo do Sistema

### Como o sistema processa bipagens:

1. **Recebe o webhook** em `/api/bipagens/webhook`
2. **Detecta tipo de código**:
   - Se começa com `3122` → Login de colaborador
   - Caso contrário → Bipagem de produto
3. **Formata o EAN** (validação e normalização)
4. **Verifica cancelamento** (limite de bipagens)
5. **Busca produto no ERP** (usando PLU extraído do EAN)
6. **Registra/busca equipamento** (se scanner_id fornecido)
7. **Verifica se equipamento está ativo**
8. **Busca colaborador logado** no equipamento (se houver)
9. **Salva bipagem** no banco com status `pending`
10. **Retorna sucesso** com dados da bipagem

### Status possíveis:

- **`pending`** (Pendente): Bipagem registrada, aguardando venda
- **`verified`** (Verificado): Bipagem verificada e vinculada a uma venda
- **`cancelled`** (Cancelado): Bipagem cancelada manualmente

## Exemplos de Uso

### Exemplo 1: Simular bipagem simples
```json
{
  "raw": "2037040050854",
  "event_date": "2025-01-20T10:30:00.000Z"
}
```
**Resultado**: Cria bipagem de produto pesado com status "pending"

### Exemplo 2: Simular bipagem com equipamento
```json
{
  "raw": "2037040050854",
  "scanner_id": "SCANNER_01",
  "machine_id": "PDV_001",
  "event_date": "2025-01-20T10:30:00.000Z"
}
```
**Resultado**: Cria bipagem vinculada ao equipamento SCANNER_01/PDV_001

### Exemplo 3: Simular login de colaborador
```json
{
  "raw": "3122000000018",
  "scanner_id": "SCANNER_01",
  "machine_id": "PDV_001"
}
```
**Resultado**: Loga colaborador no equipamento (não cria bipagem)

## Visualizando as Bipagens

Após simular, você pode:

1. **Ir para "Bipagens Ao Vivo"**: As bipagens aparecem em tempo real
2. **Ver detalhes completos**: Produto, peso, preço, horário, vendedor
3. **Cancelar bipagens**: Status "pending" pode ser cancelado
4. **Reativar bipagens**: Status "cancelled" pode ser reativado
5. **Acompanhar tempo pendente**: Quanto tempo a bipagem está aguardando venda

## Dicas de Teste

### Para testar diferentes cenários:

1. **Produto pesado** (EAN peso): Use códigos começando com `20`
   - Exemplo: `2037040050854`

2. **Produto de preço fixo**: Use códigos EAN-13 comuns
   - Exemplo: `7891234567890`

3. **Login de vendedor**: Use códigos começando com `3122`
   - Exemplo: `3122000000018`

4. **Equipamentos diferentes**: Altere Scanner ID e Machine ID
   - Teste: `SCANNER_01`, `SCANNER_02`, etc.

5. **Datas diferentes**: Simule bipagens em horários específicos
   - Útil para testar filtros por data na aba "Bipagens Ao Vivo"

## Integração com o Sistema

O simulador usa o **mesmo endpoint** que os leitores físicos:
- **Endpoint**: `POST /api/bipagens/webhook`
- **Autenticação**: Token JWT do usuário logado
- **Formato**: JSON com campos `raw`, `scanner_id`, `machine_id`, `event_date`

Isso significa que:
- ✅ Testa o fluxo real do sistema
- ✅ Valida integração com ERP
- ✅ Registra equipamentos
- ✅ Vincula colaboradores
- ✅ Aparece em tempo real na interface

## Troubleshooting

### Problema: "Produto não encontrado no ERP"
**Solução**: O EAN usado não está cadastrado no sistema ERP. Use os exemplos fornecidos ou cadastre o produto no ERP primeiro.

### Problema: "Equipamento desabilitado"
**Solução**: O equipamento associado ao Scanner ID está marcado como inativo. Ative-o na aba "Configurações" → "Equipamentos".

### Problema: "EAN inválido"
**Solução**: O código fornecido não segue o formato EAN-13 válido. Verifique se tem 13 dígitos e dígito verificador correto.

### Problema: "Colaborador não encontrado"
**Solução**: Ao usar código de colaborador (3122...), certifique-se de que o colaborador está cadastrado no sistema.

## Próximos Passos

Com o simulador funcionando, você pode:

1. ✅ Testar o sistema completo sem hardware
2. ✅ Validar regras de negócio
3. ✅ Treinar usuários
4. ✅ Fazer testes de integração
5. ✅ Simular cenários de produção

## Suporte

Para dúvidas ou problemas, verifique:
1. Console do navegador (F12) para erros
2. Logs do backend para detalhes da requisição
3. Configurações de API estão corretas
4. ERP está acessível e respondendo
