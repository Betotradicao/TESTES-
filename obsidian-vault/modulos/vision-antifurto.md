# Vision Antifurto — POC de IA própria pra detecção de movimentos furtivos

> Status: **planejamento / pré-POC** · Próxima sessão: definir 2 câmeras de teste na Tradição.
> Criado: 2026-04-22 (retomar a partir daqui)

## 🎯 Objetivo

Detectar automaticamente **movimentos furtivos** (colocar produto no bolso, agachar em gôndola de alto valor, sair sem passar no PDV) usando **as câmeras/DVR que os clientes já têm**, processando tudo na **nossa VPS em CPU** — sem GPU, sem licença paga, sem Veesion.

**Nome interno provisório:** `Vision Antifurto` (parte da família Vision 360, junto com Vision-PDV e Vision-Palavra-Chave).

## 📋 Contexto da discussão (22/04/2026)

Cliente Tradição foi escolhido como piloto porque **o DVR dele já está conectado na VPS via túnel SSH** (ver [[dvr-cameras]]):
- DVR 10.6.1.123 → VPS porta 18080 (HTTP) e 18554 (RTSP)
- Codec H.264 (não precisa transcodificar)
- FFmpeg já instalado no container backend
- Módulos Vision existentes já puxam clipes por RTSP

**Por isso começar por Tradição é mais barato que qualquer outro cliente** — pula setup FTP/SDK/email.

## 🏛️ Por que NÃO usar Veesion/concorrente

- **Preço**: R$ 200–500 por câmera por mês, mensalidade pesa pro cliente
- **Dependência**: fornecedor externo, sem controle do pipeline
- **Diferenciação zero**: qualquer concorrente nosso também pode comprar Veesion
- **Possibilidade**: construir uma versão própria "lite" que flagra ~60-70% dos furtos óbvios — suficiente pra virar diferencial comercial

**Quando Veesion ganha:** competição direta em grande rede com orçamento. Até 5-10 lojas, nossa solução própria é melhor custo-benefício.

## 🏗️ Arquitetura proposta (event-driven, CPU-only)

```
[Worker antifurto — container novo na VPS]
     │
     │ conecta RTSP (pelo túnel já existente) de N câmeras
     │ amostra 1 frame cada 500ms (2 fps)
     ▼
[Motion detection por diff de pixels] (~5 ms/frame em CPU)
     │ sem movimento → descarta
     ▼
[Se movimento: YOLOv8n + MediaPipe Pose] (~200 ms/frame)
     │  • detecta: pessoa, bolsa, carrinho, mão, produto
     │  • esqueleto de 33 pontos por pessoa
     ▼
[Buffer de 10 s + heurísticas temporais]
     │  • mão foi ao bolso com objeto?
     │  • agachou e levantou sem cesta?
     │  • saindo com bolsa mais volumosa?
     │  • saiu sem passar no PDV (cruza com bipagens)?
     ▼
[Score ≥ 60%]
     ├─ salva clipe 30 s anotado
     ├─ cria alerta no **Check List** (reutiliza infra de alertas que já temos)
     └─ envia msg WhatsApp pro grupo com link
```

## 📦 Stack 100% open-source

| Componente | Função | Licença | Custo |
|---|---|---|---|
| **YOLOv8n** (nano) | Object detection (pessoa, bolsa, produto, mão) | AGPL | 0 |
| **MediaPipe Pose** | Esqueleto 33 pontos | Apache 2.0 | 0 |
| **ByteTrack** | Tracking entre frames | MIT | 0 |
| **OpenCV / ffmpeg** | Decodificação, motion detection | BSD / LGPL | 0 |
| **Python worker** (ou Node + ONNX) | Orquestração | - | 0 |

## 📊 Custo real na VPS atual (2 câmeras piloto)

- **CPU**: ~12% de 1 core sustentado (2 câmeras × 2 fps, só 30% dos frames passam por YOLO)
- **RAM**: ~500 MB (YOLO carregado 1x em worker persistente)
- **Storage**: ~1 GB/dia (só clipes suspeitos)
- **Rede**: tráfego RTSP local ao túnel SSH, desprezível

