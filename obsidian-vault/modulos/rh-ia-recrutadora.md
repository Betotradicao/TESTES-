---
tags: [rh, ia, recrutamento, futuro, ideia]
status: ideia-validada
prioridade: alta
data-ideia: 2026-04-26
---

# 🤖 IA Recrutadora — Entrevistas por Vídeo Automatizadas

> **Status:** ideia validada como viável, em fila pra implementação
> **Trigger:** Roberto perguntou se dava pra criar agente de IA que entrevista candidatos via vídeo, com gravação, transcrição, análise e scoring automático

## 🎯 Visão

Link único enviado ao candidato → ele abre → cai numa página com **agente de IA recrutadora** (voz + visual) que:
1. Faz perguntas comportamentais baseadas na vaga e nas preferências configuradas
2. Espera resposta, aprofunda, faz follow-up dinâmico
3. Grava a entrevista (vídeo + áudio + transcript)
4. Ao final, gera **relatório estruturado** com score por competência, red flags, fit cultural, alinhamento DISC

## 🏗️ Arquitetura proposta

```
Link único: /recrutamento/<token-unico-por-candidato>
   ↓
Página com webcam + microfone + agente IA falando (avatar opcional)
   ↓
[STT: Whisper] tempo real → [Cérebro: Claude] perguntas/follow-up → [TTS: ElevenLabs/OpenAI] voz
   ↓
Grava vídeo (MediaRecorder API + upload chunked pro MinIO já existente)
   ↓
Ao final: Claude analisa transcript completo + JSON estruturado → salva no banco
```

## 🛠️ Stack viável (off-the-shelf, 2026)

| Componente | Opção | Observação |
|---|---|---|
| **Voz tempo real** | OpenAI Realtime API (`gpt-4o-realtime`) | WebRTC, ~500ms latência, voz natural |
| **Alternativa** | Anthropic Voice (Claude) quando soltar oficial | Esperar |
| **Avatar visual** | Tavus, HeyGen, D-ID | Geram avatar falando em tempo real |
| **Gravação** | `MediaRecorder` browser → MinIO chunked | MinIO já existe no stack |
| **Análise pós-entrevista** | Claude com transcript completo | JSON estruturado |
| **Anti-fraude** | Eye tracking via webcam (mediapipe) | Detectar candidato olhando ChatGPT em outra aba |

## ⚠️ Fatores técnicos mais difíceis (em ordem de criticidade)

### 1. Latência da conversa (< 800ms)
- Acima disso vira "interrogatório", não conversa
- OpenAI Realtime resolve. Self-hosted (Whisper local + LLM + Coqui TTS) tipicamente fica em 1-2s

### 2. Anti-fraude
- **Risco:** candidato lê resposta do ChatGPT em outra aba
- **Mitigações:**
  - Eye tracking (mediapipe) — detecta se está olhando pra outra tela
  - Perguntas situacionais ("conta uma vez que você teve que lidar com X") → respostas específicas, ChatGPT genérico não passa
  - Tempo limite curto pra resposta (5-10s)
  - Perguntas randomizadas e contextuais
  - Gravação de tela (com consentimento) — opcional

### 3. Calibração das perguntas (system prompt)
- A IA precisa de **persona muito bem definida**: tom, profundidade, escala de scoring (1-5 por critério), critérios não-negociáveis, regras de follow-up condicionais
- É arte + ciência. **Iterar com casos reais.**

### 4. Compliance LGPD
- Gravação de imagem/voz exige consentimento explícito (tela de aceite com base legal)
- Armazenamento criptografado
- Retenção definida (ex: 6 meses pós-processo)
- Direito ao esquecimento (botão "apagar minha entrevista")
- Ver: [[lgpd-compliance]]

### 5. Custo por entrevista
- OpenAI Realtime: ~$0.06/min input + $0.24/min output áudio
- Entrevista de 20min ≈ **US$ 3-6**
- 100 candidatos/mês ≈ **US$ 300-600** só de API
- **Calcular ROI vs custo de RH humano fazendo triagem**

### 6. Falsos negativos
- IA pode descartar bom candidato por: sotaque, gagueira, problema técnico de áudio, nervosismo
- **Sempre ter revisão humana antes de descartar definitivamente**

## 📚 Recursos prontos pra "alimentar" a IA

- **Behavioral Interview Banks** (método STAR) — perguntas comportamentais já validadas em mercado
- **DISC + Big 5** — já temos DISC no sistema; IA pode inferir DISC pelas respostas
- **Project Oxygen (Google)** — competências de liderança validadas
- **Ground truth interno:** já temos **histórico DISC dos colaboradores atuais** → dá pra usar como benchmark: *"candidatos parecidos com nossos top performers"*

## 🚀 Fases de implementação

| Fase | Entrega | Esforço |
|---|---|---|
| **1. MVP texto** | Link `/recrutamento/<token>` → chat com Claude fazendo perguntas (sem voz) → relatório JSON | 1 semana |
| **2. + Voz** | Mesmo fluxo via OpenAI Realtime, áudio tempo real | 1-2 semanas |
| **3. + Gravação vídeo** | MediaRecorder → MinIO + transcript salvo | 3-5 dias |
| **4. + Avatar visual** | Tavus/HeyGen integrado | 1 semana |
| **5. + Análise estruturada** | JSON com scores, red flags, fit cultural, alinhamento DISC, comparativo vs top performers | 1 semana |
| **6. + Anti-fraude** | Eye tracking + perguntas situacionais randomizadas + detecção de leitura | 2 semanas |

**Total estimado MVP completo:** ~6-8 semanas

## 💎 Diferencial de mercado

- Gupy/Kenoby fazem **screening por chat de texto** — não entrevista em vídeo
- **Entrevista em vídeo com IA recrutadora real é território aberto no Brasil**
- Pra varejo (alta rotatividade, muito candidato pra repor caixa/repositor): **escalar entrevistas a 1/4 do custo é game changer**
- Posicionamento: "**Recrutadora 24/7 que nunca fica cansada nem enviesada**"

## 🔗 Conexões com sistema atual

- [[rh]] — módulo principal RH onde a feature vivirá
- [[../arquitetura/deploy]] — MinIO já no stack (gravações)
- DISC já existe → input pra análise comparativa
- Vagas já cadastradas → contexto pra perguntas customizadas

## 📌 Próximo passo concreto

Quando voltar a esse tema:
1. Validar com Roberto: começa pelo MVP texto pra testar UX antes de investir em voz?
2. Definir 1 vaga piloto (ex: caixa) + escrever system prompt da recrutadora
3. Implementar fase 1 (texto) em sprint de 1 semana
4. Testar com 5-10 candidatos reais e iterar

## 💬 Origem da ideia

Conversa com Roberto em 2026-04-26 (sessão de túneis SSH + multi-cliente). Ele perguntou *"vc acha que seria possível no nosso sistema de RH criar um link onde eu enviaria para o candidato... esse candidato ao abrir o link se depararia com um agente de IA que funcionaria como uma recrutadora..."*. Resposta: **100% possível, território aberto, prioridade alta pra inovação.**
