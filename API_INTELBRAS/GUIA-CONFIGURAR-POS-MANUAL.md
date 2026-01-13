# 📝 GUIA: Configurar POS PDV1 no Canal 5 - MANUALMENTE

## ⚠️ IMPORTANTE
Este DVR só tem **1 configuração POS** disponível via API (PosConfig[0]).
Como já está sendo usado pela Câmera 1 (FACIAL ENTRADA), vamos configurar **manualmente pela interface web**.

---

## 🌐 ACESSO À INTERFACE WEB

**URL:** http://10.6.1.123
**Usuário:** admin
**Senha:** beto3107@

---

## 📋 PASSO A PASSO - CONFIGURAÇÃO POS

### 1. Acessar Menu POS

1. Faça login no DVR
2. Clique em **Menu** (ícone de hamburger superior direito)
3. Navegue até: **POS** → **Configurar**

---

### 2. Adicionar Novo POS (PDV1)

Se já existir uma configuração (FACIAL ENTRADA), você pode:

**Opção A:** Adicionar novo POS (se o DVR suportar múltiplos)
- Procure botão **"Adicionar"** ou **"+"**
- Nome: **PDV1**

**Opção B:** Editar POS existente (se só houver 1 slot)
- Modifique a configuração atual para PDV1

---

### 3. Configurar Parâmetros Básicos

| Campo | Valor | Obrigatório |
|-------|-------|-------------|
| **Nome PDV** | `PDV1` | ✅ SIM |
| **Habilitar** | ✅ Marcado | ✅ SIM |
| **Canal** | Canal **5** | ✅ SIM |
| **Privacidade** | Desmarcar | Não |

---

### 4. Configurar Protocolo

| Campo | Valor | Obrigatório |
|-------|-------|-------------|
| **Protocolo** | `General` | ✅ SIM |
| **Modo de conexão** | `TCP` | ✅ SIM |

---

### 5. Configurar Endereço IP (Engrenagem/Config)

⚠️ **CLIQUE NO ÍCONE DE ENGRENAGEM** ao lado de "Tipo de Ligação"

| Campo | Valor | Explicação |
|-------|-------|------------|
| **IP de Origem** | `10.6.1.171` | IP da máquina que ENVIA os dados (PDV/Backend) |
| **Porta Origem** | `37777` | Porta de origem (pode deixar padrão) |
| **IP de Destino** | `10.6.1.123` | IP do próprio DVR |
| **Porta Destino** | `38800` | ✅ **PORTA POS PADRÃO** |

Clique em **Salvar**

---

### 6. Configurar Converter (Codificação)

| Campo | Valor | Obrigatório |
|-------|-------|-------------|
| **Converter** | `Unicode(UTF-8)` | ✅ SIM |

Isso garante acentuação correta (á, é, ç, etc)

---

### 7. Configurar Modo de Exibição

| Campo | Valor | Recomendado |
|-------|-------|-------------|
| **Modo de Exibição** | `Pagina` (ou `TURN`) | ✅ SIM |
| **Tempo Excedido** | `100` segundos | Sim |
| **Tempo de Exibição** | `120` segundos | Sim |

**Explicação:**
- **Pagina**: Quando acaba a tela, apaga tudo e começa de cima
- **Lista**: Texto sobe linha por linha (estilo créditos)

---

### 8. Configurar Aparência do Texto

| Campo | Valor | Recomendado |
|-------|-------|-------------|
| **Tamanho da Fonte** | `Grande` | Sim |
| **Cor da Fonte** | `Laranja` ou `Branco` | Sim |

💡 **Dica:** Escolha cor que contraste com o chão da loja

---

### 9. Configurar POS Info

| Campo | Valor | CRÍTICO |
|-------|-------|---------|
| **POS Info** | ✅ **MARCADO** | ✅ **SIM** |

⚠️ **SE NÃO MARCAR:** Texto grava mas NÃO aparece no monitoramento ao vivo!

---

### 10. Configurar Limitador (DELIMITADOR)

| Campo | Valor | MUITO IMPORTANTE |
|-------|-------|-------------------|
| **Limitador** | `7C` | ✅ **OBRIGATÓRIO** |

**O que é 7C?**
- `7C` = Pipe `|` em hexadecimal
- É o caractere que **separa as linhas** do cupom

**Exemplo de cupom:**
```
LINHA 1|LINHA 2|LINHA 3|
```

**Se o texto não aparecer, tente:**
- `0A` = Line Feed `\n`
- `0D0A` = `\r\n` (Windows)

---

### 11. SALVAR CONFIGURAÇÃO

Clique em **Salvar** ou **OK**

---

## 🟣 PASSO CRÍTICO: CONFIGURAR BARRA ROXA (GRAVAÇÃO POS)

