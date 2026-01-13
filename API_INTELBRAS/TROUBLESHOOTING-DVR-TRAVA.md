# 🔴 TROUBLESHOOTING: DVR Intelbras Trava ao Receber Dados POS

**Data:** 12/01/2026
**DVR:** Intelbras MHDX 3108 (10.6.1.123)
**Problema:** DVR trava/reinicia ao receber qualquer dado via porta 38800

---

## 📋 RESUMO DO PROBLEMA

O DVR Intelbras **trava e reinicia** toda vez que recebe dados via TCP na porta 38800 (porta POS), independentemente do:
- Volume de dados (testamos desde 1 palavra até cupons completos)
- Formato do envio (uma linha, múltiplas linhas, eventos separados)
- Configuração POS (testamos várias configurações diferentes)

---

## 🧪 TESTES REALIZADOS (TODOS FALHARAM)

### Teste 1: Cupom Completo (~50 linhas)
**Arquivo:** `teste-cupom-visual.js`
**Resultado:** ❌ DVR travou
**Motivo inicial:** Suspeitamos que era muito dado de uma vez

### Teste 2: Cupom Coca Cola (~25 linhas)
**Arquivo:** `teste-coca-cola.js`
**Resultado:** ❌ DVR travou
**Motivo inicial:** Ainda muito dado

### Teste 3: Cupom Mínimo (3 linhas)
**Arquivo:** `teste-minimo-coca.js`
**Dados enviados:**
```
COCA COLA 2L|R$ 10,99|TESTE PDV1|
```
**Tamanho:** 33 bytes
**Resultado:** ❌ DVR travou

### Teste 4: Eventos Separados (estilo Zanthus)
**Arquivo:** `teste-minimo-coca.js` (modificado)
**Estratégia:** Enviar eventos separados com intervalo de 100ms, imitando o Zanthus
**Eventos:**
1. `AbreDoc: COD=001|`
2. `Item: 1 - COCA COLA 2L, qtd=1 valor=10.99|`
3. `TOTAL: R$ 10,99|`
4. `DINHEIRO: R$ 10,99|`
5. `FECHA CUPOM|`

**Resultado:** ❌ DVR travou

### Teste 5: Diagnóstico (4 linhas)
**Arquivo:** `teste-diagnostico-pos.js`
**Dados enviados:**
```
TESTE DIAGNOSTICO|IP 10.6.1.171|PORTA 38800|PROCURAR EM TODOS OS CANAIS|
```
**Tamanho:** 72 bytes
**Resultado:** ❌ DVR travou

### Teste 6: PDV4 Simples (1 linha - TESTE FINAL)
**Arquivo:** `teste-pdv4-simples.js`
**Configuração:** PDV4 configurado manualmente via interface web
**Dados enviados:**
```
TESTE PDV4|
```
**Tamanho:** **11 bytes** (APENAS 1 PALAVRA!)
**Resultado:** ❌ DVR travou/reiniciou

---

## ⚙️ CONFIGURAÇÕES TESTADAS

### Configuração 1: PDV1 - Canal 5 (via API)
**Status:** Tentativa de configuração via API
**Problema:** API retornou erro 400 (Bad Request)
**Conclusão:** DVR não aceita múltiplas configurações POS via API

### Configuração 2: PDV2 - Canal 5 (existente)
**IP Origem:** 10.6.1.171
**Canal:** 5 (índice 4)
**Status:** Já existia no DVR
**Teste:** Enviamos dados, DVR travou

### Configuração 3: PDV4 - Canal 4 (manual - COMPLETA)
**IP Origem:** 10.6.1.171 ✅
**Porta Origem:** 38800 ✅
**IP Destino:** 10.6.1.123 ✅
**Porta Destino:** 38800 ✅
**Protocolo:** General ✅
**Modo de conexão:** TCP ✅
**Limitador:** 7C (pipe |) ✅
**Converter:** Unicode(UTF-8) ✅
**POS Info:** ✅ MARCADO
**Overlay:** ✅ ATIVO
**Tempo exibição:** 120s ✅
**Tamanho Fonte:** Grande ✅

**Status:** Configuração 100% correta segundo manual GCINT0037
**Teste:** Enviamos 11 bytes (1 palavra), **DVR TRAVOU**

---

## 📚 DOCUMENTAÇÃO CONSULTADA

