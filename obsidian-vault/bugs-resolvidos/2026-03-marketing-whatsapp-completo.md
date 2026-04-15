# Feature: Marketing WhatsApp (módulo completo)

**Data:** 2026-03 (vários commits)
**Módulo:** [[../modulos/marketing-whatsapp|Marketing WhatsApp]]

## 🎯 O que foi entregue
Módulo completo de marketing via WhatsApp com:
- **Disparo em massa** para clientes opt-in
- **Múltiplas imagens** por disparo
- **Aba Entregas** com status (entregue/lido/erro)
- **Listas** de contatos segmentadas
- **Stats reais** + tabela de mensagens capturadas

## 🔌 Integração
**Evolution API** (webhook) — configurado em `seed-configurations.ts`:
- `evolution_server_url`
- `evolution_api_key`

## 📝 Commits chave
- `6629fc8` — Disparo em Massa WhatsApp - sistema completo
- `5a82932` — Listas, múltiplas imagens, webhook Evolution API
- `e03a34b` — Aba Entregas
- `7e3c457` — Menu Marketing no Radar
- `3b15630` — Stats reais + tabela mensagens capturadas
- `e5d0aeb` — Busca real de broadcasts + status de entrega

## ⚠️ Lições
- Opt-in é obrigatório por compliance
- Evolution API precisa estar rodando com URL/key válidas (seed popula default mas cada cliente sobrescreve)

## 🏷️ Tags
#feature #marketing #whatsapp #evolution #2026-03
