# 🎯 INTEGRAÇÃO DVR POS - ROTA ALTERNATIVA SEM ZANTHUS

## 📋 OBJETIVO

Implementar integração direta entre **nosso sistema Backend** e o **DVR Intelbras** para exibir cupons fiscais nas câmeras, **SEM depender do Zanthus**.

---

## 🔄 COMPARAÇÃO: COM vs SEM ZANTHUS

### ❌ INTEGRAÇÃO PADRÃO (COM ZANTHUS)
```
[ZANTHUS ERP]
    ↓
[File 18 - Config 971-061-NNN]
    ↓
[ZPPERDAS Library (lib3zpperdas.so)]
    ↓
[TCP Socket - Porta 38800]
    ↓
[DVR INTELBRAS - 10.6.1.123:38800]
    ↓
[Texto sobreposto no vídeo das câmeras]
```

**Problemas:**
- Dependência do Zanthus Manager
- Precisa configurar File 18 manualmente
- Usa biblioteca proprietária ZPPERDAS
- Difícil debugar problemas
- Logs em arquivo `.ZL1` obscuros

---

### ✅ INTEGRAÇÃO ALTERNATIVA (SEM ZANTHUS)

```
[NOSSO BACKEND - Node.js/TypeScript]
    ↓
[DVRPOSService.ts]
    ↓
[TCP Socket - Porta 38800]
    ↓
[DVR INTELBRAS - 10.6.1.123:38800]
    ↓
[Texto sobreposto no vídeo das câmeras]
```

**Vantagens:**
- ✅ Controle total do código
- ✅ Logs em tempo real
- ✅ Formatação customizável
- ✅ Independente do Zanthus
- ✅ Funciona com qualquer fonte de dados (API, webhook, banco, etc)
- ✅ Fácil debugar e testar

---

## 🛠️ IMPLEMENTAÇÃO TÉCNICA

### 1. **Arquivo Principal: `DVRPOSService.ts`**

**Localização:** `packages/backend/src/services/dvr-pos.service.ts`

**Já está implementado!** Este arquivo contém toda a lógica necessária.

#### Funcionalidades:

```typescript
class DVRPOSService {
  // 1. Formatar venda para padrão DVR
  private static formatSaleToDVR(sale: any): string

  // 2. Enviar cupom via TCP
  static async sendToDVR(cupom: string): Promise<void>

  // 3. Processar venda do banco e enviar
  static async processSale(saleId: string): Promise<void>

  // 4. Configurar IP/porta do DVR
  static configure(config: Partial<DVRConfig>): void

  // 5. Testar conexão
  static async testConnection(): Promise<boolean>
}
```

---

### 2. **PROTOCOLO DE COMUNICAÇÃO**

#### 2.1 Conexão TCP

```typescript
const client = new net.Socket();
client.connect(38800, '10.6.1.123', () => {
  console.log('✅ Conectado ao DVR');
});
```

- **IP:** `10.6.1.123` (DVR Intelbras)
- **Porta:** `38800` (padrão POS)
- **Protocolo:** TCP Raw Socket
- **Timeout:** 5 segundos

---

#### 2.2 Formato do Cupom

**DELIMITADOR:** Pipe `|` (0x7C em hexadecimal)

**Estrutura:**
```
Linha 1|Linha 2|Linha 3|...|Linha N|
```

**Exemplo Completo:**
```javascript
const cupom = [
  '========================================',
  '      SUPERMERCADO BOM PRECO           ',
  '========================================',
  'CNPJ: 12.345.678/0001-99',
  'Rua das Flores, 123 - Centro',
  '========================================',
  '',
  'Data: 10/01/2026',
  'Hora: 14:35:22',
  'Cupom: 123456',
  'Caixa: PDV 01',
  'Operador: MARIA SILVA',
  '',
  '========================================',
  '            PRODUTOS                    ',
  '========================================',
  '',
  '001 ARROZ TIPO 1 5KG',
  '    1 x R$ 25,90',
  '                           R$ 25,90',
  '',
  '002 FEIJAO PRETO 1KG',
  '    2 x R$ 8,50',
  '                           R$ 17,00',
  '',
  '========================================',
  'SUBTOTAL:              R$ 42,90',
  '========================================',
  'TOTAL:                 R$ 42,90',
  '========================================',
  '',
  'FORMA DE PAGAMENTO:',
  'DINHEIRO               R$ 42,90',
  '',
  '========================================',
  '      OBRIGADO PELA PREFERENCIA!       ',
  '========================================',
  ''
].join('|') + '|';
```

