# Troubleshooting: DVR Intelbras Crashes ao Receber Cupons

## Histórico de Crashes

### Crash 1 - Cupom Grande (759 bytes, 25 linhas)
**Data**: 2026-01-11
**Configuração DVR**:
- Nome PDV: PDV1
- Canal: 5
- Protocolo: General
- Modo de conexão: TCP
- Converter: Unicode(UTF-8)
- Exibição: Página
- Tempo excedido: 100s
- Tempo de exibição: 120s
- Tamanho da Fonte: Grande
- Cor da Fonte: ROSA/MAGENTA
- POS Info: ✅ Marcado
- Limitador: 7C (pipe |)

**Cupom Enviado**:
```
========================================|
        SUPERMERCADO BOM PRECO         |
========================================|
Data: 11/01/2026 - Hora: 14:30         |
Cupom Fiscal: 001234                   |
PDV: 01 - Operador: MARIA              |
========================================|
ITEM  DESCRICAO           QTD    VALOR |
----------------------------------------|
001   COCA COLA 2L       1      R$ 8,50|
002   ARROZ TIPO 1 5KG   2     R$ 25,00|
003   FEIJAO PRETO 1KG   1      R$ 7,80|
004   MACARRAO INST      3      R$ 6,90|
005   LEITE INTEGRAL     4     R$ 15,60|
----------------------------------------|
SUBTOTAL:                    R$ 63,80  |
DESCONTO:                     R$ 3,80  |
========================================|
TOTAL A PAGAR:               R$ 60,00  |
========================================|
FORMA DE PAGAMENTO: DINHEIRO           |
VALOR PAGO:                  R$ 100,00 |
TROCO:                        R$ 40,00 |
========================================|
     OBRIGADO PELA PREFERENCIA!        |
========================================|
```

**Resultado**: ❌ DVR travou após receber dados

### Crash 2 - Cupom Mínimo (115 bytes, 8 linhas)
**Data**: 2026-01-11 (~5 minutos depois do Crash 1)

**Cupom Enviado**:
```
SUPERMERCADO BOM PRECO|
Cupom: 123 - PDV 01|
Data: 11/01/2026|
---|
1x COCA COLA  R$ 8,50|
---|
TOTAL: R$ 8,50|
|
```

**Resultado**: ❌ DVR travou novamente

## Análise do Manual GCINT0037 (Zanthus)

### Descobertas Críticas

#### 1. Tempo de Exibição e Gravações Múltiplas
- **Problema Identificado**: Se o cupom exceder o "Tempo de exibição" configurado (120s no nosso caso), o DVR **cria uma NOVA gravação**
- **Exemplo do Manual** (página 17): Cupom com timeout de 600s foi dividido em DUAS gravações diferentes
- **Impacto**: Pode causar problemas de memória/buffer no DVR ao tentar criar múltiplas gravações rapidamente

#### 2. Biblioteca ZPPERDAS (Usado pela Zanthus)
A Zanthus usa biblioteca especializada que não estamos usando:
- **Linux**: lib3zpperdas.so
- **Windows**: zpperdas.dll

**O que a biblioteca faz que não estamos fazendo**:
- Gera logs detalhados (LGPERDAS) com status `r=0` para sucesso
- Implementa sequência de handshake específica com o DVR
- Gerencia timing correto entre envios
- Trata respostas e erros do DVR

#### 3. Configuração File 18 (Zanthus)
Formato: `|IP_DVR|PORTA_DVR|IP_PDV|PORTA_PDV|`
- Exemplo: `|192.168.1.100|38800|192.168.1.50|0|`
- Porta PDV = 0 (cliente não escuta respostas)

### Diferenças: Zanthus vs Nossa Implementação

| Aspecto | Zanthus (Manual) | Nossa Implementação |
|---------|------------------|---------------------|
| **Biblioteca** | ZPPERDAS (lib3zpperdas.so) | Node.js TCP direto |
| **Logging** | LGPERDAS com r=0/r=erro | Console.log apenas |
| **Configuração** | File 18 (971-061-NNN) | IP/porta diretos |
| **Teste** | Hercules (manual, controlado) | Script automatizado |
| **Delay entre envios** | Manual, um por vez | Rápido (5 min entre testes) |
| **Handshake** | Sequência específica da lib | Apenas connect + write |
| **Error handling** | Tratamento via biblioteca | Sem tratamento DVR-specific |

## Causas Possíveis dos Crashes

### 1. ⚠️ Tempo de Exibição Muito Curto (120s)
- Cupons podem estar excedendo 120s de exibição
- DVR tenta criar nova gravação enquanto processa a primeira
- Sobrecarga de memória/buffer

**Solução sugerida**: Aumentar para 300s ou 600s

### 2. ⚠️ Modo "Página" vs "Lista"
- Modo "Página" pode ter mais overhead de processamento
- Modo "Lista" pode ser mais leve

**Solução sugerida**: Testar modo "Lista"

### 3. ⚠️ Falta de Sequência de Inicialização
- ZPPERDAS provavelmente faz handshake antes de enviar dados
- Estamos enviando dados direto após connect

**Solução sugerida**: Investigar protocolo correto de handshake

### 4. ⚠️ Connection Close Timing
- Estamos fechando conexão após 500ms
- DVR pode precisar de mais tempo ou confirmação

**Solução sugerida**: Testar diferentes timings ou aguardar resposta do DVR

### 5. ⚠️ Delay Insuficiente Entre Envios
- Testamos 2 cupons com ~5 minutos de diferença
- DVR pode precisar de mais tempo para "limpar" estado anterior

**Solução sugerida**: Aguardar 10+ minutos ou reiniciar canal POS entre testes

