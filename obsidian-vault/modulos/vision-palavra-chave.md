# Vision Palavra-Chave

Ferramenta de busca por palavra-chave em cupons fiscais e vendas, com foco em "achar agulha no palheiro" (cupom específico, transação suspeita, etc).

## 📂 Arquivos
- **Frontend:** `packages/frontend/src/pages/VisionPalavraChave.jsx`, `VisionPalavraChave2.jsx`
- **Backend:** controllers/services relacionados a busca de cupons

## 🎯 O que faz
- Busca livre por termo/código em cupons, vendas, NFs
- Suporta filtros de período, loja, tipo de venda
- Botões de atalho: **Cartão POS** e **iFood** (adicionados recentemente)

## 🔍 Recursos especiais
- Busca em Oracle (Intersolid) respeitando range de datas
- Exibe itens de **CANC. VENDA** em `getCupomByTime`
- Expõe itens cancelados e com desconto no rodapé do cupom

## ⚡ Pre-geracao de clipes DVR (botao Play verde)

Cron a cada 2h pre-gera os clipes dos 4 tipos visiveis na tela: **CANC. ITEM, CANC. CUPOM, CANC. VENDA, DESCONTO**. Quando o clipe esta pronto, o botao Play vira **verde** com check ✓ e o video toca instantaneo (sem chamar ffmpeg na hora). Retencao 2 dias, igual Bipagens.

- Tabela: `dvr_pos_event_clips` (idempotente via `event_key`)
- Cron geracao: `0 */2 * * *` em `index.ts`
- Cron limpeza: `5 3 * * *` (apaga MP4 + remove registro >2 dias)
- Detalhes: [[../bugs-resolvidos/2026-05-pre-clipes-vision-palavra-chave|Pre-clipes Vision Palavra-Chave]]

## 🏷️ Tags
#modulo #vision #busca
