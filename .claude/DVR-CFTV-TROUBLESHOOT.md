# DVR / CFTV — Como configurar e diagnosticar (Vision Palavra Chave / Bipagens)

> Este doc explica como o vídeo do DVR é exibido no sistema e como diagnosticar quando para de funcionar — pra nunca mais quebrar igual aconteceu em 06/05/2026.

---

## 🔧 Arquitetura — fluxo do vídeo

```
[Loja: DVR/Câmera]
        ↓ (rede local)
[Máquina Cliente]
        ↓ ssh -R (port-forward reverso)
[VPS Hostinger]
        ↓ ffmpeg rtsp://172.20.0.1:<porta_rtsp>
[Backend Container Docker]
        ↓ gera .mp4
[Frontend → <video src="...">]
```

O backend roda em container e acessa a VPS host via `172.20.0.1` (gateway Docker bridge). As portas do DVR não ficam expostas direto — vão por **SSH reverse tunnel** da máquina da loja → VPS.

---

## ⚙️ Onde fica cada coisa

### 1. Config de DVR no sistema (PostgreSQL do cliente)

Tabela `configurations` no banco de cada cliente. Chaves relevantes:

| Chave | Exemplo Tradição | O que é |
|---|---|---|
| `dvr_ip` | `10.6.1.123` | IP do DVR na rede local da loja (não usado pra conexão direta — só informativo no front) |
| `dvr_porta_http` | `18080` | Porta HTTP **na VPS** (forward SSH) — usada pra autenticar e listar canais |
| `dvr_porta_rtsp` | `28101` | Porta RTSP **na VPS** (forward SSH) — usada pelo ffmpeg pra puxar o stream |
| `dvr_usuario` | `admin` | Usuário do DVR |
| `dvr_senha` | `***` | Senha do DVR |
| `dvr_codec_mode` | `transcode` | `copy` (mesmo codec) ou `transcode` (converte H.265→H.264) |
| `dvr_canais` | JSON | Mapeamento de canais físicos do DVR → nomes/PDVs |
| `dvr_cameras_pdv` | JSON | Quais canais associar a quais PDVs (Vision PDV) |
| `dvr_cameras_risco` | JSON | Quais canais usar para Vision Palavra-Chave (operações de risco) |
| `dvr_cameras_bipagens` | JSON | Quais canais associar às bipagens |

**As portas HTTP/RTSP nunca apontam pro IP do DVR direto** — apontam pra **portas locais da VPS** que o tunnel SSH abre.

### 2. Túneis SSH (na máquina da loja)

Arquivo: `C:\ProgramData\SSHTunnels\tunnels.json`

Cada entrada vira uma sessão `ssh -R porta_vps:ip_dvr_local:porta_dvr_local` rodando 24/7. Exemplo Tradição:

```json
{
  "name": "Tradicao",
  "key": "C:\\ProgramData\\SSHTunnels\\tunnel_key",
  "forwards": "-R 1521:10.6.1.100:1521 -R 18080:10.6.1.123:80",
  "healthUrl": "https://tradicao.prevencaonoradar.com.br/api/health"
}
{
  "name": "Loja1DVR",
  "key": "C:\\ProgramData\\SSHTunnels-Loja1DVR\\tunnel_key",
  "forwards": "-R 28100:10.6.1.123:80 -R 28101:10.6.1.123:554"
}
```

**Tradução do exemplo:**
- `1521 (VPS) → 10.6.1.100:1521 (Oracle do supermercado)`
- `18080 (VPS) → 10.6.1.123:80 (DVR HTTP)`
- `28100 (VPS) → 10.6.1.123:80 (DVR HTTP — duplicado, via segundo tunnel)`
- `28101 (VPS) → 10.6.1.123:554 (DVR RTSP)` ← **única porta de RTSP escutando**

> **REGRA DE OURO:** A porta `dvr_porta_rtsp` no banco TEM que bater com uma das portas que o `tunnels.json` está escutando na VPS via `-R`. Se não bater = `Connection refused` no ffmpeg = `Erro ao gerar clipe`.

### 3. Checar quais portas estão escutando na VPS

```bash
ssh vps2-hostinger "ss -ltn | grep -E ':1521|:18080|:28100|:28101|:28554|:554'"
```

Se a porta `dvr_porta_rtsp` configurada no banco **não aparecer** nessa lista, o vídeo NÃO vai funcionar.

---

## 🚨 Procedimento de diagnóstico — "vídeo não carrega / cai"

Quando o usuário reportar `Erro ao gerar clipe de vídeo` no Vision:

### Passo 1 — Olhar log do backend e identificar o erro do ffmpeg

```bash
ssh vps2-hostinger "docker logs prevencao-<CLIENTE>-backend --since 30m 2>&1 | grep -iE 'clip|ffmpeg|rtsp' | tail -20"
```

Procurar pela linha `[DVR] ffmpeg stderr (last 500 chars):`. Os erros típicos:

| Mensagem | Causa | Solução |
|---|---|---|
| `Connection refused` na porta RTSP | Tunnel SSH não está escutando aquela porta | Comparar `dvr_porta_rtsp` no banco com `ss -ltn` na VPS |
| `401 Unauthorized` | usuário/senha errados | Conferir `dvr_usuario` e `dvr_senha` |
| `Connection timed out` | tunnel caiu / DVR offline | Reiniciar tunnel manager na máquina cliente |
| `Invalid data found when processing input` | Codec incompatível | Mudar `dvr_codec_mode` de `copy` para `transcode` |
| `404 Not Found` na URL playback | Modelo de DVR usa URL diferente | Ver seção "URLs por modelo de DVR" abaixo |

