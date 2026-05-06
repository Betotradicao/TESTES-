# 2026-05-06 — Tradição: porta RTSP errada após mexer no Nunes

## 🚨 Sintoma
Vision Palavra-Chave da Tradição: ao buscar evento → "Erro ao gerar clip: Erro ao gerar clipe de vídeo". Imagem do vídeo preta no player.

## 🔍 Diagnóstico
Logs do backend mostraram:
```
[DVR] ffmpeg stderr: rtsp://admin:beto3107%40@172.20.0.1:28554/cam/playback?... Connection refused
```

`ss -ltn` na VPS mostrou que **nenhum processo escuta na 28554**. As portas que existiam:
- `1521` (Oracle), `18080` (DVR HTTP), `28100` (DVR HTTP via 2º tunnel), `28101` (DVR RTSP via 2º tunnel)

## 🎯 Causa raiz
Quando arrumaram o DVR do Nunes em outro momento, **a porta RTSP do Tradição foi alterada no front (Configurações de Rede → DVR/CFTV) de `28101` para `28554`**. Nenhum tunnel SSH faz forward dessa porta — o forward do RTSP da Tradição rola pela `28101` (do tunnel `Loja1DVR` em `tunnels.json`).

## ✅ Correção
```sql
UPDATE configurations SET value = '28101' WHERE key = 'dvr_porta_rtsp';
```
Banco: `postgres_tradicao` na VPS 46.

Não precisou reiniciar backend — `configurations` é lida a cada request.

## 📚 Lição reutilizável
**A porta `dvr_porta_rtsp` no banco PRECISA bater com uma das portas que o `tunnels.json` da máquina cliente está fazendo `-R` na VPS.**

**Why:** O backend roda em container Docker e acessa `172.20.0.1:<porta>` (gateway pra host VPS). Se a porta não está sendo encaminhada via SSH reverse tunnel, dá `Connection refused`.

**How to apply:**
1. Antes de mudar porta DVR de qualquer cliente, sempre rodar `ss -ltn` na VPS pra ver portas ativas
2. Conferir `C:\ProgramData\SSHTunnels\tunnels.json` da máquina cliente pra ver os `-R`
3. A porta no banco DEVE estar entre os `-R` ativos
4. Mexer em config DVR de um cliente NUNCA pode afetar config de outro cliente — sempre filtrar por banco/cliente correto

Doc completo: `.claude/DVR-CFTV-TROUBLESHOOT.md`
