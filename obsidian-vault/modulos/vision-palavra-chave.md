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

## 🏷️ Tags
#modulo #vision #busca
