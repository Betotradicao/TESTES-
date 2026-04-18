# 🚧 Trabalho em Andamento

## 🎯 Status ao encerrar sessão (16/04/2026)

### ✅ Concluído e commitado
- **Gestão Inteligente**: fix tiposSaida (NF Transferência não contamina mais)
- **Compra x Venda**: Dif Anual nos itens preenchido
- **Obsidian Vault**: 54 notas, skills Kepano, CLAUDE.md com regras
- **Vision Palavra-Chave (Nunes)**: CANC Item/Cupom/Venda + Desconto agrupado + hora HH:MM:SS + nome operador + itens com desconto em vermelho na notinha
- **DVR codec toggle**: select copy/transcode na tela Config Rede DVR/CFTV

### 🔴 Pendente: vídeo DVR do Tradição
**Problema:** DVR do Tradição atualizou firmware e agora grava em **HEVC (H.265)** — antes era H.264.
- FFmpeg transcoda OK no CLI (gera MP4 H.264 válido, confirmado via ffprobe)
- Streaming pipe → browser falha (browser desconecta antes de receber frames)
- Generate-clip (arquivo primeiro) funciona no backend mas frontend precisa debug

**Próximos passos (por ordem de facilidade):**
1. **Reconfigurar DVR Tradição pra H.264** — painel web do DVR, trocar codec das câmeras. 5 min. Resolve definitivamente.
2. **Debug do flow generate-clip → browser** — validar URL, autenticação, timeout no F12 Console
3. **Testar sub-stream H.264** — se DVR mantiver HEVC no main, usar sub-stream

### ⚠️ Túnel Nunes OFFLINE
Portas 38100/38101/10835 não estão LISTEN na VPS. Provável que máquina Windows da loja desligou. Quando ligar, serviço SSH deve reconectar automático. Se não, rodar .BAT do túnel manualmente.

### 📦 Deploys realizados
- ✅ Nunes (backend + frontend) — filtros CANC/Desconto + codec toggle
- ✅ Tradição (backend + frontend) — codec toggle
- ✅ SuperVital (backend + frontend) — tiposSaida + Dif Anual (início da sessão)
- ✅ MaxValle (frontend + backend) — deploy geral (início da sessão)

### ⚠️ Estado do repositório
Branch `TESTE`, 4 commits pushados nesta sessão. Sem alterações pendentes de código.