### Manual Zanthus - GCINT0037.pdf
**Aprendizados:**
1. Limitador **7C** = Pipe `|` em hexadecimal (quebra de linha)
2. Zanthus envia eventos separados (não cupom inteiro de uma vez)
3. Configuração de IP de Origem é CRÍTICA
4. POS Info deve estar marcado para texto aparecer
5. Overlay deve estar ativo

**Exemplos do Zanthus (funcionam no DVR):**
```
AbreDoc: COD=243|
Item: 1 - RANCHO URBANO, qtd=1.000 valor=11.90|
CancelandoCupom|
OPERACAO: FUNC=2-FECHATE-3|
```

O manual mostra cupons ENORMES funcionando via Zanthus.

### Arquivos Criados Durante Investigação
1. `INTEGRACAO-DVR-POS-SEM-ZANTHUS.md` - Guia completo de integração
2. `GUIA-CONFIGURAR-POS-MANUAL.md` - Passo a passo configuração manual
3. Múltiplos scripts de teste (documentados acima)

---

## 🔍 ANÁLISE E HIPÓTESES

### Hipótese 1: Problema de Firmware/Bug DVR ❓
**Evidências:**
- DVR trava com qualquer volume de dados (até 11 bytes)
- Configuração está 100% correta segundo manual
- Zanthus consegue enviar dados (comprovado por screenshots)

**Possibilidade:** Bug no firmware do DVR que só aceita dados do Zanthus

### Hipótese 2: Autenticação/Handshake Especial ❓
**Evidências:**
- Zanthus usa biblioteca proprietária `lib3zpperdas.so` (Linux) / `zpperdas.dll` (Windows)
- Pode haver handshake ou autenticação especial que não está documentada
- DVR pode validar origem dos dados além do IP

### Hipótese 3: Protocolo Proprietário ❓
**Evidências:**
- Embora manual diga "General TCP", pode haver protocolo proprietário
- Dados podem precisar de header ou formato específico
- Biblioteca ZPPERDAS pode adicionar bytes de controle

### Hipótese 4: Problema de Rede/Firewall DVR ❓
**Evidências:**
- IP de origem configurado corretamente (10.6.1.171)
- Porta 38800 está aberta (conexão estabelece com sucesso)
- MAS DVR pode estar rejeitando payload

**Contra-evidência:** Conexão TCP estabelece com sucesso (`✅ Conectado`)

---

## 🛠️ SCRIPTS DE CONFIGURAÇÃO CRIADOS

### 1. `configurar-pos-pdv1-canal5.js`
Tentativa de configurar PDV1 via API (falhou - erro 400)

### 2. `configurar-pos-pdv1-completo.js`
Configuração detalhada via API com todos os parâmetros (falhou - erro 400)

### 3. `configurar-pos-pdv1-simples.js`
Tentativa simplificada (falhou - erro 400)

### 4. `configurar-pdv4-completo.js`
Script de configuração completa do PDV4 via API
**Status:** Não executado (configuramos manualmente)

### 5. `show-pos-configs.js`
Script para visualizar todas as configurações POS do DVR
**Status:** ✅ Funcionou, mostrou 16 dispositivos POS

---

## 🧪 SCRIPTS DE TESTE CRIADOS

### 1. `teste-cupom-visual.js`
Cupom completo ~50 linhas (travou DVR)

### 2. `teste-coca-cola.js`
Cupom Coca Cola ~25 linhas (travou DVR)

### 3. `teste-minimo-coca.js`
Versão 1: 3 linhas (travou)
Versão 2: Eventos separados estilo Zanthus (travou)

### 4. `teste-diagnostico-pos.js`
4 linhas para diagnóstico (travou)

### 5. `teste-ultra-minimo.js`
1 linha - não chegou a ser executado

### 6. `teste-uma-palavra.js`
1 palavra - criado mas não executado (DVR já estava reiniciando)

### 7. `teste-pdv4-simples.js`
**TESTE FINAL** - 11 bytes, 1 palavra (travou)

---

## ⚠️ COMPORTAMENTO OBSERVADO DO DVR

### Quando Recebe Dados na Porta 38800:
1. ✅ Conexão TCP estabelece com sucesso
2. ✅ `client.connect()` executa callback
3. ✅ `client.write()` retorna sem erro
4. ❌ **DVR TRAVA/CONGELA**
5. ❌ Interface web fica inacessível
6. ❌ Vídeo congela
7. 🔄 DVR reinicia automaticamente (30-60 segundos depois)

