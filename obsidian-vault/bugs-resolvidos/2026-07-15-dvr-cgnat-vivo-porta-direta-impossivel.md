# 2026-07-15 — DVR Tradição: CGNAT da Vivo torna "porta direta no roteador" impossível

## Sintoma
"Testar Conexão" do DVR dando **timeout**, mesmo com **todas as portas corretamente
encaminhadas no Mikrotik**. Config na tela: `187.90.96.96` (IP público da loja) + 8123/5554.

## Causa-raiz — DUAS camadas empilhadas

### 1. O IP público não é da loja — é CGNAT da Vivo
`187.90.96.96` → rDNS `ip-187-90-96-96.user.vivozap.com.br`, bloco `187.88.0.0/14`
da **TELEFÔNICA BRASIL (Vivo)**, faixa de *user pool* compartilhada.

A loja **enxerga** esse IP como seu (ipify/ifconfig retornam ele), mas ele é o NAT
coletivo da Vivo. Encaminhamento de porta no roteador **nunca** vai funcionar: o pacote
de entrada morre na Vivo e jamais chega no Mikrotik.

### 2. Container não alcançava o túnel (INPUT DROP)
Mesmo com o túnel SSH vivo e funcionando, o backend não chegava em `172.20.0.1:28100`.
O hardening do XMRig deixou `INPUT policy DROP` e só liberou `1521` (Oracle) e `8080`.

## 🔑 Como diagnosticar CGNAT (o teste que mata a dúvida)

Sondar o IP público **de fora** (da VPS). O sinal decisivo é **silêncio total**:

```bash
ping -c4 <ip_publico>                      # sem resposta
for P in 80 443 554 8291 8123; do          # NENHUMA porta abre
  timeout 5 bash -c "cat < /dev/null > /dev/tcp/<ip_publico>/$P" && echo "$P ABERTA"
done
getent hosts <ip_publico>                  # rDNS entrega o dono
whois <ip_publico> | grep -iE 'owner|inetnum'
```

> ⚠️ **A distinção que importa:** se fosse só o *forward errado*, o roteador ainda
> responderia em **alguma** porta (Winbox 8291, admin 80/443) ou no ping. **Silêncio
> absoluto em tudo = o IP não é a sua ponta.** Não adianta mexer no roteador.

**Confirmação definitiva:** Winbox → IP → Addresses → interface WAN.
`100.64.x.x`–`100.127.x.x` = CGNAT (RFC 6598). Só resolve com **IP público dedicado
pago** junto à operadora — ou usando túnel.

## ✅ Solução aplicada — voltar pro túnel (que já funcionava)

O túnel estava **vivo o tempo todo** (`ssh -R 28100/28101`, DVR respondendo HTTP 200
em 25ms do host da VPS). Só faltavam duas coisas:

**1. iptables — regra ESTREITA por IP de container (não por /16):**
```bash
iptables -I INPUT 1 -i br-019ae38a96f7 -s 172.20.0.2/32 -p tcp --dport 28100 -j ACCEPT
iptables -I INPUT 1 -i br-019ae38a96f7 -s 172.20.0.2/32 -p tcp --dport 28101 -j ACCEPT
netfilter-persistent save   # senão cai no reboot
```

**2. Banco — apontar pro caminho do túnel (SEM tocar em código):**
```sql
UPDATE dvr_devices SET ip='10.6.1.123', porta_http=28100, porta_rtsp=28101 WHERE id=1;
```

**Verificado:** ffprobe → `hevc 2880x1616`; ffmpeg gravou 3s → MP4 de 4.5MB pelo túnel.

## 💡 Lições

1. **"Todas as portas abertas no roteador" não significa nada sob CGNAT.** Antes de
   debugar forward, confirme que o IP público é *realmente seu* (sondagem de fora).
2. **`10.6.1.123` (IP privado) É a config correta** quando se usa túnel — o
   `deviceToConfig` reescreve IP privado + porta >10000 → `172.20.0.1` sozinho.
   Colocar o IP público **desliga** essa lógica e manda o container pra internet.
