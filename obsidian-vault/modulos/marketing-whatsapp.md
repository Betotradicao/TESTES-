# Marketing WhatsApp

Integração com Evolution API para disparos de WhatsApp.

## 📂 Arquivos
- `MarketingWhatsapp.jsx` — configuração e campanhas
- `DisparoWhatsapp.jsx` — disparo em massa

## 🔌 Integração
- **Evolution API** (provedor de WhatsApp)
- Configs pré-populadas no seed: `evolution_server_url`, `evolution_api_key` (ver `seed-configurations.ts`)

## 🚨 Bot mudo? Cheque o webhook ANTES do código
```bash
docker logs --since 6h prevencao-<cliente>-backend | grep -ciE 'disparo-whatsapp/webhook'
```
**Zero** = a Evolution não está chamando a gente → é registro de webhook, não código.
Registrar: `POST /api/disparo-whatsapp/setup-webhook`.
Causa-raiz completa e armadilhas (token criptografado, enum de eventos, 1 webhook por
instância): [[../bugs-resolvidos/2026-07-20-chatbot-mudo-webhook-evolution]]

## 🔁 Menu reaparecendo a cada resposta?
`intervalo_menu_horas` no fluxo controla de quanto em quanto tempo o menu pode ir pro MESMO
contato (0 = sempre). O fluxo volta pro menu sozinho após responder uma opção — o laço de
renderização respeita o cooldown e, quando cala, **mantém a sessão apontada pro menu** pra
que as opções sigam valendo. Detalhe em
[[../bugs-resolvidos/2026-07-20-chatbot-mudo-webhook-evolution]] (PARTE B).

## 🔑 Configs (tabela `configurations`, valores criptografados)
`disparo_whats_url` · `disparo_whats_instancia` (Tradição = `MARKETING`) · `disparo_whats_token`
Instância do chatbot vem do fluxo (`instance_name`); vazio = cai no `disparo_whats_instancia`.

## 🏷️ Tags
#modulo #marketing #whatsapp #evolution
