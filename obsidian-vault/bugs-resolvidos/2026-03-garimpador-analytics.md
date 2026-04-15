# Feature: Garimpador 360 Analytics (evolução grande)

**Data:** 2026-03
**Módulo:** [[../modulos/garimpador|Garimpador]]

## 🎯 O que foi entregue
Evolução massiva do Garimpador com IA e busca vetorial:

### Recursos novos
- **Busca vetorial PGVector** para matching de produtos
- **Sync semanal via cron** (toda segunda 6h BRT)
- **Config VectorStore** na UI
- **Algoritmo de matching IA** (inspirado em n8n)
- **Ranking Concorrentes** com drag-and-drop colunas
- **Fora do Mix** com ordenação e Tabloid
- **Busca híbrida** (vetorial + textual)
- **Reprocessamento** + saldo OpenAI
- **Scraping Mercado Livre** melhorado (links + vendedores)
- **Gráficos:** eixo X dias 1-31, linha Custo Loja
- **Troféu** e destaque para itens enviados no WhatsApp
- **Candidatos da IA** em TODOS os matches

## 🗄️ Tecnologia
- **PGVector** (extensão PostgreSQL) para embeddings
- **OpenAI API** para matching IA
- Renomeado de "OFERTA NO RADAR" para "GARIMPADOR 360"

## 📝 Commits chave
- `d8d1d99` — Garimpador VectorStore - busca vetorial PGVector
- `13b7414` — cron semanal VectorStore
- `da9779f` — UI config VectorStore + cron configurável
- `5c0b584` — novo algoritmo matching IA + Ranking Concorrentes
- `85abd8d` — Ranking - filtro fornecedor, multi-select, tabloid
- `1cc06ff` — Analytics - melhorias UI/UX completas
- `8beac05` — Ranking - drag-and-drop, tabloid emoji
- `d702233` — Fora do Mix - colunas ordenáveis, tabloid
- `2067d1b` — scraping ML - links e vendedores
- `198186b` — sistema de pesos para matching
- `11ca68e` — busca hibrida + reprocessamento + saldo OpenAI
- `1893ac4` — renomear OFERTA NO RADAR → GARIMPADOR 360

## 🏷️ Tags
#feature #garimpador #ia #vectorstore #pgvector #openai #2026-03