3. **Cada cliente tem seu /16 exclusivo** (tradicao 172.20, maxvale 172.18,
   supervital 172.23, nunes 172.24). Regra por `-s <ip_container>/32 -i <bridge>` é
   mais estreita que a do Oracle (que usa `172.20.0.0/16` inteiro) e **não** encosta
   em outro cliente.
4. **Task "Pronto" no schtasks ≠ túnel morto.** A task dispara o `.vbs` e sai; o que
   importa é o `ssh.exe` vivo (`Get-CimInstance Win32_Process -Filter "Name='ssh.exe'"`).

## 🐛 Dois bugs de código descobertos no caminho (NÃO corrigidos ainda)

### 1. Botão "Testar" do accordion sempre dá timeout
`DvrDevicesController.tryHttpAuth` usa o **IP cru** do banco e **não aplica** a reescrita
que o `DVRCFTVService.deviceToConfig` faz:

```ts
const host = d.ip;                  // 10.6.1.123 (privado) — inalcançável da VPS
const port = d.porta_http || 80;    // 28100
```

**Provado:** container → `10.6.1.123:28100` = TIMEOUT | → `172.20.0.1:28100` = OK.
O botão "Testar Conexão" **legado** funciona porque passa pelo `DVRCFTVService`.
**Sintoma que engana:** vídeo funcionando + botão dizendo timeout.
**Correção:** aplicar o mesmo rewrite (IP privado + porta >10000 → `172.20.0.1`) no
`tryHttpAuth`. Afeta todos os clientes com túnel, não só o Tradição.

### 2. Clipe demora ~4min (parece travado) — câmera 5MP
`[DVR] Generating clip: duration=126s` + `speed=0.54x` → **~233s de espera**.
Fonte: `2880x1616 H.265 @ 12.7 Mbit/s`. A tela promete "alguns segundos" e o browser desiste.
**Correção proposta:** `-vf scale=1280:-2` no ffmpeg do clipe (resolução ainda identifica
operador). Alternativa: substream do DVR.

## ⚠️ Excluir o DVR na tela derruba TUDO (comportamento perigoso)

`dvr_devices` vazia → `getConfig()` cai no `getConfigLegacy()` (chaves `dvr_*` de
`configurations`). Se o legado apontar pro IP público → timeout geral, inclusive no
botão que antes funcionava.

**Recuperação (não precisa de backup):** os mapeamentos vivem **também** no legado
(`dvr_canais`, `dvr_cameras_pdv`, `dvr_cameras_risco`, `dvr_cameras_bipagens`).
Dá pra recriar o registro inteiro a partir deles:

```sql
INSERT INTO dvr_devices (name,codigo_loja,ip,porta_http,porta_rtsp,usuario,senha,codec_mode,
  canais,cameras_pdv,cameras_bipagens,cameras_risco,antecedencia_segundos,
  tempo_depois_segundos,canal_padrao,is_default,status)
SELECT 'DVR LOJA 1 FACIAL',1,'10.6.1.123',28100,28101,
  (SELECT value FROM configurations WHERE key='dvr_usuario'),
  (SELECT value FROM configurations WHERE key='dvr_senha'),'transcode',
  COALESCE((SELECT value::jsonb FROM configurations WHERE key='dvr_canais'),'[]'::jsonb),
  COALESCE((SELECT value::jsonb FROM configurations WHERE key='dvr_cameras_pdv'),'[]'::jsonb),
  COALESCE((SELECT value::jsonb FROM configurations WHERE key='dvr_cameras_bipagens'),'[]'::jsonb),
  COALESCE((SELECT value::jsonb FROM configurations WHERE key='dvr_cameras_risco'),'[]'::jsonb),
  10,120,0,true,'active';
```

> 💡 **Manter o legado sincronizado com o `dvr_devices`** é rede de proteção barata.
> A dica na tela (*"IP fixo público ou DDNS Mikrotik. Sem túnel SSH"*) **induz ao erro** —
> foi ela que levou o DVR pro IP público. Vale corrigir o texto.

