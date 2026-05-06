# DVR e Câmeras

Integração com DVRs **Intelbras/Dahua** das lojas para visualização ao vivo e reprodução de vídeos históricos associados a eventos do PDV (Vision Palavra-Chave, Vision PDV, Vision Bipagens).

## 🏗️ Arquitetura Completa

```
[Loja do Cliente]                       [VPS 46 - Docker]
                                        
DVR local (192.168.x.x)                 Container: prevencao-<cliente>-backend
  HTTP: 80       <──────┐                ├── API HTTP (RPC2 Digest Auth — Dahua)
  RTSP: 554      <──────┤                ├── FFmpeg (RTSP → MP4 fragmentado H.264)
  TCP:  37777    <──────┤  Túnel SSH     └── Pipe → Browser (<video> MSE)
                        │                
Windows na loja ────────┘  Portas VPS:
(serviço SSHTunnels-     HTTP 3XXXX
 <nomeloja>DVR)          RTSP 3XXXY
```

## 📂 Arquivos Principais

- **Frontend**
  - `VisualizarCameras.jsx` — grid ao vivo
  - `VisionPDV.jsx`, `VisionPalavraChave2.jsx`, `Bipagens.jsx` — integram clipe DVR ao evento
  - `MonitorarEmailDVR.jsx` — monitora alertas do DVR via e-mail
- **Backend**
  - `services/dvr-cftv.service.ts` — orquestra conexão/stream
  - `controllers/dvr-cftv.controller.ts` — endpoints
  - `controllers/tunnel-installer.controller.ts` — gera .BAT de instalação do túnel
  - `controllers/dvr-monitor.controller.ts` — monitoramento por e-mail

## 🔌 Túneis SSH (pasta separada por cliente)

Cada túnel DVR usa **pasta isolada** `C:\ProgramData\SSHTunnels-<NomeLoja>DVR\` e **serviço Windows separado** `SSH-Tunnel-<NomeLoja>DVR`.

**Importante:** o túnel do banco (`C:\ProgramData\SSHTunnels\`) NÃO é tocado — isolamento total.

## 🎥 Stream RTSP → Browser

### URL do DVR (Dahua/Intelbras)
```
rtsp://{user}:{pass}@{ip}:{rtspPort}/cam/playback?channel={ch}&starttime={start}&endtime={end}
```

### FFmpeg (conversão em tempo real)
```
ffmpeg -rtsp_transport tcp -i {rtsp_url}
       -c:v libx264 -preset ultrafast -crf 28
       -movflags frag_keyframe+empty_moov+faststart
       -c:a aac -f mp4 pipe:1
```

### Detecção de codec
- **H.264 nativo** (DVRs antigos tipo Tradição) → `copy` (sem transcodificar, instantâneo)
- **H.265/HEVC** (DVRs novos tipo Nunes iMHDX 3132+) → transcodifica com `libx264` (**~5-10s de delay**)

Browsers NÃO suportam HEVC nativamente → transcodificação é obrigatória.

## 🔐 Autenticação Dahua (RPC2 Digest Auth)

1. Envia `login` com username → DVR retorna `realm` + `random`
2. Calcula hash:
   - `hash1 = MD5(user:realm:pass)` (uppercase)
   - `hash2 = MD5(user:random:hash1)` (uppercase)
3. Reenvia com `hash2` → DVR retorna sessão

**Cuidado:** modelos novos (iMHDX 3132+) podem ter variações. Se "Testar Conexão" falhar com `invalid credentials` mas login web funciona, é incompatibilidade de firmware.

## 🕐 Parse de Data/Hora (RP INFO / PG)

O PostgreSQL do RP INFO ([[../clientes/nunes|Nunes]]) retorna hora **sem `:`** (ex: `063825`). Backend converte para `06:38:25` antes de montar a URL RTSP. Se esquecer essa conversão → "Data NaN no RTSP" → vídeo não carrega.

## 📋 Configuração (fluxo resumido)

1. **Configurações de Tabelas → Túnel DVR** — gerar `.BAT` e instalar no Windows da loja
2. **Configurações de Rede → DVR / CFTV** — preencher:
   - Host: **`host.docker.internal`** (NÃO usar IP local do DVR)
   - Porta HTTP/RTSP: portas VPS do túnel
   - User/senha do DVR
3. **"Detectar do DVR"** — mapeia canais automaticamente
4. **Mapeamento Canais → PDV** — coluna "Pal. Chave 2" + PDV + tempo antes/depois (padrão 20s/120s)

## 🐳 Rede Docker

- Backend em container → usa `host.docker.internal` (NÃO localhost)
- Quando container → VPS host, usa gateway Docker `172.20.0.1`
- FFmpeg precisa estar **instalado no Dockerfile do backend** (ver commit `e83b598`)

## 🐛 Troubleshooting

| Problema | Causa provável | Solução |
|---|---|---|
| "Testar Conexão" falha | IP/porta errada | Usar `host.docker.internal` + porta do túnel |
| Túnel OFFLINE | Chave SSH não está na VPS | Regerar `.BAT` e reinstalar na loja |
| Vídeo preto | H.265 não convertido | Verificar deploy tem `libx264` |
| Vídeo não carrega | Data NaN no RTSP | Parse da hora PG sem `:` |
| "Nenhuma câmera" | PDV não mapeado | Configurar "Pal. Chave 2" + PDV |
| Play não dispara | Comparação PDV string/number | `String(c.pdv) === String(pdv)` |
| Túnel derrubou banco | Mesma pasta SSH | Pasta separada `SSHTunnels-<loja>DVR` |

## 🗺️ Clientes configurados

| Cliente | DVR IP Local | VPS HTTP | VPS RTSP | Codec | Status |
|---|---|---|---|---|---|
| [[../clientes/tradicao\|Tradição]] | 10.6.1.123 (Intelbras MIB 1116) | 18080 | **28101** | transcode H.265→H.264 | ✅ |
| [[../clientes/nunes\|Nunes]] | 192.168.102.169 | 38100 | 38101 | H.265→H.264 | ✅ |

> ⚠️ **REGRA DE OURO**: a porta `dvr_porta_rtsp` no banco TEM que bater com uma das portas que o `tunnels.json` da máquina cliente está fazendo `-R` na VPS. Conferir com `ss -ltn` na VPS antes de salvar config no front. **Doc completo de troubleshoot: `.claude/DVR-CFTV-TROUBLESHOOT.md`** (passos de diagnóstico, URLs RTSP por marca, checklist por cliente).

## 🔗 Bugs/features relacionados
- [[../bugs-resolvidos/2026-05-06-dvr-tradicao-rtsp-port-quebrou|2026-05-06 — Tradição: porta RTSP errada após mexer no Nunes]]
- [[../bugs-resolvidos/2026-04-dvr-h265-h264|DVR H.265 → H.264 para browser]]
- [[../bugs-resolvidos/2026-03-vision-pdv-dvr|Vision PDV + integração DVR CFTV]]

## 🏷️ Tags
#modulo #dvr #cameras #streaming #rtsp #ffmpeg