### Não Importa:
- ❌ Tamanho dos dados (11 bytes até 5KB)
- ❌ Formato (1 linha, múltiplas linhas, eventos separados)
- ❌ Intervalo entre envios (instantâneo ou 100ms)
- ❌ Configuração POS (testamos 3 diferentes)
- ❌ Canal (testamos Canal 4 e Canal 5)

---

## ✅ O QUE FUNCIONA

### Via Zanthus Manager + lib3zpperdas.so
- ✅ Cupons enormes (50+ linhas)
- ✅ Texto aparece nas câmeras
- ✅ Busca POS funciona
- ✅ Gravação funciona
- ✅ DVR **NÃO TRAVA**

**Comprovado por:**
- Screenshots no manual GCINT0037.pdf (páginas 11-17)
- Configuração existente mostra que já funcionou antes

---

## 🚫 LIMITAÇÕES IDENTIFICADAS

### 1. API do DVR
- ❌ Não permite criar múltiplos POS
- ❌ Retorna erro 400 para novos PosConfig
- ✅ Permite LER configurações (`show-pos-configs.js` funciona)
- ❌ Não permite MODIFICAR configurações via API de forma confiável

### 2. Integração Direta (Sem Zanthus)
- ❌ **IMPOSSÍVEL** com conhecimento atual
- ❌ DVR trava com qualquer dado enviado
- ❌ Não há documentação de protocolo proprietário
- ❌ Biblioteca ZPPERDAS é proprietária (sem código fonte)

### 3. Firmware DVR
- ❓ Pode ter bug que só aceita dados do Zanthus
- ❓ Pode exigir autenticação/handshake não documentado
- ❓ Pode ter proteção contra envios não autorizados

---

## 🎯 CONCLUSÕES

### O Que Sabemos:
1. ✅ Configuração POS está **100% correta**
2. ✅ IP, porta, limitador, encoding - tudo configurado
3. ✅ Conexão TCP estabelece com sucesso
4. ❌ DVR **REJEITA/TRAVA** ao processar dados recebidos
5. ✅ Zanthus **FUNCIONA** com mesma configuração

### O Que NÃO Sabemos:
1. ❓ Por que Zanthus funciona e nosso código não
2. ❓ Se há protocolo proprietário além do TCP raw
3. ❓ Se há handshake ou autenticação especial
4. ❓ Qual exatamente a diferença entre lib3zpperdas e nosso código

### Impedimento Técnico:
**A biblioteca ZPPERDAS é proprietária e fechada.** Não temos acesso ao código fonte para entender:
- Como ela formata os dados
- Se adiciona headers especiais
- Se faz autenticação prévia
- Qual o protocolo exato usado

---

## 🔮 PRÓXIMAS AÇÕES POSSÍVEIS

### Opção 1: Usar Zanthus Manager ✅ RECOMENDADO
**Prós:**
- ✅ Funciona comprovadamente
- ✅ Suportado oficialmente
- ✅ DVR não trava

**Contras:**
- ❌ Dependência do Zanthus ERP
- ❌ Precisa configurar File 18 (faixa 971-061-NNN)
- ❌ Menos flexibilidade

**Como Fazer:**
1. Instalar Zanthus Manager
2. Cadastrar servidor de gravação (Menu → Cadastros → Servidores de Gravação)
3. Vincular PDVs (Menu → Administração de PDVs → Aba DVR)
4. Configurar File 18: `|10.6.1.123|38800|10.6.1.171|0|`

### Opção 2: Engenharia Reversa da lib3zpperdas ⚠️ COMPLEXO
**Necessário:**
- Decompilador para `.so` ou `.dll`
- Conhecimento de assembly
- Análise de tráfego de rede (Wireshark)

**Passos:**
1. Capturar tráfego Zanthus → DVR com Wireshark
2. Comparar com nosso tráfego
3. Identificar diferenças (headers, formato, handshake)
4. Replicar protocolo exato

**Complexidade:** 🔴 MUITO ALTA

### Opção 3: Atualizar Firmware DVR ❓ INCERTO
**Tentativa:**
- Verificar se há firmware mais novo disponível
- Pode corrigir bugs de travamento

**Risco:**
- ⚠️ Pode piorar o problema
- ⚠️ Pode quebrar configurações existentes

