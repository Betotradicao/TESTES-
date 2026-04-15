# Feature: Vision PDV — integração DVR CFTV

**Data:** 2026-03
**Módulo:** [[../modulos/dvr-cameras|DVR e Câmeras]] / [[../modulos/vision-palavra-chave|Vision]]

## 🎯 O que foi entregue
Integração completa entre PDV e DVR CFTV:
- **Busca cancelamentos via Oracle** no Vision PDV
- **Vídeo DVR por PDV** — associa câmera ao terminal
- **Config dinâmica multi-cliente** (sem hardcode)
- **Configurações de Rede** para DVR (coluna "Pal. Chave 2")
- **Vision Facial + câmeras bipagens** integrados
- **Vision Operações de Risco** com vídeo DVR e colunas reordenáveis
- **Tempo antes/depois configurável** nos clipes

## 🐛 Fix importantes
- `1eaceea` — DVR usa gateway Docker (172.20.0.1) quando rodando no container
- `e83b598` — adicionar ffmpeg no Dockerfile do backend
- `9ec3969` — suporte DVR via túnel SSH (porta HTTP configurável)

## 📝 Commits chave
- `84d7977` — Vision PDV - integração DVR CFTV
- `9144555` — config dinâmica multi-cliente
- `fda8ccb` — melhorias Vision PDV, Prazo Fornecedores, Conciliação
- `49e3b6c` — busca cancelamentos via Oracle + melhorias UI
- `4adbfce` — Vision Facial + câmeras bipagens + fix DVR Docker
- `de4e726` — Vision Operações de Risco com vídeo DVR
- `7ef01ce` — Vision Facial com detecções DVR
- `319dc60` — tempo antes/depois configurável + sync câmeras

## ⚠️ Lições
- Container backend não acessa `localhost` do host → usar `172.20.0.1` (gateway Docker)
- DVR da rede local precisa de túnel SSH quando backend está em VPS
- FFmpeg **obrigatório** no Dockerfile do backend pra converter streams

## 🏷️ Tags
#feature #vision #pdv #dvr #cameras #2026-03