> 🔧 **`docker exec` + heredoc precisa de `-i`**, senão o psql recebe stdin vazio e a
> transação some sem erro (`INSERT 0` silencioso).

## 🎬 Pré-geração de clipes (Vision) — o que descobrimos

### `FINALIZADORA` nunca fica verde — por design
O cron ([[../../packages/backend/src/index.ts|index.ts]] ~L1815) só pré-gera **`cancelado`** e
**`desconto`**. E o `enrichWithPreClips` (dvr-cftv.controller.ts ~L342) filtra por:
```js
const TIPOS_PRE = new Set(['CANC. ITEM', 'CANC. CUPOM', 'CANC. VENDA', 'DESCONTO']);
```
Busca por finalizadora (ex: "funcionario", "pix", "credito") → `tipo = 'FINALIZADORA'` →
**fora da lista** → Play sempre roxo, por mais clipe que exista no disco. Idem `PRODUTO`
(ex: "bala"). Pra cobrir, precisa entrar nos **dois** lugares.

### 1788 clipes `failed` — feature morta e não se recupera sozinha
Durante os ~2 meses de DVR inalcançável, o cron falhou em tudo e marcou `failed`.
```js
if (existing && existing.clip_status === 'failed') { skipCount++; continue; }  // NUNCA retenta
```
Mesmo com o DVR OK, esses 1788 estão condenados. Só volta com:
```sql
UPDATE dvr_pos_event_clips SET clip_status=NULL, clip_retry_count=0
 WHERE clip_status='failed' AND event_time > NOW() - INTERVAL '48 hours';
```
> ⚠️ Só faz sentido nas últimas 48h — é a janela que o cron varre e a retenção do clipe.

### Custo real de gerar em massa (medido 15/07)
| | |
|---|---|
| Câmera **FACIAL** | `2880x1616` H.265 @ 12.7Mbit/s → **0.675x** (clipe de 126s = **187s**) |
| Câmeras de **PDV** | baixa resolução @ ~1Mbit/s → **1.01x** (clipe de 130s = **~130s**) |
| Tamanho médio | **~15MB**/clipe |
| VPS | **4 núcleos**, **12 backends** de clientes, 132GB livres |

**Disco não é gargalo — CPU é.** ~230 eventos (5 dias de "bala") ≈ **8h de ffmpeg** nos 4
núcleos, degradando os outros 11 clientes. Em massa: `nice` + 1 por vez + madrugada.

### `start = transactionDate` — o "Tempo ANTES" não aparece no vídeo
`generateClip` (dvr-cftv.service.ts ~L1850) faz `start = transactionDate` e
`end = start + duration`. O front manda `duration = antes + depois`, mas **nada é subtraído**:
o clipe começa **no** evento. O "Tempo ANTES do evento (s)" da tela não tem efeito prático.

## 🧰 Armadilhas de shell que queimaram tempo aqui

1. **`date -d "$T +${N} seconds"` lê `+130` como fuso `+13:00`** → `endtime` **antes** do
   `starttime` → DVR devolve `404 Not Found`. Sempre calcular em epoch:
   ```bash
   EPOCH=$(date -d "$TIME" +%s)
   END=$(date -d "@$((EPOCH + DUR))" +%Y_%m_%d_%H_%M_%S)
   ```
2. **`docker exec` sem `-i`** = psql/stdin vazio → heredoc SQL some **sem erro**.
3. **`ffmpeg` lê stdin** e morre em loop `while read` → usar **`-nostdin`**.
4. Silenciar `2>&1 >/dev/null` no ffmpeg esconde exatamente o `404` que explica tudo.

## 🔗 Relacionados
- [[../modulos/dvr-cameras|DVR e Câmeras]]
- [[2026-07-15-tunel-dvr-chave-nao-autorizada-matava-oracle|Túnel DVR com chave não autorizada matava Oracle]]
- [[2026-05-06-dvr-tradicao-rtsp-port-quebrou|Tradição: porta RTSP errada]]

## 🏷️ Tags
#bug #dvr #rede #cgnat #iptables #tunel #tradicao