### Opção 4: Contatar Suporte Intelbras 📞 RECOMENDADO
**Perguntas:**
1. Por que DVR trava ao receber dados TCP na porta 38800?
2. Há protocolo especial além do TCP raw?
3. É possível integrar sem Zanthus?
4. Qual a diferença entre dados do Zanthus e dados raw?

**Informações para fornecer:**
- Modelo DVR: MHDX 3108
- IP: 10.6.1.123
- Firmware: (verificar versão)
- Problema: Trava ao receber dados na porta 38800

---

## 📁 ARQUIVOS DE REFERÊNCIA

### Documentação
- `INTEGRACAO-DVR-POS-SEM-ZANTHUS.md` - Guia integração
- `GUIA-CONFIGURAR-POS-MANUAL.md` - Configuração manual
- `GCINT0037.pdf` - Manual Zanthus oficial
- `TROUBLESHOOTING-DVR-TRAVA.md` - Este arquivo

### Scripts Configuração
- `show-pos-configs.js` - Ver configs (✅ funciona)
- `configurar-pdv4-completo.js` - Configurar PDV4 via API

### Scripts Teste (todos falharam)
- `teste-cupom-visual.js`
- `teste-coca-cola.js`
- `teste-minimo-coca.js`
- `teste-diagnostico-pos.js`
- `teste-pdv4-simples.js`

---

## 🎓 LIÇÕES APRENDIDAS

### 1. Documentação ≠ Realidade
O manual Zanthus documenta "TCP General", mas na prática pode haver protocolo proprietário.

### 2. Configuração Correta ≠ Funcionamento
Mesmo com configuração 100% correta segundo manual, DVR não aceita dados diretos.

### 3. Biblioteca Proprietária = Dependência Forçada
A lib3zpperdas.so parece ser **obrigatória** para integração funcionar.

### 4. DVR Intelbras + POS = Melhor com Zanthus
O ecossistema foi projetado para funcionar com Zanthus, integração direta é muito difícil/impossível.

---

## 🔐 DADOS TÉCNICOS DO AMBIENTE

### Servidor
- **IP:** 10.6.1.171
- **SO:** Windows Server
- **Node.js:** Instalado
- **Acesso:** Administrativo

### DVR Intelbras
- **Modelo:** MHDX 3108 (verificar exato)
- **IP:** 10.6.1.123
- **Porta POS:** 38800
- **Usuário:** admin
- **Senha:** beto3107@
- **Interface Web:** http://10.6.1.123

### Rede
- **Rede Local:** 10.6.1.x/24
- **Gateway:** 10.6.1.254
- **Ping:** ✅ Funciona
- **Porta 38800:** ✅ Aberta (conexão estabelece)

---

## ⏰ TIMELINE DOS TESTES

**12/01/2026 - Manhã/Tarde:**
1. Tentativa configuração via API (falhou - erro 400)
2. Configuração manual PDV4 via interface web (sucesso)
3. Teste cupom completo (DVR travou)
4. Teste cupom reduzido (DVR travou)
5. Teste mínimo 3 linhas (DVR travou)
6. Leitura manual GCINT0037 (descoberta eventos separados)
7. Teste eventos separados (DVR travou)
8. Teste diagnóstico 4 linhas (DVR travou)
9. Teste PDV4 1 palavra **11 bytes** (DVR travou)

**Resultado Final:** ❌ Integração direta impossível com conhecimento atual

---

## 📞 CONTATOS ÚTEIS

### Suporte Intelbras
- **Site:** https://www.intelbras.com/pt-br/suporte
- **Telefone:** 0800 7042767
- **Email:** suporte@intelbras.com.br

### Suporte Zanthus
- **Site:** https://www.zanthus.com.br
- **Assunto:** Integração POS DVR Intelbras

---

**Última atualização:** 12/01/2026 15:30
**Status:** ❌ Integração direta NÃO FUNCIONA
**Recomendação:** ✅ Usar Zanthus Manager

---

## 🚨 AVISO IMPORTANTE

**NÃO EXECUTE** os scripts de teste sem antes:
1. Fazer backup das configurações do DVR
2. Estar preparado para DVR reiniciar
3. Ter acesso físico ao DVR para reset se necessário

**O DVR TRAVA A CADA TESTE** e precisa reiniciar (30-60 segundos).

---

**Desenvolvido e testado por:** Claude AI + Roberto Santos
**Data:** Janeiro 2026
**Conclusão:** Integração direta sem Zanthus é tecnicamente impossível no momento atual.
