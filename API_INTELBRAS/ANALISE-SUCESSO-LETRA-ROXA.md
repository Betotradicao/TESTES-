# Análise: Como Conseguimos Letra Roxa na Tela (Antes dos Crashes)

## Contexto

Você mencionou: "vc conseguiu escreve de roxo ali embaixo,,,"

Isso indica que **EM ALGUM MOMENTO** conseguimos fazer o texto aparecer roxo na tela do DVR, mas depois os testes causaram crashes.

## Diferenças Importantes

### O que FUNCIONOU (Letra Roxa Apareceu)
- ✅ Texto apareceu na tela
- ✅ Cor roxa/magenta foi exibida corretamente
- ✅ DVR não travou (ou não travou imediatamente)

### O que FALHOU (Crashes)
- ❌ Teste 1: Cupom 759 bytes, 25 linhas → DVR travou
- ❌ Teste 2: Cupom 115 bytes, 8 linhas → DVR travou novamente

## Análise das Configurações Encontradas via API

### VideoWidget - CustomTitle
Encontramos na API:
```
table.VideoWidget[0].CustomTitle[0].Text=TESTE POS - CUPOM 001
```

**Isso é DIFERENTE de enviar via porta TCP 38800!**

- **CustomTitle**: Texto estático configurado na interface web do DVR
- **POS via TCP**: Texto dinâmico enviado pela rede

### Configuração de Cor
A cor ROSA/MAGENTA (roxa) está configurada em:
```
table.VideoWidget[0].CustomTitle[0].FrontColor[0]=255
table.VideoWidget[0].CustomTitle[0].FrontColor[1]=255
table.VideoWidget[0].CustomTitle[0].FrontColor[2]=255
table.VideoWidget[0].CustomTitle[0].FrontColor[3]=255
```

**RGBA**: (255, 255, 255, 255) = Branco com alpha máximo

Mas na interface você disse que a cor está como ROSA/MAGENTA. Isso significa que a configuração de cor do **POS** pode estar em outro lugar.

## Hipóteses: Por Que Funcionou Antes?

### Hipótese 1: Teste Manual Anterior (Hercules ou Similar)
Você pode ter testado antes usando:
- Hercules Utility (mencionado no manual)
- Interface web do DVR (configuração manual)
- Outro software que seguiu o protocolo correto

### Hipótese 2: Configuração CustomTitle vs POS Dinâmico
Duas formas de exibir texto no DVR:

| Método | Como Funciona | Resultado |
|--------|---------------|-----------|
| **CustomTitle** | Configurado manualmente na web | Texto estático, sempre visível |
| **POS TCP** | Enviado via socket porta 38800 | Texto dinâmico, muda conforme cupons |

O texto "TESTE POS - CUPOM 001" pode ter sido:
- Configurado manualmente (CustomTitle)
- OU enviado via POS e ficou "preso" após crash

### Hipótese 3: Primeiro Envio Funcionou, Segundo Travou
Possível sequência:
1. Primeiro envio (pequeno) → ✅ Funcionou, texto roxo apareceu
2. DVR começou a processar
3. Segundo envio (grande) → ❌ DVR não estava pronto, travou
4. Ou: Primeiro envio não foi "fechado" corretamente, segundo envio causou conflito

## O Que Pode Estar Faltando no Nosso Código

### 1. Protocolo de Handshake
```javascript
// O que fizemos (ERRADO):
client.connect(38800, '10.6.1.123', () => {
  client.write(cupom, 'utf8');
  setTimeout(() => client.end(), 500);
});
```

**Problemas**:
- Não aguardamos resposta do DVR
- Não verificamos se DVR está pronto
- Fechamos conexão muito rápido (500ms)
- Não enviamos sequência de inicialização

### 2. Possível Protocolo Correto (Baseado em ATM/POS Padrão)

Muitos sistemas POS/ATM usam sequência específica:

```javascript
// Possível protocolo correto:
client.connect(38800, '10.6.1.123', () => {
  console.log('Conectado ao DVR');

  // 1. Aguardar resposta do DVR (pode enviar ACK ou prompt)
  client.once('data', (ack) => {
    console.log('DVR respondeu:', ack.toString('hex'));

    // 2. Enviar cupom
    client.write(cupom, 'utf8');

    // 3. Aguardar confirmação
    client.once('data', (confirm) => {
      console.log('DVR confirmou:', confirm.toString('hex'));

      // 4. Fechar conexão SOMENTE após confirmação
      setTimeout(() => client.end(), 1000);
    });
  });
});
```

### 3. Análise do Delimiter e Encoding

**Configuração esperada (do screenshot)**:
- Limitador: `7C` (hex) = `|` (pipe)
- Encoding: UTF-8
- Modo: Página
- Tempo: 120s

**O que enviamos**:
```javascript
const cupom = 'LINHA 1|LINHA 2|LINHA 3|';
```

