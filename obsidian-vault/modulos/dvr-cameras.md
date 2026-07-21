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
| **Timeout com portas certas no roteador** | **CGNAT da operadora** | Sondar IP público de fora; se mudo em tudo → usar túnel (ver seção acima) |
| **Timeout, túnel vivo e porta escutando** | **INPUT DROP: container barrado** | Regra iptables `/32` + bridge do cliente |
| Config com IP público apontado | Desliga a lógica de túnel do `deviceToConfig` | Usar **IP privado** (10.6.1.123) + porta >10000 |
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
| [[../clientes/tradicao\|Tradição]] | **10.6.1.148** (Intelbras **MHDX 5116**) | **28100** | **28101** | transcode H.265→H.264 | ⚠️ IP trocado 21/07 — ver abaixo |
| [[../clientes/nunes\|Nunes]] | 192.168.102.169 | 38100 | 38101 | H.265→H.264 | ✅ |

## 🔄 Trocar o IP do DVR: mudar na TELA NÃO adianta

O campo "IP do DVR" das Configurações de Rede **não é usado pra conectar** quando há túnel.
`deviceToConfig` (dvr-cftv.service.ts ~L181):
```js
const dvrIp = isDocker && isPrivateIp && rawHttpPort > 10000 ? '172.20.0.1' : configuredIp;
```
IP privado + porta >10000 → conecta em `172.20.0.1` (boca do túnel) e **descarta o IP digitado**.
Ele serve só como bandeira "é privado, vá pelo túnel".

**Quem sabe o IP real do DVR é a máquina Windows da loja:**
```powershell
# ver config atual
Select-String -Path "C:\ProgramData\SSHTunnels-*DVR\tunnel-service.ps1" -Pattern "LOCAL_IP|LOCAL_PORT|REMOTE_PORT"
# trocar o IP
$f = (Get-ChildItem 'C:\ProgramData\SSHTunnels-*DVR\tunnel-service.ps1').FullName
(Get-Content $f -Raw) -replace '10\.6\.1\.123','10.6.1.148' | Set-Content $f -Encoding UTF8
Get-Service SSH-Tunnel-*DVR | Restart-Service
```

**Diagnóstico pela VPS** (distingue "túnel caiu" de "túnel vivo apontando errado"):
```bash
ss -ltn | grep -E '28100|28101'                     # escutando? => túnel SSH de pé
curl -s -o /dev/null -w '%{http_code}' --max-time 8 http://127.0.0.1:28100/   # 000 => destino errado
```
> ⚠️ Testar a porta RTSP com TCP puro **engana**: o `-R` aceita a conexão localmente
> antes de tentar repassar, então "aceitou" não prova que o outro lado responde.
> **Use o teste HTTP na 28100** como sinal de verdade.

## 🚫 Por que NÃO dá pra usar "porta direta no roteador" (IP público)

A tentação é pular o túnel e apontar o DVR pro IP público da loja + port-forward no
Mikrotik. **No Tradição isso é impossível: a Vivo usa CGNAT** — o "IP público" da loja
é o NAT compartilhado da operadora, não o roteador. Nenhum pacote de entrada chega.

**Sintoma clássico:** timeout no "Testar Conexão" *com todas as portas certas no roteador*.
**Teste decisivo:** sondar o IP público de fora (da VPS). Se **nada** responde — nem ping,
nem Winbox 8291, nem 80/443 — o IP não é a sua ponta. Se fosse só forward errado, algo
responderia.

**Confirmação:** Winbox → IP → Addresses → WAN. `100.64.x.x`–`100.127.x.x` = CGNAT.
Só sai disso com IP público dedicado (pago) na operadora.

> Doc completo: [[../bugs-resolvidos/2026-07-15-dvr-cgnat-vivo-porta-direta-impossivel|CGNAT da Vivo — porta direta impossível]]

## 🔥 iptables da VPS — container precisa de liberação explícita

`INPUT policy` é **DROP** (hardening do XMRig). Túnel vivo + porta escutando **não basta**:
o container não alcança `172.20.0.1:<porta>` sem regra. Ao configurar DVR de cliente novo:

```bash
# regra ESTREITA: só o container daquele cliente, só as portas dele
iptables -I INPUT 1 -i <bridge_do_cliente> -s <ip_container>/32 -p tcp --dport <porta> -j ACCEPT
netfilter-persistent save   # senão cai no reboot

# descobrir bridge e IP do container:
docker inspect prevencao-<cliente>-backend --format '{{range .NetworkSettings.Networks}}{{.IPAddress}} {{.Gateway}}{{end}}'
```

Cada cliente tem **/16 exclusivo** (tradicao 172.20, maxvale 172.18, supervital 172.23,
nunes 172.24, idealmix 172.22) — regra por `/32` + bridge não encosta em ninguém.