**Regras Importantes:**
- ✅ Máximo **40-50 caracteres por linha** (DVR tem limite de largura)
- ✅ Usar apenas **ASCII ou UTF-8** (evitar emojis)
- ✅ Terminar com pipe `|` no final
- ✅ Linhas vazias = pipe sozinho: `||`
- ❌ Evitar linhas muito longas (cortam na tela)

---

#### 2.3 Encoding

```typescript
client.write(cupom, 'utf8');
```

**Encodings testados:**
- ✅ **UTF-8**: Funciona, permite acentos (á, é, ç)
- ✅ **ASCII**: Mais seguro, sem acentos
- ❌ **ISO-8859-1**: Não testado ainda

---

### 3. **CONFIGURAÇÃO DO DVR**

#### 3.1 Configurações Obrigatórias

Acessar: `http://10.6.1.123` → Menu → POS → Configurar

| Parâmetro | Valor | Crítico? |
|-----------|-------|----------|
| **Habilitar POS** | ✅ Marcado | **SIM** |
| **Gravar Canal** | ✅ Marcado | **SIM** |
| **Protocolo** | `General` ou `TCP` | SIM |
| **Tipo de ligação** | `TCP` | SIM |
| **IP de Origem** | `0.0.0.0` | Não |
| **Porta de Origem** | vazio ou `0` | Não |
| **Porta de Destino** | `38800` | **SIM** |
| **Limitador** | `7C` | **MUITO IMPORTANTE** |
| **Tempo de exibição (linha)** | `100-600` ms | Não |
| **Tempo de exibição (geral)** | `10000` ms | Não |
| **POS Info** | ✅ Marcado | **SIM** |
| **Overlay Ativo** | ✅ Marcado | **SIM** |
| **Cor da Fonte** | Branco/Verde | Não |
| **Tamanho da Fonte** | Grande | Não |

---

#### 3.2 **LIMITADOR 7C - O QUE É?**

O **limitador** é o caractere que **separa as linhas** do cupom.

- **7C** = Pipe `|` em hexadecimal
- **0A** = Line Feed `\n` (Linux)
- **0D0A** = Carriage Return + Line Feed `\r\n` (Windows)

**Se o texto NÃO aparece nas câmeras:**
1. Tente mudar limitador para `0A`
2. Se ainda não funcionar, tente `0D0A`
3. Volta para `7C` (padrão)

---

#### 3.3 **GRAVAÇÃO POS (BARRA ROXA)**

Para a **BUSCA POS** funcionar, é OBRIGATÓRIO configurar a gravação:

**Passo a passo:**
1. Menu → Armazenamento → Agenda
2. Clique na engrenagem do **DOMINGO**
3. Na janela que abrir:
   - ✅ Marque a caixa **"POS"**
   - Deve aparecer **BARRA ROXA** no gráfico de horários
4. Clique em **"Copiar para"** → Selecionar **TODOS os dias**
5. Salvar

**SEM A BARRA ROXA:**
- ❌ Texto aparece nas câmeras AO VIVO
- ❌ MAS não grava no HD
- ❌ Busca POS retorna vazia

**COM A BARRA ROXA:**
- ✅ Texto aparece AO VIVO
- ✅ Grava no HD do DVR
- ✅ Busca POS funciona (buscar por "COCA COLA", ver vídeo com texto)

---

#### 3.4 Verificar Status POS via API

**Script:** `API_INTELBRAS/scripts-teste/show-pos-configs.js`

```bash
cd API_INTELBRAS/scripts-teste
node show-pos-configs.js
```