### 6. ⚠️ Tamanho do Buffer/Cupom
- Mesmo cupom pequeno (115 bytes) travou
- Pode não ser problema de tamanho, mas de protocolo

**Solução sugerida**: Focar em protocolo correto, não tamanho

## Recomendações para Próximos Testes

### ⚙️ Mudanças de Configuração no DVR

1. **Aumentar Tempo de Exibição**
   - Atual: 120s
   - Sugerido: **300s** (5 minutos)
   - Evita criação de múltiplas gravações

2. **Testar Modo Lista**
   - Atual: Página
   - Testar: **Lista**
   - Pode ter menos overhead

3. **Ajustar Tempo Excedido**
   - Atual: 100s
   - Sugerido: **30s**
   - Timeout mais rápido se PDV desconectar

### 🧪 Protocolo de Teste Controlado

#### Teste 1: Cupom Ultra-Mínimo
```javascript
const cupom = 'TESTE 1|LINHA 2|FIM|';
```
- Apenas 3 linhas
- ~25 bytes
- Sem formatação complexa

#### Teste 2: Aguardar Resposta do DVR
```javascript
client.on('data', (data) => {
  console.log('DVR respondeu:', data.toString());
  client.end();
});

client.on('error', (err) => {
  console.error('Erro:', err);
});

client.connect(38800, '10.6.1.123', () => {
  client.write(cupom, 'utf8');
  // NÃO fechar automaticamente - aguardar resposta
});
```

#### Teste 3: Delay de 15+ Minutos Entre Envios
- Enviar cupom teste
- **Aguardar 15 minutos completos**
- Enviar próximo cupom
- Verificar se DVR "esqueceu" estado anterior

#### Teste 4: Verificar Logs do DVR
- Acessar interface web do DVR
- Verificar logs de erros
- Procurar mensagens sobre POS/Canal 5

### 📋 Checklist Pré-Teste

Antes de cada teste, verificar:

- [ ] DVR está online e responsivo
- [ ] Canal 5 está gravando normalmente
- [ ] Nenhum texto POS aparecendo atualmente
- [ ] Configurações POS corretas (limitador 7C, porta 38800)
- [ ] Aguardou tempo suficiente desde último teste (15+ min)
- [ ] Backup/snapshot da configuração DVR (se possível)

### 🚨 Protocolo de Emergência se Travar

1. **NÃO enviar mais dados** - aguardar recovery natural
2. Aguardar 5 minutos completos
3. Se não recuperar: reiniciar apenas o canal POS (não DVR todo)
4. Documentar: hora exata, cupom enviado, tempo até recovery
5. Verificar logs do DVR após recovery

## Próximos Passos

### Fase 1: Estabilizar Envio Básico ✅ PRIORIDADE
- [ ] Implementar teste ultra-controlado (cupom 3 linhas)
- [ ] Aumentar Tempo de exibição para 300s
- [ ] Testar modo "Lista"
- [ ] Aguardar resposta do DVR antes de fechar conexão
- [ ] Conseguir 1 envio bem-sucedido SEM crash

### Fase 2: Entender Protocolo (após Fase 1)
- [ ] Investigar se DVR envia resposta/ACK
- [ ] Documentar protocolo completo de comunicação
- [ ] Comparar com comportamento do Hercules utility
- [ ] Implementar handshake correto se necessário

### Fase 3: Sistema de Fila (SOMENTE após Fases 1 e 2)
- [ ] Implementar delay configurável entre cupons
- [ ] Sistema de retry com backoff exponencial
- [ ] Monitoramento de saúde do DVR
- [ ] Logs detalhados estilo LGPERDAS

### Fase 4: Integração com Zanthus (após Fase 3)
- [ ] Buscar cupons reais da API Zanthus
- [ ] Formatar conforme padrão do DVR
- [ ] Testar com cupons fiscais reais
- [ ] Validar busca por palavra-chave

## Limitações Conhecidas do DVR

1. **Crash fácil**: DVR é sensível a sequência incorreta de comandos
2. **Sem documentação pública**: Protocolo exato não documentado pela Intelbras
3. **Dependência da biblioteca Zanthus**: Método oficial usa ZPPERDAS
4. **Recovery lento**: Pode levar 5+ minutos para voltar após crash
5. **Tempo de exibição crítico**: Configuração incorreta causa múltiplas gravações

## Logs de Teste

### 2026-01-11 - Teste 1 (Crash)
```
[14:30:00] Conectando em 10.6.1.123:38800
[14:30:01] Conectado com sucesso
[14:30:01] Enviando cupom (759 bytes, 25 linhas)
[14:30:02] Dados enviados
[14:30:02] Conexão fechada
[14:30:03] ❌ DVR não responsivo
[14:35:00] ✅ DVR recuperado
```

### 2026-01-11 - Teste 2 (Crash)
```
[14:35:30] Conectando em 10.6.1.123:38800
[14:35:31] Conectado com sucesso
[14:35:31] Enviando cupom MÍNIMO (115 bytes, 8 linhas)
[14:35:32] Dados enviados
[14:35:32] Conexão fechada
[14:35:33] ❌ DVR travou novamente
[14:40:00] ✅ DVR recuperado
```

## Referências

- Manual GCINT0037 - Integração CFTV Zanthus
- Configuração DVR screenshot (PDV1 Canal 5)
- Transcrição método manual de configuração
- Testes realizados em 2026-01-11

---

**Última atualização**: 2026-01-11
**Status**: 🔴 DVR instável - crashes confirmados com cupons de todos os tamanhos
**Próximo teste**: Cupom ultra-mínimo (3 linhas) + aguardar resposta DVR + modo Lista