### Passo 2 — Validar config no banco

```bash
ssh vps2-hostinger "docker exec prevencao-<CLIENTE>-postgres psql -U postgres -d postgres_<CLIENTE> -c \"SELECT key, value FROM configurations WHERE key ILIKE '%dvr%' ORDER BY key;\""
```

### Passo 3 — Conferir tunnel.json

```powershell
cat C:\ProgramData\SSHTunnels\tunnels.json
```

Garantir que existe um forward `-R <dvr_porta_rtsp>:<ip_local_dvr>:554` (ou 80 pra HTTP).

### Passo 4 — Checar se túnel está vivo

```bash
ssh vps2-hostinger "ss -ltn | grep -E ':18080|:28100|:28101|:28554'"
```

Se não estiver listando, reiniciar o tunnel manager:

```powershell
schtasks /run /tn "SSHTunnelManager"
```

### Passo 5 — Atualizar config se a porta estiver errada

```bash
ssh vps2-hostinger "docker exec prevencao-<CLIENTE>-postgres psql -U postgres -d postgres_<CLIENTE> -c \"UPDATE configurations SET value = '<PORTA_CORRETA>' WHERE key = 'dvr_porta_rtsp';\""
```

**Não precisa reiniciar backend** — `configurations` é lida a cada request.

---

## 📋 Configuração por cliente (estado atual em 06/05/2026)

### Tradição

| Item | Valor |
|---|---|
| DVR modelo | Intelbras MIB 1116 (16 canais) |
| IP local | 10.6.1.123 |
| Usuário | admin |
| Senha | beto3107@ |
| **Porta HTTP (banco)** | `18080` |
| **Porta RTSP (banco)** | `28101` ← mudada de 28554 em 06/05/2026 (bagunçou ao arrumar Nunes) |
| Codec mode | `transcode` (DVR grava em H.265, transcodifica pra H.264) |
| Tunnels que abrem essas portas | `Tradicao` (18080) + `Loja1DVR` (28100, 28101) |
| Máquina cliente | Esta máquina aqui — Windows Server 2019, IP 10.6.1.171 |

### Nunes

DVR diferente — modelo distinto do Tradição. **Funciona mas usa URL/protocolo próprio.** Deve ter sido configurado no `dvr-cftv.service.ts` com lógica específica via `dvr_modelo` ou similar. Ao mexer no Nunes em 06/05, o config DVR do Tradição foi acidentalmente apontado pra porta 28554 (que não tinha tunnel) → quebrou.

> ⚠️ **AVISO**: ao mexer em DVR de um cliente, sempre confirmar que **NADA mexeu no banco/config de outro cliente**.

### MaxValle, SuperVital, Idealmix

DVR a confirmar / ainda não testado a fundo.

### Mameva

Cliente demo, sem DVR físico.

---

## 🌐 URLs RTSP por modelo de DVR

Diferentes fabricantes usam paths RTSP diferentes. O backend precisa montar a URL certa.

| Fabricante | URL playback (gravado) | URL live (ao vivo) |
|---|---|---|
| Intelbras MHDX/MIB | `rtsp://user:pass@ip:port/cam/playback?channel=N&starttime=YYYY_MM_DD_HH_MM_SS&endtime=...` | `rtsp://user:pass@ip:port/cam/realmonitor?channel=N&subtype=0` |
| Hikvision | `rtsp://user:pass@ip:port/Streaming/tracks/N01/?starttime=YYYYMMDDTHHMMSSZ&endtime=...` | `rtsp://user:pass@ip:port/Streaming/Channels/N01` |
| Dahua | (similar Intelbras) `rtsp://user:pass@ip:port/cam/playback?...` | `rtsp://user:pass@ip:port/cam/realmonitor?...` |
| Genérico ONVIF | depende do device | `rtsp://user:pass@ip:port/onvif/profile1/media.smp` |

> Tradição é Intelbras → usa `cam/playback`. Caso clientes futuros tenham Hikvision, vai precisar ramificar no `dvr-cftv.service.ts` baseado em `dvr_marca` ou `dvr_modelo`.

---

## 🛡️ Boas práticas pra não quebrar de novo

1. **Nunca alterar a porta RTSP/HTTP no front sem antes verificar `tunnels.json` da máquina cliente.** Front mostra/edita o que está no banco — se a porta nova não tem tunnel, vai dar `Connection refused`.

2. **Antes de fazer qualquer mudança em DVR de um cliente**, anotar:
   - Cliente atual + porta atual
   - Cliente que vai mexer + porta dele
   - Confirmar que NÃO confundiu os dois.

3. **Sempre validar com `ss -ltn` na VPS depois da mudança** — porta tem que aparecer escutando.

4. **Manter este doc atualizado**: ao adicionar cliente novo ou mudar config, registrar na seção "Configuração por cliente".

5. **Em caso de dúvida**, rodar o script de diagnóstico do Passo 1–4 acima antes de tocar em config.

---

## 📝 Histórico de incidentes

### 2026-05-06 — Tradição: vídeo não gera após arrumar Nunes
- **Sintoma**: `Erro ao gerar clipe: ffmpeg exit code 1` → `Connection refused` em `172.20.0.1:28554`
- **Causa**: ao arrumar config DVR do Nunes, a porta RTSP do Tradição foi alterada de `28101` (válida) para `28554` (sem tunnel correspondente na VPS)
- **Solução**: `UPDATE configurations SET value = '28101' WHERE key = 'dvr_porta_rtsp'` no banco do Tradição
- **Lição**: sempre conferir qual porta os túneis SSH estão escutando antes de mudar config. A porta no banco PRECISA bater com o `-R` do tunnels.json.
