# Pre-clipes DVR no Vision Palavra-Chave (2026-05-19)

Reaproveitamos a ideia dos clipes pre-gerados das [[../modulos/bipagens|Bipagens]] (>3h pendentes) para a tela [[../modulos/vision-palavra-chave|Vision Palavra-Chave]]. Objetivo: clicar **Play** em **Canc. Item / Canc. Cupom / Canc. Venda / Desconto** e o video tocar **instantaneo** em vez de esperar 30-60s o ffmpeg processar.

## 🎯 Por que era inviavel hoje

`handlePlayVideo` chamava `/dvr-cftv/pos/generate-clip` que invoca `DVRCFTVService.generateClip()` → conecta RTSP, ffmpeg transcoda e devolve MP4. Cada clique custa 30-90s. Em auditoria com dezenas de eventos por dia ficou inutilizavel.

## 🏗️ Arquitetura

Diferente de Bipagens (tabela local `bips`), os 4 eventos do PDV vem do **ERP** (Oracle Intersolid ou Postgres RP INFO no Nunes). Nao temos tabela local desses eventos. Solucao: **tabela espelho so dos clipes** com `event_key` idempotente.

### Tabela `dvr_pos_event_clips`

| Coluna | Tipo | Uso |
|---|---|---|
| `event_key` | VARCHAR(160) UNIQUE | `{cod_loja}\|{pdv}\|{cupom}\|{tipoKey}\|{event_time}` |
| `cod_loja`, `pdv`, `cupom_num`, `event_time`, `tipo` | * | metadados pra filtro |
| `channel` | INT | canal DVR usado |
| `filename` | VARCHAR(255) | MP4 em `uploads/dvr-clips/` (mesmo dir dos clipes de bipagem) |
| `clip_status` | varchar | `ready` / `pending_retry` / `failed` |
| `clip_retry_count` | INT | abandona apos 3 tentativas |
| `clip_generated_at` | timestamp | base pra limpeza 2 dias |

Migration: `1784810000000-CreateDvrPosEventClips.ts`
Entity: `packages/backend/src/entities/DvrPosEventClip.ts`

### Cron de pre-geracao — `0 */2 * * *` (a cada 2h)

Em `packages/backend/src/index.ts`. Pra cada `Company` ativa:
1. Le `dvr_devices.cameras_pdv` da loja → mapa `pdv → camera`
2. Chama `DVRCFTVService.searchOracleAllPdvs(start-2d, end, 'cancelado', ..., codLoja)` — retorna os 3 tipos de canc juntos
3. Chama o mesmo com `'desconto'` — retorna DESCONTO
4. Pra cada evento elegivel (PDV com camera, nao pulado, nao falhado):
   - Monta `event_key`
   - Skip se ja existe `ready` ou `failed` ou retry >= 3
   - Chama `generateClip(channel, time, antes+depois)`
   - Salva registro com status final

Limites: 30 eventos por ciclo (evita travar o ffmpeg).

### Cron de limpeza — `5 3 * * *` (3:05 da manha, 1x/dia)

Apaga MP4 do disco + **deleta** registros com `clip_generated_at < hoje - 2 dias`. Os `failed`/`pending_retry` ficam pra retry no cron das 2h.

### Enriquecimento do search

`DVRCFTVController.searchOracle` chama `enrichWithPreClips(items, codLoja)` antes de responder. Faz **um SELECT IN** com todos os `event_keys` dos items elegiveis (TIPOS_PRE = `CANC. ITEM | CANC. CUPOM | CANC. VENDA | DESCONTO`) e adiciona ao item:
```js
{ ...item, clip_status: 'ready', clip_filename: 'clip_xyz.mp4' }
```

### Frontend

`handlePlayVideo` em [`VisionPalavraChave2.jsx`](../../packages/frontend/src/pages/VisionPalavraChave2.jsx) ganhou um atalho:
- Se `item.clip_status === 'ready' && item.clip_filename` → seta direto `videoUrl = .../stream/{filename}` (sem chamar generate-clip)
- Caso contrario → comportamento anterior (live ffmpeg)

Botao Play vira **verde** quando pronto (com check ✓ antes do icone de play).

## 💾 Custo estimado de disco

~25 eventos × 4 tipos × 1 camera × 15MB ≈ **~1.5GB/dia/loja**. × 2 dias retencao = ~3GB pico/loja. Manageable.

## ⚠️ Particularidades

- **Idempotente:** `event_key` UNIQUE — rerodar o cron nao gera duplicado.
- **Bifurcacao OK:** funciona pra Oracle e Postgres porque o cron chama `searchOracleAllPdvs`, que ja bifurca internamente (regra de ouro do [[../clientes/nunes|Nunes]]).
- **Multi-loja:** o cron itera `companies.active = true` e busca camera por `cod_loja`. Se loja nao tem camera PDV, pula.
- **Tipos cobertos:** so os 4 explicitos. Outras palavras-chave (dinheiro, pix, etc) continuam usando live ffmpeg.

## 🗂️ Arquivos tocados

- `packages/backend/src/migrations/1784810000000-CreateDvrPosEventClips.ts` (novo)
- `packages/backend/src/entities/DvrPosEventClip.ts` (novo)
- `packages/backend/src/index.ts` (2 crons novos)
- `packages/backend/src/controllers/dvr-cftv.controller.ts` (`enrichWithPreClips`)
- `packages/frontend/src/pages/VisionPalavraChave2.jsx` (`handlePlayVideo` + botao verde)

## 🏷️ Tags
#feature #vision #dvr #performance