✅ Formato correto: linhas separadas por `|` e terminadas com `|`

**Mas pode estar faltando**:
- Header específico (identificação do PDV/canal)
- Código de controle inicial
- Sequência de finalização
- Checksums ou validação

## Próximos Passos para Reproduzir o Sucesso

### Teste 1: Verificar Se Texto Atual É CustomTitle ou POS
```javascript
// Via API, limpar CustomTitle
curl -u "admin:beto3107@" --digest \
  "http://10.6.1.123/cgi-bin/configManager.cgi?action=setConfig&VideoWidget[0].CustomTitle[0].Text="
```

Se texto sumir da tela → Era CustomTitle (estático)
Se texto continuar → É POS (dinâmico) e está "preso"

### Teste 2: Envio Mínimo com Aguardo de Resposta
```javascript
const net = require('net');
const client = new net.Socket();

client.on('data', (data) => {
  console.log('DVR enviou:', data.toString());
  console.log('Hex:', data.toString('hex'));
});

client.on('error', (err) => {
  console.error('Erro:', err);
});

client.on('close', () => {
  console.log('Conexão fechada');
});

client.connect(38800, '10.6.1.123', () => {
  console.log('Conectado - aguardando resposta do DVR...');

  // NÃO enviar nada ainda, só ouvir
  setTimeout(() => {
    console.log('Nenhuma resposta em 5s');

    // Agora enviar cupom mínimo
    const cupom = 'TESTE|LINHA 2|FIM|';
    console.log('Enviando:', cupom.length, 'bytes');
    client.write(cupom, 'utf8');

    // Aguardar mais 5s antes de fechar
    setTimeout(() => {
      console.log('Fechando conexão...');
      client.end();
    }, 5000);
  }, 5000);
});
```

### Teste 3: Comparar com Zanthus (ZPPERDAS)
O manual mostra que Zanthus usa biblioteca específica. Podemos:
1. Capturar tráfego de rede quando Zanthus envia (tcpdump/wireshark)
2. Ver exatamente o que a biblioteca envia
3. Replicar byte-por-byte

### Teste 4: Usar Hercules Utility (Mencionado no Manual)
Download: https://www.hw-group.com/software/hercules-setup-utility
- Conectar em 10.6.1.123:38800
- Enviar manualmente linha por linha
- Observar respostas do DVR
- Ver exatamente quando texto aparece na tela

## Perguntas Críticas

1. **Quando você viu a letra roxa**, foi:
   - [ ] Durante nossos testes via Node.js?
   - [ ] Em teste manual anterior (Hercules/outro software)?
   - [ ] Configuração estática na interface web?

2. **O texto roxo que apareceu** era:
   - [ ] "TESTE POS - CUPOM 001" (que vimos na API)?
   - [ ] Outro texto diferente?
   - [ ] Cupom fiscal completo?

3. **Após aparecer o texto roxo**, o que aconteceu:
   - [ ] Ficou fixo na tela?
   - [ ] Desapareceu após X segundos?
   - [ ] DVR travou logo depois?

4. **Existe algum software da Zanthus rodando** no cliente que está enviando cupons automaticamente?
   - [ ] Sim, Zanthus POS com ZPPERDAS
   - [ ] Não, queremos implementar sem Zanthus

## Descoberta Importante: ATMSniffer vs CustomTitle

Pelo que vimos na API:

### CustomTitle (Estático)
- Configurado em: `VideoWidget[x].CustomTitle[y].Text`
- Sempre visível
- Não requer TCP
- Exemplo: "TESTE POS - CUPOM 001"

### ATMSniffer (Dinâmico via TCP)
- Configurado em: `ATMSniffer[x]`
- Recebe via porta 38800
- Protocolo ATM/POS
- Texto muda conforme transações

**Se o texto roxo que você viu era "TESTE POS - CUPOM 001"**, ele pode ter sido:
- Configurado manualmente como CustomTitle
- Não enviado via nossa integração TCP

## Conclusão Preliminar

Para reproduzir o sucesso (letra roxa aparecendo), precisamos:

1. ✅ Confirmar qual canal está configurado (4 ou 5)
2. ✅ Ver screenshot da configuração POS completa
3. ⚠️ Entender se texto anterior era CustomTitle ou POS dinâmico
4. ⚠️ Implementar protocolo correto com handshake
5. ⚠️ Aguardar respostas do DVR antes de fechar conexão
6. ⚠️ Testar com Hercules primeiro (manual) antes de automatizar

**Próximo teste sugerido**:
Usar Hercules Utility manualmente para conectar em 10.6.1.123:38800 e enviar:
```
TESTE|LINHA 2|FIM|
```

Ver se:
- DVR responde algo
- Texto aparece na tela
- Cor fica roxa/magenta
- DVR trava ou não