**Escalabilidade:** até ~15 câmeras totais em 4 clientes na VPS atual sem problemas. Acima disso, VPS separada dedicada (~R$ 40/mês) ou upgrade +2 cores.

## 🧠 Heurísticas planejadas (ordem de implementação)

### Fase 1 — POC (3 heurísticas básicas)
1. **Mão ao bolso com objeto**: punho (wrist do MediaPipe) desce pra zona do tronco/cintura + YOLO detecta "objeto na mão" antes + objeto some depois
2. **Agachamento prolongado em gôndola**: bounding box comprime em Y + permanência > 8 s em zona de gôndola de alto valor
3. **Saída sem passar no PDV**: face recognition na entrada/saída + sem registro de bipagem entre os dois momentos (cruza com nossa base)

### Fase 2 — heurísticas adicionais
4. Bolsa mais volumosa na saída (comparar área em pixels entrada × saída)
5. Produto some da mão sem ir pra cesta/carrinho
6. Aglomeração suspeita (N pessoas juntas em gôndola restrita)

### Fase 3 — ML leve
- Coletar ~500 clipes rotulados pelo feedback do segurança
- Treinar XGBoost em cima das features extraídas (pose + objetos + tempo)
- Re-treinar mensalmente

## ⚠️ Riscos identificados

1. **Dataset**: sem vídeos rotulados, classificador ML não funciona. Resolve com feedback do segurança nas primeiras semanas.
2. **Câmera ruim**: ângulo picado do teto, baixa resolução, contra-luz → nenhum modelo salva. **Pré-requisito: auditoria da câmera antes**.
3. **Falso positivo no começo**: ~40-60% no primeiro mês. Usuário precisa aceitar e dar feedback.
4. **LGPD**: gravação e processamento de imagem do cliente dele. Fica no escopo do próprio cliente (câmeras são dele), mas vale documentar consentimento interno.

## ✋ Decisões pendentes (retomar daqui)

Usuário precisa confirmar antes de começar:

1. **Quais 2 câmeras da Tradição** pro piloto:
   - **Combo A — "Furto de consumo"**: gôndola bebida/higiene + corredor de saída
   - **Combo B — "Conluio operador × cliente"**: 2 câmeras de PDV
   - **Combo C — "Mão ao bolso"**: doces/salgadinhos + carnes/frios
   - Recomendação: **Combo A**

2. **Ângulo das câmeras escolhidas**: precisa ser **lateral, altura ~2.5 m, enquadrando pessoa da cintura pra cima**. Se tá picada do teto, não serve.

3. **Revisor dos alertas**: quem dá feedback nas primeiras 4-6 semanas? Idealmente o próprio usuário ou um segurança da Tradição disposto a marcar "✅ furto" / "❌ falso positivo" em cada alerta.

## ⏱️ Cronograma POC (após confirmações acima)

| Semana | Entrega |
|---|---|
| 1 | Container `antifurto-worker` (Python + YOLOv8n + MediaPipe) conectando via RTSP nas 2 câmeras. Motion detection + YOLO funcionando. |
| 2 | Heurísticas 1 e 2 (mão-ao-bolso + agachado). Salva clipe anotado quando score alto. |
| 3 | Integração com Check List existente: alerta "antifurto" com clipe anexo. Dashboard de performance. |
| 4 | Calibração em produção. Feedback loop. |

**Acurácia esperada:**
- Início: ~40-50% (muito falso positivo)
- Após 2-3 meses de feedback: ~65-70%
- Não compete com Veesion (~85-90%) mas **já é útil** pra cliente pequeno/médio.

## 🔗 Relacionado

- [[dvr-cameras]] — infraestrutura DVR já em produção
- [[vision-palavra-chave]] — módulo existente que também puxa clipes DVR
- [[vision-facial]] — face recognition (usado pra heurística 3 e 4)
- [[bipagens]] — cruzamento com eventos de bipagem cancelada

## 🏷️ Tags
#modulo #ia #antifurto #visao-computacional #poc #planejamento #yolo #mediapipe
