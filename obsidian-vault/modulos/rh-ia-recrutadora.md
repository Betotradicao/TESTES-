---
tags: [rh, ia, recrutamento, modulo-ativo]
status: em-producao
prioridade: alta
data-inicio: 2026-04-26
ultima-revisao: 2026-04-27
modulo-frontend: /rh/recrutador
modulo-backend: /api/recrutador
---

# 🤖 Recrutador(a) Inteligente — Entrevistador Digital com IA

> **Status:** MVP em produção (Tradição). 5 abas funcionais. Modo texto + voz operacional.
> **Próxima fase:** avatar visual + análise de vídeo (D-ID/Tavus).

## 🎯 O que é

Plataforma própria de entrevistas conduzidas por IA. Substitui (ou complementa) entrevistas humanas em **escala**, mantendo qualidade comportamental + decisão final humana.

Persona: **Helen** — recrutadora PhD-level com 15 anos de experiência em varejo. System prompt construído em cima de:
- BEI/McClelland, STAR, Performance-based Hiring (Lou Adler)
- Topgrading (Bradford Smart), Tactical Empathy (Chris Voss)
- Active Listening (Carl Rogers), Hiring for Attitude (Mark Murphy)
- Grit (Angela Duckworth), OARS, NVC, 5 Whys, Funnel
- Anti-vieses cognitivos (halo, confirmation, similarity, recency, affinity)

## 📁 Onde está

```
Backend
├── packages/backend/src/services/rh-recrutador-agent.service.ts   # Agente OpenAI Function Calling
├── packages/backend/src/controllers/rh-recrutador.controller.ts   # CRUD + endpoints públicos + TTS
├── packages/backend/src/routes/rh-recrutador.routes.ts
└── packages/backend/src/migrations/178471*-*.ts                    # 7 migrations

Frontend
├── packages/frontend/src/pages/RhRecrutadorIA.jsx                 # Tela admin (5 abas)
├── packages/frontend/src/pages/RecrutamentoPublico.jsx            # Tela pública candidato
└── packages/frontend/src/App.jsx (rotas /rh/recrutador, /recrutamento/:token)

DB
├── rh_recrutador_vagas              # 14 vagas seed
├── rh_recrutador_perguntas_banco    # 100+ perguntas seed
├── rh_recrutador_config             # 1 linha global (Helen)
├── rh_recrutador_entrevistas
└── rh_recrutador_respostas
```

## 🏗️ Arquitetura atual (em produção)

```
[Candidato — modo texto/voz]
    ↓ /recrutamento/<token-único>
[Frontend público RecrutamentoPublico.jsx]
    ↓ POST /publico/:token/responder
[Backend rh-recrutador-agent.service]
    ↓ OpenAI Function Calling
    ├── consultar_perguntas_banco
    ├── salvar_resposta_e_analise
    ├── detectar_red_flag_critico
    └── finalizar_entrevista
    ↓ relatório JSON estruturado
[Frontend admin] ← visualização: radar chart + 4 quadrantes (fortes/atenção/ganhos/problemas)
```

**Modos de TTS implementados:**
1. **Web Speech** (navegador, grátis, qualidade ⭐⭐) — fallback
2. **Azure Neural pt-BR** (500k chars grátis/mês, ⭐⭐⭐⭐⭐, **sotaque BR real**)
3. **OpenAI TTS-1-HD** (~R$ 0,40/entrevista, ⭐⭐⭐⭐, sotaque americanizado)
4. **ElevenLabs** (free tier ou paga, ⭐⭐⭐⭐⭐, humana 100%)

## 📊 Análise competitiva (pesquisa profunda 2026-04-27)

### Líderes globais

| Plataforma | Comercial | Stack | Avatar | Diferencial |
|---|---|---|---|---|
| **HireVue** | US$ 35-100k/ano enterprise | NLP próprio + Azure OpenAI | ❌ | 15 anos de validação psicométrica |
| **MyInterview** | ~US$ 39-79/mês SMB | NLP genérico | ❌ | UX simples, embeddable |
| **Interviewer.AI** | ~US$ 250/mês | Visão computacional + LLM API | ❌ | Mais barato + Explainable AI |
| **Talview** | Enterprise | ML próprio + parcerias | ❌ | **Proctoring** é o produto principal |

### Avatar APIs (pra construir o nosso)

| Plataforma | Preço | Qualidade | Latência | Forte em |
|---|---|---|---|---|
| **Tavus** | $0,30-1,00/min | ⭐⭐⭐⭐⭐ | <1s | Conversacional ao vivo |
| **D-ID** | ~$0,30/min | ⭐⭐⭐⭐ | ~2s | Foto estática → avatar |
| **HeyGen** | $24/mês + créditos | ⭐⭐⭐⭐⭐ | Render assíncrono | Marketing/training |

### Brasil