> ⚠️ **REGRA DE OURO**: a porta `dvr_porta_rtsp` no banco TEM que bater com uma das portas que o `tunnels.json` da máquina cliente está fazendo `-R` na VPS. Conferir com `ss -ltn` na VPS antes de salvar config no front. **Doc completo de troubleshoot: `.claude/DVR-CFTV-TROUBLESHOOT.md`** (passos de diagnóstico, URLs RTSP por marca, checklist por cliente).

## ⚡ Vídeo em ~9s: o `live-stream` existe e NÃO é usado

| Caminho | Tempo até aparecer | Arrastar linha do tempo |
|---|---|---|
| `generate-clip` (o que o Vision usa) | **134s** (espera arquivo inteiro) | ✅ |
| `live-stream` (**pronto, sem uso**) | **9,1s** (MP4 fragmentado) | ❌ |

Rota, controller e service **já existem e estão plugados**:
`routes/dvr-cftv.routes.ts:40` → `DVRCFTVController.liveStream` → `DVRCFTVService.startRTSPStream`
(usa `-movflags frag_keyframe+empty_moov+faststart` + `-flags low_delay`). O Vision nunca chamou.

> 💡 Os ~9s são o **DVR posicionando a gravação no HD** — 64KB chegam em 9,7s e 1MB em 9,1s.
> Depois disso o vídeo jorra. Não há o que otimizar aí.
>
> 💡 `startRTSPStream` aplica o **"Tempo ANTES" corretamente** (`start = evento - antes`),
> ao contrário do `generateClip`.

### 🔴 ANTES DE ATIVAR: falta teto de ffmpeg simultâneos
**Roberto relata incidente passado: mexida em câmeras → looping → VPS esquentou e travou.**
A causa se reproduz assim:

| Proteção | Estado |
|---|---|
| Matar ffmpeg no disconnect (`res.on('close')` → SIGKILL) | ✅ existe (`dvr-cftv.controller.ts:180`) |
| Limite de duração (`-t`) | ✅ existe (modo transcode) |
| **Teto de ffmpeg simultâneos** | 🔴 **NÃO EXISTE** |

> ⚠️ **Câmeras têm resoluções diferentes** (medido 16/07): PDV 1 ≈ 1 Mbit/s → **1.01x** (streaming
> ok); PDV 3 é **2880x1616 @ 12.7 Mbit/s** → **0.675x** → **o player alcança o ffmpeg e engasga**
> → usuário clica de novo → mais ffmpeg → 4 núcleos entopem. `scale` **não resolve**: o gargalo
> é *decodificar* H.265 5MP.
>
> **Desenho seguro:** clipe pré-gerado (instantâneo + seek) → senão live-stream (~9s) →
> **com fila/teto de 2 simultâneos**.

## 🩺 Healthcheck do frontend: `unhealthy` é FALSO POSITIVO (todos os clientes)

```
Test: wget --spider http://localhost:3004   →  "Connection refused"
```
O healthcheck aponta pra **3004**, mas o nginx do container serve na **80**. **Todos** os
frontends da VPS estão `unhealthy` há 8+ dias por isso. O site responde **HTTP 200 em 33ms**.
**Não investigar como incidente** — e não confiar nesse status pra validar deploy.

## 📼 Retenção real do DVR do Tradição (medido 16/07)

| Dia 11/07 | 08:00 | 12:00 | 15:00 | 18:00 | 20:00 |
|---|---|---|---|---|---|
| Canal 1 (FACIAL ENTRADA) | ✅ | ✅ | ✅ | ✅ | ✅ |
| Canais 2, 3, 4 (PDVs) | ❌ | ❌ | ❌ | ✅ | ✅ |

Do dia 12 em diante: tudo cheio. **A borda de retenção das câmeras de PDV é ~11/07 18:00**
(~4,5 dias). É sobrescrita circular normal, não falha do sistema — mas explica clipes que
saem curtos (5MB/35s quando se pede 130s): pegam pedaços perto do buraco.

> ⚠️ **Testar retenção com 1 canal em 1 horário dá conclusão errada** — a primeira medição
> disse "dia 11 não tem nada"; varrendo 4 canais × 5 horários apareceu que tem.

## 🔗 Bugs/features relacionados
- [[../bugs-resolvidos/2026-05-06-dvr-tradicao-rtsp-port-quebrou|2026-05-06 — Tradição: porta RTSP errada após mexer no Nunes]]
- [[../bugs-resolvidos/2026-04-dvr-h265-h264|DVR H.265 → H.264 para browser]]
- [[../bugs-resolvidos/2026-03-vision-pdv-dvr|Vision PDV + integração DVR CFTV]]

## 🏷️ Tags
#modulo #dvr #cameras #streaming #rtsp #ffmpeg