**Saída esperada:**
```
╔═══════════════════════════════════════════════════════════════════╗
║              CONFIGURAÇÕES POS - DVR INTELBRAS                   ║
╚═══════════════════════════════════════════════════════════════════╝

DVR: 10.6.1.123

═══════════════════════════════════════════════════════════════════
PDV1 (POS #4):
  Status: ✅ ATIVO
  Overlay Ativo: ✅ SIM
  Canal: 3
  Porta: 38800
  Delimitador: 7C
═══════════════════════════════════════════════════════════════════
```

**Se Overlay mostrar ❌ NÃO:**

```bash
node habilitar-overlay-pdv2.js  # (ajustar para o PDV correto)
```

---

### 4. **INTEGRAÇÃO COM VENDAS**

#### 4.1 Opção 1: Automático (Trigger no Backend)

**Quando:** Uma venda é finalizada no sistema

**Onde:** `packages/backend/src/controllers/sales.controller.ts`

```typescript
import { DVRPOSService } from '../services/dvr-pos.service';

// No método createSale() ou finalizeSale()
async createSale(req: Request, res: Response) {
  try {
    // ... criar venda no banco ...

    const sale = await saleRepository.save(newSale);

    // 🎯 ENVIAR PARA DVR AUTOMATICAMENTE
    await DVRPOSService.processSale(sale.id);

    return res.status(201).json(sale);
  } catch (error) {
    // ... tratamento de erro ...
  }
}
```

**Fluxo:**
1. Venda criada no banco
2. `DVRPOSService.processSale()` é chamado
3. Service busca venda + itens no banco
4. Formata cupom
5. Envia via TCP para DVR
6. Texto aparece nas câmeras

---

#### 4.2 Opção 2: Webhook/API Externa

**Quando:** Receber webhook de sistema externo (PDV, ERP, etc)

**Endpoint:** `POST /api/dvr/pos/send`

```typescript
// packages/backend/src/routes/dvr.routes.ts
router.post('/pos/send', async (req, res) => {
  try {
    const { sale } = req.body;

    // Formatar cupom
    const cupom = DVRPOSService.formatSaleToDVR(sale);

    // Enviar
    await DVRPOSService.sendToDVR(cupom);

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
```

**Exemplo de chamada:**
```bash
curl -X POST http://46.202.150.64:3001/api/dvr/pos/send \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer SEU_TOKEN" \
  -d '{
    "sale": {
      "id": "123",
      "dataVenda": "2026-01-10T14:35:22",
      "notaFiscalNumero": "456789",
      "caixa": "PDV 01",
      "operador": "MARIA SILVA",
      "valorTotal": 42.90,
      "items": [
        {
          "descricao": "ARROZ TIPO 1 5KG",
          "quantidade": 1,
          "valorUnitario": 25.90,
          "valorTotal": 25.90
        },
        {
          "descricao": "FEIJAO PRETO 1KG",
          "quantidade": 2,
          "valorUnitario": 8.50,
          "valorTotal": 17.00
        }
      ]
    }
  }'
```

---

#### 4.3 Opção 3: Manual (Teste ou Admin)

**Script de teste:** `API_INTELBRAS/scripts-teste/teste-cupom-visual.js`

```bash
cd API_INTELBRAS/scripts-teste
node teste-cupom-visual.js
```

Envia cupom de teste com 5 produtos para DVR.

---

### 5. **DIFERENÇAS DO ZANTHUS**

| Aspecto | COM ZANTHUS | SEM ZANTHUS (Nossa Solução) |
|---------|-------------|------------------------------|
| **Configuração** | File 18 (971-061-NNN) | Código TypeScript |
| **Biblioteca** | ZPPERDAS (lib3zpperdas.so) | Node.js `net` module |
| **Logs** | `.ZL1` (obscuros) | Console/Winston (claros) |
| **Formato** | Fixo do Zanthus | 100% customizável |
| **Fonte de Dados** | Apenas Zanthus ERP | Qualquer fonte (API, DB, webhook) |
| **Debug** | Difícil | Fácil (breakpoints, logs) |
| **Dependência** | Alta (Zanthus Manager) | Zero |
| **Manutenção** | Complexa | Simples |