- **Gupy/Kenoby**: matching de CV, "Gaia" IA, **chat texto** (não vídeo conversacional)
- **Solides**: assessment DISC pré-IA generativa
- **Taqe, Revelo, Compleo**: marketplace e ATS
- ✅ **Ninguém faz entrevista conversacional com avatar em pt-BR — GAP REAL**

### Open-source (pra cortar custo de API)

| Componente | Lib OSS | Custo |
|---|---|---|
| Avatar/lipsync | SadTalker, Wav2Lip, **MuseTalk** (real-time 30fps) | Grátis após GPU |
| TTS pt-BR | **Coqui XTTS-v2**, Piper, F5-TTS | Grátis |
| STT | **faster-whisper** (CTranslate2, 4x speedup) | Grátis |
| LLM | Llama 3.1 70B, Qwen 2.5 72B (vLLM/Ollama) | Grátis em 2x A100 |

**Stack 100% local:** Llama + faster-whisper + Coqui + MuseTalk = **zero custo marginal** após CAPEX de GPU (~R$ 30k = paga em 3.000 entrevistas).

## ⚠️ Insights críticos da pesquisa

1. **HireVue removeu análise facial em 2021** — auditoria provou viés. Quem promete "microexpressões" hoje vende vodu.
2. **MIT Tech Review (Schellmann 2021)** mostrou que MyInterview dava score similar lendo Wikipedia vs candidata real → **personality scoring por vídeo é espúrio**. **Não cair nessa armadilha — validar nosso scoring com KPIs reais.**
3. **Final Round AI** (US$ 96/mês) é o vetor de ataque — overlay sugere respostas em tempo real ao candidato. **Anti-fraude por detecção de leitura é diferencial vendável.**
4. **PL 2338/2023** vai classificar IA em RH como **alto risco** com obrigações reforçadas. Acompanhar.
5. **ANPD** já fiscaliza decisões automatizadas. Sanção até 2% do faturamento, máx R$ 50M.

## 💰 Custo realista por entrevista (15 min)

### Modelo MVP atual (texto + voz Azure)

| Item | Custo |
|---|---|
| GPT-4o-mini (cérebro) | ~R$ 0,30 |
| Azure TTS pt-BR (5min fala IA) | ~R$ 0,30 |
| Whisper STT (15min áudio) | ~R$ 0,45 (se ativarmos) |
| Storage | desprezível |
| **Total marginal** | **~R$ 1,00-1,50** |

### Modelo futuro (com avatar visual)

| Item | Custo |
|---|---|
| D-ID streaming (5min vídeo) | **~R$ 7,50** (88% do custo) |
| Demais (TTS+STT+GPT+storage) | ~R$ 1,00 |
| **Total marginal** | **~R$ 8,50** |
| Com overhead 30% | **~R$ 12-15** |
| Venda sugerida | **R$ 25-40 / entrevista** |

**Comparativo:** HireVue cobra equivalente a **R$ 500-1.500/entrevista** em contratos enterprise. Nossa stack fica **90-95% mais barata**.

## 🏆 Diferenciais defensáveis pro varejo BR

### 1. Banco de competências calibrado pra varejo
HireVue é generalista. Temos perguntas STAR específicas pra:
- PDV / atendimento sob pressão
- Cortes de carne, fermentação, frescor de peixe, sazonalidade FLV
- Prevenção de perdas, ética em situações de tentação
- Liderança de setor de supermercado

### 2. Loop fechado com Oracle Intersolid (KPIs reais)
**Únicos com isso.** Já temos integração Oracle nos clientes. Podemos correlacionar:
- Score IA na entrevista × turnover em 90 dias
- Score IA × NPS de loja
- Score IA × taxa de quebra do setor
→ **Re-treinar modelo** com ground truth do desempenho real.

### 3. Helen com sotaque BR autêntico + UX brasileira
Azure Francisca + roteiro com "tudo bem?", "me conta uma situação que…" gera muito mais conforto em candidato de operação que avatar corporativo americano traduzido.

## ⚖️ Compliance (LGPD + CLT + cotas)

### LGPD (Lei 13.709/2018)
- **Vídeo + áudio + análise** = dado pessoal **sensível** (Art. 5 II — biometria)
- Base legal: **consentimento específico e destacado** (Art. 7 I + Art. 11 I) — não pode ser genérico
- **Art. 20**: revisão humana obrigatória antes de comunicar reprovação ao candidato
- Retenção curta (90-180 dias pós-processo) com exclusão automática
- DPO designado, **RIPD** (Relatório de Impacto) recomendado
- Canal de exercício de direitos do titular (consultar, corrigir, excluir)

### CLT + Lei 9.029/1995 (Anti-discriminação)
- Documentar **paridade de score por grupo demográfico** (testes de viés periódicos)
- Risco: ação civil pública pelo MPT se houver discriminação indireta detectada
- **NUNCA**: estado civil, filhos, planos de gravidez, religião, orientação sexual, partido