⚠️ **SEM ISSO, O POS NÃO GRAVA NO HD DO DVR!**

### Passo a Passo:

1. **Menu** → **Armazenamento** → **Agenda**

2. Clique na **engrenagem** do **DOMINGO**

3. Na janela que abrir:
   - ✅ Marque a caixa **"POS"**
   - Deve aparecer **BARRA ROXA** no gráfico de horários

4. Clique em **"Copiar para"** → Selecionar **TODOS os dias da semana**

5. Clique em **Salvar**

### Como saber se funcionou?

✅ **COM Barra Roxa:**
- Texto aparece AO VIVO nas câmeras
- Texto GRAVA no HD
- Busca POS funciona (Menu → POS → Buscar)

❌ **SEM Barra Roxa:**
- Texto aparece AO VIVO
- MAS não grava no HD
- Busca POS retorna VAZIA

---

## 🧪 TESTAR CONFIGURAÇÃO

### Opção 1: Hercules SETUP Utility (Recomendado)

1. Baixar: https://www.hw-group.com/software/hercules-setup-utility

2. Abrir Hercules → Aba **TCP Client**

3. Configurar:
   - **IP:** `10.6.1.123`
   - **Port:** `38800`

4. Clicar em **Connect**

5. Na caixa de texto, digitar:
   ```
   TESTE PDV1|LINHA 2|LINHA 3|TOTAL: R$ 10,00|
   ```

6. Clicar em **Send**

7. **VERIFICAR:**
   - Acessar DVR web: http://10.6.1.123
   - Ver **Canal 5** (ao vivo)
   - O texto deve aparecer sobreposto no vídeo!

---

### Opção 2: Script Node.js

```bash
cd API_INTELBRAS/scripts-teste
node teste-cupom-visual.js
```

---

## 🔍 VERIFICAR BUSCA POS

1. **Menu** → **POS** → **Buscar**

2. Filtros:
   - **Nome da regra:** PDV1
   - **Canal:** 5
   - **Data/Hora:** Hoje

3. Buscar por texto: `TESTE`

4. **Deve aparecer** a transação na lista

5. Clicar na transação → **Ver vídeo com texto sobreposto**

**Se não aparecer:**
- ❌ Barra roxa NÃO configurada
- ❌ Aguardar 1-2 minutos (pode demorar)
- ❌ Verificar se Canal está correto (5)

---

## ❗ TROUBLESHOOTING

### Problema: Texto NÃO aparece nas câmeras

**Checklist:**
- [ ] POS habilitado? (checkbox marcado)
- [ ] Canal selecionado corretamente? (5)
- [ ] **POS Info** marcado?
- [ ] Porta 38800 correta?
- [ ] Limitador configurado como `7C`?
- [ ] Texto termina com pipe `|`?

---

### Problema: Conexão RECUSADA (Hercules)

**Causa:** Porta 38800 não está aberta ou DVR offline

**Solução:**
```bash
# Windows (PowerShell)
Test-NetConnection -ComputerName 10.6.1.123 -Port 38800

# Se falhar:
# 1. Verificar se DVR está ligado
# 2. Ping: ping 10.6.1.123
# 3. Verificar firewall do DVR
```

---

### Problema: Texto aparece MAS desaparece rápido

**Causa:** Tempo de exibição muito baixo

**Solução:**
1. Menu → POS → Configurar
2. **Tempo de Exibição:** Aumentar para `500-1000` segundos
3. Salvar

---

### Problema: Busca POS retorna VAZIA

**Causa:** Barra roxa não configurada

**Solução:**
1. Menu → Armazenamento → Agenda
2. Engrenagem → Marcar **POS**
3. Verificar **barra roxa** apareceu
4. Copiar para todos os dias

---

## 📊 RESUMO DA CONFIGURAÇÃO

| Parâmetro | Valor Correto |
|-----------|---------------|
| Nome | PDV1 |
| Canal | 5 |
| IP Origem | 10.6.1.171 |
| Porta Origem | 37777 |
| IP Destino | 10.6.1.123 |
| Porta Destino | 38800 |
| Protocolo | General (TCP) |
| Converter | UTF-8 |
| Limitador | 7C |
| POS Info | ✅ Marcado |
| Barra Roxa | ✅ Configurada |

---

## ✅ CHECKLIST FINAL

Antes de testar em produção, verifique:

- [ ] POS habilitado no DVR
- [ ] Canal 5 selecionado
- [ ] Porta 38800 configurada
- [ ] Limitador 7C configurado
- [ ] POS Info marcado
- [ ] Barra Roxa configurada (CRÍTICO!)
- [ ] Teste com Hercules funcionou
- [ ] Busca POS retorna dados

---

**Última atualização:** 12/01/2026
**Criado por:** Claude AI
**Baseado em:** GCINT0037.pdf + Experiência prática