---

### 6. **ESTRUTURA DO FILE 18 (ZANTHUS) - PARA REFERÊNCIA**

Se no futuro precisar integrar COM Zanthus, aqui está a estrutura:

**Faixa:** `971-061-NNN` (onde NNN = número do PDV)

**Exemplo:** `971-061-001` (PDV 1)

**Formato:**
```
|IP_DVR|PORTA_DVR|IP_PDV|PORTA_PDV|
```

**Exemplo Concreto:**
```
|10.6.1.123|38800|10.6.1.100|0|
```

**Campos:**
1. **IP_DVR**: IP do DVR Intelbras (ex: `10.6.1.123`)
2. **PORTA_DVR**: Porta POS do DVR (geralmente `38800`)
3. **IP_PDV**: IP da máquina do PDV (ex: `10.6.1.100`)
4. **PORTA_PDV**: Porta local do PDV (geralmente `0` ou vazio)

**Cadastro no Zanthus Manager:**
1. Configurações → Cadastro de Servidores de Gravação
2. Tipo: `INTELBRAS`
3. Subtipo: `ZINTELBRAS`
4. IP: `10.6.1.123`
5. Porta: `38800`
6. Vincular PDVs → Selecionar PDVs que vão enviar

**Logs Zanthus:**
- **Localização:** `Zanthus/Zeus/pdv/Java/LGPERDAS/AAAAMMDD.ZL1`
- **Formato:** `timestamp|r=0|mensagem` (r=0 sucesso, r≠0 erro)

---

### 7. **TESTES E VALIDAÇÃO**

#### 7.1 Teste de Conexão

**Script:** `API_INTELBRAS/scripts-teste/teste-conexao.js`

```javascript
const net = require('net');

const client = new net.Socket();
client.setTimeout(5000);

client.connect(38800, '10.6.1.123', () => {
  console.log('✅ Conectado ao DVR!');
  client.end();
});

client.on('error', (err) => {
  console.error('❌ Erro:', err.message);
});

client.on('timeout', () => {
  console.error('⏱️ Timeout');
  client.destroy();
});
```

**Resultado esperado:**
```
✅ Conectado ao DVR!
```

---

#### 7.2 Teste de Envio de Cupom

**Script:** `API_INTELBRAS/scripts-teste/teste-cupom-visual.js`

```bash
node teste-cupom-visual.js
```

**Verificar:**
1. Console mostra: `✅ Cupom enviado ao DVR com sucesso!`
2. Acessar DVR web: `http://10.6.1.123`
3. Ver câmera PDV (ex: Canal 3 ou 4)
4. **Texto deve aparecer sobreposto no vídeo AO VIVO**

---

#### 7.3 Teste de Busca POS (Requer Barra Roxa)

1. Enviar cupom de teste (com produto "COCA COLA")
2. Aguardar 1-2 minutos
3. Acessar DVR: Menu → POS → Buscar
4. Buscar por: `COCA` ou `COLA`
5. **Deve aparecer a transação na lista**
6. Clicar na transação → **Ver vídeo com texto sobreposto**

**Se não aparecer:**
- ❌ Barra roxa NÃO configurada
- ❌ Gravação POS desabilitada
- ❌ Aguardar mais tempo (pode demorar até 5 min)

---

### 8. **TROUBLESHOOTING**

#### Problema 1: Conexão OK mas texto NÃO aparece

**Checklist:**
- [ ] POS habilitado no DVR?
- [ ] Overlay habilitado? (`show-pos-configs.js`)
- [ ] Limitador configurado como `7C`?
- [ ] Câmera/canal selecionado para POS?
- [ ] Texto tem menos de 50 caracteres por linha?
- [ ] Termina com pipe `|`?

**Solução:** Ver arquivo `API_INTELBRAS/Manual/TROUBLESHOOTING_DVR.md`

---

#### Problema 2: ECONNREFUSED (Conexão recusada)

**Causa:** Porta 38800 fechada ou DVR offline

**Verificar:**
```bash
# Linux/Mac
nc -zv 10.6.1.123 38800

# Windows
Test-NetConnection -ComputerName 10.6.1.123 -Port 38800
```