### Lei de Cotas (PCDs — Lei 8.213/91 Art. 93 + Lei 10.097/2000 aprendizes)
- Modo só áudio (deficiência visual) com TTS de qualidade
- Transcrição + legenda (auditiva)
- Sem brain teasers ou cronômetro implícito (motora/cognitiva)

### PL 2338/2023 (Marco Legal da IA)
- Em tramitação 2026
- Sistemas de RH classificados como **alto risco**
- Obrigações: avaliação de impacto, transparência sobre lógica decisória, auditoria
- Provável aprovação 2026 com vigência escalonada → **arquitetar transparência DESDE JÁ**

### Imagem da "recrutadora virtual"
- Foto stock pra IA generativa: licença explícita (muitas excluem desde 2023)
- Atriz contratada: contrato com cláusula de uso em treinamento/geração de IA
- Sem isso = violação de direito de imagem (CC Art. 20), indenização certa

## 🎯 Roadmap em fases

| # | Fase | Status | Tempo |
|---|---|---|---|
| 1 | **MVP texto** (chat com Helen) | ✅ produção | feita |
| 2 | **Voz Web Speech** (gratuita) | ✅ produção | feita |
| 3 | **Voz Azure pt-BR** (humana) | ✅ produção | feita |
| 4 | **Voz OpenAI/ElevenLabs** | ✅ produção | feita |
| 5 | **TTS por entrevista** (não só global) | ✅ produção | feita |
| 6 | **Relatório com radar chart + 4 quadrantes** | ✅ produção | feita |
| 7 | **Regras LGPD/CLT robustas no system prompt** | ✅ produção | feita 2026-04-27 |
| 8 | **Gravação webcam candidato (MediaRecorder + MinIO chunked)** | 🚧 próximo | 1 sem |
| 9 | **Análise pós-vídeo** (eye contact MediaPipe + sentimento + presença) | 🚧 | 1 sem |
| 10 | **Avatar Helen falando** (D-ID, fase paga) | 🚧 | 2 sem |
| 11 | **Anti-fraude** (detecção overlay/leitura/cadência IA) | 🚧 | 2 sem |
| 12 | **Loop com KPIs Oracle** (score × turnover real) | 🚧 | 2 sem |

## ⚡ Próximos passos imediatos

1. ✅ **Salvar regras LGPD na Helen** (feito 2026-04-27 — 2.420 chars no system prompt)
2. 📋 **Validar com advogado LGPD** o termo de consentimento + fluxo de revisão humana
3. 🧪 **Piloto Tradição** com 5-10 candidatos reais (modo voz Azure)
4. 📊 **Medir correlação score IA × desempenho real após 90 dias**
5. 🎬 Avaliar D-ID/MuseTalk pra Fase 8

## 🔗 Conexões com outros módulos

- [[rh]] — módulo principal RH onde a feature mora
- [[../arquitetura/deploy]] — MinIO já no stack (gravações futuras)
- DISC já existe → input pra análise comparativa
- Vagas já cadastradas → contexto pra perguntas customizadas
- [[lgpd-compliance]] — termos de consentimento + RIPD + retenção

## 📌 Decisões já tomadas

| Decisão | Por quê | Data |
|---|---|---|
| Persona "Helen" feminina | Mais empática em pesquisa de UX, reduz ansiedade do candidato | 2026-04-26 |
| OpenAI Function Calling vs MCP | Já temos chave, pattern testado em ai-consultant | 2026-04-26 |
| 5 abas internas (1 menu lateral) | Reduz poluição do sidebar (era 5 itens, virou 1) | 2026-04-26 |
| Modo voz default = Web Speech | Zero custo, mesmo qualidade média, valida UX antes de subir pra Azure | 2026-04-26 |
| Azure pt-BR como recomendado | 500k chars/mês grátis + sotaque BR real (vs OpenAI americanizada) | 2026-04-27 |
| LGPD/CLT no system prompt | Garante compliance em CADA entrevista, não só na superfície | 2026-04-27 |

## 🎓 Origem e visão

Conversa com Roberto em 2026-04-26: *"vc acha que seria possível no nosso sistema de RH criar um link onde eu enviaria para o candidato... esse candidato ao abrir o link se depararia com um agente de IA que funcionaria como uma recrutadora..."*. **100% possível, território aberto no Brasil**, prioridade alta pra inovação.

Em 2026-04-27 evoluiu pra estratégia de competir com HireVue no varejo BR — **diferenciais defensáveis identificados**: vertical, integração Oracle, sotaque autêntico. Custo marginal R$ 1-1,50/entrevista hoje (texto+voz), R$ 12-15 com avatar visual no futuro. Margem comercial saudável a R$ 25-40/entrevista.