**Solução:**
- Verificar se DVR está ligado
- Ping no DVR: `ping 10.6.1.123`
- Verificar firewall do DVR

---

#### Problema 3: Texto aparece mas desaparece muito rápido

**Causa:** Tempo de exibição muito baixo

**Solução:**
1. DVR → POS → Configurar
2. **Tempo de exibição**: Aumentar para `500-1000` ms
3. **Tempo de exibição geral**: Aumentar para `20000` ms (20 seg)

---

#### Problema 4: Busca POS retorna vazia

**Causa:** Barra roxa não configurada (gravação POS desabilitada)

**Solução:**
1. Menu → Armazenamento → Agenda
2. Engrenagem → Marcar **POS**
3. Verificar **barra roxa** no gráfico
4. Copiar para todos os dias

**Script de verificação:**
```bash
node verificar-gravacao-pos.js
```

---

### 9. **ARQUIVOS IMPORTANTES**

#### Backend (Produção)
```
packages/backend/src/
├── services/
│   └── dvr-pos.service.ts        # Serviço principal
├── controllers/
│   └── sales.controller.ts       # Integrar aqui
└── routes/
    └── dvr.routes.ts             # Endpoint webhook (se necessário)
```

#### Scripts de Teste
```
API_INTELBRAS/scripts-teste/
├── show-pos-configs.js           # Ver config POS
├── habilitar-overlay-pdv2.js     # Habilitar overlay
├── teste-cupom-visual.js         # Enviar cupom teste
├── teste-conexao.js              # Testar TCP
└── verificar-gravacao-pos.js     # Verificar barra roxa
```

#### Documentação
```
API_INTELBRAS/Manual/
├── TROUBLESHOOTING_DVR.md        # Solução de problemas
└── GCINT0037.pdf                 # Manual Zanthus (referência)
```

---

### 10. **RESUMO FINAL**

#### O que JÁ ESTÁ PRONTO:

✅ Serviço `DVRPOSService.ts` implementado
✅ Formatação de cupom em padrão DVR
✅ Conexão TCP na porta 38800
✅ Scripts de teste funcionando
✅ Documentação completa

#### O que PRECISA FAZER:

1. **Integrar com endpoint de vendas:**
   - Chamar `DVRPOSService.processSale(saleId)` quando venda for criada

2. **Configurar DVR (uma vez):**
   - Habilitar POS
   - Configurar limitador `7C`
   - Habilitar overlay
   - Configurar barra roxa (se quiser busca)

3. **Testar:**
   - Enviar cupom de teste
   - Verificar texto nas câmeras
   - Testar busca POS (opcional)

---

### 11. **PRÓXIMOS PASSOS (ORDEM)**

#### Passo 1: Testar Ambiente Atual
```bash
cd API_INTELBRAS/scripts-teste
node teste-cupom-visual.js
```
Verificar se texto aparece no DVR.

#### Passo 2: Integrar no Backend
```typescript
// packages/backend/src/controllers/sales.controller.ts
import { DVRPOSService } from '../services/dvr-pos.service';

// Ao criar venda:
await DVRPOSService.processSale(sale.id);
```

#### Passo 3: Configurar Barra Roxa (Se Necessário)
Menu → Armazenamento → Agenda → POS → Salvar

#### Passo 4: Deploy
```bash
git add .
git commit -m "feat: Adiciona integração DVR POS sem Zanthus"
git push
```

#### Passo 5: Validar em Produção
- Criar venda real
- Verificar texto nas câmeras
- Testar busca POS

---

## 📞 CONTATO

Em caso de dúvidas sobre esta integração, consultar:

- **Desenvolvedor:** Roberto Santos
- **Email:** betotradicao76@gmail.com
- **Documentação DVR:** `API_INTELBRAS/Manual/TROUBLESHOOTING_DVR.md`
- **Manual Zanthus:** `API_INTELBRAS/Manual/GCINT0037.pdf`

---

**Desenvolvido em:** Janeiro 2026
**Última atualização:** 10/01/2026
